// ApiIntelligenceService
// Defined according to M5.0 Work Package §7 & M5.1 PM Review Blocker 3
// Production-shaped Web API adapter for persistent project intelligence.
// Refactored to use authenticated ApiClient with credentialed cookies, CSRF injection, and zero mock fallback.

import { IntelligenceItem, IntelligenceReviewSummary } from '../../types';
import { IIntelligenceService } from '../interfaces/IIntelligenceService';
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiIntelligenceService implements IIntelligenceService {
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

  async getIntelligenceItems(projectId: string): Promise<IntelligenceItem[]> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence`;
    let data: any;
    try {
      data = await this.client.get<any>(path);
    } catch (err: any) {
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiIntelligenceService: ${err.message}`);
      }
      throw err;
    }

    if (!data || !Array.isArray(data.items)) {
      throw new Error(
        `ApiIntelligenceService: Malformed API response from ${this.client.baseUrl}${path}: expected '{ items: [...] }' envelope`
      );
    }
    return data.items;
  }

  async getIntelligenceItemById(projectId: string, itemId: string): Promise<IntelligenceItem | null> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}`;
    try {
      return await this.client.get<IntelligenceItem>(path);
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiIntelligenceService: ${err.message}`);
      }
      throw err;
    }
  }

  async getIntelligenceSummary(_projectId: string): Promise<IntelligenceReviewSummary> {
    throw new Error(
      'ApiIntelligenceService: getIntelligenceSummary is not supported in API mode in M5.0. Server-side intelligence review summary is not platformised, and client-side summary invention is forbidden.'
    );
  }

  async resolveIntelligenceConflict(
    projectId: string,
    itemId: string,
    chosenCandidateId: string,
    rationale?: string
  ): Promise<IntelligenceItem> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}/resolve`;
    try {
      return await this.client.post<IntelligenceItem>(path, { chosenCandidateId, rationale });
    } catch (err: any) {
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiIntelligenceService: ${err.message}`);
      }
      throw err;
    }
  }

  async approveIntelligenceItem(
    projectId: string,
    itemId: string,
    _approverName?: string
  ): Promise<IntelligenceItem> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}/approve`;
    try {
      return await this.client.post<IntelligenceItem>(path, {});
    } catch (err: any) {
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiIntelligenceService: ${err.message}`);
      }
      throw err;
    }
  }
}
