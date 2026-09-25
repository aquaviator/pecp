# PECP M5.1 Project Manager Review

## Verdict

**M5.1 — HOLD / NOT CLOSED**

The implementation is substantial and contains much of the intended M5.1 security platform, but the submitted completion report does not match authoritative remote GitHub state and several material security/authority requirements remain incomplete.

Do **not** create M5.1.1.

Correct M5.1 in place and return for independent PM audit.

---

# 1. Authoritative remote state

Current M5.1 implementation SHA on `master`:

`c3d7b30cd9b0b790f2d6c7110688d63897734bc2`

Actual GitHub Actions run:

`36118527448`

Actual job:

`108018222994`

Conclusion:

**FAILURE**

The failure occurs during deterministic dependency installation:

`npm ci`

GitHub reports:

- `package.json` and `package-lock.json` are out of sync;
- `@fastify/cookie@11.1.2` is missing from the lockfile;
- `cookie@2.0.1` is missing from the lockfile.

TypeScript, tests and production build were therefore skipped remotely.

The locally reported test suite is useful development evidence but is not authoritative CI evidence until normal GitHub CI is green.

The completion report's implementation reference `c109d6bc-2992-4b64-9537-dd9af9f40546` is not the authoritative Git commit.

---

# 2. What is accepted

The implementation direction is strong and the following are present:

- M5.1 identity types in `@pecp/platform-core`;
- LOCAL authentication provider seam;
- native Node `scrypt` password hashing;
- timing-safe password comparison;
- opaque random sessions with SHA-256 token hashes persisted rather than raw tokens;
- user, credential, membership, session and append-only audit persistence;
- deterministic role/permission policy matching the M5.1 work package;
- tenant-filtered organisation/project API behavior;
- Fastify cookie support;
- configured CORS allowlist;
- CSRF protection for cookie-authenticated mutations;
- user administration APIs;
- membership APIs;
- audit read API;
- authenticated intelligence resolve/approve routes;
- stable actor identity fields including `approvedById`;
- project conflict-count recomputation from persisted intelligence;
- CLI bootstrap-admin implementation;
- API-mode Auth/Admin adapters;
- login page, AuthContext and administration UI components;
- security/reference/concurrency test suites.

These are correct foundations.

---

# 3. Blocking corrections

## Blocker 1 — deterministic lockfile / remote CI

Synchronize the root `package-lock.json` using npm 10.9.8.

Required:

- run the repository-approved install workflow;
- commit the lockfile;
- prove clean root `npm ci`;
- push to `master`;
- wait for normal GitHub `CI`.

Do not change CI to use `npm install`.

---

## Blocker 2 — the web authentication boundary is not actually wired into the application

The repository contains:

- `AuthProvider`;
- `LoginPage`;
- `useAuth()`;
- permission-aware portal components.

But the live application entry still renders:

`<App />`

and `App` renders:

`<ServiceProvider><AppContent /></ServiceProvider>`

without an `AuthProvider` or authenticated application gate.

Consequences:

- API-mode users are not presented with the login flow;
- session restore is not performed as an application gate;
- `AppHeader`, `IntelligencePage` and `AdministrationPage` call `useAuth()` without an enclosing provider and can throw;
- the claimed login/session UI is not integrated into the actual portal.

### Required correction

Wire the actual runtime hierarchy, for example:

`ServiceProvider -> AuthProvider -> AuthenticatedAppBoundary -> AppContent`

Behavior:

### API mode

- while restoring `/auth/me`, render a neutral loading state;
- unauthenticated -> `LoginPage`;
- authenticated -> portal;
- logout -> login;
- refresh restores the session.

### MOCK mode

- deterministic mock/reference operation may bypass real login, but it must still provide a valid AuthContext so permission-aware components do not crash.

Add integration tests proving the actual `App` runtime follows this behavior.

---

## Blocker 3 — existing Project/Intelligence API clients are not consistently credentialed

M5.1 introduced a shared credentialed `ApiClient`, but the existing adapters were not fully migrated.

`ApiProjectService` still uses direct `fetch()` calls without:

`credentials: 'include'`

and its project-create mutation does not use the shared CSRF behavior.

The read side of `ApiIntelligenceService` also uses direct `fetch()` without credentialed cookies.

In the normal development topology:

- web: localhost:3000
- API: localhost:3001

these are cross-origin fetches.

The authenticated session cookie therefore will not reliably accompany those calls.

The result is a portal that can successfully log in but then receive 401 responses from project/intelligence operations.

### Required correction

Refactor all API-mode adapters through the shared authenticated `ApiClient` where practical:

- `ApiProjectService`;
- `ApiIntelligenceService`;
- `ApiAuthService`;
- `ApiAdminService`.

