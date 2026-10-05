// SqliteContractRevisionRepository
// Persistent review revisions repository for Performance Contract
// Defined according to BUILD-CONTRACT-ARTEFACT-APPROVALS

import {
  IContractRevisionRepository,
  ContractRevisionRecord
} from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface ContractRevisionRow {
  id: string;
  project_id: string;
  organisation_id: string;
  revision_number: number;
  status: string;
  contract_id: string;
  version: string;
  fingerprint: string;
  input_revision_digest: string;
  content_json: string;
  provenance_json: string;
  recorded_at: string;
  actor_user_id: string;
  actor_display_name: string;
}

export class SqliteContractRevisionRepository implements IContractRevisionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: ContractRevisionRow): ContractRevisionRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      organisationId: row.organisation_id,
      revisionNumber: row.revision_number,
      status: row.status as any,
      contractId: row.contract_id,
      version: row.version,
      fingerprint: row.fingerprint,
      inputRevisionDigest: row.input_revision_digest,
      contentJson: row.content_json,
      provenanceJson: row.provenance_json,
      recordedAt: row.recorded_at,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name
    };
  }

  async createRevision(record: ContractRevisionRecord): Promise<void> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      INSERT INTO project_contract_revisions (
        id, project_id, organisation_id, revision_number, status,
        contract_id, version, fingerprint, input_revision_digest,
        content_json, provenance_json, recorded_at,
        actor_user_id, actor_display_name
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    stmt.run(
      record.id,
      record.projectId,
      record.organisationId,
      record.revisionNumber,
      record.status,
      record.contractId,
      record.version,
      record.fingerprint,
      record.inputRevisionDigest,
      record.contentJson,
      record.provenanceJson,
      record.recordedAt,
      record.actorUserId,
      record.actorDisplayName
    );
  }

  async getByRevisionNumber(
    projectId: string,
    revisionNumber: number
  ): Promise<ContractRevisionRecord | null> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      SELECT * FROM project_contract_revisions
      WHERE project_id = ? AND revision_number = ?
    `);

    const row = stmt.get(projectId, revisionNumber) as ContractRevisionRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async getLatestRevision(projectId: string): Promise<ContractRevisionRecord | null> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      SELECT * FROM project_contract_revisions
      WHERE project_id = ?
      ORDER BY revision_number DESC
      LIMIT 1
    `);

    const row = stmt.get(projectId) as ContractRevisionRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async listRevisions(projectId: string): Promise<ContractRevisionRecord[]> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      SELECT * FROM project_contract_revisions
      WHERE project_id = ?
      ORDER BY revision_number DESC
    `);

    const rows = stmt.all(projectId) as unknown as ContractRevisionRow[];
    return rows.map((r) => this.mapRow(r));
  }
}
