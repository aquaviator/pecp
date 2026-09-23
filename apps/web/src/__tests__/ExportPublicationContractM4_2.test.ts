import { describe, it, expect } from 'vitest';
import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  AcceptanceEvaluation,
  FindingsRegister,
  PerformanceEvidencePackage,
  PublicationBundle,
  GovernedObservation,
  EngineeringArtefact
} from '@pecp/pe-domain';
import {
  compileTestDefinition,
  ingestGovernedExecutionEvidence,
  evaluateAcceptance,
  generateFindings,
  generatePerformanceEvidencePackage,
  generateResultsReport,
  renderResultsReportMarkdown,
  renderResultsReportHtml,
  generateDefectPayloads,
  generatePublicationBundle,
  verifyPublicationBundleDigest,
  buildResultsReportDigestPayload,
  computeResultsReportDigest,
  computeTestDefinitionFingerprint,
  sha256Hex
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

describe('M4.2 / M4.2.1 — Canonical Export & Publication Contract Gate', () => {
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

  const createAuthoritativePackageAndFindings = (): {
    contract: PerformanceContract;
    testDef: TestDefinition;
    results: CanonicalExecutionResult;
    evaluation: AcceptanceEvaluation;
    findingsRegister: FindingsRegister;
    evidencePackage: PerformanceEvidencePackage;
  } => {
    const contract = RETAILCO_M3_APPROVED_CONTRACT;
    const testDef = createAuthoritativeTestDef();
    const results = createAuthoritativeResults();
    const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
    const findingsRegister = generateFindings({
      acceptanceEvaluation: evaluation,
      results,
      contract,
      testDefinition: testDef
    });
    const evidencePackage = generatePerformanceEvidencePackage({
      contract,
      testDefinition: testDef,
      results,
      acceptanceEvaluation: evaluation,
      findingsRegister
    });
    return { contract, testDef, results, evaluation, findingsRegister, evidencePackage };
  };

  const createAttainedResults = (): CanonicalExecutionResult => {
    const base = createAuthoritativeResults();
    return {
      ...base,
      acceptanceBasisAttainment: {
        ...base.acceptanceBasisAttainment,
        resultValue: 8.9,
        derivationStatus: 'DETERMINISTICALLY_DERIVED'
      }
    };
  };

  const createFailingResults = (): CanonicalExecutionResult => {
    const base = createAuthoritativeResults();
    return {
      ...base,
      acceptanceBasisAttainment: {
        ...base.acceptanceBasisAttainment,
        resultValue: 8.9,
        derivationStatus: 'DETERMINISTICALLY_DERIVED'
      },
      metrics: {
        ...base.metrics,
        httpReqDurationCheckout: {
          ...base.metrics.httpReqDurationCheckout,
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
        ...base.thresholdObservations.filter(
          (t) => t.metric !== 'http_req_duration{journey:checkout}'
        )
      ]
    };
  };

  describe('1. Authoritative RetailCo Export Output (M4.2 & M4.2.1)', () => {
    it('preserves VALID package status, INCONCLUSIVE verdict, and exact governed metrics', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      expect(evidencePackage.packageGenerationStatus).toBe('VALID');
      expect(evidencePackage.evidenceSummary.acceptanceVerdict?.verdict).toBe('INCONCLUSIVE');

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API']
      });

      // Bundle top-level checks
      expect(bundle.overallReadiness).toBe('READY');
      expect(bundle.sourceAcceptanceVerdict).toBe('INCONCLUSIVE');
      expect(bundle.sourceEvidencePackageId).toBe(evidencePackage.id);
      expect(bundle.sourceEvidencePackageDigest).toBe(evidencePackage.packageDigest.value);
      expect(bundle.blockingReasons).toHaveLength(0);

      // Verify Report content within bundle
      const reportArtifact = bundle.artifacts.find(
        (a) => a.artifactType === 'RESULTS_REPORT' && a.format === 'JSON'
      );
      expect(reportArtifact).toBeDefined();
      const report = JSON.parse(reportArtifact!.content);

      // Acceptance verdict: INCONCLUSIVE
      expect(report.acceptanceVerdict.verdict).toBe('INCONCLUSIVE');

      // Exact business target: 8.75 orders/second
      expect(report.workloadDemand.businessDemand).toBe(8.75);
      expect(report.workloadDemand.businessDemandUnit).toBe('orders/second');

      // Exact scheduler demand: 109.375 journey_iterations/second
      expect(report.workloadDemand.schedulerDemand).toBe(109.375);
      expect(report.workloadDemand.schedulerDemandUnit).toBe('journey_iterations/second');
      expect(report.workloadDemand.schedulerPopulation).toBe('JOURNEY_ITERATION');
      expect(report.workloadDemand.executionModel).toBe('OPEN');

      // Exact timings: 300 / 900 / 120 / 1320
      expect(report.scheduleTimings.rampUpSeconds).toBe(300);
      expect(report.scheduleTimings.steadyStateSeconds).toBe(900);
      expect(report.scheduleTimings.rampDownSeconds).toBe(120);
      expect(report.scheduleTimings.totalDurationSeconds).toBe(1320);

      // Criteria outcomes
      const checkoutOutcome = report.criterionOutcomes.find(
        (c: any) => c.key === 'checkout_response_time' || c.metric === 'Checkout Response Time'
      );
      expect(checkoutOutcome).toBeDefined();
      expect(checkoutOutcome.status).toBe('PASS');
      expect(checkoutOutcome.observedValue).toBeCloseTo(0.3906885, 4);

      const errorRateOutcome = report.criterionOutcomes.find(
        (c: any) => c.key === 'global_error_rate' || c.metric === 'HTTP Error Rate'
      );
      expect(errorRateOutcome).toBeDefined();
      expect(errorRateOutcome.status).toBe('PASS');
      expect(errorRateOutcome.observedValue).toBe(0);

      // Findings summary preserved
      expect(report.findingsSummary.totalFindings).toBe(1);
      expect(report.findingsSummary.byType['WORKLOAD_ATTAINMENT_UNRESOLVED']).toBe(1);

      // Exactly zero defect candidates and zero defect payloads
      expect(report.defectCandidatesSummary.totalCandidates).toBe(0);
      expect(bundle.defectPayloads).toHaveLength(0);
    });

    it('exposes the refactored M4.2.1 visualisation hook preserving arbitrary governed schedule stages and journey mix', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const report = generateResultsReport(evidencePackage, testDef, findingsRegister);

      expect(report.visualisationHook).toBeDefined();

      // Scheduler summary
      expect(report.visualisationHook.scheduler).toEqual({
        executionModel: 'OPEN',
        population: 'JOURNEY_ITERATION',
        rateUnit: 'journey_iterations/second',
        startRate: 0,
        peakArrivalRate: 109.375
      });

      // Business target
      expect(report.visualisationHook.businessTarget).toEqual({
        metric: 'Target Workload Arrival Demand',
        targetValue: 8.75,
        unit: 'orders/second',
        timeBasis: 'STEADY_STATE_PEAK'
      });

      // Stages (M4.2.1: exact startRate, targetArrivalRate, and time boundaries)
      expect(report.visualisationHook.stages).toHaveLength(3);
      expect(report.visualisationHook.stages[0].stageIndex).toBe(1);
      expect(report.visualisationHook.stages[0].durationSeconds).toBe(300);
      expect(report.visualisationHook.stages[0].startTimeSeconds).toBe(0);
      expect(report.visualisationHook.stages[0].endTimeSeconds).toBe(300);
      expect(report.visualisationHook.stages[0].startArrivalRate).toBe(0);
      expect(report.visualisationHook.stages[0].targetArrivalRate).toBe(109.375);
      expect(report.visualisationHook.stages[0].name).toContain('Ramp-up');

      expect(report.visualisationHook.stages[1].stageIndex).toBe(2);
      expect(report.visualisationHook.stages[1].durationSeconds).toBe(900);
      expect(report.visualisationHook.stages[1].startTimeSeconds).toBe(300);
      expect(report.visualisationHook.stages[1].endTimeSeconds).toBe(1200);
      expect(report.visualisationHook.stages[1].startArrivalRate).toBe(109.375);
      expect(report.visualisationHook.stages[1].targetArrivalRate).toBe(109.375);
      expect(report.visualisationHook.stages[1].name).toContain('Steady-state');

      expect(report.visualisationHook.stages[2].stageIndex).toBe(3);
      expect(report.visualisationHook.stages[2].durationSeconds).toBe(120);
      expect(report.visualisationHook.stages[2].startTimeSeconds).toBe(1200);
      expect(report.visualisationHook.stages[2].endTimeSeconds).toBe(1320);
      expect(report.visualisationHook.stages[2].startArrivalRate).toBe(109.375);
      expect(report.visualisationHook.stages[2].targetArrivalRate).toBe(0);
      expect(report.visualisationHook.stages[2].name).toContain('Ramp-down');

      // Authoritative RetailCo journey distribution: Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%
      expect(report.visualisationHook.journeyDistribution).toHaveLength(5);
      const journeys = report.visualisationHook.journeyDistribution;
      expect(journeys.find((j) => j.journeyKey === 'browse')?.percentage).toBe(55);
      expect(journeys.find((j) => j.journeyKey === 'search')?.percentage).toBe(20);
      expect(journeys.find((j) => j.journeyKey === 'basket')?.percentage).toBe(15);
      expect(journeys.find((j) => j.journeyKey === 'checkout')?.percentage).toBe(8);
      expect(journeys.find((j) => j.journeyKey === 'account')?.percentage).toBe(2);
    });
  });

  describe('2. Verdict Projections: PASS, FAIL, PASS_WITH_OBSERVATION & Target String Preservation', () => {
    it('exports a PASS package with READY status and zero defect payloads', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      expect(evaluation.overallVerdict).toBe('PASS');

      const findings = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: testDef });
      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: findings
      });

      const bundle = generatePublicationBundle({
        evidencePackage: pkg,
        findingsRegister: findings,
        testDefinition: testDef,
        destinations: ['DOWNLOAD', 'API']
      });

      expect(bundle.overallReadiness).toBe('READY');
      expect(bundle.sourceAcceptanceVerdict).toBe('PASS');
      expect(bundle.defectPayloads).toHaveLength(0);

      const verification = verifyPublicationBundleDigest(bundle);
      expect(verification.isValid).toBe(true);
    });

    it('exports a FAIL package preserving Defect Candidate target strings exactly without Number() corruption', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createFailingResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      expect(evaluation.overallVerdict).toBe('FAIL');

      const findings = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: testDef });
      expect(findings.defectCandidates.length).toBeGreaterThan(0);

      // Verify that candidate has non-numeric target string expression 'p95 < 2000ms'
      const candidate = findings.defectCandidates[0];
      expect(candidate.acceptanceCriterionReference.target).toBe('p95 < 2000ms');

      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: findings
      });

      const bundle = generatePublicationBundle({
        evidencePackage: pkg,
        findingsRegister: findings,
        testDefinition: testDef,
        destinations: ['DOWNLOAD', 'API']
      });

      expect(bundle.overallReadiness).toBe('READY');
      expect(bundle.sourceAcceptanceVerdict).toBe('FAIL');
      expect(bundle.defectPayloads.length).toBe(1);

      const defectPayload = bundle.defectPayloads[0];
      expect(defectPayload.sourceFindingId).toBeTruthy();
      expect(defectPayload.sourceCandidateId).toBeTruthy();
      expect(defectPayload.sourceExecutionRunId).toBeTruthy();
      expect(defectPayload.title).toBeTruthy();
      expect(defectPayload.factualProblemStatement).toBeTruthy();
      expect(defectPayload.canonicalCriterionReference.metric).toBe('Checkout Response Time');
      expect(defectPayload.observedEvidence.observedValue).toBe(2450);

      // M4.2.1 Critical Invariant: target string must remain exactly 'p95 < 2000ms', not cast to NaN or null
      expect(defectPayload.canonicalCriterionReference.target).toBe('p95 < 2000ms');
      expect(defectPayload.expectedCriterion.target).toBe('p95 < 2000ms');

      // Governed comparison semantics preserved separately
      expect(defectPayload.expectedCriterion.operator).toBe('<');
      expect(defectPayload.expectedCriterion.thresholdValue).toBe(2000);
      expect(defectPayload.expectedCriterion.unit).toBe('ms');

      // Invariant: Zero invented priority, severity, assignee, team/component, sprint, due date, root cause
      expect((defectPayload as any).priority).toBeUndefined();
      expect((defectPayload as any).severity).toBeUndefined();
      expect((defectPayload as any).assignee).toBeUndefined();
      expect((defectPayload as any).team).toBeUndefined();
      expect((defectPayload as any).component).toBeUndefined();
      expect((defectPayload as any).sprint).toBeUndefined();
      expect((defectPayload as any).dueDate).toBeUndefined();
      expect((defectPayload as any).rootCause).toBeUndefined();

      const verification = verifyPublicationBundleDigest(bundle);
      expect(verification.isValid).toBe(true);
    });

    it('exports a PASS_WITH_OBSERVATION package preserving observation semantics', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createAttainedResults();
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
      expect(evaluation.overallVerdict).toBe('PASS_WITH_OBSERVATION');

      const findings = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: testDef });
      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: findings
      });

      const bundle = generatePublicationBundle({
        evidencePackage: pkg,
        findingsRegister: findings,
        testDefinition: testDef,
        destinations: ['DOWNLOAD', 'API']
      });

      expect(bundle.overallReadiness).toBe('READY');
      expect(bundle.sourceAcceptanceVerdict).toBe('PASS_WITH_OBSERVATION');
    });
  });

  describe('3. Governed Absence & Semantic Default Removal (M4.2.1)', () => {
    it('invalid or audit-only package does not invent zero rates or default units/populations/verdict', () => {
      const emptyPackage: PerformanceEvidencePackage = {
        id: 'pep-0000000000000000',
        packageGenerationStatus: 'INVALID_PROVENANCE',
        packageDigest: {
          algorithm: 'SHA-256',
          schemaVersion: 'performance-evidence-package-v1',
          value: '0000000000000000000000000000000000000000000000000000000000000000'
        },
        components: [],
        lineage: {
          edges: []
        },
        evidenceSummary: {
          execution: {},
          workloadDemand: {},
          criterionOutcomes: [],
          dataQualityAndIntegrity: {
            provenanceValid: false,
            operationalIntegrityValid: false,
            rawEvidenceComplete: false,
            governedObservationsCount: 0,
            blockingObservationsCount: 0
          }
        },
        generationIssues: ['Execution failed before completion.'],
        generatedAt: '2026-09-23T00:00:00Z'
      } as unknown as PerformanceEvidencePackage;

      const report = generateResultsReport(emptyPackage);

      // Must be null / undefined / absent, NOT 'orders', 'orders/second', 0, 'JOURNEY_ITERATION', 'OPEN', 'INCONCLUSIVE'
      expect(report.workloadDemand.businessDemand).toBeNull();
      expect(report.workloadDemand.businessDemandUnit).toBeNull();
      expect(report.workloadDemand.businessDemandMetric).toBeNull();
      expect(report.workloadDemand.schedulerDemand).toBeNull();
      expect(report.workloadDemand.schedulerDemandUnit).toBeNull();
      expect(report.workloadDemand.schedulerPopulation).toBeNull();
      expect(report.workloadDemand.executionModel).toBeNull();
      expect(report.workloadAttainment).toBeNull();
      expect(report.acceptanceVerdict).toBeNull();

      // Markdown and HTML must display explicit [GOVERNED ABSENCE]
      const md = renderResultsReportMarkdown(report);
      expect(md).toContain('**Acceptance Verdict**: [GOVERNED ABSENCE]');
      expect(md).toContain('**Business Workload Demand**: [GOVERNED ABSENCE]');
      expect(md).toContain('**Scheduler Demand**: [GOVERNED ABSENCE] (Population: [GOVERNED ABSENCE], Execution Model: [GOVERNED ABSENCE])');

      const html = renderResultsReportHtml(report);
      expect(html).toContain('<strong>Acceptance Verdict:</strong> [GOVERNED ABSENCE]');
      expect(html).toContain('<strong>Business Workload Demand:</strong> [GOVERNED ABSENCE]');
    });

    it('never synthesizes INCONCLUSIVE in audit-only PublicationBundle when source verdict is absent', () => {
      const emptyPackage: PerformanceEvidencePackage = {
        id: 'pep-0000000000000000',
        packageGenerationStatus: 'INVALID_PROVENANCE',
        packageDigest: {
          algorithm: 'SHA-256',
          schemaVersion: 'performance-evidence-package-v1',
          value: '0000000000000000000000000000000000000000000000000000000000000000'
        },
        components: [],
        lineage: {
          edges: []
        },
        evidenceSummary: {
          execution: {},
          workloadDemand: {},
          criterionOutcomes: [],
          dataQualityAndIntegrity: {
            provenanceValid: false,
            operationalIntegrityValid: false,
            rawEvidenceComplete: false,
            governedObservationsCount: 0,
            blockingObservationsCount: 0
          }
        },
        generationIssues: ['Results missing.'],
        generatedAt: '2026-09-23T00:00:00Z'
      } as unknown as PerformanceEvidencePackage;

      const bundle = generatePublicationBundle({
        evidencePackage: emptyPackage,
        allowAuditOnly: true,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('AUDIT_ONLY_NOT_PUBLISHABLE');
      expect(bundle.sourceAcceptanceVerdict).toBeUndefined();
    });
  });

  describe('4. Independent Verification of Supplied Objects (M4.2.1)', () => {
    it('blocks publication and rejects defect payload generation when FindingsRegister content is tampered', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      // Tamper a finding inside FindingsRegister while keeping stored registerDigest unchanged
      const tamperedFindings = findingsRegister.findings.map((f, i) =>
        i === 0 ? { ...f, factualDescription: 'TAMPERED DESCRIPTION' } : f
      );
      const tamperedRegister: FindingsRegister = {
        ...findingsRegister,
        findings: tamperedFindings
      };

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister: tamperedRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(
        bundle.blockingReasons.some((r) => r.includes('FindingsRegister cryptographic verification failed'))
      ).toBe(true);
      // Defect payloads must not be generated from unverified register
      expect(bundle.defectPayloads).toHaveLength(0);
    });

    it('blocks publication when independently supplied FindingsRegister mismatches component reference', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      // Tamper the canonicalId stored in the package component
      const tamperedPackage: PerformanceEvidencePackage = {
        ...evidencePackage,
        components: evidencePackage.components.map((c) =>
          c.componentType === 'FINDINGS_REGISTER' ? { ...c, canonicalId: 'findings-other-id' } : c
        )
      };

      const bundle = generatePublicationBundle({
        evidencePackage: tamperedPackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(
        bundle.blockingReasons.some((r) => r.includes('does not match component canonicalId'))
      ).toBe(true);
    });

    it('blocks publication when TestDefinition fingerprint drifts from computed fingerprint', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      // Modify a journey step path in testDef without updating fingerprint
      const driftedTestDef: TestDefinition = {
        ...testDef,
        journeys: testDef.journeys.map((j, i) =>
          i === 0
            ? {
                ...j,
                steps: j.steps.map((s, si) => (si === 0 ? { ...s, path: '/api/v1/tampered-path' } : s))
              }
            : j
        )
      };

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: driftedTestDef,
        findingsRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(
        bundle.blockingReasons.some((r) => r.includes('TestDefinition fingerprint drift'))
      ).toBe(true);
    });

    it('blocks publication when TestDefinition version mismatches package component', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      // Modify version on testDef
      const modifiedTestDef: TestDefinition = {
        ...testDef,
        version: 'v2.0'
      };
      // Recompute fingerprint so internal fingerprint check passes
      (modifiedTestDef as any).fingerprint = computeTestDefinitionFingerprint(modifiedTestDef);

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: modifiedTestDef,
        findingsRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(
        bundle.blockingReasons.some((r) => r.includes('TestDefinition version v2.0 does not match'))
      ).toBe(true);
    });

    it('marks Strategy artifact ineligible when Strategy is stale or superseded in Evidence Package', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const strategy: EngineeringArtefact = {
        id: 'strategy-retailco-bf2026',
        projectId: 'proj-retailco',
        projectName: 'RetailCo',
        type: 'PERFORMANCE_STRATEGY',
        title: 'RetailCo Performance Strategy',
        version: 'v1.0',
        status: 'SUPERSEDED',
        engineeringIntent: 'REPRESENTATIVE',
        sourceContractId: 'contract-retailco-v1',
        sourceContractVersion: 'v1.0',
        sourceContractFingerprint: 'fp-mock-contract',
        sourceIntelligenceReferences: [],
        generationTimestamp: '2026-09-23T00:00:00Z',
        sections: [],
        unresolvedIssues: [],
        approvalReadiness: {
          canApprove: false,
          status: 'SUPERSEDED',
          blockingReasons: ['Superseded by v2'],
          unresolvedIssuesCount: 0
        }
      };

      const packageWithStrategy: PerformanceEvidencePackage = {
        ...evidencePackage,
        components: [
          ...evidencePackage.components,
          {
            componentType: 'PERFORMANCE_STRATEGY',
            canonicalId: strategy.id,
            version: strategy.version,
            fingerprint: strategy.sourceContractFingerprint,
            status: 'SUPERSEDED',
            isRequired: false,
            presenceStatus: 'SUPERSEDED'
          }
        ]
      };

      const bundle = generatePublicationBundle({
        evidencePackage: packageWithStrategy,
        testDefinition: testDef,
        findingsRegister,
        strategy,
        destinations: ['DOWNLOAD']
      });

      const stratArtifact = bundle.artifacts.find(
        (a) => a.artifactType === 'PERFORMANCE_STRATEGY'
      );
      expect(stratArtifact).toBeDefined();
      expect(stratArtifact!.publicationEligibility).toBe(false);
      expect(stratArtifact!.blockingReasons.some((r) => r.includes('stale, superseded'))).toBe(true);
      // M4.2.1: sourceFingerprint must not pretend to be an artefact content fingerprint
      expect(stratArtifact!.sourceFingerprint).toBeNull();
    });
  });

  describe('5. Cryptographic Binding & Bundle Verification Hardening (M4.2.1)', () => {
    it('detects tampered artifact metadata or mediaType during bundle verification', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API']
      });

      expect(verifyPublicationBundleDigest(bundle).isValid).toBe(true);

      // Tamper artifact metadata
      const tamperedMetaBundle: PublicationBundle = {
        ...bundle,
        artifacts: bundle.artifacts.map((a, i) =>
          i === 0 ? { ...a, metadata: { ...a.metadata, tamperedKey: true } } : a
        )
      };
      expect(verifyPublicationBundleDigest(tamperedMetaBundle).isValid).toBe(false);

      // Tamper artifact mediaType
      const tamperedMediaTypeBundle: PublicationBundle = {
        ...bundle,
        artifacts: bundle.artifacts.map((a, i) =>
          i === 0 ? { ...a, mediaType: 'application/octet-stream' } : a
        )
      };
      expect(verifyPublicationBundleDigest(tamperedMediaTypeBundle).isValid).toBe(false);

      // Tamper artifact blockingReasons
      const tamperedReasonsBundle: PublicationBundle = {
        ...bundle,
        artifacts: bundle.artifacts.map((a, i) =>
          i === 0 ? { ...a, blockingReasons: ['Fabricated blocking reason'] } : a
        )
      };
      expect(verifyPublicationBundleDigest(tamperedReasonsBundle).isValid).toBe(false);
    });

    it('rejects bundle algorithm/schema/id tamper', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD']
      });

      // Tamper algorithm
      const tamperedAlgo: PublicationBundle = {
        ...bundle,
        bundleDigest: { ...bundle.bundleDigest, algorithm: 'SHA-512' as any }
      };
      expect(verifyPublicationBundleDigest(tamperedAlgo).isValid).toBe(false);

      // Tamper schemaVersion
      const tamperedSchema: PublicationBundle = {
        ...bundle,
        bundleDigest: { ...bundle.bundleDigest, schemaVersion: 'publication-bundle-v2' as any }
      };
      expect(verifyPublicationBundleDigest(tamperedSchema).isValid).toBe(false);

      // Tamper bundle ID
      const tamperedId: PublicationBundle = {
        ...bundle,
        id: 'pub-invalid-custom-id'
      };
      expect(verifyPublicationBundleDigest(tamperedId).isValid).toBe(false);
    });

    it('detects defect payload id tamper during bundle verification', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createFailingResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      const findings = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: testDef });
      const pkg = generatePerformanceEvidencePackage({
        contract,
        testDefinition: testDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister: findings
      });

      const bundle = generatePublicationBundle({
        evidencePackage: pkg,
        findingsRegister: findings,
        testDefinition: testDef,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.defectPayloads.length).toBeGreaterThan(0);
      expect(verifyPublicationBundleDigest(bundle).isValid).toBe(true);

      const tamperedDefectsBundle: PublicationBundle = {
        ...bundle,
        defectPayloads: bundle.defectPayloads.map((d, i) =>
          i === 0 ? { ...d, id: 'defect-payload-tampered-id' } : d
        )
      };
      const result = verifyPublicationBundleDigest(tamperedDefectsBundle);
      expect(result.isValid).toBe(false);
      expect(result.mismatches.some((m) => m.includes('Defect payload ID mismatch'))).toBe(true);
    });

    it('changes ResultsReport reportDigest when any semantic field is modified', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const report = generateResultsReport(evidencePackage, testDef, findingsRegister);

      const basePayload = buildResultsReportDigestPayload(report);
      const originalDigest = computeResultsReportDigest(basePayload);
      expect(report.reportDigest).toBe(originalDigest);

      // Tamper projectExecutionIdentity
      const tamperedIdentityPayload = {
        ...basePayload,
        projectExecutionIdentity: {
          ...basePayload.projectExecutionIdentity,
          executionMode: 'CUSTOM_TEST'
        }
      };
      expect(computeResultsReportDigest(tamperedIdentityPayload)).not.toBe(originalDigest);

      // Tamper workloadDemand schedulerPopulation
      const tamperedDemandPayload = {
        ...basePayload,
        workloadDemand: {
          ...basePayload.workloadDemand,
          schedulerPopulation: 'SESSION'
        }
      };
      expect(computeResultsReportDigest(tamperedDemandPayload)).not.toBe(originalDigest);

      // Tamper visualisationHook stages
      const tamperedStagesPayload = {
        ...basePayload,
        visualisationHook: {
          ...basePayload.visualisationHook,
          stages: [
            ...basePayload.visualisationHook.stages,
            { stageIndex: 99, durationSeconds: 60, startTimeSeconds: 1320, endTimeSeconds: 1380, startArrivalRate: 0, targetArrivalRate: 10 }
          ]
        }
      };
      expect(computeResultsReportDigest(tamperedStagesPayload)).not.toBe(originalDigest);
    });
  });

  describe('6. Arbitrary Governed Schedule Visualisation Fidelity (M4.2.1)', () => {
    it('projects generic two-stage schedule with non-zero start rate and cumulative timing', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();

      // Custom 2-stage schedule with startRate = 25
      const customTestDef: TestDefinition = {
        ...baseTestDef,
        scenarios: [
          {
            ...baseTestDef.scenarios[0],
            workloadSchedule: {
              id: 'sched-two-stage-custom',
              executionModel: 'OPEN',
              arrivalPopulation: 'TRANSACTION',
              rateUnit: 'tx/second',
              startRate: 25,
              totalDurationSeconds: 600,
              peakArrivalRate: 150,
              timeUnit: 'seconds',
              stages: [
                { durationSeconds: 200, targetArrivalRate: 150, description: 'ramp-up-to-peak' },
                { durationSeconds: 400, targetArrivalRate: 150, description: 'extended-steady' }
              ]
            }
          }
        ]
      };
      (customTestDef as any).fingerprint = computeTestDefinitionFingerprint(customTestDef);

      const results = createAuthoritativeResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: customTestDef, results });
      const findingsRegister = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: customTestDef });
      const evidencePackage = generatePerformanceEvidencePackage({
        contract,
        testDefinition: customTestDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister
      });

      const report = generateResultsReport(evidencePackage, customTestDef, findingsRegister);

      expect(report.visualisationHook.scheduler).toEqual({
        executionModel: 'OPEN',
        population: 'TRANSACTION',
        rateUnit: 'tx/second',
        startRate: 25,
        peakArrivalRate: 150
      });

      expect(report.visualisationHook.stages).toHaveLength(2);
      expect(report.visualisationHook.stages[0]).toEqual({
        stageIndex: 1,
        name: 'ramp-up-to-peak',
        durationSeconds: 200,
        startTimeSeconds: 0,
        endTimeSeconds: 200,
        startArrivalRate: 25,
        targetArrivalRate: 150
      });
      expect(report.visualisationHook.stages[1]).toEqual({
        stageIndex: 2,
        name: 'extended-steady',
        durationSeconds: 400,
        startTimeSeconds: 200,
        endTimeSeconds: 600,
        startArrivalRate: 150,
        targetArrivalRate: 150
      });
    });

    it('projects stress-style multi-stage stepped schedule faithfully', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const baseTestDef = createAuthoritativeTestDef();

      const stressTestDef: TestDefinition = {
        ...baseTestDef,
        scenarios: [
          {
            ...baseTestDef.scenarios[0],
            workloadSchedule: {
              id: 'sched-stress-stepped',
              executionModel: 'OPEN',
              arrivalPopulation: 'SESSION',
              rateUnit: 'sessions/second',
              startRate: 0,
              totalDurationSeconds: 900,
              peakArrivalRate: 300,
              timeUnit: 'seconds',
              stages: [
                { durationSeconds: 300, targetArrivalRate: 100, description: 'step-1' },
                { durationSeconds: 300, targetArrivalRate: 200, description: 'step-2' },
                { durationSeconds: 300, targetArrivalRate: 300, description: 'step-3' }
              ]
            }
          }
        ]
      };
      (stressTestDef as any).fingerprint = computeTestDefinitionFingerprint(stressTestDef);

      const results = createAuthoritativeResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: stressTestDef, results });
      const findingsRegister = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: stressTestDef });
      const evidencePackage = generatePerformanceEvidencePackage({
        contract,
        testDefinition: stressTestDef,
        results,
        acceptanceEvaluation: evaluation,
        findingsRegister
      });

      const report = generateResultsReport(evidencePackage, stressTestDef, findingsRegister);

      expect(report.visualisationHook.stages).toHaveLength(3);
      expect(report.visualisationHook.stages[0]).toEqual({
        stageIndex: 1,
        name: 'step-1',
        durationSeconds: 300,
        startTimeSeconds: 0,
        endTimeSeconds: 300,
        startArrivalRate: 0,
        targetArrivalRate: 100
      });
      expect(report.visualisationHook.stages[1]).toEqual({
        stageIndex: 2,
        name: 'step-2',
        durationSeconds: 300,
        startTimeSeconds: 300,
        endTimeSeconds: 600,
        startArrivalRate: 100,
        targetArrivalRate: 200
      });
      expect(report.visualisationHook.stages[2]).toEqual({
        stageIndex: 3,
        name: 'step-3',
        durationSeconds: 300,
        startTimeSeconds: 600,
        endTimeSeconds: 900,
        startArrivalRate: 200,
        targetArrivalRate: 300
      });
    });
  });
});
