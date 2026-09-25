// MockAuthService - Standalone mock adapter for MOCK mode
// Preserves M0-M4 test suite isolation without backend dependency

import { IAuthService, AuthResponse, MeResponse } from '../interfaces/IAuthService';
import { UserSummary, AuthenticatedPrincipal } from '../../types/auth';

const MOCK_USER: UserSummary = {
  id: 'usr-mock-admin',
  email: 'mock.admin@retailco.internal',
  displayName: 'Lead Performance Architect',
  status: 'ACTIVE',
  platformRole: 'PLATFORM_ADMIN'
};

const MOCK_PRINCIPAL: AuthenticatedPrincipal = {
  userId: MOCK_USER.id,
  email: MOCK_USER.email,
  displayName: MOCK_USER.displayName,
  platformRole: 'PLATFORM_ADMIN',
  memberships: [
    {
      organisationId: 'retailco',
      role: 'ORG_ADMIN'
    }
  ],
  sessionId: 'mock-session-id',
  authenticatedAt: '2026-09-24T00:00:00.000Z'
};

const ALL_MOCK_PERMISSIONS = [
  'ORGANISATION_READ',
  'ORGANISATION_MANAGE_MEMBERS',
  'PROJECT_READ',
  'PROJECT_CREATE',
  'PROJECT_UPDATE',
  'PROJECT_ARCHIVE',
  'INTELLIGENCE_READ',
  'INTELLIGENCE_RESOLVE',
  'INTELLIGENCE_APPROVE',
  'AUDIT_READ'
];

export class MockAuthService implements IAuthService {
  private authenticated = true;

  async login(_credentials: { email: string; password: string }): Promise<AuthResponse> {
    this.authenticated = true;
    return {
      user: MOCK_USER,
      principal: MOCK_PRINCIPAL,
      csrfToken: 'mock-csrf-token'
    };
  }

  async logout(): Promise<void> {
    this.authenticated = false;
  }

  async getCurrentUser(): Promise<MeResponse | null> {
    if (!this.authenticated) return null;
    return {
      user: MOCK_USER,
      principal: MOCK_PRINCIPAL,
      permissions: ALL_MOCK_PERMISSIONS
    };
  }

  async changePassword(_passwords: { currentPassword: string; newPassword: string }): Promise<void> {
    // No-op in mock
  }
}
