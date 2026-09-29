// ISourceService
// Defined according to M5.2 Work Package §11 [I09]

import {
  SourceMetadata,
  SourceVersion,
  ExtractionResult,
  IntakeReviewSummary,
  ProjectChecklist,
  RequiredFieldDefinition,
  StructuredImportFieldMapping,
  StructuredImportPreview,
  IntelligenceItem
} from '@pecp/pe-domain';

export interface ISourceService {
  listSources(projectId: string): Promise<SourceMetadata[]>;
  getSource(projectId: string, sourceId: string): Promise<SourceMetadata>;
  createBriefSource(projectId: string, text: string, title?: string): Promise<SourceMetadata>;
  createStatementSource(
    projectId: string,
    text: string,
    speaker: string,
    title?: string
  ): Promise<SourceMetadata>;
  uploadSource(projectId: string, file: File): Promise<SourceMetadata>;
  listVersions(projectId: string, sourceId: string): Promise<SourceVersion[]>;
  createVersion(
    projectId: string,
    sourceId: string,
    data: { text?: string; file?: File; baseRevision?: number }
  ): Promise<SourceVersion>;
  downloadContent(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<{ blob: Blob; filename?: string }>;
  extractVersion(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<ExtractionResult>;
  getExtraction(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<ExtractionResult | null>;
  getIntakeSummary(projectId: string): Promise<IntakeReviewSummary>;
  getChecklist(projectId: string): Promise<ProjectChecklist>;
  updateChecklist(
    projectId: string,
    items: RequiredFieldDefinition[],
    baseRevision: number
  ): Promise<ProjectChecklist>;
  importPreview(
    projectId: string,
    request: {
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
      delimiter?: string;
    }
  ): Promise<StructuredImportPreview>;
  importApply(
    projectId: string,
    request: {
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
      baseRevision?: number;
      delimiter?: string;
    }
  ): Promise<{ importedCount: number; items: IntelligenceItem[] }>;
  createIntelligenceItem(
    projectId: string,
    item: {
      key: string;
      category: string;
      title: string;
      value: string | number;
      unit?: string;
      sourceBinding?: any;
    }
  ): Promise<IntelligenceItem>;
  patchIntelligenceItem(
    projectId: string,
    itemId: string,
    data: {
      key?: string;
      category?: string;
      title?: string;
      value?: string | number;
      unit?: string;
      baseRevision: number;
      sourceBinding?: any;
    }
  ): Promise<IntelligenceItem>;
  getIntelligenceHistory(projectId: string, itemId: string): Promise<any[]>;
}
