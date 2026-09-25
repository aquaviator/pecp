# PECP M5.1 Project Manager Review

## Latest verdict

**M5.1: HOLD / NOT CLOSED**

This follow-up reviews implementation `a50ff4040f095ce774d48029bfeed61339d53966` against the existing M5.1 work package and the previous PM review committed at `c6fcdfa3ff3d0004f86548cd47c91dbce6c97e06`.

Correct M5.1 in place. Do not create M5.1.1 and do not start M5.2.

This is a source review and inspection of actual GitHub Actions evidence, not a claim that the PM independently ran the local test suite. Accepted source changes below remain subject to successful clean CI and the applicable regression tests.

## 1. Authoritative implementation and verification

- Repository: `aquaviator/pecp`
- Audited branch: `master`
- Implementation SHA: `a50ff4040f095ce774d48029bfeed61339d53966`
- Workflow: `CI`
- Run ID: `36123203003`
- Job ID: `108033282058`
- Remote conclusion: **FAILURE**
- Failed step: **Install dependencies (deterministic)**
- TypeScript, tests and production build: **SKIPPED in this remote run**

The run is bound to the audited implementation SHA. Its logs show Node v22.23.2 and npm 10.9.8, followed by:

```text
npm error code EUSAGE
npm ci can only install packages when package.json and package-lock.json are in sync.
Missing: @fastify/cookie@11.1.2 from lock file
Missing: cookie@2.0.1 from lock file
```

The submitted local totals are arithmetically consistent:

- Web: 487
- API: 83
- Reference Lab: 10
- Total: 580

These remain **reported local results**, not verified remote results. This remote run did not execute those suites. No claim is made here that the tests themselves failed.

## 2. Previous corrections now present in source

The remaining task is smaller than the original twelve-point correction. Do not discard or rewrite the corrections already present.

### Application authentication boundary

`apps/web/src/App.tsx` now mounts:

```text
ServiceProvider
  -> AuthProvider
    -> AuthenticatedAppBoundary
      -> AppContent
```

The boundary contains API-mode session-loading, login and authenticated portal states. MOCK mode retains an AuthContext-backed reference path. The initial conflict count is now `number | null`, initialized to `null`, rather than the historical value of 3.

### Authenticated project and intelligence clients

`ApiProjectService` and `ApiIntelligenceService` now delegate to the shared `ApiClient`. Existing collection-envelope checks and error propagation are retained. Intelligence mutation payloads do not send a trusted approver identity.

### Security mutations and audit atomicity

`IdentityAdministrationService` now accepts `IUnitOfWork`; the API factory supplies the SQLite unit of work. User creation, status changes, credential changes, and membership writes place their persistent mutation and success audit inside that boundary.

`apps/api/test/identity_atomic_rollback.test.ts` contains six failure-injection cases covering user creation, user disable, password reset, membership creation, membership role change and membership revocation.

This addresses the prior missing write/audit transaction boundary. The separate last-administrator check placement problem is described below.

### Mutation-denial auditing

Protected mutation denial audit calls have been added, including membership routes. `apps/api/test/mutation_denial_audit.test.ts` contains regressions for project creation/update/archive, membership mutations, intelligence approval and administrative user-creation denial. Its project fixture now supplies `organisation`.

`SqliteAuditEventRepository` query-helper additions are present in the commit. Their presence is not, by itself, proof that every authorization or audit requirement is complete.

### Membership directory access

The membership list route now requires `ORGANISATION_MANAGE_MEMBERS`; the identity service restricts membership listing to PLATFORM_ADMIN or the target organisation's ORG_ADMIN. Preserve this restriction and the original role matrix.

### Password-change lifecycle and authentication timestamp

The password-change route now clears session and CSRF cookies after revocation instead of issuing a replacement session. Principal restoration receives the validated session's persisted `authenticatedAt`; login also copies the created session's authentication timestamp into its returned principal.

### Final ORG_ADMIN sequential check

Demotion/revocation no longer exempt PLATFORM_ADMIN from the final-ORG_ADMIN guard. This fixes the direct sequential exception but does not yet make the invariant complete under concurrency or the membership-create endpoint.

## 3. Remaining blocker A: the pushed lockfile is still inconsistent

This is the same dependency-installation blocker, not a new requirement.

The implementation commit still cannot pass clean `npm ci` in normal GitHub CI.

Required correction:

1. Confirm the working directory is the repository root, not a nested sandbox export directory.
2. Confirm the approved Node/npm environment, including npm 10.9.8.
3. Synchronize the root lockfile against the root and workspace package manifests.
4. Commit the actual updated `package-lock.json` alongside any dependency changes.
5. Verify a clean installation and the normal lint/test/build commands from an isolated checkout or worktree.
6. Push the implementation and bind the new report to the CI run for that exact SHA.

Do not replace `npm ci` with `npm install` in CI. Do not add a fallback installation command. Do not treat a cached sandbox build as evidence that the pushed lockfile is correct.

## 4. Remaining blocker B: final-administrator protection is incomplete

This is completion of the existing last-ORG_ADMIN and concurrent-security requirements, not a new milestone or feature.

