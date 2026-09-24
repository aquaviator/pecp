// PECP Core Domain Types & Authoritative Shared Contracts
// Defined according to docs/PRODUCT_CONSTITUTION.md and docs/work-packages/M1_INTELLIGENCE_TO_CONTRACT.md

/**
 * Canonical intelligence/provenance state according to Constitution §7.
 * Governs the authoritative engineering state and lineage of values.
 */
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

/**
 * Review & readiness display status for triage, inspection, and gap analysis.
 * Distinct from the underlying canonical lifecycle state.
 */
export type ReviewStatus =
  | 'FOUND'
  | 'MISSING'
  | 'AMBIGUOUS'
  | 'CONFLICTING'
  | 'STALE';

/**
 * Performance Engineering Intents (Constitution §6)
 */
export type EngineeringIntent =
  | 'DISCOVERY'
  | 'REPRESENTATIVE'
  | 'FORECAST'
  | 'INVESTIGATIVE'
  | 'CERTIFICATION';

/**
 * Project initiation methods supported in PECP portal
 */
export type ProjectCreationMethod =
  | 'BRIEF'
  | 'UPLOAD_DOCUMENTS'
  | 'CONNECT_EXISTING'
  | 'ANALYSE_EXISTING';

export type IntegrationMode = 'MOCK' | 'SANDBOX' | 'LIVE';

export type IntegrationStatus = 'NOT_CONFIGURED' | 'CONFIGURED' | 'DISABLED';

export type IntelligenceCategory =
  | 'BUSINESS_CONTEXT'
  | 'WORKLOAD'
  | 'REQUIREMENTS'
  | 'ARCHITECTURE'
  | 'ACCEPTANCE_CRITERIA'
  | 'TEST_DATA'
  | 'ENVIRONMENT'
  | 'OBSERVABILITY';

export interface ProjectSummary {
  id: string;
  name: string;
  organisation: string;
  organisationId?: string;
  intent: EngineeringIntent;
  description: string;
  createdDate: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  documentsCount: number;
  requirementsCount: number;
  conflictsCount: number;
}

export interface IntelligenceCandidate {
  id: string;
  value: string | number;
  unit?: string;
  source: string;
  sourceDocument: string;
  sourceLocation: string;
  canonicalState: CanonicalState;
  reviewStatus: ReviewStatus;
  capturedDate: string;
  notes?: string;
}

export interface IntelligenceItemHistory {
  date: string;
  action: string;
  actor: string;
  note?: string;
}

export interface IntelligenceItem {
  id: string;
  key: string;
  title: string;
  category: IntelligenceCategory;
  canonicalState: CanonicalState;
  reviewStatus: ReviewStatus;
  unit?: string;
  value?: string | number;
  source?: string;
  sourceDocument?: string;
  sourceLocation?: string;
  capturedDate?: string;
  approvalState?: 'UNREVIEWED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvalDate?: string;
  ambiguityReason?: string;
  candidates?: IntelligenceCandidate[]; // For conflicting items
  history: IntelligenceItemHistory[];
  notes?: string;
}

export interface ReadinessSection {
  id: string;
  title: string;
  status: 'VERIFIED' | 'ATTENTION_REQUIRED' | 'INCOMPLETE';
  summary: string;
  verifiedCount: number;
  totalCount: number;
  notes: string;
}

export interface IntelligenceReviewSummary {
  documentsAnalysed: number;
  requirementsFound: number;
  performanceRequirements: number;
  conflicts: number;
  missingInformation: number;
  readinessSections: ReadinessSection[];
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: 'ALM' | 'DOCUMENTS' | 'AI' | 'TESTING_ENGINE' | 'OBSERVABILITY';
  description: string;
  status: IntegrationStatus;
  availableModes: IntegrationMode[];
  currentMode?: IntegrationMode;
  configSummary?: string;
}

// ---------------------------------------------------------------------------
// Workload Engine & Calculation Lineage Domain Models (M1)
// ---------------------------------------------------------------------------

export type ThroughputUnit = 'per_hour' | 'per_minute' | 'per_second';

export type TimeUnit = 'seconds' | 'minutes' | 'hours';

export interface CalculationLineageStep {
  operator: string;
  operand: number;
  unit?: string;
  result: number;
  description: string;
}

export interface CalculationLineageInput {
  parameter: string;
  value: number | string;
  unit?: string;
  sourceId?: string;
  sourceTitle?: string;
}

