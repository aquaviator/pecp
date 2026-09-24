# Work Package: M5.1 — Identity, RBAC & Audit Authority

## Status

READY TO EXECUTE

## Objective

Add the trusted human-identity and authorization boundary required before PECP allows real users, real approvals, real connectors or AI-assisted write operations.

M5.1 must establish:

1. authenticated user identity;
2. organisation-scoped role membership;
3. deterministic server-side permission enforcement;
4. immutable audit attribution for governed mutations;
5. secure local authentication suitable for the customer-deployed MVP;
6. a provider seam for future enterprise identity;
7. authenticated portal session/login/logout;
8. authenticated intelligence conflict resolution and approval using the logged-in actor rather than user-supplied actor names.

The governing principle is:

**AI proposes. Systems verify. Humans decide.**

M5.1 makes the “human” in that statement an authenticated, attributable principal.

---

# 1. Governing documents

Read before implementation:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M5_0_CLOSURE.md`
- `docs/platform/M5_0_PLATFORM_ARCHITECTURE.md`
- `docs/platform/M5_0_API.md`
- all current `packages/platform-core` contracts/services
- all current `apps/api` persistence/API code
- current web service interfaces and API adapters

M0-M5.0 deterministic engineering semantics remain authoritative.

Do not redesign them.

---

# 2. Architectural decision

M5.1 uses a provider-shaped identity architecture with a secure embedded LOCAL identity provider for the Sellable MVP.

Future OIDC/SAML/enterprise identity must be able to replace authentication without changing RBAC, audit, canonical PE logic or application authorization semantics.

Dependency direction:

```
Web Portal
   ↓
Auth/API Clients
   ↓
Fastify Authentication Boundary
   ↓
Authenticated Principal
   ↓
Governed Application / Authorization Services
   ↓
Repository + Unit of Work
   ↓
