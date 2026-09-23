# Work Package: M4.3.1 — Portal Zero-Invention, Canonical Projection & Reference Fidelity Gate

## Objective

Remove the remaining UI-layer inventions from M4.3 so Results, Findings, Evidence, Executions and workload visualisation are faithful projections of canonical PECP objects for any project, not RetailCo-specific screens with fallback engineering facts.

This is the M4.3 correction/closure gate.

Read:

- `docs/M4_3_PM_REVIEW.md`;
- `docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md`;
- `docs/M4_2_CLOSURE.md`;
- `docs/M4_1_CLOSURE.md`;
- `docs/M4_0_CLOSURE.md`.

Do not call external APIs.
Do not rerun k6.
Do not alter Acceptance/Findings/Evidence algorithms.
Do not add live connector actions.
Do not begin M4.4.

## 1. ResultsPage: remove all semantic fallbacks

Remove fallback substitutions for:

- overall Acceptance verdict;
- execution operational status;
- workload prerequisite status;
- workload derivation status;
- criterion observed unit;
- iteration count;
- iteration rate;
- business event count;
- discrepancy count;
- runner engine/version;
- workflow run id;
- repository commit SHA.

Rules:

- source-backed value present -> render exact value;
- source-backed value absent -> render governed absence;
- do not inject authoritative RetailCo constants.

Do not print `100% Corroborated` unless the canonical corroboration state actually proves that statement.

Do not print a fixed iteration rate unless sourced or deterministically derived in a pure presentation helper from present canonical values.

## 2. ResultsPage: preserve exact Acceptance semantics

RetailCo must still display:

- Acceptance = INCONCLUSIVE;
- workload prerequisite = UNRESOLVED;
- derivation = UNRESOLVED_INSUFFICIENT_TIME_SERIES;
- Checkout = PASS at 0.3906885 ms against p95 < 2000ms;
- HTTP failure = PASS at 0 against rate < 0.005.

Add an absence regression proving a malformed/audit-only view does not silently become INCONCLUSIVE/UNRESOLVED.

## 3. FindingsPage: remove canonical-state fallbacks

Remove fallback substitutions for:

- generationStatus -> VALID;
- Acceptance -> INCONCLUSIVE;
- digest -> VALID;
- classification -> GOVERNANCE.

Render actual values or governed absence.

Zero-defect explanation:

- use source/governed blocker information where present;
- otherwise use generic wording without assuming INCONCLUSIVE.

Never infer root cause.

## 4. EvidencePage: render the actual canonical package

Refactor the Evidence page around the actual package model.

### Package header

Render exact:

- package id;
- packageGenerationStatus;
- package digest;
- source execution run id;
- source Contract;
- source Test Definition;
- Acceptance verdict;
- Findings summary.

No fallback ids/statuses.

### Component inventory

Render `evidencePackage.components` dynamically.

For every component display only fields present in the component:

- type;
- canonicalId;
- version;
- status;
- presenceStatus;
- fingerprint/digest where present;
- issues where present.

Do not invent:

- APPROVED;
- VERIFIED;
- COMPLETED;
- INGESTED;
- file counts.

### Lineage

Render `evidencePackage.lineage.edges` dynamically.

Show:

- from component/id;
- binding type;
- to component/id;
- verified state.

For authoritative RetailCo, all six required core edges must be visible and verified.

If an edge is absent, do not render a fake card for it.

### Raw evidence

Render the actual raw evidence inventory / raw artifact summary.

Do not hardcode `8 FILES INTACT`.

### Acceptance separation

Preserve the explicit distinction:

- Evidence Package = VALID;
- Acceptance = INCONCLUSIVE.

But drive both labels from source data.

## 5. EvidencePage: render real M4.2 publication readiness

Use:

`publicationBundle.publicationReadiness`

and:

`publicationBundle.overallReadiness`.

Do not use a hardcoded destination matrix.

Display exact status and blocking reasons for each available destination.

Authoritative RetailCo remains:

- DOWNLOAD READY;
- API READY;
- JIRA/AZURE_DEVOPS/CONFLUENCE/SHAREPOINT BLOCKED_MISSING_DESTINATION_CONFIGURATION.

## 6. ExecutionsPage: remove reference fallbacks and overclaims

Remove fallback values for:

- iterations;
- business event count;
- Test Definition id.

Derive duration display from source duration only.

Update empty/header copy so the UI describes the factual execution record/ingress view actually implemented.

Do not claim active infrastructure orchestration or runner control if it is not implemented.

## 7. WorkloadProfileChart: make fully project-neutral

Remove the hardcoded RetailCo relationship:

`8.75 orders/second ÷ 8% = 109.375 ...`

Population relationship content must either:

- be supplied as governed source/presentation data; or
- not be shown.

Remove unit defaults:

