// SqliteGovernanceDecisionRepository
// Persistent governance decisions repository (approvals and withdrawals)
// Defined according to BUILD-CONTRACT-ARTEFACT-APPROVALS

import {
  IGovernanceDecisionRepository
} from '@pecp/platform-core';
import {
  GovernanceTargetType,
  GovernanceDecisionRecord
} from '@pecp/pe-domain';
import { SqliteDatabase } from './SqliteDatabase.js';

interface GovernanceDecisionRow {
  id: string;
  project_id: string;
  organisation_id: string;
  target_type: string;
  target_id: string;
  target_revision_number: number;
  decision_type: string;
  rationale: string;
  actor_user_id: string;
  actor_display_name: string;
  target_content_fingerprint: string;
  target_input_digest: string;
  decided_at: string;
  decision_revision: number;
}

export class SqliteGovernanceDecisionRepository implements IGovernanceDecisionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: GovernanceDecisionRow): GovernanceDecisionRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      organisationId: row.organisation_id,
      targetType: row.target_type as GovernanceTargetType,
      targetId: row.target_id,
      targetRevisionNumber: row.target_revision_number,
      decisionType: row.decision_type as any,
      rationale: row.rationale,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name,
      targetContentFingerprint: row.target_content_fingerprint,
      targetInputDigest: row.target_input_digest,
      decidedAt: row.decided_at,
      decisionRevision: row.decision_revision
    };
  }

  async recordDecision(record: GovernanceDecisionRecord): Promise<void> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      INSERT INTO governance_decisions (
        id, project_id, organisation_id, target_type, target_id,
        target_revision_number, decision_type, rationale, actor_user_id,
        actor_display_name, target_content_fingerprint, target_input_digest,
        decided_at, decision_revision
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
      record.targetType,
      record.targetId,
      record.targetRevisionNumber,
      record.decisionType,
      record.rationale,
      record.actorUserId,
      record.actorDisplayName,
      record.targetContentFingerprint,
      record.targetInputDigest,
      record.decidedAt,
      record.decisionRevision
    );
  }

  async listDecisionsForTarget(
    projectId: string,
    targetType: GovernanceTargetType,
    targetId: string,
    targetRevisionNumber: number
  ): Promise<GovernanceDecisionRecord[]> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      SELECT * FROM governance_decisions
      WHERE project_id = ? AND target_type = ? AND target_id = ? AND target_revision_number = ?
      ORDER BY decision_revision ASC, decided_at ASC
    `);

    const rows = stmt.all(
      projectId,
      targetType,
      targetId,
      targetRevisionNumber
    ) as unknown as GovernanceDecisionRow[];

    return rows.map((r) => this.mapRow(r));
  }

  async getLatestDecisionForTarget(
    projectId: string,
    targetType: GovernanceTargetType,
    targetId: string,
    targetRevisionNumber: number
  ): Promise<GovernanceDecisionRecord | null> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      SELECT * FROM governance_decisions
      WHERE project_id = ? AND target_type = ? AND target_id = ? AND target_revision_number = ?
      ORDER BY decision_revision DESC, decided_at DESC
      LIMIT 1
    `);

    const row = stmt.get(
      projectId,
      targetType,
      targetId,
      targetRevisionNumber
    ) as GovernanceDecisionRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async listDecisionsForProject(projectId: string): Promise<GovernanceDecisionRecord[]> {
    const rawDb = this.db.getRawDb();
    const stmt = rawDb.prepare(`
      SELECT * FROM governance_decisions
      WHERE project_id = ?
      ORDER BY decided_at DESC
    `);

    const rows = stmt.all(projectId) as unknown as GovernanceDecisionRow[];
    return rows.map((r) => this.mapRow(r));
  }
}
