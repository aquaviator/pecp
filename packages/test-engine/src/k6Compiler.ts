import {
  TestDefinition,
  K6ExecutionBundle,
  K6Options,
  K6ScenarioConfig,
  K6ExecutionBundleFile,
  AcceptanceCriterion,
  K6ProviderCapacityConfig,
  K6ProviderDerivedCapacity
} from '@pecp/pe-domain';
import { computeBundleFingerprint } from './fingerprint.js';

export const K6_STANDARD_PROVIDER_POLICY = {
  policyId: 'k6-standard-arrival-rate-sizing',
  policyVersion: 'v1.0',
  ruleIdentifier: 'RULE_PEAK_CONCURRENCY_ESTIMATION_V1',
  formulaDescription:
    'Provider-derived capacity: preAllocatedVUs = max(10, ceil(peakArrivalRate * 2.5)), maxVUs = max(50, ceil(peakArrivalRate * 10)), rateTimeUnit = 1s'
};

export interface CompileK6BundleOptions {
  testDefinition: TestDefinition;
  bundleId?: string;
  generatedAt?: string;
  clock?: () => string;
  k6ProviderCapacity?: K6ProviderCapacityConfig;
}

function sanitizeMetricName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * Maps defined canonical acceptance criteria to k6 threshold expressions.
 * Enforces Constitution §10: Only DEFINED criteria with explicit operator, thresholdValue,
 * and valid unit/percentile become thresholds.
 * Does NOT guess '<' operators or parse raw target strings.
 * Workload arrival demand is NEVER converted into an NFR threshold.
 */
function buildK6Thresholds(criteria: AcceptanceCriterion[]): Record<string, string[]> {
  const thresholds: Record<string, string[]> = {};

  for (const crit of criteria) {
    if (crit.status !== 'DEFINED') {
      continue;
    }

    // Must have explicit operator and numeric thresholdValue
    if (!crit.operator || crit.thresholdValue === undefined) {
      continue;
    }

    const operator = crit.operator;
    const val = crit.thresholdValue;
    if (isNaN(val)) continue;

    // Error rate thresholds
    if (crit.metric.toLowerCase().includes('error') || crit.unit === 'rate' || crit.unit === '%') {
      let rateVal: number | undefined;
      if (crit.unit === '%') {
        rateVal = val / 100;
      } else if (crit.unit === 'rate' || crit.unit === 'fraction') {
        rateVal = val;
      }
      if (rateVal !== undefined && !isNaN(rateVal)) {
        thresholds['http_req_failed'] = [`rate${operator}${rateVal}`];
      }
      continue;
    }

    // Response time / latency thresholds
    if (
      crit.percentile &&
      (crit.metric.toLowerCase().includes('latency') ||
        crit.metric.toLowerCase().includes('response') ||
        crit.metric.toLowerCase().includes('duration'))
    ) {
      const pKey = `p(${crit.percentile})`;
      let msVal: number | undefined;
      if (crit.unit === 'seconds' || crit.unit === 's') {
        msVal = val * 1000;
      } else if (crit.unit === 'ms' || crit.unit === 'milliseconds') {
        msVal = val;
      }

      if (msVal !== undefined && !isNaN(msVal)) {
        const scope = crit.scope.toLowerCase();
        let metricKey = 'http_req_duration';
        if (scope.includes('checkout')) {
          metricKey = 'http_req_duration{journey:checkout}';
        } else if (scope.includes('search')) {
          metricKey = 'http_req_duration{journey:search}';
        } else if (scope.includes('basket')) {
          metricKey = 'http_req_duration{journey:basket}';
        }

        thresholds[metricKey] = [`${pKey}${operator}${msVal}`];
      }
    }
  }

  return thresholds;
}

/**
 * Deterministically packaged versioned PECP stable k6 runtime module.
 */
