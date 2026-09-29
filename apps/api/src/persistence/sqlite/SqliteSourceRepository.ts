// SqliteSourceRepository
// Defined according to M5.2 Work Package §3 & §5 [I01, I03]

import {
  SourceMetadata,
  SourceVersion,
  ExtractionStatus,
  SourceKind,
  SourceFormat
} from '@pecp/pe-domain';
import { ISourceRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface SourceRow {
  id: string;
  project_id: string;
  organisation_id: string;
  kind: string;
  title: string;
  current_version_number: number;
  current_version_id: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  created_by_user_display_name: string;
}

interface SourceVersionRow {
  id: string;
  source_id: string;
  project_id: string;
  organisation_id: string;
  version_number: number;
  byte_size: number;
  media_type: string;
  format: string;
  sha256: string;
  captured_at: string;
  captured_by_user_id: string;
  captured_by_user_display_name: string;
  supplied_authored_at: string | null;
  supplied_speaker: string | null;
  supplied_external_reference: string | null;
  extraction_status: string;
  extraction_id: string | null;
  diagnostics: string | null;
}

function mapSourceRow(row: SourceRow): SourceMetadata {
  return {
    id: row.id,
    projectId: row.project_id,
    organisationId: row.organisation_id,
    kind: row.kind as SourceKind,
    title: row.title,
    currentVersionNumber: row.current_version_number,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByUserId: row.created_by_user_id,
    createdByUserDisplayName: row.created_by_user_display_name
  };
}

function mapVersionRow(row: SourceVersionRow): SourceVersion {
  return {
    id: row.id,
    sourceId: row.source_id,
    projectId: row.project_id,
    organisationId: row.organisation_id,
    versionNumber: row.version_number,
    byteSize: row.byte_size,
    mediaType: row.media_type,
    format: row.format as SourceFormat,
    sha256: row.sha256,
    capturedAt: row.captured_at,
    capturedByUserId: row.captured_by_user_id,
    capturedByUserDisplayName: row.captured_by_user_display_name,
    suppliedAuthoredAt: row.supplied_authored_at,
    suppliedSpeaker: row.supplied_speaker,
    suppliedExternalReference: row.supplied_external_reference,
    extractionStatus: row.extraction_status as ExtractionStatus,
    extractionId: row.extraction_id,
    diagnostics: row.diagnostics
  };
}

export class SqliteSourceRepository implements ISourceRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async createSource(
    source: SourceMetadata,
    initialVersion: SourceVersion,
    bytes: Buffer
  ): Promise<{ source: SourceMetadata; version: SourceVersion }> {
    const raw = this.db.getRawDatabase();

    this.db.transaction(() => {
      // 1. Insert source
      raw.prepare(`
        INSERT INTO sources (
          id, project_id, organisation_id, kind, title,
          current_version_number, current_version_id,
          created_at, updated_at, created_by_user_id, created_by_user_display_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        source.id,
        source.projectId,
        source.organisationId,
        source.kind,
        source.title,
        source.currentVersionNumber,
        source.currentVersionId,
        source.createdAt,
        source.updatedAt,
        source.createdByUserId,
        source.createdByUserDisplayName
      );

      // 2. Insert version
      raw.prepare(`
        INSERT INTO source_versions (
          id, source_id, project_id, organisation_id, version_number,
          byte_size, media_type, format, sha256, captured_at,
          captured_by_user_id, captured_by_user_display_name,
          supplied_authored_at, supplied_speaker, supplied_external_reference,
          extraction_status, extraction_id, diagnostics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        initialVersion.id,
        initialVersion.sourceId,
        initialVersion.projectId,
        initialVersion.organisationId,
        initialVersion.versionNumber,
        initialVersion.byteSize,
        initialVersion.mediaType,
        initialVersion.format,
        initialVersion.sha256,
        initialVersion.capturedAt,
        initialVersion.capturedByUserId,
        initialVersion.capturedByUserDisplayName,
        initialVersion.suppliedAuthoredAt ?? null,
        initialVersion.suppliedSpeaker ?? null,
        initialVersion.suppliedExternalReference ?? null,
        initialVersion.extractionStatus,
        initialVersion.extractionId ?? null,
        initialVersion.diagnostics ?? null
      );

      // 3. Store raw BLOB
      raw.prepare(`
        INSERT INTO source_blobs (project_id, version_id, bytes)
        VALUES (?, ?, ?)
      `).run(initialVersion.projectId, initialVersion.id, bytes);
    });

    return { source, version: initialVersion };
  }

  async createVersion(version: SourceVersion, bytes: Buffer): Promise<SourceVersion> {
    const raw = this.db.getRawDatabase();

    this.db.transaction(() => {
      raw.prepare(`
        INSERT INTO source_versions (
          id, source_id, project_id, organisation_id, version_number,
          byte_size, media_type, format, sha256, captured_at,
          captured_by_user_id, captured_by_user_display_name,
          supplied_authored_at, supplied_speaker, supplied_external_reference,
          extraction_status, extraction_id, diagnostics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        version.id,
        version.sourceId,
        version.projectId,
        version.organisationId,
        version.versionNumber,
        version.byteSize,
        version.mediaType,
        version.format,
        version.sha256,
        version.capturedAt,
        version.capturedByUserId,
        version.capturedByUserDisplayName,
        version.suppliedAuthoredAt ?? null,
        version.suppliedSpeaker ?? null,
        version.suppliedExternalReference ?? null,
        version.extractionStatus,
        version.extractionId ?? null,
        version.diagnostics ?? null
      );

      raw.prepare(`
        INSERT INTO source_blobs (project_id, version_id, bytes)
        VALUES (?, ?, ?)
      `).run(version.projectId, version.id, bytes);

      // Update source current pointer
      raw.prepare(`
        UPDATE sources
        SET current_version_number = ?,
            current_version_id = ?,
            updated_at = ?
        WHERE project_id = ? AND id = ?
      `).run(
        version.versionNumber,
        version.id,
        new Date().toISOString(),
        version.projectId,
        version.sourceId
      );
    });

    return version;
  }

  async getSource(projectId: string, sourceId: string): Promise<SourceMetadata | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM sources
      WHERE project_id = ? AND id = ?
    `).get(projectId, sourceId) as unknown as SourceRow | undefined;

    return row ? mapSourceRow(row) : null;
  }

  async listSources(projectId: string): Promise<SourceMetadata[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT *
      FROM sources
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId) as unknown as SourceRow[];

    return rows.map(mapSourceRow);
  }

  async getVersion(projectId: string, sourceId: string, versionId: string): Promise<SourceVersion | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM source_versions
      WHERE project_id = ? AND source_id = ? AND id = ?
    `).get(projectId, sourceId, versionId) as unknown as SourceVersionRow | undefined;

    return row ? mapVersionRow(row) : null;
  }

  async getVersionByNumber(
    projectId: string,
    sourceId: string,
    versionNumber: number
  ): Promise<SourceVersion | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM source_versions
      WHERE project_id = ? AND source_id = ? AND version_number = ?
    `).get(projectId, sourceId, versionNumber) as unknown as SourceVersionRow | undefined;

    return row ? mapVersionRow(row) : null;
  }

  async listVersions(projectId: string, sourceId: string): Promise<SourceVersion[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT *
      FROM source_versions
      WHERE project_id = ? AND source_id = ?
      ORDER BY version_number ASC
    `).all(projectId, sourceId) as unknown as SourceVersionRow[];

    return rows.map(mapVersionRow);
  }

  async getBlob(projectId: string, versionId: string): Promise<Buffer | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT bytes
      FROM source_blobs
      WHERE project_id = ? AND version_id = ?
    `).get(projectId, versionId) as { bytes: Buffer } | undefined;

    if (!row || !row.bytes) return null;
    return Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes);
  }

  async updateSourceCurrentVersion(
    projectId: string,
    sourceId: string,
    versionId: string,
    versionNumber: number
  ): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      UPDATE sources
      SET current_version_id = ?,
          current_version_number = ?,
          updated_at = ?
      WHERE project_id = ? AND id = ?
    `).run(versionId, versionNumber, new Date().toISOString(), projectId, sourceId);
  }

  async updateVersionExtraction(
    projectId: string,
    versionId: string,
    status: ExtractionStatus,
    extractionId?: string | null,
    diagnostics?: string | null
  ): Promise<void> {
    const raw = this.db.getRawDatabase();
    raw.prepare(`
      UPDATE source_versions
      SET extraction_status = ?,
          extraction_id = ?,
          diagnostics = ?
      WHERE project_id = ? AND id = ?
    `).run(status, extractionId ?? null, diagnostics ?? null, projectId, versionId);
  }

  async getAggregateByteSize(projectId: string): Promise<number> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT COALESCE(SUM(byte_size), 0) as total_bytes
      FROM source_versions
      WHERE project_id = ?
    `).get(projectId) as { total_bytes: number } | undefined;

    return row?.total_bytes ?? 0;
  }
}
