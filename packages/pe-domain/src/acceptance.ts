// PECP Canonical Acceptance Domain Model (M3.3)
// Defined according to docs/work-packages/M3_3_DETERMINISTIC_ACCEPTANCE_ENGINE.md
// Invariant: Pure, deterministic acceptance evaluation outside the UI.

import { AttainmentDerivationStatus, AttainmentTimeBasis } from './results.js';

/**
 * Governed overall acceptance verdict for PECP.
 * Invariant: Can only be assigned by M3.3 Acceptance Engine.
 */
export type AcceptanceVerdict =
  | 'PASS'
  | 'FAIL'
  | 'PASS_WITH_OBSERVATION'
  | 'INCONCLUSIVE';

/**
 * Evaluation status of an individual canonical acceptance criterion.
 */
export type CriterionEvaluationStatus =
  | 'PASS'
  | 'FAIL'
  | 'NOT_EVALUATED'
  | 'NOT_EVALUABLE';

/**
 * Evaluation status of the prerequisite workload demand attainment.
 */
export type WorkloadAttainmentEvaluationStatus =
  | 'ATTAINED'
  | 'NOT_ATTAINED'
  | 'UNRESOLVED'
  | 'INVALID';

/**
 * Governed observation severity classification.
 */
export type GovernedObservationSeverity = 'INFO' | 'WARNING' | 'OBSERVATION';

/**
 * Governed observation.
 * Explicit non-blocking observations allow PASS_WITH_OBSERVATION.
 * Blocking observations yield INCONCLUSIVE.
 */
export interface GovernedObservation {
  id: string;
  source: string;
  description: string;
  severity: GovernedObservationSeverity | string;
  isBlocking: boolean;
  provenanceReference?: string;
  details?: Record<string, unknown>;
}

/**
 * Workload attainment evaluation outcome.
 */
export interface WorkloadAttainmentEvaluation {
  status: WorkloadAttainmentEvaluationStatus;
  targetValue?: number;
  observedValue?: number;
  unit?: string;
  timeBasis?: AttainmentTimeBasis;
  tolerancePercentage?: number;
  requiredMinimum?: number;
  derivationStatus?: AttainmentDerivationStatus;
  isPrerequisiteMet: boolean;
  rationale: string;
}

/**
 * Cryptographic digest descriptor for an Acceptance Evaluation.
 * Exposes algorithm, schemaVersion, and deterministic SHA-256 digest value.
 */
export interface AcceptanceEvaluationDigest {
  algorithm: 'SHA-256';
  schemaVersion: 'acceptance-evaluation-v1';
  value: string;
}

/**
 * Corroborating engine threshold comparison.
 */
export interface CorroboratingEngineThreshold {
  metric: string;
  expression: string;
  enginePassed?: boolean | null;
  agreesWithEngine?: boolean | null;
  status?: string;
}

/**
 * Evaluation of an individual canonical acceptance criterion.
 */
export interface AcceptanceCriterionEvaluation {
  criterionId: string;
  key: string;
  metric: string;
  scope: string;
  operator?: '<' | '<=' | '>' | '>=' | '==' | string;
  canonicalThresholdValue?: number;
  canonicalUnit?: string;
  percentile?: number;
  normalizedComparisonThreshold?: number;
  observedValue?: number;
  observedUnit?: string;
  evidenceSourcePath?: string;
  status: CriterionEvaluationStatus;
  corroboratingEngineThreshold?: CorroboratingEngineThreshold;
  deterministicRationale: string;
}

/**
 * Pre-evaluation gate result (provenance or execution integrity).
 */
export interface AcceptanceGateResult {
  isValid: boolean;
  reasons: string[];
  details?: Record<string, unknown>;
}

/**
 * Canonical Acceptance Evaluation.
 * Immutable, provenance-bound, and deterministically fingerprinted.
 */
export interface AcceptanceEvaluation {
  id: string;
  version: string;
  sourceExecutionRunId: string;
  repositoryCommitSha?: string;
  workflowRunId?: string;
  sourceContract: {
    id: string;
    version: string;
    fingerprint: string;
    status?: string;
  };
  testDefinition: {
    id: string;
    version: string;
    fingerprint: string;
  };
  canonicalResults: {
    executionRunId: string;
    artifactDigest?: string;
  };
  provenanceGate: AcceptanceGateResult;
  operationalIntegrityGate: AcceptanceGateResult;
  workloadPrerequisite: WorkloadAttainmentEvaluation;
  criterionEvaluations: AcceptanceCriterionEvaluation[];
  governedObservations: GovernedObservation[];
  overallVerdict: AcceptanceVerdict;
  verdictReasons: string[];
  evaluatedAt?: string;
  evaluationDigest: AcceptanceEvaluationDigest;
  evaluationFingerprint: string;
}
