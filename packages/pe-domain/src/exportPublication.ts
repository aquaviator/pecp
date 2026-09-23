// PECP Canonical Export & Publication Contract Domain Model (M4.2)
// Defined according to docs/work-packages/M4_2_CANONICAL_EXPORT_PUBLICATION_CONTRACT.md
// Invariant: Pure, deterministic export and publication boundary outside UI without external mutation or invented fields.

import { AcceptanceVerdict } from './acceptance.js';

/**
 * Governed export artefact types supported in PECP M4.2.
 */
export type ExportArtifactType =
  | 'PERFORMANCE_STRATEGY'
  | 'PERFORMANCE_TEST_PLAN'
  | 'RESULTS_REPORT'
  | 'PERFORMANCE_EVIDENCE_PACKAGE'
  | 'FINDINGS_REGISTER'
  | 'DEFECT_CANDIDATE';

/**
 * Governed export serialization formats in M4.2.
 */
export type ExportFormat = 'JSON' | 'MARKDOWN' | 'HTML';

/**
 * Governed external or local publication destinations.
 * Destination existence defines the contract boundary without requiring live connector execution.
 */
export type PublicationDestination =
  | 'DOWNLOAD'
  | 'API'
  | 'CONFLUENCE'
  | 'SHAREPOINT'
  | 'JIRA'
  | 'AZURE_DEVOPS';

/**
 * Governed publication readiness lifecycle statuses.
 */
export type PublicationReadinessStatus =
  | 'READY'
  | 'BLOCKED_INVALID_SOURCE'
  | 'BLOCKED_MISSING_DESTINATION_CONFIGURATION'
  | 'BLOCKED_MISSING_REQUIRED_FIELD'
  | 'AUDIT_ONLY_NOT_PUBLISHABLE';

/**
 * Single deterministic export artefact.
 */
export interface ExportArtifact {
  id: string;
  artifactType: ExportArtifactType;
  sourceId: string;
  sourceVersion?: string | number;
  sourceFingerprint?: string;
  sourceDigest?: string;
  format: ExportFormat;
  mediaType: string;
  content: string;
  contentDigest: string; // SHA-256 hex
  metadata: Record<string, unknown>;
  publicationEligibility: boolean;
  blockingReasons: string[];
}

/**
 * Destination-neutral defect publication payload derived deterministically from DefectCandidate.
 * Invariant: Never contains invented priority, severity, assignee, team/component, sprint, due date, or root cause.
 */
export interface DestinationNeutralDefectPayload {
  id: string;
  sourceFindingId: string;
  sourceCandidateId: string;
  sourceExecutionRunId: string;
  sourceAcceptanceEvaluationId?: string;
  sourceEvidencePackageId: string;
  title: string;
  factualProblemStatement: string;
  canonicalCriterionReference: {
    criterionId: string;
    metric: string;
    scope: string;
    target?: number | null;
  };
  observedEvidence: {
    observedValue: number;
    observedUnit: string;
    evidenceSourcePath?: string | null;
  };
  expectedCriterion: {
    target?: number | null;
    operator: string;
    thresholdValue: number;
    unit: string;
  };
  executionRunReference: string;
  evidenceReferences: string[];
  publicationEligibility: boolean;
  blockingReasons: string[];
  payloadDigest: string; // SHA-256 hex
}

/**
 * Governed visualisation reference hook exposed in Results Report model.
 * Supplies sufficient governed data for a future UI/rendering layer to plot without coupling chart libraries.
 */
export interface ResultsReportVisualisationHook {
  totalSchedulerLoadOverTime: {
    unit: string;
    timeBasis: string;
    targetRate: number;
  };
  businessWorkloadTarget: {
    businessMetric: string;
    targetRate: number;
    unit: string;
  };
  journeyDistribution: Array<{
    journeyName: string;
    ratioPercentage?: number;
    description?: string;
  }>;
  stages: Array<{
    stageIndex: number;
    stageName: string;
    durationSeconds: number;
    targetArrivalRate: number;
  }>;
}

/**
 * Governed render-neutral Results Report projection.
 * Derived factually from a verified PerformanceEvidencePackage.
 */
export interface RenderNeutralResultsReport {
  id: string;
  sourcePackageId: string;
  sourcePackageDigest: string;
  projectExecutionIdentity: {
    contractId: string;
    contractVersion: string | number;
    testDefinitionId: string;
    testDefinitionVersion: string | number;
    executionRunId: string;
    executionMode?: string;
    operationalStatus?: string;
    commitSha?: string;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
  };
  workloadDemand: {
    businessDemand: number;
    businessDemandUnit: string;
    schedulerDemand: number;
    schedulerDemandUnit: string;
    schedulerPopulation: string;
    executionModel: string;
  };
  scheduleTimings: {
    rampUpSeconds?: number;
    steadyStateSeconds?: number;
    rampDownSeconds?: number;
    totalDurationSeconds?: number;
  };
  visualisationHook: ResultsReportVisualisationHook;
  workloadAttainment: {
    status: string;
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
    status: string;
    rationale: string;
  }>;
  acceptanceVerdict: {
    verdict: string;
    reasons: string[];
    evaluatedAt?: string;
  };
  findingsSummary: {
    totalFindings: number;
    byType: Record<string, number>;
    byClassification: Record<string, number>;
    totalDefectCandidates: number;
    generationStatus?: string;
  };
  defectCandidatesSummary: {
    totalCandidates: number;
    eligibleForPublication: number;
    blockedFromPublication: number;
  };
  evidencePackageIntegrity: {
    packageGenerationStatus: string;
    coreLineageEdgesVerified: boolean;
    totalLineageEdges: number;
    generationIssues: string[];
  };
  reportDigest: string; // SHA-256 hex
}

/**
 * Cryptographic digest descriptor for PublicationBundle.
 */
export interface PublicationBundleDigest {
  algorithm: 'SHA-256';
  schemaVersion: 'publication-bundle-v1';
  value: string;
}

/**
 * Publication readiness state for a specific destination.
 */
export interface DestinationPublicationStatus {
  status: PublicationReadinessStatus;
  blockingReasons: string[];
}

/**
 * Immutable Publication Bundle binding all export artefacts, defect payloads, and publication readiness.
 */
export interface PublicationBundle {
  id: string;
  schemaVersion: 'publication-bundle-v1';
  sourceEvidencePackageId: string;
  sourceEvidencePackageDigest: string;
  sourceAcceptanceVerdict: AcceptanceVerdict;
  sourceFindingsRegisterDigest?: string;
  artifacts: ExportArtifact[];
  defectPayloads: DestinationNeutralDefectPayload[];
  requestedDestinations: PublicationDestination[];
  publicationReadiness: Record<PublicationDestination, DestinationPublicationStatus>;
  overallReadiness: PublicationReadinessStatus;
  blockingReasons: string[];
  bundleDigest: PublicationBundleDigest;
  generatedAt?: string;
}
