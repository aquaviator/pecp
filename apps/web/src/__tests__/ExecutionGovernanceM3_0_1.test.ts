import { describe, it, expect } from 'vitest';
import {
  PerformanceContract,
  computeContractFingerprint,
  JourneyDefinition,
  WorkloadSchedule
} from '@pecp/pe-domain';
import {
  compileTestDefinition,
  compileK6Bundle,
  K6_STANDARD_PROVIDER_POLICY
} from '@pecp/test-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture.js';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE,
  RETAILCO_M3_WORKLOAD_SCHEDULE,
  RETAILCO_M3_JOURNEYS
} from '../fixtures/retailco/m3ExecutionFixture.js';

describe('M3.0.1 Execution Governance Gate (10 Mandatory Corrections)', () => {
  // Base approved contract copy
  const approvedContract: PerformanceContract = {
    ...RETAILCO_M3_APPROVED_CONTRACT,
    id: 'contract-test-gov-approved',
    status: 'APPROVED'
  };

  describe('Correction 1: Strict Workload Demand Separation & No Invented Fallback', () => {
    it('refuses to invent default 8.75/s target rate or 5% tolerance when throughput calculation is missing', () => {
      const contractWithoutThroughput: PerformanceContract = {
        ...approvedContract,
        id: 'contract-no-calc',
        workloadCalculations: [] // No throughput calculation
      };

      const testDef = compileTestDefinition({
        contract: contractWithoutThroughput,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.status).toBe('NOT_EXECUTABLE');
      expect(testDef.workloadAttainment).toBeUndefined();

      const issue = testDef.issues.find((i) => i.type === 'NOT_SUPPLIED' && i.parameter === 'workload_demand');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('BLOCKING');
      expect(testDef.blockingReasons).toContain('Workload demand attainment target is NOT_SUPPLIED in contract workload calculations.');
    });

    it('does not invent a default tolerance percentage if not provided in intelligence', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          workloadTolerancePercentage: undefined
        }
      });

      expect(testDef.workloadAttainment).toBeDefined();
      expect(testDef.workloadAttainment?.tolerancePercentage).toBeUndefined();
    });
  });

  describe('Correction 2: Pure Source-Driven Preconditions (No Invented Probes)', () => {
    it('only contains preconditions explicitly supplied in execution intelligence', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          schedule: RETAILCO_M3_WORKLOAD_SCHEDULE,
          journeys: RETAILCO_M3_JOURNEYS,
          targetEnvironmentBaseUrlRef: 'http://custom-lab.internal:8080',
          preconditions: [] // Explicitly empty
        }
      });

      expect(testDef.preconditions).toEqual([]);
      // Ensure no default probe issues were generated
      expect(testDef.issues.filter((i) => i.type === 'UNSATISFIED_PRECONDITION')).toHaveLength(0);
    });
  });

  describe('Correction 3: Upstream Contract Status Gate', () => {
    it('sets status to BLOCKED when upstream contract is BLOCKED', () => {
      const blockedContract: PerformanceContract = {
        ...approvedContract,
        status: 'BLOCKED'
      };

      const testDef = compileTestDefinition({
        contract: blockedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.status).toBe('BLOCKED');
      expect(testDef.isExecutable).toBe(false);
      expect(testDef.issues.some((i) => i.type === 'UPSTREAM_CONTRACT_BLOCKED')).toBe(true);
    });

    it('sets status to NOT_EXECUTABLE with UPSTREAM_CONTRACT_NOT_APPROVED when contract is DRAFT', () => {
      const draftContract: PerformanceContract = {
        ...approvedContract,
        status: 'DRAFT'
      };

      const testDef = compileTestDefinition({
        contract: draftContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.status).toBe('NOT_EXECUTABLE');
      expect(testDef.isExecutable).toBe(false);
      expect(testDef.issues.some((i) => i.type === 'UPSTREAM_CONTRACT_NOT_APPROVED')).toBe(true);
      expect(testDef.blockingReasons).toContain(
        'Upstream Performance Contract must be in APPROVED status for execution readiness (current status: DRAFT).'
      );
    });

    it('sets status to NOT_EXECUTABLE with UPSTREAM_CONTRACT_NOT_APPROVED when contract is READY_FOR_APPROVAL', () => {
      const readyForApprovalContract: PerformanceContract = {
        ...approvedContract,
        status: 'READY_FOR_APPROVAL'
      };

      const testDef = compileTestDefinition({
        contract: readyForApprovalContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.status).toBe('NOT_EXECUTABLE');
      expect(testDef.isExecutable).toBe(false);
      expect(testDef.issues.some((i) => i.type === 'UPSTREAM_CONTRACT_NOT_APPROVED')).toBe(true);
    });
  });

  describe('Correction 4: Stable PECP k6 Runtime Integration', () => {
    it('packages runtime.js and delegates journey execution without code duplication', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const bundle = compileK6Bundle({ testDefinition: testDef });

      // Bundle files include packaged runtime
      const runtimeFile = bundle.files.find((f) => f.filename === 'runtime.js');
      expect(runtimeFile).toBeDefined();
      expect(runtimeFile?.content).toContain('export function executeStep(stepConfig)');
      expect(runtimeFile?.content).toContain('export function executeIteration(');
      expect(runtimeFile?.content).toContain('export const workloadArrivalDemand');

      // journeys.js imports executeStep from runtime.js
      const journeysFile = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeysFile?.content).toContain("import { executeStep } from './runtime.js';");
      expect(journeysFile?.content).toContain('executeStep({');

      // entrypoint.js imports executeIteration from runtime.js
      const entrypointFile = bundle.files.find((f) => f.filename === 'entrypoint.js');
      expect(entrypointFile?.content).toContain(
        "import { executeIteration, workloadArrivalDemand, workloadAttainmentRate } from './runtime.js';"
      );
      expect(entrypointFile?.content).toContain(
        'executeIteration(JOURNEY_RUNNER_MAP, JOURNEY_WEIGHTS, BASE_URL, {});'
      );
    });
  });

  describe('Correction 5: Governed k6 Provider Sizing', () => {
    it('applies K6ProviderPolicy v1.0 formula and records policy provenance metadata', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const bundle = compileK6Bundle({ testDefinition: testDef });

      const pecpExt = bundle.options.ext?.pecp;
      expect(pecpExt?.providerCapacity).toBeDefined();
      expect(pecpExt?.providerCapacity?.isProviderDerived).toBe(true);
      expect(pecpExt?.providerCapacity?.policyId).toBe(K6_STANDARD_PROVIDER_POLICY.policyId);
      expect(pecpExt?.providerCapacity?.ruleIdentifier).toBe(K6_STANDARD_PROVIDER_POLICY.ruleIdentifier);

      // peakArrivalRate is 109.375 (M3.0.3): preAllocatedVUs = max(10, ceil(109.375*2.5)) = 274, maxVUs = max(50, ceil(109.375*10)) = 1094
      expect(pecpExt?.providerCapacity?.preAllocatedVUs).toBe(274);
      expect(pecpExt?.providerCapacity?.maxVUs).toBe(1094);

      const scenario = bundle.options.scenarios[Object.keys(bundle.options.scenarios)[0]];
      expect(scenario.preAllocatedVUs).toBe(274);
      expect(scenario.maxVUs).toBe(1094);
    });

    it('honors explicit provider capacity configuration when supplied', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const bundle = compileK6Bundle({
        testDefinition: testDef,
        k6ProviderCapacity: {
          preAllocatedVUs: 50,
          maxVUs: 200,
          rateTimeUnit: '1s'
        }
      });

      const pecpExt = bundle.options.ext?.pecp;
      expect(pecpExt?.providerCapacity?.isProviderDerived).toBe(false);
      expect(pecpExt?.providerCapacity?.preAllocatedVUs).toBe(50);
      expect(pecpExt?.providerCapacity?.maxVUs).toBe(200);

      const scenario = bundle.options.scenarios[Object.keys(bundle.options.scenarios)[0]];
      expect(scenario.preAllocatedVUs).toBe(50);
      expect(scenario.maxVUs).toBe(200);
    });
  });

  describe('Correction 6: Journey Step Integrity & Mutating Payload Validation', () => {
    it('blocks execution if a mutating step (POST/PUT/PATCH) lacks an explicit requestPayload', () => {
      const invalidJourneys: JourneyDefinition[] = [
        {
          id: 'journey-order',
          key: 'order',
          name: 'Order Journey',
          weight: 1.0,
          percentage: 100,
          steps: [
            {
              id: 'step-post-order',
              name: 'Post Order',
              method: 'POST',
              path: '/api/v1/orders',
              expectedStatusCode: 201
              // Missing requestPayload
            }
          ]
        }
      ];

      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          schedule: RETAILCO_M3_WORKLOAD_SCHEDULE,
          journeys: invalidJourneys,
          targetEnvironmentBaseUrlRef: 'http://ref.lab:8080'
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.status).toBe('NOT_EXECUTABLE');

      const payloadIssue = testDef.issues.find(
        (i) => i.type === 'NOT_SUPPLIED' && i.parameter === 'step.requestPayload.step-post-order'
      );
      expect(payloadIssue).toBeDefined();
      expect(payloadIssue?.severity).toBe('BLOCKING');
      expect(testDef.blockingReasons).toContain(
        'HTTP POST step "Post Order" (step-post-order) requires an explicit requestPayload.'
      );
    });

    it('does not invent synthetic payloads in generated journey steps', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const bundle = compileK6Bundle({ testDefinition: testDef });
      const journeysFile = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeysFile?.content).not.toContain('syntheticPayload: true');
      expect(journeysFile?.content).toContain('SKU-ELECTRONICS-9921');
    });
  });

  describe('Correction 7: Acceptance Criteria & Threshold Compilation Strictness', () => {
    it('only compiles criteria with explicit operator, numeric threshold, and valid units into thresholds', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const bundle = compileK6Bundle({ testDefinition: testDef });
      const thresholds = bundle.options.thresholds;

      // Defined checkout latency p95 < 2000
      expect(thresholds['http_req_duration{journey:checkout}']).toEqual(['p(95)<2000']);
      // Defined error rate < 0.5% -> rate<0.005
      expect(thresholds['http_req_failed']).toEqual(['rate<0.005']);
    });
  });

  describe('Correction 8: Deterministic Single Source of Truth for Contract Fingerprint', () => {
    it('uses computeContractFingerprint from pe-domain deterministically', () => {
      const fp1 = computeContractFingerprint(approvedContract);
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.sourceContractFingerprint).toBe(fp1);
      expect(fp1.startsWith('fp-')).toBe(true);
    });
  });

  describe('Correction 9: Safe Blocked Bundle Generation', () => {
    it('generates a blocked k6 bundle with governance notice when test definition is non-executable', () => {
      const nonExecutableDef = compileTestDefinition({
        contract: { ...approvedContract, status: 'BLOCKED' },
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const bundle = compileK6Bundle({ testDefinition: nonExecutableDef });
      expect(bundle.isExecutable).toBe(false);

      const entrypoint = bundle.files.find((f) => f.filename === 'entrypoint.js');
      expect(entrypoint?.content).toContain('PECP GOVERNANCE NOTICE: EXECUTION BLOCKED');
      expect(entrypoint?.content).toContain('throw new Error');
    });
  });

  describe('Correction 10: Secret Reference Boundary Enforcement', () => {
    it('isolates credentials in __ENV references and never hardcodes secret values', () => {
      const testDef = compileTestDefinition({
        contract: approvedContract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const bundle = compileK6Bundle({ testDefinition: testDef });
      const journeys = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeys?.content).toContain("__ENV['RETAILCO_CHECKOUT_AUTH_TOKEN']");
      expect(journeys?.content).not.toContain('secret123');
    });
  });
});
