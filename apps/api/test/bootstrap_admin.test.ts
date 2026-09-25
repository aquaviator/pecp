// M5.1 Bootstrap Admin CLI Tests
// Defined according to M5.1 Work Package §10 & §23

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { bootstrapAdmin, parseArgs } from '../src/cli/bootstrap-admin.js';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';

describe('M5.1 Bootstrap First Administrator', () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-bootstrap-test-'));
    dbPath = path.join(tempDir, 'pecp-bootstrap.db');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. parseArgs extracts --email and --name correctly', () => {
    const args = parseArgs(['--email', 'admin@retailco.com', '--name', 'Alice Admin']);
    expect(args.email).toBe('admin@retailco.com');
    expect(args.name).toBe('Alice Admin');
  });

  it('2. Successfully bootstraps the first PLATFORM_ADMIN', async () => {
    const adminPassword = 'BootstrapPassword123!';
    const result = await bootstrapAdmin({
      dbPath,
      email: 'admin@pecp.io',
      name: 'Initial Platform Admin',
      password: adminPassword
    });

    expect(result.userId).toBeDefined();
    expect(typeof result.userId).toBe('string');
    expect(result.email).toBe('admin@pecp.io');
    expect(result.displayName).toBe('Initial Platform Admin');

    // Verify user can now log in via API
    const db = new SqliteDatabase(dbPath);
    db.open();
    const app = buildApiApp({ database: db });
    await app.ready();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'admin@pecp.io',
        password: adminPassword
      }
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.user.platformRole).toBe('PLATFORM_ADMIN');
    expect(body.principal.platformRole).toBe('PLATFORM_ADMIN');

    await app.close();
  });

  it('3. Fails when an active PLATFORM_ADMIN already exists', async () => {
    const adminPassword = 'BootstrapPassword123!';
    await bootstrapAdmin({
      dbPath,
      email: 'admin@pecp.io',
      name: 'Initial Platform Admin',
      password: adminPassword
    });

    // Attempt second bootstrap
    await expect(
      bootstrapAdmin({
        dbPath,
        email: 'second-admin@pecp.io',
        name: 'Second Admin',
        password: 'AnotherPassword123!'
      })
    ).rejects.toThrow(/Platform administrator already exists/);
  });

  it('4. Enforces password policy on bootstrap password', async () => {
    await expect(
      bootstrapAdmin({
        dbPath,
        email: 'admin@pecp.io',
        name: 'Initial Platform Admin',
        password: 'short'
      })
    ).rejects.toThrow(/at least 12 characters/);
  });
});
