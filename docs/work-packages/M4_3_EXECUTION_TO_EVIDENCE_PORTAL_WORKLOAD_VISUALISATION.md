# Work Package: M4.3 — Execution-to-Evidence Portal & Workload Visualisation

## Objective

Bring the closed M3/M4 canonical execution-to-export spine into the PECP portal without moving engineering logic into React.

Replace the current M0 placeholder Results, Findings and Evidence experiences with deterministic read-only projections of canonical Results, Acceptance, Findings, Evidence Package and Publication Bundle data.

Add governed workload visualisation for schedule shape and journey distribution.

This is a Product Experience integration milestone. It does not change canonical verdicts, evidence models or publishing semantics.

Read:

- `docs/M4_2_CLOSURE.md`;
- `docs/M4_1_CLOSURE.md`;
- `docs/M4_0_CLOSURE.md`;
- `docs/M3_3_CLOSURE.md`;
- `docs/PRODUCT_CONSTITUTION.md`.

Use the existing dark PECP workbench visual language.

Recharts is already available in `@pecp/web`.

Do not call live external APIs.
Do not rerun k6.
Do not infer root cause.
Do not invent missing telemetry.
Do not calculate Acceptance verdicts inside UI components.

## 1. UI authority law

React pages are views over governed canonical objects.

UI components must not independently decide:

- PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE;
- workload attainment status;
- Finding type;
- Defect eligibility;
- Evidence Package validity;
- publication readiness.

Those values come from existing deterministic engines/services.

Charting may derive presentation coordinates from governed schedule/weights, but may not modify or normalize source values.

## 2. Execution-to-evidence service boundary

Add a service interface suitable for current mock/reference data and future API-backed implementation.

Recommended:

`IExecutionEvidenceService`

with a project-scoped read model containing, where available:

- CanonicalExecutionResult;
- AcceptanceEvaluation;
- FindingsRegister;
- PerformanceEvidencePackage;
- PublicationBundle;
- RenderNeutralResultsReport;
- verified TestDefinition / visualisation hook.

Implement a RetailCo mock/reference service using existing authoritative fixtures and deterministic engine functions.

Pages should consume the service, not reconstruct the lifecycle independently.

No page-level raw k6 parsing.

## 3. Results page

Replace the current empty M0 shell.

For authoritative RetailCo show:

### Execution identity

- run id;
- execution mode;
- operational status;
- source Contract;
- source Test Definition;
- execution timestamps.

### Workload

Show business and scheduler demand separately:

- Business target: 8.75 orders/second;
- Scheduler peak: 109.375 journey_iterations/second;
- Scheduler population: JOURNEY_ITERATION;
- Execution model: OPEN.

Never label business throughput as scheduler RPS.

### Acceptance

Show:

- overall verdict = INCONCLUSIVE;
- workload prerequisite = UNRESOLVED;
- derivationStatus = UNRESOLVED_INSUFFICIENT_TIME_SERIES;
- deterministic reason/rationale;
- criteria table.

RetailCo criterion rows:

- Checkout p95 = 0.3906885 ms vs p95 < 2000ms => PASS detail;
- HTTP failure rate = 0 vs rate < 0.005 => PASS detail.

Make visually explicit that green criterion rows do not make the overall run PASS because workload attainment is unresolved.

### Data quality

Show Results completeness/integrity state and raw evidence availability.

Do not claim actual steady-state attainment because the source does not contain the required time-sliced evidence.

## 4. Findings page

Replace the current placeholder/invented bottleneck copy.

For RetailCo show the actual Findings Register:

- generation status = VALID;
- one `WORKLOAD_ATTAINMENT_UNRESOLVED` Finding;
- classification = GOVERNANCE;
- defect eligibility = false;
- zero Defect Candidates.

Remove UI claims that PECP has diagnosed:

- resource contention;
- thread starvation;
- bottlenecks;
- error spikes;

unless a canonical Finding actually says so.

Add clear empty state for zero Defect Candidates.

## 5. Evidence page

Replace M0 empty state with the actual canonical Performance Evidence Package.

Show:

- package status;
- package id/digest;
- Acceptance verdict;
- Findings count;
- Defect Candidate count;
- component inventory;
- raw evidence inventory summary;
- all six required lineage edges;
- verified/unverified state;
- publication/export readiness.

For RetailCo make the distinction explicit:

**Evidence Package VALID**

while:

**Performance Acceptance INCONCLUSIVE**

Do not label VALID package as a passing performance test.

## 6. Export/download presentation

Display the current M4.2 Publication Bundle:

- overall readiness;
- DOWNLOAD readiness;
- API readiness;
- external connector blockers;
- available deterministic artifacts:
  - Evidence Package JSON;
  - Results Report JSON;
  - Results Report Markdown;
  - Results Report HTML;
  - Findings Register JSON when available.

M4.3 may provide browser download actions for already-generated artifact content.

Do not implement Jira/ADO/Confluence/SharePoint network calls.

## 7. Workload Profile visualisation

Add a reusable component such as:

`WorkloadProfileChart`

fed from the verified `ResultsReportVisualisationHook`.

### Scheduler load chart

Use Recharts.

X-axis:

- elapsed time in seconds/minutes.

Y-axis:

- scheduler arrival rate;
- label with the governed scheduler unit.

Build points directly from exact governed stage boundaries:

