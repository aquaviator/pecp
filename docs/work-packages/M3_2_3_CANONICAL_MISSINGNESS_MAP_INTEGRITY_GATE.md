# Work Package: M3.2.3 — Canonical Missingness & Map Integrity Gate

## Objective

Close the final three zero-invention gaps in the canonical Results Model so M3.2 can be formally closed and safely handed to the Acceptance Engine.

Read:

- `docs/M3_2_2_PM_REVIEW.md`
- `docs/work-packages/M3_2_2_ZERO_INVENTION_SEMANTIC_HARDENING_GATE.md`

Do not implement M3.3.
Do not run real k6.
Do not assign a final PECP performance verdict.

## 1. Preserve missing business target unit

In `BusinessEventsObservation.governedTarget`:

- source unit present -> preserve exact unit;
- source unit absent -> undefined;
- do not use empty string as a placeholder.

Add a regression test.

## 2. Preserve missing attainment source metric

Update `WorkloadAttainmentObservation` so `actualSourceMetric` can represent absence.

Populate `actualSourceMetric = pecp_business_attainment_events` only when that raw metric is actually present in the ingested evidence.

For unresolved acceptance-basis results where the metric is absent:

- `actualSourceMetric` must remain undefined;
- derivation remains unresolved;
- no placeholder metric name may be injected.

For the authoritative M3.1B artifact, preserve the metric name exactly because the metric is present.

Add positive and negative regression tests.

## 3. Validate Reference Lab route/status counter maps

Add deterministic normalization for:

- `referenceLabMetrics.delta.requestsByRoute`;
- `referenceLabMetrics.delta.statusCounts`.

Rules per map:

- map absent -> undefined;
- key value explicitly 0 -> preserve 0;
- finite numeric value -> preserve;
- malformed / NaN / Infinity -> create `MALFORMED_METRIC` issue and do not allow invalid numeric data into canonical Results.

Do not coerce arbitrary non-numeric strings into canonical numbers.

Add tests covering:

- missing route map;
- missing status map;
- explicit zero route/status counters;
- malformed route counter;
- malformed status counter;
- no NaN / Infinity in canonical result.

## 4. Authoritative regression must remain exact

The authoritative M3.1B fixture must still ingest with:

- run id `pecp-ref-canonical-1789978991064`;
- workflow `35577599469`;
- 120981 iterations;
- 8 dropped iterations;
- 9671 business events;
- 9671 Reference Lab orders;
- 120982 total Reference Lab requests;
- exact route/status maps;
- 109.375 scheduler peak;
- 8.75 orders/sec target;
- unresolved acceptance-basis attainment;
- no `pecp_workload_attainment_rate`;
- `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`.

## Definition of Done

M3.2.3 is complete when:

1. missing target unit remains absent;
2. missing attainment source metric remains absent;
3. Reference Lab route/status maps reject malformed values;
4. explicit measured zeros remain zeros;
5. no invalid numeric values enter canonical Results;
6. authoritative artifact regression remains exact;
7. normal CI is green;
8. no final PECP performance verdict is assigned.

Stop and provide an M3.2.3 completion report for PM audit.
