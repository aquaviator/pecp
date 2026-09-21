// PECP Deterministic Acceptance Engine (M3.3)
// Defined according to docs/work-packages/M3_3_DETERMINISTIC_ACCEPTANCE_ENGINE.md
// Pure, deterministic acceptance evaluation outside the UI.

import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  AcceptanceEvaluation,
  AcceptanceVerdict,
  CriterionEvaluationStatus,
  WorkloadAttainmentEvaluation,
  AcceptanceCriterionEvaluation,
  AcceptanceGateResult,
  GovernedObservation,
  computeContractFingerprint
} from '@pecp/pe-domain';
import { computeStringChecksum } from './fingerprint.js';

export interface EvaluateAcceptanceInput {
  contract: PerformanceContract;
  testDefinition: TestDefinition;
  results: CanonicalExecutionResult;
  governedObservations?: GovernedObservation[];
  evaluationTimestamp?: string;
  evaluationId?: string;
}

/**
 * Deep freezes an object to enforce immutability.
 */
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Deterministic Acceptance Engine.
 * Evaluates in strict mandatory order:
 * 1. provenance / drift validity;
 * 2. execution / evidence integrity;
 * 3. workload attainment prerequisite;
 * 4. canonical criterion evaluability;
 * 5. independent comparison & threshold corroboration conflict;
 * 6. criterion PASS / FAIL outcomes;
 * 7. governed non-blocking observations.
 */