- first point = schedule start;
- one point per stage end;
- connect consecutive points linearly.

RetailCo exact points:

- t=0s -> 0;
- t=300s -> 109.375;
- t=1200s -> 109.375;
- t=1320s -> 0.

This naturally renders ramp-up, steady-state and ramp-down.

For a stress-style schedule, the chart must show the configured increasing stages rather than assuming a plateau.

For soak/spike/custom schedules, render exactly the supplied stage sequence.

If source startRate is absent, do not invent zero.

## 8. Journey Distribution visualisation

Add a second governed chart.

Preferred presentation:

- stacked area over the same scheduler timeline; and/or
- compact distribution bar/donut companion.

For each scheduler chart point, derived journey rate may be calculated as:

`schedulerRate * governedJourneyWeight`

This is presentation-only derived data.

For authoritative RetailCo at peak:

- Browse: 60.15625 journey_iterations/second;
- Search: 21.875;
- Basket: 16.40625;
- Checkout: 8.75;
- Account: 2.1875.

The sum must equal 109.375.

Rules:

- use supplied weights/percentages exactly;
- do not normalize a distribution that does not total 100%;
- if distribution is incomplete/invalid, display governed warning/absence rather than repairing it.

## 9. Business target presentation

Do not plot 8.75 orders/second on the same numerical axis as 109.375 journey_iterations/second as though the units are equivalent.

Show business demand separately:

- companion KPI/card;
- separate axis/chart only if clearly unit-labelled;
- population relationship/lineage explanation.

For RetailCo explain the governed relationship:

8.75 orders/second / 8% checkout share = 109.375 mixed journey iterations/second.

Do not imply that 8.75 checkout iterations/second automatically proves 8.75 successful orders/second.

## 10. Shared workload visualisation adapter

Keep chart calculation outside React rendering.

Add a pure presentation adapter, for example:

`buildWorkloadVisualisationSeries(hook)`.

Recommended output:

- scheduler points;
- journey stacked-series points;
- series metadata;
- validation issues.

Rules:

- no wall clock;
- deterministic ordering;
- no source mutation;
- no invented values;
- no weight normalization.

## 11. Tests page integration

Enhance the existing Workload Schedule tab with the shared Workload Profile visualisation.

Remove UI fallbacks such as:

- execution model -> OPEN;
- rate unit -> journey_iterations/second;
- population -> JOURNEY_ITERATION;
- generic stage description -> invented engineering description;

when the canonical value is absent.

Render governed absence explicitly.

Keep the existing schedule table and journey detail alongside the chart.

## 12. Existing placeholder copy cleanup

Audit Results, Findings, Evidence and Executions page text.

Remove statements that overclaim current capability or invent diagnosis.

Examples to remove or correct:

- Results saying deterministic PASS/FAIL only;
- Findings promising bottleneck classifications without canonical Finding evidence;
- Evidence implying a performance pass because package is valid.

Use the actual canonical terminology.

## 13. RetailCo reference UX

The reference project should demonstrate the full path visually:

`Execution -> Results -> Acceptance -> Findings -> Evidence -> Export`

Expected visible facts:

- execution completed;
- package valid;
- Acceptance inconclusive;
- criteria details pass;
- workload unresolved;
- one governance Finding;
- zero Defect Candidates;
- export bundle ready for DOWNLOAD/API;
- exact workload profile and journey mix visible.

## 14. Tests

Add deterministic tests for the presentation adapter:

- RetailCo scheduler points exactly 0/300/1200/1320;
- exact rates 0/109.375/109.375/0;
- journey distribution exactly 55/20/15/8/2;
- peak per-journey rates exact;
- journey rates sum to scheduler rate;
- no weight normalization;
- missing startRate remains absent;
- stress-style increasing schedule rendered exactly;
- arbitrary multi-stage schedule preserved.

Add web integration tests proving:

- Results displays INCONCLUSIVE, not PASS;
- Results displays UNRESOLVED workload;
- criteria rows can PASS while overall verdict stays INCONCLUSIVE;
- Findings displays one workload-unresolved finding and zero defects;
- Evidence displays VALID package and INCONCLUSIVE Acceptance separately;
- six lineage edges visible;
- export readiness displays DOWNLOAD/API READY;
- no invented root-cause/bottleneck labels;
- Tests page no longer uses semantic fallback defaults.

## 15. Accessibility

Charts require:

- visible axis/unit labels;
- accessible text summary/table equivalent;
- no colour-only meaning;
- tooltip values include units;
- keyboard-accessible surrounding controls where applicable.

## Explicit non-goals

M4.3 does not:

- create live connector records;
- rerun k6;
- add APM/root-cause analysis;
- perform release certification;
- move canonical calculations into React;
- generate new canonical Findings;
- replace deterministic engines.

## Definition of Done

M4.3 is complete when:

1. Results/Findings/Evidence are populated from canonical service data;
2. RetailCo execution-to-evidence path is visible in portal;
3. workload scheduler profile is graphed from governed stage data;
4. journey distribution is visualized without normalization/invention;
5. business demand remains semantically separate from scheduler demand;
6. arbitrary schedule shapes are supported;
7. UI semantic fallback defaults are removed in touched views;
8. no page independently calculates PECP verdicts;
9. web/presentation tests are green;
10. normal CI remains green.

Stop and provide an M4.3 completion report for PM audit.
