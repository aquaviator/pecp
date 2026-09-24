// ApiProjectService Unit Tests
// Defined according to M5.0 Work Package §6 & §9

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiProjectService } from '../services/api/ApiProjectService';
import { CreateProjectRequest } from '../services/interfaces/IProjectService';
import { ProjectSummary } from '../types';

describe('M5.0 ApiProjectService Web Adapter', () => {
  const originalFetch = global.fetch;
  let service: ApiProjectService;

  beforeEach(() => {
    service = new ApiProjectService('http://localhost:3001');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. maps API responses to exact ProjectSummary on getProjects', async () => {
    const mockProjects: ProjectSummary[] = [
      {
        id: 'proj-123',
        name: 'Enterprise Checkout',
        organisation: 'GlobalRetail',
        organisationId: 'org-456',
        intent: 'REPRESENTATIVE',
        description: 'End-to-end checkout test',
        createdDate: '2026-09-24T00:00:00.000Z',
        status: 'ACTIVE',
        documentsCount: 2,
        requirementsCount: 0,
        conflictsCount: 0
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: mockProjects })
    });

    const projects = await service.getProjects();
    expect(projects).toEqual(mockProjects);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/projects', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
  });

  it('2. maps single project and returns null on 404 for getProjectById', async () => {
    const mockProject: ProjectSummary = {
      id: 'proj-123',
      name: 'Single Project',
      organisation: 'Org1',
      organisationId: 'org-1',
      intent: 'FORECAST',
      description: 'Single desc',
      createdDate: '2026-09-24T00:00:00.000Z',
      status: 'ACTIVE',
      documentsCount: 0,
      requirementsCount: 0,
      conflictsCount: 0
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('proj-123')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockProject
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'Not found' } })
      };
    });

    const found = await service.getProjectById('proj-123');
    expect(found).toEqual(mockProject);

    const missing = await service.getProjectById('proj-missing');
    expect(missing).toBeNull();
  });

  it('3. round-trips supplied createProject request and does NOT invent values', async () => {
    const request: CreateProjectRequest = {
      name: 'New Project',
      organisation: 'Acme',
      intent: 'DISCOVERY',
      description: 'Test description',
      creationMethod: 'BRIEF',
      briefText: 'Sample brief',
      uploadedDocumentNames: ['doc1.pdf']
    };

    const mockCreated: ProjectSummary = {
      id: 'proj-new-789',
      name: 'New Project',
      organisation: 'Acme',
      organisationId: 'org-acme',
      intent: 'DISCOVERY',
      description: 'Test description',
      createdDate: '2026-09-24T00:00:00.000Z',
      status: 'ACTIVE',
      documentsCount: 1,
      requirementsCount: 0,
      conflictsCount: 0
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockCreated
    });

    const result = await service.createProject(request);
    expect(result).toEqual(mockCreated);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(request)
    });
  });

  it('4. preserves network errors and API errors without silent fallback to mock data', async () => {
    // Simulated network connection failure
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getProjects()).rejects.toThrow(
      /ApiProjectService: Failed to connect to PECP API/
    );

    // Simulated API 500 error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected internal error occurred'
        }
      })
    });

    await expect(service.getProjects()).rejects.toThrow(
      /An unexpected internal error occurred/
    );
  });

  it('5. malformed successful API list envelopes fail rather than becoming empty collections', async () => {
    // Missing items property
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    });

    await expect(service.getProjects()).rejects.toThrow(
      /Malformed API response .* expected '{ items: \[\.\.\.\] }' envelope/
    );

    // items is null or not an array
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: null })
    });

    await expect(service.getProjects()).rejects.toThrow(
      /Malformed API response .* expected '{ items: \[\.\.\.\] }' envelope/
    );
  });
});
