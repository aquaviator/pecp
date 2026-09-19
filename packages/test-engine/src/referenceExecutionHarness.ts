import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  K6ExecutionBundle,
  TestDefinition,
  PerformanceContract
} from '@pecp/pe-domain';
import {
  ExecutionPreflightManifest,
  TargetProbeResult,
  PreflightValidationContext,
  validateExecutionPreflightManifest
} from './preflightCompiler.js';

const execFileAsync = promisify(execFile);

export const PINNED_K6_VERSION_EXPECTED = '0.54.0';

export interface PinnedK6EngineInfo {
  name: 'k6';
  version: string;
  fullVersionString: string;
  isPinnedExpected: boolean;
  binaryPath: string;
}

export interface MaterializedFile {
  filename: string;
  path: string;
  sizeBytes: number;
  checksum: string;
}

export interface MaterializationResult {
  targetDir: string;
  files: MaterializedFile[];
  bundleFingerprint: string;
  verifiedByteMatch: boolean;
}

export interface ReferenceLabMetricsSnapshot {
  requestCountsByRoute: Record<string, number>;
  statusCounts: Record<string, number>;
  businessAttainmentEvents: {
    order_created: number;
  };
  totalRequests: number;
  capturedAt: string;
}

export interface ReferenceLabMetricsDelta {
  totalRequests: number;
  requestsByRoute: Record<string, number>;
  statusCounts: Record<string, number>;
  orderCreatedEvents: number;
  durationSeconds: number;
}

export interface K6ProcessInvocation {
  binaryPath: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  stdoutLogPath: string;
  stderrLogPath: string;
  summaryJsonPath: string;
  redactedToken?: string;
}

export interface K6ProcessResult {
  exitCode: number | null;
  error?: Error;
}

export interface K6ExecutionAdapter {
  checkVersion: (binaryPath?: string) => Promise<PinnedK6EngineInfo>;
  runK6: (invocation: K6ProcessInvocation) => Promise<K6ProcessResult>;
}

export const defaultK6ExecutionAdapter: K6ExecutionAdapter = {
  checkVersion: async (binaryPath = 'k6') => {
    return checkPinnedK6Engine(binaryPath);
  },
  runK6: async (invocation: K6ProcessInvocation) => {
    const stdoutStream = fs.createWriteStream(invocation.stdoutLogPath, { flags: 'w' });
    const stderrStream = fs.createWriteStream(invocation.stderrLogPath, { flags: 'w' });
    const redactedToken = invocation.redactedToken;

    return new Promise<K6ProcessResult>((resolve) => {
      try {
        const child = spawn(invocation.binaryPath, invocation.args, {
          cwd: invocation.cwd,
          env: invocation.env
        });

        child.stdout.on('data', (data) => {
          const text = redactedToken
            ? data.toString().split(redactedToken).join('***REDACTED_EPHEMERAL***')
            : data.toString();
          stdoutStream.write(text);
        });

        child.stderr.on('data', (data) => {
          const text = redactedToken
            ? data.toString().split(redactedToken).join('***REDACTED_EPHEMERAL***')
            : data.toString();
          stderrStream.write(text);
        });

        child.on('error', (err) => {
          stderrStream.write(`\nChild process spawn error: ${err.message}\n`);
          stdoutStream.end();
          stderrStream.end();
          resolve({ exitCode: null, error: err });
        });

        child.on('close', (code) => {
          stdoutStream.end();
          stderrStream.end();
          resolve({ exitCode: code });
        });
      } catch (err: any) {
        stdoutStream.end();
        stderrStream.end();
        resolve({ exitCode: null, error: err });
      }
    });
  }
};

export interface ReferenceExecutionOptions {
  targetBaseUrl?: string;
  outputDir: string;
  testDefinition: TestDefinition;
  bundle: K6ExecutionBundle;
  preflightManifest: ExecutionPreflightManifest;
  referenceLabManifest?: {
    version: string;
    service: string;
    routes?: any[];
  };
  sourceContract?: PerformanceContract;
  k6Binary?: string;
  k6Adapter?: K6ExecutionAdapter;
  ephemeralToken?: string;
  commitSha?: string;
  runId?: string;
  smokeDurationOverrideSeconds?: number;
  executionMode?: 'CANONICAL' | 'SMOKE_DIAGNOSTIC';
  forcePreflightInvalid?: boolean;
  omitRawSummaryForTest?: boolean;
}

