import { describe, it, expect } from 'vitest';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import {
  compileTestDefinition,
  compileK6Bundle,
  computeBundleFingerprint
} from '@pecp/test-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
} from '../fixtures/retailco/intelligenceFixture';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../fixtures/retailco/m3ExecutionFixture';

describe('PECP k6 Execution Bundle Compiler (M3.0)', () => {
  const blockedM2Contract = compileDraftPerformanceContract({
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
    version: 'v0.1-draft'
  });

  const blockedM2TestDef = compileTestDefinition({
    contract: blockedM2Contract,
    projectSummary: RETAILCO_PROJECT_FIXTURE
  });

  const approvedM3TestDef = compileTestDefinition({
    contract: RETAILCO_M3_APPROVED_CONTRACT,
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    version: 'v1.0',
    executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
  });

  describe('1. Non-Executable Bundle Handling (Governance Enforcement)', () => {
    it('produces a safe non-executable bundle when upstream TestDefinition is BLOCKED', () => {
      const bundle = compileK6Bundle({
        testDefinition: blockedM2TestDef
      });

      expect(bundle.isExecutable).toBe(false);
      expect(bundle.nonExecutableReasons.length).toBeGreaterThan(0);
      expect(bundle.options.scenarios).toEqual({});
      expect(bundle.options.thresholds).toEqual({});

      // Entrypoint must contain non-executable warning and throw error on execution
      const entrypointFile = bundle.files.find((f) => f.filename === 'entrypoint.js');
      expect(entrypointFile).toBeDefined();
      expect(entrypointFile?.content).toContain('PECP GOVERNANCE NOTICE: EXECUTION BLOCKED');
      expect(entrypointFile?.content).toContain('throw new Error');
    });
  });

  describe('2. Executable k6 Bundle Generation', () => {
    it('compiles an execution-ready bundle with config.json, journeys.js, entrypoint.js, and runtime.js', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef,
        generatedAt: '2026-08-25T14:30:00.000Z'
      });

      expect(bundle.isExecutable).toBe(true);
      expect(bundle.nonExecutableReasons).toEqual([]);
      expect(bundle.files.length).toBe(4);

      const fileNames = bundle.files.map((f) => f.filename);
      expect(fileNames).toContain('config.json');
      expect(fileNames).toContain('journeys.js');
      expect(fileNames).toContain('entrypoint.js');
      expect(fileNames).toContain('runtime.js');

      // journeys.js and entrypoint.js consume runtime.js
      const entrypointFile = bundle.files.find((f) => f.filename === 'entrypoint.js');
      expect(entrypointFile?.content).toContain("import { executeIteration");
      expect(entrypointFile?.content).toContain("from './runtime.js'");

      const journeysFile = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeysFile?.content).toContain("import { executeStep } from './runtime.js'");
    });

    it('governs provider-derived capacity sizing and records provenance metadata', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const providerCap = bundle.options.ext?.pecp?.providerCapacity;
      expect(providerCap).toBeDefined();
      expect(providerCap?.isProviderDerived).toBe(true);
      expect(providerCap?.policyId).toBe('k6-standard-arrival-rate-sizing');
      expect(providerCap?.preAllocatedVUs).toBe(22); // max(10, ceil(8.75 * 2.5)) = 22
      expect(providerCap?.maxVUs).toBe(88); // max(50, ceil(8.75 * 10)) = 88

      const scenario = bundle.options.scenarios[Object.keys(bundle.options.scenarios)[0]];
      expect(scenario.preAllocatedVUs).toBe(22);
      expect(scenario.maxVUs).toBe(88);
    });

    it('derives scenario configuration directly from explicit canonical schedule stages', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const scenarioKey = Object.keys(bundle.options.scenarios)[0];
      const scenario = bundle.options.scenarios[scenarioKey];

      expect(scenario.executor).toBe('ramping-arrival-rate');
      expect(scenario.timeUnit).toBe('1s');
      expect(scenario.stages).toBeDefined();
      expect(scenario.stages?.length).toBe(3);

      // Matches schedule: 300s -> 8.75, 900s -> 8.75, 120s -> 0
      expect(scenario.stages?.[0]).toEqual({ target: 8.75, duration: '300s' });
      expect(scenario.stages?.[1]).toEqual({ target: 8.75, duration: '900s' });
      expect(scenario.stages?.[2]).toEqual({ target: 0, duration: '120s' });
    });

    it('maps defined criteria strictly to k6 thresholds without inventing thresholds', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const thresholds = bundle.options.thresholds;

      // Latency threshold for checkout: p(95)<2000
      expect(thresholds['http_req_duration{journey:checkout}']).toEqual(['p(95)<2000']);

      // Error rate threshold: rate<0.005
      expect(thresholds['http_req_failed']).toEqual(['rate<0.005']);

      // Workload demand is NOT mapped to an NFR threshold
      expect(thresholds['pecp_workload_arrival_demand']).toBeUndefined();
      expect(thresholds['workload_demand']).toBeUndefined();
    });

    it('embeds workload attainment requirement into metadata, keeping it separate from NFRs', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const pecpExt = bundle.options.ext?.pecp;
      expect(pecpExt).toBeDefined();
      expect(pecpExt?.testDefinitionId).toBe(approvedM3TestDef.id);
      expect(pecpExt?.workloadAttainment?.targetValue).toBe(8.75);
      expect(pecpExt?.workloadAttainment?.unit).toBe('orders/second');
    });

    it('generates modular journey functions with correct weights and credentials references', () => {
      const bundle = compileK6Bundle({
        testDefinition: approvedM3TestDef
      });

      const journeysFile = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeysFile).toBeDefined();
      const content = journeysFile?.content || '';

      // Must export journey functions
      expect(content).toContain('export function runBrowseJourney');
      expect(content).toContain('export function runSearchJourney');
      expect(content).toContain('export function runBasketJourney');
      expect(content).toContain('export function runCheckoutJourney');
      expect(content).toContain('export function runAccountJourney');

      // Must export weights map matching canonical distribution
      expect(content).toContain('"browse": 0.55');
      expect(content).toContain('"search": 0.2');
      expect(content).toContain('"basket": 0.15');
      expect(content).toContain('"checkout": 0.08');
      expect(content).toContain('"account": 0.02');

      // Checkout journey must reference __ENV for credentials, never raw tokens
      expect(content).toContain("__ENV['RETAILCO_CHECKOUT_AUTH_TOKEN']");
      expect(content).not.toContain('secret123');
      expect(content).not.toContain('Bearer mock-');
    });

    it('generates deterministic bundle fingerprints for identical definitions', () => {
      const bundle1 = compileK6Bundle({
        testDefinition: approvedM3TestDef,
        generatedAt: '2026-08-25T14:30:00.000Z'
      });

      const bundle2 = compileK6Bundle({
        testDefinition: approvedM3TestDef,
        generatedAt: '2026-08-25T14:30:00.000Z'
      });

      expect(bundle1.fingerprint).toBe(bundle2.fingerprint);
      expect(bundle1.fingerprint.startsWith('fp-')).toBe(true);
    });
  });
});