export interface CalculationLineage {
  calculationId: string;
  outputParameter: string;
  outputValue: number;
  unit: string;
  formulaIdentifier: string;
  humanReadableExplanation: string;
  derivationSteps?: string[];
  structuredSteps?: CalculationLineageStep[];
  inputValues: CalculationLineageInput[];
  sourceIntelligenceIds: string[];
  timestamp: string;
  version?: string;
  warnings?: string[];
  assumptions?: string[];
}

export interface BlockedCalculation {
  calculationId: string;
  outputParameter: string;
  status: 'BLOCKED';
  calculated: false;
  formulaIdentifier: string;
  reason: string;
  requiredIntelligence: string[];
  missingPrerequisites: string[];
  availableInputs: CalculationLineageInput[];
}

export interface WorkloadInput {
  id: string;
  key: string;
  title: string;
  value: number | string;
  unit: string;
  canonicalState: CanonicalState;
  reviewStatus: ReviewStatus;
  sourceId: string;
  sourceDocument?: string;
  sourceLocation?: string;
  notes?: string;
}

export interface ThroughputConversion {
  baseRate: number;
  baseUnit: ThroughputUnit;
  hourlyRate: number;
  perMinuteRate: number;
  perSecondRate: number;
  lineage: CalculationLineage;
  semanticNotice: string;
}

export interface JourneyDistributionItem {
  id: string;
  name: string;
  percentage: number; // 0 to 100
  weight: number; // 0.0 to 1.0
  sourceId?: string;
}

export interface JourneyDistribution {
  journeys: JourneyDistributionItem[];
  totalPercentage: number;
  isValid: boolean;
  tolerance: number;
  validationError?: string;
  sourceIntelligenceIds: string[];
}

export type WorkloadIssueType =
  | 'MISSING_PREREQUISITE'
  | 'AMBIGUOUS_SOURCE'
  | 'CONFLICTING_SOURCE'
  | 'UNAPPROVED_CRITICAL_VALUE'
  | 'INCOMPATIBLE_UNITS_SEMANTICS'
  | 'INVALID_JOURNEY_DISTRIBUTION';

export type WorkloadIssueSeverity = 'BLOCKING' | 'WARNING';

export interface WorkloadIssue {
  id: string;
  type: WorkloadIssueType;
  parameter: string;
  description: string;
  severity: WorkloadIssueSeverity;
  sourceIntelligenceId?: string;
  remediationGuidance: string;
}

export type WorkloadReadinessStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

export interface WorkloadReadiness {
  status: WorkloadReadinessStatus;
  isReady: boolean;
  blockingIssuesCount: number;
  warningIssuesCount: number;
  issues: WorkloadIssue[];
  summary: string;
}

export interface WorkloadModel {
  id: string;
  projectId: string;
  version: string;
  inputs: WorkloadInput[];
  throughput?: ThroughputConversion;
  journeyDistribution?: JourneyDistribution;
  concurrencyCalculation?: CalculationLineage | BlockedCalculation;
  additionalCalculations: CalculationLineage[];
  blockedCalculations: BlockedCalculation[];
  readiness: WorkloadReadiness;
  compiledDate: string;
}

// ---------------------------------------------------------------------------
// Performance Contract Domain Models (M1)
// ---------------------------------------------------------------------------

export type ContractStatus =
  | 'DRAFT'
  | 'BLOCKED'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'SUPERSEDED';

export type PerformanceContractStatus = ContractStatus;

export type AcceptanceCriterionStatus =
  | 'DEFINED'
  | 'AMBIGUOUS'
  | 'UNRESOLVED'
  | 'CONFLICTING';

export interface AcceptanceCriterion {
  id: string;
  key: string;
  metric: string;
  target: string;
  operator?: '<' | '<=' | '>' | '>=' | '==' | 'BETWEEN';
  thresholdValue?: number;
  unit: string;
  percentile?: number; // e.g. 95, 99
  scope: string; // e.g. 'Checkout API', 'Global', 'Search'
  status: AcceptanceCriterionStatus;
  ambiguityNotice?: string;
  sourceIntelligenceId?: string;
  isBlockingForApproval: boolean;
}

export interface ContractApprovalReadiness {
  canApprove: boolean;
  blockingReasons: string[];
  unresolvedIssuesCount: number;
}

