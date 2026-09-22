import { describe, it, expect } from 'vitest';
import {
  evaluateAcceptance,
  compileTestDefinition,
  ingestGovernedExecutionEvidence,
  generateFindings
} from '@pecp/test-engine';
import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  GovernedObservation,
  AcceptanceEvaluation
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

describe('M4.0 — Canonical Findings & Defect Candidate Model', () => {
  // Authoritative helpers
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

  // -------------------------------------------------------------------------
  // 1. Authoritative RetailCo Run (§7)
  // -------------------------------------------------------------------------
  describe('1. Authoritative RetailCo Run Findings Generation (§7)', () => {
    it('generates exactly one WORKLOAD_ATTAINMENT_UNRESOLVED finding and zero defect candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.status).toBe('UNRESOLVED');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.findings).toHaveLength(1);
      expect(register.defectCandidates).toHaveLength(0);

      const finding = register.findings[0];
      expect(finding.findingType).toBe('WORKLOAD_ATTAINMENT_UNRESOLVED');
      expect(finding.classification).toBe('GOVERNANCE');
      expect(finding.status).toBe('OPEN');
      expect(finding.defectEligibility).toBe(false);
      expect(finding.workloadPrerequisiteStatus).toBe('UNRESOLVED');
      expect(finding.factualDescription).toContain('could not be proven from available time-sliced evidence');
      expect(finding.sourceExecutionRunId).toBe(results.run.executionRunId);
      expect(finding.sourceAcceptanceEvaluationId).toBe(evaluation.id);
      expect(finding.sourceAcceptanceEvaluationDigest).toBe(evaluation.evaluationDigest.value);
      expect(finding.findingDigest).toHaveLength(64);
      expect(finding.id).toMatch(/^finding-[a-f0-9]{16}$/);

      expect(register.registerDigest.algorithm).toBe('SHA-256');
      expect(register.registerDigest.schemaVersion).toBe('findings-register-v1');
      expect(register.registerDigest.value).toHaveLength(64);
    });
  });

  // -------------------------------------------------------------------------
  // 2. PASS Overall Verdict (§1)
  // -------------------------------------------------------------------------
  describe('2. PASS Overall Verdict (§1)', () => {
    it('produces empty findings collection and zero defect candidates when verdict is PASS', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('PASS');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('PASS');
      expect(register.findings).toHaveLength(0);
      expect(register.defectCandidates).toHaveLength(0);
      expect(register.registerDigest.value).toHaveLength(64);
    });
  });

  // -------------------------------------------------------------------------
  // 3. FAIL with One Failed Criterion (§1, §6, §11)
  // -------------------------------------------------------------------------
  describe('3. FAIL with One Failed Criterion (§1, §6, §11)', () => {
    it('generates one PERFORMANCE_CRITERION_FAILURE finding and one DefectCandidate under attained workload', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Degrade checkout latency to 2450 ms (exceeds p95 < 2000 ms)
      results.metrics.httpReqDurationCheckout = {
        ...results.metrics.httpReqDurationCheckout,
        p95: 2450
      };
      results.thresholdObservations = results.thresholdObservations.map((t) =>
        t.metric === 'http_req_duration{journey:checkout}'
          ? { ...t, status: 'OBSERVED_FAILED', engineResult: false }
          : t
      );

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('FAIL');
      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('FAIL');
      expect(register.findings).toHaveLength(1);
      expect(register.defectCandidates).toHaveLength(1);

      const finding = register.findings[0];
      expect(finding.findingType).toBe('PERFORMANCE_CRITERION_FAILURE');
      expect(finding.classification).toBe('PERFORMANCE');
      expect(finding.status).toBe('OPEN');
      expect(finding.sourceCriterionId).toBe('ac-checkout-latency');
      expect(finding.observedValue).toBe(2450);
      expect(finding.observedUnit).toBe('ms');
      expect(finding.canonicalThreshold).toBe(2000);
      expect(finding.canonicalOperator).toBe('<');
      expect(finding.canonicalUnit).toBe('ms');
      expect(finding.workloadPrerequisiteStatus).toBe('ATTAINED');
      expect(finding.defectEligibility).toBe(true);
      expect(finding.factualDescription).toContain('observed 2450 ms against governed requirement < 2000 ms');

      const candidate = register.defectCandidates[0];
      expect(candidate.sourceFindingId).toBe(finding.id);
      expect(candidate.title).toContain('checkout_response_time');
      expect(candidate.acceptanceCriterionReference.criterionId).toBe('ac-checkout-latency');
      expect(candidate.observedEvidenceSummary.observedValue).toBe(2450);
      expect(candidate.expectedGovernedCriterion.thresholdValue).toBe(2000);
      expect(candidate.publicationEligibility).toBe(true);
      expect(candidate.blockingReasonsToPublication).toHaveLength(0);
      expect(candidate.candidateDigest).toHaveLength(64);
      expect(candidate.id).toMatch(/^candidate-[a-f0-9]{16}$/);
    });
  });

  // -------------------------------------------------------------------------
  // 4. FAIL with Multiple Failed Criteria (§14)
  // -------------------------------------------------------------------------
  describe('4. FAIL with Multiple Failed Criteria (§14)', () => {
    it('generates one finding and one candidate per failed criterion, deterministically ordered', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Degrade checkout latency to 2450 ms (> 2000 ms)
      results.metrics.httpReqDurationCheckout = {
        ...results.metrics.httpReqDurationCheckout,
        p95: 2450
      };

      // Degrade http error rate to 2.5% (> 0.5% / 0.005)
      results.metrics.httpReqFailed = {
        ...results.metrics.httpReqFailed,
        rate: 0.025
      };

      results.thresholdObservations = results.thresholdObservations.map((t) => {
        if (t.metric === 'http_req_duration{journey:checkout}') {
          return { ...t, status: 'OBSERVED_FAILED', engineResult: false };
        }
        if (t.metric === 'http_req_failed') {
          return { ...t, status: 'OBSERVED_FAILED', engineResult: false };
        }
        return t;
      });

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('FAIL');
      expect(evaluation.workloadPrerequisite.status).toBe('ATTAINED');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('FAIL');
      expect(register.findings).toHaveLength(2);
      expect(register.defectCandidates).toHaveLength(2);

      // Verify deterministically ordered by criterion ID
      const criterionIds = register.findings.map((f) => f.sourceCriterionId);
      expect(criterionIds).toEqual(['ac-checkout-latency', 'ac-global-error-rate']);

      const candidateCritIds = register.defectCandidates.map(
        (c) => c.acceptanceCriterionReference.criterionId
      );
      expect(candidateCritIds).toEqual(['ac-checkout-latency', 'ac-global-error-rate']);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Workload NOT_ATTAINED + Failed Criterion Detail (§8, §14)
  // -------------------------------------------------------------------------
  describe('5. Workload NOT_ATTAINED + Failed Criterion Detail (§8, §14)', () => {
    it('produces WORKLOAD_NOT_ATTAINED finding and ZERO performance defects when under-driven', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Set under-driven workload attainment: 4.5 orders/sec < target 8.75
      results.acceptanceBasisAttainment = {
        ...results.acceptanceBasisAttainment,
        resultValue: 4.5
      };

      // Also degrade latency to fail
      results.metrics.rawMetrics['http_req_duration{scenario:retailco_checkout_journey}'] = {
        values: {
          min: 100,
          max: 3000,
          avg: 1200,
          med: 1100,
          'p(90)': 1900,
          'p(95)': 2450,
          'p(99)': 2900
        }
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      // Governed law: under-driven run CANNOT produce FAIL or SUT defects
      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.workloadPrerequisite.status).toBe('NOT_ATTAINED');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.findings).toHaveLength(1);
      expect(register.defectCandidates).toHaveLength(0);

      const finding = register.findings[0];
      expect(finding.findingType).toBe('WORKLOAD_NOT_ATTAINED');
      expect(finding.classification).toBe('EXECUTION_VALIDITY');
      expect(finding.defectEligibility).toBe(false);
      expect(finding.observedValue).toBe(4.5);
      expect(finding.canonicalThreshold).toBe(8.75);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Criterion NOT_EVALUABLE (§14)
  // -------------------------------------------------------------------------
  describe('6. Criterion NOT_EVALUABLE (§14)', () => {
    it('produces CRITERION_NOT_EVALUABLE finding and ZERO defect candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Remove the metric required by ac-checkout-latency
      delete (results.metrics as any).httpReqDurationCheckout;

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.defectCandidates).toHaveLength(0);

      const notEvalFinding = register.findings.find(
        (f) => f.findingType === 'CRITERION_NOT_EVALUABLE'
      );
      expect(notEvalFinding).toBeDefined();
      expect(notEvalFinding?.classification).toBe('EVIDENCE_QUALITY');
      expect(notEvalFinding?.defectEligibility).toBe(false);
      expect(notEvalFinding?.sourceCriterionId).toBe('ac-checkout-latency');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Acceptance Provenance Gate Conflict (§9, §14)
  // -------------------------------------------------------------------------
  describe('7. Acceptance Provenance Gate Conflict (§9, §14)', () => {
    it('generates PROVENANCE_CONFLICT finding and zero defect candidates', () => {
      const contract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        id: 'tampered-contract-id'
      };
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.provenanceGate.isValid).toBe(false);

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.defectCandidates).toHaveLength(0);

      const provFinding = register.findings.find(
        (f) => f.findingType === 'PROVENANCE_CONFLICT'
      );
      expect(provFinding).toBeDefined();
      expect(provFinding?.classification).toBe('GOVERNANCE');
      expect(provFinding?.defectEligibility).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Operational Integrity Gate Failure (§9, §14)
  // -------------------------------------------------------------------------
  describe('8. Operational Integrity Gate Failure (§9, §14)', () => {
    it('generates EXECUTION_INTEGRITY_ISSUE finding and zero defect candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Tamper results to have missing raw summary
      results.evidenceInventory.summaryJson!.presenceStatus = 'CORRUPT';

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(evaluation.operationalIntegrityGate.isValid).toBe(false);

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.defectCandidates).toHaveLength(0);

      const integFinding = register.findings.find(
        (f) => f.findingType === 'EXECUTION_INTEGRITY_ISSUE'
      );
      expect(integFinding).toBeDefined();
      expect(integFinding?.classification).toBe('EXECUTION_VALIDITY');
      expect(integFinding?.defectEligibility).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Threshold Corroboration Conflict (§14)
  // -------------------------------------------------------------------------
  describe('9. Threshold Corroboration Conflict (§14)', () => {
    it('generates THRESHOLD_CORROBORATION_CONFLICT finding and zero defect candidates on semantic drift', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Inject conflicting threshold expression for checkout latency (p(90) instead of p(95))
      results.thresholdObservations = results.thresholdObservations.map((t) =>
        t.metric === 'http_req_duration{journey:checkout}'
          ? { ...t, expression: 'p(90)<2000' }
          : t
      );

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.defectCandidates).toHaveLength(0);

      const driftFinding = register.findings.find(
        (f) => f.findingType === 'THRESHOLD_CORROBORATION_CONFLICT'
      );
      expect(driftFinding).toBeDefined();
      expect(driftFinding?.classification).toBe('EVIDENCE_QUALITY');
      expect(driftFinding?.defectEligibility).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 10. Blocking Governed Observation (§14)
  // -------------------------------------------------------------------------
  describe('10. Blocking Governed Observation (§14)', () => {
    it('generates BLOCKING_GOVERNED_OBSERVATION finding and zero defect candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const blockingObs: GovernedObservation = {
        id: 'obs-database-unreachable',
        source: 'INFRASTRUCTURE_PROBE',
        description: 'Payment gateway probe reported intermittent connection resets',
        severity: 'CRITICAL',
        isBlocking: true
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations: [blockingObs]
      });

      expect(evaluation.overallVerdict).toBe('INCONCLUSIVE');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('INCONCLUSIVE');
      expect(register.defectCandidates).toHaveLength(0);

      const obsFinding = register.findings.find(
        (f) => f.findingType === 'BLOCKING_GOVERNED_OBSERVATION'
      );
      expect(obsFinding).toBeDefined();
      expect(obsFinding?.governedObservationId).toBe('obs-database-unreachable');
      expect(obsFinding?.classification).toBe('EXECUTION_VALIDITY');
      expect(obsFinding?.defectEligibility).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 11. PASS_WITH_OBSERVATION (§10, §14)
  // -------------------------------------------------------------------------
  describe('11. PASS_WITH_OBSERVATION (§10, §14)', () => {
    it('generates NON_BLOCKING_OBSERVATION finding and zero defect candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      const nonBlockingObs: GovernedObservation = {
        id: 'obs-minor-clock-skew',
        source: 'AGENT_PROBE',
        description: 'Minor clock skew of 12ms observed between worker and target',
        severity: 'INFO',
        isBlocking: false
      };

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations: [nonBlockingObs]
      });

      expect(evaluation.overallVerdict).toBe('PASS_WITH_OBSERVATION');

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.overallVerdict).toBe('PASS_WITH_OBSERVATION');
      expect(register.findings).toHaveLength(1);
      expect(register.defectCandidates).toHaveLength(0);

      const finding = register.findings[0];
      expect(finding.findingType).toBe('NON_BLOCKING_OBSERVATION');
      expect(finding.classification).toBe('OBSERVATION');
      expect(finding.governedObservationId).toBe('obs-minor-clock-skew');
      expect(finding.defectEligibility).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 12. No Root Cause or Severity Invention (§12, §13, §14)
  // -------------------------------------------------------------------------
  describe('12. No Root Cause or Severity Invention (§12, §13, §14)', () => {
    it('never populates root cause or invented defect workflow attributes', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Degrade checkout latency
      results.metrics.httpReqDurationCheckout = {
        ...results.metrics.httpReqDurationCheckout,
        p95: 2450
      };
      results.thresholdObservations = results.thresholdObservations.map((t) =>
        t.metric === 'http_req_duration{journey:checkout}'
          ? { ...t, status: 'OBSERVED_FAILED', engineResult: false }
          : t
      );

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.findings).toHaveLength(1);
      expect(register.defectCandidates).toHaveLength(1);

      const finding = register.findings[0];
      expect((finding as any).rootCause).toBeUndefined();
      expect(finding.factualDescription).not.toContain('database');
      expect(finding.factualDescription).not.toContain('CPU');
      expect(finding.factualDescription).not.toContain('memory');

      const candidate = register.defectCandidates[0];
      expect((candidate as any).assignee).toBeUndefined();
      expect((candidate as any).sprint).toBeUndefined();
      expect((candidate as any).priority).toBeUndefined();
      expect((candidate as any).severity).toBeUndefined();
      expect((candidate as any).component).toBeUndefined();
      expect((candidate as any).team).toBeUndefined();
      expect((candidate as any).rootCause).toBeUndefined();
      expect((candidate as any).dueDate).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 13. Deterministic Ordering (§14)
  // -------------------------------------------------------------------------
  describe('13. Deterministic Ordering (§14)', () => {
    it('maintains strictly deterministic order across repeated runs', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Degrade both metrics
      results.metrics.httpReqDurationCheckout = {
        ...results.metrics.httpReqDurationCheckout,
        p95: 2450
      };
      results.metrics.httpReqFailed = {
        ...results.metrics.httpReqFailed,
        rate: 0.025
      };
      results.thresholdObservations = results.thresholdObservations.map((t) => {
        if (t.metric === 'http_req_duration{journey:checkout}') {
          return { ...t, status: 'OBSERVED_FAILED', engineResult: false };
        }
        if (t.metric === 'http_req_failed') {
          return { ...t, status: 'OBSERVED_FAILED', engineResult: false };
        }
        return t;
      });

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      const run1 = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const run2 = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(run1.findings.map((f) => f.id)).toEqual(run2.findings.map((f) => f.id));
      expect(run1.defectCandidates.map((c) => c.id)).toEqual(run2.defectCandidates.map((c) => c.id));
      expect(run1.registerDigest.value).toBe(run2.registerDigest.value);
    });
  });

  // -------------------------------------------------------------------------
  // 14. Identical Inputs -> Identical SHA-256 Digests (§14)
  // -------------------------------------------------------------------------
  describe('14. Identical Inputs -> Identical SHA-256 Digests (§14)', () => {
    it('computes identical register and finding digests for identical inputs', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const eval1 = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const eval2 = evaluateAcceptance({ contract, testDefinition: testDef, results });

      const reg1 = generateFindings({ acceptanceEvaluation: eval1, results });
      const reg2 = generateFindings({ acceptanceEvaluation: eval2, results });

      expect(reg1.registerDigest.value).toBe(reg2.registerDigest.value);
      expect(reg1.findings[0].findingDigest).toBe(reg2.findings[0].findingDigest);
      expect(reg1.id).toBe(reg2.id);
    });
  });

  // -------------------------------------------------------------------------
  // 15. Source Acceptance Digest Change -> Finding Digest Change (§14)
  // -------------------------------------------------------------------------
  describe('15. Source Acceptance Digest Change -> Finding Digest Change (§14)', () => {
    it('produces different finding digests when acceptance evaluation digest changes', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results1 = createAuthoritativeResults();

      const eval1 = evaluateAcceptance({ contract, testDefinition: testDef, results: results1 });
      const reg1 = generateFindings({ acceptanceEvaluation: eval1, results: results1 });

      // Modify the evaluation digest value manually
      const eval2: AcceptanceEvaluation = {
        ...eval1,
        evaluationDigest: {
          algorithm: 'SHA-256',
          schemaVersion: 'acceptance-evaluation-v1',
          value: '0000000000000000000000000000000000000000000000000000000000000000'
        }
      };

      const reg2 = generateFindings({ acceptanceEvaluation: eval2, results: results1 });

      expect(reg1.findings[0].findingDigest).not.toBe(reg2.findings[0].findingDigest);
      expect(reg1.registerDigest.value).not.toBe(reg2.registerDigest.value);
    });
  });

  // -------------------------------------------------------------------------
  // 16. Mismatch Between Acceptance and Results -> Provenance Conflict (§5, §14)
  // -------------------------------------------------------------------------
  describe('16. Mismatch Between Acceptance and Results (§5, §14)', () => {
    it('produces PROVENANCE_CONFLICT finding and zero defect candidates when run ids mismatch', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results
      });

      // Results with mismatched run id
      const mismatchedResults: CanonicalExecutionResult = {
        ...results,
        run: {
          ...results.run,
          executionRunId: 'different-run-id-999'
        }
      };

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results: mismatchedResults
      });

      expect(register.defectCandidates).toHaveLength(0);
      expect(register.findings).toHaveLength(1);
      expect(register.findings[0].findingType).toBe('PROVENANCE_CONFLICT');
      expect(register.findings[0].defectEligibility).toBe(false);
      expect(register.findings[0].factualDescription).toContain('Execution run ID mismatch');
    });
  });
});
