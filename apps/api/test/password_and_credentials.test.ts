// M5.1 Password and Credential Security Tests
// Defined according to M5.1 Work Package §5 & §23

import { describe, it, expect } from 'vitest';
import { PasswordHasher } from '@pecp/platform-core';

describe('M5.1 Password and Credential Security', () => {
  it('hashes passwords using scrypt and never stores raw passwords', async () => {
    const rawPassword = 'CorrectHorseBatteryStaple123!';
    const result = await PasswordHasher.hash(rawPassword);

    expect(result.algorithm).toBe('scrypt-v1');
    expect(result.salt).toBeDefined();
    expect(result.salt.length).toBe(32); // 16 bytes hex = 32 chars
    expect(result.passwordHash).toBeDefined();
    expect(result.passwordHash).not.toBe(rawPassword);
    expect(result.passwordHash).not.toContain(rawPassword);
    expect(result.paramsJson).toContain('16384');
  });

  it('generates unique salts across multiple hashes of identical passwords', async () => {
    const rawPassword = 'IdenticalPassword123!';
    const hash1 = await PasswordHasher.hash(rawPassword);
    const hash2 = await PasswordHasher.hash(rawPassword);

    expect(hash1.salt).not.toBe(hash2.salt);
    expect(hash1.passwordHash).not.toBe(hash2.passwordHash);
  });

  it('verifies passwords correctly with timing-safe comparison', async () => {
    const rawPassword = 'MySecretEngineeringPassphrase!';
    const hashResult = await PasswordHasher.hash(rawPassword);

    const valid = await PasswordHasher.verify(
      rawPassword,
      hashResult.salt,
      hashResult.passwordHash,
      hashResult.paramsJson
    );
    expect(valid).toBe(true);

    const wrong = await PasswordHasher.verify(
      'WrongPassword123!',
      hashResult.salt,
      hashResult.passwordHash,
      hashResult.paramsJson
    );
    expect(wrong).toBe(false);
  });

  it('enforces password policy: minimum 12 characters and maximum 128 characters', async () => {
    // Under 12 characters rejected
    expect(() => PasswordHasher.validatePassword('Short1!')).toThrow(/at least 12 characters/);
    expect(() => PasswordHasher.validatePassword('12345678901')).toThrow(/at least 12 characters/);

    // Exactly 12 characters accepted
    expect(() => PasswordHasher.validatePassword('123456789012')).not.toThrow();

    // 128 characters accepted
    const long128 = 'a'.repeat(128);
    expect(() => PasswordHasher.validatePassword(long128)).not.toThrow();

    // Over 128 characters rejected
    const long129 = 'a'.repeat(129);
    expect(() => PasswordHasher.validatePassword(long129)).toThrow(/must not exceed 128 characters/);

    // Empty or non-string rejected
    expect(() => PasswordHasher.validatePassword('')).toThrow();
  });
});
