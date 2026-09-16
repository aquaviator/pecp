# PECP M0.1 PM Review

Status: **CONDITIONAL PASS — M0 remains open pending CI alignment**

## Verified

- Canonical provenance state is separated from UI review status.
- Canonical states match the Product Constitution.
- RetailCo fixtures no longer use `as any` for the architecture item.
- Portal moved to `apps/web` and monorepo placeholders exist.
- Vitest test suites are present.
- Product Constitution remains authoritative and is imported by the portal at build time.

## Remaining gate issues

### 1. CI branch mismatch

Repository default branch is currently `master`, but `.github/workflows/ci.yml` only triggers on `main`.

Result: the new CI gate is not executing on the authoritative default branch.

Required correction: either rename the repository default branch to `main` and update the repo accordingly, or change CI to trigger on `master` (or both during transition).

### 2. Deterministic npm install is not yet enforced

The repository currently contains `bun.lock` but no committed `package-lock.json`, while CI uses:

```sh
npm ci || npm install
```

The fallback means CI is not deterministic and masks a missing/stale npm lockfile.

Required correction:

- choose npm as the authoritative package manager for this repo;
- generate and commit `package-lock.json` from the workspace root;
- remove `bun.lock` unless Bun is intentionally retained and documented;
- change CI to `npm ci` only;
- optionally add the `packageManager` field to the root `package.json`.

## M0 closure condition

M0 can be formally closed when a push/PR on the authoritative default branch produces a passing CI run executing:

1. deterministic dependency install;
2. TypeScript validation;
3. unit tests;
4. production build.

Do not begin M1 until this gate is green.
