# Work Package: M3.1B.3 — Authoritative Execution Provenance Gate

## Objective

Convert the already-proven canonical execution path into authoritative PECP closure evidence by running the full canonical workload once through the dedicated GitHub Actions workflow and binding the evidence to the remote commit and workflow run.

This is an evidence/provenance gate, not a redesign.

Read:

- `docs/work-packages/M3_1B_FIRST_GOVERNED_REFERENCE_EXECUTION.md`
- `docs/work-packages/M3_1B_2_CANONICAL_EXECUTION_READINESS_GATE.md`
- `docs/M3_1B_2_PM_REVIEW.md`

Do not implement Results Model / Acceptance Engine / Findings / M4.

## 1. Use authoritative remote master

Sync authoritative `master`.

The canonical execution must run against a GitHub-visible commit SHA.

Do not report a local-only SHA as the authoritative implementation SHA.

The execution manifest must record the actual `GITHUB_SHA`.

## 2. Capture workflow run identity

Add a machine-readable workflow execution identity to the canonical manifest.

At minimum capture:

- `repositoryCommitSha` or existing `commitSha`;
- `workflowRunId` from `GITHUB_RUN_ID` when running under GitHub Actions;
- PECP execution `runId`.

When not running under GitHub Actions, workflowRunId may be absent / explicitly unavailable, but such a run cannot satisfy this closure gate.

Do not invent an ID.

## 3. Fresh canonical evidence directory

Before canonical execution, ensure the target canonical evidence directory is empty/fresh.

Do not allow files from the previous local run to remain and satisfy evidence checks.

Preferred behaviour:

- remove/recreate `evidence/m3-1b/canonical/` immediately before the canonical run; or
- use a unique run-scoped evidence directory and upload that exact directory.

The runner must generate every required file during the authoritative run.

## 4. Dedicated GitHub Actions workflow

Dispatch:

`Governed Reference Execution (M3.1B)`

with:

`mode = canonical`

The workflow must:

- checkout the exact authoritative SHA;
- install exact k6 v0.54.0;
- use the preflight-first orchestrator;
- run the full 1320-second canonical schedule unchanged;
- upload the complete evidence artifact even if the execution later reports an operational failure.

Record the GitHub Actions run ID.

## 5. Required artifact contents

The uploaded canonical artifact must contain newly generated:

- `execution-manifest.json`;
- `summary.json`;
- stdout log;
- stderr log;
- `config.json`;
- `journeys.js`;
- `entrypoint.js`;
- `runtime.js`.

The manifest must include/checksum the required execution files.

The artifact itself is the authoritative evidence store. It is not necessary to commit large raw logs into source control.

## 6. Required authority bindings

Audit the resulting manifest and prove:

- `commitSha` equals the workflow's checked-out GitHub SHA;
- workflowRunId equals the GitHub Actions run;
- source contract fingerprint is current;
- Test Definition fingerprint is current;
- bundle fingerprint is current;
- runtime version/source id are current;
- preflight status is READY with zero blocking issues;
- engine is pinned v0.54.0.

## 7. Security verification

Before artifact upload, scan every generated canonical evidence file for the ephemeral credential.

Required result:

`NO_CREDENTIAL_LEAKAGE`

Do not upload unsafe evidence.

Do not print the credential.

## 8. Canonical execution proof

Closure evidence must show:

- execution mode CANONICAL;
- approximately 1320 seconds governed schedule plus minimal runner overhead;
- actual HTTP traffic reaches the real RetailCo Reference Lab;
- actual `order_created > 0`;
- k6 process exit code recorded;
- raw summary recorded;
- Reference Lab before/after/delta metrics recorded.

No PECP performance verdict may be evaluated.

## 9. Do not interpret raw attainment yet

The prior local run exposed useful raw observations, including business event rate and dropped iterations.

Preserve equivalent raw metrics from the authoritative run but do not decide:

- PASS;
- FAIL;
- PASS_WITH_OBSERVATION;
- INCONCLUSIVE.

That belongs to M3.2/M3.3.

## 10. Normal CI remains green

Normal CI must continue to pass without real k6:

- npm ci;
- npm run lint;
- npm run test;
- npm run build.

## Completion report

Provide:

- authoritative remote implementation SHA;
- normal CI run ID/result and test counts;
- canonical GitHub Actions workflow run ID/result;
- workflow artifact name/id;
- PECP run id;
- manifest commit SHA;
- manifest workflowRunId;
- k6 version;
- preflight status/issues;
- start/end/duration;
- k6 exit code;
- source Contract/Test Definition/bundle fingerprints;
- artifact file list;
- Reference Lab before/after/delta;
- order_created count;
- iteration/dropped-iteration raw observations;
- credential leakage scan result;
- `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`.

## Definition of Done

M3.1B closes when all of the following are true:

1. execution comes from authoritative GitHub-visible code;
2. manifest binds to the exact repository SHA;
3. manifest/run evidence identifies the GitHub Actions workflow run;
4. dedicated canonical workflow completes;
5. evidence directory was fresh for the run;
6. complete raw artifact is uploaded and inspectable;
7. full canonical workload ran unchanged;
8. real Reference Lab traffic and business events occurred;
9. no credential leakage occurred;
10. no PECP performance verdict was assigned;
11. normal CI remains green.

Stop after reporting. Do not start M3.2/M3.3/M4.
