// MockSourceService
// Deterministic in-memory source service for MOCK mode only
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
import { ISourceService } from '../interfaces/ISourceService';

export class MockSourceService implements ISourceService {
  private sources: Map<string, SourceMetadata[]> = new Map();
  private versions: Map<string, SourceVersion[]> = new Map();
  private extractions: Map<string, ExtractionResult> = new Map();
  private checklists: Map<string, ProjectChecklist> = new Map();

  constructor() {
    this.seedMockData('proj-1');
  }

  private seedMockData(projectId: string) {
    const defaultSources: SourceMetadata[] = [
      {
        id: 'src-brief-1',
        projectId,
        organisationId: 'RetailCo',
        kind: 'BRIEF',
        title: 'Project Brief - Black Friday Peak',
        currentVersionNumber: 1,
        currentVersionId: 'ver-brief-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByUserId: 'user-lead-1',
        createdByUserDisplayName: 'Lead Architect'
      },
      {
        id: 'src-forecast-1',
        projectId,
        organisationId: 'RetailCo',
        kind: 'UPLOAD',
        title: 'Holiday_Peak_Forecast_2027.csv',
        currentVersionNumber: 1,
        currentVersionId: 'ver-forecast-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByUserId: 'user-lead-1',
        createdByUserDisplayName: 'Lead Architect'
      }
    ];

    this.sources.set(projectId, defaultSources);

    const defaultVersions: SourceVersion[] = [
      {
        id: 'ver-brief-1',
        sourceId: 'src-brief-1',
        projectId,
        organisationId: 'RetailCo',
        versionNumber: 1,
        byteSize: 1540,
        mediaType: 'text/markdown',
        format: 'MARKDOWN',
        sha256: 'sha256-mock-brief-digest-1',
        capturedAt: new Date().toISOString(),
        capturedByUserId: 'user-lead-1',
        capturedByUserDisplayName: 'Lead Architect',
        extractionStatus: 'SUCCESS'
      },
      {
        id: 'ver-forecast-1',
        sourceId: 'src-forecast-1',
        projectId,
        organisationId: 'RetailCo',
        versionNumber: 1,
        byteSize: 4200,
        mediaType: 'text/csv',
        format: 'CSV',
        sha256: 'sha256-mock-forecast-digest-1',
        capturedAt: new Date().toISOString(),
        capturedByUserId: 'user-lead-1',
        capturedByUserDisplayName: 'Lead Architect',
        extractionStatus: 'SUCCESS'
      }
    ];

    this.versions.set('src-brief-1', [defaultVersions[0]]);
    this.versions.set('src-forecast-1', [defaultVersions[1]]);

    this.extractions.set('ver-brief-1', {
      id: 'ext-brief-1',
      sourceVersionId: 'ver-brief-1',
      projectId,
      organisationId: 'RetailCo',
      status: 'SUCCESS',
      parserId: 'text-parser',
      parserVersion: '1.0.0',
      extractedAt: new Date().toISOString(),
      textLength: 74,
      contentDigest: 'sha256-brief-extracted',
      plainText: 'Support 100,000 users and keep checkout fast during the 2027 holiday peak.',
      fragments: [
        {
          id: 'frag-brief-1',
          extractionId: 'ext-brief-1',
          sourceVersionId: 'ver-brief-1',
          segmentIndex: 0,
          locator: 'char:0-74',
          text: 'Support 100,000 users and keep checkout fast during the 2027 holiday peak.'
        }
      ]
    });

    this.extractions.set('ver-forecast-1', {
      id: 'ext-forecast-1',
      sourceVersionId: 'ver-forecast-1',
      projectId,
      organisationId: 'RetailCo',
      status: 'SUCCESS',
      parserId: 'csv-parser',
      parserVersion: '1.0.0',
      extractedAt: new Date().toISOString(),
      textLength: 48,
      contentDigest: 'sha256-fc-extracted',
      plainText: 'peak_demand_orders,24000\ncheckout_latency_p95_ms,200',
      fragments: [
        {
          id: 'frag-fc-1',
          extractionId: 'ext-forecast-1',
          sourceVersionId: 'ver-forecast-1',
          segmentIndex: 0,
          locator: 'row:1,col:2',
          text: '24000'
        },
        {
          id: 'frag-fc-2',
          extractionId: 'ext-forecast-1',
          sourceVersionId: 'ver-forecast-1',
          segmentIndex: 1,
          locator: 'row:2,col:2',
          text: '200'
        }
      ]
    });

    this.checklists.set(projectId, {
      projectId,
      organisationId: 'RetailCo',
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 'system',
      items: [
        {
          key: 'peak_demand_orders',
          category: 'WORKLOAD',
          title: 'Peak Demand Orders',
          expectedUnit: 'orders/hr',
          required: true,
          description: 'Required hourly peak business throughput'
        },
        {
          key: 'checkout_latency_p95_ms',
          category: 'REQUIREMENTS',
          title: 'Checkout p95 Latency',
          expectedUnit: 'ms',
          required: true,
          description: 'Required 95th percentile checkout response time SLA'
        }
      ]
    });
  }

