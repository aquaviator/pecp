# PECP M4.3.1 Project Manager Review

## Latest Verdict

**M4.3.1 — HOLD / NOT CLOSED**

The remote CI/type-contract correction has succeeded, but the independent semantic audit found residual zero-invention and project-neutrality violations in the live portal.

Do **not** create M4.3.2. Correct M4.3.1 in place.

## Authoritative implementation and CI

Current implementation SHA:

`d2897184654e005ba1f4f7600ed42e3071406d57`

GitHub Actions workflow:

`CI`

Run ID:

`35976316162`

Job ID:

`107557549784`

Conclusion:

**SUCCESS**

Verified from remote GitHub Actions:

- deterministic `npm ci`: PASS
- TypeScript typecheck: PASS
- 26 Vitest files: PASS
- 462 Vitest tests: PASS
- M4.3.1 RetailCo authority-drift: 9/9 PASS
- M4.3.1 generic/non-bleed suite: 7/7 PASS
- M4.3 web integration: 8/8 PASS
- workload visualisation adapter: 9/9 PASS
- RetailCo Reference Lab: 10/10 PASS
- production build: PASS

The previous eight TypeScript blockers are resolved.

## Accepted corrections

The second implementation correctly fixes:

- unsupported `computeContractFingerprint` import;
- optional metric assertion access;
- `ExecutionEvidenceState` import source;
- canonical `organisation` spelling;
- Acceptance workload prerequisite field;
- canonical Finding `deterministicReason`;
- corroboration `countsMatch`;
- raw artifact `k6Version`.

The following M4.3.1 capabilities are also confirmed:

- RetailCo authority-drift protection exists and runs through the deterministic engine chain;
- generic non-RetailCo regressions exist;
- WorkloadProfileChart no longer contains the RetailCo 8.75 / 8% / 109.375 relationship sentence;
- unit fallbacks are removed from the shared chart;
- TestDefinition schedule projection is outside React in a pure adapter;
- Evidence component/lineage/readiness collections are dynamically iterated rather than hardcoded.

## Remaining semantic blockers

### 1. EvidencePage still invents component presence

The work package requires each component to display only fields actually present and explicitly forbids invented statuses.

Current code:

`const isPresent = c.presenceStatus === 'PRESENT' || !c.presenceStatus;`

and:

`c.status || c.presenceStatus || 'PRESENT'`

This silently turns an absent `presenceStatus` into `PRESENT`.

Required:

- if `status` exists, render it;
- if `presenceStatus` exists, render it;
- if neither exists, render `NOT_SUPPLIED`;
- do not style an absent state as present/verified.

### 2. EvidencePage does not render all required package identity/binding fields

M4.3.1 §4 explicitly requires exact rendering of:

- package id;
- packageGenerationStatus;
- package digest;
- source execution run id;
- source Contract;
- source Test Definition;
- Acceptance verdict;
- Findings summary.

Current EvidencePage does not render the package digest, source execution run id, source Contract identity or source Test Definition identity.

Add these from the actual canonical package/state. No fallback IDs.

### 3. EvidencePage contains unconditional integrity claims

Current copy states:

`Cryptographic digests of all components verified against SHA-256 bindings. Zero missing files or integrity errors.`

That statement is rendered regardless of the package's actual status/components/issues.

This is an audit-facing invented conclusion.

Required:

- either derive the statement from canonical package evidence;
- or replace it with neutral explanatory text that does not assert current-package validity.

The separate educational statement explaining what a VALID package means may remain, provided it is clearly general and the actual package status is source-driven.

### 4. Evidence findings counts default missing evidence to zero

Current code ultimately falls back to:

- total findings = `0`;
- defect candidates = `0`.

For an incomplete/audit-only package, missing summary data is not the same as a canonical count of zero.

Required:

- preserve exact zero where a source collection/count is present and empty/zero;
- render `NOT_SUPPLIED` when the source count is absent.

### 5. Evidence lineage details invent `Bound`

Current lineage table uses:

`edge.details || 'Bound'`

M4.3.1 requires rendering the exact lineage edge fields. A missing detail field must not become a new semantic statement.

Use exact details if present, otherwise `NOT_SUPPLIED` or omit the column content.

### 6. Evidence raw-artifact fallback invents `PRESENT`

