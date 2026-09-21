import { describe, it, expect } from 'vitest';
import {
  evaluateAcceptance,
  compileTestDefinition,
  ingestGovernedExecutionEvidence
} from '@pecp/test-engine';
import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  GovernedObservation
} from '@pecp/pe-domain';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../fixtures/retailco/m3ExecutionFixture';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  AUTHORITATIVE_M3_1B_MANIFEST,
  AUTHORITATIVE_M3_1B_ARTIFACT_REFERENCE,
  AUTHORITATIVE_CONFIG_RAW,
  AUTHORITATIVE_JOURNEYS_RAW,
  AUTHORITATIVE_ENTRYPOINT_RAW,
  AUTHORITATIVE_RUNTIME_RAW,
  AUTHORITATIVE_STDOUT_RAW,
  AUTHORITATIVE_STDERR_RAW,
  AUTHORITATIVE_SUMMARY_RAW
} from '../fixtures/retailco/m31bAuthoritativeRunFixture';

describe('M3.3 — Deterministic Acceptance Engine', () => {
  // Authoritative inputs
  const createAuthoritativeResults = (): CanonicalExecutionResult => {
    return ingestGovernedExecutionEvidence({
      manifest: JSON.parse(JSON.stringify(AUTHORITATIVE_M3_1B_MANIFEST)),
      summaryJson: AUTHORITATIVE_SUMMARY_RAW,
      stdoutLog: AUTHORITATIVE_STDOUT_RAW,
      stderrLog: AUTHORITATIVE_STDERR_RAW,
      configJson: AUTHORITATIVE_CONFIG_RAW,
      journeysJs: AUTHORITATIVE_JOURNEYS_RAW,
      entrypointJs: AUTHORITATIVE_ENTRYPOINT_RAW,
      runtimeJs: AUTHORITATIVE_RUNTIME_RAW,
      executionArtifact: AUTHORITATIVE_M3_1B_ARTIFACT_REFERENCE
    });
  };

  const createAuthoritativeTestDef = (): TestDefinition => {
    return compileTestDefinition({
      contract: RETAILCO_M3_APPROVED_CONTRACT,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      testDefinitionId: 'test-def-proj-retailco-bf2026-v1.0',
      version: 'v1.0',
      executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
    });
  };

  // -------------------------------------------------------------------------
  // 1. Authoritative RetailCo Reference Run (M3.1B / M3.2)
  // -------------------------------------------------------------------------
  describe('1. Authoritative RetailCo Reference Run Evaluation (§12)', () => {
    it('evaluates criteria as PASS details but produces INCONCLUSIVE overall due to unresolved steady-state workload', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      // 1. Provenance Gate
      expect(evaluation.provenanceGate.isValid).toBe(true);
      expect(evaluation.provenanceGate.reasons).toEqual([]);

      // 2. Operational Integrity Gate
      expect(evaluation.operationalIntegrityGate.isValid).toBe(true);
      expect(evaluation.operationalIntegrityGate.reasons).toEqual([]);

      // 3. Workload Attainment Prerequisite: UNRESOLVED
      expect(evaluation.workloadPrerequisite.status).toBe('UNRESOLVED');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(false);
      expect(evaluation.workloadPrerequisite.timeBasis).toBe('STEADY_STATE_PEAK');
      expect(evaluation.workloadPrerequisite.observedValue).toBeUndefined();
      expect(evaluation.workloadPrerequisite.targetValue).toBe(8.75);
      expect(evaluation.workloadPrerequisite.rationale).toContain('unresolved');

      // 4. Criterion Details: Both criteria evaluate to PASS individually
      expect(evaluation.criterionEvaluations).toHaveLength(2);

      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit).toBeDefined();
      expect(latencyCrit?.status).toBe('PASS');
      expect(latencyCrit?.canonicalThresholdValue).toBe(2000);
      expect(latencyCrit?.canonicalUnit).toBe('ms');
      expect(latencyCrit?.percentile).toBe(95);
      expect(latencyCrit?.observedValue).toBeDefined();
      expect(latencyCrit?.observedValue).toBeLessThan(2000);
      expect(latencyCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBe(true);
      expect(latencyCrit?.corroboratingEngineThreshold?.enginePassed).toBe(true);

      const errorRateCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-global-error-rate'
      );
      expect(errorRateCrit).toBeDefined();
      expect(errorRateCrit?.status).toBe('PASS');
      expect(errorRateCrit?.canonicalThresholdValue).toBe(0.005);
      expect(errorRateCrit?.canonicalUnit).toBe('rate');
      expect(errorRateCrit?.observedValue).toBeDefined();
      expect(errorRateCrit?.observedValue).toBeLessThan(0.005);
      expect(errorRateCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBe(true);
      expect(errorRateCrit?.corroboratingEngineThreshold?.enginePassed).toBe(true);

      // 5. Overall Verdict: MUST be INCONCLUSIVE
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('unresolved'))).toBe(true);

      // 6. Immutability & Fingerprint
      expect(evaluation.evaluationFingerprint).toBeDefined();
      expect(evaluation.evaluationFingerprint.startsWith('fp-')).toBe(true);
      expect(() => {
        (evaluation as any).overallVerdict = 'PASS';
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Synthetic Verdict Paths (PASS, FAIL, PASS_WITH_OBSERVATION, INCONCLUSIVE)
  // -------------------------------------------------------------------------
  describe('2. Synthetic Verdict Paths (§13)', () => {
    it('produces PASS when workload is attained, all criteria pass, and no observations exist', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Synthesize attained steady-state workload (8.9 orders/s >= 8.75)
      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          attainmentRatio: 8.9 / 8.75
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(true);
      expect(evaluation.workloadPrerequisite.observedValue).toBe(8.9);
      expect(evaluation.overallVerdict).toBe('PASS');
      expect(evaluation.verdictReasons).toContain(
        'All canonical acceptance criteria passed and governed workload demand was attained.'
      );
    });

    it('produces FAIL when workload is attained and one or more criteria fail', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Synthesize attained workload + latency regression (2450ms > 2000ms threshold)
      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        metrics: {
          ...baseResults.metrics,
          httpReqDurationCheckout: {
            ...baseResults.metrics.httpReqDurationCheckout,
            p95: 2450
          }
        },
        thresholdObservations: [
          {
            metric: 'http_req_duration{journey:checkout}',
            expression: 'p(95)<2000',
            status: 'OBSERVED_FAILED',
            engineResult: false,
            observedValue: 2450,
            rawSource: {}
          },
          ...baseResults.thresholdObservations.filter(
            (t) => t.metric !== 'http_req_duration{journey:checkout}'
          )
        ]
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(true);

      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit?.status).toBe('FAIL');
      expect(latencyCrit?.observedValue).toBe(2450);

      expect(evaluation.overallVerdict).toBe('FAIL');
      expect(evaluation.verdictReasons.some((r) => r.includes('ac-checkout-latency') && r.includes('failed'))).toBe(true);
    });

    it('produces PASS_WITH_OBSERVATION when workload attained, all criteria pass, and governed observation is present', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.85,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const governedObservations: GovernedObservation[] = [
        {
          id: 'obs-ref-lab-cpu-warning',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'Reference Lab CPU utilization hovered at 78% during peak steady-state.',
          severity: 'OBSERVATION',
          isBlocking: false
        }
      ];

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations
      });

      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');
      expect(evaluation.criterionEvaluations.every((c) => c.status === 'PASS')).toBe(true);
      expect(evaluation.overallVerdict).toBe('PASS_WITH_OBSERVATION');
      expect(evaluation.verdictReasons.some((r) => r.includes('governed non-blocking observation'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Mandatory Workload Attainment Law (Prerequisite Gate Enforcement)
  // -------------------------------------------------------------------------
  describe('3. Mandatory Workload Attainment Law (§2, §5, §11)', () => {
    it('produces INCONCLUSIVE (never FAIL) when performance criterion fails but workload was NOT attained', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Workload fell short (5.2 orders/s < 8.75), and latency also failed (3100ms > 2000ms)
      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 5.2,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        metrics: {
          ...baseResults.metrics,
          httpReqDurationCheckout: {
            ...baseResults.metrics.httpReqDurationCheckout,
            p95: 3100
          }
        },
        thresholdObservations: [
          {
            metric: 'http_req_duration{journey:checkout}',
            expression: 'p(95)<2000',
            status: 'OBSERVED_FAILED',
            engineResult: false,
            observedValue: 3100,
            rawSource: {}
          },
          ...baseResults.thresholdObservations.filter(
            (t) => t.metric !== 'http_req_duration{journey:checkout}'
          )
        ]
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      // Workload prerequisite was not met
      expect(evaluation.workloadPrerequisite.status).toBe('NOT_ATTAINED');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(false);

      // Latency criterion did fail in its detail
      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit?.status).toBe('FAIL');

      // CRITICAL LAW: Must NOT be FAIL! Must be INCONCLUSIVE!
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('failed to meet required minimum'))).toBe(true);
    });

    it('produces INCONCLUSIVE when performance criterion fails and workload is UNRESOLVED', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Latency failed, but workload is unresolved
      const results: CanonicalExecutionResult = {
        ...baseResults,
        metrics: {
          ...baseResults.metrics,
          httpReqDurationCheckout: {
            ...baseResults.metrics.httpReqDurationCheckout,
            p95: 3500
          }
        },
        thresholdObservations: [
          {
            metric: 'http_req_duration{journey:checkout}',
            expression: 'p(95)<2000',
            status: 'OBSERVED_FAILED',
            engineResult: false,
            observedValue: 3500,
            rawSource: {}
          },
          ...baseResults.thresholdObservations.filter(
            (t) => t.metric !== 'http_req_duration{journey:checkout}'
          )
        ]
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('UNRESOLVED');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Provenance and Drift Validity Gate (§3)
  // -------------------------------------------------------------------------
  describe('4. Provenance and Drift Validity Gate (§3)', () => {
    it('produces INCONCLUSIVE when PerformanceContract is not in APPROVED status', () => {
      const contract: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        status: 'DRAFT'
      };
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('APPROVED'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when TestDefinition sourceContractId mismatches Contract id', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef: TestDefinition = {
        ...createAuthoritativeTestDef(),
        sourceContractId: 'contract-different-id'
      };
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('sourceContractId'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when Contract fingerprint drifts from TestDefinition source fingerprint', () => {
      // Altering contract criteria modifies computed contract fingerprint
      const contract: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        acceptanceCriteria: RETAILCO_M3_APPROVED_CONTRACT.acceptanceCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, target: 'p95 < 1500ms' } : c
        )
      };
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('fingerprint'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when Results testDefinition fingerprint mismatches compiled TestDefinition', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: {
          ...baseResults.run,
          testDefinition: {
            ...baseResults.run.testDefinition,
            fingerprint: 'fp-different-hash'
          }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('Results testDefinition.fingerprint'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Operational and Evidence Integrity Gate (§4)
  // -------------------------------------------------------------------------
  describe('5. Operational and Evidence Integrity Gate (§4)', () => {
    it('produces INCONCLUSIVE when preflight verification is invalid', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: {
          ...baseResults.run,
          preflightStatus: {
            status: 'PREFLIGHT_FAILED',
            isValid: false,
            blockingReasons: ['Reference Lab endpoint unreachable']
          }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.operationalIntegrityGate.isValid).toBe(false);
      expect(evaluation.operationalIntegrityGate.reasons.some((r) => r.includes('Preflight'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when engine exit code is non-zero', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: {
          ...baseResults.run,
          engineExitCode: 1
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.operationalIntegrityGate.isValid).toBe(false);
      expect(evaluation.operationalIntegrityGate.reasons.some((r) => r.includes('exit code'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when execution operationalStatus is not completed', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: {
          ...baseResults.run,
          operationalStatus: 'EXECUTION_ABORTED' as any
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.operationalIntegrityGate.isValid).toBe(false);
      expect(evaluation.operationalIntegrityGate.reasons.some((r) => r.includes('EXECUTION_ABORTED'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when results contain data quality integrity errors', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        dataQuality: {
          ...baseResults.dataQuality,
          hasIntegrityErrors: true,
          issues: [
            {
              code: 'CHECKSUM_MISMATCH',
              severity: 'FATAL',
              message: 'Raw artifact digest checksum mismatch'
            }
          ]
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.operationalIntegrityGate.isValid).toBe(false);
      expect(evaluation.operationalIntegrityGate.reasons.some((r) => r.includes('integrity errors'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Criterion Evaluability Gate (§6, §7)
  // -------------------------------------------------------------------------
  describe('6. Criterion Evaluability Gate (§6, §7)', () => {
    it('produces NOT_EVALUABLE and overall INCONCLUSIVE when required raw metric is absent', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Attain workload so workload gate passes, but omit httpReqFailed metric
      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        metrics: {
          ...baseResults.metrics,
          httpReqFailed: undefined
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const errorCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-global-error-rate'
      );
      expect(errorCrit?.status).toBe('NOT_EVALUABLE');
      expect(errorCrit?.deterministicRationale).toContain('absent');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('NOT_EVALUABLE'))).toBe(true);
    });

    it('produces NOT_EVALUABLE when criterion operator is unsupported', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        executableCriteria: baseTestDef.executableCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, operator: 'BETWEEN' as any } : c
        )
      };

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit?.status).toBe('NOT_EVALUABLE');
      expect(latencyCrit?.deterministicRationale).toContain('Unsupported or missing comparison operator');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces NOT_EVALUABLE when criterion unit is unsupported', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        executableCriteria: baseTestDef.executableCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, unit: 'lightyears' as any } : c
        )
      };

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit?.status).toBe('NOT_EVALUABLE');
      expect(latencyCrit?.deterministicRationale).toContain('Unsupported unit');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Engine Threshold Corroboration Conflict Gate (§8)
  // -------------------------------------------------------------------------
  describe('7. Engine Threshold Corroboration Conflict Gate (§8)', () => {
    it('produces INCONCLUSIVE when independent comparison disagrees with k6 engine threshold', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Observed checkout latency is 115ms (< 2000ms => PASS),
      // BUT k6 threshold observation was recorded as OBSERVED_FAILED (engineResult: false).
      // PECP must record an evidence conflict and mark verdict INCONCLUSIVE without guessing.
      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        thresholdObservations: [
          {
            metric: 'http_req_duration{journey:checkout}',
            expression: 'p(95)<2000',
            status: 'OBSERVED_FAILED',
            engineResult: false,
            observedValue: 115,
            rawSource: {}
          },
          ...baseResults.thresholdObservations.filter(
            (t) => t.metric !== 'http_req_duration{journey:checkout}'
          )
        ]
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit?.status).toBe('PASS');
      expect(latencyCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBe(false);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Corroboration conflict'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Deterministic Fingerprint Reproducibility (§15)
  // -------------------------------------------------------------------------
  describe('8. Deterministic Fingerprint Reproducibility (§15)', () => {
    it('generates identical evaluation fingerprints for identical evaluations regardless of wall-clock time', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const eval1 = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        evaluationTimestamp: '2026-08-25T14:00:00.000Z',
        evaluationId: 'eval-1'
      });

      const eval2 = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        evaluationTimestamp: '2026-09-21T00:00:00.000Z',
        evaluationId: 'eval-2'
      });

      expect(eval1.evaluationFingerprint).toBe(eval2.evaluationFingerprint);
      expect(eval1.overallVerdict).toBe(eval2.overallVerdict);
    });
  });
});
