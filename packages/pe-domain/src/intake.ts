// M5.2 Real Intelligence Intake, Source Provenance & Review Types
// Defined according to docs/work-packages/M5_2_REAL_INTELLIGENCE_INTAKE_SOURCE_PROVENANCE.md

import { CanonicalState, IntelligenceCategory, ReviewStatus, EngineeringIntent } from './index.js';

export type SourceKind = 'BRIEF' | 'MANUAL_ASSERTION' | 'UPLOAD';

export type SourceFormat =
  | 'PLAIN_TEXT'
  | 'MARKDOWN'
  | 'CSV'
  | 'JSON'
  | 'DOCX'
  | 'PDF'
  | 'UNSUPPORTED';

export type ExtractionStatus =
  | 'NOT_PROCESSED'
  | 'PENDING'
  | 'SUCCESS'
  | 'NO_EXTRACTABLE_TEXT'
  | 'NEEDS_MANUAL_REVIEW'
  | 'FAILED';

export interface SourceMetadata {
  id: string;
  projectId: string;
  organisationId: string;
  kind: SourceKind;
  title: string;
  currentVersionNumber: number;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  createdByUserDisplayName: string;
}

export interface SourceVersion {
  id: string;
  sourceId: string;
  projectId: string;
  organisationId: string;
  versionNumber: number;
  byteSize: number;
  mediaType: string;
  format: SourceFormat;
  sha256: string;
  capturedAt: string;
  capturedByUserId: string;
  capturedByUserDisplayName: string;
  suppliedAuthoredAt?: string | null;
  suppliedSpeaker?: string | null;
  suppliedExternalReference?: string | null;
  extractionStatus: ExtractionStatus;
  extractionId?: string | null;
  diagnostics?: string | null;
}

export interface ExtractedFragment {
  id: string;
  extractionId: string;
  sourceVersionId: string;
  segmentIndex: number;
  locator: string; // e.g. "line:1", "page:3", "doc:p[2]", "row:5,col:2", "/target/tps"
  text: string;
  characterOffset?: number;
  length?: number;
  metadataJson?: string | null;
}

export interface ExtractionResult {
  id: string;
  sourceVersionId: string;
  projectId: string;
  organisationId: string;
  status: ExtractionStatus;
  parserId: string;
  parserVersion: string;
  extractedAt: string;
  textLength: number;
  pageCount?: number | null;
  contentDigest: string; // SHA-256 of extracted normalized text
  diagnostics?: string | null;
  plainText: string;
  fragments: ExtractedFragment[];
}

export interface SourceBindingReference {
  projectId: string;
  sourceId: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  originalSha256: string;
  extractionId?: string | null;
  locator: string;
  excerpt?: string;
}

export interface IntelligenceApprovalSnapshot {
  revision: number;
  approvedAt: string;
  approvedByUserId: string;
  approvedByUserDisplayName: string;
  decisionNote?: string;
  boundSourceVersionIds: string[];
  value?: string | number;
  unit?: string;
}

export interface RequiredFieldDefinition {
  key: string;
  title: string;
  category: IntelligenceCategory;
  expectedValueKind?: 'STRING' | 'NUMBER' | 'ANY';
  expectedUnit?: string;
  required: boolean;
  description?: string;
}

export interface ProjectChecklist {
  projectId: string;
  organisationId: string;
  revision: number;
  updatedAt: string;
  updatedByUserId: string;
  items: RequiredFieldDefinition[];
}

export interface IntakeReviewSummary {
  policyVersion: string;
  projectId: string;
  uploadedFilesCount: number;
  extractedSuccessCount: number;
  extractionFailedCount: number;
  extractionPendingCount: number;
  extractionManualReviewCount: number;
  briefSourcesCount: number;
  manualAssertionsCount: number;
  totalIntelligenceFields: number;
  fieldsByCategory: Record<IntelligenceCategory, number>;
  unreviewedFieldsCount: number;
  approvedFieldsCount: number;
  pendingApprovalCount: number;
  rejectedFieldsCount: number;
  conflictingFieldsCount: number;
  ambiguousFieldsCount: number;
  staleFieldsCount: number;
  configuredRequiredCount: number;
  configuredMissingGapsCount: number;
  checklistStatus: 'NOT_CONFIGURED' | 'CONFIGURED';
  gaps: Array<{
    key: string;
    title: string;
    category: IntelligenceCategory;
    reason: 'MISSING' | 'AMBIGUOUS' | 'CONFLICTING' | 'STALE' | 'NOT_APPROVED' | 'INVALID_CONTRACT';
  }>;
}

export interface StructuredImportFieldMapping {
  sourceColumnOrKey: string;
  targetKey: string;
  title: string;
  category: IntelligenceCategory;
  valueKind: 'STRING' | 'NUMBER';
  unit?: string;
}

export interface StructuredImportPreviewItem {
  key: string;
  title: string;
  category: IntelligenceCategory;
  value: string | number;
  unit?: string;
  sourceLocation: string;
  excerpt?: string;
  validationError?: string;
}

export interface StructuredImportPreview {
  sourceId: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  sourceDigest: string;
  format: 'CSV' | 'JSON';
  proposedItems: StructuredImportPreviewItem[];
  validCount: number;
  invalidCount: number;
  mappingDigest: string;
}

export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < input.length && input[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < input.length && input[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Governed Intelligence-to-Performance Contract Compilation Models
// ---------------------------------------------------------------------------

export type FieldEligibilityStatus =
  | 'USABLE'
  | 'MISSING'
  | 'CONFLICTING'
  | 'AMBIGUOUS'
  | 'STALE'
  | 'UNAPPROVED'
  | 'INVALID_TYPE'
  | 'INVALID_OR_MISSING_UNIT'
  | 'INVALID_PROVENANCE';

export interface ContractFieldProvenance {
  fieldKey: string;
  intelligenceItemId: string;
  intelligenceRevision: number;
  canonicalState: CanonicalState;
  reviewStatus: ReviewStatus;
  approvalRevision?: number;
  approvedBy?: string;
  approvedAt?: string;
  decisionNote?: string;
  sourceId?: string;
  sourceVersionId?: string;
  sourceVersionNumber?: number;
  sourceSha256?: string;
  locator?: string;
  excerpt?: string;
  value: string | number;
  unit?: string;
}

export interface ContractBlockingIssue {
  fieldKey: string;
  title: string;
  issueType: string;
  reason: string;
  severity: 'BLOCKING' | 'WARNING';
  remediationGuidance: string;
  intelligenceItemId?: string;
}

export interface CompiledFieldValue {
  key: string;
  title: string;
  value: string | number;
  unit?: string;
  provenance: ContractFieldProvenance;
}

export interface PerformanceContractCompilationResult {
  projectId: string;
  projectName: string;
  engineeringIntent: EngineeringIntent;
  status: 'DRAFT' | 'BLOCKED' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'SUPERSEDED';
  isCompileReady: boolean;
  fingerprint: string;
  contract: any;
  compiledValues: Record<string, CompiledFieldValue>;
  blockingIssues: ContractBlockingIssue[];
  provenance: ContractFieldProvenance[];
  compiledAt: string;
}
