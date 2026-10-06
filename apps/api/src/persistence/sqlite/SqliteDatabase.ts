// SqliteDatabase
// Defined according to M5.0 Work Package §3

import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { IUnitOfWork } from '@pecp/platform-core';

interface TransactionScope {
  id: string;
  depth: number;
}

class AsyncTransactionMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const run = () => {
        this.locked = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.locked = false;
          const next = this.queue.shift();
          if (next) {
            next();
          }
        });
      };

      if (!this.locked) {
        run();
      } else {
        this.queue.push(run);
      }
    });
  }
}

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_platform_schema',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS organisations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          normalized_name TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'ARCHIVED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          organisation_id TEXT NOT NULL,
          name TEXT NOT NULL,
          intent TEXT NOT NULL,
          description TEXT NOT NULL,
          created_date TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'ARCHIVED', 'DRAFT')),
          documents_count INTEGER NOT NULL DEFAULT 0,
          requirements_count INTEGER NOT NULL DEFAULT 0,
          conflicts_count INTEGER NOT NULL DEFAULT 0,
          creation_method TEXT,
          brief_text TEXT,
          uploaded_document_names_json TEXT,
          external_reference TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organisation_id) REFERENCES organisations(id)
        );

        CREATE TABLE IF NOT EXISTS entity_revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          actor_ref TEXT,
          UNIQUE(entity_type, entity_id, revision_number)
        );

        CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organisation_id);
        CREATE INDEX IF NOT EXISTS idx_revisions_entity ON entity_revisions(entity_type, entity_id);
      `);
    }
  },
  {
    version: 2,
    name: '002_project_intelligence_items',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_intelligence_items (
          id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          item_key TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          canonical_state TEXT NOT NULL,
          review_status TEXT NOT NULL,
          unit TEXT,
          value_text TEXT,
          value_number REAL,
          source TEXT,
          source_document TEXT,
          source_location TEXT,
          captured_date TEXT,
          approval_state TEXT,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (project_id, id),
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE INDEX IF NOT EXISTS idx_intelligence_project ON project_intelligence_items(project_id);
      `);
    }
  },
  {
    version: 3,
    name: '003_identity_rbac_audit',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          normalized_email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'DISABLED')),
          platform_role TEXT NOT NULL CHECK(platform_role IN ('PLATFORM_ADMIN', 'NONE')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_credentials (
          user_id TEXT PRIMARY KEY,
          algorithm TEXT NOT NULL,
          salt TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          params_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS organisation_memberships (
          organisation_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('ORG_ADMIN', 'PERFORMANCE_LEAD', 'PERFORMANCE_ENGINEER', 'REVIEWER', 'VIEWER')),
          status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'REVOKED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by_user_id TEXT NOT NULL,
          PRIMARY KEY (organisation_id, user_id),
          FOREIGN KEY (organisation_id) REFERENCES organisations(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          revoked_at TEXT,
          authenticated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY,
          occurred_at TEXT NOT NULL,
          actor_user_id TEXT,
          actor_display_name TEXT,
          organisation_id TEXT,
          project_id TEXT,
          action TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT,
          outcome TEXT NOT NULL CHECK(outcome IN ('SUCCESS', 'DENIED', 'FAILURE')),
          reason TEXT,
          metadata_json TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);
        CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organisation_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(organisation_id);
        CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_events(project_id);
        CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
        CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_events(occurred_at);
      `);
    }
  },
  {
    version: 4,
    name: '004_m5_2_intake_provenance',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sources (
          id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('BRIEF', 'MANUAL_ASSERTION', 'UPLOAD')),
          title TEXT NOT NULL,
          current_version_number INTEGER NOT NULL,
          current_version_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by_user_id TEXT NOT NULL,
          created_by_user_display_name TEXT NOT NULL,
          PRIMARY KEY (project_id, id),
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS source_versions (
          id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          byte_size INTEGER NOT NULL,
          media_type TEXT NOT NULL,
          format TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          captured_at TEXT NOT NULL,
          captured_by_user_id TEXT NOT NULL,
          captured_by_user_display_name TEXT NOT NULL,
          supplied_authored_at TEXT,
          supplied_speaker TEXT,
          supplied_external_reference TEXT,
          extraction_status TEXT NOT NULL,
          extraction_id TEXT,
          diagnostics TEXT,
          PRIMARY KEY (project_id, source_id, id),
          UNIQUE (project_id, source_id, version_number),
          FOREIGN KEY (project_id, source_id) REFERENCES sources(project_id, id)
        );

        CREATE TABLE IF NOT EXISTS source_blobs (
          project_id TEXT NOT NULL,
          version_id TEXT NOT NULL,
          bytes BLOB NOT NULL,
          PRIMARY KEY (project_id, version_id)
        );

        CREATE TABLE IF NOT EXISTS extraction_results (
          id TEXT NOT NULL,
          source_version_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          status TEXT NOT NULL,
          parser_id TEXT NOT NULL,
          parser_version TEXT NOT NULL,
          extracted_at TEXT NOT NULL,
          text_length INTEGER NOT NULL,
          page_count INTEGER,
          content_digest TEXT NOT NULL,
          diagnostics TEXT,
          plain_text TEXT NOT NULL,
          PRIMARY KEY (project_id, id)
        );

        CREATE TABLE IF NOT EXISTS extracted_fragments (
          id TEXT NOT NULL,
          extraction_id TEXT NOT NULL,
          source_version_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          segment_index INTEGER NOT NULL,
          locator TEXT NOT NULL,
          text TEXT NOT NULL,
          character_offset INTEGER,
          length INTEGER,
          metadata_json TEXT,
          PRIMARY KEY (project_id, extraction_id, id),
          FOREIGN KEY (project_id, extraction_id) REFERENCES extraction_results(project_id, id)
        );

        CREATE TABLE IF NOT EXISTS intelligence_revisions (
          id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          recorded_at TEXT NOT NULL,
          actor_user_id TEXT,
          actor_display_name TEXT,
          canonical_state TEXT NOT NULL,
          review_status TEXT NOT NULL,
          value_text TEXT,
          value_number REAL,
          unit TEXT,
          approval_state TEXT NOT NULL,
          approved_by_user_id TEXT,
          source_bindings_json TEXT NOT NULL,
          candidates_json TEXT,
          snapshot_json TEXT NOT NULL,
          PRIMARY KEY (project_id, item_id, revision_number),
          FOREIGN KEY (project_id, item_id) REFERENCES project_intelligence_items(project_id, id)
        );

        CREATE TABLE IF NOT EXISTS intelligence_source_bindings (
          id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          source_id TEXT NOT NULL,
          source_version_id TEXT NOT NULL,
          source_version_number INTEGER NOT NULL,
          original_sha256 TEXT NOT NULL,
          extraction_id TEXT,
          locator TEXT NOT NULL,
          excerpt TEXT,
          PRIMARY KEY (project_id, id)
        );

        CREATE TABLE IF NOT EXISTS project_checklists (
          project_id TEXT PRIMARY KEY,
          organisation_id TEXT NOT NULL,
          revision INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by_user_id TEXT NOT NULL,
          items_json TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS idempotency_records (
          key TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload_sha256 TEXT NOT NULL,
          response_status INTEGER NOT NULL,
          response_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(project_id);
        CREATE INDEX IF NOT EXISTS idx_source_versions_source ON source_versions(project_id, source_id);
        CREATE INDEX IF NOT EXISTS idx_extraction_version ON extraction_results(project_id, source_version_id);
        CREATE INDEX IF NOT EXISTS idx_fragments_extraction ON extracted_fragments(project_id, extraction_id);
        CREATE INDEX IF NOT EXISTS idx_intel_revisions_item ON intelligence_revisions(project_id, item_id);
        CREATE INDEX IF NOT EXISTS idx_bindings_source_version ON intelligence_source_bindings(project_id, source_version_id);
        CREATE INDEX IF NOT EXISTS idx_idempotency_project ON idempotency_records(project_id);
      `);
    }
  },
  {
    version: 5,
    name: '005_project_artefacts',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_artefacts (
          id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          artefact_type TEXT NOT NULL CHECK(artefact_type IN ('PERFORMANCE_STRATEGY', 'PERFORMANCE_TEST_PLAN')),
          title TEXT NOT NULL,
          current_revision_number INTEGER NOT NULL,
          current_revision_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          created_by_user_id TEXT NOT NULL,
          created_by_user_display_name TEXT NOT NULL,
          PRIMARY KEY (project_id, id),
          UNIQUE (project_id, artefact_type),
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS project_artefact_revisions (
          id TEXT NOT NULL,
          artefact_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          artefact_type TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          source_contract_id TEXT NOT NULL,
          source_contract_version TEXT NOT NULL,
          source_contract_fingerprint TEXT NOT NULL,
          input_revision_digest TEXT NOT NULL,
          generation_metadata_json TEXT NOT NULL,
          content_json TEXT NOT NULL,
          markdown_export TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          actor_display_name TEXT NOT NULL,
          PRIMARY KEY (project_id, artefact_id, revision_number),
          UNIQUE (project_id, id),
          FOREIGN KEY (project_id, artefact_id) REFERENCES project_artefacts(project_id, id)
        );

        CREATE INDEX IF NOT EXISTS idx_artefacts_project ON project_artefacts(project_id);
        CREATE INDEX IF NOT EXISTS idx_artefact_revisions_artefact ON project_artefact_revisions(project_id, artefact_id);
      `);
    }
  },
  {
    version: 6,
    name: '006_contract_revisions_and_governance_decisions',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_contract_revisions (
          id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          contract_id TEXT NOT NULL,
          version TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          input_revision_digest TEXT NOT NULL,
          content_json TEXT NOT NULL,
          provenance_json TEXT NOT NULL,
          recorded_at TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          actor_display_name TEXT NOT NULL,
          PRIMARY KEY (project_id, revision_number),
          UNIQUE (project_id, id),
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE TABLE IF NOT EXISTS governance_decisions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          organisation_id TEXT NOT NULL,
          target_type TEXT NOT NULL CHECK(target_type IN ('PERFORMANCE_CONTRACT', 'PERFORMANCE_STRATEGY', 'PERFORMANCE_TEST_PLAN')),
          target_id TEXT NOT NULL,
          target_revision_number INTEGER NOT NULL,
          decision_type TEXT NOT NULL CHECK(decision_type IN ('APPROVE', 'WITHDRAW')),
          rationale TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          actor_display_name TEXT NOT NULL,
          target_content_fingerprint TEXT NOT NULL,
          target_input_digest TEXT NOT NULL,
          decided_at TEXT NOT NULL,
          decision_revision INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );

        CREATE INDEX IF NOT EXISTS idx_contract_revisions_project ON project_contract_revisions(project_id);
        CREATE INDEX IF NOT EXISTS idx_gov_decisions_target ON governance_decisions(project_id, target_type, target_id, target_revision_number);
        CREATE INDEX IF NOT EXISTS idx_gov_decisions_timeline ON governance_decisions(project_id, decided_at);
      `);

      try {
        db.exec(`ALTER TABLE project_artefact_revisions ADD COLUMN source_contract_revision_number INTEGER;`);
      } catch {
        // Column may already exist
      }
    }
  },
  {
    version: 7,
    name: '007_governance_decision_unique_revision',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_decisions_unique_revision
        ON governance_decisions(project_id, target_type, target_id, target_revision_number, decision_revision);
      `);
    }
  }
];

export class SqliteDatabase implements IUnitOfWork {
  private db: DatabaseSync | null = null;
  private migrationsAppliedCount = 0;
  private readonly dbPath: string;
  private txMutex = new AsyncTransactionMutex();
  private txScopeStorage = new AsyncLocalStorage<TransactionScope>();
  private syncTransactionDepth = 0;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  open(): void {
    if (this.db) return;

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);

    // Foreign keys pragma
    this.db.exec('PRAGMA foreign_keys = ON;');

    // WAL mode where possible
    try {
      if (this.dbPath !== ':memory:') {
        this.db.exec('PRAGMA journal_mode = WAL;');
      }
    } catch {
      // In-memory or specific filesystems might not support WAL
    }

    this.runMigrations();
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database is not open');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = this.db.prepare(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    ).all() as Array<{ version: number }>;

    const appliedVersions = new Set(appliedRows.map((r) => r.version));
    this.migrationsAppliedCount = appliedVersions.size;

    for (const migration of MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        this.transaction(() => {
          if (!this.db) throw new Error('Database is not open');
          migration.up(this.db);
          this.db.prepare(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
          ).run(migration.version, migration.name, new Date().toISOString());
        });
        this.migrationsAppliedCount++;
      }
    }
  }

  /**
   * Database-agnostic transactional unit of work execution.
   * Isolates concurrent requests so independent transactions never share a transaction.
   * Supports nested operations within the same request flow through SQLite savepoints.
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database is not open');

    const currentScope = this.txScopeStorage.getStore();

    if (currentScope) {
      // Nested transaction within the same async request flow -> use SAVEPOINT
      currentScope.depth++;
      const savepointName = `sp_${currentScope.id.replace(/-/g, '_')}_${currentScope.depth}`;
      this.db.exec(`SAVEPOINT ${savepointName};`);

      try {
        const result = await operation();
        try {
          this.db.exec(`RELEASE SAVEPOINT ${savepointName};`);
        } catch {
          // ignore if already released
        }
        currentScope.depth--;
        return result;
      } catch (error) {
        try {
          this.db.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
        } catch {
          // ignore rollback error
        }
        currentScope.depth--;
        throw error;
      }
    }

    // Top-level unit-of-work -> acquire transaction mutex to ensure isolated SQLite transaction
    const releaseLock = await this.txMutex.acquire();
    const newScope: TransactionScope = {
      id: randomUUID(),
      depth: 1
    };

    return this.txScopeStorage.run(newScope, async () => {
      if (!this.db) {
        releaseLock();
        throw new Error('Database is not open');
      }

      this.db.exec('BEGIN TRANSACTION;');

      try {
        const result = await operation();
        this.db.exec('COMMIT;');
        return result;
      } catch (error) {
        try {
          this.db.exec('ROLLBACK;');
        } catch {
          // ignore rollback error if already rolled back
        }
        throw error;
      } finally {
        releaseLock();
      }
    });
  }

  /**
   * Synchronous transaction runner with savepoint support.
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) throw new Error('Database is not open');

    const inAsyncTx = !!this.txScopeStorage.getStore();
    this.syncTransactionDepth++;
    const savepointName = `sp_sync_${this.syncTransactionDepth}`;

    if (this.syncTransactionDepth === 1 && !inAsyncTx) {
      this.db.exec('BEGIN TRANSACTION;');
    } else {
      this.db.exec(`SAVEPOINT ${savepointName};`);
    }

    try {
      const result = fn();
      if (this.syncTransactionDepth === 1 && !inAsyncTx) {
        this.db.exec('COMMIT;');
      } else {
        this.db.exec(`RELEASE SAVEPOINT ${savepointName};`);
      }
      this.syncTransactionDepth--;
      return result;
    } catch (error) {
      if (this.syncTransactionDepth === 1 && !inAsyncTx) {
        try {
          this.db.exec('ROLLBACK;');
        } catch {
          // Rollback failed if transaction was already aborted
        }
      } else {
        try {
          this.db.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
        } catch {
          // Rollback failed
        }
      }
      this.syncTransactionDepth--;
      throw error;
    }
  }

  getRawDatabase(): DatabaseSync {
    if (!this.db) throw new Error('Database is not open');
    return this.db;
  }

  isReady(): boolean {
    if (!this.db) return false;
    try {
      const res = this.db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
      return res?.alive === 1 && this.migrationsAppliedCount >= MIGRATIONS.length;
    } catch {
      return false;
    }
  }

  getMigrationsApplied(): number {
    return this.migrationsAppliedCount;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
