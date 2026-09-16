# Work Package: M1.1 — M1 Gate Corrections

## Objective

Close the M1 quality gate without starting M2.

M1 functionality is substantially present, but GitHub CI is red and PM review identified deterministic-governance defects that must be corrected before M1 can be closed.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M0_CLOSURE.md`
- `docs/work-packages/M1_INTELLIGENCE_TO_CONTRACT.md`

## 1. Repair deterministic npm CI

The GitHub Actions run for M1 failed at `npm ci` because `package-lock.json` was not regenerated after adding the new workspace packages/dependencies.

Required:

- regenerate the root `package-lock.json` using npm 10.9.8 after all M1 workspace/package dependency changes;
- commit the updated lockfile;
- from a clean checkout, `npm ci` must succeed;
- then `npm run lint`, `npm run test`, and `npm run build` must all pass;
- GitHub Actions on `master` must be green.

Do not weaken CI and do not restore `npm ci || npm install`.

## 2. Do not calculate from an unresolved conflicting candidate

The M1 work package states RetailCo throughput conversion occurs **after the peak-order conflict is resolved to the approved candidate**.

The current compiler can parse `31,500 (Candidate)` from an item whose canonical/review state is still `CONFLICTING`, and can also fall back to candidate `cand-3` or the first candidate. This is not acceptable as authoritative contract input.

Required rules:

- The contract compiler must never silently choose `cand-3`, the first candidate, or any candidate merely because it is present.
- Critical workload calculations included as contract calculations must use a governed current value that is explicitly resolved/approved, or an explicit separately modelled preview/candidate mode whose outputs are clearly non-authoritative and cannot satisfy approval readiness.
- For the RetailCo M1 reference scenario, create/use a **post-resolution M1 intelligence state** in which 31,500 orders/hour has been formally selected and approved before throughput conversion is compiled.
- Preserve the original unresolved RetailCo fixture/scenario needed to demonstrate M0 conflict behaviour. Do not erase the conflict example from the product.
- Do not hard-code candidate IDs in general compiler logic.

Add tests proving an unresolved `CONFLICTING` peak-order item cannot silently become an authoritative throughput calculation.

## 3. Remove acceptance-criterion magic numbers

The compiler currently contains literal/fallback acceptance values such as checkout `2.0`, search p95 `0.8s`, and throughput fallback `8.75`.

Required:

- Acceptance criteria must derive operator, threshold, unit, percentile and scope from canonical intelligence where those fields are actually known.
- If a value is not represented by sufficiently structured source intelligence, preserve it as ambiguous/unresolved or omit it from executable criteria. Do not manufacture a default.
- The checkout `< 2 seconds` requirement may retain the known threshold/operator/unit while leaving percentile undefined and blocking approval.
- Remove fallback expressions that can fabricate a valid-looking criterion when calculation/source data is absent.

Add tests proving no default p95, 0.8s, 2.0s, or 8.75 value is introduced unless supported by the supplied intelligence/calculation.

## 4. Complete workload readiness checks

The readiness engine must recognise the existing RetailCo session-duration key (`avg_session_duration`) as well as supported canonical aliases.

Required:

- missing session arrival rate must create a structured `MISSING_PREREQUISITE` issue when average session duration is known;
- implement the M1-required `unapproved critical value` readiness check for critical workload/acceptance inputs;
- avoid duplicate issues when the same semantic problem is surfaced through more than one path;
- keep READY / PARTIAL / BLOCKED deterministic.

Add tests for these cases.

## 5. Reference scenario consistency

Update `reference-library/retailco/m1-scenario-manifest.json` so that it clearly distinguishes:

- the original three source candidates;
- the formal resolution event selecting 31,500 orders/hour for the M1 post-resolution state;
- the approved/current value used for deterministic throughput conversion;
- remaining blockers: missing session arrival rate and ambiguous checkout percentile.

The manifest must not simultaneously describe peak orders as unresolved while also treating 31,500 as an authoritative contract input.

## 6. Validation

Run from repository root:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

Then sync/push to `master` and verify GitHub Actions succeeds.

## Non-goals

- Do not begin M2.
- Do not generate Strategy or Test Plan artefacts.
- Do not add AI integrations, ADO live APIs, persistence, k6, authentication, or deployment features.
- Do not redesign the portal beyond changes necessary to show the corrected M1 states.

## Definition of Done

M1 closes only when:

1. lockfile and npm workspace state are deterministic and GitHub CI is green;
2. unresolved candidates cannot become authoritative workload calculations;
3. RetailCo M1 explicitly models post-resolution approval of 31,500 orders/hour;
4. no acceptance-criterion magic defaults remain;
5. missing session arrival and unapproved critical inputs are represented by readiness issues;
6. reference manifest and compiler behaviour agree;
7. all tests/typecheck/build pass;
8. no M2 work has started.

Stop after M1.1 and provide a completion report including the GitHub Actions run result.