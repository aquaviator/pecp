import {
  TestDefinition,
  K6ExecutionBundle,
  K6Options,
  K6ScenarioConfig,
  K6ExecutionBundleFile,
  AcceptanceCriterion
} from '@pecp/pe-domain';
import { computeBundleFingerprint } from './fingerprint.js';

export interface CompileK6BundleOptions {
  testDefinition: TestDefinition;
  bundleId?: string;
  generatedAt?: string;
  clock?: () => string;
}

function sanitizeMetricName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * Maps defined canonical acceptance criteria to k6 threshold expressions.
 * Enforces Constitution §10: Only DEFINED criteria with unambiguous percentiles become thresholds.
 * Workload arrival demand is NEVER converted into an NFR threshold.
 */
function buildK6Thresholds(criteria: AcceptanceCriterion[]): Record<string, string[]> {
  const thresholds: Record<string, string[]> = {};

  for (const crit of criteria) {
    if (crit.status !== 'DEFINED') {
      continue;
    }

    const operator = crit.operator || '<';
    const val = crit.thresholdValue !== undefined ? crit.thresholdValue : parseFloat(crit.target.replace(/[^0-9.]/g, ''));

    if (isNaN(val)) continue;

    // Error rate thresholds
    if (crit.metric.toLowerCase().includes('error') || crit.unit.includes('rate') || crit.unit.includes('%')) {
      // If percentage e.g. 0.5% -> rate 0.005
      const rateVal = val > 1 ? val / 100 : val;
      thresholds['http_req_failed'] = [`rate${operator}${rateVal}`];
      continue;
    }

    // Response time / latency thresholds
    if (crit.percentile && (crit.metric.toLowerCase().includes('latency') || crit.metric.toLowerCase().includes('response'))) {
      const pKey = `p(${crit.percentile})`;
      // Duration in ms: if unit is seconds, convert to ms
      const msVal = crit.unit === 'seconds' || crit.unit === 's' ? val * 1000 : val;
      
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

  return thresholds;
}

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
          workloadAttainment: {
            metric: testDefinition.workloadAttainment.metric,
            targetValue: testDefinition.workloadAttainment.targetValue,
            unit: testDefinition.workloadAttainment.unit
          },
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

  const k6ScenarioConfig: K6ScenarioConfig = {
    executor: 'ramping-arrival-rate',
    rate: 1,
    timeUnit: '1s',
    preAllocatedVUs: Math.max(20, Math.ceil(schedule.peakArrivalRate * 3)),
    maxVUs: Math.max(100, Math.ceil(schedule.peakArrivalRate * 12)),
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
        workloadAttainment: {
          metric: testDefinition.workloadAttainment.metric,
          targetValue: testDefinition.workloadAttainment.targetValue,
          unit: testDefinition.workloadAttainment.unit
        },
        targetEnvironmentBaseUrlRef: scenario.targetEnvironmentBaseUrlRef,
        credentialReferences: testDefinition.credentialReferences
      }
    }
  };

  // Generate journeys.js
  const journeyFunctionsCode = testDefinition.journeys
    .map((journey) => {
      const funcName = `run${journey.key.charAt(0).toUpperCase() + journey.key.slice(1)}Journey`;
      const stepsCode = journey.steps
        .map((step) => {
          const authHeader =
            step.credentialReferences && step.credentialReferences.length > 0
              ? `    headers['Authorization'] = __ENV['${step.credentialReferences[0].referenceId}'] || 'Bearer NOT_CONFIGURED';\n`
              : '';
          const thinkTime = step.thinkTimeSeconds || 1;
          const method = step.method.toLowerCase();
          const expectedStatus = step.expectedStatusCode || 200;

          return `    // Step: ${step.name}
    ${authHeader}const res_${sanitizeMetricName(step.id)} = http.${method}(\`\${baseUrl}${step.path}\`, ${
            method === 'post' || method === 'put' ? "JSON.stringify({ syntheticPayload: true }), " : ''
          }{
      headers: Object.assign({}, headers, { 'Content-Type': 'application/json' }),
      tags: { journey: '${journey.key}', step: '${step.id}', name: '${step.name}' }
    });
    check(res_${sanitizeMetricName(step.id)}, {
      '${step.name} status is ${expectedStatus}': (r) => r.status === ${expectedStatus}
    });
    sleep(${thinkTime});`;
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

  const journeysJsContent = `// ============================================================================
// PECP Generated k6 Journey Modules
// Source Test Definition: ${testDefinition.id} (${testDefinition.version})
// Bound Contract: ${testDefinition.sourceContractId}
// Generated At: ${generatedAt}
// ============================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';

export const JOURNEY_WEIGHTS = ${JSON.stringify(journeyWeightsMap, null, 2)};

${journeyFunctionsCode}
`;

  // Generate entrypoint.js
  const entrypointJsContent = `// ============================================================================
// PECP Governed k6 Entrypoint
// Source Test Definition: ${testDefinition.id}
// Engineering Intent: ${testDefinition.engineeringIntent}
// Target Environment Ref: ${scenario.targetEnvironmentBaseUrlRef}
// Fingerprint: ${testDefinition.fingerprint} (Deterministic drift checksum)
// ============================================================================
import { Counter, Rate } from 'k6/metrics';
import * as journeys from './journeys.js';

// Load generated options and thresholds
export const options = JSON.parse(open('./config.json'));

// Workload Arrival Demand Tracker (Prerequisite attainment metric, distinct from NFRs)
export const workloadArrivalDemand = new Counter('pecp_workload_arrival_demand');
export const workloadAttainmentRate = new Rate('pecp_workload_attainment_rate');

const BASE_URL = __ENV['TARGET_BASE_URL'] || '${scenario.targetEnvironmentBaseUrlRef}';

export default function () {
  workloadArrivalDemand.add(1);

  // Select journey based on canonical distribution weights
  const rand = Math.random();
  let cumulative = 0;

${testDefinition.journeys
  .map((j) => {
    const funcName = `journeys.run${j.key.charAt(0).toUpperCase() + j.key.slice(1)}Journey`;
    return `  cumulative += ${j.weight};
  if (rand <= cumulative) {
    ${funcName}(BASE_URL, {});
    return;
  }`;
  })
  .join('\n')}

  // Fallback default
  ${
    testDefinition.journeys.length > 0
      ? `journeys.run${testDefinition.journeys[0].key.charAt(0).toUpperCase() + testDefinition.journeys[0].key.slice(1)}Journey(BASE_URL, {});`
      : '// No journeys configured'
  }
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
      description: 'Modular journey step implementations with metric tagging',
      content: journeysJsContent
    },
    {
      filename: 'entrypoint.js',
      path: 'entrypoint.js',
      language: 'javascript',
      description: 'Governed k6 entrypoint consuming journeys and tracking arrival demand',
      content: entrypointJsContent
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
