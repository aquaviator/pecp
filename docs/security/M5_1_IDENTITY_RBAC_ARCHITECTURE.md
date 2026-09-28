# M5.1 Identity, RBAC & Audit Authority Architecture

## 1. Executive Summary & Governing Principle

PECP M5.1 establishes the authoritative human identity, role-based access control (RBAC), and immutable audit boundary for the platform.

The architectural foundation embodies the PECP core governing principle:

> **AI proposes. Systems verify. Humans decide.**

Every security mutation, project state alteration, and intelligence approval is bound to an authenticated human principal with cryptographic session assurance and atomic audit ledger persistence.

---

## 2. System Dependency Hierarchy & Layering

The identity and security architecture enforces strict one-way dependency boundaries:

```
┌────────────────────────────────────────────────────────┐
│                      Web Portal                        │
│ (React SPA, AuthProvider, AuthenticatedAppBoundary)   │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP Cookies (Session & CSRF) or Bearer Token
                            ▼
┌────────────────────────────────────────────────────────┐
│                   Fastify API Gateway                  │
│   (CORS, @fastify/cookie, preHandler Auth & CSRF Hooks)│
└───────────────────────────┬────────────────────────────┘
                            │ AuthenticatedPrincipal
                            ▼
┌────────────────────────────────────────────────────────┐
│                Governed Application Services           │
│ (IdentityAdministrationService, ProjectService, etc.) │
└───────────────────────────┬────────────────────────────┘
                            │ IUnitOfWork Transaction
                            ▼
┌────────────────────────────────────────────────────────┐
│              Persistence & Audit Repositories          │
│ (SqliteUserRepository, SqliteMembershipRepository,     │
│  SqliteSessionRepository, SqliteAuditEventRepository)  │
└────────────────────────────────────────────────────────┘
```

The canonical Performance Engineering (PE) calculation engines remain completely pure and independent of transport, persistence, and session mechanisms.

---

## 3. Identity Model & Domain Entities

### User (`User`)
Represents an individual platform user:
- `id`: Globally unique identifier (`usr_...` or UUID format).
- `email`: Normalized lowercase lookup key (`normalizedEmail`) and original casing preserved for display.
- `displayName`: Human-readable name.
- `status`: Lifecycle state (`ACTIVE` | `DISABLED`). Disabled users cannot authenticate; existing sessions are marked revoked via `SessionService.revokeAllForUser()` upon status transition to `DISABLED`.
- `platformRole`: Global role (`PLATFORM_ADMIN` | `NONE`). `PLATFORM_ADMIN` grants cross-organisation oversight and administration capabilities.
- `createdAt` / `updatedAt`: ISO-8601 UTC timestamps.

### Organisation Membership (`OrganisationMembership`)
Represents scoped authorization within a tenant organization:
- `organisationId`: Identifier of the organization.
- `userId`: Identifier of the member user.
- `role`: One of five scoped roles: `ORG_ADMIN`, `PERFORMANCE_LEAD`, `PERFORMANCE_ENGINEER`, `REVIEWER`, `VIEWER`.
- `status`: Lifecycle status (`ACTIVE` | `REVOKED`).
- `createdAt` / `updatedAt`: ISO-8601 UTC timestamps.
- `createdByUserId`: Audit provenance indicating which principal established the membership. Creation provenance is strictly preserved across reactivations.

### Authenticated Principal (`AuthenticatedPrincipal`)
Constructed exclusively by the server-side authentication boundary upon validating the incoming session:
- `userId`: Identifier of the user.
- `email`: Normalized email.
- `displayName`: Display name.
- `platformRole`: `PLATFORM_ADMIN` | `NONE`.
- `memberships`: Array of active organisation memberships (`{ organisationId, role }`).
- `sessionId`: Identifier of the active session record.
- `authenticatedAt`: Immutable timestamp of when the underlying session was created.

*Security Invariant:* The `AuthenticatedPrincipal` is never parsed from an incoming request payload. It is resolved strictly from the server-side session store using the cryptographically verified session token.

---

## 4. Local Authentication Provider & Enterprise Seam

### Local Provider Implementation (`LocalAuthenticationProvider`)
The default Sellable MVP implements a hardened embedded local authentication provider implementing `IAuthenticationProvider`:
- **Password Hashing (`PasswordHasher`):** Implemented using standard Node.js `crypto.scrypt` with a cryptographically secure 16-byte random salt per user.
- **Key Parameters:** Cost parameter `N=16384`, block size `r=8`, parallelization `p=1`, derived key length 64 bytes, max memory 32MB.
- **Storage Representation:** Returned via `HashResult` with distinct fields:
  - `algorithm`: `'scrypt-v1'`
  - `salt`: 16-byte random salt (hex string)
  - `passwordHash`: 64-byte derived key (hex string)
  - `paramsJson`: `{"N":16384,"r":8,"p":1,"maxmem":33554432}`
  These values are stored in dedicated columns (`algorithm`, `salt`, `password_hash`, `params_json`, `updated_at`) of the `local_credentials` SQLite table.
