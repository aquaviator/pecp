import {
  TestDefinition,
  K6ExecutionBundle,
  K6Options,
  K6ScenarioConfig,
  K6ExecutionBundleFile,
  AcceptanceCriterion,
  K6ProviderCapacityConfig,
  K6ProviderDerivedCapacity,
  TestDefinitionIssue
} from '@pecp/pe-domain';
import { computeBundleFingerprint } from './fingerprint.js';
import {
  PECP_STABLE_K6_RUNTIME_VERSION,
  PECP_STABLE_K6_RUNTIME_SOURCE_ID,
  PECP_STABLE_K6_RUNTIME_SOURCE
} from './authoritativeRuntime.js';

export {
  PECP_STABLE_K6_RUNTIME_VERSION,
  PECP_STABLE_K6_RUNTIME_SOURCE_ID,
  PECP_STABLE_K6_RUNTIME_SOURCE
};

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

export interface ThresholdCompilationResult {
  thresholds: Record<string, string[]>;
  issues: TestDefinitionIssue[];
  unmappedReasons: string[];
}

/**
 * Maps defined canonical acceptance criteria to k6 threshold expressions.
 * Enforces Constitution §10 & Work Package M3.0.2:
 * Provider threshold mapping failures must be explicit.
 * For every criterion in testDefinition.executableCriteria:
 * - either map it successfully into a k6 threshold; or
 * - emit a provider compilation issue explaining why it cannot be mapped.
 * If a required executable criterion cannot be represented by the provider,
 * the resulting k6 bundle must be non-executable.
 */
