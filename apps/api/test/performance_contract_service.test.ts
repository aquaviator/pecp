// Domain/Service Tests for PerformanceContractService
// Verifies explicit input eligibility evaluation, provenance mapping, and deterministic compilation

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PerformanceContractService,
  IProjectRepository,
  IIntelligenceRepository,
  AuthenticatedPrincipal,
  ProjectWithMetadata
} from '@pecp/platform-core';
import {
  ProjectSummary,
  IntelligenceItem,
  CanonicalState,
  ReviewStatus
} from '@pecp/pe-domain';

class InMemoryProjectRepository implements IProjectRepository {
  private projects = new Map<string, ProjectSummary>();

  async list(): Promise<ProjectSummary[]> {
    return Array.from(this.projects.values());
  }
  async listByOrganisation(): Promise<ProjectSummary[]> {
    return Array.from(this.projects.values());
  }
  async getById(id: string): Promise<ProjectSummary | null> {
    return this.projects.get(id) || null;
  }
  async getByIdWithMetadata(id: string): Promise<ProjectWithMetadata | null> {
    const p = this.projects.get(id);
    return p ? { project: p } : null;
  }
  async create(project: ProjectSummary): Promise<ProjectSummary> {
    this.projects.set(project.id, project);
    return project;
  }
  async save(project: ProjectSummary): Promise<void> {
    this.projects.set(project.id, project);
  }
  async update(id: string, updates: any): Promise<ProjectSummary | null> {
    const existing = this.projects.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.projects.set(id, updated);
    return updated;
  }
  async archive(id: string): Promise<ProjectSummary | null> {
    const existing = this.projects.get(id);
    if (!existing) return null;
    existing.status = 'ARCHIVED';
    return existing;
  }
  async countByOrganisation(): Promise<number> {
    return this.projects.size;
  }
}

class InMemoryIntelligenceRepository implements IIntelligenceRepository {
  private items = new Map<string, IntelligenceItem[]>();
  private snapshots: any[] = [];

  async listByProject(projectId: string): Promise<IntelligenceItem[]> {
    return this.items.get(projectId) || [];
  }
  async getById(projectId: string, itemId: string): Promise<IntelligenceItem | null> {
    const list = this.items.get(projectId) || [];
    return list.find((i) => i.id === itemId) || null;
  }
  async saveItems(projectId: string, itemsToSave: IntelligenceItem[]): Promise<void> {
    const list = this.items.get(projectId) || [];
    for (const item of itemsToSave) {
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
    }
    this.items.set(projectId, list);
  }
  async listAll(): Promise<IntelligenceItem[]> {
    return Array.from(this.items.values()).flat();
  }
  async saveRevisionSnapshot(snapshot: any): Promise<void> {
    this.snapshots.push(snapshot);
  }
  async listRevisionSnapshots(projectId: string, itemId: string): Promise<any[]> {
    return this.snapshots.filter((s) => s.projectId === projectId && s.itemId === itemId);
  }
  async getRevisionSnapshot(
    projectId: string,
    itemId: string,
    revisionNumber: number
  ): Promise<any | null> {
    return (
      this.snapshots.find(
        (s) => s.projectId === projectId && s.itemId === itemId && s.revisionNumber === revisionNumber
      ) || null
    );
  }
}

