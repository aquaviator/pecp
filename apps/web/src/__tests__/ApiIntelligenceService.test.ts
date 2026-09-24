// ApiIntelligenceService Unit Tests
// Defined according to M5.0 Work Package §7 and PM Review Blockers 3 & 4

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiIntelligenceService } from '../services/api/ApiIntelligenceService';
import { IntelligenceItem } from '../types';

describe('M5.0 ApiIntelligenceService Web Adapter', () => {
  const originalFetch = global.fetch;
  let service: ApiIntelligenceService;

  beforeEach(() => {
    service = new ApiIntelligenceService('http://localhost:3001');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const sampleItems: IntelligenceItem[] = [
    {
      id: 'item-1',
      key: 'item.throughput',
      category: 'WORKLOAD',
      canonicalState: 'APPROVED',
      title: 'Peak Throughput Volume',
      value: '4500 req/sec',
      unit: 'req/sec',
      source: 'REQUIREMENTS_SPEC',
      sourceDocument: 'Architecture_v2.pdf',
      sourceLocation: 'Section 4.1',
      reviewStatus: 'FOUND',
      approvalState: 'APPROVED',
      history: [],
      capturedDate: '2026-09-24T00:00:00.000Z'
    },
    {
      id: 'item-2',
      key: 'item.latency',
      category: 'REQUIREMENTS',
      canonicalState: 'CONFLICTING',
      title: 'p95 Latency SLA',
      value: '200ms',
      unit: 'ms',
      source: 'SLA_DOC',
      sourceDocument: 'SLA_Doc.pdf',
      sourceLocation: 'Page 12',
      reviewStatus: 'CONFLICTING',
      approvalState: 'PENDING_APPROVAL',
      history: [],
      capturedDate: '2026-09-24T00:00:00.000Z'
    }
  ];

  it('1. maps API responses to exact IntelligenceItem[] on getIntelligenceItems preserving provenance', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: sampleItems })
    });

    const items = await service.getIntelligenceItems('proj-123');
    expect(items).toEqual(sampleItems);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/v1/projects/proj-123/intelligence', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    // Check exact provenance fields
    expect(items[0].sourceDocument).toBe('Architecture_v2.pdf');
    expect(items[0].sourceLocation).toBe('Section 4.1');
    expect(items[0].reviewStatus).toBe('FOUND');
    expect(items[0].approvalState).toBe('APPROVED');
  });

  it('2. maps single item and returns null on 404 for getIntelligenceItemById', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('item-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => sampleItems[0]
        };
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: { code: 'NOT_FOUND', message: 'Item not found' } })
      };
    });

    const item = await service.getIntelligenceItemById('proj-123', 'item-1');
    expect(item).toEqual(sampleItems[0]);

    const missing = await service.getIntelligenceItemById('proj-123', 'item-missing');
    expect(missing).toBeNull();
  });

  it('3. getIntelligenceSummary explicitly rejects to prevent client-invented summary semantics', async () => {
    await expect(service.getIntelligenceSummary('proj-123')).rejects.toThrow(
      /ApiIntelligenceService: getIntelligenceSummary is not supported in API mode in M5.0. Server-side intelligence review summary is not platformised, and client-side summary invention is forbidden./
    );
  });

  it('4. preserves real API and network errors without falling back to mock fixtures', async () => {
    // 500 server error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database disk I/O failure'
        }
      })
    });

    await expect(service.getIntelligenceItems('proj-123')).rejects.toThrow('Database disk I/O failure');

    // Network disconnection error
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    await expect(service.getIntelligenceItems('proj-123')).rejects.toThrow(/Failed to connect to PECP API/);
  });

  it('5. mutation/approval methods explicitly reject because authenticated actor identity is deferred to M5.1', async () => {
    await expect(
      service.resolveIntelligenceConflict('proj-123', 'item-2', 'cand-1', 'agreed target')
    ).rejects.toThrow(/requires authenticated actor identity \(deferred to M5.1\)/);

    await expect(
      service.approveIntelligenceItem('proj-123', 'item-2', 'Lead Architect')
    ).rejects.toThrow(/requires authenticated actor identity \(deferred to M5.1\)/);
  });

  it('6. malformed successful API list envelopes fail rather than becoming empty collections', async () => {
    // Missing items property in envelope
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    });

    await expect(service.getIntelligenceItems('proj-123')).rejects.toThrow(
      /ApiIntelligenceService: Malformed API response .* expected '{ items: \[\.\.\.\] }' envelope/
    );

    // items is null or not an array
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: null })
    });

    await expect(service.getIntelligenceItems('proj-123')).rejects.toThrow(
      /ApiIntelligenceService: Malformed API response .* expected '{ items: \[\.\.\.\] }' envelope/
    );
  });
});
