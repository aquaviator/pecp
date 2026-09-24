// Persistent Intelligence Read Model Tests
// Defined according to M5.0 Work Package §7 (Extension)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase';
import { SqliteIntelligenceRepository } from '../src/persistence/sqlite/SqliteIntelligenceRepository';
import { IntelligenceItem } from '@pecp/pe-domain';

describe('M5.0 §7 Persistent Intelligence Read Model', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let intelligenceRepo: SqliteIntelligenceRepository;
  let app: FastifyInstance;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-intel-test-'));
    dbPath = path.join(tempDir, 'pecp-intel.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    intelligenceRepo = new SqliteIntelligenceRepository(db);

    app = buildApiApp({ database: db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('serves project-scoped intelligence items faithfully without modification', async () => {
    // 1. Create a project
    const projRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: 'Intelligence Project',
        organisation: 'Intel Org',
        intent: 'DISCOVERY',
        description: 'Testing intelligence storage'
      }
    });
    const project = projRes.json();

    // 2. Seed intelligence items
    const item1: IntelligenceItem = {
      id: 'intel-item-1',
      key: 'checkout_throughput_peak',
      title: 'Peak Checkout Throughput',
      category: 'WORKLOAD',
      canonicalState: 'OBSERVED',
      reviewStatus: 'FOUND',
      value: 125.5,
      unit: 'orders/sec',
      source: 'APM telemetry dashboard',
      sourceDocument: 'telemetry-report-q4.pdf',
      sourceLocation: 'Page 14, Table 2',
      capturedDate: '2026-09-24T00:00:00.000Z',
      approvalState: 'APPROVED',
      history: []
    };

    const item2: IntelligenceItem = {
      id: 'intel-item-2',
      key: 'p95_latency_slo',
      title: 'Checkout p95 Latency SLO',
      category: 'REQUIREMENTS',
      canonicalState: 'APPROVED',
      reviewStatus: 'FOUND',
      value: 800,
      unit: 'ms',
      source: 'PRD v2.3',
      sourceDocument: 'checkout-prd.docx',
      sourceLocation: 'Section 4.1.2',
      capturedDate: '2026-09-24T00:00:00.000Z',
      approvalState: 'APPROVED',
      history: []
    };

    await intelligenceRepo.saveItems(project.id, [item1, item2]);

    // 3. List items via GET /api/v1/projects/:projectId/intelligence
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/intelligence`
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body.items.length).toBe(2);
    expect(body.items.map((i: any) => i.id).sort()).toEqual(['intel-item-1', 'intel-item-2']);

    // 4. Get individual item via GET /api/v1/projects/:projectId/intelligence/:itemId
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/intelligence/intel-item-1`
    });

    expect(getRes.statusCode).toBe(200);
    const fetched = getRes.json();
    expect(fetched.id).toBe(item1.id);
    expect(fetched.key).toBe(item1.key);
    expect(fetched.title).toBe(item1.title);
    expect(fetched.value).toBe(item1.value);
    expect(fetched.unit).toBe(item1.unit);
    expect(fetched.approvalState).toBe(item1.approvalState);

    // 5. 404 for unknown item
    const notFoundRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/intelligence/non-existent`
    });
    expect(notFoundRes.statusCode).toBe(404);
  });
});
