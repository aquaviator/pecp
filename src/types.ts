// PECP Core Domain Types according to Product Constitution v1.0

export type CanonicalState =
  | 'MISSING'
  | 'OBSERVED'
  | 'MANUAL'
  | 'IMPORTED'
  | 'INFERRED'
  | 'CALCULATED'
  | 'CONFLICTING'
  | 'STALE'
  | 'APPROVED'
  | 'SUPERSEDED';

export type EngineeringIntent =
  | 'DISCOVERY'
  | 'REPRESENTATIVE'
  | 'FORECAST'
  | 'INVESTIGATIVE'
  | 'CERTIFICATION';

export type EvaluationVerdict =
  | 'PASS'
  | 'FAIL'
  | 'PASS_WITH_OBSERVATION'
  | 'INCONCLUSIVE';

export type ProviderCategory =
  | 'RequirementProvider'
  | 'PublishingProvider'
  | 'ExecutionProvider'
  | 'TelemetryProvider'
  | 'SourceControlProvider'
  | 'PipelineProvider'
  | 'SecretProvider'
  | 'AIProvider';

export type ProviderMode = 'MOCK' | 'SANDBOX' | 'LIVE';

export interface ProvenanceInfo {
  source: string; // e.g. "Azure DevOps WorkItem #4092", "Dynatrace Telemetry", "Project Brief docx"
  sourceRef: string;
  sourceType: 'DOCUMENT' | 'MANUAL' | 'ALM' | 'TELEMETRY' | 'AI_EXTRACT' | 'ENGINEERING_CALC';
  timestamp: string;
  confidencePct: number;
  extractedBy?: string;
  approvedBy?: string;
  approvalTimestamp?: string;
  calculationLineage?: string;
  rationale?: string;
}

export interface IntelligenceItem {
  id: string;
  key: string;
  category: 'VOLUME' | 'LATENCY_SLA' | 'CONCURRENCY' | 'BUSINESS_MIX' | 'INFRASTRUCTURE' | 'AVAILABILITY';
  title: string;
  value: string | number;
  unit: string;
  canonicalState: CanonicalState;
  provenance: ProvenanceInfo;
  conflictingValue?: string | number;
  conflictingSource?: string;
  notes?: string;
}

export interface IntelligenceConflict {
  id: string;
  itemId: string;
  field: string;
  sourceA: {
    source: string;
    value: string | number;
    unit: string;
    state: CanonicalState;
    timestamp: string;
  };
  sourceB: {
    source: string;
    value: string | number;
    unit: string;
    state: CanonicalState;
    timestamp: string;
  };
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
  status: 'PENDING' | 'RESOLVED';
  resolutionNote?: string;
  selectedSource?: 'sourceA' | 'sourceB' | 'CUSTOM';
}

export interface UserJourney {
  id: string;
  name: string;
  description: string;
  mixPercentage: number;
  avgResponseTargetMs: number;
  p95TargetMs: number;
  thinkTimeSec: number;
  stepsCount: number;
  endpoint: string;
  criticalPath: boolean;
}

export interface WorkloadParameters {
  peakHourlyTransactions: number;
  targetTps: number;
  averageSessionDurationSec: number;
  calculatedVirtualUsers: number;
  littlesLawEquation: string;
  rampUpMinutes: number;
  steadyStateMinutes: number;
  rampDownMinutes: number;
  safetyMarginPct: number;
}

export interface PerformanceContract {
  id: string;
  version: string;
  title: string;
  intent: EngineeringIntent;
  targetEnvironment: string;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'SUPERSEDED';
  approvedAt?: string;
  approvedBy?: string;
  slaGates: {
    journeyId: string;
    journeyName: string;
    p95MaxMs: number;
    errorRateMaxPct: number;
    minimumThroughputTps: number;
  }[];
  concurrencyCap: number;
  failureThresholds: {
    overallErrorRatePct: number;
    consecutiveFailedHealthchecks: number;
  };
}

export interface EngineeringArtefact {
  id: string;
  type: 'STRATEGY' | 'TEST_PLAN' | 'WORKLOAD_MODEL' | 'NFR_REVIEW' | 'RISK_REGISTER' | 'RESULTS_REPORT' | 'EVIDENCE_PACKAGE';
  title: string;
  version: string;
  author: string;
  generatedDate: string;
  approvalStatus: 'DRAFT' | 'IN_REVIEW' | 'APPROVED';
  approvedBy?: string;
  markdownContent: string;
}

export interface K6ScenarioConfig {
  name: string;
  executor: 'ramping-vus' | 'constant-vus' | 'ramping-arrival-rate';
  stages: { duration: string; target: number }[];
  gracefulStop: string;
}

export interface K6TestDefinition {
  id: string;
  name: string;
  version: string;
  targetUrl: string;
  thresholds: Record<string, string[]>;
  scenarios: K6ScenarioConfig[];
  scriptCode: string;
  generatedAt: string;
}

export interface ExecutionMetricSample {
  timestampSec: number;
  currentVus: number;
  reqPerSec: number;
  p95LatencyMs: number;
  errorRatePct: number;
}

export interface ExecutionRun {
  id: string;
  runNumber: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  durationSec: number;
  peakVus: number;
  totalRequests: number;
  averageTps: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePct: number;
  verdict: EvaluationVerdict;
  observations: string[];
  metricsTimeline: ExecutionMetricSample[];
}

export interface PerformanceFinding {
  id: string;
  code: string;
  title: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
  category: 'LATENCY_DEGRADATION' | 'SATURATION_LIMIT' | 'ERROR_SPIKE' | 'CAPACITY_CLIFF' | 'RESOURCE_CONTENTION';
  journey: string;
  description: string;
  evidence: string;
  recommendation: string;
  exportedToALM?: boolean;
  ticketRef?: string;
}

export interface ProviderConnector {
  category: ProviderCategory;
  name: string;
  mode: ProviderMode;
  status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED';
  details: string;
}
