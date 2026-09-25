// IAdminService Interface
// Defined according to M5.1 Work Package §12, §13 & §21

import {
  UserSummary,
  OrganisationMembershipSummary,
  OrganisationRole,
  UserStatus,
  AuditEventSummary
} from '../../types/auth';

export interface CreateUserRequest {
  email: string;
  displayName: string;
  initialPassword?: string;
  platformRole?: 'PLATFORM_ADMIN' | 'NONE';
}

export interface AddMembershipRequest {
  userId: string;
  role: OrganisationRole;
}

export interface AuditQueryOptions {
  organisationId?: string;
  projectId?: string;
  actorUserId?: string;
  action?: string;
  limit?: number;
}

export interface IAdminService {
  // User administration
  listUsers(): Promise<UserSummary[]>;
  getUserById(userId: string): Promise<UserSummary | null>;
  createUser(req: CreateUserRequest): Promise<UserSummary>;
  updateUserStatus(userId: string, status: UserStatus): Promise<UserSummary>;
  resetPassword(userId: string, newPassword: string): Promise<void>;

  // Membership administration
  listMemberships(organisationId: string): Promise<OrganisationMembershipSummary[]>;
  addMembership(organisationId: string, req: AddMembershipRequest): Promise<OrganisationMembershipSummary>;
  updateMembershipRole(organisationId: string, userId: string, role: OrganisationRole): Promise<OrganisationMembershipSummary>;
  revokeMembership(organisationId: string, userId: string): Promise<void>;

  // Audit log
  queryAudit(options?: AuditQueryOptions): Promise<AuditEventSummary[]>;
}
