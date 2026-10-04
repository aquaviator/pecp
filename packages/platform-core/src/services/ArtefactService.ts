// ArtefactService
// Defined according to Real Strategy and Test Plan Workflow

import { createHash, randomUUID } from 'node:crypto';
import {
  EngineeringArtefact,
  ArtefactType,
  IntelligenceItem,
  PerformanceContract,
  ArtefactStalenessResult
} from '@pecp/pe-domain';
import {
  generatePerformanceStrategy,
  generatePerformanceTestPlan,
  evaluateArtefactStaleness,
  checkAndTagArtefactStaleness,
  exportArtefactToMarkdown
} from '@pecp/artefact-engine';
import {
  AuthenticatedPrincipal,
  SavedArtefactRecord,
  SavedArtefactRevisionRecord,
  GenerateArtefactInput,
  ArtefactDetailResponse,
  ArtefactListItem,
  ArtefactRevisionSummary
} from '../types.js';
import { IArtefactRepository } from '../repositories/IArtefactRepository.js';
import { IProjectRepository } from '../repositories/IProjectRepository.js';
import { IIntelligenceRepository } from '../repositories/IIntelligenceRepository.js';
import { IOrganisationMembershipRepository } from '../repositories/IOrganisationMembershipRepository.js';
import { IIdempotencyRepository } from '../repositories/IIdempotencyRepository.js';
import { IUnitOfWork } from '../transactions/IUnitOfWork.js';
import { PerformanceContractService } from './PerformanceContractService.js';
import { AuditService } from './AuditService.js';
import { AuthorizationPolicy } from './AuthorizationPolicy.js';

export interface ArtefactServiceOptions {
  artefactRepository: IArtefactRepository;
  performanceContractService: PerformanceContractService;
  projectRepository: IProjectRepository;
  intelligenceRepository: IIntelligenceRepository;
  membershipRepository?: IOrganisationMembershipRepository;
  idempotencyRepository?: IIdempotencyRepository;
  auditService: AuditService;
  unitOfWork?: IUnitOfWork;
  clock?: () => string;
}

export class ArtefactService {
  private readonly artefactRepo: IArtefactRepository;
  private readonly contractService: PerformanceContractService;
  private readonly projectRepo: IProjectRepository;
  private readonly intelligenceRepo: IIntelligenceRepository;
  private readonly membershipRepo?: IOrganisationMembershipRepository;
  private readonly idempotencyRepo?: IIdempotencyRepository;
  private readonly auditService: AuditService;
  private readonly unitOfWork?: IUnitOfWork;
  private readonly clock: () => string;

  constructor(options: ArtefactServiceOptions) {
    this.artefactRepo = options.artefactRepository;
    this.contractService = options.performanceContractService;
    this.projectRepo = options.projectRepository;
    this.intelligenceRepo = options.intelligenceRepository;
    this.membershipRepo = options.membershipRepository;
    this.idempotencyRepo = options.idempotencyRepository;
    this.auditService = options.auditService;
    this.unitOfWork = options.unitOfWork;
    this.clock = options.clock || (() => new Date().toISOString());
  }

