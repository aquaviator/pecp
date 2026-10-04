// IntakeService - Core Intake, Provenance, Conflict, Approval & Gap Checklist Rules
// Defined according to M5.2 Work Package §1-§10 [I01-I08]

import { createHash, randomUUID } from 'node:crypto';
import {
  SourceMetadata,
  SourceVersion,
  SourceKind,
  SourceFormat,
  ExtractionResult,
  ExtractionStatus,
  ExtractedFragment,
  SourceBindingReference,
  IntelligenceApprovalSnapshot,
  RequiredFieldDefinition,
  ProjectChecklist,
  IntakeReviewSummary,
  StructuredImportFieldMapping,
  StructuredImportPreview,
  StructuredImportPreviewItem,
  IntelligenceItem,
  IntelligenceCandidate,
  IntelligenceCategory,
  CanonicalState,
  ReviewStatus,
  parseCsvRows
} from '@pecp/pe-domain';
import {
  ISourceRepository,
  IExtractionRepository,
  IIntelligenceRepository,
  IChecklistRepository,
  IIdempotencyRepository,
  IProjectRepository,
  IOrganisationMembershipRepository,
  IUnitOfWork,
  AuthenticatedPrincipal,
  IntelligenceRevisionSnapshot
} from '../index.js';
import { AuditService } from './AuditService.js';
import { AuthorizationPolicy } from './AuthorizationPolicy.js';

export interface IDocumentParserRegistry {
  detectFormat(filename: string, buffer: Buffer, declaredMime?: string): {
    format: SourceFormat;
    mediaType: string;
    isSupported: boolean;
    rejectionReason?: string;
  };
  parse(
    format: SourceFormat,
    buffer: Buffer,
    sourceVersionId: string,
    options?: any
  ): Promise<{
    status: ExtractionStatus;
    parserId: string;
    parserVersion: string;
    plainText: string;
    fragments: ExtractedFragment[];
    pageCount?: number | null;
    diagnostics?: string | null;
    limitations?: string[];
  }>;
  calculateDigest(plainText: string): string;
}

export interface IntakeServiceDependencies {
  sourceRepository: ISourceRepository;
  extractionRepository: IExtractionRepository;
  intelligenceRepository: IIntelligenceRepository;
  checklistRepository: IChecklistRepository;
  idempotencyRepository?: IIdempotencyRepository;
  projectRepository: IProjectRepository;
  membershipRepository?: IOrganisationMembershipRepository;
  auditService: AuditService;
  unitOfWork: IUnitOfWork;
  parserRegistry: IDocumentParserRegistry;
}

export const INTAKE_LIMITS = {
  MAX_UPLOAD_BYTES: 10 * 1024 * 1024, // 10 MiB
  MAX_PROJECT_AGGREGATE_BYTES: 100 * 1024 * 1024, // 100 MiB
  MAX_TEXT_SOURCE_BYTES: 1 * 1024 * 1024, // 1 MiB
  MAX_EXTRACTED_BYTES: 2 * 1024 * 1024, // 2 MiB
  MAX_PDF_PAGES: 200,
  MAX_DOCX_EXPANDED_BYTES: 50 * 1024 * 1024, // 50 MiB
  EXTRACTION_TIMEOUT_MS: 30000 // 30 seconds
};

export function areValuesAndUnitsEqual(
  val1: string | number | undefined | null,
  unit1: string | undefined | null,
  val2: string | number | undefined | null,
  unit2: string | undefined | null
): boolean {
  if (typeof val1 !== typeof val2) return false;
  if (val1 !== val2) return false;
  const u1 = unit1 === null || unit1 === undefined || unit1 === '' ? undefined : unit1;
  const u2 = unit2 === null || unit2 === undefined || unit2 === '' ? undefined : unit2;
  return u1 === u2;
}

export class IntakeService {
  private readonly sourceRepo: ISourceRepository;
  private readonly extractionRepo: IExtractionRepository;
  private readonly intelligenceRepo: IIntelligenceRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly idempotencyRepo?: IIdempotencyRepository;
  private readonly projectRepo: IProjectRepository;
  private readonly membershipRepo?: IOrganisationMembershipRepository;
  private readonly auditService: AuditService;
  private readonly unitOfWork: IUnitOfWork;
  private readonly parserRegistry: IDocumentParserRegistry;

  constructor(deps: IntakeServiceDependencies) {
    this.sourceRepo = deps.sourceRepository;
    this.extractionRepo = deps.extractionRepository;
    this.intelligenceRepo = deps.intelligenceRepository;
    this.checklistRepo = deps.checklistRepository;
    this.idempotencyRepo = deps.idempotencyRepository;
    this.projectRepo = deps.projectRepository;
    this.membershipRepo = deps.membershipRepository;
    this.auditService = deps.auditService;
    this.unitOfWork = deps.unitOfWork;
    this.parserRegistry = deps.parserRegistry;
  }

  async assertSourceWritePermission(projectId: string, actor: AuthenticatedPrincipal): Promise<void> {
    await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
  }

  private async assertProjectAccess(
    projectId: string,
    actor: AuthenticatedPrincipal,
    requiredPermission?: 'SOURCE_WRITE' | 'INTELLIGENCE_WRITE' | 'INTELLIGENCE_READ' | 'INTELLIGENCE_APPROVE' | 'INTELLIGENCE_RESOLVE'
  ) {
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      const err = new Error(`Project '${projectId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    const orgId = project.organisationId || '';

    if (actor.platformRole !== 'PLATFORM_ADMIN') {
      let membership = actor.memberships.find((m) => m.organisationId === orgId);
      if (this.membershipRepo) {
        const fresh = await this.membershipRepo.get(orgId, actor.userId);
        if (fresh) {
          membership = fresh;
        } else {
          membership = undefined;
        }
      }

      if (!membership) {
        // Concealed 404 for cross-tenant isolation
        const err = new Error(`Project '${projectId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      if (requiredPermission) {
        const effectiveActor: AuthenticatedPrincipal = {
          ...actor,
          memberships: actor.memberships.map((m) =>
            m.organisationId === orgId && membership ? membership : m
          )
        };
        const has = AuthorizationPolicy.hasPermission(effectiveActor, requiredPermission, orgId);
        if (!has) {
          const err = new Error(`Insufficient permissions: ${requiredPermission} required`);
          (err as any).statusCode = 403;
          throw err;
        }
      }
    }

