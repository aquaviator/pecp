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
  conflictsCount?: number;
  requirementsCount?: number;
  documentsCount?: number;
}

export interface ProjectWithMetadata {
  project: ProjectSummary;
  bootstrapMetadata?: ProjectBootstrapMetadata | null;
}

// --- M5.1 Identity, RBAC, Sessions, and Audit Types ---

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type PlatformRole = 'PLATFORM_ADMIN' | 'NONE';

export interface User {
  id: string;
  email: string;
  normalizedEmail: string;
  displayName: string;
  status: UserStatus;
  platformRole: PlatformRole;
  createdAt: string;
  updatedAt: string;
}

export type OrganisationRole =
  | 'ORG_ADMIN'
  | 'PERFORMANCE_LEAD'
  | 'PERFORMANCE_ENGINEER'
  | 'REVIEWER'
  | 'VIEWER';

export type OrganisationMembershipStatus = 'ACTIVE' | 'REVOKED';

export interface OrganisationMembership {
  organisationId: string;
  userId: string;
  role: OrganisationRole;
  status: OrganisationMembershipStatus;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
}

export interface PrincipalMembership {
  organisationId: string;
  role: OrganisationRole;
}

export interface AuthenticatedPrincipal {
  userId: string;
  email: string;
  displayName: string;
  platformRole: PlatformRole;
  memberships: PrincipalMembership[];
  sessionId: string;
  authenticatedAt: string;
}

export type Permission =
  | 'ORGANISATION_READ'
  | 'ORGANISATION_MANAGE_MEMBERS'
  | 'PROJECT_READ'
  | 'PROJECT_CREATE'
  | 'PROJECT_UPDATE'
  | 'PROJECT_ARCHIVE'
  | 'INTELLIGENCE_READ'
  | 'INTELLIGENCE_RESOLVE'
  | 'INTELLIGENCE_APPROVE'
  | 'AUDIT_READ';

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  authenticatedAt: string;
}

export interface LocalCredential {
  userId: string;
  algorithm: string;
  salt: string;
  passwordHash: string;
  paramsJson: string;
  updatedAt: string;
}

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'USER_CREATE'
  | 'USER_DISABLE'
  | 'USER_ENABLE'
  | 'ORGANISATION_CREATE'
  | 'ORGANISATION_STATUS_CHANGE'
  | 'MEMBERSHIP_CREATE'
  | 'MEMBERSHIP_ROLE_CHANGE'
  | 'MEMBERSHIP_REVOKE'
  | 'PROJECT_CREATE'
  | 'PROJECT_UPDATE'
  | 'PROJECT_ARCHIVE'
  | 'INTELLIGENCE_CONFLICT_RESOLVE'
  | 'INTELLIGENCE_APPROVE'
  | 'AUTHORIZATION_DENIED';

export type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILURE';

export interface AuditEvent {
  id: string;
  occurredAt: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  organisationId?: string | null;
  projectId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  outcome: AuditOutcome;
  reason?: string | null;
  metadataJson?: string | null;
}

export interface AuditQueryFilter {
  organisationId?: string;
  projectId?: string;
  actorUserId?: string;
  action?: AuditAction;
  limit?: number;
  before?: string;
  after?: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  platformRole?: PlatformRole;
}

export interface CreateMembershipInput {
  organisationId: string;
  userId: string;
  role: OrganisationRole;
  createdByUserId: string;
}
