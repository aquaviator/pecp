// PECP Canonical Results Model
// Governed, immutable, provenance-bound execution result types according to docs/work-packages/M3_2_RESULTS_MODEL_RAW_EVIDENCE_INGESTION.md
// Invariant: No final PECP performance verdict (PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE) is evaluated or assigned in M3.2.

/**
 * Invariant Performance Verdict boundary for M3.2.
 * Execution evidence ingestion strictly preserves the non-evaluated state.
 */
export type InvariantPerformanceVerdict = 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED';

export const INVARIANT_PERFORMANCE_VERDICT: InvariantPerformanceVerdict = 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED';

export const INVARIANT_VERDICT_DISCLAIMER =
  'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: M3.2 is strictly raw evidence ingestion and results modeling. No PECP PASS/FAIL/INCONCLUSIVE performance verdict is evaluated or assigned.';

/**
 * Execution Mode of the governed run.
 */
export type ExecutionMode = 'CANONICAL' | 'SMOKE_DIAGNOSTIC' | string;

/**
 * Operational Status of the execution harness.
 */
export type OperationalStatus =
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_ENGINE_FAILED'
  | 'TARGET_UNAVAILABLE'
  | 'PREFLIGHT_BLOCKED'
  | string;

/**
 * Artifact reference representing GitHub Actions or external storage bundle.
 */
export interface ExecutionRunArtifactReference {
  id?: string;
  name?: string;
  digest?: string;
  sizeBytes?: number;
  retentionExpiresAt?: string;
  url?: string;
}

/**
 * Engine identity and version metadata.
 */
export interface ExecutionRunEngineInfo {
  name: string;
  version: string;
  fullVersionString?: string;
  binaryPath?: string;
  isPinnedExpected?: boolean;
}

/**
 * Target Reference Lab identity and preflight probe status.
 */
export interface ExecutionRunTargetInfo {
  baseUrl: string;
  probeResult?: {
    baseUrl: string;
    verifiedAt: string;
    healthStatus: string;
    readyStatus: string;
    isResolvable: boolean;
    httpStatusHealth: number;
    httpStatusReady: number;
  };
}

/**
 * Preflight verification status prior to live execution.
 */
export interface ExecutionRunPreflightInfo {
  status: string;
  isValid: boolean;
  blockingReasons: string[];
  manifestTimestamp?: string;
}

/**
 * Source Performance Contract provenance binding.
 */
export interface ExecutionRunSourceContractInfo {
  id: string;
  version: string;
  fingerprint: string;
  status?: string;
}

/**
 * Test Definition provenance binding.
 */
export interface ExecutionRunTestDefinitionInfo {
  id: string;
  version: string;
  fingerprint: string;
}

/**
 * PECP Runtime provenance binding.
 */
export interface ExecutionRunRuntimeInfo {
  version?: string;
  sourceId?: string;
}

/**
 * Execution timing timestamps.
 */
export interface ExecutionRunTimestamps {
  startedAt: string;
  completedAt: string;
  durationSeconds?: number;
}

/**
 * Canonical ExecutionRun identity model.
 * Preserves source evidence identity without inventing or reconstructing missing provenance.
 */
export interface ExecutionRun {
  executionRunId: string;
  executionMode: ExecutionMode;
  operationalStatus: OperationalStatus;
  repositoryCommitSha: string;
  commitSha: string;
  workflowRunId?: string;
  executionArtifact?: ExecutionRunArtifactReference;
  timestamps: ExecutionRunTimestamps;
  engine: ExecutionRunEngineInfo;
  engineExitCode: number | null;
  target: ExecutionRunTargetInfo;
  preflightStatus: ExecutionRunPreflightInfo;
  sourceContract: ExecutionRunSourceContractInfo;
  testDefinition: ExecutionRunTestDefinitionInfo;
  bundleFingerprint: string;
  runtime: ExecutionRunRuntimeInfo;
}

/**
 * Raw evidence artifact types.
 */
export type RawEvidenceType =
  | 'EXECUTION_MANIFEST'
  | 'K6_SUMMARY_JSON'
  | 'STDOUT_LOG'
  | 'STDERR_LOG'
  | 'CONFIG_JSON'
  | 'JOURNEYS_JS'
  | 'ENTRYPOINT_JS'
  | 'RUNTIME_JS'
  | 'REFERENCE_LAB_METRICS';

