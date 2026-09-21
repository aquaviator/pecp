# M3.1B Closure — First Governed Reference Execution

## Status

**M3.1B — CLOSED ✅**

PECP has completed and independently verified its first authoritative governed real-k6 execution against the RetailCo Reference Lab.

This closes the execution-proof stage:

`Governed PECP model → generated k6 bundle → real pinned k6 engine → real Reference Lab traffic → preserved raw execution evidence`

No PECP performance verdict was evaluated or assigned.

## Authoritative execution

GitHub Actions workflow:

`Governed Reference Execution (M3.1B)`

Workflow run:

`35577599469`

Event:

`workflow_dispatch`

Result:

**SUCCESS**

Checked-out authoritative repository SHA:

`76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`

The provenance implementation used by that commit includes:

`3bc300becb36b83da1a6f467b022d7f6342456e1`

Normal CI for the authoritative head also completed successfully:

`35459912412`

## Engine and execution identity

- PECP execution run id: `pecp-ref-canonical-1789978991064`
- execution mode: `CANONICAL`
- operational status: `EXECUTION_COMPLETED`
- engine: k6
- pinned version: `0.54.0`
- engine string: `k6 v0.54.0 (commit/baba871c8a, go1.23.1, linux/amd64)`
- k6 exit code: `0`
- start: `2026-09-21T08:23:11.065Z`
- end: `2026-09-21T08:45:12.226Z`
- measured duration: `1321.161s`

The canonical governed schedule ran for the full 1320-second duration plus runner overhead.

## Provenance bindings

The canonical execution manifest records:

- `commitSha = 76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`
- `repositoryCommitSha = 76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`
- `workflowRunId = 35577599469`

This establishes the authoritative repository → workflow → execution evidence chain required by M3.1B.3.

## Governed model bindings

- source Contract id: `contract-proj-retailco-bf26-v1.0-approved`
- source Contract fingerprint: `fp-0dad9ae4`
- source Contract status: `APPROVED`
- Test Definition id: `test-def-proj-retailco-bf2026-v1.0`
- Test Definition fingerprint: `fp-6911db94`
- generated k6 bundle fingerprint: `fp-256b6329`
- runtime version: `1.0.0`
- runtime source: `pecp-stable-k6-runtime-v1.0.0`

## Preflight

Immediately before execution:

- status: `READY_FOR_LIVE_EXECUTION`
- validation: valid
- blocking issues: zero
- Reference Lab health: HTTP 200 / healthy
- Reference Lab readiness: HTTP 200 / ready

## Governed workload identity

Scheduler demand:

- population: `JOURNEY_ITERATION`
- peak rate: `109.375 journey_iterations/second`

Business workload target:

- metric: `orders`
- target: `8.75 orders/second`
- successful checkout contribution: 1 order

The business demand and load-generator population remain explicitly separate.

## Raw execution observations

The k6 summary recorded:

- iterations: `120981`
- average iteration arrival rate over the complete shaped test: approximately `91.5892/s`
- dropped iterations: `8`
- HTTP requests: `120981`
- business attainment events: `9671`
- raw business event rate over the complete test: approximately `7.3215/s`

Reference Lab post-run delta:

- total requests: `120982`
- Browse/featured: `66713`
- Search: `24003`
- Basket: `18195`
- Checkout: `9671`
- Account/order history: `2399`
- HTTP 201: `9671`
- `order_created`: `9671`

These are raw observations only. They are deliberately not converted into a PECP acceptance verdict in M3.1B.

## Evidence artifact

GitHub Actions artifact:

`m3-1b-evidence-canonical-35577599469`

Artifact ID:

`10629771462`

Artifact SHA-256:

`0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91`

Artifact retention expires 2026-12-20.

The downloaded artifact was independently inspected and contains a fresh canonical evidence set:

- `execution-manifest.json`
- `summary.json`
- `k6-stdout.log`
- `k6-stderr.log`
- `config.json`
- `journeys.js`
- `entrypoint.js`
- `runtime.js`

It also contains the separate smoke-diagnostic evidence tree, which is not used as canonical closure evidence.

## Security

Workflow and artifact evidence confirm:

`NO_CREDENTIAL_LEAKAGE`

The canonical artifact contains no cleartext token pattern. The manifest contains only:

`***REDACTED_EPHEMERAL***`

## Verdict boundary

The manifest records:

`PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`

M3.1B does not interpret:

- business attainment;
- dropped iterations;
- k6 threshold observations;
- response-time metrics;
- workload-attainment sufficiency.

Those belong to downstream Results Model and Acceptance Engine stages.

## Important downstream observations

The canonical summary contains raw evidence that must be preserved by the Results Model, including:

- dropped iterations;
- business attainment event count/rate;
- workload arrival demand count/rate;
- k6 threshold state;
- response-time distributions.

The summary does not contain an emitted `pecp_workload_attainment_rate` metric even though the stable runtime declares that metric. M3.2 must decide whether workload attainment is represented as directly emitted telemetry, deterministically derived results, or both. No value may be invented.

## Closure decision

All M3.1B execution-proof and provenance gates are satisfied.

**M3.1B is formally CLOSED.**

Overall M3 remains OPEN.

Next authorised stage:

**M3.2 — Results Model / Raw Execution Evidence Ingestion**

No Acceptance Engine verdict is authorised until M3.2 establishes a governed, immutable, provenance-bound results representation.
