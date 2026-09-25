// SqliteLocalCredentialRepository
// Defined according to M5.1 Work Package §8 & §12

import { LocalCredential, ILocalCredentialRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface CredentialRow {
  user_id: string;
  algorithm: string;
  salt: string;
  password_hash: string;
  params_json: string;
  updated_at: string;
}

export class SqliteLocalCredentialRepository implements ILocalCredentialRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: CredentialRow): LocalCredential {
    return {
      userId: row.user_id,
      algorithm: row.algorithm,
      salt: row.salt,
      passwordHash: row.password_hash,
      paramsJson: row.params_json,
      updatedAt: row.updated_at
    };
  }

  async getByUserId(userId: string): Promise<LocalCredential | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT user_id, algorithm, salt, password_hash, params_json, updated_at
      FROM local_credentials WHERE user_id = ?
    `).get(userId) as unknown as CredentialRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async save(credential: LocalCredential): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO local_credentials (user_id, algorithm, salt, password_hash, params_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        algorithm = excluded.algorithm,
        salt = excluded.salt,
        password_hash = excluded.password_hash,
        params_json = excluded.params_json,
        updated_at = excluded.updated_at
    `).run(
      credential.userId,
      credential.algorithm,
      credential.salt,
      credential.passwordHash,
      credential.paramsJson,
      credential.updatedAt
    );
  }

  async deleteByUserId(userId: string): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`DELETE FROM local_credentials WHERE user_id = ?`).run(userId);
  }
}