Preserve:

- `credentials: include`;
- CSRF injection for mutations;
- safe error-envelope behavior;
- M5.0 malformed-list-envelope validation;
- no silent mock fallback.

Add adapter/integration tests proving authenticated cookies and CSRF are used by project and intelligence mutations.

---

## Blocker 4 — identity/membership mutations and their audit events are not transactionally atomic

The M5.0 platform correctly established an asynchronous `IUnitOfWork`.

`PlatformApplicationService` uses it for project/organisation/intelligence mutation + revision/audit work.

However, `IdentityAdministrationService` does not use `IUnitOfWork`.

Current multi-step security mutations include separate repository/audit calls for operations such as:

- user create + credential + audit;
- user disable + session revocation + status update + audit;
- password reset + credential + session revocation + audit;
- password change + credential + session revocation + audit;
- membership create + audit;
- membership role change + audit;
- membership revoke + audit.

If a later audit/repository write fails, earlier security state may remain committed without its required audit evidence.

The current concurrent-security test proves a happy-path event count. It does not inject audit failure and prove rollback.

### Required correction

Inject/use the existing asynchronous `IUnitOfWork` in the identity administration/application boundary.

Wrap governed security mutations atomically where they contain multiple persistent writes and audit events.

Add failure-injection tests proving, at minimum:

- failed USER_CREATE audit rolls back user + credential;
- failed USER_DISABLE audit rolls back status/session changes;
- failed PASSWORD_RESET audit rolls back credential/session changes;
- failed MEMBERSHIP_CREATE audit rolls back membership;
- failed MEMBERSHIP_ROLE_CHANGE audit rolls back role;
- failed MEMBERSHIP_REVOKE audit rolls back revocation.

Keep login-failure auditing independent where no platform mutation occurs.

---

## Blocker 5 — protected mutation denials are not consistently audited

M5.1 requires authorization denial audit for protected mutation attempts.

Several Fastify routes perform permission checks and return `403` directly before calling a service that would record `AUTHORIZATION_DENIED`.

Examples include route-level denial paths for:

- membership mutations;
- project mutations;
- intelligence resolution/approval;
- some administrative operations.

These denials can therefore disappear from the audit authority.

### Required correction

Centralize or consistently implement protected-mutation authorization denial auditing.

For every protected mutation route:

- authenticated but insufficient permission -> 403;
- append `AUTHORIZATION_DENIED`;
- include safe target/action context;
- never include password/session/CSRF material.

Add route-level denial audit regressions.

Do not audit every harmless GET denial unless required.

---

## Blocker 6 — organisation membership read access is too broad

The M5.1 work package states that the Organisation Membership API requires:

- PLATFORM_ADMIN; or
- active ORG_ADMIN for the target organisation.

Current:

`GET /api/v1/organisations/:organisationId/memberships`

checks only:

`ORGANISATION_READ`

That allows roles such as VIEWER, REVIEWER, PERFORMANCE_ENGINEER and PERFORMANCE_LEAD to enumerate the organisation membership directory.

### Required correction

Membership list/add/change/revoke must require:

- PLATFORM_ADMIN; or
- active ORG_ADMIN for that organisation.

Add explicit negative tests for VIEWER / REVIEWER / PERFORMANCE_ENGINEER / PERFORMANCE_LEAD membership-list access.

---

## Blocker 7 — final ORG_ADMIN protection can leave an organisation orphaned

Current membership demotion/revocation logic prevents removal of the final ORG_ADMIN only when the acting user is not a PLATFORM_ADMIN.

A PLATFORM_ADMIN may therefore demote or revoke the final active ORG_ADMIN and leave the organisation without an organisation administrator.

The work package requires a recovery-safe transition.

### Required correction

For M5.1, use the safest narrow rule:

- never demote/revoke the final active ORG_ADMIN unless another active ORG_ADMIN already exists.

A future explicit atomic transfer/recovery workflow may relax this later.

Add tests for both ORG_ADMIN and PLATFORM_ADMIN actors.

---

## Blocker 8 — password-change session lifecycle differs from the governing specification

The work package requires password change/reset to revoke existing sessions and states that self password change clears the current session after success.

Current `change-password`:

1. revokes existing sessions;
2. immediately creates a replacement session;
3. issues new session/CSRF cookies.

That means the user remains authenticated after password change.

### Required correction

Follow the work package:

- successful password change revokes all sessions;
- clear current session and CSRF cookies;
- return success;
- require explicit login with the new password.

Update API/web tests and UX accordingly.

---

## Blocker 9 — authenticatedAt is not projected from the authenticated session

`LocalAuthenticationProvider.buildPrincipal()` currently assigns:

`authenticatedAt: new Date().toISOString()`

each time a principal is reconstructed.

