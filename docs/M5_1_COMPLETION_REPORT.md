# M5.1 Completion Report for PM Audit

## 1. Executive Summary & Programme State

- **Programme Milestone:** M5.1 — Identity, RBAC & Audit Authority
- **Repository:** `aquaviator/pecp`
- **Branch:** `master`
- **Base Remote Audited Commit:** `a90e626428080932d15700c2410aa331d07d819a`
- **Prior Failed GitHub CI Run:** `36427590377` (Job ID: `108945273246`)
- **Remote CI Failure Reason:** In commit `a90e626`, `package-lock.json` retained unchanged Git blob SHA `163f1273fb768a30a5ab9e8c138b339e410ca00f`, which was missing `@fastify/cookie@11.1.2` and `cookie@2.0.1`. Consequently, GitHub Actions failed at `npm ci`.
- **Programme State:** M5.0 CLOSED -> M5.1 Implementation Complete / Lockfile & Documentation Corrected -> M5.2 NOT STARTED
- **Milestone Self-Closure:** **NOT SELF-CLOSED** (Pending operator push, GitHub Actions execution, and independent PM audit).

---

## 2. Lockfile Diagnosis & Root Manifest Synchronization

### 2.1 Diagnosis of Unchanged Remote Lockfile
Inspection of commit `a90e626428080932d15700c2410aa331d07d819a` revealed:
- `apps/api/src/app.ts`, `apps/api/test/concurrent_security.test.ts`, `packages/platform-core/src/services/IdentityAdministrationService.ts`, and initial documentation drafts were included in the commit.
- However, `package-lock.json` was not staged in `a90e626428080932d15700c2410aa331d07d819a` and remained at Git blob `163f1273fb768a30a5ab9e8c138b339e410ca00f`.
- When CI run `36427590377` executed `npm ci` under Node v22.23.2 and npm 10.9.8, npm rejected the lockfile with:
  ```text
  npm error code EUSAGE
  Missing: @fastify/cookie@11.1.2 from lock file
  Missing: cookie@2.0.1 from lock file
  ```

### 2.2 Root Lockfile Synchronization
Working from the verified repository root with npm 10.9.8:
- Synchronized the root lockfile against root and workspace manifests using `npm install --package-lock-only`.
- Confirmed that `@fastify/cookie: ^11.1.2` is present in `@pecp/api` workspace dependencies.
- Confirmed resolved records for `@fastify/cookie@11.1.2` and nested `cookie@2.0.1` are present.
- Mirrored `@fastify/cookie` in `bun.lock`.
- Verified lockfile change:
  - Baseline blob SHA: `163f1273fb768a30a5ab9e8c138b339e410ca00f`
  - Corrected lockfile blob SHA: `0d1d756a8c7fb7298b0fa5c4b23456f885ecf97b` (differs from failed baseline).

---

## 3. Real Isolated Clean Installation & Test Verification

In an isolated checkout/worktree of the committed revision, real end-to-end execution of the full validation pipeline was performed (no `--dry-run` substitution):

### 3.1 Real `npm ci` Execution
- Executed in clean workspace with wiped `node_modules`.
- Completed with 0 errors: 354 packages installed cleanly and deterministically.

### 3.2 Real `npm run lint` Execution
- `tsc --noEmit` across `@pecp/web` and `apps/api` passed with 0 errors.

### 3.3 Real `npm run test` Execution (583 Passed, 0 Failed)
- **Web Suite (`apps/web`):** 30 test files, **487 passed**, 0 failed
- **API Suite (`apps/api`):** 17 test files, **86 passed**, 0 failed
- **Reference Lab Suite (`reference-lab/retailco`):** 1 test file, **10 passed**, 0 failed
- **Total Tests:** **583 tests passing**, 0 failing across 48 test files.

### 3.4 Real `npm run build` Execution
- Vite production build of `@pecp/web` succeeded in 9.27s (dist generated, 2588 modules transformed).

---

## 4. Documentation Fidelity & Source Alignments

All platform security documents were thoroughly audited against actual source code and corrected:

### A. Platform Bootstrap
- **Explicit CLI Command:** Documented that bootstrap is performed via `node apps/api/dist/cli/bootstrap-admin.js` (or `npx tsx apps/api/src/cli/bootstrap-admin.ts`), requiring `--email` and `--name` CLI flags.
- **Password Delivery:** Requires `PECP_BOOTSTRAP_ADMIN_PASSWORD` environment variable (validated by `PasswordHasher` between 12 and 128 characters).
- **Existing Admin Rejection:** Documented that `userRepo.countActivePlatformAdmins() > 0` aborts with `Platform administrator already exists. Bootstrap aborted.` and existing email aborts with `User with email '<email>' already exists`.
- **Zero Invention:** Removed all claims of automatic startup bootstrap and invented default credentials (`admin@pecp.io` / `Admin123456!`).

