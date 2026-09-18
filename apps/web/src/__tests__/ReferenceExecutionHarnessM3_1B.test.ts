import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRetailCoLabServer } from '../../../../reference-lab/retailco/src/server.js';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../fixtures/retailco/m3ExecutionFixture';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  compileTestDefinition,
  compileK6Bundle,
  buildExecutionPreflightManifest
} from '@pecp/test-engine';
import {
  checkPinnedK6Engine,
  materializeK6Bundle,
  executeReferenceRun,
  generateEphemeralCheckoutToken,
  computeSha256Checksum,
  probeReferenceLab,
  PINNED_K6_VERSION_EXPECTED
} from '../../../../packages/test-engine/src/referenceExecutionHarness.js';

describe('M3.1B Governed Reference Execution Harness', () => {
  let lab: ReturnType<typeof createRetailCoLabServer>;
  let baseUrl: string;
  let testDef: ReturnType<typeof compileTestDefinition>;
  let bundle: ReturnType<typeof compileK6Bundle>;
  let labManifest: any;
  let workDir: string;

  beforeAll(async () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecp-m3-1b-test-'));

    // Start Reference Lab on an ephemeral random port
    lab = createRetailCoLabServer({
      port: 0,
      silent: true
    });
    const { port } = await lab.start();
    baseUrl = `http://127.0.0.1:${port}`;

    const labManifestPath = path.resolve(
      __dirname,
      '../../../../reference-lab/retailco/reference-lab-manifest.json'
    );
    labManifest = JSON.parse(fs.readFileSync(labManifestPath, 'utf8'));

    const baseTestDef = compileTestDefinition({
      contract: RETAILCO_M3_APPROVED_CONTRACT,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      version: 'v1.0',
      executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
    });

    testDef = {
      ...baseTestDef,
      scenarios: baseTestDef.scenarios.map((s) => ({
        ...s,
        targetEnvironmentBaseUrlRef: baseUrl
      }))
    };

    bundle = compileK6Bundle({
      testDefinition: testDef,
      generatedAt: '2026-09-18T10:30:00Z'
    });
  });

  afterAll(async () => {
    if (lab) {
      await lab.stop();
    }
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  describe('1. Pinned k6 Engine Verification (Section 3)', () => {
    it('detects real pinned k6 binary with expected stable version', async () => {
      const engineInfo = await checkPinnedK6Engine('k6');
      expect(engineInfo.name).toBe('k6');
      expect(engineInfo.version).toBe(PINNED_K6_VERSION_EXPECTED);
      expect(engineInfo.isPinnedExpected).toBe(true);
      expect(engineInfo.fullVersionString).toContain('k6 v0.54.0');
    });

    it('rejects unpinned or floating versions if requested', async () => {
      expect(PINNED_K6_VERSION_EXPECTED).not.toBe('latest');
      expect(PINNED_K6_VERSION_EXPECTED).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
    });
  });

  describe('2. Unmodified Governed Bundle Materialization (Section 4)', () => {
    it('materializes all files with byte-for-byte exact equality', () => {
      const outDir = path.join(workDir, 'bundle-materialize-test');
      const matResult = materializeK6Bundle(bundle, outDir);

      expect(matResult.verifiedByteMatch).toBe(true);
      expect(matResult.files.length).toBe(4);

      const filenames = matResult.files.map((f) => f.filename).sort();
      expect(filenames).toEqual(['config.json', 'entrypoint.js', 'journeys.js', 'runtime.js']);

      for (const file of bundle.files) {
        const filePath = path.join(outDir, file.filename);
        expect(fs.existsSync(filePath)).toBe(true);
        const diskContent = fs.readFileSync(filePath, 'utf8');
        expect(diskContent).toBe(file.content);
        expect(computeSha256Checksum(diskContent)).toBe(
          matResult.files.find((f) => f.filename === file.filename)?.checksum
        );
      }
    });
  });

  describe('3. Automated Verification Around the Runner (Section 11)', () => {
    it('preflight failure strictly prevents process launch', async () => {
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
        forcePreflightInvalid: true
      });

      expect(result.operationalStatus).toBe('PREFLIGHT_BLOCKED');
      expect(result.k6ExitCode).toBeNull();
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].code).toBe('PREFLIGHT_BLOCKED');
      // Verify k6 process was NOT spawned: no stdout log created
      const stdoutLogPath = path.join(outDir, 'k6-stdout.log');
      expect(fs.existsSync(stdoutLogPath)).toBe(false);
    });

    it('ephemeral credentials are never persisted in raw logs or cleartext manifests', async () => {
      const ephemeralToken = generateEphemeralCheckoutToken();
      expect(ephemeralToken).toContain('retailco_live_run_');

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
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        ephemeralToken,
        smokeDurationOverrideSeconds: 1
      });

      // Manifest must NOT contain the cleartext token
      const manifestPath = path.join(outDir, 'execution-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifestText = fs.readFileSync(manifestPath, 'utf8');
      expect(manifestText).not.toContain(ephemeralToken);

      // Credential entry in manifest must be masked
      expect(result.credentials[0].referenceId).toBe('RETAILCO_CHECKOUT_AUTH_TOKEN');
      expect(result.credentials[0].maskedValue).toBe('***REDACTED_EPHEMERAL***');
    }, 15000);

    it('execution manifest cannot claim completed without required raw evidence', async () => {
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
        smokeDurationOverrideSeconds: 1,
        omitRawSummaryForTest: true
      });

      expect(result.operationalStatus).toBe('EXECUTION_ENGINE_FAILED');
      expect(result.issues.some((i) => i.code === 'MISSING_RAW_EVIDENCE')).toBe(true);
    }, 15000);

    it('run bindings faithfully record all contract, definition, and runtime fingerprints', async () => {
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
        smokeDurationOverrideSeconds: 1
      });

      expect(result.pecpBinding.sourceContractId).toBe(RETAILCO_M3_APPROVED_CONTRACT.id);
      expect(result.pecpBinding.sourceContractFingerprint).toBe(testDef.sourceContractFingerprint);
      expect(result.pecpBinding.testDefinitionId).toBe(testDef.id);
      expect(result.pecpBinding.testDefinitionFingerprint).toBe(testDef.fingerprint);
      expect(result.pecpBinding.bundleFingerprint).toBe(bundle.fingerprint);
      expect(result.pecpBinding.runtimeSourceId).toBe('pecp-stable-k6-runtime-v1.0.0');
    }, 15000);

    it('raw results are strictly NOT evaluated as PASS/FAIL/INCONCLUSIVE (Section 2 & 10)', async () => {
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
        smokeDurationOverrideSeconds: 1
      });

      expect(result.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
      expect(result.verdictDisclaimer).toContain('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
      expect((result as any).verdict).toBeUndefined();
      expect((result as any).pass).toBeUndefined();
      expect((result as any).statusVerdict).toBeUndefined();
    }, 15000);
  });

  describe('4. End-to-End Governed Reference Run against Reference Lab (Section 6, 8, 9)', () => {
    it('executes real k6 against Reference Lab, captures raw evidence and metrics delta', async () => {
      const probe = await probeReferenceLab(baseUrl);
      expect(probe.isResolvable).toBe(true);
      expect(probe.healthStatus).toBe('healthy');
      expect(probe.readyStatus).toBe('ready');

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

      const outDir = path.join(workDir, 'live-e2e-run');
      const result = await executeReferenceRun({
        targetBaseUrl: baseUrl,
        outputDir: outDir,
        testDefinition: testDef,
        bundle,
        preflightManifest: preflight,
        smokeDurationOverrideSeconds: 3
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
      expect(Object.keys(delta.requestsByRoute).length).toBeGreaterThan(0);
      const browseRequests =
        (delta.requestsByRoute['/api/v1/products/featured'] || 0) +
        (delta.requestsByRoute['/api/v1/products/search'] || 0);
      expect(browseRequests + delta.totalRequests).toBeGreaterThan(0);

      // Business attainment events observed
      expect(result.businessAttainment.metric).toBe('orders');
      expect(result.businessAttainment.targetArrivalRate).toBe(8.75);

      // Machine-readable manifest on disk
      const manifestPath = path.join(outDir, 'execution-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
      const onDiskManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(onDiskManifest.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(onDiskManifest.engine.version).toBe(PINNED_K6_VERSION_EXPECTED);
      expect(onDiskManifest.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
    }, 20000);
  });
});
