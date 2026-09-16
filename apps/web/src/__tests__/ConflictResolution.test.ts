import { describe, it, expect, beforeEach } from 'vitest';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';

describe('Intelligence Conflict Resolution Behavior', () => {
  let intelligenceService: MockIntelligenceService;

  beforeEach(() => {
    intelligenceService = new MockIntelligenceService();
  });

  it('resolves a conflicting parameter in favor of the designated authoritative candidate', async () => {
    const summaryBefore = await intelligenceService.getIntelligenceSummary('proj-retailco-bf2026');
    expect(summaryBefore.conflicts).toBe(3);

    const rationale = 'Approved 31,500 orders/hr based on executive commercial sign-off for Black Friday 2026.';
    const resolvedItem = await intelligenceService.resolveIntelligenceConflict(
      'proj-retailco-bf2026',
      'intel-peak-orders',
      'cand-3',
      rationale
    );

    // 1. Authoritative candidate value and metadata applied
    expect(resolvedItem.value).toBe('31,500');
    expect(resolvedItem.unit).toBe('orders/hour');
    expect(resolvedItem.source).toBe('Black Friday 2026 Business Forecast');
    expect(resolvedItem.sourceDocument).toBe('Doc: BF26-Commercial-Demand-Model.xlsx');

    // 2. Canonical state and review status correctly updated
    expect(resolvedItem.canonicalState).toBe('APPROVED');
    expect(resolvedItem.reviewStatus).toBe('FOUND');
    expect(resolvedItem.approvalState).toBe('APPROVED');
    expect(resolvedItem.approvedBy).toBe('Performance Lead');

    // 3. Lineage ledger audit record inserted
    const auditRecord = resolvedItem.history[resolvedItem.history.length - 1];
    expect(auditRecord).toBeDefined();
    expect(auditRecord.actor).toBe('Performance Lead');
    expect(auditRecord.action).toContain('Resolved conflict in favor of candidate (31,500 orders/hour)');
    expect(auditRecord.note).toBe(rationale);

    // 4. Summary counts and readiness section updated
    const summaryAfter = await intelligenceService.getIntelligenceSummary('proj-retailco-bf2026');
    expect(summaryAfter.conflicts).toBe(2);

    const workloadSection = summaryAfter.readinessSections.find((s) => s.id === 'workload');
    expect(workloadSection?.status).toBe('VERIFIED');
    expect(workloadSection?.summary).toContain('Peak hourly order candidate resolved');
  });

  it('rejects conflict resolution with invalid candidate ID', async () => {
    await expect(
      intelligenceService.resolveIntelligenceConflict(
        'proj-retailco-bf2026',
        'intel-peak-orders',
        'invalid-cand-id',
        'test rationale'
      )
    ).rejects.toThrow('Candidate invalid-cand-id not found');
  });

  it('rejects conflict resolution on items without candidates', async () => {
    await expect(
      intelligenceService.resolveIntelligenceConflict(
        'proj-retailco-bf2026',
        'intel-session-duration',
        'cand-1',
        'test rationale'
      )
    ).rejects.toThrow('has no candidates to resolve');
  });
});
