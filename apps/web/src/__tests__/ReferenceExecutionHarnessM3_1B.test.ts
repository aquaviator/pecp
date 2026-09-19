import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {
  PINNED_K6_VERSION_EXPECTED,
  PinnedK6EngineInfo,
  K6ProcessInvocation,
  K6ExecutionAdapter,
  computeSha256Checksum,
  generateEphemeralCheckoutToken,
  materializeK6Bundle,
  probeReferenceLab,
  queryReferenceLabMetrics,
  computeReferenceLabMetricsDelta,
  executeReferenceRun
} from '@pecp/test-engine/execution';
import {
  compileTestDefinition,
  compileK6Bundle,
  buildExecutionPreflightManifest
} from '@pecp/test-engine';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../fixtures/retailco/m3ExecutionFixture';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
// Import Reference Lab HTTP server factory
import { createRetailCoLabServer } from '../../../../reference-lab/retailco/src/server.js';

function createMockK6Adapter(overrides: {
  version?: string;
  isPinnedExpected?: boolean;
  checkVersionError?: Error;
  runK6Error?: Error;
  exitCode?: number;
  onRun?: (invocation: K6ProcessInvocation) => void | Promise<void>;
} = {}) {
  const checkCalls: string[] = [];
  const runCalls: K6ProcessInvocation[] = [];

  const adapter: K6ExecutionAdapter = {
    checkVersion: async (binaryPath = 'k6') => {
      checkCalls.push(binaryPath);
      if (overrides.checkVersionError) {
        throw overrides.checkVersionError;
      }
      const version = overrides.version || PINNED_K6_VERSION_EXPECTED;
      return {
        name: 'k6',
        version,
        fullVersionString: `k6 v${version} (injected mock adapter)`,
        isPinnedExpected:
          overrides.isPinnedExpected !== undefined
            ? overrides.isPinnedExpected
            : version === PINNED_K6_VERSION_EXPECTED,
        binaryPath
      };
    },
    runK6: async (invocation: K6ProcessInvocation) => {
      runCalls.push(invocation);
      if (overrides.onRun) {
        await overrides.onRun(invocation);
      }

      // Write mock summary.json if not already written
      if (!fs.existsSync(invocation.summaryJsonPath)) {
        fs.writeFileSync(
          invocation.summaryJsonPath,
          JSON.stringify({
            metrics: {
              http_reqs: { count: 850, rate: 38.6 },
              http_req_duration: { avg: 14.8, p95: 32.1 }
            }
          }),
          'utf8'
        );
      }

      // Write stdout and stderr logs
      const rawStdout =
        'Mock k6 execution started\nrunning (00m03.0s)...\ndone\n';
      const textStdout = invocation.redactedToken
        ? rawStdout.split(invocation.redactedToken).join('***REDACTED_EPHEMERAL***')
        : rawStdout;
      fs.writeFileSync(invocation.stdoutLogPath, textStdout, 'utf8');
      fs.writeFileSync(invocation.stderrLogPath, '', 'utf8');

      if (overrides.runK6Error) {
        return { exitCode: null, error: overrides.runK6Error };
      }
      return { exitCode: overrides.exitCode !== undefined ? overrides.exitCode : 0 };
    }
  };

  return { adapter, checkCalls, runCalls };
}

function sendHttpJson(
  urlStr: string,
  method: string,
  bodyObj: any,
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const postData = JSON.stringify(bodyObj);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: data });
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

