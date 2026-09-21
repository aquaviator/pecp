# PECP M3.3 Project Manager Review

## Status

**M3.3 — IMPLEMENTATION FOUNDATION ACCEPTED, NOT YET CLOSED**

The deterministic Acceptance Engine architecture is now present outside the UI and the central PECP law is correctly implemented:

- unresolved / unmet workload demand cannot produce PASS;
- unresolved / unmet workload demand cannot produce FAIL;
- the authoritative RetailCo run evaluates overall INCONCLUSIVE because acceptance-basis workload attainment is unresolved.

Normal CI is green.

However, the current implementation still has several acceptance-authority and determinism gaps that must be corrected before PECP is allowed to treat M3.3 verdicts as authoritative.

A single consolidated correction gate is required:

**M3.3.1 — Acceptance Authority, Corroboration & Determinism Gate**

No new real k6 execution is required.

---

## Authoritative remote implementation

Implementation SHA:

`1dc3519de63c7b29ce3cdafea082e18198ed33ed`

CI run:

`35592049576`

Result:

**SUCCESS**

Verified:

- 19 Vitest files passed;
- **259 Vitest tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **269 combined tests**;
- TypeScript typecheck passed;
- production build passed.

---

## Accepted M3.3 capabilities

The following implementation choices are accepted:

- Acceptance domain types are in `@pecp/pe-domain`;
- deterministic acceptance logic is in `@pecp/test-engine`, not UI;
- overall verdicts are limited to PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE;
- provenance and operational/evidence gates run before workload/criterion outcomes;
- workload attainment is evaluated as a prerequisite;
- unresolved workload produces INCONCLUSIVE;
- workload not attained produces INCONCLUSIVE even when a criterion independently fails;
- canonical criteria are compared independently from k6 threshold booleans;
- k6 threshold observations are corroborating evidence only;
- engine disagreement can force INCONCLUSIVE;
- missing raw criterion metric produces NOT_EVALUABLE;
- immutable output is attempted through deepFreeze;
- evaluation fingerprint excludes wall-clock timestamp;
- authoritative RetailCo overall verdict is INCONCLUSIVE.

These are the correct architectural foundations.

---

## Correction to the supplied completion report

The completion report states authoritative RetailCo observations of approximately:

- Checkout p95 = 115 ms;
- HTTP error rate = 0.078%.

Those values are **not** present in the authoritative M3.1B artifact.

The exact authoritative artifact used by M3.2/M3.3 records:

- `http_req_duration{journey:checkout}.p(95) = 0.3906885 ms`;
- `http_req_failed rate/value = 0`;
- global `http_req_duration.p(95) = 0.330927 ms`.

The current M3.3 test only asserts that the observations are below their thresholds, so the incorrect narrative values did not make CI fail.

M3.3.1 must add exact authoritative observed-value assertions so completion reports cannot drift from evidence.

---

## Blocking findings

### 1. NOT_EVALUABLE criteria still invent threshold zero values

When a criterion has a missing/unsupported operator or missing threshold, the current engine writes fallback fields such as:

`canonicalThresholdValue: crit.thresholdValue ?? 0`

and:

`normalizedComparisonThreshold: crit.thresholdValue ?? 0`.

This violates PECP's zero-invention law.

A missing threshold is not a threshold of zero.

Required:

- make threshold/operator fields optional where a criterion is not evaluable;
- preserve missing canonical input as missing;
- never write 0 unless the canonical criterion explicitly supplies 0.

---

### 2. Test Definition criteria are not independently checked against Contract criteria

The engine evaluates `testDefinition.executableCriteria` but does not require exact criterion authority parity with the approved Performance Contract.

This is a serious governance gap because the existing Contract/Test Definition drift fingerprints do not bind every acceptance semantic field.

At minimum cross-check each executable criterion against the Contract criterion with the same id for:

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

Also require every executable criterion to come from a Contract criterion in DEFINED status.

A mutated Test Definition threshold/operator/unit/scope must not be evaluated as authoritative merely because the stored fingerprint still matches older fingerprint semantics.

Any mismatch => provenance/criterion authority invalid => overall INCONCLUSIVE.

Also surface approved-contract criteria that are AMBIGUOUS / UNRESOLVED / CONFLICTING as non-evaluable governance state rather than silently ignoring them.

---

### 3. The current Test Definition object is not self-verified against its fingerprint

M3.3 compares:

- Test Definition stored fingerprint;
- Results stored Test Definition fingerprint.

It does not recompute the current Test Definition drift fingerprint from the object being evaluated.

Add a self-integrity check using `computeTestDefinitionFingerprint`.

Because the legacy Test Definition fingerprint does not include every acceptance semantic field, this self-check is necessary but not sufficient; it must be used together with the Contract criterion parity check above.

---

### 4. Workload acceptance evidence is not cross-checked against Test Definition workload authority

