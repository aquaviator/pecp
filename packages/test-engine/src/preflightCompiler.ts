import {
  TestDefinition,
  K6ExecutionBundle,
  PerformanceContract,
  JourneyStep
} from '@pecp/pe-domain';
import {
  PECP_STABLE_K6_RUNTIME_VERSION,
  PECP_STABLE_K6_RUNTIME_SOURCE_ID
} from './authoritativeRuntime.js';

export interface PreflightTestDefinitionBinding {
  id: string;
  version: string;
  status: string;
  fingerprint: string;
  sourceContractId: string;
  sourceContractVersion: string;
  sourceContractFingerprint: string;
  sourceContractStatus: string;
}

export interface PreflightK6RuntimeBinding {
  version: string;
  sourceId: string;
  entrypoint: string;
  bundleFiles: string[];
  bundleFingerprint: string;
  testDefinitionFingerprint: string;
}

export interface PreflightHealthyThreshold {
  criterionId: string;
  metric: string;
  aggregation: string;
  operator: string;
  threshold: number;
  unit: string;
  expression: string;
}

export interface PreflightGovernedWorkload {
  schedulerArrivalPopulation: string;
  schedulerPeakRate: {
    value: number;
    unit: string;
  };
  businessWorkloadAttainment: {
    metric: string;
    targetValue: number;
    unit: string;
  };
  populationRelationship: {
    id: string;
    formulaIdentifier: string;
    relevantJourneyKey: string;
    journeyShare: number;
    contributionPerSuccessfulEvent: number;
    derivedSchedulerRate: number;
  };
  checkoutContribution: string;
}

export interface PreflightCredentialBindings {
  requiredReferences: Array<{
    provider: string;
    referenceId: string;
    purpose: string;
    enforcedRoute: string;
    enforcedScheme: string;
  }>;
  ephemeralAtRuntime: boolean;
  noHardcodedSecrets: boolean;
}

export interface PreflightChecks {
  contractApproved: boolean;
  testDefinitionCompiled: boolean;
  k6BundleCompiled: boolean;
  referenceLabManifestAligned: boolean;
  referenceLabRoutesVerified: boolean;
  credentialBindingsDefined: boolean;
  populationSemanticsHardened: boolean;
  thresholdsBoundToApprovedContract: boolean;
  targetResolvable: boolean;
  liveExecutionNotStarted: boolean;
}

export interface TargetProbeResult {
  baseUrl: string;
  healthStatus: 'healthy' | string;
  readyStatus: 'ready' | string;
  verifiedAt: string;
  isResolvable: boolean;
  httpStatusHealth?: number;
  httpStatusReady?: number;
}

export interface ExecutionPreflightManifest {
  $schema?: string;
  manifestType: 'M3_EXECUTION_PREFLIGHT';
  milestone: string;
  service: string;
  serviceVersion: string;
  routeManifestVersion: string;
  preflightTimestamp: string;
  status: 'READY_FOR_LIVE_EXECUTION' | 'PREFLIGHT_BLOCKED';
  targetEnvironment: {
    strategy: string;
    defaultBaseUrl: string;
    envVarOverride: string;
    protocol: string;
    port: number;
    host: string;
    verifiedProbe?: {
      verifiedAt: string;
      healthStatus: string;
      readyStatus: string;
      isResolvable: boolean;
    };
  };
  canonicalTestDefinition: PreflightTestDefinitionBinding;
  k6Runtime: PreflightK6RuntimeBinding;
  governedWorkload: PreflightGovernedWorkload;
  credentialBindings: PreflightCredentialBindings;
  expectedHealthyThresholds: PreflightHealthyThreshold[];
  preflightChecks: PreflightChecks;
}

export interface PreflightValidationIssue {
  field: string;
  expected: unknown;
  actual: unknown;
  description: string;
}

export interface PreflightValidationResult {
  isValid: boolean;
  status: 'READY_FOR_LIVE_EXECUTION' | 'PREFLIGHT_BLOCKED';
  issues: PreflightValidationIssue[];
}

export interface ReferenceLabRouteManifestItem {
  id?: string;
  path: string;
  method: string;
  expectedStatus: number;
  authRequired?: boolean;
  authHeader?: string;
  authScheme?: string;
  payloadRequired?: boolean;
  requiredPayloadFields?: string[];
  businessEventContribution?: {
    eventKey: string;
    metric: string;
    unit: string;
    contribution: number;
    expectedStatus: number;
  };
  description?: string;
}

export interface ReferenceLabManifestDefinition {
  version: string;
  service: string;
  environment?: string;
  defaultPort?: number;
  routes: ReferenceLabRouteManifestItem[];
}

export interface BuildPreflightManifestOptions {
  testDefinition: TestDefinition;
  bundle: K6ExecutionBundle;
  referenceLabManifest: ReferenceLabManifestDefinition;
  sourceContract?: PerformanceContract;
  targetProbe?: TargetProbeResult;
  preflightTimestamp?: string;
  liveExecutionStarted?: boolean;
}

