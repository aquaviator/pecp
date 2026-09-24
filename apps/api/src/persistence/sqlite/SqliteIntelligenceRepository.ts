// SqliteIntelligenceRepository
// Defined according to M5.0 Work Package §7 (Persistent Intelligence Read Model)

import { IntelligenceItem } from '@pecp/pe-domain';
import { IIntelligenceRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase';

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
}
