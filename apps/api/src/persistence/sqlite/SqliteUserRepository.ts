// SqliteUserRepository
// Defined according to M5.1 Work Package §8 & §12

import { User, IUserRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface UserRow {
  id: string;
  email: string;
  normalized_email: string;
  display_name: string;
  status: string;
  platform_role: string;
  created_at: string;
  updated_at: string;
}

export class SqliteUserRepository implements IUserRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      normalizedEmail: row.normalized_email,
      displayName: row.display_name,
      status: row.status as any,
      platformRole: row.platform_role as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getById(id: string): Promise<User | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT id, email, normalized_email, display_name, status, platform_role, created_at, updated_at
      FROM users WHERE id = ?
    `).get(id) as unknown as UserRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const raw = this.db.getRawDatabase();
    const normalized = email.trim().toLowerCase();
    const row = raw.prepare(`
      SELECT id, email, normalized_email, display_name, status, platform_role, created_at, updated_at
      FROM users WHERE normalized_email = ?
    `).get(normalized) as unknown as UserRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async create(user: User): Promise<User> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO users (id, email, normalized_email, display_name, status, platform_role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email,
      user.normalizedEmail,
      user.displayName,
      user.status,
      user.platformRole,
      user.createdAt,
      user.updatedAt
    );
    return { ...user };
  }

  async update(user: User): Promise<User> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      UPDATE users
      SET email = ?, normalized_email = ?, display_name = ?, status = ?, platform_role = ?, updated_at = ?
      WHERE id = ?
    `).run(
      user.email,
      user.normalizedEmail,
      user.displayName,
      user.status,
      user.platformRole,
      user.updatedAt,
      user.id
    );
    return { ...user };
  }

  async list(): Promise<User[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT id, email, normalized_email, display_name, status, platform_role, created_at, updated_at
      FROM users ORDER BY created_at ASC
    `).all() as unknown as UserRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async countActivePlatformAdmins(): Promise<number> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE platform_role = 'PLATFORM_ADMIN' AND status = 'ACTIVE'
    `).get() as { count: number };
    return row ? Number(row.count) : 0;
  }
}
