import { describe, it, expect } from 'vitest';
import {
  evaluateAcceptance,
  compileTestDefinition,
  ingestGovernedExecutionEvidence,
  computeTestDefinitionFingerprint
} from '@pecp/test-engine';
import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  GovernedObservation,
  computeContractFingerprint
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
      expect(latencyCrit?.observedValue).toBe(0.3906885);
      expect(latencyCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBe(true);
      expect(latencyCrit?.corroboratingEngineThreshold?.enginePassed).toBe(true);

      const errorRateCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-global-error-rate'
      );
      expect(errorRateCrit).toBeDefined();
      expect(errorRateCrit?.status).toBe('PASS');
      expect(errorRateCrit?.canonicalThresholdValue).toBe(0.005);
      expect(errorRateCrit?.canonicalUnit).toBe('rate');
      expect(errorRateCrit?.observedValue).toBe(0);
      expect(errorRateCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBe(true);
      expect(errorRateCrit?.corroboratingEngineThreshold?.enginePassed).toBe(true);

      // 5. Overall Verdict: MUST be INCONCLUSIVE
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('unresolved'))).toBe(true);

      // 6. Immutability & Fingerprint
      expect(evaluation.evaluationDigest).toBeDefined();
      expect(evaluation.evaluationDigest.algorithm).toBe('SHA-256');
      expect(evaluation.evaluationDigest.schemaVersion).toBe('acceptance-evaluation-v1');
      expect(evaluation.evaluationDigest.value).toMatch(/^[0-9a-f]{64}$/);
      expect(evaluation.evaluationFingerprint).toBe(evaluation.evaluationDigest.value);
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

  // -------------------------------------------------------------------------
  // 9. Contract-TestDefinition Parity and Integrity Gate (M3.3.1 §3)
  // -------------------------------------------------------------------------
  describe('9. Contract-TestDefinition Parity and Integrity Gate (M3.3.1 §3)', () => {
    it('produces INCONCLUSIVE when test definition executable criterion is missing in contract', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        executableCriteria: [
          ...baseTestDef.executableCriteria,
          {
            id: 'ac-unapproved-extra',
            key: 'extra_metric',
            metric: 'extra_latency',
            target: 'p95 < 500ms',
            operator: '<',
            thresholdValue: 500,
            unit: 'ms',
            percentile: 95,
            scope: 'extra',
            status: 'DEFINED',
            isBlockingForApproval: true
          }
        ]
      };
      // Keep fingerprint valid for self-integrity check so parity failure is isolated
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);
      const resultsSynced = {
        ...results,
        run: {
          ...results.run,
          testDefinition: { ...results.run.testDefinition, fingerprint: testDef.fingerprint }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: resultsSynced
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('ac-unapproved-extra'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when contract criterion status is not DEFINED', () => {
      const contract: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        acceptanceCriteria: RETAILCO_M3_APPROVED_CONTRACT.acceptanceCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, status: 'DRAFT' as any } : c
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
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('ac-checkout-latency') && r.includes('DRAFT'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when criterion semantics mismatch (operator, target, threshold, unit, percentile, scope)', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        executableCriteria: baseTestDef.executableCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, thresholdValue: 1500 } : c
        )
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);
      const resultsSynced = {
        ...results,
        run: {
          ...results.run,
          testDefinition: { ...results.run.testDefinition, fingerprint: testDef.fingerprint }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: resultsSynced
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('semantics differ') && r.includes('thresholdValue'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when DEFINED contract criterion is missing in test definition', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        executableCriteria: baseTestDef.executableCriteria.filter((c) => c.id !== 'ac-global-error-rate')
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);
      const resultsSynced = {
        ...results,
        run: {
          ...results.run,
          testDefinition: { ...results.run.testDefinition, fingerprint: testDef.fingerprint }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: resultsSynced
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('ac-global-error-rate') && r.includes('missing from TestDefinition'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when contract contains ambiguous, unresolved, or conflicting criteria', () => {
      const contract: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        acceptanceCriteria: [
          ...RETAILCO_M3_APPROVED_CONTRACT.acceptanceCriteria,
          {
            id: 'ac-unresolved-candidate',
            key: 'unresolved_journey',
            metric: 'latency',
            target: 'unknown target',
            operator: '<',
            thresholdValue: 100,
            unit: 'ms',
            scope: 'unresolved',
            status: 'AMBIGUOUS',
            isBlockingForApproval: true
          }
        ]
      };
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('unresolved criteria') && r.includes('AMBIGUOUS'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('produces INCONCLUSIVE when test definition fingerprint mismatches recomputed self-integrity fingerprint', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      // Tamper fingerprint
      const testDef: TestDefinition = {
        ...baseTestDef,
        fingerprint: 'fp-tampered-hash-12345'
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.provenanceGate.isValid).toBe(false);
      expect(evaluation.provenanceGate.reasons.some((r) => r.includes('self-integrity failed'))).toBe(true);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 10. Workload Authority and Tolerance Matrix (M3.3.1 §3)
  // -------------------------------------------------------------------------
  describe('10. Workload Authority and Tolerance Matrix (M3.3.1 §3)', () => {
    it('produces INVALID workload and INCONCLUSIVE when target value mismatches between TestDefinition and results', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          governedDemand: {
            targetValue: 15.0, // mismatches testDef.workloadAttainment.targetValue (8.75)
            unit: 'orders/s'
          }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(false);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('targetValue 15 mismatches'))).toBe(true);
    });

    it('produces INVALID workload and INCONCLUSIVE when target unit mismatches', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          governedDemand: {
            targetValue: 8.75,
            unit: 'req/s' // mismatches 'orders/s'
          }
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('target unit \'req/s\' mismatches'))).toBe(true);
    });

    it('produces INVALID workload and INCONCLUSIVE when governed population mismatches', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          governedPopulation: 'mismatched_population_id'
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('governed population \'mismatched_population_id\' mismatches'))).toBe(true);
    });

    it('produces INVALID workload and INCONCLUSIVE when acceptance time basis is unapproved (e.g. FULL_TEST_AVERAGE)', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          timeBasis: 'FULL_TEST_AVERAGE' as any
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('time basis \'FULL_TEST_AVERAGE\' is unapproved'))).toBe(true);
    });

    it('produces INVALID workload and INCONCLUSIVE when claimed resultValue has missing actualSourceMetric', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          actualSourceMetric: undefined
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('no grounded actualSourceMetric'))).toBe(true);
    });

    it('evaluates absent tolerance strictly against target value', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        workloadAttainment: {
          ...baseTestDef.workloadAttainment!,
          tolerancePercentage: undefined
        }
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);

      // Target is 8.75. Result 8.74 must NOT attain.
      const resultsFail: CanonicalExecutionResult = {
        ...baseResults,
        run: { ...baseResults.run, testDefinition: { ...baseResults.run.testDefinition, fingerprint: testDef.fingerprint } },
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.74,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const evalFail = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: resultsFail
      });
      expect(evalFail.workloadPrerequisite.status).toBe('NOT_ATTAINED');
      expect(evalFail.workloadPrerequisite.requiredMinimum).toBe(8.75);
      expect(evalFail.overallVerdict).toBe('INCONCLUSIVE');

      // Result 8.75 must attain exactly.
      const resultsPass: CanonicalExecutionResult = {
        ...resultsFail,
        acceptanceBasisAttainment: {
          ...resultsFail.acceptanceBasisAttainment,
          resultValue: 8.75
        }
      };

      const evalPass = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: resultsPass
      });
      expect(evalPass.workloadPrerequisite.status).toBe('ATTAINED');
      expect(evalPass.overallVerdict).toBe('PASS');
    });

    it('evaluates valid tolerance percentage (5%): target 8.75 * 0.95 = 8.3125, so 8.4 passes', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        workloadAttainment: {
          ...baseTestDef.workloadAttainment!,
          tolerancePercentage: 5
        }
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);

      // 8.4 is below 8.75, but above 8.75 * 0.95 = 8.3125
      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: { ...baseResults.run, testDefinition: { ...baseResults.run.testDefinition, fingerprint: testDef.fingerprint } },
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.4,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');
      expect(evaluation.workloadPrerequisite.requiredMinimum).toBeCloseTo(8.3125, 4);
      expect(evaluation.overallVerdict).toBe('PASS');
    });

    it('produces INVALID workload and INCONCLUSIVE when tolerance percentage is negative (-5%)', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        workloadAttainment: {
          ...baseTestDef.workloadAttainment!,
          tolerancePercentage: -5
        }
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: { ...baseResults.run, testDefinition: { ...baseResults.run.testDefinition, fingerprint: testDef.fingerprint } },
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

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Invalid workload tolerancePercentage \'-5\''))).toBe(true);
    });

    it('produces INVALID workload and INCONCLUSIVE when tolerance percentage is > 100% (105%)', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        workloadAttainment: {
          ...baseTestDef.workloadAttainment!,
          tolerancePercentage: 105
        }
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: { ...baseResults.run, testDefinition: { ...baseResults.run.testDefinition, fingerprint: testDef.fingerprint } },
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

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Invalid workload tolerancePercentage \'105\''))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 11. Exact Engine Corroboration Matrix (M3.3.1 §3)
  // -------------------------------------------------------------------------
  describe('11. Exact Engine Corroboration Matrix (M3.3.1 §3)', () => {
    it('corroborates exact metric + expression match', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: baseResults
      });

      const latencyCrit = evaluation.criterionEvaluations.find(
        (c) => c.criterionId === 'ac-checkout-latency'
      );
      expect(latencyCrit?.corroboratingEngineThreshold).toBeDefined();
      expect(latencyCrit?.corroboratingEngineThreshold?.metric).toBe('http_req_duration{journey:checkout}');
      expect(latencyCrit?.corroboratingEngineThreshold?.expression).toBe('p(95)<2000');
      expect(latencyCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBe(true);
      expect(latencyCrit?.corroboratingEngineThreshold?.enginePassed).toBe(true);
    });

    it('leaves corroboratingEngineThreshold undefined when metric matches but expression differs', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Change threshold observation expression to p(95)<1500 (mismatches criterion threshold of 2000)
      const results: CanonicalExecutionResult = {
        ...baseResults,
        thresholdObservations: baseResults.thresholdObservations.map((t) =>
          t.metric === 'http_req_duration{journey:checkout}'
            ? { ...t, expression: 'p(95)<1500' }
            : t
        )
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
      expect(latencyCrit?.corroboratingEngineThreshold).toBeUndefined();
    });

    it('produces INCONCLUSIVE when threshold observation status contradicts engineResult boolean', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Contradictory: status OBSERVED_PASSED but engineResult: false
      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        thresholdObservations: baseResults.thresholdObservations.map((t) =>
          t.metric === 'http_req_duration{journey:checkout}'
            ? { ...t, status: 'OBSERVED_PASSED', engineResult: false }
            : t
        )
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('internal contradiction'))).toBe(true);
    });

    it('preserves status and does not fail on UNAVAILABLE / UNSUPPORTED threshold observations', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        thresholdObservations: baseResults.thresholdObservations.map((t) =>
          t.metric === 'http_req_duration{journey:checkout}'
            ? { ...t, status: 'UNAVAILABLE', engineResult: null }
            : t
        )
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
      expect(latencyCrit?.corroboratingEngineThreshold?.status).toBe('UNAVAILABLE');
      expect(latencyCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBeUndefined();
      expect(latencyCrit?.corroboratingEngineThreshold?.enginePassed).toBeNull();
      expect(evaluation.overallVerdict).toBe('PASS');
    });
  });

  // -------------------------------------------------------------------------
  // 12. Comparison Operators and Units Matrix (M3.3.1 §3)
  // -------------------------------------------------------------------------
  describe('12. Comparison Operators and Units Matrix (M3.3.1 §3)', () => {
    const buildSyntheticEvaluation = (
      operator: '<' | '<=' | '>' | '>=' | '==',
      thresholdValue: number,
      unit: string,
      observedMetricVal: number
    ) => {
      const baseContract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const contract: PerformanceContract = {
        ...baseContract,
        acceptanceCriteria: [
          {
            id: 'ac-test-op',
            key: 'test_op',
            metric: 'checkout_latency',
            target: `p95 ${operator} ${thresholdValue}${unit}`,
            operator,
            thresholdValue,
            unit,
            percentile: 95,
            scope: 'checkout',
            status: 'DEFINED',
            isBlockingForApproval: true
          }
        ]
      };

      const testDef: TestDefinition = {
        ...baseTestDef,
        sourceContractId: contract.id,
        sourceContractVersion: contract.version,
        sourceContractFingerprint: computeContractFingerprint(contract),
        executableCriteria: [
          {
            id: 'ac-test-op',
            key: 'test_op',
            metric: 'checkout_latency',
            target: `p95 ${operator} ${thresholdValue}${unit}`,
            operator,
            thresholdValue,
            unit,
            percentile: 95,
            scope: 'checkout',
            status: 'DEFINED',
            isBlockingForApproval: true
          }
        ]
      };
      testDef.fingerprint = computeTestDefinitionFingerprint(testDef);

      const results: CanonicalExecutionResult = {
        ...baseResults,
        run: {
          ...baseResults.run,
          sourceContract: {
            id: contract.id,
            version: contract.version,
            fingerprint: testDef.sourceContractFingerprint
          },
          testDefinition: {
            id: testDef.id,
            version: testDef.version,
            fingerprint: testDef.fingerprint
          }
        },
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        },
        metrics: {
          ...baseResults.metrics,
          httpReqDurationCheckout: {
            ...baseResults.metrics.httpReqDurationCheckout,
            p95: observedMetricVal
          }
        },
        thresholdObservations: []
      };

      return evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });
    };

    it('evaluates comparison operators: <, <=, >, >=, == correctly', () => {
      // '<'
      expect(buildSyntheticEvaluation('<', 200, 'ms', 199).criterionEvaluations[0].status).toBe('PASS');
      expect(buildSyntheticEvaluation('<', 200, 'ms', 200).criterionEvaluations[0].status).toBe('FAIL');

      // '<='
      expect(buildSyntheticEvaluation('<=', 200, 'ms', 200).criterionEvaluations[0].status).toBe('PASS');
      expect(buildSyntheticEvaluation('<=', 200, 'ms', 201).criterionEvaluations[0].status).toBe('FAIL');

      // '>'
      expect(buildSyntheticEvaluation('>', 200, 'ms', 201).criterionEvaluations[0].status).toBe('PASS');
      expect(buildSyntheticEvaluation('>', 200, 'ms', 200).criterionEvaluations[0].status).toBe('FAIL');

      // '>='
      expect(buildSyntheticEvaluation('>=', 200, 'ms', 200).criterionEvaluations[0].status).toBe('PASS');
      expect(buildSyntheticEvaluation('>=', 200, 'ms', 199).criterionEvaluations[0].status).toBe('FAIL');

      // '=='
      expect(buildSyntheticEvaluation('==', 200, 'ms', 200).criterionEvaluations[0].status).toBe('PASS');
      expect(buildSyntheticEvaluation('==', 200, 'ms', 201).criterionEvaluations[0].status).toBe('FAIL');
    });

    it('evaluates latency units: ms and s correctly', () => {
      // 2 seconds => 2000 ms threshold
      const evalSeconds = buildSyntheticEvaluation('<', 2, 's', 1500);
      const critS = evalSeconds.criterionEvaluations[0];
      expect(critS.canonicalUnit).toBe('s');
      expect(critS.canonicalThresholdValue).toBe(2);
      expect(critS.normalizedComparisonThreshold).toBe(2000);
      expect(critS.status).toBe('PASS');

      // 2000 ms => 2000 ms threshold
      const evalMs = buildSyntheticEvaluation('<', 2000, 'ms', 1500);
      const critMs = evalMs.criterionEvaluations[0];
      expect(critMs.canonicalUnit).toBe('ms');
      expect(critMs.canonicalThresholdValue).toBe(2000);
      expect(critMs.normalizedComparisonThreshold).toBe(2000);
      expect(critMs.status).toBe('PASS');
    });

    it('evaluates error rate units: %, rate, and fraction correctly', () => {
      const baseContract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testUnit = (unit: '%' | 'rate' | 'fraction', thresholdValue: number, observedVal: number) => {
        const contract: PerformanceContract = {
          ...baseContract,
          acceptanceCriteria: [
            {
              id: 'ac-test-err',
              key: 'test_err',
              metric: 'global_error_rate',
              target: `rate < ${thresholdValue}${unit}`,
              operator: '<',
              thresholdValue,
              unit,
              scope: 'global',
              status: 'DEFINED',
              isBlockingForApproval: true
            }
          ]
        };

        const testDef: TestDefinition = {
          ...baseTestDef,
          sourceContractId: contract.id,
          sourceContractVersion: contract.version,
          sourceContractFingerprint: computeContractFingerprint(contract),
          executableCriteria: [
            {
              id: 'ac-test-err',
              key: 'test_err',
              metric: 'global_error_rate',
              target: `rate < ${thresholdValue}${unit}`,
              operator: '<',
              thresholdValue,
              unit,
              scope: 'global',
              status: 'DEFINED',
              isBlockingForApproval: true
            }
          ]
        };
        testDef.fingerprint = computeTestDefinitionFingerprint(testDef);

        const results: CanonicalExecutionResult = {
          ...baseResults,
          run: {
            ...baseResults.run,
            sourceContract: {
              id: contract.id,
              version: contract.version,
              fingerprint: testDef.sourceContractFingerprint
            },
            testDefinition: {
              id: testDef.id,
              version: testDef.version,
              fingerprint: testDef.fingerprint
            }
          },
          acceptanceBasisAttainment: {
            ...baseResults.acceptanceBasisAttainment,
            resultValue: 8.9,
            derivationStatus: 'DETERMINISTICALLY_DERIVED'
          },
          metrics: {
            ...baseResults.metrics,
            httpReqFailed: {
              fails: 0,
              passes: 100,
              rate: observedVal
            }
          },
          thresholdObservations: []
        };

        return evaluateAcceptance({ contract, testDefinition: testDef, results }).criterionEvaluations[0];
      };

      // 0.5% => normalized comparison threshold is 0.005
      const critPct = testUnit('%', 0.5, 0.002);
      expect(critPct.canonicalUnit).toBe('%');
      expect(critPct.canonicalThresholdValue).toBe(0.5);
      expect(critPct.normalizedComparisonThreshold).toBe(0.005);
      expect(critPct.status).toBe('PASS');

      // rate 0.005 => normalized comparison threshold is 0.005
      const critRate = testUnit('rate', 0.005, 0.006);
      expect(critRate.canonicalUnit).toBe('rate');
      expect(critRate.canonicalThresholdValue).toBe(0.005);
      expect(critRate.normalizedComparisonThreshold).toBe(0.005);
      expect(critRate.status).toBe('FAIL');

      // fraction 0.005 => normalized comparison threshold is 0.005
      const critFraction = testUnit('fraction', 0.005, 0.002);
      expect(critFraction.canonicalUnit).toBe('fraction');
      expect(critFraction.canonicalThresholdValue).toBe(0.005);
      expect(critFraction.normalizedComparisonThreshold).toBe(0.005);
      expect(critFraction.status).toBe('PASS');
    });

    it('preserves original threshold and leaves normalized threshold undefined on unsupported operator without zero-invention', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const testDef: TestDefinition = {
        ...baseTestDef,
        executableCriteria: baseTestDef.executableCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, operator: 'APPROX' as any } : c
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
      expect(latencyCrit?.canonicalThresholdValue).toBe(2000);
      expect(latencyCrit?.normalizedComparisonThreshold).toBeUndefined();
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
    });
  });

  // -------------------------------------------------------------------------
  // 13. Governed Observations Enforcement (M3.3.1 §3)
  // -------------------------------------------------------------------------
  describe('13. Governed Observations Enforcement (M3.3.1 §3)', () => {
    it('produces INCONCLUSIVE when a single blocking governed observation is present', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const governedObservations: GovernedObservation[] = [
        {
          id: 'obs-blocking-crash',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'Payment gateway crashed during peak steady state.',
          severity: 'OBSERVATION',
          isBlocking: true
        }
      ];

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Blocking governed observation \'obs-blocking-crash\''))).toBe(true);
    });

    it('produces INCONCLUSIVE when both blocking and non-blocking observations are present', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const governedObservations: GovernedObservation[] = [
        {
          id: 'obs-nonblocking-cpu',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'CPU reached 75%.',
          severity: 'OBSERVATION',
          isBlocking: false
        },
        {
          id: 'obs-blocking-db',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'Database deadlock observed.',
          severity: 'OBSERVATION',
          isBlocking: true
        }
      ];

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Blocking governed observation \'obs-blocking-db\''))).toBe(true);
    });

    it('produces INCONCLUSIVE when blocking observation is present even if criterion fails', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      // Latency fails (3500 > 2000) AND blocking observation is present
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
          ...baseResults.thresholdObservations.filter((t) => t.metric !== 'http_req_duration{journey:checkout}')
        ]
      };

      const governedObservations: GovernedObservation[] = [
        {
          id: 'obs-blocking-service-restart',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'Service was unexpectedly restarted by container runtime.',
          severity: 'OBSERVATION',
          isBlocking: true
        }
      ];

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations
      });

      // Mandatory Order: Blocking Observations gate (Gate 6) precedes Criterion Failures gate (Gate 7)!
      // Therefore, the overall verdict MUST be INCONCLUSIVE, not FAIL!
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Blocking governed observation'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 14. Caller Input Purity and Deterministic Evaluation Fingerprint (M3.3.1 §3)
  // -------------------------------------------------------------------------
  describe('14. Caller Input Purity and Deterministic Evaluation Fingerprint (M3.3.1 §3)', () => {
    it('ensures caller-owned observations array and observation objects remain unfrozen and mutable', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const callerObs: GovernedObservation[] = [
        {
          id: 'obs-caller-test',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'Initial caller observation',
          severity: 'OBSERVATION',
          isBlocking: false,
          details: { count: 1 }
        }
      ];

      evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations: callerObs
      });

      // Assert caller-owned inputs were NOT frozen
      expect(Object.isFrozen(callerObs)).toBe(false);
      expect(Object.isFrozen(callerObs[0])).toBe(false);
      expect(Object.isFrozen(callerObs[0].details)).toBe(false);

      // Verify caller can still mutate their own objects safely
      expect(() => {
        callerObs[0].description = 'mutated description';
        callerObs.push({
          id: 'obs-caller-test-2',
          source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
          description: 'Pushed second observation',
          severity: 'OBSERVATION',
          isBlocking: false
        });
      }).not.toThrow();
    });

    it('generates identical evaluation output and fingerprint for identical inputs without wall-clock dependence', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const eval1 = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const eval2 = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(eval1.evaluationFingerprint).toBe(eval2.evaluationFingerprint);
      expect(eval1.overallVerdict).toBe(eval2.overallVerdict);
      expect(eval1.id).toBe(eval2.id);
    });

    it('changing a governed observation changes the evaluation fingerprint even when overall verdict remains PASS_WITH_OBSERVATION', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAuthoritativeResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED'
        }
      };

      const evalA = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations: [
          {
            id: 'obs-alpha',
            source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
            description: 'Observation Alpha',
            severity: 'OBSERVATION',
            isBlocking: false
          }
        ]
      });

      const evalB = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations: [
          {
            id: 'obs-beta',
            source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
            description: 'Observation Beta',
            severity: 'OBSERVATION',
            isBlocking: false
          }
        ]
      });

      expect(evalA.overallVerdict).toBe('PASS_WITH_OBSERVATION');
      expect(evalB.overallVerdict).toBe('PASS_WITH_OBSERVATION');
      expect(evalA.evaluationFingerprint).not.toBe(evalB.evaluationFingerprint);
    });
  });

  // -------------------------------------------------------------------------
  // 15. M3.3.2 — Acceptance Evidence Binding & Cryptographic Finalization Gate
  // -------------------------------------------------------------------------
  describe('15. M3.3.2 — Acceptance Evidence Binding & Cryptographic Finalization Gate', () => {
    // Base helper: fully attained results for RetailCo
    const createAttainedResults = (): CanonicalExecutionResult => {
      const base = createAuthoritativeResults();
      return {
        ...base,
        metrics: {
          ...base.metrics,
          pecpBusinessAttainmentEvents: {
            count: 11571,
            rate: 8.758
          }
        },
        acceptanceBasisAttainment: {
          governedDemand: {
            targetValue: 8.75,
            unit: 'orders/second'
          },
          governedPopulation: 'JOURNEY_ITERATION',
          timeBasis: 'STEADY_STATE_PEAK',
          resultValue: 8.9,
          derivationStatus: 'DETERMINISTICALLY_DERIVED',
          actualSourceMetric: 'pecp_business_attainment_events',
          calculationFormula: 'pecp_business_attainment_events.rate during steady state',
          derivationNotes: 'Authoritative derived attainment rate'
        }
      };
    };

    it('exposes dedicated SHA-256 Acceptance Evaluation decision digest and derives deterministic id', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const eval1 = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const eval2 = evaluateAcceptance({ contract, testDefinition: testDef, results });

      // Digest structure
      expect(eval1.evaluationDigest).toBeDefined();
      expect(eval1.evaluationDigest.algorithm).toBe('SHA-256');
      expect(eval1.evaluationDigest.schemaVersion).toBe('acceptance-evaluation-v1');
      expect(eval1.evaluationDigest.value).toMatch(/^[0-9a-f]{64}$/);

      // Determinism & ID derivation
      expect(eval1.evaluationFingerprint).toBe(eval1.evaluationDigest.value);
      expect(eval1.id).toBe(`acceptance-${eval1.evaluationDigest.value}`);
      expect(eval1.evaluationDigest.value).toBe(eval2.evaluationDigest.value);
      expect(eval1.id).toBe(eval2.id);
    });

    it('recomputes different SHA-256 digest when normalized criterion operator changes', () => {
      const baseContract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const evalBase = evaluateAcceptance({ contract: baseContract, testDefinition: testDef, results });

      const modifiedContract: PerformanceContract = {
        ...baseContract,
        acceptanceCriteria: baseContract.acceptanceCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, operator: '<=' as const } : c
        )
      };
      const modifiedTestDef: TestDefinition = {
        ...testDef,
        executableCriteria: testDef.executableCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, operator: '<=' as const } : c
        )
      };

      const evalModified = evaluateAcceptance({
        contract: modifiedContract,
        testDefinition: modifiedTestDef,
        results
      });

      expect(evalBase.evaluationDigest.value).not.toBe(evalModified.evaluationDigest.value);
    });

    it('recomputes different SHA-256 digest when criterion percentile changes', () => {
      const baseContract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const evalBase = evaluateAcceptance({ contract: baseContract, testDefinition: testDef, results });

      const modifiedContract: PerformanceContract = {
        ...baseContract,
        acceptanceCriteria: baseContract.acceptanceCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, percentile: 99 } : c
        )
      };
      const modifiedTestDef: TestDefinition = {
        ...testDef,
        executableCriteria: testDef.executableCriteria.map((c) =>
          c.id === 'ac-checkout-latency' ? { ...c, percentile: 99 } : c
        )
      };

      const evalModified = evaluateAcceptance({
        contract: modifiedContract,
        testDefinition: modifiedTestDef,
        results
      });

      expect(evalBase.evaluationDigest.value).not.toBe(evalModified.evaluationDigest.value);
    });

    it('recomputes different SHA-256 digest when criterion evidenceSourcePath changes', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const resultsA = createAttainedResults();

      const resultsB: CanonicalExecutionResult = {
        ...resultsA,
        metrics: {
          ...resultsA.metrics,
          httpReqDurationCheckout: {
            ...resultsA.metrics.httpReqDurationCheckout,
            p95: 120.5
          }
        }
      };

      const evalA = evaluateAcceptance({ contract, testDefinition: testDef, results: resultsA });
      const evalB = evaluateAcceptance({ contract, testDefinition: testDef, results: resultsB });

      expect(evalA.evaluationDigest.value).not.toBe(evalB.evaluationDigest.value);
    });

    it('recomputes different SHA-256 digest when gate failure reasons change', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const evalClean = evaluateAcceptance({ contract, testDefinition: testDef, results: baseResults });

      // Invalidate operational integrity gate
      const driftedResults: CanonicalExecutionResult = {
        ...baseResults,
        run: {
          ...baseResults.run,
          operationalStatus: 'EXECUTION_FAILED' as any
        }
      };

      const evalDrifted = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: driftedResults
      });

      expect(evalClean.evaluationDigest.value).not.toBe(evalDrifted.evaluationDigest.value);
      expect(evalDrifted.overallVerdict).toBe('INCONCLUSIVE');
      expect(evalDrifted.operationalIntegrityGate.isValid).toBe(false);
    });

    it('recomputes different SHA-256 digest when governed observation severity or text changes', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const obs1: GovernedObservation = {
        id: 'obs-001',
        source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
        severity: 'OBSERVATION',
        isBlocking: false,
        description: 'Observation variation A'
      };

      const obs2: GovernedObservation = {
        id: 'obs-001',
        source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
        severity: 'RISK',
        isBlocking: false,
        description: 'Observation variation A'
      };

      const obs3: GovernedObservation = {
        id: 'obs-001',
        source: 'REFERENCE_LAB_SYSTEM_TELEMETRY',
        severity: 'OBSERVATION',
        isBlocking: false,
        description: 'Observation variation B with different text'
      };

      const eval1 = evaluateAcceptance({ contract, testDefinition: testDef, results, governedObservations: [obs1] });
      const eval2 = evaluateAcceptance({ contract, testDefinition: testDef, results, governedObservations: [obs2] });
      const eval3 = evaluateAcceptance({ contract, testDefinition: testDef, results, governedObservations: [obs3] });

      expect(eval1.evaluationDigest.value).not.toBe(eval2.evaluationDigest.value);
      expect(eval1.evaluationDigest.value).not.toBe(eval3.evaluationDigest.value);
      expect(eval2.evaluationDigest.value).not.toBe(eval3.evaluationDigest.value);
    });

    it('produces INVALID workload and INCONCLUSIVE when Results governedDemand.targetValue is missing for claimed resultValue', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          governedDemand: undefined as any
        }
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(false);
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.rationale).toContain('governedDemand.targetValue');
    });

    it('produces INVALID workload and INCONCLUSIVE when Results governedDemand.unit is missing for claimed resultValue', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          governedDemand: {
            targetValue: 8.75,
            unit: ''
          }
        }
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.rationale).toContain('governedDemand.unit');
    });

    it('produces INVALID workload and INCONCLUSIVE when Results governedPopulation is missing for claimed resultValue', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          governedPopulation: undefined as any
        }
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.rationale).toContain('governedPopulation');
    });

    it('produces INVALID workload and INCONCLUSIVE when claimed resultValue has UNRESOLVED_INSUFFICIENT_TIME_SERIES derivation status', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          derivationStatus: 'UNRESOLVED_INSUFFICIENT_TIME_SERIES'
        }
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.rationale).toContain('incompatible derivation status');
    });

    it('produces INVALID workload and INCONCLUSIVE when claimed actualSourceMetric is fabricated or not in evidence', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        acceptanceBasisAttainment: {
          ...baseResults.acceptanceBasisAttainment,
          resultValue: 8.9,
          actualSourceMetric: 'fabricated_unsupported_metric_name'
        }
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      expect(evaluation.workloadPrerequisite.status).toBe('INVALID');
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.rationale).toContain('not grounded');
    });

    it('validates grounded actualSourceMetric against governed execution evidence', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');
      expect(evaluation.workloadPrerequisite.isPrerequisiteMet).toBe(true);
      expect(evaluation.overallVerdict).toBe('PASS');
    });

    it('represents unavailable corroboration without forcing agreement boolean (agreesWithEngine is undefined)', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      const results: CanonicalExecutionResult = {
        ...baseResults,
        thresholdObservations: baseResults.thresholdObservations.map((t) =>
          t.metric === 'http_req_duration{journey:checkout}'
            ? { ...t, status: 'UNAVAILABLE', engineResult: null }
            : t
        )
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      const latencyCrit = evaluation.criterionEvaluations.find((c) => c.criterionId === 'ac-checkout-latency');
      expect(latencyCrit?.status).toBe('PASS');
      expect(latencyCrit?.corroboratingEngineThreshold?.status).toBe('UNAVAILABLE');
      expect(latencyCrit?.corroboratingEngineThreshold?.agreesWithEngine).toBeUndefined();
      expect(latencyCrit?.corroboratingEngineThreshold?.enginePassed).toBeNull();
      expect(evaluation.overallVerdict).toBe('PASS');
    });

    it('detects threshold semantics drift when same metric has different threshold expression and returns INCONCLUSIVE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      // Change threshold expression from p(95)<2000 to p(95)<1500
      const results: CanonicalExecutionResult = {
        ...baseResults,
        thresholdObservations: baseResults.thresholdObservations.map((t) =>
          t.metric === 'http_req_duration{journey:checkout}'
            ? { ...t, expression: 'p(95)<1500' }
            : t
        )
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      const latencyCrit = evaluation.criterionEvaluations.find((c) => c.criterionId === 'ac-checkout-latency');
      // Independent evaluation passes (0.39 ms < 2000 ms)
      expect(latencyCrit?.status).toBe('PASS');
      // Corroborating threshold is undefined because exact expression did not match
      expect(latencyCrit?.corroboratingEngineThreshold).toBeUndefined();
      // Overall verdict is INCONCLUSIVE due to threshold semantics drift
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.verdictReasons.some((r) => r.includes('Threshold expression semantics drift'))).toBe(true);
    });

    it('evaluates criteria independently when engine metric is absent from threshold observations', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const baseResults = createAttainedResults();

      // Remove checkout threshold observation completely
      const results: CanonicalExecutionResult = {
        ...baseResults,
        thresholdObservations: baseResults.thresholdObservations.filter(
          (t) => t.metric !== 'http_req_duration{journey:checkout}'
        )
      };

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });

      const latencyCrit = evaluation.criterionEvaluations.find((c) => c.criterionId === 'ac-checkout-latency');
      expect(latencyCrit?.status).toBe('PASS');
      expect(latencyCrit?.corroboratingEngineThreshold).toBeUndefined();
      // No drift reason because metric was absent, not present with differing expression
      expect(evaluation.verdictReasons.some((r) => r.includes('Threshold expression semantics drift'))).toBe(false);
      expect(evaluation.overallVerdict).toBe('PASS');
    });

    it('handles evaluatedAt deterministically: caller timestamp vs completedAt vs absent, with clock-independent digest', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      // 1. Caller timestamp provided
      const evalCaller = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        evaluationTimestamp: '2026-09-21T18:00:00.000Z'
      });
      expect(evalCaller.evaluatedAt).toBe('2026-09-21T18:00:00.000Z');

      // 2. Default to results.run.timestamps.completedAt
      const evalDefault = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });
      expect(evalDefault.evaluatedAt).toBe(results.run.timestamps.completedAt);

      // 3. Neither provided
      const resultsNoTimestamp: CanonicalExecutionResult = {
        ...results,
        run: {
          ...results.run,
          timestamps: {
            ...results.run.timestamps,
            completedAt: undefined as any
          }
        }
      };
      const evalNoTimestamp = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results: resultsNoTimestamp
      });
      expect(evalNoTimestamp.evaluatedAt).toBeUndefined();

      // 4. Verification that evaluatedAt does NOT alter the SHA-256 evaluation digest
      expect(evalCaller.evaluationDigest.value).toBe(evalDefault.evaluationDigest.value);
      expect(evalCaller.evaluationFingerprint).toBe(evalDefault.evaluationFingerprint);
    });
  });
});
