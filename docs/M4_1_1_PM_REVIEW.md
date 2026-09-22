# PECP M4.1.1 Project Manager Review

## Status

**M4.1.1 — SUBSTANTIALLY PASSED, M4.1 NOT YET CLOSED**

The Evidence Package semantic-integrity hardening has corrected the major M4.1 defects:

- business demand and scheduler demand are structurally separated;
- RetailCo stage timings are correct;
- Results integrity errors prevent a VALID package;
- raw-evidence lineage shares the governed evidence-validity result;
- CANONICAL_RESULTS no longer borrows execution artifact/bundle identity;
- Strategy/Test Plan STALE/SUPERSEDED states are preserved;
- the missing M4.1 regression paths are now covered.

Normal CI is green.

A final narrow closure gate is still required because several audit-facing fields continue to invent placeholder or synthetic semantics in malformed/invalid runtime inputs, and one component status is invented even on the valid path.

**M4.1.2 — Audit Metadata Fidelity & Placeholder Elimination Gate**

No k6 execution is required.

## Authoritative implementation

Implementation SHA:

`8cdbca1687bce416ec3f8625b2a82640ba98ceb3`

CI run:

`35711663749`

Result: **SUCCESS**

Verified:

- 21 Vitest files passed;
- **380 Vitest tests passed**;
- **37 Evidence Package tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **390 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Verified M4.1.1 corrections

### Workload semantics

Authoritative RetailCo package now preserves:

- business demand = 8.75 orders/second;
- scheduler demand = 109.375 journey_iterations/second;
- scheduler population = JOURNEY_ITERATION;
- execution model = OPEN.

No business/scheduler substitution is used.

### Schedule semantics

Authoritative schedule is correctly represented:

- ramp-up = 300 seconds;
- steady-state = 900 seconds;
- ramp-down = 120 seconds;
- total = 1320 seconds.

### Results integrity

`results.dataQuality.hasIntegrityErrors = true` now prevents VALID package generation and maps to `INVALID_RESULTS_INTEGRITY`.

### Raw-evidence lineage

Raw-evidence capture/parse lineage edges now use the shared governed raw-evidence validity calculation and are not marked verified when evidence is incomplete/invalid.

### Component identities

`CANONICAL_RESULTS` no longer carries the execution artifact digest or execution bundle fingerprint as its own identity.

Those execution identities are now explicitly represented on `EXECUTION_RUN`.

### Optional artefacts

STALE and SUPERSEDED Strategy/Test Plan inputs are explicitly preserved and prevent the package being represented as current/valid.

## Remaining blocking findings

### 1. Literal `unknown` provenance placeholders remain

The M4.1.1 gate explicitly required removal of fabricated canonical identifiers.

The live generator still creates values such as:

- `contractId = contract?.id ?? 'unknown'`;
- `testDefId = testDefinition?.id ?? 'unknown'`;
- `safeRunId = runId ?? 'unknown'`;
- lineage endpoint IDs such as `'unknown'`.

The package also writes `sourceExecutionRunId: safeRunId`.

An invalid package may describe missing provenance, but a literal string `unknown` must not masquerade as a canonical identifier.

Required:

- make invalid-package identity fields optional where necessary;
- omit lineage edges whose required endpoint identity is absent, or model the missing endpoint explicitly without a fabricated ID;
- never persist `unknown` as a source/canonical identifier.

### 2. Execution summary still invents execution mode/status defaults

The package currently uses:

- missing `executionMode` -> `CANONICAL`;
- missing `operationalStatus` -> `UNKNOWN`;
- missing execution run ID -> empty string in the summary.

These are source facts and must not be defaulted.

Required:

- preserve exact Results values;
- if required execution metadata is absent, add a generation issue and make the package invalid/incomplete;
- make summary fields optional for invalid-package representation if needed;
- never fabricate CANONICAL, UNKNOWN or empty identity strings.

### 3. Workload/Acceptance summary still synthesizes missing evaluation state

The package currently defaults malformed/missing Acceptance fields into summary values such as:

- workload status -> `INVALID`;
- prerequisite met -> `false`;
- rationale -> empty string;
- counts/status fields through non-null assertions/default zero paths.

For a genuinely evaluated INVALID workload, `INVALID` is valid.
For a missing Acceptance structure, it is not.

Required:

- distinguish "source says INVALID" from "source field absent";
- do not manufacture workload/Acceptance state for an invalid package;
- make invalid-package summary fields optional where source data is absent.

### 4. Test Definition component invents status `ACTIVE`

The component inventory currently sets:

`TEST_DEFINITION.status = 'ACTIVE'`

regardless of the canonical Test Definition state.

`ACTIVE` is not the source TestDefinition status and therefore creates an audit-semantic fact.

Required:

- use the exact canonical `testDefinition.status`;
- never synthesize ACTIVE.

### 5. Canonical Results component invents status `INGESTED`

The component inventory currently sets:

`CANONICAL_RESULTS.status = 'INGESTED'`.

The canonical Results model does not expose a Results lifecycle status named INGESTED.

Required:

- leave status absent unless it is backed by a canonical Results field;
- do not create process labels in a generic canonical status field.

### 6. Required execution metadata is not explicitly validated for package validity

The generator validates executionRunId, source bindings and evidence, but a malformed Results object can omit execution mode or operational status and still reach package assembly.

Because there is no canonical Results digest in M4.1, package generation must at least fail safely on missing audit-critical execution metadata.

For a VALID package require source-backed:

- execution run id;
- execution mode;
- operational status;
- startedAt;
- completedAt;
- repository/commit identity where required by the current Results model;
- bundle fingerprint where required by execution provenance.

Do not require a particular operational status such as EXECUTION_COMPLETED merely to create an evidence package. Preserve the actual status. The rule is presence/fidelity, not a success-only package.

### 7. Invalid-package representation must remain deterministic without invention

An invalid package is still valuable audit evidence.

It should therefore be possible to return a deterministic package object with:

- packageGenerationStatus;
- generationIssues;
- whatever source identities are actually available;
- no fabricated IDs/statuses/verdicts.

Update domain optionality where necessary rather than inserting placeholders.

## Decision

Do not render/export/publish the package yet.

Complete:

**M4.1.2 — Audit Metadata Fidelity & Placeholder Elimination Gate**

Then re-audit M4.1. If clean, M4.1 can be formally closed.