Therefore `GET /auth/me` can report a fresh authentication time on each request rather than the actual session authentication timestamp persisted in `sessions.authenticated_at`.

### Required correction

Build the principal from the validated session's authoritative:

- sessionId;
- authenticatedAt.

Do not manufacture a new authentication timestamp during principal restoration.

Add a session-restoration test proving `authenticatedAt` remains stable across requests.

---

## Blocker 10 — required security documentation is missing

The work package requires:

- `docs/security/M5_1_IDENTITY_RBAC_ARCHITECTURE.md`
- `docs/security/M5_1_SECURITY_OPERATIONS.md`

Neither is present on authoritative `master`.

The completion report is currently under:

`app/applet/docs/M5_1_COMPLETION_REPORT.md`

rather than the expected top-level project documentation area.

### Required correction

Create the two required security documents and update the M5.0/M5.1 API documentation for implemented endpoints.

Move/create the completion report under:

`docs/M5_1_COMPLETION_REPORT.md`

Do not document unimplemented/future capabilities as present.

---

## Blocker 11 — the completion report's role/security facts do not match the implementation

The actual `AuthorizationPolicy` matches the governing work package:

### PERFORMANCE_ENGINEER

- cannot resolve;
- cannot approve;
- cannot audit.

### REVIEWER

- can resolve;
- can approve;
- can audit.

The submitted report states the opposite for conflict resolution/reviewer authority.

Other report mismatches include:

- code default session TTL = **12 hours**, not seven days;
- code uses `PECP_ALLOWED_ORIGINS`, not `PECP_CORS_ORIGIN`;
- code uses `X-PECP-CSRF`, not `x-csrf-token`;
- login does **not** return the raw session token in the JSON body;
- authoritative implementation is a Git SHA, not the supplied UUID reference;
- reported remote run/job identifiers do not correspond to the GitHub repository.

Correct the completion report to the actual implementation.

Do not change correct RBAC code to match the incorrect report.

---

## Blocker 12 — M5.0 carry-forward conflict counter is still hardcoded

The report states the historical initial conflict counter of `3` was removed.

Current `apps/web/src/App.tsx` still contains:

`useState(3)`

This is the exact M5.0 carry-forward item that M5.1 was asked to close.

### Required correction

Make the value nullable/source-driven.

Do not initialize a generic project portal with RetailCo-shaped conflict state.

Add a regression.

---

# 4. Additional PM observations

These are not separate blockers if the items above are corrected as part of the same pass:

- The shared web `ApiClient` is the right direction and should become the single authenticated request path.
- The server-side RBAC matrix in `AuthorizationPolicy` is correct. Preserve it.
- The use of an Authorization Bearer session-token path is broader than required for the browser MVP. Do not expand it into API-key/service-account semantics in M5.1. If retained for test/automation compatibility, document it precisely and do not claim an API-key feature.
- Audit metadata sanitization should remain conservative. If arbitrary nested metadata is introduced later, recursive secret redaction will be safer than top-level-key filtering.
- Login failure may remain an unauthenticated security audit event.
- OIDC/SAML/MFA/SCIM remain out of scope.

---

# 5. Required verification before resubmission

From a clean repository state:

1. `npm ci` — PASS
2. TypeScript — PASS
3. web tests — PASS
4. API/platform/security tests — PASS
5. RetailCo Reference Lab — PASS
6. production web build — PASS
7. actual App authentication-gate tests — PASS
8. credentialed Project/Intelligence API client tests — PASS
9. identity mutation + audit rollback failure-injection tests — PASS
10. protected-mutation denial audit tests — PASS
11. membership-read authorization tests — PASS
12. final ORG_ADMIN protection tests — PASS
13. password-change forced reauthentication test — PASS
14. stable `authenticatedAt` restoration test — PASS
15. M5.0 concurrency/persistence regressions — PASS
16. normal GitHub `CI` — SUCCESS

---

# 6. Closure condition

M5.1 may close only when:

- remote deterministic CI is green;
- the portal actually enforces/restores login in API mode;
- existing API adapters operate correctly with cookie authentication and CSRF;
- security mutations and their required audit records are atomic;
- protected mutation denials are auditable;
- membership administration access follows the work-package boundary;
- organisations cannot be left without an active ORG_ADMIN;
- password changes revoke/clear sessions as specified;
- principal authentication time is source-backed;
- required security documentation exists;
- the completion report accurately describes the implementation;
- the historical conflict-counter default is removed;
- M5.2 remains unstarted.

No M5.2 product scope is required to close these gaps.

## Programme state

`M5.0 ✅ → M5.1 substantial implementation / HOLD on CI + runtime auth integration + security authority fidelity → M5.2 NOT STARTED`
