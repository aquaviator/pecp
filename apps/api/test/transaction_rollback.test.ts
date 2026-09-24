// Transaction Rollback & Atomicity Failure Injection Tests
// Defined according to M5.0 PM Review Blocker 2 & Blocker 5

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SqliteDatabase } from '../src/persistence/sqlite/SqliteDatabase';
import { SqliteOrganisationRepository } from '../src/persistence/sqlite/SqliteOrganisationRepository';
import { SqliteProjectRepository } from '../src/persistence/sqlite/SqliteProjectRepository';
import { SqliteEntityRevisionRepository } from '../src/persistence/sqlite/SqliteEntityRevisionRepository';
import { PlatformApplicationService } from '@pecp/platform-core';

describe('M5.0 Persistence Atomicity & Transaction Rollback Under Failure Injection', () => {
  let tempDir: string;
  let dbPath: string;
  let db: SqliteDatabase;
  let orgRepo: SqliteOrganisationRepository;
  let projectRepo: SqliteProjectRepository;
  let revisionRepo: SqliteEntityRevisionRepository;
  let service: PlatformApplicationService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-tx-test-'));
    dbPath = path.join(tempDir, 'pecp-tx.db');
    db = new SqliteDatabase(dbPath);
    db.open();

    orgRepo = new SqliteOrganisationRepository(db);
    projectRepo = new SqliteProjectRepository(db);
    revisionRepo = new SqliteEntityRevisionRepository(db);

    service = new PlatformApplicationService({
      organisationRepository: orgRepo,
      projectRepository: projectRepo,
      entityRevisionRepository: revisionRepo,
      unitOfWork: db
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Failed revision append rolls back project create', async () => {
    // Ensure organisation exists
    await service.createOrganisation({ name: 'Acme Logistics' });

    // Mock/Spy revisionRepo to fail when recording project revision
    const originalRecordRevision = revisionRepo.recordRevision.bind(revisionRepo);
    vi.spyOn(revisionRepo, 'recordRevision').mockImplementation(async (rev) => {
      if (rev.entityType === 'PROJECT') {
        throw new Error('INJECTED_REVISION_FAILURE: Disk write failed');
      }
      return originalRecordRevision(rev);
    });

    await expect(
      service.createProject({
        name: 'Project Delta',
        organisation: 'Acme Logistics',
        intent: 'FORECAST',
        description: 'Test project description',
        creationMethod: 'BRIEF'
      })
    ).rejects.toThrow('INJECTED_REVISION_FAILURE');

    // Invariant: The project creation MUST be rolled back entirely
    const projects = await projectRepo.list();
    expect(projects.length).toBe(0);

    // Verify directly via raw database query that no stranded row exists
    const rawRows = db.getRawDatabase().prepare('SELECT * FROM projects WHERE name = ?').all('Project Delta');
    expect(rawRows.length).toBe(0);

    // Verify entity_revisions has no project records
    const revRows = db.getRawDatabase().prepare('SELECT * FROM entity_revisions WHERE entity_type = ?').all('PROJECT');
    expect(revRows.length).toBe(0);
  });

  it('2. Failed revision append rolls back project update', async () => {
    // Create initial project successfully
    const initial = await service.createProject({
      name: 'Initial Project Name',
      organisation: 'Beta Corp',
      intent: 'FORECAST',
      description: 'Initial Description',
      creationMethod: 'BRIEF'
    });

    expect(initial.name).toBe('Initial Project Name');
    const revBefore = await revisionRepo.getLatestRevisionNumber('PROJECT', initial.id);
    expect(revBefore).toBe(1);

    // Spy on revisionRepo to fail on the second revision
    vi.spyOn(revisionRepo, 'recordRevision').mockImplementation(async (rev) => {
      if (rev.revisionNumber === 2) {
        throw new Error('INJECTED_REVISION_UPDATE_FAILURE');
      }
      return;
    });

    await expect(
      service.updateProject(initial.id, {
        name: 'Mutated Project Name',
        description: 'Mutated Description'
      })
    ).rejects.toThrow('INJECTED_REVISION_UPDATE_FAILURE');

    // Invariant: Project record in database MUST remain in pre-update state
    const current = await projectRepo.getById(initial.id);
    expect(current).not.toBeNull();
    expect(current!.name).toBe('Initial Project Name');
    expect(current!.description).toBe('Initial Description');

    // Revision number remains 1
    const revAfter = await revisionRepo.getLatestRevisionNumber('PROJECT', initial.id);
    expect(revAfter).toBe(1);
  });

  it('3. Failed revision append rolls back organisation create', async () => {
    vi.spyOn(revisionRepo, 'recordRevision').mockRejectedValue(
      new Error('INJECTED_ORG_REVISION_FAILURE')
    );

    await expect(
      service.createOrganisation({ name: 'Omega Global' })
    ).rejects.toThrow('INJECTED_ORG_REVISION_FAILURE');

    // Invariant: Organisation MUST NOT exist in database
    const org = await orgRepo.getByName('Omega Global');
    expect(org).toBeNull();

    const list = await orgRepo.list();
    expect(list.length).toBe(0);

    const rawRows = db.getRawDatabase().prepare('SELECT * FROM organisations WHERE normalized_name = ?').all('omega global');
    expect(rawRows.length).toBe(0);
  });

  it('4. Failed revision append rolls back organisation status mutation', async () => {
    const org = await service.createOrganisation({ name: 'Zeta Holdings' });
    expect(org.status).toBe('ACTIVE');

    // Fail subsequent revision insertion
    vi.spyOn(revisionRepo, 'recordRevision').mockRejectedValue(
      new Error('INJECTED_STATUS_REVISION_FAILURE')
    );

    await expect(
      service.updateOrganisationStatus(org.id, 'ARCHIVED')
    ).rejects.toThrow('INJECTED_STATUS_REVISION_FAILURE');

    // Invariant: Organisation status MUST remain ACTIVE
    const fresh = await orgRepo.getById(org.id);
    expect(fresh).not.toBeNull();
    expect(fresh!.status).toBe('ACTIVE');
  });

  it('5. Failed project creation after auto-created organisation does not strand that organisation', async () => {
    // Verify "AutoTenantCorp" does not exist initially
    const beforeCheck = await orgRepo.getByName('AutoTenantCorp');
    expect(beforeCheck).toBeNull();
    expect((await orgRepo.list()).length).toBe(0);

    // Fail when creating the project (simulating failure after organisation was auto-created)
    vi.spyOn(projectRepo, 'create').mockRejectedValue(
      new Error('INJECTED_PROJECT_WRITE_FAILURE')
    );

    await expect(
      service.createProject({
        name: 'Auto-Org Test Project',
        organisation: 'AutoTenantCorp',
        intent: 'FORECAST',
        description: 'Auto-org project description',
        creationMethod: 'BRIEF'
      })
    ).rejects.toThrow('INJECTED_PROJECT_WRITE_FAILURE');

    // Invariant: The auto-created organisation MUST BE ROLLED BACK completely
    const orgAfter = await orgRepo.getByName('AutoTenantCorp');
    expect(orgAfter).toBeNull();

    const orgList = await orgRepo.list();
    expect(orgList.length).toBe(0);

    const rawOrgs = db.getRawDatabase().prepare('SELECT * FROM organisations WHERE normalized_name = ?').all('autotenantcorp');
    expect(rawOrgs.length).toBe(0);

    const rawProjects = db.getRawDatabase().prepare('SELECT * FROM projects WHERE name = ?').all('Auto-Org Test Project');
    expect(rawProjects.length).toBe(0);
  });

  it('6. Failed revision append during project creation after auto-creating organisation rolls back BOTH', async () => {
    // Both org auto-creation and project creation succeed, but project revision append fails
    let orgCreated = false;
    vi.spyOn(revisionRepo, 'recordRevision').mockImplementation(async (rev) => {
      if (rev.entityType === 'ORGANISATION') {
        orgCreated = true;
        return;
      }
      if (rev.entityType === 'PROJECT') {
        throw new Error('INJECTED_PROJECT_REVISION_FAIL');
      }
      return;
    });

    await expect(
      service.createProject({
        name: 'Project With Auto Org',
        organisation: 'StrictRollbackTenant',
        intent: 'CERTIFICATION',
        description: 'Auto org project description',
        creationMethod: 'BRIEF'
      })
    ).rejects.toThrow('INJECTED_PROJECT_REVISION_FAIL');

    expect(orgCreated).toBe(true);

    // Invariant: Because project creation as a whole failed, the entire transaction rolled back,
    // leaving NEITHER the project NOR the auto-created organisation!
    const orgCheck = await orgRepo.getByName('StrictRollbackTenant');
    expect(orgCheck).toBeNull();

    const projCheck = await projectRepo.list();
    expect(projCheck.length).toBe(0);

    const rawOrgs = db.getRawDatabase().prepare('SELECT * FROM organisations').all();
    expect(rawOrgs.length).toBe(0);

    const rawProjs = db.getRawDatabase().prepare('SELECT * FROM projects').all();
    expect(rawProjs.length).toBe(0);
  });

  it('7. Concurrent Unit-of-Work Isolation: two independent requests cannot share one SQLite transaction under async delays/barriers, and rollback of one does not affect the other', async () => {
    function createBarrier() {
      let resolve: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      return {
        wait: () => promise,
        release: () => resolve()
      };
    }

    const request1InTx = createBarrier();
    const request2Dispatched = createBarrier();

    const originalProjectCreate = projectRepo.create.bind(projectRepo);
    vi.spyOn(projectRepo, 'create').mockImplementation(async (project, meta) => {
      if (project.name === 'Concurrent Project Fail') {
        request1InTx.release();
        // Wait until Request 2 has been dispatched concurrently
        await request2Dispatched.wait();
        // Real async delay while inside transaction
        await new Promise((r) => setTimeout(r, 40));
        // Inject failure to trigger rollback of Request 1
        throw new Error('INJECTED_CONCURRENT_ROLLBACK');
      }
      return originalProjectCreate(project, meta);
    });

    // Start Request 1 (which will encounter injected error and roll back)
    const request1Promise = service.createProject({
      name: 'Concurrent Project Fail',
      organisation: 'Failing Tenant',
      intent: 'FORECAST',
      description: 'Will be rolled back',
      creationMethod: 'BRIEF'
    });

    // Wait until Request 1 is actively inside its unit of work
    await request1InTx.wait();

    // Dispatch Request 2 concurrently while Request 1 is still inside its transaction
    const request2Promise = service.createProject({
      name: 'Concurrent Project Success',
      organisation: 'Succeeding Tenant',
      intent: 'CERTIFICATION',
      description: 'Will succeed',
      creationMethod: 'BRIEF'
    });

    // Notify that Request 2 has been dispatched
    request2Dispatched.release();

    const [result1, result2] = await Promise.allSettled([request1Promise, request2Promise]);

    // Request 1 must fail and roll back
    expect(result1.status).toBe('rejected');
    expect((result1 as PromiseRejectedResult).reason.message).toContain('INJECTED_CONCURRENT_ROLLBACK');

    // Request 2 must succeed and commit independently
    expect(result2.status).toBe('fulfilled');
    const createdProject2 = (result2 as PromiseFulfilledResult<any>).value;
    expect(createdProject2.name).toBe('Concurrent Project Success');

    // Invariant: Database contains Request 2's project and organisation
    const project2 = await projectRepo.getById(createdProject2.id);
    expect(project2).not.toBeNull();
    expect(project2?.name).toBe('Concurrent Project Success');

    const org2 = await orgRepo.getByName('Succeeding Tenant');
    expect(org2).not.toBeNull();

    // Invariant: Database DOES NOT contain Request 1's project or organisation (rolled back completely)
    const rawFailingProjects = db
      .getRawDatabase()
      .prepare('SELECT * FROM projects WHERE name = ?')
      .all('Concurrent Project Fail');
    expect(rawFailingProjects.length).toBe(0);

    const rawFailingOrgs = db
      .getRawDatabase()
      .prepare('SELECT * FROM organisations WHERE normalized_name = ?')
      .all('failing tenant');
    expect(rawFailingOrgs.length).toBe(0);
  });

  it('8. Concurrent Unit-of-Work Isolation: succeeding request commits properly and is not polluted when a concurrent request with async delays rolls back', async () => {
    function createBarrier() {
      let resolve: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      return {
        wait: () => promise,
        release: () => resolve()
      };
    }

    const barrierSuccessActive = createBarrier();
    const barrierFailureDispatched = createBarrier();

    const originalRevisionRecord = revisionRepo.recordRevision.bind(revisionRepo);
    vi.spyOn(revisionRepo, 'recordRevision').mockImplementation(async (rev) => {
      // For the succeeding project, delay inside transaction
      if (rev.entityType === 'PROJECT' && (rev as any).payloadJson?.includes('Succeeding Concurrency Alpha')) {
        barrierSuccessActive.release();
        await barrierFailureDispatched.wait();
        await new Promise((r) => setTimeout(r, 30));
      }
      // For the failing project, throw error
      if (rev.entityType === 'PROJECT' && (rev as any).payloadJson?.includes('Failing Concurrency Beta')) {
        throw new Error('INJECTED_CONCURRENT_BETA_FAIL');
      }
      return originalRevisionRecord(rev);
    });

    const successPromise = service.createProject({
      name: 'Succeeding Concurrency Alpha',
      organisation: 'Tenant Alpha',
      intent: 'DISCOVERY',
      description: 'Alpha description',
      creationMethod: 'BRIEF'
    });

    await barrierSuccessActive.wait();

    const failPromise = service.createProject({
      name: 'Failing Concurrency Beta',
      organisation: 'Tenant Beta',
      intent: 'FORECAST',
      description: 'Beta description',
      creationMethod: 'BRIEF'
    });

    barrierFailureDispatched.release();

    const [resAlpha, resBeta] = await Promise.allSettled([successPromise, failPromise]);

    expect(resAlpha.status).toBe('fulfilled');
    expect(resBeta.status).toBe('rejected');

    // Alpha exists
    const alphaOrg = await orgRepo.getByName('Tenant Alpha');
    expect(alphaOrg).not.toBeNull();

    // Beta was rolled back
    const betaOrg = await orgRepo.getByName('Tenant Beta');
    expect(betaOrg).toBeNull();
  });
});
