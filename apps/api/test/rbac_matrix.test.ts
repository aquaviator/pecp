// M5.1 RBAC Matrix Deterministic Permissions Tests
// Defined according to M5.1 Work Package §4, §6 & §23

import { describe, it, expect } from 'vitest';
import {
  AuthorizationPolicy,
  OrganisationRole,
  Permission,
  AuthenticatedPrincipal
} from '@pecp/platform-core';

describe('M5.1 RBAC Deterministic Permission Matrix', () => {
  const targetOrgId = 'org-northstar';

  function buildPrincipal(
    role: OrganisationRole | null,
    platformRole: 'PLATFORM_ADMIN' | 'NONE' = 'NONE'
  ): AuthenticatedPrincipal {
    return {
      userId: 'usr-1',
      email: 'user@northstar.com',
      displayName: 'Test User',
      platformRole,
      memberships: role ? [{ organisationId: targetOrgId, role }] : [],
      sessionId: 'sess-1',
      authenticatedAt: new Date().toISOString()
    };
  }

  const ALL_PERMISSIONS: Permission[] = [
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

  it('1. PLATFORM_ADMIN has all platform permissions globally across any organisation', () => {
    const principal = buildPrincipal(null, 'PLATFORM_ADMIN');
    for (const perm of ALL_PERMISSIONS) {
      expect(AuthorizationPolicy.hasPermission(principal, perm, targetOrgId)).toBe(true);
      expect(AuthorizationPolicy.hasPermission(principal, perm, 'org-any-other')).toBe(true);
    }
  });

  it('2. ORG_ADMIN has all 10 organisation-scoped permissions', () => {
    const principal = buildPrincipal('ORG_ADMIN');
    for (const perm of ALL_PERMISSIONS) {
      expect(AuthorizationPolicy.hasPermission(principal, perm, targetOrgId)).toBe(true);
    }
    // But NOT in an organisation they do not belong to
    for (const perm of ALL_PERMISSIONS) {
      expect(AuthorizationPolicy.hasPermission(principal, perm, 'org-other')).toBe(false);
    }
  });

  it('3. PERFORMANCE_LEAD can read, create, update, archive projects, resolve & approve intelligence, read audit, but CANNOT manage members', () => {
    const principal = buildPrincipal('PERFORMANCE_LEAD');

    // Allowed
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_CREATE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_UPDATE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_ARCHIVE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_RESOLVE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_APPROVE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', targetOrgId)).toBe(true);

    // Denied
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', targetOrgId)).toBe(false);
  });

  it('4. PERFORMANCE_ENGINEER can read org/projects/intel and create/update projects, but CANNOT archive, approve, resolve, or audit', () => {
    const principal = buildPrincipal('PERFORMANCE_ENGINEER');

    // Allowed
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_CREATE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_UPDATE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', targetOrgId)).toBe(true);

    // Denied
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_ARCHIVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_RESOLVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_APPROVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', targetOrgId)).toBe(false);
  });

  it('5. REVIEWER can read org/projects/intel, resolve & approve intelligence, and read audit, but CANNOT create/update/archive projects or manage members', () => {
    const principal = buildPrincipal('REVIEWER');

    // Allowed
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_RESOLVE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_APPROVE', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', targetOrgId)).toBe(true);

    // Denied
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_CREATE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_UPDATE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_ARCHIVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', targetOrgId)).toBe(false);
  });

  it('6. VIEWER has read-only access to organisation, projects, and intelligence items', () => {
    const principal = buildPrincipal('VIEWER');

    // Allowed
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', targetOrgId)).toBe(true);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', targetOrgId)).toBe(true);

    // Denied
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_CREATE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_UPDATE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'PROJECT_ARCHIVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_RESOLVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_APPROVE', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', targetOrgId)).toBe(false);
    expect(AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', targetOrgId)).toBe(false);
  });
});