- **Timing Safety:** Password verification executes constant-time buffer comparison via `crypto.timingSafeEqual` over the derived key buffer to eliminate timing side-channel attacks.
- **Password Constraints:** Enforces minimum 12 characters and maximum 128 characters.
- **Privacy:** Plaintext passwords are never logged, audited, or persisted.

### Enterprise Identity Seam (`IAuthenticationProvider`)
To accommodate future enterprise SAML 2.0 / OIDC integrations without altering business logic, authentication is abstracted behind the provider interface:
```typescript
export interface AuthenticationResult {
  success: boolean;
  principal?: AuthenticatedPrincipal;
  user?: User;
  errorMessage?: string;
}

export interface IAuthenticationProvider {
  readonly providerId: string;
  authenticate(credentials: Record<string, any>): Promise<AuthenticationResult>;
}
```
`LocalAuthenticationProvider` (`providerId: 'LOCAL'`) implements `IAuthenticationProvider` and additionally provides `buildPrincipal(userId: string, sessionId: string, authenticatedAt?: string): Promise<AuthenticatedPrincipal | null>`.

Session token lifecycle management is decoupled from authentication and encapsulated in `SessionService` (`createSession`, `validateSession`, `revokeSession`, `revokeAllForUser`), backed by `ISessionRepository`.

Replacing the local provider with an enterprise OIDC/SAML bridge requires zero modifications to downstream authorization policies, domain models, or audit logging.

---

## 5. Session Lifecycle & Token Management

- **Opaque Tokens:** Session tokens are 32-byte (256-bit) cryptographically random hexadecimal strings generated via `crypto.randomBytes(32)`.
- **Token Hashing at Rest:** The raw session token is delivered exclusively to the client in an HTTP-only cookie (`pecp_session`). The JSON login response returns `{ user, principal, csrfToken }`, never the raw session token. The database stores only the SHA-256 hash of the token (`token_hash = sha256(raw_token)`). Compromise of the database does not reveal valid session tokens.
- **Session Duration (TTL):** Default TTL is 12 hours, configurable when constructing `SessionService`.
- **Soft Revocation via `revoked_at`:**
  - Revocation is implemented by updating the `revoked_at` timestamp on session records (`session.revokedAt`).
  - Session lookup in `SessionService.validateSession()` checks:
    ```typescript
    if (session.revokedAt) return null;
    if (session.expiresAt <= now) return null;
    ```
  - `SessionService.revokeSession(sessionId)` sets `revoked_at` for a single session.
  - `SessionService.revokeAllForUser(userId)` sets `revoked_at` across all active sessions for that user.
- **Forced Reauthentication on Credential Change:** Modifying or resetting a password immediately revokes all active sessions for the user via `revokeAllForUser(userId)` and clears client cookies.
- **Revocation on User Disabling:** Setting user status to `DISABLED` revokes all active sessions for that user via `revokeAllForUser(userId)`.
- **Session Restoration:** Each validated session preserves the original immutable `authenticatedAt` timestamp, which remains invariant throughout the lifetime of the session.

---

## 6. Cookie Security, CSRF & CORS Configuration

### Cookie Architecture
- **Session Cookie (`pecp_session`):**
  - `HttpOnly`: True (inaccessible to JavaScript).
  - `SameSite`: `lax`.
  - `Secure`: Controlled by `options.secureCookies` in `buildApiApp(options)`. If unspecified, defaults to production mode (`process.env.NODE_ENV === 'production'`). No custom environment variable is read for cookie security.
  - `Path`: `/`.