SQLite Identity / Membership / Session / Audit Provider
```

Canonical PE engines remain independent.

---

# 3. Identity model

Add platform identity types to `@pecp/platform-core`.

## User

At minimum:

- id;
- email;
- displayName;
- status: ACTIVE | DISABLED;
- platformRole: PLATFORM_ADMIN | NONE;
- createdAt;
- updatedAt.

Email uniqueness must use a normalized lower-case comparison key while preserving the display/input email separately.

## Organisation Membership

At minimum:

- organisationId;
- userId;
- role;
- status: ACTIVE | REVOKED;
- createdAt;
- updatedAt;
- createdByUserId.

Organisation roles:

- ORG_ADMIN
- PERFORMANCE_LEAD
- PERFORMANCE_ENGINEER
- REVIEWER
- VIEWER

No project-specific roles in M5.1.

That is future scope.

## Authenticated Principal

At minimum:

- userId;
- email;
- displayName;
- platformRole;
- active organisation memberships;
- sessionId;
- authenticatedAt.

Never accept this structure from an API request body.

It is produced by the authentication boundary only.

---

# 4. Permission model

Use explicit permission strings and a deterministic role-to-permission mapping.

M5.1 permissions:

- ORGANISATION_READ
- ORGANISATION_MANAGE_MEMBERS
- PROJECT_READ
- PROJECT_CREATE
- PROJECT_UPDATE
- PROJECT_ARCHIVE
- INTELLIGENCE_READ
- INTELLIGENCE_RESOLVE
- INTELLIGENCE_APPROVE
- AUDIT_READ

`PLATFORM_ADMIN` is a global bypass for implemented M5.1 permissions.

Organisation role matrix:

## ORG_ADMIN

- ORGANISATION_READ
- ORGANISATION_MANAGE_MEMBERS
- PROJECT_READ
- PROJECT_CREATE
- PROJECT_UPDATE
- PROJECT_ARCHIVE
- INTELLIGENCE_READ
- INTELLIGENCE_RESOLVE
- INTELLIGENCE_APPROVE
- AUDIT_READ

## PERFORMANCE_LEAD

- ORGANISATION_READ
- PROJECT_READ
- PROJECT_CREATE
- PROJECT_UPDATE
- PROJECT_ARCHIVE
- INTELLIGENCE_READ
- INTELLIGENCE_RESOLVE
- INTELLIGENCE_APPROVE
- AUDIT_READ

## PERFORMANCE_ENGINEER

- ORGANISATION_READ
- PROJECT_READ
- PROJECT_CREATE
- PROJECT_UPDATE
- INTELLIGENCE_READ

## REVIEWER

- ORGANISATION_READ
- PROJECT_READ
- INTELLIGENCE_READ
- INTELLIGENCE_RESOLVE
- INTELLIGENCE_APPROVE
- AUDIT_READ

## VIEWER

- ORGANISATION_READ
- PROJECT_READ
- INTELLIGENCE_READ

Authorization rules must be implemented in server-side application/security services, not only hidden buttons in React.

---

# 5. Security semantics

## Authentication

Implement a LOCAL identity provider using only standard Node crypto primitives where practical.

Password hashing:

- use `crypto.scrypt`;
- random per-user salt;
- versioned algorithm metadata;
- timing-safe comparison;
- minimum password length 12;
- maximum password length 128;
- never log or audit raw passwords;
- never persist raw passwords.

Do not use reversible encryption for passwords.

## Sessions

Use opaque random session tokens.

Rules:

- raw session token is only delivered to the client cookie;
- persist only a SHA-256 hash of the session token;
- sessions have creation and expiry timestamps;
- disabled users cannot authenticate;
- disabling a user revokes active sessions;
- password reset/change revokes existing sessions.

Default session TTL may be 12 hours and must be configurable using:

`PECP_SESSION_TTL_HOURS`

## Cookies

Use secure browser session cookies.

Add `@fastify/cookie`.

Session cookie:

`pecp_session`

Requirements:

- HttpOnly;
- SameSite=Lax or stricter;
- Path=/;
- Secure configurable for local development vs production.

CSRF cookie:

`pecp_csrf`

Requirements:

- random value;
- readable by the web client;
- SameSite=Lax or stricter;
- state-changing browser requests send matching `X-PECP-CSRF`.

Mutation routes authenticated by cookie must reject missing/mismatched CSRF.

## CORS

Replace permissive `origin: true`.

Use explicit allowed origins configured by:

`PECP_ALLOWED_ORIGINS`

Default local development may allow:

`http://localhost:3000`

Enable credentialed requests.

Do not silently allow arbitrary browser origins.

---

# 6. Identity-provider seam

Define an authentication provider contract so LOCAL authentication is one provider, not hardwired into authorization logic.

The provider abstraction must be sufficient for a future OIDC implementation to produce the same trusted PECP principal/user identity.

Do not implement OIDC/SAML in M5.1.

Do not add external identity SDKs.

---

# 7. SQLite schema / migration

Add a new deterministic migration after the existing M5.0 migrations.

At minimum persist:

## users

- id
- email
- normalized_email UNIQUE
- display_name
- status
- platform_role
- created_at
- updated_at

## local_credentials

- user_id PK/FK
- algorithm
- salt
- password_hash
- params_json
- updated_at

## organisation_memberships

- organisation_id
- user_id
- role
- status
- created_at
- updated_at
- created_by_user_id
- PK/unique membership boundary

## sessions

- id
- user_id
- token_hash UNIQUE
- created_at
- expires_at
- revoked_at nullable
- authenticated_at

Never store the raw session token.

## audit_events

At minimum:

- id
- occurred_at
- actor_user_id nullable only for permitted unauthenticated security events
- actor_display_name nullable
- organisation_id nullable
- project_id nullable
- action
- target_type
- target_id nullable
- outcome: SUCCESS | DENIED | FAILURE
- reason nullable
- metadata_json nullable

Audit events are append-only.

No API may update/delete an audit event.

Do not claim cryptographic tamper evidence unless actually implemented.

---

# 8. Repository / service contracts

Add database-agnostic contracts for:

- IUserRepository
- IOrganisationMembershipRepository
- ISessionRepository
- IAuditRepository
- local credential persistence where appropriate

Add security/application services for:

