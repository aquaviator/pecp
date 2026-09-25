// M5.1 Authentication API & Cookie / CSRF Tests
// Defined according to M5.1 Work Package §8, §9 & §11

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApiApp } from '../src/app.js';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase.js';
import { createTestUser } from './test-auth-helper.js';

describe('M5.1 Authentication API & CSRF Enforcement', () => {
  let tempDir: string;
  let db: SqliteDatabase;
  let app: FastifyInstance;
  const testEmail = 'lead.architect@retailco.com';
  const testPassword = 'SecureEngineeringPassword123!';

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-auth-api-test-'));
    const dbPath = path.join(tempDir, 'pecp-auth.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    await createTestUser(db, {
      email: testEmail,
      displayName: 'Lead Architect',
      password: testPassword
    });

    app = buildApiApp({ database: db, secureCookies: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. POST /api/v1/auth/login sets cookies and returns safe user and principal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: testPassword
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.displayName).toBe('Lead Architect');
    expect(body.principal).toBeDefined();
    expect(body.csrfToken).toBeDefined();

    // Verify session and csrf cookies
    const cookies = res.cookies;
    const sessionCookie = cookies.find((c) => c.name === 'pecp_session');
    const csrfCookie = cookies.find((c) => c.name === 'pecp_csrf');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.httpOnly).toBe(true);
    expect(sessionCookie!.path).toBe('/');
    expect(sessionCookie!.sameSite).toBe('Lax');

    expect(csrfCookie).toBeDefined();
    expect(csrfCookie!.path).toBe('/');
    expect(csrfCookie!.value).toBe(body.csrfToken);
  });

  it('2. POST /api/v1/auth/login returns generic 401 without account enumeration', async () => {
    // Unknown email
    const unknownRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'unknown@retailco.com',
        password: testPassword
      }
    });
    expect(unknownRes.statusCode).toBe(401);
    expect(unknownRes.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownRes.json().error.message).toBe('Invalid email or password');

    // Wrong password
    const wrongPassRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: testEmail,
        password: 'WrongPassword123!'
      }
    });
    expect(wrongPassRes.statusCode).toBe(401);
    expect(wrongPassRes.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassRes.json().error.message).toBe('Invalid email or password');
  });

  it('3. POST /api/v1/auth/login rejects disabled users with generic 401', async () => {
    await createTestUser(db, {
      email: 'disabled@retailco.com',
      displayName: 'Disabled User',
      password: testPassword,
      status: 'DISABLED'
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'disabled@retailco.com',
        password: testPassword
      }
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('4. GET /api/v1/auth/me returns authenticated principal and permissions', async () => {
    // Login first
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword }
    });
    const sessionCookie = loginRes.cookies.find((c) => c.name === 'pecp_session')!.value;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { pecp_session: sessionCookie }
    });

    expect(meRes.statusCode).toBe(200);
    const body = meRes.json();
    expect(body.user.email).toBe(testEmail);
    expect(body.principal.email).toBe(testEmail);
    expect(Array.isArray(body.permissions)).toBe(true);
  });

  it('5. POST /api/v1/auth/logout revokes session and clears cookies', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword }
    });
    const sessionCookie = loginRes.cookies.find((c) => c.name === 'pecp_session')!.value;
    const csrfCookie = loginRes.cookies.find((c) => c.name === 'pecp_csrf')!.value;

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { pecp_session: sessionCookie, pecp_csrf: csrfCookie },
      headers: { 'x-pecp-csrf': csrfCookie }
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().success).toBe(true);

    // After logout, me request must return 401
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { pecp_session: sessionCookie }
    });
    expect(meRes.statusCode).toBe(401);
  });

  it('6. CSRF validation: cookie-authenticated mutation without matching X-PECP-CSRF is rejected with 403', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword }
    });
    const sessionCookie = loginRes.cookies.find((c) => c.name === 'pecp_session')!.value;
    const csrfCookie = loginRes.cookies.find((c) => c.name === 'pecp_csrf')!.value;

    // Mutation with cookie but missing X-PECP-CSRF header
    const missingHeaderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { pecp_session: sessionCookie, pecp_csrf: csrfCookie }
    });
    expect(missingHeaderRes.statusCode).toBe(403);
    expect(missingHeaderRes.json().error.code).toBe('CSRF_FORBIDDEN');

    // Mutation with cookie and mismatched X-PECP-CSRF header
    const mismatchedHeaderRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { pecp_session: sessionCookie, pecp_csrf: csrfCookie },
      headers: { 'x-pecp-csrf': 'forged-token-value' }
    });
    expect(mismatchedHeaderRes.statusCode).toBe(403);
    expect(mismatchedHeaderRes.json().error.code).toBe('CSRF_FORBIDDEN');
  });

  it('7. POST /api/v1/auth/change-password validates current password and revokes previous sessions', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword }
    });
    const sessionCookie = loginRes.cookies.find((c) => c.name === 'pecp_session')!.value;
    const csrfCookie = loginRes.cookies.find((c) => c.name === 'pecp_csrf')!.value;

    const newPassword = 'NewVerySecurePassword123!';

    // Change password
    const changeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      cookies: { pecp_session: sessionCookie, pecp_csrf: csrfCookie },
      headers: { 'x-pecp-csrf': csrfCookie },
      payload: {
        currentPassword: testPassword,
        newPassword
      }
    });
    expect(changeRes.statusCode).toBe(200);

    // Old session must now be revoked
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { pecp_session: sessionCookie }
    });
    expect(meRes.statusCode).toBe(401);

    // Login with new password must succeed
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: newPassword }
    });
    expect(newLoginRes.statusCode).toBe(200);
  });
});
