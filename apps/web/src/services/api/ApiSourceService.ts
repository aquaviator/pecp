// ApiSourceService
// Defined according to M5.2 Work Package §10 & §11 [I08, I09]

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
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiSourceService implements ISourceService {
  private readonly client: ApiClient;

  constructor(clientOrBaseUrl?: ApiClient | string) {
    if (clientOrBaseUrl instanceof ApiClient) {
      this.client = clientOrBaseUrl;
    } else if (typeof clientOrBaseUrl === 'string') {
      this.client = new ApiClient(clientOrBaseUrl);
    } else {
      this.client = defaultApiClient;
    }
  }

  async listSources(projectId: string): Promise<SourceMetadata[]> {
    const res = await this.client.get<{ sources: SourceMetadata[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources`
    );
    return res.sources || [];
  }

  async getSource(projectId: string, sourceId: string): Promise<SourceMetadata> {
    return this.client.get<SourceMetadata>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}`
    );
  }

  async createBriefSource(projectId: string, text: string, title?: string): Promise<SourceMetadata> {
    return this.client.post<SourceMetadata>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/text`,
      {
        kind: 'BRIEF',
        text,
        title: title || 'Project Brief'
      }
    );
  }

  async createStatementSource(
    projectId: string,
    text: string,
    speaker: string,
    title?: string
  ): Promise<SourceMetadata> {
    return this.client.post<SourceMetadata>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/text`,
      {
        kind: 'MANUAL_ASSERTION',
        text,
        speaker,
        title: title || `Statement - ${speaker}`
      }
    );
  }

  async uploadSource(projectId: string, file: File): Promise<SourceMetadata> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.client.upload<SourceMetadata>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/upload`,
      formData
    );
  }

  async listVersions(projectId: string, sourceId: string): Promise<SourceVersion[]> {
    const res = await this.client.get<{ versions: SourceVersion[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/versions`
    );
    return res.versions || [];
  }

  async createVersion(
    projectId: string,
    sourceId: string,
    data: { text?: string; file?: File; baseRevision?: number }
  ): Promise<SourceVersion> {
    if (data.file) {
      const formData = new FormData();
      formData.append('file', data.file, data.file.name);
      if (data.baseRevision !== undefined) {
        formData.append('baseRevision', String(data.baseRevision));
      }
      return this.client.upload<SourceVersion>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/versions`,
        formData
      );
    }
    return this.client.post<SourceVersion>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/versions`,
      {
        text: data.text,
        baseRevision: data.baseRevision
      }
    );
  }

  async downloadContent(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<{ blob: Blob; filename?: string }> {
    return this.client.downloadBlob(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/versions/${encodeURIComponent(versionId)}/content`
    );
  }

  async extractVersion(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<ExtractionResult> {
    return this.client.post<ExtractionResult>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/versions/${encodeURIComponent(versionId)}/extract`,
      {}
    );
  }

  async getExtraction(
    projectId: string,
    sourceId: string,
    versionId: string
  ): Promise<ExtractionResult | null> {
    try {
      return await this.client.get<ExtractionResult>(
        `/api/v1/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/versions/${encodeURIComponent(versionId)}/extraction`
      );
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async getIntakeSummary(projectId: string): Promise<IntakeReviewSummary> {
    return this.client.get<IntakeReviewSummary>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence-intake-summary`
    );
  }

  async getChecklist(projectId: string): Promise<ProjectChecklist> {
    return this.client.get<ProjectChecklist>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence-requirements`
    );
  }

  async updateChecklist(
    projectId: string,
    items: RequiredFieldDefinition[],
    baseRevision: number
  ): Promise<ProjectChecklist> {
    return this.client.put<ProjectChecklist>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence-requirements`,
      {
        items,
        baseRevision
      }
    );
  }

  async importPreview(
    projectId: string,
    request: {
      sourceVersionId: string;
      mappings: StructuredImportFieldMapping[];
      delimiter?: string;
    }
  ): Promise<StructuredImportPreview> {
    return this.client.post<StructuredImportPreview>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/import-preview`,
      request
    );
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
    return this.client.post<{ importedCount: number; items: IntelligenceItem[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/import-apply`,
      request
    );
  }

  async createIntelligenceItem(
    projectId: string,
    item: {
      key: string;
      category: string;
      title: string;
      value: string | number;
      unit?: string;
      sourceBinding?: any;
    }
  ): Promise<IntelligenceItem> {
    return this.client.post<IntelligenceItem>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence`,
      item
    );
  }

  async patchIntelligenceItem(
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
  ): Promise<IntelligenceItem> {
    return this.client.patch<IntelligenceItem>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}`,
      data
    );
  }

  async getIntelligenceHistory(projectId: string, itemId: string): Promise<any[]> {
    const res = await this.client.get<{ history: any[] }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}/history`
    );
    return res.history || [];
  }
}
