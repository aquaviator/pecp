# Work Package: M3.1B.2 — Canonical Execution Readiness & Evidence Gate

## Objective

Make the dedicated governed execution path ready for PECP's first canonical 22-minute real k6 run, then execute that run and preserve authoritative raw evidence.

This is the final execution gate for M3.1B.

Read:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M3_1A_CLOSURE.md`
- `docs/work-packages/M3_1B_FIRST_GOVERNED_REFERENCE_EXECUTION.md`
- `docs/work-packages/M3_1B_1_EXECUTION_HARNESS_CI_ISOLATION_GATE.md`
- `docs/M3_1B_1_PM_REVIEW.md`

Do not build the PECP Results Model.
Do not assign PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE.
Do not begin M3.2, M3.3 or M4.

## 1. Make the real orchestrator preflight-first

Refactor `scripts/run-governed-reference-execution.ts` so the authority order is:

1. generate one ephemeral credential;
2. start the actual RetailCo Reference Lab using that credential;
3. probe `/health` and `/ready`;
4. compile the current governed Test Definition;
5. compile the current governed k6 bundle;
6. load the actual Reference Lab manifest;
7. build preflight;
8. validate preflight;
9. require `READY_FOR_LIVE_EXECUTION` with zero issues;
10. only then verify that the actual k6 engine is the exact pinned version;
11. execute.

A preflight failure must stop before authoritative engine/version acceptance and before k6 process launch.

The GitHub workflow may install k6 earlier as runner setup, but the execution orchestrator must not authorise/check the engine as part of the governed run until preflight is green.

## 2. Make Reference Lab manifest evidence mandatory

For canonical execution, `executeReferenceRun()` must require actual supplied Reference Lab manifest metadata.

Remove hard-coded fallback metadata such as:

- `retailco-reference-lab`;
- `1.0.0`.

If the required Reference Lab manifest is absent, return a blocked operational result before engine/process launch.

Fast tests must prove omission cannot self-authorise from fallback values.

## 3. Canonical raw-evidence completeness

For `executionMode === 'CANONICAL'`, `EXECUTION_COMPLETED` requires all mandatory evidence:

- `summary.json`;
- stdout log;
- stderr log;
- generated `config.json`;
- generated `journeys.js`;
- generated `entrypoint.js`;
- generated `runtime.js`;
- materialisation byte-match confirmation;
- pre-run Reference Lab metrics snapshot;
- post-run Reference Lab metrics snapshot;
- calculated metrics delta;
- Test Definition / contract / bundle / runtime bindings;
- pinned k6 version metadata;
- k6 process exit code.

If any mandatory evidence is missing, canonical operational status must not be `EXECUTION_COMPLETED`.

Use a structured issue such as `MISSING_RAW_EVIDENCE` or a more specific code.

## 4. Metrics failures must not become synthetic zero evidence

For canonical execution:

- failure to capture pre-run metrics is operationally blocking;
- failure to capture post-run metrics is operationally blocking;
- do not synthesize zero-valued snapshots and then claim successful canonical completion.

For fast injected tests or smoke diagnostics, controlled diagnostic behaviour may remain, but it must not be confused with canonical evidence.

## 5. Preserve credential secrecy

Retain the shared credential lifecycle:

- generated once by the orchestrator;
- passed to Reference Lab;
- passed to k6;
- masked in GitHub Actions;
- never persisted;
- never echoed.

The canonical evidence artifact must be scanned for the cleartext ephemeral credential before upload.

If leakage is detected, fail the run and do not upload unsafe evidence.

## 6. Canonical schedule integrity

The closure run must execute the current compiler-generated canonical schedule unchanged:

- total duration: 1320 seconds;
- peak scheduler rate: 109.375 journey_iterations/second;
- business attainment target remains separately 8.75 orders/second;
- Checkout share 0.08;
- successful Checkout contribution 1 order.

Do not apply the smoke-duration override to canonical mode.

The orchestrator should assert canonical schedule identity before launch and fail if canonical duration/rate semantics drift unexpectedly from the current governed Test Definition.

Do not hard-code these values inside the generic engine runner. A RetailCo reference-orchestrator assertion may compare compiled governed values to the approved reference fixture.

## 7. Dedicated workflow execution

Keep the dedicated manual workflow.

Recommended sequence:

### A. Optional smoke diagnostic
Run:
- mode: `smoke_diagnostic`

This may prove installation/process plumbing only and must be labelled diagnostic.

### B. Canonical closure run
Run:
- mode: `canonical`

This is the M3.1B closure evidence.

Record the GitHub Actions workflow run ID.

## 8. Artifact retention

The canonical workflow artifact must contain:

- execution-manifest.json;
- summary.json;
- raw/stdout log;
- raw/stderr log;
- config.json;
- journeys.js;
- entrypoint.js;
- runtime.js;
- binding/checksum metadata;
- Reference Lab metrics before/after/delta.

Do not include credentials.

Retention of 90 days is acceptable for this first reference execution.

## 9. Required evidence for PM closure

Completion report must provide:

- authoritative implementation commit SHA;
- normal CI run id/result;
- canonical execution workflow run id/result;
- k6 version string;
- execution run id;
- start/end timestamps;
- measured execution duration;
- k6 exit code;
- preflight status / zero-issue validation;
- scheduler population/peak/unit;
- business target/unit;
- generated bundle fingerprint;
- Test Definition fingerprint;
- source Contract fingerprint;
- raw artifact names;
- Reference Lab total request delta;
- per-route request counts;
- status counts;
- observed `order_created` count;
- confirmation artifact scan found no credential leakage;
- confirmation `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`.

## 10. Normal CI

Normal CI must remain green and must not invoke real k6.

Run:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

## Definition of Done

M3.1B closes only when:

1. normal CI is green and remains k6-independent;
2. real orchestrator is preflight-first;
3. canonical Reference Lab manifest is mandatory;
4. canonical evidence completeness is enforced;
5. metrics failures cannot be disguised as zero evidence;
6. real pinned k6 v0.54.0 is verified;
7. full 1320-second canonical schedule executes unchanged;
8. actual HTTP traffic reaches the Reference Lab;
9. actual `order_created` events are observed;
10. all required raw artifacts are preserved;
11. evidence is bound to current governed fingerprints;
12. no cleartext credential appears in artifacts;
13. PECP performance verdict remains NOT_EVALUATED;
14. M3.2/M3.3/M4 have not begun.

Stop after M3.1B canonical execution and report.
