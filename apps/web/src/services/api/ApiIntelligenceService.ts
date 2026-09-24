// ApiIntelligenceService
// Defined according to M5.0 Work Package §7 and PM Review Blockers 3 & 4
// Production-shaped Web API adapter for persistent project intelligence.
// Invariant: Network/API errors are preserved as real errors and NEVER silently fall back to mocks.
// Mutation/approval methods explicitly reject because authenticated actor identity is deferred to M5.1.

import { IntelligenceItem, IntelligenceReviewSummary } from '../../types';
import { IIntelligenceService } from '../interfaces/IIntelligenceService';

export class ApiIntelligenceService implements IIntelligenceService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || (import.meta as any).env?.VITE_PECP_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  }

  async getIntelligenceItems(projectId: string): Promise<IntelligenceItem[]> {
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/intelligence`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
    } catch (networkError: any) {
      throw new Error(`ApiIntelligenceService: Failed to connect to PECP API at ${url}: ${networkError?.message || networkError}`);
    }

    if (!response.ok) {
      let errorMsg = `PECP API error: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use default status message
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.items || [];
  }

  async getIntelligenceItemById(projectId: string, itemId: string): Promise<IntelligenceItem | null> {
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
    } catch (networkError: any) {
      throw new Error(`ApiIntelligenceService: Failed to connect to PECP API at ${url}: ${networkError?.message || networkError}`);
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      let errorMsg = `PECP API error: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use default status message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  async getIntelligenceSummary(projectId: string): Promise<IntelligenceReviewSummary> {
    const items = await this.getIntelligenceItems(projectId);

    const documentsSet = new Set<string>();
    for (const item of items) {
      if (item.sourceDocument) {
        documentsSet.add(item.sourceDocument);
      }
    }

    const performanceRequirements = items.filter(
      (i) => i.category === 'REQUIREMENTS' || i.category === 'WORKLOAD'
    ).length;

    const conflicts = items.filter(
      (i) => i.reviewStatus === 'CONFLICTING' || i.canonicalState === 'CONFLICTING'
    ).length;

    const missingInformation = items.filter(
      (i) => i.reviewStatus === 'MISSING' || i.canonicalState === 'MISSING'
    ).length;

    return {
      documentsAnalysed: documentsSet.size,
      requirementsFound: items.length,
      performanceRequirements,
      conflicts,
      missingInformation,
      readinessSections: []
    };
  }

  async resolveIntelligenceConflict(
    _projectId: string,
    _itemId: string,
    _chosenCandidateId: string,
    _rationale?: string
  ): Promise<IntelligenceItem> {
    throw new Error(
      'ApiIntelligenceService: Intelligence conflict resolution requires authenticated actor identity (deferred to M5.1). Not supported in M5.0 API mode.'
    );
  }

  async approveIntelligenceItem(
    _projectId: string,
    _itemId: string,
    _approverName: string
  ): Promise<IntelligenceItem> {
    throw new Error(
      'ApiIntelligenceService: Intelligence item approval requires authenticated actor identity (deferred to M5.1). Not supported in M5.0 API mode.'
    );
  }
}
