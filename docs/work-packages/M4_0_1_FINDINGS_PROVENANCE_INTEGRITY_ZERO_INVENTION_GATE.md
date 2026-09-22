# Work Package: M4.0.1 — Findings Provenance Integrity & Zero-Invention Gate

## Objective

Harden M4.0 so a Findings Register can only be generated from an intact, provenance-compatible M3.3 Acceptance Evaluation and no Defect Candidate can contain invented fallback evidence.

This is the M4.0 correction gate.

Read:

- `docs/M4_0_PM_REVIEW.md`;
- `docs/work-packages/M4_0_CANONICAL_FINDINGS_DEFECT_CANDIDATE_MODEL.md`;
- `docs/M3_3_CLOSURE.md`.

Do not implement final Evidence Package.
Do not publish Jira/ADO tickets.
Do not infer root cause.
Do not perform release certification.
Do not run k6.

## 1. Verify Acceptance Evaluation digest integrity

Refactor M3.3 digest construction so the exact canonical Acceptance Evaluation digest payload can be reused for verification.

Provide a deterministic helper such as:

- `buildAcceptanceEvaluationDigestPayload(...)`;
- `verifyAcceptanceEvaluationDigest(...)`.

The helper must reconstruct the same `acceptance-evaluation-v1` content used when M3.3 created the digest.

In `generateFindings()`:

- recompute Acceptance Evaluation SHA-256;
- compare with `acceptanceEvaluation.evaluationDigest.value`;
- verify algorithm = SHA-256;
- verify schemaVersion = acceptance-evaluation-v1;
- verify retained `evaluationFingerprint` equals the digest value.

Mismatch must produce an invalid generation result and zero Defect Candidates.

Do not accept a changed digest merely as a new source binding.

## 2. Complete Acceptance-to-Results provenance checks

Compare exactly:

### Execution

- Acceptance `sourceExecutionRunId` vs Results `executionRunId`.

### Contract

- id;
- version;
- fingerprint.

### Test Definition

- id;
- version;
- fingerprint.

Missing/mismatched binding => invalid provenance generation result.

No normal performance finding/defect publication path may execute after this gate fails.

## 3. Validate optional Contract and Test Definition inputs

If `contract` is supplied:

- id/version must match Acceptance and Results authority;
- recompute `computeContractFingerprint(contract)`;
- stored/current authority must match Acceptance/Results fingerprints.

If `testDefinition` is supplied:

- id/version must match Acceptance and Results authority;
- recompute `computeTestDefinitionFingerprint(testDefinition)`;
- current fingerprint must match supplied/stored authority.

If these optional inputs are absent, do not invent them.

## 4. Add Findings generation validity state

Extend the canonical Findings Register with an explicit generation state.

Recommended:

`FindingsGenerationStatus = VALID | INVALID_ACCEPTANCE_INTEGRITY | INVALID_PROVENANCE`

and:

`generationIssues: string[]`.

Rules:

- normal governed generation => VALID;
- bad Acceptance digest => INVALID_ACCEPTANCE_INTEGRITY;
- source binding mismatch => INVALID_PROVENANCE.

Invalid generation states:

- zero Defect Candidates;
- no normal SUT performance findings;
- may contain the appropriate provenance/integrity finding(s);
- must be digest-bound.

Bind status/issues into `registerDigest`.

## 5. Remove all Defect Candidate fallback invention

Delete fallback substitutions such as:

- `observedValue ?? 0`;
- `observedUnit ?? ''`;
- `operator ?? '<'`;
- `canonicalThresholdValue ?? 0`;
- `canonicalUnit ?? ''`.

Before creating a publication-eligible Defect Candidate, require all necessary factual evidence.

At minimum:

- finite observedValue;
- non-empty observedUnit;
- supported canonical operator;
- finite canonicalThresholdValue;
- non-empty canonicalUnit;
- non-empty evidenceSourcePath.

If any is absent:

- performance finding may remain factual if supportable;
- `defectEligibility = false`;
- no publication-eligible Defect Candidate.

