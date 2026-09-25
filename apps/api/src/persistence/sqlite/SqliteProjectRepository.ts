// SqliteProjectRepository
// Defined according to M5.0 Work Package §2 & §3

import { ProjectSummary, EngineeringIntent, ProjectCreationMethod } from '@pecp/pe-domain';
import {
  IProjectRepository,
  ProjectBootstrapMetadata,
  UpdateProjectInput
} from '@pecp/platform-core';
import { SqliteDatabase } from './SqliteDatabase';

interface ProjectRow {
  id: string;
  organisation_id: string;
  organisation_name?: string;
  name: string;
  intent: string;
  description: string;
  created_date: string;
  status: string;
  documents_count: number;
  requirements_count: number;
  conflicts_count: number;
  creation_method: string | null;
  brief_text: string | null;
  uploaded_document_names_json: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

export class SqliteProjectRepository implements IProjectRepository {
  constructor(private readonly db: SqliteDatabase) {}

  private mapRow(row: ProjectRow): ProjectSummary {
    return {
      id: row.id,
      name: row.name,
      organisation: row.organisation_name || row.organisation_id,
      organisationId: row.organisation_id,
      intent: row.intent as EngineeringIntent,
      description: row.description,
      createdDate: row.created_date,
      status: row.status as 'ACTIVE' | 'ARCHIVED' | 'DRAFT',
      documentsCount: row.documents_count,
      requirementsCount: row.requirements_count,
      conflictsCount: row.conflicts_count
    };
  }

  async list(): Promise<ProjectSummary[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT p.*, o.name as organisation_name
      FROM projects p
      LEFT JOIN organisations o ON p.organisation_id = o.id
      ORDER BY p.created_at DESC
    `).all() as unknown as ProjectRow[];

    return rows.map((r) => this.mapRow(r));
  }

  async listByOrganisation(organisationId: string): Promise<ProjectSummary[]> {
    const raw = this.db.getRawDatabase();
    const rows = raw.prepare(`
      SELECT p.*, o.name as organisation_name
      FROM projects p
      LEFT JOIN organisations o ON p.organisation_id = o.id
      WHERE p.organisation_id = ?
      ORDER BY p.created_at DESC
    `).all(organisationId) as unknown as ProjectRow[];

    return rows.map((r) => this.mapRow(r));
  }

  async getById(id: string): Promise<ProjectSummary | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT p.*, o.name as organisation_name
      FROM projects p
      LEFT JOIN organisations o ON p.organisation_id = o.id
      WHERE p.id = ?
    `).get(id) as unknown as ProjectRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  async getBootstrapMetadata(projectId: string): Promise<ProjectBootstrapMetadata | null> {
    const raw = this.db.getRawDatabase();
    const row = raw.prepare(`
      SELECT creation_method, brief_text, uploaded_document_names_json, external_reference
      FROM projects
      WHERE id = ?
    `).get(projectId) as unknown as ProjectRow | undefined;

    if (!row || !row.creation_method) return null;

    let uploadedDocs: string[] | undefined = undefined;
    if (row.uploaded_document_names_json) {
      try {
        const parsed = JSON.parse(row.uploaded_document_names_json);
        if (!Array.isArray(parsed)) {
          throw new Error('uploaded_document_names_json must be a JSON array of strings');
        }
        uploadedDocs = parsed;
      } catch (err: any) {
        throw new Error(
          `Failed to parse bootstrap metadata for project '${projectId}': corrupt JSON (${err.message})`
        );
      }
    }

    return {
      creationMethod: row.creation_method as ProjectCreationMethod,
      briefText: row.brief_text ?? undefined,
      uploadedDocumentNames: uploadedDocs,
      externalReference: row.external_reference ?? undefined
    };
  }

  async create(project: ProjectSummary, bootstrapMetadata?: ProjectBootstrapMetadata): Promise<ProjectSummary> {
    const raw = this.db.getRawDatabase();
    const now = new Date().toISOString();

    const uploadedJson = bootstrapMetadata?.uploadedDocumentNames
      ? JSON.stringify(bootstrapMetadata.uploadedDocumentNames)
      : null;

    raw.prepare(`
      INSERT INTO projects (
        id, organisation_id, name, intent, description, created_date, status,
        documents_count, requirements_count, conflicts_count,
        creation_method, brief_text, uploaded_document_names_json, external_reference,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      project.organisationId || '',
      project.name,
      project.intent,
      project.description,
      project.createdDate || now,
      project.status,
      project.documentsCount,
      project.requirementsCount,
      project.conflictsCount,
      bootstrapMetadata?.creationMethod ?? null,
      bootstrapMetadata?.briefText ?? null,
      uploadedJson,
      bootstrapMetadata?.externalReference ?? null,
      now,
      now
    );

    return { ...project };
  }

  async update(id: string, updates: UpdateProjectInput): Promise<ProjectSummary | null> {
    const raw = this.db.getRawDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const newName = updates.name !== undefined ? updates.name : existing.name;
    const newDescription = updates.description !== undefined ? updates.description : existing.description;
    const newIntent = updates.intent !== undefined ? updates.intent : existing.intent;
    const newStatus = updates.status !== undefined ? updates.status : existing.status;
    const newConflicts = updates.conflictsCount !== undefined ? updates.conflictsCount : existing.conflictsCount;
    const newReqs = updates.requirementsCount !== undefined ? updates.requirementsCount : existing.requirementsCount;
    const newDocs = updates.documentsCount !== undefined ? updates.documentsCount : existing.documentsCount;
    const now = new Date().toISOString();

    raw.prepare(`
      UPDATE projects
      SET name = ?, description = ?, intent = ?, status = ?,
          conflicts_count = ?, requirements_count = ?, documents_count = ?,
          updated_at = ?
      WHERE id = ?
    `).run(newName, newDescription, newIntent, newStatus, newConflicts, newReqs, newDocs, now, id);

    return this.getById(id);
  }

  async archive(id: string): Promise<ProjectSummary | null> {
    return this.update(id, { status: 'ARCHIVED' });
  }
}
