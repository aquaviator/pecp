// SqliteIdempotencyRepository
// Defined according to M5.2 Work Package §5 [I03]

import { IIdempotencyRepository, IdempotencyRecord } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface IdempotencyRow {
  key: string;
  project_id: string;
  actor_user_id: string;
  operation: string;
  payload_sha256: string;
  response_status: number;
  response_json: string;
  created_at: string;
}

export class SqliteIdempotencyRepository implements IIdempotencyRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async get(key: string): Promise<IdempotencyRecord | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM idempotency_records
      WHERE key = ?
    `).get(key) as unknown as IdempotencyRow | undefined;

    if (!row) return null;

    return {
      key: row.key,
      projectId: row.project_id,
      actorUserId: row.actor_user_id,
      operation: row.operation,
      payloadSha256: row.payload_sha256,
      responseStatus: row.response_status,
      responseJson: row.response_json,
      createdAt: row.created_at
    };
  }

  async save(record: IdempotencyRecord): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      INSERT INTO idempotency_records (
        key, project_id, actor_user_id, operation, payload_sha256, response_status, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        response_status = excluded.response_status,
        response_json = excluded.response_json
    `).run(
      record.key,
      record.projectId,
      record.actorUserId,
      record.operation,
      record.payloadSha256,
      record.responseStatus,
      record.responseJson,
      record.createdAt
    );
  }
}
