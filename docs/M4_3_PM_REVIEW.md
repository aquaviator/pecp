# PECP M4.3 Project Manager Review

## Status

**M4.3 — SUBSTANTIALLY IMPLEMENTED, NOT CLOSED**

The Execution-to-Evidence Portal and workload visualisation are now present on authoritative `master`, and the normal CI pipeline is green.

The implementation successfully introduces the project-scoped execution/evidence service boundary, governed Results/Findings/Evidence/Executions views, a reusable workload profile chart, a pure workload visualisation adapter, RetailCo reference integration, and M4.3 web regression coverage.

However, the live UI reintroduces several audit-facing semantic defaults and hardcoded RetailCo facts that bypass the canonical objects it is meant to project. These are material because M4.3 is the human-facing interpretation layer over the closed M3/M4 deterministic spine.

A single correction/closure gate is required:

**M4.3.1 — Portal Zero-Invention, Canonical Projection & Reference Fidelity Gate**

Do not begin another milestone before this gate passes.

## Authoritative implementation

Implementation SHA:

`6ac8a4a0305bc91edd6af6ed0f57e6f0affe0e2c`

CI run:

`35852772146`

Result: **SUCCESS**

Verified:

- 24 Vitest files passed;
- **446 Vitest tests passed**;
- **8 M4.3 web integration tests passed**;
- **9 workload visualisation adapter tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **456 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Accepted M4.3 capabilities

Verified in live code:

- `IExecutionEvidenceService` exists and is wired through `ServiceContext`;
- RetailCo reference execution/evidence state is exposed through the mock service;
- Results, Findings, Evidence and Executions pages consume the execution/evidence service;
- Results visibly separates business demand from scheduler demand;
- Results displays authoritative RetailCo Acceptance = INCONCLUSIVE and workload = UNRESOLVED;
- Findings displays the governed workload-attainment Finding and zero Defect Candidates;
- Evidence distinguishes package validity from performance Acceptance;
- Recharts-based scheduler and journey-mix visualisations exist;
- `buildWorkloadVisualisationSeries()` is pure and does not normalize invalid distributions;
- arbitrary increasing schedules are covered by adapter tests;
- browser export actions are local only;
- no live Jira/ADO/Confluence/SharePoint side effects were introduced.

## Blocking findings

### 1. ResultsPage reintroduces forbidden engineering defaults

The page currently substitutes source facts when values are absent, including:

- Acceptance verdict -> `INCONCLUSIVE`;
- operational status -> `COMPLETED`;
- workload status -> `UNRESOLVED`;
- workload derivation -> `UNRESOLVED_INSUFFICIENT_TIME_SERIES`;
- observed criterion unit -> `ms`;
- iterations -> `120,981`;
- business events -> `9,671`;
- discrepancy count -> `0`;
- runner engine -> `k6 v0.54.0`;
- workflow run id -> `35577599469`;
- repository commit -> `76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`.

The page also renders fixed text `91.59 iter/s` and `100% Corroborated` rather than deriving those statements from source fields.

This violates the M4.3 zero-invention law.

Required:

- preserve governed absence;
- render `NOT_SUPPLIED` / `[GOVERNED ABSENCE]` where appropriate;
- never substitute RetailCo values for missing canonical fields;
- derive descriptive claims only from present canonical facts.

### 2. EvidencePage is substantially hardcoded instead of projecting the Evidence Package

The Evidence page currently hardcodes or defaults:

- package status -> VALID;
- Acceptance verdict -> INCONCLUSIVE;
- Contract id/version and workload/criteria summary;
- Test Definition id/version and schedule summary;
- execution run id, k6 version, iteration count, duration and exit code;
- artifact id and `8 FILES INTACT`;
- CANONICAL_RESULTS status -> `INGESTED`;
- Acceptance/Findings summary;
- six component-lineage descriptions/statuses;
- DOWNLOAD/API/external publication readiness matrix.

