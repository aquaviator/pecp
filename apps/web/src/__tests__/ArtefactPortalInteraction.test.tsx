// @vitest-environment happy-dom
// ArtefactPortalInteraction.test.tsx
// DOM-Capable Interaction Tests for Performance Strategy and Test Plan Workflow
// Proves DOM generation, document preview, error/retry, revision history,
// staleness warning/regeneration, and project switching with out-of-order response protection.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceProvider } from '../services/ServiceContext';
import { StrategyPage } from '../pages/project/StrategyPage';
import { TestPlanPage } from '../pages/project/TestPlanPage';
import { MockProjectService } from '../services/mock/MockProjectService';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';
import { MockPerformanceContractService } from '../services/mock/MockPerformanceContractService';
import { IArtefactService } from '../services/interfaces/IArtefactService';
import { ProjectSummary } from '../types';
import {
  ArtefactDetailResponse,
  EngineeringArtefact,
  ArtefactListItem
} from '@pecp/pe-domain';
import { generatePerformanceStrategy, generatePerformanceTestPlan } from '@pecp/artefact-engine';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Artefact Portal DOM Interaction & Workflow Tests', () => {
  let container: HTMLDivElement;
  let root: Root;

  const projectA: ProjectSummary = {
    id: 'proj-northstar-a',
    name: 'Northstar Peak 2027',
    organisation: 'Northstar Retail Logistics',
    organisationId: 'org-northstar',
    intent: 'FORECAST',
    description: 'Holiday Peak 2027 Performance Strategy',
    createdDate: '2026-10-01T10:00:00.000Z',
    status: 'ACTIVE',
    documentsCount: 2,
    requirementsCount: 4,
    conflictsCount: 0
  };

  const projectB: ProjectSummary = {
    id: 'proj-contoso-b',
    name: 'Contoso Checkout',
    organisation: 'Contoso Corp',
    organisationId: 'org-contoso',
    intent: 'FORECAST',
    description: 'Contoso project B',
    createdDate: '2026-10-02T10:00:00.000Z',
    status: 'ACTIVE',
    documentsCount: 1,
    requirementsCount: 2,
    conflictsCount: 0
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

  const createSampleArtefact = (proj: ProjectSummary, type: 'PERFORMANCE_STRATEGY' | 'PERFORMANCE_TEST_PLAN', rev: number = 1): EngineeringArtefact => {
    const contract = compileDraftPerformanceContract({
      projectSummary: proj,
      intelligenceItems: [],
      version: 'v0.1-draft'
    });
    const gen = type === 'PERFORMANCE_STRATEGY' ? generatePerformanceStrategy : generatePerformanceTestPlan;
    const art = gen({
      contract,
      intelligenceItems: [],
      projectSummary: proj,
      artefactVersion: `v${rev}.0-draft`
    });
    art.id = `artefact-${type}-${proj.id}`;
    return art;
  };

  it('1. Displays initial empty state with live contract readiness, and generates full structured preview on button click', async () => {
    const sampleArtefact = createSampleArtefact(projectA, 'PERFORMANCE_STRATEGY');
    const mockDetail: ArtefactDetailResponse = {
      artefact: sampleArtefact,
      staleness: {
        isStale: false,
        reasons: [],
        currentContractVersion: 'v0.1-draft',
        artefactContractVersion: 'v0.1-draft',
        currentContractFingerprint: 'fp-123',
        artefactContractFingerprint: 'fp-123'
      },
      currentRevisionNumber: 1,
      revisions: [
        {
          id: 'rev-1',
          revisionNumber: 1,
          status: 'BLOCKED',
          recordedAt: new Date().toISOString(),
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-123'
        }
      ]
    };

    let generateCalled = false;
    const mockArtefactService: IArtefactService = {
      listArtefacts: vi.fn().mockResolvedValue([]),
      getArtefact: vi.fn().mockRejectedValue(new Error('404 Artefact not found')),
      generateArtefact: vi.fn().mockImplementation(async () => {
        generateCalled = true;
        return mockDetail;
      }),
      exportArtefactMarkdown: vi.fn().mockResolvedValue('# Exported Markdown')
    };

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: new MockProjectService(),
            intelligenceService: new MockIntelligenceService(),
            artefactService: mockArtefactService
          }}
        >
          <StrategyPage project={projectA} />
        </ServiceProvider>
      );
    });

    // 1. Initial empty state is shown
    expect(container.textContent).toContain('No Performance Strategy Generated Yet');
    expect(container.textContent).toContain('Generate Performance Strategy');

    // 2. Click "Generate Performance Strategy" button
    const generateBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Generate Performance Strategy')
    );
    expect(generateBtn).toBeDefined();

    await act(async () => {
      generateBtn!.click();
    });

    expect(generateCalled).toBe(true);

    // 3. Document preview is rendered
    expect(container.textContent).toContain(sampleArtefact.title);
    expect(container.textContent).toContain('Table of Contents');
    expect(container.textContent).toContain('Copy Markdown');
    expect(container.textContent).toContain('Export .md');
  });

  it('2. Renders upstream drift warning banner and enables regeneration to revision 2', async () => {
    const sampleArtefact = createSampleArtefact(projectA, 'PERFORMANCE_STRATEGY');
    const staleDetail: ArtefactDetailResponse = {
      artefact: { ...sampleArtefact, status: 'STALE' },
      staleness: {
        isStale: true,
        reasons: ['Workload target updated from 20,000 to 24,000 orders/hr in canonical intelligence.'],
        currentContractVersion: 'v0.2-draft',
        artefactContractVersion: 'v0.1-draft',
        currentContractFingerprint: 'fp-456',
        artefactContractFingerprint: 'fp-123'
      },
      currentRevisionNumber: 1,
      revisions: [
        {
          id: 'rev-1',
          revisionNumber: 1,
          status: 'BLOCKED',
          recordedAt: new Date().toISOString(),
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-123'
        }
      ]
    };

    const freshDetail: ArtefactDetailResponse = {
      artefact: { ...sampleArtefact, version: 'v2.0-draft', status: 'BLOCKED' },
      staleness: {
        isStale: false,
        reasons: [],
        currentContractVersion: 'v0.2-draft',
        artefactContractVersion: 'v0.2-draft',
        currentContractFingerprint: 'fp-456',
        artefactContractFingerprint: 'fp-456'
      },
      currentRevisionNumber: 2,
      revisions: [
        {
          id: 'rev-2',
          revisionNumber: 2,
          status: 'BLOCKED',
          recordedAt: new Date().toISOString(),
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-456'
        },
        {
          id: 'rev-1',
          revisionNumber: 1,
          status: 'BLOCKED',
          recordedAt: new Date().toISOString(),
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-123'
        }
      ]
    };

    const mockArtefactService: IArtefactService = {
      listArtefacts: vi.fn().mockResolvedValue([]),
      getArtefact: vi.fn().mockResolvedValue(staleDetail),
      generateArtefact: vi.fn().mockResolvedValue(freshDetail),
      exportArtefactMarkdown: vi.fn().mockResolvedValue('# Fresh Markdown')
    };

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: new MockProjectService(),
            intelligenceService: new MockIntelligenceService(),
            artefactService: mockArtefactService
          }}
        >
          <StrategyPage project={projectA} />
        </ServiceProvider>
      );
    });

    // 1. Stale warning banner is displayed with reason
    expect(container.textContent).toContain('Upstream Contract Drift Detected');
    expect(container.textContent).toContain('Workload target updated from 20,000 to 24,000');

    // 2. Click "Regenerate Current Revision"
    const regenBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Regenerate')
    );
    expect(regenBtn).toBeDefined();

    await act(async () => {
      regenBtn!.click();
    });

    // 3. Document updates to revision 2 and staleness banner disappears
    expect(container.textContent).toContain('Version: v2.0-draft');
    expect(container.textContent).not.toContain('Upstream Contract Drift Detected');
  });

  it('3. Supports revision switching in dropdown and displays historical archive notice', async () => {
    const rev1Art = createSampleArtefact(projectA, 'PERFORMANCE_TEST_PLAN', 1);
    const rev2Art = createSampleArtefact(projectA, 'PERFORMANCE_TEST_PLAN', 2);

    const detailRev2: ArtefactDetailResponse = {
      artefact: rev2Art,
      staleness: {
        isStale: false,
        reasons: [],
        currentContractVersion: 'v0.2-draft',
        artefactContractVersion: 'v0.2-draft',
        currentContractFingerprint: 'fp-456',
        artefactContractFingerprint: 'fp-456'
      },
      currentRevisionNumber: 2,
      revisions: [
        {
          id: 'rev-2',
          revisionNumber: 2,
          status: 'BLOCKED',
          recordedAt: '2026-10-02T12:00:00Z',
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-456'
        },
        {
          id: 'rev-1',
          revisionNumber: 1,
          status: 'BLOCKED',
          recordedAt: '2026-10-01T12:00:00Z',
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-123'
        }
      ]
    };

    const detailRev1: ArtefactDetailResponse = {
      artefact: rev1Art,
      staleness: {
        isStale: true,
        reasons: ['Superseded by revision 2'],
        currentContractVersion: 'v0.2-draft',
        artefactContractVersion: 'v0.1-draft',
        currentContractFingerprint: 'fp-456',
        artefactContractFingerprint: 'fp-123'
      },
      currentRevisionNumber: 2,
      revisions: detailRev2.revisions
    };

    const mockArtefactService: IArtefactService = {
      listArtefacts: vi.fn().mockResolvedValue([]),
      getArtefact: vi.fn().mockImplementation(async (_pid, _type, rev) => {
        if (rev === 1) return detailRev1;
        return detailRev2;
      }),
      generateArtefact: vi.fn(),
      exportArtefactMarkdown: vi.fn().mockResolvedValue('# Test Plan Markdown')
    };

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: new MockProjectService(),
            intelligenceService: new MockIntelligenceService(),
            artefactService: mockArtefactService
          }}
        >
          <TestPlanPage project={projectA} />
        </ServiceProvider>
      );
    });

    // 1. Initial state is revision 2
    expect(container.textContent).toContain('Version: v2.0-draft');

    // 2. Select Revision dropdown exists
    const selectElem = container.querySelector('select[aria-label="Select Artefact Revision"]') as HTMLSelectElement;
    expect(selectElem).toBeDefined();

    // 3. Switch to Revision 1
    await act(async () => {
      selectElem.value = '1';
      selectElem.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 4. Historical notice is shown
    expect(container.textContent).toContain('Viewing historical revision v1.0');
    expect(container.textContent).toContain('Switch to Latest Revision (v2.0)');
  });

  it('4. Handles generation error with clear message and retry action', async () => {
    let callCount = 0;
    const sampleArtefact = createSampleArtefact(projectA, 'PERFORMANCE_STRATEGY');
    const successDetail: ArtefactDetailResponse = {
      artefact: sampleArtefact,
      staleness: {
        isStale: false,
        reasons: [],
        currentContractVersion: 'v0.1-draft',
        artefactContractVersion: 'v0.1-draft',
        currentContractFingerprint: 'fp-123',
        artefactContractFingerprint: 'fp-123'
      },
      currentRevisionNumber: 1,
      revisions: [
        {
          id: 'rev-1',
          revisionNumber: 1,
          status: 'BLOCKED',
          recordedAt: new Date().toISOString(),
          actorDisplayName: 'Peter Lead',
          sourceContractFingerprint: 'fp-123'
        }
      ]
    };

    const mockArtefactService: IArtefactService = {
      listArtefacts: vi.fn().mockResolvedValue([]),
      getArtefact: vi.fn().mockRejectedValue(new Error('404 Not Found')),
      generateArtefact: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Precondition Failed: Stale contract expectation. Refresh contract state.');
        }
        return successDetail;
      }),
      exportArtefactMarkdown: vi.fn()
    };

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: new MockProjectService(),
            intelligenceService: new MockIntelligenceService(),
            artefactService: mockArtefactService
          }}
        >
          <StrategyPage project={projectA} />
        </ServiceProvider>
      );
    });

    // Click generate (first call fails)
    const generateBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Generate Performance Strategy')
    );
    await act(async () => {
      generateBtn!.click();
    });

    // Error is rendered
    expect(container.textContent).toContain('Precondition Failed: Stale contract expectation');

    // Click retry
    const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Generate Performance Strategy') || b.textContent?.includes('Retry')
    );
    await act(async () => {
      retryBtn!.click();
    });

    // Second call succeeds and renders preview
    expect(container.textContent).toContain(sampleArtefact.title);
    expect(container.textContent).not.toContain('Precondition Failed');
  });

  it('5. Protects against out-of-order race conditions when switching projects', async () => {
    let resolveProjectA: (val: any) => void;
    const slowPromiseA = new Promise((resolve) => {
      resolveProjectA = resolve;
    });

    const artefactB = createSampleArtefact(projectB, 'PERFORMANCE_STRATEGY');
    const fastDetailB: ArtefactDetailResponse = {
      artefact: artefactB,
      staleness: {
        isStale: false,
        reasons: [],
        currentContractVersion: 'v0.1-draft',
        artefactContractVersion: 'v0.1-draft',
        currentContractFingerprint: 'fp-B',
        artefactContractFingerprint: 'fp-B'
      },
      currentRevisionNumber: 1,
      revisions: [
        {
          id: 'rev-B-1',
          revisionNumber: 1,
          status: 'BLOCKED',
          recordedAt: new Date().toISOString(),
          actorDisplayName: 'Lead',
          sourceContractFingerprint: 'fp-B'
        }
      ]
    };

    const mockArtefactService: IArtefactService = {
      listArtefacts: vi.fn().mockResolvedValue([]),
      getArtefact: vi.fn().mockImplementation(async (pid) => {
        if (pid === projectA.id) {
          return slowPromiseA;
        }
        return fastDetailB;
      }),
      generateArtefact: vi.fn(),
      exportArtefactMarkdown: vi.fn()
    };

    // 1. Mount with Project A (slow response pending)
    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: new MockProjectService(),
            intelligenceService: new MockIntelligenceService(),
            artefactService: mockArtefactService
          }}
        >
          <StrategyPage project={projectA} />
        </ServiceProvider>
      );
    });

    // 2. User rapidly switches to Project B
    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            projectService: new MockProjectService(),
            intelligenceService: new MockIntelligenceService(),
            artefactService: mockArtefactService
          }}
        >
          <StrategyPage project={projectB} />
        </ServiceProvider>
      );
    });

    // Project B is rendered
    expect(container.textContent).toContain(artefactB.title);

    // 3. Now Project A resolves late (out of order)
    const artefactA = createSampleArtefact(projectA, 'PERFORMANCE_STRATEGY');
    await act(async () => {
      resolveProjectA({
        artefact: artefactA,
        staleness: { isStale: false, reasons: [], currentContractVersion: 'v0.1-draft', artefactContractVersion: 'v0.1-draft', currentContractFingerprint: 'fp-A', artefactContractFingerprint: 'fp-A' },
        currentRevisionNumber: 1,
        revisions: []
      });
    });

    // 4. Late response from Project A was ignored; Project B remains rendered!
    expect(container.textContent).toContain(artefactB.title);
    expect(container.textContent).not.toContain(artefactA.title);
  });
});
