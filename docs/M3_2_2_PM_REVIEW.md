# PECP M3.2.2 Project Manager Review

## Status

**M3.2.2 — PASS WITH ONE FINAL CANONICAL-MISSINGNESS CORRECTION**

The zero-invention hardening work is materially correct and CI is green. The authoritative M3.1B fixture remains exact, missing duration no longer becomes zero, malformed numeric k6 metrics are rejected, missing manifest is governed, root-check missing counters remain absent, and acceptance-basis attainment remains unresolved.

M3.2 is not formally closed yet because three remaining generic canonical-result fields can still blur absent evidence and typed evidence.

## Authoritative remote implementation

Current implementation SHA:

`354e9d290ea71690dee2375572a0b945c513eadc`

Normal CI:

`35588785806`

Result: **SUCCESS**

Verified:

- 18 Vitest files passed;
- **236 Vitest tests passed**;
- **10 Reference Lab TAP tests passed**;
- combined **246 tests**;
- TypeScript typecheck passed;
- production build passed.

## Accepted corrections

Verified in live code/tests:

- absent `state.testRunDurationMs` remains undefined;
- explicit source duration 0 remains 0;
- malformed flat/legacy metrics are rejected as `MALFORMED_METRIC`;
- non-finite values cannot enter normalized k6 metrics;
- root-check missing passes/fails remain undefined;
- explicit root-check zero remains zero;
- missing execution manifest produces deterministic `MISSING_MANIFEST` and `MISSING_REQUIRED_ARTIFACT`;
- missing workload target no longer becomes target 0;
- missing scheduler population no longer becomes an `unspecified` governed population;
- Reference Lab top-level event/total/duration missing values remain undefined;
- measured Reference Lab zero remains zero;
- full-test average remains distinct from unresolved acceptance-basis attainment;
- no final PECP performance verdict is assigned.

## Remaining corrections before M3.2 closure

### 1. Governed target unit still uses an empty-string fallback

In generic `businessEventsObservation`, a present target with a missing unit currently produces:

`unit: ''`

The domain type already allows the unit to be absent.

Change this to preserve `undefined` when the source unit is absent.

### 2. Workload attainment still invents an actual source metric identifier

`WorkloadAttainmentObservation.actualSourceMetric` is currently required and the ingestion path always writes:

`pecp_business_attainment_events`

including for unresolved acceptance-basis results where that metric may be absent from the input evidence.

The M3.2.2 work package explicitly required source metric to be absent/unresolved when not present.

Make `actualSourceMetric` optional (or model an explicit source-availability state) and only populate it when the underlying metric is actually present.

For the authoritative M3.1B fixture it must remain `pecp_business_attainment_events`.

### 3. Reference Lab route/status maps are not numerically validated

`delta.requestsByRoute` and `delta.statusCounts` are currently copied directly into the canonical model.

Missing whole maps remain absent, which is correct, but malformed supplied route/status counter values can still enter a `Record<string, number>` at runtime without a quality issue.

Normalize each supplied map deterministically:

- absent map -> undefined;
- explicit numeric zero -> zero;
- finite numeric value -> preserve;
- malformed/non-finite supplied value -> `MALFORMED_METRIC` and no invalid value in canonical Results.

Add negative tests for both route and status maps.

## Decision

Do not start M3.3 yet.

Complete one tiny final gate:

**M3.2.3 — Canonical Missingness & Map Integrity Gate**

No new real k6 execution is required.
