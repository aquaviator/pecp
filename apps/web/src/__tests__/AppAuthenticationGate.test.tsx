// AppAuthenticationGate Integration Tests
// Defined according to M5.1 PM Review Blocker 2 & Blocker 12
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App, AuthenticatedAppBoundary } from '../App';
import { ServiceProvider } from '../services/ServiceContext';
import { AuthProvider } from '../context/AuthContext';
import { IAuthService } from '../services/interfaces/IAuthService';
import { MockProjectService } from '../services/mock/MockProjectService';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';
import { MockAdminService } from '../services/mock/MockAdminService';
import { MockIntegrationService } from '../services/mock/MockIntegrationService';
import { MockExecutionEvidenceService } from '../services/mock/MockExecutionEvidenceService';
import { UserSummary, AuthenticatedPrincipal } from '../types/auth';

describe('M5.1 App Authentication Gate & Source-Driven Conflict State', () => {
  it('1. MOCK mode bypasses login gate and renders portal with valid AuthContext without crashing', () => {
    const html = renderToString(<App />);

    // In mock mode, portal renders immediately
    expect(html).toContain('Governed Performance Projects');
    expect(html).toContain('Projects');
    expect(html).toContain('Dashboard');
    expect(html).not.toContain('Platform Authentication');
  });

  it('2. API mode renders neutral loading state while session restoration is in progress', () => {
    const dummyAuthService: IAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn().mockReturnValue(new Promise(() => {})),
      changePassword: vi.fn()
    };

    const html = renderToString(
      <ServiceProvider
        serviceMode="API"
        overrideServices={{
          authService: dummyAuthService,
          projectService: new MockProjectService(),
          intelligenceService: new MockIntelligenceService(),
          adminService: new MockAdminService(),
          integrationService: new MockIntegrationService(),
          executionEvidenceService: new MockExecutionEvidenceService()
        }}
      >
        <AuthProvider initialValue={{ isLoading: true, user: null, principal: null }}>
          <AuthenticatedAppBoundary>
            <div>Protected Content</div>
          </AuthenticatedAppBoundary>
        </AuthProvider>
      </ServiceProvider>
    );

    // Neutral loading state is rendered during restoration
    expect(html).toContain('Restoring platform authority session...');
    expect(html).not.toContain('Protected Content');
    expect(html).not.toContain('Platform Authentication');
  });

  it('3. API mode renders LoginPage when unauthenticated', () => {
    const dummyAuthService: IAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn().mockResolvedValue(null),
      changePassword: vi.fn()
    };

    const html = renderToString(
      <ServiceProvider
        serviceMode="API"
        overrideServices={{
          authService: dummyAuthService,
          projectService: new MockProjectService(),
          intelligenceService: new MockIntelligenceService(),
          adminService: new MockAdminService(),
          integrationService: new MockIntegrationService(),
          executionEvidenceService: new MockExecutionEvidenceService()
        }}
      >
        <AuthProvider initialValue={{ isLoading: false, user: null, principal: null }}>
          <AuthenticatedAppBoundary>
            <div>Protected Portal Content</div>
          </AuthenticatedAppBoundary>
        </AuthProvider>
      </ServiceProvider>
    );

    // When unauthenticated, renders login page
    expect(html).toContain('Platform Authentication');
    expect(html).toContain('Work Email Address');
    expect(html).toContain('Password');
    expect(html).not.toContain('Protected Portal Content');
  });

  it('4. API mode renders portal when authenticated and provides active principal', () => {
    const user: UserSummary = {
      id: 'usr-alice',
      email: 'alice@example.com',
      displayName: 'Alice Architect',
      status: 'ACTIVE',
      platformRole: 'NONE'
    };

    const principal: AuthenticatedPrincipal = {
      userId: 'usr-alice',
      email: 'alice@example.com',
      displayName: 'Alice Architect',
      platformRole: 'NONE',
      memberships: [{ organisationId: 'retailco', role: 'ORG_ADMIN' }],
      sessionId: 'sess-alice-123',
      authenticatedAt: '2026-09-25T00:00:00.000Z'
    };

    const dummyAuthService: IAuthService = {
      login: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn().mockResolvedValue({ user, principal, permissions: ['PROJECT_READ'] }),
      changePassword: vi.fn()
    };

    const html = renderToString(
      <ServiceProvider
        serviceMode="API"
        overrideServices={{
          authService: dummyAuthService,
          projectService: new MockProjectService(),
          intelligenceService: new MockIntelligenceService(),
          adminService: new MockAdminService(),
          integrationService: new MockIntegrationService(),
          executionEvidenceService: new MockExecutionEvidenceService()
        }}
      >
        <AuthProvider initialValue={{ isLoading: false, user, principal, permissions: ['PROJECT_READ'] }}>
          <AuthenticatedAppBoundary>
            <div data-testid="protected-portal">Authorized Corporate Workspace</div>
          </AuthenticatedAppBoundary>
        </AuthProvider>
      </ServiceProvider>
    );

    // Shows protected portal content
    expect(html).toContain('Authorized Corporate Workspace');
    expect(html).not.toContain('Platform Authentication');
  });

  it('5. conflictsCount is null/source-driven and does NOT default to 3 in initial state', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Governed Performance Projects');
    // Verify that the initial portal state does not hardcode conflict count 3
    expect(html).not.toContain('<span class="font-bold text-purple-400">3</span>');
  });
});
