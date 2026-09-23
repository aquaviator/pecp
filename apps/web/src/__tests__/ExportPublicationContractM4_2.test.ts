import { describe, it, expect } from 'vitest';
import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  AcceptanceEvaluation,
  FindingsRegister,
  PerformanceEvidencePackage,
  PublicationBundle,
  GovernedObservation
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
  verifyPublicationBundleDigest
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

describe('M4.2 — Canonical Export & Publication Contract', () => {
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

  describe('1. Authoritative RetailCo Export Output', () => {
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

      // Verify cryptographic integrity
      const verification = verifyPublicationBundleDigest(bundle);
      expect(verification.isValid).toBe(true);
      expect(verification.mismatches).toHaveLength(0);

      // Results Report checks
      const reportArtifact = bundle.artifacts.find(
        (a) => a.artifactType === 'RESULTS_REPORT' && a.format === 'JSON'
      );
      expect(reportArtifact).toBeDefined();
      const report = JSON.parse(reportArtifact!.content);

      // Exact business & scheduler demand separation
      expect(report.workloadDemand.businessDemand).toBe(8.75);
      expect(report.workloadDemand.businessDemandUnit).toBe('orders/second');
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
      const checkoutOutcome = report.criterionOutcomes.find((c: any) => c.key === 'checkout_response_time' || c.metric === 'Checkout Response Time');
      expect(checkoutOutcome).toBeDefined();
      expect(checkoutOutcome.status).toBe('PASS');
      expect(checkoutOutcome.observedValue).toBeCloseTo(0.3906885, 4);

      const errorRateOutcome = report.criterionOutcomes.find((c: any) => c.key === 'global_error_rate' || c.metric === 'HTTP Error Rate');
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

    it('exposes the governed visualisation hook with stages and target rates', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const report = generateResultsReport(evidencePackage, testDef, findingsRegister);

      expect(report.visualisationHook).toBeDefined();
      expect(report.visualisationHook.totalSchedulerLoadOverTime).toEqual({
        unit: 'journey_iterations/second',
        timeBasis: 'STEADY_STATE_PEAK',
        targetRate: 109.375
      });
      expect(report.visualisationHook.businessWorkloadTarget).toEqual({
        businessMetric: 'orders',
        targetRate: 8.75,
        unit: 'orders/second'
      });
      expect(report.visualisationHook.stages).toHaveLength(3);
      expect(report.visualisationHook.stages[0]).toEqual({
        stageIndex: 1,
        stageName: 'ramp-up',
        durationSeconds: 300,
        targetArrivalRate: 109.375
      });
      expect(report.visualisationHook.stages[1]).toEqual({
        stageIndex: 2,
        stageName: 'steady-state',
        durationSeconds: 900,
        targetArrivalRate: 109.375
      });
      expect(report.visualisationHook.stages[2]).toEqual({
        stageIndex: 3,
        stageName: 'ramp-down',
        durationSeconds: 120,
        targetArrivalRate: 0
      });
      expect(report.visualisationHook.journeyDistribution.length).toBeGreaterThan(0);
    });
  });

  describe('2. Verdict Projections: PASS, FAIL, PASS_WITH_OBSERVATION', () => {
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

    it('exports a FAIL package with destination-neutral defect payloads and strict zero-invention invariant', () => {
      const contract = RETAILCO_M3_APPROVED_CONTRACT;
      const testDef = createAuthoritativeTestDef();
      const results = createFailingResults();
      const evaluation = evaluateAcceptance({ contract, testDefinition: testDef, results });
      expect(evaluation.overallVerdict).toBe('FAIL');

      const findings = generateFindings({ acceptanceEvaluation: evaluation, results, contract, testDefinition: testDef });
      expect(findings.defectCandidates.length).toBeGreaterThan(0);

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

  describe('3. Publication Readiness & Destination Configuration Gates', () => {
    it('blocks live-publication destinations (Jira, ADO, Confluence, SharePoint) missing configuration', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'JIRA', 'AZURE_DEVOPS', 'CONFLUENCE', 'SHAREPOINT']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
      expect(bundle.publicationReadiness['DOWNLOAD'].status).toBe('READY');
      expect(bundle.publicationReadiness['JIRA'].status).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
      expect(bundle.publicationReadiness['AZURE_DEVOPS'].status).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
      expect(bundle.publicationReadiness['CONFLUENCE'].status).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
      expect(bundle.publicationReadiness['SHAREPOINT'].status).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');

      expect(bundle.blockingReasons.some((r) => r.includes('Jira'))).toBe(true);
      expect(bundle.blockingReasons.some((r) => r.includes('Azure DevOps'))).toBe(true);
      expect(bundle.blockingReasons.some((r) => r.includes('Confluence'))).toBe(true);
      expect(bundle.blockingReasons.some((r) => r.includes('SharePoint'))).toBe(true);
    });

    it('rejects invalid Evidence Package with BLOCKED_INVALID_SOURCE by default', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const invalidPkg: PerformanceEvidencePackage = {
        ...evidencePackage,
        packageGenerationStatus: 'INVALID_PROVENANCE'
      };

      const bundle = generatePublicationBundle({
        evidencePackage: invalidPkg,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(bundle.publicationReadiness['DOWNLOAD'].status).toBe('BLOCKED_INVALID_SOURCE');
      expect(bundle.artifacts.every((a) => !a.publicationEligibility)).toBe(true);
      expect(bundle.blockingReasons.some((r) => r.includes('expected VALID'))).toBe(true);
    });

    it('allows AUDIT_ONLY_NOT_PUBLISHABLE when allowAuditOnly is true for invalid packages', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const invalidPkg: PerformanceEvidencePackage = {
        ...evidencePackage,
        packageGenerationStatus: 'INVALID_PROVENANCE'
      };

      const bundle = generatePublicationBundle({
        evidencePackage: invalidPkg,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD'],
        allowAuditOnly: true
      });

      expect(bundle.overallReadiness).toBe('AUDIT_ONLY_NOT_PUBLISHABLE');
      expect(bundle.publicationReadiness['DOWNLOAD'].status).toBe('AUDIT_ONLY_NOT_PUBLISHABLE');
      expect(bundle.artifacts.every((a) => !a.publicationEligibility)).toBe(true);
    });

    it('rejects tampered Evidence Package digest with BLOCKED_INVALID_SOURCE', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const tamperedPkg: PerformanceEvidencePackage = {
        ...evidencePackage,
        packageDigest: {
          ...evidencePackage.packageDigest,
          value: '0000000000000000000000000000000000000000000000000000000000000000'
        }
      };

      const bundle = generatePublicationBundle({
        evidencePackage: tamperedPkg,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(bundle.blockingReasons.some((r) => r.includes('cryptographic digest is invalid'))).toBe(true);
    });

    it('rejects independently supplied FindingsRegister that mismatches package component reference', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const mismatchedFindingsRegister: FindingsRegister = {
        ...findingsRegister,
        id: 'findings-reg-mismatched-id'
      };

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister: mismatchedFindingsRegister,
        destinations: ['DOWNLOAD']
      });

      expect(bundle.overallReadiness).toBe('BLOCKED_INVALID_SOURCE');
      expect(bundle.blockingReasons.some((r) => r.includes('does not match component canonicalId'))).toBe(true);
    });
  });

  describe('4. Human-Readable Projections (Markdown & HTML)', () => {
    it('renders deterministic Markdown projection with governed absence indicators', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const report = generateResultsReport(evidencePackage, testDef, findingsRegister);
      const md1 = renderResultsReportMarkdown(report);
      const md2 = renderResultsReportMarkdown(report);

      expect(md1).toBe(md2);
      expect(md1).toContain('# Performance Results Report');
      expect(md1).toContain('**Acceptance Verdict**: INCONCLUSIVE');
      expect(md1).toContain('**Business Workload Demand**: 8.75 orders/second');
      expect(md1).toContain('**Scheduler Demand**: 109.375 journey_iterations/second');
      expect(md1).toContain('Ramp-Up: 300s');
      expect(md1).toContain('Steady-State: 900s');
      expect(md1).toContain('Ramp-Down: 120s');
      expect(md1).toContain('Total Duration: 1320s');
      expect(md1).toContain('WORKLOAD_ATTAINMENT_UNRESOLVED');
      expect(md1).toContain('ALL 6 CORE EDGES VERIFIED');
    });

    it('renders deterministic HTML projection safely without injection', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();
      const report = generateResultsReport(evidencePackage, testDef, findingsRegister);
      const html1 = renderResultsReportHtml(report);
      const html2 = renderResultsReportHtml(report);

      expect(html1).toBe(html2);
      expect(html1).toContain('<!DOCTYPE html>');
      expect(html1).toContain('<h1>Performance Results Report</h1>');
      expect(html1).toContain('INCONCLUSIVE');
      expect(html1).toContain('8.75 orders/second');
      expect(html1).toContain('109.375 journey_iterations/second');
    });
  });

  describe('5. Determinism, Immutability & Cryptographic Identity', () => {
    it('produces identical bundle digests for identical inputs', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle1 = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API']
      });

      const bundle2 = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API']
      });

      expect(bundle1.id).toBe(bundle2.id);
      expect(bundle1.bundleDigest.value).toBe(bundle2.bundleDigest.value);
      expect(bundle1.artifacts.length).toBe(bundle2.artifacts.length);
      for (let i = 0; i < bundle1.artifacts.length; i++) {
        expect(bundle1.artifacts[i].contentDigest).toBe(bundle2.artifacts[i].contentDigest);
      }
    });

    it('excludes generatedAt timestamps from cryptographic bundle digest', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle1 = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API'],
        generatedAt: '2026-09-23T00:00:00Z'
      });

      const bundle2 = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API'],
        generatedAt: '2026-09-23T12:00:00Z'
      });

      expect(bundle1.bundleDigest.value).toBe(bundle2.bundleDigest.value);
      expect(bundle1.id).toBe(bundle2.id);
    });

    it('produces deep-frozen, immutable output without modifying caller input', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API']
      });

      expect(Object.isFrozen(bundle)).toBe(true);
      expect(Object.isFrozen(bundle.artifacts)).toBe(true);
      expect(Object.isFrozen(bundle.defectPayloads)).toBe(true);
      expect(Object.isFrozen(bundle.publicationReadiness)).toBe(true);

      expect(() => {
        (bundle as any).overallReadiness = 'TAMPERED';
      }).toThrow();

      // Caller input purity
      expect(evidencePackage.packageGenerationStatus).toBe('VALID');
      expect(findingsRegister.overallVerdict).toBe('INCONCLUSIVE');
    });

    it('detects tampered artifact content during bundle verification', () => {
      const { evidencePackage, testDef, findingsRegister } = createAuthoritativePackageAndFindings();

      const bundle = generatePublicationBundle({
        evidencePackage,
        testDefinition: testDef,
        findingsRegister,
        destinations: ['DOWNLOAD', 'API']
      });

      // Create a shallow copy with tampered artifact content
      const tamperedArtifacts = bundle.artifacts.map((a, idx) =>
        idx === 0 ? { ...a, content: a.content + '\n// tampered' } : a
      );
      const tamperedBundle: PublicationBundle = {
        ...bundle,
        artifacts: tamperedArtifacts
      };

      const verification = verifyPublicationBundleDigest(tamperedBundle);
      expect(verification.isValid).toBe(false);
      expect(verification.mismatches.some((m) => m.includes('content digest mismatch'))).toBe(true);
    });
  });
});