The engine currently takes the target primarily from `testDefinition.workloadAttainment` but does not validate the Results acceptance-basis governed demand against that source.

Before evaluating attainment, verify compatibility of authoritative fields where present:

- Results governed target value vs Test Definition workload target;
- Results governed target unit vs Test Definition workload unit;
- Results governed population vs Test Definition population relationship output population;
- acceptance-basis time basis;
- actual source metric when an observed value is claimed.

A mismatch/absence in required bindings must yield INVALID/UNRESOLVED and overall INCONCLUSIVE.

Do not simply ignore a conflicting Results target because the Test Definition contains a target.

---

### 5. Tolerance validation is incomplete

`tolerancePercentage` is applied arithmetically without validating the supplied value.

Required:

- absent tolerance => no tolerance is applied and required minimum equals target;
- supplied tolerance must be finite and within a governed valid percentage range;
- invalid tolerance => workload prerequisite INVALID / overall INCONCLUSIVE;
- no default 5% or any other tolerance.

Add explicit tests for both supplied and absent tolerance.

---

### 6. Engine-threshold corroboration matches metric only, not metric + expression

The work package requires deterministic matching by normalized metric identity **and expression**.

Current code uses `.find()` on the metric name only.

If multiple thresholds exist on the same metric, PECP can corroborate against the wrong threshold observation.

Required:

- construct the expected normalized threshold expression from the canonical criterion;
- match exact normalized metric + exact expression;
- do not borrow another threshold on the same metric;
- add a multi-threshold regression proving the correct observation is selected.

Also handle UNAVAILABLE/UNSUPPORTED threshold observations without treating them as an engine failure merely because `engineResult` is null.

If threshold status and `engineResult` internally disagree, surface an evidence conflict.

---

### 7. Blocking governed observations can currently produce PASS

The final decision currently filters only non-blocking observations.

A supplied observation with:

`isBlocking: true`

is not used to prevent PASS/FAIL.

This contradicts the domain comment and work package rule that blocking integrity/validity observations produce INCONCLUSIVE.

Required:

- if any governed blocking observation is present, overall verdict = INCONCLUSIVE;
- it must not become PASS_WITH_OBSERVATION;
- add explicit regression tests.

---

### 8. Default evaluation metadata uses wall-clock time

The engine defaults to:

- `new Date().toISOString()`;
- `Date.now()` inside evaluation id.

Therefore two calls with identical authoritative inputs do not return an identical evaluation object, even though the fingerprint is stable.

The work package required evaluation timestamp to be supplied by caller or deterministic context.

Required:

- remove wall-clock calls from the deterministic engine;
- either require caller-supplied evaluation metadata, derive deterministic defaults from governed context, or leave timestamp absent by updating the domain;
- derive a stable evaluation id from the evaluation fingerprint when no explicit id is supplied;
- identical inputs with no external time input should produce identical normalized evaluation content.

---

### 9. deepFreeze currently freezes caller-owned governed observations

The output references the caller's `governedObservations` array directly and deepFreeze recursively freezes it.

That makes evaluation have an observable side effect on caller-owned input data.

Required for a pure engine:

- copy/normalize governed observations before freezing the AcceptanceEvaluation;
- prove caller input remains unfrozen/unmodified.

---

### 10. Acceptance fingerprint does not bind governed observation content

The fingerprint includes overall verdict but not the governed observation identities/content.

Two different non-blocking observations can therefore produce the same PASS_WITH_OBSERVATION fingerprint if all other evidence is identical.

Bind normalized governed observation content into the acceptance fingerprint, at minimum:

- id;
- source;
- severity;
- isBlocking;
- provenanceReference.

Description may also be bound if it is part of canonical governed observation content.

Do not include wall-clock timestamp.

---

### 11. Required DoD tests are incomplete

The current AcceptanceEngine test suite does not yet cover all required M3.3 work package cases.

Add explicit coverage for:

- every comparison operator: <, <=, >, >=, ==;
- seconds -> milliseconds normalization;
- percent -> fraction/rate normalization;
- missing percentile;
- unsupported/missing scope metric;
- explicit workload tolerance;
- no workload tolerance;
- ambiguous/unresolved/conflicting canonical criterion;
- blocking governed observation;
- exact metric + expression threshold corroboration;
- multiple thresholds on one metric;
- unavailable threshold corroboration;
- workload target/unit/population mismatch;
- deterministic default metadata;
- exact authoritative RetailCo observed metric values.

---

## Decision

Do not start Findings, Evidence Package, defect generation or release certification.

Complete:

**M3.3.1 — Acceptance Authority, Corroboration & Determinism Gate**

Then re-audit M3.3.

The overall RetailCo reference expectation remains:

- Checkout latency criterion detail = PASS;
- global error-rate criterion detail = PASS;
- workload prerequisite = UNRESOLVED;
- overall verdict = INCONCLUSIVE.