This is especially serious because M4.1 explicitly removed invented `CANONICAL_RESULTS.status = INGESTED`.

Required:

- render the actual `evidencePackage.components`;
- render the actual `evidencePackage.lineage.edges`;
- render actual raw evidence inventory/summary;
- render actual package status, source identities, Acceptance and Findings;
- render actual `publicationBundle.publicationReadiness`;
- do not hardcode the six lineage cards as facts if the underlying edges are absent/unverified;
- no invented component status.

### 3. FindingsPage contains canonical-state fallbacks

Current fallbacks include:

- Findings generation status -> VALID;
- Acceptance verdict -> INCONCLUSIVE;
- digest text -> VALID;
- Finding classification -> GOVERNANCE.

These values must come from the Findings Register / Acceptance Evaluation.

The empty Defect Candidate explanation also hardcodes INCONCLUSIVE-specific wording. It should explain the actual governed blocker/reason when available and remain generic when not.

### 4. ExecutionsPage still injects reference values

Current fallbacks include:

- completed iterations -> 120,981;
- business events -> 9,671;
- source Test Definition id -> RetailCo id.

The empty-state text also claims runner orchestration capabilities that remain ahead of the current implemented runner-control surface.

Render only the recorded execution state and explicitly describe the current page as a governed execution record/reference view.

### 5. Reusable WorkloadProfileChart contains RetailCo-specific engineering semantics

The shared chart component currently hardcodes:

`8.75 orders/second ÷ 8% = 109.375 journey iterations/second`.

Any other project with business/scheduler demand can therefore display a false RetailCo-specific relationship.

It also falls back to units such as:

- `units/s`;
- `orders/second`;
- `journey_iterations/second`.

Required:

- reusable chart must be project-neutral;
- population relationship text must come from governed source relationship data or be omitted;
- no domain-unit fallback;
- incomplete distribution must never display `100% corroborated`.

### 6. Evidence publication readiness is hardcoded

M4.2 already provides:

`publicationBundle.publicationReadiness`.

M4.3 must render this map rather than a fixed list saying DOWNLOAD/API READY and external destinations BLOCKED.

This is essential because readiness may differ for another project/package.

### 7. TestsPage performs schedule projection calculations inside React

`TestsPage.tsx` constructs `scheduleVisualisationHook` and computes cumulative stage boundaries inside the page.

M4.3 specifically requires chart/presentation transformation outside React rendering.

Required:

- extract TestDefinition -> visualisation hook projection into a pure presentation helper;
- reuse that helper in TestsPage;
- React should render the result, not calculate schedule timing semantics.

### 8. Browser-safe RetailCo execution fixture needs authority-drift protection

`authoritativeRetailCoExecutionEvidence.ts` is a large browser-safe snapshot of canonical objects.

That can be acceptable for the portal, but it becomes a second source of truth unless automatically checked against the real deterministic pipeline.

Required:

- add a regression that rebuilds the authoritative RetailCo chain from the existing Contract/Test Definition/raw evidence fixtures using the canonical engines;
- compare the browser-safe snapshot's key canonical identities, statuses, fingerprints/digests and authoritative values to the rebuilt chain;
- fail CI if the snapshot drifts;
- document how the snapshot is generated/refreshed.

Do not hand-maintain duplicated canonical values without an automated authority check.

## Completion-report note

The supplied task report says ExecutionsPage validates multi-run listing and active execution selection.

The current M4.3 implementation is a single project-scoped execution state view, not a multi-run selector. Multi-run selection was not required by the M4.3 work package, so this is not a product blocker, but the completion wording should not overstate the implemented behaviour.

## Decision

Complete one correction/closure gate:

**M4.3.1 — Portal Zero-Invention, Canonical Projection & Reference Fidelity Gate**

Do not add new product scope.

If M4.3.1 passes full CI and PM audit, close M4.3.
