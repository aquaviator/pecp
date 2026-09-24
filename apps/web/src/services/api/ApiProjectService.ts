// ApiProjectService
// Defined according to M5.0 Work Package §6
// Production-shaped Web API adapter for project operations.
// Invariant: Network/API errors are preserved as real errors and NEVER silently fall back to mocks.

import { ProjectSummary } from '../../types';
import { IProjectService, CreateProjectRequest } from '../interfaces/IProjectService';

export class ApiProjectService implements IProjectService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || (import.meta as any).env?.VITE_PECP_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
  }

  async getProjects(): Promise<ProjectSummary[]> {
    const url = `${this.baseUrl}/api/v1/projects`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
    } catch (networkError: any) {
      throw new Error(`ApiProjectService: Failed to connect to PECP API at ${url}: ${networkError?.message || networkError}`);
    }

    if (!response.ok) {
      let errorMsg = `PECP API error: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use default message
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.items)) {
      throw new Error(
        `ApiProjectService: Malformed API response from ${url}: expected '{ items: [...] }' envelope`
      );
    }
    return data.items;
  }

  async getProjectById(id: string): Promise<ProjectSummary | null> {
    const url = `${this.baseUrl}/api/v1/projects/${encodeURIComponent(id)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
    } catch (networkError: any) {
      throw new Error(`ApiProjectService: Failed to connect to PECP API at ${url}: ${networkError?.message || networkError}`);
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
        // use default message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  async createProject(request: CreateProjectRequest): Promise<ProjectSummary> {
    const url = `${this.baseUrl}/api/v1/projects`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request)
      });
    } catch (networkError: any) {
      throw new Error(`ApiProjectService: Failed to connect to PECP API at ${url}: ${networkError?.message || networkError}`);
    }

    if (!response.ok) {
      let errorMsg = `PECP API error: HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson?.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch {
        // use default message
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }
}
