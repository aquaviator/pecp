// M5.1 Intelligence Governance & Attributed Approval Tests
// Defined according to M5.1 Work Package §15 & §23

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { IntelligenceItem } from '@pecp/pe-domain';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { SqliteIntelligenceRepository } from '../src/persistence/sqlite/SqliteIntelligenceRepository.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('M5.1 Intelligence Governance & Human Actor Decision Authority', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;
  let intelRepo: SqliteIntelligenceRepository;

  let adminAuth: { authorization: string };
  let orgId: string;
  let projectId: string;

  let reviewerAuth: { authorization: string };
  let reviewerUser: any;
  let engineerAuth: { authorization: string };

  const conflictingItemId = 'intel-conflict-1';
  const candidateAId = 'cand-a';
  const candidateBId = 'cand-b';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-intel-gov-test-'));
    const dbPath = path.join(tempDir, 'pecp-intel-gov.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    intelRepo = new SqliteIntelligenceRepository(db);

    const admin = await createPlatformAdmin(db);
    adminAuth = admin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();

    // Create organisation & project
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'RetailCo Governance Org' }
    });
    orgId = orgRes.json().id;

    const projRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: adminAuth,
      payload: {
        name: 'Checkout Performance Governance',
        organisation: 'RetailCo Governance Org',
        organisationId: orgId,
        intent: 'CERTIFICATION',
        description: 'Testing human decision attribution'
      }
    });
    projectId = projRes.json().id;

    // Reviewer (permitted to resolve & approve)
    const reviewer = await createTestUser(db, {
      email: 'rita.reviewer@retailco.com',
      displayName: 'Rita Reviewer',
      membership: { organisationId: orgId, role: 'REVIEWER' }
    });
    reviewerAuth = reviewer.authHeaders;
    reviewerUser = reviewer.user;

    // Engineer (forbidden to approve or resolve)
    const engineer = await createTestUser(db, {
      email: 'erin.engineer@retailco.com',
      displayName: 'Erin Engineer',
      membership: { organisationId: orgId, role: 'PERFORMANCE_ENGINEER' }
    });
    engineerAuth = engineer.authHeaders;

    // Seed conflicting intelligence item with 2 upstream candidates
    const conflictingItem: IntelligenceItem = {
      id: conflictingItemId,
      key: 'peak_checkout_tps',
      title: 'Peak Checkout TPS Target',
      category: 'WORKLOAD',
      canonicalState: 'CONFLICTING',
      reviewStatus: 'CONFLICTING',
      value: 1200,
      unit: 'tps',
      source: 'Telemetry vs PRD',
      sourceDocument: 'prd-v2.pdf',
      sourceLocation: 'Page 5',
      capturedDate: '2026-09-24T00:00:00.000Z',
      history: [],
      candidates: [
        {
          id: candidateAId,
          value: 1200,
          unit: 'tps',
          source: 'Marketing PRD',
          sourceDocument: 'prd-v2.pdf',
          sourceLocation: 'Page 5, Section 2',
          capturedDate: '2026-09-20T00:00:00.000Z',
          canonicalState: 'CONFLICTING',
          reviewStatus: 'CONFLICTING'
        },
        {
          id: candidateBId,
          value: 850,
          unit: 'tps',
          source: 'APM Historic Actuals',
          sourceDocument: 'telemetry-october.json',
          sourceLocation: 'Query aggregate',
          capturedDate: '2026-09-22T00:00:00.000Z',
          canonicalState: 'CONFLICTING',
          reviewStatus: 'CONFLICTING'
        }
      ]
    };

    await intelRepo.saveItems(projectId, [conflictingItem]);
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Rejects unauthenticated resolution and approval requests with 401', async () => {
    const unauthResolve = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/${conflictingItemId}/resolve`,
      payload: { chosenCandidateId: candidateBId }
    });
    expect(unauthResolve.statusCode).toBe(401);

    const unauthApprove = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/${conflictingItemId}/approve`
    });
    expect(unauthApprove.statusCode).toBe(401);
  });

  it('2. Denies unpermitted roles (e.g. PERFORMANCE_ENGINEER) with 403', async () => {
    const engineerResolve = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/${conflictingItemId}/resolve`,
      headers: engineerAuth,
      payload: { chosenCandidateId: candidateBId }
    });
    expect(engineerResolve.statusCode).toBe(403);
    expect(engineerResolve.json().error.code).toBe('FORBIDDEN');

    const engineerApprove = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/${conflictingItemId}/approve`,
      headers: engineerAuth
    });
    expect(engineerApprove.statusCode).toBe(403);
  });

  it('3. Permitted actor resolves conflict: promotes candidate provenance, sets authenticated actor, and records audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/${conflictingItemId}/resolve`,
      headers: reviewerAuth,
      payload: {
        chosenCandidateId: candidateBId,
        rationale: 'Telemetry actuals represent true measured peak'
      }
    });

    expect(res.statusCode).toBe(200);
    const resolvedItem: IntelligenceItem = res.json();

    // Promoted value & unit from Candidate B
    expect(resolvedItem.value).toBe(850);
    expect(resolvedItem.unit).toBe('tps');
    expect(resolvedItem.source).toBe('APM Historic Actuals');
    expect(resolvedItem.sourceDocument).toBe('telemetry-october.json');

    // Canonical & review state transitions
    expect(resolvedItem.canonicalState).toBe('APPROVED');
    expect(resolvedItem.reviewStatus).toBe('FOUND');
    expect(resolvedItem.approvalState).toBe('APPROVED');

    // Attributed to the authenticated actor Rita Reviewer, NOT client-supplied string
    expect(resolvedItem.approvedBy).toBe('Rita Reviewer');
    expect(resolvedItem.approvedById).toBe(reviewerUser.id);
    expect(resolvedItem.approvalDate).toBeDefined();

    // Verify history contains resolution entry with actor
    expect(resolvedItem.history.length).toBeGreaterThan(0);
    const lastHistory = resolvedItem.history[resolvedItem.history.length - 1];
    expect(lastHistory.actor).toBe('Rita Reviewer');
    expect(lastHistory.note).toContain('Telemetry actuals represent true measured peak');

    // Verify audit event was written with Rita Reviewer as actor
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/audit?projectId=${projectId}`,
      headers: adminAuth
    });
    const resolveAudit = auditRes.json().items.find((e: any) => e.action === 'INTELLIGENCE_CONFLICT_RESOLVE');
    expect(resolveAudit).toBeDefined();
    expect(resolveAudit.actorUserId).toBe(reviewerUser.id);
    expect(resolveAudit.actorDisplayName).toBe('Rita Reviewer');
    expect(resolveAudit.targetId).toBe(conflictingItemId);
    expect(resolveAudit.outcome).toBe('SUCCESS');
  });

  it('4. Ignores client-supplied fake approver identity in favor of authenticated principal', async () => {
    // Attempting to spoof approver name in request body
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/intelligence/${conflictingItemId}/resolve`,
      headers: reviewerAuth,
      payload: {
        chosenCandidateId: candidateAId,
        approverName: 'Falsely Claimed Chief Architect',
        approvedBy: 'Spoofed Name',
        actorUserId: 'fake-user-id'
      }
    });

    expect(res.statusCode).toBe(200);
    const item = res.json();
    // The server MUST use the session principal, NOT any fake client body fields
    expect(item.approvedBy).toBe('Rita Reviewer');
    expect(item.approvedById).toBe(reviewerUser.id);
  });
});
