# Work Package: M3.1A.1 — Pre-Live Binding Integrity Gate

## Objective

Close the final binding-integrity gap in M3.1A before the first real k6 execution.

The Reference Lab is implemented and CI is green. This package only corrects and proves the machine-readable preflight bindings used to authorise M3.1B.

Do **not** run k6 against the Reference Lab in this work package.

Read:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M3_0_CLOSURE.md`
- `docs/work-packages/M3_1A_REFERENCE_LAB_FOUNDATION_AND_PREFLIGHT.md`
- `docs/M3_1A_PM_REVIEW.md`

## 1. Preflight Test Definition binding

Update `reference-library/retailco/m3-preflight-manifest.json` so `canonicalTestDefinition` records the actual compiled:

- id;
- version;
- status;
- fingerprint/checksum;
- source contract id;
- source contract version;
- source contract fingerprint where available.

Tests must compile the reference Test Definition and prove every binding field matches.

Do not copy a guessed fingerprint into the file without verification.

## 2. k6 runtime and bundle binding

The preflight manifest must agree with the actual compiled k6 bundle:

- runtime version must equal `PECP_STABLE_K6_RUNTIME_VERSION`;
- runtime source id must equal `PECP_STABLE_K6_RUNTIME_SOURCE_ID`;
- bundle file list must reflect the actual execution-ready bundle, including `runtime.js`;
- record bundle fingerprint/checksum if available and verify it deterministically;
- record Test Definition fingerprint carried by the bundle.

Tests must compile the M3 RetailCo k6 bundle and compare these values directly.

## 3. Acceptance criterion binding

Do not maintain a second set of criterion identifiers or units in the preflight manifest.

The expected healthy thresholds must bind to the approved M3 contract and provider compilation:

- Checkout criterion id must come from the approved contract (`ac-checkout-latency`);
- global error criterion id must come from the approved contract (`ac-global-error-rate`);
- Checkout maps to `http_req_duration{journey:checkout}` with `p(95)<2000`;
- global error rate maps to `http_req_failed` with `rate<0.005`;
- represent `0.005` semantically as a rate/fraction, not as 0.005 percent.

Add tests comparing the manifest to the actual compiled provider thresholds.

## 4. READY_FOR_LIVE_EXECUTION law

The preflight manifest may say `READY_FOR_LIVE_EXECUTION` only when all binding checks are true.

Prefer a deterministic preflight builder/validator function over hand-maintained booleans if this can be done narrowly.

At minimum tests must fail if any of these drift:

- Test Definition fingerprint;
- source contract binding;
- runtime source id/version;
- bundle file set;
- bundle fingerprint;
- scheduler peak/population/unit;
- business attainment target/unit;
- population relationship;
- credential reference id;
- provider thresholds;
- Reference Lab manifest version.

## 5. Ephemeral test credential law\n\nRemove committed token-like literals from the M3.1A test suite.\n\nGenerate the checkout test credential at test runtime using Node `crypto` (`randomUUID` / `randomBytes`) or equivalent. The generated value may be passed into the in-process lab server and request headers, but must not be committed, logged, echoed, or written to manifests.\n\nAdd/retain a test proving error responses never echo the generated credential.\n\n## 6. Reference Lab route-manifest completeness\n\nIf `/metrics` / `/api/v1/metrics` remains a supported Reference Lab surface, add it to `reference-lab-manifest.json` and verify its method/status/auth semantics. If it is intentionally internal and not part of the supported surface, remove the completion-report/documentation claim that it is an authoritative exposed route.\n\nPrefer documenting it because M3.1B can use it as an independent Reference Lab business-event cross-check.\n\n## 7. Test count clarity

Keep the root test pipeline as:

- web/package Vitest suite;
- Reference Lab native Node test suite.

Completion report should state both counts separately and the combined total. Current verified baseline is 149 Vitest tests plus 10 Reference Lab native tests.

## 8. CI

From clean root run:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions on `master` must pass.

## Non-goals

Do not:

- run k6 against the lab;
- create real execution results;
- compute PASS/FAIL/INCONCLUSIVE;
- add findings/evidence;
- begin M4.

## Definition of Done

M3.1A closes when:

1. the Reference Lab remains green;
2. preflight Test Definition binding is exact and fingerprinted;
3. runtime/bundle metadata matches actual compiled output;
4. threshold ids/units/expressions match the approved contract and k6 provider output;
5. `READY_FOR_LIVE_EXECUTION` is tested against real compiled bindings rather than stale literals;
6. root CI is green;
7. no k6 load run has occurred.

Stop after M3.1A.1.
