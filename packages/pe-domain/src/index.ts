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
