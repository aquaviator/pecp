// SqliteOrganisationRepository
// Defined according to M5.0 Work Package §2 & §3

import {
  IOrganisationRepository,
  Organisation,
  OrganisationStatus
} from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase';

interface OrganisationRow {
  id: string;
  name: string;
  normalized_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class SqliteOrganisationRepository implements IOrganisationRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: OrganisationRow): Organisation {
    return {
      id: row.id,
      name: row.name,
      status: row.status as OrganisationStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async list(): Promise<Organisation[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(
      'SELECT id, name, normalized_name, status, created_at, updated_at FROM organisations ORDER BY name ASC'
    ).all() as unknown as OrganisationRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async getById(id: string): Promise<Organisation | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(
      'SELECT id, name, normalized_name, status, created_at, updated_at FROM organisations WHERE id = ?'
    ).get(id) as unknown as OrganisationRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getByName(name: string): Promise<Organisation | null> {
    const normalized = name.trim().toLowerCase();
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(
      'SELECT id, name, normalized_name, status, created_at, updated_at FROM organisations WHERE normalized_name = ?'
    ).get(normalized) as unknown as OrganisationRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async create(org: Organisation): Promise<Organisation> {
    const normalized = org.name.trim().toLowerCase();
    const raw = this.db.getRawDatabase();

    raw.prepare(
      `INSERT INTO organisations (id, name, normalized_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(org.id, org.name, normalized, org.status, org.createdAt, org.updatedAt);

    return { ...org };
  }

  async updateStatus(id: string, status: OrganisationStatus): Promise<Organisation | null> {
    const raw = this.db.getRawDatabase();
    const now = new Date().toISOString();
    const res = raw.prepare(
      'UPDATE organisations SET status = ?, updated_at = ? WHERE id = ?'
    ).run(status, now, id);

    if (res.changes === 0) {
      return null;
    }

    return this.getById(id);
  }
}
