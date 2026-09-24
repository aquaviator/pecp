# PECP M5.0 Project Manager Review

## Verdict

**M5.0 — HOLD / NOT CLOSED**

The implementation is materially substantial and directionally correct, but the submitted completion report does not match authoritative remote repository/CI state and several M5.0 platform invariants remain incomplete.

Do **not** create M5.0.1.

Correct M5.0 in place and return for PM audit.

## Authoritative remote state

Implementation SHA currently on `master`:

`c7d8fdfc6808fbf6301a46007548dd08c85a69ef`

The completion report incorrectly identifies the prior M4.3 implementation SHA as the implementation reference and cites the prior M4.3 CI run.

Actual M5.0 GitHub Actions run:

`35981236215`

Job:

`107573367604`

Conclusion:

**FAILURE**

Failure occurred at deterministic dependency installation:

`npm ci`

GitHub reports that `package.json` and `package-lock.json` are out of sync, including missing Fastify, `@fastify/cors`, `tsx`, `@pecp/api`, `@pecp/platform-core` and their transitive dependencies.

TypeScript, tests and production build were therefore skipped remotely.

Local test results are useful development evidence, but M5.0 cannot close until authoritative remote CI is green.

---

## What is accepted

The implementation has made the intended platform transition:

- `apps/api` is now a real Fastify application;
- `packages/platform-core` exists and is HTTP/UI neutral;
- organisation/project repository contracts exist;
- SQLite migrations and persistence exist;
- organisation/project API endpoints exist;
- server-side UUID identities are used;
- project zero-invention counts are preserved;
- bootstrap metadata is persisted separately from canonical intelligence;
- `ApiProjectService` exists;
- Northstar restart persistence coverage exists;
- persistent intelligence repository/read endpoints exist;
- M0-M4 deterministic engine packages were not moved into HTTP/SQL code;
- M5.1 authentication/RBAC scope has not been started.

These are the correct architectural moves.

---

# Blocking corrections

## 1. Deterministic lockfile is broken

The repository added/changed workspace dependencies without committing a synchronized `package-lock.json`.

This violates the established deterministic `npm ci` gate and M5.0 §8/§27.

Required:

- run the repository-approved npm 10.9.8 install workflow;
- update and commit `package-lock.json`;
- verify clean `npm ci` from the repository root;
- push and wait for normal GitHub CI.

Do not substitute `npm install` in CI.

---

## 2. Current-record + revision writes are not atomic

M5.0 explicitly requires organisation/project mutations that update the current record and append `entity_revisions` to be atomic.

Current `PlatformApplicationService` does:

1. repository create/update/archive;
2. then a separate revision repository write.

Those are separate database operations with no transaction spanning both calls.

If revision insertion fails, the current entity mutation remains committed.

The current test named "records payload snapshots atomically" only checks that revisions exist. It does not induce a revision failure and prove rollback.

This is a material governance/persistence issue.

Required:

- add a database-agnostic transaction/unit-of-work contract to `platform-core`, or another equally clean application boundary;
- SQLite must implement that transaction boundary;
- wrap organisation create/status mutation and project create/update/archive plus revision append in one atomic unit;
- project auto-creation of a new organisation must not leave a stranded organisation if project creation fails;
- do not move SQLite-specific transaction logic into the canonical domain.

Add failure-injection tests proving rollback.

At minimum prove:

- failed revision append rolls back project create;
- failed revision append rolls back project update;
- failed revision append rolls back organisation create/status mutation;
- failed project creation after auto-created organisation does not strand that organisation.

---

## 3. API mode still silently instantiates mock/reference services

`ServiceContext` selects `ApiProjectService` in API mode, but still constructs:

- `MockIntelligenceService`;
- `MockIntegrationService`;
- `MockExecutionEvidenceService`.

That conflicts with the M5.0 service-mode invariant that API mode must not silently fall back to mock/reference data.

It can make a persistent project coexist with unrelated reference/mock intelligence/integration/execution state.

Required:

- API mode must never silently instantiate mock/reference services;
- because the intelligence read-model extension was implemented, add `ApiIntelligenceService` for its supported read operations;
- mutation/approval methods that require M5.1 actor identity must fail explicitly with a clear unsupported/not-yet-available error rather than use mock authority;
- for integration and execution/evidence services not yet platformised, use explicit unavailable/not-supported API-mode adapters or another clearly surfaced boundary;
- MOCK mode may continue to use the deterministic reference services.

Add regression coverage proving API mode contains no `Mock*Service` fallback path.

---

## 4. Claimed §7 intelligence extension is incomplete at the web boundary

The report says the persistent intelligence read-model stretch is complete.

The repository contains:

- SQLite intelligence persistence;
- API read endpoints.

But it does not contain the required `ApiIntelligenceService` web adapter, and API mode still uses `MockIntelligenceService`.

Therefore the extension is only partially complete.

Required:

- implement `ApiIntelligenceService` for:
  - list project intelligence;
  - get intelligence item;
- preserve exact canonical/review/provenance fields;
- no normalization or invented approvals;
- mutation methods must be explicit unsupported operations until M5.1 identity exists.

Add adapter tests for exact mapping, 404, network/API errors and no mock fallback.

---

## 5. Transaction/rollback coverage required by the work package is missing

M5.0 §9 explicitly requires:

- current write + revision atomicity;
- transaction rollback coverage.

Current repository tests verify happy-path revision numbering but do not test rollback.

Add deterministic failure-injection tests as described in blocker 2.

---

## 6. Default durable data directory is not gitignored

The real server defaults to:

`data/pecp.db`

but current `.gitignore` does not ignore `data/` or PECP SQLite database/WAL/SHM files.

This creates a risk of committing customer/local persistent state.

Required:

- add the chosen PECP runtime data directory and SQLite sidecar patterns to `.gitignore`;
- document the location;
- do not ignore source fixtures/reference data broadly.

---

## 7. Documentation overstates atomicity

`docs/platform/M5_0_PLATFORM_ARCHITECTURE.md` currently states that every organisation/project mutation atomically writes its revision.

That is not true in the current implementation.

After implementing the transaction correction, retain the statement and document the actual unit-of-work boundary.

If architecture changes, update the document to match real code.

Documentation must describe implemented behaviour only.

---

## 8. Completion-report identity and CI references must be corrected

The next completion report must cite:

- the actual final M5.0 implementation SHA;
- the actual M5.0 GitHub Actions run and job;
- remote CI conclusion;
- test counts from that remote run.

Do not cite the M4.3 run as M5.0 evidence.

---

# PM notes, non-blocking

- `apps/api/src/server.ts` correctly uses durable `data/pecp.db` by default, while test/app-factory paths can use isolated/in-memory databases.
- Fastify route validation is intentionally lightweight for M5.0 and can be hardened later.
- Authentication/CORS hardening belongs primarily to M5.1/security work. Do not expand this correction into M5.1.
- SQLite remains an embedded provider behind repository contracts, which is appropriate for this milestone.

---

# Required verification before resubmission

From a clean repository state:

1. `npm ci` — PASS
2. root TypeScript checks — PASS
3. web tests — PASS
4. API/platform tests — PASS
5. RetailCo Reference Lab — PASS
6. production web build — PASS
7. transaction failure/rollback tests — PASS
8. API-mode no-mock-fallback tests — PASS
9. persistence restart test — PASS
10. normal GitHub `CI` — SUCCESS

---

# Closure condition

M5.0 can close when:

- deterministic install is restored;
- persistence/revision operations are genuinely atomic;
- API mode contains no silent mock/reference fallbacks;
- the claimed intelligence read model is wired through the API web adapter;
- rollback/no-fallback regressions exist;
- runtime data is gitignored;
- documentation matches implementation;
- authoritative remote CI is green.

No new product scope is required.

## Programme state

`M4.3 ✅ → M5.0 implementation substantial but HOLD on deterministic CI + transaction/service-mode fidelity → M5.1 NOT STARTED`