- password hashing/verification;
- authentication;
- session creation/lookup/revocation;
- principal construction;
- permission evaluation;
- user administration;
- membership administration;
- audit append/query.

Identity/RBAC application services must not import Fastify or React.

Use the existing asynchronous Unit-of-Work boundary for mutations that must be atomic with audit.

---

# 9. Audit authority

Every successful governed mutation introduced/exposed by M5.1 must have an actor-derived audit event.

Actor identity must come from the authenticated principal.

Never accept:

- actorUserId;
- approverName;
- approvedBy;
- audit actor

from the client as authority.

At minimum audit:

- login success;
- login failure;
- logout;
- password change/reset;
- user create;
- user disable/enable;
- organisation create;
- organisation status change;
- membership create;
- membership role change;
- membership revoke;
- project create;
- project update;
- project archive;
- intelligence conflict resolution;
- intelligence approval;
- authorization denial for protected mutation attempts.

Do not include raw passwords/session tokens/CSRF values in metadata.

Where a mutation and audit event are both platform state, write them within one Unit of Work when practical.

Security-denial audit may be its own append because the denied mutation does not occur.

---

# 10. Bootstrap administrator

M5.1 must provide a safe deterministic way to create the first local platform administrator.

Implement a CLI/bootstrap command such as:

`npm run api:bootstrap-admin -- --email <email> --name <displayName>`

Password must come from a protected environment variable:

`PECP_BOOTSTRAP_ADMIN_PASSWORD`

Rules:

- never accept password as a normal CLI positional argument;
- never print it;
- enforce password policy;
- create a PLATFORM_ADMIN user;
- fail if a platform admin already exists unless an explicit future recovery path is implemented;
- audit the bootstrap event without including password material.

No unauthenticated HTTP “create admin” endpoint.

---

# 11. Authentication API

Add versioned endpoints.

## POST /api/v1/auth/login

Request:

- email
- password

Behavior:

- generic 401 for invalid credentials;
- no account enumeration;
- set session + CSRF cookies on success;
- return safe user/principal summary;
- audit success/failure.

## POST /api/v1/auth/logout

Authenticated.

Revokes current session and clears cookies.

## GET /api/v1/auth/me

Authenticated.

Returns current safe principal/profile and current permission summary.

Never return password hashes, session token hashes, salts or credential params unnecessarily.

## POST /api/v1/auth/change-password

Authenticated.

Requires current password + new password.

Revokes existing sessions and clears current session after successful change.

---

# 12. User administration API

PLATFORM_ADMIN only.

Add:

- GET `/api/v1/admin/users`
- POST `/api/v1/admin/users`
- GET `/api/v1/admin/users/:userId`
- PATCH `/api/v1/admin/users/:userId/status`
- POST `/api/v1/admin/users/:userId/reset-password`

Creation/reset requests may contain an initial/new password.

Never echo it in responses.

Never write it to audit metadata.

Disabling a user must revoke active sessions.

Prevent a user from disabling the only remaining active PLATFORM_ADMIN unless another active PLATFORM_ADMIN exists.

---

# 13. Organisation membership API

Require:

- PLATFORM_ADMIN; or
- active ORG_ADMIN membership for the target organisation.

Add:

- GET `/api/v1/organisations/:organisationId/memberships`
- POST `/api/v1/organisations/:organisationId/memberships`
- PATCH `/api/v1/organisations/:organisationId/memberships/:userId/role`
- POST `/api/v1/organisations/:organisationId/memberships/:userId/revoke`

Membership user must already exist.

Do not create a user implicitly from an email address.

When PLATFORM_ADMIN creates a new organisation, automatically create an active ORG_ADMIN membership for that actor inside the same Unit of Work.

When PLATFORM_ADMIN project creation auto-creates an organisation, the same rule applies.

Protect against accidental removal of the final active ORG_ADMIN unless the acting PLATFORM_ADMIN explicitly performs a supported recovery-safe transition.

---

# 14. Protect existing M5.0 API

Health/readiness remain public:

- GET /health
- GET /ready

Login is public.

All other operational `/api/v1` routes require authenticated identity unless explicitly stated.

Apply tenant-aware authorization:

