// SqliteEntityRevisionRepository
// Defined according to M5.0 Work Package §3

import { IEntityRevisionRepository, EntityRevision } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase';

interface RevisionRow {
  id: number;
  entity_type: string;
  entity_id: string;
  revision_number: number;
  payload_json: string;
  recorded_at: string;
  actor_ref: string | null;
}

export class SqliteEntityRevisionRepository implements IEntityRevisionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: RevisionRow): EntityRevision {
    return {
      id: String(row.id),
      entityType: row.entity_type as 'ORGANISATION' | 'PROJECT',
      entityId: row.entity_id,
      revisionNumber: row.revision_number,
      payloadJson: row.payload_json,
      recordedAt: row.recorded_at,
      actorRef: row.actor_ref
    };
  }

  async recordRevision(revision: EntityRevision): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO entity_revisions (
        entity_type, entity_id, revision_number, payload_json, recorded_at, actor_ref
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      revision.entityType,
      revision.entityId,
      revision.revisionNumber,
      revision.payloadJson,
      revision.recordedAt,
      revision.actorRef ?? null
    );
  }

  async listByEntity(entityType: string, entityId: string): Promise<EntityRevision[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT id, entity_type, entity_id, revision_number, payload_json, recorded_at, actor_ref
      FROM entity_revisions
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY revision_number ASC
    `).all(entityType, entityId) as unknown as RevisionRow[];

    return rows.map((r) => this.mapRow(r));
  }

  async getLatestRevisionNumber(entityType: string, entityId: string): Promise<number> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT MAX(revision_number) as max_rev
      FROM entity_revisions
      WHERE entity_type = ? AND entity_id = ?
    `).get(entityType, entityId) as { max_rev: number | null } | undefined;

    return row?.max_rev ?? 0;
  }
}
