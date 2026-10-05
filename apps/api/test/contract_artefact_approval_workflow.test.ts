// Comprehensive Integration Tests for BUILD-CONTRACT-ARTEFACT-APPROVALS
// Verifies full approval workflow, version bindings, invalidation, RBAC matrix,
// concurrency/idempotency, and database restart persistence.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('Contract and Artefact Approval Workflow API Integration', () => {
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
  let rachelReviewerAuth: { authorization: string };
  let edwardEngineerAuth: { authorization: string };
  let victorViewerAuth: { authorization: string };
  let charlieContosoAuth: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-approval-api-'));
    dbPath = path.join(tempDir, 'pecp-approval-api.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const rootAdmin = await createPlatformAdmin(db);
    adminAuth = rootAdmin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();

    // 1. Provision Northstar Org & Contoso Org
    const northstarOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Northstar Logistics' }
    });
    northstarOrgId = northstarOrgRes.json().id;

    const contosoOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Contoso Foreign Org' }
    });
    contosoOrgId = contosoOrgRes.json().id;

    // 2. Provision Users with exact role matrix
    const peter = await createTestUser(db, {
      email: 'peter.lead@northstar.internal',
      displayName: 'Peter Lead',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_LEAD' }
    });
    peterLeadAuth = peter.authHeaders;

    const rachel = await createTestUser(db, {
      email: 'rachel.reviewer@northstar.internal',
      displayName: 'Rachel Reviewer',
      membership: { organisationId: northstarOrgId, role: 'REVIEWER' }
    });
    rachelReviewerAuth = rachel.authHeaders;

    const edward = await createTestUser(db, {
      email: 'edward.engineer@northstar.internal',
      displayName: 'Edward Engineer',
      membership: { organisationId: northstarOrgId, role: 'PERFORMANCE_ENGINEER' }
    });
    edwardEngineerAuth = edward.authHeaders;

    const victor = await createTestUser(db, {
      email: 'victor.viewer@northstar.internal',
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

    // 3. Create Northstar Project
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Northstar Peak 2027 Ingestion',
        organisation: 'Northstar Logistics',
        organisationId: northstarOrgId,
        intent: 'FORECAST',
        description: 'Peak volume and capacity verification'
      }
    });
    northstarProjectId = projRes.json().id;

    // 4. Create Contoso Project
    const contosoProjRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Contoso Project',
        organisation: 'Contoso Foreign Org',
        organisationId: contosoOrgId,
        intent: 'BENCHMARK'
      }
    });
    contosoProjectId = contosoProjRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function seedApprovedIntelligence(): Promise<{ sourceId: string; versionId: string; fingerprint: string }> {
    const textRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/sources/text`,
      headers: peterLeadAuth,
      payload: {
        title: 'Executive Architecture Specification',
        text: 'Peak hourly order volume target is 24000 orders/hr.',
        kind: 'BRIEF'
      }
    });
    const { source, version } = textRes.json();

    const extractionRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/sources/${source.id}/versions/${version.id}/extraction`,
      headers: peterLeadAuth
    });
    const locator = extractionRes.json().fragments[0].locator;

    const itemRes = await app.inject({
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
          sourceId: source.id,
          sourceVersionId: version.id,
          locator
        }
      }
    });
    const createdItem = itemRes.json();

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/intelligence/${createdItem.id}/approve`,
      headers: peterLeadAuth,
      payload: { expectedRevision: 1 }
    });

    const contractRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract`,
      headers: peterLeadAuth
    });
    const contractData = contractRes.json();
    return {
      sourceId: source.id,
      versionId: version.id,
      fingerprint: contractData.fingerprint
    };
  }

  it('1. Scenario 1 & 2: Saves review revision, approves revision, and binds Strategy & Test Plan documents', async () => {
    const { fingerprint } = await seedApprovedIntelligence();

    // Step A: Save Contract Review Revision
    const saveRevRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: peterLeadAuth,
      payload: {
        commitMessage: 'Initial formal review baseline for Black Friday 2027',
        expectedContractFingerprint: fingerprint
      }
    });
    expect(saveRevRes.statusCode).toBe(201);
    const rev1 = saveRevRes.json();
    expect(rev1.revisionNumber).toBe(1);
    expect(rev1.fingerprint).toBe(fingerprint);
    expect(rev1.approvalValidity.state).toBe('NOT_APPROVED');
    expect(rev1.decisionHistory).toHaveLength(0);

    // Step B: Authorised Reviewer approves Contract Revision 1
    const approveContractRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Verified against executive workload forecasts and agreed architectural targets.',
        expectedRevisionNumber: 1,
        expectedContentFingerprint: fingerprint,
        expectedDecisionRevision: 0
      }
    });
    expect(approveContractRes.statusCode).toBe(200);
    const approvedContract = approveContractRes.json();
    expect(approvedContract.approvalValidity.state).toBe('CURRENTLY_VALID');
    expect(approvedContract.activeDecision?.decisionType).toBe('APPROVE');
    expect(approvedContract.activeDecision?.actorDisplayName).toBe('Rachel Reviewer');
    expect(approvedContract.activeDecision?.decisionRevision).toBe(1);
    expect(approvedContract.decisionHistory).toHaveLength(1);

    // Step C: Generate Strategy bound to approved contract revision 1
    const genStrategyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: edwardEngineerAuth,
      payload: {
        artefactType: 'PERFORMANCE_STRATEGY',
        contractRevisionNumber: 1
      }
    });
    expect(genStrategyRes.statusCode).toBe(201);
    const strategy = genStrategyRes.json();
    expect(strategy.artefact.type).toBe('PERFORMANCE_STRATEGY');
    expect(strategy.artefact.sourceContractRevisionNumber).toBe(1);
    expect(strategy.currentRevisionNumber).toBe(1);
    expect(strategy.approvalValidity.state).toBe('NOT_APPROVED');

    // Step D: Rachel Reviewer approves Strategy Revision 1
    const approveStrategyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/PERFORMANCE_STRATEGY/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Performance strategy structure and testing phases are validated.',
        expectedRevisionNumber: 1,
        expectedDecisionRevision: 0
      }
    });
    expect(approveStrategyRes.statusCode).toBe(200);
    const approvedStrategy = approveStrategyRes.json();
    expect(approvedStrategy.approvalValidity.state).toBe('CURRENTLY_VALID');
    expect(approvedStrategy.activeDecision?.actorDisplayName).toBe('Rachel Reviewer');
    expect(approvedStrategy.activeDecision?.decisionRevision).toBe(1);

    // Step E: Generate and approve Test Plan bound to approved contract revision 1
    const genTestPlanRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: edwardEngineerAuth,
      payload: {
        artefactType: 'PERFORMANCE_TEST_PLAN',
        contractRevisionNumber: 1
      }
    });
    expect(genTestPlanRes.statusCode).toBe(201);
    const testPlan = genTestPlanRes.json();
    expect(testPlan.artefact.sourceContractRevisionNumber).toBe(1);

    const approveTestPlanRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/PERFORMANCE_TEST_PLAN/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'SLO thresholds and k6 schedule scenarios are complete and verified.',
        expectedRevisionNumber: 1,
        expectedDecisionRevision: 0
      }
    });
    expect(approveTestPlanRes.statusCode).toBe(200);
    const approvedTestPlan = approveTestPlanRes.json();
    expect(approvedTestPlan.approvalValidity.state).toBe('CURRENTLY_VALID');

    // Step F: Verify Markdown export reflects approved validity
    const exportRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/PERFORMANCE_TEST_PLAN/export?format=markdown`,
      headers: victorViewerAuth
    });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/markdown');
  });

  it('2. Scenario 3 & 4: Rejects approvals when preconditions are unfulfilled or conflicting', async () => {
    // Attempting to approve contract without any intelligence (empty/blocked)
    const saveEmptyRev = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: peterLeadAuth,
      payload: { commitMessage: 'Empty contract draft' }
    });
    expect(saveEmptyRev.statusCode).toBe(201);

    // Approving a blocked revision fails because required inputs are missing
    const approveBlocked = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Attempting to approve blocked contract'
      }
    });
    expect(approveBlocked.statusCode).toBe(400);

    // Now seed valid intelligence and save revision 2
    const { fingerprint } = await seedApprovedIntelligence();
    const saveValidRev = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: peterLeadAuth,
      payload: { commitMessage: 'Valid contract review' }
    });
    expect(saveValidRev.statusCode).toBe(201);
    expect(saveValidRev.json().revisionNumber).toBe(2);

    // Mismatched fingerprint returns 409 Conflict
    const conflictRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/2/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Conflict test',
        expectedRevisionNumber: 2,
        expectedContentFingerprint: 'fp-mismatched-deadbeef'
      }
    });
    expect(conflictRes.statusCode).toBe(409);

    // Mismatched decision revision returns 409 Conflict
    const conflictDecisionRev = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/2/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Conflict test',
        expectedRevisionNumber: 2,
        expectedDecisionRevision: 99
      }
    });
    expect(conflictDecisionRev.statusCode).toBe(409);
  });

  it('3. Scenario 5 & 6: Invalidation semantics — parent contract withdrawal invalidates dependent documents', async () => {
    const { fingerprint } = await seedApprovedIntelligence();

    // Save and approve Contract Revision 1
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: peterLeadAuth,
      payload: { commitMessage: 'Baseline for invalidation test' }
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Approved baseline contract.',
        expectedRevisionNumber: 1
      }
    });

    // Generate & approve Strategy Revision 1
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: edwardEngineerAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY', contractRevisionNumber: 1 }
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/PERFORMANCE_STRATEGY/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: { decisionType: 'APPROVE', rationale: 'Approved strategy.', expectedRevisionNumber: 1 }
    });

    // Rachel Reviewer WITHDRAWS the Contract approval
    const withdrawRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'WITHDRAW',
        rationale: 'New regulatory change requires revisiting order capacity assumptions.',
        expectedRevisionNumber: 1,
        expectedDecisionRevision: 1
      }
    });
    expect(withdrawRes.statusCode).toBe(200);
    const withdrawnContract = withdrawRes.json();
    expect(withdrawnContract.approvalValidity.state).toBe('WITHDRAWN');
    expect(withdrawnContract.activeDecision?.decisionType).toBe('WITHDRAW');
    expect(withdrawnContract.decisionHistory).toHaveLength(2);

    // Verify Strategy approval validity is now STALE / invalid for current use
    const stratDetailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/PERFORMANCE_STRATEGY`,
      headers: victorViewerAuth
    });
    expect(stratDetailRes.statusCode).toBe(200);
    const stratDetail = stratDetailRes.json();
    expect(stratDetail.approvalValidity.state).toBe('PARENT_UNAPPROVED');
    expect(stratDetail.approvalValidity.isValid).toBe(false);
    expect(stratDetail.approvalValidity.reasons.join(' ')).toContain('approval is not valid, has drifted, or was withdrawn');

    // Re-approving contract creates revision 2 decision; does NOT resurrect child strategy approval
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Re-approved after clarification.',
        expectedRevisionNumber: 1,
        expectedDecisionRevision: 2
      }
    });

    const stratAfterParentReapprove = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/artefacts/PERFORMANCE_STRATEGY`,
      headers: victorViewerAuth
    });
    // Strategy approval remains invalid (PARENT_UNAPPROVED) because child decision was bound to earlier decision state
    expect(stratAfterParentReapprove.json().approvalValidity.state).toBe('PARENT_UNAPPROVED');
    expect(stratAfterParentReapprove.json().approvalValidity.isValid).toBe(false);
  });

  it('4. Scenario 8: Role-Matrix RBAC and cross-tenant isolation enforcement', async () => {
    await seedApprovedIntelligence();

    // 1. Unauthenticated requests fail with 401
    const unauthSave = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      payload: { commitMessage: 'Unauthorized attempt' }
    });
    expect(unauthSave.statusCode).toBe(401);

    // 2. Cross-tenant access fails with 403
    const crossTenantSave = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: charlieContosoAuth,
      payload: { commitMessage: 'Cross tenant attempt' }
    });
    expect(crossTenantSave.statusCode).toBe(403);

    // 3. VIEWER cannot save review revision or approve
    const viewerSave = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: victorViewerAuth,
      payload: { commitMessage: 'Viewer attempt' }
    });
    expect(viewerSave.statusCode).toBe(403);

    // 4. PERFORMANCE_ENGINEER can save review revisions and generate documents, but CANNOT approve
    const engineerSave = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: edwardEngineerAuth,
      payload: { commitMessage: 'Engineer valid save' }
    });
    expect(engineerSave.statusCode).toBe(201);

    const engineerApprove = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: edwardEngineerAuth,
      payload: { decisionType: 'APPROVE', rationale: 'Engineer cannot approve' }
    });
    expect(engineerApprove.statusCode).toBe(403);

    // 5. REVIEWER can approve, but CANNOT generate documents
    const reviewerGen = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/artefacts`,
      headers: rachelReviewerAuth,
      payload: { artefactType: 'PERFORMANCE_STRATEGY' }
    });
    expect(reviewerGen.statusCode).toBe(403);

    const reviewerApprove = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Reviewer is authorized to approve',
        expectedRevisionNumber: 1
      }
    });
    expect(reviewerApprove.statusCode).toBe(200);
  });

  it('5. Scenario 9: Idempotency and atomic duplicate rejection', async () => {
    await seedApprovedIntelligence();

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: peterLeadAuth,
      payload: { commitMessage: 'Idempotency test revision' }
    });

    const idempotencyKey = 'idem-decision-key-001';

    // First submission
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: { ...rachelReviewerAuth, 'idempotency-key': idempotencyKey },
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Approved with idempotency key.',
        expectedRevisionNumber: 1
      }
    });
    expect(res1.statusCode).toBe(200);

    // Replay with SAME key and SAME payload returns 200 with identical decision without duplicate history
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: { ...rachelReviewerAuth, 'idempotency-key': idempotencyKey },
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Approved with idempotency key.',
        expectedRevisionNumber: 1
      }
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().decisionHistory).toHaveLength(1);

    // Replay with SAME key but CHANGED payload returns 409 Conflict
    const res3 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: { ...rachelReviewerAuth, 'idempotency-key': idempotencyKey },
      payload: {
        decisionType: 'WITHDRAW',
        rationale: 'Conflicting replay payload',
        expectedRevisionNumber: 1
      }
    });
    expect(res3.statusCode).toBe(409);
  });

  it('6. Scenario 7: Full database restart preserves revisions, decisions, and validity', async () => {
    await seedApprovedIntelligence();

    // 1. Save and approve contract revision 1
    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions`,
      headers: peterLeadAuth,
      payload: { commitMessage: 'Pre-restart baseline' }
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1/decisions`,
      headers: rachelReviewerAuth,
      payload: {
        decisionType: 'APPROVE',
        rationale: 'Pre-restart approval rationale.',
        expectedRevisionNumber: 1
      }
    });

    // 2. Simulate complete API & database restart
    await app.close();
    db.close();

    const restartedDb = new SqliteDatabase(dbPath);
    restartedDb.open();
    const restartedApp = buildApiApp({ database: restartedDb });
    await restartedApp.ready();

    // 3. Query contract revision 1 after restart
    const resAfterRestart = await restartedApp.inject({
      method: 'GET',
      url: `/api/v1/projects/${northstarProjectId}/performance-contract/revisions/1`,
      headers: victorViewerAuth
    });
    expect(resAfterRestart.statusCode).toBe(200);
    const revAfter = resAfterRestart.json();
    expect(revAfter.revisionNumber).toBe(1);
    expect(revAfter.approvalValidity.state).toBe('CURRENTLY_VALID');
    expect(revAfter.activeDecision?.actorDisplayName).toBe('Rachel Reviewer');
    expect(revAfter.activeDecision?.rationale).toBe('Pre-restart approval rationale.');

    await restartedApp.close();
    restartedDb.close();
  });
});