### B1. The guard runs before the transaction lock

In `IdentityAdministrationService.updateMembershipRole()` and `revokeMembership()`, the current membership read and `countActiveAdmins()` check happen before `withTransaction()` acquires the unit-of-work boundary.

The write and audit are atomic, but the decision to permit removal is not protected by that same transaction.

A permitted interleaving is:

1. Organisation has two active ORG_ADMIN memberships.
2. Two independent removal/demotion operations each read a count of two before either acquires the mutation transaction.
3. Both pass the check.
4. Their writes serialize, but neither repeats the guard inside the transaction.
5. Both removals can complete, leaving zero active ORG_ADMIN memberships.

This is a source-derived concurrency finding. It has not been exercised against a deployed customer instance during this audit.

Required correction:

- Move the current membership read, applicable administrator-count check, mutation and audit inside the same serialized unit of work.
- Re-evaluate the relevant authority/state at the write boundary rather than relying on a pre-lock snapshot.
- Preserve rollback behavior and audit attribution.
- Add an async-barrier regression starting with two administrators and attempting concurrent demotions/revocations. At least one usable administrator must remain; rejected changes must not partially persist.

### B2. Membership creation can overwrite an existing administrator

`IdentityAdministrationService.addMembership()` constructs a new membership and calls `membershipRepo.save()` without checking for an existing membership.

`SqliteOrganisationMembershipRepository.save()` implements an UPSERT:

```text
ON CONFLICT(organisation_id, user_id) DO UPDATE
  role = excluded.role,
  status = excluded.status,
  updated_at = excluded.updated_at
```

Consequently, the POST membership-create path can change an existing ORG_ADMIN to VIEWER without passing through the role-change method's final-administrator check. It can also describe an overwrite as MEMBERSHIP_CREATE rather than the actual role transition.

Required narrow correction:

- For an existing active membership, return a controlled 409 conflict from the create path and require the governed role-change endpoint, or route the operation through exactly the same guarded transition.
- Do not silently overwrite an existing active membership.
- Define any revoked-membership reactivation behavior explicitly; do not use it as a role-change bypass or rewrite original creation provenance.
- Perform the existence check and any permitted insertion/reactivation atomically.

Required tests:

- Re-posting the sole ORG_ADMIN as VIEWER cannot remove administrator authority.
- Duplicate active-membership creation cannot silently change role, status or creation provenance.
- The public API and direct application-service behavior agree.
- Both PLATFORM_ADMIN and ORG_ADMIN actors are covered.
- Concurrent removal tests cover demotion and revocation, with audit/state consistency.

## 5. Remaining blocker C: required security documents and completion report are absent

At the audited SHA, direct repository reads did not find:

- `docs/security/` containing the required M5.1 documents;
- `docs/M5_1_COMPLETION_REPORT.md`.

The commit removes the report previously placed under `app/applet/docs/`; removing the misplaced copy does not create its required replacement.

Create and commit:

1. `docs/security/M5_1_IDENTITY_RBAC_ARCHITECTURE.md`
2. `docs/security/M5_1_SECURITY_OPERATIONS.md`
3. `docs/M5_1_COMPLETION_REPORT.md`

Ensure the implemented API documentation is current as required by the original work package.

The documents must describe the actual runtime hierarchy, LOCAL authentication provider, role matrix, tenant boundaries, session lifecycle, CSRF/CORS configuration, bootstrap process, administrator protection, audit transaction boundary and current limitations. Preserve the correct REVIEWER permissions; do not copy the erroneous matrix from the first completion report.

The report must distinguish implementation SHA, documentation commit, local verification and remote CI. If remote CI is unavailable or incomplete, say so. Do not invent workflow identifiers or assert remote success from local logs.

## 6. Verification and closure process

Preserve all historical M0-M5.0 tests and current M5.1 security tests. Execute the normal repository pipeline:

```text
npm ci
npm run lint
npm run test
npm run build
```

Retain and verify the originally required evidence for:

- real application authentication gate and logout/session restoration;
- credentialed project/intelligence calls and CSRF;
- identity mutation/audit rollback;
- protected mutation-denial audit;
- membership-directory access restrictions;
- final administrator protection, including the concurrency and alternate-endpoint paths above;
- forced reauthentication after password change;
- stable session authenticatedAt;
- tenant filtering and no API-mode mock fallback.

Do not report a source-level change as a passing runtime test unless it was actually executed. Do not claim a browser walkthrough from static-render tests alone.

Return an updated **M5.1 Completion Report for PM Audit** containing:

- actual implementation SHA;
- GitHub workflow run and job IDs bound to that SHA;
- remote conclusion and step outcomes;
- exact web/API/reference-lab counts from that run;
- clean-lockfile confirmation;
- final-administrator regression results;
- required documentation paths;
- any remaining limitations;
- confirmation M5.2 has not started.

## Programme state

**M5.0 CLOSED -> M5.1 implementation corrections largely present / HOLD on deterministic CI, final-administrator integrity and missing documentation -> M5.2 NOT STARTED.**

This review does not close M5.1, does not reopen M5.0, and does not authorize additional product scope.
