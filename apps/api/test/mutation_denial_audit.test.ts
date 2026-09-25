// Protected-mutation authorization denial audit tests
// Defined according to M5.1 PM Review Blocker 5
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { SqliteUserRepository } from '../src/persistence/sqlite/SqliteUserRepository.js';
import { SqliteOrganisationRepository } from '../src/persistence/sqlite/SqliteOrganisationRepository.js';
import { SqliteOrganisationMembershipRepository } from '../src/persistence/sqlite/SqliteOrganisationMembershipRepository.js';
import { SqliteProjectRepository } from '../src/persistence/sqlite/SqliteProjectRepository.js';
import { SqliteAuditEventRepository } from '../src/persistence/sqlite/SqliteAuditEventRepository.js';
import { SqliteSessionRepository } from '../src/persistence/sqlite/SqliteSessionRepository.js';
import { SessionService } from '@pecp/platform-core';

describe('M5.1 Protected Mutation Denial Audit Regressions', () => {
  let app: FastifyInstance;
  let db: SqliteDatabase;
  let userRepo: SqliteUserRepository;
  let orgRepo: SqliteOrganisationRepository;
  let membershipRepo: SqliteOrganisationMembershipRepository;
  let projectRepo: SqliteProjectRepository;
  let auditRepo: SqliteAuditEventRepository;
  let sessionRepo: SqliteSessionRepository;
  let sessionService: SessionService;

  let viewerToken: string;
  let engineerToken: string;
  let orgId: string;
  let projectId: string;

  beforeEach(async () => {
    db = new SqliteDatabase(':memory:');
    db.open();

    userRepo = new SqliteUserRepository(db);
    orgRepo = new SqliteOrganisationRepository(db);
    membershipRepo = new SqliteOrganisationMembershipRepository(db);
    projectRepo = new SqliteProjectRepository(db);
    auditRepo = new SqliteAuditEventRepository(db);
    sessionRepo = new SqliteSessionRepository(db);
    sessionService = new SessionService(sessionRepo, userRepo, 12);

    app = buildApiApp({ database: db, secureCookies: false });
    await app.ready();

    // Create organisation
    const org = await orgRepo.create({
      id: 'org-test-denial',
      name: 'Denial Test Org',
      status: 'ACTIVE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    });
    orgId = org.id;

    // Create project
    const project = await projectRepo.create({
      id: 'proj-denial-target',
      organisationId: orgId,
      organisation: 'Denial Test Org',
      name: 'Governed Performance SUT',
      intent: 'FORECAST',
      description: 'Test project for mutation denials',
      createdDate: '2026-09-25T00:00:00.000Z',
      status: 'ACTIVE',
      documentsCount: 0,
      requirementsCount: 0,
      conflictsCount: 0
    });
    projectId = project.id;

    // Create VIEWER user
    const viewer = await userRepo.create({
      id: 'usr-viewer-denial',
      email: 'viewer@denial.test',
      normalizedEmail: 'viewer@denial.test',
      displayName: 'Victor Viewer',
      status: 'ACTIVE',
      platformRole: 'NONE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    });
    await membershipRepo.save({
      organisationId: orgId,
      userId: viewer.id,
      role: 'VIEWER',
      status: 'ACTIVE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
      createdByUserId: 'usr-root'
    });
    const viewerSession = await sessionService.createSession(viewer.id);
    viewerToken = viewerSession.rawToken;

    // Create PERFORMANCE_ENGINEER user (can create/update project, but cannot archive, resolve or approve)
    const engineer = await userRepo.create({
      id: 'usr-engineer-denial',
      email: 'engineer@denial.test',
      normalizedEmail: 'engineer@denial.test',
      displayName: 'Erin Engineer',
      status: 'ACTIVE',
      platformRole: 'NONE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    });
    await membershipRepo.save({
      organisationId: orgId,
      userId: engineer.id,
      role: 'PERFORMANCE_ENGINEER',
      status: 'ACTIVE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
      createdByUserId: 'usr-root'
    });
    const engineerSession = await sessionService.createSession(engineer.id);
    engineerToken = engineerSession.rawToken;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('1. POST /api/v1/projects denial by VIEWER is audited as AUTHORIZATION_DENIED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        name: 'Unauthorized Project',
        organisation: 'Denial Test Org',
        organisationId: orgId,
        intent: 'DISCOVERY'
      }
    });

    expect(res.statusCode).toBe(403);

    // Verify audit event
    const events = await auditRepo.listByOrganisation(orgId);
    const denial = events.find((e) => e.action === 'AUTHORIZATION_DENIED' && e.targetType === 'PROJECT');
    expect(denial).toBeDefined();
    expect(denial?.outcome).toBe('DENIED');
    expect(denial?.actorUserId).toBe('usr-viewer-denial');
    expect(denial?.reason).toContain('PROJECT_CREATE');
  });

  it('2. PATCH /api/v1/projects/:projectId denial by VIEWER is audited as AUTHORIZATION_DENIED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { name: 'Attempted Rename' }
    });

    expect(res.statusCode).toBe(403);

    const events = await auditRepo.listByOrganisation(orgId);
    const denial = events.find(
      (e) => e.action === 'AUTHORIZATION_DENIED' && e.targetType === 'PROJECT' && e.targetId === projectId
    );
    expect(denial).toBeDefined();
    expect(denial?.outcome).toBe('DENIED');
  });

  it('3. POST /api/v1/projects/:projectId/archive denial by PERFORMANCE_ENGINEER is audited', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/archive`,
      headers: { authorization: `Bearer ${engineerToken}` }
    });

    expect(res.statusCode).toBe(403);

    const events = await auditRepo.listByOrganisation(orgId);
    const denial = events.find(
      (e) => e.action === 'AUTHORIZATION_DENIED' && e.targetType === 'PROJECT' && e.targetId === projectId
    );
    expect(denial).toBeDefined();
    expect(denial?.reason).toContain('PROJECT_ARCHIVE');
  });

  it('4. Membership mutation denials (add, role change, revoke) by VIEWER are audited', async () => {
    // Add membership attempt
    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { userId: 'usr-somebody', role: 'VIEWER' }
    });
    expect(addRes.statusCode).toBe(403);

    // Role change attempt
    const roleRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organisations/${orgId}/memberships/usr-somebody/role`,
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { role: 'ORG_ADMIN' }
    });
    expect(roleRes.statusCode).toBe(403);

    // Revoke attempt
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${orgId}/memberships/usr-somebody/revoke`,
      headers: { authorization: `Bearer ${viewerToken}` }
    });
    expect(revokeRes.statusCode).toBe(403);

    const events = await auditRepo.listByOrganisation(orgId);
    const membershipDenials = events.filter(
      (e) => e.action === 'AUTHORIZATION_DENIED' && e.targetType === 'MEMBERSHIP'
    );
    expect(membershipDenials.length).toBe(3);
  });

  it('5. Intelligence approve denial by PERFORMANCE_ENGINEER is audited', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/item-latency/approve`,
      headers: { authorization: `Bearer ${engineerToken}` }
    });

    expect(res.statusCode).toBe(403);

    const events = await auditRepo.listByOrganisation(orgId);
    const denial = events.find(
      (e) => e.action === 'AUTHORIZATION_DENIED' && e.targetType === 'INTELLIGENCE_ITEM'
    );
    expect(denial).toBeDefined();
    expect(denial?.reason).toContain('INTELLIGENCE_APPROVE');
  });

  it('6. Admin user creation denial by non-PLATFORM_ADMIN is audited without leaking secrets', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: { authorization: `Bearer ${engineerToken}` },
      payload: {
        email: 'attacker@evil.corp',
        displayName: 'Attacker',
        password: 'TopSecretPassword999!'
      }
    });

    expect(res.statusCode).toBe(403);

    const events = await auditRepo.listAll();
    const denial = events.find(
      (e) => e.action === 'AUTHORIZATION_DENIED' && e.targetType === 'USER'
    );
    expect(denial).toBeDefined();
    expect(denial?.reason).toContain('PLATFORM_ADMIN');

    // Prove zero password/secret leakage in metadata
    expect(denial?.metadataJson).not.toContain('TopSecretPassword999!');
    expect(denial?.metadataJson).not.toContain('attacker@evil.corp');
  });
});
