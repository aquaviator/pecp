// M5.1 Web Auth & Governance Types

export type PlatformRole = 'PLATFORM_ADMIN' | 'NONE';

export type OrganisationRole =
  | 'ORG_ADMIN'
  | 'PERFORMANCE_LEAD'
  | 'PERFORMANCE_ENGINEER'
  | 'REVIEWER'
  | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type MembershipStatus = 'ACTIVE' | 'REVOKED';

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

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  platformRole: PlatformRole;
  createdAt?: string;
  updatedAt?: string;
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

export interface OrganisationMembershipSummary {
  organisationId: string;
  userId: string;
  role: OrganisationRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  user?: UserSummary;
}

export interface AuditEventSummary {
  id: string;
  occurredAt: string;
  actorUserId?: string;
  actorDisplayName?: string;
  organisationId?: string;
  projectId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  reason?: string;
  metadata?: Record<string, any>;
}
