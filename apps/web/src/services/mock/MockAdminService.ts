// MockAdminService - Standalone mock adapter for Admin & Audit operations in MOCK mode

import {
  IAdminService,
  CreateUserRequest,
  AddMembershipRequest,
  AuditQueryOptions
} from '../interfaces/IAdminService';
import {
  UserSummary,
  OrganisationMembershipSummary,
  OrganisationRole,
  UserStatus,
  AuditEventSummary
} from '../../types/auth';

const INITIAL_USERS: UserSummary[] = [
  {
    id: 'usr-admin-1',
    email: 'alice.admin@retailco.com',
    displayName: 'Alice Admin',
    status: 'ACTIVE',
    platformRole: 'PLATFORM_ADMIN',
    createdAt: '2026-09-20T00:00:00.000Z'
  },
  {
    id: 'usr-lead-2',
    email: 'peter.lead@retailco.com',
    displayName: 'Peter Lead',
    status: 'ACTIVE',
    platformRole: 'NONE',
    createdAt: '2026-09-21T00:00:00.000Z'
  },
  {
    id: 'usr-eng-3',
    email: 'erin.engineer@retailco.com',
    displayName: 'Erin Engineer',
    status: 'ACTIVE',
    platformRole: 'NONE',
    createdAt: '2026-09-22T00:00:00.000Z'
  }
];

const INITIAL_MEMBERSHIPS: OrganisationMembershipSummary[] = [
  {
    organisationId: 'retailco',
    userId: 'usr-admin-1',
    role: 'ORG_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    createdByUserId: 'usr-admin-1',
    user: INITIAL_USERS[0]
  },
  {
    organisationId: 'retailco',
    userId: 'usr-lead-2',
    role: 'PERFORMANCE_LEAD',
    status: 'ACTIVE',
    createdAt: '2026-09-21T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    createdByUserId: 'usr-admin-1',
    user: INITIAL_USERS[1]
  }
];

const INITIAL_AUDIT_EVENTS: AuditEventSummary[] = [
  {
    id: 'audit-001',
    occurredAt: '2026-09-24T10:00:00.000Z',
    actorUserId: 'usr-admin-1',
    actorDisplayName: 'Alice Admin',
    organisationId: 'retailco',
    action: 'ORGANISATION_CREATE',
    targetType: 'ORGANISATION',
    targetId: 'retailco',
    outcome: 'SUCCESS'
  },
  {
    id: 'audit-002',
    occurredAt: '2026-09-24T10:05:00.000Z',
    actorUserId: 'usr-admin-1',
    actorDisplayName: 'Alice Admin',
    organisationId: 'retailco',
    projectId: 'retailco-northstar',
    action: 'PROJECT_CREATE',
    targetType: 'PROJECT',
    targetId: 'retailco-northstar',
    outcome: 'SUCCESS'
  }
];

export class MockAdminService implements IAdminService {
  private users: UserSummary[] = [...INITIAL_USERS];
  private memberships: OrganisationMembershipSummary[] = [...INITIAL_MEMBERSHIPS];
  private auditEvents: AuditEventSummary[] = [...INITIAL_AUDIT_EVENTS];

  async listUsers(): Promise<UserSummary[]> {
    return [...this.users];
  }

  async getUserById(userId: string): Promise<UserSummary | null> {
    return this.users.find((u) => u.id === userId) || null;
  }

  async createUser(req: CreateUserRequest): Promise<UserSummary> {
    const newUser: UserSummary = {
      id: `usr-mock-${Date.now()}`,
      email: req.email,
      displayName: req.displayName,
      status: 'ACTIVE',
      platformRole: req.platformRole || 'NONE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<UserSummary> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    user.status = status;
    return user;
  }

  async resetPassword(_userId: string, _newPassword: string): Promise<void> {
    // No-op in mock
  }

  async listMemberships(organisationId: string): Promise<OrganisationMembershipSummary[]> {
    return this.memberships.filter((m) => m.organisationId === organisationId);
  }

  async addMembership(
    organisationId: string,
    req: AddMembershipRequest
  ): Promise<OrganisationMembershipSummary> {
    const user = this.users.find((u) => u.id === req.userId);
    const newMembership: OrganisationMembershipSummary = {
      organisationId,
      userId: req.userId,
      role: req.role,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUserId: 'usr-admin-1',
      user
    };
    this.memberships.push(newMembership);
    return newMembership;
  }

  async updateMembershipRole(
    organisationId: string,
    userId: string,
    role: OrganisationRole
  ): Promise<OrganisationMembershipSummary> {
    const m = this.memberships.find((mem) => mem.organisationId === organisationId && mem.userId === userId);
    if (!m) throw new Error('Membership not found');
    m.role = role;
    m.updatedAt = new Date().toISOString();
    return m;
  }

  async revokeMembership(organisationId: string, userId: string): Promise<void> {
    const m = this.memberships.find((mem) => mem.organisationId === organisationId && mem.userId === userId);
    if (m) {
      m.status = 'REVOKED';
      m.updatedAt = new Date().toISOString();
    }
  }

  async queryAudit(options: AuditQueryOptions = {}): Promise<AuditEventSummary[]> {
    let result = [...this.auditEvents];
    if (options.organisationId) {
      result = result.filter((e) => e.organisationId === options.organisationId);
    }
    if (options.projectId) {
      result = result.filter((e) => e.projectId === options.projectId);
    }
    if (options.action) {
      result = result.filter((e) => e.action === options.action);
    }
    return result;
  }
}
