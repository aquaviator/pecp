# M4.2.1 Completion Report — Export Semantic Integrity, Cryptographic Binding & Visualisation Fidelity Gate

**Status**: IMPLEMENTED & AUDIT-READY (Awaiting Formal PM Sign-off)  
**Date**: September 23, 2026  
**Work Package**: `docs/work-packages/M4_2_1_EXPORT_SEMANTIC_INTEGRITY_CRYPTOGRAPHIC_BINDING_VISUALISATION_FIDELITY_GATE.md`  
**Superceded/Blocked Document**: `docs/M4_2_CLOSURE.md` (invalidated by `docs/M4_2_PM_REVIEW.md`)

---

## 1. Summary of Removed Semantic Defaults & Fallbacks

All unauthorized defaults, fallbacks, coercions, and syntheses identified in `docs/M4_2_PM_REVIEW.md` have been systematically removed across the export engine:

1. **Results Report (`generateResultsReport`)**:
   - Removed synthetic unit `'orders'` and `'orders/second'` defaults. All units are now strictly nullable (`string | null`) representing governed presence or governed absence.
   - Removed synthetic zero rates (`0`) when workload demand or attainment is unmeasured or absent.
   - Removed synthetic scheduler population default (`'JOURNEY_ITERATION'`) and execution model default (`'OPEN'`) when not present in source test definitions or packages.
   - Removed synthesized acceptance verdict fallback (`'UNRESOLVED'` or `'INCONCLUSIVE'`). If source acceptance verdict is absent, `acceptanceVerdict` is `null`.
   - Replaced silent defaulting in human-readable projections (Markdown & HTML) with explicit governed absence indicators: `[GOVERNED ABSENCE]`.

2. **Defect Candidate Target Expressions (`generateDefectPayloads`)**:
   - Removed `Number(c.acceptanceCriterionReference.target)` numeric coercion.
   - Preserved target expression exactly as supplied: `string | null` (e.g. `'p95 < 2000ms'`).
   - Comparison semantics (`operator`, `thresholdValue`, `unit`) are projected into `expectedCriterion` without corrupting or mutating `target`.

3. **Source Verdict in Publication Bundle (`generatePublicationBundle`)**:
   - Removed synthetic fallback `evidencePackage.evidenceSummary?.acceptanceVerdict?.verdict ?? 'INCONCLUSIVE'`.
   - Now sets `sourceAcceptanceVerdict: evidencePackage.evidenceSummary?.acceptanceVerdict?.verdict`, strictly preserving `undefined` when absent.
   - Enforced that a `VALID` package requires an authoritative acceptance verdict, or publication readiness transitions to `BLOCKED_INVALID_SOURCE`.

---

## 2. Independent Verification Architecture for Supplied Objects

The export engine no longer trusts caller-supplied objects by reference alone; it cryptographically verifies all components against the authoritative Evidence Package before bundle generation:

1. **Findings Register Verification**:
   - Evaluates internal cryptographic integrity via `verifyFindingsRegisterDigest(findingsRegister)`. Any tampering of finding descriptions, classifications, defect candidates, or register digests immediately blocks publication with `BLOCKED_INVALID_SOURCE`.
   - Verifies canonical identity matching: `findingsRegister.id === packageComponent.canonicalId`. Mismatches trigger immediate block.
   - Verifies that defect candidate publication payloads are never generated from an unverified or tampered Findings Register.

2. **Test Definition Verification**:
   - Recomputes the canonical fingerprint using `computeTestDefinitionFingerprint(testDefinition)` and validates against `testDefinition.fingerprint`. Any drift in journeys, steps, schedules, or contract bindings immediately blocks publication.
   - Verifies that `testDefinition.version === packageComponent.version` and `testDefinition.id === packageComponent.canonicalId`.

3. **Performance Strategy & Test Plan Verification**:
   - Validates `sourceContractFingerprint` and `version` against the package components.
   - Marks Strategy or Test Plan export artifacts as ineligible (`publicationEligibility: false`) with explicit blocking reasons if the corresponding component in the evidence package is `STALE` or `SUPERSEDED`.
   - Sets `sourceFingerprint: null` for Strategy/Plan artifacts, avoiding false claims of artifact content fingerprinting.

---

## 3. Publication Bundle Digest Schema & Cryptographic Identity Model

The publication bundle digest schema has been hardened to `publication-bundle-v1`:

1. **Full Semantic Binding (`buildPublicationBundleDigestPayload`)**:
   - The bundle digest payload now includes:
     - `schemaVersion`: `'publication-bundle-v1'`
     - `sourceEvidencePackageId` and `sourceEvidencePackageDigest`
     - `sourceAcceptanceVerdict`: `string | null`
     - `overallReadiness`: `PublicationReadinessStatus`
     - `publicationReadiness`: sorted dictionary of per-destination readiness and blocking reasons
     - `artifacts`: sorted list of all export artifacts, binding `id`, `artifactType`, `format`, `mediaType`, `contentDigest`, `sourceId`, `sourceDigest`, `publicationEligibility`, `blockingReasons`, and deterministic `metadata`
     - `defectPayloads`: sorted list of defect payload digests (`buildDefectCandidateDigestPayload`)
   - Caller timestamp (`generatedAt`) remains strictly excluded from the digest calculation to maintain determinism.

