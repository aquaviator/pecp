import { describe, it, expect } from 'vitest';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import { RETAILCO_INTELLIGENCE_ITEMS_FIXTURE } from '../fixtures/retailco/intelligenceFixture';

describe('Draft Performance Contract Compiler (M1)', () => {
  it('compiles a Draft Performance Contract preserving engineering intent FORECAST', () => {
    const contract = compileDraftPerformanceContract({
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      intelligenceItems: RETAILCO_INTELLIGENCE_ITEMS_FIXTURE,
      version: 'v0.1-draft'
    });

    expect(contract.id).toBe('contract-proj-retailco-bf2026-v0.1-draft');
    expect(contract.projectName).toBe('Black Friday 2026 Readiness');
    expect(contract.engineeringIntent).toBe('FORECAST');
    expect(contract.version).toBe('v0.1-draft');
  });

  it('includes calculation lineage for derived workload throughput values', () => {
    const contract = compileDraftPerformanceContract({
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      intelligenceItems: RETAILCO_INTELLIGENCE_ITEMS_FIXTURE
    });

    expect(contract.workloadCalculations.length).toBeGreaterThan(0);
    const throughputCalc = contract.workloadCalculations[0];
    expect(throughputCalc.outputParameter).toBe('order_throughput_per_second');
    expect(throughputCalc.outputValue).toBe(8.75);
    expect(throughputCalc.unit).toBe('orders/second');
    expect(throughputCalc.formulaIdentifier).toBe('throughput_time_unit_conversion');
    expect(contract.calculationLineageReferences).toContain(throughputCalc.calculationId);
  });

  it('does NOT contain fabricated concurrent sessions and exposes blocked concurrency calculation', () => {
    const contract = compileDraftPerformanceContract({
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      intelligenceItems: RETAILCO_INTELLIGENCE_ITEMS_FIXTURE
    });

    // Concurrency must NOT be calculated
    const concurrencyCalc = contract.workloadCalculations.find(
      (c) => c.outputParameter === 'concurrent_sessions'
    );
    expect(concurrencyCalc).toBeUndefined();

    // Must be recorded in blockedWorkloadCalculations
    expect(contract.blockedWorkloadCalculations).toHaveLength(1);
    const blocked = contract.blockedWorkloadCalculations[0];
    expect(blocked.outputParameter).toBe('concurrent_sessions');
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.calculated).toBe(false);
    expect(blocked.reason).toContain('Average session duration is known, but session arrival rate is not');
    expect(blocked.requiredIntelligence[0]).toContain('Peak session starts/hour');
  });

  it('flags ambiguous checkout requirement as unresolved without silently inventing a percentile', () => {
    const contract = compileDraftPerformanceContract({
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      intelligenceItems: RETAILCO_INTELLIGENCE_ITEMS_FIXTURE
    });

    const checkoutCriterion = contract.acceptanceCriteria.find(
      (c) => c.key === 'checkout_response_time'
    );

    expect(checkoutCriterion).toBeDefined();
    expect(checkoutCriterion?.status).toBe('AMBIGUOUS');
    expect(checkoutCriterion?.percentile).toBeUndefined();
    expect(checkoutCriterion?.ambiguityNotice).toContain(
      'Target specifies < 2.0s without an associated percentile'
    );
    expect(checkoutCriterion?.isBlockingForApproval).toBe(true);
  });

  it('evaluates contract status truthfully as BLOCKED and reports blocking reasons', () => {
    const contract = compileDraftPerformanceContract({
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      intelligenceItems: RETAILCO_INTELLIGENCE_ITEMS_FIXTURE
    });

    // Contract must NOT be APPROVED
    expect(contract.status).toBe('BLOCKED');
    expect(contract.approvalReadiness.canApprove).toBe(false);
    expect(contract.approvalReadiness.unresolvedIssuesCount).toBeGreaterThan(0);
    expect(contract.approvalReadiness.blockingReasons.length).toBeGreaterThan(0);

    // Blocking reasons must mention the unresolved items
    const allReasons = contract.approvalReadiness.blockingReasons.join(' ');
    expect(allReasons).toMatch(/Peak Hourly Order Volume|session_arrival_rate|checkout/i);
  });
});
