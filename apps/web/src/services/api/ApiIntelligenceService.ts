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
    if (!data || !Array.isArray(data.items)) {
      throw new Error(
        `ApiIntelligenceService: Malformed API response from ${url}: expected '{ items: [...] }' envelope`
      );
    }
    return data.items;
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
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}/resolve`;
    const csrfToken = typeof document !== 'undefined'
      ? (document.cookie.match(/(?:^|;\s*)pecp_csrf=([^;]*)/) ? decodeURIComponent(document.cookie.match(/(?:^|;\s*)pecp_csrf=([^;]*)/)![1]) : undefined)
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (csrfToken) {
      headers['X-PECP-CSRF'] = csrfToken;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ chosenCandidateId, rationale })
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
        // default message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  async approveIntelligenceItem(
    projectId: string,
    itemId: string,
    _approverName?: string
  ): Promise<IntelligenceItem> {
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/intelligence/${encodeURIComponent(itemId)}/approve`;
    const csrfToken = typeof document !== 'undefined'
      ? (document.cookie.match(/(?:^|;\s*)pecp_csrf=([^;]*)/) ? decodeURIComponent(document.cookie.match(/(?:^|;\s*)pecp_csrf=([^;]*)/)![1]) : undefined)
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (csrfToken) {
      headers['X-PECP-CSRF'] = csrfToken;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({})
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
        // default message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }
}