No value may be manufactured to satisfy the candidate schema.

Update domain optionality if necessary.

## 6. Correct canonical target semantics

Never use criterion `key` as criterion `target`.

For:

- `acceptanceCriterionReference.target`;
- `expectedGovernedCriterion.target`;

use the exact target string only when it can be resolved from a verified canonical Contract/Test Definition criterion.

If no verified canonical target string is available:

- leave target undefined.

The operator/threshold/unit fields already provide deterministic numeric expectation and must remain source-backed.

## 7. Explicitly revalidate defect eligibility

A finding may be defect-eligible only when all are true:

1. Findings generation status = VALID;
2. Acceptance digest integrity verified;
3. Acceptance overall verdict = FAIL;
4. workload prerequisite = ATTAINED;
5. provenance gate valid;
6. operational integrity gate valid;
7. source criterion status = FAIL;
8. required observed/threshold evidence is complete;
9. finding is bound to Acceptance digest.

Otherwise:

- defectEligibility = false;
- no publication-eligible candidate.

## 8. Make Findings Register immutable without side effects

Deep-freeze the newly created Findings Register output.

Do not freeze or mutate caller-owned:

- Acceptance Evaluation;
- Results;
- Contract;
- Test Definition.

Add tests proving:

- returned register and nested outputs are frozen/immutable;
- supplied inputs remain unfrozen and mutable where originally mutable.

## 9. Update tampered-digest regression

Replace the current test that mutates Acceptance digest and expects a different normal finding digest.

New expected behavior:

- tampered Acceptance digest => generation status INVALID_ACCEPTANCE_INTEGRITY;
- provenance/integrity finding only;
- zero Defect Candidates;
- normal RetailCo workload finding is not generated from the tampered evaluation.

Add separate test proving a valid source Acceptance digest change produced by a genuinely different Acceptance Evaluation naturally changes downstream finding/register digests.

## 10. Negative regression matrix

Add tests for:

- tampered Acceptance digest;
- mismatched Acceptance evaluationFingerprint;
- wrong digest algorithm/schema;
- Contract id mismatch;
- Contract version mismatch;
- Test Definition id mismatch;
- Test Definition version mismatch;
- supplied Contract fingerprint drift;
- supplied Test Definition self-fingerprint drift;
- FAIL criterion missing observed value => no defect candidate;
- FAIL criterion missing observed unit => no defect candidate;
- FAIL criterion missing operator => no defect candidate;
- FAIL criterion missing canonical threshold => no defect candidate;
- FAIL criterion missing canonical unit => no defect candidate;
- FAIL criterion missing evidence source path => no defect candidate;
- target string is canonical target when verified source supplied;
- target remains absent when no verified source target is available;
- no fallback 0 / empty string / `<` values;
- returned Findings Register immutable;
- caller inputs not frozen;
- authoritative RetailCo still produces one workload-unresolved finding and zero defects.

## 11. Authoritative RetailCo regression

The untouched authoritative path must remain:

- Acceptance overall = INCONCLUSIVE;
- workload = UNRESOLVED;
- two criterion details = PASS;
- Findings generation status = VALID;
- exactly one `WORKLOAD_ATTAINMENT_UNRESOLVED` finding;
- zero Defect Candidates;
- deterministic SHA-256 finding/register digests.

## Definition of Done

M4.0.1 is complete when:

1. Acceptance digest is recomputed and verified before findings generation;
2. full Contract/Test Definition id/version/fingerprint bindings are checked;
3. optional supplied Contract/Test Definition inputs are validated;
4. invalid generation state is explicit and digest-bound;
5. Defect Candidates contain no fallback/invented values;
6. canonical target semantics are correct;
7. defect eligibility is explicitly revalidated;
8. returned Findings Register is immutable without freezing caller inputs;
9. authoritative RetailCo behaviour is unchanged;
10. normal CI is green.

Stop and provide an M4.0.1 completion report for PM audit.
