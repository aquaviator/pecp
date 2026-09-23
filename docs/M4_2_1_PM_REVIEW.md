# PECP M4.2.1 Project Manager Review

## Status

**M4.2.1 — SUBSTANTIALLY PASSED, M4.2 NOT YET CLOSED**

The M4.2.1 hardening gate has corrected the major semantic-default, target-expression, cryptographic-binding and generic schedule issues identified in the M4.2 PM review.

Normal CI is green and the authoritative RetailCo export remains correctly governed.

However, the live implementation still has four material closure gaps around companion-object isolation, optional artefact source binding, report digest completeness, and schema/visualisation fidelity. These must be corrected before M4.2 becomes the authoritative export boundary.

A final narrow closure gate is required:

**M4.2.2 — Companion Isolation, Source-Binding & Report Integrity Gate**

No live connector work is authorized.

## Authoritative implementation

Implementation SHA:

`7b849c84d855233bf759a47480b91c57911005fe`

CI run:

`35844650290`

Result: **SUCCESS**

Verified:

- 22 Vitest files passed;
- **420 Vitest tests passed**;
- **18 M4.2/M4.2.1 tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **430 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Verified M4.2.1 corrections

### Semantic defaults

The render-neutral Results Report now preserves absent governed values as null/absence instead of fabricating:

- zero workload rates;
- default workload units;
- default scheduler population/model;
- synthetic Acceptance verdict;
- synthetic workload prerequisite outcome.

Markdown/HTML use `[GOVERNED ABSENCE]`.

### Defect target fidelity

Governed target expressions such as:

`p95 < 2000ms`

are preserved as strings rather than being converted through `Number(...)`.

### Findings verification

Supplied Findings Registers are now cryptographically verified before defect payload generation.

### Test Definition verification

Supplied Test Definitions are fingerprint-recomputed and id/version/fingerprint checked against the Evidence Package component.

### Bundle cryptographic binding

Publication Bundle digest now binds substantially more artifact semantics including:

- id;
- source identity;
- media type;
- metadata;
- content digest;
- eligibility;
- blocking reasons.

Bundle verification checks digest algorithm/schema, bundle id, artifact content/id and Defect Payload digest/id.

### Generic schedule visualisation

When a Test Definition is used, schedule stages now carry:

- source stage order;
- duration;
- cumulative start/end seconds;
- start arrival rate;
- target arrival rate;
- scheduler unit/population/model;
- journey distribution.

Stress-style multi-stage schedules are covered by regression tests.

## Remaining blocking findings

### 1. Unverified companion objects are still used to build Results Report content

The generator comment says:

> only pass verified companions to prevent unverified drift

but the implementation calls:

`generateResultsReport(evidencePackage, verifiedTestDefinition ?? testDefinition, verifiedFindingsRegister ?? findingsRegister)`.

If verification fails, this falls back to the **unverified caller object**.

Consequences:

- a drifted Test Definition can still alter visualisation/report content in a blocked or audit-only bundle;
- a tampered Findings Register can still alter report candidate counts/summary even though defect payload generation is correctly blocked.

This violates the M4.2.1 rule that unverified companion content must not enter generated projections.

Required:

- call `generateResultsReport(evidencePackage, verifiedTestDefinition, verifiedFindingsRegister)`;
- never fall back to unverified supplied objects;
- if a supplied companion fails verification, only canonical Evidence Package content may be projected;
- no export artifact may contain unverified companion content.

### 2. Strategy/Test Plan source Contract binding checks use the wrong component field

M4.1 stores Strategy/Test Plan source Contract authority in:

`EvidencePackageComponentReference.sourceContractFingerprint`.

M4.2.1 currently checks:

`comp.fingerprint`

against:

`strategy.sourceContractFingerprint` / `testPlan.sourceContractFingerprint`.

For normal M4.1 package components, `comp.fingerprint` is absent.

Therefore a same-id/version/status Strategy or Test Plan with a changed source Contract fingerprint can evade this check.

The existing regression test constructs a synthetic Strategy component using `fingerprint`, so it masks the real package shape.

Required:

- compare `comp.sourceContractFingerprint` with the supplied artefact's `sourceContractFingerprint`;
- test using the actual M4.1 Evidence Package component schema;
- add explicit Strategy and Test Plan source-binding mismatch tests.

### 3. Results Report digest does not bind source execution timestamps

`RenderNeutralResultsReport.projectExecutionIdentity` contains:

- `startedAt`;
- `completedAt`.

These are governed source execution facts.

`buildResultsReportDigestPayload()` currently excludes both.

The M4.2.1 work package requires the report digest to bind all semantically meaningful report content and exclude only intentionally non-semantic generation-time metadata.

Required:

- bind `startedAt` and `completedAt` into `reportDigest`;
- consider `acceptanceVerdict.evaluatedAt` source-backed and bind it unless an explicit documented reason excludes it;
- keep Publication Bundle `generatedAt` excluded.

A source execution timestamp change must alter the report digest.

### 4. Bundle top-level schemaVersion is not verified/bound

The Publication Bundle contains:

`schemaVersion: 'publication-bundle-v1'`

and its digest descriptor also carries a schema version.

The verifier checks:

`bundle.bundleDigest.schemaVersion`

but not:

`bundle.schemaVersion`.

The digest payload itself hardcodes `publication-bundle-v1` rather than consuming/checking the top-level bundle field.

A tampered top-level bundle schema can therefore be inconsistent with its digest envelope without direct detection.

Required:

- verify `bundle.schemaVersion === 'publication-bundle-v1'`;
- bind/check the actual top-level schema value consistently;
- add a regression that changes only top-level `bundle.schemaVersion` and requires verification failure.

### 5. Missing scheduler startRate is still silently converted to zero

`WorkloadSchedule.startRate` is optional in the canonical domain.

For a verified Test Definition, the visualisation projector currently initializes:

`currentRate = sched.startRate !== undefined ? sched.startRate : 0`

and returns scheduler `startRate: ... : 0`.

That invents a zero initial rate when the source did not provide one.

Required:

- make stage `startArrivalRate` nullable/optional where source start rate is absent;
- first stage start rate remains absent when `schedule.startRate` is absent;
- subsequent stage start rate can deterministically use the previous governed target rate;
- do not synthesize zero.

### 6. Package-summary fallback still reconstructs a three-stage load profile

When no verified Test Definition is available, `generateResultsReport()` reconstructs:

- ramp-up;
- steady-state;
- ramp-down

from Evidence Package summary fields.

This is safe for RetailCo but is not a generic representation for stress/spike/custom schedules and can turn a summary into a fabricated exact schedule.

Required:

- without a verified Test Definition, do not reconstruct exact visualisation stages;
- preserve scheduler/business summary fields if available;
- return `stages: []` and `journeyDistribution: []` unless exact governed source schedule data is available;
- human-readable output may say governed stage detail is unavailable.

## Completion-report factual corrections

The completion report contains two authoritative RetailCo unit/criterion errors:

- Checkout p95 is **0.3906885 ms**, not `0.3906885s`. The governed criterion is p95 < **2000 ms**.
- HTTP failure-rate criterion is **rate < 0.005 (0.5%)**, not `<= 1%`.

These are report wording errors. The authoritative implementation/test fixtures still preserve the correct values.

## Decision

Do not begin live Jira/ADO/Confluence/SharePoint connector execution.

Complete:

**M4.2.2 — Companion Isolation, Source-Binding & Report Integrity Gate**

Then re-audit M4.2. If clean, formally close M4.2.