  async listSources(projectId: string): Promise<SourceMetadata[]> {
    return this.sources.get(projectId) || [];
  }

  async getSource(projectId: string, sourceId: string): Promise<SourceMetadata> {
    const list = this.sources.get(projectId) || [];
    const src = list.find((s) => s.id === sourceId);
    if (!src) throw new Error(`Source ${sourceId} not found`);
    return src;
  }

  async createBriefSource(projectId: string, text: string, title?: string): Promise<SourceMetadata> {
    const list = this.sources.get(projectId) || [];
    const id = `src-brief-${Date.now()}`;
    const versionId = `ver-${id}-1`;
    const newSrc: SourceMetadata = {
      id,
      projectId,
      organisationId: 'RetailCo',
      kind: 'BRIEF',
      title: title || 'Project Brief',
      currentVersionNumber: 1,
      currentVersionId: versionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUserId: 'mock-user',
      createdByUserDisplayName: 'Mock User'
    };
    list.push(newSrc);
    this.sources.set(projectId, list);

    const version: SourceVersion = {
      id: versionId,
      sourceId: id,
      projectId,
      organisationId: 'RetailCo',
      versionNumber: 1,
      byteSize: text.length,
      mediaType: 'text/markdown',
      format: 'MARKDOWN',
      sha256: 'sha256-mock-digest',
      capturedAt: new Date().toISOString(),
      capturedByUserId: 'mock-user',
      capturedByUserDisplayName: 'Mock User',
      extractionStatus: 'SUCCESS'
    };
    this.versions.set(id, [version]);

    this.extractions.set(versionId, {
      id: `ext-${versionId}`,
      sourceVersionId: versionId,
      projectId,
      organisationId: 'RetailCo',
      status: 'SUCCESS',
      parserId: 'text-parser',
      parserVersion: '1.0.0',
      extractedAt: new Date().toISOString(),
      textLength: text.length,
      contentDigest: 'sha256-mock-text',
      plainText: text,
      fragments: [
        {
          id: `frag-${versionId}-1`,
          extractionId: `ext-${versionId}`,
          sourceVersionId: versionId,
          segmentIndex: 0,
          locator: `char:0-${text.length}`,
          text
        }
      ]
    });

    return newSrc;
  }

  async createStatementSource(
    projectId: string,
    text: string,
    speaker: string,
    title?: string
  ): Promise<SourceMetadata> {
    const list = this.sources.get(projectId) || [];
    const id = `src-stmt-${Date.now()}`;
    const versionId = `ver-${id}-1`;
    const newSrc: SourceMetadata = {
      id,
      projectId,
      organisationId: 'RetailCo',
      kind: 'MANUAL_ASSERTION',
      title: title || `Statement - ${speaker}`,
      currentVersionNumber: 1,
      currentVersionId: versionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUserId: 'mock-user',
      createdByUserDisplayName: 'Mock User'
    };
    list.push(newSrc);
    this.sources.set(projectId, list);

    const version: SourceVersion = {
      id: versionId,
      sourceId: id,
      projectId,
      organisationId: 'RetailCo',
      versionNumber: 1,
      byteSize: text.length,
      mediaType: 'text/plain',
      format: 'PLAIN_TEXT',
      sha256: 'sha256-mock-stmt-digest',
      capturedAt: new Date().toISOString(),
      capturedByUserId: 'mock-user',
      capturedByUserDisplayName: 'Mock User',
      suppliedSpeaker: speaker,
      extractionStatus: 'SUCCESS'
    };
    this.versions.set(id, [version]);

    this.extractions.set(versionId, {
      id: `ext-${versionId}`,
      sourceVersionId: versionId,
      projectId,
      organisationId: 'RetailCo',
      status: 'SUCCESS',
      parserId: 'text-parser',
      parserVersion: '1.0.0',
      extractedAt: new Date().toISOString(),
      textLength: text.length,
      contentDigest: 'sha256-mock-stmt',
      plainText: text,
      fragments: [
        {
          id: `frag-${versionId}-1`,
          extractionId: `ext-${versionId}`,
          sourceVersionId: versionId,
          segmentIndex: 0,
          locator: `char:0-${text.length}`,
          text
        }
      ]
    });

    return newSrc;
  }