    return project;
  }

  private async validateSourceBinding(
    projectId: string,
    binding: {
      sourceId: string;
      sourceVersionId: string;
      locator: string;
      excerpt?: string;
    }
  ): Promise<SourceBindingReference> {
    const sMeta = await this.sourceRepo.getSource(projectId, binding.sourceId);
    if (!sMeta) {
      const err = new Error(`Referenced source '${binding.sourceId}' does not exist in project '${projectId}'`);
      (err as any).statusCode = 400;
      throw err;
    }
    const sVer = await this.sourceRepo.getVersion(projectId, binding.sourceId, binding.sourceVersionId);
    if (!sVer) {
      const err = new Error(
        `Referenced source version '${binding.sourceVersionId}' not found for source '${binding.sourceId}'`
      );
      (err as any).statusCode = 400;
      throw err;
    }
    if (!sVer.extractionId) {
      const err = new Error(`Source version '${binding.sourceVersionId}' has no extraction result`);
      (err as any).statusCode = 400;
      throw err;
    }
    const extraction = await this.extractionRepo.getExtraction(projectId, sVer.extractionId);
    if (!extraction) {
      const err = new Error(
        `Extraction '${sVer.extractionId}' not found for source version '${binding.sourceVersionId}'`
      );
      (err as any).statusCode = 400;
      throw err;
    }
    const frag = extraction.fragments.find((f) => f.locator === binding.locator);
    if (!frag && !extraction.plainText.includes(binding.locator)) {
      const err = new Error(
        `Locator '${binding.locator}' could not be resolved in extraction fragments for source '${sMeta.title}'`
      );
      (err as any).statusCode = 400;
      throw err;
    }
    if (binding.excerpt && binding.excerpt.trim().length > 0) {
      const excerptClean = binding.excerpt.trim();
      const inFrag = frag && frag.text && frag.text.includes(excerptClean);
      const inPlain = extraction.plainText && extraction.plainText.includes(excerptClean);
      if (!inFrag && !inPlain) {
        const err = new Error(
          `Quoted excerpt '${binding.excerpt}' does not match extracted content at locator '${binding.locator}'`
        );
        (err as any).statusCode = 400;
        throw err;
      }
    }

    return {
      projectId,
      sourceId: sMeta.id,
      sourceVersionId: sVer.id,
      sourceVersionNumber: sVer.versionNumber,
      originalSha256: sVer.sha256,
      extractionId: sVer.extractionId,
      locator: binding.locator,
      excerpt: binding.excerpt
    };
  }

  // -------------------------------------------------------------------------
  // 1. Source Queries
  // -------------------------------------------------------------------------

  async listSources(projectId: string, actor: AuthenticatedPrincipal): Promise<SourceMetadata[]> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    return this.sourceRepo.listSources(projectId);
  }

  async getSource(projectId: string, sourceId: string, actor: AuthenticatedPrincipal): Promise<SourceMetadata> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    const source = await this.sourceRepo.getSource(projectId, sourceId);
    if (!source) {
      const err = new Error(`Source '${sourceId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }
    return source;
  }

  async listSourceVersions(projectId: string, sourceId: string, actor: AuthenticatedPrincipal): Promise<SourceVersion[]> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    await this.getSource(projectId, sourceId, actor);
    return this.sourceRepo.listVersions(projectId, sourceId);
  }

  async getSourceVersion(
    projectId: string,
    sourceId: string,
    versionId: string,
    actor: AuthenticatedPrincipal
  ): Promise<SourceVersion> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    const version = await this.sourceRepo.getVersion(projectId, sourceId, versionId);
    if (!version) {
      const err = new Error(`Source version '${versionId}' not found for source '${sourceId}'`);
      (err as any).statusCode = 404;
      throw err;
    }
    return version;
  }

  async getSourceBlob(
    projectId: string,
    sourceId: string,
    versionId: string,
    actor: AuthenticatedPrincipal
  ): Promise<{ version: SourceVersion; buffer: Buffer }> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    const version = await this.getSourceVersion(projectId, sourceId, versionId, actor);
    const blob = await this.sourceRepo.getBlob(projectId, versionId);
    if (!blob) {
      const err = new Error(`Source bytes for version '${versionId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }
    return { version, buffer: blob };
  }

  // -------------------------------------------------------------------------
  // 2. Source Creation & Versions (Brief / Manual Assertion / Upload)
  // -------------------------------------------------------------------------

  async captureTextSource(
    projectId: string,
    input: {
      kind: 'BRIEF' | 'MANUAL_ASSERTION';
      title: string;
      text: string;
      format?: 'PLAIN_TEXT' | 'MARKDOWN';
      suppliedAuthoredAt?: string;
      suppliedSpeaker?: string;
      suppliedExternalReference?: string;
    },
    actor: AuthenticatedPrincipal
  ): Promise<{ source: SourceMetadata; version: SourceVersion; extraction: ExtractionResult }> {
    const project = await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
    const orgId = project.organisationId || '';

    const trimmedText = input.text ?? '';
    const buffer = Buffer.from(trimmedText, 'utf-8');

    if (buffer.length > INTAKE_LIMITS.MAX_TEXT_SOURCE_BYTES) {
      const err = new Error(
        `Supplied text exceeds maximum permitted limit of ${INTAKE_LIMITS.MAX_TEXT_SOURCE_BYTES} bytes`
      );
      (err as any).statusCode = 413;
      throw err;
    }

    const currentAggregate = await this.sourceRepo.getAggregateByteSize(projectId);
    if (currentAggregate + buffer.length > INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES) {
      const err = new Error(
        `Project aggregate storage limit (${INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES} bytes) exceeded`
      );
      (err as any).statusCode = 413;
      throw err;
    }

    const now = new Date().toISOString();
    const sourceId = `src-${randomUUID()}`;
    const versionId = `sv-${randomUUID()}`;
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const format = input.format || 'PLAIN_TEXT';

    const source: SourceMetadata = {
      id: sourceId,
      projectId,
      organisationId: orgId,
      kind: input.kind,
      title: input.title.trim() || (input.kind === 'BRIEF' ? 'Project Brief' : 'Stakeholder Assertion'),
      currentVersionNumber: 1,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actor.userId,
      createdByUserDisplayName: actor.displayName
    };

    const initialVersion: SourceVersion = {
      id: versionId,
      sourceId,
      projectId,
      organisationId: orgId,
      versionNumber: 1,
      byteSize: buffer.length,
      mediaType: format === 'MARKDOWN' ? 'text/markdown' : 'text/plain',
      format,
      sha256,
      capturedAt: now,
      capturedByUserId: actor.userId,
      capturedByUserDisplayName: actor.displayName,
      suppliedAuthoredAt: input.suppliedAuthoredAt,
      suppliedSpeaker: input.suppliedSpeaker,
      suppliedExternalReference: input.suppliedExternalReference,
      extractionStatus: 'PENDING'
    };

    // 1. Commit source + version + blob atomically inside unit of work
    await this.unitOfWork.execute(async () => {
      await this.sourceRepo.createSource(source, initialVersion, buffer);

      if (input.kind === 'BRIEF') {
        await this.projectRepo.update(projectId, { briefText: trimmedText });
      }

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_CREATE',
        targetType: 'SOURCE',
        targetId: sourceId,
        outcome: 'SUCCESS',
        metadata: {
          kind: input.kind,
          title: source.title,
          versionNumber: 1,
          sha256
        }
      });
    });

    // 2. Perform text extraction outside database lock
    const parsed = await this.parserRegistry.parse(format, buffer, versionId, {
      maxExtractedBytes: INTAKE_LIMITS.MAX_EXTRACTED_BYTES
    });

    const extractionId = `ext-${randomUUID()}`;
    const contentDigest = this.parserRegistry.calculateDigest(parsed.plainText);

    const extractionResult: ExtractionResult = {
      id: extractionId,
      sourceVersionId: versionId,
      projectId,
      organisationId: orgId,
      status: parsed.status,
      parserId: parsed.parserId,
      parserVersion: parsed.parserVersion,
      extractedAt: new Date().toISOString(),
      textLength: parsed.plainText.length,
      pageCount: parsed.pageCount,
      contentDigest,
      diagnostics: parsed.diagnostics,
      plainText: parsed.plainText,
      fragments: parsed.fragments.map((f) => ({ ...f, extractionId }))
    };

    // 3. Commit extraction in separate short transaction
    await this.unitOfWork.execute(async () => {
      await this.extractionRepo.saveExtraction(extractionResult);
      await this.sourceRepo.updateVersionExtraction(
        projectId,
        versionId,
        parsed.status,
        extractionId,
        parsed.diagnostics
      );

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_EXTRACT',
        targetType: 'SOURCE_VERSION',
        targetId: versionId,
        outcome: parsed.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
        metadata: {
          extractionId,
          status: parsed.status,
          fragmentsCount: extractionResult.fragments.length,
          contentDigest
        }
      });
    });

    initialVersion.extractionStatus = parsed.status;
    initialVersion.extractionId = extractionId;
    initialVersion.diagnostics = parsed.diagnostics;

    return { source, version: initialVersion, extraction: extractionResult };
  }

  async captureUploadSource(
    projectId: string,
    input: {
      filename: string;
      buffer: Buffer;
      mimeType?: string;
      title?: string;
    },
    actor: AuthenticatedPrincipal
  ): Promise<{ source: SourceMetadata; version: SourceVersion; extraction: ExtractionResult }> {
    const project = await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
    const orgId = project.organisationId || '';

    if (input.buffer.length > INTAKE_LIMITS.MAX_UPLOAD_BYTES) {
      const err = new Error(
        `Uploaded file size (${input.buffer.length} bytes) exceeds limit of ${INTAKE_LIMITS.MAX_UPLOAD_BYTES} bytes`
      );
      (err as any).statusCode = 413;
      throw err;
    }

    const currentAggregate = await this.sourceRepo.getAggregateByteSize(projectId);
    if (currentAggregate + input.buffer.length > INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES) {
      const err = new Error(
        `Project aggregate storage limit (${INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES} bytes) exceeded`
      );
      (err as any).statusCode = 413;
      throw err;
    }

    // Format & Content Type Detection with Security Rejection
    const detection = this.parserRegistry.detectFormat(input.filename, input.buffer, input.mimeType);
    if (!detection.isSupported) {
      const err = new Error(
        detection.rejectionReason || `File format '${detection.format}' is not supported for intake`
      );
      (err as any).statusCode = 415;
      throw err;
    }

    const now = new Date().toISOString();
    const sourceId = `src-${randomUUID()}`;
    const versionId = `sv-${randomUUID()}`;
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    const source: SourceMetadata = {
      id: sourceId,
      projectId,
      organisationId: orgId,
      kind: 'UPLOAD',
      title: input.title?.trim() || input.filename,
      currentVersionNumber: 1,
      currentVersionId: versionId,
      createdAt: now,
      updatedAt: now,
      createdByUserId: actor.userId,
      createdByUserDisplayName: actor.displayName
    };

    const initialVersion: SourceVersion = {
      id: versionId,
      sourceId,
      projectId,
      organisationId: orgId,
      versionNumber: 1,
      byteSize: input.buffer.length,
      mediaType: detection.mediaType,
      format: detection.format,
      sha256,
      capturedAt: now,
      capturedByUserId: actor.userId,
      capturedByUserDisplayName: actor.displayName,
      extractionStatus: 'PENDING'
    };

    // 1. Commit source + version + blob
    await this.unitOfWork.execute(async () => {
      const currentAggregate = await this.sourceRepo.getAggregateByteSize(projectId);
      if (currentAggregate + input.buffer.length > INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES) {
        const err = new Error(
          `Project aggregate storage limit (${INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES} bytes) exceeded`
        );
        (err as any).statusCode = 413;
        throw err;
      }

      await this.sourceRepo.createSource(source, initialVersion, input.buffer);

      // Increment documents count on project
      const allSources = await this.sourceRepo.listSources(projectId);
      const uploadCount = allSources.filter((s) => s.kind === 'UPLOAD').length;
      await this.projectRepo.update(projectId, { documentsCount: uploadCount });

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_CREATE',
        targetType: 'SOURCE',
        targetId: sourceId,
        outcome: 'SUCCESS',
        metadata: {
          kind: 'UPLOAD',
          title: source.title,
          filename: input.filename,
          format: detection.format,
          byteSize: input.buffer.length,
          sha256
        }
      });
    });

    // 2. Parse outside lock
    const parsed = await this.parserRegistry.parse(detection.format, input.buffer, versionId, {
      maxExtractedBytes: INTAKE_LIMITS.MAX_EXTRACTED_BYTES,
      maxPages: INTAKE_LIMITS.MAX_PDF_PAGES,
      maxExpandedBytes: INTAKE_LIMITS.MAX_DOCX_EXPANDED_BYTES,
      timeoutMs: INTAKE_LIMITS.EXTRACTION_TIMEOUT_MS
    });

    const extractionId = `ext-${randomUUID()}`;
    const contentDigest = this.parserRegistry.calculateDigest(parsed.plainText);

    const extractionResult: ExtractionResult = {
      id: extractionId,
      sourceVersionId: versionId,
      projectId,
      organisationId: orgId,
      status: parsed.status,
      parserId: parsed.parserId,
      parserVersion: parsed.parserVersion,
      extractedAt: new Date().toISOString(),
      textLength: parsed.plainText.length,
      pageCount: parsed.pageCount,
      contentDigest,
      diagnostics: parsed.diagnostics,
      plainText: parsed.plainText,
      fragments: parsed.fragments.map((f) => ({ ...f, extractionId }))
    };

    // 3. Commit extraction result (recheck permissions & source state inside transaction)
    await this.unitOfWork.execute(async () => {
      await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
      const v = await this.sourceRepo.getVersion(projectId, sourceId, versionId);
      if (!v) {
        const err = new Error(`Source version '${versionId}' no longer exists`);
        (err as any).statusCode = 404;
        throw err;
      }

      await this.extractionRepo.saveExtraction(extractionResult);
      await this.sourceRepo.updateVersionExtraction(
        projectId,
        versionId,
        parsed.status,
        extractionId,
        parsed.diagnostics
      );

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_EXTRACT',
        targetType: 'SOURCE_VERSION',
        targetId: versionId,
        outcome: parsed.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
        metadata: {
          extractionId,
          status: parsed.status,
          fragmentsCount: extractionResult.fragments.length,
          contentDigest
        }
      });
    });

    initialVersion.extractionStatus = parsed.status;
    initialVersion.extractionId = extractionId;
    initialVersion.diagnostics = parsed.diagnostics;

    return { source, version: initialVersion, extraction: extractionResult };
  }

  async createSourceVersion(
    projectId: string,
    sourceId: string,
    input: {
      text?: string;
      buffer?: Buffer;
      filename?: string;
      mimeType?: string;
      expectedRevision?: number;
      suppliedAuthoredAt?: string;
      suppliedSpeaker?: string;
      suppliedExternalReference?: string;
    },
    actor: AuthenticatedPrincipal
  ): Promise<{ version: SourceVersion; extraction: ExtractionResult }> {
    const project = await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
    const orgId = project.organisationId || '';
    const source = await this.getSource(projectId, sourceId, actor);

    // Optimistic concurrency check - required for updating existing source (§5 [I03, I05])
    if (input.expectedRevision === undefined) {
      const err = new Error(
        `Precondition Failed: expectedRevision is required when creating a new version of an existing source`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    if (source.currentVersionNumber !== input.expectedRevision) {
      const err = new Error(
        `Precondition Failed: Source current version is ${source.currentVersionNumber}, expected ${input.expectedRevision}`
      );
      (err as any).statusCode = 409;
      throw err;
    }

    let buffer: Buffer;
    let format: SourceFormat;
    let mediaType: string;

    if (source.kind === 'BRIEF' || source.kind === 'MANUAL_ASSERTION') {
      const text = input.text ?? '';
      buffer = Buffer.from(text, 'utf-8');
      if (buffer.length > INTAKE_LIMITS.MAX_TEXT_SOURCE_BYTES) {
        const err = new Error(
          `Supplied text exceeds limit of ${INTAKE_LIMITS.MAX_TEXT_SOURCE_BYTES} bytes`
        );
        (err as any).statusCode = 413;
        throw err;
      }
      format = 'PLAIN_TEXT';
      mediaType = 'text/plain';
    } else {
      if (!input.buffer) {
        const err = new Error('File buffer is required for upload source version');
        (err as any).statusCode = 400;
        throw err;
      }
      buffer = input.buffer;
      if (buffer.length > INTAKE_LIMITS.MAX_UPLOAD_BYTES) {
        const err = new Error(
          `File size exceeds limit of ${INTAKE_LIMITS.MAX_UPLOAD_BYTES} bytes`
        );
        (err as any).statusCode = 413;
        throw err;
      }
      const detection = this.parserRegistry.detectFormat(
        input.filename || source.title,
        buffer,
        input.mimeType
      );
      if (!detection.isSupported) {
        const err = new Error(detection.rejectionReason || 'Unsupported file format');
        (err as any).statusCode = 415;
        throw err;
      }
      format = detection.format;
      mediaType = detection.mediaType;
    }

    const nextVersionNumber = source.currentVersionNumber + 1;
    const versionId = `sv-${randomUUID()}`;
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const now = new Date().toISOString();

    const version: SourceVersion = {
      id: versionId,
      sourceId,
      projectId,
      organisationId: orgId,
      versionNumber: nextVersionNumber,
      byteSize: buffer.length,
      mediaType,
      format,
      sha256,
      capturedAt: now,
      capturedByUserId: actor.userId,
      capturedByUserDisplayName: actor.displayName,
      suppliedAuthoredAt: input.suppliedAuthoredAt,
      suppliedSpeaker: input.suppliedSpeaker,
      suppliedExternalReference: input.suppliedExternalReference,
      extractionStatus: 'PENDING'
    };

    // Commit new version + invalidate linked current intake approvals inside write lock
    await this.unitOfWork.execute(async () => {
      const currentAggregate = await this.sourceRepo.getAggregateByteSize(projectId);
      if (currentAggregate + buffer.length > INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES) {
        const err = new Error(
          `Project aggregate storage limit (${INTAKE_LIMITS.MAX_PROJECT_AGGREGATE_BYTES} bytes) exceeded`
        );
        (err as any).statusCode = 413;
        throw err;
      }

      await this.sourceRepo.createVersion(version, buffer);

      if (source.kind === 'BRIEF' && input.text) {
        await this.projectRepo.update(projectId, { briefText: input.text });
      }

      // Invalidate current approvals for items bound to this source (§7 [I05])
      const projectItems = await this.intelligenceRepo.listByProject(projectId);
      const itemsToUpdate: IntelligenceItem[] = [];

      for (const item of projectItems) {
        const boundToThisSource = item.sourceBindings?.some((b) => b.sourceId === sourceId);
        if (boundToThisSource) {
          // Increment revision & invalidate current approval
          const oldRev = item.revision ?? 1;
          const newRev = oldRev + 1;
          item.revision = newRev;
          item.canonicalState = 'STALE';
          item.reviewStatus = 'STALE';
          item.approvalState = 'UNREVIEWED';
          item.approvedBy = undefined;
          item.approvedById = undefined;
          item.approvalDate = undefined;
          item.activeApprovalSnapshot = undefined;

          if (!item.history) item.history = [];
          item.history.push({
            date: now,
            action: `Current approval invalidated due to source update (${source.title} v${nextVersionNumber})`,
            actor: actor.displayName,
            note: `Linked source '${source.title}' updated to revision ${nextVersionNumber}. Review required.`
          });

          itemsToUpdate.push(item);

          // Save snapshot of invalidated state
          const snapshotId = `rev-${randomUUID()}`;
          const snapshot: IntelligenceRevisionSnapshot = {
            id: snapshotId,
            itemId: item.id,
            projectId,
            organisationId: orgId,
            revisionNumber: newRev,
            recordedAt: now,
            actorUserId: actor.userId,
            actorDisplayName: actor.displayName,
            canonicalState: item.canonicalState,
            reviewStatus: item.reviewStatus,
            valueText: typeof item.value === 'string' ? item.value : null,
            valueNumber: typeof item.value === 'number' ? item.value : null,
            unit: item.unit ?? null,
            approvalState: 'UNREVIEWED',
            sourceBindingsJson: JSON.stringify(item.sourceBindings ?? []),
            candidatesJson: item.candidates ? JSON.stringify(item.candidates) : null,
            snapshotJson: JSON.stringify(item)
          };
          await this.intelligenceRepo.saveRevisionSnapshot(snapshot);

          await this.auditService.record({
            actor,
            organisationId: orgId,
            projectId,
            action: 'INTELLIGENCE_APPROVAL_INVALIDATE',
            targetType: 'INTELLIGENCE_ITEM',
            targetId: item.id,
            outcome: 'SUCCESS',
            metadata: {
              reason: 'SOURCE_SUPERSEDED',
              sourceId,
              newSourceVersionNumber: nextVersionNumber,
              newRevision: newRev
            }
          });
        }
      }

      if (itemsToUpdate.length > 0) {
        await this.intelligenceRepo.saveItems(projectId, itemsToUpdate);
      }

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_VERSION_CREATE',
        targetType: 'SOURCE_VERSION',
        targetId: versionId,
        outcome: 'SUCCESS',
        metadata: {
          sourceId,
          versionNumber: nextVersionNumber,
          sha256,
          invalidatedItemsCount: itemsToUpdate.length
        }
      });
    });

    // Parse outside lock
    const parsed = await this.parserRegistry.parse(format, buffer, versionId, {
      maxExtractedBytes: INTAKE_LIMITS.MAX_EXTRACTED_BYTES,
      maxPages: INTAKE_LIMITS.MAX_PDF_PAGES,
      maxExpandedBytes: INTAKE_LIMITS.MAX_DOCX_EXPANDED_BYTES,
      timeoutMs: INTAKE_LIMITS.EXTRACTION_TIMEOUT_MS
    });

    const extractionId = `ext-${randomUUID()}`;
    const contentDigest = this.parserRegistry.calculateDigest(parsed.plainText);

    const extractionResult: ExtractionResult = {
      id: extractionId,
      sourceVersionId: versionId,
      projectId,
      organisationId: orgId,
      status: parsed.status,
      parserId: parsed.parserId,
      parserVersion: parsed.parserVersion,
      extractedAt: new Date().toISOString(),
      textLength: parsed.plainText.length,
      pageCount: parsed.pageCount,
      contentDigest,
      diagnostics: parsed.diagnostics,
      plainText: parsed.plainText,
      fragments: parsed.fragments.map((f) => ({ ...f, extractionId }))
    };

    // Commit extraction result (recheck permissions & state inside lock)
    await this.unitOfWork.execute(async () => {
      await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
      const v = await this.sourceRepo.getVersion(projectId, sourceId, versionId);
      if (!v) {
        const err = new Error(`Source version '${versionId}' no longer exists`);
        (err as any).statusCode = 404;
        throw err;
      }

      await this.extractionRepo.saveExtraction(extractionResult);
      await this.sourceRepo.updateVersionExtraction(
        projectId,
        versionId,
        parsed.status,
        extractionId,
        parsed.diagnostics
      );

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_EXTRACT',
        targetType: 'SOURCE_VERSION',
        targetId: versionId,
        outcome: parsed.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
        metadata: {
          extractionId,
          status: parsed.status,
          fragmentsCount: extractionResult.fragments.length,
          contentDigest
        }
      });
    });

    version.extractionStatus = parsed.status;
    version.extractionId = extractionId;
    version.diagnostics = parsed.diagnostics;

    return { version, extraction: extractionResult };
  }

  async extractSourceVersion(
    projectId: string,
    sourceId: string,
    versionId: string,
    actor: AuthenticatedPrincipal
  ): Promise<ExtractionResult> {
    const project = await this.assertProjectAccess(projectId, actor, 'SOURCE_WRITE');
    const orgId = project.organisationId || '';
    const version = await this.getSourceVersion(projectId, sourceId, versionId, actor);
    const blob = await this.sourceRepo.getBlob(projectId, versionId);

    if (!blob) {
      const err = new Error(`Blob not found for source version '${versionId}'`);
      (err as any).statusCode = 404;
      throw err;
    }

    const parsed = await this.parserRegistry.parse(version.format, blob, versionId, {
      maxExtractedBytes: INTAKE_LIMITS.MAX_EXTRACTED_BYTES,
      maxPages: INTAKE_LIMITS.MAX_PDF_PAGES,
      maxExpandedBytes: INTAKE_LIMITS.MAX_DOCX_EXPANDED_BYTES,
      timeoutMs: INTAKE_LIMITS.EXTRACTION_TIMEOUT_MS
    });

    const extractionId = `ext-${randomUUID()}`;
    const contentDigest = this.parserRegistry.calculateDigest(parsed.plainText);

    const extractionResult: ExtractionResult = {
      id: extractionId,
      sourceVersionId: versionId,
      projectId,
      organisationId: orgId,
      status: parsed.status,
      parserId: parsed.parserId,
      parserVersion: parsed.parserVersion,
      extractedAt: new Date().toISOString(),
      textLength: parsed.plainText.length,
      pageCount: parsed.pageCount,
      contentDigest,
      diagnostics: parsed.diagnostics,
      plainText: parsed.plainText,
      fragments: parsed.fragments.map((f) => ({ ...f, extractionId }))
    };

    await this.unitOfWork.execute(async () => {
      await this.extractionRepo.saveExtraction(extractionResult);
      await this.sourceRepo.updateVersionExtraction(
        projectId,
        versionId,
        parsed.status,
        extractionId,
        parsed.diagnostics
      );

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'SOURCE_EXTRACT',
        targetType: 'SOURCE_VERSION',
        targetId: versionId,
        outcome: parsed.status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
        metadata: {
          extractionId,
          status: parsed.status,
          fragmentsCount: extractionResult.fragments.length,
          contentDigest
        }
      });
    });

    return extractionResult;
  }

  async getExtraction(
    projectId: string,
    sourceId: string,
    versionId: string,
    actor: AuthenticatedPrincipal
  ): Promise<ExtractionResult> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    await this.getSourceVersion(projectId, sourceId, versionId, actor);
    const extraction = await this.extractionRepo.getExtractionByVersion(projectId, versionId);
    if (!extraction) {
      const err = new Error(`Extraction result not found for version '${versionId}'`);
      (err as any).statusCode = 404;
      throw err;
    }
    return extraction;
  }

  // -------------------------------------------------------------------------
  // 3. Capturing Structured Intelligence & Conflict Laws (§6 & §7 [I04, I05])
  // -------------------------------------------------------------------------

  async captureIntelligenceItem(
    projectId: string,
    input: {
      key: string;
      title: string;
      category: IntelligenceCategory;
      valueKind?: 'STRING' | 'NUMBER';
      value: string | number;
      unit?: string;
      ambiguityReason?: string;
      sourceBinding?: {
        sourceId: string;
        sourceVersionId: string;
        locator: string;
        excerpt?: string;
      };
    },
    actor: AuthenticatedPrincipal
  ): Promise<IntelligenceItem> {
    const project = await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_WRITE');
    const orgId = project.organisationId || '';

    const key = input.key?.trim();
    if (!key) {
      const err = new Error('Intelligence item key cannot be empty');
      (err as any).statusCode = 400;
      throw err;
    }

    let bindingRef: SourceBindingReference | undefined;
    let sourceMeta: SourceMetadata | null = null;
    let sourceVer: SourceVersion | null = null;

    if (input.sourceBinding) {
      bindingRef = await this.validateSourceBinding(projectId, input.sourceBinding);
      sourceMeta = await this.sourceRepo.getSource(projectId, bindingRef.sourceId);
    }

    return this.unitOfWork.execute(async () => {
      const existingItems = await this.intelligenceRepo.listByProject(projectId);
      const existing = existingItems.find((i) => i.key === key);
      const now = new Date().toISOString();

      if (!existing) {
        // Brand new intelligence item
        const itemId = `intel-${randomUUID()}`;
        const isAmbiguous = !!input.ambiguityReason;

        const canonicalState: CanonicalState = bindingRef ? 'IMPORTED' : 'MANUAL';
        const reviewStatus: ReviewStatus = isAmbiguous ? 'AMBIGUOUS' : 'FOUND';

        const newItem: IntelligenceItem = {
          id: itemId,
          key,
          title: input.title?.trim() || key,
          category: input.category,
          canonicalState,
          reviewStatus,
          approvalState: 'UNREVIEWED',
          value: input.value,
          unit: input.unit ?? undefined,
          source: sourceMeta ? sourceMeta.title : 'Manual Assertion',
          sourceDocument: sourceMeta ? sourceMeta.title : undefined,
          sourceLocation: bindingRef?.locator,
          capturedDate: now,
          ambiguityReason: input.ambiguityReason,
          revision: 1,
          intakeManaged: true,
          sourceBindings: bindingRef ? [bindingRef] : [],
          history: [
            {
              date: now,
              action: `Captured intelligence item (${input.value}${input.unit ? ' ' + input.unit : ''})`,
              actor: actor.displayName,
              note: bindingRef ? `Bound to ${sourceMeta?.title} (${bindingRef.locator})` : 'Manual stakeholder assertion'
            }
          ]
        };

        await this.intelligenceRepo.saveItems(projectId, [newItem]);

        const snapshot: IntelligenceRevisionSnapshot = {
          id: `rev-${randomUUID()}`,
          itemId,
          projectId,
          organisationId: orgId,
          revisionNumber: 1,
          recordedAt: now,
          actorUserId: actor.userId,
          actorDisplayName: actor.displayName,
          canonicalState: newItem.canonicalState,
          reviewStatus: newItem.reviewStatus,
          valueText: typeof newItem.value === 'string' ? newItem.value : null,
          valueNumber: typeof newItem.value === 'number' ? newItem.value : null,
          unit: newItem.unit ?? null,
          approvalState: 'UNREVIEWED',
          sourceBindingsJson: JSON.stringify(newItem.sourceBindings ?? []),
          snapshotJson: JSON.stringify(newItem)
        };
        await this.intelligenceRepo.saveRevisionSnapshot(snapshot);

        await this.recalculateProjectCounters(projectId);

        await this.auditService.record({
          actor,
          organisationId: orgId,
          projectId,
          action: 'INTELLIGENCE_CREATE',
          targetType: 'INTELLIGENCE_ITEM',
          targetId: itemId,
          outcome: 'SUCCESS',
          metadata: {
            key,
            revision: 1,
            value: input.value,
            unit: input.unit
          }
        });

        return newItem;
      }

      // Existing item found: apply conflict, corroboration or update rules (§7 [I05])
      const sameValueAndUnit = areValuesAndUnitsEqual(
        existing.value,
        existing.unit,
        input.value,
        input.unit
      );

      const currentRev = existing.revision ?? 1;
      const nextRev = currentRev + 1;
      existing.revision = nextRev;
      existing.intakeManaged = true;

      if (sameValueAndUnit) {
        // Corroboration: same value & unit from independent source
        let addedNewBinding = false;
        if (bindingRef) {
          if (!existing.sourceBindings) existing.sourceBindings = [];
          // Avoid duplicate retry binding
          const alreadyBound = existing.sourceBindings.some(
            (b) => b.sourceVersionId === bindingRef!.sourceVersionId && b.locator === bindingRef!.locator
          );
          if (!alreadyBound) {
            existing.sourceBindings.push(bindingRef);
            addedNewBinding = true;
          }
        }

        // Material binding change invalidates existing approval (§7 [I05])
        if (addedNewBinding && existing.approvalState === 'APPROVED') {
          existing.approvalState = 'UNREVIEWED';
          existing.approvedBy = undefined;
          existing.approvedById = undefined;
          existing.approvalDate = undefined;
          existing.activeApprovalSnapshot = undefined;
          existing.reviewStatus = 'FOUND';

          await this.auditService.record({
            actor,
            organisationId: orgId,
            projectId,
            action: 'INTELLIGENCE_APPROVAL_INVALIDATE',
            targetType: 'INTELLIGENCE_ITEM',
            targetId: existing.id,
            outcome: 'SUCCESS',
            metadata: {
              reason: 'NEW_SOURCE_BINDING',
              newRevision: nextRev
            }
          });
        }

        existing.history.push({
          date: now,
          action: `Corroborated by independent source (${sourceMeta?.title || 'Manual'})`,
          actor: actor.displayName
        });
      } else {
        // Differing assertions -> mark CONFLICTING (§7 [I05])
        existing.canonicalState = 'CONFLICTING';
        existing.reviewStatus = 'CONFLICTING';
        // Invalidate current approval!
        existing.approvalState = 'UNREVIEWED';
        existing.approvedBy = undefined;
        existing.approvedById = undefined;
        existing.approvalDate = undefined;
        existing.activeApprovalSnapshot = undefined;

        // Build or update candidates with independent source bindings
        if (!existing.candidates || existing.candidates.length === 0) {
          const cand1: IntelligenceCandidate = {
            id: `cand-${randomUUID()}`,
            source: existing.source || 'Original Assertion',
            sourceDocument: existing.sourceDocument || 'Original',
            sourceLocation: existing.sourceLocation || 'unspecified',
            value: existing.value ?? '',
            unit: existing.unit,
            canonicalState: existing.canonicalState,
            reviewStatus: 'FOUND',
            capturedDate: existing.capturedDate || now,
            sourceBindings: existing.sourceBindings ? [...existing.sourceBindings] : []
          };
          const cand2: IntelligenceCandidate = {
            id: `cand-${randomUUID()}`,
            source: sourceMeta?.title || 'New Assertion',
            sourceDocument: sourceMeta?.title || 'New Assertion',
            sourceLocation: bindingRef?.locator || 'unspecified',
            value: input.value,
            unit: input.unit,
            canonicalState: bindingRef ? 'IMPORTED' : 'MANUAL',
            reviewStatus: 'FOUND',
            capturedDate: now,
            sourceBindings: bindingRef ? [bindingRef] : []
          };
          existing.candidates = [cand1, cand2];
        } else {
          const newCand: IntelligenceCandidate = {
            id: `cand-${randomUUID()}`,
            source: sourceMeta?.title || 'Additional Assertion',
            sourceDocument: sourceMeta?.title || 'Additional Assertion',
            sourceLocation: bindingRef?.locator || 'unspecified',
            value: input.value,
            unit: input.unit,
            canonicalState: bindingRef ? 'IMPORTED' : 'MANUAL',
            reviewStatus: 'FOUND',
            capturedDate: now,
            sourceBindings: bindingRef ? [bindingRef] : []
          };
          existing.candidates.push(newCand);
        }

        if (bindingRef) {
          if (!existing.sourceBindings) existing.sourceBindings = [];
          existing.sourceBindings.push(bindingRef);
        }

        existing.history.push({
          date: now,
          action: `Conflicting assertion captured (${input.value}${input.unit ? ' ' + input.unit : ''} vs ${existing.value}${existing.unit ? ' ' + existing.unit : ''})`,
          actor: actor.displayName,
          note: `New assertion from ${sourceMeta?.title || 'Manual'} conflicts with existing value.`
        });
      }

      await this.intelligenceRepo.saveItems(projectId, [existing]);

      const snapshot: IntelligenceRevisionSnapshot = {
        id: `rev-${randomUUID()}`,
        itemId: existing.id,
        projectId,
        organisationId: orgId,
        revisionNumber: nextRev,
        recordedAt: now,
        actorUserId: actor.userId,
        actorDisplayName: actor.displayName,
        canonicalState: existing.canonicalState,
        reviewStatus: existing.reviewStatus,
        valueText: typeof existing.value === 'string' ? existing.value : null,
        valueNumber: typeof existing.value === 'number' ? existing.value : null,
        unit: existing.unit ?? null,
        approvalState: existing.approvalState ?? 'UNREVIEWED',
        sourceBindingsJson: JSON.stringify(existing.sourceBindings ?? []),
        candidatesJson: existing.candidates ? JSON.stringify(existing.candidates) : null,
        snapshotJson: JSON.stringify(existing)
      };
      await this.intelligenceRepo.saveRevisionSnapshot(snapshot);

      await this.recalculateProjectCounters(projectId);

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'INTELLIGENCE_UPDATE',
        targetType: 'INTELLIGENCE_ITEM',
        targetId: existing.id,
        outcome: 'SUCCESS',
        metadata: {
          key,
          revision: nextRev,
          canonicalState: existing.canonicalState,
          conflictDetected: existing.canonicalState === 'CONFLICTING'
        }
      });

      return existing;
    });
  }

  async updateIntelligenceItem(
    projectId: string,
    itemId: string,
    input: {
      expectedRevision: number;
      title?: string;
      value?: string | number;
      unit?: string;
      ambiguityReason?: string;
      sourceBinding?: {
        sourceId: string;
        sourceVersionId: string;
        locator: string;
        excerpt?: string;
      };
    },
    actor: AuthenticatedPrincipal
  ): Promise<IntelligenceItem> {
    const project = await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_WRITE');
    const orgId = project.organisationId || '';

    return this.unitOfWork.execute(async () => {
      const item = await this.intelligenceRepo.getById(projectId, itemId);
      if (!item) {
        const err = new Error(`Intelligence item '${itemId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      const currentRev = item.revision ?? 1;
      if (input.expectedRevision !== currentRev) {
        const err = new Error(
          `Precondition Failed: Item current revision is ${currentRev}, expected ${input.expectedRevision}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const now = new Date().toISOString();
      const nextRev = currentRev + 1;
      item.revision = nextRev;
      item.intakeManaged = true;

      const wasApproved = item.approvalState === 'APPROVED';
      const isMaterialChange =
        (input.value !== undefined && !areValuesAndUnitsEqual(input.value, item.unit, item.value, item.unit)) ||
        (input.unit !== undefined && !areValuesAndUnitsEqual(item.value, input.unit, item.value, item.unit)) ||
        (input.ambiguityReason !== undefined && input.ambiguityReason !== item.ambiguityReason) ||
        !!input.sourceBinding;

      if (input.title) item.title = input.title.trim();
      if (input.value !== undefined) item.value = input.value;
      if (input.unit !== undefined) item.unit = input.unit;
      if (input.ambiguityReason !== undefined) {
        item.ambiguityReason = input.ambiguityReason;
        if (input.ambiguityReason) {
          item.canonicalState = 'MANUAL';
          item.reviewStatus = 'AMBIGUOUS';
        }
      }

      if (input.sourceBinding) {
        const validatedBinding = await this.validateSourceBinding(projectId, input.sourceBinding);
        if (!item.sourceBindings) item.sourceBindings = [];
        item.sourceBindings = [
          validatedBinding,
          ...item.sourceBindings.filter((b) => b.sourceId !== validatedBinding.sourceId)
        ];
        const sMeta = await this.sourceRepo.getSource(projectId, validatedBinding.sourceId);
        item.source = sMeta?.title || 'Linked Source';
        item.sourceDocument = sMeta?.title || 'Linked Source';
        item.sourceLocation = validatedBinding.locator;
        if (item.canonicalState === 'STALE') {
          item.canonicalState = 'IMPORTED';
        }
        if (item.reviewStatus === 'STALE') {
          item.reviewStatus = item.ambiguityReason ? 'AMBIGUOUS' : 'FOUND';
        }
      }

      // Material change invalidates current approval (§7 [I05])
      if (isMaterialChange && wasApproved) {
        item.approvalState = 'UNREVIEWED';
        item.approvedBy = undefined;
        item.approvedById = undefined;
        item.approvalDate = undefined;
        item.activeApprovalSnapshot = undefined;
        item.canonicalState = item.sourceBindings && item.sourceBindings.length > 0 ? 'IMPORTED' : 'MANUAL';
        item.reviewStatus = item.ambiguityReason ? 'AMBIGUOUS' : 'STALE';

        await this.auditService.record({
          actor,
          organisationId: orgId,
          projectId,
          action: 'INTELLIGENCE_APPROVAL_INVALIDATE',
          targetType: 'INTELLIGENCE_ITEM',
          targetId: itemId,
          outcome: 'SUCCESS',
          metadata: {
            reason: 'MATERIAL_EDIT',
            newRevision: nextRev
          }
        });
      }

      if (!item.history) item.history = [];
      item.history.push({
        date: now,
        action: `Edited intelligence item (rev ${nextRev})`,
        actor: actor.displayName,
        note: isMaterialChange ? 'Material edit applied; approval invalidated if previously approved.' : undefined
      });

      await this.intelligenceRepo.saveItems(projectId, [item]);

      const snapshot: IntelligenceRevisionSnapshot = {
        id: `rev-${randomUUID()}`,
        itemId: item.id,
        projectId,
        organisationId: orgId,
        revisionNumber: nextRev,
        recordedAt: now,
        actorUserId: actor.userId,
        actorDisplayName: actor.displayName,
        canonicalState: item.canonicalState,
        reviewStatus: item.reviewStatus,
        valueText: typeof item.value === 'string' ? item.value : null,
        valueNumber: typeof item.value === 'number' ? item.value : null,
        unit: item.unit ?? null,
        approvalState: item.approvalState ?? 'UNREVIEWED',
        sourceBindingsJson: JSON.stringify(item.sourceBindings ?? []),
        candidatesJson: item.candidates ? JSON.stringify(item.candidates) : null,
        snapshotJson: JSON.stringify(item)
      };
      await this.intelligenceRepo.saveRevisionSnapshot(snapshot);

      await this.recalculateProjectCounters(projectId);

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'INTELLIGENCE_UPDATE',
        targetType: 'INTELLIGENCE_ITEM',
        targetId: itemId,
        outcome: 'SUCCESS',
        metadata: {
          revision: nextRev,
          isMaterialChange
        }
      });

      return item;
    });
  }

  async getIntelligenceHistory(
    projectId: string,
    itemId: string,
    actor: AuthenticatedPrincipal
  ): Promise<IntelligenceRevisionSnapshot[]> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    return this.intelligenceRepo.listRevisionSnapshots(projectId, itemId);
  }

  // -------------------------------------------------------------------------
  // 4. Structured Import Preview & Apply (§6 [I04])
  // -------------------------------------------------------------------------

  async previewImport(
    projectId: string,
    input: {
      sourceId: string;
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
    },
    actor: AuthenticatedPrincipal
  ): Promise<StructuredImportPreview> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_WRITE');
    const version = await this.getSourceVersion(projectId, input.sourceId, input.sourceVersionId, actor);
    const blob = await this.sourceRepo.getBlob(projectId, input.sourceVersionId);

    if (!blob) {
      const err = new Error(`Blob not found for source version '${input.sourceVersionId}'`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (version.format !== 'CSV' && version.format !== 'JSON') {
      const err = new Error(
        `Structured import is only supported for CSV and JSON sources; found '${version.format}'`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const proposedItems: StructuredImportPreviewItem[] = [];
    let validCount = 0;
    let invalidCount = 0;

    const text = blob.toString('utf-8');

    if (version.format === 'CSV') {
      const rows = parseCsvRows(text);
      if (rows.length === 0) {
        return {
          sourceId: input.sourceId,
          sourceVersionId: input.sourceVersionId,
          sourceVersionNumber: version.versionNumber,
          sourceDigest: version.sha256,
          format: 'CSV',
          proposedItems: [],
          validCount: 0,
          invalidCount: 0,
          mappingDigest: createHash('sha256').update(JSON.stringify(input.mappings)).digest('hex')
        };
      }

      const headers = rows[0] || [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];

        for (const mapping of input.mappings) {
          const colIdx = headers.indexOf(mapping.sourceColumnOrKey);
          if (colIdx === -1) {
            proposedItems.push({
              key: mapping.targetKey,
              title: mapping.title,
              category: mapping.category,
              value: '',
              sourceLocation: `row:${r},col:unknown`,
              validationError: `Source column '${mapping.sourceColumnOrKey}' not found in CSV header`
            });
            invalidCount++;
            continue;
          }

          const rawVal = row[colIdx] ?? '';
          let finalVal: string | number = rawVal;
          let valErr: string | undefined;

          if (mapping.valueKind === 'NUMBER') {
            const trimmed = rawVal.trim();
            const num = Number(trimmed);
            if (trimmed === '' || !Number.isFinite(num)) {
              valErr = `Value '${rawVal}' is not a valid finite number for target '${mapping.targetKey}'`;
              invalidCount++;
            } else {
              finalVal = num;
              validCount++;
            }
          } else {
            validCount++;
          }

          proposedItems.push({
            key: mapping.targetKey,
            title: mapping.title,
            category: mapping.category,
            value: finalVal,
            unit: mapping.unit,
            sourceLocation: `row:${r},col:${colIdx + 1}`,
            excerpt: rawVal,
            validationError: valErr
          });
        }
      }
    } else if (version.format === 'JSON') {
      let jsonObj: any;
      try {
        jsonObj = JSON.parse(text);
      } catch (e: any) {
        const err = new Error(`Malformed JSON in source: ${e.message}`);
        (err as any).statusCode = 400;
        throw err;
      }

      for (const mapping of input.mappings) {
        // Resolve RFC 6901 JSON pointer with escaping: ~1 -> /, ~0 -> ~
        const ptr = mapping.sourceColumnOrKey.startsWith('/')
          ? mapping.sourceColumnOrKey
          : `/${mapping.sourceColumnOrKey.replace(/\./g, '/')}`;
        const parts = ptr
          .split('/')
          .filter(Boolean)
          .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));

        let cur = jsonObj;
        let found = true;
        for (const part of parts) {
          if (cur && typeof cur === 'object' && part in cur) {
            cur = cur[part];
          } else {
            found = false;
            break;
          }
        }

        if (!found || cur === undefined || cur === null) {
          proposedItems.push({
            key: mapping.targetKey,
            title: mapping.title,
            category: mapping.category,
            value: '',
            sourceLocation: ptr,
            validationError: `JSON Pointer '${mapping.sourceColumnOrKey}' was null, undefined, or missing`
          });
          invalidCount++;
          continue;
        }

        let finalVal: string | number = cur;
        let valErr: string | undefined;

        if (mapping.valueKind === 'NUMBER') {
          if (typeof cur !== 'number' && typeof cur !== 'string') {
            valErr = `JSON value for '${mapping.targetKey}' is of invalid non-numeric type ${typeof cur}`;
            invalidCount++;
          } else {
            const trimmed = String(cur).trim();
            const num = Number(trimmed);
            if (trimmed === '' || !Number.isFinite(num)) {
              valErr = `JSON value '${cur}' is not a valid finite number for target '${mapping.targetKey}'`;
              invalidCount++;
            } else {
              finalVal = num;
              validCount++;
            }
          }
        } else {
          finalVal = String(cur);
          validCount++;
        }

        proposedItems.push({
          key: mapping.targetKey,
          title: mapping.title,
          category: mapping.category,
          value: finalVal,
          unit: mapping.unit,
          sourceLocation: ptr,
          excerpt: String(cur),
          validationError: valErr
        });
      }
    }

    const mappingDigest = createHash('sha256')
      .update(JSON.stringify(input.mappings))
      .digest('hex');

    return {
      sourceId: input.sourceId,
      sourceVersionId: input.sourceVersionId,
      sourceVersionNumber: version.versionNumber,
      sourceDigest: version.sha256,
      format: version.format as 'CSV' | 'JSON',
      proposedItems,
      validCount,
      invalidCount,
      mappingDigest
    };
  }

  async applyImport(
    projectId: string,
    input: {
      sourceId: string;
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
      mappingDigest: string;
      expectedRevisions?: Record<string, number>;
    },
    actor: AuthenticatedPrincipal
  ): Promise<{ appliedCount: number; items: IntelligenceItem[] }> {
    const project = await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_WRITE');
    const orgId = project.organisationId || '';

    return this.unitOfWork.execute(async () => {
      // Recompute preview inside transaction to validate source state & tamper resistance (§6, §10 [I04, I08])
      const preview = await this.previewImport(
        projectId,
        {
          sourceId: input.sourceId,
          sourceVersionId: input.sourceVersionId,
          mappings: input.mappings
        },
        actor
      );

      if (input.mappingDigest !== preview.mappingDigest) {
        const err = new Error(
          `Mapping digest mismatch: submitted '${input.mappingDigest}' does not match recomputed '${preview.mappingDigest}' (preview tampered or mappings modified)`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      if (preview.invalidCount > 0) {
        const firstErr = preview.proposedItems.find((p) => p.validationError)?.validationError;
        const err = new Error(
          `Import contains ${preview.invalidCount} invalid row(s). All-or-nothing apply aborted: ${firstErr}`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      // Check expected revisions
      const existingItems = await this.intelligenceRepo.listByProject(projectId);
      if (input.expectedRevisions) {
        for (const [key, expectedRev] of Object.entries(input.expectedRevisions)) {
          const ex = existingItems.find((i) => i.key === key);
          const actualRev = ex ? ex.revision ?? 1 : 0;
          if (actualRev !== expectedRev) {
            const err = new Error(
              `Precondition Failed: Field '${key}' current revision is ${actualRev}, expected ${expectedRev}`
            );
            (err as any).statusCode = 409;
            throw err;
          }
        }
      }

      const appliedItems: IntelligenceItem[] = [];

      for (const proposed of preview.proposedItems) {
        const item = await this.captureIntelligenceItem(
          projectId,
          {
            key: proposed.key,
            title: proposed.title,
            category: proposed.category,
            value: proposed.value,
            unit: proposed.unit,
            sourceBinding: {
              sourceId: input.sourceId,
              sourceVersionId: input.sourceVersionId,
              locator: proposed.sourceLocation,
              excerpt: proposed.excerpt
            }
          },
          actor
        );
        appliedItems.push(item);
      }

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'INTELLIGENCE_IMPORT',
        targetType: 'SOURCE_VERSION',
        targetId: input.sourceVersionId,
        outcome: 'SUCCESS',
        metadata: {
          sourceId: input.sourceId,
          appliedCount: appliedItems.length,
          mappingDigest: input.mappingDigest
        }
      });

      return { appliedCount: appliedItems.length, items: appliedItems };
    });
  }

  // -------------------------------------------------------------------------
  // 5. Checklist & Truthful Summary (§8 [I06])
  // -------------------------------------------------------------------------

  async getChecklist(projectId: string, actor: AuthenticatedPrincipal): Promise<ProjectChecklist | null> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');
    return this.checklistRepo.getChecklist(projectId);
  }

  async updateChecklist(
    projectId: string,
    input: {
      expectedRevision?: number;
      items: RequiredFieldDefinition[];
    },
    actor: AuthenticatedPrincipal
  ): Promise<ProjectChecklist> {
    const project = await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_WRITE');
    const orgId = project.organisationId || '';

    return this.unitOfWork.execute(async () => {
      const existing = await this.checklistRepo.getChecklist(projectId);
      const currentRev = existing ? existing.revision : 0;

      // Require explicit revision precondition when updating an existing checklist (§5 [I03, I05])
      if (existing !== null && input.expectedRevision === undefined) {
        const err = new Error(
          `Precondition Failed: expectedRevision is required when updating an existing checklist`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      if (input.expectedRevision !== undefined && currentRev !== input.expectedRevision) {
        const err = new Error(
          `Precondition Failed: Checklist current revision is ${currentRev}, expected ${input.expectedRevision}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const nextRev = currentRev + 1;
      const now = new Date().toISOString();

      const updated: ProjectChecklist = {
        projectId,
        organisationId: orgId,
        revision: nextRev,
        updatedAt: now,
        updatedByUserId: actor.userId,
        items: input.items
      };

      await this.checklistRepo.saveChecklist(updated);

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'INTELLIGENCE_CHECKLIST_UPDATE',
        targetType: 'PROJECT_CHECKLIST',
        targetId: projectId,
        outcome: 'SUCCESS',
        metadata: {
          revision: nextRev,
          itemsCount: input.items.length
        }
      });

      return updated;
    });
  }

  async getIntakeReviewSummary(projectId: string, actor: AuthenticatedPrincipal): Promise<IntakeReviewSummary> {
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_READ');

    const sources = await this.sourceRepo.listSources(projectId);
    const items = await this.intelligenceRepo.listByProject(projectId);
    const checklist = await this.checklistRepo.getChecklist(projectId);

    // Source stats
    const uploadedFiles = sources.filter((s) => s.kind === 'UPLOAD');
    const briefSources = sources.filter((s) => s.kind === 'BRIEF');
    const manualAssertions = sources.filter((s) => s.kind === 'MANUAL_ASSERTION');

    let extractedSuccessCount = 0;
    let extractionFailedCount = 0;
    let extractionPendingCount = 0;
    let extractionManualReviewCount = 0;

    for (const s of uploadedFiles) {
      const ver = await this.sourceRepo.getVersion(projectId, s.id, s.currentVersionId);
      if (ver) {
        if (ver.extractionStatus === 'SUCCESS') {
          extractedSuccessCount++;
        } else if (ver.extractionStatus === 'FAILED') {
          extractionFailedCount++;
        } else if (
          ver.extractionStatus === 'NO_EXTRACTABLE_TEXT' ||
          ver.extractionStatus === 'NEEDS_MANUAL_REVIEW'
        ) {
          extractionManualReviewCount++;
        } else {
          extractionPendingCount++;
        }
      }
    }

    // Intelligence field stats
    const fieldsByCategory: Record<IntelligenceCategory, number> = {
      BUSINESS_CONTEXT: 0,
      WORKLOAD: 0,
      REQUIREMENTS: 0,
      ARCHITECTURE: 0,
      ACCEPTANCE_CRITERIA: 0,
      TEST_DATA: 0,
      ENVIRONMENT: 0,
      OBSERVABILITY: 0
    };

    let unreviewedFieldsCount = 0;
    let approvedFieldsCount = 0;
    let pendingApprovalCount = 0;
    let rejectedFieldsCount = 0;
    let conflictingFieldsCount = 0;
    let ambiguousFieldsCount = 0;
    let staleFieldsCount = 0;

    for (const item of items) {
      if (fieldsByCategory[item.category] !== undefined) {
        fieldsByCategory[item.category]++;
      }

      if (item.canonicalState === 'CONFLICTING' || item.reviewStatus === 'CONFLICTING') {
        conflictingFieldsCount++;
      }
      if (item.reviewStatus === 'AMBIGUOUS') {
        ambiguousFieldsCount++;
      }
      if (item.canonicalState === 'STALE' || item.reviewStatus === 'STALE') {
        staleFieldsCount++;
      }

      if (item.approvalState === 'APPROVED') {
        approvedFieldsCount++;
      } else if (item.approvalState === 'PENDING_APPROVAL') {
        pendingApprovalCount++;
      } else if (item.approvalState === 'REJECTED') {
        rejectedFieldsCount++;
      } else {
        unreviewedFieldsCount++;
      }
    }

    // Gap analysis against configured checklist (§8 [I06])
    const gaps: Array<{
      key: string;
      title: string;
      category: IntelligenceCategory;
      reason: 'MISSING' | 'AMBIGUOUS' | 'CONFLICTING' | 'STALE' | 'NOT_APPROVED' | 'INVALID_CONTRACT';
    }> = [];

    let configuredRequiredCount = 0;
    let configuredMissingGapsCount = 0;

    if (checklist && checklist.items && checklist.items.length > 0) {
      for (const req of checklist.items) {
        if (!req.required) continue;
        configuredRequiredCount++;

        const match = items.find((i) => i.key === req.key);
        if (!match) {
          configuredMissingGapsCount++;
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'MISSING'
          });
        } else if (match.value === undefined || match.value === null || match.value === '') {
          configuredMissingGapsCount++;
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'MISSING'
          });
        } else if (
          req.expectedValueKind === 'NUMBER' &&
          (typeof match.value !== 'number' || !Number.isFinite(match.value))
        ) {
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'INVALID_CONTRACT'
          });
        } else if (req.expectedUnit && match.unit !== req.expectedUnit) {
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'INVALID_CONTRACT'
          });
        } else if (match.canonicalState === 'CONFLICTING' || match.reviewStatus === 'CONFLICTING') {
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'CONFLICTING'
          });
        } else if (match.reviewStatus === 'AMBIGUOUS') {
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'AMBIGUOUS'
          });
        } else if (match.canonicalState === 'STALE' || match.reviewStatus === 'STALE') {
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'STALE'
          });
        } else if (match.approvalState !== 'APPROVED') {
          gaps.push({
            key: req.key,
            title: req.title,
            category: req.category,
            reason: 'NOT_APPROVED'
          });
        }
      }
    }

    return {
      policyVersion: 'M5.2-1.0.0',
      projectId,
      uploadedFilesCount: uploadedFiles.length,
      extractedSuccessCount,
      extractionFailedCount,
      extractionPendingCount,
      extractionManualReviewCount,
      briefSourcesCount: briefSources.length,
      manualAssertionsCount: manualAssertions.length,
      totalIntelligenceFields: items.length,
      fieldsByCategory,
      unreviewedFieldsCount,
      approvedFieldsCount,
      pendingApprovalCount,
      rejectedFieldsCount,
      conflictingFieldsCount,
      ambiguousFieldsCount,
      staleFieldsCount,
      configuredRequiredCount,
      configuredMissingGapsCount,
      checklistStatus: checklist && checklist.items.length > 0 ? 'CONFIGURED' : 'NOT_CONFIGURED',
      gaps
    };
  }

  // -------------------------------------------------------------------------
  // 6. Updated Approval & Resolution with Preconditions (§7 [I05])
  // -------------------------------------------------------------------------

  async approveIntelligenceItem(
    projectId: string,
    itemId: string,
    expectedRevision: number | undefined,
    actor: AuthenticatedPrincipal
  ): Promise<IntelligenceItem> {
    const project = await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_APPROVE');
    const orgId = project.organisationId || '';

    return this.unitOfWork.execute(async () => {
      const item = await this.intelligenceRepo.getById(projectId, itemId);
      if (!item) {
        const err = new Error(`Intelligence item '${itemId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      // Precondition: expectedRevision is required for intake-managed records (§5 [I03, I05])
      const currentRev = item.revision ?? 1;
      if (item.intakeManaged && expectedRevision === undefined) {
        const err = new Error(
          `Precondition Failed: expectedRevision is required for approving intake-managed records`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      if (expectedRevision !== undefined && currentRev !== expectedRevision) {
        const err = new Error(
          `Precondition Failed: Item current revision is ${currentRev}, expected ${expectedRevision}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      // Missing / absent value cannot be approved
      if (item.value === undefined || item.value === null || item.value === '') {
        const err = new Error(
          `Cannot approve intelligence item '${itemId}' with missing or empty value`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      // Intake-managed approval preconditions (§7 [I05])
      if (item.canonicalState === 'CONFLICTING' || item.reviewStatus === 'CONFLICTING') {
        const err = new Error(
          `Cannot approve conflicting intelligence item '${itemId}'. Resolve competing assertions first.`
        );
        (err as any).statusCode = 400;
        throw err;
      }
      if (item.reviewStatus === 'AMBIGUOUS') {
        const err = new Error(
          `Cannot approve ambiguous intelligence item '${itemId}': ${item.ambiguityReason || 'Unresolved ambiguity'}`
        );
        (err as any).statusCode = 400;
        throw err;
      }
      if (item.canonicalState === 'STALE' || item.reviewStatus === 'STALE') {
        const err = new Error(
          `Cannot approve stale intelligence item '${itemId}'. Re-review and update source binding first.`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      // For intake-managed imported records, verify that source bindings exist and are valid
      if (item.intakeManaged && item.canonicalState === 'IMPORTED') {
        if (!item.sourceBindings || item.sourceBindings.length === 0) {
          const err = new Error(
            `Cannot approve imported intelligence item '${itemId}' without supporting source bindings`
          );
          (err as any).statusCode = 400;
          throw err;
        }
      }

      const now = new Date().toISOString();
      const nextRev = currentRev + 1;
      item.revision = nextRev;
      item.canonicalState = 'APPROVED';
      item.reviewStatus = 'FOUND';
      item.approvalState = 'APPROVED';
      item.approvedBy = actor.displayName;
      item.approvedById = actor.userId;
      item.approvalDate = now;

      const boundIds = item.sourceBindings?.map((b) => b.sourceVersionId) ?? [];
      const snapshotRecord: IntelligenceApprovalSnapshot = {
        revision: nextRev,
        approvedAt: now,
        approvedByUserId: actor.userId,
        approvedByUserDisplayName: actor.displayName,
        boundSourceVersionIds: boundIds,
        value: item.value,
        unit: item.unit
      };
      item.activeApprovalSnapshot = snapshotRecord;

      if (!item.history) item.history = [];
      item.history.push({
        date: now,
        action: `Item formally APPROVED at revision ${nextRev}`,
        actor: actor.displayName
      });

      await this.intelligenceRepo.saveItems(projectId, [item]);

      const snapshot: IntelligenceRevisionSnapshot = {
        id: `rev-${randomUUID()}`,
        itemId: item.id,
        projectId,
        organisationId: orgId,
        revisionNumber: nextRev,
        recordedAt: now,
        actorUserId: actor.userId,
        actorDisplayName: actor.displayName,
        canonicalState: item.canonicalState,
        reviewStatus: item.reviewStatus,
        valueText: typeof item.value === 'string' ? item.value : null,
        valueNumber: typeof item.value === 'number' ? item.value : null,
        unit: item.unit ?? null,
        approvalState: 'APPROVED',
        approvedByUserId: actor.userId,
        sourceBindingsJson: JSON.stringify(item.sourceBindings ?? []),
        candidatesJson: item.candidates ? JSON.stringify(item.candidates) : null,
        snapshotJson: JSON.stringify(item)
      };
      await this.intelligenceRepo.saveRevisionSnapshot(snapshot);

      await this.recalculateProjectCounters(projectId);

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'INTELLIGENCE_APPROVE',
        targetType: 'INTELLIGENCE_ITEM',
        targetId: itemId,
        outcome: 'SUCCESS',
        metadata: {
          revision: nextRev,
          approvedValue: item.value,
          approvedUnit: item.unit
        }
      });

      return item;
    });
  }

  async resolveConflict(
    projectId: string,
    itemId: string,
    chosenCandidateId: string,
    rationale: string | undefined,
    expectedRevision: number | undefined,
    actor: AuthenticatedPrincipal
  ): Promise<IntelligenceItem> {
    const project = await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_RESOLVE');
    // Also requires INTELLIGENCE_APPROVE (§9 [I07])
    await this.assertProjectAccess(projectId, actor, 'INTELLIGENCE_APPROVE');
    const orgId = project.organisationId || '';

    return this.unitOfWork.execute(async () => {
      const item = await this.intelligenceRepo.getById(projectId, itemId);
      if (!item) {
        const err = new Error(`Intelligence item '${itemId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      const currentRev = item.revision ?? 1;
      if (item.intakeManaged && expectedRevision === undefined) {
        const err = new Error(
          `Precondition Failed: expectedRevision is required for resolving intake-managed records`
        );
        (err as any).statusCode = 400;
        throw err;
      }

      if (expectedRevision !== undefined && currentRev !== expectedRevision) {
        const err = new Error(
          `Precondition Failed: Item current revision is ${currentRev}, expected ${expectedRevision}`
        );
        (err as any).statusCode = 409;
        throw err;
      }

      const chosen = item.candidates?.find((c) => c.id === chosenCandidateId);
      if (!chosen) {
        const err = new Error(`Candidate '${chosenCandidateId}' not found for item '${itemId}'`);
        (err as any).statusCode = 400;
        throw err;
      }

      const now = new Date().toISOString();
      const nextRev = currentRev + 1;
      item.revision = nextRev;
      item.canonicalState = 'APPROVED';
      item.reviewStatus = 'FOUND';
      item.value = chosen.value;
      // Missing unit stays missing and must not inherit previous candidate's unit (§7 [I05])
      item.unit = chosen.unit !== undefined ? chosen.unit : undefined;
      item.approvalState = 'APPROVED';
      item.approvedBy = actor.displayName;
      item.approvedById = actor.userId;
      item.approvalDate = now;
      item.source = chosen.source;
      item.sourceDocument = chosen.sourceDocument;
      item.sourceLocation = chosen.sourceLocation;
      item.notes = `Authoritative candidate selected from ${chosen.source}. ${rationale ? `Rationale: ${rationale}` : ''}`.trim();

      // Transfer chosen candidate's source bindings if present
      if (chosen.sourceBindings && chosen.sourceBindings.length > 0) {
        item.sourceBindings = [...chosen.sourceBindings];
      }

      const boundIds = item.sourceBindings?.map((b) => b.sourceVersionId) ?? [];
      const snapshotRecord: IntelligenceApprovalSnapshot = {
        revision: nextRev,
        approvedAt: now,
        approvedByUserId: actor.userId,
        approvedByUserDisplayName: actor.displayName,
        boundSourceVersionIds: boundIds,
        decisionNote: rationale,
        value: chosen.value,
        unit: chosen.unit
      };
      item.activeApprovalSnapshot = snapshotRecord;

      if (!item.history) item.history = [];
      item.history.push({
        date: now,
        action: `Resolved conflict in favor of candidate (${chosen.value}${chosen.unit ? ' ' + chosen.unit : ''}) at rev ${nextRev}`,
        actor: actor.displayName,
        note: rationale || `Authoritative source: ${chosen.source}`
      });

      await this.intelligenceRepo.saveItems(projectId, [item]);

      const snapshot: IntelligenceRevisionSnapshot = {
        id: `rev-${randomUUID()}`,
        itemId: item.id,
        projectId,
        organisationId: orgId,
        revisionNumber: nextRev,
        recordedAt: now,
        actorUserId: actor.userId,
        actorDisplayName: actor.displayName,
        canonicalState: item.canonicalState,
        reviewStatus: item.reviewStatus,
        valueText: typeof item.value === 'string' ? item.value : null,
        valueNumber: typeof item.value === 'number' ? item.value : null,
        unit: item.unit ?? null,
        approvalState: 'APPROVED',
        approvedByUserId: actor.userId,
        sourceBindingsJson: JSON.stringify(item.sourceBindings ?? []),
        candidatesJson: item.candidates ? JSON.stringify(item.candidates) : null,
        snapshotJson: JSON.stringify(item)
      };
      await this.intelligenceRepo.saveRevisionSnapshot(snapshot);

      await this.recalculateProjectCounters(projectId);

      await this.auditService.record({
        actor,
        organisationId: orgId,
        projectId,
        action: 'INTELLIGENCE_CONFLICT_RESOLVE',
        targetType: 'INTELLIGENCE_ITEM',
        targetId: itemId,
        outcome: 'SUCCESS',
        metadata: {
          chosenCandidateId,
          resolvedValue: chosen.value,
          resolvedUnit: chosen.unit,
          revision: nextRev
        }
      });

      return item;
    });
  }

  private async recalculateProjectCounters(projectId: string): Promise<void> {
    const allItems = await this.intelligenceRepo.listByProject(projectId);
    const conflicts = allItems.filter(
      (i) => i.canonicalState === 'CONFLICTING' || i.reviewStatus === 'CONFLICTING'
    ).length;
    const requirements = allItems.filter(
      (i) => i.category === 'REQUIREMENTS' || i.category === 'WORKLOAD'
    ).length;

    await this.projectRepo.update(projectId, {
      conflictsCount: conflicts,
      requirementsCount: requirements
    });
  }
}
