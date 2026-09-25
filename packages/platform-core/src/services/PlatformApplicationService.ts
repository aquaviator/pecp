// PlatformApplicationService
// Defined according to M5.0 Work Package §2 & §4

import { ProjectSummary, IntelligenceItem } from '@pecp/pe-domain';
import {
  Organisation,
  OrganisationStatus,
  CreateOrganisationInput,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectBootstrapMetadata,
  ProjectWithMetadata,
  AuthenticatedPrincipal,
  OrganisationMembership
} from '../types.js';
import { IOrganisationRepository } from '../repositories/IOrganisationRepository.js';
import { IProjectRepository } from '../repositories/IProjectRepository.js';
import { IEntityRevisionRepository } from '../repositories/IEntityRevisionRepository.js';
import { IIntelligenceRepository } from '../repositories/IIntelligenceRepository.js';
import { IOrganisationMembershipRepository } from '../repositories/IOrganisationMembershipRepository.js';
import { IUnitOfWork } from '../transactions/IUnitOfWork.js';
import { AuditService } from './AuditService.js';

export interface PlatformServiceDependencies {
  organisationRepository: IOrganisationRepository;
  projectRepository: IProjectRepository;
  entityRevisionRepository?: IEntityRevisionRepository;
  intelligenceRepository?: IIntelligenceRepository;
  membershipRepository?: IOrganisationMembershipRepository;
  auditService?: AuditService;
  unitOfWork?: IUnitOfWork;
}

export class PlatformApplicationService {
  private readonly orgRepo: IOrganisationRepository;
  private readonly projectRepo: IProjectRepository;
  private readonly revisionRepo?: IEntityRevisionRepository;
  private readonly intelligenceRepo?: IIntelligenceRepository;
  private readonly membershipRepo?: IOrganisationMembershipRepository;
  private readonly auditService?: AuditService;
  private readonly unitOfWork?: IUnitOfWork;

  constructor(deps: PlatformServiceDependencies) {
    this.orgRepo = deps.organisationRepository;
    this.projectRepo = deps.projectRepository;
    this.revisionRepo = deps.entityRevisionRepository;
    this.intelligenceRepo = deps.intelligenceRepository;
    this.membershipRepo = deps.membershipRepository;
    this.auditService = deps.auditService;
    this.unitOfWork = deps.unitOfWork;
  }

