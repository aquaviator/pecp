# Work Package: M3.3 — Deterministic Acceptance Engine

## Objective

Implement PECP's deterministic Acceptance Engine.

M3.3 consumes:

1. an approved Performance Contract;
2. the governed Canonical Test Definition derived from that Contract;
3. a canonical M3.2 `CanonicalExecutionResult`;

and produces a provenance-bound acceptance evaluation using only governed source criteria and measured/derived evidence.

M3.3 is where PECP may first assign:

- `PASS`;
- `FAIL`;
- `PASS_WITH_OBSERVATION`;
- `INCONCLUSIVE`.

Read:

- `docs/M3_2_CLOSURE.md`;
- `docs/M3_1B_CLOSURE.md`;
- `docs/work-packages/M2_1_ARTEFACT_GOVERNANCE_GATE.md`;
- `docs/work-packages/M3_0_3_ARRIVAL_POPULATION_AND_ATTAINMENT_SEMANTICS.md`;
- canonical Contract/Test Definition/Results domain types.

Do not implement Findings/defect generation.
Do not generate the final Evidence Package.
Do not implement release certification.
Do not run another real k6 test.

## 1. Acceptance governance law

Implement exactly:

- **PASS** = required workload attained + every defined canonical acceptance criterion evaluates PASS + no governed non-blocking observations requiring PASS_WITH_OBSERVATION;
- **FAIL** = required workload attained + one or more defined canonical acceptance criteria evaluate FAIL;
- **PASS_WITH_OBSERVATION** = required workload attained + every defined canonical acceptance criterion evaluates PASS + one or more explicit governed non-blocking observations exist;
- **INCONCLUSIVE** = required workload not attained, workload attainment is unresolved, run/evidence is invalid for non-SUT reasons, provenance is inconsistent, or one or more required acceptance criteria cannot be evaluated.

Critical law:

**A performance criterion failure cannot produce overall FAIL unless the required workload prerequisite was attained.**

If workload attainment is not proven, overall verdict is INCONCLUSIVE.

## 2. Canonical acceptance domain model

Add engine-neutral domain types in `@pecp/pe-domain`.

Recommended minimum:

### AcceptanceVerdict

`PASS | FAIL | PASS_WITH_OBSERVATION | INCONCLUSIVE`

### CriterionEvaluationStatus

`PASS | FAIL | NOT_EVALUATED | NOT_EVALUABLE`

### WorkloadAttainmentEvaluationStatus

`ATTAINED | NOT_ATTAINED | UNRESOLVED | INVALID`

### AcceptanceCriterionEvaluation

Preserve:

- source criterion id/key;
- metric;
- scope;
- operator;
- canonical threshold value;
- canonical unit;
- percentile;
- normalized comparison threshold;
- observed value;
- observed unit;
- evidence source/path;
- evaluation status;
- deterministic rationale.

### AcceptanceEvaluation

Preserve:

- evaluation id/version;
- source execution run id;
- repository/workflow provenance;
- source Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- canonical Results identity;
- workload prerequisite evaluation;
- criterion evaluations;
- governed observations;
- overall verdict;
- verdict reasons;
- evaluation timestamp supplied by caller or deterministic context;
- evaluation fingerprint/checksum.

No source fact may be invented.

## 3. Provenance and drift gate before evaluation

Before evaluating performance, require consistency between:

- approved Contract;
- Test Definition source Contract id/version/fingerprint;
- Results source Contract id/version/fingerprint;
- Results Test Definition id/version/fingerprint;
- execution bundle/runtime provenance where required.

If provenance is mismatched, stale, absent, or conflicting:

**overall verdict = INCONCLUSIVE**

Do not continue as though the current Contract governed a run produced from a different definition.

Record explicit reason codes.

## 4. Operational/evidence validity gate

Before workload or criteria evaluation inspect canonical Results.

At minimum INCONCLUSIVE when:

- execution operational status was not `EXECUTION_COMPLETED`;
- preflight was invalid;
- engine exit code is non-zero / absent where required;
- `dataQuality.hasIntegrityErrors = true`;
- required raw evidence is incomplete;
- authoritative source bindings are absent.

Warnings alone must not automatically become FAIL.

Do not infer SUT failure from infrastructure/tooling/evidence failure.

## 5. Workload attainment prerequisite

Evaluate `CanonicalExecutionResult.acceptanceBasisAttainment`.

Do not use `fullTestAverageObservation` as the acceptance prerequisite unless the canonical Contract/Test Definition explicitly defines FULL_TEST_AVERAGE as the acceptance time basis.

For the current RetailCo M3.1B evidence:

- acceptance basis = `STEADY_STATE_PEAK`;
- derivation status = `UNRESOLVED_INSUFFICIENT_TIME_SERIES`;
- result value = absent.

