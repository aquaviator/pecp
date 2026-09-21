# Work Package: M3.2 — Results Model & Raw Execution Evidence Ingestion

## Objective

Introduce PECP's canonical Results Model and ingest raw governed execution evidence without evaluating a final PECP performance verdict.

M3.2 converts immutable raw execution evidence into a governed, queryable, provenance-bound result representation.

Input authority is the completed M3.1B execution evidence.

Read:

- `docs/M3_1B_CLOSURE.md`
- `docs/PRODUCT_CONSTITUTION.md`
- execution/test-definition/domain packages
- canonical M3.1B evidence schema

Do not implement PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE.
Do not implement Findings or Evidence Package generation.
Do not begin M4.

## 1. Canonical ExecutionRun identity

Add a canonical immutable ExecutionRun model.

At minimum:

- executionRunId;
- executionMode;
- operationalStatus;
- repositoryCommitSha;
- workflowRunId;
- executionArtifact identity/digest;
- startedAt;
- completedAt;
- durationSeconds;
- engine name/version;
- engine exit code;
- target identity;
- preflight status;
- source Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- bundle fingerprint;
- runtime version/source id.

ExecutionRun must preserve source evidence identity. It must not reconstruct or invent missing provenance.

## 2. Raw evidence references

Represent required raw evidence explicitly.

At minimum:

- execution-manifest;
- summary.json;
- stdout;
- stderr;
- config.json;
- journeys.js;
- entrypoint.js;
- runtime.js;
- Reference Lab metrics snapshots/delta.

Each evidence reference should support:

- filename/type;
- checksum;
- size;
- source/artifact locator;
- availability/presence status.

Do not persist cleartext credentials.

## 3. k6 summary ingestion

Create a deterministic parser for the exact k6 summary format produced by the pinned M3.1B engine.

Normalize, where present:

- iterations;
- dropped_iterations;
- http_reqs;
- http_req_failed;
- checks;
- VUs / max VUs;
- HTTP duration distributions;
- threshold observations;
- PECP custom metrics;
- journey-duration metrics.

Preserve the raw metric name and raw source value alongside normalized semantics.

Unsupported or absent metrics must be represented explicitly as absent/unsupported, never defaulted to zero unless the raw source actually says zero.

## 4. Workload execution observations

Create separate result structures for:

### Scheduler execution

- scheduler population;
- governed peak rate;
- schedule identity;
- actual iterations;
- dropped iterations;
- arrival-demand counter/rate where emitted.

### Business events

- governed metric;
- governed target;
- observed event count;
- observed raw rate where emitted;
- Reference Lab corroborating event count.

Do not conflate scheduler iterations with business events.

## 5. Reference Lab corroboration

Ingest before/after/delta Reference Lab metrics.

Preserve:

- total request delta;
- route counts;
- status counts;
- business event counts;
- capture timestamps.

Create consistency observations, e.g. k6 business-event count vs Reference Lab `order_created` count, but do not create a final performance verdict.

A mismatch should be represented as a result integrity/data-quality issue.

## 6. Thresholds are observations

Ingest k6 threshold state as raw engine evidence.

A threshold may be:

- observed passed;
- observed failed;
- unavailable;
- unsupported/unparseable.

Do not translate threshold state into PECP PASS/FAIL.

Preserve:

- metric;
- expression;
- engine result;
- raw source.

## 7. Data quality / completeness

Introduce explicit result quality/completeness semantics.

At minimum detect:

- missing manifest;
- missing summary;
- checksum mismatch;
- missing required binding;
- parser incompatibility;
- missing required custom metric;
- Reference Lab metrics unavailable;
- business-event count mismatch;
- execution operational status not completed.

Do not silently repair incomplete data.

## 8. Workload attainment representation

M3.2 may calculate deterministic observations required for future acceptance, but must not assign the final verdict.

If deriving attainment, preserve complete lineage:

- governed demand;
- governed population;
- actual source metric;
- calculation formula;
- units;
- time basis;
- result.

Do not use whole-test average rate as a substitute for steady-state peak attainment unless the Contract/Test Definition explicitly defines that measurement basis.

Do not invent `pecp_workload_attainment_rate` when it is absent from the raw summary.

Decide and document whether:

1. workload attainment must be emitted directly at runtime;
2. it can be deterministically derived from raw time-series/summary data;
3. both are required/cross-checked.

If current evidence is insufficient for a valid peak/steady-state attainment calculation, represent it as unresolved rather than guessing.

## 9. Preserve M3.1B reference run as fixture

Use the authoritative M3.1B canonical artifact/run as a reference ingestion fixture.

Expected invariant facts include:

- workflow run `35577599469`;
- repository SHA `76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`;
- k6 `0.54.0`;
- canonical duration ~1321.161s;
- 120981 k6 iterations;
- 8 dropped iterations;
- 9671 business events;
- Reference Lab `order_created = 9671`;
- verdict remains NOT_EVALUATED.

Do not hard-code these values into generic parser behaviour. They belong only to the reference fixture/tests.

## 10. Package boundaries

Prefer canonical domain/result types in `@pecp/pe-domain` and deterministic ingestion/parsing logic in the appropriate engine package.

Do not put source-of-truth result semantics only in the web UI.

UI work in M3.2 should be minimal and only if needed to demonstrate the model.

## 11. Tests

Add positive and negative tests covering:

- valid canonical M3.1B evidence ingestion;
- checksum mismatch;
- missing raw artifact;
- absent custom metric;
- k6 threshold observation parsing;
- dropped iteration parsing;
- business event parsing;
- Reference Lab corroboration;
- mismatched business event counts;
- provenance/fingerprint preservation;
- no credential persistence;
- no PECP verdict field/value produced.

Normal CI remains fast and must not execute real k6.

## 12. Explicit non-goals

Do not:

- assign PASS;
- assign FAIL;
- assign PASS_WITH_OBSERVATION;
- assign INCONCLUSIVE;
- decide release certification;
- create defects/findings;
- produce final Evidence Package;
- change the canonical workload to make the reference run look successful.

## Definition of Done

M3.2 is complete when:

1. canonical ExecutionRun and Results types exist;
2. authoritative M3.1B evidence can be deterministically ingested;
3. all source bindings/provenance are preserved;
4. raw k6 metrics and threshold states are represented without verdict translation;
5. scheduler and business attainment observations remain semantically separate;
6. Reference Lab evidence is ingested and cross-checkable;
7. missing/invalid evidence becomes explicit quality issues;
8. no values are invented;
9. no final PECP performance verdict is assigned;
10. normal CI is green.

Stop at Results Model / ingestion completion and provide a completion report for PM audit.
