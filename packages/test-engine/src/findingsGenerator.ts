// PECP Deterministic Findings & Defect Candidate Generator (M4.0)
// Defined according to docs/work-packages/M4_0_CANONICAL_FINDINGS_DEFECT_CANDIDATE_MODEL.md
// Invariant: Pure, deterministic findings generation outside the UI. Never invent root cause or severity.

import {
  AcceptanceEvaluation,
  CanonicalExecutionResult,
  PerformanceContract,
  TestDefinition,
  CanonicalFinding,
  DefectCandidate,
  FindingsRegister,
  FindingType,
  FindingClassification
} from '@pecp/pe-domain';
import { sha256Hex, computeFindingsRegisterDigest } from './fingerprint.js';

export interface GenerateFindingsInput {
  acceptanceEvaluation: AcceptanceEvaluation;
  results: CanonicalExecutionResult;
  contract?: PerformanceContract;
  testDefinition?: TestDefinition;
  generationTimestamp?: string;
}

/**
 * Computes deterministic SHA-256 digest and ID for a CanonicalFinding.
 */
function finalizeFinding(
  finding: Omit<CanonicalFinding, 'id' | 'findingDigest'>
): CanonicalFinding {
  const payload = {
    sourceAcceptanceEvaluationDigest: finding.sourceAcceptanceEvaluationDigest,
    sourceExecutionRunId: finding.sourceExecutionRunId,
    sourceContractFingerprint: finding.sourceContractFingerprint,
    sourceTestDefinitionFingerprint: finding.sourceTestDefinitionFingerprint,
    findingType: finding.findingType,
    classification: finding.classification,
    title: finding.title,
    factualDescription: finding.factualDescription,
    sourceCriterionId: finding.sourceCriterionId ?? null,
    observedValue: finding.observedValue ?? null,
    observedUnit: finding.observedUnit ?? null,
    canonicalThreshold: finding.canonicalThreshold ?? null,
    canonicalOperator: finding.canonicalOperator ?? null,
    canonicalUnit: finding.canonicalUnit ?? null,
    workloadPrerequisiteStatus: finding.workloadPrerequisiteStatus,
    evidenceSourcePaths: [...finding.evidenceSourcePaths].sort(),
    governedObservationId: finding.governedObservationId ?? null,
    defectEligibility: finding.defectEligibility,
    deterministicReason: finding.deterministicReason,
    severity: finding.severity ?? null
  };

  const digest = sha256Hex(JSON.stringify(payload));
  return {
    ...finding,
    id: `finding-${digest.slice(0, 16)}`,
    findingDigest: digest
  };
}

/**
 * Computes deterministic SHA-256 digest and ID for a DefectCandidate.
 */
function finalizeDefectCandidate(
  candidate: Omit<DefectCandidate, 'id' | 'candidateDigest'>
): DefectCandidate {
  const payload = {
    sourceFindingId: candidate.sourceFindingId,
    title: candidate.title,
    factualProblemStatement: candidate.factualProblemStatement,
    acceptanceCriterionReference: candidate.acceptanceCriterionReference,
    observedEvidenceSummary: candidate.observedEvidenceSummary,
    expectedGovernedCriterion: candidate.expectedGovernedCriterion,
    executionRunReference: candidate.executionRunReference,
    evidenceReferences: [...candidate.evidenceReferences].sort(),
    publicationEligibility: candidate.publicationEligibility,
    blockingReasonsToPublication: [...candidate.blockingReasonsToPublication].sort()
  };

  const digest = sha256Hex(JSON.stringify(payload));
  return {
    ...candidate,
    id: `candidate-${digest.slice(0, 16)}`,
    candidateDigest: digest
  };
}