describe('PerformanceContractService — Domain & Eligibility Specification', () => {
  let projectRepo: InMemoryProjectRepository;
  let intelligenceRepo: InMemoryIntelligenceRepository;
  let service: PerformanceContractService;

  const testProject: ProjectSummary = {
    id: 'proj-northstar-test',
    name: 'Northstar Peak 2027',
    organisation: 'Northstar Retail Logistics',
    organisationId: 'org-northstar',
    intent: 'FORECAST',
    description: 'Black Friday 2027 forecast',
    createdDate: '2026-10-01T10:00:00.000Z',
    status: 'ACTIVE',
    documentsCount: 1,
    requirementsCount: 1,
    conflictsCount: 0
  };

  const authorizedPrincipal: AuthenticatedPrincipal = {
    userId: 'user-peter',
    email: 'peter@northstar.internal',
    displayName: 'Peter Lead',
    platformRole: 'NONE',
    memberships: [
      {
        organisationId: 'org-northstar',
        role: 'PERFORMANCE_LEAD'
      }
    ],
    sessionId: 'session-peter',
    authenticatedAt: '2026-10-01T10:00:00.000Z'
  };

  const foreignPrincipal: AuthenticatedPrincipal = {
    userId: 'user-charlie',
    email: 'charlie@contoso.internal',
    displayName: 'Charlie Contoso',
    platformRole: 'NONE',
    memberships: [
      {
        organisationId: 'org-contoso',
        role: 'ORG_ADMIN'
      }
    ],
    sessionId: 'session-charlie',
    authenticatedAt: '2026-10-01T10:00:00.000Z'
  };

  beforeEach(async () => {
    projectRepo = new InMemoryProjectRepository();
    intelligenceRepo = new InMemoryIntelligenceRepository();
    await projectRepo.save(testProject);

    service = new PerformanceContractService({
      projectRepository: projectRepo,
      intelligenceRepository: intelligenceRepo
    });
  });

  describe('Eligibility Evaluation States', () => {
    it('1. Detects MISSING required peak throughput input and blocks compilation', async () => {
      // No items in repository
      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      expect(result.blockingIssues).toHaveLength(1);
      expect(result.blockingIssues[0].fieldKey).toBe('peak_orders_per_hr');
      expect(result.blockingIssues[0].issueType).toBe('MISSING_PREREQUISITE');
      expect(result.blockingIssues[0].reason).toContain('MISSING');
      expect(Object.keys(result.compiledValues)).toHaveLength(0);
    });

    it('2. Detects CONFLICTING item across competing candidates and blocks compilation', async () => {
      const conflictingItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'CONFLICTING',
        reviewStatus: 'CONFLICTING',
        value: 30000,
        unit: 'orders/hr',
        revision: 2,
        candidates: [
          {
            id: 'cand-1',
            value: 24000,
            unit: 'orders/hr',
            source: 'CSV',
            sourceDocument: 'forecast.csv',
            sourceLocation: 'row:2',
            canonicalState: 'IMPORTED',
            reviewStatus: 'FOUND',
            capturedDate: '2026-10-01'
          },
          {
            id: 'cand-2',
            value: 30000,
            unit: 'orders/hr',
            source: 'Brief',
            sourceDocument: 'Commercial Brief',
            sourceLocation: 'para:1',
            canonicalState: 'MANUAL',
            reviewStatus: 'FOUND',
            capturedDate: '2026-10-01'
          }
        ],
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [conflictingItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      const issue = result.blockingIssues.find((i) => i.fieldKey === 'peak_orders_per_hr');
      expect(issue).toBeDefined();
      expect(issue!.issueType).toBe('CONFLICTING_SOURCE');
      expect(issue!.reason).toContain('CONFLICTING');
      expect(result.contract.blockedWorkloadCalculations.length).toBeGreaterThan(0);
    });

    it('3. Detects STALE item when bound source has been superseded and blocks compilation', async () => {
      const staleItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'STALE',
        reviewStatus: 'STALE',
        approvalState: 'UNREVIEWED',
        value: 24000,
        unit: 'orders/hr',
        revision: 4,
        sourceBindings: [
          {
            projectId: 'proj-northstar-test',
            sourceId: 'src-csv',
            sourceVersionId: 'ver-csv-1',
            sourceVersionNumber: 1,
            originalSha256: 'abc123sha',
            locator: 'row:2,col:declared_value'
          }
        ],
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [staleItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      const issue = result.blockingIssues.find((i) => i.fieldKey === 'peak_orders_per_hr');
      expect(issue).toBeDefined();
      expect(issue!.issueType).toBe('STALE_SOURCE');
      expect(issue!.reason).toContain('STALE');
      expect(result.contract.blockedWorkloadCalculations[0].reason).toContain('STALE');
    });

    it('4. Detects UNAPPROVED item and prevents premature compilation', async () => {
      const unapprovedItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'IMPORTED',
        reviewStatus: 'FOUND',
        approvalState: 'UNREVIEWED',
        value: 24000,
        unit: 'orders/hr',
        revision: 1,
        sourceBindings: [
          {
            projectId: 'proj-northstar-test',
            sourceId: 'src-csv',
            sourceVersionId: 'ver-csv-1',
            sourceVersionNumber: 1,
            originalSha256: 'abc123sha',
            locator: 'row:2,col:declared_value'
          }
        ],
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [unapprovedItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      const issue = result.blockingIssues.find((i) => i.fieldKey === 'peak_orders_per_hr');
      expect(issue).toBeDefined();
      expect(issue!.issueType).toBe('UNAPPROVED_CRITICAL_VALUE');
      expect(issue!.reason).toContain('not been formally approved');
    });

    it('5. Detects INVALID_TYPE for non-numeric throughput specification', async () => {
      const invalidTypeItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'APPROVED',
        reviewStatus: 'FOUND',
        approvalState: 'APPROVED',
        value: 'very-high-traffic',
        unit: 'orders/hr',
        revision: 1,
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [invalidTypeItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      const issue = result.blockingIssues.find((i) => i.fieldKey === 'peak_orders_per_hr');
      expect(issue).toBeDefined();
      expect(issue!.issueType).toBe('INVALID_VALUE_TYPE');
    });

    it('6. Detects INVALID_OR_MISSING_UNIT when required engineering unit is absent', async () => {
      const missingUnitItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'APPROVED',
        reviewStatus: 'FOUND',
        approvalState: 'APPROVED',
        value: 24000,
        unit: '',
        revision: 1,
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [missingUnitItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      const issue = result.blockingIssues.find((i) => i.fieldKey === 'peak_orders_per_hr');
      expect(issue).toBeDefined();
      expect(issue!.issueType).toBe('INCOMPATIBLE_UNITS_SEMANTICS');
    });

    it('7. Detects INVALID_PROVENANCE when intake-managed imported item has no source bindings', async () => {
      const brokenProvenanceItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'IMPORTED',
        reviewStatus: 'FOUND',
        approvalState: 'APPROVED',
        intakeManaged: true,
        value: 24000,
        unit: 'orders/hr',
        revision: 1,
        sourceBindings: [], // Empty source bindings!
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [brokenProvenanceItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      expect(result.isCompileReady).toBe(false);
      expect(result.status).toBe('BLOCKED');
      const issue = result.blockingIssues.find((i) => i.fieldKey === 'peak_orders_per_hr');
      expect(issue).toBeDefined();
      expect(issue!.issueType).toBe('MISSING_SOURCE_PROVENANCE');
    });
  });

  describe('Successful Compilation and Lineage Assembly', () => {
    it('8. Compiles approved intake intelligence into canonical contract with complete provenance', async () => {
      const approvedItem: IntelligenceItem = {
        id: 'intel-peak-orders',
        key: 'peak_orders_per_hr',
        title: 'Peak Orders per Hour',
        category: 'WORKLOAD',
        canonicalState: 'APPROVED',
        reviewStatus: 'FOUND',
        approvalState: 'APPROVED',
        value: 24000,
        unit: 'orders/hr',
        revision: 3,
        approvedBy: 'Peter Lead',
        approvalDate: '2026-10-01T10:15:00.000Z',
        activeApprovalSnapshot: {
          revision: 3,
          approvedAt: '2026-10-01T10:15:00.000Z',
          approvedByUserId: 'user-peter',
          approvedByUserDisplayName: 'Peter Lead',
          boundSourceVersionIds: ['ver-csv-1'],
          decisionNote: 'Approved forecast from 2027 CSV',
          value: 24000,
          unit: 'orders/hr'
        },
        sourceBindings: [
          {
            projectId: 'proj-northstar-test',
            sourceId: 'src-csv',
            sourceVersionId: 'ver-csv-1',
            sourceVersionNumber: 1,
            originalSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
            locator: 'row:2,col:declared_value',
            excerpt: '24000'
          }
        ],
        history: []
      };
      await intelligenceRepo.saveItems('proj-northstar-test', [approvedItem]);

      const result = await service.compileProjectPerformanceContract('proj-northstar-test', authorizedPrincipal);

      // Verify contract readiness
      expect(result.isCompileReady).toBe(true);
      expect(result.status).toBe('READY_FOR_APPROVAL');
      expect(result.blockingIssues).toHaveLength(0);
      expect(result.fingerprint).toMatch(/^fp-[a-f0-9]{8}$/);

      // Verify compiled values
      const compiled = result.compiledValues['peak_orders_per_hr'];
      expect(compiled).toBeDefined();
      expect(compiled.value).toBe(24000);
      expect(compiled.unit).toBe('orders/hr');

      // Verify complete, unfabricated provenance
      const prov = compiled.provenance;
      expect(prov.intelligenceItemId).toBe('intel-peak-orders');
      expect(prov.intelligenceRevision).toBe(3);
      expect(prov.canonicalState).toBe('APPROVED');
      expect(prov.reviewStatus).toBe('FOUND');
      expect(prov.approvalRevision).toBe(3);
      expect(prov.approvedBy).toBe('Peter Lead');
      expect(prov.decisionNote).toBe('Approved forecast from 2027 CSV');
      expect(prov.sourceId).toBe('src-csv');
      expect(prov.sourceVersionId).toBe('ver-csv-1');
      expect(prov.sourceVersionNumber).toBe(1);
      expect(prov.sourceSha256).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
      expect(prov.locator).toBe('row:2,col:declared_value');
      expect(prov.excerpt).toBe('24000');

      // Verify deterministic workload calculation inside canonical contract
      expect(result.contract.workloadCalculations).toHaveLength(1);
      const calc = result.contract.workloadCalculations[0];
      expect(calc.outputParameter).toBe('order_throughput_per_second');
      expect(calc.outputValue).toBeCloseTo(24000 / 3600, 3);
      expect(calc.formulaIdentifier).toBe('throughput_time_unit_conversion');
    });

    it('9. Rejects unauthorized principal with 403 Forbidden', async () => {
      await expect(
        service.compileProjectPerformanceContract('proj-northstar-test', foreignPrincipal)
      ).rejects.toThrow('PROJECT_READ permission required');
    });

    it('10. Throws 404 Not Found for non-existent project', async () => {
      await expect(
        service.compileProjectPerformanceContract('proj-non-existent', authorizedPrincipal)
      ).rejects.toThrow("Project 'proj-non-existent' not found");
    });
  });
});
