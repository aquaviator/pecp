# Work Package: M3.3.1 — Acceptance Authority, Corroboration & Determinism Gate

## Objective

Harden M3.3 so PECP verdicts are provably based on the exact approved Contract, exact executable criterion semantics, compatible acceptance-basis workload evidence, deterministic corroboration, and a side-effect-free deterministic evaluation.

This is a correction gate for M3.3.

Read:

- `docs/M3_3_PM_REVIEW.md`;
- `docs/work-packages/M3_3_DETERMINISTIC_ACCEPTANCE_ENGINE.md`;
- `docs/M3_2_CLOSURE.md`;
- `docs/work-packages/M2_1_ARTEFACT_GOVERNANCE_GATE.md`.

Do not implement Findings.
Do not generate defects.
Do not generate the final Evidence Package.
Do not perform release certification.
Do not run real k6.

## 1. Remove acceptance zero invention

Refactor `AcceptanceCriterionEvaluation` so NOT_EVALUABLE criteria can preserve absent inputs.

Fields such as the following must be optional when unavailable:

- operator;
- canonicalThresholdValue;
- normalizedComparisonThreshold;
- canonicalUnit where source itself is absent.

Rules:

- source explicit 0 => preserve 0;
- source absent => undefined;
- source malformed/unsupported => NOT_EVALUABLE with reason;
- never create threshold 0 as a placeholder.

Add negative tests.

## 2. Enforce Contract -> Test Definition criterion authority parity

For every `testDefinition.executableCriteria` entry:

- find Contract criterion by canonical id;
- Contract criterion must exist;
- Contract criterion status must be DEFINED;
- compare exact governed semantics:
  - id;
  - key;
  - metric;
  - target;
  - operator;
  - thresholdValue;
  - unit;
  - percentile;
  - scope;
  - status.

Any mismatch => criterion authority/provenance invalid and overall INCONCLUSIVE.

Also verify every DEFINED Contract criterion expected for execution is represented in the Test Definition executable criteria.

Do not evaluate a criterion that only exists in the Test Definition.

For Contract criteria in AMBIGUOUS / UNRESOLVED / CONFLICTING state, preserve their governance state and prevent a conclusive overall verdict when they are required for the approved evaluation.

Add tamper tests changing only:

- thresholdValue;
- operator;
- unit;
- percentile;
- scope;

while keeping the stored Test Definition fingerprint unchanged. PECP must still detect the authority mismatch.

## 3. Verify Test Definition self-integrity

Recompute the current Test Definition fingerprint with `computeTestDefinitionFingerprint` and compare it to `testDefinition.fingerprint`.

Mismatch => provenance gate invalid => INCONCLUSIVE.

Do not replace the existing authoritative M3.1B Test Definition fingerprint or migrate historical evidence in this gate.

## 4. Cross-check workload acceptance authority

Before workload comparison, validate the acceptance-basis observation against the canonical Test Definition.

At minimum check where source values exist:

- target value matches `testDefinition.workloadAttainment.targetValue`;
- target unit matches `testDefinition.workloadAttainment.unit`;
- governed scheduler population matches `testDefinition.populationRelationship.outputSchedulerRate.population` where the relationship exists;
- acceptance time basis is governed/allowed;
- a claimed observed acceptance value has a grounded `actualSourceMetric`.

For M3.3 v1, the RetailCo acceptance basis is STEADY_STATE_PEAK.

Do not accept FULL_TEST_AVERAGE as the governed prerequisite merely because a result value exists unless a future canonical source explicitly authorizes that basis.

Conflict/missing required binding => INVALID or UNRESOLVED => overall INCONCLUSIVE.

Add tests for target, unit, population and time-basis mismatch.

## 5. Validate supplied workload tolerance

Tolerance rules:

- absent tolerance => no tolerance is applied;
- required minimum = target exactly;
- supplied tolerance must be finite;
- supplied tolerance must be within the accepted governed range for a percentage;
- invalid tolerance => workload prerequisite INVALID;
- never default tolerance.

For a valid explicit tolerance:

`requiredMinimum = targetValue * (1 - tolerancePercentage / 100)`

Add tests for:

- absent tolerance;
- valid explicit tolerance;
- negative tolerance;
- >100 tolerance;
- NaN/Infinity via malformed runtime fixture.

## 6. Exact engine-threshold corroboration

Corroboration must match:

**normalized metric identity + normalized threshold expression**

not metric alone.

Build expected expression from the canonical criterion after unit normalization.

Examples:

- `http_req_failed` + `rate<0.005`;
- `http_req_duration{journey:checkout}` + `p(95)<2000`.

If multiple thresholds exist for the same metric, select only the exact matching expression.

If no exact matching threshold observation exists:

- criterion can still be evaluated independently;
- do not use a different threshold as corroboration.

