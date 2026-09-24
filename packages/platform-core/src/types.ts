// PECP Platform Core Types
// Authoritative tenancy, organisation, and project bootstrap contracts according to M5.0

import {
  EngineeringIntent,
  ProjectCreationMethod,
  ProjectSummary,
  IntelligenceItem
} from '@pecp/pe-domain';

export type OrganisationStatus = 'ACTIVE' | 'ARCHIVED';

export interface Organisation {
  id: string;
  name: string;
  status: OrganisationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBootstrapMetadata {
  creationMethod: ProjectCreationMethod;
  briefText?: string;
  uploadedDocumentNames?: string[];
  externalReference?: string;
}

export interface EntityRevision {
  id?: string;
  entityType: 'ORGANISATION' | 'PROJECT';
  entityId: string;
  revisionNumber: number;
  payloadJson: string;
  recordedAt: string;
  actorRef?: string | null;
}

export interface CreateOrganisationInput {
  name: string;
}

export interface CreateProjectInput {
  name: string;
  organisation: string;
  intent: EngineeringIntent;
  description: string;
  creationMethod: ProjectCreationMethod;
  briefText?: string;
  uploadedDocumentNames?: string[];
  externalReference?: string;
  organisationId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  intent?: EngineeringIntent;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
}

export interface ProjectWithMetadata {
  project: ProjectSummary;
  bootstrapMetadata?: ProjectBootstrapMetadata | null;
}
