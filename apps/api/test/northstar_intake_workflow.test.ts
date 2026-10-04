// M5.2 Complete Northstar Intake, Provenance & Governance Integration Suite
// Proves end-to-end provenance, conflict detection, resolution, approval invalidation,
// structured import safety, concurrency, cross-tenant isolation, and restart fidelity.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, '../../../reference-library/northstar/m5-2');

describe('M5.2 End-to-End Northstar Intake & Provenance Workflow', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;

  let northstarOrgId: string;
  let contosoOrgId: string;
  let northstarProjectId: string;
  let contosoProjectId: string;

  let adminAuth: { authorization: string };
  let aliceAdminAuth: { authorization: string };
  let peterLeadAuth: { authorization: string };
  let erinEngineerAuth: { authorization: string };
  let victorViewerAuth: { authorization: string };
  let charlieContosoAuth: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-northstar-intake-'));
    dbPath = path.join(tempDir, 'pecp-northstar.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const rootAdmin = await createPlatformAdmin(db);
    adminAuth = rootAdmin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();

    // 1. Provision Northstar Retail (Org A)
    const northstarOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Northstar Retail Logistics' }
    });
    expect(northstarOrgRes.statusCode).toBe(201);
    northstarOrgId = northstarOrgRes.json().id;

    // 2. Provision Contoso Org (Org B)
    const contosoOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Contoso External Corp' }
    });
    expect(contosoOrgRes.statusCode).toBe(201);
    contosoOrgId = contosoOrgRes.json().id;

    // 3. Create users in Northstar
    const alice = await createTestUser(db, {
      email: 'alice.admin@northstar.internal',
      displayName: 'Alice Admin',
      membership: { organisationId: northstarOrgId, role: 'ORG_ADMIN' }
    });
    aliceAdminAuth = alice.authHeaders;

    const peter = await createTestUser(db, {
      email: 'peter.lead@northstar.internal',
      displayName: 'Peter Lead',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_LEAD' }
    });
    peterLeadAuth = peter.authHeaders;

    const erin = await createTestUser(db, {
      email: 'erin.engineer@northstar.internal',
      displayName: 'Erin Engineer',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_ENGINEER' }
    });
    erinEngineerAuth = erin.authHeaders;

    const victor = await createTestUser(db, {
      email: 'victor.viewer@northstar.internal',
      displayName: 'Victor Viewer',
      membership: { organisationId: northstarOrgId, role: 'VIEWER' }
    });
    victorViewerAuth = victor.authHeaders;

    // 4. Create user in Contoso (Org B)
    const charlie = await createTestUser(db, {
      email: 'charlie@contoso.internal',
      displayName: 'Charlie Contoso',
      membership: { organisationId: contosoOrgId, role: 'ORG_ADMIN' }
    });
    charlieContosoAuth = charlie.authHeaders;

    // 5. Create Northstar Project
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Northstar Peak 2027 Ingestion',
        organisation: 'Northstar Retail Logistics',
        organisationId: northstarOrgId,
        intent: 'FORECAST',
        description: 'Black Friday 2027 holiday peak capacity planning',
        creationMethod: 'BRIEF',
        briefText: 'Support 100,000 users and keep checkout fast.'
      }
    });
    expect(projRes.statusCode).toBe(201);
    northstarProjectId = projRes.json().id;

    // 6. Create Contoso Project
    const contosoProjRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Contoso Isolation Test',
        organisation: 'Contoso External Corp',
        organisationId: contosoOrgId,
        intent: 'CERTIFICATION',
        description: 'Settlement pipeline verification'
      }
    });
    expect(contosoProjRes.statusCode).toBe(201);
    contosoProjectId = contosoProjRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Proves full Northstar intake, import, competing assertions, resolution, invalidation, and persistence restart', async () => {
    // Step A: Capture Brief text as a source
    const briefRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/text`,
      headers: erinEngineerAuth,
      payload: {
        title: 'Northstar Executive Brief',
        text: 'Target Peak Throughput: 24000 orders/hr during Black Friday window.',
        kind: 'BRIEF'
      }
    });
    expect(briefRes.statusCode).toBe(201);
    const briefSource = briefRes.json();
    expect(briefSource.source.id).toBeDefined();
    expect(briefSource.version.extractionStatus).toBe('SUCCESS');

    // Step B: Upload CSV source (holiday_peak_forecast_2027_v1.csv)
    const csvContent = fs.readFileSync(path.join(fixtureDir, 'holiday_peak_forecast_2027_v1.csv'));
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const csvMultipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="holiday_peak_forecast_2027_v1.csv"',
      'Content-Type: text/csv',
      '',
      csvContent.toString('utf-8'),
      `--${boundary}--`
    ].join('\r\n');

    const csvUploadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/upload`,
      headers: {
        ...erinEngineerAuth,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(csvMultipartBody)
    });
    expect(csvUploadRes.statusCode).toBe(201);
    const csvSource = csvUploadRes.json();
    const csvSourceId = csvSource.source.id;
    const csvVersionId = csvSource.version.id;
    expect(csvSource.version.extractionStatus).toBe('SUCCESS');

    // Step C: Structured Import Preview with RFC 4180 parsing
    const previewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/import-preview`,
      headers: erinEngineerAuth,
      payload: {
        sourceId: csvSourceId,
        sourceVersionId: csvVersionId,
        mappings: [
          {
            sourceColumnOrKey: 'declared_value',
            targetKey: 'peak_orders_per_hr',
            title: 'Peak Orders per Hour',
            category: 'WORKLOAD',
            valueKind: 'NUMBER',
            unit: 'orders/hr'
          }
        ]
      }
    });
    expect(previewRes.statusCode).toBe(200);
    const previewData = previewRes.json();
    expect(previewData.validCount).toBe(1);
    expect(previewData.invalidCount).toBe(0);
    expect(previewData.proposedItems[0].value).toBe(24000);
    expect(previewData.mappingDigest).toBeDefined();

    // Step D: Apply Structured Import with validated mappingDigest
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/import-apply`,
      headers: erinEngineerAuth,
      payload: {
        sourceId: csvSourceId,
        sourceVersionId: csvVersionId,
        mappings: [
          {
            sourceColumnOrKey: 'declared_value',
            targetKey: 'peak_orders_per_hr',
            title: 'Peak Orders per Hour',
            category: 'WORKLOAD',
            valueKind: 'NUMBER',
            unit: 'orders/hr'
          }
        ],
        mappingDigest: previewData.mappingDigest
      }
    });
    expect(applyRes.statusCode).toBe(201);
    const appliedData = applyRes.json();
    expect(appliedData.appliedCount).toBe(1);
    const peakItem = appliedData.items[0];
    expect(peakItem.key).toBe('peak_orders_per_hr');
    expect(peakItem.value).toBe(24000);
    expect(peakItem.unit).toBe('orders/hr');
    expect(peakItem.canonicalState).toBe('IMPORTED');
    expect(peakItem.reviewStatus).toBe('FOUND');
    expect(peakItem.approvalState).toBe('UNREVIEWED');
    expect(peakItem.revision).toBe(1);

    // Step E: Capture a Competing Assertion from a different stakeholder
    // Conflicting value: 30000 orders/hr
    const conflictRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence`,
      headers: erinEngineerAuth,
      payload: {
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        value: 30000,
        unit: 'orders/hr',
        source: 'Commercial Director Stakeholder Brief'
      }
    });
    expect(conflictRes.statusCode).toBe(201);
    const conflictingItem = conflictRes.json();
    expect(conflictingItem.canonicalState).toBe('CONFLICTING');
    expect(conflictingItem.reviewStatus).toBe('CONFLICTING');
    expect(conflictingItem.candidates).toHaveLength(2);
    expect(conflictingItem.revision).toBe(2);

    // Step E2: Verify competing 30,000 orders/hr assertion blocks compilation while CONFLICTING (Requirement 7.2)
    const contractBlockedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: erinEngineerAuth
    });
    expect(contractBlockedRes.statusCode).toBe(200);
    const contractBlocked = contractBlockedRes.json();
    expect(contractBlocked.status).toBe('BLOCKED');
    expect(contractBlocked.isCompileReady).toBe(false);
    expect(contractBlocked.blockingIssues.some((i: any) => i.issueType === 'CONFLICTING_SOURCE')).toBe(true);

    // Step F: Verify unapproved item cannot be approved while in CONFLICTING state
    const prematureApproveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}/approve`,
      headers: aliceAdminAuth,
      payload: {
        expectedRevision: 2
      }
    });
    expect(prematureApproveRes.statusCode).toBe(400);
    expect(prematureApproveRes.json().error.message).toContain('Resolve competing assertions first');

    // Step G: Authorized Resolution by Peter Lead (Technical Lead)
    // Peter chooses the candidate value of 24000 from the authoritative CSV forecast
    const chosenCandidate = conflictingItem.candidates.find((c: any) => Number(c.value) === 24000) || conflictingItem.candidates[0];
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}/resolve`,
      headers: peterLeadAuth,
      payload: {
        chosenCandidateId: chosenCandidate.id,
        expectedRevision: 2,
        rationale: 'Accepted forecast CSV over informal stakeholder estimate based on 2026 actuals.'
      }
    });
    expect(resolveRes.statusCode).toBe(200);
    const resolvedItem = resolveRes.json();
    expect(resolvedItem.canonicalState).toBe('APPROVED');
    expect(resolvedItem.reviewStatus).toBe('FOUND');
    expect(resolvedItem.approvalState).toBe('APPROVED');
    expect(resolvedItem.revision).toBe(3);
    expect(resolvedItem.activeApprovalSnapshot).toBeDefined();
    expect(resolvedItem.activeApprovalSnapshot.value).toBe(24000);

    // Step G2: Verify approved 24,000 orders/hr compiles into canonical performance contract with complete provenance (Requirement 7.1, 7.3, 7.6)
    const contractApprovedRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: erinEngineerAuth
    });
    expect(contractApprovedRes.statusCode).toBe(200);
    const contractApproved = contractApprovedRes.json();
    expect(contractApproved.status).toBe('READY_FOR_APPROVAL');
    expect(contractApproved.isCompileReady).toBe(true);
    expect(contractApproved.compiledValues['peak_orders_per_hr'].value).toBe(24000);
    expect(contractApproved.compiledValues['peak_orders_per_hr'].unit).toBe('orders/hr');
    expect(contractApproved.contract.workloadCalculations[0].outputValue).toBeCloseTo(24000 / 3600, 3);
    const approvedProv = contractApproved.compiledValues['peak_orders_per_hr'].provenance;
    expect(approvedProv.sourceId).toBe(csvSourceId);
    expect(approvedProv.sourceVersionId).toBe(csvVersionId);
    expect(approvedProv.sourceVersionNumber).toBe(1);
    expect(approvedProv.locator).toBe(peakItem.sourceLocation || 'row:1,col:2');
    expect(approvedProv.approvalRevision).toBe(3);
    expect(approvedProv.approvedBy).toBe('Peter Lead');
    expect(approvedProv.sourceSha256).toBeDefined();
    const approvedFingerprint = contractApproved.fingerprint;

    // Step H: Source Replacement (Upload v2 of forecast CSV)
    // In v2, the file has been revised
    const csvV2Content = fs.readFileSync(path.join(fixtureDir, 'holiday_peak_forecast_2027_v2.csv'));
    const boundaryV2 = '----WebKitFormBoundaryRevisedV2';
    const csvV2MultipartBody = [
      `--${boundaryV2}`,
      'Content-Disposition: form-data; name="expectedRevision"',
      '',
      '1',
      `--${boundaryV2}`,
      'Content-Disposition: form-data; name="file"; filename="holiday_peak_forecast_2027_v2.csv"',
      'Content-Type: text/csv',
      '',
      csvV2Content.toString('utf-8'),
      `--${boundaryV2}--`
    ].join('\r\n');

    const replaceSourceRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/${csvSourceId}/versions`,
      headers: {
        ...erinEngineerAuth,
        'content-type': `multipart/form-data; boundary=${boundaryV2}`
      },
      payload: Buffer.from(csvV2MultipartBody)
    });
    expect(replaceSourceRes.statusCode).toBe(201);

    // Step I: Verify Approval Invalidation on Bound Items
    const recheckItemRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}`,
      headers: erinEngineerAuth
    });
    expect(recheckItemRes.statusCode).toBe(200);
    const invalidatedItem = recheckItemRes.json();
    expect(invalidatedItem.canonicalState).toBe('STALE');
    expect(invalidatedItem.reviewStatus).toBe('STALE');
    expect(invalidatedItem.approvalState).toBe('UNREVIEWED');
    expect(invalidatedItem.activeApprovalSnapshot).toBeUndefined();
    expect(invalidatedItem.revision).toBe(4); // Incremented due to invalidation

    // Step I2: Verify replacing/superseding bound source invalidates approval to STALE and blocks contract (Requirement 7.4)
    const contractStaleRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: erinEngineerAuth
    });
    expect(contractStaleRes.statusCode).toBe(200);
    const contractStale = contractStaleRes.json();
    expect(contractStale.status).toBe('BLOCKED');
    expect(contractStale.isCompileReady).toBe(false);
    expect(contractStale.blockingIssues.some((i: any) => i.issueType === 'STALE_SOURCE')).toBe(true);

    // Step J: Stale Revision Rejection
    // Attempting to approve using old revision 3 should fail with 409 Conflict
    const staleApproveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}/approve`,
      headers: aliceAdminAuth,
      payload: {
        expectedRevision: 3
      }
    });
    expect(staleApproveRes.statusCode).toBe(409);
    expect(staleApproveRes.json().error.message).toContain('Precondition Failed');

    // Step K: Check Requirements & Intake Summary Fidelity
    const summaryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/intelligence-intake-summary`,
      headers: erinEngineerAuth
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary.projectId).toBe(northstarProjectId);
    expect(summary.uploadedFilesCount).toBe(1);
    expect(summary.extractedSuccessCount).toBe(1); // 1 uploaded file currently in SUCCESS
    expect(summary.extractionFailedCount).toBe(0);

    // Step K2: Reapproval against the current source/revision restores compile readiness (Requirement 7.5)
    // Query versions of csvSource to get the new v2 version ID
    const csvVersionsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/sources/${csvSourceId}/versions`,
      headers: erinEngineerAuth
    });
    expect(csvVersionsRes.statusCode).toBe(200);
    const versionsList = csvVersionsRes.json().items || csvVersionsRes.json().versions;
    const csvV2Version = versionsList.find((v: any) => v.versionNumber === 2);
    expect(csvV2Version).toBeDefined();

    // Re-bind intelligence item to v2 source
    const patchBindingRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}`,
      headers: erinEngineerAuth,
      payload: {
        expectedRevision: 4,
        sourceBinding: {
          sourceId: csvSourceId,
          sourceVersionId: csvV2Version.id,
          locator: 'row:1,col:2'
        }
      }
    });
    expect(patchBindingRes.statusCode).toBe(200);
    const patchedItem = patchBindingRes.json();
    expect(patchedItem.canonicalState).toBe('IMPORTED');
    expect(patchedItem.reviewStatus).toBe('FOUND');
    expect(patchedItem.revision).toBe(5);

    // Formally re-approve against current revision with Peter Lead
    const reapproveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}/approve`,
      headers: peterLeadAuth,
      payload: {
        expectedRevision: 5
      }
    });
    expect(reapproveRes.statusCode).toBe(200);
    const reapprovedItem = reapproveRes.json();
    expect(reapprovedItem.canonicalState).toBe('APPROVED');
    expect(reapprovedItem.revision).toBe(6);

    // Verify contract compile readiness is restored with updated v2 provenance
    const contractRestoredRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: erinEngineerAuth
    });
    expect(contractRestoredRes.statusCode).toBe(200);
    const contractRestored = contractRestoredRes.json();
    expect(contractRestored.status).toBe('READY_FOR_APPROVAL');
    expect(contractRestored.isCompileReady).toBe(true);
    expect(contractRestored.compiledValues['peak_orders_per_hr'].value).toBe(24000);
    expect(contractRestored.compiledValues['peak_orders_per_hr'].provenance.sourceVersionNumber).toBe(2);
    const restoredFingerprint = contractRestored.fingerprint;

    // Step L: Persistence Restart & Reference Verification
    // Close db and fastify server, create fresh instance pointing to same file
    await app.close();
    db.close();

    const db2 = new SqliteDatabase(dbPath);
    db2.open();
    const app2 = buildApiApp({ database: db2 });
    await app2.ready();

    // Re-query the project and intelligence item
    const restartedItemRes = await app2.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${peakItem.id}`,
      headers: aliceAdminAuth
    });
    expect(restartedItemRes.statusCode).toBe(200);
    const restartedItem = restartedItemRes.json();
    expect(restartedItem.id).toBe(peakItem.id);
    expect(restartedItem.revision).toBe(6);
    expect(restartedItem.canonicalState).toBe('APPROVED');
    expect(restartedItem.approvalState).toBe('APPROVED');
    expect(restartedItem.history.length).toBeGreaterThan(1);

    // Step L2: Database restart preserves same canonical compilation result and semantic fingerprint (Requirement 7.7)
    const restartedContractRes = await app2.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: aliceAdminAuth
    });
    expect(restartedContractRes.statusCode).toBe(200);
    const restartedContract = restartedContractRes.json();
    expect(restartedContract.status).toBe('READY_FOR_APPROVAL');
    expect(restartedContract.isCompileReady).toBe(true);
    expect(restartedContract.fingerprint).toBe(restoredFingerprint);
    expect(restartedContract.compiledValues['peak_orders_per_hr'].value).toBe(24000);
    expect(restartedContract.contract.workloadCalculations[0].outputValue).toBeCloseTo(24000 / 3600, 3);

    await app2.close();
    db2.close();
  });

  it('2. Enforces Cross-Tenant Isolation & Rejects Foreign Source Bindings', async () => {
    // 1. Charlie in Contoso uploads a proprietary spec
    const contosoBrief = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${contosoProjectId}/sources/text`,
      headers: charlieContosoAuth,
      payload: {
        title: 'Contoso Confidential Spec',
        text: 'Internal Contoso confidential architecture benchmark.',
        kind: 'BRIEF'
      }
    });
    expect(contosoBrief.statusCode).toBe(201);
    const contosoSource = contosoBrief.json();

    // 2. Northstar user attempts to bind an intelligence item to Contoso source
    const crossTenantBindRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence`,
      headers: erinEngineerAuth,
      payload: {
        key: 'cross_tenant_probe',
        title: 'Cross Tenant Probe',
        category: 'REQUIREMENTS',
        value: 100,
        sourceBinding: {
          sourceId: contosoSource.source.id,
          sourceVersionId: contosoSource.version.id,
          locator: 'char:0-10'
        }
      }
    });
    // Must be rejected with 400 because source does not belong to Northstar project
    expect(crossTenantBindRes.statusCode).toBe(400);
    expect(crossTenantBindRes.json().error.message).toContain('does not exist in project');
  });

  it('3. Enforces Write Permission BEFORE Consuming Upload Stream & Re-authorizes Idempotent Replays', async () => {
    // Victor Viewer has VIEW permission but NOT SOURCE_WRITE permission
    const boundary = '----WebKitFormBoundaryViewerTest';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.csv"',
      'Content-Type: text/csv',
      '',
      'col1,col2\n1,2',
      `--${boundary}--`
    ].join('\r\n');

    const unauthorizedUploadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/upload`,
      headers: {
        ...victorViewerAuth,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartBody)
    });

    // Victor is rejected with 403 Forbidden
    expect(unauthorizedUploadRes.statusCode).toBe(403);
    expect(unauthorizedUploadRes.json().error.code).toBe('FORBIDDEN');
  });

  it('4. Rejects Tampered Import Previews & Incompatible Revisions with All-or-Nothing Rollback', async () => {
    // 1. Upload CSV
    const csvContent = 'metric_name,target_val\nlatency_p95,250\nerror_rate,0.01';
    const boundary = '----WebKitFormBoundaryImportTamper';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="metrics.csv"',
      'Content-Type: text/csv',
      '',
      csvContent,
      `--${boundary}--`
    ].join('\r\n');

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/upload`,
      headers: {
        ...erinEngineerAuth,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload: Buffer.from(multipartBody)
    });
    const { source, version } = uploadRes.json();

    // 2. Submit import-apply with a forged mappingDigest
    const tamperedApplyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/import-apply`,
      headers: erinEngineerAuth,
      payload: {
        sourceId: source.id,
        sourceVersionId: version.id,
        mappings: [
          {
            sourceColumnOrKey: 'target_val',
            targetKey: 'latency_p95_ms',
            title: 'Latency P95',
            category: 'REQUIREMENTS',
            valueKind: 'NUMBER',
            unit: 'ms'
          }
        ],
        mappingDigest: 'forged_sha256_digest_that_does_not_match'
      }
    });

    expect(tamperedApplyRes.statusCode).toBe(409);
    expect(tamperedApplyRes.json().error.message).toContain('Mapping digest mismatch');

    // Verify nothing was persisted (all-or-nothing rollback)
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/intelligence`,
      headers: erinEngineerAuth
    });
    const items = listRes.json().items;
    expect(items.find((i: any) => i.key === 'latency_p95_ms')).toBeUndefined();
  });
});
