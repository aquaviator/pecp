// Repository Contract Tests
// Defined according to M5.0 Work Package §9

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase';
import { SqliteOrganisationRepository } from '../src/persistence/sqlite/SqliteOrganisationRepository';
import { SqliteProjectRepository } from '../src/persistence/sqlite/SqliteProjectRepository';
import { SqliteEntityRevisionRepository } from '../src/persistence/sqlite/SqliteEntityRevisionRepository';
import { PlatformApplicationService } from '@pecp/platform-core';

describe('M5.0 Persistence & Repository Contracts', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganisationRepository;
  let projectRepo: SqliteProjectRepository;
  let revisionRepo: SqliteEntityRevisionRepository;
  let service: PlatformApplicationService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-test-'));
    dbPath = path.join(tempDir, 'pecp-test.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    orgRepo = new SqliteOrganisationRepository(db);
    projectRepo = new SqliteProjectRepository(db);
    revisionRepo = new SqliteEntityRevisionRepository(db);

    service = new PlatformApplicationService({
      organisationRepository: orgRepo,
      projectRepository: projectRepo,
      entityRevisionRepository: revisionRepo
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Organisation: creates, retrieves by id and name, and lists organisations', async () => {
    const org = await service.createOrganisation({ name: 'Acme Corp' });
    expect(org.id).toMatch(/^org-/);
    expect(org.name).toBe('Acme Corp');
    expect(org.status).toBe('ACTIVE');

    const byId = await service.getOrganisationById(org.id);
    expect(byId).toEqual(org);

    // Case-insensitive lookup
    const byName = await service.getOrganisationByName('acme corp');
    expect(byName).toEqual(org);

    const list = await service.listOrganisations();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(org.id);
  });

  it('2. Organisation: normalisation prevents duplicate names with varying whitespace and casing', async () => {
    await service.createOrganisation({ name: 'FinTech Global' });

    // Same casing/spaces trimmed
    await expect(service.createOrganisation({ name: '  FinTech Global  ' })).rejects.toThrow(
      /already exists/
    );

    // Different casing
    await expect(service.createOrganisation({ name: 'fintech global' })).rejects.toThrow(
      /already exists/
    );
  });

  it('3. Project: creates with zero-invention safeguards and binds to organisation', async () => {
    const project = await service.createProject({
      name: 'Core Banking Load Test',
      organisation: 'BankCorp',
      intent: 'REPRESENTATIVE',
      description: 'End-to-end banking transactions test',
      creationMethod: 'BRIEF',
      briefText: 'Simulate 500 TPS during market open',
      uploadedDocumentNames: ['arch-spec.pdf', 'nfr.docx']
    });

    expect(project.id).toMatch(/^proj-/);
    expect(project.name).toBe('Core Banking Load Test');
    expect(project.organisation).toBe('BankCorp');
    expect(project.organisationId).toMatch(/^org-/);
    expect(project.intent).toBe('REPRESENTATIVE');

    // Strict zero-invention safeguards (M5.0 §2):
    expect(project.requirementsCount).toBe(0);
    expect(project.conflictsCount).toBe(0);
    expect(project.documentsCount).toBe(2);
    expect(project.status).toBe('ACTIVE');

    // Verify bootstrap metadata was persisted
    const withMeta = await service.getProjectWithMetadata(project.id);
    expect(withMeta?.bootstrapMetadata?.creationMethod).toBe('BRIEF');
    expect(withMeta?.bootstrapMetadata?.briefText).toBe('Simulate 500 TPS during market open');
    expect(withMeta?.bootstrapMetadata?.uploadedDocumentNames).toEqual(['arch-spec.pdf', 'nfr.docx']);
  });

  it('4. Project: enforces tenancy boundaries and prevents cross-organisation leakage', async () => {
    const org1 = await service.createOrganisation({ name: 'Alpha Org' });
    const org2 = await service.createOrganisation({ name: 'Beta Org' });

    const p1 = await service.createProject({
      name: 'Project Alpha 1',
      organisation: 'Alpha Org',
      organisationId: org1.id,
      intent: 'FORECAST',
      description: 'Alpha description',
      creationMethod: 'BRIEF'
    });

    const p2 = await service.createProject({
      name: 'Project Beta 1',
      organisation: 'Beta Org',
      organisationId: org2.id,
      intent: 'DISCOVERY',
      description: 'Beta description',
      creationMethod: 'BRIEF'
    });

    const alphaProjects = await service.listProjectsByOrganisation(org1.id);
    expect(alphaProjects.length).toBe(1);
    expect(alphaProjects[0].id).toBe(p1.id);

    const betaProjects = await service.listProjectsByOrganisation(org2.id);
    expect(betaProjects.length).toBe(1);
    expect(betaProjects[0].id).toBe(p2.id);

    // List all returns both
    const all = await service.listProjects();
    expect(all.length).toBe(2);
  });

  it('5. Project: updates and archives correctly', async () => {
    const p = await service.createProject({
      name: 'Initial Name',
      organisation: 'Update Org',
      intent: 'INVESTIGATIVE',
      description: 'Initial desc',
      creationMethod: 'BRIEF'
    });

    const updated = await service.updateProject(p.id, {
      name: 'Updated Name',
      description: 'Updated desc',
      intent: 'CERTIFICATION'
    });

    expect(updated?.name).toBe('Updated Name');
    expect(updated?.description).toBe('Updated desc');
    expect(updated?.intent).toBe('CERTIFICATION');

    const archived = await service.archiveProject(p.id);
    expect(archived?.status).toBe('ARCHIVED');

    const fetched = await service.getProjectById(p.id);
    expect(fetched?.status).toBe('ARCHIVED');
  });

  it('6. Revisions: increments revision numbers and records payload snapshots atomically', async () => {
    const p = await service.createProject({
      name: 'Revisioned Project',
      organisation: 'Revision Org',
      intent: 'DISCOVERY',
      description: 'Revision desc',
      creationMethod: 'BRIEF'
    });

    // Rev 1 on create
    let revs = await revisionRepo.listByEntity('PROJECT', p.id);
    expect(revs.length).toBe(1);
    expect(revs[0].revisionNumber).toBe(1);

    // Rev 2 on update
    await service.updateProject(p.id, { name: 'Revisioned Project v2' });
    revs = await revisionRepo.listByEntity('PROJECT', p.id);
    expect(revs.length).toBe(2);
    expect(revs[1].revisionNumber).toBe(2);

    // Rev 3 on archive
    await service.archiveProject(p.id);
    revs = await revisionRepo.listByEntity('PROJECT', p.id);
    expect(revs.length).toBe(3);
    expect(revs[2].revisionNumber).toBe(3);

    // Payloads parse back to valid JSON
    const payload3 = JSON.parse(revs[2].payloadJson);
    expect(payload3.status).toBe('ARCHIVED');
  });

  it('7. Reopen: persistence survives repository close and reopen', async () => {
    const p = await service.createProject({
      name: 'Durable Project',
      organisation: 'Durable Org',
      intent: 'FORECAST',
      description: 'Survives restart',
      creationMethod: 'BRIEF'
    });

    // Close database
    db.close();

    // Reopen same database file
    const db2 = new SqliteDatabase(dbPath);
    db2.open();
    const projectRepo2 = new SqliteProjectRepository(db2);

    const reloaded = await projectRepo2.getById(p.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(p.id);
    expect(reloaded?.name).toBe('Durable Project');
    expect(reloaded?.organisation).toBe('Durable Org');

    db2.close();
  });
});
