import { describe, it, expect, beforeEach } from 'vitest';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';

describe('MockIntelligenceService', () => {
  let intelligenceService: MockIntelligenceService;

  beforeEach(() => {
    intelligenceService = new MockIntelligenceService();
  });

  it('returns the exact reference summary metrics for RetailCo', async () => {
    const summary = await intelligenceService.getIntelligenceSummary('proj-retailco-bf2026');

    // M0.1 constitutionally verified metrics: 5 documents, 28 requirements, 11 perf reqs, 3 conflicts, 7 missing
    expect(summary.documentsAnalysed).toBe(5);
    expect(summary.requirementsFound).toBe(28);
    expect(summary.performanceRequirements).toBe(11);
    expect(summary.conflicts).toBe(3);
    expect(summary.missingInformation).toBe(7);
    expect(summary.readinessSections).toHaveLength(7);
  });

  it('returns default zeroed metrics for an unknown or newly created project', async () => {
    const summary = await intelligenceService.getIntelligenceSummary('unknown-proj');
    expect(summary.documentsAnalysed).toBe(0);
    expect(summary.conflicts).toBe(0);
    expect(summary.requirementsFound).toBe(0);
    expect(summary.readinessSections).toEqual([]);
  });

  it('retrieves intelligence items for RetailCo with valid parameters', async () => {
    const items = await intelligenceService.getIntelligenceItems('proj-retailco-bf2026');
    expect(items.length).toBeGreaterThan(0);

    const peakOrders = items.find((i) => i.key === 'peak_hourly_orders');
    expect(peakOrders).toBeDefined();
    expect(peakOrders?.canonicalState).toBe('CONFLICTING');
    expect(peakOrders?.reviewStatus).toBe('CONFLICTING');
    expect(peakOrders?.candidates).toHaveLength(3);
  });

  it('approves an unreviewed intelligence item and updates canonical state to APPROVED', async () => {
    const updated = await intelligenceService.approveIntelligenceItem(
      'proj-retailco-bf2026',
      'intel-checkout-latency',
      'Chief Architect'
    );

    expect(updated.canonicalState).toBe('APPROVED');
    expect(updated.reviewStatus).toBe('FOUND');
    expect(updated.approvalState).toBe('APPROVED');
    expect(updated.approvedBy).toBe('Chief Architect');
    expect(updated.approvalDate).toBeDefined();

    const historyLast = updated.history[updated.history.length - 1];
    expect(historyLast.actor).toBe('Chief Architect');
    expect(historyLast.action).toContain('APPROVED');
  });

  it('throws when attempting to approve an item from an unknown project or unknown item', async () => {
    await expect(
      intelligenceService.approveIntelligenceItem('nonexistent-project', 'item-1', 'Architect')
    ).rejects.toThrow('not found');

    await expect(
      intelligenceService.approveIntelligenceItem('proj-retailco-bf2026', 'nonexistent-item', 'Architect')
    ).rejects.toThrow('not found');
  });
});
