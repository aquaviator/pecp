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
  AUTHORITATIVE_CONFIG_RAW,
  AUTHORITATIVE_JOURNEYS_RAW,
  AUTHORITATIVE_ENTRYPOINT_RAW,
  AUTHORITATIVE_RUNTIME_RAW,
  AUTHORITATIVE_STDOUT_RAW,
  AUTHORITATIVE_STDERR_RAW,
  AUTHORITATIVE_SUMMARY_RAW,
  AUTHORITATIVE_MANIFEST_RAW,
  computeSha256
} from '../fixtures/retailco/m31bAuthoritativeRunFixture';

describe('M3.2 — Canonical Results Model & Raw Evidence Ingestion', () => {
  // Base input representing the complete authoritative M3.1B reference execution
  const createAuthoritativeEvidenceInput = () => ({
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

  describe('1. Authoritative M3.1B Canonical Reference Run Ingestion (§9, §10)', () => {
    it('ingests the authoritative M3.1B reference execution with 100% fidelity to invariant facts', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Verify ExecutionRun identity
      expect(result.run.executionRunId).toBe('pecp-ref-canonical-1789978991064');
      expect(result.run.workflowRunId).toBe('35577599469');
      expect(result.run.repositoryCommitSha).toBe('76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82');
      expect(result.run.commitSha).toBe('76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82');
      expect(result.run.engine.name).toBe('k6');
      expect(result.run.engine.version).toBe('0.54.0');
      expect(result.run.engineExitCode).toBe(0);
      expect(result.run.operationalStatus).toBe('EXECUTION_COMPLETED');
      expect(result.run.timestamps.durationSeconds).toBe(1321.161);

      // Verify artifact identity
      expect(result.run.executionArtifact).toBeDefined();
      expect(result.run.executionArtifact?.id).toBe('10629771462');
      expect(result.run.executionArtifact?.digest).toBe('0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91');

      // Verify metrics from authoritative summary.json
      expect(result.metrics.iterations?.count).toBe(120981);
      expect(result.metrics.droppedIterations?.count).toBe(8);
      expect(result.metrics.pecpBusinessAttainmentEvents?.count).toBe(9671);

      // Verify Reference Lab corroboration
      expect(result.referenceLabCorroboration).toBeDefined();
      expect(result.referenceLabCorroboration?.sourceLocator).toBe('execution-manifest.json#/referenceLabMetrics');
      expect(result.referenceLabCorroboration?.businessEventCounts.orderCreatedEvents).toBe(9671);
      expect(result.referenceLabCorroboration?.totalRequestsDelta).toBe(120982);
      expect(result.referenceLabCorroboration?.consistency.countsMatch).toBe(true);
      expect(result.referenceLabCorroboration?.consistency.discrepancyCount).toBe(0);

      // Verify strict verdict boundary: NO PECP PASS/FAIL assigned!
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

    it('flags MISSING_REQUIRED_BINDING when engine identity is omitted rather than assuming k6', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input.manifest as any).engine;

      const result = ingestGovernedExecutionEvidence(input);
      expect(result.run.engine.name).toBe('UNKNOWN_ENGINE');
      const engineIssue = result.dataQuality.issues.find(
        (i) => i.code === 'MISSING_REQUIRED_BINDING' && i.message.includes('Engine identity')
      );
      expect(engineIssue).toBeDefined();
      expect(result.dataQuality.hasIntegrityErrors).toBe(true);
    });
  });

  describe('3. Raw Evidence Inventory and Integrity (§2, §7, §8)', () => {
    it('verifies checksums across all 8 evidence files plus Reference Lab locator and marks them PRESENT', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const inventory = result.evidenceInventory;
      // 8 raw files + 1 Reference Lab locator reference = 9 references in allReferences
      expect(inventory.allReferences).toHaveLength(9);

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

      // Check Reference Lab locator
      expect(inventory.referenceLabMetrics).toBeDefined();
      expect(inventory.referenceLabMetrics?.sourceLocator).toBe('execution-manifest.json#/referenceLabMetrics');
      expect(inventory.referenceLabMetrics?.presenceStatus).toBe('PRESENT');
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

    it('enforces required raw-artifact completeness: missing each required artifact causes MISSING_REQUIRED_ARTIFACT', () => {
      const requiredArtifactKeys: (keyof ReturnType<typeof createAuthoritativeEvidenceInput>)[] = [
        'summaryJson',
        'stdoutLog',
        'stderrLog',
        'configJson',
        'journeysJs',
        'entrypointJs',
        'runtimeJs'
      ];

      for (const key of requiredArtifactKeys) {
        const input = createAuthoritativeEvidenceInput();
        delete (input as any)[key];

        const result = ingestGovernedExecutionEvidence(input);
        expect(result.dataQuality.isComplete).toBe(false);
        const issue = result.dataQuality.issues.find(
          (i) => i.code === 'MISSING_REQUIRED_ARTIFACT'
        );
        expect(issue).toBeDefined();
        expect(issue?.severity).toBe('ERROR');
      }
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

  describe('5. Authoritative k6 v0.54.0 Summary Parsing and Thresholds (§2, §3, §4, §6, §10)', () => {
    it('parses exact authoritative values from summary.json without invention', () => {
      const parsed = parseK6SummaryJson(AUTHORITATIVE_M3_1B_SUMMARY_JSON);

      // Duration trends (flat schema in k6 v0.54.0)
      expect(parsed.metrics.httpReqDuration?.avg).toBeCloseTo(0.234, 3);
      expect(parsed.metrics.httpReqDuration?.p95).toBe(0.330927);
      expect(parsed.metrics.httpReqDuration?.p99).toBe(0.4346683999999997);

      // Checkout duration
      expect(parsed.metrics.httpReqDurationCheckout?.p95).toBe(0.3906885);
      expect(parsed.metrics.pecpJourneyDurationMs?.p95).toBe(4001);
      expect(parsed.metrics.pecpJourneyDurationMs?.p99).toBe(4002);

      // Max VUs
      expect(parsed.metrics.vusMax?.max).toBe(282);
      expect(parsed.metrics.vusMax?.value).toBe(282);

      // Rates and counters
      expect(parsed.metrics.httpReqFailed?.passes).toBe(0);
      expect(parsed.metrics.httpReqFailed?.fails).toBe(120981);
      expect(parsed.metrics.httpReqFailed?.rate).toBe(0);
      expect(parsed.metrics.checks?.rate).toBe(1.0);
      expect(parsed.metrics.checks?.passes).toBe(120981);
      expect(parsed.metrics.checks?.fails).toBe(0);

      // Root checks: preserves all 5 individual journey checks from root_group.checks
      expect(parsed.metrics.rootChecks).toHaveLength(5);
      const featuredCheck = parsed.metrics.rootChecks.find((c) => c.name === 'View Featured Products status is 200');
      expect(featuredCheck).toBeDefined();
      expect(featuredCheck?.passes).toBe(66713);
      expect(featuredCheck?.fails).toBe(0);

      const checkoutCheck = parsed.metrics.rootChecks.find((c) => c.name === 'Submit Order Checkout status is 201');
      expect(checkoutCheck).toBeDefined();
      expect(checkoutCheck?.passes).toBe(9671);
      expect(checkoutCheck?.fails).toBe(0);

      const basketCheck = parsed.metrics.rootChecks.find((c) => c.name === 'Add SKU to Basket status is 200');
      expect(basketCheck).toBeDefined();
      expect(basketCheck?.passes).toBe(18195);
      expect(basketCheck?.fails).toBe(0);

      const catalogCheck = parsed.metrics.rootChecks.find((c) => c.name === 'Query Product Catalog status is 200');
      expect(catalogCheck).toBeDefined();
      expect(catalogCheck?.passes).toBe(24003);
      expect(catalogCheck?.fails).toBe(0);

      const orderHistoryCheck = parsed.metrics.rootChecks.find((c) => c.name === 'View Customer Order History status is 200');
      expect(orderHistoryCheck).toBeDefined();
      expect(orderHistoryCheck?.passes).toBe(2399);
      expect(orderHistoryCheck?.fails).toBe(0);
    });

    it('correctly maps k6 v0.54.0 boolean thresholds: false = not breached (OBSERVED_PASSED)', () => {
      const parsed = parseK6SummaryJson(AUTHORITATIVE_M3_1B_SUMMARY_JSON);

      expect(parsed.thresholdObservations).toHaveLength(2);

      const rateThresh = parsed.thresholdObservations.find((t) => t.expression === 'rate<0.005');
      expect(rateThresh).toBeDefined();
      expect(rateThresh?.status).toBe('OBSERVED_PASSED');
      expect(rateThresh?.engineResult).toBe(true);
      expect(rateThresh?.metric).toBe('http_req_failed');
      expect(rateThresh?.parserSchemaVersion).toBe('k6-v0.54.0-summary-export');

      const checkoutThresh = parsed.thresholdObservations.find((t) => t.expression === 'p(95)<2000');
      expect(checkoutThresh).toBeDefined();
      expect(checkoutThresh?.status).toBe('OBSERVED_PASSED');
      expect(checkoutThresh?.engineResult).toBe(true);
      expect(checkoutThresh?.metric).toBe('http_req_duration{journey:checkout}');
      expect(checkoutThresh?.observedValue).toBe(0.3906885);
      expect(checkoutThresh?.parserSchemaVersion).toBe('k6-v0.54.0-summary-export');
    });

    it('maps boolean true in k6 v0.54.0 summary to OBSERVED_FAILED without evaluating a PECP verdict', () => {
      const customSummary = JSON.parse(JSON.stringify(AUTHORITATIVE_M3_1B_SUMMARY_JSON));
      // In k6 v0.54.0, true indicates threshold failure/breach
      customSummary.metrics.http_req_failed.thresholds['rate<0.005'] = true;

      const parsed = parseK6SummaryJson(customSummary);
      const thresh = parsed.thresholdObservations.find((t) => t.expression === 'rate<0.005');
      expect(thresh?.status).toBe('OBSERVED_FAILED');
      expect(thresh?.engineResult).toBe(false);

      // Ingest with this custom summary
      const input = createAuthoritativeEvidenceInput();
      input.summaryJson = customSummary;
      const result = ingestGovernedExecutionEvidence(input);

      // Threshold failure is preserved as engine observation, NOT translated to PECP FAIL!
      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
      expect(result.thresholdObservations.find((t) => t.expression === 'rate<0.005')?.status).toBe('OBSERVED_FAILED');
    });

    it('preserves Rate semantics for pecpWorkloadAttainmentRate and leaves it undefined when absent', () => {
      const parsed = parseK6SummaryJson(AUTHORITATIVE_M3_1B_SUMMARY_JSON);
      expect(parsed.metrics.pecpWorkloadAttainmentRate).toBeUndefined();

      // Test with an explicit Rate metric payload
      const rateSummary = JSON.parse(JSON.stringify(AUTHORITATIVE_M3_1B_SUMMARY_JSON));
      rateSummary.metrics.pecp_workload_attainment_rate = {
        passes: 9671,
        fails: 0,
        rate: 0.8367
      };
      const parsedWithRate = parseK6SummaryJson(rateSummary);
      expect(parsedWithRate.metrics.pecpWorkloadAttainmentRate).toBeDefined();
      expect(parsedWithRate.metrics.pecpWorkloadAttainmentRate?.rate).toBe(0.8367);
      expect(parsedWithRate.metrics.pecpWorkloadAttainmentRate?.passes).toBe(9671);
      expect(parsedWithRate.metrics.pecpWorkloadAttainmentRate?.fails).toBe(0);
    });
  });

  describe('6. Semantic Separation of Scheduler vs Business Events (§4, §5)', () => {
    it('preserves distinct structures for scheduler iterations and business events without default injection', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Scheduler observation (from binding, no default fallback)
      const scheduler = result.schedulerObservation;
      expect(scheduler.schedulerPopulation).toBe('JOURNEY_ITERATION');
      expect(scheduler.governedPeakRate).toBe(109.375);
      expect(scheduler.actualIterations).toBe(120981);
      expect(scheduler.observedIterationRate).toBeCloseTo(91.589, 3);
      expect(scheduler.droppedIterations).toBe(8);
      expect(scheduler.arrivalDemandCounter).toBe(120981);

      // Business events observation (from binding, no default fallback)
      const business = result.businessEventsObservation;
      expect(business.governedMetric).toBe('orders');
      expect(business.governedTarget?.value).toBe(8.75);
      expect(business.governedTarget?.unit).toBe('orders/second');
      expect(business.observedEventCount).toBe(9671);
      expect(business.observedRawRate).toBeCloseTo(7.321, 3);
      expect(business.referenceLabCorroboratingEventCount).toBe(9671);

      // Conflation prevention
      expect(scheduler.actualIterations).not.toBe(business.observedEventCount);
      expect(scheduler.governedPeakRate).not.toBe(business.governedTarget?.value);
    });

    it('flags UNRESOLVED_SCHEDULE_POPULATION when scheduler population is missing and does not invent JOURNEY_ITERATION', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input.manifest as any).pecpBinding.schedulerArrival.population;

      const result = ingestGovernedExecutionEvidence(input);
      expect(result.schedulerObservation.schedulerPopulation).toBeUndefined();
      const issue = result.dataQuality.issues.find((i) => i.code === 'UNRESOLVED_SCHEDULE_POPULATION');
      expect(issue).toBeDefined();
    });

    it('flags MISSING_SOURCE_WORKLOAD_TARGET when business target is missing and does not invent 8.75', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input.manifest as any).pecpBinding.businessAttainment;
      delete (input.manifest as any).businessAttainment;

      const result = ingestGovernedExecutionEvidence(input);
      expect(result.businessEventsObservation.governedTarget).toBeUndefined();
      expect(result.businessEventsObservation.governedMetric).toBeUndefined();
      const issue = result.dataQuality.issues.find((i) => i.code === 'MISSING_SOURCE_WORKLOAD_TARGET');
      expect(issue).toBeDefined();
    });
  });

  describe('7. Reference Lab Corroboration & Consistency Checking (§5, §8)', () => {
    it('corroborates k6 business attainment against Reference Lab order_created counter', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const lab = result.referenceLabCorroboration;
      expect(lab).toBeDefined();
      expect(lab?.sourceLocator).toBe('execution-manifest.json#/referenceLabMetrics');
      expect(lab?.totalRequestsDelta).toBe(120982);
      expect(lab?.businessEventCounts.orderCreatedEvents).toBe(9671);
      expect(lab?.consistency.k6BusinessEventCount).toBe(9671);
      expect(lab?.consistency.referenceLabOrderCreatedCount).toBe(9671);
      expect(lab?.consistency.countsMatch).toBe(true);
      expect(lab?.consistency.discrepancyCount).toBe(0);

      // Route delta check
      expect(lab?.requestsByRoute?.['/api/v1/orders/checkout']).toBe(9671);
      expect(lab?.requestsByRoute?.['/api/v1/products/featured']).toBe(66713);
      expect(lab?.requestsByRoute?.['/api/v1/products/search']).toBe(24003);
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

      // Discrepancy is a data quality issue, NOT a PECP FAIL!
      expect(result.performanceVerdict).toBe(INVARIANT_PERFORMANCE_VERDICT);
    });
  });

  describe('8. Separation of Full-Test Average from Contract-Basis Attainment (§9)', () => {
    it('separates full-test-average observation from unresolved acceptance-basis attainment', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Full-test average observation: descriptive whole-execution metric
      expect(result.fullTestAverageObservation).toBeDefined();
      expect(result.fullTestAverageObservation?.timeBasis).toBe('FULL_TEST_AVERAGE');
      expect(result.fullTestAverageObservation?.resultValue).toBeCloseTo(7.321, 3);
      expect(result.fullTestAverageObservation?.attainmentRatio).toBeCloseTo(0.8367, 3);
      expect(result.fullTestAverageObservation?.derivationStatus).toBe('DETERMINISTICALLY_DERIVED');

      // Acceptance-basis attainment: steady-state is UNRESOLVED due to lack of time-sliced telemetry
      expect(result.acceptanceBasisAttainment).toBeDefined();
      expect(result.acceptanceBasisAttainment.timeBasis).toBe('STEADY_STATE_PEAK');
      expect(result.acceptanceBasisAttainment.resultValue).toBeUndefined();
      expect(result.acceptanceBasisAttainment.attainmentRatio).toBeUndefined();
      expect(result.acceptanceBasisAttainment.derivationStatus).toBe('UNRESOLVED_INSUFFICIENT_TIME_SERIES');

      // Governed attainment observation returned to downstream engines forces acceptance basis
      expect(result.workloadAttainmentObservation.derivationStatus).toBe('UNRESOLVED_INSUFFICIENT_TIME_SERIES');
      expect(result.workloadAttainmentObservation.resultValue).toBeUndefined();

      // Verdict remains NOT_EVALUATED
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

      expect(result.evidenceInventory.manifest?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.summaryJson?.presenceStatus).toBe('PRESENT');
      expect(result.evidenceInventory.stdoutLog?.presenceStatus).toBe('PRESENT');

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

  describe('11. Negative and Edge Case Fidelity Tests (§11)', () => {
    it('proves that a missing metric does not become 0 but remains undefined', () => {
      // Create minimal summary missing duration, counter, and custom metrics
      const sparseSummary = {
        metrics: {
          iterations: { count: 50, rate: 5.0 }
          // all other metrics absent
        }
      };
      const parsed = parseK6SummaryJson(sparseSummary);
      expect(parsed.metrics.iterations?.count).toBe(50);
      expect(parsed.metrics.httpReqDuration).toBeUndefined();
      expect(parsed.metrics.httpReqDurationCheckout).toBeUndefined();
      expect(parsed.metrics.droppedIterations).toBeUndefined();
      expect(parsed.metrics.pecpWorkloadAttainmentRate).toBeUndefined();
      expect(parsed.metrics.vus).toBeUndefined();
      expect(parsed.metrics.vusMax).toBeUndefined();
    });

    it('proves that malformed nested/legacy metric is parsed where supported and handles empty values gracefully', () => {
      const legacySummary = {
        metrics: {
          http_req_duration: {
            values: {
              avg: 1.25,
              'p(95)': 2.5
            }
          },
          dropped_iterations: {
            values: {
              count: 0
            }
          }
        }
      };
      const parsed = parseK6SummaryJson(legacySummary);
      expect(parsed.metrics.httpReqDuration?.avg).toBe(1.25);
      expect(parsed.metrics.httpReqDuration?.p95).toBe(2.5);
      expect(parsed.metrics.httpReqDuration?.p99).toBeUndefined();
      expect(parsed.metrics.droppedIterations?.count).toBe(0);
    });

    it('proves root-check map parsing is deterministic for both object map and array formats', () => {
      const objectChecksSummary = {
        root_group: {
          checks: {
            checkA: { name: 'Check Alpha', passes: 10, fails: 0 },
            checkB: { name: 'Check Beta', passes: 20, fails: 1 }
          }
        }
      };
      const parsedObj = parseK6SummaryJson(objectChecksSummary);
      expect(parsedObj.metrics.rootChecks).toHaveLength(2);
      expect(parsedObj.metrics.rootChecks[0].name).toBe('Check Alpha');
      expect(parsedObj.metrics.rootChecks[0].passes).toBe(10);
      expect(parsedObj.metrics.rootChecks[1].name).toBe('Check Beta');
      expect(parsedObj.metrics.rootChecks[1].fails).toBe(1);

      const arrayChecksSummary = {
        root_group: {
          checks: [
            { name: 'Check Gamma', passes: 30, fails: 0 }
          ]
        }
      };
      const parsedArr = parseK6SummaryJson(arrayChecksSummary);
      expect(parsedArr.metrics.rootChecks).toHaveLength(1);
      expect(parsedArr.metrics.rootChecks[0].name).toBe('Check Gamma');
      expect(parsedArr.metrics.rootChecks[0].passes).toBe(30);
    });

    it('proves that invalid JSON in summary payload throws PARSER_INCOMPATIBILITY', () => {
      expect(() => parseK6SummaryJson('NOT_VALID_JSON{')).toThrow('PARSER_INCOMPATIBILITY');
      expect(() => parseK6SummaryJson(null as any)).toThrow('PARSER_INCOMPATIBILITY');
    });
  });

  describe('12. M3.2.2 Zero-Invention Semantic Hardening Gate Negative Regressions', () => {
    it('proves missing summary duration does not become 0 and explicit 0 remains 0', () => {
      // Missing duration in summary
      const missingDurationSummary = {
        metrics: {
          iterations: { count: 10, rate: 1.0 }
        }
      };
      const parsedMissing = parseK6SummaryJson(missingDurationSummary);
      expect(parsedMissing.metrics.testRunDurationMs).toBeUndefined();
      expect(parsedMissing.metrics.testRunDurationMs).not.toBe(0);

      // Explicit duration 0 in summary
      const explicitZeroSummary = {
        state: { testRunDurationMs: 0 },
        metrics: {
          iterations: { count: 10, rate: 1.0 }
        }
      };
      const parsedZero = parseK6SummaryJson(explicitZeroSummary);
      expect(parsedZero.metrics.testRunDurationMs).toBe(0);

      // Ingestion preserves missing duration as undefined
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);
      expect(result.metrics.testRunDurationMs).toBeUndefined();
      expect(result.metrics.testRunDurationMs).not.toBe(0);
    });

    it('proves missing workload target does not create target 0 in any attainment object', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input.manifest as any).pecpBinding.businessAttainment;
      delete (input.manifest as any).businessAttainment;

      const result = ingestGovernedExecutionEvidence(input);

      // Business observation
      expect(result.businessEventsObservation.governedTarget).toBeUndefined();
      expect(result.businessEventsObservation.governedMetric).toBeUndefined();

      // Full test average observation
      expect(result.fullTestAverageObservation?.governedDemand?.targetValue).toBeUndefined();
      expect(result.fullTestAverageObservation?.governedDemand?.targetValue).not.toBe(0);
      expect(result.fullTestAverageObservation?.governedDemand?.metric).toBeUndefined();
      expect(result.fullTestAverageObservation?.governedDemand?.metric).not.toBe('unspecified');

      // Acceptance basis attainment
      expect(result.acceptanceBasisAttainment.governedDemand?.targetValue).toBeUndefined();
      expect(result.acceptanceBasisAttainment.governedDemand?.targetValue).not.toBe(0);
      expect(result.acceptanceBasisAttainment.governedDemand?.metric).toBeUndefined();
      expect(result.acceptanceBasisAttainment.governedDemand?.metric).not.toBe('unspecified');
      expect(result.acceptanceBasisAttainment.derivationStatus).toBe('UNRESOLVED_INSUFFICIENT_TIME_SERIES');
    });

    it('proves missing scheduler population does not create an unspecified governed population', () => {
      const input = createAuthoritativeEvidenceInput();
      delete (input.manifest as any).pecpBinding.schedulerArrival.population;

      const result = ingestGovernedExecutionEvidence(input);
      expect(result.schedulerObservation.schedulerPopulation).toBeUndefined();
      expect(result.schedulerObservation.schedulerPopulation).not.toBe('unspecified');
      expect(result.fullTestAverageObservation?.governedPopulation).toBeUndefined();
      expect(result.fullTestAverageObservation?.governedPopulation).not.toBe('unspecified');
      expect(result.acceptanceBasisAttainment.governedPopulation).toBeUndefined();
      expect(result.acceptanceBasisAttainment.governedPopulation).not.toBe('unspecified');
    });

    it('proves Reference Lab evidence distinguishes missing from measured zero', () => {
      // 1. Missing Reference Lab counts remain undefined
      const inputMissing = createAuthoritativeEvidenceInput();
      delete (inputMissing.manifest as any).referenceLabMetrics.delta.orderCreatedEvents;
      delete (inputMissing.manifest as any).referenceLabMetrics.delta.totalRequests;
      delete (inputMissing.manifest as any).referenceLabMetrics.delta.durationSeconds;

      const resultMissing = ingestGovernedExecutionEvidence(inputMissing);
      const labMissing = resultMissing.referenceLabCorroboration;
      expect(labMissing?.businessEventCounts.orderCreatedEvents).toBeUndefined();
      expect(labMissing?.businessEventCounts.orderCreatedEvents).not.toBe(0);
      expect(labMissing?.totalRequestsDelta).toBeUndefined();
      expect(labMissing?.totalRequestsDelta).not.toBe(0);
      expect(labMissing?.durationSeconds).toBeUndefined();
      expect(labMissing?.durationSeconds).not.toBe(0);
      expect(labMissing?.consistency.countsMatch).toBeUndefined();
      expect(labMissing?.consistency.discrepancyCount).toBeUndefined();
      expect(labMissing?.consistency.notes).toContain('unavailable');

      // 2. Explicit measured zero remains 0
      const inputZero = createAuthoritativeEvidenceInput();
      (inputZero.manifest as any).referenceLabMetrics.delta.orderCreatedEvents = 0;
      (inputZero.manifest as any).referenceLabMetrics.delta.totalRequests = 0;
      (inputZero.manifest as any).referenceLabMetrics.delta.durationSeconds = 0;

      const resultZero = ingestGovernedExecutionEvidence(inputZero);
      const labZero = resultZero.referenceLabCorroboration;
      expect(labZero?.businessEventCounts.orderCreatedEvents).toBe(0);
      expect(labZero?.totalRequestsDelta).toBe(0);
      expect(labZero?.durationSeconds).toBe(0);
      expect(labZero?.consistency.countsMatch).toBe(false);
      expect(labZero?.consistency.discrepancyCount).toBe(9671);
    });

    it('proves missing execution manifest fails deterministically with machine-readable issue and incomplete result', () => {
      const input = createAuthoritativeEvidenceInput();
      input.manifest = undefined as any;

      const result = ingestGovernedExecutionEvidence(input);
      expect(result.dataQuality.isComplete).toBe(false);
      expect(result.dataQuality.hasIntegrityErrors).toBe(true);

      const fatalManifestIssue = result.dataQuality.issues.find((i) => i.code === 'MISSING_MANIFEST');
      expect(fatalManifestIssue).toBeDefined();
      expect(fatalManifestIssue?.severity).toBe('FATAL');

      const missingArtifactIssue = result.dataQuality.issues.find((i) => i.code === 'MISSING_REQUIRED_ARTIFACT' && i.details?.filename === 'execution-manifest.json');
      expect(missingArtifactIssue).toBeDefined();

      expect(result.evidenceInventory.manifest?.presenceStatus).toBe('ABSENT');
      expect(result.evidenceInventory.allReferences.every((r) => r.presenceStatus === 'PRESENT')).toBe(false);
      expect(result.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
    });

    it('proves malformed flat and legacy numeric metrics are surfaced as MALFORMED_METRIC', () => {
      // Flat shape with NaN string or invalid number
      const malformedFlatSummary = {
        metrics: {
          http_req_duration: {
            avg: 'not-a-number'
          }
        }
      };
      expect(() => parseK6SummaryJson(malformedFlatSummary)).toThrow('MALFORMED_METRIC');

      // Legacy shape with NaN
      const malformedLegacySummary = {
        metrics: {
          iterations: {
            values: {
              count: NaN
            }
          }
        }
      };
      expect(() => parseK6SummaryJson(malformedLegacySummary)).toThrow('MALFORMED_METRIC');

      // Infinity rejected
      const infinitySummary = {
        metrics: {
          vus: {
            value: Infinity
          }
        }
      };
      expect(() => parseK6SummaryJson(infinitySummary)).toThrow('MALFORMED_METRIC');

      // Ingestion surfaces MALFORMED_METRIC in dataQuality.issues
      const input = createAuthoritativeEvidenceInput();
      input.summaryJson = JSON.stringify(malformedFlatSummary);
      const result = ingestGovernedExecutionEvidence(input);
      expect(result.dataQuality.hasIntegrityErrors).toBe(true);
      const malformedIssue = result.dataQuality.issues.find((i) => i.code === 'MALFORMED_METRIC');
      expect(malformedIssue).toBeDefined();
    });

    it('proves root-check counters preserve absence and do not manufacture zero counters', () => {
      // Missing passes/fails
      const missingCountersSummary = {
        root_group: {
          checks: {
            checkWithoutCounters: {
              name: 'Missing Counters Check'
              // passes and fails absent
            }
          }
        }
      };
      const parsedMissing = parseK6SummaryJson(missingCountersSummary);
      expect(parsedMissing.metrics.rootChecks).toHaveLength(1);
      const check = parsedMissing.metrics.rootChecks[0];
      expect(check.passes).toBeUndefined();
      expect(check.passes).not.toBe(0);
      expect(check.fails).toBeUndefined();
      expect(check.fails).not.toBe(0);

      // Explicit zero passes/fails
      const explicitZeroSummary = {
        root_group: {
          checks: {
            zeroCheck: {
              name: 'Zero Check',
              passes: 0,
              fails: 0
            }
          }
        }
      };
      const parsedZero = parseK6SummaryJson(explicitZeroSummary);
      expect(parsedZero.metrics.rootChecks[0].passes).toBe(0);
      expect(parsedZero.metrics.rootChecks[0].fails).toBe(0);
    });

    it('guarantees no NaN enters canonical Results', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      const checkNoNaN = (obj: any, path = ''): void => {
        if (obj === null || obj === undefined) return;
        if (typeof obj === 'number') {
          if (Number.isNaN(obj)) {
            throw new Error(`NaN detected at path: ${path}`);
          }
          return;
        }
        if (typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            checkNoNaN(obj[key], path ? `${path}.${key}` : key);
          }
        }
      };

      expect(() => checkNoNaN(result)).not.toThrow();
    });
  });

  describe('13. M3.2.3 Canonical Missingness & Map Integrity Gate (§1, §2, §3, §4)', () => {
    it('preserves missing business target unit as undefined and does not use empty string as placeholder', () => {
      // 1. Missing target unit
      const inputMissingUnit = createAuthoritativeEvidenceInput();
      delete (inputMissingUnit.manifest as any).pecpBinding.businessAttainment.unit;
      delete (inputMissingUnit.manifest as any).businessAttainment.unit;

      const resultMissing = ingestGovernedExecutionEvidence(inputMissingUnit);
      expect(resultMissing.businessEventsObservation.governedTarget?.value).toBe(8.75);
      expect(resultMissing.businessEventsObservation.governedTarget?.unit).toBeUndefined();
      expect(resultMissing.businessEventsObservation.governedTarget?.unit).not.toBe('');
      expect(resultMissing.acceptanceBasisAttainment.governedDemand?.unit).toBeUndefined();
      expect(resultMissing.acceptanceBasisAttainment.governedDemand?.unit).not.toBe('');
      expect(resultMissing.acceptanceBasisAttainment.units).toBeUndefined();
      expect(resultMissing.acceptanceBasisAttainment.units).not.toBe('');

      // 2. Explicit empty string unit in manifest is treated as absent unit (not stored as empty string)
      const inputEmptyUnit = createAuthoritativeEvidenceInput();
      (inputEmptyUnit.manifest as any).pecpBinding.businessAttainment.unit = '';
      (inputEmptyUnit.manifest as any).businessAttainment.unit = '';

      const resultEmpty = ingestGovernedExecutionEvidence(inputEmptyUnit);
      expect(resultEmpty.businessEventsObservation.governedTarget?.unit).toBeUndefined();
      expect(resultEmpty.businessEventsObservation.governedTarget?.unit).not.toBe('');

      // 3. Present target unit is preserved exactly
      const inputPresent = createAuthoritativeEvidenceInput();
      const resultPresent = ingestGovernedExecutionEvidence(inputPresent);
      expect(resultPresent.businessEventsObservation.governedTarget?.unit).toBe('orders/second');
      expect(resultPresent.acceptanceBasisAttainment.governedDemand?.unit).toBe('orders/second');
      expect(resultPresent.acceptanceBasisAttainment.units).toBe('orders/second');
    });

    it('populates actualSourceMetric only when raw metric is present and leaves it undefined when absent', () => {
      // 1. Authoritative input has pecp_business_attainment_events present -> preserved exactly
      const inputAuthoritative = createAuthoritativeEvidenceInput();
      const resultAuthoritative = ingestGovernedExecutionEvidence(inputAuthoritative);
      expect(resultAuthoritative.acceptanceBasisAttainment.actualSourceMetric).toBe('pecp_business_attainment_events');
      expect(resultAuthoritative.fullTestAverageObservation?.actualSourceMetric).toBe('pecp_business_attainment_events');
      expect(resultAuthoritative.workloadAttainmentObservation.actualSourceMetric).toBe('pecp_business_attainment_events');

      // 2. Missing pecp_business_attainment_events from summaryJson -> actualSourceMetric is undefined
      const inputMissingMetric = createAuthoritativeEvidenceInput();
      const parsedSummary = JSON.parse(inputMissingMetric.summaryJson);
      delete parsedSummary.metrics.pecp_business_attainment_events;
      inputMissingMetric.summaryJson = JSON.stringify(parsedSummary);

      const resultMissing = ingestGovernedExecutionEvidence(inputMissingMetric);
      expect(resultMissing.acceptanceBasisAttainment.actualSourceMetric).toBeUndefined();
      expect(resultMissing.acceptanceBasisAttainment.derivationStatus).toBe('UNRESOLVED_INSUFFICIENT_TIME_SERIES');
      expect(resultMissing.fullTestAverageObservation?.actualSourceMetric).toBeUndefined();
      expect(resultMissing.workloadAttainmentObservation.actualSourceMetric).toBeUndefined();

      // Ensure no placeholder string like 'unspecified' or 'pecp_business_attainment_events' was injected
      expect(resultMissing.acceptanceBasisAttainment.actualSourceMetric).not.toBe('unspecified');
      expect(resultMissing.acceptanceBasisAttainment.actualSourceMetric).not.toBe('pecp_business_attainment_events');
    });

    it('validates Reference Lab route and status counter maps with deterministic normalization', () => {
      // 1. Missing route map and missing status map remain undefined
      const inputMissingMaps = createAuthoritativeEvidenceInput();
      delete (inputMissingMaps.manifest as any).referenceLabMetrics.delta.requestsByRoute;
      delete (inputMissingMaps.manifest as any).referenceLabMetrics.delta.statusCounts;

      const resultMissing = ingestGovernedExecutionEvidence(inputMissingMaps);
      expect(resultMissing.referenceLabCorroboration?.requestsByRoute).toBeUndefined();
      expect(resultMissing.referenceLabCorroboration?.statusCounts).toBeUndefined();

      // 2. Explicit zero route and status counters are preserved as 0
      const inputZeroMaps = createAuthoritativeEvidenceInput();
      (inputZeroMaps.manifest as any).referenceLabMetrics.delta.requestsByRoute = {
        '/api/v1/basket/items': 0,
        '/api/v1/orders/checkout': 0
      };
      (inputZeroMaps.manifest as any).referenceLabMetrics.delta.statusCounts = {
        '200': 0,
        '500': 0
      };

      const resultZero = ingestGovernedExecutionEvidence(inputZeroMaps);
      expect(resultZero.referenceLabCorroboration?.requestsByRoute?.['/api/v1/basket/items']).toBe(0);
      expect(resultZero.referenceLabCorroboration?.requestsByRoute?.['/api/v1/orders/checkout']).toBe(0);
      expect(resultZero.referenceLabCorroboration?.statusCounts?.['200']).toBe(0);
      expect(resultZero.referenceLabCorroboration?.statusCounts?.['500']).toBe(0);

      // 3. Malformed route counter (non-numeric string, NaN, Infinity) surfaces MALFORMED_METRIC
      const inputMalformedRoute = createAuthoritativeEvidenceInput();
      (inputMalformedRoute.manifest as any).referenceLabMetrics.delta.requestsByRoute = {
        '/api/v1/valid': 100,
        '/api/v1/invalid-string': 'not-a-number',
        '/api/v1/nan': NaN,
        '/api/v1/infinity': Infinity
      };

      const resultMalformedRoute = ingestGovernedExecutionEvidence(inputMalformedRoute);
      expect(resultMalformedRoute.dataQuality.hasIntegrityErrors).toBe(true);
      const routeErrors = resultMalformedRoute.dataQuality.issues.filter(
        (i) => i.code === 'MALFORMED_METRIC' && i.message.includes('requestsByRoute')
      );
      expect(routeErrors.length).toBeGreaterThanOrEqual(3);
      // Valid counter is preserved
      expect(resultMalformedRoute.referenceLabCorroboration?.requestsByRoute?.['/api/v1/valid']).toBe(100);
      // Malformed counters are NOT coerced to 0 and do NOT enter canonical record as NaN or Infinity
      expect(resultMalformedRoute.referenceLabCorroboration?.requestsByRoute?.['/api/v1/invalid-string']).toBeUndefined();
      expect(resultMalformedRoute.referenceLabCorroboration?.requestsByRoute?.['/api/v1/nan']).toBeUndefined();
      expect(resultMalformedRoute.referenceLabCorroboration?.requestsByRoute?.['/api/v1/infinity']).toBeUndefined();

      // 4. Malformed status counter surfaces MALFORMED_METRIC
      const inputMalformedStatus = createAuthoritativeEvidenceInput();
      (inputMalformedStatus.manifest as any).referenceLabMetrics.delta.statusCounts = {
        '200': 120982,
        '500': 'bad-counter',
        '503': Infinity
      };

      const resultMalformedStatus = ingestGovernedExecutionEvidence(inputMalformedStatus);
      expect(resultMalformedStatus.dataQuality.hasIntegrityErrors).toBe(true);
      const statusErrors = resultMalformedStatus.dataQuality.issues.filter(
        (i) => i.code === 'MALFORMED_METRIC' && i.message.includes('statusCounts')
      );
      expect(statusErrors.length).toBeGreaterThanOrEqual(2);
      expect(resultMalformedStatus.referenceLabCorroboration?.statusCounts?.['200']).toBe(120982);
      expect(resultMalformedStatus.referenceLabCorroboration?.statusCounts?.['500']).toBeUndefined();
      expect(resultMalformedStatus.referenceLabCorroboration?.statusCounts?.['503']).toBeUndefined();

      // 5. Deep scan ensures no NaN / Infinity exists anywhere in result
      const checkNoNonFinite = (obj: any, path = ''): void => {
        if (obj === null || obj === undefined) return;
        if (typeof obj === 'number') {
          if (!Number.isFinite(obj)) {
            throw new Error(`Non-finite number (${obj}) detected at path: ${path}`);
          }
          return;
        }
        if (typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            checkNoNonFinite(obj[key], path ? `${path}.${key}` : key);
          }
        }
      };

      expect(() => checkNoNonFinite(resultMalformedRoute)).not.toThrow();
      expect(() => checkNoNonFinite(resultMalformedStatus)).not.toThrow();
    });

    it('preserves the authoritative M3.1B regression exactly with all canonical requirements', () => {
      const input = createAuthoritativeEvidenceInput();
      const result = ingestGovernedExecutionEvidence(input);

      // Run identity & provenance
      expect(result.run.executionRunId).toBe('pecp-ref-canonical-1789978991064');
      expect(result.run.workflowRunId).toBe('35577599469');

      // Iterations
      expect(result.metrics.iterations?.count).toBe(120981);
      expect(result.metrics.droppedIterations?.count).toBe(8);

      // Business & Reference Lab events
      expect(result.metrics.pecpBusinessAttainmentEvents?.count).toBe(9671);
      expect(result.businessEventsObservation.observedEventCount).toBe(9671);
      expect(result.referenceLabCorroboration?.businessEventCounts.orderCreatedEvents).toBe(9671);
      expect(result.referenceLabCorroboration?.totalRequestsDelta).toBe(120982);

      // Exact route and status maps
      expect(result.referenceLabCorroboration?.requestsByRoute?.['/api/v1/orders/checkout']).toBe(9671);
      expect(result.referenceLabCorroboration?.requestsByRoute?.['/api/v1/products/featured']).toBe(66713);
      expect(result.referenceLabCorroboration?.requestsByRoute?.['/api/v1/products/search']).toBe(24003);
      expect(result.referenceLabCorroboration?.statusCounts?.['200']).toBe(111311);
      expect(result.referenceLabCorroboration?.statusCounts?.['201']).toBe(9671);

      // Governed scheduler peak and business target
      expect(result.schedulerObservation.governedPeakRate).toBe(109.375);
      expect(result.businessEventsObservation.governedTarget?.value).toBe(8.75);
      expect(result.businessEventsObservation.governedTarget?.unit).toBe('orders/second');

      // Unresolved acceptance-basis attainment
      expect(result.acceptanceBasisAttainment.timeBasis).toBe('STEADY_STATE_PEAK');
      expect(result.acceptanceBasisAttainment.derivationStatus).toBe('UNRESOLVED_INSUFFICIENT_TIME_SERIES');
      expect(result.acceptanceBasisAttainment.resultValue).toBeUndefined();
      expect(result.acceptanceBasisAttainment.actualSourceMetric).toBe('pecp_business_attainment_events');

      // Absence of unmeasured rate
      expect(result.metrics.pecpWorkloadAttainmentRate).toBeUndefined();

      // Strict verdict invariant
      expect(result.performanceVerdict).toBe('PECP_PERFORMANCE_VERDICT_NOT_EVALUATED');
      expect((result.performanceVerdict as string)).not.toBe('PASS');
      expect((result.performanceVerdict as string)).not.toBe('FAIL');
    });
  });
});
