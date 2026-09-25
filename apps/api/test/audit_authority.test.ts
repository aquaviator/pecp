// M5.1 Audit Authority & Immutable Attribution Tests
// Defined according to M5.1 Work Package §9, §14 & §23

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('M5.1 Audit Authority & Governed Attribution', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;
  let adminAuth: { authorization: string };
  let adminUser: any;
  let orgId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-audit-test-'));
    const dbPath = path.join(tempDir, 'pecp-audit.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const admin = await createPlatformAdmin(db);
    adminAuth = admin.authHeaders;
    adminUser = admin.user;

    app = buildApiApp({ database: db });
    await app.ready();

    // Create an organisation
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Audit Testing Corp' }
    });
    orgId = orgRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Attributes governed project creation and mutations to the authenticated session actor', async () => {
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Attributed Project',
        organisation: 'Audit Testing Corp',
        organisationId: orgId,
        intent: 'INVESTIGATIVE',
        description: 'Verifying audit trail'
      }
    });
    expect(projRes.statusCode).toBe(201);
    const projectId = projRes.json().id;

    // Query audit events for project creation
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/audit?projectId=${projectId}`,
      headers: adminAuth
    });
    expect(auditRes.statusCode).toBe(200);
    const events = auditRes.json().items;

    const createEvent = events.find((e: any) => e.action === 'PROJECT_CREATE');
    expect(createEvent).toBeDefined();
    expect(createEvent.actorUserId).toBe(adminUser.id);
    expect(createEvent.actorDisplayName).toBe(adminUser.displayName);
    expect(createEvent.outcome).toBe('SUCCESS');
    expect(createEvent.targetId).toBe(projectId);
  });

  it('2. Audit records are immutable: reject any attempt to update or delete audit events', async () => {
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/audit/any-id',
      headers: adminAuth
    });
    expect(deleteRes.statusCode).toBe(404);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/audit/any-id',
      headers: adminAuth,
      payload: { outcome: 'DENIED' }
    });
    expect(patchRes.statusCode).toBe(404);
  });

  it('3. Audit metadata never leaks secrets or cryptographic materials', async () => {
    // Create a new user with password
    const userRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: adminAuth,
      payload: {
        email: 'secret.check@pecp.io',
        displayName: 'Secret Check',
        initialPassword: 'SuperSecretPassword123!'
      }
    });
    expect(userRes.statusCode).toBe(201);

    // Query all audit events
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/v1/audit',
      headers: adminAuth
    });
    expect(auditRes.statusCode).toBe(200);
    const allEvents = auditRes.json().items;

    for (const event of allEvents) {
      const serialized = JSON.stringify(event);
      expect(serialized).not.toContain('SuperSecretPassword123!');
      expect(serialized).not.toContain('scrypt-v1');
      expect(serialized).not.toContain('passwordHash');
      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('pecp_session');
      expect(serialized).not.toContain('pecp_csrf');
    }
  });

  it('4. Attributes membership management actions accurately to the governing actor', async () => {
    // Create target user
    const targetUser = await createTestUser(db, {
      email: 'member@pecp.io',
      displayName: 'Prospective Member'
    });

    // Add membership
    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth,
      payload: {
        userId: targetUser.user.id,
        role: 'REVIEWER'
      }
    });
    expect(addRes.statusCode).toBe(201);

    // Update role
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organisations/${orgId}/memberships/${targetUser.user.id}/role`,
      headers: adminAuth,
      payload: { role: 'PERFORMANCE_LEAD' }
    });
    expect(updateRes.statusCode).toBe(200);

    // Revoke
    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${orgId}/memberships/${targetUser.user.id}/revoke`,
      headers: adminAuth
    });
    expect(revokeRes.statusCode).toBe(200);

    // Verify audit events exist for all three actions
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/audit?organisationId=${orgId}`,
      headers: adminAuth
    });
    const actions = auditRes.json().items.map((e: any) => e.action);
    expect(actions).toContain('MEMBERSHIP_CREATE');
    expect(actions).toContain('MEMBERSHIP_ROLE_CHANGE');
    expect(actions).toContain('MEMBERSHIP_REVOKE');
  });
});
