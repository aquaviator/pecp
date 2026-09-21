import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  ingestGovernedExecutionEvidence,
  ingestGovernedExecutionDirectory,
  parseK6SummaryJson
} from '@pecp/test-engine';
import {
  INVARIANT_PERFORMANCE_VERDICT,
  INVARIANT_VERDICT_DISCLAIMER
} from '@pecp/pe-domain';
import {
  AUTHORITATIVE_M3_1B_FACTS,
  AUTHORITATIVE_M3_1B_MANIFEST,
  AUTHORITATIVE_M3_1B_SUMMARY_JSON,
  AUTHORITATIVE_M3_1B_ARTIFACT_REFERENCE,
  MOCK_CONFIG_CONTENT,
  MOCK_JOURNEYS_CONTENT,
  MOCK_ENTRYPOINT_CONTENT,
  MOCK_RUNTIME_CONTENT,
  MOCK_STDOUT_CONTENT,
  MOCK_STDERR_CONTENT,
  MOCK_SUMMARY_CONTENT,
  computeSha256
} from '../fixtures/retailco/m31bAuthoritativeRunFixture';

describe('M3.2 — Canonical Results Model & Raw Evidence Ingestion', () => {
  // Base input representing the complete authoritative M3.1B reference execution
  const createAuthoritativeEvidenceInput = () => ({
    manifest: JSON.parse(JSON.stringify(AUTHORITATIVE_M3_1B_MANIFEST)),
    summaryJson: JSON.parse(JSON.stringify(AUTHORITATIVE_M3_1B_SUMMARY_JSON)),
    stdoutLog: MOCK_STDOUT_CONTENT,
    stderrLog: MOCK_STDERR_CONTENT,
    configJson: MOCK_CONFIG_CONTENT,
    journeysJs: MOCK_JOURNEYS_CONTENT,
    entrypointJs: MOCK_ENTRYPOINT_CONTENT,
    runtimeJs: MOCK_RUNTIME_CONTENT,
    executionArtifact: AUTHORITATIVE_M3_1B_ARTIFACT_REFERENCE
  });

  describe('1. Authoritative M3.1B Canonical Reference Run Ingestion (§9)', () => {
    it('ingests the authoritative M3.1B reference execution with 100% fidelity to invariant facts', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Verify ExecutionRun identity
      expect(result.run.executionRunId).toBe(AUTHORITATIVE_M3_1B_FACTS.runId);
      expect(result.run.workflowRunId).toBe(AUTHORITATIVE_M3_1B_FACTS.workflowRunId);
      expect(result.run.repositoryCommitSha).toBe(AUTHORITATIVE_M3_1B_FACTS.repositoryCommitSha);
      expect(result.run.commitSha).toBe(AUTHORITATIVE_M3_1B_FACTS.repositoryCommitSha);
      expect(result.run.engine.name).toBe('k6');
      expect(result.run.engine.version).toBe(AUTHORITATIVE_M3_1B_FACTS.k6Version);
      expect(result.run.engineExitCode).toBe(0);
      expect(result.run.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(result.run.timestamps.durationSeconds).toBe(AUTHORITATIVE_M3_1B_FACTS.durationSeconds);

      // Verify artifact identity
      expect(result.run.executionArtifact).toBeDefined();
      expect(result.run.executionArtifact?.id).toBe(AUTHORITATIVE_M3_1B_FACTS.artifactId);
      expect(result.run.executionArtifact?.digest).toBe(AUTHORITATIVE_M3_1B_FACTS.artifactDigest);

      // Verify metrics
      expect(result.metrics.iterations?.count).toBe(AUTHORITATIVE_M3_1B_FACTS.iterations);
      expect(result.metrics.droppedIterations?.count).toBe(AUTHORITATIVE_M3_1B_FACTS.droppedIterations);
      expect(result.metrics.pecpBusinessAttainmentEvents?.count).toBe(AUTHORITATIVE_M3_1B_FACTS.businessEvents);

      // Verify Reference Lab corroboration
      expect(result.referenceLabCorroboration).toBeDefined();
      expect(result.referenceLabCorroboration?.businessEventCounts.orderCreatedEvents).toBe(
        AUTHORITATIVE_M3_1B_FACTS.referenceLabOrderCreated
      );
      expect(result.referenceLabCorroboration?.consistency.countsMatch).toBe(true);
      expect(result.referenceLabCorroboration?.consistency.discrepancyCount).toBe(0);

      // Verify strict verdict boundary
      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
      expect(result.verdictDisclaimer).toBe(INVARIANT_VERDICT_DISCLAIMER);
      expect((result as any).verdict).toBeUndefined();
      expect((result as any).status).not.toBe('PASS');
      expect((result as any).status).not.toBe('FAIL');
      expect((result as any).status).not.toBe('PASS_WITH_OBSERVATION');
      expect((result as any).status).not.toBe('INCONCLUSIVE');

      // Data quality
      expect(result.dataQuality.isComplete).toBe(true);
      expect(result.dataQuality.hasIntegrityErrors).toBe(false);
      expect(result.dataQuality.issues).toHaveLength(0);
    });
  });

  describe('2. Canonical Model and Provenance Preservation (§1, §10)', () => {
    it('preserves complete contract, test definition, bundle, and runtime lineage without invention', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Source Contract provenance
      expect(result.run.sourceContract.id).toBe('contract-proj-retailco-bf26-v1.0-approved');
      expect(result.run.sourceContract.version).toBe('v1.0');
      expect(result.run.sourceContract.fingerprint).toBe('fp-0dad9ae4');
      expect(result.run.sourceContract.status).toBe('APPROVED');

      // Test Definition provenance
      expect(result.run.testDefinition.id).toBe('test-def-proj-retailco-bf2026-v1.0');
      expect(result.run.testDefinition.version).toBe('v1.0');
      expect(result.run.testDefinition.fingerprint).toBe('fp-6911db94');

      // Bundle & Runtime
      expect(result.run.bundleFingerprint).toBe('fp-256b6329');
      expect(result.run.runtime.version).toBe('1.0.0');
      expect(result.run.runtime.sourceId).toBe('pecp-stable-k6-runtime-v1.0.0');

      // Preflight
      expect(result.run.preflightStatus.isValid).toBe(true);
      expect(result.run.preflightStatus.status).toBe('READY_FOR_LIVE_EXECUTION');
      expect(result.run.preflightStatus.blockingReasons).toEqual([]);
    });

    it('flags MISSING_REQUIRED_BINDING when critical provenance bindings are omitted', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input.manifest as any).pecpBinding.sourceContractFingerprint;
      delete (input.manifest as any).pecpBinding.bundleFingerprint;

      const result = ingestGovernedExecutionEvidence(input);
      const bindingIssue = result.dataQuality.issues.find((i) => i.code === 'MISSING_REQUIRED_BINDING');
      expect(bindingIssue).toBeDefined();
      expect(result.dataQuality.hasIntegrityErrors).toBe(true);
    });
  });

  describe('3. Raw Evidence Inventory and Integrity (§2, §7)', () => {
    it('verifies checksums across all 8 evidence files and marks them PRESENT and verified', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const inventory = result.evidenceInventory;
      expect(inventory.allReferences).toHaveLength(8);

      const fileKeys = [
        'manifest',
        'summaryJson',
        'stdoutLog',
        'stderrLog',
        'configJson',
        'journeysJs',
        'entrypointJs',
        'runtimeJs'
      ] as const;

      for (const key of fileKeys) {
        const ref = inventory[key];
        expect(ref).toBeDefined();
        expect(ref?.presenceStatus).toBe('PRESENT');
        expect(ref?.checksumVerified).toBe(true);
        expect(ref?.checksum).toBeTruthy();
        expect(ref?.sizeBytes).toBeGreaterThanOrEqual(0);
      }
    });

    it('detects CHECKSUM_MISMATCH when raw file content differs from expected manifest checksum', () => {
      const input = createAuthoritativeEvidenceInput();
      // Corrupt stdout content
      input.stdoutLog = 'CORRUPTED_STDOUT_BYTES';

      const result = ingestGovernedExecutionEvidence(input);
      const mismatch = result.dataQuality.issues.find((i) => i.code === 'CHECKSUM_MISMATCH');
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe('ERROR');
      expect(mismatch?.details?.filename).toBe('k6-stdout.log');
      expect(result.evidenceInventory.stdoutLog?.checksumVerified).toBe(false);
      expect(result.dataQuality.hasIntegrityErrors).toBe(true);
    });

    it('marks missing artifacts as ABSENT without crashing and records data quality issues', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input as any).summaryJson;
      delete (input as any).configJson;

      const result = ingestGovernedExecutionEvidence(input);
      expect(result.evidenceInventory.summaryJson?.presenceStatus).toBe('ABSENT');
      expect(result.evidenceInventory.configJson?.presenceStatus).toBe('ABSENT');

      const missingSummaryIssue = result.dataQuality.issues.find((i) => i.code === 'MISSING_SUMMARY');
      expect(missingSummaryIssue).toBeDefined();
    });
  });

  describe('4. Security and Credential Redaction (§2)', () => {
    it('verifies that manifest credentials are masked with ***REDACTED_EPHEMERAL***', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const leakIssue = result.dataQuality.issues.find((i) => i.code === 'CREDENTIAL_LEAKAGE_DETECTED');
      expect(leakIssue).toBeUndefined();
    });

    it('detects and flags CREDENTIAL_LEAKAGE_DETECTED if cleartext token is leaked in manifest', () => {
      const input = createAuthoritativeEvidenceInput();
      (input.manifest as any).credentials[0].maskedValue = 'retailco_live_run_1789978991064_deadbeef0123456789abcdef';

      const result = ingestGovernedExecutionEvidence(input);
      const leakIssue = result.dataQuality.issues.find((i) => i.code === 'CREDENTIAL_LEAKAGE_DETECTED');
      expect(leakIssue).toBeDefined();
      expect(leakIssue?.severity).toBe('FATAL');
    });

    it('detects and flags CREDENTIAL_LEAKAGE_DETECTED if cleartext token is leaked in log files', () => {
      const input = createAuthoritativeEvidenceInput();
      input.stdoutLog = 'Authorization: Bearer retailco_live_run_1789978991064_deadbeef0123456789abcdef leaked!';

      const result = ingestGovernedExecutionEvidence(input);
      const leakIssue = result.dataQuality.issues.find((i) => i.code === 'CREDENTIAL_LEAKAGE_DETECTED');
      expect(leakIssue).toBeDefined();
      expect(leakIssue?.severity).toBe('FATAL');
    });
  });

  describe('5. k6 Summary Parsing and Threshold Observations (§3, §6)', () => {
    it('parses k6 duration distributions, counters, rates, and checks deterministically', () => {
      const parsed = parseK6SummaryJson(AUTHORITATIVE_M3_1B_SUMMARY_JSON);

      // Duration trends
      expect(parsed.metrics.httpReqDuration?.avg).toBe(0.75);
      expect(parsed.metrics.httpReqDuration?.p95).toBe(1.11);
      expect(parsed.metrics.httpReqDuration?.p99).toBe(1.61);

      expect(parsed.metrics.httpReqDurationCheckout?.p95).toBe(1.55);
      expect(parsed.metrics.pecpJourneyDurationMs?.p95).toBe(4002);

      // Rates and counters
      expect(parsed.metrics.httpReqFailed?.passes).toBe(0);
      expect(parsed.metrics.httpReqFailed?.rate).toBe(0);
      expect(parsed.metrics.checks?.rate).toBe(1.0);
      expect(parsed.metrics.rootChecks[0].name).toBe('status 200 or 201');
      expect(parsed.metrics.rootChecks[0].passes).toBe(120981);
    });

    it('treats k6 thresholds strictly as engine observations without converting to PECP PASS/FAIL', () => {
      const parsed = parseK6SummaryJson(AUTHORITATIVE_M3_1B_SUMMARY_JSON);

      expect(parsed.thresholdObservations).toHaveLength(2);

      const rateThresh = parsed.thresholdObservations.find((t) => t.expression === 'rate<0.005');
      expect(rateThresh).toBeDefined();
      expect(rateThresh?.status).toBe('OBSERVED_PASSED');
      expect(rateThresh?.engineResult).toBe(true);
      expect(rateThresh?.metric).toBe('http_req_failed');

      const checkoutThresh = parsed.thresholdObservations.find((t) => t.expression === 'p(95)<2000');
      expect(checkoutThresh).toBeDefined();
      expect(checkoutThresh?.status).toBe('OBSERVED_PASSED');
      expect(checkoutThresh?.engineResult).toBe(true);
      expect(checkoutThresh?.metric).toBe('http_req_duration{journey:checkout}');
      expect(checkoutThresh?.observedValue).toBe(1.55);
    });

    it('records OBSERVED_FAILED for failing engine thresholds without triggering a PECP verdict', () => {
      const customSummary = JSON.parse(JSON.stringify(AUTHORITATIVE_M3_1B_SUMMARY_JSON));
      customSummary.metrics.http_req_failed.thresholds['rate<0.005'].ok = false;

      const parsed = parseK6SummaryJson(customSummary);
      const thresh = parsed.thresholdObservations.find((t) => t.expression === 'rate<0.005');
      expect(thresh?.status).toBe('OBSERVED_FAILED');
      expect(thresh?.engineResult).toBe(false);

      // Ingest with this custom summary
      const input = createAuthoritativeEvidenceInput();
      input.summaryJson = customSummary;
      const result = ingestGovernedExecutionEvidence(input);

      // Crucial: Threshold failure is preserved as engine observation, NOT translated to PECP FAIL!
      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
      expect(result.thresholdObservations.find((t) => t.expression === 'rate<0.005')?.status).toBe('OBSERVED_FAILED');
    });

    it('leaves pecpWorkloadAttainmentRate explicitly undefined when absent from summary rather than inventing 0', () => {
      const parsed = parseK6SummaryJson(AUTHORITATIVE_M3_1B_SUMMARY_JSON);
      expect(parsed.metrics.pecpWorkloadAttainmentRate).toBeUndefined();
    });
  });

  describe('6. Semantic Separation of Scheduler vs Business Events (§4)', () => {
    it('preserves distinct structures for scheduler iterations and business events', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Scheduler observation (JOURNEY_ITERATION population)
      const scheduler = result.schedulerObservation;
      expect(scheduler.schedulerPopulation).toBe('JOURNEY_ITERATION');
      expect(scheduler.governedPeakRate).toBe(109.375);
      expect(scheduler.actualIterations).toBe(120981);
      expect(scheduler.observedIterationRate).toBe(91.5892);
      expect(scheduler.droppedIterations).toBe(8);
      expect(scheduler.arrivalDemandCounter).toBe(120981);

      // Business events observation (orders metric)
      const business = result.businessEventsObservation;
      expect(business.governedMetric).toBe('orders');
      expect(business.governedTarget.value).toBe(8.75);
      expect(business.governedTarget.unit).toBe('orders/second');
      expect(business.observedEventCount).toBe(9671);
      expect(business.observedRawRate).toBe(7.3215);
      expect(business.referenceLabCorroboratingEventCount).toBe(9671);

      // Conflation check
      expect(scheduler.actualIterations).not.toBe(business.observedEventCount);
      expect(scheduler.governedPeakRate).not.toBe(business.governedTarget.value);
    });
  });

  describe('7. Reference Lab Corroboration & Consistency Checking (§5)', () => {
    it('corroborates k6 business attainment against Reference Lab order_created counter', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const lab = result.referenceLabCorroboration;
      expect(lab).toBeDefined();
      expect(lab?.totalRequestsDelta).toBe(120982);
      expect(lab?.businessEventCounts.orderCreatedEvents).toBe(9671);
      expect(lab?.consistency.k6BusinessEventCount).toBe(9671);
      expect(lab?.consistency.referenceLabOrderCreatedCount).toBe(9671);
      expect(lab?.consistency.countsMatch).toBe(true);
      expect(lab?.consistency.discrepancyCount).toBe(0);

      // Route delta check
      expect(lab?.requestsByRoute['/api/v1/orders/checkout']).toBe(9671);
      expect(lab?.requestsByRoute['/api/v1/products/featured']).toBe(66713);
      expect(lab?.requestsByRoute['/api/v1/products/search']).toBe(24003);
    });

    it('detects BUSINESS_EVENT_COUNT_MISMATCH without evaluating a performance verdict', () => {
      const input = createAuthoritativeEvidenceInput();
      // Introduce a mismatch in Reference Lab order count
      (input.manifest as any).referenceLabMetrics.delta.orderCreatedEvents = 9600;

      const result = ingestGovernedExecutionEvidence(input);

      expect(result.referenceLabCorroboration?.consistency.countsMatch).toBe(false);
      expect(result.referenceLabCorroboration?.consistency.discrepancyCount).toBe(71);

      const mismatchIssue = result.dataQuality.issues.find((i) => i.code === 'BUSINESS_EVENT_COUNT_MISMATCH');
      expect(mismatchIssue).toBeDefined();
      expect(mismatchIssue?.severity).toBe('ERROR');
      expect(result.dataQuality.hasIntegrityErrors).toBe(true);

      // Invariant: Discrepancy is a data quality issue, NOT a PECP FAIL!
      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
    });
  });

  describe('8. Workload Attainment Lineage and Mathematical Basis (§8)', () => {
    it('records complete lineage for whole-test average rate and documents steady-state distinction', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const attainment = result.workloadAttainmentObservation;
      expect(attainment.governedDemand.metric).toBe('orders');
      expect(attainment.governedDemand.targetValue).toBe(8.75);
      expect(attainment.actualSourceMetric).toBe('pecp_business_attainment_events');
      expect(attainment.calculationFormula).toBe('total_observed_events / total_test_duration_seconds');
      expect(attainment.timeBasis).toBe('FULL_TEST_AVERAGE');
      expect(attainment.resultValue).toBe(7.3215);
      expect(attainment.attainmentRatio).toBe(Number((7.3215 / 8.75).toFixed(4))); // ~0.8367
      expect(attainment.derivationStatus).toBe('DETERMINISTICALLY_DERIVED');
      expect(attainment.derivationNotes).toContain('Whole-test average rate');
      expect(attainment.derivationNotes).toContain('mathematically distinct from steady-state peak attainment');

      // Invariant: Verdict remains NOT_EVALUATED
      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
    });
  });

  describe('9. Ingestion of Real Repository Evidence Artifacts', () => {
    const resolveEvidenceDir = (subdir: string): string => {
      const candidates = [
        path.resolve(process.cwd(), 'evidence/m3-1b', subdir),
        path.resolve(process.cwd(), '../../evidence/m3-1b', subdir),
        path.resolve(process.cwd(), '../evidence/m3-1b', subdir)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      return path.resolve(process.cwd(), 'evidence/m3-1b', subdir);
    };

    it('ingests evidence from evidence/m3-1b/canonical directory', () => {
      const canonicalDir = resolveEvidenceDir('canonical');
      const result = ingestGovernedExecutionDirectory(canonicalDir);

      expect(result.run.executionMode).toBe('CANONICAL');
      expect(result.run.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(result.run.engine.version).toBe('0.54.0');
      expect(result.metrics.iterations?.count).toBe(120982);
      expect(result.metrics.droppedIterations?.count).toBe(7);
      expect(result.metrics.pecpBusinessAttainmentEvents?.count).toBe(9761);
      expect(result.referenceLabCorroboration?.businessEventCounts.orderCreatedEvents).toBe(9761);
      expect(result.referenceLabCorroboration?.consistency.countsMatch).toBe(true);

      // Notice: In the repo, uncommitted materialized source files are marked ABSENT
      expect(result.evidenceInventory.manifest?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.summaryJson?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.stdoutLog?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.configJson?.presenceStatus).toBe('ABSENT');

      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
    });

    it('ingests evidence from evidence/m3-1b/smoke_diagnostic directory with all 8 files on disk', () => {
      const smokeDir = resolveEvidenceDir('smoke_diagnostic');
      const result = ingestGovernedExecutionDirectory(smokeDir);

      expect(result.run.executionMode).toBe('SMOKE_DIAGNOSTIC');
      expect(result.run.operationalStatus).toBe('EXECUTION_COMPLETED');

      // In smoke_diagnostic, all 8 files are present on disk
      expect(result.evidenceInventory.manifest?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.summaryJson?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.stdoutLog?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.stderrLog?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.configJson?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.journeysJs?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.entrypointJs?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.runtimeJs?.presenceStatus).toBe('PRESENT');

      // Checksums verified
      expect(result.evidenceInventory.manifest?.checksumVerified).toBe(true);
      expect(result.evidenceInventory.summaryJson?.checksumVerified).toBe(true);
      expect(result.evidenceInventory.stdoutLog?.checksumVerified).toBe(true);

      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
    });
  });

  describe('10. Explicit Non-Goals Verification (§12)', () => {
    it('never produces PASS, FAIL, PASS_WITH_OBSERVATION, or INCONCLUSIVE', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Strict negative assertions
      expect((result as any).verdict).toBeUndefined();
      expect((result as any).acceptanceVerdict).toBeUndefined();
      expect((result as any).releaseCertification).toBeUndefined();
      expect((result as any).findings).toBeUndefined();
      expect((result as any).evidencePackage).toBeUndefined();

      expect(result.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
      expect(result.performanceVerdict).not.toBe('PASS');
      expect(result.performanceVerdict).not.toBe('FAIL');
      expect(result.performanceVerdict).not.toBe('PASS_WITH_OBSERVATION');
      expect(result.performanceVerdict).not.toBe('INCONCLUSIVE');
    });
  });
});
