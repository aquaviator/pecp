import { describe, it, expect } from 'vitest';
import {
  compileTestDefinition,
  compileK6Bundle,
  computeTestDefinitionFingerprint,
  computeBundleFingerprint
} from '@pecp/test-engine';
import {
  WorkloadSchedule,
  WorkloadPopulationRelationship,
  JourneyDefinition
} from '@pecp/pe-domain';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE,
  RETAILCO_M3_POPULATION_RELATIONSHIP,
  RETAILCO_M3_WORKLOAD_SCHEDULE,
  RETAILCO_M3_JOURNEYS
} from '../fixtures/retailco/m3ExecutionFixture';

describe('M3.0.3 Arrival Population & Attainment Semantics', () => {
  describe('1. Semantic Distinction & Rejection of Business Units on Mixed Schedules', () => {
    it('blocks compilation when a mixed-journey schedule directly uses business outcome rate units', () => {
      const invalidSchedule: WorkloadSchedule = {
        id: 'sched-invalid-mixed-business-unit',
        executionModel: 'OPEN',
        totalDurationSeconds: 1320,
        peakArrivalRate: 8.75,
        rateUnit: 'orders/second', // INVALID: Mixed-journey schedule cannot use orders/second directly
        timeUnit: 'seconds',
        startRate: 0,
        stages: [
          { durationSeconds: 300, targetArrivalRate: 8.75 },
          { durationSeconds: 900, targetArrivalRate: 8.75 },
          { durationSeconds: 120, targetArrivalRate: 0 }
        ]
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          schedule: invalidSchedule,
          populationRelationship: undefined
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.status).toBe('NOT_EXECUTABLE');
      const issue = testDef.issues.find(
        (i) => i.type === 'BUSINESS_WORKLOAD_UNIT_ON_MIXED_SCHEDULE'
      );
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('BLOCKING');
      expect(issue?.description).toContain('orders/second');
      expect(testDef.blockingReasons.some((r) => r.includes('BUSINESS_WORKLOAD_UNIT_ON_MIXED_SCHEDULE'))).toBe(true);
    });

    it('requires explicit populationRelationship when business attainment targets exist on mixed journey model', () => {
      const scheduleWithoutRelationship: WorkloadSchedule = {
        id: 'sched-no-rel',
        executionModel: 'OPEN',
        arrivalPopulation: 'JOURNEY_ITERATION',
        totalDurationSeconds: 1320,
        peakArrivalRate: 109.375,
        rateUnit: 'journey_iterations/second',
        timeUnit: 'seconds',
        startRate: 0,
        stages: [
          { durationSeconds: 300, targetArrivalRate: 109.375 },
          { durationSeconds: 900, targetArrivalRate: 109.375 },
          { durationSeconds: 120, targetArrivalRate: 0 }
        ]
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          schedule: scheduleWithoutRelationship,
          populationRelationship: undefined // Missing!
        }
      });

      expect(testDef.isExecutable).toBe(false);
      expect(testDef.status).toBe('NOT_EXECUTABLE');
      const issue = testDef.issues.find((i) => i.type === 'POPULATION_RELATIONSHIP_MISSING');
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('BLOCKING');
      expect(issue?.description).toContain('POPULATION_RELATIONSHIP_MISSING');
    });
  });

  describe('2. Traceable Derivation & Mathematical Consistency Validation', () => {
    it('blocks compilation if populationRelationship target does not match upstream contract workload attainment', () => {
      const mismatchedTargetRel: WorkloadPopulationRelationship = {
        id: 'rel-mismatched-target',
        formulaIdentifier: 'TARGET_DIVIDED_BY_JOURNEY_SHARE',
        inputBusinessTarget: {
          value: 20.0, // Upstream contract says 8.75!
          unit: 'orders/second'
        },
        relevantJourneyKey: 'checkout',
        journeyShare: 0.08,
        contributionPerSuccessfulEvent: 1,
        outputSchedulerRate: {
          value: 250.0,
          population: 'JOURNEY_ITERATION',
          unit: 'journey_iterations/second'
        },
        description: 'Mismatched target'
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          populationRelationship: mismatchedTargetRel
        }
      });

      expect(testDef.isExecutable).toBe(false);
      const issue = testDef.issues.find(
        (i) => i.type === 'POPULATION_RELATIONSHIP_MISMATCH' && i.parameter === 'inputBusinessTarget.value'
      );
      expect(issue).toBeDefined();
      expect(issue?.severity).toBe('BLOCKING');
    });

    it('blocks compilation if populationRelationship journeyShare does not match journey weight', () => {
      const mismatchedShareRel: WorkloadPopulationRelationship = {
        id: 'rel-mismatched-share',
        formulaIdentifier: 'TARGET_DIVIDED_BY_JOURNEY_SHARE',
        inputBusinessTarget: {
          value: 8.75,
          unit: 'orders/second'
        },
        relevantJourneyKey: 'checkout',
        journeyShare: 0.15, // Checkout journey in RETAILCO_M3_JOURNEYS is 0.08!
        contributionPerSuccessfulEvent: 1,
        outputSchedulerRate: {
          value: 58.33,
          population: 'JOURNEY_ITERATION',
          unit: 'journey_iterations/second'
        },
        description: 'Mismatched share'
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          populationRelationship: mismatchedShareRel
        }
      });

      expect(testDef.isExecutable).toBe(false);
      const issue = testDef.issues.find(
        (i) => i.type === 'POPULATION_RELATIONSHIP_MISMATCH' && i.parameter === 'journeyShare'
      );
      expect(issue).toBeDefined();
    });

    it('blocks compilation if outputSchedulerRate math does not equal target / (journeyShare * contribution)', () => {
      const invalidMathRel: WorkloadPopulationRelationship = {
        id: 'rel-invalid-math',
        formulaIdentifier: 'TARGET_DIVIDED_BY_JOURNEY_SHARE',
        inputBusinessTarget: {
          value: 8.75,
          unit: 'orders/second'
        },
        relevantJourneyKey: 'checkout',
        journeyShare: 0.08,
        contributionPerSuccessfulEvent: 1,
        outputSchedulerRate: {
          value: 99.0, // Expected: 8.75 / 0.08 = 109.375
          population: 'JOURNEY_ITERATION',
          unit: 'journey_iterations/second'
        },
        description: 'Incorrect calculation output'
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          populationRelationship: invalidMathRel
        }
      });

      expect(testDef.isExecutable).toBe(false);
      const issue = testDef.issues.find(
        (i) => i.type === 'POPULATION_RELATIONSHIP_MISMATCH' && i.parameter === 'outputSchedulerRate.value'
      );
      expect(issue).toBeDefined();
      expect(issue?.description).toContain('expected ~109.375');
    });

    it('blocks compilation if relevantJourneyKey does not exist in canonical journeys', () => {
      const unknownJourneyRel: WorkloadPopulationRelationship = {
        id: 'rel-unknown-journey',
        formulaIdentifier: 'TARGET_DIVIDED_BY_JOURNEY_SHARE',
        inputBusinessTarget: {
          value: 8.75,
          unit: 'orders/second'
        },
        relevantJourneyKey: 'non_existent_journey',
        journeyShare: 0.08,
        contributionPerSuccessfulEvent: 1,
        outputSchedulerRate: {
          value: 109.375,
          population: 'JOURNEY_ITERATION',
          unit: 'journey_iterations/second'
        },
        description: 'Unknown journey reference'
      };

      const testDef = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: {
          ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
          populationRelationship: unknownJourneyRel
        }
      });

      expect(testDef.isExecutable).toBe(false);
      const issue = testDef.issues.find(
        (i) => i.type === 'POPULATION_RELATIONSHIP_MISMATCH' && i.parameter === 'relevantJourneyKey'
      );
      expect(issue).toBeDefined();
    });
  });

  describe('3. Execution-Ready Attainment & Bundle Generation', () => {
    const validTestDef = compileTestDefinition({
      contract: RETAILCO_M3_APPROVED_CONTRACT,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      version: 'v1.0',
      executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
    });

    it('successfully compiles TestDefinition with explicit population relationship', () => {
      expect(validTestDef.isExecutable).toBe(true);
      expect(validTestDef.status).toBe('READY_FOR_EXECUTION');
      expect(validTestDef.populationRelationship).toBeDefined();
      expect(validTestDef.populationRelationship?.outputSchedulerRate.value).toBe(109.375);
      expect(validTestDef.scenarios[0].workloadSchedule.arrivalPopulation).toBe('JOURNEY_ITERATION');
      expect(validTestDef.scenarios[0].workloadSchedule.peakArrivalRate).toBe(109.375);
    });

    it('compiles k6 execution bundle with scheduler arrival metadata and attainment parameters', () => {
      const bundle = compileK6Bundle({
        testDefinition: validTestDef,
        generatedAt: '2026-08-25T14:30:00.000Z'
      });

      expect(bundle.isExecutable).toBe(true);

      const ext = bundle.options.ext?.pecp;
      expect(ext).toBeDefined();
      expect(ext?.schedulerArrival?.population).toBe('JOURNEY_ITERATION');
      expect(ext?.schedulerArrival?.peakRate).toBe(109.375);
      expect(ext?.schedulerArrival?.unit).toBe('journey_iterations/second');
      expect(ext?.populationRelationship?.id).toBe('rel-retailco-bf26-orders-to-iterations');
      expect(ext?.workloadAttainment?.targetValue).toBe(8.75);
      expect(ext?.workloadAttainment?.unit).toBe('orders/second');
    });

    it('generates businessEvent step parameters in journeys.js', () => {
      const bundle = compileK6Bundle({
        testDefinition: validTestDef
      });

      const journeysFile = bundle.files.find((f) => f.filename === 'journeys.js');
      expect(journeysFile).toBeDefined();
      expect(journeysFile?.content).toContain('businessEvent: {"eventKey":"order_created","metric":"orders","unit":"orders","contribution":1,"expectedStatus":201');
    });

    it('exports businessAttainmentEvents counter metric from entrypoint.js', () => {
      const bundle = compileK6Bundle({
        testDefinition: validTestDef
      });

      const entrypointFile = bundle.files.find((f) => f.filename === 'entrypoint.js');
      expect(entrypointFile).toBeDefined();
      expect(entrypointFile?.content).toContain("import { businessAttainmentEvents } from './runtime.js'");
      expect(entrypointFile?.content).toContain("import { executeIteration, workloadArrivalDemand, workloadAttainmentRate } from './runtime.js'");
      expect(entrypointFile?.content).toContain('export { workloadArrivalDemand, workloadAttainmentRate, businessAttainmentEvents };');
    });

    it('blocks k6 compilation if schedule specifies an unsupported provider population', () => {
      const unsupportedPopDef = {
        ...validTestDef,
        scenarios: [
          {
            ...validTestDef.scenarios[0],
            workloadSchedule: {
              ...validTestDef.scenarios[0].workloadSchedule,
              arrivalPopulation: 'UNSUPPORTED_QUANTUM_POPULATION' as any
            }
          }
        ]
      };

      const bundle = compileK6Bundle({
        testDefinition: unsupportedPopDef
      });

      expect(bundle.isExecutable).toBe(false);
      expect(bundle.nonExecutableReasons.some((r) => r.includes('does not support arrival population'))).toBe(true);
    });
  });
});
