# PECP M3.1B.1 Project Manager Review

## Status

**M3.1B.1 — PASS WITH PRE-CANONICAL CORRECTIONS**

The execution harness / CI-isolation implementation is present on authoritative `master` at:

`317aa7cc3bcc18f08a8d411a6f24980e20f4d00b`

Normal GitHub Actions run:

`35452588799`

completed **SUCCESS**.

Verified normal CI counts:

- Vitest: **197 passed** across 17 test files;
- RetailCo Reference Lab native tests: **10 passed**;
- combined: **207 passed**;
- TypeScript typecheck: passed;
- production build: passed;
- real k6 was **not** invoked by normal CI.

## Accepted M3.1B.1 work

The following corrections are accepted:

- normal CI no longer requires a host k6 binary;
- fast execution-harness tests use an injected `K6ExecutionAdapter`;
- engine-version behaviour can be tested without real process launch;
- `executeReferenceRun()` validates preflight before engine/process execution;
- a blocked preflight makes zero engine/process calls;
- project execution bindings are derived from preflight/Test Definition/bundle rather than hard-coded RetailCo scheduler/business values;
- the Reference Lab test lifecycle uses a shared ephemeral checkout token;
- a dedicated `workflow_dispatch` reference-execution workflow exists;
- the dedicated workflow installs an exact pinned k6 v0.54.0;
- canonical and smoke-diagnostic modes are explicitly separated;
- evidence is uploaded as a GitHub Actions artifact;
- no PECP PASS/FAIL/INCONCLUSIVE verdict is created by the harness.

## Remaining corrections before the canonical 22-minute run

### 1. Top-level orchestrator still checks k6 before preflight

`scripts/run-governed-reference-execution.ts` currently verifies the pinned k6 engine before it:

- starts/probes the Reference Lab;
- compiles the Test Definition/bundle;
- builds and validates preflight.

The generic `executeReferenceRun()` now has the correct preflight-first order, but the real execution orchestrator should follow the same governance ordering.

Required canonical order:

1. generate ephemeral runtime credential;
2. start Reference Lab;
3. probe health/readiness;
4. compile current Test Definition;
5. compile current bundle;
6. build/validate preflight;
7. only if READY, verify the pinned engine;
8. execute.

Installing the pinned binary in the dedicated workflow may occur earlier as environment setup. The **authoritative engine/version acceptance check** must occur after preflight.

### 2. Generic harness still has a Reference Lab metadata fallback

When `referenceLabManifest` is omitted, `executeReferenceRun()` still constructs fallback metadata containing `1.0.0` / `retailco-reference-lab`.

For canonical governed execution, the actual Reference Lab manifest must be mandatory. Missing manifest evidence must block before process launch.

### 3. EXECUTION_COMPLETED evidence requirements are too weak

Current operational completion requires only:

- `summary.json`;
- stdout;
- entrypoint.js;
- k6 exit code 0.

M3.1B closure requires stronger raw evidence.

For the canonical run, `EXECUTION_COMPLETED` must require at minimum:

- summary.json;
- stdout;
- stderr;
- config.json;
- journeys.js;
- entrypoint.js;
- runtime.js;
- successful before metrics snapshot;
- successful after metrics snapshot;
- metrics delta;
- current bundle/Test Definition bindings.

Do not silently replace failed metrics collection with zero-valued evidence and still call the canonical run completed.

### 4. Real canonical execution has not yet occurred

The dedicated workflow exists, but no canonical M3.1B execution evidence has yet been presented.

M3.1B remains OPEN until the full 1320-second governed run executes with real k6 and produces preserved evidence.

## Decision

M3.1B.1 engineering/CI isolation is accepted.

Complete the narrow M3.1B.2 canonical-execution readiness corrections, then run the dedicated canonical workflow.

Do not implement Results/Acceptance and do not assign a PECP performance verdict.
