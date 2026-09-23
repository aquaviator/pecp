# Work Package: M4.2.2 — Companion Isolation, Source-Binding & Report Integrity Gate

## Objective

Close the final M4.2 integrity gaps so export projections can never consume unverified companion content, optional artefacts use the correct source-binding field, report identity binds source execution facts, and visualisation never invents missing schedule rates or exact stages.

This is the final M4.2 closure gate.

Read:

- `docs/M4_2_1_PM_REVIEW.md`;
- `docs/work-packages/M4_2_1_EXPORT_SEMANTIC_INTEGRITY_CRYPTOGRAPHIC_BINDING_VISUALISATION_FIDELITY_GATE.md`;
- `docs/M4_1_CLOSURE.md`.

Do not call external APIs.
Do not rerun k6.
Do not infer root cause.
Do not render PDF/DOCX.
Do not begin the next milestone.

## 1. Never project unverified companion objects

In `generatePublicationBundle()`:

Use only:

- `verifiedTestDefinition`;
- `verifiedFindingsRegister`;

when generating Results Report content.

Do not use:

- `verifiedTestDefinition ?? testDefinition`;
- `verifiedFindingsRegister ?? findingsRegister`.

If caller supplies a companion and verification fails:

- bundle remains blocked;
- no Defect Payloads are generated from it;
- Results Report must be derived only from the verified Evidence Package and any independently verified companion objects;
- no tampered journey distribution, schedule, finding count or defect count may enter report artifacts.

Add regressions proving:

- drifted Test Definition cannot change Results Report visualisation;
- tampered Findings Register cannot change Results Report Findings/Defect summaries.

## 2. Correct Strategy/Test Plan source Contract binding

For package components use:

`component.sourceContractFingerprint`

not:

`component.fingerprint`

when validating Strategy/Test Plan source Contract authority.

Verify for supplied Strategy/Test Plan:

- id;
- version;
- `sourceContractFingerprint`;
- status/currentness.

Use actual M4.1 Evidence Package component shape in tests.

Add tests:

- same id/version/status + wrong Strategy sourceContractFingerprint => BLOCKED_INVALID_SOURCE;
- same id/version/status + wrong Test Plan sourceContractFingerprint => BLOCKED_INVALID_SOURCE.

Do not claim an artefact content fingerprint exists.

## 3. Bind governed execution timestamps into Results Report digest

Update `buildResultsReportDigestPayload()` to bind:

- `projectExecutionIdentity.startedAt`;
- `projectExecutionIdentity.completedAt`.

Also bind:

- `acceptanceVerdict.evaluatedAt`

unless there is an explicit canonical rule documenting that it is non-semantic.

Continue excluding:

- Publication Bundle `generatedAt`;
- other caller-only generation timestamps.

Add tests proving changing startedAt/completedAt changes `reportDigest`.

## 4. Verify top-level PublicationBundle schemaVersion

In `verifyPublicationBundleDigest()`:

Require:

- `bundle.schemaVersion === 'publication-bundle-v1'`;
- `bundle.bundleDigest.schemaVersion === 'publication-bundle-v1'`;
- `bundle.bundleDigest.algorithm === 'SHA-256'`.

Ensure the top-level schema value is consistently represented in the digest contract.

Add test:

- change only `bundle.schemaVersion` => verification fails.

## 5. Remove visualisation start-rate invention

Canonical `WorkloadSchedule.startRate` is optional.

Update visualisation domain if required:

- `ResultsReportVisualisationStage.startArrivalRate?: number | null`.

Rules:

- if `schedule.startRate` exists, first stage uses it exactly;
- if absent, first stage `startArrivalRate` remains absent/null;
- stage N>1 uses the previous governed stage target rate;
- scheduler `startRate` remains absent/null if source is absent;
- never default missing startRate to 0.

Add test with a valid schedule omitting `startRate`.

## 6. Do not reconstruct exact stages without verified Test Definition

When `generateResultsReport()` has no independently verified Test Definition:

- preserve business/scheduler summary values from Evidence Package;
- do not synthesize ramp-up/steady-state/ramp-down stage records;
- `visualisationHook.stages = []`;
- `visualisationHook.journeyDistribution = []`.

The Evidence Package's summarized durations may still appear in `scheduleTimings`, but they must not be represented as exact source stages.

Add tests for a valid Evidence Package generated from a multi-stage/custom schedule where Test Definition is not supplied to M4.2:

- no fabricated three-stage visualisation;
- summary timings remain source-backed where available.

## 7. Preserve authoritative RetailCo exact facts

With the verified RetailCo Test Definition supplied:

- package = VALID;
- publication DOWNLOAD/API = READY;
- Acceptance = INCONCLUSIVE;
- workload prerequisite = UNRESOLVED;
- business target = 8.75 orders/second;
- scheduler peak = 109.375 journey_iterations/second;
- scheduler start rate = 0;
- population = JOURNEY_ITERATION;
- model = OPEN;
- stages:
  - 0-300s: 0 -> 109.375;
  - 300-1200s: 109.375 -> 109.375;
  - 1200-1320s: 109.375 -> 0;
- journey mix:
  - Browse 55%;
  - Search 20%;
  - Basket 15%;
  - Checkout 8%;
  - Account 2%;
- Checkout p95 = 0.3906885 ms against p95 < 2000ms => PASS;
- HTTP failure rate = 0 against rate < 0.005 => PASS;
- one WORKLOAD_ATTAINMENT_UNRESOLVED Finding;
- zero Defect Candidates / Defect Payloads.

## 8. Regression matrix

At minimum add:

- unverified Test Definition not used in report;
- unverified Findings Register not used in report;
- Strategy sourceContractFingerprint mismatch blocked;
- Test Plan sourceContractFingerprint mismatch blocked;
- startedAt tamper changes report digest;
- completedAt tamper changes report digest;
- top-level PublicationBundle schemaVersion tamper rejected;
- schedule missing startRate stays absent/null;
- no Test Definition => no reconstructed exact visualisation stages;
- RetailCo exact visualisation unchanged;
- full normal CI green.

## Definition of Done

M4.2.2 is complete when:

1. no unverified companion content enters generated artifacts;
2. Strategy/Test Plan source binding uses the correct component field;
3. report digest binds governed execution timestamps;
4. top-level bundle schema is verified;
5. missing startRate remains absent;
6. exact visualisation stages require a verified Test Definition;
7. authoritative RetailCo remains unchanged;
8. normal CI is green.

Stop and provide an M4.2.2 completion report for PM audit.
