// PECP Canonical Export & Publication Contract Domain Model (M4.2 / M4.2.1)
// Defined according to docs/work-packages/M4_2_CANONICAL_EXPORT_PUBLICATION_CONTRACT.md
// and docs/work-packages/M4_2_1_EXPORT_SEMANTIC_INTEGRITY_CRYPTOGRAPHIC_BINDING_VISUALISATION_FIDELITY_GATE.md
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
  sourceVersion?: string | number | null;
  sourceFingerprint?: string | null;
  sourceDigest?: string | null;
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
 * Invariant (M4.2.1): Target expressions remain exact strings (e.g. 'p95 < 2000ms'); never cast to Number.
 */
export interface DestinationNeutralDefectPayload {
  id: string;
  sourceFindingId: string;
  sourceCandidateId: string;
  sourceExecutionRunId: string;
  sourceAcceptanceEvaluationId?: string | null;
  sourceEvidencePackageId: string;
  title: string;
  factualProblemStatement: string;
  canonicalCriterionReference: {
    criterionId: string;
    metric: string;
    scope: string;
    target?: string | null;
  };
  observedEvidence: {
    observedValue: number;
    observedUnit: string;
    evidenceSourcePath?: string | null;
  };
  expectedCriterion: {
    target?: string | null;
    operator?: string | null;
    thresholdValue?: number | null;
    unit?: string | null;
  };
  executionRunReference: string;
  evidenceReferences: string[];
  publicationEligibility: boolean;
  blockingReasons: string[];
  payloadDigest: string; // SHA-256 hex
}

/**
 * Governed stage for workload visualisation hook (M4.2.1).
 * Preserves exact sequence, start/target arrival rates, and cumulative timestamps.
 */
export interface ResultsReportVisualisationStage {
  stageIndex: number;
  name?: string | null;
  durationSeconds: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  startArrivalRate?: number | null;
  targetArrivalRate: number;
}

/**
 * Governed journey distribution item for workload visualisation hook (M4.2.1).
 */
export interface ResultsReportJourneyDistributionItem {
  journeyId?: string | null;
  journeyKey?: string | null;
  name: string;
  percentage?: number | null;
  weight?: number | null;
  description?: string | null;
}

/**
 * Governed visualisation reference hook exposed in Results Report model.
 * Supplies sufficient governed data for a future UI/rendering layer to plot arbitrary schedules
 * (load, stress, soak, spike, custom) without coupling chart libraries into domain core.
 * Invariant (M4.2.1): No default rates, units, or populations; faithfully models source schedule.
 */
export interface ResultsReportVisualisationHook {
  scheduler?: {
    executionModel?: string | null;
    population?: string | null;
    rateUnit?: string | null;
    startRate?: number | null;
    peakArrivalRate?: number | null;
  } | null;
  businessTarget?: {
    metric?: string | null;
    targetValue?: number | null;
    unit?: string | null;
    timeBasis?: string | null;
  } | null;
  stages: ResultsReportVisualisationStage[];
  journeyDistribution: ResultsReportJourneyDistributionItem[];
}

/**
 * Governed render-neutral Results Report projection.
 * Derived factually from a verified PerformanceEvidencePackage.
 * Invariant (M4.2.1): Zero invented engineering defaults when source fields are absent in audit-only packages.
 */
export interface RenderNeutralResultsReport {
  id: string;
  sourcePackageId: string;
  sourcePackageDigest: string;
  projectExecutionIdentity: {
    contractId?: string | null;
    contractVersion?: string | number | null;
    testDefinitionId?: string | null;
    testDefinitionVersion?: string | number | null;
    executionRunId?: string | null;
    executionMode?: string | null;
    operationalStatus?: string | null;
    commitSha?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    durationSeconds?: number | null;
  };
  workloadDemand: {
    businessDemand?: number | null;
    businessDemandUnit?: string | null;
    businessDemandMetric?: string | null;
    businessDemandTimeBasis?: string | null;
    schedulerDemand?: number | null;
    schedulerDemandUnit?: string | null;
    schedulerPopulation?: string | null;
    executionModel?: string | null;
    profileType?: string | null;
  };
  scheduleTimings: {
    rampUpSeconds?: number | null;
    steadyStateSeconds?: number | null;
    rampDownSeconds?: number | null;
    totalDurationSeconds?: number | null;
  };
  visualisationHook: ResultsReportVisualisationHook;
  workloadAttainment?: {
    status?: string | null;
    isPrerequisiteMet?: boolean | null;
    observedValue?: number | null;
    targetValue?: number | null;
    unit?: string | null;
    derivationStatus?: string | null;
    rationale?: string | null;
  } | null;
  criterionOutcomes: Array<{
    criterionId: string;
    key: string;
    metric: string;
    target?: string | null;
    canonicalThresholdValue?: number | null;
    canonicalUnit?: string | null;
    observedValue?: number | null;
    observedUnit?: string | null;
    status: string;
    rationale?: string | null;
  }>;
  acceptanceVerdict?: {
    verdict?: string | null;
    reasons?: string[];
    evaluatedAt?: string | null;
  } | null;
  findingsSummary?: {
    totalFindings: number;
    byType: Record<string, number>;
    byClassification: Record<string, number>;
    totalDefectCandidates: number;
    generationStatus?: string | null;
  } | null;
  defectCandidatesSummary?: {
    totalCandidates: number;
    eligibleForPublication: number;
    blockedFromPublication: number;
  } | null;
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
 * Invariant (M4.2.1): Source verdict is optional for invalid audit-only sources; never synthesize INCONCLUSIVE.
 */
export interface PublicationBundle {
  id: string;
  schemaVersion: 'publication-bundle-v1';
  sourceEvidencePackageId: string;
  sourceEvidencePackageDigest: string;
  sourceAcceptanceVerdict?: AcceptanceVerdict | null;
  sourceFindingsRegisterDigest?: string | null;
  artifacts: ExportArtifact[];
  defectPayloads: DestinationNeutralDefectPayload[];
  requestedDestinations: PublicationDestination[];
  publicationReadiness: Record<PublicationDestination, DestinationPublicationStatus>;
  overallReadiness: PublicationReadinessStatus;
  blockingReasons: string[];
  bundleDigest: PublicationBundleDigest;
  generatedAt?: string;
}