export interface PerformanceContract {
  id: string;
  projectId: string;
  projectName: string;
  version: string;
  engineeringIntent: EngineeringIntent;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  sourceIntelligenceReferences: Array<{
    id: string;
    key: string;
    title: string;
    canonicalState: CanonicalState;
    reviewStatus: ReviewStatus;
  }>;
  workloadInputs: WorkloadInput[];
  workloadCalculations: CalculationLineage[];
  blockedWorkloadCalculations: BlockedCalculation[];
  workloadReadiness: WorkloadReadiness;
  acceptanceCriteria: AcceptanceCriterion[];
  unresolvedIssues: WorkloadIssue[];
  calculationLineageReferences: string[];
  approvalReadiness: ContractApprovalReadiness;
  approvedBy?: string;
  approvedAt?: string;
}

// ---------------------------------------------------------------------------
// Engineering Artefacts Domain Models (M2)
// ---------------------------------------------------------------------------

export type ArtefactType = 'PERFORMANCE_STRATEGY' | 'PERFORMANCE_TEST_PLAN';

export type ArtefactStatus =
  | 'DRAFT'
  | 'BLOCKED'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'STALE'
  | 'SUPERSEDED';

export type ArtefactVersion = string;

export type ArtefactSectionStatus =
  | 'COMPLETE'
  | 'UNRESOLVED'
  | 'NOT_SUPPLIED'
  | 'BLOCKED';

export type ArtefactCalloutType = 'INFO' | 'WARNING' | 'BLOCKER' | 'ASSUMPTION' | 'GUIDANCE';

export interface ArtefactCallout {
  id?: string;
  type: ArtefactCalloutType;
  text: string;
  sourceIntelligenceId?: string;
}

export interface ArtefactTable {
  id: string;
  caption?: string;
  headers: string[];
  rows: Array<Array<string | number | boolean>>;
}

export interface ArtefactSection {
  id: string;
  sectionNumber: string; // e.g. "1.0", "7.0", "7.1"
  title: string;
  status?: ArtefactSectionStatus;
  summary?: string;
  paragraphs?: string[];
  subsections?: ArtefactSection[];
  tables?: ArtefactTable[];
  callouts?: ArtefactCallout[];
  sourceIntelligenceIds?: string[];
}

export interface ArtefactSourceReference {
  id: string;
  key: string;
  title: string;
  canonicalState: CanonicalState;
  reviewStatus: ReviewStatus;
  sourceDocument?: string;
  sourceLocation?: string;
}

export interface ArtefactIssue {
  id: string;
  title: string;
  description: string;
  severity: 'BLOCKING' | 'WARNING';
  category:
    | 'WORKLOAD'
    | 'ACCEPTANCE_CRITERIA'
    | 'ENVIRONMENT'
    | 'TEST_DATA'
    | 'OBSERVABILITY'
    | 'GOVERNANCE';
  sourceIntelligenceId?: string;
  remediationGuidance?: string;
}

export interface ArtefactApprovalReadiness {
  canApprove: boolean;
  status: ArtefactStatus;
  blockingReasons: string[];
  unresolvedIssuesCount: number;
}

export interface ArtefactMetadata {
  author?: string;
  organisation?: string;
  classification?: string;
  targetAudience?: string;
  governanceGate?: string;
  [key: string]: unknown;
}

export interface EngineeringArtefact {
  id: string;
  projectId: string;
  projectName: string;
  type: ArtefactType;
  title: string;
  version: ArtefactVersion;
  status: ArtefactStatus;
  engineeringIntent: EngineeringIntent;
  sourceContractId: string;
  sourceContractVersion: string;
  sourceContractFingerprint: string;
  sourceIntelligenceReferences: ArtefactSourceReference[];
  generationTimestamp: string;
  sections: ArtefactSection[];
  unresolvedIssues: ArtefactIssue[];
  approvalReadiness: ArtefactApprovalReadiness;
  metadata?: ArtefactMetadata;
}

export interface ArtefactStalenessResult {
  isStale: boolean;
  reasons: string[];
  currentContractVersion: string;
  artefactContractVersion: string;
  currentContractFingerprint: string;
  artefactContractFingerprint: string;
}

// ---------------------------------------------------------------------------
// Canonical Test Definition & Executable Test Models (M3)
// Engine-neutral domain contracts according to Constitution §10 and M3.0
// ---------------------------------------------------------------------------

