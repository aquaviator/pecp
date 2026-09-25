// PasswordHasher - Standard Node crypto.scrypt password verification
// Defined according to M5.1 Work Package §5

import * as crypto from 'node:crypto';

export interface HashResult {
  algorithm: string;
  salt: string;
  passwordHash: string;
  paramsJson: string;
}

export class PasswordHasher {
  private static readonly ALGORITHM = 'scrypt-v1';
  private static readonly KEY_LENGTH = 64;
  private static readonly SALT_LENGTH = 16;
  public static readonly MIN_LENGTH = 12;
  public static readonly MAX_LENGTH = 128;

  static validatePassword(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    if (password.length < PasswordHasher.MIN_LENGTH) {
      throw new Error(`Password must be at least ${PasswordHasher.MIN_LENGTH} characters long`);
    }
    if (password.length > PasswordHasher.MAX_LENGTH) {
      throw new Error(`Password must not exceed ${PasswordHasher.MAX_LENGTH} characters`);
    }
  }

  static async hash(password: string): Promise<HashResult> {
    PasswordHasher.validatePassword(password);
    const salt = crypto.randomBytes(PasswordHasher.SALT_LENGTH).toString('hex');
    const params = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, PasswordHasher.KEY_LENGTH, params, (err, key) => {
        if (err) reject(err);
        else resolve(key as Buffer);
      });
    });

    return {
      algorithm: PasswordHasher.ALGORITHM,
      salt,
      passwordHash: derivedKey.toString('hex'),
      paramsJson: JSON.stringify(params)
    };
  }

  static async verify(
    password: string,
    salt: string,
    storedHash: string,
    paramsJson?: string
  ): Promise<boolean> {
    try {
      const params = paramsJson
        ? JSON.parse(paramsJson)
        : { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
      const derivedKey = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(password, salt, PasswordHasher.KEY_LENGTH, params, (err, key) => {
          if (err) reject(err);
          else resolve(key as Buffer);
        });
      });
      const storedBuffer = Buffer.from(storedHash, 'hex');

      if (derivedKey.length !== storedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(derivedKey, storedBuffer);
    } catch {
      return false;
    }
  }
}
