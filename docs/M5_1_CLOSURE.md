# PECP M5.1 Closure

## Milestone and decision

**M5.1: Identity, RBAC & Audit Authority**

**Status: CLOSED**

Closure date: 2026-09-28.

The final independent PM sign-off accepts the defined M5.1 work package after implementation corrections, successful remote CI and the five documentation-only corrections. The controlling review is `docs/M5_1_PM_REVIEW.md`, approved in commit `481f81b75670c2b5203f42e4d48622bce9fbbdc6`.

This is milestone acceptance, not a production release authorization, security certification or claim that no defects remain.

## Authoritative evidence

| Item | Reference |
| --- | --- |
| Repository / branch | `aquaviator/pecp` / `master` |
| Accepted runtime implementation | `0f3f3f3b7541fa73c4c3bd5260f12235daa0b9fe` |
| Runtime implementation CI | Run `36430335260`, job `108954578668`, SUCCESS |
| Final remote documentation revision | `7e3b90bf122a3b23d50cb9667e131b60fdaf18fb` |
| Final revision CI | Run `36431793119`, job `108959547758`, SUCCESS |
| Root lockfile blob | `0d1d756a8c7fb7298b0fa5c4b23456f885ecf97b` |
| CI runtime | Node v22.23.2, npm 10.9.8 |

The final documentation revision changes only the completion report, API documentation, identity architecture document and security operations document. It does not change application code, dependencies, tests, RBAC or transaction behavior relative to the accepted runtime implementation.

## Verification observed in final remote CI

- Real deterministic `npm ci`: PASS.
- Root TypeScript checks: PASS.
- Web: 30 Vitest files, 487 tests passed.
- API/platform: 17 Vitest files, 86 tests passed.
- RetailCo Reference Lab: 10 tests passed.
- Combined: 583 passing tests, zero failed.
- Production web build: PASS.

The PM inspected remote source/diffs, CI metadata and job logs. The PM did not conduct an independent browser walkthrough or local rerun during the documentation sign-off.

## Accepted capability

M5.1 adds the implemented LOCAL identity and organisation-scoped authorization layer to the M5.0 persistent platform, including:

- user, credential, membership, session and audit persistence;
- salted scrypt password hashing and opaque session tokens stored as hashes;
- login, logout, session restoration and password-change session revocation;
- cookie-authenticated browser requests with CSRF handling;
- deterministic server-side role permissions and tenant-filtered access;
- authenticated project and intelligence API clients;
- user and membership administration;
- authenticated actor attribution for intelligence resolution and approval;
- governed security mutations with required transactional success-audit writes;
- tested protected-mutation denial auditing;
- tested final-ORG_ADMIN demotion/revocation protection under concurrency;
- rejection of duplicate active-membership creation rather than role overwrite;
- membership reactivation retaining original creation provenance;
- bootstrap through the existing root npm script;
- security architecture, operational and API documentation.

These accepted behaviors are bounded by the reviewed source and regression coverage. They are not an exhaustive guarantee against every threat or administrative race.

## Documentation sign-off

All five final corrections are accepted:

1. Bootstrap instructions use `npm run api:bootstrap-admin`, required password input and an explicitly shared database path, not an assumed compiled API file.
2. Login JSON is `{ user, principal, csrfToken }`; the raw session token is issued in the HttpOnly cookie.
3. Audit outcomes are `SUCCESS | DENIED | FAILURE`.
4. The out-of-band recovery SQL uses the actual snake_case columns and is not represented as an audited product workflow.
5. Membership revocation is documented as returning `{ "success": true }`.

## Carry-forward release notes

The CI log reports two moderate dependency advisories and existing deprecation/experimental/browser-externalization/bundle-size warnings. Their impact remains to be triaged during release hardening. The milestone is not described as warning-free or certified secure for production.

The supported build evidence is for the web bundle plus API typechecking/tests, not a compiled production API installation package. Audit records are append-only through the application contract; privileged direct database changes are outside that guarantee.

## Scope boundary

M5.1 closure does not implement or approve enterprise SSO, MFA, SCIM, invitations, service accounts/API keys, BYOAI, document extraction, live publishing connectors, production runner orchestration, billing or deployment certification.

No source migration or reorganisation is performed by this closure. Earlier implementation reports and failed runs remain historical evidence, retained through their original records and Git history.

## Programme state

**M0 -> M1 -> M2 -> M3 -> M4.0 -> M4.1 -> M4.2 -> M4.3 -> M5.0 -> M5.1: CLOSED milestones.**

**M5.2: NOT STARTED by this sign-off.**

The next planned progression is real intelligence intake, to be defined and authorised in its own work package. This closure does not start that work or authorize reopening the resolved M5.1 corrections.