describe('M3.1B.1 Governed Reference Execution Harness & CI Isolation Gate', () => {
  let labInstance: any;
  let labPort: number;
  let baseUrl: string;
  let workDir: string;
  let testDef: any;
  let bundle: any;
  let labManifest: any;
  const sharedEphemeralToken = generateEphemeralCheckoutToken();

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-m3-1b-ci-isolation-'));

    // Start ephemeral Reference Lab configured with shared ephemeral token (Section 5)
    labInstance = createRetailCoLabServer({
      port: 0,
      authToken: sharedEphemeralToken,
      silent: true
    });
    const { port } = await labInstance.start();
    labPort = port;
    baseUrl = `http://localhost:${labPort}`;

    const labManifestPath = path.resolve(
      __dirname,
      '../../../../reference-lab/retailco/reference-lab-manifest.json'
    );
    labManifest = JSON.parse(fs.readFileSync(labManifestPath, 'utf8'));

    // Compile Test Definition and Bundle bound to ephemeral Reference Lab URL
    testDef = compileTestDefinition({
      contract: RETAILCO_M3_APPROVED_CONTRACT,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      version: 'v1.0',
      executionIntelligence: {
        ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
        targetEnvironmentBaseUrlRef: baseUrl
      }
    });

    bundle = compileK6Bundle({
      testDefinition: testDef,
      generatedAt: '2026-09-18T10:30:00Z'
    });
  });

  afterAll(async () => {
    if (labInstance) {
      await labInstance.stop();
    }
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  describe('1. Fast CI Engine Isolation & Version Verification (Section 1, 3)', () => {
    it('accepts pinned k6 version via execution adapter', async () => {
      const { adapter } = createMockK6Adapter({ version: PINNED_K6_VERSION_EXPECTED });
      const info = await adapter.checkVersion();
      expect(info.name).toBe('k6');
      expect(info.version).toBe(PINNED_K6_VERSION_EXPECTED);
      expect(info.isPinnedExpected).toBe(true);
    });

    it('rejects unpinned or floating versions before process execution', async () => {
      const { adapter, runCalls } = createMockK6Adapter({
        version: '0.53.0',
        isPinnedExpected: false
      });

      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'unpinned-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        k6Adapter: adapter
      });

      expect(result.operationalStatus).toBe('EXECUTION_ENGINE_FAILED');
      expect(result.issues[0].code).toBe('UNPINNED_K6_ENGINE');
      expect(runCalls.length).toBe(0); // Zero process calls made
    });
  });

  describe('2. Unmodified Governed Bundle Materialization (Section 4)', () => {
    it('materializes all files with byte-for-byte exact equality', () => {
      const targetDir = path.join(workDir, 'bundle-materialize-test');
      const result = materializeK6Bundle(bundle, targetDir);

      expect(result.verifiedByteMatch).toBe(true);
      expect(result.files.length).toBe(bundle.files.length);

      for (const file of bundle.files) {
        const filePath = path.join(targetDir, file.filename);
        expect(fs.existsSync(filePath)).toBe(true);
        const diskContent = fs.readFileSync(filePath, 'utf8');
        expect(diskContent).toBe(file.content);
        expect(computeSha256Checksum(diskContent)).toBe(computeSha256Checksum(file.content));
      }
    });
  });

  describe('3. Preflight First Authority & CI Isolation (Section 2, 3, 5, 9)', () => {
    it('preflight failure strictly prevents process launch and engine check (ZERO calls)', async () => {
      // Mock adapter whose checkVersion will throw if called
      const { adapter, checkCalls, runCalls } = createMockK6Adapter({
        checkVersionError: new Error('Binary check should NEVER be called on blocked preflight!')
      });

      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'preflight-blocked-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        forcePreflightInvalid: true,
        k6Adapter: adapter
      });

      expect(result.operationalStatus).toBe('PREFLIGHT_BLOCKED');
      expect(result.issues[0].code).toBe('PREFLIGHT_BLOCKED');
      // Proves ZERO engine/process calls were made even though engine check was set to throw!
      expect(checkCalls.length).toBe(0);
      expect(runCalls.length).toBe(0);
    });

    it('omission of Reference Lab manifest strictly blocks operational execution before engine check (ZERO calls)', async () => {
      const { adapter, checkCalls, runCalls } = createMockK6Adapter({
        checkVersionError: new Error('Binary check should NEVER be called on missing Reference Lab manifest!')
      });

      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'missing-lab-manifest-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        // referenceLabManifest explicitly omitted!
        k6Adapter: adapter
      });

      expect(result.operationalStatus).toBe('PREFLIGHT_BLOCKED');
      expect(result.issues[0].code).toBe('REFERENCE_LAB_MANIFEST_MISSING');
      expect(checkCalls.length).toBe(0);
      expect(runCalls.length).toBe(0);
    });

    it('ephemeral credentials are never persisted in raw logs or cleartext manifests', async () => {
      const ephemeralToken = generateEphemeralCheckoutToken();
      const { adapter } = createMockK6Adapter({
        onRun: (inv) => {
          // Verify that the ephemeral token was passed in env and arguments
          expect(inv.env[testDef.credentials[0].referenceId]).toBe(ephemeralToken);
          expect(inv.args.some((a) => a.includes(ephemeralToken))).toBe(true);
          // Write a log line that simulated echoing the token
          fs.writeFileSync(
            inv.stdoutLogPath,
            `Running k6 with token ${ephemeralToken} for authorization\n`,
            'utf8'
          );
        }
      });

      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'credentials-security-test');
      // Redacting in stream should redact the token
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        ephemeralToken,
        k6Adapter: adapter
      });

      // Manifest on disk must NOT contain the cleartext token
      const manifestPath = path.join(outDir, 'execution-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifestText = fs.readFileSync(manifestPath, 'utf8');
      expect(manifestText).not.toContain(ephemeralToken);

      // Credential entry in manifest must be masked
      expect(result.credentials[0].referenceId).toBe('RETAILCO_CHECKOUT_AUTH_TOKEN');
      expect(result.credentials[0].maskedValue).toBe('***REDACTED_EPHEMERAL***');
    });

    it('execution manifest cannot claim completed without required raw evidence', async () => {
      const { adapter } = createMockK6Adapter();
      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'missing-raw-evidence-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        k6Adapter: adapter,
        omitRawSummaryForTest: true
      });

      expect(result.operationalStatus).toBe('EXECUTION_ENGINE_FAILED');
      expect(result.issues.some((i) => i.code === 'MISSING_RAW_EVIDENCE')).toBe(true);
    });

    it('enforces canonical raw-evidence completeness across all artifacts and metrics', async () => {
      const { adapter } = createMockK6Adapter();
      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'canonical-evidence-complete-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        executionMode: 'CANONICAL',
        k6Adapter: adapter
      });

      expect(result.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(result.rawArtefacts.summaryJson).toBeDefined();
      expect(result.rawArtefacts.stdoutLog).toBeDefined();
      expect(result.rawArtefacts.stderrLog).toBeDefined();
      expect(result.rawArtefacts.configJson).toBeDefined();
      expect(result.rawArtefacts.journeysJs).toBeDefined();
      expect(result.rawArtefacts.entrypointJs).toBeDefined();
      expect(result.rawArtefacts.runtimeJs).toBeDefined();
      expect(result.referenceLabMetrics.before).toBeDefined();
      expect(result.referenceLabMetrics.after).toBeDefined();
      expect(result.referenceLabMetrics.delta).toBeDefined();
    });

    it('canonical execution strictly halts on pre-run metrics failure without synthesizing zero evidence', async () => {
      const { adapter, runCalls } = createMockK6Adapter();
      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'canonical-pre-metrics-failed-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        executionMode: 'CANONICAL',
        forcePreMetricsFailureForTest: true,
        k6Adapter: adapter
      });

      expect(result.operationalStatus).toBe('EXECUTION_ENGINE_FAILED');
      expect(result.issues.some((i) => i.code === 'PRE_METRICS_FETCH_FAILED')).toBe(true);
      expect(runCalls.length).toBe(0); // Proves k6 was NOT launched!
      expect(result.referenceLabMetrics.before).toBeUndefined(); // Proves zero evidence was NOT synthesized!
    });

    it('run bindings faithfully record all contract, definition, and runtime fingerprints with zero fallbacks', async () => {
      const { adapter } = createMockK6Adapter();
      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'fingerprint-binding-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        k6Adapter: adapter
      });

      expect(result.pecpBinding.sourceContractId).toBe(RETAILCO_M3_APPROVED_CONTRACT.id);
      expect(result.pecpBinding.sourceContractFingerprint).toBe(testDef.sourceContractFingerprint);
      expect(result.pecpBinding.testDefinitionId).toBe(testDef.id);
      expect(result.pecpBinding.testDefinitionFingerprint).toBe(testDef.fingerprint);
      expect(result.pecpBinding.bundleFingerprint).toBe(bundle.fingerprint);
      expect(result.pecpBinding.runtimeSourceId).toBe('pecp-stable-k6-runtime-v1.0.0');
      expect(result.pecpBinding.schedulerArrival.peakRate).toBe(109.375);
      expect(result.pecpBinding.businessAttainment.targetValue).toBe(8.75);
    });

    it('raw results are strictly NOT evaluated as PASS/FAIL/INCONCLUSIVE (Section 2 & 10)', async () => {
      const { adapter } = createMockK6Adapter();
      const probe = await probeReferenceLab(baseUrl);
      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });

      const outDir = path.join(workDir, 'verdict-boundary-test');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        k6Adapter: adapter
      });

      expect(result.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
      expect(result.verdictDisclaimer).toContain('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
      expect((result as any).verdict).toBeUndefined();
      expect((result as any).pass).toBeUndefined();
      expect((result as any).statusVerdict).toBeUndefined();
    });
  });

  describe('4. Reference Lab Lifecycle & Injected Orchestration (Section 5, 8, 9)', () => {
    it('executes harness orchestration against Reference Lab and captures metrics delta', async () => {
      const probe = await probeReferenceLab(baseUrl);
      expect(probe.isResolvable).toBe(true);
      expect(probe.healthStatus).toBe('healthy');
      expect(probe.readyStatus).toBe('ready');

      // Verify lab is configured with shared ephemeral token
      const readyRes = await fetch(`${baseUrl}/ready`);
      const readyJson = await readyRes.json();
      expect(readyJson.authConfigured).toBe(true);

      const { adapter } = createMockK6Adapter({
        onRun: async () => {
          // Simulate k6 making authenticated checkout request to Reference Lab
          await sendHttpJson(
            `${baseUrl}/api/v1/orders/checkout`,
            'POST',
            {
              basketId: 'bask-syn-101',
              paymentMethod: 'synthetic_card_token_v1',
              shippingAddressId: 'addr-syn-999'
            },
            {
              Authorization: `Bearer ${sharedEphemeralToken}`
            }
          );
        }
      });

      const preflight = buildExecutionPreflightManifest({
        testDefinition: testDef,
        bundle,
        referenceLabManifest: labManifest,
        sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
        targetProbe: probe,
        preflightTimestamp: '2026-09-18T10:30:00Z',
        liveExecutionStarted: false
      });
      expect(preflight.status).toBe('READY_FOR_LIVE_EXECUTION');

      const outDir = path.join(workDir, 'orchestration-e2e-run');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        referenceLabManifest: labManifest,
        ephemeralToken: sharedEphemeralToken,
        k6Adapter: adapter
      });

      expect(result.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(result.k6ExitCode).toBe(0);

      // Raw artifacts check
      expect(result.rawArtefacts.summaryJson).toBeDefined();
      expect(result.rawArtefacts.stdoutLog).toBeDefined();
      expect(result.rawArtefacts.stderrLog).toBeDefined();
      expect(result.rawArtefacts.entrypointJs).toBeDefined();

      expect(fs.existsSync(result.rawArtefacts.summaryJson!.path)).toBe(true);
      expect(fs.existsSync(result.rawArtefacts.stdoutLog!.path)).toBe(true);

      // Reference Lab metrics delta
      expect(result.referenceLabMetrics.delta).toBeDefined();
      const delta = result.referenceLabMetrics.delta!;
      expect(delta.totalRequests).toBeGreaterThan(0);
      expect(delta.orderCreatedEvents).toBeGreaterThanOrEqual(1);

      // Business attainment events observed
      expect(result.businessAttainment.metric).toBe('orders');
      expect(result.businessAttainment.targetArrivalRate).toBe(8.75);
      expect(result.businessAttainment.orderCreatedEventsObserved).toBeGreaterThanOrEqual(1);

      // Machine-readable manifest on disk
      const manifestPath = path.join(outDir, 'execution-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const onDiskManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(onDiskManifest.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(onDiskManifest.engine.version).toBe(PINNED_K6_VERSION_EXPECTED);
      expect(onDiskManifest.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
    });
  });
});