export interface PreflightValidationContext {
  testDefinition: TestDefinition;
  bundle: K6ExecutionBundle;
  referenceLabManifest: {
    version: string;
    service: string;
    routes?: ReferenceLabRouteManifestItem[];
  };
  sourceContract?: PerformanceContract;
  targetProbe?: TargetProbeResult;
  liveExecutionStarted?: boolean;
}

/**
 * Builds a strictly source-driven ExecutionPreflightManifest bound directly to
 * compiled TestDefinition, K6ExecutionBundle, Reference Lab route manifest, and
 * verified TargetProbeResult.
 *
 * Enforces M3.1A.2 No-Fallback Gate:
 * 1. Absolutely NO engineering fallbacks (operators, percentiles, rates, targets, URLs).
 * 2. Contract approval proven from governed status, NOT inferred from ID text.
 * 3. Exact semantic Reference Lab route alignment (method, path, status, payload, auth, business event).
 * 4. Target resolvability proven by explicit verified probe evidence.
 * 5. Credential bindings derived from canonical steps and route manifest.
 * 6. READY_FOR_LIVE_EXECUTION law: any missing proof emits PREFLIGHT_BLOCKED.
 */
export function buildExecutionPreflightManifest(
  options: BuildPreflightManifestOptions
): ExecutionPreflightManifest {
  const { testDefinition, bundle, referenceLabManifest } = options;
  const timestamp = options.preflightTimestamp || '2026-09-18T10:30:00Z';
  const scenario = testDefinition.scenarios?.[0];
  const schedule = scenario?.workloadSchedule;
  const popRel = testDefinition.populationRelationship;
  const attainment = testDefinition.workloadAttainment;
  const issues: PreflightValidationIssue[] = [];

  // 1. Contract Approval Binding (NO string inference)
  const contractStatus =
    options.sourceContract?.status ||
    testDefinition.sourceContractStatus ||
    '';

  const isContractApproved = contractStatus === 'APPROVED';
  if (!isContractApproved) {
    issues.push({
      field: 'canonicalTestDefinition.sourceContractStatus',
      expected: 'APPROVED',
      actual: contractStatus || 'UNDEFINED',
      description: `Source contract status is "${contractStatus || 'UNDEFINED'}", not APPROVED. Contract approval must be proven from governed state.`
    });
  }

  // 2. Test Definition & k6 Bundle Executability
  const isTestDefCompiled =
    testDefinition.status === 'READY_FOR_EXECUTION' && testDefinition.isExecutable === true;
  if (!isTestDefCompiled) {
    issues.push({
      field: 'canonicalTestDefinition.status',
      expected: 'READY_FOR_EXECUTION (executable)',
      actual: `${testDefinition.status} (executable=${testDefinition.isExecutable})`,
      description: 'Test Definition must be in READY_FOR_EXECUTION status and executable.'
    });
  }

  const isK6BundleCompiled = bundle.isExecutable === true;
  if (!isK6BundleCompiled) {
    issues.push({
      field: 'k6Runtime.isExecutable',
      expected: true,
      actual: bundle.isExecutable,
      description: 'k6 execution bundle must be executable.'
    });
  }

  // 3. Expected Healthy Thresholds (NO fallbacks for operator, percentile, threshold)
  const expectedHealthyThresholds: PreflightHealthyThreshold[] = [];
  let thresholdsBoundToApprovedContract = true;

  if (!testDefinition.executableCriteria || testDefinition.executableCriteria.length === 0) {
    thresholdsBoundToApprovedContract = false;
    issues.push({
      field: 'canonicalTestDefinition.executableCriteria',
      expected: 'At least one executable criterion',
      actual: 0,
      description: 'Test Definition has no executable criteria.'
    });
  } else {
    for (const crit of testDefinition.executableCriteria) {
      if (!crit.operator) {
        thresholdsBoundToApprovedContract = false;
        issues.push({
          field: `executableCriteria.${crit.id}.operator`,
          expected: 'Explicit comparison operator (<, <=, >, >=, ==)',
          actual: undefined,
          description: `Criterion "${crit.id}" missing operator; no fallback operator allowed.`
        });
        continue;
      }

      if (crit.thresholdValue === undefined || isNaN(crit.thresholdValue)) {
        thresholdsBoundToApprovedContract = false;
        issues.push({
          field: `executableCriteria.${crit.id}.thresholdValue`,
          expected: 'Valid numeric threshold value',
          actual: crit.thresholdValue,
          description: `Criterion "${crit.id}" missing thresholdValue; no fallback value allowed.`
        });
        continue;
      }

      let metricKey = 'http_req_duration';
      let aggregation = '';
      let unit = crit.unit;

      if (crit.metric.toLowerCase().includes('error') || crit.metric.toLowerCase().includes('fail')) {
        metricKey = 'http_req_failed';
        aggregation = 'rate';
        if (unit === 'percentage') {
          thresholdsBoundToApprovedContract = false;
          issues.push({
            field: `executableCriteria.${crit.id}.unit`,
            expected: 'rate or fraction',
            actual: 'percentage',
            description: `Error rate criterion "${crit.id}" must be expressed in rate/fraction, not percentage.`
          });
        }
        unit = 'rate';
      } else {
        if (!crit.percentile) {
          thresholdsBoundToApprovedContract = false;
          issues.push({
            field: `executableCriteria.${crit.id}.percentile`,
            expected: 'Explicit percentile number (e.g. 95, 99)',
            actual: undefined,
            description: `Latency criterion "${crit.id}" missing percentile; no fallback percentile allowed.`
          });
          continue;
        }
        aggregation = `p(${crit.percentile})`;
        const scope = (crit.scope || '').toLowerCase();
        if (scope.includes('checkout')) {
          metricKey = 'http_req_duration{journey:checkout}';
        }
      }

      const expression = `${aggregation}${crit.operator}${crit.thresholdValue}`;

      // Verify exact expression exists in compiled bundle thresholds
      const bundleThresholdsForMetric = bundle.options.thresholds[metricKey];
      if (!bundleThresholdsForMetric || !bundleThresholdsForMetric.includes(expression)) {
        thresholdsBoundToApprovedContract = false;
        issues.push({
          field: `expectedHealthyThresholds.${crit.id}.expression`,
          expected: bundleThresholdsForMetric,
          actual: expression,
          description: `Threshold expression "${expression}" for metric "${metricKey}" not found in compiled bundle options.`
        });
      }

      expectedHealthyThresholds.push({
        criterionId: crit.id,
        metric: metricKey,
        aggregation,
        operator: crit.operator,
        threshold: crit.thresholdValue,
        unit,
        expression
      });
    }
  }

  // 4. Governed Workload & Population Semantics (NO fallbacks for attainment, shares, contributions)
  let populationSemanticsHardened = true;

  if (!schedule) {
    populationSemanticsHardened = false;
    issues.push({
      field: 'governedWorkload.workloadSchedule',
      expected: 'Defined WorkloadSchedule',
      actual: undefined,
      description: 'Workload schedule is missing.'
    });
  }

  if (!schedule?.arrivalPopulation) {
    populationSemanticsHardened = false;
    issues.push({
      field: 'governedWorkload.schedulerArrivalPopulation',
      expected: 'Defined SchedulerArrivalPopulation',
      actual: undefined,
      description: 'Scheduler arrival population is missing; no fallback allowed.'
    });
  }

  if (schedule?.peakArrivalRate === undefined || isNaN(schedule.peakArrivalRate) || schedule.peakArrivalRate <= 0) {
    populationSemanticsHardened = false;
    issues.push({
      field: 'governedWorkload.schedulerPeakRate.value',
      expected: 'Positive peak arrival rate',
      actual: schedule?.peakArrivalRate,
      description: 'Scheduler peak arrival rate is missing or non-positive; no fallback allowed.'
    });
  }

  if (!schedule?.rateUnit) {
    populationSemanticsHardened = false;
    issues.push({
      field: 'governedWorkload.schedulerPeakRate.unit',
      expected: 'Defined rate unit',
      actual: undefined,
      description: 'Scheduler rate unit is missing; no fallback allowed.'
    });
  }

  if (
    !attainment ||
    !attainment.metric ||
    attainment.targetValue === undefined ||
    isNaN(attainment.targetValue) ||
    attainment.targetValue <= 0 ||
    !attainment.unit
  ) {
    populationSemanticsHardened = false;
    issues.push({
      field: 'governedWorkload.businessWorkloadAttainment',
      expected: 'Defined WorkloadAttainmentRequirement with positive targetValue and unit',
      actual: attainment,
      description: 'Workload attainment requirement is missing or incomplete; no fallback allowed.'
    });
  }

  if (
    !popRel ||
    !popRel.id ||
    !popRel.relevantJourneyKey ||
    popRel.journeyShare === undefined ||
    isNaN(popRel.journeyShare) ||
    popRel.journeyShare <= 0 ||
    popRel.contributionPerSuccessfulEvent === undefined ||
    isNaN(popRel.contributionPerSuccessfulEvent) ||
    popRel.contributionPerSuccessfulEvent <= 0 ||
    !popRel.outputSchedulerRate ||
    popRel.outputSchedulerRate.value <= 0
  ) {
    populationSemanticsHardened = false;
    issues.push({
      field: 'governedWorkload.populationRelationship',
      expected: 'Defined WorkloadPopulationRelationship with valid relevantJourneyKey, positive journeyShare, and positive contribution',
      actual: popRel,
      description: 'Population relationship is missing or incomplete; no fallback allowed.'
    });
  }

  const governedWorkload: PreflightGovernedWorkload = {
    schedulerArrivalPopulation: schedule?.arrivalPopulation || '',
    schedulerPeakRate: {
      value: schedule?.peakArrivalRate ?? 0,
      unit: schedule?.rateUnit || ''
    },
    businessWorkloadAttainment: {
      metric: attainment?.metric || '',
      targetValue: attainment?.targetValue ?? 0,
      unit: attainment?.unit || ''
    },
    populationRelationship: {
      id: popRel?.id || '',
      formulaIdentifier: popRel?.formulaIdentifier || '',
      relevantJourneyKey: popRel?.relevantJourneyKey || '',
      journeyShare: popRel?.journeyShare ?? 0,
      contributionPerSuccessfulEvent: popRel?.contributionPerSuccessfulEvent ?? 0,
      derivedSchedulerRate: popRel?.outputSchedulerRate?.value ?? 0
    },
    checkoutContribution: popRel
      ? `${popRel.contributionPerSuccessfulEvent} ${attainment?.metric || 'event'}`
      : ''
  };

  // 5. Semantic Reference Lab Route Alignment (NO route-count heuristics)
  let referenceLabRoutesVerified = true;
  const canonicalJourneys = testDefinition.journeys || scenario?.journeyDistribution || [];

  for (const journey of canonicalJourneys) {
    for (const step of journey.steps) {
      const route = referenceLabManifest.routes.find(
        (r) =>
          r.method.toUpperCase() === step.method.toUpperCase() &&
          (r.path === step.path || step.path.startsWith(r.path.split('?')[0]))
      );

      if (!route) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}`,
          expected: 'Matching route in Reference Lab manifest',
          actual: undefined,
          description: `Required journey step ${step.method} ${step.path} has no matching route in Reference Lab manifest.`
        });
        continue;
      }

      // Assert expected healthy status
      if (step.expectedStatusCode !== undefined && route.expectedStatus !== step.expectedStatusCode) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}.expectedStatus`,
          expected: step.expectedStatusCode,
          actual: route.expectedStatus,
          description: `Route ${step.method} ${step.path} expected status mismatch: step expects ${step.expectedStatusCode}, lab route specifies ${route.expectedStatus}.`
        });
      }

      // Assert payload requirement semantics
      const stepRequiresPayload =
        Boolean(step.requestPayload) || ['POST', 'PUT', 'PATCH'].includes(step.method.toUpperCase());
      if (stepRequiresPayload && route.payloadRequired === false) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}.payloadRequired`,
          expected: true,
          actual: route.payloadRequired,
          description: `Route ${step.method} ${step.path} payload requirement mismatch: step requires request payload, lab specifies payloadRequired=false.`
        });
      }

      // Assert auth requirement semantics
      const stepRequiresAuth = Boolean(step.credentialReferences && step.credentialReferences.length > 0);
      if (stepRequiresAuth && !route.authRequired) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}.authRequired`,
          expected: true,
          actual: route.authRequired,
          description: `Route ${step.method} ${step.path} auth requirement mismatch: step references credentials, lab specifies authRequired=false.`
        });
      }

      // Assert business event contribution semantics
      if (step.businessEventContribution) {
        if (!route.businessEventContribution) {
          referenceLabRoutesVerified = false;
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution`,
            expected: step.businessEventContribution,
            actual: undefined,
            description: `Route ${step.method} ${step.path} missing business event contribution in lab manifest.`
          });
        } else {
          const sEvt = step.businessEventContribution;
          const rEvt = route.businessEventContribution;
          if (
            rEvt.eventKey !== sEvt.eventKey ||
            rEvt.contribution !== sEvt.contribution ||
            rEvt.expectedStatus !== sEvt.expectedStatus
          ) {
            referenceLabRoutesVerified = false;
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution`,
              expected: sEvt,
              actual: rEvt,
              description: `Route ${step.method} ${step.path} business event contribution properties mismatch.`
            });
          }
        }
      }
    }
  }

  const referenceLabManifestAligned =
    referenceLabManifest.version === '1.0.0' && Boolean(referenceLabManifest.service);

  // 6. Credential Binding Derivation (NO hard-coded Checkout or Bearer)
  let credentialBindingsDefined = true;
  const derivedCredentialReferences: Array<{
    provider: string;
    referenceId: string;
    purpose: string;
    enforcedRoute: string;
    enforcedScheme: string;
  }> = [];

  for (const ref of testDefinition.credentialReferences) {
    let referencingStep: JourneyStep | undefined;
    for (const journey of canonicalJourneys) {
      for (const step of journey.steps) {
        if (step.credentialReferences?.some((r) => r.referenceId === ref.referenceId)) {
          referencingStep = step;
          break;
        }
      }
      if (referencingStep) break;
    }

    if (!referencingStep) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${ref.referenceId}`,
        expected: 'Referenced in at least one canonical journey step',
        actual: undefined,
        description: `Credential reference "${ref.referenceId}" is not referenced by any canonical journey step.`
      });
      continue;
    }

    const matchingRoute = referenceLabManifest.routes.find(
      (r) =>
        r.method.toUpperCase() === referencingStep!.method.toUpperCase() &&
        (r.path === referencingStep!.path || referencingStep!.path.startsWith(r.path.split('?')[0]))
    );

    if (!matchingRoute) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${ref.referenceId}.enforcedRoute`,
        expected: `Reference lab route matching step ${referencingStep.method} ${referencingStep.path}`,
        actual: undefined,
        description: `No Reference Lab route found for credential-referenced step ${referencingStep.method} ${referencingStep.path}.`
      });
      continue;
    }

    if (!matchingRoute.authRequired) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${ref.referenceId}.authRequired`,
        expected: true,
        actual: matchingRoute.authRequired,
        description: `Reference Lab route ${matchingRoute.method} ${matchingRoute.path} does not require auth, but step references credentials.`
      });
      continue;
    }

    if (!matchingRoute.authScheme) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${ref.referenceId}.enforcedScheme`,
        expected: 'Defined authScheme in route manifest',
        actual: undefined,
        description: `Reference Lab route ${matchingRoute.method} ${matchingRoute.path} does not specify an authScheme.`
      });
      continue;
    }

    derivedCredentialReferences.push({
      provider: ref.provider,
      referenceId: ref.referenceId,
      purpose: ref.purpose,
      enforcedRoute: matchingRoute.path,
      enforcedScheme: matchingRoute.authScheme
    });
  }

  const credentialBindings: PreflightCredentialBindings = {
    requiredReferences: derivedCredentialReferences,
    ephemeralAtRuntime: true,
    noHardcodedSecrets: true
  };

  // 7. Target Resolvability Evidence (NO hardcoded true)
  const probe = options.targetProbe;
  const isTargetResolvable =
    probe !== undefined &&
    probe.isResolvable === true &&
    probe.healthStatus === 'healthy' &&
    probe.readyStatus === 'ready';

  if (!isTargetResolvable) {
    issues.push({
      field: 'preflightChecks.targetResolvable',
      expected: 'Explicit verified probe result with isResolvable=true, healthStatus="healthy", readyStatus="ready"',
      actual: probe
        ? `isResolvable=${probe.isResolvable}, health=${probe.healthStatus}, ready=${probe.readyStatus}`
        : 'missing probe evidence',
      description: 'Target resolvability cannot be asserted without explicit verified probe evidence.'
    });
  }

  const rawTargetUrl = probe?.baseUrl || scenario?.targetEnvironmentBaseUrlRef;
  let parsedUrl: URL | null = null;
  if (rawTargetUrl) {
    try {
      parsedUrl = new URL(rawTargetUrl);
    } catch {
      parsedUrl = null;
    }
  }

  if (!parsedUrl) {
    issues.push({
      field: 'targetEnvironment.defaultBaseUrl',
      expected: 'Valid HTTP/HTTPS URL',
      actual: rawTargetUrl,
      description: 'Target environment URL is missing or invalid; no fallback value allowed.'
    });
  }

  const targetEnvironment = {
    strategy: 'LOCALHOST_RESOLVABLE',
    defaultBaseUrl: parsedUrl ? parsedUrl.origin : '',
    envVarOverride: 'TARGET_BASE_URL',
    protocol: parsedUrl ? parsedUrl.protocol.replace(':', '').toUpperCase() : '',
    port: parsedUrl ? parseInt(parsedUrl.port, 10) || (parsedUrl.protocol === 'https:' ? 443 : 80) : 0,
    host: parsedUrl ? parsedUrl.hostname : '',
    verifiedProbe: probe
      ? {
          verifiedAt: probe.verifiedAt,
          healthStatus: probe.healthStatus,
          readyStatus: probe.readyStatus,
          isResolvable: probe.isResolvable
        }
      : undefined
  };

  // 8. Live Execution Guard
  const liveExecutionNotStarted = !options.liveExecutionStarted;
  if (!liveExecutionNotStarted) {
    issues.push({
      field: 'preflightChecks.liveExecutionNotStarted',
      expected: true,
      actual: false,
      description: 'Live execution must not have started.'
    });
  }

  const bundleFiles = bundle.files.map((f) => f.filename);

  const preflightChecks: PreflightChecks = {
    contractApproved: isContractApproved,
    testDefinitionCompiled: isTestDefCompiled,
    k6BundleCompiled: isK6BundleCompiled,
    referenceLabManifestAligned,
    referenceLabRoutesVerified,
    credentialBindingsDefined,
    populationSemanticsHardened,
    thresholdsBoundToApprovedContract,
    targetResolvable: isTargetResolvable,
    liveExecutionNotStarted
  };

  const allChecksPass =
    preflightChecks.contractApproved &&
    preflightChecks.testDefinitionCompiled &&
    preflightChecks.k6BundleCompiled &&
    preflightChecks.referenceLabManifestAligned &&
    preflightChecks.referenceLabRoutesVerified &&
    preflightChecks.credentialBindingsDefined &&
    preflightChecks.populationSemanticsHardened &&
    preflightChecks.thresholdsBoundToApprovedContract &&
    preflightChecks.targetResolvable &&
    preflightChecks.liveExecutionNotStarted &&
    issues.length === 0;

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    manifestType: 'M3_EXECUTION_PREFLIGHT',
    milestone: 'M3.1A',
    service: referenceLabManifest.service || 'retailco-reference-lab',
    serviceVersion: referenceLabManifest.version || '1.0.0',
    routeManifestVersion: referenceLabManifest.version || '1.0.0',
    preflightTimestamp: timestamp,
    status: allChecksPass ? 'READY_FOR_LIVE_EXECUTION' : 'PREFLIGHT_BLOCKED',
    targetEnvironment,
    canonicalTestDefinition: {
      id: testDefinition.id,
      version: testDefinition.version,
      status: testDefinition.status,
      fingerprint: testDefinition.fingerprint,
      sourceContractId: testDefinition.sourceContractId,
      sourceContractVersion: testDefinition.sourceContractVersion,
      sourceContractFingerprint: testDefinition.sourceContractFingerprint,
      sourceContractStatus: contractStatus || 'UNDEFINED'
    },
    k6Runtime: {
      version: bundle.runtimeVersion || PECP_STABLE_K6_RUNTIME_VERSION,
      sourceId: bundle.runtimeSourceId || PECP_STABLE_K6_RUNTIME_SOURCE_ID,
      entrypoint: 'entrypoint.js',
      bundleFiles,
      bundleFingerprint: bundle.fingerprint,
      testDefinitionFingerprint: bundle.testDefinitionFingerprint
    },
    governedWorkload,
    credentialBindings,
    expectedHealthyThresholds,
    preflightChecks
  };
}