Therefore the authoritative reference evaluation must result in:

`workloadAttainment.status = UNRESOLVED`

and overall:

`INCONCLUSIVE`

even though the two k6 threshold observations are green.

### Attainment calculation

Where acceptance-basis result evidence exists:

- source target must come from canonical `WorkloadAttainmentRequirement`;
- observed value/time basis must come from canonical Results;
- units/population must be compatible;
- if explicit `tolerancePercentage` is present, apply only that supplied tolerance;
- if tolerance is absent, do not invent one.

For a minimum-throughput demand:

`requiredMinimum = targetValue * (1 - tolerancePercentage/100)`

only when an explicit tolerance exists.

Otherwise:

`requiredMinimum = targetValue`.

Observed >= requiredMinimum => ATTAINED.

Observed < requiredMinimum => NOT_ATTAINED.

Both NOT_ATTAINED and UNRESOLVED make overall verdict INCONCLUSIVE, not FAIL.

## 6. Criterion source authority

Only evaluate criteria that are canonical and executable:

- Contract criterion status = `DEFINED`;
- criterion appears in `TestDefinition.executableCriteria`;
- Test Definition must not have substituted an ambiguous/unresolved criterion.

Ambiguous, unresolved or conflicting required criteria must not become synthetic thresholds.

If a required canonical criterion is not evaluable from the Result evidence:

`CriterionEvaluationStatus = NOT_EVALUABLE`

and overall verdict is INCONCLUSIVE once workload validity has been considered.

## 7. Deterministic criterion evaluation

Implement engine-neutral comparison semantics.

Supported operators for M3.3 v1:

- `<`;
- `<=`;
- `>`;
- `>=`;
- `==`.

Do not invent handling for `BETWEEN` until the domain contains both governed bounds.

### HTTP error-rate criteria

Canonical observed source:

`results.metrics.httpReqFailed.rate`

Normalize criterion units only from supported governed forms:

- `rate` / `fraction` => use source threshold directly;
- `%` => divide canonical threshold by 100.

No other unit conversion may be invented.

### Response-time / latency criteria

Canonical observed source is the correct normalized duration metric and requested percentile.

Supported scopes should follow the existing provider semantics where evidence exists:

- Global -> `httpReqDuration`;
- Checkout -> `httpReqDurationCheckout`;
- additional journey scope only where a corresponding canonical result observation exists.

Canonical k6 duration observations are milliseconds.

Supported criterion units:

- `ms` / `milliseconds`;
- `s` / `seconds` converted deterministically to milliseconds.

If the requested percentile/scope metric is absent:

NOT_EVALUABLE.

Do not substitute average for percentile, global for journey scope, p95 for p99, or another journey.

## 8. Independent comparison plus engine-threshold corroboration

PECP acceptance must be calculated from:

- canonical criterion;
- canonical observed value;
- canonical operator/threshold.

Do not treat the k6 engine threshold boolean as the PECP verdict.

Where a matching `ThresholdObservation` exists, use it as corroborating engine evidence.

Match deterministically by normalized metric identity and expression.

If PECP's independent comparison and the engine observation disagree:

- record an evidence conflict/integrity reason;
- overall verdict = INCONCLUSIVE.

Do not silently choose one.

## 9. Criterion lineage

Every criterion evaluation must identify its evidence.

Example RetailCo lineage:

### ac-checkout-latency

Contract:

`Checkout Response Time — p95 < 2000ms`

Evidence:

`http_req_duration{journey:checkout}.p95`

### ac-global-error-rate

Contract:

`HTTP Error Rate — < 0.005 rate`

Evidence:

`http_req_failed.rate`

Do not identify criteria solely by display text when a canonical criterion id exists.

## 10. Governed observations and PASS_WITH_OBSERVATION

Do not automatically convert arbitrary warnings, dropped iterations or logs into PASS_WITH_OBSERVATION.

Introduce an explicit governed observation type containing at minimum:

- id;
- source;
- description;
- severity/classification;
- blocking flag;
- provenance/evidence reference.

PASS_WITH_OBSERVATION is permitted only when:

- workload is ATTAINED;
- all required defined criteria PASS;
- at least one explicit governed non-blocking observation exists.

If no governed observation exists, use PASS.

Blocking integrity/validity issues produce INCONCLUSIVE, not PASS_WITH_OBSERVATION.

## 11. Deterministic overall decision order

Evaluate in this order:

1. provenance/drift validity;
2. execution/evidence integrity;
3. workload attainment prerequisite;
4. canonical criterion evaluability;
5. criterion PASS/FAIL outcomes;
6. explicit governed non-blocking observations.

This order is mandatory.

