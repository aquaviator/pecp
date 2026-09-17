# PECP M3.0.1 Project Manager Review

## Gate status

**M3.0.1: CONDITIONAL PASS**

The main governance corrections are present and GitHub CI is green, but M3.0 remains open pending a small pre-live execution validity gate.

Verified on authoritative `master` implementation commit `3d6b0c3ede587b3c0115f982414c9c203b8c390d` and GitHub Actions run `35208604473`.

## Verified corrections

- hidden 8.75 orders/sec workload fallback removed;
- hidden 5% attainment tolerance removed;
- source contract must be `APPROVED` for execution readiness;
- preconditions are no longer fabricated when absent;
- mutating request payloads are required by canonical journey data;
- think time and expected status are no longer defaulted to project values;
- threshold mapping no longer recovers operator/value from display strings;
- contract fingerprint implementation is shared across layers;
- provider VU capacity is explicit or derived through a named/versioned provider policy;
- generated bundle includes a packaged runtime module and delegates journey execution to it;
- GitHub CI passes deterministic install, typecheck, tests and production build.

## Remaining blockers before live execution

### 1. Ramping-arrival-rate configuration uses `rate` instead of `startRate`

The generated k6 scenario currently sets:

```ts
executor: 'ramping-arrival-rate',
rate: 1,
timeUnit: '1s',
...
```

For k6 `ramping-arrival-rate`, the initial option is `startRate`; `rate` belongs to `constant-arrival-rate`.

The generated provider configuration must use valid k6 executor semantics before M3.1 live execution.

### 2. Stable runtime still has two implementations

`execution/k6-runtime/src/` remains one implementation while `packages/test-engine/src/k6Compiler.ts` contains an independent `PECP_STABLE_K6_RUNTIME_SOURCE` string implementation.

Packaging a runtime file is not sufficient if the packaged runtime is maintained separately from the repository runtime implementation. Establish one authoritative runtime source and package/reference that exact source.

### 3. Unsatisfied supplied preconditions do not block execution

The compiler records an unsatisfied canonical precondition as a `WARNING`, but does not add a blocking reason and does not include precondition satisfaction in `isExecutable`.

A Test Definition can therefore become `READY_FOR_EXECUTION` while an explicitly supplied execution precondition is false.

Supplied preconditions marked mandatory must gate execution.

### 4. Unsupported executable acceptance units can disappear silently

The k6 threshold compiler skips criteria whose units cannot be mapped. A criterion may therefore be executable in the Test Definition but absent from the k6 thresholds without making the bundle non-executable or surfacing a provider issue.

Provider mapping failures must be explicit and must block execution when they affect a required executable criterion.

### 5. Missing required credential values must fail safely

Generated journey code currently falls back to a placeholder Authorization value such as `Bearer NOT_CONFIGURED` when a referenced environment variable is missing.

For a required credential reference, the runtime must fail fast or otherwise explicitly block that step. It must not send a fabricated placeholder credential to the target system.

## Decision

Do not begin M3.1 live Reference Lab execution yet.

Complete `docs/work-packages/M3_0_2_PRE_LIVE_EXECUTION_VALIDITY_GATE.md` first. Once that gate is green in GitHub Actions, M3.0 can close and M3.1 may begin.