export interface ReferenceExecutionResult {
  runId: string;
  executionMode: 'CANONICAL' | 'SMOKE_DIAGNOSTIC';
  operationalStatus:
    | 'EXECUTION_COMPLETED'
    | 'EXECUTION_ENGINE_FAILED'
    | 'TARGET_UNAVAILABLE'
    | 'PREFLIGHT_BLOCKED';
  commitSha: string;
  timestamps: {
    startedAt: string;
    completedAt: string;
    durationSeconds: number;
  };
  engine: PinnedK6EngineInfo;
  target: {
    baseUrl: string;
    probeResult?: TargetProbeResult;
  };
  pecpBinding: {
    sourceContractId: string;
    sourceContractVersion: string;
    sourceContractFingerprint: string;
    sourceContractStatus: string;
    testDefinitionId: string;
    testDefinitionVersion: string;
    testDefinitionFingerprint: string;
    bundleFingerprint: string;
    runtimeVersion: string;
    runtimeSourceId: string;
    schedulerArrival: {
      population: string;
      peakRate: number;
      unit: string;
    };
    businessAttainment: {
      metric: string;
      targetValue: number;
      unit: string;
    };
  };
  preflight: {
    manifestTimestamp: string;
    status: string;
    isValid: boolean;
    blockingReasons: string[];
  };
  credentials: Array<{
    referenceId: string;
    purpose: string;
    provider: string;
    injectedAs: string;
    maskedValue: string;
  }>;
  materializedFiles: MaterializedFile[];
  k6ExitCode: number | null;
  rawArtefacts: {
    summaryJson?: { path: string; checksum: string; sizeBytes: number };
    stdoutLog?: { path: string; checksum: string; sizeBytes: number };
    stderrLog?: { path: string; checksum: string; sizeBytes: number };
    configJson?: { path: string; checksum: string; sizeBytes: number };
    journeysJs?: { path: string; checksum: string; sizeBytes: number };
    entrypointJs?: { path: string; checksum: string; sizeBytes: number };
    runtimeJs?: { path: string; checksum: string; sizeBytes: number };
  };
  referenceLabMetrics: {
    before?: ReferenceLabMetricsSnapshot;
    after?: ReferenceLabMetricsSnapshot;
    delta?: ReferenceLabMetricsDelta;
  };
  businessAttainment: {
    metric: string;
    orderCreatedEventsObserved: number;
    targetArrivalRate: number;
  };
  performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED';
  verdictDisclaimer: string;
  issues: Array<{ code: string; message: string }>;
}

/**
 * Computes deterministic SHA-256 hex checksum.
 */
