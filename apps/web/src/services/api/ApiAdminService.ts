// ApiAdminService - Production-shaped API adapter for User/Membership Administration and Audit
// Defined according to M5.1 Work Package §12, §13 & §21

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
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiAdminService implements IAdminService {
  constructor(private readonly client: ApiClient = defaultApiClient) {}

  async listUsers(): Promise<UserSummary[]> {
    const data = await this.client.get<{ items: UserSummary[] }>('/api/v1/admin/users');
    if (!data || !Array.isArray(data.items)) {
      throw new Error("ApiAdminService: Expected '{ items: [...] }' envelope from /api/v1/admin/users");
    }
    return data.items;
  }

  async getUserById(userId: string): Promise<UserSummary | null> {
    try {
      return await this.client.get<UserSummary>(`/api/v1/admin/users/${encodeURIComponent(userId)}`);
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async createUser(req: CreateUserRequest): Promise<UserSummary> {
    return this.client.post<UserSummary>('/api/v1/admin/users', req);
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<UserSummary> {
    return this.client.patch<UserSummary>(`/api/v1/admin/users/${encodeURIComponent(userId)}/status`, { status });
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    await this.client.post(`/api/v1/admin/users/${encodeURIComponent(userId)}/reset-password`, { newPassword });
  }

  async listMemberships(organisationId: string): Promise<OrganisationMembershipSummary[]> {
    const data = await this.client.get<{ items: OrganisationMembershipSummary[] }>(
      `/api/v1/organisations/${encodeURIComponent(organisationId)}/memberships`
    );
    if (!data || !Array.isArray(data.items)) {
      throw new Error("ApiAdminService: Expected '{ items: [...] }' envelope from memberships endpoint");
    }
    return data.items;
  }

  async addMembership(
    organisationId: string,
    req: AddMembershipRequest
  ): Promise<OrganisationMembershipSummary> {
    return this.client.post<OrganisationMembershipSummary>(
      `/api/v1/organisations/${encodeURIComponent(organisationId)}/memberships`,
      req
    );
  }

  async updateMembershipRole(
    organisationId: string,
    userId: string,
    role: OrganisationRole
  ): Promise<OrganisationMembershipSummary> {
    return this.client.patch<OrganisationMembershipSummary>(
      `/api/v1/organisations/${encodeURIComponent(organisationId)}/memberships/${encodeURIComponent(userId)}/role`,
      { role }
    );
  }

  async revokeMembership(organisationId: string, userId: string): Promise<void> {
    await this.client.post(
      `/api/v1/organisations/${encodeURIComponent(organisationId)}/memberships/${encodeURIComponent(userId)}/revoke`
    );
  }

  async queryAudit(options: AuditQueryOptions = {}): Promise<AuditEventSummary[]> {
    const params = new URLSearchParams();
    if (options.organisationId) params.set('organisationId', options.organisationId);
    if (options.projectId) params.set('projectId', options.projectId);
    if (options.actorUserId) params.set('actorUserId', options.actorUserId);
    if (options.action) params.set('action', options.action);
    if (options.limit) params.set('limit', String(options.limit));

    const qs = params.toString();
    const url = `/api/v1/audit${qs ? `?${qs}` : ''}`;
    const data = await this.client.get<{ items: AuditEventSummary[] }>(url);
    if (!data || !Array.isArray(data.items)) {
      throw new Error("ApiAdminService: Expected '{ items: [...] }' envelope from /api/v1/audit");
    }
    return data.items;
  }
}
