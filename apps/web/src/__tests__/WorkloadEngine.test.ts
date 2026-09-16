import { describe, it, expect } from 'vitest';
import {
  convertThroughput,
  calculateLittlesLaw,
  evaluateSessionConcurrency,
  applyGrowthAndHeadroom,
  validateJourneyDistribution,
  evaluateWorkloadReadiness
} from '@pecp/workload-engine';

describe('Workload Engine: Pure Deterministic Mathematics (M1)', () => {
  describe('Business Throughput Conversion', () => {
    it('accurately converts RetailCo peak order throughput (31,500/hr = 525/min = 8.75/sec)', () => {
      const conversion = convertThroughput(31500, 'per_hour');

      expect(conversion.hourlyRate).toBe(31500);
      expect(conversion.perMinuteRate).toBe(525);
      expect(conversion.perSecondRate).toBe(8.75);

      // Verify calculation lineage
      expect(conversion.lineage).toBeDefined();
      expect(conversion.lineage.formulaIdentifier).toBe('throughput_time_unit_conversion');
      expect(conversion.lineage.outputValue).toBe(8.75);
      expect(conversion.lineage.unit).toBe('orders/second');
      expect(conversion.lineage.derivationSteps).toHaveLength(3);

      // Verify semantic notice: unit conversion only, NOT session arrival rate
      expect(conversion.semanticNotice).toContain(
        'Unit conversion of transaction/order volume only'
      );
      expect(conversion.semanticNotice).toContain(
        'must NOT be described as user/session arrival rate'
      );
    });

    it('handles conversions starting from per_minute and per_second', () => {
      const fromMin = convertThroughput(60, 'per_minute');
      expect(fromMin.hourlyRate).toBe(3600);
      expect(fromMin.perSecondRate).toBe(1);

      const fromSec = convertThroughput(10, 'per_second');
      expect(fromSec.perMinuteRate).toBe(600);
      expect(fromSec.hourlyRate).toBe(36000);
    });

    it('rejects invalid or negative throughput rates', () => {
      expect(() => convertThroughput(-100)).toThrow();
      expect(() => convertThroughput(NaN)).toThrow();
    });
  });

  describe("Little's Law & Concurrency Refusal Law", () => {
    it('refuses to infer concurrent sessions when only peak order throughput and session duration are present', () => {
      const result = evaluateSessionConcurrency({
        hasSessionArrivalRate: false,
        sessionArrivalRate: undefined,
        hasSessionDuration: true,
        sessionDuration: 8,
        sessionDurationUnit: 'minutes',
        hasOrderThroughput: true,
        orderThroughput: 31500,
        orderThroughputUnit: 'per_hour'
      });

      expect(result.canCalculate).toBe(false);
      expect(result.calculation).toBeUndefined();
      expect(result.blocked).toBeDefined();

      const blocked = result.blocked!;
      expect(blocked.status).toBe('BLOCKED');
      expect(blocked.calculated).toBe(false);
      expect(blocked.outputParameter).toBe('concurrent_sessions');
      expect(blocked.reason).toContain('Average session duration is known, but session arrival rate is not');
      expect(blocked.reason).toContain('Peak order throughput cannot be assumed to equal session arrival rate');
      expect(blocked.requiredIntelligence[0]).toContain('Peak session starts/hour');
      expect(blocked.missingPrerequisites).toContain('session_arrival_rate');

      // Crucial anti-slop / anti-hallucination check: 8.75 * 480 != 4200 sessions
      expect(blocked.availableInputs.find((i) => i.parameter === 'order_throughput')?.value).toBe(31500);
      expect(blocked.availableInputs.find((i) => i.parameter === 'session_duration')?.value).toBe(8);
    });

    it("calculates Little's Law correctly when arrival rate and residence duration of the same flow population are available", () => {
      // 50 user session arrivals per second, 8 minutes (480s) residence time
      // L = λ × W = 50 × 480 = 24,000 concurrent sessions
      const lineage = calculateLittlesLaw({
        arrivalRate: 50,
        arrivalRateUnit: 'per_second',
        residenceTime: 8,
        residenceTimeUnit: 'minutes',
        flowPopulation: 'user_sessions'
      });

      expect(lineage.outputValue).toBe(24000);
      expect(lineage.unit).toBe('concurrent_user_sessions');
      expect(lineage.formulaIdentifier).toBe('littles_law_L_equals_lambda_times_W');
      expect(lineage.structuredSteps?.[0].operand).toBe(480);
      expect(lineage.structuredSteps?.[0].result).toBe(24000);
    });

    it('rejects invalid or non-positive Little\'s Law parameters', () => {
      expect(() =>
        calculateLittlesLaw({
          arrivalRate: -5,
          arrivalRateUnit: 'per_second',
          residenceTime: 10,
          residenceTimeUnit: 'seconds',
          flowPopulation: 'sessions'
        })
      ).toThrow();

      expect(() =>
        calculateLittlesLaw({
          arrivalRate: 10,
          arrivalRateUnit: 'per_second',
          residenceTime: 0,
          residenceTimeUnit: 'seconds',
          flowPopulation: 'sessions'
        })
      ).toThrow();
    });
  });

  describe('Growth and Headroom Transformations', () => {
    it('applies explicit growth and headroom compounded transformations without invented defaults', () => {
      // Base: 31,500 orders/hr, Growth: +20%, Headroom: +30%
      // After growth: 31,500 * 1.2 = 37,800
      // After headroom: 37,800 * 1.3 = 49,140
      const lineage = applyGrowthAndHeadroom({
        baseValue: 31500,
        baseUnit: 'orders/hour',
        growthPercentage: 20,
        headroomPercentage: 30,
        sourceBaseId: 'intel-peak-orders',
        parameterName: 'Peak Forecast Capacity'
      });

      expect(lineage.outputValue).toBe(49140);
      expect(lineage.unit).toBe('orders/hour');
      expect(lineage.formulaIdentifier).toBe(
        'base_times_one_plus_growth_times_one_plus_headroom'
      );
      expect(lineage.inputValues.find((i) => i.parameter === 'growth_percentage')?.value).toBe('20%');
      expect(lineage.inputValues.find((i) => i.parameter === 'engineering_headroom_percentage')?.value).toBe('30%');
    });

    it('calculates baseline unchanged when no growth or headroom are passed', () => {
      const lineage = applyGrowthAndHeadroom({
        baseValue: 10000,
        baseUnit: 'req/sec'
      });

      expect(lineage.outputValue).toBe(10000);
    });
  });

  describe('Journey Distribution Validation', () => {
    it('validates a distribution summing to 100% within tolerance', () => {
      const journeys = [
        { id: '1', name: 'Browse', percentage: 55, weight: 0.55 },
        { id: '2', name: 'Search', percentage: 20, weight: 0.20 },
        { id: '3', name: 'Basket', percentage: 15, weight: 0.15 },
        { id: '4', name: 'Checkout', percentage: 8, weight: 0.08 },
        { id: '5', name: 'Account', percentage: 2, weight: 0.02 }
      ];

      const result = validateJourneyDistribution(journeys);
      expect(result.isValid).toBe(true);
      expect(result.totalPercentage).toBe(100);
      expect(result.validationError).toBeUndefined();
    });

    it('fails validation and surfaces structured issue when percentages do not sum to 100%', () => {
      const invalidJourneys = [
        { id: '1', name: 'Browse', percentage: 50, weight: 0.5 },
        { id: '2', name: 'Search', percentage: 20, weight: 0.2 },
        { id: '3', name: 'Basket', percentage: 15, weight: 0.15 }
      ]; // Sum = 85%

      const result = validateJourneyDistribution(invalidJourneys);
      expect(result.isValid).toBe(false);
      expect(result.totalPercentage).toBe(85);
      expect(result.validationError).toContain('Journey distribution total is 85%');
      expect(result.validationError).toContain('deviates from 100% by 15.00%');
    });
  });

  describe('Workload Readiness Evaluation (M1.1 Gate Corrections)', () => {
    it('recognises avg_session_duration key and creates MISSING_PREREQUISITE for session_arrival_rate', () => {
      const items: any[] = [
        {
          id: 'intel-session-duration',
          key: 'avg_session_duration',
          title: 'Average User Session Duration',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'FOUND',
          value: 8,
          unit: 'minutes',
          history: []
        }
      ];

      const readiness = evaluateWorkloadReadiness(items);
      expect(readiness.status).toBe('BLOCKED');
      expect(readiness.blockingIssuesCount).toBeGreaterThanOrEqual(1);

      const missingIssue = readiness.issues.find(
        (i) => i.parameter === 'session_arrival_rate' && i.type === 'MISSING_PREREQUISITE'
      );
      expect(missingIssue).toBeDefined();
      expect(missingIssue?.severity).toBe('BLOCKING');
      expect(missingIssue?.description).toContain("Little's Law (L = λ × W) requires the arrival rate");
    });

    it('surfaces UNAPPROVED_CRITICAL_VALUE for unapproved critical workload inputs', () => {
      const items: any[] = [
        {
          id: 'intel-peak-orders',
          key: 'peak_hourly_orders',
          title: 'Peak Hourly Order Volume',
          category: 'WORKLOAD',
          canonicalState: 'IMPORTED',
          reviewStatus: 'FOUND',
          approvalState: 'UNREVIEWED',
          value: 24000,
          unit: 'orders/hour',
          history: []
        }
      ];

      const readiness = evaluateWorkloadReadiness(items);
      const unapprovedIssue = readiness.issues.find(
        (i) => i.type === 'UNAPPROVED_CRITICAL_VALUE' && i.parameter === 'peak_hourly_orders'
      );
      expect(unapprovedIssue).toBeDefined();
      expect(unapprovedIssue?.severity).toBe('BLOCKING');
      expect(unapprovedIssue?.description).toContain('has not been formally approved');
    });

    it('avoids duplicate issues when an item is already flagged as CONFLICTING_SOURCE', () => {
      const items: any[] = [
        {
          id: 'intel-peak-orders',
          key: 'peak_hourly_orders',
          title: 'Peak Hourly Order Volume',
          category: 'WORKLOAD',
          canonicalState: 'CONFLICTING',
          reviewStatus: 'CONFLICTING',
          approvalState: 'UNREVIEWED',
          value: '31,500 (Candidate)',
          candidates: [{ id: 'c1', value: 18000 }, { id: 'c2', value: 31500 }],
          history: []
        }
      ];

      const readiness = evaluateWorkloadReadiness(items);
      const issuesForPeakOrders = readiness.issues.filter(
        (i) => i.sourceIntelligenceId === 'intel-peak-orders'
      );

      // Must have exactly 1 issue (CONFLICTING_SOURCE), not duplicated with UNAPPROVED_CRITICAL_VALUE
      expect(issuesForPeakOrders).toHaveLength(1);
      expect(issuesForPeakOrders[0].type).toBe('CONFLICTING_SOURCE');
    });

    it('produces deterministic READY status when all required parameters are approved and valid', () => {
      const readyItems: any[] = [
        {
          id: 'intel-peak-orders',
          key: 'peak_hourly_orders',
          title: 'Peak Hourly Order Volume',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'APPROVED',
          approvalState: 'APPROVED',
          value: 31500,
          unit: 'orders/hour',
          history: []
        },
        {
          id: 'intel-session-duration',
          key: 'avg_session_duration',
          title: 'Average User Session Duration',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'APPROVED',
          approvalState: 'APPROVED',
          value: 8,
          unit: 'minutes',
          history: []
        },
        {
          id: 'intel-session-arrival',
          key: 'session_arrival_rate',
          title: 'Session Arrival Rate',
          category: 'WORKLOAD',
          canonicalState: 'APPROVED',
          reviewStatus: 'APPROVED',
          approvalState: 'APPROVED',
          value: 50,
          unit: 'per_second',
          history: []
        },
        {
          id: 'intel-checkout-latency',
          key: 'checkout_response_time',
          title: 'Checkout Response Time (p95)',
          category: 'ACCEPTANCE_CRITERIA',
          canonicalState: 'APPROVED',
          reviewStatus: 'APPROVED',
          approvalState: 'APPROVED',
          value: '<= 2.0',
          unit: 'seconds',
          history: []
        }
      ];

      const readiness = evaluateWorkloadReadiness(readyItems, {
        hasJourneyDistribution: true,
        journeyDistributionValid: true
      });

      expect(readiness.status).toBe('READY');
      expect(readiness.isReady).toBe(true);
      expect(readiness.blockingIssuesCount).toBe(0);
    });
  });
});