A later green criterion must never override an earlier invalidity/inconclusive gate.

## 12. Authoritative RetailCo reference expectation

Use the exact authoritative M3.1B/M3.2 fixture.

The current result has:

- Contract approved;
- two DEFINED executable criteria;
- k6 engine threshold observations green;
- Checkout p95 well below 2000ms;
- HTTP error rate = 0;
- but acceptance-basis workload attainment is unresolved because steady-state time-sliced evidence was not captured.

Expected M3.3 outcome:

- workload attainment: `UNRESOLVED`;
- latency criterion may be evaluated as PASS detail;
- error-rate criterion may be evaluated as PASS detail;
- overall verdict: **INCONCLUSIVE**;
- reason: required workload attainment was not proven on the governed acceptance basis.

This is a core PECP governance test.

## 13. Synthetic deterministic acceptance fixtures

Without executing real k6, add unit fixtures proving all verdict paths.

### PASS

- valid provenance/evidence;
- workload ATTAINED;
- all defined criteria PASS;
- no governed observations.

### FAIL

- valid provenance/evidence;
- workload ATTAINED;
- at least one defined criterion FAIL.

### PASS_WITH_OBSERVATION

- valid provenance/evidence;
- workload ATTAINED;
- all defined criteria PASS;
- explicit governed non-blocking observation supplied.

### INCONCLUSIVE

Cover independently:

- workload NOT_ATTAINED;
- workload UNRESOLVED;
- execution invalid;
- evidence integrity error;
- Contract/Test Definition fingerprint mismatch;
- criterion missing required metric;
- unsupported unit/operator;
- ambiguous/unresolved required criterion;
- engine-threshold corroboration conflict.

## 14. Zero-invention laws

Do not invent:

- workload tolerance;
- acceptance threshold;
- criterion operator;
- percentile;
- scope;
- unit conversion;
- missing observed metric;
- missing acceptance time basis;
- criterion result;
- observation;
- overall verdict reason.

Missing required input produces NOT_EVALUABLE / UNRESOLVED / INCONCLUSIVE as appropriate.

## 15. Immutability and fingerprint

Acceptance evaluation should be immutable and deterministically fingerprinted from its authoritative inputs and normalized evaluation content.

The fingerprint must bind at least:

- Contract fingerprint;
- Test Definition fingerprint;
- execution run id;
- relevant Results/evidence identity;
- criterion outcomes;
- workload-attainment outcome;
- overall verdict.

Do not include a wall-clock timestamp in the fingerprint.

## 16. Package boundaries

Prefer:

- domain types in `@pecp/pe-domain`;
- deterministic engine logic in `@pecp/test-engine` or a clearly named acceptance module;
- minimal/no UI work in M3.3.

Do not make the web UI authoritative for verdict logic.

## 17. Tests

Add unit/integration tests for:

- authoritative RetailCo => INCONCLUSIVE for unresolved workload attainment;
- independent latency comparison;
- independent error-rate comparison;
- each comparison operator;
- supported unit conversions;
- missing percentile;
- missing scope metric;
- workload tolerance supplied;
- no tolerance supplied;
- NOT_ATTAINED => INCONCLUSIVE;
- criterion failure with attained workload => FAIL;
- all criteria pass + attained workload => PASS;
- explicit observation => PASS_WITH_OBSERVATION;
- fingerprint mismatch => INCONCLUSIVE;
- data integrity error => INCONCLUSIVE;
- threshold corroboration agreement;
- threshold corroboration conflict => INCONCLUSIVE;
- no invented values.

Normal CI must remain fast and must not run real k6.

## Explicit non-goals

Do not:

- generate Findings;
- create Jira/ADO defects;
- assign root cause;
- generate final Evidence Package;
- perform release certification;
- alter source Contract criteria;
- alter the canonical M3.1B workload;
- rerun the 22-minute reference test.

## Definition of Done

M3.3 is complete when:

1. canonical Acceptance domain types exist;
2. deterministic acceptance evaluation exists outside the UI;
3. provenance/drift is gated;
4. workload attainment is evaluated first;
5. required workload not attained/unresolved can never produce PASS or FAIL;
6. canonical criteria are evaluated independently from engine threshold booleans;
7. missing criteria evidence becomes NOT_EVALUABLE and overall INCONCLUSIVE;
8. engine threshold observations are corroborating only;
9. PASS/FAIL/PASS_WITH_OBSERVATION/INCONCLUSIVE paths are all tested;
10. the authoritative RetailCo reference run evaluates INCONCLUSIVE because steady-state attainment is unresolved;
11. acceptance output is provenance-bound and deterministically fingerprinted;
12. no values are invented;
13. normal CI is green.

Stop and provide an M3.3 completion report for PM audit.
