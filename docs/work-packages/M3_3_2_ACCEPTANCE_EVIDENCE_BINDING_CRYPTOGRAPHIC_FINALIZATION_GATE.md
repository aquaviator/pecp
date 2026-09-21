# Work Package: M3.3.2 — Acceptance Evidence Binding & Cryptographic Finalization Gate

## Objective

Close the final Acceptance Engine authority gaps so a PECP Acceptance Evaluation is fully grounded in governed Results evidence and cryptographically bound to the exact decision semantics.

This is the final M3.3 correction gate.

Read:

- `docs/M3_3_1_PM_REVIEW.md`;
- `docs/work-packages/M3_3_1_ACCEPTANCE_AUTHORITY_CORROBORATION_DETERMINISM_GATE.md`;
- `docs/work-packages/M3_3_DETERMINISTIC_ACCEPTANCE_ENGINE.md`;
- `docs/M3_2_CLOSURE.md`.

Do not implement Findings.
Do not generate defects.
Do not generate final Evidence Package.
Do not perform release certification.
Do not run real k6.

## 1. Add a dedicated cryptographic Acceptance Evaluation fingerprint

Do not alter historical Contract/Test Definition fingerprints used by M3.1B evidence.

Introduce a dedicated deterministic SHA-256 acceptance-evaluation digest.

The Acceptance Evaluation should expose algorithm/version explicitly, for example:

- algorithm = SHA-256;
- schema/version = acceptance-evaluation-v1;
- digest/fingerprint value.

The digest must be calculated from canonical normalized content only.

No wall-clock timestamp may participate.

## 2. Bind complete criterion decision semantics

The acceptance digest must bind each criterion evaluation's canonical decision content, including at minimum:

- criterion id/key;
- metric;
- scope;
- comparison operator;
- canonical threshold value;
- canonical unit;
- percentile;
- normalized comparison threshold;
- observed value;
- observed unit;
- evidence source path;
- evaluation status;
- exact corroborating metric;
- exact corroborating expression;
- corroborating observation status;
- engine result/agreement where available.

Sort criterion records deterministically by canonical criterion id unless order is itself governed.

## 3. Require complete Results workload bindings for a claimed acceptance value

When `acceptanceBasisAttainment.resultValue` is present, require:

- `governedDemand.targetValue`;
- `governedDemand.unit`;
- `governedPopulation`;
- `actualSourceMetric`;
- valid governed acceptance time basis;
- derivation status compatible with an evaluated value.

Each must match the Test Definition authority where applicable.

Missing required binding => workload status INVALID and overall INCONCLUSIVE.

Do not fall back from a missing Results binding to Test Definition data for the purpose of proving what the observed result represents.

For unresolved results with no resultValue, missing observation-only fields may remain unresolved rather than invalid where semantically appropriate.

## 4. Ground actualSourceMetric

A non-empty source metric string alone is insufficient.

For M3.3 v1:

- if `actualSourceMetric = pecp_business_attainment_events`, the ingested Results must actually contain that raw/normalized metric;
- if another metric identifier is supplied without a governed evidence reference/recognized canonical source, mark workload evidence INVALID.

If supporting additional sources, extend the canonical Results model with an explicit evidence/source reference and validate it deterministically.

Add negative regression using a fabricated source metric name.

## 5. Corroboration availability semantics

Update `CorroboratingEngineThreshold` so agreement can be absent.

Rules:

- exact matching observation with authoritative PASS/FAIL => compute agreement;
- UNAVAILABLE / UNSUPPORTED / null engine result => `enginePassed` unavailable and `agreesWithEngine` unavailable;
- contradictory status vs engineResult => evidence conflict / INCONCLUSIVE.

Do not encode unavailable as agreement=true.

## 6. Detect same-metric expression drift

For criteria that map to an engine threshold metric:

- compute expected metric + expression;
- exact match remains the corroborating observation;
- if there is no exact match but one or more threshold observations exist for the same metric with different expressions, record an execution-threshold semantics conflict and overall INCONCLUSIVE;
- if no observation for the metric exists at all, independent evaluation may remain valid per M3.3 rules.

Add a regression with:

- expected `p(95)<2000`;
- actual same-metric observation `p(95)<1500`;
- workload attained;
- independent criterion otherwise PASS;
- expected overall = INCONCLUSIVE.

## 7. Deterministic evaluation metadata

Remove report/implementation ambiguity.

Use:

- caller-supplied `evaluationTimestamp` when supplied;
- otherwise the governed `results.run.timestamps.completedAt` when present;
- otherwise leave absent.

No system clock calls.

Default evaluation id should continue to derive deterministically from the acceptance digest/fingerprint.

Add exact tests.

## 8. Bind gates, reasons and observations into digest

The cryptographic acceptance digest must also bind:

- provenance gate validity + normalized reasons;
- operational integrity gate validity + normalized reasons;
- workload prerequisite status/target/observed/required minimum/time basis/tolerance/derivation status;
- governed observations, sorted deterministically;
- overall verdict;
- verdict reasons.

This makes the digest represent the actual acceptance decision, not merely its headline status.

## 9. Authoritative RetailCo regression

The authoritative M3.1B/M3.2 evaluation must remain:

- Checkout p95 = 0.3906885 ms;
- HTTP failure rate = 0;
- Checkout criterion PASS detail;
- Error Rate criterion PASS detail;
- workload prerequisite UNRESOLVED;
- overall verdict INCONCLUSIVE.

The new SHA-256 acceptance digest must be stable across repeated evaluations of identical inputs.

## 10. Negative regression matrix

Add tests proving:

- missing Results workload target binding + claimed result => INVALID / INCONCLUSIVE;
- missing Results workload unit + claimed result => INVALID / INCONCLUSIVE;
- missing Results workload population + claimed result => INVALID / INCONCLUSIVE;
- fabricated actualSourceMetric => INVALID / INCONCLUSIVE;
- valid grounded source metric is accepted;
- unavailable corroboration has no agreement boolean;
- same-metric wrong-expression threshold => INCONCLUSIVE;
- no threshold observation for metric does not itself invent a conflict;
- acceptance digest changes when criterion operator changes;
- acceptance digest changes when percentile/scope/evidence path changes;
- acceptance digest changes when gate reason changes;
- acceptance digest changes when governed observation changes;
- identical inputs produce identical SHA-256 digest and deterministic id;
- default evaluatedAt comes from execution completedAt, not wall-clock time.

## Definition of Done

M3.3.2 is complete when:

1. Acceptance Evaluation uses a dedicated SHA-256 decision digest;
2. full criterion semantics are digest-bound;
3. claimed workload observations require complete governed Results bindings;
4. actualSourceMetric is evidence-grounded;
5. unavailable corroboration is not represented as agreement;
6. same-metric threshold expression drift is detected;
7. deterministic evaluatedAt behavior is explicit and tested;
8. gate/reason/workload/observation/verdict content is digest-bound;
9. authoritative RetailCo remains INCONCLUSIVE;
10. normal CI is green.

Stop and provide an M3.3.2 completion report for PM audit.
