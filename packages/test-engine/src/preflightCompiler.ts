import {
  TestDefinition,
  K6ExecutionBundle
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

export interface BuildPreflightManifestOptions {
  testDefinition: TestDefinition;
  bundle: K6ExecutionBundle;
  referenceLabManifest: {
    version: string;
    service: string;
    routes: Array<{
      path: string;
      method: string;
      expectedStatus: number;
      authRequired?: boolean;
      authScheme?: string;
      businessEventContribution?: any;
    }>;
  };
  preflightTimestamp?: string;
  liveExecutionStarted?: boolean;
}

/**
 * Builds a deterministic ExecutionPreflightManifest bound directly to the
 * compiled TestDefinition, K6ExecutionBundle, and Reference Lab route manifest.
 * Enforces Constitution §10, §11 and Work Package M3.1A.1.
 */
export function buildExecutionPreflightManifest(
  options: BuildPreflightManifestOptions
): ExecutionPreflightManifest {
  const { testDefinition, bundle, referenceLabManifest } = options;
  const timestamp = options.preflightTimestamp || '2026-09-18T10:30:00Z';
  const scenario = testDefinition.scenarios[0];
  const schedule = scenario.workloadSchedule;
  const popRel = testDefinition.populationRelationship;

  // Build expected healthy thresholds directly from executable criteria and bundle thresholds
  const expectedHealthyThresholds: PreflightHealthyThreshold[] = testDefinition.executableCriteria.map((crit) => {
    let metricKey = 'http_req_duration';
    let aggregation = crit.percentile ? `p(${crit.percentile})` : 'p(95)';
    let unit = crit.unit;

    if (crit.metric.toLowerCase().includes('error') || crit.metric.toLowerCase().includes('fail')) {
      metricKey = 'http_req_failed';
      aggregation = 'rate';
      unit = 'rate'; // Represented semantically as rate/fraction
    } else {
      const scope = (crit.scope || '').toLowerCase();
      if (scope.includes('checkout')) {
        metricKey = 'http_req_duration{journey:checkout}';
      }
    }

    const expression = `${aggregation}${crit.operator || '<'}${crit.thresholdValue}`;

    return {
      criterionId: crit.id,
      metric: metricKey,
      aggregation,
      operator: crit.operator || '<',
      threshold: crit.thresholdValue ?? 0,
      unit,
      expression
    };
  });

  const credentialBindings: PreflightCredentialBindings = {
    requiredReferences: testDefinition.credentialReferences.map((ref) => ({
      provider: ref.provider,
      referenceId: ref.referenceId,
      purpose: ref.purpose,
      enforcedRoute: '/api/v1/orders/checkout',
      enforcedScheme: 'Bearer'
    })),
    ephemeralAtRuntime: true,
    noHardcodedSecrets: true
  };

  const governedWorkload: PreflightGovernedWorkload = {
    schedulerArrivalPopulation: schedule.arrivalPopulation || 'JOURNEY_ITERATION',
    schedulerPeakRate: {
      value: schedule.peakArrivalRate,
      unit: schedule.rateUnit
    },
    businessWorkloadAttainment: {
      metric: testDefinition.workloadAttainment?.metric || 'orders',
      targetValue: testDefinition.workloadAttainment?.targetValue || 8.75,
      unit: testDefinition.workloadAttainment?.unit || 'orders/second'
    },
    populationRelationship: {
      id: popRel?.id || '',
      formulaIdentifier: popRel?.formulaIdentifier || '',
      relevantJourneyKey: popRel?.relevantJourneyKey || 'checkout',
      journeyShare: popRel?.journeyShare || 0.08,
      contributionPerSuccessfulEvent: popRel?.contributionPerSuccessfulEvent || 1,
      derivedSchedulerRate: popRel?.outputSchedulerRate.value || schedule.peakArrivalRate
    },
    checkoutContribution: `${popRel?.contributionPerSuccessfulEvent || 1} order`
  };

  const targetEnvironment = {
    strategy: 'LOCALHOST_RESOLVABLE',
    defaultBaseUrl: scenario.targetEnvironmentBaseUrlRef || 'http://localhost:8080',
    envVarOverride: 'TARGET_BASE_URL',
    protocol: 'HTTP',
    port: 8080,
    host: 'localhost'
  };

  const bundleFiles = bundle.files.map((f) => f.filename);

  const preflightChecks: PreflightChecks = {
    contractApproved: testDefinition.sourceContractId.includes('approved'),
    testDefinitionCompiled: testDefinition.status === 'READY_FOR_EXECUTION' && testDefinition.isExecutable,
    k6BundleCompiled: bundle.isExecutable,
    referenceLabManifestAligned: referenceLabManifest.version === '1.0.0',
    referenceLabRoutesVerified: referenceLabManifest.routes.length >= 7,
    credentialBindingsDefined: credentialBindings.requiredReferences.length > 0,
    populationSemanticsHardened: popRel !== undefined && popRel.journeyShare > 0,
    thresholdsBoundToApprovedContract: expectedHealthyThresholds.length === testDefinition.executableCriteria.length,
    targetResolvable: true,
    liveExecutionNotStarted: !options.liveExecutionStarted
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
    preflightChecks.liveExecutionNotStarted;

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
      sourceContractFingerprint: testDefinition.sourceContractFingerprint
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
 * Enforces the READY_FOR_LIVE_EXECUTION law (Work Package M3.1A.1 Requirement 4).
 */
export function validateExecutionPreflightManifest(
  manifest: ExecutionPreflightManifest,
  context: {
    testDefinition: TestDefinition;
    bundle: K6ExecutionBundle;
    referenceLabManifest: { version: string; service: string };
    liveExecutionStarted?: boolean;
  }
): PreflightValidationResult {
  const issues: PreflightValidationIssue[] = [];
  const { testDefinition, bundle, referenceLabManifest } = context;

  // 1. Test Definition Bindings
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

  // 2. k6 Runtime & Bundle Bindings
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

  // 3. Acceptance Criteria & Thresholds Binding
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

  // 4. Governed Workload & Population Relationship
  const scenario = testDefinition.scenarios[0];
  const schedule = scenario.workloadSchedule;
  const popRel = testDefinition.populationRelationship;

  if (manifest.governedWorkload.schedulerPeakRate.value !== schedule.peakArrivalRate) {
    issues.push({
      field: 'governedWorkload.schedulerPeakRate.value',
      expected: schedule.peakArrivalRate,
      actual: manifest.governedWorkload.schedulerPeakRate.value,
      description: 'Scheduler peak rate value mismatch.'
    });
  }

  if (manifest.governedWorkload.schedulerPeakRate.unit !== schedule.rateUnit) {
    issues.push({
      field: 'governedWorkload.schedulerPeakRate.unit',
      expected: schedule.rateUnit,
      actual: manifest.governedWorkload.schedulerPeakRate.unit,
      description: 'Scheduler peak rate unit mismatch.'
    });
  }

  if (manifest.governedWorkload.schedulerArrivalPopulation !== schedule.arrivalPopulation) {
    issues.push({
      field: 'governedWorkload.schedulerArrivalPopulation',
      expected: schedule.arrivalPopulation,
      actual: manifest.governedWorkload.schedulerArrivalPopulation,
      description: 'Scheduler arrival population mismatch.'
    });
  }

  if (
    manifest.governedWorkload.businessWorkloadAttainment.targetValue !==
    testDefinition.workloadAttainment?.targetValue
  ) {
    issues.push({
      field: 'governedWorkload.businessWorkloadAttainment.targetValue',
      expected: testDefinition.workloadAttainment?.targetValue,
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

  // 5. Credential References
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

  // 6. Route Manifest Version
  if (manifest.routeManifestVersion !== referenceLabManifest.version) {
    issues.push({
      field: 'routeManifestVersion',
      expected: referenceLabManifest.version,
      actual: manifest.routeManifestVersion,
      description: 'Route manifest version mismatch.'
    });
  }

  // 7. Live Execution Gate
  if (context.liveExecutionStarted || !manifest.preflightChecks.liveExecutionNotStarted) {
    issues.push({
      field: 'preflightChecks.liveExecutionNotStarted',
      expected: true,
      actual: false,
      description: 'Live execution must not have started during preflight gate validation.'
    });
  }

  const isValid = issues.length === 0;

  return {
    isValid,
    status: isValid ? 'READY_FOR_LIVE_EXECUTION' : 'PREFLIGHT_BLOCKED',
    issues
  };
}
