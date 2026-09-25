// AuthContext & useAuth hook
// Defined according to M5.1 Work Package §17 & §19

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { UserSummary, AuthenticatedPrincipal, Permission, OrganisationRole } from '../types/auth';
import { useServices } from '../services/ServiceContext';

const ROLE_PERMISSIONS: Record<OrganisationRole, Set<Permission>> = {
  ORG_ADMIN: new Set<Permission>([
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
  ]),
  PERFORMANCE_LEAD: new Set<Permission>([
    'ORGANISATION_READ',
    'PROJECT_READ',
    'PROJECT_CREATE',
    'PROJECT_UPDATE',
    'PROJECT_ARCHIVE',
    'INTELLIGENCE_READ',
    'INTELLIGENCE_RESOLVE',
    'INTELLIGENCE_APPROVE',
    'AUDIT_READ'
  ]),
  PERFORMANCE_ENGINEER: new Set<Permission>([
    'ORGANISATION_READ',
    'PROJECT_READ',
    'PROJECT_CREATE',
    'PROJECT_UPDATE',
    'INTELLIGENCE_READ'
  ]),
  REVIEWER: new Set<Permission>([
    'ORGANISATION_READ',
    'PROJECT_READ',
    'INTELLIGENCE_READ',
    'INTELLIGENCE_RESOLVE',
    'INTELLIGENCE_APPROVE',
    'AUDIT_READ'
  ]),
  VIEWER: new Set<Permission>([
    'ORGANISATION_READ',
    'PROJECT_READ',
    'INTELLIGENCE_READ'
  ])
};

export interface AuthContextValue {
  user: UserSummary | null;
  principal: AuthenticatedPrincipal | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission, organisationId?: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  initialValue?: Partial<AuthContextValue>;
}> = ({ children, initialValue }) => {
  const { authService, mode } = useServices();
  const [user, setUser] = useState<UserSummary | null>(initialValue?.user ?? null);
  const [principal, setPrincipal] = useState<AuthenticatedPrincipal | null>(initialValue?.principal ?? null);
  const [permissions, setPermissions] = useState<string[]>(initialValue?.permissions ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(
    initialValue?.isLoading !== undefined ? initialValue.isLoading : mode === 'API'
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await authService.getCurrentUser();
      if (me) {
        setUser(me.user);
        setPrincipal(me.principal);
        setPermissions(me.permissions || []);
      } else {
        setUser(null);
        setPrincipal(null);
        setPermissions([]);
      }
    } catch {
      setUser(null);
      setPrincipal(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      setIsLoading(true);
      try {
        const res = await authService.login(credentials);
        setUser(res.user);
        setPrincipal(res.principal);
        // Refresh permissions from /me
        const me = await authService.getCurrentUser();
        if (me) {
          setPermissions(me.permissions || []);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [authService]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setPrincipal(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  const hasPermission = useCallback(
    (permission: Permission, organisationId?: string): boolean => {
      if (!principal) {
        // In MOCK mode, if no principal set, default to allow
        return mode === 'MOCK';
      }

      if (principal.platformRole === 'PLATFORM_ADMIN') {
        return true;
      }

      if (organisationId) {
        const mem = principal.memberships.find((m) => m.organisationId === organisationId);
        if (!mem) return false;
        const perms = ROLE_PERMISSIONS[mem.role];
        return perms ? perms.has(permission) : false;
      }

      // If no org specified, check if permission holds in ANY active membership
      for (const mem of principal.memberships) {
        const perms = ROLE_PERMISSIONS[mem.role];
        if (perms && perms.has(permission)) {
          return true;
        }
      }

      return false;
    },
    [principal, mode]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      principal,
      permissions,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasPermission,
      refreshUser
    }),
    [user, principal, permissions, isLoading, login, logout, hasPermission, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
