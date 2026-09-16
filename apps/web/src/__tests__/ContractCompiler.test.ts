import { describe, it, expect } from 'vitest';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  RETAILCO_INTELLIGENCE_ITEMS_FIXTURE,
  RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
} from '../fixtures/retailco/intelligenceFixture';
import { IntelligenceItem } from '../types';

describe('Draft Performance Contract Compiler (M1 & M1.1)', () => {
  it('compiles a Draft Performance Contract preserving engineering intent FORECAST', () => {
    const contract = compileDraftPerformanceContract({
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
      version: 'v0.1-draft'
    });

    expect(contract.id).toBe('contract-proj-retailco-bf2026-v0.1-draft');
    expect(contract.projectName).toBe('Black Friday 2026 Readiness');
    expect(contract.engineeringIntent).toBe('FORECAST');
    expect(contract.version).toBe('v0.1-draft');
  });

  describe('Deterministic Governance & Candidate Resolution (M1.1 §2)', () => {
    it('refuses to calculate authoritative throughput from unresolved conflicting candidates', () => {
      // Pre-resolution M0 state where intel-peak-orders has reviewStatus = CONFLICTING and 3 candidates
      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_INTELLIGENCE_ITEMS_FIXTURE
      });

      // Must NOT contain order_throughput_per_second in authoritative workloadCalculations
      const throughputCalc = contract.workloadCalculations.find(
        (c) => c.outputParameter === 'order_throughput_per_second'
      );
      expect(throughputCalc).toBeUndefined();

      // Must be explicitly captured in blockedWorkloadCalculations
      const blockedThroughput = contract.blockedWorkloadCalculations.find(
        (b) => b.outputParameter === 'order_throughput_per_second'
      );
      expect(blockedThroughput).toBeDefined();
      expect(blockedThroughput?.status).toBe('BLOCKED');
      expect(blockedThroughput?.reason).toContain('Peak hourly order volume is in a CONFLICTING state');
      expect(blockedThroughput?.reason).toContain('An authoritative candidate must be formally selected');

      // Approval readiness must block because peak orders is conflicting
      expect(contract.status).toBe('BLOCKED');
      expect(contract.approvalReadiness.canApprove).toBe(false);
      const reasons = contract.approvalReadiness.blockingReasons.join(' ');
      expect(reasons).toMatch(/Peak hourly order volume/i);
    });

    it('compiles authoritative throughput with full lineage for post-resolution M1 state (31,500 orders/hr = 8.75 orders/sec)', () => {
      // Post-resolution M1 state where 31,500 has been formally approved
      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
      });

      expect(contract.workloadCalculations.length).toBeGreaterThan(0);
      const throughputCalc = contract.workloadCalculations.find(
        (c) => c.outputParameter === 'order_throughput_per_second'
      );
      expect(throughputCalc).toBeDefined();
      expect(throughputCalc?.outputValue).toBe(8.75);
      expect(throughputCalc?.unit).toBe('orders/second');
      expect(throughputCalc?.formulaIdentifier).toBe('throughput_time_unit_conversion');
      expect(contract.calculationLineageReferences).toContain(throughputCalc?.calculationId);

      // Throughput calculation is recorded in workloadCalculations, but NOT manufactured as acceptance criterion
      const derivedCrit = contract.acceptanceCriteria.find(
        (c) => c.key === 'peak_order_throughput_criterion'
      );
      expect(derivedCrit).toBeUndefined();
    });
  });

  describe('Acceptance Criteria & Magic Number Prohibition (M1.1 §3)', () => {
    it('does NOT manufacture default percentiles (e.g. p95) when percentile is omitted from intelligence', () => {
      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
      });

      const checkoutCriterion = contract.acceptanceCriteria.find(
        (c) => c.key === 'checkout_response_time'
      );

      expect(checkoutCriterion).toBeDefined();
      expect(checkoutCriterion?.status).toBe('AMBIGUOUS');
      // Must NOT default to 95!
      expect(checkoutCriterion?.percentile).toBeUndefined();
      expect(checkoutCriterion?.thresholdValue).toBe(2);
      expect(checkoutCriterion?.unit).toBe('seconds');
      expect(checkoutCriterion?.operator).toBe('<');
      expect(checkoutCriterion?.isBlockingForApproval).toBe(true);
      expect(checkoutCriterion?.ambiguityNotice).toMatch(
        /percentile.*not defined|without an associated percentile/i
      );
    });

    it('does NOT fabricate 0.8s, 2.0s, or 8.75 values when criteria/source data is missing or unstructured', () => {
      const minimalItems: IntelligenceItem[] = [
        {
          id: 'item-minimal-search',
          key: 'search_response_time',
          title: 'Catalog Search Latency Target',
          category: 'ACCEPTANCE_CRITERIA',
          canonicalState: 'IMPORTED',
          reviewStatus: 'AMBIGUOUS',
          history: []
          // Note: No value, no unit, no percentile supplied!
        }
      ];

      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: minimalItems
      });

      const searchCrit = contract.acceptanceCriteria.find(
        (c) => c.key === 'search_response_time'
      );
      expect(searchCrit).toBeDefined();
      // Must NOT invent 0.8 or 95!
      expect(searchCrit?.thresholdValue).toBeUndefined();
      expect(searchCrit?.percentile).toBeUndefined();
      expect(searchCrit?.status).toBe('AMBIGUOUS');

      // Throughput criterion must NOT be fabricated as 8.75 when no throughput calculation exists
      const throughputCrit = contract.acceptanceCriteria.find(
        (c) => c.key === 'peak_order_throughput_criterion'
      );
      expect(throughputCrit).toBeUndefined();
    });

    it('faithfully extracts percentile and threshold when explicitly present in source item', () => {
      const structuredItems: IntelligenceItem[] = [
        {
          id: 'item-p99',
          key: 'payment_latency',
          title: 'Payment Authorization Response Time (p99)',
          category: 'ACCEPTANCE_CRITERIA',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          value: '<= 1.5',
          unit: 'seconds',
          history: []
        }
      ];

      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: structuredItems
      });

      const paymentCrit = contract.acceptanceCriteria.find(
        (c) => c.key === 'payment_latency'
      );
      expect(paymentCrit).toBeDefined();
      expect(paymentCrit?.thresholdValue).toBe(1.5);
      expect(paymentCrit?.operator).toBe('<=');
      expect(paymentCrit?.unit).toBe('seconds');
      expect(paymentCrit?.percentile).toBe(99);
      expect(paymentCrit?.status).toBe('DEFINED');
    });
  });

  describe("Little's Law & Concurrency Block (M1.1 §4)", () => {
    it('does NOT contain fabricated concurrent sessions and exposes blocked concurrency calculation', () => {
      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
      });

      // Concurrency must NOT be calculated
      const concurrencyCalc = contract.workloadCalculations.find(
        (c) => c.outputParameter === 'concurrent_sessions'
      );
      expect(concurrencyCalc).toBeUndefined();

      // Must be recorded in blockedWorkloadCalculations
      const blocked = contract.blockedWorkloadCalculations.find(
        (b) => b.outputParameter === 'concurrent_sessions'
      );
      expect(blocked).toBeDefined();
      expect(blocked?.status).toBe('BLOCKED');
      expect(blocked?.calculated).toBe(false);
      expect(blocked?.reason).toContain('Average session duration is known, but session arrival rate is not');
      expect(blocked?.requiredIntelligence[0]).toContain('Peak session starts/hour');
    });

    it('evaluates contract status truthfully as BLOCKED and reports remaining blockers', () => {
      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
      });

      // Contract must NOT be APPROVED
      expect(contract.status).toBe('BLOCKED');
      expect(contract.approvalReadiness.canApprove).toBe(false);
      expect(contract.approvalReadiness.unresolvedIssuesCount).toBeGreaterThanOrEqual(2);

      // Remaining blockers: session arrival rate missing and checkout percentile ambiguous
      const allReasons = contract.approvalReadiness.blockingReasons.join(' ');
      expect(allReasons).toMatch(/session[_\s]arrival[_\s]rate/i);
      expect(allReasons).toMatch(/percentile/i);
    });
  });

  describe('M1.2 Final Semantic Gate Hardening', () => {
    it('produces a blocked / refused readiness state when intelligence is conflicting', () => {
      const conflictingItems: IntelligenceItem[] = [
        {
          id: 'item-peak',
          key: 'peak_hourly_orders',
          title: 'Peak Hourly Orders',
          category: 'WORKLOAD',
          canonicalState: 'CONFLICTING',
          reviewStatus: 'CONFLICTING',
          approvalState: 'UNREVIEWED',
          value: '31,500 (Candidate)',
          candidates: [
            {
              id: 'c1',
              value: 18000,
              unit: 'orders/hour',
              source: 'Source A',
              sourceDocument: 'Doc A',
              sourceLocation: 'p1',
              capturedDate: '2026-08-01',
              canonicalState: 'IMPORTED',
              reviewStatus: 'FOUND'
            },
            {
              id: 'c2',
              value: 31500,
              unit: 'orders/hour',
              source: 'Source B',
              sourceDocument: 'Doc B',
              sourceLocation: 'p2',
              capturedDate: '2026-08-01',
              canonicalState: 'IMPORTED',
              reviewStatus: 'FOUND'
            }
          ],
          history: []
        }
      ];

      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: conflictingItems
      });

      expect(contract.status).toBe('BLOCKED');
      expect(contract.approvalReadiness.canApprove).toBe(false);
      expect(contract.workloadCalculations.find((c) => c.outputParameter === 'order_throughput_per_second')).toBeUndefined();
      expect(contract.blockedWorkloadCalculations.find((b) => b.outputParameter === 'order_throughput_per_second')).toBeDefined();
    });

    it('compiles without warning when all semantic prerequisites are fully approved and satisfied', () => {
      const fullySatisfiedItems: IntelligenceItem[] = [
        {
          id: 'item-peak',
          key: 'peak_hourly_orders',
          title: 'Peak Hourly Orders',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvalState: 'APPROVED',
          value: 36000,
          unit: 'orders/hour',
          history: []
        },
        {
          id: 'item-session-arr',
          key: 'session_arrival_rate',
          title: 'Session Arrival Rate',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvalState: 'APPROVED',
          value: 50,
          unit: 'per_second',
          history: []
        },
        {
          id: 'item-session-dur',
          key: 'avg_session_duration',
          title: 'Average Session Duration',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvalState: 'APPROVED',
          value: 8,
          unit: 'minutes',
          history: []
        },
        {
          id: 'item-lat',
          key: 'checkout_response_time',
          title: 'Checkout Response Time (p95)',
          category: 'ACCEPTANCE_CRITERIA',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvalState: 'APPROVED',
          value: '<= 1.5',
          unit: 'seconds',
          history: []
        }
      ];

      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: fullySatisfiedItems,
        compilationTimestamp: '2026-09-16T12:00:00.000Z'
      });

      expect(contract.status).toBe('READY_FOR_APPROVAL');
      expect(contract.approvalReadiness.canApprove).toBe(true);
      expect(contract.approvalReadiness.blockingReasons).toHaveLength(0);
      expect(contract.approvalReadiness.unresolvedIssuesCount).toBe(0);

      // Concurrency calculated via Little's Law: 50 * 480 = 24,000
      const concurrencyCalc = contract.workloadCalculations.find((c) => c.outputParameter === 'concurrent_sessions');
      expect(concurrencyCalc).toBeDefined();
      expect(concurrencyCalc?.outputValue).toBe(24000);

      // Latency criterion properly defined with percentile 95
      const crit = contract.acceptanceCriteria.find((c) => c.key === 'checkout_response_time');
      expect(crit?.status).toBe('DEFINED');
      expect(crit?.percentile).toBe(95);
      expect(crit?.operator).toBe('<=');
      expect(crit?.thresholdValue).toBe(1.5);
    });

    it('proves compiler output does not invent acceptance criteria for derived throughput', () => {
      const itemsWithThroughputOnly: IntelligenceItem[] = [
        {
          id: 'item-peak',
          key: 'peak_hourly_orders',
          title: 'Peak Hourly Orders',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          approvalState: 'APPROVED',
          value: 36000,
          unit: 'orders/hour',
          history: []
        }
      ];

      const contract = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: itemsWithThroughputOnly
      });

      // Workload calculation exists
      const throughputCalc = contract.workloadCalculations.find((c) => c.outputParameter === 'order_throughput_per_second');
      expect(throughputCalc?.outputValue).toBe(10);

      // But NO acceptance criteria was invented
      expect(contract.acceptanceCriteria).toHaveLength(0);
      expect(contract.acceptanceCriteria.find((c) => c.key === 'peak_order_throughput_criterion')).toBeUndefined();
    });

    it('verifies determinism across repeated compilation runs with explicit timestamp', () => {
      const fixedTime = '2026-09-16T00:00:00.000Z';
      const contract1 = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        compilationTimestamp: fixedTime
      });

      const contract2 = compileDraftPerformanceContract({
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        compilationTimestamp: fixedTime
      });

      expect(contract1.createdAt).toBe(fixedTime);
      expect(contract2.createdAt).toBe(fixedTime);
      expect(contract1).toEqual(contract2);
    });
  });
});