- `units/s`;
- `orders/second`;
- `journey_iterations/second`.

Use the exact governed unit or explicit absence.

Do not display `100% corroborated` simply because a journey distribution sums to 100%.

Preferred neutral wording:

- `Journey distribution total: 100%`;
- or a governed validation message.

## 8. Shared presentation adapter for Test Definition schedule

Move TestDefinition -> `ResultsReportVisualisationHook` conversion out of `TestsPage.tsx`.

Create a pure deterministic helper, for example:

`buildVisualisationHookFromTestDefinition(testDefinition)`.

It must:

- preserve startRate;
- preserve exact stage order;
- derive cumulative stage start/end boundaries deterministically;
- preserve exact target rates;
- preserve exact journey weights/percentages;
- not normalize;
- not mutate input;
- preserve absence.

Use this helper in TestsPage.

Do not calculate schedule timing semantics directly inside JSX/page component logic.

## 9. RetailCo browser snapshot authority check

Add an automated fixture-authority regression.

Rebuild the authoritative RetailCo chain from existing canonical fixtures using the deterministic engine path:

- approved Contract;
- compiled Test Definition;
- authoritative M3.1B raw evidence ingestion;
- Acceptance evaluation;
- Findings generation;
- Evidence Package generation;
- Publication Bundle / Results Report generation.

Compare against `authoritativeRetailCoExecutionEvidence.ts`.

At minimum verify exact equality for:

- Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- execution run id;
- canonical Results authoritative metrics;
- Acceptance id/digest/verdict/workload status;
- Findings Register id/digest/counts;
- Evidence Package id/digest/status;
- Publication Bundle id/digest/readiness;
- Results Report id/digest;
- business demand = 8.75 orders/second;
- scheduler peak = 109.375 journey_iterations/second;
- stage timings = 300/900/120/1320;
- mix = 55/20/15/8/2;
- Checkout observed = 0.3906885 ms;
- error rate = 0;
- one workload-unresolved Finding;
- zero Defect Candidates.

Document that the browser fixture is a generated/reference snapshot and CI guards it against canonical drift.

## 10. Generic/non-RetailCo regressions

The current web tests are primarily RetailCo happy-path tests.

Add at least one synthetic project/evidence state proving:

- no RetailCo id appears;
- no RetailCo workload value appears;
- no default INCONCLUSIVE appears when verdict absent;
- no default VALID appears when status absent;
- no default GOVERNANCE appears when classification absent;
- no RetailCo population relationship sentence appears;
- publication readiness comes from supplied bundle state.

## 11. Workload chart regressions

Keep existing exact RetailCo adapter tests.

Add:

- missing rate unit -> visible governed absence, not `units/s`;
- missing business unit -> governed absence;
- incomplete distribution -> no `100% corroborated` claim;
- generic 100% distribution -> neutral distribution-total wording;
- custom project business/scheduler rates -> no RetailCo relationship text.

## 12. TestsPage touched-view cleanup

Confirm the touched schedule view contains no semantic defaults for:

- execution model;
- arrival population;
- scheduler unit;
- scheduler start rate;
- stage target rate.

Do not broaden this gate into unrelated historical cleanup unless a touched visualisation path depends on it.

## 13. Authoritative RetailCo invariant

After correction, authoritative RetailCo must still show:

- execution run = pecp-ref-canonical-1789978991064;
- operational status = EXECUTION_COMPLETED;
- business target = 8.75 orders/second;
- scheduler peak = 109.375 journey_iterations/second;
- population = JOURNEY_ITERATION;
- model = OPEN;
- start rate = 0;
- stages 0/300/1200/1320 with rates 0/109.375/109.375/0;
- journey mix 55/20/15/8/2;
- Acceptance = INCONCLUSIVE;
- workload = UNRESOLVED;
- derivation = UNRESOLVED_INSUFFICIENT_TIME_SERIES;
- Checkout p95 = 0.3906885 ms PASS;
- HTTP failure rate = 0 PASS;
- one WORKLOAD_ATTAINMENT_UNRESOLVED Finding;
- zero Defect Candidates;
- Evidence Package = VALID;
- all six required lineage edges verified;
- DOWNLOAD/API READY.

## Definition of Done

M4.3.1 is complete when:

1. touched portal pages contain no fallback engineering facts;
2. Evidence page dynamically projects components/lineage/readiness;
3. shared chart contains no RetailCo-specific engineering sentence;
4. Test Definition schedule projection is outside React;
5. browser-safe RetailCo snapshot is automatically checked against canonical engine output;
6. generic project tests prove no RetailCo bleed;
7. authoritative RetailCo UI remains exact;
8. full normal CI is green.

When complete, commit/push to `master` and return:

**M4.3.1 Completion Report for PM Audit**

Do not self-close M4.3.