export const PECP_STABLE_K6_RUNTIME_SOURCE = `// ============================================================================
// PECP Stable k6 Runtime (Packaged Core Module v1.0)
// Authoritative execution runtime for metrics, HTTP execution, and journey orchestration
// ============================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// 1. Core Metrics (Prerequisite workload arrival demand & journey duration trends)
export const workloadArrivalDemand = new Counter('pecp_workload_arrival_demand');
export const workloadAttainmentRate = new Rate('pecp_workload_attainment_rate');
export const journeyDurationTrend = new Trend('pecp_journey_duration_ms', true);

// 2. HTTP Helper (No invented defaults: explicit expectedStatus and thinkTimeSeconds)
export function executeStep(stepConfig) {
  const {
    method = 'GET',
    url,
    body,
    headers = {},
    tags = {},
    expectedStatus,
    thinkTimeSeconds = 0
  } = stepConfig;

  const params = {
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    tags
  };

  let res;
  const verb = method.toUpperCase();
  if (verb === 'GET') {
    res = http.get(url, params);
  } else if (verb === 'POST') {
    res = http.post(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else if (verb === 'PUT') {
    res = http.put(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else if (verb === 'DELETE') {
    res = http.del(url, params);
  } else if (verb === 'PATCH') {
    res = http.patch(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else {
    res = http.get(url, params);
  }

  // Check expected status ONLY if explicitly defined
  if (expectedStatus !== undefined && expectedStatus !== null) {
    check(res, {
      [\`\${tags.name || 'Step'} status is \${expectedStatus}\`]: (r) => r.status === expectedStatus
    });
  }

  // Sleep ONLY if explicitly provided and greater than zero
  if (typeof thinkTimeSeconds === 'number' && thinkTimeSeconds > 0) {
    sleep(thinkTimeSeconds);
  }

  return res;
}

// 3. Journey Selection & Orchestration
export function selectJourneyByWeight(weights) {
  const rand = Math.random();
  let cumulative = 0;
  for (const [journeyKey, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return journeyKey;
    }
  }
  return Object.keys(weights)[0];
}

export function executeIteration(journeyRunnerMap, weights, baseUrl, baseHeaders) {
  workloadArrivalDemand.add(1);
  const selectedKey = selectJourneyByWeight(weights);
  const runner = journeyRunnerMap[selectedKey];

  if (runner) {
    const startTime = new Date().getTime();
    runner(baseUrl, baseHeaders);
    const duration = new Date().getTime() - startTime;
    journeyDurationTrend.add(duration, { journey: selectedKey });
  }
}
`;

/**
 * Pure deterministic compiler: transforms an engine-neutral Canonical Test Definition
 * into a modular k6 execution bundle according to M3.0 specifications.
 */
