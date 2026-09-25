// SqliteOrganisationMembershipRepository
// Defined according to M5.1 Work Package §8 & §12

import {
  OrganisationMembership,
  IOrganisationMembershipRepository,
  OrganisationRole,
  OrganisationMembershipStatus
} from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface MembershipRow {
  organisation_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
}

export class SqliteOrganisationMembershipRepository implements IOrganisationMembershipRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: MembershipRow): OrganisationMembership {
    return {
      organisationId: row.organisation_id,
      userId: row.user_id,
      role: row.role as OrganisationRole,
      status: row.status as OrganisationMembershipStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id
    };
  }

  async get(organisationId: string, userId: string): Promise<OrganisationMembership | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT organisation_id, user_id, role, status, created_at, updated_at, created_by_user_id
      FROM organisation_memberships
      WHERE organisation_id = ? AND user_id = ?
    `).get(organisationId, userId) as unknown as MembershipRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async listByOrganisation(organisationId: string): Promise<OrganisationMembership[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT organisation_id, user_id, role, status, created_at, updated_at, created_by_user_id
      FROM organisation_memberships
      WHERE organisation_id = ?
      ORDER BY created_at ASC
    `).all(organisationId) as unknown as MembershipRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async listByUser(userId: string): Promise<OrganisationMembership[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT organisation_id, user_id, role, status, created_at, updated_at, created_by_user_id
      FROM organisation_memberships
      WHERE user_id = ?
      ORDER BY created_at ASC
    `).all(userId) as unknown as MembershipRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async save(membership: OrganisationMembership): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO organisation_memberships (
        organisation_id, user_id, role, status, created_at, updated_at, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(organisation_id, user_id) DO UPDATE SET
        role = excluded.role,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      membership.organisationId,
      membership.userId,
      membership.role,
      membership.status,
      membership.createdAt,
      membership.updatedAt,
      membership.createdByUserId
    );
  }

  async countActiveAdmins(organisationId: string): Promise<number> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT COUNT(*) as count
      FROM organisation_memberships
      WHERE organisation_id = ? AND role = 'ORG_ADMIN' AND status = 'ACTIVE'
    `).get(organisationId) as { count: number };
    return row ? Number(row.count) : 0;
  }
}
