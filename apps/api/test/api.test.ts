// Fastify Inject API Tests
// Defined according to M5.0 Work Package §9

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase';
import { createPlatformAdmin } from './test-auth-helper';

describe('M5.0 Fastify API & Endpoints', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;
  let authHeaders: { authorization: string };

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-api-test-'));
    dbPath = path.join(tempDir, 'pecp-api.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const admin = await createPlatformAdmin(db);
    authHeaders = admin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. GET /health returns 200 and ok status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();
  });

  it('2. GET /ready checks persistence availability and migrations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ready'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ready');
    expect(body.database).toBe('connected');
    expect(body.migrationsApplied).toBeGreaterThanOrEqual(2);
  });

  it('3. Organisation endpoints: create, list, get, and patch status', async () => {
    // Create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: authHeaders,
      payload: { name: 'FinTech Hub' }
    });
    expect(createRes.statusCode).toBe(201);
    const org = createRes.json();
    expect(org.id).toMatch(/^org-/);
    expect(org.name).toBe('FinTech Hub');
    expect(org.status).toBe('ACTIVE');

    // Duplicate 409
    const dupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: authHeaders,
      payload: { name: '  fintech hub  ' }
    });
    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.json().error.code).toBe('CONFLICT');

    // List
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/organisations',
      headers: authHeaders
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.length).toBe(1);

    // Get by id
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${org.id}`,
      headers: authHeaders
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().id).toBe(org.id);

    // Patch status
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organisations/${org.id}/status`,
      headers: authHeaders,
      payload: { status: 'ARCHIVED' }
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().status).toBe('ARCHIVED');
  });

  it('4. Project creation: auto-creates organisation by supplied display name and preserves zero-invention', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: authHeaders,
      payload: {
        name: 'OmniChannel Checkout Test',
        organisation: 'Retail World',
        intent: 'CERTIFICATION',
        description: 'Black Friday readiness certification',
        creationMethod: 'BRIEF',
        briefText: 'Simulate 1200 checkout completions/sec',
        uploadedDocumentNames: ['doc1.pdf', 'doc2.pdf']
      }
    });

    expect(res.statusCode).toBe(201);
    const project = res.json();
    expect(project.id).toMatch(/^proj-/);
    expect(project.name).toBe('OmniChannel Checkout Test');
    expect(project.organisation).toBe('Retail World');
    expect(project.organisationId).toMatch(/^org-/);
    expect(project.intent).toBe('CERTIFICATION');

    // Zero-invention checks (M5.0 §2):
    expect(project.requirementsCount).toBe(0);
    expect(project.conflictsCount).toBe(0);
    expect(project.documentsCount).toBe(2);

    // Verify auto-created organisation exists
    const orgRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${project.organisationId}`,
      headers: authHeaders
    });
    expect(orgRes.statusCode).toBe(200);
    expect(orgRes.json().name).toBe('Retail World');
  });

  it('5. Validation: rejects invalid engineering intent with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: authHeaders,
      payload: {
        name: 'Invalid Project',
        organisation: 'Test Org',
        intent: 'INVENTED_INTENT',
        description: 'Invalid'
      }
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('Invalid engineering intent');
  });

  it('6. Validation: returns 404 for unknown resources', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/non-existent-proj-id',
      headers: authHeaders
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('not found');
  });

  it('7. Error safety: error responses do NOT expose SQL internals or file paths', async () => {
    // Malformed input causing validation error
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: 'not-a-json-object',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      }
    });

    expect(res.statusCode).toBe(400);
    const rawText = res.body;
    expect(rawText).not.toContain('SQLITE_');
    expect(rawText).not.toContain('/home/');
    expect(rawText).not.toContain('/app/');
    expect(rawText).not.toContain('.db');
  });

  it('8. Project update and archive endpoints', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: authHeaders,
      payload: {
        name: 'Project to Update',
        organisation: 'Update Org',
        intent: 'DISCOVERY',
        description: 'Before update'
      }
    });
    const proj = createRes.json();

    // Patch
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${proj.id}`,
      headers: authHeaders,
      payload: {
        name: 'Project After Update',
        description: 'Updated successfully'
      }
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().name).toBe('Project After Update');
    expect(patchRes.json().description).toBe('Updated successfully');

    // Archive
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${proj.id}/archive`,
      headers: authHeaders
    });
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.json().status).toBe('ARCHIVED');
  });
});
