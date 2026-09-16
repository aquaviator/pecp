// PECP Core Domain Types
// Authoritative definitions following docs/PRODUCT_CONSTITUTION.md

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
