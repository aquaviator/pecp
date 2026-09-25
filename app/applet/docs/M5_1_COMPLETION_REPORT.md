# M5.1 Completion Report for PM Audit

**Milestone**: M5.1 — Identity, RBAC & Audit Authority  
**Status**: IMPLEMENTED & AUDIT-READY (Awaiting Formal PM Review & Audit)  
**Date**: September 25, 2026  
**Work Package**: `docs/work-packages/M5_1_IDENTITY_RBAC_AUDIT_AUTHORITY.md`  
**Prior Milestone**: `docs/M5_0_CLOSURE.md` (CLOSED ✅)  

---

## 1. Executive Summary

Milestone M5.1 establishes the trusted human-identity and authorization boundary for the Performance Engineering Control Plane (PECP). It enforces the core product constitutional rule:
> **"AI proposes. Systems verify. Humans decide."**

Prior to M5.1, the platform foundation (M5.0) established multi-tenant database persistence and governed API routing, but mutations relied on caller-supplied actor headers or unauthenticated access. M5.1 introduces:
1. **Authenticated User Identity**: Cryptographically secure local user authentication (Scrypt) with durable user accounts and disabled-account enforcement.
2. **Deterministic Role-Based Access Control (RBAC)**: Exact 5-tier organisation role model (`ORG_ADMIN`, `PERFORMANCE_LEAD`, `PERFORMANCE_ENGINEER`, `REVIEWER`, `VIEWER`) and a platform role (`PLATFORM_ADMIN`).
3. **Strict Multi-Tenant Isolation**: Hard barrier between organisations. Users can only access projects and organisations where they have active memberships or platform administrator rights.
4. **Governed Decision Authority**: All intelligence conflict resolutions and approvals strictly bind to the authenticated human session actor. Caller-supplied actor headers are rejected or ignored.
5. **Immutable Audit Event Attribution**: Every governed mutation, authentication event, membership alteration, and intelligence decision is recorded in an append-only audit ledger with actor attribution and metadata.
6. **Robust Session Lifecycle & CSRF/CORS Protection**: Opaque session tokens hashed with SHA-256 before persistence; cookie-based session transport with `SameSite=Lax`, `HttpOnly`, and dedicated double-submit CSRF token verification on all state-mutating requests (`POST`, `PATCH`, `DELETE`).
7. **Out-of-Band Admin Bootstrapping**: Secure CLI command (`npm run api:bootstrap-admin`) without dangerous unauthenticated HTTP bootstrap endpoints.

---

## 2. Test Execution & Verification

### Exact Test Counts by Suite

| Suite / Workspace | Files | Tests Passed | Status |
| :--- | :---: | :---: | :---: |
| **Web Portal Suite** (`apps/web`) | 29 | **480** | **PASS** |
| **Platform API Suite** (`apps/api`) | 15 | **71** | **PASS** |
| **RetailCo Reference Lab** (`reference-lab/retailco`) | 1 | **10** | **PASS** |
| **Total Automated Tests** | **45** | **561** | **PASS** |

### Build & Typecheck
- **TypeScript Workspace Lint (`npm run lint`)**: PASS (0 errors across `apps/web` and `apps/api`)
- **Vite Production Build (`npm run build`)**: PASS (Clean asset generation to `dist/`)
- **Deterministic CI / Verification (`compile_applet`)**: PASS

### Reference Execution & Run Metadata
- **Authoritative Implementation Reference**: `c109d6bc-2992-4b64-9537-dd9af9f40546`
- **Verification Environment**: Node v22.13 / Fastify v5.12 / Vitest v3.2.7 / SQLite Native
- **Conclusion**: **SUCCESS (All 561 tests pass cleanly)**

---

## 3. Schema & Migrations Added

Database migrations are managed deterministically via `SqliteDatabase`. M5.1 introduces Migration `003_identity_rbac_audit`:

```sql
-- Migration 003: identity_rbac_audit

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
```

---

## 4. Identity & Authentication Architecture

### Password Hashing (`PasswordHasher`)
- Uses Node.js native `crypto.scrypt` with cryptographically random 16-byte salts.
- Scrypt tuning: `N=16384`, `r=8`, `p=1`, `maxmem=33554432`, generating 64-byte key length.
- Timing-safe verification using `crypto.timingSafeEqual`.
- Salts and parameters stored alongside hash in `local_credentials` table; cleartext passwords are never persisted or logged.

### Session Security (`SqliteSessionRepository`)
- Session token generated with `crypto.randomBytes(32).toString('hex')` (256-bit entropy).
- Raw token is returned to user via HTTP cookie / auth response; the database stores ONLY `token_hash = sha256(token)`.
- Compromise of the database does not yield active session tokens.
- Session expiration defaults to 7 days; revocation timestamps (`revoked_at`) prevent reuse.
- Inactive or disabled users (`user.status === 'DISABLED'`) are automatically denied even if their session token is valid.

### CSRF & CORS Protection
- **CORS**: Restricted from open wildcard `*` to specific allowed origin (`process.env.PECP_CORS_ORIGIN || 'http://localhost:3000'`) with credentials enabled.
- **CSRF**: Double-submit cookie pattern (`pecp_csrf`). For non-idempotent HTTP methods (`POST`, `PATCH`, `DELETE`), requests authenticate via session cookies and MUST supply matching `x-csrf-token` header. Requests failing CSRF verification receive `403 Forbidden: Invalid or missing CSRF token`. Bearer token authentication bypasses CSRF check to facilitate automated API clients and tests.

---

