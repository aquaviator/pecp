import { describe, it, expect } from 'vitest';
import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  EngineeringArtefact,
  PerformanceEvidencePackage
} from '@pecp/pe-domain';
import {
  compileTestDefinition,
  ingestGovernedExecutionEvidence,
  evaluateAcceptance,
  generateFindings,
  generatePerformanceEvidencePackage,
  verifyPerformanceEvidencePackageDigest,
  computeEvidencePackageDigest
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
      expect(pkg.evidenceSummary.acceptanceVerdict.verdict).toBe('PASS');
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
      expect(pkg.evidenceSummary.findingsSummary.totalDefectCandidates).toBe(1);
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
});
