# M3.2 Closure — Canonical Results Model & Deterministic Evidence Ingestion

## Status

**M3.2 — CLOSED ✅**

The canonical Results Model and deterministic raw-evidence ingestion stage is complete.

PECP can now ingest the authoritative M3.1B execution evidence into a governed, provenance-bound canonical result representation without assigning a final performance verdict and without silently inventing missing measurements.

## Authoritative implementation

M3.2 final implementation commit:

`e13b4521efa1d43094e05b57b4215d11a4961cac`

Normal CI run:

`35590840870`

The Build/Lint/Test job completed successfully.

Verified test counts:

- 18 Vitest files;
- **240 Vitest tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **250 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Authoritative reference evidence

The principal M3.2 regression source remains the immutable canonical artifact from:

- GitHub Actions run: `35577599469`;
- artifact id: `10629771462`;
- artifact name: `m3-1b-evidence-canonical-35577599469`;
- artifact SHA-256: `0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91`.

Exact canonical artifact bytes are preserved under:

`packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical/`

## Closed M3.2 capabilities

M3.2 now provides:

- canonical `ExecutionRun` identity and provenance;
- raw evidence inventory with presence/checksum/size verification;
- deterministic k6 v0.54.0 summary parsing;
- support for authoritative flat summary-export semantics;
- supported legacy `.values` parsing where intentionally retained;
- finite-number validation for normalized metric values;
- k6 threshold observations preserved without PECP verdict translation;
- journey/root-check evidence preservation;
- scheduler-arrival and business-event semantic separation;
- Reference Lab before/after/delta corroboration;
- explicit Reference Lab evidence source locator;
- business-event consistency checks;
- full-test-average descriptive workload observation;
- separate acceptance-basis workload attainment;
- unresolved steady-state attainment when time-sliced evidence is absent;
- explicit data-quality and integrity issues;
- deterministic missing-manifest behavior;
- required-artifact completeness governance;
- credential leakage detection;
- zero-invention missingness semantics;
- no `NaN` / Infinity in canonical normalized metrics;
- no fabricated `pecp_workload_attainment_rate`.

## M3.2.1 fidelity corrections

The original reconstructed fixture was replaced with the actual M3.1B GitHub Actions artifact.

The parser was aligned to the real k6 v0.54.0 export shape, including:

- direct metric dictionaries;
- boolean threshold state;
- root-check maps;
- exact authoritative p95 / VU / counter observations.

## M3.2.2 zero-invention hardening

Canonical result semantics now distinguish:

- missing numeric evidence vs measured zero;
- malformed metric values vs valid values;
- missing workload target/population vs governed values;
- missing root-check counters vs explicit zero;
- missing manifest vs valid evidence.

## M3.2.3 canonical missingness & map integrity

The final gate verified:

- missing business target unit remains absent;
- `actualSourceMetric` is only populated when its raw metric actually exists;
- Reference Lab route/status counter maps are normalized and finite-value checked;
- malformed map values are excluded and surfaced as `MALFORMED_METRIC`;
- explicit measured zero remains zero;
- the authoritative M3.1B regression remains exact.

## Authoritative M3.1B result facts preserved

The canonical ingestion regression preserves:

- execution run id: `pecp-ref-canonical-1789978991064`;
- workflow run id: `35577599469`;
- repository SHA: `76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`;
- k6 v0.54.0;
- 120,981 iterations;
- 8 dropped iterations;
- 9,671 business events;
- 9,671 Reference Lab `order_created` events;
- 120,982 total Reference Lab request delta;
- scheduler peak: 109.375 journey iterations/sec;
- business target: 8.75 orders/sec;
- exact route/status corroboration;
- absent `pecp_workload_attainment_rate`;
- acceptance-basis attainment: `UNRESOLVED_INSUFFICIENT_TIME_SERIES`;
- performance verdict: `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`.

## Critical semantic boundary

M3.2 describes and governs evidence.

It does **not** decide whether the system passed.

The raw k6 threshold observations in the M3.1B run may be green, but PECP cannot declare PASS from them alone.

The accepted governance law remains:

- PASS = required workload attained + every defined canonical acceptance criterion passes;
- FAIL = required workload attained + one or more defined canonical acceptance criteria fail;
- PASS_WITH_OBSERVATION = required workload attained + all required criteria pass + governed non-blocking observations exist;
- INCONCLUSIVE = required workload not attained, run invalid for non-SUT reasons, or required acceptance criteria cannot be evaluated.

The authoritative M3.1B result currently has unresolved steady-state/acceptance-basis workload attainment. M3.3 must therefore treat that prerequisite explicitly before considering an overall verdict.

## Closure decision

**M3.2 is formally CLOSED.**

Next authorised stage:

**M3.3 — Deterministic Acceptance Engine**

No Findings, defect generation, release certification, or Evidence Package generation is authorised until M3.3 is complete.
