// @vitest-environment happy-dom
// M5.2 Performance Contract Portal Interaction & DOM-Capable Lineage Tests
// Proves DOM rendering of contract readiness, authoritative compiled values,
// blocking governance issues, and verifiable source provenance lineage.

import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceProvider } from '../services/ServiceContext';
import { ContractPage } from '../pages/project/ContractPage';
import { MockProjectService } from '../services/mock/MockProjectService';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';
import { IPerformanceContractService } from '../services/interfaces/IPerformanceContractService';
import { ProjectSummary } from '../types';
import { PerformanceContractCompilationResult } from '@pecp/pe-domain';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ContractPage DOM Portal Interaction & Provenance Lineage Verification', () => {
  let container: HTMLDivElement;
  let root: Root;

  const testProject: ProjectSummary = {
    id: 'proj-northstar-contract-dom',
    name: 'Northstar Peak 2027',
    organisation: 'Northstar Retail Logistics',
    organisationId: 'org-northstar',
    intent: 'FORECAST',
    description: 'Holiday Peak 2027 Performance Contract',
    createdDate: '2026-10-01T10:00:00.000Z',
    status: 'ACTIVE',
    documentsCount: 2,
    requirementsCount: 4,
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

  it('1. Renders BLOCKED contract state with deterministic blocking reasons and locked sign action', async () => {
    const mockBlockedResult: PerformanceContractCompilationResult = {
      projectId: testProject.id,
      projectName: testProject.name,
      engineeringIntent: testProject.intent,
      status: 'BLOCKED',
      isCompileReady: false,
      fingerprint: 'fp-blocked123',
      contract: {
        id: `contract-${testProject.id}-v0.1-draft`,
        projectId: testProject.id,
        projectName: testProject.name,
        version: 'v0.1-draft',
        engineeringIntent: testProject.intent,
        status: 'BLOCKED',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
        sourceIntelligenceReferences: [],
        workloadInputs: [],
        workloadCalculations: [],
        blockedWorkloadCalculations: [
          {
            calculationId: 'calc-blocked-throughput',
            outputParameter: 'order_throughput_per_second',
            status: 'BLOCKED',
            calculated: false,
            formulaIdentifier: 'throughput_time_unit_conversion',
            reason: 'Peak hourly order volume is in a CONFLICTING state across multiple competing candidates.',
            requiredIntelligence: ['Approved peak_orders_per_hr candidate'],
            missingPrerequisites: ['approved_peak_orders'],
            availableInputs: []
          }
        ],
        workloadReadiness: {
          status: 'BLOCKED',
          isReady: false,
          blockingIssuesCount: 1,
          warningIssuesCount: 0,
          issues: [
            {
              id: 'issue-1',
              type: 'CONFLICTING_SOURCE',
              parameter: 'peak_orders_per_hr',
              description: 'Field Peak Orders per Hour is in a CONFLICTING state.',
              severity: 'BLOCKING',
              remediationGuidance: 'Resolve competing assertion candidates.'
            }
          ],
          summary: '1 blocking issue'
        },
        acceptanceCriteria: [],
        unresolvedIssues: [],
        calculationLineageReferences: [],
        approvalReadiness: {
          canApprove: false,
          blockingReasons: [
            'Field Peak Orders per Hour is in a CONFLICTING state across 2 competing candidates.'
          ],
          unresolvedIssuesCount: 1
        },
        fingerprint: 'fp-blocked123'
      },
      compiledValues: {},
      blockingIssues: [
        {
          fieldKey: 'peak_orders_per_hr',
          title: 'Peak Orders per Hour',
          issueType: 'CONFLICTING_SOURCE',
          reason: 'Field Peak Orders per Hour is in a CONFLICTING state across 2 competing candidates.',
          severity: 'BLOCKING',
          remediationGuidance: 'Resolve competing assertion candidates.',
          intelligenceItemId: 'intel-1'
        }
      ],
      provenance: [],
      compiledAt: '2026-10-01T10:00:00.000Z'
    };

    const mockContractService: IPerformanceContractService = {
      getPerformanceContract: vi.fn().mockResolvedValue(mockBlockedResult)
    };

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            performanceContractService: mockContractService
          }}
        >
          <ContractPage project={testProject} />
        </ServiceProvider>
      );
    });

    // Wait for async effect resolution
    await act(async () => {
      await Promise.resolve();
    });

    // Verify contract readiness in DOM
    expect(container.textContent).toContain('Governed Performance Contract');
    expect(container.textContent).toContain('Approval Readiness: BLOCKED');
    expect(container.textContent).toContain('Sign & Approve Contract (Locked)');
    expect(container.textContent).toContain('fp-blocked123');
    expect(container.textContent).toContain('Field Peak Orders per Hour is in a CONFLICTING state across 2 competing candidates');

    // Verify locked button is disabled
    const button = container.querySelector('button[disabled]');
    expect(button).not.toBeNull();
  });

  it('2. Renders READY contract state with authoritative compiled values and source provenance', async () => {
    const mockReadyResult: PerformanceContractCompilationResult = {
      projectId: testProject.id,
      projectName: testProject.name,
      engineeringIntent: testProject.intent,
      status: 'READY_FOR_APPROVAL',
      isCompileReady: true,
      fingerprint: 'fp-ready9999',
      contract: {
        id: `contract-${testProject.id}-v0.1-draft`,
        projectId: testProject.id,
        projectName: testProject.name,
        version: 'v0.1-draft',
        engineeringIntent: testProject.intent,
        status: 'READY_FOR_APPROVAL',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-01T10:00:00.000Z',
        sourceIntelligenceReferences: [],
        workloadInputs: [
          {
            id: 'intel-peak',
            key: 'peak_orders_per_hr',
            title: 'Peak Orders per Hour',
            value: 24000,
            unit: 'orders/hr',
            canonicalState: 'APPROVED',
            reviewStatus: 'FOUND',
            sourceId: 'src-csv-1',
            revision: 3,
            approvalRevision: 3,
            sourceVersionId: 'ver-csv-1',
            sourceVersionNumber: 1,
            sourceSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            locator: 'row:2,col:declared_value',
            excerpt: '24000'
          }
        ],
        workloadCalculations: [
          {
            calculationId: 'calc-throughput-peak-24000',
            outputParameter: 'order_throughput_per_second',
            outputValue: 6.66667,
            unit: 'orders/second',
            formulaIdentifier: 'throughput_time_unit_conversion',
            humanReadableExplanation: '24,000 orders/hr converted to 6.67 orders/sec',
            inputValues: [
              {
                parameter: 'peak_orders_per_hr',
                value: 24000,
                unit: 'orders/hr'
              }
            ],
            sourceIntelligenceIds: ['intel-peak'],
            timestamp: '2026-10-01T10:00:00.000Z'
          }
        ],
        blockedWorkloadCalculations: [],
        workloadReadiness: {
          status: 'READY',
          isReady: true,
          blockingIssuesCount: 0,
          warningIssuesCount: 0,
          issues: [],
          summary: 'All requirements satisfied'
        },
        acceptanceCriteria: [],
        unresolvedIssues: [],
        calculationLineageReferences: ['calc-throughput-peak-24000'],
        approvalReadiness: {
          canApprove: true,
          blockingReasons: [],
          unresolvedIssuesCount: 0
        },
        fingerprint: 'fp-ready9999'
      },
      compiledValues: {
        peak_orders_per_hr: {
          key: 'peak_orders_per_hr',
          title: 'Peak Orders per Hour',
          value: 24000,
          unit: 'orders/hr',
          provenance: {
            fieldKey: 'peak_orders_per_hr',
            intelligenceItemId: 'intel-peak',
            intelligenceRevision: 3,
            canonicalState: 'APPROVED',
            reviewStatus: 'FOUND',
            approvalRevision: 3,
            approvedBy: 'Peter Lead',
            approvedAt: '2026-10-01T10:15:00.000Z',
            decisionNote: 'Accepted forecast CSV',
            sourceId: 'src-csv-1',
            sourceVersionId: 'ver-csv-1',
            sourceVersionNumber: 1,
            sourceSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            locator: 'row:2,col:declared_value',
            excerpt: '24000',
            value: 24000,
            unit: 'orders/hr'
          }
        }
      },
      blockingIssues: [],
      provenance: [
        {
          fieldKey: 'peak_orders_per_hr',
          intelligenceItemId: 'intel-peak',
          intelligenceRevision: 3,
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvalRevision: 3,
          approvedBy: 'Peter Lead',
          approvedAt: '2026-10-01T10:15:00.000Z',
          decisionNote: 'Accepted forecast CSV',
          sourceId: 'src-csv-1',
          sourceVersionId: 'ver-csv-1',
          sourceVersionNumber: 1,
          sourceSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          locator: 'row:2,col:declared_value',
          excerpt: '24000',
          value: 24000,
          unit: 'orders/hr'
        }
      ],
      compiledAt: '2026-10-01T10:00:00.000Z'
    };

    const mockContractService: IPerformanceContractService = {
      getPerformanceContract: vi.fn().mockResolvedValue(mockReadyResult)
    };

    await act(async () => {
      root.render(
        <ServiceProvider
          overrideServices={{
            performanceContractService: mockContractService
          }}
        >
          <ContractPage project={testProject} />
        </ServiceProvider>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Verify Ready state in DOM
    expect(container.textContent).toContain('Approval Readiness: READY FOR APPROVAL');
    expect(container.textContent).toContain('Sign & Approve Contract');
    expect(container.textContent).toContain('fp-ready9999');

    // Verify Authoritative Governed Inputs & Source Provenance table renders in DOM
    expect(container.textContent).toContain('Authoritative Governed Inputs & Source Provenance');
    expect(container.textContent).toContain('peak_orders_per_hr');
    expect(container.textContent).toContain('24,000 orders/hr');
    expect(container.textContent).toContain('Version 1');
    expect(container.textContent).toContain('SHA: 9f86d081884c...');
    expect(container.textContent).toContain('row:2,col:declared_value');
    expect(container.textContent).toContain('"24000"');
    expect(container.textContent).toContain('Peter Lead');
    expect(container.textContent).toContain('Rev 3');

    // Verify Sign button is enabled
    const button = container.querySelector('button.bg-emerald-600') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(false);

    // Verify Machine-Readable JSON toggle
    const jsonTabButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Machine-Readable JSON')
    );
    expect(jsonTabButton).toBeDefined();

    await act(async () => {
      jsonTabButton!.click();
    });

    expect(container.textContent).toContain('fp-ready9999');
    expect(container.textContent).toContain('peak_orders_per_hr');
    expect(container.textContent).toContain('Copy JSON');
  });
});
