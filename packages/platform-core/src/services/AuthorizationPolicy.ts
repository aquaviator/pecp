// AuthorizationPolicy - Deterministic RBAC Policy Engine
// Defined according to M5.1 Work Package §4 & §6

import { OrganisationRole, Permission, AuthenticatedPrincipal } from '../types.js';

export const ALL_PERMISSIONS: readonly Permission[] = [
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
] as const;

export const ROLE_PERMISSIONS: Record<OrganisationRole, readonly Permission[]> = {
  ORG_ADMIN: [
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
  ],
  PERFORMANCE_LEAD: [
    'ORGANISATION_READ',
    'PROJECT_READ',
    'PROJECT_CREATE',
    'PROJECT_UPDATE',
    'PROJECT_ARCHIVE',
    'INTELLIGENCE_READ',
    'INTELLIGENCE_RESOLVE',
    'INTELLIGENCE_APPROVE',
    'AUDIT_READ'
  ],
  PERFORMANCE_ENGINEER: [
    'ORGANISATION_READ',
    'PROJECT_READ',
    'PROJECT_CREATE',
    'PROJECT_UPDATE',
    'INTELLIGENCE_READ'
  ],
  REVIEWER: [
    'ORGANISATION_READ',
    'PROJECT_READ',
    'INTELLIGENCE_READ',
    'INTELLIGENCE_RESOLVE',
    'INTELLIGENCE_APPROVE',
    'AUDIT_READ'
  ],
  VIEWER: [
    'ORGANISATION_READ',
    'PROJECT_READ',
    'INTELLIGENCE_READ'
  ]
};

export class AuthorizationPolicy {
  /**
   * Check if a principal has a specific permission within an organisation context.
   * PLATFORM_ADMIN has a global bypass for all implemented M5.1 permissions.
   */
  static hasPermission(
    principal: AuthenticatedPrincipal,
    permission: Permission,
    organisationId?: string
  ): boolean {
    if (principal.platformRole === 'PLATFORM_ADMIN') {
      return true;
    }

    if (!organisationId) {
      // If no organisation context is provided, user has the permission if they hold it in ANY active membership
      return principal.memberships.some((m) =>
        ROLE_PERMISSIONS[m.role]?.includes(permission)
      );
    }

    const membership = principal.memberships.find((m) => m.organisationId === organisationId);
    if (!membership) {
      return false;
    }

    const permissions = ROLE_PERMISSIONS[membership.role] || [];
    return permissions.includes(permission);
  }

  /**
   * Get all effective permissions for a principal in a specific organisation (or global union).
   */
  static getEffectivePermissions(
    principal: AuthenticatedPrincipal,
    organisationId?: string
  ): Permission[] {
    if (principal.platformRole === 'PLATFORM_ADMIN') {
      return [...ALL_PERMISSIONS];
    }

    if (!organisationId) {
      const perms = new Set<Permission>();
      for (const m of principal.memberships) {
        for (const p of ROLE_PERMISSIONS[m.role] || []) {
          perms.add(p);
        }
      }
      return Array.from(perms);
    }

    const membership = principal.memberships.find((m) => m.organisationId === organisationId);
    if (!membership) return [];
    return [...ROLE_PERMISSIONS[membership.role]];
  }
}
