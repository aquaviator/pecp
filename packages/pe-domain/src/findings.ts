// PECP Canonical Findings & Defect Candidate Domain Model (M4.0)
// Defined according to docs/work-packages/M4_0_CANONICAL_FINDINGS_DEFECT_CANDIDATE_MODEL.md
// Invariant: Pure, deterministic findings generation outside the UI without root-cause invention.

import {
  AcceptanceVerdict,
  WorkloadAttainmentEvaluationStatus
} from './acceptance.js';

/**
 * Governed finding type classification.
 * Derived strictly from canonical acceptance evaluation evidence.
 */
export type FindingType =
  | 'PERFORMANCE_CRITERION_FAILURE'
  | 'WORKLOAD_ATTAINMENT_UNRESOLVED'
  | 'WORKLOAD_NOT_ATTAINED'
  | 'WORKLOAD_EVIDENCE_INVALID'
  | 'EXECUTION_INTEGRITY_ISSUE'
  | 'PROVENANCE_CONFLICT'
  | 'CRITERION_NOT_EVALUABLE'
  | 'THRESHOLD_CORROBORATION_CONFLICT'
  | 'BLOCKING_GOVERNED_OBSERVATION'
  | 'NON_BLOCKING_OBSERVATION';

/**
 * Governed finding classification category.
 */
export type FindingClassification =
  | 'PERFORMANCE'
  | 'GOVERNANCE'
  | 'EVIDENCE_QUALITY'
  | 'EXECUTION_VALIDITY'
  | 'OBSERVATION';

/**
 * Finding lifecycle status in M4.0.
 */
export type FindingStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'SUPERSEDED';

/**
 * Canonical Finding.
 * Immutable engineering statement derived deterministically from canonical evidence.
 */
export interface CanonicalFinding {
  id: string;
  findingType: FindingType;
  classification: FindingClassification;
  status: FindingStatus;
  title: string;
  factualDescription: string;
  sourceAcceptanceEvaluationId: string;
  sourceAcceptanceEvaluationDigest: string;
  sourceExecutionRunId: string;
  sourceContractId: string;
  sourceContractVersion: string | number;
  sourceContractFingerprint: string;
  sourceTestDefinitionId: string;
  sourceTestDefinitionVersion: string;
  sourceTestDefinitionFingerprint: string;
  sourceCriterionId?: string;
  observedValue?: number;
  observedUnit?: string;
  canonicalThreshold?: string | number;
  canonicalOperator?: string;
  canonicalUnit?: string;
  workloadPrerequisiteStatus: WorkloadAttainmentEvaluationStatus;
  evidenceSourcePaths: string[];
  governedObservationId?: string;
  defectEligibility: boolean;
  deterministicReason: string;
  severity?: string;
  findingDigest: string;
}

/**
 * Defect Candidate.
 * A performance finding eligible for downstream defect publication because
 * the evidence proves a genuine acceptance failure under valid attained workload.
 * Invariant: Never contains invented assignee, sprint, priority, severity, component/team, root cause, or due date.
 */
export interface DefectCandidate {
  id: string;
  sourceFindingId: string;
  title: string;
  factualProblemStatement: string;
  acceptanceCriterionReference: {
    criterionId: string;
    metric: string;
    scope: string;
    target?: string;
  };
  observedEvidenceSummary: {
    observedValue: number;
    observedUnit: string;
    evidenceSourcePath?: string;
  };
  expectedGovernedCriterion: {
    target?: string;
    operator: string;
    thresholdValue: number;
    unit: string;
  };
  executionRunReference: {
    executionRunId: string;
    completedAt?: string;
  };
  evidenceReferences: string[];
  publicationEligibility: boolean;
  blockingReasonsToPublication: string[];
  candidateDigest: string;
}

/**
 * Cryptographic digest descriptor for a Findings Register.
 */
export interface FindingsRegisterDigest {
  algorithm: 'SHA-256';
  schemaVersion: 'findings-register-v1';
  value: string;
}

/**
 * Immutable Findings Register containing all findings and defect candidates
 * generated for an Acceptance Evaluation run.
 */
export interface FindingsRegister {
  id: string;
  sourceAcceptanceEvaluationId: string;
  sourceAcceptanceEvaluationDigest: string;
  sourceExecutionRunId: string;
  overallVerdict: AcceptanceVerdict;
  findings: CanonicalFinding[];
  defectCandidates: DefectCandidate[];
  registerDigest: FindingsRegisterDigest;
  generatedAt?: string;
}
