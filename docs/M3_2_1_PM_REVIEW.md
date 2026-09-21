# PECP M3.2.1 Project Manager Review

## Status

**M3.2.1 — SUBSTANTIALLY PASSED, M3.2 NOT YET CLOSED**

The authoritative-evidence fidelity correction is real and materially improves M3.2. The exact canonical files from GitHub Actions run `35577599469` are now committed as the principal fixture, the k6 v0.54.0 flat summary shape is parsed, threshold/root-check semantics are aligned, and the major RetailCo hard-coded defaults were removed.

A final narrow zero-invention semantic hardening gate is still required before M3.2 can close and M3.3 may begin.

## Authoritative remote implementation

The completion report cites local commit:

`d8289fc`

The authoritative GitHub implementation commit is:

`64cac4f8b55a1616385b0b2f64eb5c0a2cc72429`

Normal CI:

`35586651211`

Result: **SUCCESS**

Verified:

- 18 Vitest files passed;
- **228 Vitest tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- combined **238 tests**;
- TypeScript typecheck passed;
- production build passed.

## Authoritative artifact fidelity accepted

The live repository contains all eight canonical files under:

`packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical/`

Verified file sizes match the authoritative GitHub Actions artifact:

- config.json — 3,244 bytes;
- entrypoint.js — 1,796 bytes;
- execution-manifest.json — 6,809 bytes;
- journeys.js — 3,623 bytes;
- k6-stderr.log — 0 bytes;
- k6-stdout.log — 222,662 bytes;
- runtime.js — 4,305 bytes;
- summary.json — 6,178 bytes.

The completion-report SHA-256 values also match the independently preserved M3.1B artifact.

Accepted corrections include:

- real artifact bytes replace reconstructed MOCK authority;
- parser supports flat k6 v0.54.0 metrics and legacy `.values` shape;
- authoritative p95/root-check/VU values are preserved;
- boolean threshold semantics are mapped against the authoritative export;
- `pecp_workload_attainment_rate` is represented as a k6 Rate and remains absent when not emitted;
- scheduler/business observations remain separate;
- missing source workload target no longer becomes 8.75;
- missing scheduler population no longer becomes JOURNEY_ITERATION;
- all seven non-manifest raw files are tested for required-artifact completeness;
- Reference Lab metrics now have an explicit manifest source locator;
- full-test average observation is separated from unresolved acceptance-basis attainment;
- no PECP final performance verdict is assigned.

## Remaining blocking findings

### 1. Missing k6 summary duration is still converted to numeric zero

The authoritative M3.1B `summary.json` does not contain:

`state.testRunDurationMs`

but `parseK6SummaryJson()` currently executes:

`Number(parsed.state?.testRunDurationMs ?? 0)`

and `K6SummaryMetrics.testRunDurationMs` is a required number.

Therefore the authoritative raw summary is normalized as though it measured a 0 ms test duration.

That violates the zero-invention rule.

Required correction:

- make the normalized summary duration optional / explicitly unavailable;
- do not emit 0 unless the source actually contains 0;
- use the execution manifest's governed duration separately when needed.

### 2. Workload-attainment objects still inject 0 / “unspecified” placeholders

When source demand/population data is absent, the generic ingestion path still builds attainment objects with:

- `metric: 'unspecified'`;
- `targetValue: 0`;
- `governedPopulation: 'unspecified'`;
- empty unit strings.

This is especially important because:

`workloadAttainmentObservation`

is the object intended for downstream Acceptance Engine consumption.

M3.3 must never be able to mistake placeholder 0 / unspecified values for governed evidence.

Required correction:

- make governed demand/population fields optional or model an explicit unresolved source state;
- never store target 0 unless source evidence says target 0;
- acceptance-basis attainment remains unresolved when required source bindings are absent.

### 3. Reference Lab missing fields can still become zero-valued evidence

Reference Lab corroboration currently uses expressions such as:

- `Number(delta.orderCreatedEvents ?? 0)`;
- `Number(delta.totalRequests ?? 0)`;
- `Number(delta.durationSeconds ?? 0)`;
- empty-map fallbacks for routes/statuses.

If a source field is missing, that is missing evidence, not a measured zero.

Required correction:

- preserve undefined/unavailable values;
- create an explicit quality issue for malformed/incomplete Reference Lab delta evidence;
- only compare business counts when both source counts are actually available.

### 4. “All 8 required artifacts” is not yet proven for missing manifest

The negative test iterates the seven evidence inputs other than the execution manifest.

The ingestion API requires `manifest`, while directory ingestion throws if it is absent.

The M3.2.1 gate required all eight canonical files to govern completeness.

Required correction:

- define explicit behavior for a missing execution-manifest;
- either return a canonical ingestion failure result carrying `MISSING_MANIFEST / MISSING_REQUIRED_ARTIFACT`, or provide a deterministic envelope/error model that represents this as governed ingestion failure;
- add the missing-manifest test.

Do not allow an unhandled runtime failure during manifest evidence hashing.

### 5. Malformed numeric metric values are not surfaced

The M3.2.1 work package explicitly required malformed direct and legacy/nested metric values to be surfaced.

Current parsing uses `Number(...)` and can produce `NaN` without a `MALFORMED_METRIC` result-quality issue.

Required correction:

- validate finite numeric values;
- malformed supplied metrics must produce deterministic parser/data-quality failure;
- do not silently return NaN;
- add direct-flat and legacy-nested malformed metric tests.

### 6. Root-check missing counters still default to zero

Root check parsing currently uses:

`Number(c.passes ?? 0)`
`Number(c.fails ?? 0)`

If those counters are absent, zero is invented.

Required correction:

- either make root-check pass/fail counts optional, or reject malformed check records explicitly;
- zero is valid only when the raw check explicitly records zero.

## Decision

Do not start M3.3.

Complete one final narrow correction:

**M3.2.2 — Zero-Invention Semantic Hardening Gate**

No new real k6 execution is required.

Once this gate is green, M3.2 can be formally closed and the Acceptance Engine work package can begin.