## 5. Role/Permission Matrix (RBAC)

The RBAC matrix is evaluated strictly and deterministically server-side:

| Permission | `PLATFORM_ADMIN` | `ORG_ADMIN` | `PERFORMANCE_LEAD` | `PERFORMANCE_ENGINEER` | `REVIEWER` | `VIEWER` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Manage Platform Users** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Create Organisations** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Manage Org Memberships** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Create Projects** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Archive Projects** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Resolve Conflicts** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approve Intelligence** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Audit Log** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Read Projects & Intelligence** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

- Role hierarchy and permissions are encapsulated in `@pecp/platform-core` (`rbac.ts`).
- Any mutation attempt without required permission returns `403 Forbidden` and emits a `DENIED` audit event.

---

## 6. Endpoints Delivered

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/login`: Authenticates with email & password, sets session cookie and returns user profile, session token, and CSRF token.
- `POST /api/v1/auth/logout`: Revokes active session and clears auth cookies.
- `GET /api/v1/auth/me`: Returns current authenticated user, memberships, and platform role.
- `POST /api/v1/auth/change-password`: Self-service password change verifying current password.

### User & Administration (`/api/v1/admin`)
- `GET /api/v1/admin/users`: Lists all users on the platform (requires `PLATFORM_ADMIN`).
- `POST /api/v1/admin/users`: Provisions new user with initial credentials.
- `GET /api/v1/admin/users/:userId`: Fetches user profile and status.
- `PATCH /api/v1/admin/users/:userId/status`: Enables or disables user (`ACTIVE` / `DISABLED`).
- `POST /api/v1/admin/users/:userId/reset-password`: Administrative password reset.

### Organisation Membership (`/api/v1/organisations/:orgId/memberships`)
- `GET /api/v1/organisations/:orgId/memberships`: Lists organisation members.
- `POST /api/v1/organisations/:orgId/memberships`: Assigns membership and role to user.
- `PATCH /api/v1/organisations/:orgId/memberships/:userId/role`: Updates member role.
- `POST /api/v1/organisations/:orgId/memberships/:userId/revoke`: Revokes membership.

### Audit Authority (`/api/v1/audit`)
- `GET /api/v1/audit`: Returns paginated, chronological audit events filtered by organisation and project scope. Requires `ORG_ADMIN`, `PERFORMANCE_LEAD`, or `PLATFORM_ADMIN`.

### Tenancy-Isolated Projects & Governed Intelligence
- `GET /api/v1/projects`: Tenant-isolated listing. Users only receive projects belonging to organisations where they hold active membership.
- `POST /api/v1/projects/:projectId/intelligence/:itemId/resolve`: Resolves candidate clash using authenticated session user as `resolvedBy`.
- `POST /api/v1/projects/:projectId/intelligence/:itemId/approve`: Promotes intelligence to approved status using authenticated session user as `approvedBy`. Client-supplied actor fields are ignored.

---

## 7. Verifications & Proofs

### Tenant Isolation Proof (`tenant_isolation.test.ts`)
- Verified that two separate organisations (e.g. Northstar vs Contoso) cannot view, access, or mutate each other's projects.
- `GET /api/v1/projects` cleanly filters out foreign tenant projects.
- Direct access to `GET /api/v1/projects/:projectId` across tenant boundary returns `404 Not Found` (or `403 Forbidden`), preventing metadata leakage.

### Intelligence Actor Authority Proof (`intelligence_governance.test.ts`)
- Verified that unauthenticated requests to `/resolve` and `/approve` receive `401 Unauthorized`.
- Verified that callers attempting to pass spoofed `approvedBy: "ChiefArchitect"` or `resolvedBy: "ExternalUser"` in the JSON payload are ignored; the database and revision records record the exact authenticated user's ID and display name.
- Verified that `PERFORMANCE_ENGINEER` cannot approve items (requires `PERFORMANCE_LEAD` or higher).

### Concurrent Isolation Proof (`concurrent_security.test.ts`)
- Proves concurrent membership operations execute with atomic transaction isolation and mutex serialization, preventing race conditions or phantom updates in the revision and audit logs.

### Bootstrap Admin Path (`bootstrap_admin.test.ts`)
- Bootstrapping occurs strictly via CLI: `npm run api:bootstrap-admin -- --email admin@example.com --name "Platform Admin"` with `PECP_BOOTSTRAP_ADMIN_PASSWORD` in the environment.
- No insecure open HTTP endpoints exist for bootstrapping.

---

## 8. Carry-Forward Hygiene Completed (Section 28)

1. **Source-Driven Conflicts Counter**: Removed legacy React initial default of `3`. Conflict badge now defaults to `0` or source-derived counts (`conflictsCount = 0`).
2. **Document Upload Validation**: Enforced at the API boundary that all elements in `uploadedDocumentNames` must be valid strings (`!Array.isArray(body.uploadedDocumentNames) || !body.uploadedDocumentNames.every((n: any) => typeof n === 'string')` returns 400).
3. **Asynchronous Unit-of-Work Concurrency**: Intelligence resolutions and approvals execute through the serialized `IUnitOfWork` mutation boundary.

---

## 9. Limitations & Boundary Confirmation

- M5.1 establishes local authentication and session authority; federated OIDC/SAML providers are intentionally left behind the `IIdentityProvider` seam for subsequent enterprise integration milestones.
- Live runner orchestration and document intake parsers remain future milestones as defined in the product roadmap.
- **Confirmation**: M5.2 has **NOT** been started. M5.1 is complete, verified, and submitted for PM audit without self-closure.
