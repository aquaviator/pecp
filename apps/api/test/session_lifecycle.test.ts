// M5.1 Session Lifecycle Tests
// Defined according to M5.1 Work Package §8 & §23

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { SqliteUserRepository } from '../src/persistence/sqlite/SqliteUserRepository.js';
import { SqliteSessionRepository } from '../src/persistence/sqlite/SqliteSessionRepository.js';
import { SessionService } from '@pecp/platform-core';

describe('M5.1 Session Lifecycle & Token Security', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let userRepo: SqliteUserRepository;
  let sessionRepo: SqliteSessionRepository;
  let sessionService: SessionService;
  let testUserId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-session-test-'));
    const dbPath = path.join(tempDir, 'pecp-session.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    userRepo = new SqliteUserRepository(db);
    sessionRepo = new SqliteSessionRepository(db);
    sessionService = new SessionService(sessionRepo, userRepo, 12);

    testUserId = 'usr-test-123';
    const now = new Date().toISOString();
    await userRepo.create({
      id: testUserId,
      email: 'engineer@pecp.io',
      normalizedEmail: 'engineer@pecp.io',
      displayName: 'Test Engineer',
      status: 'ACTIVE',
      platformRole: 'NONE',
      createdAt: now,
      updatedAt: now
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates random opaque tokens and persists only SHA-256 token hashes', async () => {
    const { session, rawToken } = await sessionService.createSession(testUserId);

    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBe(64); // 32 bytes hex = 64 characters

    // Raw token must NOT be stored in the database
    const storedSession = await sessionRepo.getById(session.id);
    expect(storedSession).toBeDefined();
    expect(storedSession!.tokenHash).not.toBe(rawToken);

    // Stored hash must match SHA-256 of raw token
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    expect(storedSession!.tokenHash).toBe(expectedHash);
  });

  it('validates active non-expired sessions successfully', async () => {
    const { rawToken } = await sessionService.createSession(testUserId);
    const valid = await sessionService.validateSession(rawToken);

    expect(valid).not.toBeNull();
    expect(valid!.user.id).toBe(testUserId);
    expect(valid!.session.userId).toBe(testUserId);
  });

  it('rejects expired sessions', async () => {
    // Session service with 0 TTL or past expiry
    const shortLivedService = new SessionService(sessionRepo, userRepo, -1);
    const { rawToken } = await shortLivedService.createSession(testUserId);

    const valid = await sessionService.validateSession(rawToken);
    expect(valid).toBeNull();
  });

  it('revokes sessions explicitly and rejects revoked sessions', async () => {
    const { session, rawToken } = await sessionService.createSession(testUserId);

    // Initial check: valid
    expect(await sessionService.validateSession(rawToken)).not.toBeNull();

    // Revoke
    await sessionService.revokeSession(session.id);

    // Validate again: must be rejected
    expect(await sessionService.validateSession(rawToken)).toBeNull();
  });

  it('invalidates active sessions immediately when a user is disabled', async () => {
    const { rawToken } = await sessionService.createSession(testUserId);
    expect(await sessionService.validateSession(rawToken)).not.toBeNull();

    // Disable the user
    const user = await userRepo.getById(testUserId);
    user!.status = 'DISABLED';
    await userRepo.update(user!);

    // Validation must fail because user is disabled
    const valid = await sessionService.validateSession(rawToken);
    expect(valid).toBeNull();
  });

  it('revokes all existing sessions when revokeAllForUser is called', async () => {
    const s1 = await sessionService.createSession(testUserId);
    const s2 = await sessionService.createSession(testUserId);

    expect(await sessionService.validateSession(s1.rawToken)).not.toBeNull();
    expect(await sessionService.validateSession(s2.rawToken)).not.toBeNull();

    await sessionService.revokeAllForUser(testUserId);

    expect(await sessionService.validateSession(s1.rawToken)).toBeNull();
    expect(await sessionService.validateSession(s2.rawToken)).toBeNull();
  });
});
