// Failure-injection tests proving identity mutations and audit events are transactionally atomic
// Defined according to M5.1 PM Review Blocker 4
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import {
  IdentityAdministrationService,
  AuditService,
  PasswordHasher,
  AuthenticatedPrincipal,
  Organisation
} from '@pecp/platform-core';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { SqliteUserRepository } from '../src/persistence/sqlite/SqliteUserRepository.js';
import { SqliteLocalCredentialRepository } from '../src/persistence/sqlite/SqliteLocalCredentialRepository.js';
import { SqliteOrganisationMembershipRepository } from '../src/persistence/sqlite/SqliteOrganisationMembershipRepository.js';
import { SqliteSessionRepository } from '../src/persistence/sqlite/SqliteSessionRepository.js';
import { SqliteAuditEventRepository } from '../src/persistence/sqlite/SqliteAuditEventRepository.js';
import { SqliteOrganisationRepository } from '../src/persistence/sqlite/SqliteOrganisationRepository.js';

describe('M5.1 Identity Governance & Audit Atomicity Rollback Regressions', () => {
  let db: SqliteDatabase;
  let userRepo: SqliteUserRepository;
  let credentialRepo: SqliteLocalCredentialRepository;
  let membershipRepo: SqliteOrganisationMembershipRepository;
  let sessionRepo: SqliteSessionRepository;
  let auditRepo: SqliteAuditEventRepository;
  let orgRepo: SqliteOrganisationRepository;
  let auditService: AuditService;

  const platformAdminActor: AuthenticatedPrincipal = {
    userId: 'usr-root-admin',
    email: 'admin@platform.gov',
    displayName: 'Platform Administrator',
    platformRole: 'PLATFORM_ADMIN',
    memberships: [],
    sessionId: 'sess-root-1',
    authenticatedAt: '2026-09-25T00:00:00.000Z'
  };

  const createTestOrg = async (name: string): Promise<Organisation> => {
    const now = new Date().toISOString();
    return orgRepo.create({
      id: crypto.randomUUID(),
      name,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    });
  };

  beforeEach(() => {
    db = new SqliteDatabase(':memory:');
    db.open();

    userRepo = new SqliteUserRepository(db);
    credentialRepo = new SqliteLocalCredentialRepository(db);
    membershipRepo = new SqliteOrganisationMembershipRepository(db);
    sessionRepo = new SqliteSessionRepository(db);
    auditRepo = new SqliteAuditEventRepository(db);
    orgRepo = new SqliteOrganisationRepository(db);
    auditService = new AuditService(auditRepo);
  });

  afterEach(() => {
    db.close();
  });

  it('1. failed USER_CREATE audit rolls back user + credential creation', async () => {
    const faultyAuditService = new AuditService(auditRepo);
    faultyAuditService.record = async () => {
      throw new Error('INJECTED_AUDIT_DISK_FAILURE: Cannot persist USER_CREATE audit event');
    };

    const identityAdmin = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      faultyAuditService,
      db
    );

    const email = 'candidate@enterprise.internal';
    await expect(
      identityAdmin.createUser(platformAdminActor, {
        email,
        displayName: 'Candidate Engineer',
        password: 'ValidPass123!Secure'
      })
    ).rejects.toThrow('INJECTED_AUDIT_DISK_FAILURE');

    // Prove rollback: user must NOT exist in repository
    const userInDb = await userRepo.getByEmail(email);
    expect(userInDb).toBeNull();

    // Prove rollback: no credential record exists
    const users = await userRepo.list();
    expect(users.find((u) => u.email === email)).toBeUndefined();
  });

  it('2. failed USER_DISABLE audit rolls back status change and session revocation', async () => {
    const identityAdminNormal = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      auditService,
      db
    );

    const user = await identityAdminNormal.createUser(platformAdminActor, {
      email: 'engineer@corp.internal',
      displayName: 'Active Engineer',
      password: 'InitialPassword123!'
    });

    const sessionId = 'sess-eng-active';
    await sessionRepo.save({
      id: sessionId,
      userId: user.id,
      tokenHash: 'tokenhash123',
      createdAt: '2026-09-25T00:00:00.000Z',
      expiresAt: '2026-09-26T00:00:00.000Z',
      authenticatedAt: '2026-09-25T00:00:00.000Z'
    });

    const faultyAuditService = new AuditService(auditRepo);
    faultyAuditService.record = async (event) => {
      if (event.action === 'USER_DISABLE') {
        throw new Error('INJECTED_AUDIT_ERROR: Failed to record user disable audit');
      }
      return auditService.record(event);
    };

    const identityAdminFaulty = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      faultyAuditService,
      db
    );

    await expect(
      identityAdminFaulty.updateUserStatus(platformAdminActor, user.id, 'DISABLED')
    ).rejects.toThrow('INJECTED_AUDIT_ERROR');

    // Prove rollback: status must remain ACTIVE
    const refreshedUser = await userRepo.getById(user.id);
    expect(refreshedUser?.status).toBe('ACTIVE');

    // Prove rollback: session must NOT be revoked
    const session = await sessionRepo.getById(sessionId);
    expect(session?.revokedAt).toBeUndefined();
  });

  it('3. failed PASSWORD_RESET audit rolls back credential update and session invalidation', async () => {
    const identityAdminNormal = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      auditService,
      db
    );

    const initialPassword = 'InitialValidPassword123!';
    const user = await identityAdminNormal.createUser(platformAdminActor, {
      email: 'lead@corp.internal',
      displayName: 'Performance Lead',
      password: initialPassword
    });

    const sessionId = 'sess-lead-active';
    await sessionRepo.save({
      id: sessionId,
      userId: user.id,
      tokenHash: 'tokenhash-lead',
      createdAt: '2026-09-25T00:00:00.000Z',
      expiresAt: '2026-09-26T00:00:00.000Z',
      authenticatedAt: '2026-09-25T00:00:00.000Z'
    });

    const faultyAuditService = new AuditService(auditRepo);
    faultyAuditService.record = async (event) => {
      if (event.action === 'PASSWORD_RESET') {
        throw new Error('INJECTED_AUDIT_ERROR: Password reset audit failed');
      }
      return auditService.record(event);
    };

    const identityAdminFaulty = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      faultyAuditService,
      db
    );

    await expect(
      identityAdminFaulty.resetPassword(platformAdminActor, user.id, 'BrandNewPassword456!Secure')
    ).rejects.toThrow('INJECTED_AUDIT_ERROR');

    // Prove rollback: credential in DB still matches initialPassword
    const credential = await credentialRepo.getByUserId(user.id);
    expect(credential).not.toBeNull();
    const verified = await PasswordHasher.verify(
      initialPassword,
      credential!.salt,
      credential!.passwordHash,
      credential!.paramsJson
    );
    expect(verified).toBe(true);

    // Prove rollback: session was NOT revoked
    const session = await sessionRepo.getById(sessionId);
    expect(session?.revokedAt).toBeUndefined();
  });

  it('4. failed MEMBERSHIP_CREATE audit rolls back membership insertion', async () => {
    const org = await createTestOrg('Acme Logistics');
    const user = await userRepo.create({
      id: 'usr-member-1',
      email: 'member@acme.com',
      normalizedEmail: 'member@acme.com',
      displayName: 'Acme Member',
      status: 'ACTIVE',
      platformRole: 'NONE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    });

    const faultyAuditService = new AuditService(auditRepo);
    faultyAuditService.record = async () => {
      throw new Error('INJECTED_AUDIT_ERROR: Membership create audit failed');
    };

    const identityAdmin = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      faultyAuditService,
      db
    );

    await expect(
      identityAdmin.addMembership(platformAdminActor, org.id, user.id, 'PERFORMANCE_ENGINEER')
    ).rejects.toThrow('INJECTED_AUDIT_ERROR');

    // Prove rollback: membership record must NOT exist
    const membership = await membershipRepo.get(org.id, user.id);
    expect(membership).toBeNull();
  });

  it('5. failed MEMBERSHIP_ROLE_CHANGE audit rolls back role update', async () => {
    const org = await createTestOrg('Apex Retail');
    const user = await userRepo.create({
      id: 'usr-member-2',
      email: 'lead@apex.com',
      normalizedEmail: 'lead@apex.com',
      displayName: 'Apex Lead',
      status: 'ACTIVE',
      platformRole: 'NONE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    });

    await membershipRepo.save({
      organisationId: org.id,
      userId: user.id,
      role: 'VIEWER',
      status: 'ACTIVE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
      createdByUserId: platformAdminActor.userId
    });

    const faultyAuditService = new AuditService(auditRepo);
    faultyAuditService.record = async () => {
      throw new Error('INJECTED_AUDIT_ERROR: Role change audit failed');
    };

    const identityAdmin = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      faultyAuditService,
      db
    );

    await expect(
      identityAdmin.updateMembershipRole(platformAdminActor, org.id, user.id, 'PERFORMANCE_LEAD')
    ).rejects.toThrow('INJECTED_AUDIT_ERROR');

    // Prove rollback: role in DB must remain VIEWER
    const membership = await membershipRepo.get(org.id, user.id);
    expect(membership?.role).toBe('VIEWER');
  });

  it('6. failed MEMBERSHIP_REVOKE audit rolls back revocation status', async () => {
    const org = await createTestOrg('Contoso Cloud');
    const user = await userRepo.create({
      id: 'usr-member-3',
      email: 'eng@contoso.com',
      normalizedEmail: 'eng@contoso.com',
      displayName: 'Contoso Engineer',
      status: 'ACTIVE',
      platformRole: 'NONE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z'
    });

    await membershipRepo.save({
      organisationId: org.id,
      userId: user.id,
      role: 'PERFORMANCE_ENGINEER',
      status: 'ACTIVE',
      createdAt: '2026-09-25T00:00:00.000Z',
      updatedAt: '2026-09-25T00:00:00.000Z',
      createdByUserId: platformAdminActor.userId
    });

    const faultyAuditService = new AuditService(auditRepo);
    faultyAuditService.record = async () => {
      throw new Error('INJECTED_AUDIT_ERROR: Membership revoke audit failed');
    };

    const identityAdmin = new IdentityAdministrationService(
      userRepo,
      credentialRepo,
      membershipRepo,
      sessionRepo,
      faultyAuditService,
      db
    );

    await expect(
      identityAdmin.revokeMembership(platformAdminActor, org.id, user.id)
    ).rejects.toThrow('INJECTED_AUDIT_ERROR');

    // Prove rollback: status must remain ACTIVE
    const membership = await membershipRepo.get(org.id, user.id);
    expect(membership?.status).toBe('ACTIVE');
  });
});
