# Work Package: M3.1A.3 — Preflight Binding Completeness Gate

## Objective

Close M3.1A by making the execution preflight validator complete enough to be the final authority for the first live k6 run.

Read and obey:
- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M3_0_CLOSURE.md`
- `docs/work-packages/M3_1A_REFERENCE_LAB_FOUNDATION_AND_PREFLIGHT.md`
- `docs/work-packages/M3_1A_1_PREFLIGHT_BINDING_INTEGRITY_GATE.md`
- `docs/work-packages/M3_1A_2_PREFLIGHT_AUTHORITY_NO_FALLBACK_GATE.md`
- `docs/M3_1A_2_PM_REVIEW.md`

Do **not** run k6. Do not begin M3.1B or M4.

## 1. Remove residual authority fallbacks

The preflight builder must not repair missing authoritative bindings.

Remove or block fallback behaviour for:
- preflight timestamp;
- Reference Lab service/version metadata;
- k6 runtime version/source id;
- any rendered workload/event values used as authoritative preflight data.

Use an explicit supplied preflight timestamp or injected clock. Missing mandatory metadata => structured issue + `PREFLIGHT_BLOCKED`.

Do not use PECP runtime constants as substitutes for missing bundle metadata. The bundle itself must carry the required runtime binding.

Invalid sentinel values may be present only in a blocked diagnostic object and must never make a missing proof appear satisfied.

## 2. Exact source-contract identity binding

If a `sourceContract` is supplied, prove all of these match the Test Definition:
- contract id;
- version;
- deterministic non-cryptographic fingerprint via the shared authoritative contract fingerprint function;
- governed status.

A supplied APPROVED contract belonging to another Test Definition must block preflight.

If source contract evidence is required for this reference scenario, make it mandatory rather than optional.

Add negative tests for same-status but wrong id/version/fingerprint.

## 3. Enforce every preflight check in validator

`validateExecutionPreflightManifest()` must independently require every `PreflightChecks` field to be true before returning `READY_FOR_LIVE_EXECUTION`.

A manifest with `status: READY_FOR_LIVE_EXECUTION` and any false check must return:
- `isValid: false`;
- `status: PREFLIGHT_BLOCKED`;
- a structured issue identifying that check.

Do not trust the status string as evidence.

## 4. Threshold set completeness and source-contract binding

Prove exact criterion coverage:
- every `TestDefinition.executableCriteria` item appears exactly once in preflight threshold bindings;
- no unknown/extra criterion ids are accepted;
- every manifest threshold maps to the actual compiled k6 provider expression;
- when the source contract is supplied, the criterion id and structured semantics originate from that approved contract.

Bind at minimum:
- criterion id;
- metric/scope mapping;
- operator;
- threshold value;
- unit;
- percentile where applicable;
- compiled provider expression.

Deleting one required threshold from an otherwise READY manifest must block validation.

## 5. Full governed workload binding

Validator must compare the manifest against the Test Definition for:
- scheduler arrival population;
- scheduler peak rate;
- scheduler rate unit;
- business attainment metric;
- business attainment target value;
- business attainment unit;
- population relationship id;
- formula identifier;
- relevant journey key;
- journey share;
- contribution per successful event;
- derived scheduler rate.

Any drift blocks preflight.

## 6. Exact credential binding

Derive required credentials from the canonical journey-step credential references, not merely the top-level credential list.

Prove:
- every step credential is represented in the Test Definition credential registry;
- no required step credential is absent from preflight;
- no orphan top-level credential can self-authorise;
- provider, reference id, purpose, enforced route and auth scheme all match governed step + Reference Lab manifest data.

Add negative tests for route/scheme/provider drift and a step credential missing from the top-level registry.

## 7. Exact route semantics

Replace prefix path matching with normalized path equality:
- parse/normalize the canonical step path;
- ignore query string only when comparing to the route-manifest pathname;
- do not allow `/foo-extra` to match `/foo`.

For each canonical required route prove in both directions where applicable:
- HTTP method;
- normalized path;
- expected status;
- payload-required semantics;
- auth-required semantics;
- auth scheme for credential-bound routes;
- business-event event key;
- business-event metric;
- business-event unit;
- contribution;
- expected status.

Where a JSON_LITERAL payload is governed and the route manifest declares required payload fields, verify the required fields are represented.

Extra lab routes remain allowed.

## 8. Bind probe evidence to the exact target

A healthy probe for one URL must not authorise another target.

Require:
- normalized `TargetProbeResult.baseUrl` equals the Test Definition target environment origin;
- /health HTTP status is 200;
- /ready HTTP status is 200;
- health status is `healthy`;
- ready status is `ready`;
- `isResolvable === true`;
- manifest `verifiedProbe` values agree with supplied evidence.

If status-code fields are optional today, make them required for the M3.1A live-execution preflight evidence.

Add a negative test where the probe is healthy but for a different base URL.

## 9. Reference Lab metadata binding

Do not hard-code `1.0.0` as proof of alignment.

Bind manifest:
- service name;
- service version;
- route manifest version

directly to the supplied Reference Lab manifest/reference metadata.

Missing service/version metadata blocks preflight.

## 10. Fingerprint terminology

Keep all current M1-M3 fingerprints/checksums described as **deterministic non-cryptographic drift checksums**.

Remove any new or existing M3.1A wording that calls these values cryptographic unless an actual cryptographic primitive is introduced.

## 11. Tests and CI

Add focused tests for every correction above.

Required negative cases include:
- wrong but APPROVED source contract;
- one `preflightChecks` value false with READY status;
- one required threshold deleted;
- business attainment unit drift;
- population relationship share/contribution/formula drift;
- credential route/scheme/provider drift;
- step credential missing from top-level registry;
- route prefix false-positive attempt;
- route auth/payload reverse mismatch;
- business-event metric/unit mismatch;
- target probe for different base URL;
- non-200 health/ready probe despite healthy-looking text;
- missing runtime source id/version;
- missing explicit preflight timestamp.

Run from clean root:
- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions on `master` must be green.

Completion report must state separately:
- Vitest count;
- Reference Lab native test count;
- combined total;
- GitHub Actions run id/result.

## Non-goals

Do not:
- execute k6;
- generate live results;
- compute PASS/FAIL/PASS_WITH_OBSERVATION/INCONCLUSIVE;
- add results ingestion;
- add findings/evidence;
- begin M4.

## Definition of Done

M3.1A closes when:
1. no residual authoritative fallbacks remain in preflight generation;
2. exact source-contract identity/status is bound;
3. every READY check is independently enforced;
4. threshold set is complete and contract/provider-bound;
5. full workload/population semantics are bound;
6. credential binding is complete and exact;
7. route semantics are exact, not prefix-based;
8. probe evidence is bound to the exact target with HTTP evidence;
9. Reference Lab service/version metadata is source-bound;
10. fingerprint terminology is accurate;
11. root CI is green;
12. no live k6 execution has occurred.

Stop after M3.1A.3.
