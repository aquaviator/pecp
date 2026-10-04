// Integration Tests for GET /api/v1/projects/:projectId/performance-contract
// Verifies HTTP API exposure, RBAC authorization, and response fidelity

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('Performance Contract API Integration (GET /api/v1/projects/:projectId/performance-contract)', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;

  let northstarOrgId: string;
  let contosoOrgId: string;
  let northstarProjectId: string;

  let adminAuth: { authorization: string };
  let peterLeadAuth: { authorization: string };
  let victorViewerAuth: { authorization: string };
  let charlieContosoAuth: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-contract-api-'));
    dbPath = path.join(tempDir, 'pecp-contract-api.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const rootAdmin = await createPlatformAdmin(db);
    adminAuth = rootAdmin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();

    // 1. Provision Northstar Org
    const northstarOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Northstar Logistics' }
    });
    northstarOrgId = northstarOrgRes.json().id;

    // 2. Provision Contoso Org (for cross-tenant tests)
    const contosoOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Contoso Foreign Org' }
    });
    contosoOrgId = contosoOrgRes.json().id;

    // 3. Create users
    const peter = await createTestUser(db, {
      email: 'peter@northstar.internal',
      displayName: 'Peter Lead',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_LEAD' }
    });
    peterLeadAuth = peter.authHeaders;

    const victor = await createTestUser(db, {
      email: 'victor@northstar.internal',
      displayName: 'Victor Viewer',
      membership: { organisationId: northstarOrgId, role: 'VIEWER' }
    });
    victorViewerAuth = victor.authHeaders;

    const charlie = await createTestUser(db, {
      email: 'charlie@contoso.internal',
      displayName: 'Charlie Contoso',
      membership: { organisationId: contosoOrgId, role: 'ORG_ADMIN' }
    });
    charlieContosoAuth = charlie.authHeaders;

    // 4. Create Northstar Project
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Northstar Peak 2027 Ingestion',
        organisation: 'Northstar Logistics',
        organisationId: northstarOrgId,
        intent: 'FORECAST',
        description: 'Black Friday 2027 capacity planning'
      }
    });
    northstarProjectId = projRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Rejects unauthenticated request with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`
    });
    expect(res.statusCode).toBe(401);
  });

  it('2. Returns 404 Not Found for non-existent project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/proj-unknown-12345/performance-contract',
      headers: peterLeadAuth
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('3. Rejects cross-tenant access with 403 Forbidden', async () => {
    // Charlie is in Contoso, attempting to read Northstar project contract
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: charlieContosoAuth
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('4. Returns 200 OK with BLOCKED status when required inputs are missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: victorViewerAuth
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.projectId).toBe(northstarProjectId);
    expect(body.status).toBe('BLOCKED');
    expect(body.isCompileReady).toBe(false);
    expect(body.fingerprint).toMatch(/^fp-[a-f0-9]{8}$/);
    expect(body.blockingIssues.length).toBeGreaterThan(0);
    expect(body.blockingIssues[0].fieldKey).toBe('peak_orders_per_hr');
    expect(body.contract.status).toBe('BLOCKED');
  });

  it('5. Returns 200 OK with READY_FOR_APPROVAL and lineage when inputs are approved', async () => {
    // 1. Capture text source
    const textRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/text`,
      headers: peterLeadAuth,
      payload: {
        title: 'Executive Architecture Memo',
        text: 'Peak hourly order volume target is 24000 orders/hr.',
        kind: 'BRIEF'
      }
    });
    expect(textRes.statusCode).toBe(201);
    const textSource = textRes.json();

    const extractionRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/sources/${textSource.source.id}/versions/${textSource.version.id}/extraction`,
      headers: peterLeadAuth
    });
    expect(extractionRes.statusCode).toBe(200);
    const locator = extractionRes.json().fragments[0].locator;

    // 2. Create and approve peak_orders_per_hr item
    const createItemRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence`,
      headers: peterLeadAuth,
      payload: {
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        value: 24000,
        unit: 'orders/hr',
        sourceBinding: {
          sourceId: textSource.source.id,
          sourceVersionId: textSource.version.id,
          locator
        }
      }
    });
    expect(createItemRes.statusCode).toBe(201);
    const createdItem = createItemRes.json();

    // Approve it
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${createdItem.id}/approve`,
      headers: peterLeadAuth,
      payload: { expectedRevision: 1 }
    });
    expect(approveRes.statusCode).toBe(200);

    // 3. Query compiled performance contract
    const contractRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: victorViewerAuth
    });
    expect(contractRes.statusCode).toBe(200);
    const contractResult = contractRes.json();

    expect(contractResult.isCompileReady).toBe(true);
    expect(contractResult.status).toBe('READY_FOR_APPROVAL');
    expect(contractResult.blockingIssues).toHaveLength(0);
    expect(contractResult.fingerprint).toMatch(/^fp-[a-f0-9]{8}$/);

    // Verify compiled values & provenance
    const compiled = contractResult.compiledValues['peak_orders_per_hr'];
    expect(compiled).toBeDefined();
    expect(compiled.value).toBe(24000);
    expect(compiled.unit).toBe('orders/hr');
    expect(compiled.provenance.sourceId).toBe(textSource.source.id);
    expect(compiled.provenance.sourceVersionId).toBe(textSource.version.id);
    expect(compiled.provenance.approvedBy).toBe('Peter Lead');

    // Verify canonical workload calculation output
    expect(contractResult.contract.workloadCalculations).toHaveLength(1);
    expect(contractResult.contract.workloadCalculations[0].outputValue).toBeCloseTo(24000 / 3600, 3);
  });
});
