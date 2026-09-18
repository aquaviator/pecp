import {
  TestDefinition,
  K6ExecutionBundle,
  PerformanceContract,
  JourneyStep,
  computeContractFingerprint
} from '@pecp/pe-domain';

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
  httpStatusHealth: number;
  httpStatusReady: number;
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
  clock?: () => string;
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
 * Normalizes URL path by removing query parameters and trailing slashes.
 */
export function normalizePath(p: string): string {
  if (!p) return '/';
  const withoutQuery = p.split('?')[0];
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Normalizes URL origin for exact target environment comparison.
 */
export function normalizeOrigin(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const u = new URL(urlStr);
    return u.origin.toLowerCase();
  } catch {
    return urlStr.replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Builds a strictly source-driven ExecutionPreflightManifest bound directly to
 * compiled TestDefinition, K6ExecutionBundle, Reference Lab route manifest, and
 * verified TargetProbeResult.
 *
 * Enforces M3.1A.3 Preflight Binding Completeness Gate:
 * 1. Zero residual authority fallbacks (explicit timestamp, runtime version, source id, lab metadata).
 * 2. Exact source-contract identity binding (id, version, deterministic non-cryptographic fingerprint, status).
 * 3. Exact threshold set completeness and source-contract binding.
 * 4. Full governed workload binding (arrival population, peak rate, attainment, population relationship).
 * 5. Exact credential binding derived from canonical journey steps.
 * 6. Exact normalized route semantics (methods, paths, statuses, auth, payload, business events).
 * 7. Probe evidence strictly bound to exact target URL with HTTP 200 health/ready proofs.
 * 8. READY_FOR_LIVE_EXECUTION law: any missing proof emits PREFLIGHT_BLOCKED.
 */
export function buildExecutionPreflightManifest(
  options: BuildPreflightManifestOptions
): ExecutionPreflightManifest {
  const { testDefinition, bundle, referenceLabManifest } = options;
  const issues: PreflightValidationIssue[] = [];

  // 1. Mandatory Explicit Timestamp (NO fallback default)
  const timestamp = options.preflightTimestamp || (options.clock ? options.clock() : '');
  if (!timestamp) {
    issues.push({
      field: 'preflightTimestamp',
      expected: 'Explicit ISO timestamp or injected clock',
      actual: undefined,
      description: 'Preflight timestamp must be explicitly supplied; no fallback timestamp allowed.'
    });
  }

  // 2. Reference Lab Metadata Binding (NO hard-coded strings or fallbacks)
  if (!referenceLabManifest?.service) {
    issues.push({
      field: 'referenceLabManifest.service',
      expected: 'Defined service name in Reference Lab manifest',
      actual: referenceLabManifest?.service,
      description: 'Reference Lab service name is missing; no fallback allowed.'
    });
  }

  if (!referenceLabManifest?.version) {
    issues.push({
      field: 'referenceLabManifest.version',
      expected: 'Defined version in Reference Lab manifest',
      actual: referenceLabManifest?.version,
      description: 'Reference Lab version is missing; no fallback allowed.'
    });
  }

  // 3. k6 Runtime Version & Source ID (NO PECP constants as fallback)
  if (!bundle.runtimeVersion) {
    issues.push({
      field: 'k6Runtime.version',
      expected: 'Defined runtimeVersion on compiled bundle',
      actual: bundle.runtimeVersion,
      description: 'k6 runtime version must be provided by the bundle; no fallback allowed.'
    });
  }

  if (!bundle.runtimeSourceId) {
    issues.push({
      field: 'k6Runtime.sourceId',
      expected: 'Defined runtimeSourceId on compiled bundle',
      actual: bundle.runtimeSourceId,
      description: 'k6 runtime sourceId must be provided by the bundle; no fallback allowed.'
    });
  }

  // 4. Contract Approval Binding & Identity Integrity
  let isContractApproved = false;
  let contractStatus = testDefinition.sourceContractStatus || '';

  if (options.sourceContract) {
    const sc = options.sourceContract;
    contractStatus = sc.status;

    if (sc.id !== testDefinition.sourceContractId) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractId',
        expected: testDefinition.sourceContractId,
        actual: sc.id,
        description: `Supplied source contract ID "${sc.id}" does not match Test Definition sourceContractId "${testDefinition.sourceContractId}".`
      });
    }

    if (sc.version !== testDefinition.sourceContractVersion) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractVersion',
        expected: testDefinition.sourceContractVersion,
        actual: sc.version,
        description: `Supplied source contract version "${sc.version}" does not match Test Definition sourceContractVersion "${testDefinition.sourceContractVersion}".`
      });
    }

    const computedFp = computeContractFingerprint(sc);
    if (computedFp !== testDefinition.sourceContractFingerprint) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractFingerprint',
        expected: testDefinition.sourceContractFingerprint,
        actual: computedFp,
        description: `Supplied source contract fingerprint "${computedFp}" does not match Test Definition sourceContractFingerprint "${testDefinition.sourceContractFingerprint}".`
      });
    }

    if (sc.status !== 'APPROVED') {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractStatus',
        expected: 'APPROVED',
        actual: sc.status,
        description: `Supplied source contract status is "${sc.status}", not APPROVED. Contract approval must be proven from governed state.`
      });
    }

    isContractApproved =
      sc.status === 'APPROVED' &&
      sc.id === testDefinition.sourceContractId &&
      sc.version === testDefinition.sourceContractVersion &&
      computedFp === testDefinition.sourceContractFingerprint;
  } else {
    isContractApproved = contractStatus === 'APPROVED';
    if (!isContractApproved) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractStatus',
        expected: 'APPROVED',
        actual: contractStatus || 'UNDEFINED',
        description: `Source contract status is "${contractStatus || 'UNDEFINED'}", not APPROVED. Contract approval must be proven from governed state.`
      });
    }
  }

  // 5. Test Definition & k6 Bundle Executability
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

  // 6. Expected Healthy Thresholds (Set completeness & source contract binding)
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

      // If sourceContract provided, verify criterion originates from sourceContract.acceptanceCriteria
      if (options.sourceContract) {
        const scCriterion = options.sourceContract.acceptanceCriteria.find((ac) => ac.id === crit.id);
        if (!scCriterion) {
          thresholdsBoundToApprovedContract = false;
          issues.push({
            field: `executableCriteria.${crit.id}`,
            expected: 'Criterion defined in approved sourceContract',
            actual: undefined,
            description: `Criterion "${crit.id}" does not originate from approved source contract.`
          });
        } else {
          if (scCriterion.operator !== crit.operator) {
            thresholdsBoundToApprovedContract = false;
            issues.push({
              field: `executableCriteria.${crit.id}.operator`,
              expected: scCriterion.operator,
              actual: crit.operator,
              description: `Criterion "${crit.id}" operator mismatch with source contract.`
            });
          }
          if (scCriterion.thresholdValue !== undefined && scCriterion.thresholdValue !== crit.thresholdValue) {
            thresholdsBoundToApprovedContract = false;
            issues.push({
              field: `executableCriteria.${crit.id}.thresholdValue`,
              expected: scCriterion.thresholdValue,
              actual: crit.thresholdValue,
              description: `Criterion "${crit.id}" thresholdValue mismatch with source contract.`
            });
          }
          if (scCriterion.percentile !== undefined && scCriterion.percentile !== crit.percentile) {
            thresholdsBoundToApprovedContract = false;
            issues.push({
              field: `executableCriteria.${crit.id}.percentile`,
              expected: scCriterion.percentile,
              actual: crit.percentile,
              description: `Criterion "${crit.id}" percentile mismatch with source contract.`
            });
          }
        }
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

  // 7. Governed Workload & Population Semantics
  const scenario = testDefinition.scenarios?.[0];
  const schedule = scenario?.workloadSchedule;
  const popRel = testDefinition.populationRelationship;
  const attainment = testDefinition.workloadAttainment;
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
    !popRel.formulaIdentifier ||
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
      expected: 'Defined WorkloadPopulationRelationship with valid formulaIdentifier, relevantJourneyKey, positive journeyShare, and positive contribution',
      actual: popRel,
      description: 'Population relationship is missing or incomplete; no fallback allowed.'
    });
  }

  // Derive business metric entity from unit or metric (e.g. 'orders' from 'orders/second')
  const attainmentMetricEntity = attainment?.unit
    ? attainment.unit.split('/')[0].trim()
    : attainment?.metric || '';

  const checkoutContributionText =
    popRel && attainmentMetricEntity
      ? `${popRel.contributionPerSuccessfulEvent} ${attainmentMetricEntity.endsWith('s') ? attainmentMetricEntity.slice(0, -1) : attainmentMetricEntity}`
      : '';

  const governedWorkload: PreflightGovernedWorkload = {
    schedulerArrivalPopulation: schedule?.arrivalPopulation || '',
    schedulerPeakRate: {
      value: schedule?.peakArrivalRate ?? 0,
      unit: schedule?.rateUnit || ''
    },
    businessWorkloadAttainment: {
      metric: attainmentMetricEntity,
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
    checkoutContribution: checkoutContributionText
  };

  // 8. Semantic Reference Lab Route Alignment (Exact normalized paths, no prefix false positives)
  let referenceLabRoutesVerified = true;
  const canonicalJourneys = testDefinition.journeys || scenario?.journeyDistribution || [];

  for (const journey of canonicalJourneys) {
    for (const step of journey.steps) {
      const stepNormPath = normalizePath(step.path);
      const route = referenceLabManifest.routes.find(
        (r) =>
          r.method.toUpperCase() === step.method.toUpperCase() &&
          normalizePath(r.path) === stepNormPath
      );

      if (!route) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}`,
          expected: `Exact route matching ${step.method} ${stepNormPath} in Reference Lab manifest`,
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

      // Assert payload requirement semantics in BOTH directions
      const stepRequiresPayload =
        Boolean(step.requestPayload) || ['POST', 'PUT', 'PATCH'].includes(step.method.toUpperCase());
      const routeRequiresPayload = Boolean(route.payloadRequired);
      if (stepRequiresPayload !== routeRequiresPayload) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}.payloadRequired`,
          expected: stepRequiresPayload,
          actual: routeRequiresPayload,
          description: `Route ${step.method} ${step.path} payload requirement mismatch: step requires payload=${stepRequiresPayload}, lab specifies payloadRequired=${routeRequiresPayload}.`
        });
      }

      // Assert auth requirement semantics in BOTH directions
      const stepRequiresAuth = Boolean(step.credentialReferences && step.credentialReferences.length > 0);
      const routeRequiresAuth = Boolean(route.authRequired);
      if (stepRequiresAuth !== routeRequiresAuth) {
        referenceLabRoutesVerified = false;
        issues.push({
          field: `referenceLabRoutes.${step.method}_${step.path}.authRequired`,
          expected: stepRequiresAuth,
          actual: routeRequiresAuth,
          description: `Route ${step.method} ${step.path} auth requirement mismatch: step references credentials=${stepRequiresAuth}, lab specifies authRequired=${routeRequiresAuth}.`
        });
      }

      // Assert business event contribution semantics
      if (step.businessEventContribution || route.businessEventContribution) {
        if (!step.businessEventContribution) {
          referenceLabRoutesVerified = false;
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution`,
            expected: undefined,
            actual: route.businessEventContribution,
            description: `Lab route ${step.method} ${step.path} specifies business event contribution but journey step does not.`
          });
        } else if (!route.businessEventContribution) {
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
          if (rEvt.eventKey !== sEvt.eventKey) {
            referenceLabRoutesVerified = false;
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.eventKey`,
              expected: sEvt.eventKey,
              actual: rEvt.eventKey,
              description: `Route ${step.method} ${step.path} business event key mismatch.`
            });
          }
          if (rEvt.metric !== sEvt.metric) {
            referenceLabRoutesVerified = false;
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.metric`,
              expected: sEvt.metric,
              actual: rEvt.metric,
              description: `Route ${step.method} ${step.path} business event metric mismatch.`
            });
          }
          if (rEvt.unit !== sEvt.unit) {
            referenceLabRoutesVerified = false;
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.unit`,
              expected: sEvt.unit,
              actual: rEvt.unit,
              description: `Route ${step.method} ${step.path} business event unit mismatch.`
            });
          }
          if (rEvt.contribution !== sEvt.contribution) {
            referenceLabRoutesVerified = false;
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.contribution`,
              expected: sEvt.contribution,
              actual: rEvt.contribution,
              description: `Route ${step.method} ${step.path} business event contribution value mismatch.`
            });
          }
          if (rEvt.expectedStatus !== sEvt.expectedStatus) {
            referenceLabRoutesVerified = false;
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.expectedStatus`,
              expected: sEvt.expectedStatus,
              actual: rEvt.expectedStatus,
              description: `Route ${step.method} ${step.path} business event expectedStatus mismatch.`
            });
          }
        }
      }

      // Where JSON_LITERAL payload is governed and route declares requiredPayloadFields, verify presence
      if (
        step.requestPayload?.type === 'JSON_LITERAL' &&
        route.requiredPayloadFields &&
        route.requiredPayloadFields.length > 0
      ) {
        let parsedPayload: Record<string, unknown> | null = null;
        try {
          const content = step.requestPayload.value;
          if (typeof content === 'string') {
            parsedPayload = JSON.parse(content);
          } else if (typeof content === 'object' && content !== null) {
            parsedPayload = content as Record<string, unknown>;
          }
        } catch {
          parsedPayload = null;
        }

        if (!parsedPayload) {
          referenceLabRoutesVerified = false;
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}.requiredPayloadFields`,
            expected: route.requiredPayloadFields,
            actual: step.requestPayload.value,
            description: `Could not parse JSON_LITERAL payload for ${step.method} ${step.path} to verify required payload fields.`
          });
        } else {
          for (const reqField of route.requiredPayloadFields) {
            if (!(reqField in parsedPayload)) {
              referenceLabRoutesVerified = false;
              issues.push({
                field: `referenceLabRoutes.${step.method}_${step.path}.requiredPayloadFields.${reqField}`,
                expected: `Field "${reqField}" present in payload`,
                actual: undefined,
                description: `Required payload field "${reqField}" missing in step ${step.method} ${step.path} JSON_LITERAL payload.`
              });
            }
          }
        }
      }
    }
  }

  const referenceLabManifestAligned = Boolean(
    referenceLabManifest.service &&
    referenceLabManifest.version &&
    referenceLabManifest.routes &&
    referenceLabManifest.routes.length > 0 &&
    referenceLabRoutesVerified
  );

  // 9. Exact Credential Binding (Derived from canonical journey steps, no orphans)
  let credentialBindingsDefined = true;
  const stepCredMap = new Map<string, { step: JourneyStep; journey: unknown }>();

  for (const journey of canonicalJourneys) {
    for (const step of journey.steps) {
      if (step.credentialReferences) {
        for (const cr of step.credentialReferences) {
          stepCredMap.set(cr.referenceId, { step, journey });
        }
      }
    }
  }

  // Prove every step credential is represented in top-level registry
  for (const [refId, { step }] of stepCredMap.entries()) {
    const reg = testDefinition.credentialReferences.find((r) => r.referenceId === refId);
    if (!reg) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialReferences.${refId}`,
        expected: 'Represented in testDefinition.credentialReferences registry',
        actual: undefined,
        description: `Journey step ${step.method} ${step.path} references credential "${refId}" which is missing from Test Definition credential registry.`
      });
    }
  }

  // Prove no orphan credential in registry: every registry credential must be used by at least one journey step
  for (const reg of testDefinition.credentialReferences) {
    if (!stepCredMap.has(reg.referenceId)) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialReferences.${reg.referenceId}`,
        expected: 'Referenced by at least one canonical journey step',
        actual: 'Orphan credential',
        description: `Credential reference "${reg.referenceId}" is defined in Test Definition registry but not bound to any canonical journey step.`
      });
    }
  }

  const derivedCredentialReferences: Array<{
    provider: string;
    referenceId: string;
    purpose: string;
    enforcedRoute: string;
    enforcedScheme: string;
  }> = [];

  for (const [refId, { step }] of stepCredMap.entries()) {
    const reg = testDefinition.credentialReferences.find((r) => r.referenceId === refId);
    if (!reg) continue;

    const stepNormPath = normalizePath(step.path);
    const matchingRoute = referenceLabManifest.routes.find(
      (r) =>
        r.method.toUpperCase() === step.method.toUpperCase() &&
        normalizePath(r.path) === stepNormPath
    );

    if (!matchingRoute) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${refId}.enforcedRoute`,
        expected: `Reference lab route matching step ${step.method} ${step.path}`,
        actual: undefined,
        description: `No Reference Lab route found for credential-referenced step ${step.method} ${step.path}.`
      });
      continue;
    }

    if (!matchingRoute.authRequired) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${refId}.authRequired`,
        expected: true,
        actual: matchingRoute.authRequired,
        description: `Reference Lab route ${matchingRoute.method} ${matchingRoute.path} does not require auth, but step references credentials.`
      });
      continue;
    }

    if (!matchingRoute.authScheme) {
      credentialBindingsDefined = false;
      issues.push({
        field: `credentialBindings.${refId}.enforcedScheme`,
        expected: 'Defined authScheme in route manifest',
        actual: undefined,
        description: `Reference Lab route ${matchingRoute.method} ${matchingRoute.path} does not specify an authScheme.`
      });
      continue;
    }

    derivedCredentialReferences.push({
      provider: reg.provider,
      referenceId: refId,
      purpose: reg.purpose,
      enforcedRoute: matchingRoute.path,
      enforcedScheme: matchingRoute.authScheme
    });
  }

  const credentialBindings: PreflightCredentialBindings = {
    requiredReferences: derivedCredentialReferences,
    ephemeralAtRuntime: true,
    noHardcodedSecrets: true
  };

  // 10. Target Resolvability Evidence & Exact Target Origin Binding
  const probe = options.targetProbe;
  const targetBaseUrlRef = scenario?.targetEnvironmentBaseUrlRef;
  let isTargetResolvable = false;

  if (!probe) {
    issues.push({
      field: 'preflightChecks.targetResolvable',
      expected: 'Explicit verified probe result with isResolvable=true, healthStatus="healthy", readyStatus="ready"',
      actual: undefined,
      description: 'Target resolvability cannot be asserted without explicit verified probe evidence.'
    });
  } else {
    const expectedOrigin = normalizeOrigin(targetBaseUrlRef || '');
    const probeOrigin = normalizeOrigin(probe.baseUrl);

    if (expectedOrigin && probeOrigin && expectedOrigin !== probeOrigin) {
      issues.push({
        field: 'targetProbe.baseUrl',
        expected: expectedOrigin,
        actual: probeOrigin,
        description: `Probe base URL origin "${probeOrigin}" does not match Test Definition target environment origin "${expectedOrigin}".`
      });
    }

    if (probe.httpStatusHealth !== 200) {
      issues.push({
        field: 'targetProbe.httpStatusHealth',
        expected: 200,
        actual: probe.httpStatusHealth,
        description: `Target /health endpoint returned HTTP status ${probe.httpStatusHealth}, expected 200.`
      });
    }

    if (probe.httpStatusReady !== 200) {
      issues.push({
        field: 'targetProbe.httpStatusReady',
        expected: 200,
        actual: probe.httpStatusReady,
        description: `Target /ready endpoint returned HTTP status ${probe.httpStatusReady}, expected 200.`
      });
    }

    if (probe.healthStatus !== 'healthy') {
      issues.push({
        field: 'targetProbe.healthStatus',
        expected: 'healthy',
        actual: probe.healthStatus,
        description: `Target healthStatus is "${probe.healthStatus}", expected "healthy".`
      });
    }

    if (probe.readyStatus !== 'ready') {
      issues.push({
        field: 'targetProbe.readyStatus',
        expected: 'ready',
        actual: probe.readyStatus,
        description: `Target readyStatus is "${probe.readyStatus}", expected "ready".`
      });
    }

    if (!probe.isResolvable) {
      issues.push({
        field: 'targetProbe.isResolvable',
        expected: true,
        actual: probe.isResolvable,
        description: 'Target probe indicates target is not resolvable.'
      });
    }

    isTargetResolvable =
      Boolean(expectedOrigin && probeOrigin && expectedOrigin === probeOrigin) &&
      probe.isResolvable === true &&
      probe.healthStatus === 'healthy' &&
      probe.readyStatus === 'ready' &&
      probe.httpStatusHealth === 200 &&
      probe.httpStatusReady === 200;
  }

  const rawTargetUrl = targetBaseUrlRef || probe?.baseUrl;
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

  // 11. Live Execution Guard
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
    preflightChecks.contractApproved === true &&
    preflightChecks.testDefinitionCompiled === true &&
    preflightChecks.k6BundleCompiled === true &&
    preflightChecks.referenceLabManifestAligned === true &&
    preflightChecks.referenceLabRoutesVerified === true &&
    preflightChecks.credentialBindingsDefined === true &&
    preflightChecks.populationSemanticsHardened === true &&
    preflightChecks.thresholdsBoundToApprovedContract === true &&
    preflightChecks.targetResolvable === true &&
    preflightChecks.liveExecutionNotStarted === true &&
    issues.length === 0;

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    manifestType: 'M3_EXECUTION_PREFLIGHT',
    milestone: 'M3.1A',
    service: referenceLabManifest.service || '',
    serviceVersion: referenceLabManifest.version || '',
    routeManifestVersion: referenceLabManifest.version || '',
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
      version: bundle.runtimeVersion || '',
      sourceId: bundle.runtimeSourceId || '',
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
 *
 * Enforces M3.1A.3 Preflight Binding Completeness Gate:
 * 1. Independently verifies every preflightChecks boolean.
 * 2. Exact source contract identity and governed status.
 * 3. Exact threshold set completeness (no missing, no duplicate, no unknown thresholds).
 * 4. Full governed workload binding (arrival population, peak rate, attainment, population relationship).
 * 5. Exact credential binding (no orphan top-level credentials, route/scheme alignment).
 * 6. Exact normalized route semantics (methods, paths, statuses, auth, payload, business events).
 * 7. Exact target environment origin matching and verified probe evidence.
 */
export function validateExecutionPreflightManifest(
  manifest: ExecutionPreflightManifest,
  context: PreflightValidationContext
): PreflightValidationResult {
  const issues: PreflightValidationIssue[] = [];
  const { testDefinition, bundle, referenceLabManifest } = context;

  // 1. Enforce Every Preflight Check Boolean Independently
  const checkKeys: (keyof PreflightChecks)[] = [
    'contractApproved',
    'testDefinitionCompiled',
    'k6BundleCompiled',
    'referenceLabManifestAligned',
    'referenceLabRoutesVerified',
    'credentialBindingsDefined',
    'populationSemanticsHardened',
    'thresholdsBoundToApprovedContract',
    'targetResolvable',
    'liveExecutionNotStarted'
  ];

  for (const checkKey of checkKeys) {
    if (manifest.preflightChecks[checkKey] !== true) {
      issues.push({
        field: `preflightChecks.${checkKey}`,
        expected: true,
        actual: manifest.preflightChecks[checkKey],
        description: `Preflight check "${checkKey}" is not true.`
      });
    }
  }

  // 2. Source Contract Identity & Governed State Check
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

  if (context.sourceContract) {
    const sc = context.sourceContract;
    if (sc.id !== testDefinition.sourceContractId) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractId',
        expected: testDefinition.sourceContractId,
        actual: sc.id,
        description: `Supplied source contract ID "${sc.id}" does not match Test Definition sourceContractId "${testDefinition.sourceContractId}".`
      });
    }
    if (manifest.canonicalTestDefinition.sourceContractId !== sc.id) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractId',
        expected: sc.id,
        actual: manifest.canonicalTestDefinition.sourceContractId,
        description: `Manifest sourceContractId "${manifest.canonicalTestDefinition.sourceContractId}" does not match supplied source contract ID "${sc.id}".`
      });
    }

    if (sc.version !== testDefinition.sourceContractVersion) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractVersion',
        expected: testDefinition.sourceContractVersion,
        actual: sc.version,
        description: `Supplied source contract version "${sc.version}" does not match Test Definition sourceContractVersion "${testDefinition.sourceContractVersion}".`
      });
    }
    if (manifest.canonicalTestDefinition.sourceContractVersion !== sc.version) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractVersion',
        expected: sc.version,
        actual: manifest.canonicalTestDefinition.sourceContractVersion,
        description: `Manifest sourceContractVersion "${manifest.canonicalTestDefinition.sourceContractVersion}" does not match supplied source contract version "${sc.version}".`
      });
    }

    const computedContractFp = computeContractFingerprint(sc);
    if (computedContractFp !== testDefinition.sourceContractFingerprint) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractFingerprint',
        expected: testDefinition.sourceContractFingerprint,
        actual: computedContractFp,
        description: `Supplied source contract fingerprint "${computedContractFp}" does not match Test Definition sourceContractFingerprint "${testDefinition.sourceContractFingerprint}".`
      });
    }
    if (manifest.canonicalTestDefinition.sourceContractFingerprint !== computedContractFp) {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractFingerprint',
        expected: computedContractFp,
        actual: manifest.canonicalTestDefinition.sourceContractFingerprint,
        description: `Manifest sourceContractFingerprint "${manifest.canonicalTestDefinition.sourceContractFingerprint}" does not match supplied source contract fingerprint "${computedContractFp}".`
      });
    }

    if (sc.status !== 'APPROVED') {
      issues.push({
        field: 'canonicalTestDefinition.sourceContractStatus',
        expected: 'APPROVED',
        actual: sc.status,
        description: `Supplied source contract status is "${sc.status}", not APPROVED.`
      });
    }
  }

  // 3. Test Definition Bindings
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

  // 4. k6 Runtime & Bundle Bindings
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

  // 5. Acceptance Criteria & Thresholds Binding (Exact Set Completeness)
  const manifestThreshMap = new Map<string, PreflightHealthyThreshold>();
  for (const t of manifest.expectedHealthyThresholds) {
    if (manifestThreshMap.has(t.criterionId)) {
      issues.push({
        field: `expectedHealthyThresholds.${t.criterionId}`,
        expected: 'Single unique threshold definition',
        actual: 'Duplicate threshold entry',
        description: `Duplicate threshold definition found for criterion "${t.criterionId}".`
      });
    }
    manifestThreshMap.set(t.criterionId, t);
  }

  // Verify every executable criterion is represented in manifest thresholds
  for (const crit of testDefinition.executableCriteria) {
    const thresh = manifestThreshMap.get(crit.id);
    if (!thresh) {
      issues.push({
        field: `expectedHealthyThresholds.${crit.id}`,
        expected: `Defined threshold for criterion "${crit.id}"`,
        actual: undefined,
        description: `Executable criterion "${crit.id}" is missing from preflight threshold bindings.`
      });
      continue;
    }

    if (thresh.operator !== crit.operator) {
      issues.push({
        field: `expectedHealthyThresholds.${crit.id}.operator`,
        expected: crit.operator,
        actual: thresh.operator,
        description: `Operator mismatch for criterion "${crit.id}".`
      });
    }

    if (thresh.threshold !== crit.thresholdValue) {
      issues.push({
        field: `expectedHealthyThresholds.${crit.id}.threshold`,
        expected: crit.thresholdValue,
        actual: thresh.threshold,
        description: `Threshold value mismatch for criterion "${crit.id}".`
      });
    }

    const expectedUnit = (crit.metric.toLowerCase().includes('error') || crit.metric.toLowerCase().includes('fail'))
      ? 'rate'
      : crit.unit;

    if (thresh.unit !== expectedUnit) {
      issues.push({
        field: `expectedHealthyThresholds.${crit.id}.unit`,
        expected: expectedUnit,
        actual: thresh.unit,
        description: `Unit mismatch for criterion "${crit.id}".`
      });
    }

    if (thresh.unit === 'percentage' && thresh.metric === 'http_req_failed') {
      issues.push({
        field: `expectedHealthyThresholds.${crit.id}.unit`,
        expected: 'rate or fraction',
        actual: thresh.unit,
        description: 'Error rate threshold unit must be semantically represented as rate/fraction, not percentage.'
      });
    }

    const providerThresholdsForMetric = bundle.options.thresholds[thresh.metric];
    if (!providerThresholdsForMetric || !providerThresholdsForMetric.includes(thresh.expression)) {
      issues.push({
        field: `expectedHealthyThresholds.${crit.id}.expression`,
        expected: providerThresholdsForMetric,
        actual: thresh.expression,
        description: `Threshold expression "${thresh.expression}" for metric "${thresh.metric}" not found in compiled bundle options.`
      });
    }
  }

  // Verify no extra or unknown criteria exist in manifest thresholds
  for (const t of manifest.expectedHealthyThresholds) {
    const matchingCrit = testDefinition.executableCriteria.find((c) => c.id === t.criterionId);
    if (!matchingCrit) {
      issues.push({
        field: `expectedHealthyThresholds.${t.criterionId}`,
        expected: 'Valid approved contract criterion ID',
        actual: t.criterionId,
        description: `Criterion ID "${t.criterionId}" in preflight manifest is not in approved contract executable criteria.`
      });
    }
  }

  // If sourceContract is supplied, verify criterion originates from approved contract
  if (context.sourceContract) {
    for (const crit of testDefinition.executableCriteria) {
      const scCriterion = context.sourceContract.acceptanceCriteria.find((ac) => ac.id === crit.id);
      if (!scCriterion) {
        issues.push({
          field: `executableCriteria.${crit.id}`,
          expected: 'Criterion defined in approved sourceContract',
          actual: undefined,
          description: `Executable criterion "${crit.id}" does not originate from approved source contract.`
        });
        continue;
      }
      if (scCriterion.operator !== crit.operator) {
        issues.push({
          field: `executableCriteria.${crit.id}.operator`,
          expected: scCriterion.operator,
          actual: crit.operator,
          description: `Criterion "${crit.id}" operator mismatch with source contract.`
        });
      }
      if (scCriterion.thresholdValue !== undefined && scCriterion.thresholdValue !== crit.thresholdValue) {
        issues.push({
          field: `executableCriteria.${crit.id}.thresholdValue`,
          expected: scCriterion.thresholdValue,
          actual: crit.thresholdValue,
          description: `Criterion "${crit.id}" thresholdValue mismatch with source contract.`
        });
      }
      if (scCriterion.percentile !== undefined && scCriterion.percentile !== crit.percentile) {
        issues.push({
          field: `executableCriteria.${crit.id}.percentile`,
          expected: scCriterion.percentile,
          actual: crit.percentile,
          description: `Criterion "${crit.id}" percentile mismatch with source contract.`
        });
      }
    }
  }

  // 6. Full Governed Workload Binding
  const scenario = testDefinition.scenarios[0];
  const schedule = scenario?.workloadSchedule;
  const popRel = testDefinition.populationRelationship;
  const attainment = testDefinition.workloadAttainment;
  const gw = manifest.governedWorkload;

  if (schedule) {
    if (gw.schedulerArrivalPopulation !== schedule.arrivalPopulation) {
      issues.push({
        field: 'governedWorkload.schedulerArrivalPopulation',
        expected: schedule.arrivalPopulation,
        actual: gw.schedulerArrivalPopulation,
        description: 'Scheduler arrival population mismatch.'
      });
    }
    if (gw.schedulerPeakRate.value !== schedule.peakArrivalRate) {
      issues.push({
        field: 'governedWorkload.schedulerPeakRate.value',
        expected: schedule.peakArrivalRate,
        actual: gw.schedulerPeakRate.value,
        description: 'Scheduler peak rate value mismatch.'
      });
    }
    if (gw.schedulerPeakRate.unit !== schedule.rateUnit) {
      issues.push({
        field: 'governedWorkload.schedulerPeakRate.unit',
        expected: schedule.rateUnit,
        actual: gw.schedulerPeakRate.unit,
        description: 'Scheduler peak rate unit mismatch.'
      });
    }
  }

  if (attainment) {
    const expectedMetricEntity = attainment.unit ? attainment.unit.split('/')[0].trim() : attainment.metric;
    const isMetricAligned =
      gw.businessWorkloadAttainment.metric === expectedMetricEntity ||
      gw.businessWorkloadAttainment.metric === attainment.metric ||
      attainment.unit.toLowerCase().startsWith(gw.businessWorkloadAttainment.metric.toLowerCase());

    if (!isMetricAligned) {
      issues.push({
        field: 'governedWorkload.businessWorkloadAttainment.metric',
        expected: expectedMetricEntity,
        actual: gw.businessWorkloadAttainment.metric,
        description: 'Business workload attainment metric mismatch.'
      });
    }
    if (gw.businessWorkloadAttainment.targetValue !== attainment.targetValue) {
      issues.push({
        field: 'governedWorkload.businessWorkloadAttainment.targetValue',
        expected: attainment.targetValue,
        actual: gw.businessWorkloadAttainment.targetValue,
        description: 'Business workload attainment target value mismatch.'
      });
    }
    if (gw.businessWorkloadAttainment.unit !== attainment.unit) {
      issues.push({
        field: 'governedWorkload.businessWorkloadAttainment.unit',
        expected: attainment.unit,
        actual: gw.businessWorkloadAttainment.unit,
        description: 'Business workload attainment unit mismatch.'
      });
    }
  }

  if (popRel) {
    if (gw.populationRelationship.id !== popRel.id) {
      issues.push({
        field: 'governedWorkload.populationRelationship.id',
        expected: popRel.id,
        actual: gw.populationRelationship.id,
        description: 'Population relationship ID mismatch.'
      });
    }
    if (gw.populationRelationship.formulaIdentifier !== popRel.formulaIdentifier) {
      issues.push({
        field: 'governedWorkload.populationRelationship.formulaIdentifier',
        expected: popRel.formulaIdentifier,
        actual: gw.populationRelationship.formulaIdentifier,
        description: 'Population relationship formulaIdentifier mismatch.'
      });
    }
    if (gw.populationRelationship.relevantJourneyKey !== popRel.relevantJourneyKey) {
      issues.push({
        field: 'governedWorkload.populationRelationship.relevantJourneyKey',
        expected: popRel.relevantJourneyKey,
        actual: gw.populationRelationship.relevantJourneyKey,
        description: 'Population relationship relevantJourneyKey mismatch.'
      });
    }
    if (gw.populationRelationship.journeyShare !== popRel.journeyShare) {
      issues.push({
        field: 'governedWorkload.populationRelationship.journeyShare',
        expected: popRel.journeyShare,
        actual: gw.populationRelationship.journeyShare,
        description: 'Population relationship journeyShare mismatch.'
      });
    }
    if (gw.populationRelationship.contributionPerSuccessfulEvent !== popRel.contributionPerSuccessfulEvent) {
      issues.push({
        field: 'governedWorkload.populationRelationship.contributionPerSuccessfulEvent',
        expected: popRel.contributionPerSuccessfulEvent,
        actual: gw.populationRelationship.contributionPerSuccessfulEvent,
        description: 'Population relationship contributionPerSuccessfulEvent mismatch.'
      });
    }
    if (popRel.outputSchedulerRate && gw.populationRelationship.derivedSchedulerRate !== popRel.outputSchedulerRate.value) {
      issues.push({
        field: 'governedWorkload.populationRelationship.derivedSchedulerRate',
        expected: popRel.outputSchedulerRate.value,
        actual: gw.populationRelationship.derivedSchedulerRate,
        description: 'Population relationship derivedSchedulerRate mismatch.'
      });
    }
  }

  // 7. Exact Credential References Binding
  const canonicalJourneys = testDefinition.journeys || scenario?.journeyDistribution || [];
  const stepCredMap = new Map<string, { step: JourneyStep; journey: unknown }>();

  for (const journey of canonicalJourneys) {
    for (const step of journey.steps) {
      if (step.credentialReferences) {
        for (const cr of step.credentialReferences) {
          stepCredMap.set(cr.referenceId, { step, journey });
        }
      }
    }
  }

  // Prove every step credential is in top-level registry
  for (const [refId, { step }] of stepCredMap.entries()) {
    const reg = testDefinition.credentialReferences.find((r) => r.referenceId === refId);
    if (!reg) {
      issues.push({
        field: `credentialReferences.${refId}`,
        expected: 'Represented in testDefinition.credentialReferences registry',
        actual: undefined,
        description: `Journey step ${step.method} ${step.path} references credential "${refId}" which is missing from Test Definition credential registry.`
      });
    }
  }

  // Prove no orphan credential in registry: every registry credential must be used by at least one journey step
  for (const reg of testDefinition.credentialReferences) {
    if (!stepCredMap.has(reg.referenceId)) {
      issues.push({
        field: `credentialReferences.${reg.referenceId}`,
        expected: 'Referenced by at least one canonical journey step',
        actual: 'Orphan credential',
        description: `Registered credential "${reg.referenceId}" is not referenced by any journey step and cannot self-authorise.`
      });
    }
  }

  // Prove every step credential is bound in preflight
  for (const refId of stepCredMap.keys()) {
    const bound = manifest.credentialBindings.requiredReferences.find((r) => r.referenceId === refId);
    if (!bound) {
      issues.push({
        field: `credentialBindings.requiredReferences.${refId}`,
        expected: refId,
        actual: undefined,
        description: `Required credential reference "${refId}" not bound in preflight manifest.`
      });
    }
  }

  // Prove no orphan top-level credential can self-authorise
  for (const bound of manifest.credentialBindings.requiredReferences) {
    const stepUsage = stepCredMap.get(bound.referenceId);
    if (!stepUsage) {
      issues.push({
        field: `credentialBindings.requiredReferences.${bound.referenceId}`,
        expected: 'Referenced by at least one canonical journey step',
        actual: 'Orphan credential',
        description: `Credential reference "${bound.referenceId}" is an orphan top-level credential not referenced by any journey step.`
      });
      continue;
    }

    const reg = testDefinition.credentialReferences.find((r) => r.referenceId === bound.referenceId);
    if (reg) {
      if (bound.provider !== reg.provider) {
        issues.push({
          field: `credentialBindings.requiredReferences.${bound.referenceId}.provider`,
          expected: reg.provider,
          actual: bound.provider,
          description: `Credential provider mismatch for "${bound.referenceId}".`
        });
      }
      if (bound.purpose !== reg.purpose) {
        issues.push({
          field: `credentialBindings.requiredReferences.${bound.referenceId}.purpose`,
          expected: reg.purpose,
          actual: bound.purpose,
          description: `Credential purpose mismatch for "${bound.referenceId}".`
        });
      }
    }

    if (referenceLabManifest.routes) {
      const step = stepUsage.step;
      const stepNormPath = normalizePath(step.path);
      const matchingRoute = referenceLabManifest.routes.find(
        (r) =>
          r.method.toUpperCase() === step.method.toUpperCase() &&
          normalizePath(r.path) === stepNormPath
      );
      if (matchingRoute) {
        if (bound.enforcedRoute !== matchingRoute.path) {
          issues.push({
            field: `credentialBindings.requiredReferences.${bound.referenceId}.enforcedRoute`,
            expected: matchingRoute.path,
            actual: bound.enforcedRoute,
            description: `Credential enforcedRoute mismatch for "${bound.referenceId}".`
          });
        }
        if (bound.enforcedScheme !== matchingRoute.authScheme) {
          issues.push({
            field: `credentialBindings.requiredReferences.${bound.referenceId}.enforcedScheme`,
            expected: matchingRoute.authScheme,
            actual: bound.enforcedScheme,
            description: `Credential enforcedScheme mismatch for "${bound.referenceId}".`
          });
        }
      }
    }
  }

  // 8. Reference Lab Metadata & Route Semantic Alignment
  if (manifest.service !== referenceLabManifest.service) {
    issues.push({
      field: 'service',
      expected: referenceLabManifest.service,
      actual: manifest.service,
      description: 'Preflight manifest service name mismatch.'
    });
  }

  if (manifest.serviceVersion !== referenceLabManifest.version) {
    issues.push({
      field: 'serviceVersion',
      expected: referenceLabManifest.version,
      actual: manifest.serviceVersion,
      description: 'Preflight manifest serviceVersion mismatch.'
    });
  }

  if (manifest.routeManifestVersion !== referenceLabManifest.version) {
    issues.push({
      field: 'routeManifestVersion',
      expected: referenceLabManifest.version,
      actual: manifest.routeManifestVersion,
      description: 'Route manifest version mismatch.'
    });
  }

  if (referenceLabManifest.routes) {
    for (const journey of canonicalJourneys) {
      for (const step of journey.steps) {
        const stepNormPath = normalizePath(step.path);
        const route = referenceLabManifest.routes.find(
          (r) =>
            r.method.toUpperCase() === step.method.toUpperCase() &&
            normalizePath(r.path) === stepNormPath
        );

        if (!route) {
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}`,
            expected: `Exact route matching ${step.method} ${stepNormPath} in Reference Lab manifest`,
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

        const stepRequiresPayload =
          Boolean(step.requestPayload) || ['POST', 'PUT', 'PATCH'].includes(step.method.toUpperCase());
        const routeRequiresPayload = Boolean(route.payloadRequired);
        if (stepRequiresPayload !== routeRequiresPayload) {
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}.payloadRequired`,
            expected: stepRequiresPayload,
            actual: routeRequiresPayload,
            description: `Route ${step.method} ${step.path} payload requirement mismatch: step requires payload=${stepRequiresPayload}, lab route specifies payloadRequired=${routeRequiresPayload}.`
          });
        }

        const stepRequiresAuth = Boolean(step.credentialReferences && step.credentialReferences.length > 0);
        const routeRequiresAuth = Boolean(route.authRequired);
        if (stepRequiresAuth !== routeRequiresAuth) {
          issues.push({
            field: `referenceLabRoutes.${step.method}_${step.path}.authRequired`,
            expected: stepRequiresAuth,
            actual: routeRequiresAuth,
            description: `Route ${step.method} ${step.path} auth requirement mismatch: step requires auth=${stepRequiresAuth}, lab route specifies authRequired=${routeRequiresAuth}.`
          });
        }

        if (step.businessEventContribution || route.businessEventContribution) {
          if (!step.businessEventContribution) {
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution`,
              expected: undefined,
              actual: route.businessEventContribution,
              description: `Lab route ${step.method} ${step.path} defines businessEventContribution but journey step does not.`
            });
          } else if (!route.businessEventContribution) {
            issues.push({
              field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution`,
              expected: step.businessEventContribution,
              actual: undefined,
              description: `Route ${step.method} ${step.path} missing business event contribution in lab manifest.`
            });
          } else {
            const s = step.businessEventContribution;
            const r = route.businessEventContribution;
            if (r.eventKey !== s.eventKey) {
              issues.push({
                field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.eventKey`,
                expected: s.eventKey,
                actual: r.eventKey,
                description: `Route ${step.method} ${step.path} business event key mismatch.`
              });
            }
            if (r.metric !== s.metric) {
              issues.push({
                field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.metric`,
                expected: s.metric,
                actual: r.metric,
                description: `Route ${step.method} ${step.path} business event metric mismatch.`
              });
            }
            if (r.unit !== s.unit) {
              issues.push({
                field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.unit`,
                expected: s.unit,
                actual: r.unit,
                description: `Route ${step.method} ${step.path} business event unit mismatch.`
              });
            }
            if (r.contribution !== s.contribution) {
              issues.push({
                field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.contribution`,
                expected: s.contribution,
                actual: r.contribution,
                description: `Route ${step.method} ${step.path} business event contribution value mismatch.`
              });
            }
            if (r.expectedStatus !== s.expectedStatus) {
              issues.push({
                field: `referenceLabRoutes.${step.method}_${step.path}.businessEventContribution.expectedStatus`,
                expected: s.expectedStatus,
                actual: r.expectedStatus,
                description: `Route ${step.method} ${step.path} business event expectedStatus mismatch.`
              });
            }
          }
        }
      }
    }
  }

  // 9. Target Environment & Probe Evidence Verification
  const targetBaseUrlRef = scenario?.targetEnvironmentBaseUrlRef;
  const expectedOrigin = normalizeOrigin(targetBaseUrlRef || '');
  const manifestOrigin = normalizeOrigin(manifest.targetEnvironment.defaultBaseUrl);

  if (expectedOrigin && manifestOrigin !== expectedOrigin) {
    issues.push({
      field: 'targetEnvironment.defaultBaseUrl',
      expected: expectedOrigin,
      actual: manifestOrigin,
      description: `Manifest targetEnvironment origin "${manifestOrigin}" does not match Test Definition target origin "${expectedOrigin}".`
    });
  }

  if (context.targetProbe) {
    const p = context.targetProbe;
    const probeOrigin = normalizeOrigin(p.baseUrl);

    if (expectedOrigin && probeOrigin !== expectedOrigin) {
      issues.push({
        field: 'targetProbe.baseUrl',
        expected: expectedOrigin,
        actual: probeOrigin,
        description: `Supplied target probe origin "${probeOrigin}" does not match Test Definition target origin "${expectedOrigin}".`
      });
    }

    if (p.httpStatusHealth !== 200) {
      issues.push({
        field: 'targetProbe.httpStatusHealth',
        expected: 200,
        actual: p.httpStatusHealth,
        description: `Supplied target probe /health HTTP status is ${p.httpStatusHealth}, expected 200.`
      });
    }

    if (p.httpStatusReady !== 200) {
      issues.push({
        field: 'targetProbe.httpStatusReady',
        expected: 200,
        actual: p.httpStatusReady,
        description: `Supplied target probe /ready HTTP status is ${p.httpStatusReady}, expected 200.`
      });
    }

    if (p.healthStatus !== 'healthy') {
      issues.push({
        field: 'targetProbe.healthStatus',
        expected: 'healthy',
        actual: p.healthStatus,
        description: `Supplied target probe healthStatus is "${p.healthStatus}", expected "healthy".`
      });
    }

    if (p.readyStatus !== 'ready') {
      issues.push({
        field: 'targetProbe.readyStatus',
        expected: 'ready',
        actual: p.readyStatus,
        description: `Supplied target probe readyStatus is "${p.readyStatus}", expected "ready".`
      });
    }

    if (!p.isResolvable) {
      issues.push({
        field: 'targetProbe.isResolvable',
        expected: true,
        actual: p.isResolvable,
        description: 'Supplied target probe indicates target is not resolvable.'
      });
    }

    if (manifest.targetEnvironment.verifiedProbe) {
      const vp = manifest.targetEnvironment.verifiedProbe;
      if (vp.healthStatus !== p.healthStatus) {
        issues.push({
          field: 'targetEnvironment.verifiedProbe.healthStatus',
          expected: p.healthStatus,
          actual: vp.healthStatus,
          description: 'Manifest verifiedProbe healthStatus does not match supplied probe.'
        });
      }
      if (vp.readyStatus !== p.readyStatus) {
        issues.push({
          field: 'targetEnvironment.verifiedProbe.readyStatus',
          expected: p.readyStatus,
          actual: vp.readyStatus,
          description: 'Manifest verifiedProbe readyStatus does not match supplied probe.'
        });
      }
      if (vp.isResolvable !== p.isResolvable) {
        issues.push({
          field: 'targetEnvironment.verifiedProbe.isResolvable',
          expected: p.isResolvable,
          actual: vp.isResolvable,
          description: 'Manifest verifiedProbe isResolvable does not match supplied probe.'
        });
      }
    }
  } else if (manifest.preflightChecks.targetResolvable) {
    issues.push({
      field: 'preflightChecks.targetResolvable',
      expected: 'Supplied verified targetProbe evidence',
      actual: undefined,
      description: 'Preflight manifest asserts targetResolvable=true without supplied verified probe evidence.'
    });
  }

  // 10. Live Execution Gate
  if (context.liveExecutionStarted || !manifest.preflightChecks.liveExecutionNotStarted) {
    issues.push({
      field: 'preflightChecks.liveExecutionNotStarted',
      expected: true,
      actual: false,
      description: 'Live execution must not have started during preflight gate validation.'
    });
  }

  // 11. READY Law Enforcement
  if (manifest.status === 'READY_FOR_LIVE_EXECUTION' && issues.length > 0) {
    issues.push({
      field: 'status',
      expected: 'PREFLIGHT_BLOCKED',
      actual: 'READY_FOR_LIVE_EXECUTION',
      description: 'Manifest asserts READY_FOR_LIVE_EXECUTION status despite failed preflight validation checks.'
    });
  }

  const isValid =
    issues.length === 0 &&
    manifest.status === 'READY_FOR_LIVE_EXECUTION' &&
    Object.values(manifest.preflightChecks).every((v) => v === true);

  return {
    isValid,
    status: isValid ? 'READY_FOR_LIVE_EXECUTION' : 'PREFLIGHT_BLOCKED',
    issues
  };
}
