import { describe, it, expect } from 'vitest';
import {
  buildWorkloadVisualisationSeries,
  WorkloadVisualisationData
} from '../components/workload/workloadVisualisationAdapter';
import { ResultsReportVisualisationHook } from '@pecp/pe-domain';
import { AUTHORITATIVE_RETAILCO_RESULTS_REPORT } from '../fixtures/retailco/authoritativeRetailCoExecutionEvidence';

describe('M4.3 — Workload Visualisation Adapter', () => {
  describe('1. Authoritative RetailCo Reference Profile', () => {
    const hook = AUTHORITATIVE_RETAILCO_RESULTS_REPORT.visualisationHook;

    it('produces exact RetailCo scheduler timeline points (0, 300, 1200, 1320s)', () => {
      const data: WorkloadVisualisationData = buildWorkloadVisualisationSeries(hook);

      expect(data.hasData).toBe(true);
      expect(data.schedulerPoints).toHaveLength(4);

      // t=0s -> 0
      expect(data.schedulerPoints[0]).toEqual({
        elapsedSeconds: 0,
        rate: 0,
        label: 't=0s: 0'
      });

      // t=300s -> 109.375
      expect(data.schedulerPoints[1]).toEqual({
        elapsedSeconds: 300,
        rate: 109.375,
        stageIndex: 1,
        label: 'Stage 1: 109.375'
      });

      // t=1200s -> 109.375
      expect(data.schedulerPoints[2]).toEqual({
        elapsedSeconds: 1200,
        rate: 109.375,
        stageIndex: 2,
        label: 'Stage 2: 109.375'
      });

      // t=1320s -> 0
      expect(data.schedulerPoints[3]).toEqual({
        elapsedSeconds: 1320,
        rate: 0,
        stageIndex: 3,
        label: 'Stage 3: 0'
      });
    });

    it('verifies exact RetailCo journey distribution mix (55%, 20%, 15%, 8%, 2%)', () => {
      const data = buildWorkloadVisualisationSeries(hook);

      expect(data.journeyMetadata).toHaveLength(5);
      expect(data.summary.isDistributionComplete).toBe(true);
      expect(data.summary.journeySumPercentage).toBe(100);

      const [browse, search, basket, checkout, account] = data.journeyMetadata;
      expect(browse.key).toBe('browse');
      expect(browse.percentage).toBe(55);
      expect(browse.weight).toBe(0.55);

      expect(search.key).toBe('search');
      expect(search.percentage).toBe(20);
      expect(search.weight).toBe(0.2);

      expect(basket.key).toBe('basket');
      expect(basket.percentage).toBe(15);
      expect(basket.weight).toBe(0.15);

      expect(checkout.key).toBe('checkout');
      expect(checkout.percentage).toBe(8);
      expect(checkout.weight).toBe(0.08);

      expect(account.key).toBe('account');
      expect(account.percentage).toBe(2);
      expect(account.weight).toBe(0.02);
    });

    it('calculates exact peak per-journey rates matching Constitution law', () => {
      const data = buildWorkloadVisualisationSeries(hook);
      const [browse, search, basket, checkout, account] = data.journeyMetadata;

      // Peak = 109.375
      // Browse = 109.375 * 0.55 = 60.15625
      expect(browse.peakRate).toBe(60.15625);

      // Search = 109.375 * 0.20 = 21.875
      expect(search.peakRate).toBe(21.875);

      // Basket = 109.375 * 0.15 = 16.40625
      expect(basket.peakRate).toBe(16.40625);

      // Checkout = 109.375 * 0.08 = 8.75
      expect(checkout.peakRate).toBe(8.75);

      // Account = 109.375 * 0.02 = 2.1875
      expect(account.peakRate).toBe(2.1875);

      // Exact sum: 60.15625 + 21.875 + 16.40625 + 8.75 + 2.1875 = 109.375
      const sum =
        (browse.peakRate ?? 0) +
        (search.peakRate ?? 0) +
        (basket.peakRate ?? 0) +
        (checkout.peakRate ?? 0) +
        (account.peakRate ?? 0);
      expect(sum).toBe(109.375);
    });

    it('verifies journey series points at all stage boundaries', () => {
      const data = buildWorkloadVisualisationSeries(hook);
      expect(data.journeySeriesPoints).toHaveLength(4);

      // t=0s -> all 0
      expect(data.journeySeriesPoints[0]).toEqual({
        elapsedSeconds: 0,
        totalSchedulerRate: 0,
        browse: 0,
        search: 0,
        basket: 0,
        checkout: 0,
        account: 0
      });

      // t=300s -> peak
      expect(data.journeySeriesPoints[1]).toEqual({
        elapsedSeconds: 300,
        totalSchedulerRate: 109.375,
        browse: 60.15625,
        search: 21.875,
        basket: 16.40625,
        checkout: 8.75,
        account: 2.1875
      });

      // t=1200s -> peak
      expect(data.journeySeriesPoints[2]).toEqual({
        elapsedSeconds: 1200,
        totalSchedulerRate: 109.375,
        browse: 60.15625,
        search: 21.875,
        basket: 16.40625,
        checkout: 8.75,
        account: 2.1875
      });

      // t=1320s -> 0
      expect(data.journeySeriesPoints[3]).toEqual({
        elapsedSeconds: 1320,
        totalSchedulerRate: 0,
        browse: 0,
        search: 0,
        basket: 0,
        checkout: 0,
        account: 0
      });
    });

    it('preserves caller input without mutating the original hook', () => {
      const frozenHook = Object.freeze(JSON.parse(JSON.stringify(hook)));
      expect(() => buildWorkloadVisualisationSeries(frozenHook)).not.toThrow();
    });
  });

  describe('2. Governed Absence & Custom Schedule Shapes', () => {
    it('preserves missing startRate as null without fabricating 0', () => {
      const customHook: ResultsReportVisualisationHook = {
        scheduler: {
          executionModel: 'OPEN',
          population: 'JOURNEY_ITERATION',
          rateUnit: 'journey_iterations/second',
          startRate: null,
          peakArrivalRate: 50
        },
        stages: [
          {
            stageIndex: 1,
            durationSeconds: 120,
            startTimeSeconds: 0,
            endTimeSeconds: 120,
            startArrivalRate: null,
            targetArrivalRate: 50
          }
        ],
        journeyDistribution: []
      };

      const data = buildWorkloadVisualisationSeries(customHook);
      expect(data.schedulerPoints[0].rate).toBeNull();
      expect(data.schedulerPoints[0].label).toBe('t=0s: absent');
      expect(data.summary.startRate).toBeNull();
    });

    it('renders increasing stress-style multi-stage schedules exactly', () => {
      const stressHook: ResultsReportVisualisationHook = {
        scheduler: {
          executionModel: 'OPEN',
          population: 'JOURNEY_ITERATION',
          rateUnit: 'journey_iterations/second',
          startRate: 10,
          peakArrivalRate: 200
        },
        stages: [
          {
            stageIndex: 1,
            durationSeconds: 60,
            startTimeSeconds: 0,
            endTimeSeconds: 60,
            startArrivalRate: 10,
            targetArrivalRate: 50
          },
          {
            stageIndex: 2,
            durationSeconds: 120,
            startTimeSeconds: 60,
            endTimeSeconds: 180,
            startArrivalRate: 50,
            targetArrivalRate: 100
          },
          {
            stageIndex: 3,
            durationSeconds: 180,
            startTimeSeconds: 180,
            endTimeSeconds: 360,
            startArrivalRate: 100,
            targetArrivalRate: 200
          }
        ],
        journeyDistribution: []
      };

      const data = buildWorkloadVisualisationSeries(stressHook);
      expect(data.schedulerPoints).toHaveLength(4);
      expect(data.schedulerPoints[0].rate).toBe(10);
      expect(data.schedulerPoints[1].rate).toBe(50);
      expect(data.schedulerPoints[2].rate).toBe(100);
      expect(data.schedulerPoints[3].rate).toBe(200);
      expect(data.summary.totalDurationSeconds).toBe(360);
    });

    it('does not normalize incomplete journey distribution and issues a governed warning', () => {
      const non100Hook: ResultsReportVisualisationHook = {
        scheduler: {
          executionModel: 'OPEN',
          population: 'JOURNEY_ITERATION',
          rateUnit: 'journey_iterations/second',
          startRate: 0,
          peakArrivalRate: 100
        },
        stages: [
          {
            stageIndex: 1,
            durationSeconds: 60,
            startTimeSeconds: 0,
            endTimeSeconds: 60,
            startArrivalRate: 0,
            targetArrivalRate: 100
          }
        ],
        journeyDistribution: [
          { name: 'Browse', percentage: 60, weight: 0.6 },
          { name: 'Search', percentage: 20, weight: 0.2 }
          // Totals 80%
        ]
      };

      const data = buildWorkloadVisualisationSeries(non100Hook);
      expect(data.summary.journeySumPercentage).toBe(80);
      expect(data.summary.isDistributionComplete).toBe(false);
      expect(data.validationIssues).toHaveLength(1);
      expect(data.validationIssues[0]).toContain('totals 80%');

      // Weights must remain unscaled
      expect(data.journeyMetadata[0].weight).toBe(0.6);
      expect(data.journeyMetadata[1].weight).toBe(0.2);
    });

    it('gracefully handles null or empty hook', () => {
      const data = buildWorkloadVisualisationSeries(null);
      expect(data.hasData).toBe(false);
      expect(data.schedulerPoints).toHaveLength(0);
      expect(data.validationIssues).toHaveLength(1);
    });
  });
});
