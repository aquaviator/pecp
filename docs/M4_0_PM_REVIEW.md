# PECP M4.0 Project Manager Review

## Status

**M4.0 — NOT ACCEPTED YET**

The M4.0 architecture is strong and normal CI is green, but the live implementation still has several integrity and zero-invention gaps that must be corrected before Findings or Defect Candidates can become authoritative downstream evidence.

The implementation correctly establishes the Findings domain, deterministic generation, RetailCo INCONCLUSIVE behaviour, PASS/FAIL/PASS_WITH_OBSERVATION handling, SHA-256 finding/register digests and the crucial law that INCONCLUSIVE does not become an SUT performance defect.

A narrow correction gate is required:

**M4.0.1 — Findings Provenance Integrity & Zero-Invention Gate**

No new k6 execution is required.

## Authoritative implementation

Implementation SHA:

`f90e5df0d462d7677e9a26c60b2f72e91387c570`

CI run:

`35705362259`

Result: **SUCCESS**

Verified:

- 20 Vitest files passed;
- **328 Vitest tests passed**;
- **16 dedicated M4.0 tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **338 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Accepted M4.0 capabilities

Verified in live code:

- `CanonicalFinding`, `DefectCandidate` and `FindingsRegister` domain types exist;
- findings generation is outside the UI;
- authoritative RetailCo produces exactly one `WORKLOAD_ATTAINMENT_UNRESOLVED` finding and zero defect candidates;
- PASS produces zero findings;
- PASS_WITH_OBSERVATION preserves explicit non-blocking observations only;
- valid FAIL under attained workload creates criterion failure findings/candidates;
- NOT_ATTAINED protects against false SUT defects;
- NOT_EVALUABLE/provenance/integrity/corroboration/blocking-observation cases produce non-defect findings;
- root cause, priority, assignee, sprint and remediation are not invented;
- findings/register identities are deterministic SHA-256 based;
- deterministic ordering is tested.

## Blocking findings

### 1. Acceptance Evaluation digest integrity is not verified

`generateFindings()` copies:

`acceptanceEvaluation.evaluationDigest.value`

into findings and register digests but never recomputes or verifies that the supplied Acceptance Evaluation still matches that digest.

The current test suite explicitly mutates the Acceptance Evaluation digest to all-zeroes and expects a different normal finding/register digest.

That proves the generator accepts a tampered Acceptance Evaluation digest rather than rejecting it.

This is critical because M4.0 is downstream of the governed M3.3 decision.

Required:

- centralize/reuse the canonical Acceptance Evaluation digest payload builder;
- recompute the SHA-256 digest of the supplied Acceptance Evaluation;
- compare it to `acceptanceEvaluation.evaluationDigest.value`;
- require `evaluationFingerprint` to match the digest where retained;
- mismatch => invalid findings generation / provenance conflict;
- zero defect candidates;
- do not generate normal performance findings from a tampered Acceptance Evaluation.

### 2. Acceptance-to-Results provenance validation is incomplete

The work package required binding/checking:

- execution run id;
- Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- Acceptance Evaluation digest;
- Results execution identity.

The live generator currently checks:

- execution run id;
- Contract fingerprint;
- Test Definition fingerprint.

It does not explicitly compare Contract id/version or Test Definition id/version.

Add exact checks for all authority identifiers.

### 3. Supplied Contract and Test Definition inputs are ignored

`GenerateFindingsInput` accepts optional:

- `contract`;
- `testDefinition`.

The generator never uses them.

When supplied, they must be verified against:

- Acceptance Evaluation authority;
- Results authority;
- their current deterministic fingerprints.

They may be omitted for a findings-only generation path, but they must not be accepted and silently ignored.

### 4. Defect Candidate construction still contains invented fallback values

The current FAIL path contains:

- `observedValue: c.observedValue ?? 0`;
- `observedUnit: c.observedUnit ?? ''`;
- `operator: c.operator ?? '<'`;
- `thresholdValue: c.canonicalThresholdValue ?? 0`;
- `unit: c.canonicalUnit ?? ''`.

These are forbidden zero-invention/default substitutions.

A missing observed value is not zero.
A missing operator is not `<`.
A missing unit is not an empty unit.

For a publication-eligible Defect Candidate, required evidence must be present explicitly.

If required evidence is absent:

- do not invent a candidate field;
- do not mark the finding defect-eligible;
- do not mark publication eligibility true.

### 5. Defect Candidate target is populated with the criterion key

The current candidate writes:

`acceptanceCriterionReference.target = c.key`

and:

`expectedGovernedCriterion.target = c.key`.

For RetailCo that makes a key such as `checkout_response_time` masquerade as the governed target expression.

That is semantically wrong.

Required:

- if a verified Contract/Test Definition is supplied, use the exact canonical `target` string from the matching criterion;
- otherwise leave optional target fields absent;
- never substitute criterion key for target.

### 6. Defect eligibility is not independently revalidated

The current FAIL branch checks primarily:

`workloadPrerequisite.status === 'ATTAINED'`.

A genuine M3.3 FAIL implies valid provenance/integrity/evaluable evidence, but M4.0 must fail safely even if a supplied Acceptance object is malformed or forged.

Before a finding becomes defect-eligible, explicitly require:

- overall verdict = FAIL;
- workload = ATTAINED;
- provenance gate valid;
- operational integrity gate valid;
- criterion status = FAIL;
- observed value present and finite;
- observed unit present;
- operator present and supported;
- canonical threshold present and finite;
- canonical unit present;
- evidence source path present;
- Acceptance Evaluation digest verified.

Otherwise no publication-eligible defect candidate.

### 7. FindingsRegister is not immutable

The work package requires an immutable `FindingsRegister`.

The current generator returns mutable objects and arrays. There is no freeze/deepFreeze step.

Required:

- freeze only newly created output structures;
- do not freeze/mutate caller-owned Acceptance/Results/Contract/Test Definition inputs;
- add immutability and input-purity tests.

### 8. Invalid generation result is not explicit

On Acceptance/Results provenance mismatch, the generator returns a register containing `PROVENANCE_CONFLICT`, but the register has no explicit generation validity state.

Add a small governed generation status such as:

- `VALID`;
- `INVALID_ACCEPTANCE_INTEGRITY`;
- `INVALID_PROVENANCE`.

Bind the status and generation issues into the register digest.

This prevents an invalid register carrying an original Acceptance verdict from looking like a normal generated register.

## Report wording mismatch

The current repo PM report says the generator signature includes `generatedAt` and `registerId`.

The live input is `generationTimestamp` and there is no caller `registerId`.

This is documentation drift only, but update the PM artefact when the correction gate closes.

## Decision

Do not start the final Evidence Package or Jira/Azure DevOps publication.

Complete:

**M4.0.1 — Findings Provenance Integrity & Zero-Invention Gate**

Then re-audit M4.0.
