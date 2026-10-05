// ApiArtefactService
// Production Web API adapter for Engineering Artefacts (Strategy & Test Plan)

import {
  ArtefactListItem,
  ArtefactDetailResponse,
  GenerateArtefactInput,
  SubmitDecisionInput
} from '@pecp/pe-domain';
import { IArtefactService } from '../interfaces/IArtefactService';
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiArtefactService implements IArtefactService {
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

  async listArtefacts(projectId: string): Promise<ArtefactListItem[]> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/artefacts`;
    const res = await this.client.get<{ items: ArtefactListItem[] }>(path);
    return res.items || [];
  }

  async getArtefact(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number
  ): Promise<ArtefactDetailResponse> {
    const query = revisionNumber ? `?revision=${revisionNumber}` : '';
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/artefacts/${encodeURIComponent(artefactIdOrType)}${query}`;
    return this.client.get<ArtefactDetailResponse>(path);
  }

  async generateArtefact(
    projectId: string,
    input: GenerateArtefactInput
  ): Promise<ArtefactDetailResponse> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/artefacts`;
    return this.client.post<ArtefactDetailResponse>(path, input);
  }

  async exportArtefactMarkdown(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number
  ): Promise<string> {
    const query = `?format=markdown${revisionNumber ? `&revision=${revisionNumber}` : ''}`;
    const url = `${this.client.baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/artefacts/${encodeURIComponent(artefactIdOrType)}/export${query}`;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/markdown, text/plain, */*'
      }
    });

    if (!res.ok) {
      let msg = `Export failed with status ${res.status}`;
      try {
        const json = await res.json();
        if (json?.error?.message) msg = json.error.message;
      } catch {
        // Ignore json parse error
      }
      throw new Error(msg);
    }

    return res.text();
  }

  async submitArtefactDecision(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber: number,
    input: SubmitDecisionInput
  ): Promise<ArtefactDetailResponse> {
    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/artefacts/${encodeURIComponent(artefactIdOrType)}/revisions/${revisionNumber}/decisions`;
    return this.client.post<ArtefactDetailResponse>(path, input);
  }
}
