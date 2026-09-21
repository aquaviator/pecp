import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  CanonicalExecutionResult,
  ExecutionRun,
  ExecutionRunArtifactReference,
  RawEvidenceInventory,
  RawEvidenceReference,
  RawEvidenceType,
  EvidencePresenceStatus,
  SchedulerExecutionObservation,
  BusinessEventsObservation,
  ReferenceLabCorroboration,
  WorkloadAttainmentObservation,
  ResultCompleteness,
  ResultDataQualityIssue,
  ResultDataQualityIssueCode,
  K6SummaryMetrics,
  ThresholdObservation
} from '@pecp/pe-domain';
import {
  INVARIANT_PERFORMANCE_VERDICT,
  INVARIANT_VERDICT_DISCLAIMER
} from '@pecp/pe-domain';
import { parseK6SummaryJson } from './k6SummaryParser.js';

export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export interface RawFileEntry {
  filename: string;
  content?: string | Buffer;
  path?: string;
  checksum?: string;
  sizeBytes?: number;
}

export interface IngestEvidenceInput {
  manifest: string | Buffer | Record<string, any>;
  summaryJson?: string | Buffer | Record<string, any>;
  stdoutLog?: string | Buffer | RawFileEntry;
  stderrLog?: string | Buffer | RawFileEntry;
  configJson?: string | Buffer | RawFileEntry;
  journeysJs?: string | Buffer | RawFileEntry;
  entrypointJs?: string | Buffer | RawFileEntry;
  runtimeJs?: string | Buffer | RawFileEntry;
  filesOnDisk?: Record<string, RawFileEntry>;
  artifactLocator?: string;
  executionArtifact?: ExecutionRunArtifactReference;
}

/**
 * Normalizes input to string/buffer/object.
 */
function parseJsonPayload(input: string | Buffer | Record<string, any>, contextName: string): any {
  if (typeof input === 'string' || Buffer.isBuffer(input)) {
    try {
      return JSON.parse(input.toString('utf8'));
    } catch (err: any) {
      throw new Error(`PARSER_INCOMPATIBILITY: Failed to parse ${contextName} JSON: ${err.message}`);
    }
  }
  if (input && typeof input === 'object') {
    return input;
  }
  throw new Error(`PARSER_INCOMPATIBILITY: ${contextName} is not a valid JSON payload or object`);
}

/**
 * Checks for credential patterns in text to verify NO_CREDENTIAL_LEAKAGE.
 */
function scanForCredentialLeakage(text: string): boolean {
  // Check for ephemeral token pattern: retailco_live_run_<timestamp>_<entropy>
  const liveTokenPattern = /retailco_live_run_\d+_[a-f0-9]{16,}/i;
  return liveTokenPattern.test(text);
}

/**
 * Deterministically ingests governed execution evidence and returns a CanonicalExecutionResult.
 * Invariant: Never assigns PASS, FAIL, PASS_WITH_OBSERVATION, or INCONCLUSIVE.
 */
