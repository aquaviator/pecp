// Artefact Workflow API Integration Tests
// Defined according to Real Strategy and Test Plan Workflow
// Proves end-to-end generation, retrieval, revision history, idempotency,
// staleness detection upon drift, Markdown export, and SQLite persistence restart.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('Real Strategy and Test Plan Workflow API Integration', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;

  let northstarOrgId: string;
  let contosoOrgId: string;
  let northstarProjectId: string;
  let contosoProjectId: string;

  let adminAuth: { authorization: string };
  let peterLeadAuth: { authorization: string };
  let victorViewerAuth: { authorization: string };
  let charlieContosoAuth: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-artefact-api-'));
    dbPath = path.join(tempDir, 'pecp-artefact-api.db');
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

    // 2. Provision Contoso Org
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

    // 5. Create Contoso Project (for tenant isolation)
    const contosoProjRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Contoso Parallel Project',
        organisation: 'Contoso Foreign Org',
        organisationId: contosoOrgId,
        intent: 'BENCHMARK',
        description: 'Contoso isolated project'
      }
    });
    contosoProjectId = contosoProjRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Enforces authentication and authorization: rejects unauthenticated and viewer mutations', async () => {
    // Unauthenticated
    const unauthRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(unauthRes.statusCode).toBe(401);

    // Viewer role write denial (Victor Viewer)
    const viewerRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: victorViewerAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(viewerRes.statusCode).toBe(403);
    expect(viewerRes.json().error.code).toBe('FORBIDDEN');

    // Cross-tenant write denial (Charlie Contoso accessing Northstar)
    const crossTenantRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: charlieContosoAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(crossTenantRes.statusCode).toBe(403);
  });

  it('2. Generates draft Performance Strategy and Test Plan for a project with BLOCKED contract semantics', async () => {
    // Before inputs are approved, the live contract is BLOCKED
    const contractRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: peterLeadAuth
    });
    expect(contractRes.statusCode).toBe(200);
    expect(contractRes.json().status).toBe('BLOCKED');
    const contractFp = contractRes.json().fingerprint;

    // Generate Performance Strategy
    const stratRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: {
        artefactType: 'PERFORMANCE_STRATEGY',
        expectedContractFingerprint: contractFp
      }
    });
    expect(stratRes.statusCode).toBe(201);
    const stratBody = stratRes.json();
    expect(stratBody.artefact.type).toBe('PERFORMANCE_STRATEGY');
    expect(stratBody.artefact.status).toBe('BLOCKED');
    expect(stratBody.artefact.sourceContractFingerprint).toBe(contractFp);
    expect(stratBody.currentRevisionNumber).toBe(1);
    expect(stratBody.revisions.length).toBe(1);
    expect(stratBody.staleness.isStale).toBe(false);

    // Generate Performance Test Plan
    const planRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: {
        artefactType: 'PERFORMANCE_TEST_PLAN',
        expectedContractFingerprint: contractFp
      }
    });
    expect(planRes.statusCode).toBe(201);
    const planBody = planRes.json();
    expect(planBody.artefact.type).toBe('PERFORMANCE_TEST_PLAN');
    expect(planBody.artefact.status).toBe('BLOCKED');
    expect(planBody.currentRevisionNumber).toBe(1);
  });

  it('3. Populates 24,000 orders/hr and source lineage when governed inputs are approved', async () => {
    // 1. Capture source text
    const sourceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/text`,
      headers: peterLeadAuth,
      payload: {
        title: 'holiday_peak_forecast.txt',
        text: 'Peak hourly order volume forecast: 24000 orders/hr for holiday peak window.',
        kind: 'BRIEF'
      }
    });
    expect(sourceRes.statusCode).toBe(201);
    const sourceId = sourceRes.json().source.id;
    const versionId = sourceRes.json().version.id;

    // 2. Capture intelligence item
    const itemRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence`,
      headers: peterLeadAuth,
      payload: {
        key: 'peak_orders_per_hr',
        category: 'WORKLOAD',
        title: 'Peak Orders Per Hour',
        valueKind: 'NUMERIC',
        value: 24000,
        unit: 'orders/hr',
        sourceBinding: {
          sourceId,
          sourceVersionId: versionId,
          locator: '24000 orders/hr'
        }
      }
    });
    expect(itemRes.statusCode).toBe(201);
    const peakItem = itemRes.json();

    // 3. Approve peak item
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}/approve`,
      headers: peterLeadAuth,
      payload: {
        expectedRevision: peakItem.revision || 1,
        rationale: 'Approved for peak 2027 by lead'
      }
    });
    expect(approveRes.statusCode).toBe(200);

    // 4. Verify contract compilation has 24000
    const contractRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: peterLeadAuth
    });
    expect(contractRes.statusCode).toBe(200);
    const contractBody = contractRes.json();
    const peakInput = contractBody.contract.workloadInputs.find((i: any) => i.key === 'peak_orders_per_hr');
    expect(peakInput).toBeDefined();
    expect(peakInput.value).toBe(24000);

    const throughputCalc = contractBody.contract.workloadCalculations.find((c: any) => c.outputParameter === 'order_throughput_per_second');
    expect(throughputCalc).toBeDefined();
    expect(throughputCalc.outputValue).toBeCloseTo(6.666, 2);

    // 5. Generate Performance Strategy
    const stratRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(stratRes.statusCode).toBe(201);
    const strat = stratRes.json().artefact;

    // Verify 24,000 orders/hr and throughput appear in sections/tables
    const stratJson = JSON.stringify(strat);
    expect(stratJson).toContain('24000');
    expect(stratJson).toContain('Peak Orders Per Hour');
    expect(stratJson).toContain('6.6667 orders/second');
    expect(stratJson).toContain('holiday_peak_forecast.txt');
    expect(stratJson).toContain('24000 orders/hr');
  });

  it('4. Rejects stale contract expectation with 409 Conflict and no partial write', async () => {
    const staleFingerprint = 'sha256-nonexistent-fingerprint-999999999';

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: {
        artefactType: 'PERFORMANCE_STRATEGY',
        expectedContractFingerprint: staleFingerprint
      }
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
    expect(res.json().error.message).toContain('Stale contract expectation');

    // Verify no artefact was partially written
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth
    });
    expect(listRes.json().items.length).toBe(0);
  });

  it('5. Enforces idempotency: identical key returns cached response, modified payload rejects with 409', async () => {
    const idempotencyKey = 'idem-strat-northstar-12345';
    const payload = {
      artefactType: 'PERFORMANCE_STRATEGY',
      author: 'Peter Lead'
    };

    // First call
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: {
        ...peterLeadAuth,
        'idempotency-key': idempotencyKey
      },
      payload
    });
    expect(res1.statusCode).toBe(201);
    const id1 = res1.json().artefact.id;

    // Second call with identical payload & key: replays cached 201 response
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: {
        ...peterLeadAuth,
        'idempotency-key': idempotencyKey
      },
      payload
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().artefact.id).toBe(id1);
    expect(res2.json().currentRevisionNumber).toBe(1);

    // Third call with SAME key but CHANGED payload: rejects with 409 Conflict
    const res3 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: {
        ...peterLeadAuth,
        'idempotency-key': idempotencyKey
      },
      payload: {
        artefactType: 'PERFORMANCE_TEST_PLAN', // Different type!
        author: 'Someone Else'
      }
    });
    expect(res3.statusCode).toBe(409);
    expect(res3.json().error.code).toBe('CONFLICT');
    expect(res3.json().error.message).toContain('Idempotency key mismatch');
  });

  it('6. Detects upstream drift without rewriting history; regeneration creates revision 2', async () => {
    // 1. Generate Revision 1
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(res1.statusCode).toBe(201);
    const rev1Fingerprint = res1.json().artefact.sourceContractFingerprint;
    const stratId = res1.json().artefact.id;

    // 2. Introduce upstream intelligence change (drift)
    const driftRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence`,
      headers: peterLeadAuth,
      payload: {
        key: 'system_architecture_type',
        category: 'ARCHITECTURE',
        title: 'Architecture Overview',
        valueKind: 'STRING',
        value: 'Event-Driven Microservices'
      }
    });
    expect(driftRes.statusCode).toBe(201);

    // 3. Read Strategy: staleness is detected!
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/${stratId}`,
      headers: peterLeadAuth
    });
    expect(detailRes.statusCode).toBe(200);
    const detailBody = detailRes.json();
    expect(detailBody.staleness.isStale).toBe(true);
    expect(detailBody.artefact.status).toBe('STALE');

    // 4. Regenerate creates Revision 2
    const regenRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(regenRes.statusCode).toBe(201);
    const regenBody = regenRes.json();
    expect(regenBody.currentRevisionNumber).toBe(2);
    expect(regenBody.revisions.length).toBe(2);
    expect(regenBody.staleness.isStale).toBe(false);

    // 5. Revision 1 remains intact and accessible
    const rev1Res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/${stratId}?revision=1`,
      headers: peterLeadAuth
    });
    expect(rev1Res.statusCode).toBe(200);
    expect(rev1Res.json().artefact.sourceContractFingerprint).toBe(rev1Fingerprint);
  });

  it('7. Exports Markdown with appropriate notice headers and enforces tenant boundary', async () => {
    // Generate Strategy
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    const stratId = genRes.json().artefact.id;

    // Export current revision as Markdown
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/${stratId}/export?format=markdown`,
      headers: peterLeadAuth
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/markdown');
    expect(exportRes.body).toContain('# Performance Strategy');

    // Cross-tenant download is rejected with 403
    const crossTenantExport = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/${stratId}/export?format=markdown`,
      headers: charlieContosoAuth
    });
    expect(crossTenantExport.statusCode).toBe(403);

    // Foreign artefact ID does not bypass project scoping (returns 404)
    const foreignArtefactRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${contosoProjectId}/artefacts/${stratId}`,
      headers: charlieContosoAuth
    });
    expect(foreignArtefactRes.statusCode).toBe(404);
  });

  it('8. Preserves saved artefacts, revision history, and deterministic metadata across SQLite database restart', async () => {
    // 1. Generate Strategy in initial app instance
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(res1.statusCode).toBe(201);
    const originalFp = res1.json().artefact.sourceContractFingerprint;

    // 2. Shut down app and close database
    await app.close();
    db.close();

    // 3. Re-open SQLite database from same file path and restart app
    const restartedDb = new SqliteDatabase(dbPath);
    restartedDb.open();
    const restartedApp = buildApiApp({ database: restartedDb });
    await restartedApp.ready();

    // 4. Retrieve saved artefact from restarted service
    const retrieveRes = await restartedApp.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: peterLeadAuth
    });
    expect(retrieveRes.statusCode).toBe(200);
    const items = retrieveRes.json().items;
    expect(items.length).toBe(1);
    expect(items[0].currentRevisionNumber).toBe(1);
    expect(items[0].title).toContain('Performance Strategy');

    // Verify detail
    const detailRes = await restartedApp.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/${items[0].id}`,
      headers: peterLeadAuth
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().artefact.sourceContractFingerprint).toBe(originalFp);

    await restartedApp.close();
    restartedDb.close();
  });
});