/**
 * Generates canonical findings and defect candidates from a closed AcceptanceEvaluation
 * and its canonical Results evidence.
 *
 * Invariants:
 * 1. Provenance and execution identity between evaluation and results must match.
 * 2. FAIL creates performance findings and defect candidates only under ATTAINED workload.
 * 3. INCONCLUSIVE never creates SUT performance defects.
 * 4. PASS generates zero findings.
 * 5. PASS_WITH_OBSERVATION generates non-blocking observation findings only (zero defects).
 * 6. Never invent root cause, severity, priority, or ticket management state.
 */
export function generateFindings(input: GenerateFindingsInput): FindingsRegister {
  const { acceptanceEvaluation, results, generationTimestamp } = input;

  const generatedAt =
    generationTimestamp ??
    acceptanceEvaluation.evaluatedAt ??
    results.run.timestamps.completedAt;

  // 1. Evidence and Provenance Validation (§5)
  const provenanceErrors: string[] = [];

  if (acceptanceEvaluation.sourceExecutionRunId !== results.run.executionRunId) {
    provenanceErrors.push(
      `Execution run ID mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.sourceExecutionRunId}', but Results contains '${results.run.executionRunId}'.`
    );
  }

  if (
    results.run.sourceContract?.fingerprint &&
    results.run.sourceContract.fingerprint !== acceptanceEvaluation.sourceContract.fingerprint
  ) {
    provenanceErrors.push(
      `Contract fingerprint mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.sourceContract.fingerprint}', but Results references '${results.run.sourceContract.fingerprint}'.`
    );
  }

  if (
    results.run.testDefinition?.fingerprint &&
    results.run.testDefinition.fingerprint !== acceptanceEvaluation.testDefinition.fingerprint
  ) {
    provenanceErrors.push(
      `Test Definition fingerprint mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.testDefinition.fingerprint}', but Results references '${results.run.testDefinition.fingerprint}'.`
    );
  }

  // If provenance between evaluation and results is conflicting, yield a PROVENANCE_CONFLICT register
  if (provenanceErrors.length > 0) {
    const conflictFindings: CanonicalFinding[] = provenanceErrors.map((errMsg) =>
      finalizeFinding({
        findingType: 'PROVENANCE_CONFLICT',
        classification: 'GOVERNANCE',
        status: 'OPEN',
        title: 'Findings Generation Provenance Conflict',
        factualDescription: errMsg,
        sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
        sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
        sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
        sourceContractId: acceptanceEvaluation.sourceContract.id,
        sourceContractVersion: acceptanceEvaluation.sourceContract.version,
        sourceContractFingerprint: acceptanceEvaluation.sourceContract.fingerprint,
        sourceTestDefinitionId: acceptanceEvaluation.testDefinition.id,
        sourceTestDefinitionVersion: acceptanceEvaluation.testDefinition.version,
        sourceTestDefinitionFingerprint: acceptanceEvaluation.testDefinition.fingerprint,
        workloadPrerequisiteStatus: acceptanceEvaluation.workloadPrerequisite.status,
        evidenceSourcePaths: [],
        defectEligibility: false,
        deterministicReason: 'Acceptance Evaluation and Execution Results have mismatched provenance.'
      })
    );

    const sortedConflictFindings = conflictFindings.sort((a, b) => a.id.localeCompare(b.id));

    const regDigestPayload = {
      sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
      sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
      overallVerdict: acceptanceEvaluation.overallVerdict,
      findings: sortedConflictFindings.map((f) => f.findingDigest),
      defectCandidates: []
    };

    const regDigest = computeFindingsRegisterDigest(regDigestPayload);

    return {
      id: `findings-reg-${regDigest.value.slice(0, 16)}`,
      sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
      sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
      overallVerdict: acceptanceEvaluation.overallVerdict,
      findings: sortedConflictFindings,
      defectCandidates: [],
      registerDigest: regDigest,
      generatedAt
    };
  }

  const rawFindings: CanonicalFinding[] = [];
  const rawDefectCandidates: DefectCandidate[] = [];

  // Helper to construct base finding provenance fields
  const baseProvenance = {
    sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
    sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
    sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
    sourceContractId: acceptanceEvaluation.sourceContract.id,
    sourceContractVersion: acceptanceEvaluation.sourceContract.version,
    sourceContractFingerprint: acceptanceEvaluation.sourceContract.fingerprint,
    sourceTestDefinitionId: acceptanceEvaluation.testDefinition.id,
    sourceTestDefinitionVersion: acceptanceEvaluation.testDefinition.version,
    sourceTestDefinitionFingerprint: acceptanceEvaluation.testDefinition.fingerprint,
    workloadPrerequisiteStatus: acceptanceEvaluation.workloadPrerequisite.status
  };

  const overallVerdict = acceptanceEvaluation.overallVerdict;

  // -------------------------------------------------------------------------
  // Case A: PASS (§1)
  // -------------------------------------------------------------------------
  if (overallVerdict === 'PASS') {
    // PASS does not manufacture findings. Return empty collection.
  }

  // -------------------------------------------------------------------------
  // Case B: PASS_WITH_OBSERVATION (§10)
  // -------------------------------------------------------------------------
  else if (overallVerdict === 'PASS_WITH_OBSERVATION') {
    for (const obs of acceptanceEvaluation.governedObservations) {
      if (!obs.isBlocking) {
        rawFindings.push(
          finalizeFinding({
            ...baseProvenance,
            findingType: 'NON_BLOCKING_OBSERVATION',
            classification: 'OBSERVATION',
            status: 'OPEN',
            title: `Governed Observation: ${obs.id} (${obs.source})`,
            factualDescription: obs.description,
            governedObservationId: obs.id,
            severity: typeof obs.severity === 'string' ? obs.severity : undefined,
            evidenceSourcePaths: obs.provenanceReference ? [obs.provenanceReference] : [],
            defectEligibility: false,
            deterministicReason: `Non-blocking observation recorded during governed evaluation: ${obs.description}`
          })
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Case C: INCONCLUSIVE (§7, §8, §9)
  // Invariant: Never create an SUT performance defect from inconclusive results!
  // -------------------------------------------------------------------------
  else if (overallVerdict === 'INCONCLUSIVE') {
    // 1. Provenance Gate issues
    if (!acceptanceEvaluation.provenanceGate.isValid) {
      for (const reason of acceptanceEvaluation.provenanceGate.reasons) {
        rawFindings.push(
          finalizeFinding({
            ...baseProvenance,
            findingType: 'PROVENANCE_CONFLICT',
            classification: 'GOVERNANCE',
            status: 'OPEN',
            title: 'Acceptance Provenance Gate Conflict',
            factualDescription: reason,
            evidenceSourcePaths: [],
            defectEligibility: false,
            deterministicReason: `Acceptance provenance gate failed: ${reason}`
          })
        );
      }
    }

    // 2. Operational Integrity Gate issues
    if (!acceptanceEvaluation.operationalIntegrityGate.isValid) {
      for (const reason of acceptanceEvaluation.operationalIntegrityGate.reasons) {
        rawFindings.push(
          finalizeFinding({
            ...baseProvenance,
            findingType: 'EXECUTION_INTEGRITY_ISSUE',
            classification: 'EXECUTION_VALIDITY',
            status: 'OPEN',
            title: 'Acceptance Operational Integrity Issue',
            factualDescription: reason,
            evidenceSourcePaths: [],
            defectEligibility: false,
            deterministicReason: `Acceptance operational integrity gate failed: ${reason}`
          })
        );
      }
    }

    // 3. Workload Prerequisite issues
    const workloadPrereq = acceptanceEvaluation.workloadPrerequisite;
    if (workloadPrereq.status === 'UNRESOLVED') {
      rawFindings.push(
        finalizeFinding({
          ...baseProvenance,
          findingType: 'WORKLOAD_ATTAINMENT_UNRESOLVED',
          classification: 'GOVERNANCE',
          status: 'OPEN',
          title: 'Workload Demand Attainment Unresolved',
          factualDescription: `Governed steady-state workload attainment could not be proven from available time-sliced evidence. Observed rationale: ${workloadPrereq.rationale}`,
          observedValue: workloadPrereq.observedValue,
          observedUnit: workloadPrereq.unit,
          canonicalThreshold: workloadPrereq.targetValue,
          canonicalUnit: workloadPrereq.unit,
          evidenceSourcePaths: results.evidenceInventory?.summaryJson?.sourceLocator
            ? [results.evidenceInventory.summaryJson.sourceLocator]
            : results.evidenceInventory?.summaryJson?.filename
              ? [results.evidenceInventory.summaryJson.filename]
              : [],
          defectEligibility: false,
          deterministicReason:
            'Workload prerequisite is unresolved; evaluation cannot determine whether SUT met governed requirements under required demand.'
        })
      );
    } else if (workloadPrereq.status === 'NOT_ATTAINED') {
      rawFindings.push(
        finalizeFinding({
          ...baseProvenance,
          findingType: 'WORKLOAD_NOT_ATTAINED',
          classification: 'EXECUTION_VALIDITY',
          status: 'OPEN',
          title: 'Governed Workload Not Attained',
          factualDescription: `Governed workload was not attained during test execution. ${workloadPrereq.rationale}`,
          observedValue: workloadPrereq.observedValue,
          observedUnit: workloadPrereq.unit,
          canonicalThreshold: workloadPrereq.targetValue,
          canonicalUnit: workloadPrereq.unit,
          evidenceSourcePaths: results.evidenceInventory?.summaryJson?.sourceLocator
            ? [results.evidenceInventory.summaryJson.sourceLocator]
            : results.evidenceInventory?.summaryJson?.filename
              ? [results.evidenceInventory.summaryJson.filename]
              : [],
          defectEligibility: false,
          deterministicReason:
            'Governed workload prerequisite not attained; SUT performance under specified demand remains unproven.'
        })
      );
    } else if (workloadPrereq.status === 'INVALID') {
      rawFindings.push(
        finalizeFinding({
          ...baseProvenance,
          findingType: 'WORKLOAD_EVIDENCE_INVALID',
          classification: 'EVIDENCE_QUALITY',
          status: 'OPEN',
          title: 'Workload Attainment Evidence Invalid',
          factualDescription: `Workload attainment evidence is invalid: ${workloadPrereq.rationale}`,
          observedValue: workloadPrereq.observedValue,
          observedUnit: workloadPrereq.unit,
          canonicalThreshold: workloadPrereq.targetValue,
          canonicalUnit: workloadPrereq.unit,
          evidenceSourcePaths: results.evidenceInventory?.summaryJson?.sourceLocator
            ? [results.evidenceInventory.summaryJson.sourceLocator]
            : results.evidenceInventory?.summaryJson?.filename
              ? [results.evidenceInventory.summaryJson.filename]
              : [],
          defectEligibility: false,
          deterministicReason: 'Workload attainment evidence violates validity rules.'
        })
      );
    }

    // 4. Criteria with NOT_EVALUABLE status
    for (const c of acceptanceEvaluation.criterionEvaluations) {
      if (c.status === 'NOT_EVALUABLE') {
        rawFindings.push(
          finalizeFinding({
            ...baseProvenance,
            findingType: 'CRITERION_NOT_EVALUABLE',
            classification: 'EVIDENCE_QUALITY',
            status: 'OPEN',
            title: `Acceptance Criterion Not Evaluable: ${c.key}`,
            factualDescription: `Criterion ${c.key} (${c.metric}, scope: ${c.scope}) could not be evaluated against results evidence. Rationale: ${c.deterministicRationale}`,
            sourceCriterionId: c.criterionId,
            canonicalThreshold: c.canonicalThresholdValue,
            canonicalOperator: c.operator,
            canonicalUnit: c.canonicalUnit,
            evidenceSourcePaths: c.evidenceSourcePath ? [c.evidenceSourcePath] : [],
            defectEligibility: false,
            deterministicReason: `Evidence was insufficient or incompatible to evaluate criterion ${c.key}.`
          })
        );
      }
    }

    // 5. Corroborating threshold conflict / semantic drift
    for (const c of acceptanceEvaluation.criterionEvaluations) {
      const matchingVerdictConflict = acceptanceEvaluation.verdictReasons.find(
        (r) =>
          r.includes(c.criterionId) &&
          (r.includes('Threshold expression semantics drift') ||
            r.includes('Corroboration conflict') ||
            r.includes('internal contradiction') ||
            r.includes('semantics drift'))
      );

      if (
        c.corroboratingEngineThreshold?.agreesWithEngine === false ||
        c.corroboratingEngineThreshold?.status === 'SEMANTIC_DRIFT' ||
        Boolean(matchingVerdictConflict)
      ) {
        rawFindings.push(
          finalizeFinding({
            ...baseProvenance,
            findingType: 'THRESHOLD_CORROBORATION_CONFLICT',
            classification: 'EVIDENCE_QUALITY',
            status: 'OPEN',
            title: `Threshold Corroboration Conflict: ${c.key}`,
            factualDescription:
              matchingVerdictConflict ??
              `Corroborating engine threshold conflict for ${c.key}: independent evaluation contradicts engine threshold status.`,
            sourceCriterionId: c.criterionId,
            canonicalThreshold: c.canonicalThresholdValue,
            canonicalOperator: c.operator,
            canonicalUnit: c.canonicalUnit,
            evidenceSourcePaths: c.evidenceSourcePath ? [c.evidenceSourcePath] : [],
            defectEligibility: false,
            deterministicReason:
              'Observed engine threshold definition diverges semantically or contradicts canonical criterion expectation.'
          })
        );
      }
    }

    // 6. Blocking Governed Observations
    for (const obs of acceptanceEvaluation.governedObservations) {
      if (obs.isBlocking) {
        rawFindings.push(
          finalizeFinding({
            ...baseProvenance,
            findingType: 'BLOCKING_GOVERNED_OBSERVATION',
            classification: 'EXECUTION_VALIDITY',
            status: 'OPEN',
            title: `Blocking Governed Observation: ${obs.id} (${obs.source})`,
            factualDescription: obs.description,
            governedObservationId: obs.id,
            severity: typeof obs.severity === 'string' ? obs.severity : undefined,
            evidenceSourcePaths: obs.provenanceReference ? [obs.provenanceReference] : [],
            defectEligibility: false,
            deterministicReason: `Blocking observation forced acceptance evaluation to INCONCLUSIVE: ${obs.description}`
          })
        );
      }
    }

    // 7. Fallback if no specific finding was generated yet verdict is INCONCLUSIVE
    if (rawFindings.length === 0) {
      const summaryReason =
        acceptanceEvaluation.verdictReasons.length > 0
          ? acceptanceEvaluation.verdictReasons.join('; ')
          : 'Evaluation inconclusive due to unspecified acceptance condition.';
      rawFindings.push(
        finalizeFinding({
          ...baseProvenance,
          findingType: 'EXECUTION_INTEGRITY_ISSUE',
          classification: 'GOVERNANCE',
          status: 'OPEN',
          title: 'Acceptance Evaluation Inconclusive',
          factualDescription: summaryReason,
          evidenceSourcePaths: [],
          defectEligibility: false,
          deterministicReason: summaryReason
        })
      );
    }
  }

  // -------------------------------------------------------------------------
  // Case D: FAIL (§1, §6, §11)
  // Invariant: Performance criterion failure findings and defect candidates
  // are created ONLY when governed workload was ATTAINED and gates are valid.
  // -------------------------------------------------------------------------
  else if (overallVerdict === 'FAIL') {
    const isWorkloadAttained = acceptanceEvaluation.workloadPrerequisite.status === 'ATTAINED';

    if (isWorkloadAttained) {
      for (const c of acceptanceEvaluation.criterionEvaluations) {
        if (c.status === 'FAIL') {
          const finding = finalizeFinding({
            ...baseProvenance,
            findingType: 'PERFORMANCE_CRITERION_FAILURE',
            classification: 'PERFORMANCE',
            status: 'OPEN',
            title: `Performance Criterion Failure: ${c.key}`,
            factualDescription: `Criterion ${c.key} (${c.metric}, scope: ${c.scope}) observed ${c.observedValue} ${c.observedUnit ?? ''} against governed requirement ${c.operator ?? ''} ${c.canonicalThresholdValue ?? ''} ${c.canonicalUnit ?? ''}.`,
            sourceCriterionId: c.criterionId,
            observedValue: c.observedValue,
            observedUnit: c.observedUnit,
            canonicalThreshold: c.canonicalThresholdValue,
            canonicalOperator: c.operator,
            canonicalUnit: c.canonicalUnit,
            evidenceSourcePaths: c.evidenceSourcePath ? [c.evidenceSourcePath] : [],
            defectEligibility: true,
            deterministicReason: `Governed acceptance criterion failed under attained workload: ${c.deterministicRationale}`
          });

          rawFindings.push(finding);

          // Generate corresponding DefectCandidate (§3)
          const candidate = finalizeDefectCandidate({
            sourceFindingId: finding.id,
            title: `Performance Defect Candidate: ${c.key}`,
            factualProblemStatement: finding.factualDescription,
            acceptanceCriterionReference: {
              criterionId: c.criterionId,
              metric: c.metric,
              scope: c.scope,
              target: c.key
            },
            observedEvidenceSummary: {
              observedValue: c.observedValue ?? 0,
              observedUnit: c.observedUnit ?? '',
              evidenceSourcePath: c.evidenceSourcePath
            },
            expectedGovernedCriterion: {
              target: c.key,
              operator: c.operator ?? '<',
              thresholdValue: c.canonicalThresholdValue ?? 0,
              unit: c.canonicalUnit ?? ''
            },
            executionRunReference: {
              executionRunId: acceptanceEvaluation.sourceExecutionRunId,
              completedAt: acceptanceEvaluation.evaluatedAt ?? results.run.timestamps.completedAt
            },
            evidenceReferences: c.evidenceSourcePath ? [c.evidenceSourcePath] : [],
            publicationEligibility: true,
            blockingReasonsToPublication: []
          });

          rawDefectCandidates.push(candidate);
        }
      }
    }
  }

  // Deterministic sorting of findings and defect candidates
  const findings = rawFindings.sort((a, b) => {
    if (a.findingType !== b.findingType) {
      return a.findingType.localeCompare(b.findingType);
    }
    const keyA = a.sourceCriterionId ?? a.governedObservationId ?? a.id;
    const keyB = b.sourceCriterionId ?? b.governedObservationId ?? b.id;
    return keyA.localeCompare(keyB);
  });

  const defectCandidates = rawDefectCandidates.sort((a, b) => {
    const critA = a.acceptanceCriterionReference.criterionId;
    const critB = b.acceptanceCriterionReference.criterionId;
    if (critA !== critB) {
      return critA.localeCompare(critB);
    }
    return a.id.localeCompare(b.id);
  });

  // Cryptographic binding of FindingsRegister (§13)
  const registerPayload = {
    sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
    sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
    sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
    overallVerdict: acceptanceEvaluation.overallVerdict,
    findings: findings.map((f) => f.findingDigest),
    defectCandidates: defectCandidates.map((d) => d.candidateDigest)
  };

  const registerDigest = computeFindingsRegisterDigest(registerPayload);

  return {
    id: `findings-reg-${registerDigest.value.slice(0, 16)}`,
    sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
    sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
    sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
    overallVerdict: acceptanceEvaluation.overallVerdict,
    findings,
    defectCandidates,
    registerDigest,
    generatedAt
  };
}