## Organisations

Normal users list/read only organisations where they hold active membership.

PLATFORM_ADMIN may access all.

## Projects

Normal users list/read only projects belonging to organisations where they hold the required permission.

PLATFORM_ADMIN may access all.

Global:

`GET /api/v1/projects`

must no longer leak projects from organisations the user cannot access.

## Project create/update/archive

Require the corresponding project permission in the target organisation.

Auto-creation of an organisation during project creation is PLATFORM_ADMIN only.

A normal user cannot create a new tenant merely by supplying an unknown organisation name.

---

# 15. Intelligence authorization and real actor approvals

Replace the current M5.0 unsupported mutation boundary.

Add:

## POST /api/v1/projects/:projectId/intelligence/:itemId/resolve

Body:

- chosenCandidateId
- rationale optional

Do not accept approver/actor name.

Server uses authenticated principal.

Because existing conflict resolution promotes the chosen candidate into approved canonical state, require BOTH:

- INTELLIGENCE_RESOLVE
- INTELLIGENCE_APPROVE

Preserve established deterministic conflict-resolution semantics from the existing mock/reference implementation:

- chosen candidate value;
- candidate unit where supplied;
- candidate source/provenance fields;
- canonicalState -> APPROVED;
- reviewStatus -> FOUND;
- approvalState -> APPROVED;
- approvedBy -> authenticated display name;
- approvalDate -> server timestamp;
- history append from authenticated actor.

Add optional non-breaking:

`approvedById?: string`

to the canonical IntelligenceItem if required for stable actor attribution.

Do not remove existing `approvedBy`.

## POST /api/v1/projects/:projectId/intelligence/:itemId/approve

Require:

- INTELLIGENCE_APPROVE

Do not accept approverName as authority.

Set approval fields from authenticated principal only.

Both operations:

- persist the intelligence item;
- audit the action;
- use one Unit of Work;
- preserve provenance;
- never invent candidate data.

After conflict resolution, update source-backed project conflict count deterministically from remaining persisted conflicting intelligence items rather than trusting client state.

---

# 16. Authorization failure semantics

Use:

- 401 when no valid authenticated session exists;
- 403 when authenticated but permission is denied;
- 404 where resource concealment is appropriate for cross-tenant object access.

Be consistent.

Do not leak existence of another tenant's private resource where avoidable.

Audit protected mutation denials.

---

# 17. Web authentication layer

Add:

- IAuthService
- ApiAuthService
- AuthProvider/AuthContext
- login/logout/me handling
- protected application boundary

In API mode:

- unauthenticated user sees login;
- authenticated user sees portal;
- session is restored from `/api/v1/auth/me`;
- logout returns to login;
- API requests use `credentials: 'include'`;
- state-changing API requests send `X-PECP-CSRF` from the CSRF cookie.

Do not store password or raw session token in browser storage.

MOCK mode may continue to bypass real login for deterministic historical/reference testing.

Clearly label/structure that as MOCK mode only.

---

# 18. Shared API client

Refactor API adapters around a shared authenticated HTTP helper where useful.

It should consistently handle:

- API base URL;
- credentialed fetch;
- CSRF header for mutations;
- safe JSON parsing;
- error envelope handling;
- malformed response handling.

Do not introduce silent fallback behavior.

Preserve M5.0 list-envelope validation.

---

# 19. Permission-aware UI

The server remains authority.

The UI should still use the returned principal permissions to avoid presenting obviously forbidden controls.

At minimum:

- Intelligence conflict resolution button requires relevant permission;
- Intelligence approval button requires approval permission;
- Administration identity/member controls require admin permission;
- project-create control requires project-create permission;
- archive controls, if exposed, require archive permission.

A hidden button is not security.

Every server route must independently enforce permission.

---

# 20. Administration UI

Extend the Administration area in API mode with a practical but narrow identity view.

At minimum:

## Current Identity

- display name;
- email;
- platform role;
- organisation memberships/roles.

## User Administration

Visible to PLATFORM_ADMIN:

- list users;
- create user;
- enable/disable;
- reset password.

## Membership Administration

