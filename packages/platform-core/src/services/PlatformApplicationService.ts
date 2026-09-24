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
  ProjectWithMetadata
} from '../types';
import { IOrganisationRepository } from '../repositories/IOrganisationRepository';
import { IProjectRepository } from '../repositories/IProjectRepository';
import { IEntityRevisionRepository } from '../repositories/IEntityRevisionRepository';
import { IIntelligenceRepository } from '../repositories/IIntelligenceRepository';

export interface PlatformServiceDependencies {
  organisationRepository: IOrganisationRepository;
  projectRepository: IProjectRepository;
  entityRevisionRepository?: IEntityRevisionRepository;
  intelligenceRepository?: IIntelligenceRepository;
}

export class PlatformApplicationService {
  private readonly orgRepo: IOrganisationRepository;
  private readonly projectRepo: IProjectRepository;
  private readonly revisionRepo?: IEntityRevisionRepository;
  private readonly intelligenceRepo?: IIntelligenceRepository;

  constructor(deps: PlatformServiceDependencies) {
    this.orgRepo = deps.organisationRepository;
    this.projectRepo = deps.projectRepository;
    this.revisionRepo = deps.entityRevisionRepository;
    this.intelligenceRepo = deps.intelligenceRepository;
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

  async createOrganisation(input: CreateOrganisationInput): Promise<Organisation> {
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
        actorRef: null
      });
    }

    return created;
  }

  async updateOrganisationStatus(id: string, status: OrganisationStatus): Promise<Organisation | null> {
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
        actorRef: null
      });
    }

    return updated;
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

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
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
        targetOrg = await this.createOrganisation({ name: trimmedOrgName });
      }
    }

    const now = new Date().toISOString();
    const projectId = `proj-${crypto.randomUUID()}`;

    // Strictly zero-invention safeguards according to M5.0 §2:
    // requirementsCount remains 0 until requirements are extracted
    // conflictsCount remains 0
    // documentsCount matches uploadedDocumentNames count exactly
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
        actorRef: null
      });
    }

    return created;
  }

  async updateProject(id: string, updates: UpdateProjectInput): Promise<ProjectSummary | null> {
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
        actorRef: null
      });
    }

    return updated;
  }

  async archiveProject(id: string): Promise<ProjectSummary | null> {
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
        actorRef: null
      });
    }

    return archived;
  }

  // --- §7 Extension: Project Intelligence Read Model ---

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
}
