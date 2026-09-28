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
                            │ HTTP Cookies (Session & CSRF)
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
- `status`: Lifecycle state (`ACTIVE` | `DISABLED`). Disabled users cannot authenticate; existing sessions are immediately revoked upon status transition to `DISABLED`.
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

### Local Provider Implementation
The default Sellable MVP implements a hardened embedded local authentication provider:
- **Password Hashing:** Implemented using Node.js `crypto.scrypt` with a cryptographically secure 16-byte random salt per user.
- **Key Parameters:** Cost parameter `N=16384`, block size `r=8`, parallelization `p=1`, derived key length 64 bytes.
- **Format:** Versioned serialized hash string `scrypt:v1:<salt_hex>:<hash_hex>`.
- **Timing Safety:** Password verification executes constant-time buffer comparison via `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- **Password Constraints:** Enforces minimum 12 characters and maximum 128 characters.
- **Privacy:** Plaintext passwords are never logged, audited, or persisted.

### Enterprise Identity Seam (`IIdentityProvider`)
To accommodate future enterprise SAML 2.0 / OIDC integrations without altering business logic, authentication is abstracted behind an identity provider interface:
```typescript
export interface IIdentityProvider {
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validateSession(token: string): Promise<SessionValidationResult>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
}
```
Replacing the local provider with an enterprise OIDC/SAML bridge requires zero modifications to downstream authorization policies, domain models, or audit logging.

---

## 5. Session Lifecycle & Token Management

- **Opaque Tokens:** Session tokens are 32-byte (256-bit) cryptographically random hexadecimal strings generated via `crypto.randomBytes(32)`.
- **Token Hashing at Rest:** The raw token is delivered exclusively to the client in an HTTP-only cookie. The database stores only the SHA-256 hash of the token (`token_hash = sha256(raw_token)`). Compromise of the database does not reveal valid session tokens.
- **Session Duration (TTL):** Default TTL is 12 hours, configurable via `PECP_SESSION_TTL_HOURS`.
- **Forced Reauthentication on Credential Change:** Modifying or resetting a password immediately revokes all active sessions for the user and clears the client cookies.
- **Revocation on User Disabling:** Setting user status to `DISABLED` revokes all active sessions immediately.
- **Session Restoration:** Each validated session returns the original `authenticatedAt` timestamp, which remains invariant throughout the lifetime of the session.

---

## 6. Cookie Security, CSRF & CORS Configuration

### Cookie Architecture
- **Session Cookie (`pecp_session`):**
  - `HttpOnly`: True (inaccessible to JavaScript).
  - `SameSite`: `Lax`.
  - `Secure`: True in production (`NODE_ENV === 'production'`); configurable via `PECP_COOKIE_SECURE`.
  - `Path`: `/`.
- **CSRF Token Cookie (`pecp_csrf`):**
  - Double Submit Cookie pattern.
  - Non-HttpOnly cookie paired with mandatory `x-csrf-token` HTTP request header for state-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Safe methods (`GET`, `HEAD`, `OPTIONS`) are exempt from CSRF validation.
  - Server-side comparison utilizes `crypto.timingSafeEqual`.

### CORS Policy
- Configured via Fastify `@fastify/cors`.
- Explicit origin whitelist supplied via `PECP_ALLOWED_ORIGINS` (comma-separated list, e.g., `http://localhost:3000,http://localhost:5173`).
- Credentials enabled (`credentials: true`) to allow transmission of authenticated cookies.
- Allowed Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Allowed Headers: `Content-Type`, `Authorization`, `x-csrf-token`, `x-organisation-id`.

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
2. **Atomic Unit of Work Boundary:** In `IdentityAdministrationService.updateMembershipRole()` and `revokeMembership()`, the current membership lookup, the active administrator count verification, the database mutation, and the audit event recording are strictly executed inside the same serialized SQLite Unit of Work (`withTransaction`).
3. **Concurrency Protection:** Under concurrent attempts to demote or revoke the final two administrators, the serialized transaction ensures that exactly one operation succeeds while the subsequent conflicting operation is rejected with `Cannot demote/revoke the last ORG_ADMIN for this organisation`.
4. **No Overwrite via Creation:** `IdentityAdministrationService.addMembership()` inspects existing membership state within the transaction:
   - If an `ACTIVE` membership already exists, it immediately aborts with a controlled `409 Conflict` (`Active membership already exists`), preventing role hijacking or sole administrator demotion via POST requests.
   - If a `REVOKED` membership exists, it reactivates the membership while preserving the original `createdAt` and `createdByUserId` creation provenance.
5. **Universal Enforcement:** Even a `PLATFORM_ADMIN` actor cannot demote or revoke the sole active `ORG_ADMIN` of an organisation.

---

## 9. Audit Authority & Mutation-Denial Logging

### Transactional Audit Ledger
Every state change is recorded in the append-only `audit_events` ledger:
- `id`: Unique audit record identifier (`aud_...`).
- `actorUserId`: Attributed authenticated user ID.
- `actorEmail`: Actor email at the time of action.
- `organisationId`: Associated organisation (or null for platform-wide events).
- `action`: Specific governed action (e.g., `USER_CREATE`, `MEMBERSHIP_CREATE`, `MEMBERSHIP_ROLE_CHANGE`, `MEMBERSHIP_REVOKE`, `PROJECT_CREATE`, `INTELLIGENCE_APPROVE`, `AUTHORIZATION_DENIED`).
- `targetType` & `targetId`: Entity type and composite identifier.
- `outcome`: `SUCCESS` | `DENIED` | `FAILED`.
- `reason`: Description of failure or denial rationale.
- `metadataJson`: Structured parameters (roles, timestamps, diffs).
- `timestamp`: Immutable ISO-8601 UTC timestamp.

### Atomicity & Denial Auditing
- **Rollback Guarantee:** State mutations and audit entries share the identical database transaction. If audit insertion fails, the state mutation rolls back completely.
- **Denial Auditing:** Unauthorized mutation attempts generate an explicit `AUTHORIZATION_DENIED` audit record capturing the denied actor, targeted resource, and rule violation prior to throwing an HTTP 403 Forbidden response.

---

## 10. Bootstrap Process

On initial startup, if zero platform administrators exist in the database, the system executes an automated, idempotent bootstrap sequence using environment variables:
- `PECP_BOOTSTRAP_ADMIN_EMAIL` (default: `admin@pecp.io`)
- `PECP_BOOTSTRAP_ADMIN_PASSWORD` (default: `Admin123456!`)
- `PECP_BOOTSTRAP_ADMIN_NAME` (default: `Platform Administrator`)

If any user with `platformRole === 'PLATFORM_ADMIN'` already exists, the bootstrap process cleanly skips execution.

---

## 11. Explicit Scope Boundaries & Limitations

The following capabilities are deliberately out of scope for M5.1:
- Third-party social or enterprise SSO providers (OIDC, SAML, Azure AD / Entra ID, Okta, Google).
- Multi-Factor Authentication (MFA / 2FA) and WebAuthn / Passkeys.
- Out-of-band email delivery, email verification, and self-service password reset flows.
- SCIM automated user provisioning.
- Granular project-specific role assignments (roles remain organisation-scoped in M5.1).
- Attribute-Based Access Control (ABAC) or dynamic policy expressions.
