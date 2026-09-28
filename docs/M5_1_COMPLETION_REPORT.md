# M5.1 Completion Report for PM Audit

## 1. Executive Summary & Audit State

- **Programme Milestone:** M5.1 — Identity, RBAC & Audit Authority
- **Repository:** `aquaviator/pecp`
- **Branch:** `master`
- **Audit Verdict Requested:** PM Audit for M5.1 Closure
- **Programme State:** M5.0 CLOSED -> M5.1 Verification Complete -> M5.2 NOT STARTED
- **Milestone Self-Closure:** **NOT SELF-CLOSED** (Pending PM review and remote CI validation).

---

## 2. Implementation & Verification Summary

### Implementation Tracking
- **Base Master Commit:** `ea3ba8ac1b72609f4622beaf258d93a5a5013662` ("docs: update M5.1 audit with remaining CI and administrator-integrity blockers")
- **Audited Prior Attempt:** `a50ff4040f095ce774d48029bfeed61339d53966` (Failed CI run `36123203003` at `npm ci` due to missing `@fastify/cookie@11.1.2` / `cookie@2.0.1` in lockfile)
- **Committed Implementation SHA:** `2f81d5e1002ed494033d8dcaba402fa2ad08cbd6`
- **Documentation Commit SHA:** `1cd400e05533a68e781b8861af72c3b805970b27`
- **Local Implementation State:** Committed in repository root with synchronized `package-lock.json` and `bun.lock`.

### Remote Verification Status
- **Remote CI Run / Job Access:** Direct remote Git push from this sandbox environment is restricted (`could not read Username for 'https://github.com': No such device or address`). In strict compliance with instructions: **Remote results are kept separate from local results. Remote CI run/job IDs are not invented, and remote verification is explicitly reported as pending operator push.**

### Local Deterministic Verification
- **Environment:** Node v22.23.2, npm 10.9.8, Linux x64
- **Clean Installation Verification:** `npm ci --dry-run` and clean package synchronization completed with 0 errors. `@fastify/cookie@11.1.2` and `cookie@2.0.1` are verified present in `package-lock.json`.
- **Lint:** Passed (0 errors).
- **Production Build:** Passed (`apps/web` and `apps/api` built successfully).
- **Exact Test Suite Counts:**
  - **Web Suite (`apps/web`):** 30 test files, **487 passed**, 0 failed
  - **API Suite (`apps/api`):** 17 test files, **86 passed** (including all new M5.1 concurrency & sole-admin protections), 0 failed
  - **Reference Lab Suite (`reference-lab/retailco`):** 1 test file, **10 passed**, 0 failed
  - **Total Tests Executed:** **583 tests passing**, 0 failing across 48 test files.

---

## 3. Detailed Deliverables & Blockers Resolved

### A. Committed Lockfile Synchronization
- **Issue Resolved:** Resolved the `npm ci` lockfile mismatch from GitHub CI run `36123203003`.
- **Root Manifest Alignment:** Generated and synchronized the root `package-lock.json` using approved npm version 10.9.8.
- **Verification:** Both `@fastify/cookie@11.1.2` and nested `cookie@2.0.1` are fully committed in `package-lock.json` and mirrored in `bun.lock`. `npm ci --dry-run` validates deterministic synchronization across all monorepo workspaces.

### B. Final-Administrator Protection & Atomic Unit of Work
- **Relocated Guard into Unit of Work:** In `packages/platform-core/src/services/IdentityAdministrationService.ts`:
  - `updateMembershipRole()`: The current membership retrieval, the active administrator count verification (`countActiveAdmins`), the role update mutation, and the audit ledger recording are now executed inside the serialized `withTransaction` unit-of-work boundary.
  - `revokeMembership()`: The current membership lookup, the sole administrator check, the status transition to `REVOKED`, and the audit ledger recording are executed inside the serialized `withTransaction` boundary.
- **Addressed addMembership() Overwrite Path:**
  - `IdentityAdministrationService.addMembership()` now performs an atomic existence check within the transaction.
  - Creating an already-active membership returns a controlled `409 Conflict` (`Active membership already exists for user...`) with error code `CONFLICT`.
  - Re-posting the sole administrator as `VIEWER` (or any other role) via the POST membership route is rejected with HTTP 409, preventing silent overwrite or authority stripping.
  - Reactivating a previously `REVOKED` membership via `addMembership()` transitions the membership back to `ACTIVE` while preserving original creation provenance (`createdAt` and `createdByUserId`).
- **Concurrency & Sole-Administrator Regressions:**
  Added in `apps/api/test/concurrent_security.test.ts`:
  1. `proves concurrent demotion of two ORG_ADMINs retains at least one administrator and rejects the other with atomic audit`: Dispatches simultaneous demotions via `Promise.all`. Exactly one demotion succeeds (HTTP 200) and the other is rejected (HTTP 400). Exactly one active administrator remains and the rejected mutation leaves no partial audit entries.
  2. `proves concurrent revocation of two ORG_ADMINs retains at least one administrator`: Dispatches simultaneous revocations via `Promise.all`. Exactly one succeeds (HTTP 200) and the other is rejected (HTTP 400).
  3. `rejects duplicate active membership creation with 409 Conflict and protects sole administrator from overwrite`: Tests both `PLATFORM_ADMIN` and `ORG_ADMIN` actors attempting to overwrite existing memberships; validates 409 Conflict; validates provenance preservation on reactivation.