- **CSRF Token Cookie (`pecp_csrf`):**
  - Double Submit Cookie pattern.
  - Non-HttpOnly cookie paired with mandatory `X-PECP-CSRF` HTTP request header for state-changing browser mutations (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Server-side comparison validates `request.cookies['pecp_csrf'] === request.headers['x-pecp-csrf']`.
  - **Mutation Enforcement & Exceptions:**
    - CSRF validation is enforced exclusively when a request is authenticated via the `pecp_session` cookie.
    - Requests authenticated via `Authorization: Bearer <token>` are exempt from CSRF checks.
    - Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt.
    - Public endpoints (`/health`, `/ready`, and `POST /api/v1/auth/login`) are exempt from CSRF checks.

### CORS Policy
- Configured via Fastify `@fastify/cors`.
- Allowed origins parsed from comma-separated `PECP_ALLOWED_ORIGINS` environment variable (default: `['http://localhost:3000', 'http://127.0.0.1:3000']`).
- Credentials enabled (`credentials: true`) to permit authenticated cookie transmission.
- Allowed Methods: `['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']`.
- Allowed Headers: `['Content-Type', 'Authorization', 'X-PECP-CSRF', 'Accept']`.

---

## 7. Role-Based Access Control (RBAC) & Authority Matrix

### Granular Permission Set
- `ORGANISATION_READ`
- `ORGANISATION_MANAGE_MEMBERS`
- `PROJECT_READ`
- `PROJECT_CREATE`
- `PROJECT_UPDATE`
- `PROJECT_ARCHIVE`
- `INTELLIGENCE_READ`
- `INTELLIGENCE_RESOLVE`
- `INTELLIGENCE_APPROVE`
- `AUDIT_READ`

### Authoritative Role Matrix

| Permission | PLATFORM_ADMIN | ORG_ADMIN | PERFORMANCE_LEAD | PERFORMANCE_ENGINEER | REVIEWER | VIEWER |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `ORGANISATION_READ` | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** |
| `ORGANISATION_MANAGE_MEMBERS` | **YES** | **YES** | NO | NO | NO | NO |
| `PROJECT_READ` | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** |
| `PROJECT_CREATE` | **YES** | **YES** | **YES** | **YES** | NO | NO |
| `PROJECT_UPDATE` | **YES** | **YES** | **YES** | **YES** | NO | NO |
| `PROJECT_ARCHIVE` | **YES** | **YES** | **YES** | NO | NO | NO |
| `INTELLIGENCE_READ` | **YES** | **YES** | **YES** | **YES** | **YES** | **YES** |
| `INTELLIGENCE_RESOLVE` | **YES** | **YES** | **YES** | NO | **YES** | NO |
| `INTELLIGENCE_APPROVE` | **YES** | **YES** | **YES** | NO | **YES** | NO |
| `AUDIT_READ` | **YES** | **YES** | **YES** | NO | **YES** | NO |

*Role Distinction Notes:*
1. **REVIEWER Role:** Strictly scoped to verification and governance. Can view organizations, projects, and intelligence, can resolve conflicts, approve intelligence decisions, and inspect the audit trail. Cannot create, modify, or archive projects, and cannot alter organisation memberships.
2. **PERFORMANCE_ENGINEER Role:** Scoped to engineering execution. Can create and update projects and inspect telemetry; cannot archive projects, resolve/approve intelligence, manage members, or inspect audit logs.
3. **PLATFORM_ADMIN:** Global platform bypass for all operational permissions across all tenant boundaries.

---

## 8. Final-Administrator Protection & Concurrency Invariants

To prevent catastrophic administrative lockout:
1. **Last Administrator Invariant:** An organisation must maintain at least one `ACTIVE` member with the `ORG_ADMIN` role at all times.
2. **Atomic Unit of Work Boundary:** In `IdentityAdministrationService.updateMembershipRole()` and `revokeMembership()`, the current membership lookup, the active administrator count verification (`countActiveAdmins`), the database mutation, and the audit event recording are strictly executed inside the same serialized SQLite Unit of Work (`withTransaction`).
3. **Concurrency Protection:** Under concurrent attempts to demote or revoke the final two administrators, the serialized transaction ensures that exactly one operation succeeds while the subsequent conflicting operation is rejected with `Cannot demote/revoke the last ORG_ADMIN for this organisation`. Rejected mutations leave zero partial state or audit records.
4. **No Overwrite via Creation:** `IdentityAdministrationService.addMembership()` inspects existing membership state within the transaction:
   - If an `ACTIVE` membership already exists, it immediately aborts with a controlled `409 Conflict` (`Active membership already exists for user...`), preventing role hijacking or sole administrator demotion via POST requests.
   - If a `REVOKED` membership exists, it reactivates the membership while preserving the original `createdAt` and `createdByUserId` creation provenance.
5. **Universal Enforcement:** Even a `PLATFORM_ADMIN` actor cannot demote or revoke the sole active `ORG_ADMIN` of an organisation.

---

## 9. Audit Authority & Mutation-Denial Logging

### Transactional Audit Ledger
Every state change is recorded in the append-only `audit_events` ledger:
- `id`: Unique audit record identifier (UUID).
- `occurredAt`: Immutable ISO-8601 UTC timestamp.
- `actorUserId`: Attributed authenticated user ID (or null for unauthenticated/system actions).
- `actorDisplayName`: Actor display name at time of event.
- `organisationId`: Associated organisation (or null for platform-wide events).
- `projectId`: Associated project (or null).
- `action`: Specific governed `AuditAction` (e.g., `USER_CREATE`, `USER_DISABLE`, `USER_ENABLE`, `PASSWORD_CHANGE`, `PASSWORD_RESET`, `MEMBERSHIP_CREATE`, `MEMBERSHIP_ROLE_CHANGE`, `MEMBERSHIP_REVOKE`, `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_ARCHIVE`, `INTELLIGENCE_CONFLICT_RESOLVE`, `INTELLIGENCE_APPROVE`, `AUTHORIZATION_DENIED`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`).
- `targetType` & `targetId`: Entity type and composite identifier.
- `outcome`: `SUCCESS` | `DENIED` | `FAILURE`.
- `reason`: Description of failure or denial rationale.
- `metadataJson`: Structured parameters (roles, timestamps, diffs) with automatic redaction of secrets, passwords, tokens, and hashes.

### Query Filter Specification (`AuditQueryFilter`)
Queries to `GET /api/v1/audit` support the following parameters:
- `organisationId`: Filter to specific tenant events.
- `projectId`: Filter to specific project events.
- `actorUserId`: Filter by acting user.
- `action`: Filter by `AuditAction`.
- `limit`: Number of records to return.
- `before` / `after`: ISO-8601 timestamp range filters.

### Atomicity & Denial Auditing
- **Rollback Guarantee:** State mutations and audit entries share the identical database transaction. If audit insertion fails, the state mutation rolls back completely.
- **Denial Auditing:** Unauthorized mutation attempts generate an explicit `AUTHORIZATION_DENIED` audit record capturing the denied actor, targeted resource, and rule violation prior to throwing an HTTP 403 Forbidden response.

---

## 10. Bootstrap Process

The initial platform administrator is created via an explicit CLI command using the supported root `api:bootstrap-admin` npm script, NOT an automatic startup routine.

### CLI Invocation
Set the explicit shared database path and bootstrap password in the environment, then run the root script with required `--email` and `--name` arguments:

```bash
PECP_DB_PATH="data/pecp.db" \
PECP_BOOTSTRAP_ADMIN_PASSWORD="SecureBootstrapPassword123!" \
npm run api:bootstrap-admin -- --email admin@example.com --name "Platform Administrator"
```

### Constraints & Rejection Behavior
- **Arguments:** `--email` (required, valid email containing `@`) and `--name` (required, non-empty string).
- **Password:** Read from the `PECP_BOOTSTRAP_ADMIN_PASSWORD` environment variable (required; validated by `PasswordHasher.validatePassword` to require 12 to 128 characters).
- **Existing Administrator Rejection:**
  The command checks `userRepo.countActivePlatformAdmins()`. If any active `PLATFORM_ADMIN` user already exists in the database, the command cleanly aborts with:
  `Error: Platform administrator already exists. Bootstrap aborted.`
- **Existing Email Rejection:**
  If a user with the specified normalized email already exists, the command aborts with:
  `Error: User with email '<email>' already exists`.
- **No Defaults:** There are no hardcoded default admin credentials or automatic background initialization.

---

## 11. Database Configuration & Defaults

Operators must align database path configuration across processes:

| Context | Configuration Mechanism | Default Value | Notes |
| :--- | :--- | :--- | :--- |
| **Server Entrypoint** (`server.ts`) | `PECP_DB_PATH` env var | `data/pecp.db` | Production API server process. |
| **Bootstrap CLI** (`bootstrap-admin.ts`) | `PECP_DB_PATH` env var or `options.dbPath` | `pecp-platform.sqlite` | CLI command executed prior to server launch. |
| **App Factory / Tests** (`app.ts`) | `options.dbPath` or `PECP_DB_PATH` | `:memory:` | Vitest test runs and embedded instances. |

*Operational Requirement:* When deploying with persistent storage, operators must explicitly set `PECP_DB_PATH` to the identical file path (e.g., `/var/lib/pecp/pecp.db`) for both the bootstrap command and the running API server.

---

## 12. Disaster Recovery Boundary (Break-Glass Procedure)

Direct manipulation of the SQLite database (e.g. updating `platform_role` via `sqlite3` CLI) is strictly an out-of-band disaster recovery break-glass procedure for catastrophic lockout scenarios. It is not an audited, governed, or supported product feature.

---

## 13. Explicit Scope Boundaries & Limitations

The following capabilities are deliberately out of scope for M5.1:
- Third-party social or enterprise SSO providers (OIDC, SAML, Azure AD / Entra ID, Okta, Google).
- Multi-Factor Authentication (MFA / 2FA) and WebAuthn / Passkeys.
- Out-of-band email delivery, email verification, and self-service password reset flows.
- SCIM automated user provisioning.
- Granular project-specific role assignments (roles remain organisation-scoped in M5.1).
- Attribute-Based Access Control (ABAC) or dynamic policy expressions.