  async uploadSource(projectId: string, file: File): Promise<SourceMetadata> {
    const list = this.sources.get(projectId) || [];
    const id = `src-upload-${Date.now()}`;
    const versionId = `ver-${id}-1`;
    const newSrc: SourceMetadata = {
      id,
      projectId,
      organisationId: 'RetailCo',
      kind: 'UPLOAD',
      title: file.name,
      currentVersionNumber: 1,
      currentVersionId: versionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByUserId: 'mock-user',
      createdByUserDisplayName: 'Mock User'
    };
    list.push(newSrc);
    this.sources.set(projectId, list);

    const version: SourceVersion = {
      id: versionId,
      sourceId: id,
      projectId,
      organisationId: 'RetailCo',
      versionNumber: 1,
      byteSize: file.size,
      mediaType: file.type || 'application/octet-stream',
      format: file.name.endsWith('.csv') ? 'CSV' : file.name.endsWith('.json') ? 'JSON' : 'PLAIN_TEXT',
      sha256: 'sha256-mock-upload-digest',
      capturedAt: new Date().toISOString(),
      capturedByUserId: 'mock-user',
      capturedByUserDisplayName: 'Mock User',
      extractionStatus: 'SUCCESS'
    };
    this.versions.set(id, [version]);

    return newSrc;
  }

  async listVersions(projectId: string, sourceId: string): Promise<SourceVersion[]> {
    return this.versions.get(sourceId) || [];
  }

  async createVersion(
    projectId: string,
    sourceId: string,
    data: { text?: string; file?: File; baseRevision?: number }
  ): Promise<SourceVersion> {
    const vers = this.versions.get(sourceId) || [];
    const newVerNumber = vers.length + 1;
    const versionId = `ver-${sourceId}-${newVerNumber}`;
    const newVersion: SourceVersion = {
      id: versionId,
      sourceId,
      projectId,
      organisationId: 'RetailCo',
      versionNumber: newVerNumber,
      byteSize: data.file ? data.file.size : (data.text?.length || 0),
      mediaType: data.file ? data.file.type : 'text/plain',
      format: data.file?.name.endsWith('.csv') ? 'CSV' : 'PLAIN_TEXT',
      sha256: 'sha256-mock-new-digest',
      capturedAt: new Date().toISOString(),
      capturedByUserId: 'mock-user',
      capturedByUserDisplayName: 'Mock User',
      extractionStatus: 'SUCCESS'
    };
    vers.push(newVersion);
    this.versions.set(sourceId, vers);
    return newVersion;
  }

