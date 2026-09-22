# Work Package: M4.1 — Canonical Performance Evidence Package & Audit Manifest

## Objective

Implement PECP's canonical Performance Evidence Package.

M4.1 assembles the governed source-to-result chain into a deterministic, tamper-evident package manifest suitable for later rendering, download, publishing and audit.

This implements Constitution §13 step 17:

**generate a Performance Evidence Package**

M4.1 is a canonical data/package layer, not a PDF renderer and not an external publishing connector.

Read:

- `docs/M4_0_CLOSURE.md`;
- `docs/M3_3_CLOSURE.md`;
- `docs/M3_2_CLOSURE.md`;
- `docs/PRODUCT_CONSTITUTION.md`;
- canonical Contract, Engineering Artefact, Test Definition, Results, Acceptance and Findings domain models.

Do not publish to Jira/ADO/Confluence/SharePoint.
Do not generate final DOCX/PDF.
Do not assign release certification beyond the existing Acceptance verdict.
Do not rerun k6.
Do not infer root cause.

## 1. Evidence Package governance law

A Performance Evidence Package is a governed audit package over existing canonical evidence.

It must not:

- recalculate or replace the M3.3 Acceptance verdict;
- create new Findings;
- turn INCONCLUSIVE into PASS/FAIL;
- invent missing source artefacts;
- call a run "certified" unless a future explicit certification workflow says so.

Package validity and performance verdict are separate concepts.

A package may be:

- cryptographically VALID;
- complete for the evidence available;

while carrying an Acceptance verdict of INCONCLUSIVE.

The authoritative RetailCo package is expected to be exactly that.

## 2. Canonical package domain

Add engine-neutral domain types in `@pecp/pe-domain`.

Recommended minimum:

### EvidencePackageGenerationStatus

- `VALID`
- `INVALID_PROVENANCE`
- `INVALID_ACCEPTANCE_INTEGRITY`
- `INVALID_FINDINGS_INTEGRITY`
- `INCOMPLETE_REQUIRED_EVIDENCE`

### EvidencePackageComponentType

At minimum:

- `PERFORMANCE_CONTRACT`
- `PERFORMANCE_STRATEGY`
- `PERFORMANCE_TEST_PLAN`
- `TEST_DEFINITION`
- `EXECUTION_RUN`
- `RAW_EVIDENCE_INVENTORY`
- `CANONICAL_RESULTS`
- `ACCEPTANCE_EVALUATION`
- `FINDINGS_REGISTER`

### EvidencePackageComponentReference

Preserve:

- component type;
- canonical id where available;
- version where available;
- fingerprint/digest;
- algorithm/schema where applicable;
- status;
- source locator;
- required/optional flag;
- presence status.

### PerformanceEvidencePackage

Preserve at minimum:

- package id;
- schema version;
- project id/name;
- engineering intent;
- source execution run id;
- source Contract id/version/fingerprint;
- source Test Definition id/version/fingerprint;
- Acceptance Evaluation id/digest/verdict;
- Findings Register id/digest/generation status;
- package generation status;
- generation issues;
- deterministic component inventory;
- evidence summary;
- source-to-result lineage;
- package digest;
- generatedAt from governed/caller context only.

## 3. Package input contract

Implement a pure package generator, for example:

`generatePerformanceEvidencePackage(...)`

Inputs should include:

Required:

- approved `PerformanceContract`;
- canonical `TestDefinition`;
- `CanonicalExecutionResult`;
- `AcceptanceEvaluation`;
- `FindingsRegister`.

Optional when available:

- Performance Strategy `EngineeringArtefact`;
- Performance Test Plan `EngineeringArtefact`.

Do not require a UI object.

The generator must work outside the web layer.

## 4. Verify upstream cryptographic integrity

Before package generation, verify:

### Acceptance

- SHA-256 algorithm;
- `acceptance-evaluation-v1`;
- recomputed digest matches;
- retained fingerprint matches digest.

### Findings

Verify the Findings Register rather than trusting its stored digest.

Introduce/reuse a deterministic Findings digest payload builder and verifier.

Verify:

- generation status;
- register digest algorithm/schema;
- finding digests;
- defect candidate digests;
- register digest recomputation.

A tampered Finding/Defect Candidate/Register must not enter a VALID package.

## 5. Verify full source provenance

Require exact consistency across the package chain.

### Contract

- id;
- version;
- recomputed fingerprint;
- APPROVED status.

### Test Definition

- source Contract id/version/fingerprint;
- recomputed Test Definition fingerprint;
- Results Test Definition id/version/fingerprint.

### Results

- execution run id;
- Contract binding;
- Test Definition binding;
- bundle fingerprint;
- raw evidence inventory completeness state.

### Acceptance

- source execution run id;
- Contract/Test Definition identities;
- canonical Results identity.

### Findings

- source Acceptance id/digest;
- source execution run id;
- generation status.

Any contradiction => package generation invalid.

## 6. Strategy/Test Plan artefact references

When Strategy/Test Plan are supplied:

- verify source Contract id/version/fingerprint;
- preserve artefact id/version/status;
- do not claim current/approved when stale or mismatched;
- represent staleness/mismatch as package generation issue.

Do not invent either artefact if not supplied.

Define whether these are required for the first commercial package.

For M4.1 v1:

- Contract/Test Definition/Results/Acceptance/Findings are required;
- Strategy/Test Plan may be optional components until their own stable content digest is available.

Do not fabricate a content digest for historical artefacts unless it can be deterministically computed from canonical content.

## 7. Raw evidence manifest

The package must expose the M3.2 raw evidence inventory.

For every governed raw artifact preserve:

- evidence type;
- filename/source locator;
- presence status;
- SHA-256/checksum if supplied;
- size if supplied.

Do not embed secrets.

Credential leakage protections from M3.2 remain mandatory.

The Evidence Package should reference raw evidence, not duplicate arbitrary multi-megabyte logs into the canonical domain object.

## 8. Evidence summary

Create a deterministic render-neutral evidence summary.

Include factual sections such as:

- execution identity/status;
- governed workload demand;
- workload attainment evaluation;
- canonical criterion outcomes;
- final Acceptance verdict and reasons;
- Findings summary by type/classification;
- Defect Candidate count;
- data-quality/integrity state.

Do not infer narrative root cause.

Do not convert engine threshold state into the PECP verdict.

## 9. Source-to-result lineage

The package must make the chain explicit:

`Contract -> Test Definition -> Execution Run -> Raw Evidence -> Canonical Results -> Acceptance Evaluation -> Findings Register`

Where Strategy/Test Plan are supplied:

`Contract -> Strategy/Test Plan`

must also be represented.

Each edge should carry the relevant id/version/fingerprint/digest binding.

## 10. Package completeness vs performance outcome

Model separately:

### Package validity/completeness

Is the audit package internally consistent and complete for required components?

### Acceptance verdict

What did PECP conclude about performance?

Never conflate them.

Example authoritative RetailCo:

- package generation = VALID;
- package required components = present;
- Acceptance verdict = INCONCLUSIVE;
- Findings = one workload-unresolved governance finding;
- Defect Candidates = zero.

That is a valid evidence package describing an inconclusive performance evaluation.

## 11. Cryptographic package digest

Use dedicated SHA-256.

Recommended:

- algorithm: `SHA-256`;
- schemaVersion: `performance-evidence-package-v1`.

Bind normalized:

- package status/issues;
- source identities;
- component references;
- raw evidence references/checksums;
- Acceptance digest/verdict;
- Findings Register digest;
- lineage edges;
- evidence summary.

Sort semantically unordered collections deterministically.

Do not include wall-clock time in the digest.

## 12. Deterministic metadata

No `Date.now()` / `new Date()` inside the generator.

Use:

1. caller-supplied generation timestamp;
2. otherwise Results execution completion time;
3. otherwise absent.

Default package id should derive from package digest.

## 13. Immutability and input purity

Deep-freeze newly generated package output.

Do not freeze/mutate caller-owned:

- Contract;
- Strategy/Test Plan;
- Test Definition;
- Results;
- Acceptance;
- Findings.

Add purity tests.

## 14. Authoritative RetailCo expectation

Using the exact authoritative chain:

- Contract approved;
- execution completed;
- raw evidence governed;
- Results valid;
- Acceptance = INCONCLUSIVE;
- workload = UNRESOLVED;
- Checkout criterion PASS;
- Error Rate criterion PASS;
- Findings Register VALID;
- one workload-unresolved finding;
- zero Defect Candidates.

M4.1 expected output:

- package generation status = VALID;
- Acceptance verdict remains INCONCLUSIVE;
- one finding represented;
- zero defect candidates represented;
- raw evidence inventory represented;
- stable SHA-256 package digest;
- no claim that RetailCo passed performance;
- no claim of root cause;
- no release certification.

## 15. Invalid/tampered input behavior

Add deterministic invalid-package outcomes for:

- tampered Acceptance digest;
- tampered Findings Register digest;
- tampered individual finding digest;
- Contract fingerprint drift;
- Test Definition fingerprint drift;
- execution run mismatch;
- Findings source Acceptance mismatch;
- missing required Results evidence;
- credential leakage/integrity error;
- stale supplied Strategy/Test Plan binding.

An invalid package must never masquerade as VALID.

## 16. Tests

At minimum cover:

- authoritative RetailCo => VALID package carrying INCONCLUSIVE verdict;
- PASS package;
- FAIL package with Defect Candidate references;
- PASS_WITH_OBSERVATION package;
- tampered Acceptance => invalid package;
- tampered Findings Register => invalid package;
- tampered Finding/Defect Candidate digest => invalid package;
- Contract mismatch;
- Test Definition mismatch;
- run id mismatch;
- missing required component;
- raw evidence incomplete;
- optional Strategy/Test Plan absent;
- supplied Strategy/Test Plan valid;
- supplied Strategy/Test Plan stale/mismatched;
- deterministic component ordering;
- identical inputs => identical package digest/id;
- governed timestamp excluded from digest;
- package immutable;
- caller inputs unfrozen;
- no root cause/certification invention.

Normal CI remains fast and k6-independent.

## 17. UI boundary

M4.1 does not require a full UI implementation.

At most, provide enough fixture/service integration for a future Evidence page to consume the canonical package.

The web page must not calculate package validity or digests.

## Explicit non-goals

M4.1 does not:

- render PDF/DOCX;
- publish to Confluence/SharePoint;
- create Jira/ADO tickets;
- upload evidence externally;
- perform release certification;
- sign with customer PKI;
- rerun performance tests;
- infer root cause.

## Definition of Done

M4.1 is complete when:

1. canonical Performance Evidence Package domain types exist;
2. deterministic generator exists outside UI;
3. Acceptance and Findings cryptographic integrity are verified;
4. Contract/Test Definition/Results provenance is verified;
5. raw evidence inventory is represented;
6. package validity is separate from Acceptance verdict;
7. source-to-result lineage is explicit;
8. authoritative RetailCo generates a VALID package carrying INCONCLUSIVE;
9. package uses deterministic SHA-256 identity;
10. no values/verdicts/root cause/certification are invented;
11. output is immutable without caller side effects;
12. normal CI is green.

Stop and provide an M4.1 completion report for PM audit.