### B. Database Configuration Alignment
- Documented explicit configuration requirements for `PECP_DB_PATH`:
  - Server entrypoint (`server.ts`): `data/pecp.db`
  - Bootstrap CLI (`bootstrap-admin.ts`): `pecp-platform.sqlite`
  - App factory / Tests (`app.ts`): `:memory:`
- Documented operational requirement to configure the identical persistent volume path (e.g., `/var/lib/pecp/pecp.db`) across both bootstrap CLI and server environments.

### C. CSRF Protection
- **Header:** Documented exact header `X-PECP-CSRF` matching the `pecp_csrf` cookie.
- **Enforcement:** Enforced strictly on state-changing requests (`POST`, `PATCH`, `PUT`, `DELETE`) authenticated via cookie. Requests authenticated via `Authorization: Bearer <token>` and public routes (including `POST /api/v1/auth/login`) are exempt.

### D. Cookie Security
- Documented that cookie `Secure` flag is governed programmatically by `options.secureCookies` in `buildApiApp(options)`, defaulting to `process.env.NODE_ENV === 'production'`. Removed references to non-existent `PECP_COOKIE_SECURE` environment variable.

### E. Endpoints & Route Family
- Documented that user administration endpoints reside under `/api/v1/admin/users`:
  - `GET /api/v1/admin/users` (list users)
  - `POST /api/v1/admin/users` (create user)
  - `GET /api/v1/admin/users/:userId` (get user)
  - `PATCH /api/v1/admin/users/:userId/status` (disable/enable user)
  - `POST /api/v1/admin/users/:userId/reset-password` (reset password)

### F. Exact Response Envelopes
- `GET /api/v1/auth/me`: Documented exact response envelope containing `{ user, principal, permissions }`.
- `POST /api/v1/auth/logout`: Documented exact response `{ success: true }`.
- `POST /api/v1/auth/change-password`: Documented exact response `{ success: true, message: "Password changed successfully. Please log in again." }`.
- `POST /api/v1/auth/login`: Documented exact response `{ user, principal, csrfToken }`.

### G. Security Contracts & Terminology
- **Session Revocation:** Documented soft-revocation via `revoked_at` timestamp on session records (`SessionService.revokeSession`, `SessionService.revokeAllForUser`), verified at lookup time.
- **Password Hasher:** Documented `HashResult` (`algorithm`, `salt`, `passwordHash`, `paramsJson`) mapped to individual columns in the `local_credentials` SQLite table.
- **Identity Provider Interface:** Documented actual contract `IAuthenticationProvider` with `providerId` and `authenticate(credentials: Record<string, any>): Promise<AuthenticationResult>`.
- **Audit Actions & Fields:** Aligned with `AuditEvent` schema (`id`, `occurredAt`, `actorUserId`, `actorDisplayName`, `organisationId`, `projectId`, `action`, `targetType`, `targetId`, `outcome`, `reason`, `metadataJson`) and exact `AuditAction` enum names. Documented query parameters (`organisationId`, `projectId`, `actorUserId`, `action`, `limit`, `before`, `after`).

### H. Disaster Recovery Boundary
- Clearly delineated direct database modification via `sqlite3` CLI as an un-audited, out-of-band break-glass emergency procedure, NOT a supported product feature or governed workflow.

---

## 5. Final-Administrator Protection Invariants Summary

Preserved and verified the following core protections:
1. **Unit of Work Isolation:** In `updateMembershipRole()` and `revokeMembership()`, membership lookup, active admin count (`countActiveAdmins`), mutation, and audit logging execute inside the same serialized SQLite Unit of Work (`withTransaction`).
2. **Duplicate Active Creation Guard (HTTP 409):** `addMembership()` checks for existing active memberships within the transaction and rejects duplicates with `409 Conflict` (`Active membership already exists for user...`), protecting sole administrators from role overwrite via POST.
3. **Reactivation Provenance:** Reactivating a `REVOKED` membership transitions status to `ACTIVE` while preserving original creation provenance (`createdAt` and `createdByUserId`).
4. **Concurrency Regressions:** Regressions in `apps/api/test/concurrent_security.test.ts` prove concurrent demotions and revocations serialize cleanly, retaining at least one administrator and preventing partial audit persistence on rejected operations.

---

## 6. Verification Status & Remote Delivery

- **Local Implementation SHA:** `6f534b779f49cbad41d2aabac402c33135a5a9b8` (committed on top of `a90e626428080932d15700c2410aa331d07d819a`).
- **Root Lockfile Blob SHA:** `0d1d756a8c7fb7298b0fa5c4b23456f885ecf97b` (Verified differing from failed baseline `163f1273fb768a30a5ab9e8c138b339e410ca00f`).
- **Remote CI Run / Job Status:** Remote git push credentials are restricted from this sandbox environment (`fatal: could not read Username for 'https://github.com': No such device or address`). In strict compliance with instructions:
  - Local verification results are confirmed passing across all 583 tests.
  - Remote CI execution is explicitly reported as pending operator push of this commit to `aquaviator/pecp`.
  - Remote success is not declared from local build logs.
  - M5.1 is not self-closed.
  - M5.2 has not been started.
