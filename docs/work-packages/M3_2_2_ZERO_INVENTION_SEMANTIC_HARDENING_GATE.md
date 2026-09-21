# Work Package: M3.2.2 — Zero-Invention Semantic Hardening Gate

## Objective

Remove the remaining implicit zero/sentinel substitutions from canonical Results ingestion so downstream Acceptance Engine logic can distinguish measured zero, missing evidence, malformed evidence and unresolved evidence without ambiguity.

This is the final M3.2 correction gate.

Read:

- `docs/M3_2_PM_REVIEW.md`
- `docs/M3_2_1_PM_REVIEW.md`
- `docs/work-packages/M3_2_RESULTS_MODEL_RAW_EVIDENCE_INGESTION.md`
- `docs/work-packages/M3_2_1_AUTHORITATIVE_EVIDENCE_FIDELITY_GATE.md`

Do not implement M3.3 Acceptance Engine.
Do not run another real k6 test.
Do not assign a PECP final performance verdict.

## 1. Summary duration must preserve absence

The authoritative k6 v0.54.0 summary does not contain `state.testRunDurationMs`.

Change normalized Results semantics so:

- absent summary duration -> undefined / explicit unavailable;
- explicit raw 0 -> 0;
- malformed supplied duration -> parser/data-quality issue.

Do not infer summary duration from the execution manifest inside the k6 summary parser.

The execution manifest duration remains a separate authoritative execution-run field.

## 2. Remove placeholder target/population values from attainment

The canonical workload-attainment model must not use:

- targetValue = 0 as a missing-value placeholder;
- `'unspecified'` as if it were a governed metric/population;
- empty unit strings as evidence.

Update domain types as required so the following can be explicitly absent/unresolved:

- governed metric;
- governed target value;
- governed target unit;
- governed population;
- source metric where not present.

For the authoritative M3.1B fixture, all genuine governed source fields must still preserve their exact values.

For missing-source negative fixtures, acceptance-basis attainment must remain unresolved and must not contain invented demand/population values.

## 3. Reference Lab evidence must distinguish missing from zero

Refactor Reference Lab result types/ingestion so:

- source value present as 0 -> measured zero;
- source field absent -> undefined/unavailable;
- malformed supplied value -> data-quality issue.

Do not use `?? 0` for:

- orderCreatedEvents;
- totalRequests;
- durationSeconds;
- route/status counters.

Only calculate:

- count match;
- discrepancy count;

when both compared counts are actually present.

Add an explicit issue code for incomplete/malformed Reference Lab metrics if appropriate.

## 4. Govern missing execution manifest deterministically

All eight required canonical evidence files must have a defined ingestion failure path.

Add a test for missing `execution-manifest.json`.

Acceptable designs include:

A. an ingestion result envelope with success/failure and structured issues; or

B. a dedicated governed ingestion error carrying deterministic codes such as `MISSING_MANIFEST` / `MISSING_REQUIRED_ARTIFACT`.

Whichever design is chosen:

- no unhandled TypeError/hash error;
- failure reason is machine-readable;
- no partial result can look complete.

## 5. Reject malformed numeric metrics

Create finite-number validation for k6 metric parsing.

For any field supplied as a metric number:

- finite numeric value -> preserve;
- absent -> undefined;
- invalid numeric value / NaN / infinity -> deterministic malformed-metric error/issue.

Cover both:

- authoritative flat k6 v0.54.0 shape;
- supported legacy `.values` shape.

No `NaN` may enter the canonical Results Model.

## 6. Root-check counters must preserve absence

For root-group checks:

- explicit passes/fails 0 -> preserve 0;
- absent passes/fails -> undefined or malformed-check issue;
- invalid passes/fails -> malformed-metric issue.

Do not manufacture zero counters.

Update `K6CheckMetric` types if needed.

## 7. Audit remaining generic fallback values

Audit the complete generic ingestion/parser path for:

- `?? 0`;
- `|| 0`;
- `Number(x ?? 0)`;
- project-specific defaults;
- plausible metric/unit/population defaults;
- empty-string substitutions that can masquerade as source values.

Not every internal counter needs to be optional, but any canonical source/measurement field must distinguish absent from measured zero.

Add tests for each corrected canonical field.

## 8. Authoritative artifact regression

The exact M3.1B artifact fixture must continue to ingest cleanly with:

- 120981 iterations;
- 8 dropped iterations;
- 9671 business events;
- 9671 Reference Lab order_created;
- 120982 total Reference Lab request delta;
- 109.375 governed scheduler peak;
- 8.75 governed business target;
- exact p95 values;
- 282 vus_max;
- five journey root checks;
- absent `pecp_workload_attainment_rate`;
- unresolved steady-state acceptance-basis attainment;
- `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`.

## 9. Negative regression tests

At minimum prove:

- missing summary duration does not become 0;
- explicit raw duration 0 remains 0;
- missing workload target does not create target 0 in any attainment object;
- missing scheduler population does not create an unspecified governed population;
- missing Reference Lab count does not become 0;
- explicit Reference Lab zero remains 0;
- missing manifest fails deterministically with machine-readable issue/code;
- malformed flat numeric metric is rejected/surfaced;
- malformed legacy numeric metric is rejected/surfaced;
- missing root-check counters do not become 0;
- explicit root-check zero remains 0;
- no NaN enters canonical Results;
- no PECP final verdict is assigned.

## Definition of Done

M3.2.2 is complete when:

1. absent canonical numeric fields no longer become zero;
2. placeholder strings cannot masquerade as governed demand/population;
3. Reference Lab missing values remain missing;
4. missing manifest has a deterministic governed failure path;
5. malformed numeric metrics are surfaced;
6. root-check absence is not normalized to zero;
7. authoritative artifact regression remains exact;
8. normal CI is green;
9. no final PECP performance verdict is assigned.

Stop and provide an M3.2.2 completion report for PM audit.
