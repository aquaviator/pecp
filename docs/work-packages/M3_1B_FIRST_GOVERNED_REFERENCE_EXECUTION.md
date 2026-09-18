# Work Package: M3.1B — First Governed Reference Execution

## Objective

Perform PECP's first **real governed k6 execution** against the deterministic RetailCo Reference Lab using the current approved Performance Contract, Canonical Test Definition, execution preflight and generated k6 bundle.

This work package proves:

`Governed PECP model -> generated k6 bundle -> real k6 engine -> real Reference Lab traffic -> raw execution evidence`

M3.1B is an execution proof only.

Do **not** implement the PECP Results Model, final PASS/FAIL/INCONCLUSIVE evaluation, findings, evidence packages or M4.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M3_0_CLOSURE.md`
- `docs/M3_1A_CLOSURE.md`
- M3.0.1 / M3.0.2 / M3.0.3 governance packages
- M3.1A / M3.1A.1 / M3.1A.2 / M3.1A.3 packages

---

## 1. Actual k6 execution is mandatory

M3.1B is not complete through mocks, Vitest, synthetic summary files or simulated k6 output.

A real k6 engine must execute the actual generated RetailCo M3 bundle against the actual running Reference Lab service.

Before execution:

1. compile the current RetailCo Test Definition;
2. compile the current k6 bundle from that Test Definition;
3. start the actual Reference Lab;
4. obtain live `/health` and `/ready` probe evidence;
5. run `buildExecutionPreflightManifest()`;
6. run `validateExecutionPreflightManifest()`;
7. require `READY_FOR_LIVE_EXECUTION` with zero validation issues.

If preflight is not READY, stop. Do not bypass the gate.

---

## 2. Materialise the bundle from PECP

Create the smallest deterministic reference-execution harness required to materialise the files returned by `compileK6Bundle()`.

The executed files must come from the compiler output, not from a separately hand-maintained k6 script.

Materialise at minimum:

- `config.json`
- `journeys.js`
- `entrypoint.js`
- `runtime.js`

Record:

- Test Definition id/version/fingerprint;
- source contract id/version/fingerprint;
- k6 bundle id/version/fingerprint;
- PECP stable runtime version/source id;
- materialised file names and per-file deterministic checksum if straightforward.

Do not commit generated execution credentials.

Generated runtime execution artefacts may live in a temporary/reference execution output directory or CI artifact. Do not make raw run output canonical project truth.

---

## 3. Use a real, pinned k6 engine

Use an actual k6 binary/container.

Requirements:

- use an explicit, pinned k6 version;
- record the output of `k6 version` or equivalent engine version metadata;
- do not use `latest` as the authoritative execution version;
- do not implement a fake JavaScript runner that emulates k6;
- do not edit the generated bundle to make it run.

If a provider/runtime defect prevents execution, report it and stop rather than silently patching generated output outside the compiler.

---

## 4. Runtime-only credential

Generate an ephemeral checkout credential at execution runtime.

Use the same ephemeral value for:

- `RETAILCO_CHECKOUT_AUTH_TOKEN` in the Reference Lab process; and
- the governed credential binding provided to k6.

Requirements:

- generate dynamically for the run;
- never commit it;
- never print it;
- mask it in CI logs where applicable;
- no reusable static secret is required.

---

## 5. Execute the canonical schedule unchanged

The authoritative M3 RetailCo schedule is the schedule to execute.

Current governed semantics:

- scheduler population: `JOURNEY_ITERATION`;
- scheduler peak: `109.375 journey_iterations/second`;
- business attainment target: `8.75 orders/second`;
- Checkout journey share: `0.08`;
- contribution: `1 order` per successful governed Checkout event;
- full governed schedule duration: **1320 seconds / 22 minutes**.

Do not shorten, scale down or alter the schedule merely to fit CI/runtime convenience.

If the environment cannot execute the 22-minute schedule, report M3.1B as blocked. A shorter smoke run is useful for diagnostics but does not satisfy this work package unless represented as a separately governed Test Definition and explicitly not substituted for the canonical run.

---

## 6. Reference execution runner

Prefer a repeatable execution path that works both locally and in GitHub infrastructure.

A narrow reference-only runner/workflow is acceptable.

Recommended pattern:

1. start RetailCo Reference Lab on localhost:8080;
2. verify health/readiness;
3. generate and validate current preflight;
4. materialise current bundle;
5. execute real k6;
6. query Reference Lab `/api/v1/metrics` after the run;
7. capture raw artefacts;
8. stop the lab cleanly.

A dedicated manually-triggered or narrowly path-triggered GitHub Actions workflow is acceptable and preferred for reproducible evidence.

Do not add the full 22-minute load run to the normal fast CI pipeline on every commit.

---

## 7. Capture raw execution evidence

M3.1B must preserve enough evidence for M3.2 to ingest later.

Capture at minimum:

### Execution identity
- execution/run id;
- repository commit SHA;
- execution start timestamp;
- execution end timestamp;
- duration;
- target URL;
- k6 version;
- process exit code.

### PECP binding
- source Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- bundle id/fingerprint;
- stable runtime version/source id;
- preflight status and validation result.

### k6 raw output
- `summary.json`;
- stdout/stderr log;
- generated `config.json`;
- generated bundle files or a checksummed bundle archive;
- k6 threshold result data;
- iteration/request/check metrics available from summary output.

### Reference Lab cross-check
Capture `/api/v1/metrics` after the run, including:
- request counts;
- status counts;
- `businessAttainmentEvents.order_created`.

If useful, capture a before-run metrics snapshot as well so a deterministic delta can be calculated later.

No raw credential value may appear in any artefact.

---

## 8. Execution completion vs performance verdict

M3.1B may classify only the **execution operation**, for example:

- `EXECUTION_COMPLETED`;
- `EXECUTION_ENGINE_FAILED`;
- `TARGET_UNAVAILABLE`;
- `PREFLIGHT_BLOCKED`.

Do not assign PECP's performance verdict:

- PASS;
- FAIL;
- PASS_WITH_OBSERVATION;
- INCONCLUSIVE.

Those belong to the later Results/Acceptance work.

k6 threshold success/failure and process exit code must be captured faithfully as raw evidence but must not be translated into a PECP verdict in this work package.

---

## 9. Business attainment is evidence, not yet a verdict

The run must produce separate evidence for:

1. scheduler/iteration activity; and
2. successful business attainment events.

Verify that the execution produces actual `order_created` events and that the Reference Lab counter increases during the run.

Do not use the number of iterations alone as proof of order throughput.

Do not yet decide whether the measured order rate satisfies 8.75 orders/second. M3.2/M3.3 will calculate and govern that result.

---

## 10. One-time reference execution manifest

After the real run, produce a machine-readable execution evidence manifest, for example:

`reference-library/retailco/executions/<run-id>/execution-manifest.json`

or preserve it as a downloadable CI artefact if generated after the repository commit.

It should contain references/metadata, not raw secrets.

Include at minimum:

- run id;
- execution operational status;
- commit SHA;
- timestamps;
- engine/version;
- target;
- all PECP fingerprints/bindings;
- preflight result;
- raw artefact filenames/checksums;
- k6 exit code;
- Reference Lab metrics snapshot/delta;
- explicit statement: `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`.

Do not fabricate values if an artefact is absent.

---

## 11. Automated verification around the runner

Add fast automated tests for the new harness without re-running the 22-minute load test in the normal test suite.

Tests should prove:

- preflight failure prevents process launch;
- materialised files exactly equal compiler output;
- credential values are not persisted/logged;
- execution manifest cannot claim completed without required raw evidence;
- run bindings use current fingerprints;
- raw results are not interpreted as PASS/FAIL.

A short k6 syntax/smoke validation is acceptable in development if useful, but it does not replace the required real full run.

---

## 12. CI discipline

The normal CI pipeline must remain fast and green:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

The real 22-minute reference execution should be isolated from normal CI.

If a dedicated execution workflow is added, it must preserve its run id and downloadable artifacts.

---

## 13. Completion evidence

Completion report must state:

- authoritative repository commit SHA;
- normal GitHub CI run result;
- actual k6 version;
- actual Reference Lab execution mechanism;
- execution workflow/run id where applicable;
- preflight validation result immediately before execution;
- execution start/end and duration;
- k6 exit code;
- raw summary/artifact locations;
- Reference Lab request/business-event counters;
- whether actual `order_created` events occurred;
- any execution/provider defects encountered;
- confirmation that no PECP PASS/FAIL/INCONCLUSIVE verdict was assigned.

Do not claim M3.1B complete unless real k6 execution evidence exists.

---

## Non-goals

Do not:

- create the full PECP Results Model;
- compute workload attainment verdict;
- assign PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE;
- generate defects/findings from the result;
- generate Performance Evidence Package;
- add production observability;
- add JMeter;
- begin M4.

---

## Definition of Done

M3.1B closes when:

1. current governed RetailCo Test Definition compiles;
2. current governed k6 bundle compiles;
3. real Reference Lab starts and passes health/readiness;
4. live preflight returns READY_FOR_LIVE_EXECUTION with zero issues;
5. real pinned k6 executes the unmodified full governed bundle;
6. the 22-minute schedule is executed unchanged;
7. actual HTTP traffic reaches the Reference Lab;
8. successful `order_created` business events are observed;
9. raw k6 summary/log evidence is captured;
10. Reference Lab metrics are captured;
11. all execution evidence is bound to current Contract/Test Definition/bundle/runtime fingerprints;
12. no secrets are persisted;
13. normal GitHub CI remains green;
14. no PECP performance verdict is assigned;
15. M4 has not begun.

Stop after M3.1B.
