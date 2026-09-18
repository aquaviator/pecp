# Work Package: M3.1A.2 — Preflight Authority & No-Fallback Gate

## Objective

Make the M3 execution preflight artefact a strict, source-driven authority before the first real k6 run.

M3.1A and M3.1A.1 are substantially complete. This package removes the remaining ability of the preflight compiler to invent values or self-certify READY_FOR_LIVE_EXECUTION from weak checks.

Do **not** run k6 against the Reference Lab in this work package.

Read:
- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M3_0_CLOSURE.md`
- `docs/work-packages/M3_1A_REFERENCE_LAB_FOUNDATION_AND_PREFLIGHT.md`
- `docs/work-packages/M3_1A_1_PREFLIGHT_BINDING_INTEGRITY_GATE.md`
- `docs/M3_1A_PM_REVIEW.md`
- `docs/M3_1A_1_PM_REVIEW.md`

## 1. Remove all preflight fallbacks

`buildExecutionPreflightManifest()` may not invent authoritative values.

Remove fallback behaviour for:
- criterion aggregation / percentile;
- comparison operator;
- threshold value;
- workload-attainment target/unit;
- scheduler population;
- population relationship journey key/share/contribution;
- target base URL / host / port;
- credential route / scheme.

If a mandatory value is absent or unsupported:
- emit a structured preflight issue;
- set status `PREFLIGHT_BLOCKED`;
- do not fill a plausible value.

The preflight builder must be a binder/validator, not a second compiler.

## 2. Contract approval binding

Do not infer approval from contract id text.

Add the minimum authoritative status binding needed so preflight can prove the source Performance Contract is APPROVED from governed state.

Acceptable approaches:
- carry source contract status into TestDefinition; or
- require the approved PerformanceContract / explicit governed approval binding as preflight input.

Tests must prove a contract id containing `approved` does not pass when status is not APPROVED.

## 3. Semantic Reference Lab route alignment

Replace route-count checks with exact required-route validation.

For every canonical journey step required by the Test Definition, prove the Reference Lab manifest has a matching:
- HTTP method;
- path;
- expected healthy status when asserted;
- payload-required semantics;
- auth requirement and scheme where credential-bound;
- business-event contribution when the step contributes to workload attainment.

Extra lab routes are allowed.

Missing or mismatched required routes block preflight.

## 4. Target resolvability evidence

Do not hard-code `targetResolvable: true`.

Introduce an explicit, source-driven preflight probe result, for example:
- `TargetProbeResult { baseUrl, healthStatus, readyStatus, verifiedAt, isResolvable }`

or equivalent minimal structure.

M3.1A tests may obtain this by starting the real Reference Lab on an ephemeral port and probing `/health` and `/ready`.

The builder may mark target resolvable only from supplied verified evidence.

Do not perform network I/O inside the deterministic compiler itself.

## 5. Credential binding derivation

Credential route/scheme binding must derive from:
- the credential-referenced canonical journey step; and
- matching Reference Lab route manifest metadata.

No generic hard-coded `/api/v1/orders/checkout` or `Bearer` values in the compiler.

If the credential reference cannot be matched to a governed route/auth scheme, block preflight.

## 6. Threshold binding remains exact

Build expected thresholds only from fully structured executable criteria and actual compiled provider thresholds.

No:
- default p95;
- default operator;
- default threshold 0;
- provider expression reconstruction that disagrees with the compiled bundle.

Prefer binding each approved criterion id directly to the provider threshold expression already present in the k6 bundle.

Unsupported or unmapped criteria block preflight.

## 7. READY_FOR_LIVE_EXECUTION law

The builder/validator may emit READY_FOR_LIVE_EXECUTION only if all are proven:
- source contract APPROVED;
- Test Definition READY_FOR_EXECUTION and executable;
- k6 bundle executable;
- Test Definition / contract / bundle fingerprints match;
- runtime version/source id match;
- exact required bundle files match;
- required Reference Lab routes semantically match;
- target probe proves health/readiness and resolvability;
- credential references bind to governed route/auth semantics;
- scheduler population/rate and workload-attainment relationship bind exactly;
- every executable acceptance criterion maps exactly to compiled provider threshold;
- live execution has not started.

Any missing proof => PREFLIGHT_BLOCKED.

## 8. Tests

Add focused tests proving at minimum:
- missing workload attainment does not become 8.75 orders/sec;
- missing relationship does not become Checkout/0.08/1;
- missing operator/percentile/threshold does not receive defaults;
- contract id text cannot fake APPROVED status;
- route count alone cannot satisfy route alignment;
- method/status/auth/payload/business-event mismatch blocks preflight;
- targetResolvable is false/blocked without explicit probe evidence;
- failed /health or /ready probe blocks preflight;
- credential route/scheme is derived, not hard-coded;
- authoritative RetailCo preflight still validates READY_FOR_LIVE_EXECUTION;
- negative drift tests from M3.1A.1 remain green.

## 9. CI

Run:
- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions on `master` must be green.

Completion report must state:
- Vitest count;
- Reference Lab native test count;
- combined total;
- GitHub Actions run result.

## Non-goals

Do not:
- execute k6;
- create execution results;
- compute PASS/FAIL/INCONCLUSIVE;
- begin results/evidence work;
- begin M4.

## Definition of Done

M3.1A closes when:
1. the preflight compiler contains no authoritative engineering fallbacks;
2. contract approval is proven from governed status;
3. required Reference Lab route semantics are bound exactly;
4. target resolvability/readiness is backed by supplied probe evidence;
5. credential bindings are derived from canonical + lab manifest data;
6. provider thresholds bind exactly with no defaults;
7. RetailCo preflight validates READY_FOR_LIVE_EXECUTION;
8. negative tests prove missing/drifted evidence produces PREFLIGHT_BLOCKED;
9. root CI is green;
10. no live k6 execution has occurred.

Stop after M3.1A.2.
