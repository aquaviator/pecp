# Work Package: M5.0 — Persistent Platform & Governed API Foundation

## Status

READY TO EXECUTE

## Objective

Convert PECP from a browser/reference implementation into the first real customer-usable platform slice.

M5.0 must establish:

1. a real server-side PECP API;
2. durable local persistence;
3. first-class organisation/project tenancy boundaries;
4. a repository/application-service boundary that keeps canonical engineering logic out of HTTP/UI code;
5. a production-shaped web API adapter for project operations;
6. deterministic CI coverage for persistence and API behaviour.

M5.0 is a platform foundation milestone. It does **not** implement authentication/RBAC, live connectors, BYOAI, file ingestion, production runner orchestration, or live publishing.

The purpose is to create the stable platform seam those later milestones will use.

---

## Governing documents

Read before implementation:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M4_3_CLOSURE.md`
- all current service interfaces under `apps/web/src/services/interfaces`
- current domain types under `packages/pe-domain`

Constitution laws remain authoritative.

---

## Architectural decision

### API

Use **Fastify** as the HTTP adapter in `apps/api`.

Rationale:

- small, typed Node service;
- testable without opening network sockets via `inject()`;
- suitable for future customer-controlled deployment;
- does not move canonical logic into the HTTP layer.

### Persistence

Use Node 22 built-in **`node:sqlite`** for the M5.0 embedded persistence adapter.

Rationale:

- no external database service is required in CI;
- no native third-party SQLite dependency is required;
- customer-controlled local/VM/Docker installs can persist data immediately;
- repository contracts prevent SQLite becoming a permanent architectural dependency.

SQLite in M5.0 is the **embedded/reference persistence provider**, not a constitutional declaration that every enterprise production deployment must use SQLite.

Future PostgreSQL or other providers must be able to implement the same repository contract without changing canonical domain logic.

### Application boundary

Add a workspace package:

`packages/platform-core`

The dependency direction must be:

`web -> API client -> HTTP API -> platform-core application services -> repository interfaces -> SQLite adapter`

Canonical PE engines remain separate:

`platform-core -> @pecp/pe-domain / existing engines where appropriate`

HTTP routes and React components must not own business/canonical logic.

---

# 1. Platform domain additions

Add only the minimum platform types needed for M5.0.

## Organisation

Introduce an organisation record/type with at least:

- id;
- name;
- status: ACTIVE | ARCHIVED;
- createdAt;
- updatedAt.

## Project tenant binding

Preserve the existing `ProjectSummary.organisation` display field.

Add a non-breaking optional stable binding:

`organisationId?: string`

to `ProjectSummary`.

Do not remove or rename the existing display field.

## Project creation context

Persist the existing portal creation request data as bootstrap/input metadata, not canonical performance intelligence:

- creationMethod;
- briefText if supplied;
- uploadedDocumentNames if supplied;
- externalReference if supplied.

Do not convert this bootstrap input into approved intelligence during M5.0.

---

# 2. platform-core package

Create:

`packages/platform-core`

It must contain HTTP-neutral application contracts/services.

At minimum:

## Repository interfaces

`IOrganisationRepository`

- list()
- getById(id)
- getByName(name)
- create(...)
- updateStatus(...)

`IProjectRepository`

- list()
- listByOrganisation(organisationId)
- getById(id)
- create(...)
- update(...)
- archive(...)

Repository methods return cloned/plain data and must not expose SQLite objects.

## Application service

Create a platform application service that owns:

- organisation creation/lookup;
- project creation;
- project lookup/listing;
- project update/archive;
- organisation/project boundary checks;
- server-side ID generation;
- server-side operational timestamps.

Use `crypto.randomUUID()` for generated IDs.

Do not use `Date.now()` as an identity.

Do not silently invent:

- descriptions;
- requirements counts;
- conflict counts;
- document counts beyond directly supplied uploaded-document-name count;
- approval state;
- engineering values.

For a project created from a brief, `requirementsCount` remains 0 until requirements are actually extracted in a later milestone.

---

# 3. SQLite persistence

Implement the SQLite provider in the server/infrastructure layer.

Recommended location:

`apps/api/src/persistence/sqlite`

## Configuration

Support:

`PECP_DB_PATH`

Default local development path may live beneath a gitignored PECP data directory.

Tests must always use an isolated temporary database.

## Database setup

On open:

- enable foreign keys;
- use WAL mode where supported;
- run deterministic migrations before readiness is true.

## Minimum tables

### schema_migrations

Tracks applied migration versions.

### organisations

Persist exact organisation state.

### projects

Persist:

- organisation binding;
- existing ProjectSummary fields;
- project creation/bootstrap metadata;
- created/updated timestamps where platform-specific.

### entity_revisions

Append-only revision snapshots for organisation/project mutations.

Minimum fields:

- entity_type;
- entity_id;
- revision_number;
- payload_json;
- recorded_at;
- actor_ref nullable.

M5.0 does not authenticate actors. Do not invent a human actor.

This revision table is persistence history only. It is not a substitute for the full M5.1 security/audit model.

## Transactions

Organisation/project create/update operations that write a current record plus a revision must be atomic.

## Migrations

Migrations must be deterministic, ordered and idempotent.

Database readiness must fail if migrations cannot complete.

---

# 4. API service

Implement a real Fastify application in `apps/api`.

Do not put behaviour directly into the executable bootstrap. Use an application factory:

`buildApiApp(options)`

so tests can instantiate it without listening on a port.

## Health endpoints

### GET /health

Returns process health.

### GET /ready

Checks persistence availability/migration readiness.

Do not return READY if the database cannot be opened or migrated.

## Versioned API

Use:

`/api/v1`

### Organisations

- GET `/api/v1/organisations`
- POST `/api/v1/organisations`
- GET `/api/v1/organisations/:organisationId`
- PATCH `/api/v1/organisations/:organisationId/status`

### Projects

Support both explicit organisation routes and the existing portal creation shape.

Required:

- GET `/api/v1/projects`
- POST `/api/v1/projects`
- GET `/api/v1/projects/:projectId`
- PATCH `/api/v1/projects/:projectId`
- POST `/api/v1/projects/:projectId/archive`
- GET `/api/v1/organisations/:organisationId/projects`

For POST project:

- accept the existing `CreateProjectRequest`;
- resolve organisation by exact normalised organisation name;
- if no matching organisation exists, create it as part of the project-creation transaction/application operation;
- return a ProjectSummary including `organisationId`.

Normalisation may trim surrounding whitespace and use a separate comparison key for exact case-insensitive uniqueness.

Do not rewrite the user's display name into an invented format.

## Responses

Use a consistent JSON error envelope.

At minimum distinguish:

- validation error: 400;
- missing resource: 404;
- tenant/organisation mismatch: 404 or 403 consistently;
- duplicate/conflict: 409;
- persistence/internal error: 500 without leaking secrets or SQL internals.

## Validation

Validate request bodies at the API boundary.

Reject malformed engineering intent/status values.

Do not silently coerce invalid inputs.

---

# 5. API runtime

Add scripts for:

- API development;
- API typecheck;
- API tests;
- API start.

A TypeScript runtime such as `tsx` is acceptable for M5.0 development/startup.

Production container compilation/packaging is M5.6.

Do not block M5.0 on Docker packaging.

---

# 6. Web project API adapter

Create:

`ApiProjectService`

implementing the existing `IProjectService`.

It must support:

- getProjects();
- getProjectById();
- createProject().

Use the versioned API.

Do not duplicate project creation semantics in React.

## Runtime service selection

Refactor ServiceContext/service construction so PECP can run in explicit modes:

- `MOCK`
- `API`

Use an environment variable such as:

`VITE_PECP_SERVICE_MODE=MOCK|API`

and:

`VITE_PECP_API_BASE_URL`

Rules:

- existing tests may default explicitly to MOCK;
- production-shaped API mode must use ApiProjectService;
- there must be no silent fallback from failed API calls to mock data;
- a network/API error is an error, not permission to substitute RetailCo fixtures.

For M5.0, services not yet platformised may remain explicitly mock/reference-backed in MOCK mode.

Do not pretend integrations/execution are live in API mode.

Document the partial service-mode boundary.

---

# 7. Optional high-value extension: persistent intelligence read model

After all required M5.0 gates are green, continue with this extension if implementation remains straightforward.

Do not stop early merely because the required core is complete.

Add persistence/API support for current `IntelligenceItem` data:

- project-scoped list;
- get by id;
- exact storage of canonical/review states and provenance fields.

Expose:

- GET `/api/v1/projects/:projectId/intelligence`
- GET `/api/v1/projects/:projectId/intelligence/:itemId`

Add an `ApiIntelligenceService` implementing the read methods.

For M5.0, mutation/approval endpoints are optional and must not invent authenticated actors.

If an existing mutation interface cannot be implemented safely before M5.1 identity, keep it out of API mode and document that boundary rather than fabricating actor authority.

Do not create AI extraction/file ingestion in this extension.

---

# 8. CI integration

Update root scripts so normal repository CI validates the new platform.

The normal pipeline must execute:

1. deterministic `npm ci`;
2. web + API/platform TypeScript checks;
3. web tests;
4. platform-core/API tests;
5. RetailCo Reference Lab tests;
6. web production build;
7. API startup/build validation appropriate for M5.0.

Do not create a second hidden CI path.

Existing M0-M4 tests must continue to pass.

---

# 9. Required tests

Add comprehensive deterministic coverage.

## Repository contract tests

Against a temporary SQLite database:

- create/list/get organisation;
- duplicate organisation normalisation behaviour;
- create/list/get project;
- organisation boundary;
- update project;
- archive project;
- persistence survives repository reopen;
- revision number increments;
- current write and revision are atomic;
- no cross-organisation project leakage.

## API tests using Fastify inject

- /health;
- /ready;
- create/list/get organisation;
- create/list/get project;
- update/archive;
- invalid intent -> 400;
- unknown resource -> 404;
- project auto-creates organisation by supplied display name;
- project counts are not invented;
- bootstrap brief/document metadata persists;
- errors do not expose SQL/file paths.

## Web adapter tests

- ApiProjectService maps API responses to exact ProjectSummary;
- request errors remain errors;
- no fallback to MockProjectService;
- create request round-trips supplied values exactly.

## Restart persistence test

Create organisation/project, close DB, reopen the same file, prove state remains.

---

# 10. Reference scenario

M5.0 must include a deterministic platform reference test using a synthetic non-RetailCo organisation/project.

Example:

Organisation:

`Northstar Retail`

Project:

`Holiday Peak 2027`

Intent:

`FORECAST`

This is a platform persistence/API fixture only.

Do not create new engineering workload truth for Northstar in M5.0.

The test proves:

POST project -> durable persistence -> restart -> GET project -> exact equality.

RetailCo remains the authoritative engineering reference scenario for M0-M4.

---

# 11. Documentation

Create:

`docs/platform/M5_0_PLATFORM_ARCHITECTURE.md`

Document:

- dependency direction;
- API boundary;
- repository boundary;
- SQLite provider role;
- configuration;
- local startup;
- service mode;
- explicit M5.0 limitations;
- migration path for future database providers.

Create:

`docs/platform/M5_0_API.md`

Document every M5.0 endpoint with request/response examples.

Do not describe future endpoints as implemented.

---

# 12. Strict scope guard

M5.0 must NOT implement:

- login/authentication;
- RBAC;
- user accounts;
- verified human actor identity;
- secret stores;
- Jira/ADO/Confluence/SharePoint live calls;
- AI provider integration;
- file parsing/document extraction;
- production k6 runner orchestration;
- live results ingress;
- new Acceptance semantics;
- new Findings semantics;
- new Evidence semantics;
- Kubernetes deployment;
- billing/subscriptions.

Those are later milestones.

---

# 13. Architecture invariants

1. Canonical PE domain remains authoritative.
2. React never becomes a persistence layer.
3. HTTP handlers never recalculate engineering truth.
4. Repository implementations never contain Acceptance/workload logic.
5. Persistence preserves supplied values and governed absence.
6. No mock fallback in API mode.
7. No secrets in persisted bootstrap metadata/logs.
8. Organisation boundary exists from the first durable record.
9. All persistence is testable without external cloud infrastructure.
10. Existing M0-M4 deterministic behaviour remains unchanged.

---

# 14. Definition of Done

M5.0 is complete when:

1. `apps/api` is a real Fastify service rather than `.gitkeep`;
2. `packages/platform-core` exists with repository/application contracts;
3. organisation/project records persist durably in SQLite;
4. migrations and readiness work;
5. versioned organisation/project API works;
6. web has an ApiProjectService;
7. service mode is explicit and never silently falls back to mocks;
8. repository/API/web-adapter tests are green;
9. persistence restart is proven;
10. root normal CI validates API/platform plus all historic M0-M4 tests;
11. documentation is accurate;
12. no later-milestone scope has leaked in.

## Stretch completion

If the required DoD is green and no architectural blocker exists, also complete the persistent intelligence read-model extension in §7 in the same implementation pass.

---

# 15. Completion report

When finished, push to `master`, allow normal GitHub CI to complete, then return:

**M5.0 Completion Report for PM Audit**

Include:

- implementation SHA;
- CI run ID and job ID;
- exact test counts by web/API/platform/reference-lab;
- files/packages added;
- dependency changes;
- database schema/migrations;
- repository architecture;
- API endpoints;
- web service-mode implementation;
- persistence restart proof;
- tenant-boundary proof;
- zero-invention safeguards;
- whether §7 stretch intelligence read model was completed;
- known limitations/blockers;
- confirmation that M5.1 was not started.

Do not self-close M5.0.
Do not create M5.1.