export function buildK6Thresholds(criteria: AcceptanceCriterion[]): ThresholdCompilationResult {
  const thresholds: Record<string, string[]> = {};
  const issues: TestDefinitionIssue[] = [];
  const unmappedReasons: string[] = [];

  for (const crit of criteria) {
    if (crit.status !== 'DEFINED') {
      continue;
    }

    // Must have explicit operator and numeric thresholdValue
    const validOperators = ['<', '<=', '>', '>=', '=='];
    if (!crit.operator || !validOperators.includes(crit.operator)) {
      const reason = `Acceptance criterion "${crit.metric}" (${crit.id}) has unsupported or missing operator "${crit.operator}". Supported operators: ${validOperators.join(', ')}.`;
      issues.push({
        id: `issue-provider-threshold-op-${crit.id}`,
        type: 'PROVIDER_UNSUPPORTED_CRITERION',
        severity: 'BLOCKING',
        parameter: `criteria.${crit.id}.operator`,
        description: reason,
        remediationGuidance: 'Specify a standard comparison operator (<, <=, >, >=, ==).'
      });
      unmappedReasons.push(reason);
      continue;
    }

    if (crit.thresholdValue === undefined || isNaN(crit.thresholdValue)) {
      const reason = `Acceptance criterion "${crit.metric}" (${crit.id}) has missing or non-numeric threshold value.`;
      issues.push({
        id: `issue-provider-threshold-val-${crit.id}`,
        type: 'PROVIDER_UNSUPPORTED_CRITERION',
        severity: 'BLOCKING',
        parameter: `criteria.${crit.id}.thresholdValue`,
        description: reason,
        remediationGuidance: 'Provide a valid numeric threshold value.'
      });
      unmappedReasons.push(reason);
      continue;
    }

    const operator = crit.operator;
    const val = crit.thresholdValue;

    // Error rate thresholds
    if (
      crit.metric.toLowerCase().includes('error') ||
      crit.metric.toLowerCase().includes('fail')
    ) {
      let rateVal: number | undefined;
      if (crit.unit === '%') {
        rateVal = val / 100;
      } else if (crit.unit === 'rate' || crit.unit === 'fraction') {
        rateVal = val;
      } else {
        const reason = `Acceptance criterion "${crit.metric}" (${crit.id}) specifies unsupported unit "${crit.unit}" for error rate threshold. Supported error rate units: "%", "rate", "fraction".`;
        issues.push({
          id: `issue-provider-threshold-unit-${crit.id}`,
          type: 'PROVIDER_UNSUPPORTED_CRITERION',
          severity: 'BLOCKING',
          parameter: `criteria.${crit.id}.unit`,
          description: reason,
          remediationGuidance: 'Use "%" or "rate" for error rate criteria in k6 provider.'
        });
        unmappedReasons.push(reason);
        continue;
      }

      if (rateVal !== undefined && !isNaN(rateVal)) {
        const expr = `rate${operator}${rateVal}`;
        thresholds['http_req_failed'] = thresholds['http_req_failed']
          ? [...thresholds['http_req_failed'], expr]
          : [expr];
      }
      continue;
    }

    // Response time / latency thresholds
    if (
      crit.metric.toLowerCase().includes('latency') ||
      crit.metric.toLowerCase().includes('response') ||
      crit.metric.toLowerCase().includes('duration')
    ) {
      if (!crit.percentile || isNaN(crit.percentile)) {
        const reason = `Latency criterion "${crit.metric}" (${crit.id}) lacks a required percentile (e.g. 95, 99) for k6 threshold representation.`;
        issues.push({
          id: `issue-provider-threshold-pctl-${crit.id}`,
          type: 'PROVIDER_UNSUPPORTED_CRITERION',
          severity: 'BLOCKING',
          parameter: `criteria.${crit.id}.percentile`,
          description: reason,
          remediationGuidance: 'Specify an explicit percentile (e.g. 95 or 99) for latency thresholds.'
        });
        unmappedReasons.push(reason);
        continue;
      }

      const pKey = `p(${crit.percentile})`;
      let msVal: number | undefined;
      if (crit.unit === 'seconds' || crit.unit === 's') {
        msVal = val * 1000;
      } else if (crit.unit === 'ms' || crit.unit === 'milliseconds') {
        msVal = val;
      } else {
        const reason = `Latency criterion "${crit.metric}" (${crit.id}) has unsupported unit "${crit.unit}". k6 provider supports "ms", "milliseconds", "s", "seconds".`;
        issues.push({
          id: `issue-provider-threshold-unit-${crit.id}`,
          type: 'PROVIDER_UNSUPPORTED_CRITERION',
          severity: 'BLOCKING',
          parameter: `criteria.${crit.id}.unit`,
          description: reason,
          remediationGuidance: 'Change unit to "ms" or "seconds".'
        });
        unmappedReasons.push(reason);
        continue;
      }

      if (msVal !== undefined && !isNaN(msVal)) {
        const scope = (crit.scope || '').toLowerCase();
        let metricKey = 'http_req_duration';
        if (scope.includes('checkout')) {
          metricKey = 'http_req_duration{journey:checkout}';
        } else if (scope.includes('search')) {
          metricKey = 'http_req_duration{journey:search}';
        } else if (scope.includes('basket')) {
          metricKey = 'http_req_duration{journey:basket}';
        } else if (scope.includes('browse')) {
          metricKey = 'http_req_duration{journey:browse}';
        }

        const expr = `${pKey}${operator}${msVal}`;
        thresholds[metricKey] = thresholds[metricKey]
          ? [...thresholds[metricKey], expr]
          : [expr];
      }
      continue;
    }

    // Unsupported metric type for k6 HTTP provider
    const reason = `Acceptance criterion "${crit.metric}" (${crit.id}) cannot be mapped to k6 HTTP threshold (unsupported metric type).`;
    issues.push({
      id: `issue-provider-unsupported-metric-${crit.id}`,
      type: 'PROVIDER_UNSUPPORTED_CRITERION',
      severity: 'BLOCKING',
      parameter: `criteria.${crit.id}.metric`,
      description: reason,
      remediationGuidance: 'k6 HTTP provider supports HTTP latency and error rate acceptance criteria.'
    });
    unmappedReasons.push(reason);
  }

  return { thresholds, issues, unmappedReasons };
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

  // Provider Threshold Mapping Check (M3.0.2 Requirement 4)
  const thresholdMapping = buildK6Thresholds(testDefinition.executableCriteria);
  
  // Provider Population and Rate Unit Compatibility Check (M3.0.3 Requirement 7)
  const providerIssues: TestDefinitionIssue[] = [];
  const providerNonExecutableReasons: string[] = [];
  const scheduleToCheck = testDefinition.scenarios[0]?.workloadSchedule;
  const isMixedJourneys =
    testDefinition.journeys.length > 1 ||
    (testDefinition.journeys.length === 1 && testDefinition.journeys[0].weight < 0.999);

  if (scheduleToCheck) {
    const rateUnitLower = (scheduleToCheck.rateUnit || '').toLowerCase();
    const attainmentUnit = (testDefinition.workloadAttainment?.unit || '').toLowerCase();

    if (isMixedJourneys && (rateUnitLower.includes('order') || (attainmentUnit && rateUnitLower === attainmentUnit))) {
      const reason = `k6 ramping-arrival-rate executor expects scheduler arrival rate (e.g. "journey_iterations/second"), but schedule specifies business outcome unit "${scheduleToCheck.rateUnit}".`;
      providerIssues.push({
        id: 'issue-provider-incompatible-rate-unit',
        type: 'PROVIDER_INCOMPATIBLE_RATE_UNIT',
        severity: 'BLOCKING',
        parameter: 'schedule.rateUnit',
        description: reason,
        remediationGuidance: 'Configure schedule arrival population and scheduler rate unit instead of business outcome unit.'
      });
      providerNonExecutableReasons.push(reason);
    }

    const validPopulations = ['JOURNEY_ITERATION', 'SESSION', 'TRANSACTION', 'ITERATION'];
    if (scheduleToCheck.arrivalPopulation && !validPopulations.includes(scheduleToCheck.arrivalPopulation)) {
      const reason = `k6 provider does not support arrival population "${scheduleToCheck.arrivalPopulation}". Supported populations: ${validPopulations.join(', ')}.`;
      providerIssues.push({
        id: 'issue-provider-unsupported-population',
        type: 'PROVIDER_INCOMPATIBLE_RATE_UNIT',
        severity: 'BLOCKING',
        parameter: 'schedule.arrivalPopulation',
        description: reason,
        remediationGuidance: `Set schedule arrivalPopulation to one of: ${validPopulations.join(', ')}.`
      });
      providerNonExecutableReasons.push(reason);
    }
  }

  const providerMappingFailed = thresholdMapping.unmappedReasons.length > 0 || providerNonExecutableReasons.length > 0;

  // If TestDefinition is non-executable OR provider mapping fails, generate a safe blocked bundle
  if (!testDefinition.isExecutable || providerMappingFailed) {
    const combinedBlockingReasons = [
      ...testDefinition.blockingReasons,
      ...thresholdMapping.unmappedReasons,
      ...providerNonExecutableReasons
    ];
    const combinedIssues = [
      ...testDefinition.issues,
      ...thresholdMapping.issues,
      ...providerIssues
    ];

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
          runtimeVersion: PECP_STABLE_K6_RUNTIME_VERSION,
          runtimeSourceId: PECP_STABLE_K6_RUNTIME_SOURCE_ID,
          schedulerArrival: scheduleToCheck
            ? {
                population: scheduleToCheck.arrivalPopulation || 'JOURNEY_ITERATION',
                peakRate: scheduleToCheck.peakArrivalRate,
                unit: scheduleToCheck.rateUnit
              }
            : undefined,
          populationRelationship: testDefinition.populationRelationship,
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
// Upstream governance rules, precondition failures, or provider threshold mapping issues prevent execution.
//
// BLOCKING REASONS:
${combinedBlockingReasons.map((r, i) => `// ${i + 1}. ${r}`).join('\n')}
//
// ISSUES:
${combinedIssues.map((iss) => `// - [${iss.severity}] ${iss.parameter}: ${iss.description}`).join('\n')}
//
// Remediation: Resolve blockers in canonical intelligence or threshold criteria before re-compiling.
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
      runtimeVersion: PECP_STABLE_K6_RUNTIME_VERSION,
      runtimeSourceId: PECP_STABLE_K6_RUNTIME_SOURCE_ID,
      isExecutable: false,
      nonExecutableReasons: combinedBlockingReasons,
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

  // Correct k6 ramping-arrival-rate executor schema (M3.0.2 Requirement 1):
  // Uses startRate (not rate) and explicit timeUnit: '1s'
  const startRate = schedule.startRate !== undefined ? schedule.startRate : 0;
  const k6ScenarioConfig: K6ScenarioConfig = {
    executor: 'ramping-arrival-rate',
    startRate,
    timeUnit: '1s',
    preAllocatedVUs,
    maxVUs,
    stages: schedule.stages.map((st) => ({
      target: Math.round(st.targetArrivalRate * 1000) / 1000,
      duration: `${st.durationSeconds}s`
    })),
    exec: 'default'
  };

  const thresholds = thresholdMapping.thresholds;

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
        runtimeVersion: PECP_STABLE_K6_RUNTIME_VERSION,
        runtimeSourceId: PECP_STABLE_K6_RUNTIME_SOURCE_ID,
        schedulerArrival: {
          population: schedule.arrivalPopulation || 'JOURNEY_ITERATION',
          peakRate: schedule.peakArrivalRate,
          unit: schedule.rateUnit
        },
        populationRelationship: testDefinition.populationRelationship,
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

  // Generate journeys.js consuming the stable runtime helper and safe credential resolution (M3.0.2 Requirement 5)
  const journeyFunctionsCode = testDefinition.journeys
    .map((journey) => {
      const funcName = `run${journey.key.charAt(0).toUpperCase() + journey.key.slice(1)}Journey`;
      const stepsCode = journey.steps
        .map((step) => {
          const authHeader =
            step.credentialReferences && step.credentialReferences.length > 0
              ? `  // Credential Reference: __ENV['${step.credentialReferences[0].referenceId}']\n  const authToken = resolveCredential('${step.credentialReferences[0].referenceId}', '${step.credentialReferences[0].purpose || ''}');\n  headers['Authorization'] = \`Bearer \${authToken}\`;\n`
              : '';
          const thinkTime = typeof step.thinkTimeSeconds === 'number' ? step.thinkTimeSeconds : 0;

          const method = step.method.toUpperCase();
          const expectedStatusProp =
            step.expectedStatusCode !== undefined ? `    expectedStatus: ${step.expectedStatusCode},\n` : '';
          const bodyProp = step.requestPayload
            ? `    body: ${JSON.stringify(step.requestPayload.value)},\n`
            : '';
          const businessEventProp = step.businessEventContribution
            ? `    businessEvent: ${JSON.stringify(step.businessEventContribution)},\n`
            : '';

          return `  // Step: ${step.name}
${authHeader}  executeStep({
    method: '${method}',
    url: \`\${baseUrl}${step.path}\`,
${bodyProp}${expectedStatusProp}${businessEventProp}    thinkTimeSeconds: ${thinkTime},
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
// Consumes: PECP Stable k6 Runtime (executeStep, resolveCredential)
// ============================================================================
import { executeStep } from './runtime.js';
import { resolveCredential } from './runtime.js';

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
import { businessAttainmentEvents } from './runtime.js';
import { JOURNEY_WEIGHTS, JOURNEY_RUNNER_MAP } from './journeys.js';

// Load generated options and thresholds
export const options = (() => {
  const cfg = JSON.parse(open('./config.json'));
  if (cfg.scenarios) {
    for (const k of Object.keys(cfg.scenarios)) {
      const sc = cfg.scenarios[k];
      if (sc.stages && Array.isArray(sc.stages)) {
        sc.stages = sc.stages.map(function (st) {
          return Object.assign({}, st, { target: Math.round(st.target) });
        });
      }
    }
  }
  return cfg;
})();

// Re-export metrics for k6 engine discovery
export { workloadArrivalDemand, workloadAttainmentRate, businessAttainmentEvents };

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
    runtimeVersion: PECP_STABLE_K6_RUNTIME_VERSION,
    runtimeSourceId: PECP_STABLE_K6_RUNTIME_SOURCE_ID,
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


