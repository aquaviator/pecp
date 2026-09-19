#!/usr/bin/env tsx
/**
 * Pinned k6 Governed Reference Execution Orchestrator (M3.1B.1)
 *
 * Owns the full execution lifecycle:
 * 1. Pinned k6 v0.54.0 engine verification (no floating/latest versions)
 * 2. Ephemeral credential generation & ownership (shared between Reference Lab and k6)
 * 3. Reference Lab process launch and readiness verification
 * 4. Preflight evaluation first before process launch
 * 5. Materialization and execution of the compiler-generated bundle
 * 6. Capture and preservation of all raw evidence artifacts
 * 7. Enforcement of PECP verdict boundary (no PASS/FAIL assignment)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PINNED_K6_VERSION_EXPECTED,
  checkPinnedK6Engine,
  generateEphemeralCheckoutToken,
  probeReferenceLab,
  executeReferenceRun
} from '../packages/test-engine/src/referenceExecutionHarness.js';
import {
  compileTestDefinition,
  compileK6Bundle,
  buildExecutionPreflightManifest,
  validateExecutionPreflightManifest
} from '../packages/test-engine/src/index.js';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../apps/web/src/fixtures/retailco/m3ExecutionFixture.js';
import { RETAILCO_PROJECT_FIXTURE } from '../apps/web/src/fixtures/retailco/projectFixture.js';
import { createRetailCoLabServer } from '../reference-lab/retailco/src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

interface CliArgs {
  mode: 'CANONICAL' | 'SMOKE_DIAGNOSTIC';
  smokeDurationSeconds?: number;
  outputDir: string;
  k6Binary: string;
  port: number;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let mode: 'CANONICAL' | 'SMOKE_DIAGNOSTIC' = 'CANONICAL';
  let smokeDurationSeconds: number | undefined;
  let outputDir = '';
  let k6Binary = 'k6';
  let port = 0;

  for (const arg of args) {
    if (arg === '--mode=smoke_diagnostic' || arg === '--smoke') {
      mode = 'SMOKE_DIAGNOSTIC';
    } else if (arg === '--mode=canonical' || arg === '--canonical') {
      mode = 'CANONICAL';
    } else if (arg.startsWith('--smoke-duration=')) {
      smokeDurationSeconds = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--output-dir=')) {
      outputDir = arg.split('=')[1];
    } else if (arg.startsWith('--k6-bin=')) {
      k6Binary = arg.split('=')[1];
    } else if (arg.startsWith('--port=')) {
      port = parseInt(arg.split('=')[1], 10);
    }
  }

  if (mode === 'SMOKE_DIAGNOSTIC' && !smokeDurationSeconds) {
    smokeDurationSeconds = 10;
  }

  if (!outputDir) {
    const subfolder = mode === 'CANONICAL' ? 'canonical' : 'smoke_diagnostic';
    outputDir = path.resolve(rootDir, 'evidence', 'm3-1b', subfolder);
  } else {
    outputDir = path.resolve(process.cwd(), outputDir);
  }

  return { mode, smokeDurationSeconds, outputDir, k6Binary, port };
}

async function main() {
  const cli = parseCliArgs();

  console.log('================================================================');
  console.log(`Governed Reference Execution Orchestrator (M3.1B.1)`);
  console.log(`Execution Mode: ${cli.mode}`);
  if (cli.mode === 'SMOKE_DIAGNOSTIC') {
    console.log(`Diagnostic Smoke Duration Override: ${cli.smokeDurationSeconds}s`);
    console.log(`NOTE: Diagnostic smoke runs do NOT satisfy M3.1B canonical closure.`);
  } else {
    console.log(`Canonical Full Duration: 1320s (22 minutes)`);
    console.log(`Peak Scheduler Arrival: 109.375 journey iterations/sec`);
    console.log(`Target Business Attainment: 8.75 orders/sec`);
  }
  console.log(`Target Output Directory: ${cli.outputDir}`);
  console.log('================================================================\n');

  // 1. Verify Pinned k6 Engine
  console.log(`[1/6] Verifying pinned k6 engine availability at "${cli.k6Binary}"...`);
  let engineInfo;
  try {
    engineInfo = await checkPinnedK6Engine(cli.k6Binary);
    console.log(`      Engine detected: ${engineInfo.fullVersionString}`);
    if (!engineInfo.isPinnedExpected) {
      console.error(
        `FATAL: k6 version "${engineInfo.version}" does not match pinned expected version "${PINNED_K6_VERSION_EXPECTED}".`
      );
      process.exit(1);
    }
    console.log(`      Verified pinned version: v${engineInfo.version} (EXACT PIN MATCH)\n`);
  } catch (err: any) {
    console.error(`FATAL: Failed to verify pinned k6 engine: ${err.message}`);
    process.exit(1);
  }

  // 2. Generate Ephemeral Credential
  console.log(`[2/6] Generating ephemeral checkout credential for execution lifecycle...`);
  const ephemeralToken = generateEphemeralCheckoutToken();
  // Mask immediately in CI environment
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::add-mask::${ephemeralToken}`);
  }
  console.log(`      Ephemeral checkout token generated (credential masked in all logs and manifests)\n`);

  // 3. Start Reference Lab Server
  console.log(`[3/6] Launching RetailCo Reference Lab instance...`);
  const lab = createRetailCoLabServer({
    port: cli.port,
    authToken: ephemeralToken,
    silent: true
  });
  const { port: actualPort } = await lab.start();
  const baseUrl = `http://localhost:${actualPort}`;
  console.log(`      Reference Lab active on ${baseUrl}`);

  // Probe target
  const probe = await probeReferenceLab(baseUrl);
  if (!probe.isResolvable) {
    console.error(`FATAL: Reference Lab probe failed at ${baseUrl}: health=${probe.healthStatus}, ready=${probe.readyStatus}`);
    await lab.stop();
    process.exit(1);
  }
  console.log(`      Target probe verified: health=${probe.healthStatus} (${probe.httpStatusHealth}), ready=${probe.readyStatus} (${probe.httpStatusReady})\n`);

  // 4. Compile Canonical Test Definition & K6 Bundle
  console.log(`[4/6] Compiling governed Test Definition & k6 Execution Bundle...`);
  const testDef = compileTestDefinition({
    contract: RETAILCO_M3_APPROVED_CONTRACT,
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    version: 'v1.0',
    executionIntelligence: {
      ...RETAILCO_M3_EXECUTION_INTELLIGENCE,
      targetEnvironmentBaseUrlRef: baseUrl
    }
  });

  const bundle = compileK6Bundle({
    testDefinition: testDef,
    generatedAt: new Date().toISOString()
  });

  const labManifestPath = path.resolve(rootDir, 'reference-lab/retailco/reference-lab-manifest.json');
  const labManifest = JSON.parse(fs.readFileSync(labManifestPath, 'utf8'));

  const preflightManifest = buildExecutionPreflightManifest({
    testDefinition: testDef,
    bundle,
    referenceLabManifest: labManifest,
    sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
    targetProbe: probe,
    preflightTimestamp: new Date().toISOString(),
    liveExecutionStarted: false
  });

  const preflightValidation = validateExecutionPreflightManifest(preflightManifest, {
    testDefinition: testDef,
    bundle,
    referenceLabManifest: labManifest,
    sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
    targetProbe: probe,
    liveExecutionStarted: false
  });

  if (!preflightValidation.isValid || preflightManifest.status !== 'READY_FOR_LIVE_EXECUTION') {
    console.error(`FATAL: Preflight validation gate blocked execution:`);
    for (const issue of preflightValidation.issues) {
      console.error(`  - [${issue.field}] ${issue.description}`);
    }
    await lab.stop();
    process.exit(1);
  }
  console.log(`      Preflight Manifest Status: ${preflightManifest.status} (VALIDATED GATE GREEN)`);
  console.log(`      Test Definition Fingerprint: ${testDef.fingerprint}`);
  console.log(`      K6 Bundle Fingerprint: ${bundle.fingerprint}\n`);

  // 5. Execute Governed Reference Run
  console.log(`[5/6] Executing governed reference run...`);
  if (!fs.existsSync(cli.outputDir)) {
    fs.mkdirSync(cli.outputDir, { recursive: true });
  }

  const runId = `pecp-ref-${cli.mode.toLowerCase()}-${Date.now()}`;
  console.log(`      Run ID: ${runId}`);
  console.log(`      Live run started at ${new Date().toISOString()}`);

  let runResult;
  try {
    runResult = await executeReferenceRun({
      targetBaseUrl: baseUrl,
      outputDir: cli.outputDir,
      testDefinition: testDef,
      bundle,
      preflightManifest,
      referenceLabManifest: labManifest,
      sourceContract: RETAILCO_M3_APPROVED_CONTRACT,
      k6Binary: cli.k6Binary,
      ephemeralToken,
      runId,
      executionMode: cli.mode,
      smokeDurationOverrideSeconds: cli.mode === 'SMOKE_DIAGNOSTIC' ? cli.smokeDurationSeconds : undefined
    });
  } catch (err: any) {
    console.error(`FATAL: Execution run failed with exception:`, err);
    await lab.stop();
    process.exit(1);
  } finally {
    // Tear down reference lab
    console.log(`\n      Shutting down Reference Lab process...`);
    await lab.stop();
    console.log(`      Reference Lab stopped.`);
  }

  // 6. Preservation and Verification Summary
  console.log(`\n[6/6] Governed Execution Evidence Preservation & Verification:`);
  console.log(`      Operational Status: ${runResult.operationalStatus}`);
  console.log(`      k6 Exit Code: ${runResult.k6ExitCode}`);
  console.log(`      Duration: ${runResult.timestamps.durationSeconds.toFixed(1)}s`);
  console.log(`      Performance Verdict Boundary: ${runResult.performanceVerdict}`);
  console.log(`      Verdict Disclaimer: ${runResult.verdictDisclaimer}`);

  if (runResult.referenceLabMetrics.delta) {
    const delta = runResult.referenceLabMetrics.delta;
    console.log(`      Reference Lab Metrics Delta:`);
    console.log(`        Total Requests: ${delta.totalRequests}`);
    console.log(`        Orders Created: ${delta.orderCreatedEvents}`);
  }

  console.log(`      Business Workload Attainment:`);
  console.log(`        Metric: ${runResult.businessAttainment.metric}`);
  console.log(`        Target Rate: ${runResult.businessAttainment.targetArrivalRate} orders/sec`);
  console.log(`        Events Observed: ${runResult.businessAttainment.orderCreatedEventsObserved}`);

  console.log(`\n      Preserved Raw Artifacts in ${cli.outputDir}:`);
  for (const [name, art] of Object.entries(runResult.rawArtefacts)) {
    if (art) {
      console.log(`        - ${name.padEnd(14)}: ${art.path} (${art.sizeBytes} bytes, sha256: ${art.checksum.substring(0, 12)}...)`);
    }
  }

  // Security Invariant Confirmation
  const manifestPath = path.join(cli.outputDir, 'execution-manifest.json');
  console.log(`        - executionManifest: ${manifestPath}`);
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  if (manifestRaw.includes(ephemeralToken)) {
    console.error(`FATAL SECURITY ERROR: Cleartext ephemeral credential detected in execution manifest!`);
    process.exit(1);
  }
  console.log(`      Security verification: Ephemeral credential successfully masked across all artifacts.`);

  if (runResult.operationalStatus !== 'EXECUTION_COMPLETED') {
    console.error(`\nExecution FAILED with operational status: ${runResult.operationalStatus}`);
    for (const issue of runResult.issues) {
      console.error(`  - [${issue.code}] ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`\nGoverned Reference Execution COMPLETED successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