  private async assertProjectAccess(
    projectId: string,
    principal: AuthenticatedPrincipal,
    requiredRole: 'READ' | 'WRITE'
  ): Promise<{ orgId: string }> {
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      const err = new Error(`Project '${projectId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    const orgId = project.organisationId || '';

    // Check platform admin
    if (principal.platformRole === 'PLATFORM_ADMIN') {
      return { orgId };
    }

    const membership = principal.memberships.find(
      (m) => m.organisationId === orgId
    );
    if (!membership) {
      const err = new Error('Access denied: principal does not belong to project organisation');
      (err as any).statusCode = 403;
      throw err;
    }

    if (requiredRole === 'WRITE') {
      // Read-only viewers and reviewers cannot generate artefacts
      if (membership.role === 'VIEWER' || membership.role === 'REVIEWER') {
        const err = new Error('Access denied: insufficient role to generate or update artefacts');
        (err as any).statusCode = 403;
        throw err;
      }
    }

    return { orgId };
  }

  private computeInputRevisionDigest(
    contractFingerprint: string,
    items: IntelligenceItem[]
  ): string {
    const sorted = [...items].sort((a, b) => a.key.localeCompare(b.key));
    const summary = sorted.map((i) => ({
      id: i.id,
      key: i.key,
      revision: i.revision ?? 1,
      canonicalState: i.canonicalState,
      reviewStatus: i.reviewStatus,
      approvalState: i.approvalState,
      approvalRevision: i.activeApprovalSnapshot?.revision,
      value: i.value,
      unit: i.unit
    }));

    return createHash('sha256')
      .update(JSON.stringify({ contractFingerprint, summary }))
      .digest('hex');
  }

  /**
   * Deterministically generates or regenerates a Performance Strategy or Test Plan artefact.
   */
  async generateArtefact(
    projectId: string,
    input: GenerateArtefactInput,
    principal: AuthenticatedPrincipal
  ): Promise<ArtefactDetailResponse> {
    const { orgId } = await this.assertProjectAccess(projectId, principal, 'WRITE');

    if (
      input.artefactType !== 'PERFORMANCE_STRATEGY' &&
      input.artefactType !== 'PERFORMANCE_TEST_PLAN'
    ) {
      const err = new Error(
        `Invalid artefactType '${input.artefactType}'. Must be 'PERFORMANCE_STRATEGY' or 'PERFORMANCE_TEST_PLAN'`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    // 1. Handle Idempotency check if key provided
    const idempotencyKey = input.idempotencyKey;
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          projectId,
          artefactType: input.artefactType,
          expectedContractFingerprint: input.expectedContractFingerprint ?? null,
          author: input.author ?? null
        })
      )
      .digest('hex');

    if (idempotencyKey && this.idempotencyRepo) {
      const existingRecord = await this.idempotencyRepo.get(idempotencyKey);
      if (existingRecord) {
        if (existingRecord.payloadSha256 !== payloadHash) {
          const err = new Error(
            `Idempotency key mismatch: Key '${idempotencyKey}' was previously used with a different request payload.`
          );
          (err as any).statusCode = 409;
          throw err;
        }
        // Return existing stored response
        return JSON.parse(existingRecord.responseJson);
      }
    }

    // 2. Fetch project summary
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      const err = new Error(`Project '${projectId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    // 3. Compile authoritative Performance Contract
    const compilationResult = await this.contractService.compileProjectPerformanceContract(
      projectId,
      principal
    );

    // 4. Validate client expectation if provided
    if (
      input.expectedContractFingerprint &&
      input.expectedContractFingerprint !== compilationResult.fingerprint
    ) {
      const err = new Error(
        `Precondition Failed: Stale contract expectation. Expected contract fingerprint "${input.expectedContractFingerprint}" does not match live contract fingerprint "${compilationResult.fingerprint}". Refresh contract state before generating.`
      );
      (err as any).statusCode = 409;
      throw err;
    }

    // 5. Read project intelligence items
    const intelligenceItems = await this.intelligenceRepo.listByProject(projectId);
    const inputDigest = this.computeInputRevisionDigest(
      compilationResult.fingerprint,
      intelligenceItems
    );

    // 6. Check existing artefact record to determine revision
    const existingArtefact = await this.artefactRepo.getByType(projectId, input.artefactType);
    const nextRevisionNumber = existingArtefact ? existingArtefact.currentRevisionNumber + 1 : 1;
    const artefactId =
      existingArtefact?.id ||
      `artefact-${input.artefactType === 'PERFORMANCE_STRATEGY' ? 'strategy' : 'testplan'}-${projectId}`;

    const versionString = `v${nextRevisionNumber}.0-draft`;
    const generationTime = this.clock();

    // 7. Invoke deterministic generator
    const genOptions = {
      contract: compilationResult.contract,
      intelligenceItems,
      projectSummary: project,
      artefactVersion: versionString,
      author: input.author || principal.displayName,
      organisation: project.organisation,
      generationTimestamp: generationTime
    };

    let generatedArtefact: EngineeringArtefact;
    if (input.artefactType === 'PERFORMANCE_STRATEGY') {
      generatedArtefact = generatePerformanceStrategy(genOptions);
    } else {
      generatedArtefact = generatePerformanceTestPlan(genOptions);
    }

    // Ensure artefact ID matches canonical ID
    generatedArtefact.id = artefactId;
    generatedArtefact.projectId = projectId;
    generatedArtefact.projectName = project.name;

    // 8. Generate markdown export
    const markdown = exportArtefactToMarkdown(generatedArtefact);

    const revisionId = `art-rev-${randomUUID()}`;
    const savedArtefact: SavedArtefactRecord = {
      id: artefactId,
      projectId,
      organisationId: orgId,
      artefactType: input.artefactType,
      title: generatedArtefact.title,
      currentRevisionNumber: nextRevisionNumber,
      currentRevisionId: revisionId,
      createdAt: existingArtefact?.createdAt || generationTime,
      updatedAt: generationTime,
      createdByUserId: existingArtefact?.createdByUserId || principal.userId,
      createdByUserDisplayName: existingArtefact?.createdByUserDisplayName || principal.displayName
    };

    const savedRevision: SavedArtefactRevisionRecord = {
      id: revisionId,
      artefactId,
      projectId,
      organisationId: orgId,
      artefactType: input.artefactType,
      revisionNumber: nextRevisionNumber,
      status: generatedArtefact.status,
      sourceContractId: generatedArtefact.sourceContractId,
      sourceContractVersion: generatedArtefact.sourceContractVersion,
      sourceContractFingerprint: generatedArtefact.sourceContractFingerprint,
      inputRevisionDigest: inputDigest,
      generationMetadataJson: JSON.stringify({
        author: genOptions.author,
        organisation: genOptions.organisation,
        generationTimestamp: generationTime
      }),
      contentJson: JSON.stringify(generatedArtefact),
      markdownExport: markdown,
      recordedAt: generationTime,
      actorUserId: principal.userId,
      actorDisplayName: principal.displayName
    };

    // 9. Persist using Unit of Work if available
    const executeSave = async () => {
      await this.artefactRepo.saveArtefactWithRevision(savedArtefact, savedRevision);

      // Audit event
      await this.auditService.record({
        actor: principal,
        organisationId: orgId,
        projectId,
        action: nextRevisionNumber === 1 ? 'ARTEFACT_GENERATE' : 'ARTEFACT_REGENERATE',
        targetType: 'ENGINEERING_ARTEFACT',
        targetId: artefactId,
        outcome: 'SUCCESS',
        metadata: {
          artefactType: input.artefactType,
          revisionNumber: nextRevisionNumber,
          sourceContractFingerprint: generatedArtefact.sourceContractFingerprint
        }
      });
    };

    if (this.unitOfWork) {
      await this.unitOfWork.execute(executeSave);
    } else {
      await executeSave();
    }

    // 10. Prepare detail response
    const revisionsList = await this.artefactRepo.listRevisions(projectId, artefactId);
    const revisionSummaries: ArtefactRevisionSummary[] = revisionsList.map((r) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      status: r.status,
      recordedAt: r.recordedAt,
      actorDisplayName: r.actorDisplayName,
      sourceContractFingerprint: r.sourceContractFingerprint
    }));

