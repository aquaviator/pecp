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

  it('proves concurrent demotion of two ORG_ADMINs retains at least one administrator without partial persistence', async () => {
    // Create two admin users in this organisation
    const admin1 = await createTestUser(db, {
      email: 'admin1@pecp.io',
      displayName: 'Admin One',
      membership: { organisationId: orgId, role: 'ORG_ADMIN' }
    });
    const admin2 = await createTestUser(db, {
      email: 'admin2@pecp.io',
      displayName: 'Admin Two',
      membership: { organisationId: orgId, role: 'ORG_ADMIN' }
    });

    // Remove the default admin from org creation so exactly admin1 and admin2 are ORG_ADMINs
    const currentMembersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth
    });
    const initialAdmins = currentMembersRes.json().items.filter((m: any) => m.role === 'ORG_ADMIN' && m.status === 'ACTIVE');
    for (const m of initialAdmins) {
      if (m.userId !== admin1.user.id && m.userId !== admin2.user.id) {
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/organisations/${orgId}/memberships/${m.userId}/role`,
          headers: adminAuth,
          payload: { role: 'VIEWER' }
        });
      }
    }

    // Verify exactly 2 active ORG_ADMINs exist
    const preCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth
    });
    const activeAdminsPre = preCheck.json().items.filter((m: any) => m.role === 'ORG_ADMIN' && m.status === 'ACTIVE');
    expect(activeAdminsPre.length).toBe(2);

    // Simultaneously attempt to demote both admin1 and admin2 to VIEWER
    const [demote1, demote2] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/api/v1/organisations/${orgId}/memberships/${admin1.user.id}/role`,
        headers: admin1.authHeaders,
        payload: { role: 'VIEWER' }
      }),
      app.inject({
        method: 'PATCH',
        url: `/api/v1/organisations/${orgId}/memberships/${admin2.user.id}/role`,
        headers: admin2.authHeaders,
        payload: { role: 'VIEWER' }
      })
    ]);

    // One must succeed (200) and one must be rejected (400) by the unit-of-work guard
    const statusCodes = [demote1.statusCode, demote2.statusCode].sort();
    expect(statusCodes).toEqual([200, 400]);

    const failed = demote1.statusCode === 400 ? demote1 : demote2;
    expect(failed.json().error.message).toContain('Cannot demote the last ORG_ADMIN for this organisation');

    // Verify exactly one active ORG_ADMIN remains
    const postCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth
    });
    const activeAdminsPost = postCheck.json().items.filter((m: any) => m.role === 'ORG_ADMIN' && m.status === 'ACTIVE');
    expect(activeAdminsPost.length).toBe(1);

    // Verify rejected operation did not partially persist in the audit ledger
    const roleChangeAudits = await app.inject({
      method: 'GET',
      url: `/api/v1/audit?organisationId=${orgId}&action=MEMBERSHIP_ROLE_CHANGE`,
      headers: adminAuth
    });
    // Exactly 1 audit record for the demotion
    const recentDemotions = roleChangeAudits.json().items.filter(
      (a: any) => {
        if (a.targetId === `${orgId}:${admin1.user.id}` || a.targetId === `${orgId}:${admin2.user.id}`) {
          return true;
        }
        if (a.metadataJson) {
          try {
            const parsed = JSON.parse(a.metadataJson);
            return parsed.targetUserId === admin1.user.id || parsed.targetUserId === admin2.user.id;
          } catch {
            return false;
          }
        }
        return false;
      }
    );
    expect(recentDemotions.length).toBe(1);
    expect(recentDemotions[0].outcome).toBe('SUCCESS');
  });

  it('proves concurrent revocation of two ORG_ADMINs retains at least one administrator', async () => {
    // Create two admin users in this organisation
    const adminA = await createTestUser(db, {
      email: 'adminA@pecp.io',
      displayName: 'Admin Alpha',
      membership: { organisationId: orgId, role: 'ORG_ADMIN' }
    });
    const adminB = await createTestUser(db, {
      email: 'adminB@pecp.io',
      displayName: 'Admin Beta',
      membership: { organisationId: orgId, role: 'ORG_ADMIN' }
    });

    // Demote any other admins so only adminA and adminB are active admins
    const currentMembersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth
    });
    for (const m of currentMembersRes.json().items) {
      if (m.role === 'ORG_ADMIN' && m.status === 'ACTIVE' && m.userId !== adminA.user.id && m.userId !== adminB.user.id) {
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/organisations/${orgId}/memberships/${m.userId}/role`,
          headers: adminAuth,
          payload: { role: 'VIEWER' }
        });
      }
    }

    // Simultaneously attempt to revoke both adminA and adminB
    const [revokeA, revokeB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/organisations/${orgId}/memberships/${adminA.user.id}/revoke`,
        headers: adminA.authHeaders
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/organisations/${orgId}/memberships/${adminB.user.id}/revoke`,
        headers: adminB.authHeaders
      })
    ]);

    const statusCodes = [revokeA.statusCode, revokeB.statusCode].sort();
    expect(statusCodes).toEqual([200, 400]);

    const failed = revokeA.statusCode === 400 ? revokeA : revokeB;
    expect(failed.json().error.message).toContain('Cannot revoke the last ORG_ADMIN for this organisation');

    // Verify exactly one active ORG_ADMIN remains
    const postCheck = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${orgId}/memberships`,
      headers: adminAuth
    });
    const activeAdminsPost = postCheck.json().items.filter((m: any) => m.role === 'ORG_ADMIN' && m.status === 'ACTIVE');
    expect(activeAdminsPost.length).toBe(1);
  });

  it('rejects duplicate active membership creation with 409 Conflict and protects sole administrator from overwrite', async () => {
    // Create dedicated org with a single sole administrator
    const soleOrgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organisations',
      headers: adminAuth,
      payload: { name: 'Sole Admin Protected Org' }
    });
    const soleOrgId = soleOrgRes.json().id;

    const soleAdmin = await createTestUser(db, {
      email: 'soleadmin@pecp.io',
      displayName: 'Sole Administrator',
      membership: { organisationId: soleOrgId, role: 'ORG_ADMIN' }
    });

    // Remove the default admin so soleAdmin is the ONLY admin
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${soleOrgId}/memberships`,
      headers: adminAuth
    });
    for (const m of membersRes.json().items) {
      if (m.userId !== soleAdmin.user.id) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/organisations/${soleOrgId}/memberships/${m.userId}/revoke`,
          headers: adminAuth
        });
      }
    }

    // Get initial membership details to verify provenance
    const initialGet = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${soleOrgId}/memberships`,
      headers: soleAdmin.authHeaders
    });
    const initialMembership = initialGet.json().items.find((m: any) => m.userId === soleAdmin.user.id);
    expect(initialMembership.role).toBe('ORG_ADMIN');
    expect(initialMembership.status).toBe('ACTIVE');

    // 1. PLATFORM_ADMIN attempts to re-post the sole administrator as VIEWER via POST memberships
    const platformPostRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${soleOrgId}/memberships`,
      headers: adminAuth,
      payload: {
        userId: soleAdmin.user.id,
        role: 'VIEWER'
      }
    });
    expect(platformPostRes.statusCode).toBe(409);
    expect(platformPostRes.json().error.code).toBe('CONFLICT');
    expect(platformPostRes.json().error.message).toContain('Active membership already exists');

    // 2. ORG_ADMIN actor attempts to re-post another member who is already active
    const engineer = await createTestUser(db, {
      email: 'engineer@pecp.io',
      displayName: 'Engineer Test',
      membership: { organisationId: soleOrgId, role: 'PERFORMANCE_ENGINEER' }
    });

    const orgAdminPostRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${soleOrgId}/memberships`,
      headers: soleAdmin.authHeaders,
      payload: {
        userId: engineer.user.id,
        role: 'VIEWER'
      }
    });
    expect(orgAdminPostRes.statusCode).toBe(409);
    expect(orgAdminPostRes.json().error.code).toBe('CONFLICT');

    // 3. Verify sole administrator authority and creation provenance are intact
    const verifyGet = await app.inject({
      method: 'GET',
      url: `/api/v1/organisations/${soleOrgId}/memberships`,
      headers: soleAdmin.authHeaders
    });
    const verifiedAdmin = verifyGet.json().items.find((m: any) => m.userId === soleAdmin.user.id);
    expect(verifiedAdmin.role).toBe('ORG_ADMIN');
    expect(verifiedAdmin.status).toBe('ACTIVE');
    expect(verifiedAdmin.createdAt).toBe(initialMembership.createdAt);
    expect(verifiedAdmin.createdByUserId).toBe(initialMembership.createdByUserId);

    // 4. Verify reactivating a REVOKED membership via addMembership preserves original creation provenance
    await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${soleOrgId}/memberships/${engineer.user.id}/revoke`,
      headers: soleAdmin.authHeaders
    });

    const reactivateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organisations/${soleOrgId}/memberships`,
      headers: soleAdmin.authHeaders,
      payload: {
        userId: engineer.user.id,
        role: 'REVIEWER'
      }
    });
    expect(reactivateRes.statusCode).toBe(201);
    const reactivated = reactivateRes.json();
    expect(reactivated.role).toBe('REVIEWER');
    expect(reactivated.status).toBe('ACTIVE');
    // Original creation provenance preserved
    expect(reactivated.createdByUserId).toBe(engineer.user.id);
  });
});
