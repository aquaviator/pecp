# PECP M4.3.1 Project Manager Review

## Verdict

**M4.3.1 — HOLD / NOT CLOSED**

The implementation is present on authoritative `master` at:

`56cebdfc9b6c3f8d8e71e65a1c8526c9e710d9c2`

However, the authoritative GitHub Actions CI run for that SHA failed during TypeScript typecheck, before unit tests and production build were executed.

Therefore the completion report cannot be accepted as VERIFIED and M4.3 cannot be closed yet.

## Authoritative CI evidence

Workflow: `CI`

Run ID:

`35974903027`

Job:

`Build, Lint & Test`

Job ID:

`107552970445`

Conclusion:

**FAILURE**

Step outcome:

- dependency install: PASS
- TypeScript typecheck: **FAIL**
- unit tests: SKIPPED
- production build: SKIPPED

The locally reported 462 Vitest + 10 Reference Lab result is useful development evidence, but the programme gate is authoritative remote CI.

## Blocking TypeScript errors

GitHub Actions reports the following compile blockers:

1. `AuthoritativeRetailCoDriftM4_3_1.test.ts`
   - imports `computeContractFingerprint` from `@pecp/test-engine`, but that member is not exported by the package;
   - accesses optional `metrics.iterations` without proving presence;
   - accesses optional `metrics.pecpBusinessAttainmentEvents` without proving presence.

2. `GenericProjectNonBleedM4_3_1.test.tsx`
   - imports `ExecutionEvidenceState` from `../types`, but the type is defined/exported from `services/interfaces/IExecutionEvidenceService`;
   - uses `organization` in `ProjectSummary`; the canonical field is `organisation`.

3. `EvidencePage.tsx`
   - reads `acceptanceEvaluation.workloadAttainmentStatus`, which does not exist on the canonical `AcceptanceEvaluation`;
   - the canonical field is `acceptanceEvaluation.workloadPrerequisite`.

4. `FindingsPage.tsx`
   - reads `CanonicalFinding.ineligibilityReason`, which does not exist;
   - the canonical source field available for deterministic explanation is `deterministicReason`.

5. `ResultsPage.tsx`
   - reads `referenceLabCorroboration.consistency.isConsistent`, while the canonical consistency shape exposes `countsMatch`;
   - reads `RawEvidenceArtifactSummary.runnerEngine`, while the interface exposes `k6Version`.

## PM assessment of the implementation direction

The implementation direction is materially aligned with M4.3.1:

- generic non-RetailCo bleed tests have been added;
- a RetailCo authority-drift suite has been added;
- EvidencePage has been moved toward dynamic component/lineage/readiness projection;
- chart relationship wording has been neutralised;
- TestDefinition schedule projection has been extracted from React;
- semantic fallback removal is visible in the changed portal code.

These are the correct corrections.

The present blocker is not a new semantic design problem. It is a contract/type fidelity failure introduced while implementing the gate.

## Required correction

Do **not** create M4.3.2.

Correct M4.3.1 in place.

Required actions:

1. Remove the invalid `computeContractFingerprint` import unless the test genuinely needs a supported canonical function.
2. Make drift assertions TypeScript-safe without inventing data:
   - explicitly assert/check optional canonical metric objects before accessing `.count`;
   - then compare exact values.
3. Import `ExecutionEvidenceState` from its actual service interface.
4. Change synthetic `ProjectSummary.organization` to canonical `organisation`.
5. Read workload state from `acceptanceEvaluation.workloadPrerequisite`.
6. Replace unsupported Finding `ineligibilityReason` access with canonical `deterministicReason`, or render governed absence if no applicable source reason exists.
7. Replace `isConsistent` with the canonical corroboration field `countsMatch`.
8. Use `rawArtifactSummary.k6Version` for runner version display.
9. Run:
   - `npm ci`
   - normal TypeScript typecheck
   - `npm test`
   - production build
10. Push the correction to `master` and wait for the normal GitHub `CI` workflow to complete successfully.

## Acceptance condition

M4.3.1 can return for PM audit only after a new implementation SHA has:

- GitHub Actions CI = SUCCESS;
- TypeScript = PASS;
- all M4.3.1 drift/non-bleed tests = PASS;
- full Vitest workspace = PASS;
- RetailCo Reference Lab = PASS;
- production build = PASS.

The semantic audit will then confirm the live remote files and close M4.3 if no material issue remains.

## Programme state

`M4.2 ✅ → M4.3 core implemented → M4.3.1 HOLD (remote CI/type-contract correction required)`
