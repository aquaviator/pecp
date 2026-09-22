# Work Package: M3.3.3 — Workload Source Authority & SHA-256 Known-Answer Gate

## Objective

Close the final two M3.3 authority gaps:

1. prevent unrelated raw metrics from being accepted as workload-attainment evidence sources;
2. independently verify that the dependency-free acceptance digest implementation is true SHA-256.

This is the final M3.3 closure gate.

Read:

- `docs/M3_3_2_PM_REVIEW.md`;
- `docs/work-packages/M3_3_2_ACCEPTANCE_EVIDENCE_BINDING_CRYPTOGRAPHIC_FINALIZATION_GATE.md`;
- `docs/work-packages/M3_3_DETERMINISTIC_ACCEPTANCE_ENGINE.md`.

Do not implement Findings.
Do not generate defects.
Do not generate final Evidence Package.
Do not perform release certification.
Do not run real k6.

## 1. Restrict workload actualSourceMetric to governed sources

For M3.3 v1, a claimed workload-attainment `resultValue` must use an explicitly recognized canonical evidence source.

Required behavior:

- `actualSourceMetric = pecp_business_attainment_events` may be accepted when the ingested Results actually contain that normalized/raw metric;
- `actualSourceMetric = http_reqs` must be rejected for business-attainment proof;
- `actualSourceMetric = iterations` must be rejected;
- `actualSourceMetric = http_req_duration` must be rejected;
- any other arbitrary raw metric must be rejected unless a future canonical source/evidence-reference model explicitly authorizes it.

Do not treat "metric key exists in raw evidence" as sufficient semantic authority.

Future extensibility should use an explicit governed source registry or evidence reference rather than heuristic metric-name existence.

Rejected source => workload prerequisite INVALID => overall INCONCLUSIVE.

## 2. Bind source metric semantics to business attainment

For the current RetailCo workload requirement:

- governed business metric = orders;
- source metric = `pecp_business_attainment_events`;
- target unit = orders/second.

Preserve the distinction between:

- scheduler arrival population;
- business attainment metric;
- raw source metric.

Do not allow scheduler metrics or HTTP transport metrics to masquerade as business attainment evidence.

## 3. Add negative workload-source tests

Add explicit tests proving:

- valid `pecp_business_attainment_events` source is accepted;
- fabricated source is rejected;
- existing raw `http_reqs` source is rejected;
- existing raw `iterations` source is rejected;
- existing raw HTTP duration source is rejected;
- rejected source always yields INVALID / INCONCLUSIVE;
- authoritative RetailCo unresolved result remains UNRESOLVED, not INVALID, because it does not claim a result value.

## 4. Add SHA-256 known-answer tests

Independently verify `computeAcceptanceEvaluationDigest`.

At minimum prove:

`computeAcceptanceEvaluationDigest({}).value`

equals:

`44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`

and:

`computeAcceptanceEvaluationDigest({ a: 1 }).value`

equals:

`015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862`

These are SHA-256 digests of the exact JSON strings produced by `JSON.stringify`:

- `{}`
- `{"a":1}`

Alternatively, tests may compare against Node `crypto.createHash('sha256')` in the test environment.

Production/browser runtime must remain dependency-free if desired.

## 5. Preserve historical fingerprints

Do not modify:

- Contract FNV-1a fingerprints;
- Test Definition FNV-1a fingerprints;
- authoritative M3.1B bindings.

This gate only verifies the new Acceptance Evaluation SHA-256 digest and source authority.

## 6. Authoritative regression

The authoritative RetailCo evaluation must remain exactly:

- Checkout p95 = 0.3906885 ms;
- HTTP failure rate = 0;
- both canonical criterion details PASS;
- workload prerequisite status = UNRESOLVED;
- workload derivationStatus = UNRESOLVED_INSUFFICIENT_TIME_SERIES;
- overall verdict = INCONCLUSIVE;
- SHA-256 acceptance digest stable.

## Definition of Done

M3.3.3 is complete when:

1. arbitrary existing raw metrics cannot be used as workload-attainment evidence;
2. `pecp_business_attainment_events` is explicitly grounded and accepted;
3. workload source semantic separation remains intact;
4. SHA-256 known-answer tests pass;
5. historical Contract/Test Definition fingerprints remain unchanged;
6. authoritative RetailCo remains INCONCLUSIVE;
7. normal CI is green.

Stop and provide an M3.3.3 completion report for PM audit.
