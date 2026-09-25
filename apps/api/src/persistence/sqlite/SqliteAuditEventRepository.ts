// SqliteAuditEventRepository
// Defined according to M5.1 Work Package §7, §8 & §12 (Append-Only Audit Log)

import {
  AuditEvent,
  AuditQueryFilter,
  IAuditRepository,
  AuditAction,
  AuditOutcome
} from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface AuditRow {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  organisation_id: string | null;
  project_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  outcome: string;
  reason: string | null;
  metadata_json: string | null;
}

export class SqliteAuditEventRepository implements IAuditRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: AuditRow): AuditEvent {
    return {
      id: row.id,
      occurredAt: row.occurred_at,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name,
      organisationId: row.organisation_id,
      projectId: row.project_id,
      action: row.action as AuditAction,
      targetType: row.target_type,
      targetId: row.target_id,
      outcome: row.outcome as AuditOutcome,
      reason: row.reason,
      metadataJson: row.metadata_json
    };
  }

  async append(event: AuditEvent): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO audit_events (
        id, occurred_at, actor_user_id, actor_display_name, organisation_id, project_id,
        action, target_type, target_id, outcome, reason, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.occurredAt,
      event.actorUserId ?? null,
      event.actorDisplayName ?? null,
      event.organisationId ?? null,
      event.projectId ?? null,
      event.action,
      event.targetType,
      event.targetId ?? null,
      event.outcome,
      event.reason ?? null,
      event.metadataJson ?? null
    );
  }

  async query(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    const raw = this.db.getRawDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.organisationId) {
      conditions.push('organisation_id = ?');
      params.push(filter.organisationId);
    }

    if (filter.projectId) {
      conditions.push('project_id = ?');
      params.push(filter.projectId);
    }

    if (filter.actorUserId) {
      conditions.push('actor_user_id = ?');
      params.push(filter.actorUserId);
    }

    if (filter.action) {
      conditions.push('action = ?');
      params.push(filter.action);
    }

    if (filter.after) {
      conditions.push('occurred_at > ?');
      params.push(filter.after);
    }

    if (filter.before) {
      conditions.push('occurred_at < ?');
      params.push(filter.before);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 1000) : 100;
    params.push(limit);

    const queryStr = `
      SELECT id, occurred_at, actor_user_id, actor_display_name, organisation_id, project_id,
             action, target_type, target_id, outcome, reason, metadata_json
      FROM audit_events
      ${whereClause}
      ORDER BY occurred_at DESC
      LIMIT ?
    `;

    const rows = raw.prepare(queryStr).all(...params) as unknown as AuditRow[];
    return rows.map((r) => this.mapRow(r));
  }

  async listByOrganisation(organisationId: string): Promise<AuditEvent[]> {
    return this.query({ organisationId, limit: 1000 });
  }

  async listAll(): Promise<AuditEvent[]> {
    return this.query({ limit: 1000 });
  }
}
