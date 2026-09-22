// PECP Canonical Performance Evidence Package Domain Model (M4.1)
// Defined according to docs/work-packages/M4_1_CANONICAL_PERFORMANCE_EVIDENCE_PACKAGE.md
// Invariants:
// 1. Governed audit package over existing canonical evidence.
// 2. Package validity and performance verdict are strictly separate concepts.
// 3. Never invents missing source artefacts, root cause, or release certification.
// 4. Pure and immutable without caller side-effects.

import { EngineeringIntent } from './index.js';
import {
  AcceptanceVerdict,
  WorkloadAttainmentEvaluationStatus,
  CriterionEvaluationStatus
} from './acceptance.js';
import { FindingsGenerationStatus } from './findings.js';

/**
 * Governed evidence package generation status.
 * Reflects whether the audit package is internally consistent, cryptographically verified,
 * and complete for required components.
 * Distinct from the underlying AcceptanceVerdict.
 */
export type EvidencePackageGenerationStatus =
  | 'VALID'
  | 'INVALID_PROVENANCE'
  | 'INVALID_ACCEPTANCE_INTEGRITY'
  | 'INVALID_FINDINGS_INTEGRITY'
  | 'INVALID_RESULTS_INTEGRITY'
  | 'INCOMPLETE_REQUIRED_EVIDENCE';

/**
 * Component types in the Performance Evidence Package.
 */
export type EvidencePackageComponentType =
  | 'PERFORMANCE_CONTRACT'
  | 'PERFORMANCE_STRATEGY'
  | 'PERFORMANCE_TEST_PLAN'
  | 'TEST_DEFINITION'
  | 'EXECUTION_RUN'
  | 'RAW_EVIDENCE_INVENTORY'
  | 'CANONICAL_RESULTS'
  | 'ACCEPTANCE_EVALUATION'
  | 'FINDINGS_REGISTER';

/**
 * Presence and staleness status of a package component.
 */
export type ComponentPresenceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'STALE'
  | 'SUPERSEDED'
  | 'INVALID';

/**
 * Governed reference to an evidence package component.
 */
export interface EvidencePackageComponentReference {
  componentType: EvidencePackageComponentType;
  canonicalId?: string;
  version?: string | number;
  fingerprint?: string;
  digest?: string;
  algorithm?: string;
  schemaVersion?: string;
  status?: string;
  sourceContractFingerprint?: string;
  executionBundleFingerprint?: string;
  executionArtifactDigest?: string;
  sourceLocator?: string;
  isRequired: boolean;
  presenceStatus: ComponentPresenceStatus;
  issues?: string[];
}

/**
 * Governed raw evidence file representation in the package manifest.
 * Preserves evidence metadata without embedding secrets or multi-megabyte payloads.
 */
export interface RawEvidencePackageItem {
  evidenceType: string;
  filename: string;
  presenceStatus: string;
  checksum?: string;
  sizeBytes?: number;
  sourceLocator?: string;
}

/**
 * Workload demand breakdown separating business demand from scheduler demand
 * and preserving governed stage timings (M4.1.1).
 */
export interface EvidencePackageWorkloadDemand {
  businessDemand?: {
    targetValue?: number;
    unit?: string;
    metric?: string;
    timeBasis?: string;
  };
  schedulerDemand?: {
    peakArrivalRate?: number;
    unit?: string;
    population?: string;
    executionModel?: string;
    startRate?: number;
  };
  profileType?: string;
  totalDurationSeconds?: number;
  rampUpSeconds?: number;
  steadyStateSeconds?: number;
  rampDownSeconds?: number;
}

/**
 * Deterministic render-neutral evidence summary.
 */
export interface EvidencePackageSummary {
  execution: {
    executionRunId: string;
    executionMode: string;
    operationalStatus: string;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
  };
  workloadDemand: EvidencePackageWorkloadDemand;
  workloadAttainment: {
    status: WorkloadAttainmentEvaluationStatus;
    isPrerequisiteMet: boolean;
    observedValue?: number;
    targetValue?: number;
    unit?: string;
    derivationStatus?: string;
    rationale: string;
  };
  criterionOutcomes: Array<{
    criterionId: string;
    key: string;
    metric: string;
    target?: string;
    canonicalThresholdValue?: number;
    canonicalUnit?: string;
    observedValue?: number;
    observedUnit?: string;
    status: CriterionEvaluationStatus;
    rationale: string;
  }>;
  acceptanceVerdict: {
    verdict: AcceptanceVerdict;
    reasons: string[];
    evaluatedAt?: string;
  };
  findingsSummary: {
    generationStatus: FindingsGenerationStatus;
    totalFindings: number;
    byType: Record<string, number>;
    byClassification: Record<string, number>;
    totalDefectCandidates: number;
  };
  dataQualityAndIntegrity: {
    provenanceValid: boolean;
    operationalIntegrityValid: boolean;
    rawEvidenceComplete: boolean;
    governedObservationsCount: number;
    blockingObservationsCount: number;
  };
}

/**
 * Binding relationship type along the source-to-result lineage chain.
 */
export type LineageBindingType =
  | 'SPECIFIES'
  | 'TARGETS'
  | 'GOVERNS'
  | 'PRODUCES'
  | 'CAPTURES'
  | 'PARSES'
  | 'EVALUATES'
  | 'REGISTERS';

/**
 * Traceable edge in the source-to-result lineage graph.
 */
export interface EvidencePackageLineageEdge {
  fromComponent: EvidencePackageComponentType;
  fromId: string;
  toComponent: EvidencePackageComponentType;
  toId: string;
  bindingType: LineageBindingType | string;
  verified: boolean;
  details: string;
}

/**
 * Explicit source-to-result lineage structure.
 */
export interface EvidencePackageLineage {
  edges: EvidencePackageLineageEdge[];
}

/**
 * Cryptographic digest descriptor for a Performance Evidence Package.
 */
export interface EvidencePackageDigest {
  algorithm: 'SHA-256';
  schemaVersion: 'performance-evidence-package-v1';
  value: string;
}

/**
 * Canonical Performance Evidence Package (M4.1).
 * Immutable audit manifest binding the entire source-to-result chain.
 */
export interface PerformanceEvidencePackage {
  id: string;
  schemaVersion: 'performance-evidence-package-v1';
  projectId?: string;
  projectName?: string;
  engineeringIntent?: EngineeringIntent;
  sourceExecutionRunId: string;
  sourceContract: {
    id?: string;
    version?: string | number;
    fingerprint?: string;
    status?: string;
  };
  sourceTestDefinition: {
    id?: string;
    version?: string;
    fingerprint?: string;
  };
  acceptanceEvaluation: {
    id?: string;
    digest?: string;
    overallVerdict?: AcceptanceVerdict;
    evaluatedAt?: string;
  };
  findingsRegister: {
    id?: string;
    digest?: string;
    generationStatus?: FindingsGenerationStatus;
    totalFindings: number;
    totalDefectCandidates: number;
  };
  packageGenerationStatus: EvidencePackageGenerationStatus;
  generationIssues: string[];
  components: EvidencePackageComponentReference[];
  rawEvidenceInventory: RawEvidencePackageItem[];
  evidenceSummary: EvidencePackageSummary;
  lineage: EvidencePackageLineage;
  packageDigest: EvidencePackageDigest;
  generatedAt?: string;
}
