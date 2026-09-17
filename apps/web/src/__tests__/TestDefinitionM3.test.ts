import { describe, it, expect } from 'vitest';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import {
  compileTestDefinition,
  computeTestDefinitionFingerprint
} from '@pecp/test-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
} from '../fixtures/retailco/intelligenceFixture';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE,
  RETAILCO_M3_WORKLOAD_SCHEDULE,
  RETAILCO_M3_JOURNEYS
} from '../fixtures/retailco/m3ExecutionFixture';

describe('PECP Canonical Test Definition Engine (M3.0)', () => {
  // Post-resolution M1/M2 blocked contract baseline
  const blockedM2Contract = compileDraftPerformanceContract({
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
    version: 'v0.1-draft'
  });

  describe('1. Governance Gate & Contract Binding (Constitution §10)', () => {
    it('binds deterministically to the upstream Performance Contract and drift checksum', () => {
      const testDef = compileTestDefinition({
        contract: blockedM2Contract,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        version: 'v0.1-draft'
      });

      expect(testDef.sourceContractId).toBe(blockedM2Contract.id);
      expect(testDef.sourceContractVersion).toBe(blockedM2Contract.version);
      expect(testDef.sourceContractFingerprint).toBeDefined();
      expect(testDef.fingerprint.startsWith('fp-')).toBe(true);
      expect(testDef.engineeringIntent).toBe('FORECAST');
    });

    it('propagates BLOCKED contract status to TestDefinition, preventing execution', () => {
      const testDef = compileTestDefinition({
        contract: blockedM2Contract,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      expect(testDef.status).toBe('BLOCKED');
      expect(testDef.isExecutable).toBe(false);
      expect(testDef.blockingReasons).toContain(
        'Upstream Performance Contract is in BLOCKED status.'
      );
      expect(testDef.issues.some((i) => i.type === 'UPSTREAM_CONTRACT_BLOCKED')).toBe(true);
    });
  });

  describe('2. Authoritative Execution-Input Law (No Invented Values)', () => {
    it('refuses to invent execution schedules when not supplied in canonical intelligence', () => {
      const testDef = compileTestDefinition({
        contract: blockedM2Contract,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      // Must have issue for missing schedule
      const scheduleIssue = testDef.issues.find(
        (i) => i.type === 'NOT_SUPPLIED' && i.parameter === 'workload_schedule'
      );
      expect(scheduleIssue).toBeDefined();
      expect(scheduleIssue?.severity).toBe('BLOCKING');
      expect(testDef.scenarios[0].workloadSchedule.stages.length).toBe(0);
      expect(testDef.blockingReasons).toContain(
        'Execution schedule (stages, durations, arrival rates) is NOT_SUPPLIED in canonical intelligence.'
      );
    });

    it('refuses to invent target environment base URL when not supplied', () => {
      const testDef = compileTestDefinition({
        contract: blockedM2Contract,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const envIssue = testDef.issues.find(
        (i) => i.type === 'NOT_SUPPLIED' && i.parameter === 'targetEnvironmentBaseUrlRef'
      );
      expect(envIssue).toBeDefined();
      expect(envIssue?.severity).toBe('BLOCKING');
      expect(testDef.blockingReasons).toContain(
        'Target environment / Reference Lab base URL reference is NOT_SUPPLIED.'
      );
    });
  });

  describe('3. Workload Demand Separation (Constitution §10)', () => {
    it('tracks required throughput as an authoritative prerequisite, distinct from NFRs', () => {
      const testDef = compileTestDefinition({
        contract: blockedM2Contract,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      expect(testDef.workloadAttainment).toBeDefined();
      expect(testDef.workloadAttainment?.evaluationType).toBe('WORKLOAD_DEMAND');
      expect(testDef.workloadAttainment?.targetValue).toBe(8.75);
      expect(testDef.workloadAttainment?.unit).toBe('orders/second');
      expect(testDef.workloadAttainment?.isPrerequisiteForEvaluation).toBe(true);

      // Workload demand must NOT appear in executable acceptance criteria
      const hasThroughputInCriteria = testDef.executableCriteria.some((c) =>
        c.metric.toLowerCase().includes('throughput') || c.metric.toLowerCase().includes('order')
      );
      expect(hasThroughputInCriteria).toBe(false);
    });
  });

  describe('4. Acceptance Criteria Cleanliness (Ambiguity Exclusion)', () => {
    it('excludes ambiguous criteria lacking percentiles from executable criteria', () => {
      const testDef = compileTestDefinition({
        contract: blockedM2Contract,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      // Checkout response time in M1 is ambiguous (< 2s, no percentile)
      expect(testDef.ambiguousCriteria.length).toBeGreaterThan(0);
      const ambiguousCheckout = testDef.ambiguousCriteria.find((c) =>
        c.metric.toLowerCase().includes('checkout')
      );
      expect(ambiguousCheckout).toBeDefined();

      // Must NOT be in executableCriteria
      const executableCheckout = testDef.executableCriteria.find((c) =>
        c.metric.toLowerCase().includes('checkout')
      );
      expect(executableCheckout).toBeUndefined();

      // Must emit issue
      expect(testDef.issues.some((i) => i.type === 'AMBIGUOUS_CRITERIA')).toBe(true);
    });
  });

  describe('5. M3 Execution-Ready Reference State', () => {
    it('compiles an approved contract and canonical execution intelligence into READY_FOR_EXECUTION', () => {
      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        version: 'v1.0',
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.status).toBe('READY_FOR_EXECUTION');
      expect(testDef.isExecutable).toBe(true);
      expect(testDef.blockingReasons.length).toBe(0);

      // Schedule verified: 109.375 journey_iterations/s scheduler peak attaining 8.75 orders/s
      expect(testDef.scenarios[0].workloadSchedule.stages.length).toBe(3);
      expect(testDef.scenarios[0].workloadSchedule.totalDurationSeconds).toBe(1320);
      expect(testDef.scenarios[0].workloadSchedule.peakArrivalRate).toBe(109.375);
      expect(testDef.scenarios[0].workloadSchedule.arrivalPopulation).toBe('JOURNEY_ITERATION');
      expect(testDef.workloadAttainment?.targetValue).toBe(8.75);
      expect(testDef.workloadAttainment?.unit).toBe('orders/second');
      expect(testDef.populationRelationship?.outputSchedulerRate.value).toBe(109.375);

      // All 5 canonical journeys verified
      expect(testDef.journeys.length).toBe(5);
      const journeyKeys = testDef.journeys.map((j) => j.key);
      expect(journeyKeys).toEqual(['browse', 'search', 'basket', 'checkout', 'account']);

      // Weights sum to 1.0 (100%)
      const totalWeight = testDef.journeys.reduce((sum, j) => sum + j.weight, 0);
      expect(Math.round(totalWeight * 100) / 100).toBe(1.0);

      // Resolved criteria are in executableCriteria
      expect(testDef.executableCriteria.length).toBe(2);
      expect(testDef.ambiguousCriteria.length).toBe(0);

      // Target environment base URL is populated
      expect(testDef.scenarios[0].targetEnvironmentBaseUrlRef).toBe(
        'http://reference-lab.retailco.internal:8080'
      );
    });

    it('enforces secret reference boundary: no raw secrets embedded in test definition', () => {
      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(testDef.credentialReferences.length).toBe(1);
      expect(testDef.credentialReferences[0].provider).toBe('ENV_VAR');
      expect(testDef.credentialReferences[0].referenceId).toBe('RETAILCO_CHECKOUT_AUTH_TOKEN');

      // Check entire serialized test definition for secret leakage
      const serialized = JSON.stringify(testDef);
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('secret123');
      expect(serialized).not.toContain('Bearer eyJ');
    });

    it('produces deterministic drift checksums for identical definitions', () => {
      const def1 = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        generationTimestamp: '2026-08-25T14:00:00.000Z',
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      const def2 = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        generationTimestamp: '2026-08-25T14:00:00.000Z',
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });

      expect(def1.fingerprint).toBe(def2.fingerprint);
      expect(def1.fingerprint.startsWith('fp-')).toBe(true);
    });
  });
});