For authorised org admins/platform admin:

- list memberships;
- add existing user;
- change role;
- revoke membership.

Do not implement:

- email invites;
- SCIM;
- directory sync;
- SSO configuration.

Those are future work.

---

# 21. Audit UI / API

Add read API:

- GET `/api/v1/audit`

Support conservative query filters such as:

- organisationId;
- projectId;
- actorUserId;
- action;
- limit;
- before/after cursor or timestamp if straightforward.

Require:

- PLATFORM_ADMIN; or
- AUDIT_READ for the requested organisation.

Never allow a user to query another organisation's audit log without authority.

Add a minimal portal audit view under Administration or project governance.

Display source fields exactly.

No inferred explanation/root cause.

---

# 22. Security-sensitive invariants

1. Raw passwords never persisted.
2. Raw session tokens never persisted.
3. Password/session/CSRF values never appear in audit metadata.
4. Actor identity comes only from authenticated context.
5. Client-supplied approver names never become authority.
6. Authorization occurs server-side for every protected route.
7. Project/organisation listing is tenant-filtered.
8. Disabled users cannot keep active sessions.
9. Password reset/change invalidates old sessions.
10. No API-mode mock identity fallback.
11. No unauthenticated admin bootstrap HTTP route.
12. Audit records are append-only.
13. M0-M5.0 canonical PE semantics remain unchanged.
14. AI remains outside the security boundary.

---

# 23. Required tests

Add deterministic comprehensive coverage.

## Password / credential tests

- scrypt hash != raw password;
- verification success/failure;
- salt uniqueness;
- timing-safe comparison path;
- password policy;
- no credential material in safe user outputs.

## Session tests

- session token is random;
- DB stores token hash, not raw token;
- expiry enforced;
- revoke enforced;
- disable user revokes sessions;
- password change/reset revokes sessions.

## Authentication API

- login success;
- bad email/password returns generic 401;
- disabled user cannot login;
- auth/me;
- logout;
- cookie flags;
- CSRF cookie/header behavior;
- mutation without CSRF rejected;
- public health/ready still work.

## RBAC matrix tests

For every role, prove allowed and denied permissions.

At minimum test:

- VIEWER cannot create/update/approve;
- PERFORMANCE_ENGINEER cannot approve;
- REVIEWER can approve but cannot manage membership;
- PERFORMANCE_LEAD can resolve/approve;
- ORG_ADMIN can manage memberships;
- PLATFORM_ADMIN can administer across organisations.

## Tenant leakage tests

Use at least two organisations and multiple users.

Prove:

- Org A user cannot list Org B projects;
- cannot GET Org B project by direct ID;
- cannot read Org B intelligence;
- cannot read Org B audit;
- cannot mutate Org B membership/project/intelligence.

## Audit tests

Prove:

- actor comes from session, not request body;
- successful governed mutation creates audit event;
- denied protected mutation creates denial event where required;
- audit metadata contains no password/session/CSRF secret;
- audit events cannot be updated/deleted through API.

## Intelligence approval tests

Prove:

- unauthenticated -> 401;
- viewer/engineer denied;
- permitted actor can approve;
- permitted actor can resolve conflict;
- selected candidate provenance is preserved;
- authenticated actor display + stable ID are recorded;
- audit event records same actor;
- client-supplied fake approver name cannot override actor;
- project conflict count updates from remaining persisted conflict state.

## Bootstrap admin tests

- first bootstrap succeeds;
- password not printed/returned;
- second bootstrap fails when platform admin already exists;
- resulting user can login.

## Concurrent security tests

Preserve all M5.0 transaction concurrency tests.

Add at least one concurrent role/membership or approval mutation test to ensure audit + entity state remain transactionally correct.

---

# 24. Reference security scenario

Add a synthetic non-RetailCo authorization scenario.

Example:

Organisation A: Northstar Retail
- Alice Admin — ORG_ADMIN
- Peter Lead — PERFORMANCE_LEAD
- Erin Engineer — PERFORMANCE_ENGINEER
- Rita Reviewer — REVIEWER
- Victor Viewer — VIEWER

