# PECP M3.3.1 Project Manager Review

## Status

**M3.3.1 — SUBSTANTIALLY PASSED, M3.3 NOT YET CLOSED**

The Acceptance Authority, Corroboration & Determinism gate has materially strengthened M3.3 and the normal CI is green.

The following are now verified on authoritative `master`:

- exact authoritative RetailCo observed values are asserted;
- Contract -> Test Definition criterion parity is checked;
- Test Definition self-integrity is recomputed;
- target/unit/population/time-basis mismatch tests exist;
- tolerance is explicit and validated;
- corroboration matches exact metric + threshold expression;
- blocking observations force INCONCLUSIVE;
- wall-clock calls were removed from acceptance evaluation;
- governed observations are cloned before output freezing;
- governed observations are fingerprint-bound;
- all comparison operators and supported unit conversions are tested.

One final acceptance-evidence binding gate is required before M3.3 can close.

## Authoritative implementation

Implementation SHA:

`e59f1abac0e90cd4b418388270bbfc4c060e8078`

CI run:

`35607704467`

Result: **SUCCESS**

Verified:

- 19 Vitest files passed;
- **288 Vitest tests passed**;
- **48 Acceptance Engine tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **298 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Exact authoritative RetailCo values

Verified against the preserved M3.1B artifact:

- Checkout p95 = `0.3906885 ms`;
- HTTP request failure rate = `0`;
- global HTTP p95 = `0.330927 ms`;
- Checkout criterion detail = PASS;
- Error Rate criterion detail = PASS;
- workload prerequisite = UNRESOLVED;
- overall verdict = INCONCLUSIVE.

## Remaining blocking findings

### 1. Acceptance fingerprint is not SHA-256

The completion report describes the evaluation fingerprint as SHA-256.

The live implementation still uses:

`computeStringChecksum(...)`

which is the existing 32-bit FNV-1a drift checksum.

That helper explicitly states that it is **not cryptographic**.

This does not satisfy a claim that the Acceptance Evaluation itself is cryptographically bound.

Do not change the existing legacy Contract/Test Definition fingerprints used by historical M3.1B evidence.

Instead introduce a dedicated acceptance-evaluation SHA-256 digest/fingerprint while preserving the existing legacy fingerprints as input bindings.

### 2. Acceptance fingerprint does not bind full criterion semantics

The current fingerprint payload binds each criterion primarily through:

- criterion id;
- outcome status;
- observed value;
- normalized threshold.

It does not bind the complete accepted semantics such as:

- operator;
- canonical threshold value;
- canonical unit;
- percentile;
- scope;
- evidence source path;
- exact corroborating threshold identity/status.

The legacy Contract/Test Definition drift fingerprints also do not contain every one of these fields.

Therefore the final Acceptance Evaluation digest must bind the normalized full criterion evaluation content, not rely only on the legacy upstream fingerprints.

### 3. Missing Results workload authority can still be accepted

The engine detects **mismatches** when Results acceptance-basis target/unit/population are present, but does not require all governed bindings to be present when an observed acceptance value is claimed.

A result can currently claim a steady-state `resultValue` while omitting one or more of:

- `governedDemand.targetValue`;
- `governedDemand.unit`;
- `governedPopulation`.

The engine can then fall back to Test Definition authority and evaluate the observation.

For an observed acceptance-basis value to be accepted, Results must carry the governed demand/population bindings that show what that value represents.

Missing required binding => INVALID / INCONCLUSIVE.

### 4. actualSourceMetric is checked for non-empty text, not evidence grounding

A claimed `resultValue` is currently accepted when `actualSourceMetric` is any non-empty string.

The engine does not prove that the named source metric exists in the governed Results/evidence lineage.

Required:

- a claimed result value must identify a recognized/grounded source metric;
- for the current M3.1B/M3.2 model, `pecp_business_attainment_events` is grounded by the ingested raw metric;
- a fabricated source metric identifier must make workload evidence INVALID.

If future steady-state/windowed evidence uses a different metric, add a governed evidence reference/lineage field rather than accepting arbitrary text.

### 5. Unavailable corroboration is represented as agreement

When a matching threshold observation is UNAVAILABLE / UNSUPPORTED / has null engine result, the current output sets:

`agreesWithEngine: true`

That is semantically misleading. There is no agreement if there is no engine verdict to compare.

Required:

- make agreement nullable/optional;
- unavailable corroboration => agreement unavailable;
- do not turn absence into PASS, FAIL or agreement.

### 6. Same metric with a different threshold expression can hide run-definition drift

Current behavior intentionally leaves corroboration undefined if the metric matches but expression differs.

That is acceptable when no engine threshold evidence exists for the criterion.

However, if Results contain threshold observations for the **same metric** but none match the canonical expected expression, that is evidence that the executed provider threshold semantics differ from the criterion being evaluated.

For a provider-generated k6 threshold criterion, treat this situation as an execution/criterion evidence conflict and overall INCONCLUSIVE rather than silently ignoring the mismatching threshold.

This closes the historical weak-fingerprint gap for the current authoritative k6 run.

### 7. Deterministic evaluatedAt claim differs from implementation

The completion report says `evaluationTimestamp` falls back to the execution run's `completedAt`.

The live implementation leaves `evaluatedAt` undefined unless the caller supplies `evaluationTimestamp`.

Both approaches can be deterministic, but the report and implementation must agree.

Recommended:

`evaluatedAt = supplied evaluationTimestamp ?? results.run.timestamps.completedAt`

This uses governed execution time, not wall-clock time.

## Decision

Do not begin Findings, defect generation, Evidence Package or release certification.

Complete:

**M3.3.2 — Acceptance Evidence Binding & Cryptographic Finalization Gate**

Then re-audit and, if clean, formally close M3.3.