export function evaluateAcceptance(input: EvaluateAcceptanceInput): AcceptanceEvaluation {
  const {
    contract,
    testDefinition,
    results,
    governedObservations = [],
    evaluationTimestamp = new Date().toISOString(),
    evaluationId = `eval-${results.run.executionRunId}-${Date.now().toString(36)}`
  } = input;

  // -------------------------------------------------------------------------
  // 1. Provenance and Drift Validity Gate
  // -------------------------------------------------------------------------
  const provenanceReasons: string[] = [];
  const computedContractFp = computeContractFingerprint(contract);

  if (contract.status !== 'APPROVED') {
    provenanceReasons.push(
      `Performance Contract '${contract.id}' is in '${contract.status}' status (must be 'APPROVED').`
    );
  }

  if (testDefinition.sourceContractId !== contract.id) {
    provenanceReasons.push(
      `TestDefinition sourceContractId '${testDefinition.sourceContractId}' does not match Contract id '${contract.id}'.`
    );
  }

  if (testDefinition.sourceContractVersion !== contract.version) {
    provenanceReasons.push(
      `TestDefinition sourceContractVersion '${testDefinition.sourceContractVersion}' does not match Contract version '${contract.version}'.`
    );
  }

  if (testDefinition.sourceContractFingerprint !== computedContractFp) {
    provenanceReasons.push(
      `TestDefinition sourceContractFingerprint '${testDefinition.sourceContractFingerprint}' does not match computed Contract fingerprint '${computedContractFp}'.`
    );
  }

  if (results.run.sourceContract.id !== contract.id) {
    provenanceReasons.push(
      `Results sourceContract.id '${results.run.sourceContract.id}' does not match Contract id '${contract.id}'.`
    );
  }

  if (results.run.sourceContract.version !== contract.version) {
    provenanceReasons.push(
      `Results sourceContract.version '${results.run.sourceContract.version}' does not match Contract version '${contract.version}'.`
    );
  }

  if (results.run.sourceContract.fingerprint !== computedContractFp) {
    provenanceReasons.push(
      `Results sourceContract.fingerprint '${results.run.sourceContract.fingerprint}' does not match computed Contract fingerprint '${computedContractFp}'.`
    );
  }

  if (results.run.testDefinition.id !== testDefinition.id) {
    provenanceReasons.push(
      `Results testDefinition.id '${results.run.testDefinition.id}' does not match TestDefinition id '${testDefinition.id}'.`
    );
  }

  if (results.run.testDefinition.version !== testDefinition.version) {
    provenanceReasons.push(
      `Results testDefinition.version '${results.run.testDefinition.version}' does not match TestDefinition version '${testDefinition.version}'.`
    );
  }

  if (results.run.testDefinition.fingerprint !== testDefinition.fingerprint) {
    provenanceReasons.push(
      `Results testDefinition.fingerprint '${results.run.testDefinition.fingerprint}' does not match TestDefinition fingerprint '${testDefinition.fingerprint}'.`
    );
  }

  const provenanceGate: AcceptanceGateResult = {
    isValid: provenanceReasons.length === 0,
    reasons: provenanceReasons
  };

  // -------------------------------------------------------------------------
  // 2. Operational and Evidence Validity Gate
  // -------------------------------------------------------------------------
  const integrityReasons: string[] = [];

  if (results.run.operationalStatus !== 'EXECUTION_COMPLETED') {
    integrityReasons.push(
      `Execution operational status is '${results.run.operationalStatus}' (expected 'EXECUTION_COMPLETED').`
    );
  }

  if (!results.run.preflightStatus.isValid) {
    const reasons = results.run.preflightStatus.blockingReasons.length > 0
      ? results.run.preflightStatus.blockingReasons.join('; ')
      : 'preflight status invalid';
    integrityReasons.push(`Preflight verification failed: ${reasons}.`);
  }

  if (results.run.engineExitCode !== 0) {
    integrityReasons.push(
      `Execution engine exited with non-zero exit code (${results.run.engineExitCode}).`
    );
  }

  if (results.dataQuality.hasIntegrityErrors) {
    integrityReasons.push(
      'Execution results contain data quality integrity errors.'
    );
  }

  if (!results.dataQuality.isComplete) {
    integrityReasons.push('Required raw execution evidence or data quality is incomplete.');
  }

  const missingArtifacts = results.evidenceInventory.allReferences.filter(
    (r) => r.presenceStatus !== 'PRESENT'
  );
  if (missingArtifacts.length > 0) {
    integrityReasons.push(
      `Required evidence files are missing or corrupt: ${missingArtifacts.map((r) => r.filename).join(', ')}.`
    );
  }

  // Check fatal data quality issues
  const fatalQualityIssues = results.dataQuality.issues.filter(
    (i) => i.severity === 'FATAL' || i.code === 'MISSING_REQUIRED_BINDING' || i.code === 'CREDENTIAL_LEAKAGE_DETECTED'
  );
  if (fatalQualityIssues.length > 0) {
    integrityReasons.push(
      `Critical data quality issues present: ${fatalQualityIssues.map((i) => i.message).join('; ')}.`
    );
  }

  const operationalIntegrityGate: AcceptanceGateResult = {
    isValid: integrityReasons.length === 0,
    reasons: integrityReasons
  };

  // -------------------------------------------------------------------------
  // 3. Workload Attainment Prerequisite Evaluation
  // -------------------------------------------------------------------------
  const attainmentObservation = results.acceptanceBasisAttainment;
  const targetValue = testDefinition.workloadAttainment?.targetValue ??
    attainmentObservation?.governedDemand?.targetValue;
  const unit = testDefinition.workloadAttainment?.unit ??
    attainmentObservation?.governedDemand?.unit ??
    attainmentObservation?.units;
  const tolerancePercentage = testDefinition.workloadAttainment?.tolerancePercentage;
  const timeBasis = attainmentObservation?.timeBasis ?? 'STEADY_STATE_PEAK';
  const derivationStatus = attainmentObservation?.derivationStatus;

  let workloadPrerequisite: WorkloadAttainmentEvaluation;

  if (targetValue === undefined || !Number.isFinite(targetValue) || targetValue <= 0) {
    workloadPrerequisite = {
      status: 'INVALID',
      targetValue: undefined,
      observedValue: attainmentObservation?.resultValue,
      unit,
      timeBasis,
      tolerancePercentage,
      derivationStatus,
      isPrerequisiteMet: false,
      rationale: 'Governed workload demand target value is missing, non-finite, or invalid.'
    };
  } else if (
    derivationStatus === 'UNRESOLVED_INSUFFICIENT_TIME_SERIES' ||
    attainmentObservation?.resultValue === undefined
  ) {
    workloadPrerequisite = {
      status: 'UNRESOLVED',
      targetValue,
      observedValue: undefined,
      unit,
      timeBasis,
      tolerancePercentage,
      derivationStatus,
      isPrerequisiteMet: false,
      rationale:
        'Acceptance-basis workload attainment is unresolved because steady-state time-sliced evidence was not captured.'
    };
  } else {
    const observedValue = attainmentObservation.resultValue;
    const requiredMinimum = tolerancePercentage !== undefined
      ? targetValue * (1 - tolerancePercentage / 100)
      : targetValue;

    const isAttained = observedValue >= requiredMinimum;
    workloadPrerequisite = {
      status: isAttained ? 'ATTAINED' : 'NOT_ATTAINED',
      targetValue,
      observedValue,
      unit,
      timeBasis,
      tolerancePercentage,
      requiredMinimum,
      derivationStatus,
      isPrerequisiteMet: isAttained,
      rationale: isAttained
        ? `Observed acceptance-basis workload (${observedValue} ${unit ?? ''}) met required minimum (${requiredMinimum} ${unit ?? ''}).`
        : `Observed acceptance-basis workload (${observedValue} ${unit ?? ''}) failed to meet required minimum (${requiredMinimum} ${unit ?? ''}).`
    };
  }

  // -------------------------------------------------------------------------
  // 4. Canonical Criterion Evaluability and Deterministic Evaluation
  // -------------------------------------------------------------------------
  const criterionEvaluations: AcceptanceCriterionEvaluation[] = [];
  const engineConflictReasons: string[] = [];

  for (const crit of testDefinition.executableCriteria) {
    // Basic structural checks
    const validOperators: Array<'<' | '<=' | '>' | '>=' | '=='> = ['<', '<=', '>', '>=', '=='];
    const op = crit.operator as '<' | '<=' | '>' | '>=' | '==';

    if (!crit.operator || !validOperators.includes(op)) {
      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: op,
        canonicalThresholdValue: crit.thresholdValue ?? 0,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold: crit.thresholdValue ?? 0,
        observedValue: undefined,
        observedUnit: undefined,
        evidenceSourcePath: undefined,
        status: 'NOT_EVALUABLE',
        deterministicRationale: `Unsupported or missing comparison operator '${String(crit.operator)}'.`
      });
      continue;
    }

    if (crit.thresholdValue === undefined || !Number.isFinite(crit.thresholdValue)) {
      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: op,
        canonicalThresholdValue: 0,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold: 0,
        observedValue: undefined,
        observedUnit: undefined,
        evidenceSourcePath: undefined,
        status: 'NOT_EVALUABLE',
        deterministicRationale: `Missing or non-finite threshold value for criterion '${crit.id}'.`
      });
      continue;
    }

    const metricLower = (crit.metric || '').toLowerCase();
    const keyLower = (crit.key || '').toLowerCase();
    const scopeLower = (crit.scope || '').toLowerCase();

    // 4A: Error rate criteria
    const isErrorRate =
      metricLower.includes('error') ||
      metricLower.includes('fail') ||
      keyLower.includes('error') ||
      keyLower.includes('fail');

    // 4B: Latency / Response Time criteria
    const isLatency =
      metricLower.includes('response') ||
      metricLower.includes('latency') ||
      metricLower.includes('duration') ||
      keyLower.includes('latency') ||
      keyLower.includes('response');

    if (isErrorRate) {
      let normalizedComparisonThreshold: number;
      if (crit.unit === 'rate' || crit.unit === 'fraction') {
        normalizedComparisonThreshold = crit.thresholdValue;
      } else if (crit.unit === '%' || crit.unit === 'percent') {
        normalizedComparisonThreshold = crit.thresholdValue / 100;
      } else {
        criterionEvaluations.push({
          criterionId: crit.id,
          key: crit.key,
          metric: crit.metric,
          scope: crit.scope,
          operator: op,
          canonicalThresholdValue: crit.thresholdValue,
          canonicalUnit: crit.unit,
          percentile: crit.percentile,
          normalizedComparisonThreshold: crit.thresholdValue,
          observedValue: undefined,
          observedUnit: undefined,
          evidenceSourcePath: 'http_req_failed.rate',
          status: 'NOT_EVALUABLE',
          deterministicRationale: `Unsupported unit '${crit.unit}' for error rate criterion.`
        });
        continue;
      }

      const observedValue = results.metrics.httpReqFailed?.rate;
      const evidenceSourcePath = 'http_req_failed.rate';

      if (observedValue === undefined || !Number.isFinite(observedValue)) {
        criterionEvaluations.push({
          criterionId: crit.id,
          key: crit.key,
          metric: crit.metric,
          scope: crit.scope,
          operator: op,
          canonicalThresholdValue: crit.thresholdValue,
          canonicalUnit: crit.unit,
          percentile: crit.percentile,
          normalizedComparisonThreshold,
          observedValue: undefined,
          observedUnit: 'rate',
          evidenceSourcePath,
          status: 'NOT_EVALUABLE',
          deterministicRationale: 'Observed metric http_req_failed.rate is absent or non-finite.'
        });
        continue;
      }

      // Independent comparison
      let passes = false;
      switch (op) {
        case '<':
          passes = observedValue < normalizedComparisonThreshold;
          break;
        case '<=':
          passes = observedValue <= normalizedComparisonThreshold;
          break;
        case '>':
          passes = observedValue > normalizedComparisonThreshold;
          break;
        case '>=':
          passes = observedValue >= normalizedComparisonThreshold;
          break;
        case '==':
          passes = observedValue === normalizedComparisonThreshold;
          break;
      }

      const status: CriterionEvaluationStatus = passes ? 'PASS' : 'FAIL';

      // Corroborating engine threshold check
      const thresholdObs = results.thresholdObservations.find((t) =>
        t.metric === 'http_req_failed' || t.metric.includes('http_req_failed')
      );

      let corroboratingEngineThreshold: AcceptanceCriterionEvaluation['corroboratingEngineThreshold'] | undefined;
      if (thresholdObs) {
        const enginePassed = thresholdObs.status === 'OBSERVED_PASSED' || thresholdObs.engineResult === true;
        const agreesWithEngine = enginePassed === passes;
        corroboratingEngineThreshold = {
          metric: thresholdObs.metric,
          expression: thresholdObs.expression,
          enginePassed,
          agreesWithEngine
        };

        if (!agreesWithEngine) {
          engineConflictReasons.push(
            `Corroboration conflict for criterion '${crit.id}': independent evaluation is '${status}', but k6 engine threshold '${thresholdObs.metric}' (${thresholdObs.expression}) reported enginePassed='${enginePassed}'.`
          );
        }
      }

      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: op,
        canonicalThresholdValue: crit.thresholdValue,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold,
        observedValue,
        observedUnit: 'rate',
        evidenceSourcePath,
        status,
        corroboratingEngineThreshold,
        deterministicRationale: `Independent evaluation: observed rate ${observedValue} ${op} threshold ${normalizedComparisonThreshold} => ${status}.`
      });
    } else if (isLatency) {
      // Determine scope
      let metricObj: any;
      let pathPrefix: string;
      let thresholdMetricName: string;

      if (scopeLower.includes('checkout')) {
        metricObj = results.metrics.httpReqDurationCheckout;
        pathPrefix = 'http_req_duration{journey:checkout}';
        thresholdMetricName = 'http_req_duration{journey:checkout}';
      } else if (scopeLower.includes('global') || scopeLower === '' || scopeLower === 'all') {
        metricObj = results.metrics.httpReqDuration;
        pathPrefix = 'http_req_duration';
        thresholdMetricName = 'http_req_duration';
      } else {
        criterionEvaluations.push({
          criterionId: crit.id,
          key: crit.key,
          metric: crit.metric,
          scope: crit.scope,
          operator: op,
          canonicalThresholdValue: crit.thresholdValue,
          canonicalUnit: crit.unit,
          percentile: crit.percentile,
          normalizedComparisonThreshold: crit.thresholdValue,
          observedValue: undefined,
          observedUnit: undefined,
          evidenceSourcePath: undefined,
          status: 'NOT_EVALUABLE',
          deterministicRationale: `Unsupported latency scope '${crit.scope}'.`
        });
        continue;
      }

      // Determine percentile field
      const p = crit.percentile;
      let observedValue: number | undefined;
      let evidenceSourcePath: string;

      if (p === 95) {
        observedValue = metricObj?.p95;
        evidenceSourcePath = `${pathPrefix}.p95`;
      } else if (p === 99) {
        observedValue = metricObj?.p99;
        evidenceSourcePath = `${pathPrefix}.p99`;
      } else if (p === 90) {
        observedValue = metricObj?.p90;
        evidenceSourcePath = `${pathPrefix}.p90`;
      } else if (p === 50) {
        observedValue = metricObj?.med;
        evidenceSourcePath = `${pathPrefix}.med`;
      } else if (p === undefined && (metricLower.includes('avg') || keyLower.includes('avg'))) {
        observedValue = metricObj?.avg;
        evidenceSourcePath = `${pathPrefix}.avg`;
      } else {
        criterionEvaluations.push({
          criterionId: crit.id,
          key: crit.key,
          metric: crit.metric,
          scope: crit.scope,
          operator: op,
          canonicalThresholdValue: crit.thresholdValue,
          canonicalUnit: crit.unit,
          percentile: crit.percentile,
          normalizedComparisonThreshold: crit.thresholdValue,
          observedValue: undefined,
          observedUnit: undefined,
          evidenceSourcePath: undefined,
          status: 'NOT_EVALUABLE',
          deterministicRationale: `Requested percentile p(${String(p)}) is not supported or absent in canonical results metrics.`
        });
        continue;
      }

      // Unit normalization
      let normalizedComparisonThreshold: number;
      if (crit.unit === 'ms' || crit.unit === 'milliseconds') {
        normalizedComparisonThreshold = crit.thresholdValue;
      } else if (crit.unit === 's' || crit.unit === 'seconds') {
        normalizedComparisonThreshold = crit.thresholdValue * 1000;
      } else {
        criterionEvaluations.push({
          criterionId: crit.id,
          key: crit.key,
          metric: crit.metric,
          scope: crit.scope,
          operator: op,
          canonicalThresholdValue: crit.thresholdValue,
          canonicalUnit: crit.unit,
          percentile: crit.percentile,
          normalizedComparisonThreshold: crit.thresholdValue,
          observedValue: undefined,
          observedUnit: undefined,
          evidenceSourcePath,
          status: 'NOT_EVALUABLE',
          deterministicRationale: `Unsupported unit '${crit.unit}' for duration criterion.`
        });
        continue;
      }

      if (observedValue === undefined || !Number.isFinite(observedValue)) {
        criterionEvaluations.push({
          criterionId: crit.id,
          key: crit.key,
          metric: crit.metric,
          scope: crit.scope,
          operator: op,
          canonicalThresholdValue: crit.thresholdValue,
          canonicalUnit: crit.unit,
          percentile: crit.percentile,
          normalizedComparisonThreshold,
          observedValue: undefined,
          observedUnit: 'ms',
          evidenceSourcePath,
          status: 'NOT_EVALUABLE',
          deterministicRationale: `Observed metric '${evidenceSourcePath}' is absent or non-finite.`
        });
        continue;
      }

      // Independent comparison
      let passes = false;
      switch (op) {
        case '<':
          passes = observedValue < normalizedComparisonThreshold;
          break;
        case '<=':
          passes = observedValue <= normalizedComparisonThreshold;
          break;
        case '>':
          passes = observedValue > normalizedComparisonThreshold;
          break;
        case '>=':
          passes = observedValue >= normalizedComparisonThreshold;
          break;
        case '==':
          passes = observedValue === normalizedComparisonThreshold;
          break;
      }

      const status: CriterionEvaluationStatus = passes ? 'PASS' : 'FAIL';

      // Corroborating engine threshold check
      const thresholdObs = results.thresholdObservations.find((t) =>
        t.metric === thresholdMetricName || t.metric.includes(thresholdMetricName)
      );

      let corroboratingEngineThreshold: AcceptanceCriterionEvaluation['corroboratingEngineThreshold'] | undefined;
      if (thresholdObs) {
        const enginePassed = thresholdObs.status === 'OBSERVED_PASSED' || thresholdObs.engineResult === true;
        const agreesWithEngine = enginePassed === passes;
        corroboratingEngineThreshold = {
          metric: thresholdObs.metric,
          expression: thresholdObs.expression,
          enginePassed,
          agreesWithEngine
        };

        if (!agreesWithEngine) {
          engineConflictReasons.push(
            `Corroboration conflict for criterion '${crit.id}': independent evaluation is '${status}', but k6 engine threshold '${thresholdObs.metric}' (${thresholdObs.expression}) reported enginePassed='${enginePassed}'.`
          );
        }
      }

      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: op,
        canonicalThresholdValue: crit.thresholdValue,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold,
        observedValue,
        observedUnit: 'ms',
        evidenceSourcePath,
        status,
        corroboratingEngineThreshold,
        deterministicRationale: `Independent evaluation: observed ${observedValue}ms ${op} threshold ${normalizedComparisonThreshold}ms => ${status}.`
      });
    } else {
      // Unrecognized metric type
      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: op,
        canonicalThresholdValue: crit.thresholdValue,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold: crit.thresholdValue,
        observedValue: undefined,
        observedUnit: undefined,
        evidenceSourcePath: undefined,
        status: 'NOT_EVALUABLE',
        deterministicRationale: `Unrecognized canonical criterion metric '${crit.metric}'.`
      });
    }
  }

  // -------------------------------------------------------------------------
  // 5. Deterministic Overall Decision Order (MANDATORY)
  // -------------------------------------------------------------------------
  let overallVerdict: AcceptanceVerdict;
  const verdictReasons: string[] = [];

  // Gate 1: Provenance and Drift Validity
  if (!provenanceGate.isValid) {
    overallVerdict = 'INCONCLUSIVE';
    verdictReasons.push(...provenanceGate.reasons);
  }
  // Gate 2: Execution and Evidence Integrity
  else if (!operationalIntegrityGate.isValid) {
    overallVerdict = 'INCONCLUSIVE';
    verdictReasons.push(...operationalIntegrityGate.reasons);
  }
  // Gate 3: Workload Attainment Prerequisite
  else if (!workloadPrerequisite.isPrerequisiteMet) {
    overallVerdict = 'INCONCLUSIVE';
    verdictReasons.push(workloadPrerequisite.rationale);
  }
  // Gate 4: Canonical Criterion Evaluability
  else if (criterionEvaluations.some((c) => c.status === 'NOT_EVALUABLE')) {
    overallVerdict = 'INCONCLUSIVE';
    const notEvaluable = criterionEvaluations.filter((c) => c.status === 'NOT_EVALUABLE');
    verdictReasons.push(
      ...notEvaluable.map((c) => `Criterion '${c.criterionId}' is NOT_EVALUABLE: ${c.deterministicRationale}`)
    );
  }
  // Gate 5: Threshold Corroboration Conflict
  else if (engineConflictReasons.length > 0) {
    overallVerdict = 'INCONCLUSIVE';
    verdictReasons.push(...engineConflictReasons);
  }
  // Gate 6: Criterion Failures (Workload is attained)
  else if (criterionEvaluations.some((c) => c.status === 'FAIL')) {
    overallVerdict = 'FAIL';
    const failedCriteria = criterionEvaluations.filter((c) => c.status === 'FAIL');
    verdictReasons.push(
      ...failedCriteria.map((c) => `Criterion '${c.criterionId}' failed: ${c.deterministicRationale}`)
    );
  }
  // Gate 7: PASS vs PASS_WITH_OBSERVATION
  else {
    const nonBlockingObs = governedObservations.filter((o) => !o.isBlocking);
    if (nonBlockingObs.length > 0) {
      overallVerdict = 'PASS_WITH_OBSERVATION';
      verdictReasons.push(
        `All criteria passed and workload attained, with ${nonBlockingObs.length} governed non-blocking observation(s): ${nonBlockingObs.map((o) => o.description).join('; ')}.`
      );
    } else {
      overallVerdict = 'PASS';
      verdictReasons.push(
        'All canonical acceptance criteria passed and governed workload demand was attained.'
      );
    }
  }

  // -------------------------------------------------------------------------
  // 6. Deterministic Fingerprint Calculation (No Wall-Clock Timestamp)
  // -------------------------------------------------------------------------
  const fingerprintPayload = {
    contractFingerprint: computedContractFp,
    testDefinitionFingerprint: testDefinition.fingerprint,
    sourceExecutionRunId: results.run.executionRunId,
    resultsIdentity: {
      executionRunId: results.run.executionRunId,
      artifactDigest: results.run.executionArtifact?.digest
    },
    provenanceValid: provenanceGate.isValid,
    integrityValid: operationalIntegrityGate.isValid,
    workloadPrerequisite: {
      status: workloadPrerequisite.status,
      isPrerequisiteMet: workloadPrerequisite.isPrerequisiteMet,
      targetValue: workloadPrerequisite.targetValue,
      observedValue: workloadPrerequisite.observedValue
    },
    criteria: criterionEvaluations.map((c) => ({
      id: c.criterionId,
      status: c.status,
      observed: c.observedValue,
      threshold: c.normalizedComparisonThreshold
    })),
    overallVerdict
  };

  const evaluationFingerprint = computeStringChecksum(JSON.stringify(fingerprintPayload));

  const evaluation: AcceptanceEvaluation = {
    id: evaluationId,
    version: 'v1.0',
    sourceExecutionRunId: results.run.executionRunId,
    repositoryCommitSha: results.run.repositoryCommitSha,
    workflowRunId: results.run.workflowRunId,
    sourceContract: {
      id: contract.id,
      version: contract.version,
      fingerprint: computedContractFp,
      status: contract.status
    },
    testDefinition: {
      id: testDefinition.id,
      version: testDefinition.version,
      fingerprint: testDefinition.fingerprint
    },
    canonicalResults: {
      executionRunId: results.run.executionRunId,
      artifactDigest: results.run.executionArtifact?.digest
    },
    provenanceGate,
    operationalIntegrityGate,
    workloadPrerequisite,
    criterionEvaluations,
    governedObservations,
    overallVerdict,
    verdictReasons,
    evaluatedAt: evaluationTimestamp,
    evaluationFingerprint
  };

  return deepFreeze(evaluation);
}
