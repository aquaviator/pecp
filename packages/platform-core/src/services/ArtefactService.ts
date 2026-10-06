// ArtefactService
// Defined according to Real Strategy and Test Plan Workflow

import { createHash, randomUUID } from 'node:crypto';
import {
  EngineeringArtefact,
  ArtefactType,
  IntelligenceItem,
  PerformanceContract,
  ArtefactStalenessResult,
  GovernanceDecisionRecord,
  GovernanceDecisionSummary,
  GovernanceTargetType,
  ApprovalValidity,
  SubmitDecisionInput
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
import { IContractRevisionRepository } from '../repositories/IContractRevisionRepository.js';
import { IGovernanceDecisionRepository } from '../repositories/IGovernanceDecisionRepository.js';
import { IProjectRepository } from '../repositories/IProjectRepository.js';
import { IIntelligenceRepository } from '../repositories/IIntelligenceRepository.js';
import { IOrganisationMembershipRepository } from '../repositories/IOrganisationMembershipRepository.js';
import { IIdempotencyRepository } from '../repositories/IIdempotencyRepository.js';
import { IUnitOfWork } from '../transactions/IUnitOfWork.js';
import { PerformanceContractService } from './PerformanceContractService.js';
import { AuditService } from './AuditService.js';
import { AuthorizationPolicy, ROLE_PERMISSIONS } from './AuthorizationPolicy.js';

export interface ArtefactServiceOptions {
  artefactRepository: IArtefactRepository;
  performanceContractService: PerformanceContractService;
  projectRepository: IProjectRepository;
  intelligenceRepository: IIntelligenceRepository;
  membershipRepository?: IOrganisationMembershipRepository;
  idempotencyRepository?: IIdempotencyRepository;
  contractRevisionRepository?: IContractRevisionRepository;
  governanceDecisionRepository?: IGovernanceDecisionRepository;
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
  private readonly contractRevisionRepo?: IContractRevisionRepository;
  private readonly governanceDecisionRepo?: IGovernanceDecisionRepository;
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
    this.contractRevisionRepo = options.contractRevisionRepository;
    this.governanceDecisionRepo = options.governanceDecisionRepository;
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

    if (!project.organisationId) {
      const err = new Error(`Project '${projectId}' has no valid organisation ownership`);
      (err as any).statusCode = 400;
      throw err;
    }

    const orgId = project.organisationId;

    if (requiredRole === 'WRITE') {
      const hasPerm = AuthorizationPolicy.hasPermission(principal, 'ARTEFACT_GENERATE', orgId);
      if (!hasPerm) {
        await this.auditService.record({
          actor: principal,
          projectId,
          organisationId: orgId,
          action: 'AUTHORIZATION_DENIED',
          targetType: 'ENGINEERING_ARTEFACT',
          targetId: projectId,
          outcome: 'DENIED',
          reason: 'ARTEFACT_GENERATE permission required',
          metadata: { attemptedPermission: 'ARTEFACT_GENERATE' }
        });
        const err = new Error('ARTEFACT_GENERATE permission required');
        (err as any).statusCode = 403;
        throw err;
      }
    } else {
      const hasPerm = AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', orgId);
      if (!hasPerm) {
        await this.auditService.record({
          actor: principal,
          projectId,
          organisationId: orgId,
          action: 'AUTHORIZATION_DENIED',
          targetType: 'ENGINEERING_ARTEFACT',
          targetId: projectId,
          outcome: 'DENIED',
          reason: 'PROJECT_READ permission required',
          metadata: { attemptedPermission: 'PROJECT_READ' }
        });
        const err = new Error('PROJECT_READ permission required');
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

    // 3. Resolve governing Performance Contract (either from explicit revision or live)
    let contractRevisionNumber = input.contractRevisionNumber;
    let targetContract: PerformanceContract;
    let targetContractVersion: string;
    let targetContractFingerprint: string;

    if (contractRevisionNumber !== undefined) {
      if (!this.contractRevisionRepo) {
        throw new Error('Contract revision repository not configured');
      }
      const contractRev = await this.contractRevisionRepo.getByRevisionNumber(projectId, contractRevisionNumber);
      if (!contractRev) {
        const err = new Error(`Contract review revision ${contractRevisionNumber} not found for project '${projectId}'`);
        (err as any).statusCode = 404;
        throw err;
      }
      targetContract = JSON.parse(contractRev.contentJson);
      targetContractVersion = contractRev.version;
      targetContractFingerprint = contractRev.fingerprint;
    } else {
      const compilationResult = await this.contractService.compileProjectPerformanceContract(
        projectId,
        principal
      );
      targetContract = compilationResult.contract;
      targetContractVersion = compilationResult.contract.version;
      targetContractFingerprint = compilationResult.fingerprint;

      if (this.contractRevisionRepo) {
        const latest = await this.contractRevisionRepo.getLatestRevision(projectId);
        if (latest && latest.fingerprint === targetContractFingerprint) {
          contractRevisionNumber = latest.revisionNumber;
        }
      }
    }

    // 4. Validate client expectation if provided
    if (
      input.expectedContractFingerprint &&
      input.expectedContractFingerprint !== targetContractFingerprint
    ) {
      const err = new Error(
        `Precondition Failed: Stale contract expectation. Expected contract fingerprint "${input.expectedContractFingerprint}" does not match contract fingerprint "${targetContractFingerprint}". Refresh contract state before generating.`
      );
      (err as any).statusCode = 409;
      throw err;
    }

    // 5. Read project intelligence items
    const intelligenceItems = await this.intelligenceRepo.listByProject(projectId);
    const inputDigest = this.computeInputRevisionDigest(
      targetContractFingerprint,
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
      contract: targetContract,
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
    generatedArtefact.sourceContractId = targetContract.id;
    generatedArtefact.sourceContractVersion = targetContractVersion;
    generatedArtefact.sourceContractFingerprint = targetContractFingerprint;
    generatedArtefact.sourceContractRevisionNumber = contractRevisionNumber;

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
      sourceContractId: targetContract.id,
      sourceContractVersion: targetContractVersion,
      sourceContractFingerprint: targetContractFingerprint,
      sourceContractRevisionNumber: contractRevisionNumber,
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
      if (!AuthorizationPolicy.hasPermission(principal, 'ARTEFACT_GENERATE', orgId)) {
        const err = new Error('ARTEFACT_GENERATE permission required');
        (err as any).statusCode = 403;
        throw err;
      }

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
      sourceContractFingerprint: r.sourceContractFingerprint,
      sourceContractRevisionNumber: r.sourceContractRevisionNumber,
      activeDecision: null,
      approvalValidity: {
        isValid: false,
        state: 'NOT_APPROVED',
        reasons: ['Document revision has not been approved.'],
        activeDecision: null
      }
    }));

    const staleness: ArtefactStalenessResult = {
      isStale: false,
      reasons: [],
      currentContractVersion: targetContractVersion,
      artefactContractVersion: generatedArtefact.sourceContractVersion,
      currentContractFingerprint: targetContractFingerprint,
      artefactContractFingerprint: generatedArtefact.sourceContractFingerprint
    };

    const approvalValidity: ApprovalValidity = {
      isValid: false,
      state: 'NOT_APPROVED',
      reasons: ['Document revision has not been approved.'],
      activeDecision: null
    };

    const contentFingerprint = createHash('sha256').update(savedRevision.contentJson).digest('hex');

    const response: ArtefactDetailResponse = {
      artefact: generatedArtefact,
      staleness,
      currentRevisionNumber: nextRevisionNumber,
      contentFingerprint,
      inputRevisionDigest: savedRevision.inputRevisionDigest,
      revisions: revisionSummaries,
      activeDecision: null,
      approvalValidity,
      decisionHistory: []
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
   * Evaluates current approval validity for an artefact revision, verifying staleness and parent contract decision dependency.
   */
  private async evaluateArtefactApprovalValidity(
    projectId: string,
    artefactType: GovernanceTargetType,
    artefactId: string,
    revision: SavedArtefactRevisionRecord,
    isStale: boolean,
    stalenessReasons: string[],
    principal?: AuthenticatedPrincipal
  ): Promise<{
    activeDecision: GovernanceDecisionSummary | null;
    approvalValidity: ApprovalValidity;
    decisionHistory: GovernanceDecisionSummary[];
  }> {
    if (!this.governanceDecisionRepo) {
      return {
        activeDecision: null,
        approvalValidity: {
          isValid: false,
          state: 'NOT_APPROVED',
          reasons: ['Governance decisions repository not configured.'],
          activeDecision: null
        },
        decisionHistory: []
      };
    }

    const allDecisions = await this.governanceDecisionRepo.listDecisionsForTarget(
      projectId,
      artefactType,
      artefactId,
      revision.revisionNumber
    );

    const decisionHistory: GovernanceDecisionSummary[] = allDecisions.map((d) => ({
      id: d.id,
      decisionType: d.decisionType,
      rationale: d.rationale,
      actorDisplayName: d.actorDisplayName,
      actorUserId: d.actorUserId,
      decidedAt: d.decidedAt,
      targetContentFingerprint: d.targetContentFingerprint,
      targetInputDigest: d.targetInputDigest,
      decisionRevision: d.decisionRevision
    }));

    if (decisionHistory.length === 0) {
      return {
        activeDecision: null,
        approvalValidity: {
          isValid: false,
          state: 'NOT_APPROVED',
          reasons: ['Document revision has not been approved.'],
          activeDecision: null
        },
        decisionHistory
      };
    }

    const latestDecision = decisionHistory[decisionHistory.length - 1];

    if (latestDecision.decisionType === 'WITHDRAW') {
      return {
        activeDecision: latestDecision,
        approvalValidity: {
          isValid: false,
          state: 'WITHDRAWN',
          reasons: [`Approval was withdrawn: ${latestDecision.rationale}`],
          activeDecision: latestDecision
        },
        decisionHistory
      };
    }

    // Latest decision is APPROVE:
    // 1. Check if document is stale against live contract or intelligence
    if (isStale) {
      return {
        activeDecision: latestDecision,
        approvalValidity: {
          isValid: false,
          state: 'STALE',
          reasons:
            stalenessReasons.length > 0
              ? stalenessReasons
              : ['Governing project inputs or contract have drifted since this document was approved.'],
          activeDecision: latestDecision
        },
        decisionHistory
      };
    }

    // 2. Check governing contract revision dependency
    if (revision.sourceContractRevisionNumber !== undefined && revision.sourceContractRevisionNumber !== null) {
      try {
        const contractRev = await this.contractService.getContractReviewRevision(
          projectId,
          revision.sourceContractRevisionNumber,
          principal
        );

        if (!contractRev.approvalValidity?.isValid || contractRev.approvalValidity.state !== 'CURRENTLY_VALID') {
          return {
            activeDecision: latestDecision,
            approvalValidity: {
              isValid: false,
              state: 'PARENT_UNAPPROVED',
              reasons: [
                `Governing Performance Contract revision ${revision.sourceContractRevisionNumber} approval is not valid, has drifted, or was withdrawn.`
              ],
              activeDecision: latestDecision
            },
            decisionHistory
          };
        }

        // Track document dependency on governing contract decision so parent withdrawal and re-approval doesn't resurrect child approval
        let recordedParentDecisionId: string | null = null;
        try {
          const parsed = JSON.parse(latestDecision.targetInputDigest);
          recordedParentDecisionId = parsed.parentContractDecisionId || null;
        } catch {
          // fallback
        }

        if (
          recordedParentDecisionId &&
          contractRev.activeDecision &&
          contractRev.activeDecision.id !== recordedParentDecisionId
        ) {
          return {
            activeDecision: latestDecision,
            approvalValidity: {
              isValid: false,
              state: 'PARENT_UNAPPROVED',
              reasons: [
                'Governing Performance Contract revision was withdrawn and re-approved; downstream document requires explicit re-approval.'
              ],
              activeDecision: latestDecision
            },
            decisionHistory
          };
        }
      } catch {
        return {
          activeDecision: latestDecision,
          approvalValidity: {
            isValid: false,
            state: 'PARENT_UNAPPROVED',
            reasons: ['Governing Performance Contract review revision could not be resolved.'],
            activeDecision: latestDecision
          },
          decisionHistory
        };
      }
    } else {
      return {
        activeDecision: latestDecision,
        approvalValidity: {
          isValid: false,
          state: 'PARENT_UNAPPROVED',
          reasons: ['Document was not bound to a persisted approved Performance Contract review revision.'],
          activeDecision: latestDecision
        },
        decisionHistory
      };
    }

    return {
      activeDecision: latestDecision,
      approvalValidity: {
        isValid: true,
        state: 'CURRENTLY_VALID',
        reasons: [],
        activeDecision: latestDecision,
        approvedContractRevisionNumber: revision.sourceContractRevisionNumber
      },
      decisionHistory
    };
  }

  /**
   * Lists all artefacts for a project, evaluating staleness and approval validity against live contract.
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

      const validity = await this.evaluateArtefactApprovalValidity(
        projectId,
        art.artefactType as GovernanceTargetType,
        art.id,
        currentRev,
        staleness.isStale,
        staleness.reasons,
        principal
      );

      items.push({
        id: art.id,
        projectId: art.projectId,
        artefactType: art.artefactType,
        title: art.title,
        currentRevisionNumber: art.currentRevisionNumber,
        status: staleness.isStale ? 'STALE' : currentRev.status,
        staleness,
        updatedAt: art.updatedAt,
        activeDecision: validity.activeDecision,
        approvalValidity: validity.approvalValidity
      });
    }

    return items;
  }

  /**
   * Retrieves a specific artefact or revision, evaluating freshness and approval validity against live contract.
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

    const isTargetSuperseded = revRecord.revisionNumber < artefactRecord.currentRevisionNumber;
    const targetStalenessReasons = isTargetSuperseded
      ? [...staleness.reasons, `Revision ${revRecord.revisionNumber} has been superseded by revision ${artefactRecord.currentRevisionNumber}.`]
      : staleness.reasons;

    const targetValidity = await this.evaluateArtefactApprovalValidity(
      projectId,
      artefactRecord.artefactType as GovernanceTargetType,
      artefactRecord.id,
      revRecord,
      staleness.isStale || isTargetSuperseded,
      targetStalenessReasons,
      principal
    );

    const revisionsList = await this.artefactRepo.listRevisions(projectId, artefactRecord.id);
    const revisionSummaries: ArtefactRevisionSummary[] = [];

    for (const r of revisionsList) {
      if (r.revisionNumber === revRecord.revisionNumber) {
        revisionSummaries.push({
          id: r.id,
          revisionNumber: r.revisionNumber,
          status: r.status,
          recordedAt: r.recordedAt,
          actorDisplayName: r.actorDisplayName,
          sourceContractFingerprint: r.sourceContractFingerprint,
          sourceContractRevisionNumber: r.sourceContractRevisionNumber,
          activeDecision: targetValidity.activeDecision,
          approvalValidity: targetValidity.approvalValidity
        });
      } else {
        const parsedR: EngineeringArtefact = JSON.parse(r.contentJson);
        const rStaleness = evaluateArtefactStaleness(parsedR, compilationResult.contract);
        const rValidity = await this.evaluateArtefactApprovalValidity(
          projectId,
          artefactRecord.artefactType as GovernanceTargetType,
          artefactRecord.id,
          r,
          rStaleness.isStale || r.revisionNumber < artefactRecord.currentRevisionNumber,
          rStaleness.reasons,
          principal
        );
        revisionSummaries.push({
          id: r.id,
          revisionNumber: r.revisionNumber,
          status: r.status,
          recordedAt: r.recordedAt,
          actorDisplayName: r.actorDisplayName,
          sourceContractFingerprint: r.sourceContractFingerprint,
          sourceContractRevisionNumber: r.sourceContractRevisionNumber,
          activeDecision: rValidity.activeDecision,
          approvalValidity: rValidity.approvalValidity
        });
      }
    }

    const contentFingerprint = createHash('sha256').update(revRecord.contentJson).digest('hex');

    return {
      artefact: projectedArtefact,
      staleness,
      currentRevisionNumber: artefactRecord.currentRevisionNumber,
      contentFingerprint,
      inputRevisionDigest: revRecord.inputRevisionDigest,
      revisions: revisionSummaries,
      activeDecision: targetValidity.activeDecision,
      approvalValidity: targetValidity.approvalValidity,
      decisionHistory: targetValidity.decisionHistory
    };
  }

  /**
   * Submits an explicit governance decision (APPROVE or WITHDRAW) for an immutable artefact revision.
   */
  async submitArtefactDecision(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber: number,
    input: SubmitDecisionInput,
    principal?: AuthenticatedPrincipal
  ): Promise<ArtefactDetailResponse> {
    if (!principal) {
      const err = new Error('Authentication required to submit artefact decisions');
      (err as any).statusCode = 401;
      throw err;
    }

    const { orgId } = await this.assertProjectAccess(projectId, principal, 'READ');

    if (!this.governanceDecisionRepo) {
      throw new Error('Repositories not fully configured for governance decisions');
    }

    if (this.membershipRepo && principal.platformRole !== 'PLATFORM_ADMIN') {
      const liveMem = await this.membershipRepo.get(orgId, principal.userId);
      if (!liveMem || liveMem.status !== 'ACTIVE') {
        const err = new Error('User membership has been revoked or is inactive');
        (err as any).statusCode = 403;
        throw err;
      }
      if (!ROLE_PERMISSIONS[liveMem.role]?.includes('ARTEFACT_APPROVE')) {
        await this.auditService.record({
          actor: principal,
          projectId,
          organisationId: orgId,
          action: 'AUTHORIZATION_DENIED',
          targetType: 'ENGINEERING_ARTEFACT',
          targetId: artefactIdOrType,
          outcome: 'DENIED',
          reason: 'ARTEFACT_APPROVE permission required',
          metadata: { attemptedPermission: 'ARTEFACT_APPROVE' }
        });
        const err = new Error('ARTEFACT_APPROVE permission required');
        (err as any).statusCode = 403;
        throw err;
      }
    } else {
      const hasPerm = AuthorizationPolicy.hasPermission(
        principal,
        'ARTEFACT_APPROVE',
        orgId
      );
      if (!hasPerm) {
        await this.auditService.record({
          actor: principal,
          projectId,
          organisationId: orgId,
          action: 'AUTHORIZATION_DENIED',
          targetType: 'ENGINEERING_ARTEFACT',
          targetId: artefactIdOrType,
          outcome: 'DENIED',
          reason: 'ARTEFACT_APPROVE permission required',
          metadata: { attemptedPermission: 'ARTEFACT_APPROVE' }
        });
        const err = new Error('ARTEFACT_APPROVE permission required');
        (err as any).statusCode = 403;
        throw err;
      }
    }

    if (!input.decisionType || (input.decisionType !== 'APPROVE' && input.decisionType !== 'WITHDRAW')) {
      const err = new Error("Invalid or missing decisionType. Must be 'APPROVE' or 'WITHDRAW'");
      (err as any).statusCode = 400;
      throw err;
    }

    if (!input.rationale || typeof input.rationale !== 'string' || input.rationale.trim().length === 0) {
      const err = new Error('A non-blank rationale is required for approval decisions');
      (err as any).statusCode = 400;
      throw err;
    }

    if (
      input.expectedRevisionNumber === undefined ||
      input.expectedRevisionNumber === null ||
      typeof input.expectedRevisionNumber !== 'number' ||
      isNaN(input.expectedRevisionNumber) ||
      input.expectedRevisionNumber < 1
    ) {
      const err = new Error('Missing or malformed precondition: expectedRevisionNumber must be a positive integer');
      (err as any).statusCode = 400;
      throw err;
    }

    if (
      input.expectedDecisionRevision === undefined ||
      input.expectedDecisionRevision === null ||
      typeof input.expectedDecisionRevision !== 'number' ||
      isNaN(input.expectedDecisionRevision) ||
      input.expectedDecisionRevision < 0
    ) {
      const err = new Error('Missing or malformed precondition: expectedDecisionRevision must be an integer >= 0');
      (err as any).statusCode = 400;
      throw err;
    }

    if (
      !input.expectedContentFingerprint ||
      typeof input.expectedContentFingerprint !== 'string' ||
      input.expectedContentFingerprint.trim().length === 0
    ) {
      const err = new Error('Missing or malformed precondition: expectedContentFingerprint is required');
      (err as any).statusCode = 400;
      throw err;
    }

    const actor = principal;

    const executeDecision = async (): Promise<ArtefactDetailResponse> => {
      // Idempotency check inside transaction
      let payloadHash = '';
      if (input.idempotencyKey && this.idempotencyRepo) {
        payloadHash = createHash('sha256')
          .update(
            JSON.stringify({
              organisationId: orgId,
              projectId,
              actorUserId: actor.userId,
              operation: 'ARTEFACT_DECISION',
              artefactIdOrType,
              revisionNumber,
              decisionType: input.decisionType,
              rationale: input.rationale.trim(),
              expectedRevisionNumber: input.expectedRevisionNumber,
              expectedContentFingerprint: input.expectedContentFingerprint,
              expectedDecisionRevision: input.expectedDecisionRevision,
              expectedInputDigest: input.expectedInputDigest ?? null
            })
          )
          .digest('hex');

        const existing = await this.idempotencyRepo.get(input.idempotencyKey);
        if (existing) {
          if (
            existing.projectId !== projectId ||
            existing.actorUserId !== actor.userId ||
            existing.operation !== 'ARTEFACT_DECISION'
          ) {
            const err = new Error('Idempotency key belongs to another context or actor');
            (err as any).statusCode = 403;
            throw err;
          }
          if (existing.payloadSha256 !== payloadHash) {
            const err = new Error('Idempotency key mismatch: request payload differs from original execution');
            (err as any).statusCode = 409;
            throw err;
          }
          const liveDetail = await this.getArtefact(projectId, artefactIdOrType, revisionNumber, principal);
          return liveDetail;
        }
      }

      // Resolve artefact
      let artefactRecord = await this.artefactRepo.getById(projectId, artefactIdOrType);
      if (!artefactRecord) {
        artefactRecord = await this.artefactRepo.getByType(projectId, artefactIdOrType);
      }
      if (!artefactRecord) {
        const err = new Error(`Artefact '${artefactIdOrType}' not found for project '${projectId}'`);
        (err as any).statusCode = 404;
        throw err;
      }

      const revRecord = await this.artefactRepo.getRevision(projectId, artefactRecord.id, revisionNumber);
      if (!revRecord) {
        const err = new Error(`Revision ${revisionNumber} not found for artefact '${artefactRecord.id}'`);
        (err as any).statusCode = 404;
        throw err;
      }

      if (input.expectedRevisionNumber !== revisionNumber) {
        const err = new Error(
          `Precondition Failed: expected revision ${input.expectedRevisionNumber} does not match target ${revisionNumber}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const contentHash = createHash('sha256').update(revRecord.contentJson).digest('hex');
      if (input.expectedContentFingerprint !== contentHash) {
        const err = new Error(
          `Precondition Failed: expected content fingerprint ${input.expectedContentFingerprint} does not match target content`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      if (input.expectedInputDigest && revRecord.inputRevisionDigest && input.expectedInputDigest !== revRecord.inputRevisionDigest) {
        const err = new Error(
          `Precondition Failed: expected input digest ${input.expectedInputDigest} does not match target input digest ${revRecord.inputRevisionDigest}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      if (input.decisionType === 'APPROVE' && revisionNumber < artefactRecord.currentRevisionNumber) {
        const err = new Error(
          `Cannot approve superseded artefact revision ${revisionNumber}. Current revision is ${artefactRecord.currentRevisionNumber}.`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const parsedArtefact: EngineeringArtefact = JSON.parse(revRecord.contentJson);

      // Live contract compilation and staleness check
      const liveCompilation = await this.contractService.compileProjectPerformanceContract(projectId, principal);
      const staleness = evaluateArtefactStaleness(parsedArtefact, liveCompilation.contract);
      const liveIntelligence = await this.intelligenceRepo.listByProject(projectId);
      const liveInputDigest = this.computeInputRevisionDigest(liveCompilation.fingerprint, liveIntelligence);

      if (revRecord.inputRevisionDigest && revRecord.inputRevisionDigest !== liveInputDigest) {
        staleness.isStale = true;
        staleness.reasons.push(
          'Supplementary project intelligence (architecture, environment, or narrative context) changed since artefact generation.'
        );
      }

      let parentDecisionId: string | null = null;

      if (input.decisionType === 'APPROVE') {
        if (parsedArtefact.status === 'BLOCKED' || (parsedArtefact.approvalReadiness && !parsedArtefact.approvalReadiness.canApprove)) {
          const err = new Error(
            'Cannot approve artefact: Document is BLOCKED by unresolved governance issues or missing prerequisites'
          );
          (err as any).statusCode = 400;
          throw err;
        }

        if (staleness.isStale) {
          const err = new Error(
            `Precondition Failed: Document is STALE due to upstream changes (${staleness.reasons.join('; ')}). Regenerate document before approving.`
          );
          (err as any).statusCode = 409;
          throw err;
        }

        if (revRecord.sourceContractRevisionNumber === undefined || revRecord.sourceContractRevisionNumber === null) {
          const err = new Error(
            'Precondition Failed: Document was generated from an unpersisted contract draft. Regenerate from an approved contract review revision.'
          );
          (err as any).statusCode = 409;
          throw err;
        }

        const contractRev = await this.contractService.getContractReviewRevision(
          projectId,
          revRecord.sourceContractRevisionNumber,
          principal
        );

        if (!contractRev.approvalValidity?.isValid || contractRev.approvalValidity.state !== 'CURRENTLY_VALID') {
          const err = new Error(
            `Precondition Failed: Governing Performance Contract revision ${revRecord.sourceContractRevisionNumber} is not approved or has drifted/been withdrawn.`
          );
          (err as any).statusCode = 409;
          throw err;
        }

        parentDecisionId = contractRev.activeDecision?.id ?? null;
      }

      const existingDecisions = await this.governanceDecisionRepo!.listDecisionsForTarget(
        projectId,
        artefactRecord.artefactType as GovernanceTargetType,
        artefactRecord.id,
        revisionNumber
      );
      const nextDecisionRev = existingDecisions.length + 1;

      if (input.expectedDecisionRevision !== nextDecisionRev - 1) {
        const err = new Error(
          `Optimistic concurrency failure: expectedDecisionRevision is ${input.expectedDecisionRevision}, current is ${nextDecisionRev - 1}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const targetInputDigest = JSON.stringify({
        inputRevisionDigest: revRecord.inputRevisionDigest,
        sourceContractRevisionNumber: revRecord.sourceContractRevisionNumber ?? null,
        parentContractDecisionId: parentDecisionId
      });

      const decisionRecord: GovernanceDecisionRecord = {
        id: randomUUID(),
        projectId,
        organisationId: orgId,
        targetType: artefactRecord.artefactType as GovernanceTargetType,
        targetId: artefactRecord.id,
        targetRevisionNumber: revisionNumber,
        decisionType: input.decisionType,
        rationale: input.rationale.trim(),
        actorUserId: actor.userId,
        actorDisplayName: actor.displayName,
        targetContentFingerprint: contentHash,
        targetInputDigest,
        decidedAt: new Date().toISOString(),
        decisionRevision: nextDecisionRev
      };

      await this.governanceDecisionRepo!.recordDecision(decisionRecord);

      await this.auditService.record({
        actor,
        projectId,
        organisationId: orgId,
        action: input.decisionType === 'APPROVE' ? 'ARTEFACT_APPROVE' : 'ARTEFACT_APPROVAL_WITHDRAW',
        targetType: 'ENGINEERING_ARTEFACT',
        targetId: artefactRecord.id,
        outcome: 'SUCCESS',
        reason: input.rationale.trim(),
        metadata: {
          artefactType: artefactRecord.artefactType,
          revisionNumber,
          decisionRevision: nextDecisionRev,
          decisionType: input.decisionType
        }
      });

      const updatedDetail = await this.getArtefact(projectId, artefactRecord.id, revisionNumber, principal);

      if (input.idempotencyKey && this.idempotencyRepo) {
        await this.idempotencyRepo.save({
          key: input.idempotencyKey,
          projectId,
          actorUserId: actor.userId,
          operation: 'ARTEFACT_DECISION',
          payloadSha256: payloadHash,
          responseStatus: 200,
          responseJson: JSON.stringify(updatedDetail),
          createdAt: new Date().toISOString()
        });
      }

      return updatedDetail;
    };

    if (this.unitOfWork) {
      return this.unitOfWork.execute(executeDecision);
    }
    return executeDecision();
  }

  /**
   * Exports an artefact revision as Markdown with header staleness warning and approval notice if present.
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

    if (detail.approvalValidity) {
      if (detail.approvalValidity.isValid && detail.approvalValidity.activeDecision) {
        const approvedHeader = [
          `> 🛡️ **GOVERNED & APPROVED REVISION**`,
          `> Approved by **${detail.approvalValidity.activeDecision.actorDisplayName}** on ${detail.approvalValidity.activeDecision.decidedAt}`,
          `> Rationale: *${detail.approvalValidity.activeDecision.rationale}*`,
          '',
          '---',
          ''
        ].join('\n');
        md = approvedHeader + md;
      } else if (detail.approvalValidity.state !== 'NOT_APPROVED') {
        const invalidHeader = [
          `> ⚠️ **APPROVAL INVALIDATED: ${detail.approvalValidity.state}**`,
          ...detail.approvalValidity.reasons.map((r) => `> - ${r}`),
          '',
          '---',
          ''
        ].join('\n');
        md = invalidHeader + md;
      }
    }

    const filename = `${detail.artefact.id}-${detail.artefact.version}.md`;
    return {
      filename,
      markdown: md,
      isStale: detail.staleness.isStale
    };
  }
}