export type TestDefinitionStatus =
  | 'DRAFT'
  | 'BLOCKED'
  | 'NOT_EXECUTABLE'
  | 'READY_FOR_EXECUTION'
  | 'APPROVED'
  | 'SUPERSEDED';

export type ExecutionModel = 'OPEN' | 'CLOSED';

/**
 * Governed secret/credential reference (Constitution §11).
 * Never embeds raw tokens, keys, or passwords.
 */
export interface CredentialReference {
  provider: string; // e.g. 'VAULT', 'AZURE_KEY_VAULT', 'ENV_VAR', 'CI_SECRET'
  referenceId: string; // e.g. 'RETAILCO_CHECKOUT_AUTH_TOKEN'
  purpose: string; // e.g. 'Checkout API Authorization'
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type RequestPayloadType = 'JSON_LITERAL' | 'DATA_REFERENCE' | 'TEMPLATE_REFERENCE';

export interface RequestPayloadDefinition {
  type: RequestPayloadType;
  value: Record<string, unknown> | string;
  contentType?: string; // default 'application/json'
  description?: string;
}

export interface JourneyStep {
  id: string;
  name: string;
  method: HttpMethod;
  path: string; // endpoint path or URI pattern, e.g. '/api/v1/orders'
  expectedStatusCode?: number;
  thinkTimeSeconds?: number;
  payloadDescription?: string;
  requestPayload?: RequestPayloadDefinition;
  headers?: Record<string, string>;
  credentialReferences?: CredentialReference[];
  businessEventContribution?: BusinessEventContribution;
}

export interface BusinessEventContribution {
  eventKey: string; // e.g. 'order_created'
  metric: string; // e.g. 'orders'
  unit: string; // e.g. 'orders'
  contribution: number; // e.g. 1
  expectedStatus: number; // e.g. 201
  description?: string;
}

export type SchedulerArrivalPopulation =
  | 'JOURNEY_ITERATION'
  | 'SESSION'
  | 'TRANSACTION'
  | 'ITERATION';

export interface WorkloadPopulationRelationship {
  id: string;
  formulaIdentifier: string; // e.g. 'TARGET_DIVIDED_BY_JOURNEY_SHARE'
  inputBusinessTarget: {
    value: number; // e.g. 8.75
    unit: string; // e.g. 'orders/second'
    sourceCalculationId?: string;
  };
  relevantJourneyKey: string; // e.g. 'checkout'
  journeyShare: number; // e.g. 0.08 (8%)
  contributionPerSuccessfulEvent: number; // e.g. 1
  outputSchedulerRate: {
    value: number; // e.g. 109.375
    population: SchedulerArrivalPopulation; // 'JOURNEY_ITERATION'
    unit: string; // 'journey_iterations/second'
  };
  description: string;
  sourceIntelligenceIds?: string[];
}

export interface JourneyDefinition {
  id: string;
  key: string; // e.g. 'browse', 'search', 'basket', 'checkout', 'account'
  name: string;
  weight: number; // 0.0 to 1.0 (e.g. 0.35)
  percentage: number; // 0 to 100 (e.g. 35)
  steps: JourneyStep[];
  sourceIntelligenceIds?: string[];
  description?: string;
}

export interface ScheduleStage {
  durationSeconds: number;
  targetArrivalRate: number; // arrivals per second
  description?: string;
}

export interface WorkloadSchedule {
  id: string;
  executionModel: ExecutionModel;
  arrivalPopulation?: SchedulerArrivalPopulation;
  populationRelationship?: WorkloadPopulationRelationship;
  stages: ScheduleStage[];
  totalDurationSeconds: number;
  peakArrivalRate: number;
  rateUnit: string; // e.g. 'journey_iterations/second', 'orders/second'
  timeUnit: 'seconds' | 'minutes';
  startRate?: number; // Explicit initial arrival rate (e.g. 0 for ramp-up from zero)
  sourceIntelligenceIds?: string[];
}

/**
 * Strict separation: Workload attainment requirement is a prerequisite
 * for test validity, NOT an NFR response-time criterion (Constitution §10, M2.1 Law 4).
 */
export interface WorkloadAttainmentRequirement {
  metric: string; // e.g. 'Target Arrival Throughput'
  targetValue: number; // e.g. 8.75
  unit: string; // e.g. 'orders/second'
  evaluationType: 'WORKLOAD_DEMAND';
  description: string;
  tolerancePercentage?: number; // e.g. 5%
  isPrerequisiteForEvaluation: true;
}

export interface ExecutionPrecondition {
  id: string;
  category: 'ENVIRONMENT' | 'TEST_DATA' | 'OBSERVABILITY' | 'GOVERNANCE';
  statement: string;
  isSatisfied: boolean;
  isMandatory?: boolean; // Defaults to true: mandatory unsatisfied preconditions gate execution
  sourceIntelligenceId?: string;
  verificationMethod?: string;
}

export interface ExecutionParameter {
  key: string;
  label: string;
  value: string | number | boolean;
  isSupplied: boolean;
  unit?: string;
  sourceIntelligenceId?: string;
}

export type TestDefinitionIssueSeverity = 'BLOCKING' | 'WARNING';

export type TestDefinitionIssueType =
  | 'UPSTREAM_CONTRACT_BLOCKED'
  | 'UPSTREAM_CONTRACT_NOT_APPROVED'
  | 'NOT_SUPPLIED'
  | 'AMBIGUOUS_CRITERIA'
  | 'UNRESOLVED_SCHEDULE'
  | 'MISSING_ENVIRONMENT'
  | 'MISSING_TEST_DATA'
  | 'MISSING_OBSERVABILITY'
  | 'UNAPPROVED_VALUE'
  | 'UNSATISFIED_PRECONDITION'
  | 'INVALID_EXECUTION_STRUCTURE'
  | 'INVALID_POPULATION_SEMANTICS'
  | 'MISSING_POPULATION_RELATIONSHIP'
  | 'BUSINESS_WORKLOAD_UNIT_ON_MIXED_SCHEDULE'
  | 'POPULATION_RELATIONSHIP_MISSING'
  | 'POPULATION_RELATIONSHIP_MISMATCH'
  | 'PROVIDER_UNSUPPORTED_CRITERION'
  | 'PROVIDER_INCOMPATIBLE_RATE_UNIT';

export interface TestDefinitionIssue {
  id: string;
  type: TestDefinitionIssueType;
  severity: TestDefinitionIssueSeverity;
  parameter: string;
  description: string;
  remediationGuidance: string;
  sourceIntelligenceId?: string;
}

export interface TestScenario {
  id: string;
  name: string;
  engineeringIntent: EngineeringIntent;
  workloadSchedule: WorkloadSchedule;
  journeyDistribution: JourneyDefinition[];
  attainmentRequirement?: WorkloadAttainmentRequirement;
  populationRelationship?: WorkloadPopulationRelationship;
  targetEnvironmentBaseUrlRef: string;
}

export interface K6ProviderCapacityConfig {
  preAllocatedVUs: number;
  maxVUs: number;
  rateTimeUnit?: string; // e.g. '1s'
}

export interface K6ProviderDerivedCapacity {
  policyId: string;
  policyVersion: string;
  ruleIdentifier: string;
  sourcePeakArrivalRate: number;
  preAllocatedVUs: number;
  maxVUs: number;
  rateTimeUnit: string;
  formulaDescription: string;
  isProviderDerived: boolean;
}

export interface ExecutionIntelligenceOverrides {
  schedule?: WorkloadSchedule;
  journeys?: JourneyDefinition[];
  populationRelationship?: WorkloadPopulationRelationship;
  targetEnvironmentBaseUrlRef?: string;
  testDataIdentifiers?: string[];
  preconditions?: ExecutionPrecondition[];
  credentialReferences?: CredentialReference[];
  workloadTolerancePercentage?: number;
  k6ProviderCapacity?: K6ProviderCapacityConfig;
}

/**
 * Engine-neutral Canonical Test Definition.
 * Completely independent of k6 / JMeter syntax.
 */
export interface TestDefinition {
  id: string;
  projectId: string;
  projectName: string;
  version: string;
  status: TestDefinitionStatus;
  engineeringIntent: EngineeringIntent;
  sourceContractId: string;
  sourceContractVersion: string;
  sourceContractFingerprint: string;
  sourceContractStatus?: PerformanceContractStatus;
  fingerprint: string; // Deterministic non-cryptographic drift checksum
  generationTimestamp: string;
  scenarios: TestScenario[];
  journeys: JourneyDefinition[];
  preconditions: ExecutionPrecondition[];
  parameters: ExecutionParameter[];
  executableCriteria: AcceptanceCriterion[]; // ONLY defined, non-ambiguous criteria!
  ambiguousCriteria: AcceptanceCriterion[]; // Excluded from k6 thresholds, surfaced as issues
  workloadAttainment?: WorkloadAttainmentRequirement;
  populationRelationship?: WorkloadPopulationRelationship;
  issues: TestDefinitionIssue[];
  isExecutable: boolean;
  blockingReasons: string[];
  credentialReferences: CredentialReference[];
}

// ---------------------------------------------------------------------------
// k6 Execution Provider / Bundle Domain Models (M3.0)
// ---------------------------------------------------------------------------

export interface K6Threshold {
  metric: string; // e.g. 'http_req_duration{journey:checkout}', 'http_req_failed'
  thresholdExpressions: string[]; // e.g. ['p(95)<2000']
  sourceCriterionId?: string;
}

export interface K6ScenarioConfig {
  executor: 'ramping-arrival-rate' | 'constant-arrival-rate';
  rate?: number; // for constant-arrival-rate
  startRate?: number; // for ramping-arrival-rate
  timeUnit: string;
  preAllocatedVUs: number;
  maxVUs: number;
  stages?: Array<{ target: number; duration: string }>;
  duration?: string;
  exec?: string;
}

export interface K6Options {
  scenarios: Record<string, K6ScenarioConfig>;
  thresholds: Record<string, string[]>;
  summaryTrendStats?: string[];
  ext?: {
    pecp?: {
      testDefinitionId: string;
      testDefinitionVersion: string;
      testDefinitionFingerprint: string;
      sourceContractId: string;
      sourceContractVersion: string;
      sourceContractFingerprint: string;
      generatedAt: string;
      runtimeVersion?: string;
      runtimeSourceId?: string;
      schedulerArrival?: {
        population: SchedulerArrivalPopulation;
        peakRate: number;
        unit: string;
      };
      populationRelationship?: WorkloadPopulationRelationship;
      workloadAttainment?: {
        metric: string;
        targetValue: number;
        unit: string;
        tolerancePercentage?: number;
      };
      providerCapacity?: K6ProviderDerivedCapacity;
      targetEnvironmentBaseUrlRef: string;
      credentialReferences: CredentialReference[];
    };
  };
}

export interface K6ExecutionBundleFile {
  filename: string;
  path: string;
  content: string;
  language: 'json' | 'javascript';
  description: string;
}

export interface K6ExecutionBundle {
  id: string;
  testDefinitionId: string;
  testDefinitionVersion: string;
  testDefinitionFingerprint: string;
  fingerprint: string; // Deterministic non-cryptographic drift checksum
  generatedAt: string;
  runtimeVersion?: string;
  runtimeSourceId?: string;
  isExecutable: boolean;
  nonExecutableReasons: string[];
  options: K6Options;
  files: K6ExecutionBundleFile[];
  summary: {
    scenariosCount: number;
    journeysCount: number;
    thresholdsCount: number;
    ambiguousCriteriaExcludedCount: number;
    credentialReferencesCount: number;
  };
}

/**
 * Computes a deterministic, non-cryptographic drift checksum/fingerprint of a Performance Contract.
 * Detects structural or value drift in calculations, criteria, readiness, or issues.
 * Uses 32-bit FNV-1a for lightweight, environment-agnostic drift detection.
 * NOTE: This is a deterministic drift checksum, NOT a cryptographic hash or signature.
 */
export function computeContractFingerprint(contract: PerformanceContract): string {
  const digestPayload = {
    id: contract.id,
    version: contract.version,
    status: contract.status,
    intent: contract.engineeringIntent,
    calculations: contract.workloadCalculations.map((c) => ({
      id: c.calculationId,
      param: c.outputParameter,
      value: c.outputValue,
      unit: c.unit
    })),
    blockedCalculations: contract.blockedWorkloadCalculations.map((bc) => ({
      id: bc.calculationId,
      param: bc.outputParameter,
      reason: bc.reason
    })),
    criteria: contract.acceptanceCriteria.map((ac) => ({
      id: ac.id,
      metric: ac.metric,
      target: ac.target,
      status: ac.status,
      percentile: ac.percentile
    })),
    issues: contract.unresolvedIssues.map((issue) => ({
      id: issue.id,
      type: issue.type,
      severity: issue.severity
    })),
    canApprove: contract.approvalReadiness.canApprove
  };

  const str = JSON.stringify(digestPayload);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export * from './results.js';
export * from './acceptance.js';
export * from './findings.js';
export * from './evidencePackage.js';
export * from './exportPublication.js';