### C. Architecture & Operations Documentation
The following documents have been authored and committed:
1. `docs/security/M5_1_IDENTITY_RBAC_ARCHITECTURE.md`: Complete specification of identity entities, the local scrypt authentication provider, enterprise identity seam (`IIdentityProvider`), session lifecycle, cookie and CSRF protections, CORS origin restrictions, authoritative RBAC matrix, tenant isolation rules, transactional audit boundaries, and explicit limitations.
2. `docs/security/M5_1_SECURITY_OPERATIONS.md`: Operational procedures covering platform bootstrap administrator, user lifecycle management, administrative password reset, membership management, session TTL controls, allowed origin configuration, secure cookies, and emergency lockout recovery runbooks.
3. `docs/platform/M5_0_API.md`: Updated to include all implemented M5.1 endpoints: authentication (`/auth/login`, `/auth/logout`, `/auth/me`, `/auth/change-password`), user administration (`/users`), organisation membership (`/organisations/:orgId/memberships`), intelligence governance approvals (`/projects/:id/intelligence/:itemId/resolve`, `/approve`), and audit ledger querying (`/audit`).

---

## 4. Architectural Model & Invariants

### Domain Entities
- **User:** `id`, `email` (normalized lookup key), `displayName`, `status` (`ACTIVE` | `DISABLED`), `platformRole` (`PLATFORM_ADMIN` | `NONE`), `createdAt`, `updatedAt`.
- **OrganisationMembership:** `organisationId`, `userId`, `role`, `status` (`ACTIVE` | `REVOKED`), `createdAt`, `updatedAt`, `createdByUserId`.
- **AuthenticatedPrincipal:** Constructed exclusively by the Fastify preHandler hook from the validated session: `userId`, `email`, `displayName`, `platformRole`, `memberships`, `sessionId`, `authenticatedAt`.

### Authoritative Role Matrix
Enforces the correct permissions as validated in `apps/api/test/rbac_matrix.test.ts`:
- **ORG_ADMIN:** `ORGANISATION_READ`, `ORGANISATION_MANAGE_MEMBERS`, `PROJECT_READ`, `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_ARCHIVE`, `INTELLIGENCE_READ`, `INTELLIGENCE_RESOLVE`, `INTELLIGENCE_APPROVE`, `AUDIT_READ`.
- **PERFORMANCE_LEAD:** `ORGANISATION_READ`, `PROJECT_READ`, `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_ARCHIVE`, `INTELLIGENCE_READ`, `INTELLIGENCE_RESOLVE`, `INTELLIGENCE_APPROVE`, `AUDIT_READ`.
- **PERFORMANCE_ENGINEER:** `ORGANISATION_READ`, `PROJECT_READ`, `PROJECT_CREATE`, `PROJECT_UPDATE`, `INTELLIGENCE_READ`.
- **REVIEWER:** `ORGANISATION_READ`, `PROJECT_READ`, `INTELLIGENCE_READ`, `INTELLIGENCE_RESOLVE`, `INTELLIGENCE_APPROVE`, `AUDIT_READ`. *(Cannot create, update, or archive projects; cannot manage members).*
- **VIEWER:** `ORGANISATION_READ`, `PROJECT_READ`, `INTELLIGENCE_READ`.
- **PLATFORM_ADMIN:** Global platform bypass for all operational permissions across all tenant boundaries.

### Authentication & Session Security
- **Hashing:** `crypto.scrypt` with 16-byte random salt, 64-byte key length, timing-safe buffer comparison (`crypto.timingSafeEqual`).
- **Sessions:** 32-byte opaque cryptographically random tokens; only SHA-256 hash persisted in database; 12-hour default TTL (`PECP_SESSION_TTL_HOURS`).
- **Session Revocation:** Modifying a password or setting user status to `DISABLED` immediately revokes all active sessions for that user.
- **Cookies & CSRF:** HTTP-only `SameSite=Lax` session cookie (`pecp_session`) paired with Double Submit Cookie CSRF token (`pecp_csrf`) validated on all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`).

### Tenant Isolation & Denial Auditing
- API requests enforce tenant membership boundaries; cross-tenant access returns HTTP 403 Forbidden.
- Unauthorized mutation attempts trigger an immutable `AUTHORIZATION_DENIED` record in the audit repository before throwing the 403 error.

---

## 5. Scope Guard Confirmation

In accordance with Section 27 of the M5.1 Work Package, the following features have **NOT** been implemented:
- No OIDC, SAML, Azure AD / Entra ID, Okta, or Google 3P login.
- No SCIM user provisioning.
- No MFA, WebAuthn, or passkeys.
- No automated email invitations or self-service password recovery emails.
- No billing, subscription enforcement, or external issue tracker connectors.
- No project-specific roles or ABAC rules.
- **M5.2 has NOT been started.**
