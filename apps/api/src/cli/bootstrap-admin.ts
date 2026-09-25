// CLI: Bootstrap the initial platform administrator
// Defined according to M5.1 Work Package §10 & User Prompt §15

import * as crypto from 'node:crypto';
import { PasswordHasher } from '@pecp/platform-core';
import { SqliteDatabase } from '../persistence/sqlite/SqliteDatabase.js';
import { SqliteUserRepository } from '../persistence/sqlite/SqliteUserRepository.js';
import { SqliteLocalCredentialRepository } from '../persistence/sqlite/SqliteLocalCredentialRepository.js';
import { SqliteAuditEventRepository } from '../persistence/sqlite/SqliteAuditEventRepository.js';

interface CliArgs {
  email?: string;
  name?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[i + 1];
      i++;
    } else if (argv[i] === '--name' && argv[i + 1]) {
      args.name = argv[i + 1];
      i++;
    }
  }
  return args;
}

export async function bootstrapAdmin(options?: {
  dbPath?: string;
  email?: string;
  name?: string;
  password?: string;
}): Promise<{ userId: string; email: string; displayName: string }> {
  const email = options?.email;
  const name = options?.name;
  const password = options?.password ?? process.env.PECP_BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !email.includes('@')) {
    throw new Error('Valid --email argument is required');
  }

  if (!name || !name.trim()) {
    throw new Error('Valid --name argument is required');
  }

  if (!password) {
    throw new Error('Bootstrap password must be supplied via PECP_BOOTSTRAP_ADMIN_PASSWORD environment variable');
  }

  PasswordHasher.validatePassword(password);

  const dbPath = options?.dbPath || process.env.PECP_DB_PATH || 'pecp-platform.sqlite';
  const db = new SqliteDatabase(dbPath);
  db.open();

  try {
    const userRepo = new SqliteUserRepository(db);
    const credentialRepo = new SqliteLocalCredentialRepository(db);
    const auditRepo = new SqliteAuditEventRepository(db);

    const activeAdmins = await userRepo.countActivePlatformAdmins();
    if (activeAdmins > 0) {
      throw new Error('Platform administrator already exists. Bootstrap aborted.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await userRepo.getByEmail(normalizedEmail);
    if (existing) {
      throw new Error(`User with email '${email}' already exists`);
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();

    const user = {
      id: userId,
      email: email.trim(),
      normalizedEmail,
      displayName: name.trim(),
      status: 'ACTIVE' as const,
      platformRole: 'PLATFORM_ADMIN' as const,
      createdAt: now,
      updatedAt: now
    };

    await userRepo.create(user);

    const hashResult = await PasswordHasher.hash(password);
    await credentialRepo.save({
      userId,
      algorithm: hashResult.algorithm,
      salt: hashResult.salt,
      passwordHash: hashResult.passwordHash,
      paramsJson: hashResult.paramsJson,
      updatedAt: now
    });

    await auditRepo.append({
      id: crypto.randomUUID(),
      occurredAt: now,
      actorUserId: userId,
      actorDisplayName: user.displayName,
      action: 'USER_CREATE',
      targetType: 'USER',
      targetId: userId,
      outcome: 'SUCCESS',
      metadataJson: JSON.stringify({
        email: user.email,
        platformRole: user.platformRole,
        bootstrap: true
      })
    });

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName
    };
  } finally {
    db.close();
  }
}

// Execute when run directly as CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  bootstrapAdmin({
    email: args.email,
    name: args.name
  })
    .then((result) => {
      console.log(`Successfully bootstrapped platform administrator: ${result.email} (${result.displayName})`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`Bootstrap failed: ${err.message}`);
      process.exit(1);
    });
}
