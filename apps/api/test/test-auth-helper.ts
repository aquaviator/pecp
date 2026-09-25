// Test Authentication Helper
// For testing protected M5.1 endpoints and M5.0 regression suites

import { FastifyInstance } from 'fastify';
import * as crypto from 'node:crypto';
import {
  PasswordHasher,
  OrganisationRole,
  User,
  PlatformRole
} from '@pecp/platform-core';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { SqliteUserRepository } from '../src/persistence/sqlite/SqliteUserRepository.js';
import { SqliteLocalCredentialRepository } from '../src/persistence/sqlite/SqliteLocalCredentialRepository.js';
import { SqliteOrganisationMembershipRepository } from '../src/persistence/sqlite/SqliteOrganisationMembershipRepository.js';
import { SqliteSessionRepository } from '../src/persistence/sqlite/SqliteSessionRepository.js';
import { SessionService } from '@pecp/platform-core';

export interface TestAuthContext {
  user: User;
  rawToken: string;
  authHeaders: { authorization: string };
  cookies: { pecp_session: string; pecp_csrf: string };
}

export async function createTestUser(
  db: SqliteDatabase,
  options: {
    email: string;
    displayName: string;
    password?: string;
    platformRole?: PlatformRole;
    status?: 'ACTIVE' | 'DISABLED';
    membership?: { organisationId: string; role: OrganisationRole };
  }
): Promise<{ user: User; rawToken: string; authHeaders: { authorization: string } }> {
  const userRepo = new SqliteUserRepository(db);
  const credRepo = new SqliteLocalCredentialRepository(db);
  const sessionRepo = new SqliteSessionRepository(db);
  const membershipRepo = new SqliteOrganisationMembershipRepository(db);

  const password = options.password ?? 'ValidTestPassword123!';
  const now = new Date().toISOString();
  const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;

  const user: User = {
    id: userId,
    email: options.email,
    normalizedEmail: options.email.trim().toLowerCase(),
    displayName: options.displayName,
    status: options.status ?? 'ACTIVE',
    platformRole: options.platformRole ?? 'NONE',
    createdAt: now,
    updatedAt: now
  };

  await userRepo.create(user);

  const hashResult = await PasswordHasher.hash(password);
  await credRepo.save({
    userId,
    algorithm: hashResult.algorithm,
    salt: hashResult.salt,
    passwordHash: hashResult.passwordHash,
    paramsJson: hashResult.paramsJson,
    updatedAt: now
  });

  if (options.membership) {
    await membershipRepo.save({
      organisationId: options.membership.organisationId,
      userId,
      role: options.membership.role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdByUserId: userId
    });
  }

  const sessionService = new SessionService(sessionRepo, userRepo, 12);
  const session = await sessionService.createSession(userId);

  return {
    user,
    rawToken: session.rawToken,
    authHeaders: {
      authorization: `Bearer ${session.rawToken}`
    }
  };
}

export async function createPlatformAdmin(
  db: SqliteDatabase,
  email = 'admin@pecp.io',
  displayName = 'Platform Administrator',
  password = 'AdminSecurePassword123!'
): Promise<{ user: User; rawToken: string; authHeaders: { authorization: string } }> {
  return createTestUser(db, {
    email,
    displayName,
    password,
    platformRole: 'PLATFORM_ADMIN'
  });
}