export function computeSha256Checksum(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generates an ephemeral cryptographically random checkout authorization token.
 * Never to be logged or persisted in cleartext.
 */
export function generateEphemeralCheckoutToken(): string {
  const entropy = crypto.randomBytes(24).toString('hex');
  return `retailco_live_run_${Date.now()}_${entropy}`;
}

/**
 * Validates pinned k6 binary installation and retrieves version info.
 */
export async function checkPinnedK6Engine(binaryPath = 'k6'): Promise<PinnedK6EngineInfo> {
  try {
    const { stdout } = await execFileAsync(binaryPath, ['version']);
    const raw = stdout.trim();
    // Parse k6 v0.54.0 (commit/..., ...)
    const match = raw.match(/k6\s+v?([0-9]+\.[0-9]+\.[0-9]+)/i);
    const version = match ? match[1] : 'unknown';
    const isPinnedExpected = version === PINNED_K6_VERSION_EXPECTED;

    return {
      name: 'k6',
      version,
      fullVersionString: raw,
      isPinnedExpected,
      binaryPath
    };
  } catch (err: any) {
    throw new Error(`Pinned k6 engine check failed at "${binaryPath}": ${err.message || String(err)}`);
  }
}

/**
 * Materializes k6 execution bundle to target directory with byte-level equality validation.
 */
export function materializeK6Bundle(
  bundle: K6ExecutionBundle,
  targetDir: string
): MaterializationResult {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const materializedFiles: MaterializedFile[] = [];

  for (const file of bundle.files) {
    const filePath = path.join(targetDir, file.filename);
    fs.writeFileSync(filePath, file.content, 'utf8');

    // Read back and assert byte-for-byte exact equality
    const readBack = fs.readFileSync(filePath, 'utf8');
    if (readBack !== file.content) {
      throw new Error(
        `Materialization integrity violation: File "${file.filename}" does not match compiler output byte-for-byte.`
      );
    }

    const sizeBytes = Buffer.byteLength(readBack, 'utf8');
    const checksum = computeSha256Checksum(readBack);

    materializedFiles.push({
      filename: file.filename,
      path: filePath,
      sizeBytes,
      checksum
    });
  }

  return {
    targetDir,
    files: materializedFiles,
    bundleFingerprint: bundle.fingerprint,
    verifiedByteMatch: true
  };
}

/**
 * Performs HTTP GET request and returns text + status code.
 */
function fetchHttp(urlStr: string, timeoutMs = 4000): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.get(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        timeout: timeoutMs
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP request timed out after ${timeoutMs}ms: ${urlStr}`));
    });
    req.on('error', reject);
  });
}

/**
 * Probes the Reference Lab /health and /ready endpoints.
 */
export async function probeReferenceLab(baseUrl: string): Promise<TargetProbeResult> {
  const verifiedAt = new Date().toISOString();
  try {
    const healthRes = await fetchHttp(`${baseUrl}/health`);
    const readyRes = await fetchHttp(`${baseUrl}/ready`);

    const healthOk = healthRes.statusCode === 200;
    const readyOk = readyRes.statusCode === 200;

    let healthStatus = 'unreachable';
    let readyStatus = 'unreachable';

    if (healthOk) {
      try {
        const json = JSON.parse(healthRes.body);
        healthStatus = json.status || 'healthy';
      } catch {
        healthStatus = 'healthy';
      }
    }

    if (readyOk) {
      try {
        const json = JSON.parse(readyRes.body);
        readyStatus = json.status || 'ready';
      } catch {
        readyStatus = 'ready';
      }
    }

    return {
      baseUrl,
      verifiedAt,
      healthStatus,
      readyStatus,
      isResolvable: healthOk && readyOk,
      httpStatusHealth: healthRes.statusCode,
      httpStatusReady: readyRes.statusCode
    };
  } catch {
    return {
      baseUrl,
      verifiedAt,
      healthStatus: 'unreachable',
      readyStatus: 'unreachable',
      isResolvable: false,
      httpStatusHealth: 0,
      httpStatusReady: 0
    };
  }
}

/**
 * Queries Reference Lab metrics endpoint.
 */
export async function queryReferenceLabMetrics(baseUrl: string): Promise<ReferenceLabMetricsSnapshot> {
  const capturedAt = new Date().toISOString();
  const res = await fetchHttp(`${baseUrl}/api/v1/metrics`);
  if (res.statusCode !== 200) {
    throw new Error(`Reference Lab metrics returned HTTP ${res.statusCode}: ${res.body}`);
  }

  const json = JSON.parse(res.body);
  const requestCountsByRoute = json.requestCounts || json.requestCountsByRoute || {};
  const statusCounts = json.statusCounts || {};
  const businessAttainmentEvents = json.businessAttainmentEvents || { order_created: 0 };

  const totalRequests = Object.values(statusCounts).reduce((acc: number, val: any) => acc + Number(val || 0), 0);

  return {
    requestCountsByRoute,
    statusCounts,
    businessAttainmentEvents: {
      order_created: Number(businessAttainmentEvents.order_created || 0)
    },
    totalRequests,
    capturedAt
  };
}

/**
 * Computes Reference Lab metrics delta.
 */
export function computeReferenceLabMetricsDelta(
  before: ReferenceLabMetricsSnapshot,
  after: ReferenceLabMetricsSnapshot
): ReferenceLabMetricsDelta {
  const durationSeconds = Math.max(
    0,
    (new Date(after.capturedAt).getTime() - new Date(before.capturedAt).getTime()) / 1000
  );

  const deltaRequestsByRoute: Record<string, number> = {};
  const allRoutes = new Set([
    ...Object.keys(before.requestCountsByRoute),
    ...Object.keys(after.requestCountsByRoute)
  ]);
  for (const route of allRoutes) {
    const b = before.requestCountsByRoute[route] || 0;
    const a = after.requestCountsByRoute[route] || 0;
    deltaRequestsByRoute[route] = Math.max(0, a - b);
  }

  const deltaStatusCounts: Record<string, number> = {};
  const allStatuses = new Set([
    ...Object.keys(before.statusCounts),
    ...Object.keys(after.statusCounts)
  ]);
  for (const st of allStatuses) {
    const b = before.statusCounts[st] || 0;
    const a = after.statusCounts[st] || 0;
    deltaStatusCounts[st] = Math.max(0, a - b);
  }

  const orderCreatedEvents = Math.max(
    0,
    after.businessAttainmentEvents.order_created - before.businessAttainmentEvents.order_created
  );

  const totalRequests = Math.max(0, after.totalRequests - before.totalRequests);

  return {
    totalRequests,
    requestsByRoute: deltaRequestsByRoute,
    statusCounts: deltaStatusCounts,
    orderCreatedEvents,
    durationSeconds
  };
}

/**
 * Executes a governed reference run using the pinned k6 engine and Reference Lab.
 * Order of Authority (M3.1B.1):
 *   1. Preflight Validation Gate (Blocks first, before any engine evaluation or process launch)
 *   2. Target Environment Resolvability
 *   3. Pinned Engine Verification (checks pinned version, fails if unavailable or unpinned)
 *   4. Bundle Materialization & Engine Execution
 */
export async function executeReferenceRun(
  options: ReferenceExecutionOptions
): Promise<ReferenceExecutionResult> {
  const startedAt = new Date().toISOString();
  const startTimeMs = Date.now();
  const runId = options.runId || `run-pecp-reference-${Date.now()}`;
  const commitSha = options.commitSha || process.env.GITHUB_SHA || 'UNAVAILABLE';
  const adapter = options.k6Adapter || defaultK6ExecutionAdapter;
  const k6Binary = options.k6Binary || 'k6';

  const executionMode: 'CANONICAL' | 'SMOKE_DIAGNOSTIC' =
    options.smokeDurationOverrideSeconds !== undefined
      ? 'SMOKE_DIAGNOSTIC'
      : (options.executionMode || 'CANONICAL');

  const issues: Array<{ code: string; message: string }> = [];

  // 0. Bindings extracted strictly from preflightManifest, testDefinition, and bundle (zero hardcoded project fallbacks)
  const targetBaseUrl =
    options.targetBaseUrl ||
    options.preflightManifest?.targetEnvironment?.defaultBaseUrl ||
    options.testDefinition?.scenarios?.[0]?.targetEnvironmentBaseUrlRef ||
    '';

  const sourceContractId =
    options.preflightManifest?.canonicalTestDefinition?.sourceContractId ||
    options.testDefinition?.sourceContractId ||
    '';
  const sourceContractVersion =
    options.preflightManifest?.canonicalTestDefinition?.sourceContractVersion ||
    options.testDefinition?.sourceContractVersion ||
    '';
  const sourceContractFingerprint =
    options.preflightManifest?.canonicalTestDefinition?.sourceContractFingerprint ||
    options.testDefinition?.sourceContractFingerprint ||
    '';
  const sourceContractStatus =
    options.preflightManifest?.canonicalTestDefinition?.sourceContractStatus ||
    options.testDefinition?.sourceContractStatus ||
    '';

  const testDefId = options.testDefinition?.id || '';
  const testDefVersion = options.testDefinition?.version || '';
  const testDefFingerprint = options.testDefinition?.fingerprint || '';
  const bundleFingerprint = options.bundle?.fingerprint || '';
  const runtimeVersion = options.bundle?.runtimeVersion || options.preflightManifest?.k6Runtime?.version || '';
  const runtimeSourceId = options.bundle?.runtimeSourceId || options.preflightManifest?.k6Runtime?.sourceId || '';

  const schedulerArrival = {
    population: options.preflightManifest?.governedWorkload?.schedulerArrivalPopulation || '',
    peakRate: options.preflightManifest?.governedWorkload?.schedulerPeakRate?.value ?? 0,
    unit: options.preflightManifest?.governedWorkload?.schedulerPeakRate?.unit || ''
  };

  const businessAttainment = {
    metric: options.preflightManifest?.governedWorkload?.businessWorkloadAttainment?.metric || '',
    targetValue: options.preflightManifest?.governedWorkload?.businessWorkloadAttainment?.targetValue ?? 0,
    unit: options.preflightManifest?.governedWorkload?.businessWorkloadAttainment?.unit || ''
  };

  const pecpBinding = {
    sourceContractId,
    sourceContractVersion,
    sourceContractFingerprint,
    sourceContractStatus,
    testDefinitionId: testDefId,
    testDefinitionVersion: testDefVersion,
    testDefinitionFingerprint: testDefFingerprint,
    bundleFingerprint,
    runtimeVersion,
    runtimeSourceId,
    schedulerArrival,
    businessAttainment
  };

  // Derive credentials directly from preflight manifest requiredReferences or test definition
  const rawCreds =
    options.preflightManifest?.credentialBindings?.requiredReferences ||
    options.testDefinition?.credentialReferences ||
    [];

  const credentials = rawCreds.map((b: any) => ({
    referenceId: b.referenceId,
    purpose: b.purpose,
    provider: b.provider,
    injectedAs: `TARGET_BASE_URL & k6 -e ${b.referenceId}`,
    maskedValue: '***REDACTED_EPHEMERAL***'
  }));

  // Assert target URL presence
  if (!targetBaseUrl) {
    return {
      runId,
      executionMode,
      operationalStatus: 'TARGET_UNAVAILABLE',
      commitSha,
      timestamps: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationSeconds: (Date.now() - startTimeMs) / 1000
      },
      engine: {
        name: 'k6',
        version: 'not-evaluated',
        fullVersionString: 'Target URL was not specified or bound.',
        isPinnedExpected: false,
        binaryPath: k6Binary
      },
      target: { baseUrl: '' },
      pecpBinding,
      preflight: {
        manifestTimestamp: options.preflightManifest?.preflightTimestamp || '',
        status: options.preflightManifest?.status || 'UNKNOWN',
        isValid: false,
        blockingReasons: ['TARGET_URL_MISSING']
      },
      credentials: [],
      materializedFiles: [],
      k6ExitCode: null,
      rawArtefacts: {},
      referenceLabMetrics: {},
      businessAttainment: {
        metric: businessAttainment.metric,
        orderCreatedEventsObserved: 0,
        targetArrivalRate: businessAttainment.targetValue
      },
      performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
      verdictDisclaimer:
        'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: Target URL missing. Preflight cannot proceed.',
      issues: [{ code: 'TARGET_UNAVAILABLE', message: 'Target environment URL is missing or not bound.' }]
    };
  }

  // 1. FIRST AUTHORITY: Preflight Gate Enforcement (Section 2)
  // Probe target for preflight context
  const probe = await probeReferenceLab(targetBaseUrl);
  const preflightContext: PreflightValidationContext = {
    testDefinition: options.testDefinition,
    bundle: options.bundle,
    referenceLabManifest: options.referenceLabManifest || {
      version: options.preflightManifest?.routeManifestVersion || '1.0.0',
      service: options.preflightManifest?.service || 'retailco-reference-lab'
    },
    sourceContract: options.sourceContract,
    targetProbe: probe,
    liveExecutionStarted: false
  };

  const preflightValidation = validateExecutionPreflightManifest(options.preflightManifest, preflightContext);

  const isPreflightBlocked =
    options.forcePreflightInvalid ||
    !preflightValidation.isValid ||
    options.preflightManifest.status !== 'READY_FOR_LIVE_EXECUTION';

  if (isPreflightBlocked) {
    const blockingReasons = options.forcePreflightInvalid
      ? ['FORCED_PREFLIGHT_FAILURE_TEST']
      : preflightValidation.issues.map((i) => i.description);

    // Notice: NO k6 engine check is performed when preflight blocks launch!
    return {
      runId,
      executionMode,
      operationalStatus: 'PREFLIGHT_BLOCKED',
      commitSha,
      timestamps: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationSeconds: (Date.now() - startTimeMs) / 1000
      },
      engine: {
        name: 'k6',
        version: 'not-evaluated',
        fullVersionString: 'Preflight validation blocked execution before engine check.',
        isPinnedExpected: false,
        binaryPath: k6Binary
      },
      target: {
        baseUrl: targetBaseUrl,
        probeResult: probe
      },
      pecpBinding,
      preflight: {
        manifestTimestamp: options.preflightManifest.preflightTimestamp,
        status: options.preflightManifest.status,
        isValid: false,
        blockingReasons
      },
      credentials,
      materializedFiles: [],
      k6ExitCode: null,
      rawArtefacts: {},
      referenceLabMetrics: {},
      businessAttainment: {
        metric: businessAttainment.metric,
        orderCreatedEventsObserved: 0,
        targetArrivalRate: businessAttainment.targetValue
      },
      performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
      verdictDisclaimer:
        'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: Preflight validation failure blocked process launch. Zero engine/process calls were made.',
      issues: blockingReasons.map((r) => ({ code: 'PREFLIGHT_BLOCKED', message: r }))
    };
  }

  // 2. SECOND AUTHORITY: Target Reachability Check
  if (!probe.isResolvable) {
    return {
      runId,
      executionMode,
      operationalStatus: 'TARGET_UNAVAILABLE',
      commitSha,
      timestamps: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationSeconds: (Date.now() - startTimeMs) / 1000
      },
      engine: {
        name: 'k6',
        version: 'not-evaluated',
        fullVersionString: 'Target unavailable blocked execution before engine check.',
        isPinnedExpected: false,
        binaryPath: k6Binary
      },
      target: {
        baseUrl: targetBaseUrl,
        probeResult: probe
      },
      pecpBinding,
      preflight: {
        manifestTimestamp: options.preflightManifest.preflightTimestamp,
        status: options.preflightManifest.status,
        isValid: true,
        blockingReasons: []
      },
      credentials,
      materializedFiles: [],
      k6ExitCode: null,
      rawArtefacts: {},
      referenceLabMetrics: {},
      businessAttainment: {
        metric: businessAttainment.metric,
        orderCreatedEventsObserved: 0,
        targetArrivalRate: businessAttainment.targetValue
      },
      performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
      verdictDisclaimer:
        'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: Target environment is unresolvable or unhealthy.',
      issues: [{ code: 'TARGET_UNAVAILABLE', message: `Target at ${targetBaseUrl} is unresolvable or unhealthy.` }]
    };
  }

  // 3. THIRD AUTHORITY: Pinned Engine Availability & Version Verification (Section 3, 4)
  let engineInfo: PinnedK6EngineInfo;
  try {
    engineInfo = await adapter.checkVersion(k6Binary);
  } catch (err: any) {
    return {
      runId,
      executionMode,
      operationalStatus: 'EXECUTION_ENGINE_FAILED',
      commitSha,
      timestamps: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationSeconds: (Date.now() - startTimeMs) / 1000
      },
      engine: {
        name: 'k6',
        version: 'unavailable',
        fullVersionString: err.message || String(err),
        isPinnedExpected: false,
        binaryPath: k6Binary
      },
      target: { baseUrl: targetBaseUrl, probeResult: probe },
      pecpBinding,
      preflight: {
        manifestTimestamp: options.preflightManifest.preflightTimestamp,
        status: options.preflightManifest.status,
        isValid: true,
        blockingReasons: []
      },
      credentials,
      materializedFiles: [],
      k6ExitCode: null,
      rawArtefacts: {},
      referenceLabMetrics: {},
      businessAttainment: {
        metric: businessAttainment.metric,
        orderCreatedEventsObserved: 0,
        targetArrivalRate: businessAttainment.targetValue
      },
      performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
      verdictDisclaimer:
        'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: Engine verification failed.',
      issues: [{ code: 'PINNED_K6_ENGINE_UNAVAILABLE', message: err.message || String(err) }]
    };
  }

  if (!engineInfo.isPinnedExpected) {
    return {
      runId,
      executionMode,
      operationalStatus: 'EXECUTION_ENGINE_FAILED',
      commitSha,
      timestamps: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationSeconds: (Date.now() - startTimeMs) / 1000
      },
      engine: engineInfo,
      target: { baseUrl: targetBaseUrl, probeResult: probe },
      pecpBinding,
      preflight: {
        manifestTimestamp: options.preflightManifest.preflightTimestamp,
        status: options.preflightManifest.status,
        isValid: true,
        blockingReasons: []
      },
      credentials,
      materializedFiles: [],
      k6ExitCode: null,
      rawArtefacts: {},
      referenceLabMetrics: {},
      businessAttainment: {
        metric: businessAttainment.metric,
        orderCreatedEventsObserved: 0,
        targetArrivalRate: businessAttainment.targetValue
      },
      performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
      verdictDisclaimer:
        'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: Engine version does not match pinned expected version.',
      issues: [{
        code: 'UNPINNED_K6_ENGINE',
        message: `Engine version "${engineInfo.version}" does not match pinned expected version "${PINNED_K6_VERSION_EXPECTED}".`
      }]
    };
  }

  // 4. FOURTH AUTHORITY: Ephemeral credential generation & Bundle materialization
  const ephemeralToken = options.ephemeralToken || generateEphemeralCheckoutToken();
  const materialization = materializeK6Bundle(options.bundle, options.outputDir);

  // 5. Pre-execution metrics snapshot (Section 9)
  let metricsBefore: ReferenceLabMetricsSnapshot;
  try {
    metricsBefore = await queryReferenceLabMetrics(targetBaseUrl);
  } catch (err: any) {
    metricsBefore = {
      requestCountsByRoute: {},
      statusCounts: {},
      businessAttainmentEvents: { order_created: 0 },
      totalRequests: 0,
      capturedAt: new Date().toISOString()
    };
    issues.push({ code: 'PRE_METRICS_FETCH_FAILED', message: err.message || String(err) });
  }

  // 6. Execute k6 via injected execution adapter
  const stdoutLogPath = path.join(options.outputDir, 'k6-stdout.log');
  const stderrLogPath = path.join(options.outputDir, 'k6-stderr.log');
  const summaryJsonPath = path.join(options.outputDir, 'summary.json');

  const k6Args = [
    'run',
    '--summary-export',
    summaryJsonPath,
    '-e',
    `TARGET_BASE_URL=${targetBaseUrl}`
  ];

  // Dynamically inject all derived credential references into k6 environment
  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    TARGET_BASE_URL: targetBaseUrl
  };
  for (const cred of rawCreds) {
    k6Args.push('-e', `${cred.referenceId}=${ephemeralToken}`);
    childEnv[cred.referenceId] = ephemeralToken;
  }

  if (options.smokeDurationOverrideSeconds) {
    k6Args.unshift('--duration', `${options.smokeDurationOverrideSeconds}s`);
  }

  k6Args.push(path.join(options.outputDir, 'entrypoint.js'));

  let k6ExitCode: number | null = null;
  try {
    const procResult = await adapter.runK6({
      binaryPath: k6Binary,
      args: k6Args,
      cwd: options.outputDir,
      env: childEnv,
      stdoutLogPath,
      stderrLogPath,
      summaryJsonPath,
      redactedToken: ephemeralToken
    });
    k6ExitCode = procResult.exitCode;
    if (procResult.error) {
      issues.push({ code: 'K6_EXECUTION_ERROR', message: procResult.error.message || String(procResult.error) });
    }
  } catch (err: any) {
    issues.push({ code: 'K6_EXECUTION_ERROR', message: err.message || String(err) });
  }

  // 7. Post-execution metrics snapshot
  let metricsAfter: ReferenceLabMetricsSnapshot;
  try {
    metricsAfter = await queryReferenceLabMetrics(targetBaseUrl);
  } catch (err: any) {
    metricsAfter = {
      requestCountsByRoute: {},
      statusCounts: {},
      businessAttainmentEvents: { order_created: 0 },
      totalRequests: 0,
      capturedAt: new Date().toISOString()
    };
    issues.push({ code: 'POST_METRICS_FETCH_FAILED', message: err.message || String(err) });
  }

  const metricsDelta = computeReferenceLabMetricsDelta(metricsBefore, metricsAfter);

  // 8. Inspect raw artefacts on disk
  if (options.omitRawSummaryForTest && fs.existsSync(summaryJsonPath)) {
    fs.unlinkSync(summaryJsonPath);
  }

  const rawArtefacts: ReferenceExecutionResult['rawArtefacts'] = {};

  if (fs.existsSync(summaryJsonPath)) {
    const buf = fs.readFileSync(summaryJsonPath);
    rawArtefacts.summaryJson = {
      path: summaryJsonPath,
      sizeBytes: buf.length,
      checksum: computeSha256Checksum(buf)
    };
  }

  if (fs.existsSync(stdoutLogPath)) {
    const buf = fs.readFileSync(stdoutLogPath);
    rawArtefacts.stdoutLog = {
      path: stdoutLogPath,
      sizeBytes: buf.length,
      checksum: computeSha256Checksum(buf)
    };
  }

  if (fs.existsSync(stderrLogPath)) {
    const buf = fs.readFileSync(stderrLogPath);
    rawArtefacts.stderrLog = {
      path: stderrLogPath,
      sizeBytes: buf.length,
      checksum: computeSha256Checksum(buf)
    };
  }

  for (const f of materialization.files) {
    if (f.filename === 'config.json') rawArtefacts.configJson = f;
    if (f.filename === 'journeys.js') rawArtefacts.journeysJs = f;
    if (f.filename === 'entrypoint.js') rawArtefacts.entrypointJs = f;
    if (f.filename === 'runtime.js') rawArtefacts.runtimeJs = f;
  }

  // 9. Security Audit: Ensure credential value is NEVER in logs or manifest files
  for (const p of [stdoutLogPath, stderrLogPath, summaryJsonPath]) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes(ephemeralToken)) {
        throw new Error(
          `SECURITY INVARIANT VIOLATION: Ephemeral credential was detected in artifact "${p}". Clearing file.`
        );
      }
    }
  }

  // Determine operational status
  const hasRequiredEvidence =
    rawArtefacts.summaryJson !== undefined &&
    rawArtefacts.stdoutLog !== undefined &&
    rawArtefacts.entrypointJs !== undefined;

  let operationalStatus: ReferenceExecutionResult['operationalStatus'];
  if (k6ExitCode === 0 && hasRequiredEvidence) {
    operationalStatus = 'EXECUTION_COMPLETED';
  } else {
    operationalStatus = 'EXECUTION_ENGINE_FAILED';
    if (!hasRequiredEvidence) {
      issues.push({
        code: 'MISSING_RAW_EVIDENCE',
        message: 'Required raw k6 summary or logs were not produced on disk.'
      });
    }
  }

  const completedAt = new Date().toISOString();
  const durationSeconds = (Date.now() - startTimeMs) / 1000;

  const result: ReferenceExecutionResult = {
    runId,
    executionMode,
    operationalStatus,
    commitSha,
    timestamps: {
      startedAt,
      completedAt,
      durationSeconds
    },
    engine: engineInfo,
    target: {
      baseUrl: targetBaseUrl,
      probeResult: probe
    },
    pecpBinding,
    preflight: {
      manifestTimestamp: options.preflightManifest.preflightTimestamp,
      status: options.preflightManifest.status,
      isValid: true,
      blockingReasons: []
    },
    credentials,
    materializedFiles: materialization.files,
    k6ExitCode,
    rawArtefacts,
    referenceLabMetrics: {
      before: metricsBefore,
      after: metricsAfter,
      delta: metricsDelta
    },
    businessAttainment: {
      metric: businessAttainment.metric,
      orderCreatedEventsObserved: metricsDelta.orderCreatedEvents,
      targetArrivalRate: businessAttainment.targetValue
    },
    performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
    verdictDisclaimer:
      'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: M3.1B is strictly an execution proof. No PECP PASS/FAIL/INCONCLUSIVE performance verdict is evaluated or assigned.',
    issues
  };

  // Write machine-readable execution manifest to output directory
  const manifestPath = path.join(options.outputDir, 'execution-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(result, null, 2), 'utf8');

  return result;
}