/**
 * Validates an ExecutionPreflightManifest against freshly compiled TestDefinition,
 * K6ExecutionBundle, and ReferenceLabManifest.
 * Enforces the READY_FOR_LIVE_EXECUTION law (Work Package M3.1A.2 Requirement 7).
 */
export function validateExecutionPreflightManifest(
  manifest: ExecutionPreflightManifest,
  context: PreflightValidationContext
): PreflightValidationResult {
  const issues: PreflightValidationIssue[] = [];
  const { testDefinition, bundle, referenceLabManifest } = context;

  // 1. Contract Approval Check (Must be APPROVED from governed state, not text)
  const contractStatus =
    context.sourceContract?.status ||
    testDefinition.sourceContractStatus ||
    manifest.canonicalTestDefinition.sourceContractStatus;

  if (contractStatus !== 'APPROVED') {
    issues.push({
      field: 'canonicalTestDefinition.sourceContractStatus',
      expected: 'APPROVED',
      actual: contractStatus,
      description: 'Preflight manifest requires an APPROVED source contract from governed state.'
    });
  }

  if (!manifest.preflightChecks.contractApproved) {
    issues.push({
      field: 'preflightChecks.contractApproved',
      expected: true,
      actual: false,
      description: 'preflightChecks.contractApproved must be true.'
    });
  }

  // 2. Test Definition Bindings
  if (manifest.canonicalTestDefinition.id !== testDefinition.id) {
    issues.push({
      field: 'canonicalTestDefinition.id',
      expected: testDefinition.id,
      actual: manifest.canonicalTestDefinition.id,
      description: 'Preflight manifest Test Definition ID does not match compiled Test Definition.'
    });
  }

  if (manifest.canonicalTestDefinition.version !== testDefinition.version) {
    issues.push({
      field: 'canonicalTestDefinition.version',
      expected: testDefinition.version,
      actual: manifest.canonicalTestDefinition.version,
      description: 'Preflight manifest Test Definition version mismatch.'
    });
  }

  if (manifest.canonicalTestDefinition.fingerprint !== testDefinition.fingerprint) {
    issues.push({
      field: 'canonicalTestDefinition.fingerprint',
      expected: testDefinition.fingerprint,
      actual: manifest.canonicalTestDefinition.fingerprint,
      description: 'Preflight manifest Test Definition fingerprint drift detected.'
    });
  }

  if (manifest.canonicalTestDefinition.sourceContractId !== testDefinition.sourceContractId) {
    issues.push({
      field: 'canonicalTestDefinition.sourceContractId',
      expected: testDefinition.sourceContractId,
      actual: manifest.canonicalTestDefinition.sourceContractId,
      description: 'Source contract ID binding drift detected.'
    });
  }

  if (
    manifest.canonicalTestDefinition.sourceContractFingerprint !==
    testDefinition.sourceContractFingerprint
  ) {
    issues.push({
      field: 'canonicalTestDefinition.sourceContractFingerprint',
      expected: testDefinition.sourceContractFingerprint,
      actual: manifest.canonicalTestDefinition.sourceContractFingerprint,
      description: 'Source contract fingerprint drift detected.'
    });
  }

  // 3. k6 Runtime & Bundle Bindings
  if (manifest.k6Runtime.version !== bundle.runtimeVersion) {
    issues.push({
      field: 'k6Runtime.version',
      expected: bundle.runtimeVersion,
      actual: manifest.k6Runtime.version,
      description: 'k6 runtime version mismatch.'
    });
  }

  if (manifest.k6Runtime.sourceId !== bundle.runtimeSourceId) {
    issues.push({
      field: 'k6Runtime.sourceId',
      expected: bundle.runtimeSourceId,
      actual: manifest.k6Runtime.sourceId,
      description: 'k6 runtime sourceId mismatch.'
    });
  }

  const expectedBundleFiles = bundle.files.map((f) => f.filename);
  const bundleFilesMatch =
    manifest.k6Runtime.bundleFiles.length === expectedBundleFiles.length &&
    manifest.k6Runtime.bundleFiles.every((f) => expectedBundleFiles.includes(f));

  if (!bundleFilesMatch) {
    issues.push({
      field: 'k6Runtime.bundleFiles',
      expected: expectedBundleFiles,
      actual: manifest.k6Runtime.bundleFiles,
      description: 'k6 runtime bundle files list does not match compiled bundle.'
    });
  }

  if (manifest.k6Runtime.bundleFingerprint !== bundle.fingerprint) {
    issues.push({
      field: 'k6Runtime.bundleFingerprint',
      expected: bundle.fingerprint,
      actual: manifest.k6Runtime.bundleFingerprint,
      description: 'k6 execution bundle fingerprint drift detected.'
    });
  }

  if (manifest.k6Runtime.testDefinitionFingerprint !== bundle.testDefinitionFingerprint) {
    issues.push({
      field: 'k6Runtime.testDefinitionFingerprint',
      expected: bundle.testDefinitionFingerprint,
      actual: manifest.k6Runtime.testDefinitionFingerprint,
      description: 'k6 bundle test definition fingerprint carrier mismatch.'
    });
  }

  // 4. Acceptance Criteria & Thresholds Binding
  for (const thresh of manifest.expectedHealthyThresholds) {
    const matchingCriterion = testDefinition.executableCriteria.find(
      (c) => c.id === thresh.criterionId
    );

    if (!matchingCriterion) {
      issues.push({
        field: `expectedHealthyThresholds.${thresh.criterionId}`,
        expected: 'Valid approved contract criterion ID',
        actual: thresh.criterionId,
        description: `Criterion ID "${thresh.criterionId}" in preflight manifest is not in approved contract executable criteria.`
      });
      continue;
    }

    if (thresh.unit === 'percentage' && thresh.metric === 'http_req_failed') {
      issues.push({
        field: `expectedHealthyThresholds.${thresh.criterionId}.unit`,
        expected: 'rate or fraction',
        actual: thresh.unit,
        description: 'Error rate threshold unit must be semantically represented as rate/fraction, not percentage.'
      });
    }

    const providerThresholdsForMetric = bundle.options.thresholds[thresh.metric];
    if (!providerThresholdsForMetric || !providerThresholdsForMetric.includes(thresh.expression)) {
      issues.push({
        field: `expectedHealthyThresholds.${thresh.criterionId}.expression`,
        expected: providerThresholdsForMetric,
        actual: thresh.expression,
        description: `Threshold expression "${thresh.expression}" for metric "${thresh.metric}" not found in compiled bundle options.`
      });
    }
  }

  // 5. Governed Workload & Population Relationship
  const scenario = testDefinition.scenarios[0];
  const schedule = scenario?.workloadSchedule;
  const popRel = testDefinition.populationRelationship;

  if (schedule && manifest.governedWorkload.schedulerPeakRate.value !== schedule.peakArrivalRate) {
    issues.push({
      field: 'governedWorkload.schedulerPeakRate.value',
      expected: schedule.peakArrivalRate,
      actual: manifest.governedWorkload.schedulerPeakRate.value,
      description: 'Scheduler peak rate value mismatch.'
    });
  }

  if (schedule && manifest.governedWorkload.schedulerPeakRate.unit !== schedule.rateUnit) {
    issues.push({
      field: 'governedWorkload.schedulerPeakRate.unit',
      expected: schedule.rateUnit,
      actual: manifest.governedWorkload.schedulerPeakRate.unit,
      description: 'Scheduler peak rate unit mismatch.'
    });
  }

  if (schedule && manifest.governedWorkload.schedulerArrivalPopulation !== schedule.arrivalPopulation) {
    issues.push({
      field: 'governedWorkload.schedulerArrivalPopulation',
      expected: schedule.arrivalPopulation,
      actual: manifest.governedWorkload.schedulerArrivalPopulation,
      description: 'Scheduler arrival population mismatch.'
    });
  }

  if (
    testDefinition.workloadAttainment &&
    manifest.governedWorkload.businessWorkloadAttainment.targetValue !==
      testDefinition.workloadAttainment.targetValue
  ) {
    issues.push({
      field: 'governedWorkload.businessWorkloadAttainment.targetValue',
      expected: testDefinition.workloadAttainment.targetValue,
      actual: manifest.governedWorkload.businessWorkloadAttainment.targetValue,
      description: 'Business workload attainment target value mismatch.'
    });
  }

  if (popRel && manifest.governedWorkload.populationRelationship.id !== popRel.id) {
    issues.push({
      field: 'governedWorkload.populationRelationship.id',
      expected: popRel.id,
      actual: manifest.governedWorkload.populationRelationship.id,
      description: 'Population relationship ID mismatch.'
    });
  }

  // 6. Credential References
  for (const ref of testDefinition.credentialReferences) {
    const bound = manifest.credentialBindings.requiredReferences.find(
      (r) => r.referenceId === ref.referenceId
    );
    if (!bound) {
      issues.push({
        field: `credentialBindings.requiredReferences.${ref.referenceId}`,
        expected: ref.referenceId,
        actual: undefined,
        description: `Required credential reference "${ref.referenceId}" not bound in preflight manifest.`
      });
    }
  }

  // 7. Route Manifest Version & Semantic Alignment (if routes are provided in context)
  if (manifest.routeManifestVersion !== referenceLabManifest.version) {
    issues.push({
      field: 'routeManifestVersion',
      expected: referenceLabManifest.version,
      actual: manifest.routeManifestVersion,
      description: 'Route manifest version mismatch.'
    });
  }

  if (referenceLabManifest.routes) {
    const canonicalJourneys = testDefinition.journeys || scenario?.journeyDistribution || [];
    for (const journey of canonicalJourneys) {
      for (const step of journey.steps) {
        const route = referenceLabManifest.routes.find(
          (r) =>
            r.method.toUpperCase() === step.method.toUpperCase() &&
            (r.path === step.path || step.path.startsWith(r.path.split('?')[0]))
        );
        if (!route) {
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}`,
            expected: 'Matching route in Reference Lab manifest',
            actual: undefined,
            description: `Required journey step ${step.method} ${step.path} missing from Reference Lab route manifest.`
          });
          continue;
        }

        if (step.expectedStatusCode !== undefined && route.expectedStatus !== step.expectedStatusCode) {
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}.expectedStatus`,
            expected: step.expectedStatusCode,
            actual: route.expectedStatus,
            description: `Expected status mismatch for ${step.method} ${step.path}.`
          });
        }
      }
    }
  }

  // 8. Target Resolvability Evidence
  if (manifest.preflightChecks.targetResolvable) {
    if (!context.targetProbe) {
      issues.push({
        field: 'preflightChecks.targetResolvable',
        expected: 'Supplied verified targetProbe evidence',
        actual: undefined,
        description: 'Preflight manifest asserts targetResolvable=true without supplied verified probe evidence.'
      });
    } else if (
      !context.targetProbe.isResolvable ||
      context.targetProbe.healthStatus !== 'healthy' ||
      context.targetProbe.readyStatus !== 'ready'
    ) {
      issues.push({
        field: 'preflightChecks.targetResolvable',
        expected: 'isResolvable=true, healthStatus="healthy", readyStatus="ready"',
        actual: `isResolvable=${context.targetProbe.isResolvable}, health=${context.targetProbe.healthStatus}, ready=${context.targetProbe.readyStatus}`,
        description: 'Target probe evidence indicates target is not healthy/ready or not resolvable.'
      });
    }
  }

  // 9. Live Execution Gate
  if (context.liveExecutionStarted || !manifest.preflightChecks.liveExecutionNotStarted) {
    issues.push({
      field: 'preflightChecks.liveExecutionNotStarted',
      expected: true,
      actual: false,
      description: 'Live execution must not have started during preflight gate validation.'
    });
  }

  const isValid = issues.length === 0 && manifest.status === 'READY_FOR_LIVE_EXECUTION';

  return {
    isValid,
    status: isValid ? 'READY_FOR_LIVE_EXECUTION' : 'PREFLIGHT_BLOCKED',
    issues
  };
}
