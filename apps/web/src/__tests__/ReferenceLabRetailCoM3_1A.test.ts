import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRetailCoLabServer } from '../../../../reference-lab/retailco/src/server.js';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE,
  RETAILCO_M3_JOURNEYS,
  RETAILCO_M3_POPULATION_RELATIONSHIP,
  RETAILCO_M3_WORKLOAD_SCHEDULE
} from '../fixtures/retailco/m3ExecutionFixture';
import { compileTestDefinition } from '@pecp/test-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';

describe('M3.1A Reference Lab Foundation & Execution Preflight', () => {
  const EPHEMERAL_TOKEN = 'test-token-vault-runtime-8989';
  let lab: ReturnType<typeof createRetailCoLabServer>;
  let baseUrl: string;

  beforeAll(async () => {
    lab = createRetailCoLabServer({
      port: 0,
      authToken: EPHEMERAL_TOKEN,
      silent: true
    });
    const { port } = await lab.start();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await lab.stop();
  });

  describe('1. Reference Lab Live HTTP Behavior', () => {
    it('GET /health returns 200 with service metadata', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('retailco-reference-lab');
      expect(data.version).toBe('1.0.0');
    });

    it('GET /ready returns 200 with verified synthetic data profiles', async () => {
      const res = await fetch(`${baseUrl}/ready`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ready');
      expect(data.profiles.customerAccounts).toBe(100000);
      expect(data.profiles.activeSkus).toBe(50000);
      expect(data.profiles.syntheticPaymentTokens).toBe('v1');
      expect(data.authConfigured).toBe(true);
    });

    it('GET /api/v1/products/featured returns 200 and catalog items', async () => {
      const res = await fetch(`${baseUrl}/api/v1/products/featured`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /api/v1/products/search returns 200 with query matches', async () => {
      const res = await fetch(`${baseUrl}/api/v1/products/search?q=electronics`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.query).toBe('electronics');
      expect(data.products.length).toBeGreaterThanOrEqual(2);
      expect(data.products.every((p: any) => p.category === 'electronics')).toBe(true);
    });

    it('POST /api/v1/basket/items accepts synthetic basket payload and returns 200', async () => {
      const res = await fetch(`${baseUrl}/api/v1/basket/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: 'SKU-ELECTRONICS-9921',
          quantity: 1
        })
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.basketId).toBe('basket-active-ref');
      expect(data.item.sku).toBe('SKU-ELECTRONICS-9921');
      expect(data.itemCount).toBe(1);
    });

    it('POST /api/v1/orders/checkout rejects missing or invalid credentials without exposing secrets', async () => {
      // 1. Missing header
      const resMissing = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basketId: 'basket-active-ref',
          paymentMethod: 'SYNTHETIC_CARD_TEST',
          shippingAddressId: 'addr-ref-primary'
        })
      });
      expect(resMissing.status).toBe(401);
      const dataMissing = await resMissing.json();
      expect(dataMissing.error).toBe('UNAUTHORIZED');
      expect(JSON.stringify(dataMissing)).not.toContain(EPHEMERAL_TOKEN);

      // 2. Wrong header
      const resWrong = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong-runtime-token'
        },
        body: JSON.stringify({
          basketId: 'basket-active-ref',
          paymentMethod: 'SYNTHETIC_CARD_TEST',
          shippingAddressId: 'addr-ref-primary'
        })
      });
      expect(resWrong.status).toBe(401);
      const dataWrong = await resWrong.json();
      expect(dataWrong.error).toBe('UNAUTHORIZED');
      expect(JSON.stringify(dataWrong)).not.toContain(EPHEMERAL_TOKEN);
      expect(JSON.stringify(dataWrong)).not.toContain('wrong-runtime-token');
    });

    it('POST /api/v1/orders/checkout returns 201 and emits exactly 1 order_created business event', async () => {
      const prevOrderCount = lab.getMetrics().businessAttainmentEvents.order_created;

      const res = await fetch(`${baseUrl}/api/v1/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EPHEMERAL_TOKEN}`
        },
        body: JSON.stringify({
          basketId: 'basket-active-ref',
          paymentMethod: 'SYNTHETIC_CARD_TEST',
          shippingAddressId: 'addr-ref-primary'
        })
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.status).toBe('CREATED');
      expect(data.businessEvent.eventKey).toBe('order_created');
      expect(data.businessEvent.contribution).toBe(1);

      const newOrderCount = lab.getMetrics().businessAttainmentEvents.order_created;
      expect(newOrderCount).toBe(prevOrderCount + 1);
    });

    it('GET /api/v1/customers/me/orders returns 200 with order history', async () => {
      const res = await fetch(`${baseUrl}/api/v1/customers/me/orders`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.customerId).toBe('cust-synthetic-me');
      expect(Array.isArray(data.orders)).toBe(true);
      expect(data.orders.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Reference Lab Manifest Agreement', () => {
    const manifestPath = path.resolve(
      __dirname,
      '../../../../reference-lab/retailco/reference-lab-manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    it('manifest describes all 5 canonical RetailCo journeys', () => {
      for (const journey of RETAILCO_M3_JOURNEYS) {
        for (const step of journey.steps) {
          const matchedRoute = manifest.routes.find(
            (r: any) =>
              (r.path === step.path || step.path.startsWith(r.path)) &&
              r.method === step.method
          );
          expect(matchedRoute).toBeDefined();
          expect(matchedRoute.expectedStatus).toBe(step.expectedStatusCode);

          if (step.credentialReferences && step.credentialReferences.length > 0) {
            expect(matchedRoute.authRequired).toBe(true);
            expect(matchedRoute.authScheme).toBe('Bearer');
          }

          if (step.businessEventContribution) {
            expect(matchedRoute.businessEventContribution).toBeDefined();
            expect(matchedRoute.businessEventContribution.eventKey).toBe(
              step.businessEventContribution.eventKey
            );
            expect(matchedRoute.businessEventContribution.contribution).toBe(
              step.businessEventContribution.contribution
            );
            expect(matchedRoute.businessEventContribution.expectedStatus).toBe(
              step.businessEventContribution.expectedStatus
            );
          }
        }
      }
    });
  });

  describe('3. Preflight Manifest Artefact', () => {
    const preflightPath = path.resolve(
      __dirname,
      '../../../../reference-library/retailco/m3-preflight-manifest.json'
    );
    const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));

    it('records preflight configuration with READY_FOR_LIVE_EXECUTION', () => {
      expect(preflight.status).toBe('READY_FOR_LIVE_EXECUTION');
      expect(preflight.service).toBe('retailco-reference-lab');
      expect(preflight.targetEnvironment.defaultBaseUrl).toBe('http://localhost:8080');
      expect(preflight.governedWorkload.schedulerPeakRate.value).toBe(109.375);
      expect(preflight.governedWorkload.businessWorkloadAttainment.targetValue).toBe(8.75);
      expect(preflight.governedWorkload.populationRelationship.contributionPerSuccessfulEvent).toBe(1);
      expect(preflight.credentialBindings.requiredReferences[0].referenceId).toBe(
        'RETAILCO_CHECKOUT_AUTH_TOKEN'
      );
      expect(preflight.preflightChecks.contractApproved).toBe(true);
      expect(preflight.preflightChecks.testDefinitionCompiled).toBe(true);
      expect(preflight.preflightChecks.targetResolvable).toBe(true);
    });
  });

  describe('4. Hardened Population Relationship Validation', () => {
    it('compiles cleanly with valid canonical M3 intelligence', () => {
      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
      });
      expect(result.status).toBe('READY_FOR_EXECUTION');
      expect(result.isExecutable).toBe(true);
      expect(result.blockingReasons.length).toBe(0);
    });

    it('rejects when inputBusinessTarget.unit does not match workloadAttainment.unit', () => {
      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        populationRelationship: {
          ...RETAILCO_M3_POPULATION_RELATIONSHIP,
          inputBusinessTarget: {
            value: 8.75,
            unit: 'transactions/second' // Mismatch vs contract 'orders/second'
          }
        }
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const unitIssue = result.issues.find(
        (i) => i.parameter === 'inputBusinessTarget.unit'
      );
      expect(unitIssue).toBeDefined();
      expect(unitIssue?.severity).toBe('BLOCKING');
    });

    it('rejects when outputSchedulerRate.population does not match schedule.arrivalPopulation', () => {
      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        populationRelationship: {
          ...RETAILCO_M3_POPULATION_RELATIONSHIP,
          outputSchedulerRate: {
            ...RETAILCO_M3_POPULATION_RELATIONSHIP.outputSchedulerRate,
            population: 'SESSION' as any // Mismatch vs schedule 'JOURNEY_ITERATION'
          }
        }
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const popIssue = result.issues.find(
        (i) => i.parameter === 'outputSchedulerRate.population'
      );
      expect(popIssue).toBeDefined();
    });

    it('rejects when outputSchedulerRate.unit does not match schedule.rateUnit', () => {
      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        populationRelationship: {
          ...RETAILCO_M3_POPULATION_RELATIONSHIP,
          outputSchedulerRate: {
            ...RETAILCO_M3_POPULATION_RELATIONSHIP.outputSchedulerRate,
            unit: 'sessions/second' // Mismatch vs schedule 'journey_iterations/second'
          }
        }
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const rateUnitIssue = result.issues.find(
        (i) => i.parameter === 'outputSchedulerRate.unit'
      );
      expect(rateUnitIssue).toBeDefined();
    });

    it('rejects when mixed-journey workload silently equates business unit with scheduler rate unit', () => {
      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        populationRelationship: {
          ...RETAILCO_M3_POPULATION_RELATIONSHIP,
          outputSchedulerRate: {
            ...RETAILCO_M3_POPULATION_RELATIONSHIP.outputSchedulerRate,
            unit: 'orders/second' // Equated to input business target unit
          }
        },
        schedule: {
          ...RETAILCO_M3_WORKLOAD_SCHEDULE,
          rateUnit: 'orders/second'
        }
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const equivIssue = result.issues.find(
        (i) => i.id === 'issue-population-rel-silent-unit-equivalence'
      );
      expect(equivIssue).toBeDefined();
    });

    it('rejects when contributionPerSuccessfulEvent is non-positive or not finite', () => {
      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        populationRelationship: {
          ...RETAILCO_M3_POPULATION_RELATIONSHIP,
          contributionPerSuccessfulEvent: 0
        }
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const contribIssue = result.issues.find(
        (i) => i.parameter === 'contributionPerSuccessfulEvent'
      );
      expect(contribIssue).toBeDefined();
    });

    it('rejects when referenced journey has no step emitting business event contribution', () => {
      const strippedJourneys = RETAILCO_M3_JOURNEYS.map((j) => {
        if (j.key === 'checkout') {
          return {
            ...j,
            steps: j.steps.map((s) => {
              const { businessEventContribution, ...rest } = s;
              return rest;
            })
          };
        }
        return j;
      });

      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        journeys: strippedJourneys
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const noEventIssue = result.issues.find(
        (i) => i.id === 'issue-population-rel-no-event-step'
      );
      expect(noEventIssue).toBeDefined();
    });

    it('rejects when step event contribution does not match population relationship contribution', () => {
      const modifiedJourneys = RETAILCO_M3_JOURNEYS.map((j) => {
        if (j.key === 'checkout') {
          return {
            ...j,
            steps: j.steps.map((s) => ({
              ...s,
              businessEventContribution: s.businessEventContribution
                ? { ...s.businessEventContribution, contribution: 2 } // Mismatch vs relationship 1
                : undefined
            }))
          };
        }
        return j;
      });

      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        journeys: modifiedJourneys
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const mismatchIssue = result.issues.find(
        (i) => i.parameter === 'businessEventContribution.contribution'
      );
      expect(mismatchIssue).toBeDefined();
    });

    it('rejects when step event expectedStatus does not match step expectedStatusCode', () => {
      const modifiedJourneys = RETAILCO_M3_JOURNEYS.map((j) => {
        if (j.key === 'checkout') {
          return {
            ...j,
            steps: j.steps.map((s) => ({
              ...s,
              businessEventContribution: s.businessEventContribution
                ? { ...s.businessEventContribution, expectedStatus: 200 } // Mismatch vs step 201
                : undefined
            }))
          };
        }
        return j;
      });

      const badIntelligence = {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        journeys: modifiedJourneys
      };

      const result = compileTestDefinition({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        executionIntelligence: badIntelligence
      });
      expect(result.isExecutable).toBe(false);
      const statusIssue = result.issues.find(
        (i) => i.parameter === 'businessEventContribution.expectedStatus'
      );
      expect(statusIssue).toBeDefined();
    });
  });
});