/**
 * Presence and verification status of a raw evidence file.
 */
export type EvidencePresenceStatus = 'PRESENT' | 'ABSENT' | 'UNAVAILABLE' | 'CORRUPT';

/**
 * Raw evidence file reference with checksum and size verification.
 */
export interface RawEvidenceReference {
  filename: string;
  evidenceType: RawEvidenceType;
  checksum: string;
  sizeBytes: number;
  sourceLocator?: string;
  presenceStatus: EvidencePresenceStatus;
  checksumVerified?: boolean;
  actualChecksum?: string;
}

/**
 * Complete raw evidence inventory of an execution.
 */
export interface RawEvidenceInventory {
  manifest?: RawEvidenceReference;
  summaryJson?: RawEvidenceReference;
  stdoutLog?: RawEvidenceReference;
  stderrLog?: RawEvidenceReference;
  configJson?: RawEvidenceReference;
  journeysJs?: RawEvidenceReference;
  entrypointJs?: RawEvidenceReference;
  runtimeJs?: RawEvidenceReference;
  referenceLabMetrics?: RawEvidenceReference;
  allReferences: RawEvidenceReference[];
}

/**
 * k6 Metric Value Distributions and Counters
 */
export interface K6TrendDistribution {
  min?: number;
  max?: number;
  avg?: number;
  med?: number;
  p90?: number;
  p95?: number;
  p99?: number;
}

export interface K6CounterMetric {
  count?: number;
  rate?: number;
}

export interface K6GaugeMetric {
  value?: number;
  min?: number;
  max?: number;
}

export interface K6RateMetric {
  passes?: number;
  fails?: number;
  rate?: number;
}

export interface K6CheckMetric {
  name: string;
  path: string;
  id: string;
  passes?: number;
  fails?: number;
}

/**
 * Normalized k6 summary metrics produced by pinned k6 engine.
 * Preserves raw source values and leaves absent metrics undefined.
 */
export interface K6SummaryMetrics {
  testRunDurationMs?: number;
  iterations?: K6CounterMetric;
  droppedIterations?: K6CounterMetric;
  httpReqs?: K6CounterMetric;
  httpReqFailed?: K6RateMetric;
  checks?: K6RateMetric;
  vus?: K6GaugeMetric;
  vusMax?: K6GaugeMetric;
  dataReceived?: K6CounterMetric;
  dataSent?: K6CounterMetric;
  httpReqDuration?: K6TrendDistribution;
  httpReqWaiting?: K6TrendDistribution;
  httpReqConnecting?: K6TrendDistribution;
  httpReqReceiving?: K6TrendDistribution;
  httpReqBlocked?: K6TrendDistribution;
  httpReqSending?: K6TrendDistribution;
  httpReqDurationExpected?: K6TrendDistribution;
  httpReqDurationCheckout?: K6TrendDistribution;
  iterationDuration?: K6TrendDistribution;
  pecpJourneyDurationMs?: K6TrendDistribution;
  pecpBusinessAttainmentEvents?: K6CounterMetric;
  pecpWorkloadArrivalDemand?: K6CounterMetric;
  pecpWorkloadAttainmentRate?: K6RateMetric;
  rootChecks: K6CheckMetric[];
  rawMetrics: Record<string, unknown>;
}

/**
 * Threshold observation status.
 * Invariant: Never translated into PECP PASS/FAIL in M3.2.
 */
export type ThresholdObservationStatus =
  | 'OBSERVED_PASSED'
  | 'OBSERVED_FAILED'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED';

export interface ThresholdObservation {
  metric: string;
  expression: string;
  status: ThresholdObservationStatus;
  engineResult: boolean | null;
  observedValue?: number | string;
  rawSource: unknown;
  rawThresholdValue?: unknown;
  parserSchemaVersion?: string;
}

/**
 * Scheduler execution observations.
 * Population: JOURNEY_ITERATION. Strictly distinct from business events.
 */
export interface SchedulerExecutionObservation {
  schedulerPopulation?: 'JOURNEY_ITERATION' | string;
  governedPeakRate?: number;
  scheduleIdentity?: string;
  actualIterations?: number;
  observedIterationRate?: number;
  droppedIterations?: number;
  droppedIterationRate?: number;
  arrivalDemandCounter?: number;
  arrivalDemandRate?: number;
}

/**
 * Business events observations.
 * Metric: e.g. orders. Strictly distinct from scheduler iterations.
 */