export function ingestGovernedExecutionEvidence(input: IngestEvidenceInput): CanonicalExecutionResult {
  const issues: ResultDataQualityIssue[] = [];

  // 1. Manifest Ingestion
  let manifest: any;
  try {
    manifest = parseJsonPayload(input.manifest, 'execution-manifest');
  } catch (err: any) {
    issues.push({
      code: 'PARSER_INCOMPATIBILITY',
      severity: 'FATAL',
      message: err.message
    });
    manifest = {};
  }

  if (!manifest || Object.keys(manifest).length === 0) {
    issues.push({
      code: 'MISSING_MANIFEST',
      severity: 'FATAL',
      message: 'Execution manifest is missing or empty'
    });
  }

  // Check credential masking in manifest
  if (Array.isArray(manifest.credentials)) {
    for (const cred of manifest.credentials) {
      if (cred.maskedValue && cred.maskedValue !== '***REDACTED_EPHEMERAL***') {
        issues.push({
          code: 'CREDENTIAL_LEAKAGE_DETECTED',
          severity: 'FATAL',
          message: `Credential ${cred.referenceId} is not properly redacted in manifest`,
          details: { referenceId: cred.referenceId }
        });
      }
    }
  }

  // Validate operational status
  const operationalStatus = manifest.operationalStatus ?? 'UNKNOWN';
  if (operationalStatus !== 'EXECUTION_COMPLETED') {
    issues.push({
      code: 'EXECUTION_OPERATIONAL_STATUS_NOT_COMPLETED',
      severity: 'ERROR',
      message: `Operational status is '${operationalStatus}', expected 'EXECUTION_COMPLETED'`,
      details: { operationalStatus }
    });
  }

  // Extract provenance bindings
  const pecpBinding = manifest.pecpBinding ?? {};
  const repositoryCommitSha = manifest.repositoryCommitSha || manifest.commitSha || 'UNAVAILABLE';
  const commitSha = manifest.commitSha || manifest.repositoryCommitSha || 'UNAVAILABLE';
  const workflowRunId = manifest.workflowRunId ?? undefined;

  if (commitSha === 'UNAVAILABLE' || !commitSha) {
    issues.push({
      code: 'MISSING_REQUIRED_BINDING',
      severity: 'WARNING',
      message: 'Commit SHA binding is UNAVAILABLE or missing in execution manifest'
    });
  }

  if (!pecpBinding.sourceContractId || !pecpBinding.testDefinitionId || !pecpBinding.bundleFingerprint) {
    issues.push({
      code: 'MISSING_REQUIRED_BINDING',
      severity: 'ERROR',
      message: 'One or more required PECP model bindings (Contract, Test Definition, Bundle Fingerprint) are missing'
    });
  }

  if (!manifest.engine?.name) {
    issues.push({
      code: 'MISSING_REQUIRED_BINDING',
      severity: 'ERROR',
      message: 'Engine identity is missing or absent in manifest'
    });
  }

  // Build ExecutionRun model
  const run: ExecutionRun = {
    executionRunId: manifest.runId ?? 'UNKNOWN_RUN_ID',
    executionMode: manifest.executionMode ?? 'UNKNOWN_MODE',
    operationalStatus,
    repositoryCommitSha,
    commitSha,
    workflowRunId,
    executionArtifact: input.executionArtifact,
    timestamps: {
      startedAt: manifest.timestamps?.startedAt ?? '',
      completedAt: manifest.timestamps?.completedAt ?? '',
      durationSeconds: Number(manifest.timestamps?.durationSeconds ?? 0)
    },
    engine: {
      name: manifest.engine?.name ?? 'UNKNOWN_ENGINE',
      version: manifest.engine?.version ?? '',
      fullVersionString: manifest.engine?.fullVersionString,
      binaryPath: manifest.engine?.binaryPath,
      isPinnedExpected: manifest.engine?.isPinnedExpected
    },
    engineExitCode: manifest.k6ExitCode !== undefined ? manifest.k6ExitCode : null,
    target: {
      baseUrl: manifest.target?.baseUrl ?? '',
      probeResult: manifest.target?.probeResult
    },
    preflightStatus: {
      status: manifest.preflight?.status ?? 'UNKNOWN',
      isValid: Boolean(manifest.preflight?.isValid),
      blockingReasons: Array.isArray(manifest.preflight?.blockingReasons) ? manifest.preflight.blockingReasons : [],
      manifestTimestamp: manifest.preflight?.manifestTimestamp
    },
    sourceContract: {
      id: pecpBinding.sourceContractId ?? '',
      version: pecpBinding.sourceContractVersion ?? '',
      fingerprint: pecpBinding.sourceContractFingerprint ?? '',
      status: pecpBinding.sourceContractStatus
    },
    testDefinition: {
      id: pecpBinding.testDefinitionId ?? '',
      version: pecpBinding.testDefinitionVersion ?? '',
      fingerprint: pecpBinding.testDefinitionFingerprint ?? ''
    },
    bundleFingerprint: pecpBinding.bundleFingerprint ?? '',
    runtime: {
      version: pecpBinding.runtimeVersion,
      sourceId: pecpBinding.runtimeSourceId
    }
  };

  // 2. Raw Evidence Inventory Verification
  const filesMap: Record<string, RawFileEntry> = { ...(input.filesOnDisk ?? {}) };

  // Helper to extract file content if provided directly in input
  const registerInputFile = (key: string, val?: string | Buffer | RawFileEntry) => {
    if (val === undefined || val === null) return;
    if (typeof val === 'string' || Buffer.isBuffer(val)) {
      filesMap[key] = { filename: key, content: val };
    } else if (typeof val === 'object') {
      filesMap[key] = val;
    }
  };

  registerInputFile('k6-stdout.log', input.stdoutLog);
  registerInputFile('k6-stderr.log', input.stderrLog);
  registerInputFile('config.json', input.configJson);
  registerInputFile('journeys.js', input.journeysJs);
  registerInputFile('entrypoint.js', input.entrypointJs);
  registerInputFile('runtime.js', input.runtimeJs);

  if (input.summaryJson !== undefined && input.summaryJson !== null && !filesMap['summary.json']) {
    const summaryStr = typeof input.summaryJson === 'string'
      ? input.summaryJson
      : Buffer.isBuffer(input.summaryJson)
        ? input.summaryJson.toString('utf8')
        : JSON.stringify(input.summaryJson, null, 2);
    filesMap['summary.json'] = { filename: 'summary.json', content: summaryStr };
  }

  const manifestMaterialized = Array.isArray(manifest.materializedFiles) ? manifest.materializedFiles : [];
  const manifestArtefacts = manifest.rawArtefacts ?? {};

  // Check manifest content itself as evidence
  const manifestStr = typeof input.manifest === 'string'
    ? input.manifest
    : Buffer.isBuffer(input.manifest)
      ? input.manifest.toString('utf8')
      : JSON.stringify(input.manifest, null, 2);

  const manifestRef: RawEvidenceReference = {
    filename: 'execution-manifest.json',
    evidenceType: 'EXECUTION_MANIFEST',
    checksum: computeSha256(manifestStr),
    sizeBytes: Buffer.byteLength(manifestStr),
    presenceStatus: 'PRESENT',
    checksumVerified: true
  };

  const checkEvidenceFile = (
    filename: string,
    evidenceType: RawEvidenceType,
    expectedChecksum?: string,
    expectedSizeBytes?: number
  ): RawEvidenceReference => {
    const fileEntry = filesMap[filename];
    if (!fileEntry) {
      issues.push({
        code: 'MISSING_REQUIRED_ARTIFACT',
        severity: 'ERROR',
        message: `Required raw execution artifact '${filename}' is absent from evidence inventory`,
        details: { filename, expectedChecksum, expectedSizeBytes }
      });
      return {
        filename,
        evidenceType,
        checksum: expectedChecksum || '',
        sizeBytes: expectedSizeBytes || 0,
        presenceStatus: 'ABSENT',
        checksumVerified: false
      };
    }

    let buf: Buffer | undefined;
    if (fileEntry.content !== undefined && fileEntry.content !== null) {
      buf = typeof fileEntry.content === 'string' ? Buffer.from(fileEntry.content, 'utf8') : fileEntry.content;
    } else if (fileEntry.path && fs.existsSync(fileEntry.path)) {
      buf = fs.readFileSync(fileEntry.path);
    }

    if (buf === undefined) {
      issues.push({
        code: 'MISSING_REQUIRED_ARTIFACT',
        severity: 'ERROR',
        message: `Required raw execution artifact '${filename}' could not be read or is unavailable`,
        details: { filename, expectedChecksum, expectedSizeBytes }
      });
      return {
        filename,
        evidenceType,
        checksum: expectedChecksum || fileEntry.checksum || '',
        sizeBytes: expectedSizeBytes || fileEntry.sizeBytes || 0,
        presenceStatus: fileEntry.path ? 'UNAVAILABLE' : 'ABSENT',
        checksumVerified: false
      };
    }

    const actualChecksum = computeSha256(buf);
    const actualSize = buf.length;
    let checksumVerified = true;

    if (expectedChecksum && expectedChecksum !== actualChecksum) {
      checksumVerified = false;
      issues.push({
        code: 'CHECKSUM_MISMATCH',
        severity: 'ERROR',
        message: `Checksum mismatch for ${filename}: expected ${expectedChecksum}, got ${actualChecksum}`,
        details: { filename, expectedChecksum, actualChecksum }
      });
    }

    if (expectedSizeBytes !== undefined && expectedSizeBytes !== null && expectedSizeBytes > 0 && actualSize !== expectedSizeBytes) {
      issues.push({
        code: 'CHECKSUM_MISMATCH',
        severity: 'ERROR',
        message: `Size mismatch for ${filename}: expected ${expectedSizeBytes} bytes, got ${actualSize} bytes`,
        details: { filename, expectedSizeBytes, actualSizeBytes: actualSize }
      });
    }

    // Check for credential leakage in text files
    if (filename.endsWith('.log') || filename.endsWith('.json') || filename.endsWith('.js')) {
      const text = buf.toString('utf8');
      if (scanForCredentialLeakage(text)) {
        issues.push({
          code: 'CREDENTIAL_LEAKAGE_DETECTED',
          severity: 'FATAL',
          message: `Credential leakage detected in file ${filename}! Cleartext token found.`,
          details: { filename }
        });
      }
    }

    return {
      filename,
      evidenceType,
      checksum: actualChecksum,
      sizeBytes: actualSize,
      sourceLocator: fileEntry.path,
      presenceStatus: 'PRESENT',
      checksumVerified,
      actualChecksum
    };
  };

  // Resolve expected metadata from manifest
  const summaryJsonExpected = manifestArtefacts.summaryJson;
  const stdoutExpected = manifestArtefacts.stdoutLog;
  const stderrExpected = manifestArtefacts.stderrLog;

  const findMat = (name: string) => manifestMaterialized.find((f: any) => f.filename === name);

  const summaryFileRef = checkEvidenceFile(
    'summary.json',
    'K6_SUMMARY_JSON',
    summaryJsonExpected?.checksum,
    summaryJsonExpected?.sizeBytes
  );

  const stdoutRef = checkEvidenceFile(
    'k6-stdout.log',
    'STDOUT_LOG',
    stdoutExpected?.checksum,
    stdoutExpected?.sizeBytes
  );

  const stderrRef = checkEvidenceFile(
    'k6-stderr.log',
    'STDERR_LOG',
    stderrExpected?.checksum,
    stderrExpected?.sizeBytes
  );

  const configRef = checkEvidenceFile(
    'config.json',
    'CONFIG_JSON',
    findMat('config.json')?.checksum || manifestArtefacts.configJson?.checksum,
    findMat('config.json')?.sizeBytes || manifestArtefacts.configJson?.sizeBytes
  );

  const journeysRef = checkEvidenceFile(
    'journeys.js',
    'JOURNEYS_JS',
    findMat('journeys.js')?.checksum || manifestArtefacts.journeysJs?.checksum,
    findMat('journeys.js')?.sizeBytes || manifestArtefacts.journeysJs?.sizeBytes
  );

  const entrypointRef = checkEvidenceFile(
    'entrypoint.js',
    'ENTRYPOINT_JS',
    findMat('entrypoint.js')?.checksum || manifestArtefacts.entrypointJs?.checksum,
    findMat('entrypoint.js')?.sizeBytes || manifestArtefacts.entrypointJs?.sizeBytes
  );

  const runtimeRef = checkEvidenceFile(
    'runtime.js',
    'RUNTIME_JS',
    findMat('runtime.js')?.checksum || manifestArtefacts.runtimeJs?.checksum,
    findMat('runtime.js')?.sizeBytes || manifestArtefacts.runtimeJs?.sizeBytes
  );

  // Reference Lab evidence provenance
  let referenceLabEvidenceRef: RawEvidenceReference | undefined;
  if (manifest.referenceLabMetrics) {
    const labMetricsStr = JSON.stringify(manifest.referenceLabMetrics);
    referenceLabEvidenceRef = {
      filename: 'execution-manifest.json#/referenceLabMetrics',
      evidenceType: 'REFERENCE_LAB_METRICS',
      checksum: computeSha256(labMetricsStr),
      sizeBytes: Buffer.byteLength(labMetricsStr),
      sourceLocator: 'execution-manifest.json#/referenceLabMetrics',
      presenceStatus: 'PRESENT',
      checksumVerified: true
    };
  }

  const rawInventory: RawEvidenceInventory = {
    manifest: manifestRef,
    summaryJson: summaryFileRef,
    stdoutLog: stdoutRef,
    stderrLog: stderrRef,
    configJson: configRef,
    journeysJs: journeysRef,
    entrypointJs: entrypointRef,
    runtimeJs: runtimeRef,
    referenceLabMetrics: referenceLabEvidenceRef,
    allReferences: [
      manifestRef,
      summaryFileRef,
      stdoutRef,
      stderrRef,
      configRef,
      journeysRef,
      entrypointRef,
      runtimeRef,
      ...(referenceLabEvidenceRef ? [referenceLabEvidenceRef] : [])
    ]
  };

  // 3. k6 Summary Parsing
  let parsedSummary: any;
  let summaryMetrics: K6SummaryMetrics = {
    testRunDurationMs: 0,
    rootChecks: [],
    rawMetrics: {}
  };
  let thresholdObservations: ThresholdObservation[] = [];

  // Determine summary content
  let summaryPayload = input.summaryJson;
  if (!summaryPayload && filesMap['summary.json']) {
    const entry = filesMap['summary.json'];
    if (entry.content) {
      summaryPayload = entry.content;
    } else if (entry.path && fs.existsSync(entry.path)) {
      summaryPayload = fs.readFileSync(entry.path, 'utf8');
    }
  }

  if (summaryPayload) {
    try {
      const parsed = parseK6SummaryJson(summaryPayload);
      summaryMetrics = parsed.metrics;
      thresholdObservations = parsed.thresholdObservations;
      parsedSummary = parsed;
    } catch (err: any) {
      issues.push({
        code: 'PARSER_INCOMPATIBILITY',
        severity: 'ERROR',
        message: err.message
      });
    }
  } else {
    issues.push({
      code: 'MISSING_SUMMARY',
      severity: 'ERROR',
      message: 'summary.json is absent or could not be loaded'
    });
  }

  // Verify custom metrics present
  if (parsedSummary && !summaryMetrics.pecpBusinessAttainmentEvents) {
    issues.push({
      code: 'MISSING_REQUIRED_CUSTOM_METRIC',
      severity: 'WARNING',
      message: "Custom counter 'pecp_business_attainment_events' is missing from summary.json metrics"
    });
  }

  // 4. Scheduler Execution Observation
  const schedulerArrival = pecpBinding.schedulerArrival;
  if (!schedulerArrival || !schedulerArrival.population) {
    issues.push({
      code: 'UNRESOLVED_SCHEDULE_POPULATION',
      severity: 'WARNING',
      message: 'Scheduler population is missing from source manifest binding'
    });
  }

  const schedulerObservation: SchedulerExecutionObservation = {
    schedulerPopulation: schedulerArrival?.population,
    governedPeakRate: schedulerArrival?.peakRate !== undefined ? Number(schedulerArrival.peakRate) : undefined,
    scheduleIdentity: pecpBinding.scenarioName ?? manifest.testDefinition?.scenario ?? undefined,
    actualIterations: summaryMetrics.iterations?.count,
    observedIterationRate: summaryMetrics.iterations?.rate,
    droppedIterations: summaryMetrics.droppedIterations?.count,
    droppedIterationRate: summaryMetrics.droppedIterations?.rate,
    arrivalDemandCounter: summaryMetrics.pecpWorkloadArrivalDemand?.count,
    arrivalDemandRate: summaryMetrics.pecpWorkloadArrivalDemand?.rate
  };

  // 5. Business Events Observation
  const businessAttainment = pecpBinding.businessAttainment ?? manifest.businessAttainment;
  if (!businessAttainment || businessAttainment.targetValue === undefined) {
    issues.push({
      code: 'MISSING_SOURCE_WORKLOAD_TARGET',
      severity: 'WARNING',
      message: 'Source workload target is missing from contract / test definition binding'
    });
  }

  const observedEventCount =
    summaryMetrics.pecpBusinessAttainmentEvents?.count ??
    manifest.businessAttainment?.orderCreatedEventsObserved;

  const businessEventsObservation: BusinessEventsObservation = {
    governedMetric: businessAttainment?.metric,
    governedTarget: businessAttainment?.targetValue !== undefined ? {
      value: Number(businessAttainment.targetValue),
      unit: businessAttainment.unit ?? ''
    } : undefined,
    observedEventCount,
    observedRawRate: summaryMetrics.pecpBusinessAttainmentEvents?.rate,
    referenceLabCorroboratingEventCount: manifest.referenceLabMetrics?.delta?.orderCreatedEvents
  };

  // 6. Reference Lab Corroboration
  let referenceLabCorroboration: ReferenceLabCorroboration | undefined;
  const labMetrics = manifest.referenceLabMetrics;
  if (labMetrics && labMetrics.delta) {
    const delta = labMetrics.delta;
    const labOrderEvents = Number(delta.orderCreatedEvents ?? 0);
    const countsMatch = observedEventCount !== undefined && observedEventCount === labOrderEvents;
    const discrepancyCount = observedEventCount !== undefined ? Math.abs(observedEventCount - labOrderEvents) : 0;

    if (!countsMatch) {
      issues.push({
        code: 'BUSINESS_EVENT_COUNT_MISMATCH',
        severity: 'ERROR',
        message: `Business event count mismatch: k6 emitted ${observedEventCount} events, Reference Lab recorded ${labOrderEvents} order_created events (discrepancy: ${discrepancyCount})`,
        details: { k6EventCount: observedEventCount, referenceLabOrderCreated: labOrderEvents, discrepancyCount }
      });
    }

    referenceLabCorroboration = {
      sourceLocator: 'execution-manifest.json#/referenceLabMetrics',
      totalRequestsDelta: Number(delta.totalRequests ?? 0),
      requestsByRoute: delta.requestsByRoute ?? {},
      statusCounts: delta.statusCounts ?? {},
      businessEventCounts: {
        orderCreatedEvents: labOrderEvents
      },
      captureTimestamps: {
        before: labMetrics.before?.capturedAt,
        after: labMetrics.after?.capturedAt
      },
      durationSeconds: Number(delta.durationSeconds ?? 0),
      consistency: {
        k6BusinessEventCount: observedEventCount,
        referenceLabOrderCreatedCount: labOrderEvents,
        countsMatch,
        discrepancyCount,
        notes: countsMatch
          ? 'Exact 1:1 business attainment corroboration: k6 checkout completion matched Reference Lab order creation.'
          : `Discrepancy detected: difference of ${discrepancyCount} events between k6 client observation and server-side counter.`
      }
    };
  } else {
    issues.push({
      code: 'REFERENCE_LAB_METRICS_UNAVAILABLE',
      severity: 'WARNING',
      message: 'Reference Lab before/after/delta metrics are not available in manifest'
    });
  }

  // 7. Workload Attainment Lineage Observation
  // Invariant: Full test average rate is not steady-state peak attainment.
  // Steady state peak attainment is marked as unresolved due to lack of per-stage window telemetry.
  const targetRate = businessAttainment?.targetValue !== undefined ? Number(businessAttainment.targetValue) : undefined;
  const observedRate = summaryMetrics.pecpBusinessAttainmentEvents?.rate;
  const attainmentRatio = observedRate !== undefined && targetRate !== undefined && targetRate > 0
    ? Number((observedRate / targetRate).toFixed(4))
    : undefined;

  const fullTestAverageObservation: WorkloadAttainmentObservation | undefined = (observedRate !== undefined || observedEventCount !== undefined) ? {
    governedDemand: {
      metric: businessAttainment?.metric ?? 'unspecified',
      targetValue: targetRate ?? 0,
      unit: businessAttainment?.unit ?? ''
    },
    governedPopulation: schedulerArrival?.population ?? 'unspecified',
    actualSourceMetric: 'pecp_business_attainment_events',
    calculationFormula: 'total_observed_events / total_test_duration_seconds',
    units: businessAttainment?.unit ?? '',
    timeBasis: 'FULL_TEST_AVERAGE',
    resultValue: observedRate,
    attainmentRatio,
    derivationStatus: 'DETERMINISTICALLY_DERIVED',
    derivationNotes:
      'Whole-test average rate over the complete shaped test execution. This observation aggregates the entire execution duration and does not represent steady-state acceptance basis attainment.'
  } : undefined;

  const acceptanceBasisAttainment: WorkloadAttainmentObservation = {
    governedDemand: {
      metric: businessAttainment?.metric ?? 'unspecified',
      targetValue: targetRate ?? 0,
      unit: businessAttainment?.unit ?? ''
    },
    governedPopulation: schedulerArrival?.population ?? 'unspecified',
    actualSourceMetric: 'pecp_business_attainment_events',
    calculationFormula: 'steady_state_window_events / steady_state_window_seconds',
    units: businessAttainment?.unit ?? '',
    timeBasis: 'STEADY_STATE_PEAK',
    resultValue: undefined,
    attainmentRatio: undefined,
    derivationStatus: 'UNRESOLVED_INSUFFICIENT_TIME_SERIES',
    derivationNotes:
      'Acceptance-basis attainment requires steady-state time-window analysis. The raw k6 summary export aggregates over the entire run without time-series slicing; steady-state attainment is unresolved.'
  };

  // 8. Result Completeness Summary
  const hasFatalOrError = issues.some((i) => i.severity === 'FATAL' || i.severity === 'ERROR');
  const dataQuality: ResultCompleteness = {
    isComplete: issues.length === 0,
    hasIntegrityErrors: hasFatalOrError,
    issues
  };

  return {
    run,
    evidenceInventory: rawInventory,
    metrics: summaryMetrics,
    schedulerObservation,
    businessEventsObservation,
    referenceLabCorroboration,
    thresholdObservations,
    fullTestAverageObservation,
    acceptanceBasisAttainment,
    workloadAttainmentObservation: acceptanceBasisAttainment,
    dataQuality,
    performanceVerdict: INVARIANT_PERFORMANCE_VERDICT,
    verdictDisclaimer: INVARIANT_VERDICT_DISCLAIMER
  };
}

/**
 * Ingests evidence directly from an execution output directory on disk.
 */
export function ingestGovernedExecutionDirectory(
  dirPath: string,
  options?: {
    artifactLocator?: string;
    executionArtifact?: ExecutionRunArtifactReference;
  }
): CanonicalExecutionResult {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Execution directory does not exist: ${dirPath}`);
  }

  const manifestPath = path.join(dirPath, 'execution-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Execution manifest does not exist in directory: ${manifestPath}`);
  }

  const manifestContent = fs.readFileSync(manifestPath, 'utf8');

  // Discover files on disk in dirPath
  const filesOnDisk: Record<string, RawFileEntry> = {};
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      filesOnDisk[entry] = {
        filename: entry,
        path: fullPath,
        sizeBytes: stat.size
      };
    }
  }

  return ingestGovernedExecutionEvidence({
    manifest: manifestContent,
    filesOnDisk,
    artifactLocator: options?.artifactLocator ?? dirPath,
    executionArtifact: options?.executionArtifact
  });
}