When projecting `rawArtifactSummary.files`, EvidencePage prints `PRESENT` even though `RawEvidenceFileItem` does not carry a canonical presence status.

The existence of a summary record may be displayed as a recorded file, but do not manufacture a canonical `PRESENT` status.

Use neutral UI wording or governed absence.

### 7. Publication readiness invents blocking explanations

The destination cards correctly iterate `publicationBundle.publicationReadiness`, but when `blockingReasons` is empty the UI fabricates:

- `Ready for export`; or
- `Destination unconfigured`.

M4.3.1 §5 requires exact status and exact blocking reasons.

Required:

- render the canonical readiness status;
- render supplied blocking reasons only;
- if no blocking reason exists, omit it or show `NOT_SUPPLIED`;
- never infer that an arbitrary non-READY destination is unconfigured.

### 8. ExecutionsPage still overclaims runner orchestration

M4.3.1 §6 explicitly requires this copy to be corrected.

Current page still says:

- `Customer-Controlled Test Runner Orchestration`;
- `PECP orchestrates execution...`;
- `The execution workbench orchestrates k6 runners...`.

Live runner orchestration/control is not implemented in M4.3.

Required:

Use factual wording such as:

- `Governed Execution Record`;
- `Execution Evidence & Ingress`;
- `Recorded customer-controlled runner execution`.

Do not claim active Docker/Podman/Kubernetes/native runner orchestration.

### 9. ResultsPage still contains RetailCo-specific presentation language

The page is intended to be project-neutral, but the shared Results view currently contains:

- `Telemetry & Reference Lab Corroboration`;
- `SUT Corroborated Orders Created`.

These labels are RetailCo/reference-domain semantics and appear even for a generic project.

Required:

- use generic labels sourced from canonical metric metadata where available;
- otherwise use neutral labels such as `Business Events Observed` and `Telemetry Corroboration`.

### 10. ResultsPage invents a criterion identifier when absent

Current code displays:

`evalItem.criterionId || evalItem.key || \`crit-${idx}\``

The synthetic `crit-N` identifier is an invented engineering identity.

Required:

- use canonical criterion id/key when present;
- otherwise render `NOT_SUPPLIED`.

React list keys may use the local array index internally, but the displayed engineering identity must not be invented.

### 11. ResultsPage contains a verdict-reason fallback that can imply evaluation

If no verdict reasons are supplied, the UI currently says:

`Evaluated by canonical Acceptance Engine against approved Performance Contract.`

For an incomplete/audit-only state this can assert an evaluation/approval relationship that is not actually present.

Required:

- render supplied verdict reasons;
- otherwise show neutral governed absence such as `No verdict reason supplied` / `NOT_SUPPLIED`.

### 12. TestsPage still contains RetailCo-specific semantic bleed

The shared Tests page currently states:

`Workload demand (e.g. 8.75 orders/second)...`

That RetailCo value is displayed as generic educational copy on any project.

M4.3.1 exists specifically to ensure touched views are faithful for any project rather than RetailCo-shaped screens.

Required:

- remove the RetailCo numeric example from shared project UI;
- use a generic statement without a project-specific value.

The page also still uses:

`stage.description ?? 'Execution stage'`

The original M4.3 work package explicitly identified invented generic stage descriptions as a fallback to remove.

Use exact description or `NOT_SUPPLIED`.

## Regression coverage required

Extend the generic M4.3.1 suite so it proves:

1. a component with absent status/presenceStatus does not render `PRESENT`;
2. missing package findings summary does not become canonical zero;
3. absent lineage details do not become `Bound`;
4. publication readiness with no blockingReasons does not invent `Destination unconfigured`;
5. generic Results does not render `Orders Created` or `Reference Lab`;
6. missing criterion ID/key does not render a synthetic `crit-N`;
7. generic Tests view contains no RetailCo `8.75 orders/second` example;
8. Executions copy does not claim active runner orchestration.

Preserve all existing RetailCo exact-value and drift tests.

## Closure condition

M4.3.1 and M4.3 may close when:

- the semantic blockers above are removed;
- the expanded zero-invention regressions pass;
- authoritative RetailCo remains exact;
- normal GitHub CI is SUCCESS.

No new product scope is required.

## Programme state

`M4.2 ✅ → M4.3 core implemented → M4.3.1 remote CI ✅ / semantic fidelity correction required → M4.3 NOT CLOSED`
