// PECP Deterministic Findings & Defect Candidate Generator (M4.0 / M4.0.1)
// Defined according to docs/work-packages/M4_0_1_FINDINGS_PROVENANCE_INTEGRITY_ZERO_INVENTION_GATE.md
// Invariants:
// 1. Pure, deterministic findings generation outside the UI. Never invent root cause or severity.
// 2. Acceptance Evaluation SHA-256 digest integrity must be recomputed and verified.
// 3. Strict provenance validation between Acceptance, Results, Contract, and Test Definition.
// 4. Zero Defect Candidate fallback invention.
// 5. Returned FindingsRegister is deep-frozen without side effects on caller inputs.

import {
  AcceptanceEvaluation,
  CanonicalExecutionResult,
  PerformanceContract,
  TestDefinition,
  CanonicalFinding,
  DefectCandidate,
  FindingsRegister,
  FindingsGenerationStatus,
  computeContractFingerprint
} from '@pecp/pe-domain';
import {
  sha256Hex,
  computeFindingsRegisterDigest,
  computeTestDefinitionFingerprint
} from './fingerprint.js';
import { verifyAcceptanceEvaluationDigest } from './acceptanceEngine.js';

export interface GenerateFindingsInput {
  acceptanceEvaluation: AcceptanceEvaluation;
  results: CanonicalExecutionResult;
  contract?: PerformanceContract;
  testDefinition?: TestDefinition;
  generationTimestamp?: string;
}

/**
 * Deep freezes an object and its children to enforce immutability without mutating caller inputs.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Builds deterministic digest payload for a CanonicalFinding.
 */
