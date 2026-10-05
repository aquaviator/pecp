// SqliteArtefactRepository
// Defined according to Real Strategy and Test Plan Workflow

import {
  IArtefactRepository,
  SavedArtefactRecord,
  SavedArtefactRevisionRecord
} from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface ArtefactRow {
  id: string;
  project_id: string;
  organisation_id: string;
  artefact_type: string;
  title: string;
  current_revision_number: number;
  current_revision_id: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  created_by_user_display_name: string;
}

interface ArtefactRevisionRow {
  id: string;
  artefact_id: string;
  project_id: string;
  organisation_id: string;
  artefact_type: string;
  revision_number: number;
  status: string;
  source_contract_id: string;
  source_contract_version: string;
  source_contract_fingerprint: string;
  source_contract_revision_number?: number | null;
  input_revision_digest: string;
  generation_metadata_json: string;
  content_json: string;
  markdown_export: string;
  recorded_at: string;
  actor_user_id: string;
  actor_display_name: string;
}

export class SqliteArtefactRepository implements IArtefactRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapArtefactRow(row: ArtefactRow): SavedArtefactRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      organisationId: row.organisation_id,
      artefactType: row.artefact_type as any,
      title: row.title,
      currentRevisionNumber: row.current_revision_number,
      currentRevisionId: row.current_revision_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdByUserId: row.created_by_user_id,
      createdByUserDisplayName: row.created_by_user_display_name
    };
  }

  private mapRevisionRow(row: ArtefactRevisionRow): SavedArtefactRevisionRecord {
    return {
      id: row.id,
      artefactId: row.artefact_id,
      projectId: row.project_id,
      organisationId: row.organisation_id,
      artefactType: row.artefact_type as any,
      revisionNumber: row.revision_number,
      status: row.status as any,
      sourceContractId: row.source_contract_id,
      sourceContractVersion: row.source_contract_version,
      sourceContractFingerprint: row.source_contract_fingerprint,
      sourceContractRevisionNumber:
        row.source_contract_revision_number !== null &&
        row.source_contract_revision_number !== undefined
          ? Number(row.source_contract_revision_number)
          : undefined,
      inputRevisionDigest: row.input_revision_digest,
      generationMetadataJson: row.generation_metadata_json,
      contentJson: row.content_json,
      markdownExport: row.markdown_export,
      recordedAt: row.recorded_at,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name
    };
  }

  async listByProject(projectId: string): Promise<SavedArtefactRecord[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw
      .prepare(`
        SELECT * FROM project_artefacts
        WHERE project_id = ?
        ORDER BY created_at ASC
      `)
      .all(projectId) as unknown as ArtefactRow[];

    return rows.map((r) => this.mapArtefactRow(r));
  }

  async getById(projectId: string, artefactId: string): Promise<SavedArtefactRecord | null> {
    const raw = this.db.getRawDatabase();
    const row = raw
      .prepare(`
        SELECT * FROM project_artefacts
        WHERE project_id = ? AND id = ?
      `)
      .get(projectId, artefactId) as unknown as ArtefactRow | undefined;

    return row ? this.mapArtefactRow(row) : null;
  }

  async getByType(projectId: string, artefactType: string): Promise<SavedArtefactRecord | null> {
    const raw = this.db.getRawDatabase();
    const row = raw
      .prepare(`
        SELECT * FROM project_artefacts
        WHERE project_id = ? AND artefact_type = ?
      `)
      .get(projectId, artefactType) as unknown as ArtefactRow | undefined;

    return row ? this.mapArtefactRow(row) : null;
  }

  async getRevision(
    projectId: string,
    artefactId: string,
    revisionNumber: number
  ): Promise<SavedArtefactRevisionRecord | null> {
    const raw = this.db.getRawDatabase();
    const row = raw
      .prepare(`
        SELECT * FROM project_artefact_revisions
        WHERE project_id = ? AND artefact_id = ? AND revision_number = ?
      `)
      .get(projectId, artefactId, revisionNumber) as unknown as ArtefactRevisionRow | undefined;

    return row ? this.mapRevisionRow(row) : null;
  }

  async listRevisions(projectId: string, artefactId: string): Promise<SavedArtefactRevisionRecord[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw
      .prepare(`
        SELECT * FROM project_artefact_revisions
        WHERE project_id = ? AND artefact_id = ?
        ORDER BY revision_number DESC
      `)
      .all(projectId, artefactId) as unknown as ArtefactRevisionRow[];

    return rows.map((r) => this.mapRevisionRow(r));
  }

  async saveArtefactWithRevision(
    artefact: SavedArtefactRecord,
    revision: SavedArtefactRevisionRecord
  ): Promise<void> {
    const raw = this.db.getRawDatabase();
    // Upsert artefact record
    raw
      .prepare(`
        INSERT INTO project_artefacts (
          id, project_id, organisation_id, artefact_type, title,
          current_revision_number, current_revision_id,
          created_at, updated_at, created_by_user_id, created_by_user_display_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, id) DO UPDATE SET
          title = excluded.title,
          current_revision_number = excluded.current_revision_number,
          current_revision_id = excluded.current_revision_id,
          updated_at = excluded.updated_at
      `)
      .run(
        artefact.id,
        artefact.projectId,
        artefact.organisationId,
        artefact.artefactType,
        artefact.title,
        artefact.currentRevisionNumber,
        artefact.currentRevisionId,
        artefact.createdAt,
        artefact.updatedAt,
        artefact.createdByUserId,
        artefact.createdByUserDisplayName
      );

    // Insert revision record
    raw
      .prepare(`
        INSERT INTO project_artefact_revisions (
          id, artefact_id, project_id, organisation_id, artefact_type,
          revision_number, status, source_contract_id, source_contract_version,
          source_contract_fingerprint, source_contract_revision_number, input_revision_digest,
          generation_metadata_json, content_json, markdown_export,
          recorded_at, actor_user_id, actor_display_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        revision.id,
        revision.artefactId,
        revision.projectId,
        revision.organisationId,
        revision.artefactType,
        revision.revisionNumber,
        revision.status,
        revision.sourceContractId,
        revision.sourceContractVersion,
        revision.sourceContractFingerprint,
        revision.sourceContractRevisionNumber ?? null,
        revision.inputRevisionDigest,
        revision.generationMetadataJson,
        revision.contentJson,
        revision.markdownExport,
        revision.recordedAt,
        revision.actorUserId,
        revision.actorDisplayName
      );
  }
}
