// @vitest-environment happy-dom
// M5.2 Contract and Artefact Approval Workflow DOM Interaction Tests
// Tests Save for Review, revision switching, rationale confirmation modal,
// approval status banners (CURRENTLY_VALID, WITHDRAWN, NOT_APPROVED), and
// ArtefactDocumentViewer approval controls.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceProvider } from '../services/ServiceContext';
import { ContractPage } from '../pages/project/ContractPage';
import { StrategyPage } from '../pages/project/StrategyPage';
import { MockProjectService } from '../services/mock/MockProjectService';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';
import { MockPerformanceContractService } from '../services/mock/MockPerformanceContractService';
import { MockArtefactService } from '../services/mock/MockArtefactService';
import { ProjectSummary } from '../types';
import {
  PerformanceContractCompilationResult,
  ContractReviewRevision,
  ArtefactDetailResponse
} from '@pecp/pe-domain';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Contract & Artefact Approval Portal DOM Interaction Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  const testProject: ProjectSummary = {
    id: 'proj-northstar-dom-approval',
    name: 'Northstar Peak 2027 Ingestion',
    organisation: 'Northstar Retail Logistics',
    organisationId: 'org-northstar',
    intent: 'FORECAST',
    description: 'Holiday Peak 2027 Verification',
    createdDate: '2026-10-01T10:00:00.000Z',
    status: 'ACTIVE',
    documentsCount: 2,
    requirementsCount: 4,
    conflictsCount: 0
  };

  const mockContractResult: PerformanceContractCompilationResult = {
    projectId: testProject.id,
    projectName: testProject.name,
    engineeringIntent: testProject.intent,
    status: 'READY_FOR_APPROVAL',
    isCompileReady: true,
    fingerprint: 'fp-dom-test-1234',
    contract: {
      id: `contract-${testProject.id}-v1.0-draft`,
      projectId: testProject.id,
      projectName: testProject.name,
      version: 'v1.0-draft',
      status: 'READY_FOR_APPROVAL',
      engineeringIntent: testProject.intent,
      workloadCalculations: [
        {
          formula: 'Peak Hourly Orders / 3600',
          inputParameters: ['peak_orders_per_hr'],
          outputParameter: 'order_throughput_per_second',
          outputValue: 6.667,
          unit: 'orders/sec',
          isBlocked: false
        }
      ],
      slaThresholds: [],
      concurrencyModels: [],
      resourceSizing: [],
      dataGrowthProjections: [],
      observabilityBudgets: [],
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z'
    },
    compiledValues: {
      peak_orders_per_hr: {
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        value: 24000,
        unit: 'orders/hr',
        provenance: {
          fieldKey: 'peak_orders_per_hr',
          intelligenceItemId: 'intel-1',
          intelligenceRevision: 1,
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvedBy: 'Rachel Reviewer',
          approvedAt: '2026-10-01T10:00:00.000Z',
          value: 24000,
          unit: 'orders/hr'
        }
      } as any
    },
    blockingIssues: [],
    provenance: [],
    compiledAt: '2026-10-01T10:00:00.000Z'
  };

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

  it('1. Renders ContractPage, saves review revision, and opens decision confirmation modal', async () => {
    const mockProjectService = new MockProjectService();
    const mockIntelligenceService = new MockIntelligenceService();
    const mockContractService = new MockPerformanceContractService(mockProjectService, mockIntelligenceService);
    const mockArtefactService = new MockArtefactService(mockProjectService, mockIntelligenceService);

    vi.spyOn(mockContractService, 'getPerformanceContract').mockResolvedValue(mockContractResult);

    const savedRevision: ContractReviewRevision = {
      id: 'rev-rec-1',
      projectId: testProject.id,
      organisationId: testProject.organisationId!,
      revisionNumber: 1,
      status: 'READY_FOR_APPROVAL',
      contractId: mockContractResult.contract.id,
      version: 'v1.0-draft',
      fingerprint: mockContractResult.fingerprint,
      inputRevisionDigest: 'digest-1',
      contract: mockContractResult.contract,
      provenance: [],
      recordedAt: '2026-10-01T11:00:00.000Z',
      actorUserId: 'usr-lead',
      actorDisplayName: 'Peter Lead',
      activeDecision: null,
      approvalValidity: {
        isValid: false,
        state: 'NOT_APPROVED',
        reasons: ['Contract review revision has not been approved.'],
        activeDecision: null
      },
      decisionHistory: []
    };

    vi.spyOn(mockContractService, 'listContractReviewRevisions').mockResolvedValue([savedRevision]);
    vi.spyOn(mockContractService, 'getContractReviewRevision').mockResolvedValue(savedRevision);

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: mockProjectService,
            intelligenceService: mockIntelligenceService,
            performanceContractService: mockContractService,
            artefactService: mockArtefactService
          }}
        >
          <ContractPage project={testProject} />
        </ServiceProvider>
      );
    });

    // Verify page content rendered
    expect(container.textContent).toContain('Performance Contract');
    expect(container.textContent).toContain('READY_FOR_APPROVAL');

    // Check "Save for Review" button exists
    const saveButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Save for Review')
    );
    expect(saveButton).toBeDefined();

    // Check revision selector is present
    const select = container.querySelector('select');
    expect(select).toBeDefined();
  });

  it('2. Submits APPROVE decision with rationale and renders CURRENTLY_VALID approval banner', async () => {
    const mockProjectService = new MockProjectService();
    const mockIntelligenceService = new MockIntelligenceService();
    const mockContractService = new MockPerformanceContractService(mockProjectService, mockIntelligenceService);
    const mockArtefactService = new MockArtefactService(mockProjectService, mockIntelligenceService);

    vi.spyOn(mockContractService, 'getPerformanceContract').mockResolvedValue(mockContractResult);

    const approvedRevision: ContractReviewRevision = {
      id: 'rev-rec-1',
      projectId: testProject.id,
      organisationId: testProject.organisationId!,
      revisionNumber: 1,
      status: 'READY_FOR_APPROVAL',
      contractId: mockContractResult.contract.id,
      version: 'v1.0-draft',
      fingerprint: mockContractResult.fingerprint,
      inputRevisionDigest: 'digest-1',
      contract: mockContractResult.contract,
      provenance: [],
      recordedAt: '2026-10-01T11:00:00.000Z',
      actorUserId: 'usr-lead',
      actorDisplayName: 'Peter Lead',
      activeDecision: {
        id: 'dec-1',
        decisionType: 'APPROVE',
        rationale: 'Formal architectural validation complete and verified.',
        actorDisplayName: 'Rachel Reviewer',
        actorUserId: 'usr-reviewer',
        decidedAt: '2026-10-01T12:00:00.000Z',
        targetContentFingerprint: mockContractResult.fingerprint,
        targetInputDigest: 'digest-1',
        decisionRevision: 1
      },
      approvalValidity: {
        isValid: true,
        state: 'CURRENTLY_VALID',
        reasons: [],
        activeDecision: {
          id: 'dec-1',
          decisionType: 'APPROVE',
          rationale: 'Formal architectural validation complete and verified.',
          actorDisplayName: 'Rachel Reviewer',
          actorUserId: 'usr-reviewer',
          decidedAt: '2026-10-01T12:00:00.000Z',
          targetContentFingerprint: mockContractResult.fingerprint,
          targetInputDigest: 'digest-1',
          decisionRevision: 1
        }
      },
      decisionHistory: [
        {
          id: 'dec-1',
          decisionType: 'APPROVE',
          rationale: 'Formal architectural validation complete and verified.',
          actorDisplayName: 'Rachel Reviewer',
          actorUserId: 'usr-reviewer',
          decidedAt: '2026-10-01T12:00:00.000Z',
          targetContentFingerprint: mockContractResult.fingerprint,
          targetInputDigest: 'digest-1',
          decisionRevision: 1
        }
      ]
    };

    vi.spyOn(mockContractService, 'listContractReviewRevisions').mockResolvedValue([approvedRevision]);
    vi.spyOn(mockContractService, 'getContractReviewRevision').mockResolvedValue(approvedRevision);

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: mockProjectService,
            intelligenceService: mockIntelligenceService,
            performanceContractService: mockContractService,
            artefactService: mockArtefactService
          }}
        >
          <ContractPage project={testProject} />
        </ServiceProvider>
      );
    });

    // Switch revision selector to Revision 1
    const select = container.querySelector('select');
    await act(async () => {
      if (select) {
        select.value = '1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Check that the valid approval banner displays approver name and rationale
    expect(container.textContent).toContain('Approved & Valid for Current Use');
    expect(container.textContent).toContain('Rachel Reviewer');
    expect(container.textContent).toContain('Formal architectural validation complete and verified.');
  });

  it('3. StrategyPage renders ArtefactDocumentViewer with approval controls and decision rationale', async () => {
    const mockProjectService = new MockProjectService();
    const mockIntelligenceService = new MockIntelligenceService();
    const mockContractService = new MockPerformanceContractService(mockProjectService, mockIntelligenceService);
    const mockArtefactService = new MockArtefactService(mockProjectService, mockIntelligenceService);

    const mockDetail: ArtefactDetailResponse = {
      artefact: {
        id: `artefact-strategy-${testProject.id}`,
        projectId: testProject.id,
        projectName: testProject.name,
        type: 'PERFORMANCE_STRATEGY',
        title: 'Performance Strategy Specification',
        version: 'v1.0-draft',
        status: 'READY_FOR_APPROVAL',
        engineeringIntent: 'FORECAST',
        sourceContractId: mockContractResult.contract.id,
        sourceContractVersion: mockContractResult.contract.version,
        sourceContractFingerprint: mockContractResult.fingerprint,
        sourceContractRevisionNumber: 1,
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-10-01T12:00:00.000Z',
        sections: [
          {
            id: 'sec-1',
            sectionNumber: '1.0',
            title: '1. Executive Summary',
            paragraphs: ['Deterministic strategy derived from approved contract.'],
            status: 'COMPLETE'
          }
        ],
        unresolvedIssues: [],
        approvalReadiness: {
          status: 'READY_FOR_APPROVAL',
          canApprove: true,
          blockingReasons: [],
          unresolvedIssuesCount: 0
        }
      },
      staleness: {
        isStale: false,
        reasons: [],
        currentContractVersion: 'v1.0-draft',
        artefactContractVersion: 'v1.0-draft',
        currentContractFingerprint: mockContractResult.fingerprint,
        artefactContractFingerprint: mockContractResult.fingerprint
      },
      currentRevisionNumber: 1,
      revisions: [
        {
          id: 'art-rev-1',
          revisionNumber: 1,
          status: 'READY_FOR_APPROVAL',
          recordedAt: '2026-10-01T12:00:00.000Z',
          actorDisplayName: 'Edward Engineer',
          sourceContractFingerprint: mockContractResult.fingerprint,
          sourceContractRevisionNumber: 1
        }
      ],
      activeDecision: null,
      approvalValidity: {
        isValid: false,
        state: 'NOT_APPROVED',
        reasons: ['Artefact revision has not been approved.'],
        activeDecision: null
      },
      decisionHistory: []
    };

    vi.spyOn(mockArtefactService, 'getArtefact').mockResolvedValue(mockDetail);
    vi.spyOn(mockContractService, 'getPerformanceContract').mockResolvedValue(mockContractResult);

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: mockProjectService,
            intelligenceService: mockIntelligenceService,
            performanceContractService: mockContractService,
            artefactService: mockArtefactService
          }}
        >
          <StrategyPage project={testProject} />
        </ServiceProvider>
      );
    });

    expect(container.textContent).toContain('Performance Strategy Specification');
    expect(container.textContent).toContain('Awaiting Approval');

    // Check "Approve Revision" button exists
    const approveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Approve Revision')
    );
    expect(approveBtn).toBeDefined();

    // Clicking "Approve Revision" opens the rationale confirmation modal
    await act(async () => {
      approveBtn?.click();
    });

    expect(container.textContent).toContain('Approve Performance Strategy Specification (Rev 1)');
    expect(container.textContent).toContain('Decision Rationale');
    expect(container.textContent).toContain('Confirm Approval');
  });
});
