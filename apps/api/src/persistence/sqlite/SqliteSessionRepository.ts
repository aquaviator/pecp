// SqliteSessionRepository
// Defined according to M5.1 Work Package §8 & §12

import { Session, ISessionRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  authenticated_at: string;
}

export class SqliteSessionRepository implements ISessionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: SessionRow): Session {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at ?? undefined,
      authenticatedAt: row.authenticated_at
    };
  }

  async getById(id: string): Promise<Session | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT id, user_id, token_hash, created_at, expires_at, revoked_at, authenticated_at
      FROM sessions WHERE id = ?
    `).get(id) as unknown as SessionRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT id, user_id, token_hash, created_at, expires_at, revoked_at, authenticated_at
      FROM sessions WHERE token_hash = ?
    `).get(tokenHash) as unknown as SessionRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async save(session: Session): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at, authenticated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        revoked_at = excluded.revoked_at,
        expires_at = excluded.expires_at
    `).run(
      session.id,
      session.userId,
      session.tokenHash,
      session.createdAt,
      session.expiresAt,
      session.revokedAt ?? null,
      session.authenticatedAt
    );
  }

  async revoke(id: string, revokedAt: string): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      UPDATE sessions
      SET revoked_at = ?
      WHERE id = ? AND revoked_at IS NULL
    `).run(revokedAt, id);
  }

  async revokeAllForUser(userId: string, revokedAt: string): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      UPDATE sessions
      SET revoked_at = ?
      WHERE user_id = ? AND revoked_at IS NULL
    `).run(revokedAt, userId);
  }
}
