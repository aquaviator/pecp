// SqliteExtractionRepository
// Defined according to M5.2 Work Package §4 & §5 [I02, I03]

import { ExtractionResult, ExtractedFragment, ExtractionStatus } from '@pecp/pe-domain';
import { IExtractionRepository } from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase.js';

interface ExtractionRow {
  id: string;
  source_version_id: string;
  project_id: string;
  organisation_id: string;
  status: string;
  parser_id: string;
  parser_version: string;
  extracted_at: string;
  text_length: number;
  page_count: number | null;
  content_digest: string;
  diagnostics: string | null;
  plain_text: string;
}

interface FragmentRow {
  id: string;
  extraction_id: string;
  source_version_id: string;
  project_id: string;
  segment_index: number;
  locator: string;
  text: string;
  character_offset: number | null;
  length: number | null;
  metadata_json: string | null;
}

function mapFragmentRow(row: FragmentRow): ExtractedFragment {
  return {
    id: row.id,
    extractionId: row.extraction_id,
    sourceVersionId: row.source_version_id,
    segmentIndex: row.segment_index,
    locator: row.locator,
    text: row.text,
    characterOffset: row.character_offset ?? undefined,
    length: row.length ?? undefined,
    metadataJson: row.metadata_json
  };
}

export class SqliteExtractionRepository implements IExtractionRepository {
  constructor(private readonly db: SqliteDatabase) {}

  async saveExtraction(result: ExtractionResult): Promise<void> {
    const raw = this.db.getRawDatabase();

    this.db.transaction(() => {
      // 1. Insert or replace extraction_result
      raw.prepare(`
        INSERT INTO extraction_results (
          id, source_version_id, project_id, organisation_id,
          status, parser_id, parser_version, extracted_at,
          text_length, page_count, content_digest, diagnostics, plain_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, id) DO UPDATE SET
          status = excluded.status,
          parser_id = excluded.parser_id,
          parser_version = excluded.parser_version,
          extracted_at = excluded.extracted_at,
          text_length = excluded.text_length,
          page_count = excluded.page_count,
          content_digest = excluded.content_digest,
          diagnostics = excluded.diagnostics,
          plain_text = excluded.plain_text
      `).run(
        result.id,
        result.sourceVersionId,
        result.projectId,
        result.organisationId,
        result.status,
        result.parserId,
        result.parserVersion,
        result.extractedAt,
        result.textLength,
        result.pageCount ?? null,
        result.contentDigest,
        result.diagnostics ?? null,
        result.plainText
      );

      // 2. Clear old fragments if any
      raw.prepare(`
        DELETE FROM extracted_fragments
        WHERE project_id = ? AND extraction_id = ?
      `).run(result.projectId, result.id);

      // 3. Insert fragments
      const insertFrag = raw.prepare(`
        INSERT INTO extracted_fragments (
          id, extraction_id, source_version_id, project_id,
          segment_index, locator, text, character_offset, length, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const frag of result.fragments) {
        insertFrag.run(
          frag.id,
          frag.extractionId,
          frag.sourceVersionId,
          result.projectId,
          frag.segmentIndex,
          frag.locator,
          frag.text,
          frag.characterOffset ?? null,
          frag.length ?? null,
          frag.metadataJson ?? null
        );
      }
    });
  }

  async getExtraction(projectId: string, extractionId: string): Promise<ExtractionResult | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM extraction_results
      WHERE project_id = ? AND id = ?
    `).get(projectId, extractionId) as unknown as ExtractionRow | undefined;

    if (!row) return null;

    const fragments = await this.getFragments(projectId, extractionId);

    return {
      id: row.id,
      sourceVersionId: row.source_version_id,
      projectId: row.project_id,
      organisationId: row.organisation_id,
      status: row.status as ExtractionStatus,
      parserId: row.parser_id,
      parserVersion: row.parser_version,
      extractedAt: row.extracted_at,
      textLength: row.text_length,
      pageCount: row.page_count,
      contentDigest: row.content_digest,
      diagnostics: row.diagnostics,
      plainText: row.plain_text,
      fragments
    };
  }

  async getExtractionByVersion(projectId: string, sourceVersionId: string): Promise<ExtractionResult | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT *
      FROM extraction_results
      WHERE project_id = ? AND source_version_id = ?
      ORDER BY extracted_at DESC
      LIMIT 1
    `).get(projectId, sourceVersionId) as unknown as ExtractionRow | undefined;

    if (!row) return null;

    const fragments = await this.getFragments(projectId, row.id);

    return {
      id: row.id,
      sourceVersionId: row.source_version_id,
      projectId: row.project_id,
      organisationId: row.organisation_id,
      status: row.status as ExtractionStatus,
      parserId: row.parser_id,
      parserVersion: row.parser_version,
      extractedAt: row.extracted_at,
      textLength: row.text_length,
      pageCount: row.page_count,
      contentDigest: row.content_digest,
      diagnostics: row.diagnostics,
      plainText: row.plain_text,
      fragments
    };
  }

  async getFragments(projectId: string, extractionId: string): Promise<ExtractedFragment[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT *
      FROM extracted_fragments
      WHERE project_id = ? AND extraction_id = ?
      ORDER BY segment_index ASC
    `).all(projectId, extractionId) as unknown as FragmentRow[];

    return rows.map(mapFragmentRow);
  }
}
