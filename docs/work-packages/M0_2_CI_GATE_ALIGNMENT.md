# Work Package: M0.2 — CI Gate Alignment

## Objective
Close the final M0 gate by making repository CI authoritative, deterministic, and active on the real default branch.

## Required changes

1. **Branch alignment**
   - Current repository default branch: `master`.
   - Current CI triggers only on `main`.
   - Until/unless the GitHub default branch is deliberately renamed, update CI to run on `master` pushes and pull requests. Supporting both `master` and `main` during transition is acceptable.

2. **Package manager decision**
   - Standardise this repository on npm for M0/M1.
   - Generate and commit a root `package-lock.json` compatible with the npm workspace configuration.
   - Remove `bun.lock` unless an explicit architecture decision is made to support Bun.
   - Add a root `packageManager` declaration if practical.

3. **Deterministic CI**
   - Replace `npm ci || npm install` with `npm ci`.
   - CI must fail if the lockfile is absent or inconsistent.

4. **Validation**
   - Run from repository root:
     - `npm ci`
     - `npm run lint`
     - `npm run test`
     - `npm run build`
   - Push the correction and verify an actual GitHub Actions CI run is created on the authoritative branch.

## Non-goals
- Do not begin M1.
- Do not change the canonical domain model.
- Do not add backend services.
- Do not redesign the portal.

## Definition of Done
M0 is closed only when GitHub reports a passing CI run on the authoritative default branch covering deterministic install, typecheck, tests, and production build.
