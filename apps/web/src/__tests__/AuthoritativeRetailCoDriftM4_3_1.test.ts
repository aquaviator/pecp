// M4.3.1: Automated Authority-Drift Test for Authoritative RetailCo Reference Fixture
// Defined according to docs/work-packages/M4_3_1_PORTAL_ZERO_INVENTION_CANONICAL_PROJECTION_REFERENCE_FIDELITY_GATE.md §9
// Guards against drift between browser-safe snapshot and canonical deterministic engine chain.

import { describe, it, expect } from 'vitest';
import {
  compileTestDefinition,
  ingestGovernedExecutionEvidence,
  evaluateAcceptance,
  generateFindings,
  generatePerformanceEvidencePackage,
  generateResultsReport,
  generatePublicationBundle,
  computeTestDefinitionFingerprint,
  computeContractFingerprint
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

import {
  AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE,
  AUTHORITATIVE_RETAILCO_CONTRACT,
  AUTHORITATIVE_RETAILCO_TEST_DEFINITION,
  AUTHORITATIVE_RETAILCO_EXECUTION_RESULT,
  AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION,
  AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER,
  AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE,
  AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE,
  AUTHORITATIVE_RETAILCO_RESULTS_REPORT
} from '../fixtures/retailco/authoritativeRetailCoExecutionEvidence';

describe('M4.3.1 Section 9: RetailCo Browser Snapshot Authority Drift Gate', () => {
  // Rebuild the authoritative RetailCo chain directly from canonical engines and canonical inputs
  const canonicalContract = RETAILCO_M3_APPROVED_CONTRACT;

  const canonicalTestDef = compileTestDefinition({
    contract: canonicalContract,
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    testDefinitionId: 'test-def-proj-retailco-bf2026-v1.0',
    version: 'v1.0',
    executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
  });

  const canonicalResults = ingestGovernedExecutionEvidence({
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

  const canonicalEvaluation = evaluateAcceptance({
    contract: canonicalContract,
    testDefinition: canonicalTestDef,
    results: canonicalResults
  });

  const canonicalFindings = generateFindings({
    acceptanceEvaluation: canonicalEvaluation,
    results: canonicalResults,
    contract: canonicalContract,
    testDefinition: canonicalTestDef
  });

  const canonicalEvidencePackage = generatePerformanceEvidencePackage({
    contract: canonicalContract,
    testDefinition: canonicalTestDef,
    results: canonicalResults,
    acceptanceEvaluation: canonicalEvaluation,
    findingsRegister: canonicalFindings
  });

  const canonicalResultsReport = generateResultsReport(
    canonicalEvidencePackage,
    canonicalTestDef,
    canonicalFindings
  );

  const canonicalPublicationBundle = generatePublicationBundle({
    evidencePackage: canonicalEvidencePackage,
    testDefinition: canonicalTestDef,
    findingsRegister: canonicalFindings,
    destinations: ['DOWNLOAD', 'API']
  });

  it('1. Contract Identity & Drift Fingerprint match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_CONTRACT.id).toBe(canonicalContract.id);
    expect(AUTHORITATIVE_RETAILCO_CONTRACT.version).toBe(canonicalContract.version);
    expect(AUTHORITATIVE_RETAILCO_CONTRACT.status).toBe('APPROVED');
    expect(AUTHORITATIVE_RETAILCO_CONTRACT.status).toBe(canonicalContract.status);

    const snapshotContractComp = AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.components.find(
      (c) => c.componentType === 'PERFORMANCE_CONTRACT'
    );
    const canonicalContractComp = canonicalEvidencePackage.components.find(
      (c) => c.componentType === 'PERFORMANCE_CONTRACT'
    );
    expect(snapshotContractComp?.fingerprint).toBe(canonicalContractComp?.fingerprint);
    expect(snapshotContractComp?.fingerprint).toBe('fp-0dad9ae4');
  });

  it('2. Test Definition Identity & Deterministic Fingerprint match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_TEST_DEFINITION.id).toBe(canonicalTestDef.id);
    expect(AUTHORITATIVE_RETAILCO_TEST_DEFINITION.version).toBe(canonicalTestDef.version);
    expect(AUTHORITATIVE_RETAILCO_TEST_DEFINITION.fingerprint).toBe(canonicalTestDef.fingerprint);

    const snapshotTestDefFp = computeTestDefinitionFingerprint(AUTHORITATIVE_RETAILCO_TEST_DEFINITION);
    expect(snapshotTestDefFp).toBe(canonicalTestDef.fingerprint);
  });

  it('3. Execution Run & Ingested Telemetry match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.run.executionRunId).toBe(
      canonicalResults.run.executionRunId
    );
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.run.executionRunId).toBe(
      'pecp-ref-canonical-1789978991064'
    );
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.run.operationalStatus).toBe('EXECUTION_COMPLETED');
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.run.operationalStatus).toBe(
      canonicalResults.run.operationalStatus
    );

    // Iterations and business event counts
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.metrics.iterations.count).toBe(120981);
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.metrics.iterations.count).toBe(
      canonicalResults.metrics.iterations.count
    );
    expect(
      AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.metrics.pecpBusinessAttainmentEvents.count
    ).toBe(9671);
    expect(
      AUTHORITATIVE_RETAILCO_EXECUTION_RESULT.metrics.pecpBusinessAttainmentEvents.count
    ).toBe(canonicalResults.metrics.pecpBusinessAttainmentEvents.count);
  });

  it('4. Acceptance Digest, Verdict & Workload Prerequisite match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.id).toBe(canonicalEvaluation.id);
    expect(AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.evaluationDigest.value).toBe(
      canonicalEvaluation.evaluationDigest.value
    );
    expect(AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.overallVerdict).toBe('INCONCLUSIVE');
    expect(AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.overallVerdict).toBe(
      canonicalEvaluation.overallVerdict
    );
    expect(AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.workloadPrerequisite.status).toBe(
      'UNRESOLVED'
    );
    expect(AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.workloadPrerequisite.status).toBe(
      canonicalEvaluation.workloadPrerequisite.status
    );
    expect(
      AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.workloadPrerequisite.derivationStatus
    ).toBe('UNRESOLVED_INSUFFICIENT_TIME_SERIES');
    expect(
      AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION.workloadPrerequisite.derivationStatus
    ).toBe(canonicalEvaluation.workloadPrerequisite.derivationStatus);
  });

  it('5. Findings Register Digest, Counts & Defect Invariant match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.id).toBe(canonicalFindings.id);
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.registerDigest.value).toBe(
      canonicalFindings.registerDigest.value
    );
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.findings).toHaveLength(1);
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.findings[0].findingType).toBe(
      'WORKLOAD_ATTAINMENT_UNRESOLVED'
    );
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.defectCandidates).toHaveLength(0);
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.findings.length).toBe(
      canonicalFindings.findings.length
    );
    expect(AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER.defectCandidates.length).toBe(
      canonicalFindings.defectCandidates.length
    );
  });

  it('6. Evidence Package Id, Digest, Status & Lineage Edges match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.id).toBe(canonicalEvidencePackage.id);
    expect(AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.packageDigest.value).toBe(
      canonicalEvidencePackage.packageDigest.value
    );
    expect(AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.packageGenerationStatus).toBe('VALID');
    expect(AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.packageGenerationStatus).toBe(
      canonicalEvidencePackage.packageGenerationStatus
    );

    // Lineage edges
    expect(AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.lineage.edges).toHaveLength(6);
    expect(AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.lineage.edges.length).toBe(
      canonicalEvidencePackage.lineage.edges.length
    );
    AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE.lineage.edges.forEach((edge, idx) => {
      const canonicalEdge = canonicalEvidencePackage.lineage.edges[idx];
      expect(edge.fromComponent).toBe(canonicalEdge.fromComponent);
      expect(edge.toComponent).toBe(canonicalEdge.toComponent);
      expect(edge.bindingType).toBe(canonicalEdge.bindingType);
      expect(edge.verified).toBe(true);
      expect(edge.verified).toBe(canonicalEdge.verified);
    });
  });

  it('7. Publication Bundle Id, Digest & Destination Readiness match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.id).toBe(canonicalPublicationBundle.id);
    expect(AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.bundleDigest.value).toBe(
      canonicalPublicationBundle.bundleDigest.value
    );
    expect(AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.overallReadiness).toBe('READY');
    expect(AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.overallReadiness).toBe(
      canonicalPublicationBundle.overallReadiness
    );

    // Destination readiness
    expect(
      AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.publicationReadiness.DOWNLOAD.status
    ).toBe('READY');
    expect(
      AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.publicationReadiness.API.status
    ).toBe('READY');
    expect(
      AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.publicationReadiness.CONFLUENCE.status
    ).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
    expect(
      AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.publicationReadiness.SHAREPOINT.status
    ).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
    expect(
      AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.publicationReadiness.JIRA.status
    ).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
    expect(
      AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE.publicationReadiness.AZURE_DEVOPS.status
    ).toBe('BLOCKED_MISSING_DESTINATION_CONFIGURATION');
  });

  it('8. Results Report Id, Digest & Workload Schedule/Values match canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.id).toBe(canonicalResultsReport.id);
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.reportDigest).toBe(
      canonicalResultsReport.reportDigest
    );

    // Exact workload values: business demand 8.75 orders/s, scheduler peak 109.375 journey_iterations/s
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.workloadDemand.businessDemand).toBe(8.75);
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.workloadDemand.businessDemandUnit).toBe(
      'orders/second'
    );
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.workloadDemand.schedulerDemand).toBe(109.375);
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.workloadDemand.schedulerDemandUnit).toBe(
      'journey_iterations/second'
    );
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.workloadDemand.schedulerPopulation).toBe(
      'JOURNEY_ITERATION'
    );
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.workloadDemand.executionModel).toBe('OPEN');

    // Exact stage timings: 300 / 900 / 120 / 1320
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.scheduleTimings.rampUpSeconds).toBe(300);
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.scheduleTimings.steadyStateSeconds).toBe(900);
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.scheduleTimings.rampDownSeconds).toBe(120);
    expect(AUTHORITATIVE_RETAILCO_RESULTS_REPORT.scheduleTimings.totalDurationSeconds).toBe(1320);

    // Exact journey distribution: Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%
    const journeys =
      AUTHORITATIVE_RETAILCO_RESULTS_REPORT.visualisationHook.journeyDistribution;
    expect(journeys.find((j) => j.journeyKey === 'browse')?.percentage).toBe(55);
    expect(journeys.find((j) => j.journeyKey === 'search')?.percentage).toBe(20);
    expect(journeys.find((j) => j.journeyKey === 'basket')?.percentage).toBe(15);
    expect(journeys.find((j) => j.journeyKey === 'checkout')?.percentage).toBe(8);
    expect(journeys.find((j) => j.journeyKey === 'account')?.percentage).toBe(2);

    // Criteria outcomes: Checkout latency p95 0.3906885 ms PASS, HTTP error rate 0 PASS
    const checkout = AUTHORITATIVE_RETAILCO_RESULTS_REPORT.criterionOutcomes.find(
      (c) => c.key === 'checkout_response_time'
    );
    expect(checkout?.status).toBe('PASS');
    expect(checkout?.observedValue).toBeCloseTo(0.3906885, 4);

    const errorRate = AUTHORITATIVE_RETAILCO_RESULTS_REPORT.criterionOutcomes.find(
      (c) => c.key === 'global_error_rate'
    );
    expect(errorRate?.status).toBe('PASS');
    expect(errorRate?.observedValue).toBe(0);
  });

  it('9. Execution Evidence State wrapper bundle matches canonical', () => {
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE.projectId).toBe('proj-retailco-bf2026');
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE.hasExecuted).toBe(true);
    expect(AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE.rawArtifactSummary.artifactId).toBe(
      '10629771462'
    );
  });
});
