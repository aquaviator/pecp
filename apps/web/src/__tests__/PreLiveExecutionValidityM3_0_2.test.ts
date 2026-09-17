import { describe, it, expect, vi } from 'vitest';

vi.mock('k6/http', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), patch: vi.fn() }
}));
vi.mock('k6', () => ({
  check: vi.fn(),
  sleep: vi.fn()
}));
vi.mock('k6/metrics', () => ({
  Counter: class { add() {} },
  Rate: class { add() {} },
  Trend: class { add() {} }
}));

import {
  compileTestDefinition,
  compileK6Bundle,
  buildK6Thresholds,
  PECP_STABLE_K6_RUNTIME_VERSION,
  PECP_STABLE_K6_RUNTIME_SOURCE_ID,
  PECP_STABLE_K6_RUNTIME_SOURCE
} from '@pecp/test-engine';
import {
  TestDefinition,
  WorkloadSchedule,
  JourneyDefinition,
  ExecutionPrecondition,
  AcceptanceCriterion
} from '@pecp/pe-domain';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../fixtures/retailco/m3ExecutionFixture.js';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture.js';
// @ts-ignore
import { resolveCredential } from '../../../../execution/k6-runtime/src/runtime.js';

describe('M3.0.2 Pre-Live Execution Validity Gate Verification', () => {
  const approvedM3TestDef = compileTestDefinition({
    contract: RETAILCO_M3_APPROVED_CONTRACT,
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    version: 'v1.0',
    executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
  });

  // --------------------------------------------------------------------------
  // Requirement 1: Correct k6 ramping-arrival-rate schema
  // --------------------------------------------------------------------------
  describe('Requirement 1: Correct k6 ramping-arrival-rate schema (startRate vs rate)', () => {
    it('compiles ramping-arrival-rate scenario with startRate and timeUnit, without rate property', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      expect(bundle.isExecutable).toBe(true);
      const scenarioKey = Object.keys(bundle.options.scenarios)[0];
      const scenario = bundle.options.scenarios[scenarioKey];

      expect(scenario.executor).toBe('ramping-arrival-rate');
      expect(scenario.startRate).toBe(0);
      expect(scenario.timeUnit).toBe('1s');
      expect((scenario as any).rate).toBeUndefined();
      expect(scenario.stages).toBeDefined();
      expect(scenario.stages?.length).toBe(3);
    });

    it('honors non-zero startRate when explicitly declared in workloadSchedule', () => {
      const customDef: TestDefinition = {
        ...approvedM3TestDef,
        scenarios: [
          {
            ...approvedM3TestDef.scenarios[0],
            workloadSchedule: {
              ...approvedM3TestDef.scenarios[0].workloadSchedule,
              startRate: 5
            }
          }
        ]
      };

      const bundle = compileK6Bundle({ testDefinition: customDef });
      const scenarioKey = Object.keys(bundle.options.scenarios)[0];
      const scenario = bundle.options.scenarios[scenarioKey];

      expect(scenario.startRate).toBe(5);
      expect((scenario as any).rate).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 2: Establish one authoritative stable k6 runtime source
  // --------------------------------------------------------------------------
  describe('Requirement 2: Authoritative stable k6 runtime source', () => {
    it('bundles runtime.js identical to PECP_STABLE_K6_RUNTIME_SOURCE', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const runtimeFile = bundle.files.find((f) => f.filename === 'runtime.js');
      expect(runtimeFile).toBeDefined();
      expect(runtimeFile?.content).toBe(PECP_STABLE_K6_RUNTIME_SOURCE);
      expect(runtimeFile?.content).toContain('PECP Stable k6 Runtime');
      expect(runtimeFile?.content).toContain('resolveCredential');
      expect(runtimeFile?.content).toContain('workloadArrivalDemand');
      expect(runtimeFile?.content).toContain('executeStep');
      expect(runtimeFile?.content).toContain('executeIteration');
    });

    it('records runtimeVersion and runtimeSourceId in bundle metadata and ext.pecp', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      expect(bundle.runtimeVersion).toBe(PECP_STABLE_K6_RUNTIME_VERSION);
      expect(bundle.runtimeSourceId).toBe(PECP_STABLE_K6_RUNTIME_SOURCE_ID);
      const pecpExt = (bundle.options.ext as any)?.pecp;
      expect(pecpExt?.runtimeVersion).toBe(PECP_STABLE_K6_RUNTIME_VERSION);
      expect(pecpExt?.runtimeSourceId).toBe(PECP_STABLE_K6_RUNTIME_SOURCE_ID);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Execution Preconditions Gating
  // --------------------------------------------------------------------------
  describe('Requirement 3: Execution Preconditions Gating Executability', () => {
    it('blocks execution when a precondition is not satisfied (default isMandatory: true)', () => {
      const unsatisfiedPreconditions: ExecutionPrecondition[] = [
        {
          id: 'precond-db-seed',
          category: 'TEST_DATA',
          statement: 'Catalog database must be populated with 10,000 SKUs',
          isSatisfied: false,
          verificationMethod: 'system'
        }
      ];

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          preconditions: unsatisfiedPreconditions
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.blockingReasons.length).toBeGreaterThan(0);
      expect(testDef.blockingReasons[0]).toContain('Mandatory execution precondition');
      expect(testDef.blockingReasons[0]).toContain('is unsatisfied');
      expect(testDef.issues.some((i) => i.type === 'UNSATISFIED_PRECONDITION')).toBe(true);

      const bundle = compileK6Bundle({ testDefinition: testDef });
      expect(bundle.isExecutable).toBe(false);
      expect(bundle.nonExecutableReasons.some((r) => r.includes('Catalog database must be populated'))).toBe(true);
    });

    it('does NOT block execution if an unsatisfied precondition is explicitly marked isMandatory: false', () => {
      const optionalPreconditions: ExecutionPrecondition[] = [
        {
          id: 'precond-perf-telemetry',
          category: 'OBSERVABILITY',
          statement: 'APM distributed tracing enabled for synthetic transactions',
          isSatisfied: false,
          isMandatory: false,
          verificationMethod: 'system'
        }
      ];

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          preconditions: optionalPreconditions
        }
      });

      // Advisory issue is created with WARNING severity, not BLOCKING
      const precondIssue = testDef.issues.find((i) => i.parameter.includes('precond-perf-telemetry'));
      expect(precondIssue).toBeDefined();
      expect(precondIssue?.severity).toBe('WARNING');
      expect(testDef.isExecutable).toBe(true);
    });

  });

  // --------------------------------------------------------------------------
  // Requirement 4: Provider Threshold Mapping Failures Explicit
  // --------------------------------------------------------------------------
  describe('Requirement 4: Explicit Provider Threshold Mapping', () => {
    it('emits PROVIDER_UNSUPPORTED_CRITERION when criterion has an invalid operator', () => {
      const criteriaWithBadOp: AcceptanceCriterion[] = [
        {
          id: 'crit-bad-op',
          key: 'crit-bad-op',
          metric: 'http_req_duration',
          target: '~= 1000ms',
          operator: '~=' as any,
          thresholdValue: 1000,
          unit: 'ms',
          percentile: 95,
          scope: 'checkout',
          isBlockingForApproval: true,
          status: 'DEFINED'
        }
      ];

      const result = buildK6Thresholds(criteriaWithBadOp);
      expect(result.unmappedReasons.length).toBe(1);
      expect(result.unmappedReasons[0]).toContain('unsupported or missing operator');
      expect(result.issues.some((i) => i.type === 'PROVIDER_UNSUPPORTED_CRITERION')).toBe(true);
    });

    it('emits PROVIDER_UNSUPPORTED_CRITERION when latency criterion lacks percentile', () => {
      const criteriaNoPercentile: AcceptanceCriterion[] = [
        {
          id: 'crit-no-pctl',
          key: 'crit-no-pctl',
          metric: 'http_req_duration',
          target: '< 1000ms',
          operator: '<',
          thresholdValue: 1000,
          unit: 'ms',
          scope: 'checkout',
          isBlockingForApproval: true,
          status: 'DEFINED'
        }
      ];

      const result = buildK6Thresholds(criteriaNoPercentile);
      expect(result.unmappedReasons.length).toBe(1);
      expect(result.unmappedReasons[0]).toContain('lacks a required percentile');
    });

    it('blocks k6 bundle compilation if any executable criterion cannot be mapped to provider threshold', () => {
      const unmappableDef: TestDefinition = {
        ...approvedM3TestDef,
        executableCriteria: [
          {
            id: 'crit-unsupported-cpu',
            key: 'crit-unsupported-cpu',
            metric: 'cpu_utilization',
            target: '< 80%',
            operator: '<',
            thresholdValue: 80,
            unit: '%',
            scope: 'server',
            isBlockingForApproval: true,
            status: 'DEFINED'
          }
        ]
      };

      const bundle = compileK6Bundle({ testDefinition: unmappableDef });
      expect(bundle.isExecutable).toBe(false);
      expect(bundle.nonExecutableReasons.some((r) => r.includes('cannot be mapped to k6 HTTP threshold'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 5: Ensure required credential references fail safely
  // --------------------------------------------------------------------------
  describe('Requirement 5: Fail-Safe Credential Resolution', () => {
    it('resolveCredential throws error when credential is empty or missing in environment', () => {
      expect(() => {
        resolveCredential('NON_EXISTENT_CREDENTIAL_KEY', 'Payment Gateway API');
      }).toThrowError(/PECP Credential Resolution Error.*NON_EXISTENT_CREDENTIAL_KEY/);
    });

    it('never includes placeholder fake tokens like Bearer NOT_CONFIGURED in generated journeys', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const journeysFile = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeysFile?.content).not.toContain('Bearer NOT_CONFIGURED');
      expect(journeysFile?.content).toContain('resolveCredential(');
    });
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Structural Validation for Schedules and Journeys
  // --------------------------------------------------------------------------
  describe('Requirement 6: Structural Validation for Schedules and Journeys', () => {
    it('blocks execution when schedule total duration does not equal stages sum', () => {
      const invalidSchedule: WorkloadSchedule = {
        id: 'sched-invalid-duration',
        executionModel: 'OPEN',
        timeUnit: 'seconds',
        totalDurationSeconds: 1000, // stages sum is 300 + 900 + 120 = 1320
        stages: [
          { durationSeconds: 300, targetArrivalRate: 8.75, description: 'Ramp Up' },
          { durationSeconds: 900, targetArrivalRate: 8.75, description: 'Sustained Peak' },
          { durationSeconds: 120, targetArrivalRate: 0, description: 'Ramp Down' }
        ],
        peakArrivalRate: 8.75,
        rateUnit: '1s'
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          schedule: invalidSchedule
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.blockingReasons.some((r) => r.includes('1000s') && r.includes('1320s'))).toBe(true);
      expect(testDef.issues.some((i) => i.type === 'INVALID_EXECUTION_STRUCTURE')).toBe(true);
    });

    it('blocks execution when schedule peakArrivalRate does not match max stage arrival rate', () => {
      const invalidSchedule: WorkloadSchedule = {
        id: 'sched-invalid-peak',
        executionModel: 'OPEN',
        timeUnit: 'seconds',
        totalDurationSeconds: 1320,
        stages: [
          { durationSeconds: 300, targetArrivalRate: 8.75, description: 'Ramp Up' },
          { durationSeconds: 900, targetArrivalRate: 8.75, description: 'Sustained Peak' },
          { durationSeconds: 120, targetArrivalRate: 0, description: 'Ramp Down' }
        ],
        peakArrivalRate: 15.0, // Declared 15.0 but stages max is 8.75!
        rateUnit: '1s'
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          schedule: invalidSchedule
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.blockingReasons.some((r) => r.includes('peakArrivalRate (15)') && r.includes('8.75'))).toBe(true);
    });

    it('blocks execution when journey percentage distribution does not sum to 100%', () => {
      const invalidJourneys: JourneyDefinition[] = [
        {
          id: 'j-1',
          key: 'browse',
          name: 'Browse',
          percentage: 60,
          weight: 0.6,
          steps: [
            {
              id: 's-1',
              name: 'Browse Step',
              method: 'GET',
              path: '/items'
            }
          ]
        },
        {
          id: 'j-2',
          key: 'search',
          name: 'Search',
          percentage: 30, // 60 + 30 = 90% != 100%
          weight: 0.3,
          steps: [
            {
              id: 's-2',
              name: 'Search Step',
              method: 'GET',
              path: '/search'
            }
          ]
        }
      ];

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          journeys: invalidJourneys
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.blockingReasons.some((r) => r.includes('percentages sum to 90%'))).toBe(true);
    });

    it('blocks execution when a journey step has invalid HTTP method or empty path', () => {
      const invalidStepJourneys: JourneyDefinition[] = [
        {
          id: 'j-1',
          key: 'browse',
          name: 'Browse',
          percentage: 100,
          weight: 1.0,
          steps: [
            {
              id: 's-1',
              name: 'Invalid Method Step',
              method: 'INVALID_VERB' as any,
              path: 'relative-no-leading-slash'
            }
          ]
        }
      ];

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          journeys: invalidStepJourneys
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.issues.some((i) => i.parameter.includes('method') && i.description.toLowerCase().includes('unsupported http method'))).toBe(true);
      expect(testDef.issues.some((i) => i.parameter.includes('path') && i.description.toLowerCase().includes('start with "/"'))).toBe(true);
    });
  });
});
