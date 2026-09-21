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
import { computeStringChecksum, computeTestDefinitionFingerprint } from './fingerprint.js';

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
 * 1. provenance / drift validity (including Contract-TestDefinition parity and self-integrity);
 * 2. execution / evidence integrity;
 * 3. workload attainment prerequisite;
 * 4. canonical criterion evaluability;
 * 5. independent comparison & threshold corroboration conflict;
 * 6. blocking governed observations;
 * 7. criterion PASS / FAIL outcomes;
 * 8. governed non-blocking observations.
 */
export function evaluateAcceptance(input: EvaluateAcceptanceInput): AcceptanceEvaluation {
  const {
    contract,
    testDefinition,
    results,
    governedObservations = []
  } = input;

  // Clone caller-owned governed observations to ensure caller inputs are not frozen or mutated
  const normalizedGovernedObservations: GovernedObservation[] = (governedObservations ?? []).map((o) => ({
    id: o.id,
    source: o.source,
    severity: o.severity,
    isBlocking: Boolean(o.isBlocking),
    description: o.description,
    provenanceReference: o.provenanceReference,
    details: o.details ? JSON.parse(JSON.stringify(o.details)) : undefined
  }));

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

  // Recompute Test Definition self-integrity fingerprint and check match
  const computedTestDefFp = computeTestDefinitionFingerprint(testDefinition);
  if (testDefinition.fingerprint !== computedTestDefFp) {
    provenanceReasons.push(
      `TestDefinition self-integrity failed: stored fingerprint '${testDefinition.fingerprint}' does not match recomputed fingerprint '${computedTestDefFp}'.`
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

  // Contract -> Test Definition criterion authority parity
  for (const crit of testDefinition.executableCriteria) {
    const contractCrit = contract.acceptanceCriteria.find((c) => c.id === crit.id);
    if (!contractCrit) {
      provenanceReasons.push(
        `Executable criterion '${crit.id}' does not exist in approved Performance Contract '${contract.id}'.`
      );
      continue;
    }

    if (contractCrit.status !== 'DEFINED') {
      provenanceReasons.push(
        `Executable criterion '${crit.id}' has status '${contractCrit.status}' in Contract '${contract.id}' (must be 'DEFINED').`
      );
    }

    // Compare exact governed semantics
    const mismatches: string[] = [];
    if (crit.id !== contractCrit.id) mismatches.push(`id ('${crit.id}' vs '${contractCrit.id}')`);
    if (crit.key !== contractCrit.key) mismatches.push(`key ('${crit.key}' vs '${contractCrit.key}')`);
    if (crit.metric !== contractCrit.metric) mismatches.push(`metric ('${crit.metric}' vs '${contractCrit.metric}')`);
    if (crit.target !== contractCrit.target) mismatches.push(`target ('${crit.target}' vs '${contractCrit.target}')`);
    if (crit.operator !== contractCrit.operator) mismatches.push(`operator ('${crit.operator}' vs '${contractCrit.operator}')`);
    if (crit.thresholdValue !== contractCrit.thresholdValue) mismatches.push(`thresholdValue (${crit.thresholdValue} vs ${contractCrit.thresholdValue})`);
    if (crit.unit !== contractCrit.unit) mismatches.push(`unit ('${crit.unit}' vs '${contractCrit.unit}')`);
    if (crit.percentile !== contractCrit.percentile) mismatches.push(`percentile (${crit.percentile} vs ${contractCrit.percentile})`);
    if (crit.scope !== contractCrit.scope) mismatches.push(`scope ('${crit.scope}' vs '${contractCrit.scope}')`);
    if (crit.status !== contractCrit.status) mismatches.push(`status ('${crit.status}' vs '${contractCrit.status}')`);

    if (mismatches.length > 0) {
      provenanceReasons.push(
        `Executable criterion '${crit.id}' semantics differ from Contract authority: ${mismatches.join(', ')}.`
      );
    }
  }

  // Verify every DEFINED Contract criterion is represented in Test Definition executable criteria
  const definedContractCriteria = contract.acceptanceCriteria.filter((c) => c.status === 'DEFINED');
  for (const dc of definedContractCriteria) {
    if (!testDefinition.executableCriteria.some((ec) => ec.id === dc.id)) {
      provenanceReasons.push(
        `Approved Contract defined criterion '${dc.id}' is missing from TestDefinition executableCriteria.`
      );
    }
  }

  // Preserve governance state of ambiguous/unresolved/conflicting contract criteria
  const unresolvedContractCriteria = contract.acceptanceCriteria.filter(
    (c) => c.status === 'AMBIGUOUS' || c.status === 'UNRESOLVED' || c.status === 'CONFLICTING'
  );
  if (unresolvedContractCriteria.length > 0) {
    provenanceReasons.push(
      `Approved Contract contains unresolved criteria: ${unresolvedContractCriteria.map((c) => `'${c.id}' (${c.status})`).join(', ')}.`
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
  const testDefWorkload = testDefinition.workloadAttainment;
  const attainmentObservation = results.acceptanceBasisAttainment;

  let workloadPrerequisite: WorkloadAttainmentEvaluation;
  const workloadInvalidReasons: string[] = [];

  if (!testDefWorkload) {
    workloadInvalidReasons.push('TestDefinition lacks required workloadAttainment specification.');
  } else {
    const targetValue = testDefWorkload.targetValue;
    if (targetValue === undefined || !Number.isFinite(targetValue) || targetValue <= 0) {
      workloadInvalidReasons.push('TestDefinition workload targetValue is missing, non-finite, or non-positive.');
    }

    // Cross-check with results.acceptanceBasisAttainment
    if (
      attainmentObservation?.governedDemand?.targetValue !== undefined &&
      attainmentObservation.governedDemand.targetValue !== testDefWorkload.targetValue
    ) {
      workloadInvalidReasons.push(
        `Acceptance-basis targetValue ${attainmentObservation.governedDemand.targetValue} mismatches TestDefinition workload targetValue ${testDefWorkload.targetValue}.`
      );
    }

    if (
      attainmentObservation?.governedDemand?.unit !== undefined &&
      attainmentObservation.governedDemand.unit !== testDefWorkload.unit
    ) {
      workloadInvalidReasons.push(
        `Acceptance-basis target unit '${attainmentObservation.governedDemand.unit}' mismatches TestDefinition workload unit '${testDefWorkload.unit}'.`
      );
    }

    if (
      testDefinition.populationRelationship?.outputSchedulerRate?.population !== undefined &&
      attainmentObservation?.governedPopulation !== undefined &&
      attainmentObservation.governedPopulation !== testDefinition.populationRelationship.outputSchedulerRate.population
    ) {
      workloadInvalidReasons.push(
        `Acceptance-basis governed population '${attainmentObservation.governedPopulation}' mismatches TestDefinition population relationship '${testDefinition.populationRelationship.outputSchedulerRate.population}'.`
      );
    }

    // Governed acceptance time basis check: For M3.3 RetailCo, timeBasis must be STEADY_STATE_PEAK
    if (attainmentObservation?.timeBasis !== 'STEADY_STATE_PEAK') {
      workloadInvalidReasons.push(
        `Acceptance-basis time basis '${attainmentObservation?.timeBasis}' is unapproved (governed prerequisite requires STEADY_STATE_PEAK).`
      );
    }

    // Grounded actualSourceMetric check when resultValue is claimed
    if (attainmentObservation?.resultValue !== undefined) {
      if (!attainmentObservation.actualSourceMetric || attainmentObservation.actualSourceMetric.trim() === '') {
        workloadInvalidReasons.push(
          'Claimed observed acceptance value has no grounded actualSourceMetric in raw evidence.'
        );
      }
    }

    // Tolerance validation: absent = target exactly; invalid = INVALID; no defaults
    const tol = testDefWorkload.tolerancePercentage;
    let requiredMinimum: number | undefined;
    if (tol === undefined) {
      requiredMinimum = targetValue;
    } else if (!Number.isFinite(tol) || tol < 0 || tol > 100) {
      workloadInvalidReasons.push(
        `Invalid workload tolerancePercentage '${tol}' (must be a finite number between 0 and 100).`
      );
    } else {
      requiredMinimum = targetValue * (1 - tol / 100);
    }

    if (workloadInvalidReasons.length > 0) {
      workloadPrerequisite = {
        status: 'INVALID',
        targetValue,
        observedValue: attainmentObservation?.resultValue,
        unit: testDefWorkload.unit,
        timeBasis: attainmentObservation?.timeBasis ?? 'STEADY_STATE_PEAK',
        tolerancePercentage: tol,
        requiredMinimum,
        derivationStatus: attainmentObservation?.derivationStatus,
        isPrerequisiteMet: false,
        rationale: `Workload attainment authority validation failed: ${workloadInvalidReasons.join('; ')}`
      };
    } else if (
      attainmentObservation?.derivationStatus === 'UNRESOLVED_INSUFFICIENT_TIME_SERIES' ||
      attainmentObservation?.resultValue === undefined
    ) {
      workloadPrerequisite = {
        status: 'UNRESOLVED',
        targetValue,
        observedValue: undefined,
        unit: testDefWorkload.unit,
        timeBasis: attainmentObservation?.timeBasis ?? 'STEADY_STATE_PEAK',
        tolerancePercentage: tol,
        requiredMinimum,
        derivationStatus: attainmentObservation?.derivationStatus,
        isPrerequisiteMet: false,
        rationale:
          'Acceptance-basis workload attainment is unresolved because steady-state time-sliced evidence was not captured.'
      };
    } else {
      const observedValue = attainmentObservation.resultValue;
      const minVal = requiredMinimum!;
      const isAttained = observedValue >= minVal;
      workloadPrerequisite = {
        status: isAttained ? 'ATTAINED' : 'NOT_ATTAINED',
        targetValue,
        observedValue,
        unit: testDefWorkload.unit,
        timeBasis: attainmentObservation.timeBasis,
        tolerancePercentage: tol,
        requiredMinimum: minVal,
        derivationStatus: attainmentObservation.derivationStatus,
        isPrerequisiteMet: isAttained,
        rationale: isAttained
          ? `Observed acceptance-basis workload (${observedValue} ${testDefWorkload.unit}) met required minimum (${minVal} ${testDefWorkload.unit}).`
          : `Observed acceptance-basis workload (${observedValue} ${testDefWorkload.unit}) failed to meet required minimum (${minVal} ${testDefWorkload.unit}).`
      };
    }
  }

  if (!workloadPrerequisite!) {
    workloadPrerequisite = {
      status: 'INVALID',
      targetValue: undefined,
      observedValue: undefined,
      unit: undefined,
      timeBasis: 'STEADY_STATE_PEAK',
      isPrerequisiteMet: false,
      rationale: `Workload prerequisite invalid: ${workloadInvalidReasons.join('; ')}`
    };
  }

  // -------------------------------------------------------------------------
  // 4. Canonical Criterion Evaluability and Deterministic Evaluation
  // -------------------------------------------------------------------------
  const criterionEvaluations: AcceptanceCriterionEvaluation[] = [];
  const engineConflictReasons: string[] = [];

  for (const crit of testDefinition.executableCriteria) {
    const validOperators: Array<'<' | '<=' | '>' | '>=' | '=='> = ['<', '<=', '>', '>=', '=='];
    const op = crit.operator as '<' | '<=' | '>' | '>=' | '==' | undefined;

    if (!crit.operator || !validOperators.includes(op as any)) {
      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: crit.operator,
        canonicalThresholdValue: crit.thresholdValue,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold: undefined,
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
        canonicalThresholdValue: crit.thresholdValue,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold: undefined,
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
          normalizedComparisonThreshold: undefined,
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
          deterministicRationale: 'Observed metric http_req_failed.rate is absent or non-finite in results.'
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

      // Exact Corroborating engine threshold check (metric + expression)
      const expectedThresholdMetric = 'http_req_failed';
      const expectedThresholdExpression = `rate${op}${normalizedComparisonThreshold}`;

      const matchingThresholdObs = results.thresholdObservations.find(
        (t) => t.metric === expectedThresholdMetric && t.expression === expectedThresholdExpression
      );

      let corroboratingEngineThreshold: AcceptanceCriterionEvaluation['corroboratingEngineThreshold'] | undefined;
      if (matchingThresholdObs) {
        const isPassed = matchingThresholdObs.status === 'OBSERVED_PASSED';
        const isFailed = matchingThresholdObs.status === 'OBSERVED_FAILED';

        // Check for contradiction between status and engineResult
        if (
          (isPassed && matchingThresholdObs.engineResult === false) ||
          (isFailed && matchingThresholdObs.engineResult === true)
        ) {
          engineConflictReasons.push(
            `Threshold '${matchingThresholdObs.metric}' (${matchingThresholdObs.expression}) has internal contradiction: status='${matchingThresholdObs.status}' contradicts engineResult='${matchingThresholdObs.engineResult}'.`
          );
        }

        if (
          matchingThresholdObs.status === 'UNAVAILABLE' ||
          matchingThresholdObs.status === 'UNSUPPORTED' ||
          matchingThresholdObs.engineResult === null
        ) {
          corroboratingEngineThreshold = {
            metric: matchingThresholdObs.metric,
            expression: matchingThresholdObs.expression,
            enginePassed: null,
            agreesWithEngine: true,
            status: matchingThresholdObs.status
          };
        } else {
          const enginePassed = isPassed || matchingThresholdObs.engineResult === true;
          const agreesWithEngine = enginePassed === passes;
          corroboratingEngineThreshold = {
            metric: matchingThresholdObs.metric,
            expression: matchingThresholdObs.expression,
            enginePassed,
            agreesWithEngine,
            status: matchingThresholdObs.status
          };

          if (!agreesWithEngine) {
            engineConflictReasons.push(
              `Corroboration conflict for criterion '${crit.id}': independent evaluation is '${status}', but k6 engine threshold '${matchingThresholdObs.metric}' (${matchingThresholdObs.expression}) reported enginePassed='${enginePassed}'.`
            );
          }
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
      let metricObj: any;
      let pathPrefix: string;
      let expectedThresholdMetric: string;

      const allMetrics = results.metrics as Record<string, any>;
      if (scopeLower.includes('checkout')) {
        metricObj = results.metrics.httpReqDurationCheckout || allMetrics.httpReqDurationCheckout;
        pathPrefix = 'http_req_duration{journey:checkout}';
        expectedThresholdMetric = 'http_req_duration{journey:checkout}';
      } else if (scopeLower.includes('search')) {
        metricObj = allMetrics.httpReqDurationSearch;
        pathPrefix = 'http_req_duration{journey:search}';
        expectedThresholdMetric = 'http_req_duration{journey:search}';
      } else if (scopeLower.includes('basket')) {
        metricObj = allMetrics.httpReqDurationBasket;
        pathPrefix = 'http_req_duration{journey:basket}';
        expectedThresholdMetric = 'http_req_duration{journey:basket}';
      } else if (scopeLower.includes('browse')) {
        metricObj = allMetrics.httpReqDurationBrowse;
        pathPrefix = 'http_req_duration{journey:browse}';
        expectedThresholdMetric = 'http_req_duration{journey:browse}';
      } else if (scopeLower.includes('global') || scopeLower === '' || scopeLower === 'all') {
        metricObj = results.metrics.httpReqDuration;
        pathPrefix = 'http_req_duration';
        expectedThresholdMetric = 'http_req_duration';
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
          normalizedComparisonThreshold: undefined,
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
          normalizedComparisonThreshold: undefined,
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
          normalizedComparisonThreshold: undefined,
          observedValue: undefined,
          observedUnit: undefined,
          evidenceSourcePath: undefined,
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

      // Exact Corroborating engine threshold check (metric + expression)
      const expectedThresholdExpression = p !== undefined
        ? `p(${p})${op}${normalizedComparisonThreshold}`
        : `avg${op}${normalizedComparisonThreshold}`;

      const matchingThresholdObs = results.thresholdObservations.find(
        (t) => t.metric === expectedThresholdMetric && t.expression === expectedThresholdExpression
      );

      let corroboratingEngineThreshold: AcceptanceCriterionEvaluation['corroboratingEngineThreshold'] | undefined;
      if (matchingThresholdObs) {
        const isPassed = matchingThresholdObs.status === 'OBSERVED_PASSED';
        const isFailed = matchingThresholdObs.status === 'OBSERVED_FAILED';

        // Check for contradiction between status and engineResult
        if (
          (isPassed && matchingThresholdObs.engineResult === false) ||
          (isFailed && matchingThresholdObs.engineResult === true)
        ) {
          engineConflictReasons.push(
            `Threshold '${matchingThresholdObs.metric}' (${matchingThresholdObs.expression}) has internal contradiction: status='${matchingThresholdObs.status}' contradicts engineResult='${matchingThresholdObs.engineResult}'.`
          );
        }

        if (
          matchingThresholdObs.status === 'UNAVAILABLE' ||
          matchingThresholdObs.status === 'UNSUPPORTED' ||
          matchingThresholdObs.engineResult === null
        ) {
          corroboratingEngineThreshold = {
            metric: matchingThresholdObs.metric,
            expression: matchingThresholdObs.expression,
            enginePassed: null,
            agreesWithEngine: true,
            status: matchingThresholdObs.status
          };
        } else {
          const enginePassed = isPassed || matchingThresholdObs.engineResult === true;
          const agreesWithEngine = enginePassed === passes;
          corroboratingEngineThreshold = {
            metric: matchingThresholdObs.metric,
            expression: matchingThresholdObs.expression,
            enginePassed,
            agreesWithEngine,
            status: matchingThresholdObs.status
          };

          if (!agreesWithEngine) {
            engineConflictReasons.push(
              `Corroboration conflict for criterion '${crit.id}': independent evaluation is '${status}', but k6 engine threshold '${matchingThresholdObs.metric}' (${matchingThresholdObs.expression}) reported enginePassed='${enginePassed}'.`
            );
          }
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
      criterionEvaluations.push({
        criterionId: crit.id,
        key: crit.key,
        metric: crit.metric,
        scope: crit.scope,
        operator: op,
        canonicalThresholdValue: crit.thresholdValue,
        canonicalUnit: crit.unit,
        percentile: crit.percentile,
        normalizedComparisonThreshold: undefined,
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
  // Gate 6: Blocking Governed Observations
  else if (normalizedGovernedObservations.some((o) => o.isBlocking)) {
    overallVerdict = 'INCONCLUSIVE';
    const blockingObs = normalizedGovernedObservations.filter((o) => o.isBlocking);
    verdictReasons.push(
      ...blockingObs.map((o) => `Blocking governed observation '${o.id}': ${o.description}`)
    );
  }
  // Gate 7: Criterion Failures (Workload is attained, no blocking observations)
  else if (criterionEvaluations.some((c) => c.status === 'FAIL')) {
    overallVerdict = 'FAIL';
    const failedCriteria = criterionEvaluations.filter((c) => c.status === 'FAIL');
    verdictReasons.push(
      ...failedCriteria.map((c) => `Criterion '${c.criterionId}' failed: ${c.deterministicRationale}`)
    );
  }
  // Gate 8: PASS vs PASS_WITH_OBSERVATION
  else {
    const nonBlockingObs = normalizedGovernedObservations.filter((o) => !o.isBlocking);
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
      observedValue: workloadPrerequisite.observedValue,
      requiredMinimum: workloadPrerequisite.requiredMinimum
    },
    criteria: criterionEvaluations.map((c) => ({
      id: c.criterionId,
      status: c.status,
      observed: c.observedValue,
      threshold: c.normalizedComparisonThreshold
    })),
    governedObservations: normalizedGovernedObservations
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((o) => ({
        id: o.id,
        source: o.source,
        severity: o.severity,
        isBlocking: o.isBlocking,
        description: o.description,
        provenanceReference: o.provenanceReference
      })),
    overallVerdict
  };

  const evaluationFingerprint = computeStringChecksum(JSON.stringify(fingerprintPayload));
  const resolvedEvaluationId = input.evaluationId ?? `acceptance-${evaluationFingerprint}`;

  const evaluation: AcceptanceEvaluation = {
    id: resolvedEvaluationId,
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
    governedObservations: normalizedGovernedObservations,
    overallVerdict,
    verdictReasons,
    evaluatedAt: input.evaluationTimestamp,
    evaluationFingerprint
  };

  return deepFreeze(evaluation);
}