If a matching observation is UNAVAILABLE/UNSUPPORTED with no authoritative engine result:

- preserve corroboration as unavailable;
- do not convert null into enginePassed=false.

If threshold `status` and `engineResult` contradict each other:

- record evidence conflict;
- overall INCONCLUSIVE.

Add all regressions.

## 7. Blocking governed observations

Before returning PASS / FAIL / PASS_WITH_OBSERVATION, inspect governed observations.

If any explicit observation has `isBlocking = true`:

**overall verdict = INCONCLUSIVE**

Include the blocking observation ids/reasons.

Non-blocking observations may only produce PASS_WITH_OBSERVATION after workload attainment and all criteria PASS.

Add tests for:

- one blocking observation;
- blocking + non-blocking observations together;
- blocking observation with otherwise failing criterion.

## 8. Remove wall-clock dependence from deterministic engine

No `new Date()` or `Date.now()` inside `evaluateAcceptance`.

Acceptable design:

- caller may supply `evaluationTimestamp`;
- when absent, use an explicitly deterministic governed context or leave the field absent by updating the domain;
- compute `evaluationFingerprint` first;
- derive default evaluation id from the fingerprint, for example `acceptance-<fingerprint>`.

Identical inputs with no caller time/id must yield identical normalized evaluation content.

Add regression test making two calls without supplied timestamp/id.

## 9. Preserve input purity

Do not freeze or mutate caller-owned:

- Contract;
- Test Definition;
- Results;
- governed observation array/objects.

Clone normalized output structures before `deepFreeze`.

Add a test proving the input observation array and objects remain mutable/unfrozen after evaluation.

## 10. Bind governed observations into fingerprint

Normalize governed observations into the fingerprint payload.

Bind at minimum:

- id;
- source;
- severity;
- isBlocking;
- provenanceReference.

Bind description too if it is part of canonical governed observation content.

Sort by a deterministic stable key such as id before fingerprinting if semantic ordering is not meaningful.

Changing a governed observation must change the fingerprint even when the overall verdict remains PASS_WITH_OBSERVATION.

Add test.

## 11. Exact authoritative RetailCo assertions

The authoritative M3.1B/M3.2 fixture must evaluate:

- checkout p95 observed = `0.3906885 ms`;
- error rate observed = `0`;
- Checkout criterion = PASS detail;
- Error Rate criterion = PASS detail;
- workload prerequisite = UNRESOLVED;
- overall verdict = INCONCLUSIVE.

Do not use 115ms or 0.078% as authoritative reference values.

## 12. Complete M3.3 DoD regression matrix

Add explicit tests for:

- < comparison;
- <= comparison;
- > comparison;
- >= comparison;
- == comparison;
- seconds -> milliseconds;
- percent -> rate/fraction;
- missing percentile;
- missing/unsupported scope;
- missing observed metric;
- no tolerance;
- explicit valid tolerance;
- invalid tolerance;
- workload NOT_ATTAINED => INCONCLUSIVE;
- workload UNRESOLVED => INCONCLUSIVE;
- criterion failure + attained workload => FAIL;
- all criteria pass + attained workload => PASS;
- non-blocking governed observation => PASS_WITH_OBSERVATION;
- blocking governed observation => INCONCLUSIVE;
- Contract/Test Definition criterion semantic mismatch => INCONCLUSIVE;
- Test Definition self-fingerprint mismatch => INCONCLUSIVE;
- workload target/unit/population/time-basis mismatch => INCONCLUSIVE;
- exact engine corroboration agreement;
- multi-threshold exact expression selection;
- corroboration conflict => INCONCLUSIVE;
- unavailable corroboration does not masquerade as fail;
- deterministic default evaluation metadata;
- fingerprint changes when governed observation changes;
- no input mutation/freezing;
- no invented threshold/observed values.

## 13. Normal CI

Normal CI must remain fast and k6-independent.

No 22-minute run is required.

## Definition of Done

M3.3.1 is complete when:

1. NOT_EVALUABLE criteria contain no invented zero threshold values;
2. every executable criterion is proven identical to its approved Contract authority;
3. current Test Definition self-integrity is verified;
4. workload acceptance evidence is compatible with canonical workload authority;
5. tolerance is explicit and validated;
6. engine corroboration matches exact metric + expression;
7. blocking observations force INCONCLUSIVE;
8. evaluation has no internal wall-clock dependency;
9. evaluation does not freeze/mutate caller inputs;
10. governed observations are fingerprint-bound;
11. exact authoritative RetailCo observations are asserted;
12. full M3.3 regression matrix is green;
13. overall RetailCo verdict remains INCONCLUSIVE;
14. normal CI is green.

Stop and provide an M3.3.1 completion report for PM audit.
