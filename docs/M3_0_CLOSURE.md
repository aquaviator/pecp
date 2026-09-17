# PECP M3.0 Closure — Governed Executable Test Definition & k6 Bundle

## Status

**M3.0 — CLOSED**

M3.0 is formally closed after the M3.0.3 arrival-population and workload-attainment semantics gate passed on the authoritative `master` branch.

> Note: the overall **M3 milestone remains OPEN** until PECP proves an actual governed execution against the Reference Performance Lab. M3.0 closes the pre-execution definition/compiler layer only.

## Verified implementation

M3.0 establishes the governed transformation:

`Approved Performance Contract + Canonical Execution Intelligence -> Canonical Test Definition -> Deterministic k6 Execution Bundle`

The following are accepted:

- engine-neutral `TestDefinition` domain model;
- explicit source-contract approval gate before execution readiness;
- source-driven schedules, journeys, request payloads, preconditions and credentials references;
- no raw secrets in canonical or generated execution content;
- explicit workload-attainment requirement kept separate from NFR acceptance criteria;
- deterministic k6 bundle generation;
- stable/versioned PECP k6 runtime packaging;
- provider threshold mapping with explicit failure when criteria cannot be represented;
- governed k6 provider-capacity policy with provenance;
- structural execution validation for schedules, journey distributions, methods and paths;
- fail-fast credential resolution;
- explicit scheduler-arrival population semantics;
- explicit governed mapping between scheduler arrivals and business-outcome attainment where populations differ;
- separate scheduler-activity and business-attainment runtime metrics;
- RetailCo M3 execution-ready reference fixture and manifest;
- governed Tests portal preview;
- deterministic tests across the execution compiler/provider layers.

## M3.0.3 semantic law retained

For a mixed-journey workload, PECP must never equate a business-outcome rate with executor iteration-arrival rate unless an explicit governed relationship establishes that mapping.

RetailCo reference semantics are therefore:

- business workload attainment: `8.75 orders/second`;
- scheduler population: `JOURNEY_ITERATION`;
- Checkout journey share: `0.08`;
- business-event contribution: `1 order` per successful Checkout submission;
- scheduler peak: `109.375 journey_iterations/second`;
- derivation: `8.75 / (0.08 * 1) = 109.375`.

The k6 stage target is the scheduler rate. The business target remains a separate attainment signal.

## Gate evidence

Final M3.0.3 implementation synced to GitHub as commit:

`b9de46067ecb52abee588a95ea213650ade12332`

GitHub Actions run:

`35215546770`

completed successfully on `master`.

The run validated deterministic install, TypeScript validation, all repository tests and production build.

## Pre-live observations

Two small generic hardening checks should be completed before the first live Reference Lab execution, without reopening M3.0:

1. validate that population-relationship business units and scheduler population/unit match the corresponding workload-attainment and schedule semantics, not merely their numeric values;
2. validate that `contributionPerSuccessfulEvent` is positive and agrees with the governed business-event contribution emitted by the referenced journey/step.

These belong in the Reference Lab preflight work package because the RetailCo reference state already supplies correct explicit values and no live execution has occurred.

## Reference Lab prerequisite

The repository `reference-lab/` directory currently contains only `.gitkeep`.

Therefore PECP is **not yet ready to perform the M3 live execution demonstration**, despite the Test Definition and k6 bundle being execution-ready. The next work must build and verify the deterministic RetailCo Reference Lab target before k6 is launched against it.

## Scope boundary

M3.0 did not:

- execute k6 against a live target;
- build the actual RetailCo Reference Lab service;
- ingest execution results;
- compute PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE from live results;
- generate findings or evidence packages;
- begin M4.
