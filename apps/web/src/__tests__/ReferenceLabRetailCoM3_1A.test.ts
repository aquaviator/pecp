import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
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
import {
  compileTestDefinition,
  compileK6Bundle,
  buildExecutionPreflightManifest,
  validateExecutionPreflightManifest,
  TargetProbeResult,
  PECP_STABLE_K6_RUNTIME_VERSION,
  PECP_STABLE_K6_RUNTIME_SOURCE_ID
} from '@pecp/test-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';

describe('M3.1A Reference Lab Foundation & Execution Preflight', () => {
  const EPHEMERAL_TOKEN = `test-token-${crypto.randomUUID()}`;
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

    it('GET /api/v1/metrics exposes service telemetry and business event counters', async () => {
      const res = await fetch(`${baseUrl}/api/v1/metrics`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.service).toBe('retailco-reference-lab');
      expect(typeof data.businessAttainmentEvents.order_created).toBe('number');
      expect(data.businessAttainmentEvents.order_created).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Reference Lab Manifest Agreement', () => {
    const manifestPath = path.resolve(
      __dirname,
      '../../../../reference-lab/retailco/reference-lab-manifest.json'
    );
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    it('manifest describes all 5 canonical RetailCo journeys and /api/v1/metrics route', () => {
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

      const metricsRoute = manifest.routes.find((r: any) => r.path === '/api/v1/metrics');
      expect(metricsRoute).toBeDefined();
      expect(metricsRoute.method).toBe('GET');
      expect(metricsRoute.expectedStatus).toBe(200);
      expect(metricsRoute.authRequired).toBe(false);
    });
  });

  describe('3. Preflight Manifest Artefact & Binding Integrity Gate', () => {
    const preflightPath = path.resolve(
      __dirname,
      '../../../../reference-library/retailco/m3-preflight-manifest.json'
    );
    const labManifestPath = path.resolve(
      __dirname,
      '../../../../reference-lab/retailco/reference-lab-manifest.json'
    );
    const labManifest = JSON.parse(fs.readFileSync(labManifestPath, 'utf8'));

    const compiledTestDef = compileTestDefinition({
      contract: RETAILCO_M3_APPROVED_CONTRACT,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      version: 'v1.0',
      executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
    });

    const compiledBundle = compileK6Bundle({
      testDefinition: compiledTestDef,
      generatedAt: '2026-09-18T10:30:00Z'
    });

    const getVerifiedTargetProbe = async (targetUrl: string = 'http://localhost:8080'): Promise<TargetProbeResult> => {
      const healthRes = await fetch(`${baseUrl}/health`);
      const readyRes = await fetch(`${baseUrl}/ready`);
      const healthData = (await healthRes.json().catch(() => ({}))) as { status?: string };
      const readyData = (await readyRes.json().catch(() => ({}))) as { status?: string };
      return {
        baseUrl: targetUrl,
        healthStatus: healthData.status || 'healthy',
        readyStatus: readyData.status || 'ready',
        verifiedAt: '2026-09-18T10:30:00Z',
        isResolvable: healthRes.status === 200 && readyRes.status === 200,
        httpStatusHealth: healthRes.status,
        httpStatusReady: readyRes.status
      };
    };

    it('builds a deterministic preflight manifest bound to compiled test definition and k6 bundle', async () => {
      const probe = await getVerifiedTargetProbe();
      const builtManifest = buildExecutionPreflightManifest({
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z'
      });

      expect(builtManifest.status).toBe('READY_FOR_LIVE_EXECUTION');
      expect(builtManifest.canonicalTestDefinition.id).toBe(compiledTestDef.id);
      expect(builtManifest.canonicalTestDefinition.fingerprint).toBe(compiledTestDef.fingerprint);
      expect(builtManifest.canonicalTestDefinition.sourceContractId).toBe(compiledTestDef.sourceContractId);
      expect(builtManifest.canonicalTestDefinition.sourceContractFingerprint).toBe(compiledTestDef.sourceContractFingerprint);
      expect(builtManifest.canonicalTestDefinition.sourceContractStatus).toBe('APPROVED');

      expect(builtManifest.k6Runtime.version).toBe(PECP_STABLE_K6_RUNTIME_VERSION);
      expect(builtManifest.k6Runtime.sourceId).toBe(PECP_STABLE_K6_RUNTIME_SOURCE_ID);
      expect(builtManifest.k6Runtime.bundleFingerprint).toBe(compiledBundle.fingerprint);
      expect(builtManifest.k6Runtime.testDefinitionFingerprint).toBe(compiledBundle.testDefinitionFingerprint);
      expect(builtManifest.k6Runtime.bundleFiles).toContain('runtime.js');

      // Acceptance criteria check
      const checkoutThresh = builtManifest.expectedHealthyThresholds.find(
        (t) => t.criterionId === 'ac-checkout-latency'
      );
      expect(checkoutThresh).toBeDefined();
      expect(checkoutThresh?.metric).toBe('http_req_duration{journey:checkout}');
      expect(checkoutThresh?.expression).toBe('p(95)<2000');

      const errorThresh = builtManifest.expectedHealthyThresholds.find(
        (t) => t.criterionId === 'ac-global-error-rate'
      );
      expect(errorThresh).toBeDefined();
      expect(errorThresh?.metric).toBe('http_req_failed');
      expect(errorThresh?.unit).toBe('rate');
      expect(errorThresh?.expression).toBe('rate<0.005');

      // Target environment check
      expect(builtManifest.targetEnvironment.verifiedProbe).toBeDefined();
      expect(builtManifest.targetEnvironment.verifiedProbe?.isResolvable).toBe(true);
      expect(builtManifest.preflightChecks.targetResolvable).toBe(true);
    });

    it('validates authoritative m3-preflight-manifest.json against compiled outputs with zero drift', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();

      const validation = validateExecutionPreflightManifest(preflight, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe
      });

      expect(validation.issues).toEqual([]);
      expect(validation.isValid).toBe(true);
      expect(validation.status).toBe('READY_FOR_LIVE_EXECUTION');

      expect(preflight.status).toBe('READY_FOR_LIVE_EXECUTION');
      expect(preflight.canonicalTestDefinition.fingerprint).toBe(compiledTestDef.fingerprint);
      expect(preflight.canonicalTestDefinition.sourceContractFingerprint).toBe(compiledTestDef.sourceContractFingerprint);
      expect(preflight.canonicalTestDefinition.sourceContractStatus).toBe('APPROVED');
      expect(preflight.k6Runtime.sourceId).toBe(PECP_STABLE_K6_RUNTIME_SOURCE_ID);
      expect(preflight.k6Runtime.version).toBe(PECP_STABLE_K6_RUNTIME_VERSION);
      expect(preflight.k6Runtime.bundleFingerprint).toBe(compiledBundle.fingerprint);
      expect(preflight.k6Runtime.bundleFiles).toContain('runtime.js');

      // Criterion IDs must match approved contract
      const criteriaIds = preflight.expectedHealthyThresholds.map((t: any) => t.criterionId);
      expect(criteriaIds).toContain('ac-checkout-latency');
      expect(criteriaIds).toContain('ac-global-error-rate');

      // Error rate unit must not be percentage
      const errorRateThresh = preflight.expectedHealthyThresholds.find(
        (t: any) => t.metric === 'http_req_failed'
      );
      expect(errorRateThresh.unit).toBe('rate');
    });

    it('rejects preflight when test definition fingerprint drifts', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();
      const drifted = {
        ...preflight,
        canonicalTestDefinition: {
          ...preflight.canonicalTestDefinition,
          fingerprint: 'fp-drifted-fake-9999'
        }
      };

      const result = validateExecutionPreflightManifest(drifted, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe
      });

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('PREFLIGHT_BLOCKED');
      expect(result.issues.some((i) => i.field === 'canonicalTestDefinition.fingerprint')).toBe(true);
    });

    it('rejects preflight when k6 bundle runtime sourceId drifts', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();
      const drifted = {
        ...preflight,
        k6Runtime: {
          ...preflight.k6Runtime,
          sourceId: 'pecp-k6-runtime-v0.9.0'
        }
      };

      const result = validateExecutionPreflightManifest(drifted, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.field === 'k6Runtime.sourceId')).toBe(true);
    });

    it('rejects preflight when bundle files list is missing runtime.js', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();
      const drifted = {
        ...preflight,
        k6Runtime: {
          ...preflight.k6Runtime,
          bundleFiles: ['config.json', 'journeys.js', 'entrypoint.js']
        }
      };

      const result = validateExecutionPreflightManifest(drifted, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.field === 'k6Runtime.bundleFiles')).toBe(true);
    });

    it('rejects preflight when threshold criterion ID does not match approved contract', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();
      const drifted = {
        ...preflight,
        expectedHealthyThresholds: [
          {
            criterionId: 'unapproved-random-criterion',
            metric: 'http_req_duration{journey:checkout}',
            aggregation: 'p(95)',
            operator: '<',
            threshold: 2000,
            unit: 'ms',
            expression: 'p(95)<2000'
          }
        ]
      };

      const result = validateExecutionPreflightManifest(drifted, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.field.includes('unapproved-random-criterion'))).toBe(true);
    });

    it('rejects preflight when error rate threshold unit is percentage instead of rate/fraction', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();
      const drifted = {
        ...preflight,
        expectedHealthyThresholds: preflight.expectedHealthyThresholds.map((t: any) =>
          t.metric === 'http_req_failed' ? { ...t, unit: 'percentage' } : t
        )
      };

      const result = validateExecutionPreflightManifest(drifted, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.field.includes('unit'))).toBe(true);
    });

    it('blocks preflight when live execution has already started', async () => {
      const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
      const probe = await getVerifiedTargetProbe();

      const result = validateExecutionPreflightManifest(preflight, {
        testDefinition: compiledTestDef,
        bundle: compiledBundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        liveExecutionStarted: true
      });

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('PREFLIGHT_BLOCKED');
      expect(result.issues.some((i) => i.field === 'preflightChecks.liveExecutionNotStarted')).toBe(true);
    });

    // -------------------------------------------------------------------------
    // M3.1A.2 Preflight Authority & No-Fallback Gate Requirements
    // -------------------------------------------------------------------------

    describe('M3.1A.2 Requirement 2: Contract Approval Binding (Governed State, not text)', () => {
      it('proves a contract id containing "approved" does not pass when governed status is not APPROVED', async () => {
        const probe = await getVerifiedTargetProbe();
        const unapprovedContractDef = {
          ...compiledTestDef,
          sourceContractId: 'contract-proj-retailco-bf26-v1.0-approved', // contains "approved"
          sourceContractStatus: 'DRAFT' as any
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: unapprovedContractDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.contractApproved).toBe(false);

        const validation = validateExecutionPreflightManifest(manifest, {
          testDefinition: unapprovedContractDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          targetProbe: probe
        });

        expect(validation.isValid).toBe(false);
        expect(validation.status).toBe('PREFLIGHT_BLOCKED');
        expect(validation.issues.some((i) => i.field === 'canonicalTestDefinition.sourceContractStatus')).toBe(true);
      });
    });

    describe('M3.1A.2 Requirement 1 & 6: Preflight No-Fallback Gate on Parameters & Thresholds', () => {
      it('blocks preflight when latency criterion is missing percentile (no fallback p(95))', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithMissingPercentile = {
          ...compiledTestDef,
          executableCriteria: compiledTestDef.executableCriteria.map((c) =>
            c.id === 'ac-checkout-latency' ? { ...c, percentile: undefined } : c
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithMissingPercentile as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.thresholdsBoundToApprovedContract).toBe(false);
      });

      it('blocks preflight when criterion is missing operator (no fallback <)', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithMissingOp = {
          ...compiledTestDef,
          executableCriteria: compiledTestDef.executableCriteria.map((c) =>
            c.id === 'ac-checkout-latency' ? { ...c, operator: undefined } : c
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithMissingOp as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.thresholdsBoundToApprovedContract).toBe(false);
      });

      it('blocks preflight when criterion is missing thresholdValue (no fallback 0)', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithMissingVal = {
          ...compiledTestDef,
          executableCriteria: compiledTestDef.executableCriteria.map((c) =>
            c.id === 'ac-checkout-latency' ? { ...c, thresholdValue: undefined } : c
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithMissingVal as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.thresholdsBoundToApprovedContract).toBe(false);
      });

      it('blocks preflight when scheduler arrival population is missing (no fallback)', async () => {
        const probe = await getVerifiedTargetProbe();
        const defMissingPop = {
          ...compiledTestDef,
          scenarios: [
            {
              ...compiledTestDef.scenarios[0],
              workloadSchedule: {
                ...compiledTestDef.scenarios[0].workloadSchedule,
                arrivalPopulation: undefined
              }
            }
          ]
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defMissingPop as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.populationSemanticsHardened).toBe(false);
      });

      it('blocks preflight when workload attainment target/unit is missing (no fallback 8.75 orders/sec)', async () => {
        const probe = await getVerifiedTargetProbe();
        const defMissingAttainment = {
          ...compiledTestDef,
          workloadAttainment: undefined
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defMissingAttainment as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.populationSemanticsHardened).toBe(false);
      });

      it('blocks preflight when population relationship is missing or incomplete (no fallback)', async () => {
        const probe = await getVerifiedTargetProbe();
        const defMissingPopRel = {
          ...compiledTestDef,
          populationRelationship: undefined
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defMissingPopRel as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.populationSemanticsHardened).toBe(false);
      });

      it('blocks preflight when target environment URL is missing or invalid (no fallback localhost:8080)', () => {
        const defMissingUrl = {
          ...compiledTestDef,
          scenarios: [
            {
              ...compiledTestDef.scenarios[0],
              targetEnvironmentBaseUrlRef: ''
            }
          ]
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defMissingUrl as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT
          // Note: no targetProbe provided
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.targetResolvable).toBe(false);
        expect(manifest.targetEnvironment.defaultBaseUrl).toBe('');
      });
    });

    describe('M3.1A.2 Requirement 3: Semantic Reference Lab Route Alignment', () => {
      it('blocks preflight when canonical journey step has no matching route in Reference Lab manifest', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithMissingRoute = {
          ...compiledTestDef,
          journeys: compiledTestDef.journeys.map((j) =>
            j.key === 'checkout'
              ? {
                  ...j,
                  steps: [
                    ...j.steps,
                    {
                      id: 'step-unsupported-extra',
                      name: 'Unsupported Route',
                      method: 'POST' as const,
                      path: '/api/v1/orders/non-existent-action'
                    }
                  ]
                }
              : j
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithMissingRoute,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.referenceLabRoutesVerified).toBe(false);
      });

      it('blocks preflight when canonical journey step HTTP method does not match Reference Lab route', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithWrongMethod = {
          ...compiledTestDef,
          journeys: compiledTestDef.journeys.map((j) =>
            j.key === 'browse'
              ? {
                  ...j,
                  steps: j.steps.map((st) =>
                    st.path.includes('featured') ? { ...st, method: 'DELETE' as const } : st
                  )
                }
              : j
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithWrongMethod,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.referenceLabRoutesVerified).toBe(false);
      });

      it('blocks preflight when canonical journey step expected status does not match Reference Lab route', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithWrongStatus = {
          ...compiledTestDef,
          journeys: compiledTestDef.journeys.map((j) =>
            j.key === 'checkout'
              ? {
                  ...j,
                  steps: j.steps.map((st) =>
                    st.path.includes('checkout') ? { ...st, expectedStatusCode: 200 } : st // lab route specifies 201
                  )
                }
              : j
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithWrongStatus,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.referenceLabRoutesVerified).toBe(false);
      });

      it('blocks preflight when route manifest has payloadRequired=false for step with request payload', async () => {
        const probe = await getVerifiedTargetProbe();
        const mutatedLabManifest = {
          ...labManifest,
          routes: labManifest.routes.map((r: any) =>
            r.path.includes('checkout') ? { ...r, payloadRequired: false } : r
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: mutatedLabManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.referenceLabRoutesVerified).toBe(false);
      });

      it('blocks preflight when route manifest has authRequired=false for step with credential reference', async () => {
        const probe = await getVerifiedTargetProbe();
        const mutatedLabManifest = {
          ...labManifest,
          routes: labManifest.routes.map((r: any) =>
            r.path.includes('checkout') ? { ...r, authRequired: false } : r
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: mutatedLabManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.referenceLabRoutesVerified).toBe(false);
      });

      it('blocks preflight when business event contribution is missing or mismatched on required route', async () => {
        const probe = await getVerifiedTargetProbe();
        const mutatedLabManifest = {
          ...labManifest,
          routes: labManifest.routes.map((r: any) =>
            r.path.includes('checkout')
              ? {
                  ...r,
                  businessEventContribution: {
                    ...r.businessEventContribution,
                    expectedStatus: 200 // step expects 201
                  }
                }
              : r
          )
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: mutatedLabManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.referenceLabRoutesVerified).toBe(false);
      });
    });

    describe('M3.1A.2 Requirement 4: Target Resolvability Evidence', () => {
      it('blocks preflight when targetProbe evidence is not provided (targetResolvable=false)', () => {
        const manifest = buildExecutionPreflightManifest({
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT
          // targetProbe omitted
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.targetResolvable).toBe(false);
      });

      it('blocks preflight when targetProbe reports healthStatus not healthy or isResolvable false', async () => {
        const degradedProbe: TargetProbeResult = {
          baseUrl,
          healthStatus: 'degraded',
          readyStatus: 'ready',
          verifiedAt: '2026-09-18T10:30:00Z',
          isResolvable: false,
          httpStatusHealth: 500,
          httpStatusReady: 200
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: degradedProbe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.targetResolvable).toBe(false);
      });

      it('validator rejects manifest claiming targetResolvable=true without supplied verified targetProbe evidence', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));

        const validation = validateExecutionPreflightManifest(preflight, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT
          // targetProbe omitted in validation context
        });

        expect(validation.isValid).toBe(false);
        expect(validation.issues.some((i) => i.field === 'preflightChecks.targetResolvable')).toBe(true);
      });
    });

    describe('M3.1A.2 Requirement 5: Derived Credential Bindings', () => {
      it('derives credential route and authScheme directly from journey step and Reference Lab route manifest', async () => {
        const probe = await getVerifiedTargetProbe();
        const manifest = buildExecutionPreflightManifest({
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.credentialBindings.requiredReferences.length).toBe(1);
        const ref = manifest.credentialBindings.requiredReferences[0];
        expect(ref.referenceId).toBe('RETAILCO_CHECKOUT_AUTH_TOKEN');
        expect(ref.enforcedRoute).toBe('/api/v1/orders/checkout');
        expect(ref.enforcedScheme).toBe('Bearer');
      });

      it('blocks preflight when credential reference is not bound to any canonical journey step', async () => {
        const probe = await getVerifiedTargetProbe();
        const defWithOrphanCred = {
          ...compiledTestDef,
          credentialReferences: [
            ...compiledTestDef.credentialReferences,
            {
              referenceId: 'ORPHAN_CREDENTIAL',
              provider: 'ENV_VAR',
              purpose: 'Unknown',
              environmentVariableName: 'ORPHAN_TOKEN'
            }
          ]
        };

        const manifest = buildExecutionPreflightManifest({
          testDefinition: defWithOrphanCred as any,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(manifest.status).toBe('PREFLIGHT_BLOCKED');
        expect(manifest.preflightChecks.credentialBindingsDefined).toBe(false);
      });
    });

    describe('M3.1A.3: Preflight Binding Completeness Gate', () => {
      it('blocks and invalidates when manifest asserts READY_FOR_LIVE_EXECUTION but one preflight check is false', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();
        const tampered = {
          ...preflight,
          status: 'READY_FOR_LIVE_EXECUTION',
          preflightChecks: {
            ...preflight.preflightChecks,
            referenceLabRoutesVerified: false
          }
        };

        const result = validateExecutionPreflightManifest(tampered, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(result.isValid).toBe(false);
        expect(result.status).toBe('PREFLIGHT_BLOCKED');
        expect(result.issues.some((i) => i.field === 'preflightChecks.referenceLabRoutesVerified')).toBe(true);
        expect(result.issues.some((i) => i.field === 'status')).toBe(true);
      });

      it('blocks when source contract is APPROVED but has wrong contract id, version, or fingerprint', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        // 1. Wrong source contract ID
        const badIdContract = { ...RETAILCO_M3_APPROVED_CONTRACT, id: 'contract-wrong-id' };
        const resultBadId = validateExecutionPreflightManifest(preflight, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: badIdContract,
          targetProbe: probe
        });
        expect(resultBadId.isValid).toBe(false);
        expect(resultBadId.issues.some((i) => i.field === 'canonicalTestDefinition.sourceContractId')).toBe(true);

        // 2. Wrong source contract version
        const badVersionContract = { ...RETAILCO_M3_APPROVED_CONTRACT, version: 'v2.0' };
        const resultBadVersion = validateExecutionPreflightManifest(preflight, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: badVersionContract,
          targetProbe: probe
        });
        expect(resultBadVersion.isValid).toBe(false);
        expect(resultBadVersion.issues.some((i) => i.field === 'canonicalTestDefinition.sourceContractVersion')).toBe(true);

        // 3. Wrong source contract fingerprint (modified contract content)
        const driftedContract = {
          ...RETAILCO_M3_APPROVED_CONTRACT,
          engineeringIntent: 'CERTIFICATION' as const
        };
        const resultDrift = validateExecutionPreflightManifest(preflight, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: driftedContract,
          targetProbe: probe
        });
        expect(resultDrift.isValid).toBe(false);
        expect(resultDrift.issues.some((i) => i.field === 'canonicalTestDefinition.sourceContractFingerprint')).toBe(true);
      });

      it('blocks when one required threshold is deleted from the manifest', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();
        const deletedThreshold = {
          ...preflight,
          expectedHealthyThresholds: preflight.expectedHealthyThresholds.filter(
            (t: any) => t.criterionId !== 'ac-checkout-latency'
          )
        };

        const result = validateExecutionPreflightManifest(deletedThreshold, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(result.isValid).toBe(false);
        expect(result.issues.some((i) => i.field === 'expectedHealthyThresholds.ac-checkout-latency')).toBe(true);
      });

      it('blocks when a threshold has an unknown criterion id not in approved contract', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();
        const unknownCriterion = {
          ...preflight,
          expectedHealthyThresholds: [
            ...preflight.expectedHealthyThresholds,
            {
              criterionId: 'unapproved-invented-criterion-id',
              metric: 'http_req_duration{journey:checkout}',
              aggregation: 'p(95)',
              operator: '<',
              threshold: 2000,
              unit: 'ms',
              expression: 'p(95)<2000'
            }
          ]
        };

        const result = validateExecutionPreflightManifest(unknownCriterion, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: probe
        });

        expect(result.isValid).toBe(false);
        expect(result.issues.some((i) => i.field === 'expectedHealthyThresholds.unapproved-invented-criterion-id')).toBe(true);
      });

      it('blocks when threshold operator, value, unit, or compiled expression drifts', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        // Operator drift
        const opDrift = {
          ...preflight,
          expectedHealthyThresholds: preflight.expectedHealthyThresholds.map((t: any) =>
            t.criterionId === 'ac-checkout-latency' ? { ...t, operator: '<=' } : t
          )
        };
        expect(
          validateExecutionPreflightManifest(opDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('operator'))
        ).toBe(true);

        // Value drift
        const valDrift = {
          ...preflight,
          expectedHealthyThresholds: preflight.expectedHealthyThresholds.map((t: any) =>
            t.criterionId === 'ac-checkout-latency' ? { ...t, threshold: 1500 } : t
          )
        };
        expect(
          validateExecutionPreflightManifest(valDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('threshold'))
        ).toBe(true);

        // Unit drift
        const unitDrift = {
          ...preflight,
          expectedHealthyThresholds: preflight.expectedHealthyThresholds.map((t: any) =>
            t.criterionId === 'ac-checkout-latency' ? { ...t, unit: 'seconds' } : t
          )
        };
        expect(
          validateExecutionPreflightManifest(unitDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('unit'))
        ).toBe(true);

        // Expression drift
        const exprDrift = {
          ...preflight,
          expectedHealthyThresholds: preflight.expectedHealthyThresholds.map((t: any) =>
            t.criterionId === 'ac-checkout-latency' ? { ...t, expression: 'p(99)<2000' } : t
          )
        };
        expect(
          validateExecutionPreflightManifest(exprDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('expression'))
        ).toBe(true);
      });

      it('blocks when scheduler arrival population, peak rate, or unit drifts', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        // Arrival population drift
        const popDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            schedulerArrivalPopulation: 'VIRTUAL_USERS'
          }
        };
        expect(
          validateExecutionPreflightManifest(popDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.schedulerArrivalPopulation')
        ).toBe(true);

        // Peak rate drift
        const rateDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            schedulerPeakRate: { ...preflight.governedWorkload.schedulerPeakRate, value: 200 }
          }
        };
        expect(
          validateExecutionPreflightManifest(rateDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.schedulerPeakRate.value')
        ).toBe(true);

        // Unit drift
        const rateUnitDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            schedulerPeakRate: { ...preflight.governedWorkload.schedulerPeakRate, unit: 'req/s' }
          }
        };
        expect(
          validateExecutionPreflightManifest(rateUnitDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.schedulerPeakRate.unit')
        ).toBe(true);
      });

      it('blocks when attainment target value, metric, or unit drifts', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        // Target value drift
        const targetValDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            businessWorkloadAttainment: { ...preflight.governedWorkload.businessWorkloadAttainment, targetValue: 50 }
          }
        };
        expect(
          validateExecutionPreflightManifest(targetValDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.businessWorkloadAttainment.targetValue')
        ).toBe(true);

        // Metric drift
        const metricDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            businessWorkloadAttainment: { ...preflight.governedWorkload.businessWorkloadAttainment, metric: 'revenue' }
          }
        };
        expect(
          validateExecutionPreflightManifest(metricDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.businessWorkloadAttainment.metric')
        ).toBe(true);

        // Unit drift
        const unitDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            businessWorkloadAttainment: { ...preflight.governedWorkload.businessWorkloadAttainment, unit: 'items/second' }
          }
        };
        expect(
          validateExecutionPreflightManifest(unitDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.businessWorkloadAttainment.unit')
        ).toBe(true);
      });

      it('blocks when population relationship drifts', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        const idDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            populationRelationship: { ...preflight.governedWorkload.populationRelationship, id: 'wrong-rel-id' }
          }
        };
        expect(
          validateExecutionPreflightManifest(idDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.populationRelationship.id')
        ).toBe(true);

        const shareDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            populationRelationship: { ...preflight.governedWorkload.populationRelationship, journeyShare: 0.5 }
          }
        };
        expect(
          validateExecutionPreflightManifest(shareDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.populationRelationship.journeyShare')
        ).toBe(true);

        const contribDrift = {
          ...preflight,
          governedWorkload: {
            ...preflight.governedWorkload,
            populationRelationship: { ...preflight.governedWorkload.populationRelationship, contributionPerSuccessfulEvent: 5 }
          }
        };
        expect(
          validateExecutionPreflightManifest(contribDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'governedWorkload.populationRelationship.contributionPerSuccessfulEvent')
        ).toBe(true);
      });

      it('blocks when bound credential has wrong route, auth scheme, or provider', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        // Wrong route
        const wrongRoute = {
          ...preflight,
          credentialBindings: {
            ...preflight.credentialBindings,
            requiredReferences: preflight.credentialBindings.requiredReferences.map((r: any) => ({
              ...r,
              enforcedRoute: '/api/v1/wrong/path'
            }))
          }
        };
        expect(
          validateExecutionPreflightManifest(wrongRoute, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('enforcedRoute'))
        ).toBe(true);

        // Wrong scheme
        const wrongScheme = {
          ...preflight,
          credentialBindings: {
            ...preflight.credentialBindings,
            requiredReferences: preflight.credentialBindings.requiredReferences.map((r: any) => ({
              ...r,
              enforcedScheme: 'Basic'
            }))
          }
        };
        expect(
          validateExecutionPreflightManifest(wrongScheme, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('enforcedScheme'))
        ).toBe(true);

        // Wrong provider
        const wrongProvider = {
          ...preflight,
          credentialBindings: {
            ...preflight.credentialBindings,
            requiredReferences: preflight.credentialBindings.requiredReferences.map((r: any) => ({
              ...r,
              provider: 'VAULT'
            }))
          }
        };
        expect(
          validateExecutionPreflightManifest(wrongProvider, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field.includes('provider'))
        ).toBe(true);
      });

      it('blocks when target probe origin does not match Test Definition target environment', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const mismatchedProbe: TargetProbeResult = {
          baseUrl: 'http://unauthorized-remote-host:9999',
          healthStatus: 'healthy',
          readyStatus: 'ready',
          verifiedAt: '2026-09-18T10:30:00Z',
          isResolvable: true,
          httpStatusHealth: 200,
          httpStatusReady: 200
        };

        const result = validateExecutionPreflightManifest(preflight, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: mismatchedProbe
        });

        expect(result.isValid).toBe(false);
        expect(result.status).toBe('PREFLIGHT_BLOCKED');
        expect(result.issues.some((i) => i.field === 'targetProbe.baseUrl')).toBe(true);
      });

      it('blocks when probe /health or /ready status is not 200 or not healthy/ready', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));

        const unhealthyProbe: TargetProbeResult = {
          baseUrl: 'http://localhost:8080',
          healthStatus: 'degraded',
          readyStatus: 'ready',
          verifiedAt: '2026-09-18T10:30:00Z',
          isResolvable: true,
          httpStatusHealth: 503,
          httpStatusReady: 200
        };

        const result = validateExecutionPreflightManifest(preflight, {
          testDefinition: compiledTestDef,
          bundle: compiledBundle,
          referenceLabManifest: labManifest,
          sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
          targetProbe: unhealthyProbe
        });

        expect(result.isValid).toBe(false);
        expect(result.status).toBe('PREFLIGHT_BLOCKED');
        expect(result.issues.some((i) => i.field === 'targetProbe.httpStatusHealth')).toBe(true);
        expect(result.issues.some((i) => i.field === 'targetProbe.healthStatus')).toBe(true);
      });

      it('blocks when Reference Lab service name, serviceVersion, or routeManifestVersion drifts', async () => {
        const preflight = JSON.parse(fs.readFileSync(preflightPath, 'utf8'));
        const probe = await getVerifiedTargetProbe();

        // Service name drift
        const svcDrift = { ...preflight, service: 'wrong-service' };
        expect(
          validateExecutionPreflightManifest(svcDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'service')
        ).toBe(true);

        // Service version drift
        const verDrift = { ...preflight, serviceVersion: '9.9.9' };
        expect(
          validateExecutionPreflightManifest(verDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'serviceVersion')
        ).toBe(true);

        // Route manifest version drift
        const routeVerDrift = { ...preflight, routeManifestVersion: '9.9.9' };
        expect(
          validateExecutionPreflightManifest(routeVerDrift, {
            testDefinition: compiledTestDef,
            bundle: compiledBundle,
            referenceLabManifest: labManifest,
            sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
            targetProbe: probe
          }).issues.some((i) => i.field === 'routeManifestVersion')
        ).toBe(true);
      });
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