    const staleness: ArtefactStalenessResult = {
      isStale: false,
      reasons: [],
      currentContractVersion: compilationResult.contract.version,
      artefactContractVersion: generatedArtefact.sourceContractVersion,
      currentContractFingerprint: compilationResult.fingerprint,
      artefactContractFingerprint: generatedArtefact.sourceContractFingerprint
    };

    const response: ArtefactDetailResponse = {
      artefact: generatedArtefact,
      staleness,
      currentRevisionNumber: nextRevisionNumber,
      revisions: revisionSummaries
    };

    // Record idempotency response if applicable
    if (idempotencyKey && this.idempotencyRepo) {
      await this.idempotencyRepo.save({
        key: idempotencyKey,
        projectId,
        actorUserId: principal.userId,
        operation: 'ARTEFACT_GENERATE',
        payloadSha256: payloadHash,
        responseStatus: 201,
        responseJson: JSON.stringify(response),
        createdAt: generationTime
      });
    }

    return response;
  }

  /**
   * Lists all artefacts for a project, evaluating staleness against live contract.
   */
  async listArtefacts(
    projectId: string,
    principal: AuthenticatedPrincipal
  ): Promise<ArtefactListItem[]> {
    await this.assertProjectAccess(projectId, principal, 'READ');

    const artefacts = await this.artefactRepo.listByProject(projectId);
    if (artefacts.length === 0) {
      return [];
    }

    const compilationResult = await this.contractService.compileProjectPerformanceContract(
      projectId,
      principal
    );

    const items: ArtefactListItem[] = [];
    for (const art of artefacts) {
      const currentRev = await this.artefactRepo.getRevision(
        projectId,
        art.id,
        art.currentRevisionNumber
      );
      if (!currentRev) continue;

      const parsedArtefact: EngineeringArtefact = JSON.parse(currentRev.contentJson);
      const staleness = evaluateArtefactStaleness(parsedArtefact, compilationResult.contract);

      // Check supplementary narrative intelligence changes
      const currentIntelligence = await this.intelligenceRepo.listByProject(projectId);
      const currentInputDigest = this.computeInputRevisionDigest(
        compilationResult.fingerprint,
        currentIntelligence
      );
      if (
        currentRev.inputRevisionDigest &&
        currentRev.inputRevisionDigest !== currentInputDigest &&
        !staleness.isStale
      ) {
        staleness.isStale = true;
        staleness.reasons.push(
          'Supplementary project intelligence (architecture, environment, or narrative context) changed since artefact generation.'
        );
      }

      items.push({
        id: art.id,
        projectId: art.projectId,
        artefactType: art.artefactType,
        title: art.title,
        currentRevisionNumber: art.currentRevisionNumber,
        status: staleness.isStale ? 'STALE' : currentRev.status,
        staleness,
        updatedAt: art.updatedAt
      });
    }

    return items;
  }

  /**
   * Retrieves a specific artefact or revision, evaluating freshness against live contract.
   */
  async getArtefact(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number,
    principal?: AuthenticatedPrincipal
  ): Promise<ArtefactDetailResponse> {
    if (principal) {
      await this.assertProjectAccess(projectId, principal, 'READ');
    }

    // Resolve by ID or Type
    let artefactRecord = await this.artefactRepo.getById(projectId, artefactIdOrType);
    if (!artefactRecord) {
      artefactRecord = await this.artefactRepo.getByType(projectId, artefactIdOrType);
    }

    if (!artefactRecord) {
      const err = new Error(`Artefact '${artefactIdOrType}' not found for project '${projectId}'`);
      (err as any).statusCode = 404;
      throw err;
    }

    const targetRevNumber = revisionNumber ?? artefactRecord.currentRevisionNumber;
    const revRecord = await this.artefactRepo.getRevision(
      projectId,
      artefactRecord.id,
      targetRevNumber
    );

    if (!revRecord) {
      const err = new Error(
        `Revision ${targetRevNumber} not found for artefact '${artefactRecord.id}'`
      );
      (err as any).statusCode = 404;
      throw err;
    }

    const compilationResult = await this.contractService.compileProjectPerformanceContract(
      projectId,
      principal
    );

    const originalArtefact: EngineeringArtefact = JSON.parse(revRecord.contentJson);
    const staleness = evaluateArtefactStaleness(originalArtefact, compilationResult.contract);

    // Also check narrative/input digest
    const currentIntelligence = await this.intelligenceRepo.listByProject(projectId);
    const currentInputDigest = this.computeInputRevisionDigest(
      compilationResult.fingerprint,
      currentIntelligence
    );
    if (
      revRecord.inputRevisionDigest &&
      revRecord.inputRevisionDigest !== currentInputDigest &&
      !staleness.isStale
    ) {
      staleness.isStale = true;
      staleness.reasons.push(
        'Supplementary project intelligence (architecture, environment, or narrative context) changed since artefact generation.'
      );
    }

    // Tag staleness in memory without mutating stored record
    const projectedArtefact = checkAndTagArtefactStaleness(
      originalArtefact,
      compilationResult.contract
    );

    if (staleness.isStale && projectedArtefact.status !== 'STALE') {
      projectedArtefact.status = 'STALE';
      projectedArtefact.approvalReadiness = {
        ...projectedArtefact.approvalReadiness,
        status: 'STALE',
        canApprove: false,
        blockingReasons: [...projectedArtefact.approvalReadiness.blockingReasons, ...staleness.reasons],
        unresolvedIssuesCount:
          projectedArtefact.approvalReadiness.unresolvedIssuesCount + staleness.reasons.length
      };
    }

    const revisionsList = await this.artefactRepo.listRevisions(projectId, artefactRecord.id);
    const revisionSummaries: ArtefactRevisionSummary[] = revisionsList.map((r) => ({
      id: r.id,
      revisionNumber: r.revisionNumber,
      status: r.status,
      recordedAt: r.recordedAt,
      actorDisplayName: r.actorDisplayName,
      sourceContractFingerprint: r.sourceContractFingerprint
    }));

    return {
      artefact: projectedArtefact,
      staleness,
      currentRevisionNumber: artefactRecord.currentRevisionNumber,
      revisions: revisionSummaries
    };
  }

  /**
   * Exports an artefact revision as Markdown with header staleness warning if drifted.
   */
  async exportArtefactMarkdown(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number,
    principal?: AuthenticatedPrincipal
  ): Promise<{ filename: string; markdown: string; isStale: boolean }> {
    const detail = await this.getArtefact(projectId, artefactIdOrType, revisionNumber, principal);
    let md = exportArtefactToMarkdown(detail.artefact);

    const targetRevNumber = revisionNumber ?? detail.currentRevisionNumber;
    const isHistorical = targetRevNumber < detail.currentRevisionNumber;

    if (detail.staleness.isStale) {
      const reasonsList = detail.staleness.reasons.map((r) => `> - ${r}`).join('\n');
      const warningHeader = [
        '> ⚠️ **STALE ARTEFACT NOTICE**',
        '> Upstream Performance Contract or governing intelligence has drifted since this revision was generated.',
        reasonsList,
        '> *This historical revision is retained for audit, governance, and traceability purposes.*',
        '',
        '---',
        ''
      ].join('\n');

      md = warningHeader + md;
    } else if (isHistorical) {
      const historicalHeader = [
        `> ℹ️ **HISTORICAL REVISION NOTICE: Revision ${targetRevNumber} of ${detail.currentRevisionNumber}**`,
        '> *This is an archived historical document revision retained for audit, governance, and traceability purposes.*',
        '',
        '---',
        ''
      ].join('\n');

      md = historicalHeader + md;
    }

    const filename = `${detail.artefact.id}-${detail.artefact.version}.md`;
    return {
      filename,
      markdown: md,
      isStale: detail.staleness.isStale
    };
  }
}
