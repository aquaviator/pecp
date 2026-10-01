// @vitest-environment happy-dom
// M5.2 Intake Portal Interaction & DOM-Capable Wiring Integration Tests
// Defined according to M5.2 Work Package §11 [I09] & PM Audit Corrections
// Proves upload retry without duplicate project creation and project switching isolation in real DOM.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceProvider } from '../services/ServiceContext';
import { AuthProvider } from '../context/AuthContext';
import { NewProjectModal } from '../pages/project/NewProjectModal';
import { SourcesIntakePage } from '../pages/project/SourcesIntakePage';
import { MockProjectService } from '../services/mock/MockProjectService';
import { MockSourceService } from '../services/mock/MockSourceService';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';
import { MockAdminService } from '../services/mock/MockAdminService';
import { MockIntegrationService } from '../services/mock/MockIntegrationService';
import { MockExecutionEvidenceService } from '../services/mock/MockExecutionEvidenceService';
import { ProjectSummary } from '../types';
import { SourceMetadata, SourceVersion } from '@pecp/pe-domain';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('M5.2 Intake Portal Interaction & DOM Wiring Verification', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('A. Upload Failure and Retry Without Duplicate Project Creation', () => {
    it('1. Correctly handles upload failure, displays error state, and allows retry without duplicating project', async () => {
      const mockProjectService = new MockProjectService();
      const mockSourceService = new MockSourceService();

      const createProjectSpy = vi.spyOn(mockProjectService, 'createProject');
      let uploadAttempts = 0;
      const uploadSourceSpy = vi.spyOn(mockSourceService, 'uploadSource').mockImplementation(async (projectId, file) => {
        uploadAttempts++;
        if (uploadAttempts === 1) {
          throw new Error('Connection reset during file upload');
        }
        return {
          id: 'src-uploaded-1',
          projectId,
          organisationId: 'Northstar Retail',
          kind: 'UPLOAD',
          title: file.name,
          currentVersionNumber: 1,
          currentVersionId: 'ver-uploaded-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdByUserId: 'usr-admin-1',
          createdByUserDisplayName: 'Admin User'
        } as unknown as SourceMetadata;
      });

      const onProjectCreated = vi.fn();
      const onClose = vi.fn();

      // Render initial modal state in real DOM
      await act(async () => {
        root.render(
          <ServiceProvider
            overrideServices={{
              projectService: mockProjectService,
              sourceService: mockSourceService,
              intelligenceService: new MockIntelligenceService(),
              adminService: new MockAdminService(),
              integrationService: new MockIntegrationService(),
              executionEvidenceService: new MockExecutionEvidenceService()
            }}
          >
            <AuthProvider initialValue={{ isLoading: false, user: null, principal: null, permissions: ['SOURCE_WRITE', 'PROJECT_CREATE'] }}>
              <NewProjectModal
                isOpen={true}
                onClose={onClose}
                onProjectCreated={onProjectCreated}
              />
            </AuthProvider>
          </ServiceProvider>
        );
      });

      expect(container.textContent).toContain('Project Initiation');
      expect(container.textContent).toContain('Upload Documents');

      // Attach file to the file input on METHOD step
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      const testFile = new File(['metric,val\norders,24000'], 'holiday_peak_forecast.csv', { type: 'text/csv' });
      Object.defineProperty(fileInput, 'files', {
        value: [testFile],
        writable: true,
        configurable: true
      });

      await act(async () => {
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Verify file is shown in DOM list
      expect(container.textContent).toContain('holiday_peak_forecast.csv');

      // Click "Continue" to proceed to DETAILS step
      const continueBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Continue')
      );
      expect(continueBtn).toBeDefined();

      await act(async () => {
        continueBtn!.click();
      });

      expect(container.textContent).toContain('Project Details');

      // Fill in Project Name using native input value setter
      const nameInput = container.querySelector('input[placeholder*="Peak Checkout"]') as HTMLInputElement;
      expect(nameInput).not.toBeNull();

      await act(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(nameInput, 'Northstar Retail Logistics 2027');
        } else {
          nameInput.value = 'Northstar Retail Logistics 2027';
        }
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Locate submit button ("Initialize Project")
      const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Initialize Project')
      );
      expect(submitBtn).toBeDefined();

      // Attempt 1: Click "Initialize Project" - project is created, but upload fails
      await act(async () => {
        submitBtn!.click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Assertions on failure:
      // 1. Project was created exactly once
      expect(createProjectSpy).toHaveBeenCalledTimes(1);
      // 2. Upload was attempted once and failed
      expect(uploadAttempts).toBe(1);
      // 3. Error notice is presented in the UI
      expect(container.textContent).toContain('was successfully created, but uploading "holiday_peak_forecast.csv" failed: Connection reset during file upload');
      // 4. Modal remains open and onProjectCreated has not yet fired
      expect(onProjectCreated).not.toHaveBeenCalled();
      // 5. Submit button transitions to "Retry Upload"
      const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Retry Upload')
      );
      expect(retryBtn).toBeDefined();

      // Attempt 2: Click "Retry Upload"
      await act(async () => {
        retryBtn!.click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Assertions on retry:
      // 6. createProject was NOT called again (called exactly once total, avoiding project duplication)
      expect(createProjectSpy).toHaveBeenCalledTimes(1);
      // 7. uploadSource was attempted again and succeeded
      expect(uploadAttempts).toBe(2);
      expect(uploadSourceSpy).toHaveBeenCalledTimes(2);
      // 8. onProjectCreated callback fired with the single created project
      expect(onProjectCreated).toHaveBeenCalledTimes(1);
      const createdProj = onProjectCreated.mock.calls[0][0];
      expect(createdProj.name).toBe('Northstar Retail Logistics 2027');
      // 9. onClose callback fired
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('B. Project Switching Isolation', () => {
    it('2. Isolates project sources and ensures no source leaks during project switching in DOM', async () => {
      const mockSourceService = new MockSourceService();

      const projectA: ProjectSummary = {
        id: 'proj-alpha-retail',
        name: 'Project Alpha Retail',
        organisation: 'Northstar Retail',
        intent: 'FORECAST',
        description: 'Alpha project',
        createdDate: '2026-10-01T00:00:00Z',
        status: 'ACTIVE',
        documentsCount: 1,
        requirementsCount: 1,
        conflictsCount: 0
      };

      const projectB: ProjectSummary = {
        id: 'proj-beta-payments',
        name: 'Project Beta Payments',
        organisation: 'Contoso External',
        intent: 'REPRESENTATIVE',
        description: 'Beta project',
        createdDate: '2026-10-01T00:00:00Z',
        status: 'ACTIVE',
        documentsCount: 1,
        requirementsCount: 1,
        conflictsCount: 0
      };

      const sourceA: SourceMetadata = {
        id: 'src-alpha-spec',
        projectId: projectA.id,
        organisationId: 'Northstar Retail',
        kind: 'UPLOAD',
        title: 'Alpha_Architecture_Specification.docx',
        currentVersionNumber: 1,
        currentVersionId: 'ver-alpha-1',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        createdByUserId: 'usr-1',
        createdByUserDisplayName: 'Lead Engineer'
      };

      const sourceB: SourceMetadata = {
        id: 'src-beta-spec',
        projectId: projectB.id,
        organisationId: 'Contoso External',
        kind: 'UPLOAD',
        title: 'Beta_Settlement_Audit.csv',
        currentVersionNumber: 1,
        currentVersionId: 'ver-beta-1',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        createdByUserId: 'usr-2',
        createdByUserDisplayName: 'External Engineer'
      };

      vi.spyOn(mockSourceService, 'listSources').mockImplementation(async (projectId: string) => {
        if (projectId === projectA.id) return [sourceA];
        if (projectId === projectB.id) return [sourceB];
        return [];
      });

      vi.spyOn(mockSourceService, 'listVersions').mockImplementation(async (_projectId, sourceId) => {
        return [
          {
            id: sourceId === sourceA.id ? 'ver-alpha-1' : 'ver-beta-1',
            sourceId,
            versionNumber: 1,
            createdAt: '2026-10-01T00:00:00Z',
            format: sourceId === sourceA.id ? 'DOCX' : 'CSV',
            sha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
            byteSize: 2048,
            capturedByUserDisplayName: 'Technical Lead',
            originalFilename: sourceId === sourceA.id ? 'Alpha_Architecture_Specification.docx' : 'Beta_Settlement_Audit.csv'
          } as unknown as SourceVersion
        ];
      });

      vi.spyOn(mockSourceService, 'getExtraction').mockImplementation(async (_projectId, _sourceId, versionId) => {
        return {
          id: `ext-${versionId}`,
          sourceVersionId: versionId,
          status: 'SUCCESS',
          parserId: 'pecp-parser',
          parserVersion: '1.0.0',
          extractedAt: '2026-10-01T00:00:00Z',
          contentDigest: 'digest-1234',
          pageCount: 1,
          plainText: versionId === 'ver-alpha-1' ? 'Alpha specs text' : 'Beta settlement text',
          fragments: [],
          limitations: []
        } as any;
      });

      vi.spyOn(mockSourceService, 'getIntakeSummary').mockImplementation(async (projectId) => {
        return {
          projectId,
          totalSourcesCount: 1,
          extractedSuccessCount: 1,
          extractionFailedCount: 0,
          extractionPendingCount: 0,
          extractionManualReviewCount: 0,
          briefSourcesCount: 0,
          uploadSourcesCount: 1,
          overallReadiness: 'READY_FOR_EXTRACTION_REVIEW'
        } as any;
      });

      vi.spyOn(mockSourceService, 'getChecklist').mockImplementation(async (projectId) => {
        return {
          projectId,
          requiredFields: [],
          categories: []
        } as any;
      });

      // 1. Render SourcesIntakePage in DOM for Project A
      await act(async () => {
        root.render(
          <ServiceProvider overrideServices={{ sourceService: mockSourceService }}>
            <AuthProvider initialValue={{ isLoading: false, user: null, principal: null, permissions: ['SOURCE_WRITE', 'INTELLIGENCE_READ'] }}>
              <SourcesIntakePage project={projectA} />
            </AuthProvider>
          </ServiceProvider>
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      // Verify Project A context contains its own source and NOT Project B's source
      expect(container.textContent).toContain('Alpha_Architecture_Specification.docx');
      expect(container.textContent).toContain('Source Inventory');
      expect(container.textContent).not.toContain('Beta_Settlement_Audit.csv');

      // 2. Switch Project in DOM by rendering Project B
      await act(async () => {
        root.render(
          <ServiceProvider overrideServices={{ sourceService: mockSourceService }}>
            <AuthProvider initialValue={{ isLoading: false, user: null, principal: null, permissions: ['SOURCE_WRITE', 'INTELLIGENCE_READ'] }}>
              <SourcesIntakePage project={projectB} />
            </AuthProvider>
          </ServiceProvider>
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      // Verify Project B context contains its own source and NOT Project A's source
      expect(container.textContent).toContain('Beta_Settlement_Audit.csv');
      expect(container.textContent).toContain('Source Inventory');
      expect(container.textContent).not.toContain('Alpha_Architecture_Specification.docx');

      // 3. Switch back in DOM to Project A
      await act(async () => {
        root.render(
          <ServiceProvider overrideServices={{ sourceService: mockSourceService }}>
            <AuthProvider initialValue={{ isLoading: false, user: null, principal: null, permissions: ['SOURCE_WRITE', 'INTELLIGENCE_READ'] }}>
              <SourcesIntakePage project={projectA} />
            </AuthProvider>
          </ServiceProvider>
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 60));
      });

      // Verify Project A state is restored cleanly without leaking Project B data
      expect(container.textContent).toContain('Alpha_Architecture_Specification.docx');
      expect(container.textContent).not.toContain('Beta_Settlement_Audit.csv');
    });
  });
});
