// M5.1 Reference Security & Authorization Scenario
// Defined according to M5.1 Work Package §24

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('M5.1 Synthetic Reference Security Scenario (Northstar vs Contoso)', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;

  let northstarOrgId: string;
  let contosoOrgId: string;

  let northstarProjectId: string;
  let contosoProjectId: string;

  let aliceAdminAuth: { authorization: string };
  let peterLeadAuth: { authorization: string };
  let erinEngineerAuth: { authorization: string };
  let ritaReviewerAuth: { authorization: string };
  let victorViewerAuth: { authorization: string };

  let charlieContosoAuth: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-ref-sec-test-'));
    const dbPath = path.join(tempDir, 'pecp-ref-sec.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const rootAdmin = await createPlatformAdmin(db);
    app = buildApiApp({ database: db });
    await app.ready();

    // 1. Provision Northstar Retail (Org A)
    const northstarRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: rootAdmin.authHeaders,
      payload: { name: 'Northstar Retail Scenario' }
    });
    northstarOrgId = northstarRes.json().id;

    // 2. Provision Contoso Payments (Org B)
    const contosoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: rootAdmin.authHeaders,
      payload: { name: 'Contoso Payments Scenario' }
    });
    contosoOrgId = contosoRes.json().id;

    // 3. Create Northstar Project
    const projNorthstar = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: rootAdmin.authHeaders,
      payload: {
        name: 'Northstar Storefront 2027',
        organisation: 'Northstar Retail Scenario',
        organisationId: northstarOrgId,
        intent: 'FORECAST',
        description: 'Storefront capacity testing'
      }
    });
    northstarProjectId = projNorthstar.json().id;

    // 4. Create Contoso Project
    const projContoso = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: rootAdmin.authHeaders,
      payload: {
        name: 'Contoso Gateway Settlement',
        organisation: 'Contoso Payments Scenario',
        organisationId: contosoOrgId,
        intent: 'CERTIFICATION',
        description: 'Settlement pipeline verification'
      }
    });
    contosoProjectId = projContoso.json().id;

    // 5. Populate Northstar Team with standard M5.1 5-role hierarchy
    const alice = await createTestUser(db, {
      email: 'alice@northstar.internal',
      displayName: 'Alice Admin',
      membership: { organisationId: northstarOrgId, role: 'ORG_ADMIN' }
    });
    aliceAdminAuth = alice.authHeaders;

    const peter = await createTestUser(db, {
      email: 'peter@northstar.internal',
      displayName: 'Peter Lead',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_LEAD' }
    });
    peterLeadAuth = peter.authHeaders;

    const erin = await createTestUser(db, {
      email: 'erin@northstar.internal',
      displayName: 'Erin Engineer',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_ENGINEER' }
    });
    erinEngineerAuth = erin.authHeaders;

    const rita = await createTestUser(db, {
      email: 'rita@northstar.internal',
      displayName: 'Rita Reviewer',
      membership: { organisationId: northstarOrgId, role: 'REVIEWER' }
    });
    ritaReviewerAuth = rita.authHeaders;

    const victor = await createTestUser(db, {
      email: 'victor@northstar.internal',
      displayName: 'Victor Viewer',
      membership: { organisationId: northstarOrgId, role: 'VIEWER' }
    });
    victorViewerAuth = victor.authHeaders;

    // 6. Populate Contoso Team
    const charlie = await createTestUser(db, {
      email: 'charlie@contoso.internal',
      displayName: 'Charlie Contoso Admin',
      membership: { organisationId: contosoOrgId, role: 'ORG_ADMIN' }
    });
    charlieContosoAuth = charlie.authHeaders;
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Alice Admin can manage Northstar memberships, but Peter Lead cannot', async () => {
    const newUser = await createTestUser(db, {
      email: 'new.hire@northstar.internal',
      displayName: 'New Hire'
    });

    // Alice (ORG_ADMIN) adds member -> 201
    const aliceAdd = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${northstarOrgId}/memberships`,
      headers: aliceAdminAuth,
      payload: { userId: newUser.user.id, role: 'VIEWER' }
    });
    expect(aliceAdd.statusCode).toBe(201);

    // Peter (PERFORMANCE_LEAD) attempts to change role -> 403
    const peterChange = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organisations/${northstarOrgId}/memberships/${newUser.user.id}/role`,
      headers: peterLeadAuth,
      payload: { role: 'PERFORMANCE_ENGINEER' }
    });
    expect(peterChange.statusCode).toBe(403);
  });

  it('2. Erin Engineer can create a project, but Victor Viewer and Rita Reviewer cannot', async () => {
    // Erin (PERFORMANCE_ENGINEER) creates project -> 201
    const erinProj = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: erinEngineerAuth,
      payload: {
        name: 'Erin Checkout Test',
        organisation: 'Northstar Retail Scenario',
        organisationId: northstarOrgId,
        intent: 'DISCOVERY',
        description: 'New test by engineer'
      }
    });
    expect(erinProj.statusCode).toBe(201);

    // Victor (VIEWER) creates project -> 403
    const victorProj = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: victorViewerAuth,
      payload: {
        name: 'Victor Unauthorized Project',
        organisation: 'Northstar Retail Scenario',
        organisationId: northstarOrgId,
        intent: 'DISCOVERY',
        description: 'Viewer should fail'
      }
    });
    expect(victorProj.statusCode).toBe(403);

    // Rita (REVIEWER) creates project -> 403
    const ritaProj = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: ritaReviewerAuth,
      payload: {
        name: 'Rita Unauthorized Project',
        organisation: 'Northstar Retail Scenario',
        organisationId: northstarOrgId,
        intent: 'DISCOVERY',
        description: 'Reviewer should fail'
      }
    });
    expect(ritaProj.statusCode).toBe(403);
  });

  it('3. Peter Lead can archive projects, but Erin Engineer cannot', async () => {
    // Erin attempts to archive -> 403
    const erinArchive = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/archive`,
      headers: erinEngineerAuth
    });
    expect(erinArchive.statusCode).toBe(403);

    // Peter archives -> 200
    const peterArchive = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/archive`,
      headers: peterLeadAuth
    });
    expect(peterArchive.statusCode).toBe(200);
    expect(peterArchive.json().status).toBe('ARCHIVED');
  });

  it('4. Strict multi-tenant barrier between Northstar and Contoso', async () => {
    // Charlie Contoso lists projects -> sees ONLY Contoso
    const charlieList = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: charlieContosoAuth
    });
    expect(charlieList.statusCode).toBe(200);
    const contosoProjs = charlieList.json().items;
    expect(contosoProjs.map((p: any) => p.id)).toEqual([contosoProjectId]);

    // Alice Northstar lists projects -> sees ONLY Northstar
    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: aliceAdminAuth
    });
    expect(aliceList.statusCode).toBe(200);
    const northstarProjs = aliceList.json().items;
    expect(northstarProjs.map((p: any) => p.id)).toEqual([northstarProjectId]);

    // Charlie cannot read Northstar project
    const crossGet = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}`,
      headers: charlieContosoAuth
    });
    expect([403, 404]).toContain(crossGet.statusCode);
  });
});
