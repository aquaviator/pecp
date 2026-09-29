// SqliteChecklistRepository
// Defined according to M5.2 Work Package §8 [I06]

import { ProjectChecklist } from '@pecp/pe-domain';
import { IChecklistRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface ChecklistRow {
  project_id: string;
  organisation_id: string;
  revision: number;
  updated_at: string;
  updated_by_user_id: string;
  items_json: string;
}

export class SqliteChecklistRepository implements IChecklistRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async getChecklist(projectId: string): Promise<ProjectChecklist | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM project_checklists
      WHERE project_id = ?
    `).get(projectId) as unknown as ChecklistRow | undefined;

    if (!row) return null;

    return {
      projectId: row.project_id,
      organisationId: row.organisation_id,
      revision: row.revision,
      updatedAt: row.updated_at,
      updatedByUserId: row.updated_by_user_id,
      items: JSON.parse(row.items_json)
    };
  }

  async saveChecklist(checklist: ProjectChecklist): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO project_checklists (
        project_id, organisation_id, revision, updated_at, updated_by_user_id, items_json
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        revision = excluded.revision,
        updated_at = excluded.updated_at,
        updated_by_user_id = excluded.updated_by_user_id,
        items_json = excluded.items_json
    `).run(
      checklist.projectId,
      checklist.organisationId,
      checklist.revision,
      checklist.updatedAt,
      checklist.updatedByUserId,
      JSON.stringify(checklist.items)
    );
  }
}
