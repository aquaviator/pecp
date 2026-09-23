import { describe, it, expect } from 'vitest';
import {
  PerformanceContract,
  TestDefinition,
  TestDefinitionStatus,
  CanonicalExecutionResult,
  EngineeringArtefact,
  PerformanceEvidencePackage
} from '@pecp/pe-domain';
import {
  compileTestDefinition,
  ingestGovernedExecutionEvidence,
  evaluateAcceptance,
  computeAcceptanceEvaluationDigest,
  buildAcceptanceEvaluationDigestPayload,
  generateFindings,
  generatePerformanceEvidencePackage,
  verifyPerformanceEvidencePackageDigest,
  computeEvidencePackageDigest,
  buildFindingsRegisterDigestPayload,
  computeFindingsRegisterDigest,
  REQUIRED_CORE_LINEAGE_EDGES
} from '@pecp/test-engine';
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

describe('M4.1 — Canonical Performance Evidence Package & Audit Manifest', () => {
  // Authoritative fixture helpers
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

  const createPassingContract = (): PerformanceContract => {
    return {
      ...RETAILCO_M3_APPROVED_CONTRACT,
      acceptanceCriteria: [
        {
          id: 'ac-browse-p95',
          key: 'browse_p95_latency',
          metric: 'http_req_duration',
          target: '< 1500ms',
          operator: '<',
          thresholdValue: 1500,
          unit: 'ms',
          percentile: 95,
          scope: 'Browse Journey',
          status: 'DEFINED',
          isBlockingForApproval: true
        }
      ]
    };
  };

  const createPassingTestDef = (contract: PerformanceContract): TestDefinition => {
    return compileTestDefinition({
      contract,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      testDefinitionId: 'test-def-proj-retailco-passing-v1.0',
      version: 'v1.0',
      executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
    });
  };

  const createPassingResults = (testDef: TestDefinition): CanonicalExecutionResult => {
    const attained = createAttainedResults();
    return {
      ...attained,
      run: {
        ...attained.run,
        testDefinition: {
          id: testDef.id,
          version: testDef.version,
          fingerprint: testDef.fingerprint
        }
      },
      metrics: {
        ...attained.metrics,
        httpReqDuration: {
          p95: 450,
          p90: 380,
          avg: 250,
          min: 80,
          max: 950
        }
      }
    };
  };

  const createFailingContract = (): PerformanceContract => {
    return {
      ...RETAILCO_M3_APPROVED_CONTRACT,
      acceptanceCriteria: [
        {
          id: 'ac-checkout-p95',
          key: 'checkout_p95_latency',
          metric: 'http_req_duration',
          target: '< 200ms',
          operator: '<',
          thresholdValue: 200,
          unit: 'ms',
          percentile: 95,
          scope: 'Checkout Journey',
          status: 'DEFINED',
          isBlockingForApproval: true
        }
      ]
    };
  };

  const createFailingTestDef = (contract: PerformanceContract): TestDefinition => {
    return compileTestDefinition({
      contract,
      projectSummary: RETAILCO_PROJECT_FIXTURE,
      testDefinitionId: 'test-def-proj-retailco-failing-v1.0',
      version: 'v1.0',
      executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
    });
  };

  const createFailingResults = (testDef: TestDefinition): CanonicalExecutionResult => {
    const attained = createAttainedResults();
    return {
      ...attained,
      run: {
        ...attained.run,
        testDefinition: {
          id: testDef.id,
          version: testDef.version,
          fingerprint: testDef.fingerprint
        }
      },
      metrics: {
        ...attained.metrics,
        httpReqDuration: {
          p95: 850, // exceeds 200ms threshold
          p90: 720,
          avg: 450,
          min: 150,
          max: 1800
        }
      }
    };
  };

  // -------------------------------------------------------------------------
  // 1. Authoritative RetailCo Run Evidence Package Generation (§7, §10)
  // -------------------------------------------------------------------------
  describe('1. Authoritative RetailCo Run Evidence Package Generation', () => {
    it('generates a VALID package carrying Acceptance verdict INCONCLUSIVE, one workload finding, and zero defect candidates', () => {
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

      expect(register.generationStatus).toBe('VALID');
      expect(register.findings.length).toBe(1);
      expect(register.findings[0].findingType).toBe('WORKLOAD_ATTAINMENT_UNRESOLVED');
      expect(register.defectCandidates.length).toBe(0);

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      // Strict separation: Package is VALID, while Acceptance verdict is INCONCLUSIVE
      expect(pkg.packageGenerationStatus).toBe('VALID');
      expect(pkg.generationIssues).toEqual([]);
      expect(pkg.acceptanceEvaluation.overallVerdict).toBe('INCONCLUSIVE');
      expect(pkg.findingsRegister.totalFindings).toBe(1);
      expect(pkg.findingsRegister.totalDefectCandidates).toBe(0);

      // Package Identity & Digest
      expect(pkg.id).toMatch(/^pep-[a-f0-9]{16}$/);
      expect(pkg.packageDigest.algorithm).toBe('SHA-256');
      expect(pkg.packageDigest.schemaVersion).toBe('performance-evidence-package-v1');
      expect(pkg.packageDigest.value).toHaveLength(64);

      // Cryptographic verification of package
      const verification = verifyPerformanceEvidencePackageDigest(pkg);
      expect(verification.isValid).toBe(true);
      expect(verification.recomputedDigest).toBe(pkg.packageDigest.value);

      // Raw Evidence inventory verification
      expect(pkg.rawEvidenceInventory.length).toBeGreaterThanOrEqual(9);
      const manifestRef = pkg.rawEvidenceInventory.find((f) => f.filename === 'execution-manifest.json');
      expect(manifestRef).toBeDefined();
      expect(manifestRef?.presenceStatus).toBe('PRESENT');

      // Lineage verification
      expect(pkg.lineage.edges.length).toBeGreaterThanOrEqual(6);
      const contractToDef = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'PERFORMANCE_CONTRACT' && e.toComponent === 'TEST_DEFINITION'
      );
      expect(contractToDef?.verified).toBe(true);

      const defToRun = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'TEST_DEFINITION' && e.toComponent === 'EXECUTION_RUN'
      );
      expect(defToRun?.verified).toBe(true);

      const resultsToEval = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'CANONICAL_RESULTS' && e.toComponent === 'ACCEPTANCE_EVALUATION'
      );
      expect(resultsToEval?.verified).toBe(true);

      const evalToFindings = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'ACCEPTANCE_EVALUATION' && e.toComponent === 'FINDINGS_REGISTER'
      );
      expect(evalToFindings?.verified).toBe(true);

      // M4.1.1 Workload Demand separation & stage duration fidelity
      expect(pkg.evidenceSummary.workloadDemand.businessDemand).toBeDefined();
      expect(pkg.evidenceSummary.workloadDemand.businessDemand?.targetValue).toBe(8.75);
      expect(pkg.evidenceSummary.workloadDemand.businessDemand?.unit).toBe('orders/second');

      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand).toBeDefined();
      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand?.peakArrivalRate).toBe(109.375);
      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand?.unit).toBe('journey_iterations/second');
      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand?.population).toBe('JOURNEY_ITERATION');
      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand?.executionModel).toBe('OPEN');

      expect(pkg.evidenceSummary.workloadDemand.rampUpSeconds).toBe(300);
      expect(pkg.evidenceSummary.workloadDemand.steadyStateSeconds).toBe(900);
      expect(pkg.evidenceSummary.workloadDemand.rampDownSeconds).toBe(120);
      expect(pkg.evidenceSummary.workloadDemand.totalDurationSeconds).toBe(1320);

      // M4.1.1 Component identity check: CANONICAL_RESULTS must not carry artifact/bundle fingerprint
      const resultsComp = pkg.components.find((c) => c.componentType === 'CANONICAL_RESULTS');
      expect(resultsComp?.fingerprint).toBeUndefined();
      expect(resultsComp?.digest).toBeUndefined();

      // EXECUTION_RUN component carries execution bundle & artifact identity
      const runComp = pkg.components.find((c) => c.componentType === 'EXECUTION_RUN');
      expect(runComp?.executionBundleFingerprint).toBe(results.run.bundleFingerprint);
      expect(runComp?.executionArtifactDigest).toBe(results.run.executionArtifact?.digest);

      // Acceptance criterion outcomes fidelity
      const checkoutOutcome = pkg.evidenceSummary.criterionOutcomes.find((c) => c.key === 'checkout_response_time');
      expect(checkoutOutcome?.target).toBe('p95 < 2000ms');
      expect(checkoutOutcome?.status).toBe('PASS');
      expect(checkoutOutcome?.observedValue).toBeCloseTo(0.3906885, 4);

      const errorRateOutcome = pkg.evidenceSummary.criterionOutcomes.find((c) => c.key === 'global_error_rate');
      expect(errorRateOutcome?.target).toBe('< 0.5%');
      expect(errorRateOutcome?.status).toBe('PASS');
      expect(errorRateOutcome?.observedValue).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. PASS and FAIL Scenarios
  // -------------------------------------------------------------------------
  describe('2. Evidence Package across Evaluation Verdicts', () => {
    it('generates a VALID package when Acceptance verdict is PASS', () => {
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

      expect(register.generationStatus).toBe('VALID');
      expect(register.defectCandidates.length).toBe(0);

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('VALID');
      expect(pkg.acceptanceEvaluation.overallVerdict).toBe('PASS');
      expect(pkg.evidenceSummary.acceptanceVerdict?.verdict).toBe('PASS');
      expect(verifyPerformanceEvidencePackageDigest(pkg).isValid).toBe(true);
    });

    it('generates a VALID package when Acceptance verdict is FAIL with Defect Candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Induce performance criterion failure on Checkout latency
      results.metrics.httpReqDurationCheckout = {
        p95: 2450,
        p90: 2100,
        avg: 1800,
        min: 200,
        max: 3500
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

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      expect(register.generationStatus).toBe('VALID');
      expect(register.defectCandidates.length).toBe(1);

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('VALID');
      expect(pkg.acceptanceEvaluation.overallVerdict).toBe('FAIL');
      expect(pkg.findingsRegister.totalDefectCandidates).toBe(1);
      expect(pkg.evidenceSummary.findingsSummary?.totalDefectCandidates).toBe(1);
      expect(verifyPerformanceEvidencePackageDigest(pkg).isValid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Upstream Cryptographic Integrity Gating (§4)
  // -------------------------------------------------------------------------
  describe('3. Upstream Cryptographic Integrity Gating', () => {
    it('rejects tampered Acceptance Evaluation digest with INVALID_ACCEPTANCE_INTEGRITY', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      // Tamper with Acceptance Evaluation digest
      const tamperedEvaluation = {
        ...evaluation,
        evaluationDigest: {
          ...evaluation.evaluationDigest,
          value: '0000000000000000000000000000000000000000000000000000000000000000'
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: tamperedEvaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_ACCEPTANCE_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.includes('Acceptance evaluation digest mismatch'))).toBe(true);
    });

    it('rejects tampered Findings Register digest with INVALID_FINDINGS_INTEGRITY', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      // Tamper with Findings Register digest
      const tamperedRegister = {
        ...register,
        registerDigest: {
          ...register.registerDigest,
          value: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: tamperedRegister
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.includes('Findings register digest mismatch'))).toBe(true);
    });

    it('rejects tampered individual CanonicalFinding inside Findings Register with INVALID_FINDINGS_INTEGRITY', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      // Tamper with individual finding title without recomputing finding digest
      const tamperedFinding = {
        ...register.findings[0],
        title: 'Tampered Finding Title'
      };

      const tamperedRegister = {
        ...register,
        findings: [tamperedFinding]
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: tamperedRegister
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.includes('digest mismatch'))).toBe(true);
    });

    it('detects tampered package payload via verifyPerformanceEvidencePackageDigest', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(verifyPerformanceEvidencePackageDigest(pkg).isValid).toBe(true);

      // Create a shallow tampered copy
      const tamperedPkg: PerformanceEvidencePackage = {
        ...pkg,
        packageDigest: {
          ...pkg.packageDigest,
          value: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        }
      };

      const verification = verifyPerformanceEvidencePackageDigest(tamperedPkg);
      expect(verification.isValid).toBe(false);
      expect(verification.error).toContain('digest mismatch');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Source Provenance Gating (§5)
  // -------------------------------------------------------------------------
  describe('4. Source Provenance Gating', () => {
    it('rejects unapproved Contract with INVALID_PROVENANCE', () => {
      const contract: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        status: 'DRAFT'
      };
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        testDefinition: testDef,
        results
      });

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.generationIssues.some((i) => i.includes("must be 'APPROVED'"))).toBe(true);
    });

    it('rejects Contract fingerprint mismatch with INVALID_PROVENANCE', () => {
      // Contract with modified criteria causing fingerprint drift
      const modifiedContract: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        acceptanceCriteria: [
          ...RETAILCO_M3_APPROVED_CONTRACT.acceptanceCriteria,
          {
            id: 'ac-extra',
            key: 'extra_metric',
            metric: 'http_req_duration',
            target: '< 500ms',
            operator: '<',
            thresholdValue: 500,
            unit: 'ms',
            scope: 'Extra',
            status: 'DEFINED',
            isBlockingForApproval: true
          }
        ]
      };

      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        testDefinition: testDef,
        results
      });

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract: RETAILCO_M3_APPROVED_CONTRACT,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract: modifiedContract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.generationIssues.some((i) => i.includes('Contract fingerprint'))).toBe(true);
    });

    it('rejects Test Definition fingerprint mismatch with INVALID_PROVENANCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      // Tampered test definition with modified version or fingerprint
      const modifiedTestDef: TestDefinition = {
        ...testDef,
        fingerprint: 'fp-00000000-tampered'
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: modifiedTestDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.generationIssues.some((i) => i.includes('Test Definition fingerprint'))).toBe(true);
    });

    it('rejects Execution Run ID mismatch between Results and Acceptance with INVALID_PROVENANCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      // Mismatch run ID in results
      const modifiedResults: CanonicalExecutionResult = {
        ...results,
        run: {
          ...results.run,
          executionRunId: 'run-other-9999'
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results: modifiedResults,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.generationIssues.some((i) => i.includes('Execution Run ID'))).toBe(true);
    });

    it('rejects Findings source Acceptance ID mismatch with INVALID_FINDINGS_INTEGRITY', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const mismatchedRegister = {
        ...register,
        sourceAcceptanceEvaluationId: 'other-acceptance-id'
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: mismatchedRegister
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Raw Evidence Inventory Completeness (§7)
  // -------------------------------------------------------------------------
  describe('5. Raw Evidence Inventory Completeness', () => {
    it('rejects missing or empty raw evidence references with INCOMPLETE_REQUIRED_EVIDENCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const emptyEvidenceResults: CanonicalExecutionResult = {
        ...results,
        evidenceInventory: {
          allReferences: []
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results: emptyEvidenceResults,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INCOMPLETE_REQUIRED_EVIDENCE');
      expect(pkg.generationIssues.some((i) => i.includes('Raw evidence inventory is missing'))).toBe(true);
    });

    it('rejects raw evidence references with missing files with INCOMPLETE_REQUIRED_EVIDENCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const incompleteEvidenceResults: CanonicalExecutionResult = {
        ...results,
        evidenceInventory: {
          ...results.evidenceInventory,
          allReferences: results.evidenceInventory.allReferences.map((ref, idx) =>
            idx === 0 ? { ...ref, presenceStatus: 'ABSENT' } : ref
          )
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results: incompleteEvidenceResults,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INCOMPLETE_REQUIRED_EVIDENCE');
      expect(pkg.generationIssues.some((i) => i.includes('missing or unverified files'))).toBe(true);
    });

    it('rejects credential leakage with INVALID_PROVENANCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const leakedResults: CanonicalExecutionResult = {
        ...results,
        dataQuality: {
          ...results.dataQuality,
          issues: [
            ...results.dataQuality.issues,
            {
              code: 'CREDENTIAL_LEAKAGE_DETECTED',
              severity: 'FATAL',
              message: 'Credential leak detected in test log'
            }
          ]
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results: leakedResults,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.generationIssues.some((i) => i.includes('Credential leakage detected'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Strategy & Test Plan Optional Artefacts (§6)
  // -------------------------------------------------------------------------
  describe('6. Strategy and Test Plan Artefacts Validation', () => {
    it('marks Strategy and Test Plan ABSENT when not provided, package remains VALID', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('VALID');

      const strategyComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
      expect(strategyComp?.presenceStatus).toBe('ABSENT');
      expect(strategyComp?.isRequired).toBe(false);

      const testPlanComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_TEST_PLAN');
      expect(testPlanComp?.presenceStatus).toBe('ABSENT');
      expect(testPlanComp?.isRequired).toBe(false);
    });

    it('marks Strategy and Test Plan PRESENT and links in lineage when valid', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const validStrategy: EngineeringArtefact = {
        id: 'strategy-retailco-bf2026-v1.0',
        projectId: contract.projectId,
        projectName: contract.projectName,
        type: 'PERFORMANCE_STRATEGY',
        title: 'RetailCo Black Friday 2026 Performance Strategy',
        version: 'v1.0',
        status: 'APPROVED',
        engineeringIntent: contract.engineeringIntent,
        sourceContractId: contract.id,
        sourceContractVersion: contract.version,
        sourceContractFingerprint: evaluation.sourceContract.fingerprint,
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-21T10:00:00.000Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: true,
          status: 'APPROVED',
          blockingReasons: [],
          unresolvedIssuesCount: 0
        }
      };

      const validTestPlan: EngineeringArtefact = {
        id: 'testplan-retailco-bf2026-v1.0',
        projectId: contract.projectId,
        projectName: contract.projectName,
        type: 'PERFORMANCE_TEST_PLAN',
        title: 'RetailCo Black Friday 2026 Performance Test Plan',
        version: 'v1.0',
        status: 'APPROVED',
        engineeringIntent: contract.engineeringIntent,
        sourceContractId: contract.id,
        sourceContractVersion: contract.version,
        sourceContractFingerprint: evaluation.sourceContract.fingerprint,
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-21T11:00:00.000Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: true,
          status: 'APPROVED',
          blockingReasons: [],
          unresolvedIssuesCount: 0
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        strategy: validStrategy,
        testPlan: validTestPlan
      });

      expect(pkg.packageGenerationStatus).toBe('VALID');

      const strategyComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
      expect(strategyComp?.presenceStatus).toBe('PRESENT');
      expect(strategyComp?.canonicalId).toBe(validStrategy.id);

      const testPlanComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_TEST_PLAN');
      expect(testPlanComp?.presenceStatus).toBe('PRESENT');
      expect(testPlanComp?.canonicalId).toBe(validTestPlan.id);

      const strategyEdge = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'PERFORMANCE_CONTRACT' && e.toComponent === 'PERFORMANCE_STRATEGY'
      );
      expect(strategyEdge?.verified).toBe(true);

      const testPlanEdge = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'PERFORMANCE_CONTRACT' && e.toComponent === 'PERFORMANCE_TEST_PLAN'
      );
      expect(testPlanEdge?.verified).toBe(true);
    });

    it('marks Strategy STALE when its source contract fingerprint does not match approved contract', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const staleStrategy: EngineeringArtefact = {
        id: 'strategy-retailco-bf2026-v0.9',
        projectId: contract.projectId,
        projectName: contract.projectName,
        type: 'PERFORMANCE_STRATEGY',
        title: 'RetailCo Black Friday 2026 Performance Strategy (Stale)',
        version: 'v0.9',
        status: 'APPROVED',
        engineeringIntent: contract.engineeringIntent,
        sourceContractId: contract.id,
        sourceContractVersion: 'v0.9',
        sourceContractFingerprint: 'fp-stale-contract-hash',
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-20T10:00:00.000Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: true,
          status: 'APPROVED',
          blockingReasons: [],
          unresolvedIssuesCount: 0
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        strategy: staleStrategy
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      const strategyComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
      expect(strategyComp?.presenceStatus).toBe('STALE');
      expect(pkg.generationIssues.some((i) => i.includes('Performance Strategy'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Determinism, Immutability & Caller Purity (§11, §12, §13)
  // -------------------------------------------------------------------------
  describe('7. Determinism, Immutability & Caller Purity', () => {
    it('produces byte-for-byte identical package digest and id for identical inputs', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg1 = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        generationTimestamp: '2026-09-22T00:00:00.000Z'
      });

      const pkg2 = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        generationTimestamp: '2026-09-22T01:00:00.000Z' // different timestamp
      });

      // Generation timestamp is excluded from digest payload
      expect(pkg1.packageDigest.value).toBe(pkg2.packageDigest.value);
      expect(pkg1.id).toBe(pkg2.id);
    });

    it('deep freezes the generated package to prevent accidental mutation', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(Object.isFrozen(pkg)).toBe(true);
      expect(Object.isFrozen(pkg.components)).toBe(true);
      expect(Object.isFrozen(pkg.rawEvidenceInventory)).toBe(true);
      expect(Object.isFrozen(pkg.evidenceSummary)).toBe(true);
      expect(Object.isFrozen(pkg.lineage)).toBe(true);
      expect(Object.isFrozen(pkg.packageDigest)).toBe(true);

      expect(() => {
        (pkg as any).id = 'mutated-id';
      }).toThrow();
    });

    it('does NOT freeze or mutate caller-owned inputs (caller purity)', () => {
      const contract = JSON.parse(JSON.stringify(RETAILCO_M3_APPROVED_CONTRACT));
      const testDef = JSON.parse(JSON.stringify(createAuthoritativeTestDef()));
      const results = JSON.parse(JSON.stringify(createAuthoritativeResults()));

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

      // evaluation and register outputs are frozen by their respective engines;
      // create mutable clones to verify generatePerformanceEvidencePackage doesn't freeze them
      const mutableEval = JSON.parse(JSON.stringify(evaluation));
      const mutableRegister = JSON.parse(JSON.stringify(register));

      expect(Object.isFrozen(contract)).toBe(false);
      expect(Object.isFrozen(testDef)).toBe(false);
      expect(Object.isFrozen(results)).toBe(false);
      expect(Object.isFrozen(mutableEval)).toBe(false);
      expect(Object.isFrozen(mutableRegister)).toBe(false);

      generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: mutableEval,
        findingsRegister: mutableRegister
      });

      // Caller objects must still be unfrozen
      expect(Object.isFrozen(contract)).toBe(false);
      expect(Object.isFrozen(testDef)).toBe(false);
      expect(Object.isFrozen(results)).toBe(false);
      expect(Object.isFrozen(mutableEval)).toBe(false);
      expect(Object.isFrozen(mutableRegister)).toBe(false);
    });

    it('contains ZERO unrequested inventions (no root cause, no release certification, no Jira/ADO publication)', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      const pkgKeys = Object.keys(pkg);
      expect(pkgKeys).not.toContain('rootCause');
      expect(pkgKeys).not.toContain('rootCauseAnalysis');
      expect(pkgKeys).not.toContain('releaseCertification');
      expect(pkgKeys).not.toContain('releaseDecision');
      expect(pkgKeys).not.toContain('jiraIssueKey');
      expect(pkgKeys).not.toContain('adoWorkItemId');
      expect(pkgKeys).not.toContain('confluencePageUrl');
    });
  });

  // -------------------------------------------------------------------------
  // 8. M4.1.1 Semantic Integrity & Zero-Invention Gate Regression Matrix
  // -------------------------------------------------------------------------
  describe('8. M4.1.1 Semantic Integrity & Zero-Invention Gate Regression Matrix', () => {
    it('1 & 2 & 3. Separates business workload demand (8.75 orders/sec) from scheduler demand (109.375 journey_iterations/sec) with no substitution', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      const wd = pkg.evidenceSummary.workloadDemand;

      // Business demand check
      expect(wd.businessDemand).toBeDefined();
      expect(wd.businessDemand?.targetValue).toBe(8.75);
      expect(wd.businessDemand?.unit).toBe('orders/second');
      expect(wd.businessDemand?.metric).toBe('orders');

      // Scheduler demand check
      expect(wd.schedulerDemand).toBeDefined();
      expect(wd.schedulerDemand?.peakArrivalRate).toBe(109.375);
      expect(wd.schedulerDemand?.unit).toBe('journey_iterations/second');
      expect(wd.schedulerDemand?.population).toBe('JOURNEY_ITERATION');
      expect(wd.schedulerDemand?.executionModel).toBe('OPEN');

      // Zero-invention / no substitution check: business demand must NOT use scheduler values
      expect(wd.businessDemand?.targetValue).not.toBe(109.375);
      expect(wd.businessDemand?.unit).not.toBe('journey_iterations/second');
      expect(wd.schedulerDemand?.peakArrivalRate).not.toBe(8.75);
      expect(wd.schedulerDemand?.unit).not.toBe('orders/second');
    });

    it('4. Preserves exact RetailCo schedule timings: ramp-up 300 / steady-state 900 / ramp-down 120 / total 1320', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      const wd = pkg.evidenceSummary.workloadDemand;
      expect(wd.rampUpSeconds).toBe(300);
      expect(wd.steadyStateSeconds).toBe(900);
      expect(wd.rampDownSeconds).toBe(120);
      expect(wd.totalDurationSeconds).toBe(1320);

      // Verify steady-state duration is NOT conflated with total duration
      expect(wd.steadyStateSeconds).not.toBe(wd.totalDurationSeconds);
    });

    it('5. Results with hasIntegrityErrors = true causes INVALID_RESULTS_INTEGRITY', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const integrityFailingResults: CanonicalExecutionResult = {
        ...results,
        dataQuality: {
          ...results.dataQuality,
          hasIntegrityErrors: true,
          issues: [
            {
              code: 'CHECKSUM_MISMATCH',
              severity: 'FATAL',
              message: 'Raw log checksum verification failed'
            }
          ]
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results: integrityFailingResults,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_RESULTS_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.includes('integrity errors'))).toBe(true);
      expect(pkg.evidenceSummary.dataQualityAndIntegrity.rawEvidenceComplete).toBe(false);
    });

    it('6. Unifies raw evidence lineage verification: edges are NOT verified when raw evidence is incomplete', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const incompleteResults: CanonicalExecutionResult = {
        ...results,
        dataQuality: {
          ...results.dataQuality,
          isComplete: false,
          issues: [
            {
              code: 'MISSING_REQUIRED_ARTIFACT',
              severity: 'FATAL',
              message: 'Missing k6 raw metrics log'
            }
          ]
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results: incompleteResults,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INCOMPLETE_REQUIRED_EVIDENCE');

      // Shared governed validity: Lineage edges depending on raw evidence MUST NOT be marked verified
      const runToRawEdge = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'EXECUTION_RUN' && e.toComponent === 'RAW_EVIDENCE_INVENTORY'
      );
      expect(runToRawEdge?.verified).toBe(false);

      const rawToResultsEdge = pkg.lineage.edges.find(
        (e) => e.fromComponent === 'RAW_EVIDENCE_INVENTORY' && e.toComponent === 'CANONICAL_RESULTS'
      );
      expect(rawToResultsEdge?.verified).toBe(false);
    });

    it('7. CANONICAL_RESULTS component does not carry execution artifact/bundle digest as its own fingerprint', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      const resultsComp = pkg.components.find((c) => c.componentType === 'CANONICAL_RESULTS');
      expect(resultsComp).toBeDefined();
      expect(resultsComp?.fingerprint).toBeUndefined();
      expect(resultsComp?.digest).toBeUndefined();

      // Ensure execution artifact digest & bundle fingerprint are strictly bound to EXECUTION_RUN
      const runComp = pkg.components.find((c) => c.componentType === 'EXECUTION_RUN');
      expect(runComp?.executionBundleFingerprint).toBe(results.run.bundleFingerprint);
      expect(runComp?.executionArtifactDigest).toBe(results.run.executionArtifact?.digest);
    });

    it('8. Missing engineering intent does not become CERTIFICATION fallback', () => {
      const contractWithoutIntent: PerformanceContract = {
        ...RETAILCO_M3_APPROVED_CONTRACT,
        engineeringIntent: undefined as any
      };
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({
        contract: contractWithoutIntent,
        testDefinition: testDef,
        results
      });

      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract: contractWithoutIntent,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract: contractWithoutIntent,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.engineeringIntent).toBeUndefined();
      expect(pkg.engineeringIntent).not.toBe('CERTIFICATION');
    });

    it('9. Missing Findings generation status causes INVALID_FINDINGS_INTEGRITY rather than defaulting to VALID', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const registerWithoutStatus = {
        ...register,
        generationStatus: undefined as any
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: registerWithoutStatus
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.includes('generationStatus'))).toBe(true);
    });

    it('10. Missing Acceptance verdict or id causes INVALID_ACCEPTANCE_INTEGRITY rather than fabricating values', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const evaluationWithoutVerdict = {
        ...evaluation,
        overallVerdict: undefined as any
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluationWithoutVerdict,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_ACCEPTANCE_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.includes('overallVerdict'))).toBe(true);
    });

    it('11. PASS_WITH_OBSERVATION package remains VALID and preserves observation finding', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Add a non-fatal observation to acceptance evaluation
      const observationEvaluation = evaluateAcceptance({
        contract,
        testDefinition: testDef,
        results,
        governedObservations: [
          {
            id: 'obs-latency-trend',
            source: 'SYSTEM',
            severity: 'INFO',
            description: 'Slight latency increase in last 2 minutes',
            isBlocking: false
          }
        ]
      });

      const register = generateFindings({
        acceptanceEvaluation: observationEvaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: observationEvaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('VALID');
      expect(pkg.acceptanceEvaluation.overallVerdict).toBe('PASS_WITH_OBSERVATION');
      expect(pkg.evidenceSummary.acceptanceVerdict?.verdict).toBe('PASS_WITH_OBSERVATION');
      expect(verifyPerformanceEvidencePackageDigest(pkg).isValid).toBe(true);
    });

    it('12. Tampered Defect Candidate digest causes INVALID_FINDINGS_INTEGRITY', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();

      // Induce performance criterion failure to create a defect candidate
      results.metrics.httpReqDurationCheckout = {
        p95: 3500,
        p90: 3100,
        avg: 2800,
        min: 200,
        max: 4500
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

      expect(register.defectCandidates.length).toBeGreaterThan(0);

      // Tamper with Defect Candidate digest
      const tamperedDefectCandidate = {
        ...register.defectCandidates[0],
        candidateDigest: '0000000000000000000000000000000000000000000000000000000000000000'
      };

      const tamperedRegister = {
        ...register,
        defectCandidates: [tamperedDefectCandidate]
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: tamperedRegister
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
      expect(pkg.generationIssues.some((i) => i.toLowerCase().includes('digest mismatch'))).toBe(true);
    });

    it('13. Caller-supplied generation timestamp does NOT change package digest or id', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkgA = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        generationTimestamp: '2026-09-22T08:00:00.000Z'
      });

      const pkgB = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        generationTimestamp: '2026-09-22T16:30:00.000Z'
      });

      // Metadata timestamp differs
      expect(pkgA.generatedAt).toBe('2026-09-22T08:00:00.000Z');
      expect(pkgB.generatedAt).toBe('2026-09-22T16:30:00.000Z');

      // Cryptographic digest and ID MUST be byte-for-byte identical
      expect(pkgA.packageDigest.value).toBe(pkgB.packageDigest.value);
      expect(pkgA.id).toBe(pkgB.id);
    });

    it('14. Strategy status STALE causes component STALE presence and INVALID_PROVENANCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const staleStatusStrategy: EngineeringArtefact = {
        id: 'strategy-retailco-bf2026-stale',
        projectId: contract.projectId,
        projectName: contract.projectName,
        type: 'PERFORMANCE_STRATEGY',
        title: 'RetailCo Performance Strategy',
        version: 'v1.0',
        status: 'STALE',
        engineeringIntent: contract.engineeringIntent,
        sourceContractId: contract.id,
        sourceContractVersion: contract.version,
        sourceContractFingerprint: evaluation.sourceContract.fingerprint,
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-21T10:00:00.000Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: false,
          status: 'STALE',
          blockingReasons: ['Stale strategy'],
          unresolvedIssuesCount: 1
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        strategy: staleStatusStrategy
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      const stratComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
      expect(stratComp?.presenceStatus).toBe('STALE');
      expect(pkg.generationIssues.some((i) => i.includes("'STALE' status"))).toBe(true);
    });

    it('15. Strategy status SUPERSEDED causes component SUPERSEDED presence and INVALID_PROVENANCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const supersededStrategy: EngineeringArtefact = {
        id: 'strategy-retailco-bf2026-v0.5',
        projectId: contract.projectId,
        projectName: contract.projectName,
        type: 'PERFORMANCE_STRATEGY',
        title: 'RetailCo Performance Strategy v0.5',
        version: 'v0.5',
        status: 'SUPERSEDED',
        engineeringIntent: contract.engineeringIntent,
        sourceContractId: contract.id,
        sourceContractVersion: contract.version,
        sourceContractFingerprint: evaluation.sourceContract.fingerprint,
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-20T10:00:00.000Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: false,
          status: 'SUPERSEDED',
          blockingReasons: ['Superseded by v1.0'],
          unresolvedIssuesCount: 0
        }
      };

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        strategy: supersededStrategy
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      const stratComp = pkg.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
      expect(stratComp?.presenceStatus).toBe('SUPERSEDED');
      expect(pkg.generationIssues.some((i) => i.includes('SUPERSEDED'))).toBe(true);
    });

    it('16. Test Plan status STALE and SUPERSEDED cause explicit presence status and INVALID_PROVENANCE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const staleTestPlan: EngineeringArtefact = {
        id: 'testplan-retailco-bf2026-stale',
        projectId: contract.projectId,
        projectName: contract.projectName,
        type: 'PERFORMANCE_TEST_PLAN',
        title: 'RetailCo Performance Test Plan',
        version: 'v1.0',
        status: 'STALE',
        engineeringIntent: contract.engineeringIntent,
        sourceContractId: contract.id,
        sourceContractVersion: contract.version,
        sourceContractFingerprint: evaluation.sourceContract.fingerprint,
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-21T11:00:00.000Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: false,
          status: 'STALE',
          blockingReasons: ['Stale test plan'],
          unresolvedIssuesCount: 1
        }
      };

      const pkgStale = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        testPlan: staleTestPlan
      });

      expect(pkgStale.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      const planCompStale = pkgStale.components.find((c) => c.componentType === 'PERFORMANCE_TEST_PLAN');
      expect(planCompStale?.presenceStatus).toBe('STALE');

      const supersededPlan: EngineeringArtefact = {
        ...staleTestPlan,
        id: 'testplan-retailco-bf2026-superseded',
        status: 'SUPERSEDED'
      };

      const pkgSuperseded = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register,
        testPlan: supersededPlan
      });

      expect(pkgSuperseded.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      const planCompSuperseded = pkgSuperseded.components.find((c) => c.componentType === 'PERFORMANCE_TEST_PLAN');
      expect(planCompSuperseded?.presenceStatus).toBe('SUPERSEDED');
    });

    it('17. Authoritative RetailCo remains VALID package carrying INCONCLUSIVE Acceptance, one finding, and zero defect candidates', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

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

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      // Package validity vs Acceptance verdict
      expect(pkg.packageGenerationStatus).toBe('VALID');
      expect(pkg.acceptanceEvaluation.overallVerdict).toBe('INCONCLUSIVE');

      // Workload prerequisite unresolved
      expect(pkg.evidenceSummary.workloadAttainment?.status).toBe('UNRESOLVED');
      expect(pkg.evidenceSummary.workloadAttainment?.isPrerequisiteMet).toBe(false);

      // Criteria evaluations
      const checkout = pkg.evidenceSummary.criterionOutcomes.find((c) => c.key === 'checkout_response_time');
      expect(checkout?.status).toBe('PASS');
      expect(checkout?.observedValue).toBeCloseTo(0.3906885, 4);

      const errRate = pkg.evidenceSummary.criterionOutcomes.find((c) => c.key === 'global_error_rate');
      expect(errRate?.status).toBe('PASS');
      expect(errRate?.observedValue).toBe(0);

      // Findings & defect candidate counts
      expect(pkg.findingsRegister.totalFindings).toBe(1);
      expect(pkg.findingsRegister.totalDefectCandidates).toBe(0);

      // Cryptographic verification
      const verify = verifyPerformanceEvidencePackageDigest(pkg);
      expect(verify.isValid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 18. M4.1.2 Audit Metadata Fidelity & Placeholder Elimination Gate
  // -------------------------------------------------------------------------
  describe('18. M4.1.2 Audit Metadata Fidelity & Placeholder Elimination Gate', () => {
    it('preserves exact canonical TestDefinition status instead of hardcoding ACTIVE', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      (testDef as any).status = 'STABLE';
      const results = createAuthoritativeResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      const testDefComponent = pkg.components.find((c) => c.componentType === 'TEST_DEFINITION');
      expect(testDefComponent?.status).toBe('STABLE');
    });

    it('does not invent CANONICAL_RESULTS status = INGESTED', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      const resultsComponent = pkg.components.find((c) => c.componentType === 'CANONICAL_RESULTS');
      expect(resultsComponent?.status).toBeUndefined();
    });

    it('does not synthesize executionMode=CANONICAL or operationalStatus=UNKNOWN fallbacks', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();
      delete (results.run as any).executionMode;
      delete (results.run as any).operationalStatus;

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.evidenceSummary.execution.executionMode).toBeUndefined();
      expect(pkg.evidenceSummary.execution.operationalStatus).toBeUndefined();
      expect(verifyPerformanceEvidencePackageDigest(pkg).isValid).toBe(true);
    });

    it('does not synthesize missing workload prerequisite into INVALID or empty rationale', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      // Simulate absent workload prerequisite with valid cryptographic digest
      const evaluationWithoutPrereq: any = {
        ...evaluation,
        workloadPrerequisite: undefined
      };
      evaluationWithoutPrereq.evaluationDigest = computeAcceptanceEvaluationDigest(
        buildAcceptanceEvaluationDigestPayload(evaluationWithoutPrereq)
      );

      const register = generateFindings({
        acceptanceEvaluation: evaluationWithoutPrereq,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluationWithoutPrereq,
        findingsRegister: register
      });

      expect(pkg.evidenceSummary.workloadAttainment).toBeUndefined();
      expect(verifyPerformanceEvidencePackageDigest(pkg).isValid).toBe(true);
    });

    it('eliminates all literal unknown strings in lineage edges and package identity', () => {
      const contract = { ...RETAILCO_M3_APPROVED_CONTRACT, id: '' } as any;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();
      delete (results.run as any).executionRunId;

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).not.toBe('VALID');
      expect(pkg.sourceExecutionRunId).toBeUndefined();

      // Check no lineage edges contain 'unknown'
      for (const edge of pkg.lineage.edges) {
        expect(edge.fromId).not.toBe('unknown');
        expect(edge.toId).not.toBe('unknown');
      }

      // Check JSON representation has no "unknown" values
      const jsonStr = JSON.stringify(pkg);
      expect(jsonStr).not.toContain('"unknown"');
    });

    it('requires complete audit identities before a package can be VALID', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      // Missing commit SHA
      delete (results.run as any).repositoryCommitSha;
      delete (results.run as any).commitSha;

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
      expect(pkg.generationIssues).toContain(
        'Execution run repository/commit SHA is missing from canonical results.'
      );
    });

    it('strictly preserves authoritative RetailCo package facts and invariant values', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAuthoritativeResults();

      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const register = generateFindings({
        acceptanceEvaluation: evaluation,
        results,
        contract,
        testDefinition: testDef
      });

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: register
      });

      // Status invariants
      expect(pkg.packageGenerationStatus).toBe('VALID');
      expect(pkg.acceptanceEvaluation.overallVerdict).toBe('INCONCLUSIVE');

      // Demand invariants
      expect(pkg.evidenceSummary.workloadDemand.businessDemand?.targetValue).toBe(8.75);
      expect(pkg.evidenceSummary.workloadDemand.businessDemand?.unit).toBe('orders/second');
      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand?.peakArrivalRate).toBe(109.375);
      expect(pkg.evidenceSummary.workloadDemand.schedulerDemand?.unit).toBe('journey_iterations/second');

      // Timings: 300 / 900 / 120 / 1320
      expect(pkg.evidenceSummary.workloadDemand.rampUpSeconds).toBe(300);
      expect(pkg.evidenceSummary.workloadDemand.steadyStateSeconds).toBe(900);
      expect(pkg.evidenceSummary.workloadDemand.rampDownSeconds).toBe(120);
      expect(pkg.evidenceSummary.workloadDemand.totalDurationSeconds).toBe(1320);

      // Criteria outcomes
      const checkout = pkg.evidenceSummary.criterionOutcomes.find((c) => c.key === 'checkout_response_time');
      expect(checkout?.status).toBe('PASS');
      expect(checkout?.observedValue).toBeCloseTo(0.3906885, 4);

      const errorRate = pkg.evidenceSummary.criterionOutcomes.find((c) => c.key === 'global_error_rate');
      expect(errorRate?.status).toBe('PASS');
      expect(errorRate?.observedValue).toBe(0);

      // Findings & defect candidates
      expect(pkg.findingsRegister.totalFindings).toBe(1);
      expect(pkg.findingsRegister.totalDefectCandidates).toBe(0);

      // Verifiable digest
      const verification = verifyPerformanceEvidencePackageDigest(pkg);
      expect(verification.isValid).toBe(true);
    });

    describe('M4.1.3 — Required Lineage Binding Completeness Gate & Invariants', () => {
      const recomputeEvaluation = (evalObj: any) => {
        const payload = buildAcceptanceEvaluationDigestPayload(evalObj);
        const digest = computeAcceptanceEvaluationDigest(payload);
        evalObj.evaluationDigest = digest;
        evalObj.evaluationFingerprint = digest.value;
        return evalObj;
      };

      const recomputeRegister = (regObj: any) => {
        const payload = buildFindingsRegisterDigestPayload(regObj);
        const digest = computeFindingsRegisterDigest(payload);
        regObj.registerDigest = digest;
        regObj.id = `findings-reg-${digest.value.slice(0, 16)}`;
        return regObj;
      };

      it('rejects Test Definition missing sourceContractId with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = { ...createAuthoritativeTestDef(), sourceContractId: undefined as any };
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });
        const pkg = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg.generationIssues).toContain('Test Definition is missing required sourceContractId binding.');
      });

      it('rejects Test Definition missing sourceContractVersion with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = { ...createAuthoritativeTestDef(), sourceContractVersion: undefined as any };
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });
        const pkg = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg.generationIssues).toContain('Test Definition is missing required sourceContractVersion binding.');
      });

      it('rejects Test Definition missing sourceContractFingerprint with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = { ...createAuthoritativeTestDef(), sourceContractFingerprint: undefined as any };
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });
        const pkg = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg.generationIssues).toContain('Test Definition is missing required sourceContractFingerprint binding.');
      });

      it('rejects Results missing sourceContract id/version/fingerprint with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();

        const resultsWithoutContractId = createAuthoritativeResults();
        delete (resultsWithoutContractId.run.sourceContract as any).id;
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results: resultsWithoutContractId });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results: resultsWithoutContractId,
          contract,
          testDefinition: testDef
        });
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results: resultsWithoutContractId,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg1.generationIssues).toContain('Results execution run is missing required sourceContract.id binding.');

        const resultsWithoutVersion = createAuthoritativeResults();
        delete (resultsWithoutVersion.run.sourceContract as any).version;
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results: resultsWithoutVersion,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg2.generationIssues).toContain('Results execution run is missing required sourceContract.version binding.');

        const resultsWithoutFp = createAuthoritativeResults();
        delete (resultsWithoutFp.run.sourceContract as any).fingerprint;
        const pkg3 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results: resultsWithoutFp,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg3.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg3.generationIssues).toContain('Results execution run is missing required sourceContract.fingerprint binding.');
      });

      it('rejects Results missing testDefinition id/version/fingerprint with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();

        const resultsWithoutDefId = createAuthoritativeResults();
        delete (resultsWithoutDefId.run.testDefinition as any).id;
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results: resultsWithoutDefId });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results: resultsWithoutDefId,
          contract,
          testDefinition: testDef
        });
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results: resultsWithoutDefId,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg1.generationIssues).toContain('Results execution run is missing required testDefinition.id binding.');

        const resultsWithoutDefVersion = createAuthoritativeResults();
        delete (resultsWithoutDefVersion.run.testDefinition as any).version;
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results: resultsWithoutDefVersion,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg2.generationIssues).toContain('Results execution run is missing required testDefinition.version binding.');

        const resultsWithoutDefFp = createAuthoritativeResults();
        delete (resultsWithoutDefFp.run.testDefinition as any).fingerprint;
        const pkg3 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results: resultsWithoutDefFp,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg3.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg3.generationIssues).toContain('Results execution run is missing required testDefinition.fingerprint binding.');
      });

      it('rejects Acceptance missing sourceExecutionRunId or canonicalResults.executionRunId with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const evalMissingRunId = recomputeEvaluation({ ...evaluation });
        delete (evalMissingRunId as any).sourceExecutionRunId;
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingRunId,
          findingsRegister: register
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg1.generationIssues).toContain('Acceptance evaluation is missing required sourceExecutionRunId.');

        const evalMissingResultsRunId = recomputeEvaluation({
          ...evaluation,
          canonicalResults: { ...evaluation.canonicalResults, executionRunId: undefined as any }
        });
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingResultsRunId,
          findingsRegister: register
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg2.generationIssues).toContain('Acceptance evaluation is missing required canonicalResults.executionRunId.');
      });

      it('rejects Acceptance missing sourceContract id/version/fingerprint with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const evalMissingCId = recomputeEvaluation({
          ...evaluation,
          sourceContract: { ...evaluation.sourceContract, id: undefined as any }
        });
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingCId,
          findingsRegister: register
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg1.generationIssues).toContain('Acceptance evaluation is missing required sourceContract.id binding.');

        const evalMissingCVer = recomputeEvaluation({
          ...evaluation,
          sourceContract: { ...evaluation.sourceContract, version: undefined as any }
        });
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingCVer,
          findingsRegister: register
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg2.generationIssues).toContain('Acceptance evaluation is missing required sourceContract.version binding.');

        const evalMissingCFp = recomputeEvaluation({
          ...evaluation,
          sourceContract: { ...evaluation.sourceContract, fingerprint: undefined as any }
        });
        const pkg3 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingCFp,
          findingsRegister: register
        });
        expect(pkg3.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg3.generationIssues).toContain('Acceptance evaluation is missing required sourceContract.fingerprint binding.');
      });

      it('rejects Acceptance missing testDefinition id/version/fingerprint with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const evalMissingTDefId = recomputeEvaluation({
          ...evaluation,
          testDefinition: { ...evaluation.testDefinition, id: undefined as any }
        });
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingTDefId,
          findingsRegister: register
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg1.generationIssues).toContain('Acceptance evaluation is missing required testDefinition.id binding.');

        const evalMissingTDefVer = recomputeEvaluation({
          ...evaluation,
          testDefinition: { ...evaluation.testDefinition, version: undefined as any }
        });
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingTDefVer,
          findingsRegister: register
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg2.generationIssues).toContain('Acceptance evaluation is missing required testDefinition.version binding.');

        const evalMissingTDefFp = recomputeEvaluation({
          ...evaluation,
          testDefinition: { ...evaluation.testDefinition, fingerprint: undefined as any }
        });
        const pkg3 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingTDefFp,
          findingsRegister: register
        });
        expect(pkg3.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg3.generationIssues).toContain('Acceptance evaluation is missing required testDefinition.fingerprint binding.');
      });

      it('rejects Acceptance missing workloadPrerequisite, provenanceGate, or operationalIntegrityGate with INVALID_ACCEPTANCE_INTEGRITY', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const evalMissingWorkload = { ...evaluation };
        delete (evalMissingWorkload as any).workloadPrerequisite;
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingWorkload,
          findingsRegister: register
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_ACCEPTANCE_INTEGRITY');
        expect(pkg1.generationIssues).toContain('Acceptance evaluation is missing required workloadPrerequisite.');

        const evalMissingProvGate = { ...evaluation };
        delete (evalMissingProvGate as any).provenanceGate;
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingProvGate,
          findingsRegister: register
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_ACCEPTANCE_INTEGRITY');
        expect(pkg2.generationIssues).toContain('Acceptance evaluation is missing required provenanceGate.');

        const evalMissingOpGate = { ...evaluation };
        delete (evalMissingOpGate as any).operationalIntegrityGate;
        const pkg3 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evalMissingOpGate,
          findingsRegister: register
        });
        expect(pkg3.packageGenerationStatus).toBe('INVALID_ACCEPTANCE_INTEGRITY');
        expect(pkg3.generationIssues).toContain('Acceptance evaluation is missing required operationalIntegrityGate.');
      });

      it('rejects Findings missing sourceExecutionRunId with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const registerMissingRunId = { ...register };
        delete (registerMissingRunId as any).sourceExecutionRunId;
        recomputeRegister(registerMissingRunId);

        const pkg = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: registerMissingRunId
        });
        expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        expect(pkg.generationIssues).toContain('Findings register is missing required sourceExecutionRunId.');
      });

      it('rejects Findings missing sourceAcceptanceEvaluationId or sourceAcceptanceEvaluationDigest with INVALID_FINDINGS_INTEGRITY', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const registerMissingEvalId = { ...register };
        delete (registerMissingEvalId as any).sourceAcceptanceEvaluationId;
        const pkg1 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: registerMissingEvalId
        });
        expect(pkg1.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
        expect(pkg1.generationIssues).toContain('Findings register is missing required sourceAcceptanceEvaluationId.');

        const registerMissingEvalDigest = { ...register };
        delete (registerMissingEvalDigest as any).sourceAcceptanceEvaluationDigest;
        const pkg2 = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: registerMissingEvalDigest
        });
        expect(pkg2.packageGenerationStatus).toBe('INVALID_FINDINGS_INTEGRITY');
        expect(pkg2.generationIssues).toContain('Findings register is missing required sourceAcceptanceEvaluationDigest.');
      });

      it('verifies that REQUIRED_CORE_LINEAGE_EDGES contains all six core edges', () => {
        expect(REQUIRED_CORE_LINEAGE_EDGES).toHaveLength(6);
        expect(REQUIRED_CORE_LINEAGE_EDGES).toEqual([
          { fromComponent: 'PERFORMANCE_CONTRACT', toComponent: 'TEST_DEFINITION' },
          { fromComponent: 'TEST_DEFINITION', toComponent: 'EXECUTION_RUN' },
          { fromComponent: 'EXECUTION_RUN', toComponent: 'RAW_EVIDENCE_INVENTORY' },
          { fromComponent: 'RAW_EVIDENCE_INVENTORY', toComponent: 'CANONICAL_RESULTS' },
          { fromComponent: 'CANONICAL_RESULTS', toComponent: 'ACCEPTANCE_EVALUATION' },
          { fromComponent: 'ACCEPTANCE_EVALUATION', toComponent: 'FINDINGS_REGISTER' }
        ]);
      });

      it('rejects unverified core edge in lineage with INVALID_PROVENANCE', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        // Mismatched sourceContractVersion on testDef
        const testDefMismatchedVersion = { ...testDef, sourceContractVersion: 'v999.0' };
        const pkg = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDefMismatchedVersion,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });
        expect(pkg.packageGenerationStatus).toBe('INVALID_PROVENANCE');
        const contractToTestDefEdge = pkg.lineage.edges.find(
          (e) => e.fromComponent === 'PERFORMANCE_CONTRACT' && e.toComponent === 'TEST_DEFINITION'
        );
        expect(contractToTestDefEdge?.verified).toBe(false);
      });

      it('ensures TestDefinitionStatus is strictly canonical and never non-canonical STABLE', () => {
        const testDef = createAuthoritativeTestDef();
        expect(testDef.status).toBe('READY_FOR_EXECUTION');
        expect((testDef.status as string)).not.toBe('STABLE');

        const canonicalStatuses: TestDefinitionStatus[] = [
          'DRAFT',
          'BLOCKED',
          'NOT_EXECUTABLE',
          'READY_FOR_EXECUTION',
          'APPROVED',
          'SUPERSEDED'
        ];
        expect(canonicalStatuses).toContain(testDef.status);
      });

      it('strictly preserves authoritative RetailCo facts and maintains package VALID status', () => {
        const contract = RETAILCO_M3_APPROVED_CONTRACT;
        const testDef = createAuthoritativeTestDef();
        const results = createAuthoritativeResults();
        const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
        const register = generateFindings({
          acceptanceEvaluation: evaluation,
          results,
          contract,
          testDefinition: testDef
        });

        const pkg = generatePerformanceEvidencePackage({
          contract,
          testDefinition: testDef,
          results,
          acceptanceEvaluation: evaluation,
          findingsRegister: register
        });

        expect(pkg.packageGenerationStatus).toBe('VALID');
        expect(pkg.generationIssues).toHaveLength(0);

        // Verify all 6 core lineage edges are present and verified
        for (const req of REQUIRED_CORE_LINEAGE_EDGES) {
          const edge = pkg.lineage.edges.find(
            (e) => e.fromComponent === req.fromComponent && e.toComponent === req.toComponent
          );
          expect(edge).toBeDefined();
          expect(edge?.verified).toBe(true);
          expect(edge?.fromId).toBeTruthy();
          expect(edge?.toId).toBeTruthy();
        }

        const verification = verifyPerformanceEvidencePackageDigest(pkg);
        expect(verification.isValid).toBe(true);
      });
    });
  });
});
