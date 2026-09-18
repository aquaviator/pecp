# PECP M3.1B Project Manager Review

## Status

**M3.1B — STARTED, NOT COMPLETE, AUTHORITATIVE CI RED**

M3.1A is closed. Work has already begun on M3.1B on authoritative `master` under implementation commit:

`8169109a9b1cda190da6a65abde0f58e7b1f0476`

GitHub Actions run:

`35347656609`

Result: **FAILURE**

The failure is in the new M3.1B execution harness tests, not the previously closed M3.1A preflight layer.

## Verified M3.1B progress

The repository now contains:

- `packages/test-engine/src/referenceExecutionHarness.ts`;
- bundle materialisation with byte-for-byte verification;
- SHA-256 raw-artifact checksums;
- Reference Lab health/readiness probing;
- Reference Lab metrics snapshots/deltas;
- pinned k6 version expectation;
- execution-manifest model;
- raw-result / no-PECP-verdict boundary;
- M3.1B test coverage.

This is useful progress, but it has crossed the execution boundary before the runner/CI separation was correctly designed.

## Current CI failures

Normal CI currently fails because the fast Vitest suite attempts to execute a real system `k6` binary that is not installed on the normal GitHub runner.

Observed:

- `spawn k6 ENOENT`;
- M3.1B test file: 9 tests, 5 failed;
- repository Vitest result: 192 passed / 5 failed;
- production build skipped.

This directly violates the M3.1B work package requirement that the real 22-minute execution be isolated from normal fast CI.

## Governance defects found in the harness

### 1. Preflight is checked after the k6 engine

`executeReferenceRun()` checks the k6 binary before validating preflight.

Therefore an intentionally invalid preflight returns `EXECUTION_ENGINE_FAILED` when k6 is absent instead of `PREFLIGHT_BLOCKED`.

Execution authority must be evaluated before engine availability. No execution-engine check should occur when governance already blocks launch.

### 2. The execution harness contains RetailCo engineering fallbacks

The harness currently falls back to values such as:

- target URL `http://localhost:8080`;
- source contract version `v1.0`;
- source contract status `APPROVED`;
- runtime version/source id;
- scheduler population `JOURNEY_ITERATION`;
- scheduler peak `109.375`;
- scheduler unit `journey_iterations/second`;
- business attainment `orders / 8.75 / orders/second`;
- credential reference/purpose/provider.

Those values happen to be correct for RetailCo but the runner must bind to the supplied Preflight/Test Definition/Bundle rather than re-state project truth.

### 3. Normal CI performs real-engine tests

The normal `npm test` path now contains:

- pinned real-k6 detection;
- 1-second real k6 executions;
- a 3-second real k6 execution.

Fast harness tests may use dependency injection / a process adapter to test orchestration, but real k6 execution must live in a dedicated execution workflow or explicitly invoked integration path.

A fake/injected runner is acceptable only for fast unit tests. It must never be accepted as evidence that M3.1B completed.

### 4. The current e2e test does not share the ephemeral credential with the Reference Lab

The Reference Lab in the Vitest `beforeAll` is started without the same runtime token later generated/injected into k6.

M3.1B requires the same ephemeral token to configure both:

- Reference Lab checkout auth; and
- k6 `RETAILCO_CHECKOUT_AUTH_TOKEN`.

The live execution orchestrator must own that lifecycle.

### 5. No full governed execution evidence exists

There is currently no evidence of:

- a real 22-minute canonical run;
- a real pinned k6 execution run id;
- raw `summary.json`;
- raw stdout/stderr;
- final Reference Lab metrics delta;
- real `order_created` observations from the canonical run.

M3.1B is therefore not closeable.

## Decision

Keep M3.1B OPEN.

Complete M3.1B.1 before attempting the canonical 22-minute execution.

Do not create a PECP PASS/FAIL/INCONCLUSIVE verdict.