export function computeCanonicalFindingDigestPayload(
  finding: CanonicalFinding | Omit<CanonicalFinding, 'id' | 'findingDigest'>
) {
  return {
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
}

/**
 * Computes deterministic SHA-256 digest string for a CanonicalFinding.
 */
export function computeCanonicalFindingDigest(
  finding: CanonicalFinding | Omit<CanonicalFinding, 'id' | 'findingDigest'>
): string {
  const payload = computeCanonicalFindingDigestPayload(finding);
  return sha256Hex(JSON.stringify(payload));
}

/**
 * Computes deterministic SHA-256 digest and ID for a CanonicalFinding.
 */
function finalizeFinding(
  finding: Omit<CanonicalFinding, 'id' | 'findingDigest'>
): CanonicalFinding {
  const digest = computeCanonicalFindingDigest(finding);
  return {
    ...finding,
    id: `finding-${digest.slice(0, 16)}`,
    findingDigest: digest
  };
}

/**
 * Builds deterministic digest payload for a DefectCandidate.
 */
export function computeDefectCandidateDigestPayload(
  candidate: DefectCandidate | Omit<DefectCandidate, 'id' | 'candidateDigest'>
) {
  return {
    sourceFindingId: candidate.sourceFindingId,
    title: candidate.title,
    factualProblemStatement: candidate.factualProblemStatement,
    acceptanceCriterionReference: {
      criterionId: candidate.acceptanceCriterionReference.criterionId,
      metric: candidate.acceptanceCriterionReference.metric,
      scope: candidate.acceptanceCriterionReference.scope,
      target: candidate.acceptanceCriterionReference.target ?? null
    },
    observedEvidenceSummary: {
      observedValue: candidate.observedEvidenceSummary.observedValue,
      observedUnit: candidate.observedEvidenceSummary.observedUnit,
      evidenceSourcePath: candidate.observedEvidenceSummary.evidenceSourcePath ?? null
    },
    expectedGovernedCriterion: {
      target: candidate.expectedGovernedCriterion.target ?? null,
      operator: candidate.expectedGovernedCriterion.operator,
      thresholdValue: candidate.expectedGovernedCriterion.thresholdValue,
      unit: candidate.expectedGovernedCriterion.unit
    },
    executionRunReference: candidate.executionRunReference,
    evidenceReferences: [...candidate.evidenceReferences].sort(),
    publicationEligibility: candidate.publicationEligibility,
    blockingReasonsToPublication: [...candidate.blockingReasonsToPublication].sort()
  };
}

/**
 * Computes deterministic SHA-256 digest string for a DefectCandidate.
 */
export function computeDefectCandidateDigest(
  candidate: DefectCandidate | Omit<DefectCandidate, 'id' | 'candidateDigest'>
): string {
  const payload = computeDefectCandidateDigestPayload(candidate);
  return sha256Hex(JSON.stringify(payload));
}

/**
 * Computes deterministic SHA-256 digest and ID for a DefectCandidate.
 * Invariant: Never contains fallback substituted values.
 */
function finalizeDefectCandidate(
  candidate: Omit<DefectCandidate, 'id' | 'candidateDigest'>
): DefectCandidate {
  const digest = computeDefectCandidateDigest(candidate);
  return {
    ...candidate,
    id: `candidate-${digest.slice(0, 16)}`,
    candidateDigest: digest
  };
}

export interface VerifyFindingsRegisterDigestResult {
  isValid: boolean;
  recomputedDigest: string;
  expectedDigest?: string;
  error?: string;
}

/**
 * Builds normalized payload for FindingsRegister digest computation.
 */
export function buildFindingsRegisterDigestPayload(register: FindingsRegister) {
  return {
    sourceAcceptanceEvaluationId: register.sourceAcceptanceEvaluationId,
    sourceAcceptanceEvaluationDigest: register.sourceAcceptanceEvaluationDigest,
    sourceExecutionRunId: register.sourceExecutionRunId,
    overallVerdict: register.overallVerdict,
    generationStatus: register.generationStatus,
    generationIssues: [...(register.generationIssues || [])].sort(),
    findings: (register.findings || []).map((f) => f.findingDigest),
    defectCandidates: (register.defectCandidates || []).map((d) => d.candidateDigest)
  };
}

/**
 * Recomputes and verifies the cryptographic integrity of a FindingsRegister,
 * including all individual findings and defect candidates.
 */
export function verifyFindingsRegisterDigest(
  register: FindingsRegister
): VerifyFindingsRegisterDigestResult {
  if (!register) {
    return {
      isValid: false,
      recomputedDigest: '',
      error: 'Findings register is null or undefined.'
    };
  }

  if (!register.registerDigest) {
    return {
      isValid: false,
      recomputedDigest: '',
      error: 'Findings register missing registerDigest object.'
    };
  }

  if (register.registerDigest.algorithm !== 'SHA-256') {
    return {
      isValid: false,
      recomputedDigest: '',
      expectedDigest: register.registerDigest.value,
      error: `Unsupported digest algorithm: '${register.registerDigest.algorithm}'. Expected 'SHA-256'.`
    };
  }

  if (register.registerDigest.schemaVersion !== 'findings-register-v1') {
    return {
      isValid: false,
      recomputedDigest: '',
      expectedDigest: register.registerDigest.value,
      error: `Unsupported digest schemaVersion: '${register.registerDigest.schemaVersion}'. Expected 'findings-register-v1'.`
    };
  }

  // Verify individual findings digests
  if (Array.isArray(register.findings)) {
    for (const finding of register.findings) {
      if (!finding.findingDigest) {
        return {
          isValid: false,
          recomputedDigest: '',
          expectedDigest: register.registerDigest.value,
          error: `Finding '${finding.id}' is missing findingDigest.`
        };
      }
      const recomputedFindingDigest = computeCanonicalFindingDigest(finding);
      if (recomputedFindingDigest !== finding.findingDigest) {
        return {
          isValid: false,
          recomputedDigest: '',
          expectedDigest: register.registerDigest.value,
          error: `Finding '${finding.id}' digest mismatch: recomputed '${recomputedFindingDigest}' does not match stored '${finding.findingDigest}'.`
        };
      }
      const expectedFindingId = `finding-${recomputedFindingDigest.slice(0, 16)}`;
      if (finding.id !== expectedFindingId) {
        return {
          isValid: false,
          recomputedDigest: '',
          expectedDigest: register.registerDigest.value,
          error: `Finding ID mismatch: '${finding.id}' does not match expected '${expectedFindingId}'.`
        };
      }
    }
  }

  // Verify individual defect candidates digests
  if (Array.isArray(register.defectCandidates)) {
    for (const candidate of register.defectCandidates) {
      if (!candidate.candidateDigest) {
        return {
          isValid: false,
          recomputedDigest: '',
          expectedDigest: register.registerDigest.value,
          error: `Defect candidate '${candidate.id}' is missing candidateDigest.`
        };
      }
      const recomputedCandidateDigest = computeDefectCandidateDigest(candidate);
      if (recomputedCandidateDigest !== candidate.candidateDigest) {
        return {
          isValid: false,
          recomputedDigest: '',
          expectedDigest: register.registerDigest.value,
          error: `Defect candidate '${candidate.id}' digest mismatch: recomputed '${recomputedCandidateDigest}' does not match stored '${candidate.candidateDigest}'.`
        };
      }
      const expectedCandidateId = `candidate-${recomputedCandidateDigest.slice(0, 16)}`;
      if (candidate.id !== expectedCandidateId) {
        return {
          isValid: false,
          recomputedDigest: '',
          expectedDigest: register.registerDigest.value,
          error: `Defect candidate ID mismatch: '${candidate.id}' does not match expected '${expectedCandidateId}'.`
        };
      }
    }
  }

  try {
    const payload = buildFindingsRegisterDigestPayload(register);
    const recomputed = computeFindingsRegisterDigest(payload).value;

    if (recomputed !== register.registerDigest.value) {
      return {
        isValid: false,
        recomputedDigest: recomputed,
        expectedDigest: register.registerDigest.value,
        error: `Findings register digest mismatch: recomputed '${recomputed}' does not match stored '${register.registerDigest.value}'.`
      };
    }

    const expectedRegisterId = `findings-reg-${recomputed.slice(0, 16)}`;
    if (register.id && register.id !== expectedRegisterId) {
      return {
        isValid: false,
        recomputedDigest: recomputed,
        expectedDigest: register.registerDigest.value,
        error: `Findings register ID mismatch: '${register.id}' does not match expected '${expectedRegisterId}'.`
      };
    }

    return {
      isValid: true,
      recomputedDigest: recomputed,
      expectedDigest: register.registerDigest.value
    };
  } catch (err) {
    return {
      isValid: false,
      recomputedDigest: '',
      expectedDigest: register.registerDigest.value,
      error: `Failed to recompute findings register digest: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Generates canonical findings and defect candidates from a closed AcceptanceEvaluation
 * and its canonical Results evidence according to M4.0 and M4.0.1.
 */
export function generateFindings(input: GenerateFindingsInput): FindingsRegister {
  const { acceptanceEvaluation, results, contract, testDefinition, generationTimestamp } = input;

  const generatedAt =
    generationTimestamp ??
    acceptanceEvaluation?.evaluatedAt ??
    results?.run?.timestamps?.completedAt;

  // -------------------------------------------------------------------------
  // 1. Acceptance Evaluation SHA-256 Digest Verification (§1, §4)
  // -------------------------------------------------------------------------
  const digestVerification = verifyAcceptanceEvaluationDigest(acceptanceEvaluation);
  if (!digestVerification.isValid) {
    const errorMsg =
      digestVerification.error ?? 'Acceptance Evaluation cryptographic digest verification failed.';
    const generationIssues = [errorMsg];
    const generationStatus: FindingsGenerationStatus = 'INVALID_ACCEPTANCE_INTEGRITY';

    const conflictFinding = finalizeFinding({
      findingType: 'PROVENANCE_CONFLICT',
      classification: 'GOVERNANCE',
      status: 'OPEN',
      title: 'Acceptance Evaluation Integrity Conflict',
      factualDescription: errorMsg,
      sourceAcceptanceEvaluationId: acceptanceEvaluation?.id ?? 'unknown',
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation?.evaluationDigest?.value ?? 'unknown',
      sourceExecutionRunId: acceptanceEvaluation?.sourceExecutionRunId ?? results?.run?.executionRunId ?? 'unknown',
      sourceContractId: acceptanceEvaluation?.sourceContract?.id ?? results?.run?.sourceContract?.id ?? 'unknown',
      sourceContractVersion: acceptanceEvaluation?.sourceContract?.version ?? results?.run?.sourceContract?.version ?? 'unknown',
      sourceContractFingerprint: acceptanceEvaluation?.sourceContract?.fingerprint ?? results?.run?.sourceContract?.fingerprint ?? 'unknown',
      sourceTestDefinitionId: acceptanceEvaluation?.testDefinition?.id ?? results?.run?.testDefinition?.id ?? 'unknown',
      sourceTestDefinitionVersion: acceptanceEvaluation?.testDefinition?.version ?? results?.run?.testDefinition?.version ?? 'unknown',
      sourceTestDefinitionFingerprint: acceptanceEvaluation?.testDefinition?.fingerprint ?? results?.run?.testDefinition?.fingerprint ?? 'unknown',
      workloadPrerequisiteStatus: acceptanceEvaluation?.workloadPrerequisite?.status ?? 'INVALID',
      evidenceSourcePaths: [],
      defectEligibility: false,
      deterministicReason:
        'Acceptance Evaluation digest does not match recomputed SHA-256 digest or algorithm/schema is invalid.'
    });

    const regDigestPayload = {
      sourceAcceptanceEvaluationId: acceptanceEvaluation?.id ?? 'unknown',
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation?.evaluationDigest?.value ?? 'unknown',
      sourceExecutionRunId: acceptanceEvaluation?.sourceExecutionRunId ?? results?.run?.executionRunId ?? 'unknown',
      overallVerdict: acceptanceEvaluation?.overallVerdict ?? 'INCONCLUSIVE',
      generationStatus,
      generationIssues: [...generationIssues].sort(),
      findings: [conflictFinding.findingDigest],
      defectCandidates: []
    };

    const regDigest = computeFindingsRegisterDigest(regDigestPayload);

    const register: FindingsRegister = {
      id: `findings-reg-${regDigest.value.slice(0, 16)}`,
      sourceAcceptanceEvaluationId: acceptanceEvaluation?.id ?? 'unknown',
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation?.evaluationDigest?.value ?? 'unknown',
      sourceExecutionRunId: acceptanceEvaluation?.sourceExecutionRunId ?? results?.run?.executionRunId ?? 'unknown',
      overallVerdict: acceptanceEvaluation?.overallVerdict ?? 'INCONCLUSIVE',
      generationStatus,
      generationIssues,
      findings: [conflictFinding],
      defectCandidates: [],
      registerDigest: regDigest,
      generatedAt
    };

    return deepFreeze(register);
  }

  // -------------------------------------------------------------------------
  // 2. Strict Full Provenance Validation (§2, §3, §4)
  // -------------------------------------------------------------------------
  const provenanceErrors: string[] = [];

  // 2.1 Execution Run ID
  if (acceptanceEvaluation.sourceExecutionRunId !== results.run.executionRunId) {
    provenanceErrors.push(
      `Execution run ID mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.sourceExecutionRunId}', but Results contains '${results.run.executionRunId}'.`
    );
  }

  // 2.2 Contract Bindings between Acceptance and Results
  if (!results.run.sourceContract) {
    provenanceErrors.push('Results execution run is missing sourceContract provenance binding.');
  } else {
    if (results.run.sourceContract.id !== acceptanceEvaluation.sourceContract.id) {
      provenanceErrors.push(
        `Contract ID mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.sourceContract.id}', but Results references '${results.run.sourceContract.id}'.`
      );
    }
    if (String(results.run.sourceContract.version) !== String(acceptanceEvaluation.sourceContract.version)) {
      provenanceErrors.push(
        `Contract version mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.sourceContract.version}', but Results references '${results.run.sourceContract.version}'.`
      );
    }
    if (results.run.sourceContract.fingerprint !== acceptanceEvaluation.sourceContract.fingerprint) {
      provenanceErrors.push(
        `Contract fingerprint mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.sourceContract.fingerprint}', but Results references '${results.run.sourceContract.fingerprint}'.`
      );
    }
  }

  // 2.3 Test Definition Bindings between Acceptance and Results
  if (!results.run.testDefinition) {
    provenanceErrors.push('Results execution run is missing testDefinition provenance binding.');
  } else {
    if (results.run.testDefinition.id !== acceptanceEvaluation.testDefinition.id) {
      provenanceErrors.push(
        `Test Definition ID mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.testDefinition.id}', but Results references '${results.run.testDefinition.id}'.`
      );
    }
    if (String(results.run.testDefinition.version) !== String(acceptanceEvaluation.testDefinition.version)) {
      provenanceErrors.push(
        `Test Definition version mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.testDefinition.version}', but Results references '${results.run.testDefinition.version}'.`
      );
    }
    if (results.run.testDefinition.fingerprint !== acceptanceEvaluation.testDefinition.fingerprint) {
      provenanceErrors.push(
        `Test Definition fingerprint mismatch: AcceptanceEvaluation references '${acceptanceEvaluation.testDefinition.fingerprint}', but Results references '${results.run.testDefinition.fingerprint}'.`
      );
    }
  }

  // 2.4 Validate optional supplied Contract (§3)
  let verifiedContract: PerformanceContract | undefined = undefined;
  if (contract) {
    let contractValid = true;
    if (contract.id !== acceptanceEvaluation.sourceContract.id) {
      provenanceErrors.push(
        `Supplied Contract ID '${contract.id}' does not match AcceptanceEvaluation sourceContract ID '${acceptanceEvaluation.sourceContract.id}'.`
      );
      contractValid = false;
    }
    if (String(contract.version) !== String(acceptanceEvaluation.sourceContract.version)) {
      provenanceErrors.push(
        `Supplied Contract version '${contract.version}' does not match AcceptanceEvaluation sourceContract version '${acceptanceEvaluation.sourceContract.version}'.`
      );
      contractValid = false;
    }
    if (results.run.sourceContract && contract.id !== results.run.sourceContract.id) {
      provenanceErrors.push(
        `Supplied Contract ID '${contract.id}' does not match Results sourceContract ID '${results.run.sourceContract.id}'.`
      );
      contractValid = false;
    }
    if (results.run.sourceContract && String(contract.version) !== String(results.run.sourceContract.version)) {
      provenanceErrors.push(
        `Supplied Contract version '${contract.version}' does not match Results sourceContract version '${results.run.sourceContract.version}'.`
      );
      contractValid = false;
    }

    const recomputedContractFp = computeContractFingerprint(contract);
    if (recomputedContractFp !== acceptanceEvaluation.sourceContract.fingerprint) {
      provenanceErrors.push(
        `Supplied Contract fingerprint drift: recomputed '${recomputedContractFp}' does not match AcceptanceEvaluation sourceContract fingerprint '${acceptanceEvaluation.sourceContract.fingerprint}'.`
      );
      contractValid = false;
    }
    if (results.run.sourceContract && recomputedContractFp !== results.run.sourceContract.fingerprint) {
      provenanceErrors.push(
        `Supplied Contract fingerprint drift: recomputed '${recomputedContractFp}' does not match Results sourceContract fingerprint '${results.run.sourceContract.fingerprint}'.`
      );
      contractValid = false;
    }

    if (contractValid) {
      verifiedContract = contract;
    }
  }

  // 2.5 Validate optional supplied Test Definition (§3)
  let verifiedTestDefinition: TestDefinition | undefined = undefined;
  if (testDefinition) {
    let tdValid = true;
    if (testDefinition.id !== acceptanceEvaluation.testDefinition.id) {
      provenanceErrors.push(
        `Supplied Test Definition ID '${testDefinition.id}' does not match AcceptanceEvaluation testDefinition ID '${acceptanceEvaluation.testDefinition.id}'.`
      );
      tdValid = false;
    }
    if (String(testDefinition.version) !== String(acceptanceEvaluation.testDefinition.version)) {
      provenanceErrors.push(
        `Supplied Test Definition version '${testDefinition.version}' does not match AcceptanceEvaluation testDefinition version '${acceptanceEvaluation.testDefinition.version}'.`
      );
      tdValid = false;
    }
    if (results.run.testDefinition && testDefinition.id !== results.run.testDefinition.id) {
      provenanceErrors.push(
        `Supplied Test Definition ID '${testDefinition.id}' does not match Results testDefinition ID '${results.run.testDefinition.id}'.`
      );
      tdValid = false;
    }
    if (results.run.testDefinition && String(testDefinition.version) !== String(results.run.testDefinition.version)) {
      provenanceErrors.push(
        `Supplied Test Definition version '${testDefinition.version}' does not match Results testDefinition version '${results.run.testDefinition.version}'.`
      );
      tdValid = false;
    }

    const recomputedTdFp = computeTestDefinitionFingerprint(testDefinition);
    if (recomputedTdFp !== acceptanceEvaluation.testDefinition.fingerprint) {
      provenanceErrors.push(
        `Supplied Test Definition fingerprint drift: recomputed '${recomputedTdFp}' does not match AcceptanceEvaluation testDefinition fingerprint '${acceptanceEvaluation.testDefinition.fingerprint}'.`
      );
      tdValid = false;
    }
    if (results.run.testDefinition && recomputedTdFp !== results.run.testDefinition.fingerprint) {
      provenanceErrors.push(
        `Supplied Test Definition fingerprint drift: recomputed '${recomputedTdFp}' does not match Results testDefinition fingerprint '${results.run.testDefinition.fingerprint}'.`
      );
      tdValid = false;
    }

    if (tdValid) {
      verifiedTestDefinition = testDefinition;
    }
  }

  // If provenance validation fails, produce INVALID_PROVENANCE register (§4)
  if (provenanceErrors.length > 0) {
    const generationStatus: FindingsGenerationStatus = 'INVALID_PROVENANCE';
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
        deterministicReason: 'Acceptance Evaluation and Execution Results have mismatched or invalid provenance bindings.'
      })
    );

    const sortedConflictFindings = conflictFindings.sort((a, b) => a.id.localeCompare(b.id));

    const regDigestPayload = {
      sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
      sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
      overallVerdict: acceptanceEvaluation.overallVerdict,
      generationStatus,
      generationIssues: [...provenanceErrors].sort(),
      findings: sortedConflictFindings.map((f) => f.findingDigest),
      defectCandidates: []
    };

    const regDigest = computeFindingsRegisterDigest(regDigestPayload);

    const register: FindingsRegister = {
      id: `findings-reg-${regDigest.value.slice(0, 16)}`,
      sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
      sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
      sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
      overallVerdict: acceptanceEvaluation.overallVerdict,
      generationStatus,
      generationIssues: provenanceErrors,
      findings: sortedConflictFindings,
      defectCandidates: [],
      registerDigest: regDigest,
      generatedAt
    };

    return deepFreeze(register);
  }

  // -------------------------------------------------------------------------
  // 3. Normal Governed Findings Generation (generationStatus = 'VALID')
  // -------------------------------------------------------------------------
  const generationStatus: FindingsGenerationStatus = 'VALID';
  const generationIssues: string[] = [];

  const rawFindings: CanonicalFinding[] = [];
  const rawDefectCandidates: DefectCandidate[] = [];

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

  // Case A: PASS
  if (overallVerdict === 'PASS') {
    // Zero findings for clean PASS
  }

  // Case B: PASS_WITH_OBSERVATION
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

  // Case C: INCONCLUSIVE
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

  // Case D: FAIL (§1, §5, §6, §7)
  // Invariant: Performance criterion failure findings and defect candidates
  // are created ONLY when governed workload was ATTAINED, gates valid, and all 9 conditions met.
  else if (overallVerdict === 'FAIL') {
    const isWorkloadAttained = acceptanceEvaluation.workloadPrerequisite.status === 'ATTAINED';

    for (const c of acceptanceEvaluation.criterionEvaluations) {
      if (c.status === 'FAIL') {
        // Resolve canonical target string from verified Contract or Test Definition (§6)
        // Invariant: Never use criterion key as target!
        let resolvedTarget: string | undefined = undefined;
        if (verifiedContract) {
          const match = verifiedContract.acceptanceCriteria?.find(
            (ac) => ac.id === c.criterionId || ac.key === c.key
          );
          if (match?.target) {
            resolvedTarget = match.target;
          }
        }
        if (!resolvedTarget && verifiedTestDefinition) {
          const match = verifiedTestDefinition.executableCriteria?.find(
            (ac) => ac.id === c.criterionId || ac.key === c.key
          );
          if (match?.target) {
            resolvedTarget = match.target;
          }
        }

        // Defect Eligibility Revalidation (§5, §7):
        // 1. Findings generation status = VALID
        // 2. Acceptance digest integrity verified (passed earlier)
        // 3. Acceptance overall verdict = FAIL
        // 4. Workload prerequisite = ATTAINED
        // 5. Provenance gate valid
        // 6. Operational integrity gate valid
        // 7. Source criterion status = FAIL
        // 8. Required observed/threshold evidence complete (no fallbacks)
        // 9. Finding bound to Acceptance digest
        const hasCompleteEvidence =
          typeof c.observedValue === 'number' &&
          Number.isFinite(c.observedValue) &&
          typeof c.observedUnit === 'string' &&
          c.observedUnit.trim().length > 0 &&
          typeof c.operator === 'string' &&
          ['<', '<=', '>', '>=', '==', 'BETWEEN'].includes(c.operator) &&
          typeof c.canonicalThresholdValue === 'number' &&
          Number.isFinite(c.canonicalThresholdValue) &&
          typeof c.canonicalUnit === 'string' &&
          c.canonicalUnit.trim().length > 0 &&
          typeof c.evidenceSourcePath === 'string' &&
          c.evidenceSourcePath.trim().length > 0;

        const isDefectEligible =
          isWorkloadAttained &&
          acceptanceEvaluation.provenanceGate.isValid &&
          acceptanceEvaluation.operationalIntegrityGate.isValid &&
          hasCompleteEvidence;

        const finding = finalizeFinding({
          ...baseProvenance,
          findingType: 'PERFORMANCE_CRITERION_FAILURE',
          classification: 'PERFORMANCE',
          status: 'OPEN',
          title: `Performance Criterion Failure: ${c.key}`,
          factualDescription: `Criterion ${c.key} (${c.metric}, scope: ${c.scope}) observed ${c.observedValue ?? 'unknown'} ${c.observedUnit ?? ''} against governed requirement ${c.operator ?? ''} ${c.canonicalThresholdValue ?? ''} ${c.canonicalUnit ?? ''}.`.trim(),
          sourceCriterionId: c.criterionId,
          observedValue: c.observedValue,
          observedUnit: c.observedUnit,
          canonicalThreshold: c.canonicalThresholdValue,
          canonicalOperator: c.operator,
          canonicalUnit: c.canonicalUnit,
          evidenceSourcePaths: c.evidenceSourcePath ? [c.evidenceSourcePath] : [],
          defectEligibility: isDefectEligible,
          deterministicReason: `Governed acceptance criterion failed: ${c.deterministicRationale}`
        });

        rawFindings.push(finding);

        // Generate publication-eligible DefectCandidate ONLY when all eligibility rules hold (§5, §7)
        if (isDefectEligible) {
          const candidate = finalizeDefectCandidate({
            sourceFindingId: finding.id,
            title: `Performance Defect Candidate: ${c.key}`,
            factualProblemStatement: finding.factualDescription,
            acceptanceCriterionReference: {
              criterionId: c.criterionId,
              metric: c.metric,
              scope: c.scope,
              ...(resolvedTarget ? { target: resolvedTarget } : {})
            },
            observedEvidenceSummary: {
              observedValue: c.observedValue!,
              observedUnit: c.observedUnit!,
              evidenceSourcePath: c.evidenceSourcePath!
            },
            expectedGovernedCriterion: {
              ...(resolvedTarget ? { target: resolvedTarget } : {}),
              operator: c.operator!,
              thresholdValue: c.canonicalThresholdValue!,
              unit: c.canonicalUnit!
            },
            executionRunReference: {
              executionRunId: acceptanceEvaluation.sourceExecutionRunId,
              completedAt: acceptanceEvaluation.evaluatedAt ?? results.run.timestamps.completedAt
            },
            evidenceReferences: [c.evidenceSourcePath!],
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

  // Cryptographic binding of FindingsRegister (§4, §8)
  const registerPayload = {
    sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
    sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
    sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
    overallVerdict: acceptanceEvaluation.overallVerdict,
    generationStatus,
    generationIssues: [...generationIssues].sort(),
    findings: findings.map((f) => f.findingDigest),
    defectCandidates: defectCandidates.map((d) => d.candidateDigest)
  };

  const registerDigest = computeFindingsRegisterDigest(registerPayload);

  const register: FindingsRegister = {
    id: `findings-reg-${registerDigest.value.slice(0, 16)}`,
    sourceAcceptanceEvaluationId: acceptanceEvaluation.id,
    sourceAcceptanceEvaluationDigest: acceptanceEvaluation.evaluationDigest.value,
    sourceExecutionRunId: acceptanceEvaluation.sourceExecutionRunId,
    overallVerdict: acceptanceEvaluation.overallVerdict,
    generationStatus,
    generationIssues,
    findings,
    defectCandidates,
    registerDigest,
    generatedAt
  };

  // Deep-freeze returned register without modifying caller inputs (§8)
  return deepFreeze(register);
}
