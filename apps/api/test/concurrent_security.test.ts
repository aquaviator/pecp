// M5.1 Concurrent Security & Transactional Audit Tests
// Defined according to M5.1 Work Package §23

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createPlatformAdmin, createTestUser } from './test-auth-helper.js';

describe('M5.1 Concurrent Security & Transaction Isolation', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;
  let adminAuth: { authorization: string };
  let orgId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-concurrent-sec-'));
    const dbPath = path.join(tempDir, 'pecp-concurrent-sec.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    const admin = await createPlatformAdmin(db);
    adminAuth = admin.authHeaders;

    app = buildApiApp({ database: db });
    await app.ready();

    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Concurrent Security Org' }
    });
    orgId = orgRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('proves concurrent membership updates execute with unit-of-work isolation and exact audit count', async () => {
    // Create 5 distinct users
    const users = await Promise.all([
      createTestUser(db, { email: 'user1@pecp.io', displayName: 'User 1' }),
      createTestUser(db, { email: 'user2@pecp.io', displayName: 'User 2' }),
      createTestUser(db, { email: 'user3@pecp.io', displayName: 'User 3' }),
      createTestUser(db, { email: 'user4@pecp.io', displayName: 'User 4' }),
      createTestUser(db, { email: 'user5@pecp.io', displayName: 'User 5' })
    ]);

    // Dispatch 5 concurrent membership creation requests
    const addResults = await Promise.all(
      users.map((u) =>
        app.inject({
          method: 'POST',
          url: `/api/v1/organisations/${orgId}/memberships`,
          headers: adminAuth,
          payload: {
            userId: u.user.id,
            role: 'VIEWER'
          }
        })
      )
    );

    for (const res of addResults) {
      expect(res.statusCode).toBe(201);
    }

    // Verify exactly 5 membership records exist
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth
    });
    expect(listRes.statusCode).toBe(200);
    // 5 added members + 1 auto-created admin membership on org creation = 6
    expect(listRes.json().items.length).toBe(6);

    // Verify audit ledger contains exactly 5 MEMBERSHIP_CREATE events
    const auditRes = await app.inject({
      method: 'GET',
      url: `/api/v1/audit?organisationId=${orgId}&action=MEMBERSHIP_CREATE`,
      headers: adminAuth
    });
    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.json().items.length).toBe(5);
  });
});
