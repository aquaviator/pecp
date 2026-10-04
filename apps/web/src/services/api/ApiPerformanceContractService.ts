// ApiPerformanceContractService
// Production-shaped Web API adapter for compiled performance contracts
// Fetches real governed contract compilation with authoritative provenance and fingerprint.

import { PerformanceContractCompilationResult } from '@pecp/pe-domain';
import { IPerformanceContractService } from '../interfaces/IPerformanceContractService';
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiPerformanceContractService implements IPerformanceContractService {
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

  async getPerformanceContract(projectId: string): Promise<PerformanceContractCompilationResult> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/performance-contract`;
    try {
      const data = await this.client.get<PerformanceContractCompilationResult>(path);
      return data;
    } catch (err: any) {
      if (err.message && err.message.startsWith('Failed to connect to PECP API')) {
        throw new Error(`ApiPerformanceContractService: ${err.message}`);
      }
      throw err;
    }
  }
}