  async downloadContent(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<{ blob: Blob; filename?: string }> {
    const text = 'Mock original content';
    return {
      blob: new Blob([text], { type: 'text/plain' }),
      filename: `${sourceId}-${versionId}.txt`
    };
  }

  async extractVersion(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<ExtractionResult> {
    let res = this.extractions.get(versionId);
    if (!res) {
      res = {
        id: `ext-${versionId}`,
        sourceVersionId: versionId,
        projectId,
        organisationId: 'RetailCo',
        status: 'SUCCESS',
        parserId: 'mock-parser',
        parserVersion: '1.0.0',
        extractedAt: new Date().toISOString(),
        textLength: 26,
        contentDigest: 'sha256-sample',
        plainText: 'Extracted plain text sample',
        fragments: []
      };
      this.extractions.set(versionId, res);
    }
    return res;
  }

  async getExtraction(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<ExtractionResult | null> {
    return this.extractions.get(versionId) || null;
  }

  async getIntakeSummary(projectId: string): Promise<IntakeReviewSummary> {
    const list = this.sources.get(projectId) || [];
    return {
      policyVersion: '1.0.0',
      projectId,
      uploadedFilesCount: list.filter((s) => s.kind === 'UPLOAD').length,
      extractedSuccessCount: list.length,
      extractionFailedCount: 0,
      extractionPendingCount: 0,
      briefSourcesCount: list.filter((s) => s.kind === 'BRIEF').length,
      manualAssertionsCount: list.filter((s) => s.kind === 'MANUAL_ASSERTION').length,
      totalIntelligenceFields: 4,
      fieldsByCategory: {
        BUSINESS_CONTEXT: 0,
        WORKLOAD: 2,
        REQUIREMENTS: 2,
        ARCHITECTURE: 0,
        ACCEPTANCE_CRITERIA: 0,
        TEST_DATA: 0,
        ENVIRONMENT: 0,
        OBSERVABILITY: 0
      },
      unreviewedFieldsCount: 1,
      approvedFieldsCount: 2,
      pendingApprovalCount: 1,
      rejectedFieldsCount: 0,
      conflictingFieldsCount: 1,
      ambiguousFieldsCount: 0,
      staleFieldsCount: 0,
      configuredRequiredCount: 2,
      configuredMissingGapsCount: 0,
      checklistStatus: 'CONFIGURED',
      gaps: []
    };
  }

  async getChecklist(projectId: string): Promise<ProjectChecklist> {
    const existing = this.checklists.get(projectId);
    if (existing) return existing;
    return {
      projectId,
      organisationId: 'RetailCo',
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 'system',
      items: []
    };
  }

  async updateChecklist(
    projectId: string,
    items: RequiredFieldDefinition[],
    baseRevision: number
  ): Promise<ProjectChecklist> {
    const updated: ProjectChecklist = {
      projectId,
      organisationId: 'RetailCo',
      revision: baseRevision + 1,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 'mock-user',
      items
    };
    this.checklists.set(projectId, updated);
    return updated;
  }

  async importPreview(
    projectId: string,
    request: {
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
      delimiter?: string;
    }
  ): Promise<StructuredImportPreview> {
    return {
      sourceId: 'src-forecast-1',
      sourceVersionId: request.sourceVersionId,
      sourceVersionNumber: 1,
      sourceDigest: 'sha256-mock-source',
      format: 'CSV',
      mappingDigest: 'sha256-mock-mapping',
      validCount: 2,
      invalidCount: 0,
      proposedItems: [
        {
          key: 'peak_demand_orders',
          category: 'WORKLOAD',
          title: 'Peak Demand Orders',
          value: 24000,
          unit: 'orders/hr',
          sourceLocation: 'Row 1'
        }
      ]
    };
  }

  async importApply(
    projectId: string,
    request: {
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
      baseRevision?: number;
      delimiter?: string;
    }
  ): Promise<{ importedCount: number; items: IntelligenceItem[] }> {
    return {
      importedCount: 1,
      items: []
    };
  }

  async createIntelligenceItem(projectId: string, item: any): Promise<IntelligenceItem> {
    return {
      id: `item-${Date.now()}`,
      key: item.key,
      category: item.category,
      canonicalState: 'MANUAL',
      title: item.title,
      value: item.value,
      unit: item.unit,
      source: 'MANUAL',
      reviewStatus: 'FOUND',
      approvalState: 'PENDING_APPROVAL',
      history: [],
      capturedDate: new Date().toISOString()
    };
  }

  async patchIntelligenceItem(
    projectId: string,
    itemId: string,
    data: any
  ): Promise<IntelligenceItem> {
    return {
      id: itemId,
      key: data.key || 'key',
      category: data.category || 'WORKLOAD',
      canonicalState: 'MANUAL',
      title: data.title || 'Title',
      value: data.value || '100',
      unit: data.unit,
      source: 'MANUAL',
      reviewStatus: 'FOUND',
      approvalState: 'PENDING_APPROVAL',
      history: [],
      capturedDate: new Date().toISOString()
    };
  }

  async getIntelligenceHistory(projectId: string, itemId: string): Promise<any[]> {
    return [];
  }
}