export interface BusinessEventsObservation {
  governedMetric?: string;
  governedTarget?: {
    value?: number;
    unit?: string;
  };
  observedEventCount?: number;
  observedRawRate?: number;
  referenceLabCorroboratingEventCount?: number;
}

/**
 * Reference Lab corroborating metrics and delta.
 */
export interface ReferenceLabCorroboration {
  sourceLocator?: string;
  totalRequestsDelta?: number;
  requestsByRoute?: Record<string, number>;
  statusCounts?: Record<string, number>;
  businessEventCounts: {
    orderCreatedEvents?: number;
  };
  captureTimestamps: {
    before?: string;
    after?: string;
  };
  durationSeconds?: number;
  consistency: {
    k6BusinessEventCount?: number;
    referenceLabOrderCreatedCount?: number;
    countsMatch?: boolean;
    discrepancyCount?: number;
    notes?: string;
  };
}

/**
 * Result Data Quality and Completeness Codes.
 */
export type ResultDataQualityIssueCode =
  | 'MISSING_MANIFEST'
  | 'MISSING_SUMMARY'
  | 'MISSING_REQUIRED_ARTIFACT'
  | 'CHECKSUM_MISMATCH'
  | 'MISSING_REQUIRED_BINDING'
  | 'MISSING_SOURCE_WORKLOAD_TARGET'
  | 'UNRESOLVED_SCHEDULE_POPULATION'
  | 'MALFORMED_METRIC'
  | 'PARSER_INCOMPATIBILITY'
  | 'MISSING_REQUIRED_CUSTOM_METRIC'
  | 'REFERENCE_LAB_METRICS_UNAVAILABLE'
  | 'BUSINESS_EVENT_COUNT_MISMATCH'
  | 'EXECUTION_OPERATIONAL_STATUS_NOT_COMPLETED'
  | 'CREDENTIAL_LEAKAGE_DETECTED';

export interface ResultDataQualityIssue {
  code: ResultDataQualityIssueCode;
  severity: 'FATAL' | 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  details?: Record<string, unknown>;
}

export interface ResultCompleteness {
  isComplete: boolean;
  hasIntegrityErrors: boolean;
  issues: ResultDataQualityIssue[];
}

/**
 * Time basis for workload attainment representation.
 */
export type AttainmentTimeBasis =
  | 'FULL_TEST_AVERAGE'
  | 'STEADY_STATE_PEAK'
  | 'UNRESOLVED_TIME_WINDOW';

/**
 * Derivation status of workload attainment.
 */
export type AttainmentDerivationStatus =
  | 'DETERMINISTICALLY_DERIVED'
  | 'EMITTED_AT_RUNTIME'
  | 'UNRESOLVED_INSUFFICIENT_TIME_SERIES';

/**
 * Workload attainment observation with mathematical lineage.
 * Invariant: Never evaluated into a PASS/FAIL verdict in M3.2.
 */
export interface WorkloadAttainmentObservation {
  governedDemand?: {
    metric?: string;
    targetValue?: number;
    unit?: string;
  };
  governedPopulation?: string;
  actualSourceMetric?: string;
  calculationFormula: string;
  units?: string;
  timeBasis: AttainmentTimeBasis;
  resultValue?: number;
  attainmentRatio?: number;
  derivationStatus: AttainmentDerivationStatus;
  derivationNotes: string;
}

/**
 * Governed Canonical Execution Result.
 * Aggregates execution run, raw evidence inventory, k6 metrics, scheduler observations,
 * business events, corroboration, threshold observations, workload attainment,
 * and data quality without assigning any performance verdict.
 */
export interface CanonicalExecutionResult {
  run: ExecutionRun;
  evidenceInventory: RawEvidenceInventory;
  metrics: K6SummaryMetrics;
  schedulerObservation: SchedulerExecutionObservation;
  businessEventsObservation: BusinessEventsObservation;
  referenceLabCorroboration?: ReferenceLabCorroboration;
  thresholdObservations: ThresholdObservation[];
  fullTestAverageObservation?: WorkloadAttainmentObservation;
  acceptanceBasisAttainment: WorkloadAttainmentObservation;
  workloadAttainmentObservation: WorkloadAttainmentObservation;
  dataQuality: ResultCompleteness;
  performanceVerdict: InvariantPerformanceVerdict;
  verdictDisclaimer: string;
}
