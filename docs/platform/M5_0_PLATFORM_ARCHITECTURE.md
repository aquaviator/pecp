# PECP M5.0 Platform Architecture

## 1. Overview & Objective

M5.0 establishes the persistent platform and governed API foundation for the Performance Engineering Control Plane (PECP). It transitions PECP from an in-memory browser/reference implementation into a real multi-tier, customer-usable platform slice with durable server-side storage and tenancy boundaries.

## 2. Dependency Direction

Architecture enforces a strict unidirectional dependency graph:

```
[apps/web (UI / React)]
         │
         ▼
[ApiProjectService (API Client)]
         │ (HTTP / JSON via /api/v1)
         ▼
[apps/api (Fastify HTTP Adapter)]
         │
         ▼
[PlatformApplicationService (packages/platform-core)]
         │
         ▼
[Repository Interfaces (IOrganisationRepository, IProjectRepository, etc.)]
         │
         ▼
[Persistence Adapter (apps/api/src/persistence/sqlite/SqliteDatabase)]
         │
         ▼
[node:sqlite (Node 22 built-in engine)]
```

### Governing Architectural Invariants:
1. **Canonical PE Domain Isolation:** `packages/pe-domain` and canonical engines (`workload-engine`, `test-engine`, `artefact-engine`) remain pure, deterministic, and decoupled from HTTP, SQL, and browser concerns.
2. **UI Independence:** React components and UI pages never act as a persistence layer or compute canonical engineering truth.
3. **HTTP Neutrality:** Fastify route handlers do not own business rules or recalculate engineering truth; they validate incoming HTTP requests and delegate immediately to `PlatformApplicationService`.
4. **Repository Decoupling:** Repository interfaces define domain-level contracts returning plain cloned records. Database objects or SQL queries are never leaked outside the persistence provider.

## 3. Persistent Storage: Embedded SQLite Provider

M5.0 uses Node 22 built-in `node:sqlite` (`DatabaseSync`) as its embedded reference persistence provider.

### Key Characteristics:
- **Zero Native Addons:** Relies on standard Node 22 runtime without compilation dependencies (e.g., `better-sqlite3` or Python toolchains).
- **WAL & Foreign Keys:** Enables `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;`.
- **Deterministic Migrations:** Executed on open via an ordered `schema_migrations` table before reporting readiness (`GET /ready`).
- **Entity Revisions:** Every mutation to an organisation or project atomically writes an immutable revision snapshot into `entity_revisions` with incrementing revision numbers.

### Migration Path for Future Database Providers:
The repository interfaces (`IOrganisationRepository`, `IProjectRepository`, `IEntityRevisionRepository`, `IIntelligenceRepository`) are database-agnostic. Enterprise deployments targeting PostgreSQL or Cloud SQL can implement these same contracts without altering `PlatformApplicationService` or HTTP routes.

## 4. Tenancy & Tenancy Boundaries

- **First-Class Organisations:** The `organisations` table tracks organisation identity, display name, normalized uniqueness key (`name.trim().toLowerCase()`), lifecycle status (`ACTIVE` | `ARCHIVED`), and audit timestamps.
- **Project Binding:** Every project persists an `organisation_id` foreign key referencing its parent organisation, while maintaining the non-breaking display field `organisation`.
- **Automatic Resolution:** When projects are created with an organisation name, the platform resolves existing organisations using case-insensitive matching or automatically creates the organisation in a single atomic operation.
- **Tenant Isolation:** Queries scoped to an organisation (`/api/v1/organisations/:organisationId/projects`) guarantee zero cross-tenant leakage.

## 5. Service Modes & Runtime Selection

The PECP web portal supports explicit service modes via environment variables:

- `VITE_PECP_SERVICE_MODE=MOCK|API` (defaults to `MOCK` for standalone or historical test runners).
- `VITE_PECP_API_BASE_URL` (points to the running API server, e.g. `http://localhost:3001`).

### Invariant:
In `API` mode, `ApiProjectService` handles project operations. Network or API errors are returned directly as operational errors. **There is never a silent fallback to mock data or RetailCo reference fixtures.**

## 6. M5.0 Strict Scope Boundary & Limitations

M5.0 intentionally does NOT implement:
- User accounts, authentication, or RBAC (deferred to M5.1).
- External issue tracker / documentation connectors (Jira, ADO, Confluence).
- BYOAI or LLM document extraction.
- Live k6 runner orchestration or socket execution agents.
- Changes to M3/M4 Acceptance, Findings, or Evidence Package logic.