  private async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.unitOfWork) {
      return this.unitOfWork.execute(operation);
    }
    return operation();
  }

  // --- Organisation Operations ---

  async listOrganisations(): Promise<Organisation[]> {
    return this.orgRepo.list();
  }

  async getOrganisationById(id: string): Promise<Organisation | null> {
    return this.orgRepo.getById(id);
  }

  async getOrganisationByName(name: string): Promise<Organisation | null> {
    return this.orgRepo.getByName(name);
  }

  async createOrganisation(
    input: CreateOrganisationInput,
    actor?: AuthenticatedPrincipal
  ): Promise<Organisation> {
    return this.runInTransaction(async () => {
      const trimmedName = input.name?.trim();
      if (!trimmedName) {
        throw new Error('Organisation name cannot be empty');
      }

      const existing = await this.orgRepo.getByName(trimmedName);
      if (existing) {
        const err = new Error(`Organisation '${trimmedName}' already exists`);
        (err as any).statusCode = 409;
        throw err;
      }

      const now = new Date().toISOString();
      const id = `org-${crypto.randomUUID()}`;
      const org: Organisation = {
        id,
        name: trimmedName,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now
      };

      const created = await this.orgRepo.create(org);

      if (this.revisionRepo) {
        await this.revisionRepo.recordRevision({
          entityType: 'ORGANISATION',
          entityId: id,
          revisionNumber: 1,
          payloadJson: JSON.stringify(created),
          recordedAt: now,
          actorRef: actor ? actor.userId : null
        });
      }

      // Rule (M5.1 §19): When PLATFORM_ADMIN creates an organisation, automatically
      // give that actor ORG_ADMIN membership in the new organisation atomically.
      if (actor && actor.platformRole === 'PLATFORM_ADMIN' && this.membershipRepo) {
        const membership: OrganisationMembership = {
          organisationId: id,
          userId: actor.userId,
          role: 'ORG_ADMIN',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
          createdByUserId: actor.userId
        };
        await this.membershipRepo.save(membership);
        // Also update actor's in-memory memberships if present
        actor.memberships.push({ organisationId: id, role: 'ORG_ADMIN' });
      }

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: id,
          action: 'ORGANISATION_CREATE',
          targetType: 'ORGANISATION',
          targetId: id,
          outcome: 'SUCCESS',
          metadata: { name: trimmedName }
        });
      }

      return created;
    });
  }

  async updateOrganisationStatus(
    id: string,
    status: OrganisationStatus,
    actor?: AuthenticatedPrincipal
  ): Promise<Organisation | null> {
    return this.runInTransaction(async () => {
      const updated = await this.orgRepo.updateStatus(id, status);
      if (!updated) {
        return null;
      }

      if (this.revisionRepo) {
        const currentRev = await this.revisionRepo.getLatestRevisionNumber('ORGANISATION', id);
        await this.revisionRepo.recordRevision({
          entityType: 'ORGANISATION',
          entityId: id,
          revisionNumber: currentRev + 1,
          payloadJson: JSON.stringify(updated),
          recordedAt: new Date().toISOString(),
          actorRef: actor ? actor.userId : null
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: id,
          action: 'ORGANISATION_STATUS_CHANGE',
          targetType: 'ORGANISATION',
          targetId: id,
          outcome: 'SUCCESS',
          metadata: { status }
        });
      }

      return updated;
    });
  }

  // --- Project Operations ---

  async listProjects(): Promise<ProjectSummary[]> {
    return this.projectRepo.list();
  }

  async listProjectsByOrganisation(organisationId: string): Promise<ProjectSummary[]> {
    const org = await this.orgRepo.getById(organisationId);
    if (!org) {
      const err = new Error(`Organisation '${organisationId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }
    return this.projectRepo.listByOrganisation(organisationId);
  }

  async getProjectById(id: string): Promise<ProjectSummary | null> {
    return this.projectRepo.getById(id);
  }

  async getProjectWithMetadata(id: string): Promise<ProjectWithMetadata | null> {
    const project = await this.projectRepo.getById(id);
    if (!project) return null;

    let bootstrapMetadata: ProjectBootstrapMetadata | null = null;
    if (this.projectRepo.getBootstrapMetadata) {
      bootstrapMetadata = await this.projectRepo.getBootstrapMetadata(id);
    }

    return { project, bootstrapMetadata };
  }

  async createProject(
    input: CreateProjectInput,
    actor?: AuthenticatedPrincipal
  ): Promise<ProjectSummary> {
    return this.runInTransaction(async () => {
      const trimmedOrgName = input.organisation?.trim();
      if (!trimmedOrgName) {
        const err = new Error('Project organisation is required');
        (err as any).statusCode = 400;
        throw err;
      }

      const trimmedProjectName = input.name?.trim();
      if (!trimmedProjectName) {
        const err = new Error('Project name is required');
        (err as any).statusCode = 400;
        throw err;
      }

      // Hygiene check: validate uploadedDocumentNames elements are strings
      if (input.uploadedDocumentNames) {
        if (!Array.isArray(input.uploadedDocumentNames)) {
          const err = new Error('uploadedDocumentNames must be an array of strings');
          (err as any).statusCode = 400;
          throw err;
        }
        for (const doc of input.uploadedDocumentNames) {
          if (typeof doc !== 'string') {
            const err = new Error('All uploaded document names must be strings');
            (err as any).statusCode = 400;
            throw err;
          }
        }
      }

      // Resolve or auto-create organisation by exact case-insensitive normalized matching
      let targetOrg: Organisation | null = null;
      if (input.organisationId) {
        targetOrg = await this.orgRepo.getById(input.organisationId);
        if (!targetOrg) {
          const err = new Error(`Organisation '${input.organisationId}' not found`);
          (err as any).statusCode = 404;
          throw err;
        }
      } else {
        targetOrg = await this.orgRepo.getByName(trimmedOrgName);
        if (!targetOrg) {
          // Rule (M5.1 §14 & §21): Auto-creation of organisation is PLATFORM_ADMIN only
          if (actor && actor.platformRole !== 'PLATFORM_ADMIN') {
            const err = new Error(`Organisation '${trimmedOrgName}' does not exist and only PLATFORM_ADMIN may create organisations`);
            (err as any).statusCode = 403;
            throw err;
          }
          targetOrg = await this.createOrganisation({ name: trimmedOrgName }, actor);
        }
      }

      const now = new Date().toISOString();
      const projectId = `proj-${crypto.randomUUID()}`;

      // Strictly zero-invention safeguards according to M5.0 §2:
      const documentsCount = input.uploadedDocumentNames ? input.uploadedDocumentNames.length : 0;

      const project: ProjectSummary = {
        id: projectId,
        name: trimmedProjectName,
        organisation: targetOrg.name,
        organisationId: targetOrg.id,
        intent: input.intent,
        description: input.description ?? '',
        createdDate: now,
        status: 'ACTIVE',
        documentsCount,
        requirementsCount: 0,
        conflictsCount: 0
      };

      const bootstrapMetadata: ProjectBootstrapMetadata = {
        creationMethod: input.creationMethod,
        briefText: input.briefText,
        uploadedDocumentNames: input.uploadedDocumentNames,
        externalReference: input.externalReference
      };

      const created = await this.projectRepo.create(project, bootstrapMetadata);

      if (this.revisionRepo) {
        await this.revisionRepo.recordRevision({
          entityType: 'PROJECT',
          entityId: projectId,
          revisionNumber: 1,
          payloadJson: JSON.stringify({ project: created, bootstrapMetadata }),
          recordedAt: now,
          actorRef: actor ? actor.userId : null
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: targetOrg.id,
          projectId,
          action: 'PROJECT_CREATE',
          targetType: 'PROJECT',
          targetId: projectId,
          outcome: 'SUCCESS',
          metadata: { name: trimmedProjectName, organisationId: targetOrg.id }
        });
      }

      return created;
    });
  }

  async updateProject(
    id: string,
    updates: UpdateProjectInput,
    actor?: AuthenticatedPrincipal
  ): Promise<ProjectSummary | null> {
    return this.runInTransaction(async () => {
      const updated = await this.projectRepo.update(id, updates);
      if (!updated) {
        return null;
      }

      if (this.revisionRepo) {
        const currentRev = await this.revisionRepo.getLatestRevisionNumber('PROJECT', id);
        await this.revisionRepo.recordRevision({
          entityType: 'PROJECT',
          entityId: id,
          revisionNumber: currentRev + 1,
          payloadJson: JSON.stringify(updated),
          recordedAt: new Date().toISOString(),
          actorRef: actor ? actor.userId : null
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: updated.organisationId,
          projectId: id,
          action: 'PROJECT_UPDATE',
          targetType: 'PROJECT',
          targetId: id,
          outcome: 'SUCCESS',
          metadata: { updates }
        });
      }

      return updated;
    });
  }

  async archiveProject(
    id: string,
    actor?: AuthenticatedPrincipal
  ): Promise<ProjectSummary | null> {
    return this.runInTransaction(async () => {
      const archived = await this.projectRepo.archive(id);
      if (!archived) {
        return null;
      }

      if (this.revisionRepo) {
        const currentRev = await this.revisionRepo.getLatestRevisionNumber('PROJECT', id);
        await this.revisionRepo.recordRevision({
          entityType: 'PROJECT',
          entityId: id,
          revisionNumber: currentRev + 1,
          payloadJson: JSON.stringify(archived),
          recordedAt: new Date().toISOString(),
          actorRef: actor ? actor.userId : null
        });
      }

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: archived.organisationId,
          projectId: id,
          action: 'PROJECT_ARCHIVE',
          targetType: 'PROJECT',
          targetId: id,
          outcome: 'SUCCESS'
        });
      }

      return archived;
    });
  }

  // --- Project Intelligence Read & Governed Mutation Model ---

  async listProjectIntelligence(projectId: string): Promise<IntelligenceItem[]> {
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      const err = new Error(`Project '${projectId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (!this.intelligenceRepo) {
      return [];
    }

    return this.intelligenceRepo.listByProject(projectId);
  }

  async getProjectIntelligenceItem(projectId: string, itemId: string): Promise<IntelligenceItem | null> {
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      const err = new Error(`Project '${projectId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (!this.intelligenceRepo) {
      return null;
    }

    return this.intelligenceRepo.getById(projectId, itemId);
  }

  async resolveIntelligenceConflict(
    projectId: string,
    itemId: string,
    chosenCandidateId: string,
    actor: AuthenticatedPrincipal,
    rationale?: string
  ): Promise<IntelligenceItem> {
    return this.runInTransaction(async () => {
      const project = await this.projectRepo.getById(projectId);
      if (!project) {
        const err = new Error(`Project '${projectId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      if (!this.intelligenceRepo) {
        throw new Error('Intelligence repository not available');
      }

      const item = await this.intelligenceRepo.getById(projectId, itemId);
      if (!item) {
        const err = new Error(`Intelligence item '${itemId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      const chosen = item.candidates?.find((c) => c.id === chosenCandidateId);
      if (!chosen) {
        const err = new Error(`Candidate '${chosenCandidateId}' not found for item '${itemId}'`);
        (err as any).statusCode = 400;
        throw err;
      }

      const now = new Date().toISOString();
      item.canonicalState = 'APPROVED';
      item.reviewStatus = 'FOUND';
      item.value = chosen.value;
      if (chosen.unit) item.unit = chosen.unit;
      item.approvalState = 'APPROVED';
      item.approvedBy = actor.displayName;
      item.approvedById = actor.userId;
      item.approvalDate = now;
      item.source = chosen.source;
      item.sourceDocument = chosen.sourceDocument;
      item.sourceLocation = chosen.sourceLocation;
      item.notes = `Authoritative candidate selected from ${chosen.source}. ${rationale ? `Rationale: ${rationale}` : ''}`.trim();

      if (!item.history) item.history = [];
      item.history.push({
        date: now,
        action: `Resolved conflict in favor of candidate (${chosen.value} ${chosen.unit || ''})`,
        actor: actor.displayName,
        note: rationale || `Authoritative source: ${chosen.source}`
      });

      await this.intelligenceRepo.saveItems(projectId, [item]);

      // Update remaining conflicts count deterministically
      const allItems = await this.intelligenceRepo.listByProject(projectId);
      const remainingConflicts = allItems.filter(
        (i) => i.canonicalState === 'CONFLICTING' || i.reviewStatus === 'CONFLICTING'
      ).length;
      await this.projectRepo.update(projectId, { conflictsCount: remainingConflicts });

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: project.organisationId,
          projectId,
          action: 'INTELLIGENCE_CONFLICT_RESOLVE',
          targetType: 'INTELLIGENCE_ITEM',
          targetId: itemId,
          outcome: 'SUCCESS',
          metadata: {
            chosenCandidateId,
            resolvedValue: chosen.value,
            resolvedUnit: chosen.unit
          }
        });
      }

      return item;
    });
  }

  async approveIntelligenceItem(
    projectId: string,
    itemId: string,
    actor: AuthenticatedPrincipal
  ): Promise<IntelligenceItem> {
    return this.runInTransaction(async () => {
      const project = await this.projectRepo.getById(projectId);
      if (!project) {
        const err = new Error(`Project '${projectId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      if (!this.intelligenceRepo) {
        throw new Error('Intelligence repository not available');
      }

      const item = await this.intelligenceRepo.getById(projectId, itemId);
      if (!item) {
        const err = new Error(`Intelligence item '${itemId}' not found`);
        (err as any).statusCode = 404;
        throw err;
      }

      const now = new Date().toISOString();
      item.canonicalState = 'APPROVED';
      item.reviewStatus = 'FOUND';
      item.approvalState = 'APPROVED';
      item.approvedBy = actor.displayName;
      item.approvedById = actor.userId;
      item.approvalDate = now;

      if (!item.history) item.history = [];
      item.history.push({
        date: now,
        action: 'Item formally marked as APPROVED in canonical model',
        actor: actor.displayName
      });

      await this.intelligenceRepo.saveItems(projectId, [item]);

      if (this.auditService) {
        await this.auditService.record({
          actor,
          organisationId: project.organisationId,
          projectId,
          action: 'INTELLIGENCE_APPROVE',
          targetType: 'INTELLIGENCE_ITEM',
          targetId: itemId,
          outcome: 'SUCCESS'
        });
      }

      return item;
    });
  }
}