Organisation B: Contoso Payments
- separate user/member.

Prove tenant isolation and role behavior without changing RetailCo engineering truth.

Do not make this fixture a source of workload/NFR engineering values.

---

# 25. CI integration

Normal root CI remains authoritative.

Update scripts/workspaces/lockfile as required.

Normal CI must continue to run:

1. `npm ci`
2. root TypeScript checks
3. web tests
4. API/platform/security tests
5. RetailCo Reference Lab
6. production web build

Do not create a hidden alternate security CI.

Keep npm 10.9.8 lockfile deterministic.

---

# 26. Documentation

Create:

`docs/security/M5_1_IDENTITY_RBAC_ARCHITECTURE.md`

Document:

- identity model;
- local auth provider;
- future enterprise provider seam;
- password hashing;
- session lifecycle;
- cookies/CSRF;
- CORS;
- principal construction;
- permission matrix;
- tenant rules;
- audit model;
- bootstrap process;
- explicit limitations.

Create:

`docs/security/M5_1_SECURITY_OPERATIONS.md`

Document:

- bootstrap admin;
- creating/disabling users;
- resetting password;
- assigning/revoking memberships;
- session TTL configuration;
- allowed origins;
- secure cookie setting;
- recovery/lockout considerations.

Update API docs for implemented M5.1 endpoints only.

---

# 27. Strict scope guard

M5.1 must NOT implement:

- OIDC;
- SAML;
- Entra ID integration;
- Google login;
- Okta/Auth0 integration;
- SCIM;
- MFA;
- passkeys;
- email invitations;
- password recovery email;
- billing;
- subscription enforcement;
- Jira/ADO/Confluence/SharePoint live connectors;
- BYOAI;
- document extraction;
- production runner orchestration;
- Kubernetes/Helm;
- project-specific RBAC;
- attribute-based access control;
- service accounts/API keys.

Design seams may anticipate these.

Do not implement them.

---

# 28. Carry-forward M5.0 hardening items

While touching related code, close these non-blocking M5.0 carry-forward items if straightforward:

1. remove the historical initial React conflict counter default of `3`; use nullable/source-driven state;
2. validate every `uploadedDocumentNames` element is a string at API/persistence boundaries;
3. do not expose future intelligence writes through the old synchronous transaction helper.

Do not reopen M5.0.

Treat these as M5.1 hygiene only.

---

# 29. Definition of Done

M5.1 is complete when:

1. local authenticated users exist;
2. secure password hashing exists;
3. opaque persisted sessions work without raw token persistence;
4. browser login/logout/session restore works;
5. CSRF protection exists for cookie-authenticated mutations;
6. CORS is no longer permissive;
7. role/membership model exists;
8. deterministic RBAC is enforced server-side;
9. API data access is tenant-filtered;
10. platform/user/membership admin APIs exist;
11. intelligence resolution/approval uses authenticated actor identity;
12. client-supplied approver identity cannot become authority;
13. audit events attribute governed mutations;
14. audit read access is permission-scoped;
15. bootstrap admin path exists without unauthenticated HTTP bootstrap;
16. disabled users/session revocation works;
17. no API-mode mock security fallback exists;
18. M5.0 concurrency/persistence tests remain green;
19. M0-M4 engineering semantics remain green;
20. normal GitHub CI is green.

---

# 30. Completion report

When implementation is complete:

- commit;
- push to `master`;
- wait for normal GitHub CI.

Return:

# M5.1 Completion Report for PM Audit

Include:

- implementation SHA;
- GitHub CI run ID/job ID/conclusion;
- exact test counts by suite;
- migrations/schema added;
- identity model;
- role/permission matrix;
- password/session implementation;
- bootstrap mechanism;
- authentication endpoints;
- user/membership endpoints;
- protected API behavior;
- tenant-isolation proof;
- intelligence actor-authority proof;
- audit model and examples;
- CSRF/CORS behavior;
- web login/session/admin implementation;
- M5.0 carry-forward hygiene completed;
- known limitations;
- confirmation M5.2 was not started.

Do not self-close M5.1.

Do not begin M5.2.
