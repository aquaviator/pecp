# PECP M4.1 Project Manager Review

## Status

**M4.1 — IMPLEMENTATION FOUNDATION ACCEPTED, NOT YET CLOSED**

The Canonical Performance Evidence Package has been implemented outside the UI and the core package architecture is sound. Normal CI is green and the authoritative RetailCo package correctly separates package validity from performance outcome.

However, the live implementation still contains a small set of semantic-integrity and zero-invention defects in the package summary, Results representation, and lineage validity. These must be corrected before the Evidence Package becomes the downstream audit authority.

A consolidated correction gate is required:

**M4.1.1 — Evidence Package Semantic Integrity & Zero-Invention Gate**

No new k6 execution is required.

## Authoritative implementation

Implementation SHA:

`4db9fb0bf56496f5880a1f2a967da98ffbba7090`

CI run:

`35708151753`

Result: **SUCCESS**

Verified:

- 21 Vitest files passed;
- **365 Vitest tests passed**;
- **22 M4.1 Evidence Package tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **375 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Accepted M4.1 capabilities

The following are verified in live code:

- canonical `PerformanceEvidencePackage` domain model exists;
- package generation is in `@pecp/test-engine`, outside UI;
- Acceptance digest integrity is verified;
- Findings Register and nested Finding/Defect Candidate integrity are verified;
- Contract/Test Definition/Results/Acceptance/Findings provenance is checked;
- raw evidence inventory is represented by reference rather than embedding logs;
- package validity is separate from Acceptance verdict;
- package uses deterministic SHA-256 identity;
- Strategy/Test Plan are optional package components;
- package output is deep-frozen without freezing caller inputs;
- authoritative RetailCo produces a VALID package carrying INCONCLUSIVE, one workload-unresolved finding and zero Defect Candidates.

## Blocking findings

### 1. Workload summary conflates business demand with request-rate terminology

The current domain exposes:

`workloadDemand.targetRps`

but the generator first populates that value from:

`testDefinition.workloadAttainment.targetValue`

For RetailCo this is **8.75 orders/second**, not requests/second.

If that value is absent, the generator may fall back to:

`scenarioSchedule.peakArrivalRate`

which is **109.375 journey_iterations/second**.

Those values represent different populations and must never share one semantic field.

Required:

- replace `targetRps` with source-faithful fields such as `targetValue`, `unit`, and governed business metric/population;
- represent scheduler demand separately, including scheduler peak value, scheduler population and scheduler unit;
- never silently substitute scheduler arrival demand for business workload demand.

### 2. steadyStateSeconds currently contains total test duration

The evidence summary currently assigns:

`steadyStateSeconds = scenarioSchedule.totalDurationSeconds`.

For authoritative RetailCo:

- total duration = 1320 seconds;
- steady-state duration = 900 seconds.

The package therefore misstates an authoritative test fact.

Required:

- represent total duration separately;
- derive steady-state duration only from an explicitly governed steady-state stage;
- for RetailCo preserve 300s ramp-up, 900s steady-state and 120s ramp-down;
- if stage role cannot be determined from governed data, leave the semantic duration unresolved rather than inventing it.

### 3. Results integrity errors are not part of package validity

The generator checks:

- raw reference presence;
- `dataQuality.isComplete`;
- credential leakage.

It does not gate on:

`results.dataQuality.hasIntegrityErrors`

or other governed integrity errors already captured by M3.2.

A Results object with integrity errors can therefore still become a VALID Evidence Package if its files are present.

Required:

- package validity must consume M3.2 Results integrity state;
- `hasIntegrityErrors = true` must prevent VALID package generation;
- introduce `INVALID_RESULTS_INTEGRITY` if useful, or map explicitly to a governed invalid package status;
- surface the source M3.2 integrity issues in package generation issues;
- add regression coverage for non-credential integrity errors.

### 4. Raw-evidence lineage edges can be marked verified on incomplete evidence

