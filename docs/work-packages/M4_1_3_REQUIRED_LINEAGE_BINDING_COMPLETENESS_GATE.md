# Work Package: M4.1.3 — Required Lineage Binding Completeness Gate

## Objective

Ensure a Performance Evidence Package can only be `VALID` when every required source-to-result binding is present and every required core lineage edge is verified.

This is the final M4.1 closure gate.

Read:

- `docs/M4_1_2_PM_REVIEW.md`;
- `docs/work-packages/M4_1_2_AUDIT_METADATA_FIDELITY_PLACEHOLDER_ELIMINATION_GATE.md`;
- `docs/work-packages/M4_1_CANONICAL_PERFORMANCE_EVIDENCE_PACKAGE.md`;
- `docs/M4_0_CLOSURE.md`.

Do not render documents.
Do not publish externally.
Do not perform release certification.
Do not run k6.

## 1. Require complete Test Definition source-Contract binding

For a VALID package require:

- `testDefinition.sourceContractId`;
- `testDefinition.sourceContractVersion`;
- `testDefinition.sourceContractFingerprint`.

Each must exactly match the supplied approved Contract.

Missing is invalid provenance, not "no mismatch".

## 2. Require complete Results provenance bindings

For a VALID package require Results execution bindings:

### Contract

- id;
- version;
- fingerprint.

### Test Definition

- id;
- version;
- fingerprint.

Each must be present and exactly match current Contract/Test Definition authority.

## 3. Require complete Acceptance source bindings

For a VALID package require Acceptance to contain:

- `sourceExecutionRunId`;
- `canonicalResults.executionRunId`;
- source Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- workloadPrerequisite;
- provenanceGate;
- operationalIntegrityGate;
- evaluation digest/fingerprint already verified by M3.3.

Missing required Acceptance binding => INVALID_ACCEPTANCE_INTEGRITY or INVALID_PROVENANCE as appropriate.

Do not broaden M3.3 verdict semantics and do not invent missing values.

## 4. Require complete Findings source bindings

For a VALID package require Findings Register:

- `sourceExecutionRunId`;
- `sourceAcceptanceEvaluationId`;
- `sourceAcceptanceEvaluationDigest`;
- `generationStatus = VALID`;
- valid register digest.

All bindings must match the supplied Results and Acceptance.

Missing source linkage => INVALID_FINDINGS_INTEGRITY / INVALID_PROVENANCE.

## 5. Required core lineage invariant

Define the required M4.1 core lineage edges:

1. PERFORMANCE_CONTRACT -> TEST_DEFINITION
2. TEST_DEFINITION -> EXECUTION_RUN
3. EXECUTION_RUN -> RAW_EVIDENCE_INVENTORY
4. RAW_EVIDENCE_INVENTORY -> CANONICAL_RESULTS
5. CANONICAL_RESULTS -> ACCEPTANCE_EVALUATION
6. ACCEPTANCE_EVALUATION -> FINDINGS_REGISTER

A package may only be `VALID` when all six:

- exist;
- have source-backed endpoint IDs;
- have `verified = true`.

Optional Strategy/Test Plan edges remain conditional.

If any required core edge is absent/unverified, package generation must not remain VALID.

Bind the resulting issue/status into the package digest.

## 6. Do not rely on truthy-guard mismatch checks

Replace logic of the form:

`if (binding && binding !== expected) ...`

for required bindings with:

1. explicit presence validation;
2. then exact equality validation.

Missing and mismatched are both governed failures, with distinct reasons where useful.

## 7. Canonical Test Definition status tests

Replace the non-canonical `STABLE` test.

Add source-fidelity tests using legitimate states, for example:

- READY_FOR_EXECUTION;
- APPROVED or SUPERSEDED where a fixture can be constructed consistently.

The package component must preserve the supplied canonical status exactly.

## 8. Negative regression matrix

Add tests proving a package is not VALID when any one of these is missing:

- Test Definition sourceContractId;
- Test Definition sourceContractVersion;
- Test Definition sourceContractFingerprint;
- Results source Contract id/version/fingerprint;
- Results Test Definition id/version/fingerprint;
- Acceptance sourceExecutionRunId;
- Acceptance canonicalResults.executionRunId;
- Acceptance source Contract id/version/fingerprint;
- Acceptance Test Definition id/version/fingerprint;
- Acceptance workloadPrerequisite;
- Findings sourceExecutionRunId;
- Findings sourceAcceptanceEvaluationId;
- Findings sourceAcceptanceEvaluationDigest.

For digest-bound objects in negative tests, recompute the relevant digest/fingerprint when necessary so the test proves **binding completeness**, not merely checksum tampering.

Also test:

- required core lineage edge missing => package not VALID;
- required core lineage edge unverified => package not VALID;
- all six required core edges verified for authoritative RetailCo.

## 9. Authoritative RetailCo invariant

The authoritative package must remain:

- package status = VALID;
- all six required core lineage edges present and verified;
- Acceptance = INCONCLUSIVE;
- business demand = 8.75 orders/second;
- scheduler demand = 109.375 journey_iterations/second;
- timings = 300 / 900 / 120 / 1320 seconds;
- Checkout = PASS at 0.3906885 ms against p95 < 2000ms;
- Error Rate = PASS at 0 against rate < 0.005;
- one WORKLOAD_ATTAINMENT_UNRESOLVED finding;
- zero Defect Candidates;
- stable SHA-256 package digest/id.

## Definition of Done

M4.1.3 is complete when:

1. all required source bindings are presence-checked and equality-checked;
2. VALID requires all six core lineage edges present and verified;
3. missing binding cannot pass by truthiness short-circuit;
4. Test Definition status tests use canonical statuses;
5. invalid-package output remains deterministic and zero-invention;
6. authoritative RetailCo remains unchanged;
7. normal CI is green.

Stop and provide an M4.1.3 completion report for PM audit.
