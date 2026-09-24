// IProjectRepository
// Defined according to M5.0 Work Package §2

import { ProjectSummary } from '@pecp/pe-domain';
import { ProjectBootstrapMetadata, UpdateProjectInput } from '../types';

export interface IProjectRepository {
  list(): Promise<ProjectSummary[]>;
  listByOrganisation(organisationId: string): Promise<ProjectSummary[]>;
  getById(id: string): Promise<ProjectSummary | null>;
  getBootstrapMetadata?(projectId: string): Promise<ProjectBootstrapMetadata | null>;
  create(project: ProjectSummary, bootstrapMetadata?: ProjectBootstrapMetadata): Promise<ProjectSummary>;
  update(id: string, updates: UpdateProjectInput): Promise<ProjectSummary | null>;
  archive(id: string): Promise<ProjectSummary | null>;
}