export function compileK6Bundle(options: CompileK6BundleOptions): K6ExecutionBundle {
  const { testDefinition } = options;
  const bundleId = options.bundleId || `k6-bundle-${testDefinition.id}`;
  const generatedAt =
    options.generatedAt ||
    (options.clock ? options.clock() : testDefinition.generationTimestamp || '2026-08-25T14:30:00.000Z');

  // If TestDefinition is non-executable, generate a safe blocked bundle
  if (!testDefinition.isExecutable) {
    const blockedOptions: K6Options = {
      scenarios: {},
      thresholds: {},
      ext: {
        pecp: {
          testDefinitionId: testDefinition.id,
          testDefinitionVersion: testDefinition.version,
          testDefinitionFingerprint: testDefinition.fingerprint,
          sourceContractId: testDefinition.sourceContractId,
          sourceContractVersion: testDefinition.sourceContractVersion,
          sourceContractFingerprint: testDefinition.sourceContractFingerprint,
          generatedAt,
          workloadAttainment: testDefinition.workloadAttainment
            ? {
                metric: testDefinition.workloadAttainment.metric,
                targetValue: testDefinition.workloadAttainment.targetValue,
                unit: testDefinition.workloadAttainment.unit,
                tolerancePercentage: testDefinition.workloadAttainment.tolerancePercentage
              }
            : undefined,
          targetEnvironmentBaseUrlRef: 'NOT_CONFIGURED',
          credentialReferences: testDefinition.credentialReferences
        }
      }
    };

    const blockedReadme = `// ============================================================================
// PECP GOVERNANCE NOTICE: EXECUTION BLOCKED
// ============================================================================
// This k6 bundle is currently NON-EXECUTABLE.
// Upstream governance rules or missing execution parameters prevent execution.
//
// BLOCKING REASONS:
${testDefinition.blockingReasons.map((r, i) => `// ${i + 1}. ${r}`).join('\n')}
//
// ISSUES:
${testDefinition.issues.map((iss) => `// - [${iss.severity}] ${iss.parameter}: ${iss.description}`).join('\n')}
//
// Remediation: Resolve blockers in canonical intelligence before re-compiling.
// ============================================================================
`;

    const blockedFiles: K6ExecutionBundleFile[] = [
      {
        filename: 'config.json',
        path: 'config.json',
        language: 'json',
        description: 'Non-executable k6 bundle configuration (Blocked by governance)',
        content: JSON.stringify(blockedOptions, null, 2)
      },
      {
        filename: 'entrypoint.js',
        path: 'entrypoint.js',
        language: 'javascript',
        description: 'Blocked execution entrypoint',
        content: `${blockedReadme}\nexport default function () {\n  throw new Error('PECP: Cannot execute test. TestDefinition is in BLOCKED/NOT_EXECUTABLE state.');\n}\n`
      }
    ];

    const partialBundle: Omit<K6ExecutionBundle, 'fingerprint'> = {
      id: bundleId,
      testDefinitionId: testDefinition.id,
      testDefinitionVersion: testDefinition.version,
      testDefinitionFingerprint: testDefinition.fingerprint,
      generatedAt,
      isExecutable: false,
      nonExecutableReasons: testDefinition.blockingReasons,
      options: blockedOptions,
      files: blockedFiles,
      summary: {
        scenariosCount: 0,
        journeysCount: testDefinition.journeys.length,
        thresholdsCount: 0,
        ambiguousCriteriaExcludedCount: testDefinition.ambiguousCriteria.length,
        credentialReferencesCount: testDefinition.credentialReferences.length
      }
    };

    const fingerprint = computeBundleFingerprint(partialBundle);
    return {
      ...partialBundle,
      fingerprint
    };
  }

  // Executable scenario compilation
  const scenario = testDefinition.scenarios[0];
  const schedule = scenario.workloadSchedule;

  // Governed Provider Capacity Sizing (Correction 5)
  let preAllocatedVUs: number;
  let maxVUs: number;
  let providerCapacityInfo: K6ProviderDerivedCapacity;

  if (options.k6ProviderCapacity) {
    preAllocatedVUs = options.k6ProviderCapacity.preAllocatedVUs;
    maxVUs = options.k6ProviderCapacity.maxVUs;
    providerCapacityInfo = {
      policyId: 'explicit-execution-intelligence',
      policyVersion: 'v1.0',
      ruleIdentifier: 'RULE_EXPLICIT_PROVIDER_CAPACITY',
      sourcePeakArrivalRate: schedule.peakArrivalRate,
      preAllocatedVUs,
      maxVUs,
      rateTimeUnit: options.k6ProviderCapacity.rateTimeUnit || '1s',
      formulaDescription: 'Explicitly configured in canonical execution intelligence overrides',
      isProviderDerived: false
    };
  } else {
    // Deterministically derived via K6ProviderPolicy v1.0
    preAllocatedVUs = Math.max(10, Math.ceil(schedule.peakArrivalRate * 2.5));
    maxVUs = Math.max(50, Math.ceil(schedule.peakArrivalRate * 10));
    providerCapacityInfo = {
      policyId: K6_STANDARD_PROVIDER_POLICY.policyId,
      policyVersion: K6_STANDARD_PROVIDER_POLICY.policyVersion,
      ruleIdentifier: K6_STANDARD_PROVIDER_POLICY.ruleIdentifier,
      sourcePeakArrivalRate: schedule.peakArrivalRate,
      preAllocatedVUs,
      maxVUs,
      rateTimeUnit: '1s',
      formulaDescription: K6_STANDARD_PROVIDER_POLICY.formulaDescription,
      isProviderDerived: true
    };
  }

  const k6ScenarioConfig: K6ScenarioConfig = {
    executor: 'ramping-arrival-rate',
    rate: 1, // 1 iteration per timeUnit (base multiplier for stage arrival rates)
    timeUnit: '1s',
    preAllocatedVUs,
    maxVUs,
    stages: schedule.stages.map((st) => ({
      target: Math.round(st.targetArrivalRate * 100) / 100,
      duration: `${st.durationSeconds}s`
    })),
    exec: 'default'
  };

  const thresholds = buildK6Thresholds(testDefinition.executableCriteria);

  const k6Options: K6Options = {
    scenarios: {
      [sanitizeMetricName(scenario.name)]: k6ScenarioConfig
    },
    thresholds,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
    ext: {
      pecp: {
        testDefinitionId: testDefinition.id,
        testDefinitionVersion: testDefinition.version,
        testDefinitionFingerprint: testDefinition.fingerprint,
        sourceContractId: testDefinition.sourceContractId,
        sourceContractVersion: testDefinition.sourceContractVersion,
        sourceContractFingerprint: testDefinition.sourceContractFingerprint,
        generatedAt,
        workloadAttainment: testDefinition.workloadAttainment
          ? {
              metric: testDefinition.workloadAttainment.metric,
              targetValue: testDefinition.workloadAttainment.targetValue,
              unit: testDefinition.workloadAttainment.unit,
              tolerancePercentage: testDefinition.workloadAttainment.tolerancePercentage
            }
          : undefined,
        providerCapacity: providerCapacityInfo,
        targetEnvironmentBaseUrlRef: scenario.targetEnvironmentBaseUrlRef,
        credentialReferences: testDefinition.credentialReferences
      }
    }
  };

  // Generate journeys.js consuming the stable runtime helper
  const journeyFunctionsCode = testDefinition.journeys
    .map((journey) => {
      const funcName = `run${journey.key.charAt(0).toUpperCase() + journey.key.slice(1)}Journey`;
      const stepsCode = journey.steps
        .map((step) => {
          const authHeader =
            step.credentialReferences && step.credentialReferences.length > 0
              ? `  headers['Authorization'] = __ENV['${step.credentialReferences[0].referenceId}'] || 'Bearer NOT_CONFIGURED';\n`
              : '';
          const thinkTime = typeof step.thinkTimeSeconds === 'number' ? step.thinkTimeSeconds : 0;
          const method = step.method.toUpperCase();
          const expectedStatusProp =
            step.expectedStatusCode !== undefined ? `    expectedStatus: ${step.expectedStatusCode},\n` : '';
          const bodyProp = step.requestPayload
            ? `    body: ${JSON.stringify(step.requestPayload.value)},\n`
            : '';

          return `  // Step: ${step.name}
${authHeader}  executeStep({
    method: '${method}',
    url: \`\${baseUrl}${step.path}\`,
${bodyProp}${expectedStatusProp}    thinkTimeSeconds: ${thinkTime},
    headers,
    tags: { journey: '${journey.key}', step: '${step.id}', name: '${step.name}' }
  });`;
        })
        .join('\n\n');

      return `/**
 * ${journey.name} Journey (Weight: ${journey.percentage}%)
 */
export function ${funcName}(baseUrl, baseHeaders) {
  const headers = Object.assign({}, baseHeaders);
${stepsCode}
}`;
    })
    .join('\n\n');

  const journeyWeightsMap = testDefinition.journeys.reduce<Record<string, number>>((acc, j) => {
    acc[j.key] = j.weight;
    return acc;
  }, {});

  const journeyRunnerMapEntries = testDefinition.journeys
    .map((j) => `  ${j.key}: run${j.key.charAt(0).toUpperCase() + j.key.slice(1)}Journey`)
    .join(',\n');

  const journeysJsContent = `// ============================================================================
// PECP Generated k6 Journey Modules
// Source Test Definition: ${testDefinition.id} (${testDefinition.version})
// Bound Contract: ${testDefinition.sourceContractId}
// Generated At: ${generatedAt}
// Consumes: PECP Stable k6 Runtime (executeStep)
// ============================================================================
import { executeStep } from './runtime.js';

export const JOURNEY_WEIGHTS = ${JSON.stringify(journeyWeightsMap, null, 2)};

${journeyFunctionsCode}

export const JOURNEY_RUNNER_MAP = {
${journeyRunnerMapEntries}
};
`;

  // Generate entrypoint.js: Consumes the stable PECP runtime (executeIteration)
  const entrypointJsContent = `// ============================================================================
// PECP Governed k6 Entrypoint
// Source Test Definition: ${testDefinition.id}
// Engineering Intent: ${testDefinition.engineeringIntent}
// Target Environment Ref: ${scenario.targetEnvironmentBaseUrlRef}
// Fingerprint: ${testDefinition.fingerprint} (Deterministic drift checksum)
// Architecture: Thin orchestration delegating to PECP Stable k6 Runtime
// ============================================================================
import { executeIteration, workloadArrivalDemand, workloadAttainmentRate } from './runtime.js';
import { JOURNEY_WEIGHTS, JOURNEY_RUNNER_MAP } from './journeys.js';

// Load generated options and thresholds
export const options = JSON.parse(open('./config.json'));

// Re-export metrics for k6 engine discovery
export { workloadArrivalDemand, workloadAttainmentRate };

const BASE_URL = __ENV['TARGET_BASE_URL'] || '${scenario.targetEnvironmentBaseUrlRef}';

export default function () {
  executeIteration(JOURNEY_RUNNER_MAP, JOURNEY_WEIGHTS, BASE_URL, {});
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2)
  };
}

function textSummary(data, options) {
  return \`\\n--- PECP k6 Test Execution Summary ---\\nTest Definition: ${testDefinition.id}\\nStatus: COMPLETED\\n\`;
}
`;

  const files: K6ExecutionBundleFile[] = [
    {
      filename: 'config.json',
      path: 'config.json',
      language: 'json',
      description: 'k6 runtime options, scenarios, and defined acceptance criteria thresholds',
      content: JSON.stringify(k6Options, null, 2)
    },
    {
      filename: 'journeys.js',
      path: 'journeys.js',
      language: 'javascript',
      description: 'Modular journey step implementations consuming PECP stable runtime executeStep',
      content: journeysJsContent
    },
    {
      filename: 'entrypoint.js',
      path: 'entrypoint.js',
      language: 'javascript',
      description: 'Governed k6 entrypoint delegating journey orchestration to PECP stable runtime',
      content: entrypointJsContent
    },
    {
      filename: 'runtime.js',
      path: 'runtime.js',
      language: 'javascript',
      description: 'Packaged PECP stable k6 runtime core (metrics, httpHelper, runner)',
      content: PECP_STABLE_K6_RUNTIME_SOURCE
    }
  ];

  const partialBundle: Omit<K6ExecutionBundle, 'fingerprint'> = {
    id: bundleId,
    testDefinitionId: testDefinition.id,
    testDefinitionVersion: testDefinition.version,
    testDefinitionFingerprint: testDefinition.fingerprint,
    generatedAt,
    isExecutable: true,
    nonExecutableReasons: [],
    options: k6Options,
    files,
    summary: {
      scenariosCount: 1,
      journeysCount: testDefinition.journeys.length,
      thresholdsCount: Object.keys(thresholds).length,
      ambiguousCriteriaExcludedCount: testDefinition.ambiguousCriteria.length,
      credentialReferencesCount: testDefinition.credentialReferences.length
    }
  };

  const fingerprint = computeBundleFingerprint(partialBundle);

  return {
    ...partialBundle,
    fingerprint
  };
}

