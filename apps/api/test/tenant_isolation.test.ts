// M5.1 Tenant Isolation Tests
// Defined according to M5.1 Work Package §14, §16 & §23

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('M5.1 Tenant Isolation & Non-Leakage', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;

  let adminAuth: { authorization: string };
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let projectBId: string;
  let userAAuth: { authorization: string };
  let userBAuth: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-tenant-test-'));
    const dbPath = path.join(tempDir, 'pecp-tenant.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const admin = await createPlatformAdmin(db);
    adminAuth = admin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();

    // Create Organisation A
    const orgARes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Northstar Retail Corp' }
    });
    orgAId = orgARes.json().id;

    // Create Organisation B
    const orgBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Contoso Financial LLC' }
    });
    orgBId = orgBRes.json().id;

    // Create Project A in Org A
    const projARes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Project Northstar',
        organisation: 'Northstar Retail Corp',
        organisationId: orgAId,
        intent: 'DISCOVERY',
        description: 'Retail project'
      }
    });
    projectAId = projARes.json().id;

    // Create Project B in Org B
    const projBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Project Contoso',
        organisation: 'Contoso Financial LLC',
        organisationId: orgBId,
        intent: 'CERTIFICATION',
        description: 'Finance project'
      }
    });
    projectBId = projBRes.json().id;

    // User A: ORG_ADMIN in Org A only
    const userA = await createTestUser(db, {
      email: 'alice@northstar.com',
      displayName: 'Alice Northstar',
      membership: { organisationId: orgAId, role: 'ORG_ADMIN' }
    });
    userAAuth = userA.authHeaders;

    // User B: ORG_ADMIN in Org B only
    const userB = await createTestUser(db, {
      email: 'bob@contoso.com',
      displayName: 'Bob Contoso',
      membership: { organisationId: orgBId, role: 'ORG_ADMIN' }
    });
    userBAuth = userB.authHeaders;
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. GET /api/v1/projects filters projects by tenant membership', async () => {
    // User A sees ONLY Project A
    const listARes = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: userAAuth
    });
    expect(listARes.statusCode).toBe(200);
    const itemsA = listARes.json().items;
    expect(itemsA.length).toBe(1);
    expect(itemsA[0].id).toBe(projectAId);

    // User B sees ONLY Project B
    const listBRes = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: userBAuth
    });
    expect(listBRes.statusCode).toBe(200);
    const itemsB = listBRes.json().items;
    expect(itemsB.length).toBe(1);
    expect(itemsB[0].id).toBe(projectBId);

    // PLATFORM_ADMIN sees both
    const listAdminRes = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: adminAuth
    });
    expect(listAdminRes.statusCode).toBe(200);
    expect(listAdminRes.json().items.length).toBe(2);
  });

  it('2. GET /api/v1/projects/:id denies cross-tenant direct access', async () => {
    // User A attempts to read Project B by direct ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectBId}`,
      headers: userAAuth
    });
    expect([403, 404]).toContain(getRes.statusCode);

    // User B attempts to read Project A by direct ID
    const getBRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectAId}`,
      headers: userBAuth
    });
    expect([403, 404]).toContain(getBRes.statusCode);
  });

  it('3. GET /api/v1/organisations filters organisations by tenant membership', async () => {
    const orgsResA = await app.inject({
      method: 'GET',
      url: '/api/v1/organisations',
      headers: userAAuth
    });
    expect(orgsResA.statusCode).toBe(200);
    const orgsA = orgsResA.json().items;
    expect(orgsA.map((o: any) => o.id)).toEqual([orgAId]);

    const orgsResB = await app.inject({
      method: 'GET',
      url: '/api/v1/organisations',
      headers: userBAuth
    });
    expect(orgsResB.statusCode).toBe(200);
    const orgsB = orgsResB.json().items;
    expect(orgsB.map((o: any) => o.id)).toEqual([orgBId]);
  });

  it('4. Cross-tenant mutation attempts are forbidden', async () => {
    // User A tries to update Project B
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectBId}`,
      headers: userAAuth,
      payload: { name: 'Attempted Hijack' }
    });
    expect(updateRes.statusCode).toBe(403);

    // User A tries to archive Project B
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectBId}/archive`,
      headers: userAAuth
    });
    expect(archiveRes.statusCode).toBe(403);
  });

  it('5. Audit queries are tenant-scoped', async () => {
    // User A querying Org B audit log must be rejected
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/audit?organisationId=${orgBId}`,
      headers: userAAuth
    });
    expect(auditRes.statusCode).toBe(403);
  });
});
