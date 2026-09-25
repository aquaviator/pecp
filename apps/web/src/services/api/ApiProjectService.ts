// ApiProjectService
// Defined according to M5.0 Work Package §6 & M5.1 PM Review Blocker 3
// Production-shaped Web API adapter for project operations.
// Refactored to use authenticated ApiClient with credentialed cookies, CSRF injection, and zero mock fallback.

import { ProjectSummary } from '../../types';
import { IProjectService, CreateProjectRequest } from '../interfaces/IProjectService';
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiProjectService implements IProjectService {
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

  async getProjects(): Promise<ProjectSummary[]> {
    let data: any;
    try {
      data = await this.client.get<any>('/api/v1/projects');
    } catch (err: any) {
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiProjectService: ${err.message}`);
      }
      throw err;
    }

    if (!data || !Array.isArray(data.items)) {
      throw new Error(
        `ApiProjectService: Malformed API response from ${this.client.baseUrl}/api/v1/projects: expected '{ items: [...] }' envelope`
      );
    }
    return data.items;
  }

  async getProjectById(id: string): Promise<ProjectSummary | null> {
    try {
      return await this.client.get<ProjectSummary>(`/api/v1/projects/${encodeURIComponent(id)}`);
    } catch (err: any) {
      if (err.status === 404) {
        return null;
      }
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiProjectService: ${err.message}`);
      }
      throw err;
    }
  }

  async createProject(request: CreateProjectRequest): Promise<ProjectSummary> {
    try {
      return await this.client.post<ProjectSummary>('/api/v1/projects', request);
    } catch (err: any) {
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiProjectService: ${err.message}`);
      }
      throw err;
    }
  }
}
