// SqliteIntelligenceRepository
// Defined according to M5.0 Work Package §7 (Persistent Intelligence Read Model)

import { IntelligenceItem } from '@pecp/pe-domain';
import { IIntelligenceRepository, IntelligenceRevisionSnapshot } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface IntelligenceRow {
  id: string;
  project_id: string;
  payload_json: string;
}

export class SqliteIntelligenceRepository implements IIntelligenceRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async listByProject(projectId: string): Promise<IntelligenceItem[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT payload_json
      FROM project_intelligence_items
      WHERE project_id = ?
      ORDER BY item_key ASC
    `).all(projectId) as unknown as IntelligenceRow[];

    return rows.map((r) => JSON.parse(r.payload_json));
  }

  async getById(projectId: string, itemId: string): Promise<IntelligenceItem | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT payload_json
      FROM project_intelligence_items
      WHERE project_id = ? AND id = ?
    `).get(projectId, itemId) as unknown as IntelligenceRow | undefined;

    return row ? JSON.parse(row.payload_json) : null;
  }

  async saveItems(projectId: string, items: IntelligenceItem[]): Promise<void> {
    const raw = this.db.getRawDatabase();
    const now = new Date().toISOString();

    this.db.transaction(() => {
      const stmt = raw.prepare(`
        INSERT INTO project_intelligence_items (
          id, project_id, item_key, title, category, canonical_state, review_status,
          unit, value_text, value_number, source, source_document, source_location,
          captured_date, approval_state, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, id) DO UPDATE SET
          item_key = excluded.item_key,
          title = excluded.title,
          category = excluded.category,
          canonical_state = excluded.canonical_state,
          review_status = excluded.review_status,
          unit = excluded.unit,
          value_text = excluded.value_text,
          value_number = excluded.value_number,
          source = excluded.source,
          source_document = excluded.source_document,
          source_location = excluded.source_location,
          captured_date = excluded.captured_date,
          approval_state = excluded.approval_state,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `);

      for (const item of items) {
        const valText = typeof item.value === 'string' ? item.value : null;
        const valNum = typeof item.value === 'number' ? item.value : null;

        stmt.run(
          item.id,
          projectId,
          item.key,
          item.title,
          item.category,
          item.canonicalState,
          item.reviewStatus,
          item.unit ?? null,
          valText,
          valNum,
          item.source ?? null,
          item.sourceDocument ?? null,
          item.sourceLocation ?? null,
          item.capturedDate ?? null,
          item.approvalState ?? null,
          JSON.stringify(item),
          now,
          now
        );
      }
    });
  }

  async saveRevisionSnapshot(snapshot: IntelligenceRevisionSnapshot): Promise<void> {
    const raw = this.db.getRawDatabase();
    const stmt = raw.prepare(`
      INSERT INTO intelligence_revisions (
        id, item_id, project_id, organisation_id, revision_number,
        recorded_at, actor_user_id, actor_display_name, canonical_state,
        review_status, value_text, value_number, unit, approval_state,
        approved_by_user_id, source_bindings_json, candidates_json, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, item_id, revision_number) DO UPDATE SET
        recorded_at = excluded.recorded_at,
        actor_user_id = excluded.actor_user_id,
        actor_display_name = excluded.actor_display_name,
        canonical_state = excluded.canonical_state,
        review_status = excluded.review_status,
        value_text = excluded.value_text,
        value_number = excluded.value_number,
        unit = excluded.unit,
        approval_state = excluded.approval_state,
        approved_by_user_id = excluded.approved_by_user_id,
        source_bindings_json = excluded.source_bindings_json,
        candidates_json = excluded.candidates_json,
        snapshot_json = excluded.snapshot_json
    `);

    stmt.run(
      snapshot.id,
      snapshot.itemId,
      snapshot.projectId,
      snapshot.organisationId,
      snapshot.revisionNumber,
      snapshot.recordedAt,
      snapshot.actorUserId ?? null,
      snapshot.actorDisplayName ?? null,
      snapshot.canonicalState,
      snapshot.reviewStatus,
      snapshot.valueText ?? null,
      snapshot.valueNumber ?? null,
      snapshot.unit ?? null,
      snapshot.approvalState,
      snapshot.approvedByUserId ?? null,
      snapshot.sourceBindingsJson,
      snapshot.candidatesJson ?? null,
      snapshot.snapshotJson
    );
  }

  async listRevisionSnapshots(projectId: string, itemId: string): Promise<IntelligenceRevisionSnapshot[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT id, item_id, project_id, organisation_id, revision_number,
             recorded_at, actor_user_id, actor_display_name, canonical_state,
             review_status, value_text, value_number, unit, approval_state,
             approved_by_user_id, source_bindings_json, candidates_json, snapshot_json
      FROM intelligence_revisions
      WHERE project_id = ? AND item_id = ?
      ORDER BY revision_number ASC
    `).all(projectId, itemId) as any[];

    return rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      projectId: r.project_id,
      organisationId: r.organisation_id,
      revisionNumber: r.revision_number,
      recordedAt: r.recorded_at,
      actorUserId: r.actor_user_id,
      actorDisplayName: r.actor_display_name,
      canonicalState: r.canonical_state,
      reviewStatus: r.review_status,
      valueText: r.value_text,
      valueNumber: r.value_number,
      unit: r.unit,
      approvalState: r.approval_state,
      approvedByUserId: r.approved_by_user_id,
      sourceBindingsJson: r.source_bindings_json,
      candidatesJson: r.candidates_json,
      snapshotJson: r.snapshot_json
    }));
  }

  async getRevisionSnapshot(
    projectId: string,
    itemId: string,
    revisionNumber: number
  ): Promise<IntelligenceRevisionSnapshot | null> {
    const raw = this.db.getRawDatabase();
    const r = raw.prepare(`
      SELECT id, item_id, project_id, organisation_id, revision_number,
             recorded_at, actor_user_id, actor_display_name, canonical_state,
             review_status, value_text, value_number, unit, approval_state,
             approved_by_user_id, source_bindings_json, candidates_json, snapshot_json
      FROM intelligence_revisions
      WHERE project_id = ? AND item_id = ? AND revision_number = ?
    `).get(projectId, itemId, revisionNumber) as any;

    if (!r) return null;
    return {
      id: r.id,
      itemId: r.item_id,
      projectId: r.project_id,
      organisationId: r.organisation_id,
      revisionNumber: r.revision_number,
      recordedAt: r.recorded_at,
      actorUserId: r.actor_user_id,
      actorDisplayName: r.actor_display_name,
      canonicalState: r.canonical_state,
      reviewStatus: r.review_status,
      valueText: r.value_text,
      valueNumber: r.value_number,
      unit: r.unit,
      approvalState: r.approval_state,
      approvedByUserId: r.approved_by_user_id,
      sourceBindingsJson: r.source_bindings_json,
      candidatesJson: r.candidates_json,
      snapshotJson: r.snapshot_json
    };
  }
}

