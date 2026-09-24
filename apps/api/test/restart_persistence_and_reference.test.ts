// Restart Persistence & Reference Scenario Tests
// Defined according to M5.0 Work Package §9 & §10

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase';
import { SqliteEntityRevisionRepository } from '../src/persistence/sqlite/SqliteEntityRevisionRepository';

describe('M5.0 Persistence Restart & Reference Scenario (Northstar Retail)', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-restart-test-'));
    dbPath = path.join(tempDir, 'pecp-restart.db');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('proves POST project -> durable persistence -> restart -> GET project -> exact equality', async () => {
    // 1. First Server Lifetime: Start app, create Northstar Retail project
    let db1 = new SqliteDatabase(dbPath);
    db1.open();
    let app1: FastifyInstance = buildApiApp({ database: db1 });
    await app1.ready();

    const createRes = await app1.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: {
        name: 'Holiday Peak 2027',
        organisation: 'Northstar Retail',
        intent: 'FORECAST',
        description: 'Black Friday & Cyber Monday holiday capacity forecast',
        creationMethod: 'BRIEF',
        briefText: 'Simulate peak holiday transaction growth at 35% above prior year',
        uploadedDocumentNames: ['holiday-2026-actuals.csv', 'nfr-holiday-2027.pdf'],
        externalReference: 'EXT-NORTHSTAR-2027'
      }
    });

    expect(createRes.statusCode).toBe(201);
    const createdProject = createRes.json();
    expect(createdProject.id).toMatch(/^proj-/);
    expect(createdProject.name).toBe('Holiday Peak 2027');
    expect(createdProject.organisation).toBe('Northstar Retail');
    expect(createdProject.organisationId).toMatch(/^org-/);
    expect(createdProject.intent).toBe('FORECAST');
    expect(createdProject.status).toBe('ACTIVE');
    expect(createdProject.documentsCount).toBe(2);
    expect(createdProject.requirementsCount).toBe(0);
    expect(createdProject.conflictsCount).toBe(0);

    // Close down server 1 and database 1 cleanly
    await app1.close();
    db1.close();

    // 2. Second Server Lifetime (Restart): New database instance and app instance pointing to the same database file
    const db2 = new SqliteDatabase(dbPath);
    db2.open();
    const app2: FastifyInstance = buildApiApp({ database: db2 });
    await app2.ready();

    // Fetch the project created in the previous process lifetime
    const getRes = await app2.inject({
      method: 'GET',
      url: `/api/v1/projects/${createdProject.id}`
    });

    expect(getRes.statusCode).toBe(200);
    const reloadedProject = getRes.json();

    // Exact equality check
    expect(reloadedProject).toEqual(createdProject);

    // Verify organization persisted across restart
    const getOrgRes = await app2.inject({
      method: 'GET',
      url: `/api/v1/organisations/${createdProject.organisationId}`
    });
    expect(getOrgRes.statusCode).toBe(200);
    const reloadedOrg = getOrgRes.json();
    expect(reloadedOrg.id).toBe(createdProject.organisationId);
    expect(reloadedOrg.name).toBe('Northstar Retail');
    expect(reloadedOrg.status).toBe('ACTIVE');

    // Verify entity revisions persisted across restart
    const revisionRepo2 = new SqliteEntityRevisionRepository(db2);
    const projectRevisions = await revisionRepo2.listByEntity('PROJECT', createdProject.id);
    expect(projectRevisions.length).toBe(1);
    expect(projectRevisions[0].revisionNumber).toBe(1);
    const parsedPayload = JSON.parse(projectRevisions[0].payloadJson);
    expect(parsedPayload.project.id).toBe(createdProject.id);
    expect(parsedPayload.bootstrapMetadata.externalReference).toBe('EXT-NORTHSTAR-2027');

    await app2.close();
    db2.close();
  });
});