The lineage currently marks:

`EXECUTION_RUN -> RAW_EVIDENCE_INVENTORY`

verified when:

`rawReferences.length > 0`.

It marks:

`RAW_EVIDENCE_INVENTORY -> CANONICAL_RESULTS`

verified largely from the presence of `results.metrics`.

Those conditions are weaker than package validity.

A partially missing/corrupt raw evidence inventory can therefore be represented with a `verified: true` lineage edge while the package is incomplete.

Required:

- derive lineage verification from the same governed completeness/integrity checks used by package validation;
- incomplete/corrupt raw evidence => capture/parse lineage edge not verified;
- Results integrity errors => raw-evidence-to-results edge not verified.

### 5. CANONICAL_RESULTS component uses non-Results digests as its fingerprint

The current `CANONICAL_RESULTS` component sets:

`fingerprint = executionArtifact.digest ?? bundleFingerprint`.

Neither value is a fingerprint of the canonical Results object:

- execution artifact digest identifies an execution evidence bundle;
- bundle fingerprint identifies the compiled execution bundle.

Do not label either as a canonical Results fingerprint.

Required:

- leave canonical Results fingerprint/digest absent unless a true deterministic Results digest is introduced;
- retain execution artifact/bundle identities in the correct execution/raw-evidence components;
- do not create a misleading cryptographic identity for normalized Results.

A dedicated canonical Results digest may be introduced later, but it must actually hash the canonical Results representation.

### 6. Zero-invention fallbacks remain in the package generator

The generator contains fallback semantics such as:

- `engineeringIntent ?? 'CERTIFICATION'`;
- `findingsRegister.generationStatus ?? 'VALID'`;
- fallback Acceptance verdict `INCONCLUSIVE`;
- multiple canonical ids/digests replaced with `'unknown'`.

These do not normally execute with well-typed valid inputs, but they violate PECP's zero-invention boundary for malformed or incomplete runtime data.

The most dangerous is defaulting missing Findings generation state to `VALID`.

Required:

- required source values must be present for a VALID package;
- missing required semantic values must make package generation invalid/incomplete;
- never invent CERTIFICATION intent;
- never invent VALID generation status;
- never represent missing provenance value as the literal canonical value `unknown`;
- update domain optionality for invalid-package outputs if required.

### 7. Optional artefact staleness checks only source-contract mismatch

A supplied Strategy/Test Plan whose own canonical status is `STALE` can currently be marked component `PRESENT` and its lineage `verified: true` if the source Contract binding matches.

Required:

- canonical artefact status `STALE` must remain STALE in package presence/currentness semantics;
- `SUPERSEDED` must not be represented as current;
- preserve DRAFT/READY_FOR_APPROVAL/APPROVED status without claiming approval;
- source-contract mismatch remains a package issue.

### 8. Required M4.1 regression coverage is incomplete

The current dedicated suite has 22 tests and covers most major paths, but the M4.1 work package explicitly required several cases that are not separately demonstrated.

Add explicit tests for:

- PASS_WITH_OBSERVATION package;
- tampered Defect Candidate digest;
- generic Results integrity error;
- governed timestamp change does not change package digest/id;
- canonical workload demand vs scheduler demand semantic separation;
- exact RetailCo stage durations;
- STALE/SUPERSEDED optional artefact status;
- no semantic defaults when required input fields are missing.

## Completion-report corrections

The supplied completion report says the Contract provenance check validates a computed **SHA-256** Contract fingerprint. The current Contract fingerprint remains the historical deterministic FNV-1a drift fingerprint. M4.1 correctly preserves it; the report wording is inaccurate.

The report also says 365 tests plus 10 Reference Lab tests. CI confirms this is **375 combined tests**.

## Decision

Do not render/export the final package and do not begin external publishing.

Complete:

**M4.1.1 — Evidence Package Semantic Integrity & Zero-Invention Gate**

Then re-audit M4.1.