2. **Bundle Verification Hardening (`verifyPublicationBundleDigest`)**:
   - Validates `bundleDigest.algorithm === 'SHA-256'`.
   - Validates `bundleDigest.schemaVersion === 'publication-bundle-v1'`.
   - Validates deterministic bundle ID derivation: `bundle.id === 'pub-' + bundleDigest.value.slice(0, 16)`.
   - Validates artifact content SHA-256 hashes against `contentDigest`.
   - Validates defect payload SHA-256 hashes against `payloadDigest` and verifies ID derivation: `defect.id === 'defect-' + digest.slice(0, 16)`.
   - Recomputes the overall bundle digest and reports any discrepancies in `mismatches`.

---

## 4. Visualisation Hook Contract & Schedule Fidelity

The load-test specific visualisation hook was refactored into a general governed schedule projector (`ResultsReportVisualisationHook`):

```typescript
export interface ResultsReportVisualisationHook {
  scheduler: {
    executionModel: string | null;
    population: string | null;
    rateUnit: string | null;
    startRate: number | null;
    peakArrivalRate: number | null;
  };
  businessTarget?: {
    metric: string;
    targetValue: number;
    unit: string;
    timeBasis?: string;
  };
  stages: Array<{
    stageIndex: number;
    name: string;
    durationSeconds: number;
    startTimeSeconds: number;
    endTimeSeconds: number;
    startArrivalRate: number;
    targetArrivalRate: number;
  }>;
  journeyDistribution: Array<{
    journeyId: string;
    journeyKey: string;
    name: string;
    percentage: number;
    weight: number;
    description?: string;
  }>;
}
```

### Fidelity Demonstrations
1. **Authoritative RetailCo**:
   - **Start Rate**: `0`
   - **Stage 1 (ramp-up)**: `0 -> 109.375 journey_iterations/s` over `0 -> 300s` (`300s`)
   - **Stage 2 (steady-state)**: `109.375 -> 109.375 journey_iterations/s` over `300 -> 1200s` (`900s`)
   - **Stage 3 (ramp-down)**: `109.375 -> 0 journey_iterations/s` over `1200 -> 1320s` (`120s`)
   - **Total Duration**: `1320s`
   - **Journey Mix**: Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%.
2. **Generic Two-Stage Schedule**: Non-zero start rate (e.g. `25 tx/s`), cumulative timing (`0 -> 200s`, `200 -> 600s`), preserved exactly.
3. **Multi-Stage Stress Schedule**: Stepped arrival targets (`100`, `200`, `300`) with cumulative stage boundaries (`0 -> 300`, `300 -> 600`, `600 -> 900s`) preserved without simplification.

---

## 5. Authoritative RetailCo Confirmation

The authoritative RetailCo benchmark run (`m31bAuthoritativeRunFixture.ts`) retains its canonical status and metrics exactly:

- **Evidence Package Status**: `VALID`
- **Acceptance Verdict**: `INCONCLUSIVE` (attributable to unresolved arrival rate attainment measurement)
- **Workload Attainment**: `WORKLOAD_ATTAINMENT_UNRESOLVED`
- **Business Workload Target**: `8.75 orders/second`
- **Peak Scheduler Demand**: `109.375 journey_iterations/second`
- **Scheduler Population**: `JOURNEY_ITERATION`
- **Execution Model**: `OPEN`
- **Schedule Stages**: `300s ramp-up` / `900s steady-state` / `120s ramp-down` (`1320s total`)
- **Checkout Response Time p95**: `0.3906885s` (`PASS`, threshold `2.0s`)
- **Global HTTP Error Rate**: `0%` (`PASS`, threshold `<= 1%`)
- **Defect Payloads**: Exactly `0` generated (authoritative RetailCo has zero failing criteria)
- **Publication Readiness**:
  - `DOWNLOAD`: `READY`
  - `API`: `READY`
  - Unconfigured external systems (`JIRA`, `AZURE_DEVOPS`, `CONFLUENCE`, `SHAREPOINT`): `BLOCKED_MISSING_DESTINATION_CONFIGURATION`

---

## 6. Test Inventory & CI Validation

- **Targeted Gate Suite**: `apps/web/src/__tests__/ExportPublicationContractM4_2.test.ts`
  - 18 comprehensive tests covering:
    - Authoritative RetailCo export output, readiness, and metrics preservation
    - Visualisation hook fidelity (start rate, stages, timings, journey mix)
    - Target string preservation (e.g. `'p95 < 2000ms'`)
    - Governed absence and absence of semantic defaults in audit-only reports
    - Independent cryptographic verification of FindingsRegister, TestDefinition, and Strategy
    - Detection of tampered artifact content, metadata, mediaType, and blocking reasons
    - Rejection of tampered bundle algorithms, schemas, IDs, and defect IDs
    - Semantic-field report digest tamper detection
    - Arbitrary multi-stage schedule projections
- **Monorepo Test Suite**:
  - **Test Files Passed**: 22 / 22
  - **Total Tests Passed**: 420 / 420
  - **Reference Lab Tests Passed**: 10 / 10
- **Linter**: Zero TypeScript errors (`tsc --noEmit` passed)
- **Build**: Vite production build succeeded (`npm run build`)

---

## 7. Closure & PM Review Statement

M4.2 is **NOT** prematurely marked as closed. Formal closure of M4.2 remains strictly subject to PM audit and sign-off against this M4.2.1 gate.
