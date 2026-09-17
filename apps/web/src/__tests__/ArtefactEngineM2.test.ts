import { describe, it, expect } from 'vitest';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import {
  generatePerformanceStrategy,
  generatePerformanceTestPlan,
  computeContractFingerprint,
  evaluateArtefactStaleness,
  checkAndTagArtefactStaleness,
  exportArtefactToMarkdown
} from '@pecp/artefact-engine';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  RETAILCO_INTELLIGENCE_ITEMS_FIXTURE,
  RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
} from '../fixtures/retailco/intelligenceFixture';

describe('PECP Engineering Artefact Engine (M2)', () => {
  // Post-resolution M1 contract baseline
  const postResolutionContract = compileDraftPerformanceContract({
    projectSummary: RETAILCO_PROJECT_FIXTURE,
    intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
    version: 'v0.1-draft'
  });

  describe('1. Performance Strategy Generator', () => {
    it('generates a deterministic Performance Strategy bound to upstream contract', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        artefactVersion: 'v1.0-draft'
      });

      expect(strategy.type).toBe('PERFORMANCE_STRATEGY');
      expect(strategy.title).toBe('Performance Strategy — Black Friday 2026 Readiness');
      expect(strategy.version).toBe('v1.0-draft');
      expect(strategy.engineeringIntent).toBe('FORECAST');
      expect(strategy.sourceContractId).toBe(postResolutionContract.id);
      expect(strategy.sourceContractVersion).toBe(postResolutionContract.version);
      expect(strategy.sourceContractFingerprint).toBeDefined();
      expect(strategy.sourceContractFingerprint.startsWith('fp-')).toBe(true);

      // Must contain all 17 required Strategy sections
      expect(strategy.sections.length).toBe(17);
      const sectionNumbers = strategy.sections.map((s) => s.sectionNumber);
      expect(sectionNumbers).toEqual([
        '1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0',
        '9.0', '10.0', '11.0', '12.0', '13.0', '14.0', '15.0', '16.0', '17.0'
      ]);
    });

    it('preserves governance state: BLOCKED contract produces BLOCKED, non-approvable Strategy', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      expect(strategy.status).toBe('BLOCKED');
      expect(strategy.approvalReadiness.canApprove).toBe(false);
      expect(strategy.approvalReadiness.status).toBe('BLOCKED');
      expect(strategy.approvalReadiness.blockingReasons.length).toBeGreaterThanOrEqual(2);

      // Section 1.0 Document Control callout carries blocker
      const sec1 = strategy.sections.find((s) => s.sectionNumber === '1.0');
      expect(sec1?.callouts?.some((c) => c.type === 'BLOCKER')).toBe(true);

      // Section 16.0 carries all blockers
      const sec16 = strategy.sections.find((s) => s.sectionNumber === '16.0');
      expect(sec16?.status).toBe('BLOCKED');
      expect(sec16?.tables?.[0].rows.length).toBeGreaterThanOrEqual(2);
    });

    it('presents approved workload demand (31,500/hr = 8.75/sec) with lineage in Section 7.0', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec7 = strategy.sections.find((s) => s.sectionNumber === '7.0');
      expect(sec7).toBeDefined();

      const tableRows = sec7?.tables?.[0].rows || [];
      const throughputRow = tableRows.find((r) => r[1] === 'order_throughput_per_second');
      expect(throughputRow).toBeDefined();
      expect(throughputRow?.[2]).toContain('8.75 orders/second');
      expect(throughputRow?.[3]).toBe('throughput_time_unit_conversion');

      // Little's Law concurrency must be explicitly blocked
      const concurrencyCallout = sec7?.callouts?.find((c) => c.type === 'BLOCKER');
      expect(concurrencyCallout?.text).toContain('Session Concurrency: BLOCKED');
      expect(concurrencyCallout?.text).toContain('Little\'s Law (L = λ × W) requires arrival rate of the same flow population');
    });

    it('extracts journey distribution from canonical intelligence only (Section 8.0)', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec8 = strategy.sections.find((s) => s.sectionNumber === '8.0');
      expect(sec8?.status).toBe('COMPLETE');
      const journeyRows = sec8?.tables?.[0].rows || [];
      expect(journeyRows.length).toBe(5);
      expect(journeyRows.map((r) => r[0])).toEqual(['Browse', 'Search', 'Basket', 'Checkout', 'Account']);
      expect(journeyRows.map((r) => r[1])).toEqual(['55%', '20%', '15%', '8%', '2%']);
    });

    it('clearly documents Ambiguous checkout response time in Section 9.0 without fabricating percentiles', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec9 = strategy.sections.find((s) => s.sectionNumber === '9.0');
      expect(sec9?.status).toBe('BLOCKED');

      const criteriaTable = sec9?.tables?.[0];
      const checkoutRow = criteriaTable?.rows.find((r) => String(r[1]).includes('Checkout') || String(r[2]).includes('Checkout'));
      expect(checkoutRow).toBeDefined();
      expect(checkoutRow?.[7]).toBe('MISSING'); // Percentile
      expect(checkoutRow?.[8]).toBe('AMBIGUOUS');

      const blockerCallout = sec9?.callouts?.find((c) => c.type === 'BLOCKER');
      expect(blockerCallout?.text).toContain('Ambiguous Acceptance Criterion');
    });

    it('marks unsupplied environment, data, and observability as NOT_SUPPLIED with no fabricated details', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const envSec = strategy.sections.find((s) => s.sectionNumber === '12.0');
      const dataSec = strategy.sections.find((s) => s.sectionNumber === '13.0');
      const obsSec = strategy.sections.find((s) => s.sectionNumber === '14.0');

      expect(envSec?.status).toBe('NOT_SUPPLIED');
      expect(dataSec?.status).toBe('NOT_SUPPLIED');
      expect(obsSec?.status).toBe('NOT_SUPPLIED');

      expect(envSec?.paragraphs?.[0]).toContain('not been supplied in canonical intelligence');
      expect(dataSec?.paragraphs?.[0]).toContain('not been supplied in canonical intelligence');
      expect(obsSec?.paragraphs?.[0]).toContain('not been supplied in canonical intelligence');
    });
  });

  describe('2. Performance Test Plan Generator', () => {
    it('generates a deterministic Performance Test Plan with 16 required sections', () => {
      const testPlan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        artefactVersion: 'v1.0-draft'
      });

      expect(testPlan.type).toBe('PERFORMANCE_TEST_PLAN');
      expect(testPlan.title).toBe('Performance Test Plan — Black Friday 2026 Readiness');
      expect(testPlan.version).toBe('v1.0-draft');
      expect(testPlan.engineeringIntent).toBe('FORECAST');
      expect(testPlan.sourceContractId).toBe(postResolutionContract.id);
      expect(testPlan.status).toBe('BLOCKED');
      expect(testPlan.approvalReadiness.canApprove).toBe(false);

      expect(testPlan.sections.length).toBe(16);
      const sectionNumbers = testPlan.sections.map((s) => s.sectionNumber);
      expect(sectionNumbers).toEqual([
        '1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '8.0',
        '9.0', '10.0', '11.0', '12.0', '13.0', '14.0', '15.0', '16.0'
      ]);
    });

    it('strictly separates required workload demand (Section 6.0) from NFR acceptance criteria (Section 8.0)', () => {
      const testPlan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const demandSec = testPlan.sections.find((s) => s.sectionNumber === '6.0');
      const criteriaSec = testPlan.sections.find((s) => s.sectionNumber === '8.0');

      // Demand section has throughput targets
      const demandRows = demandSec?.tables?.[0].rows || [];
      expect(demandRows.some((r) => r[0] === 'order_throughput_per_second' && r[1] === 8.75)).toBe(true);

      // Criteria section has response time latency targets
      const criteriaRows = criteriaSec?.tables?.[0].rows || [];
      expect(criteriaRows.some((r) => String(r[1]).includes('Checkout') || String(r[2]).includes('Checkout'))).toBe(true);

      // Separation principle stated in callout
      const separationCallout = demandSec?.callouts?.find((c) => c.type === 'INFO');
      expect(separationCallout?.text).toContain('Execution-Attainment Principle');
    });

    it('defines authoritative Pass / Fail / Inconclusive rules in Section 14.0', () => {
      const testPlan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec14 = testPlan.sections.find((s) => s.sectionNumber === '14.0');
      const table = sec14?.tables?.[0];
      expect(table).toBeDefined();

      const verdicts = table?.rows.map((r) => r[0]);
      expect(verdicts).toContain('PASS');
      expect(verdicts).toContain('FAIL');
      expect(verdicts).toContain('INCONCLUSIVE');

      const inconclusiveRow = table?.rows.find((r) => r[0] === 'INCONCLUSIVE');
      expect(inconclusiveRow?.[2]).toContain('Required workload demand was NOT attained');
    });

    it('does not generate executable k6 scripts in M2', () => {
      const testPlan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec9 = testPlan.sections.find((s) => s.sectionNumber === '9.0');
      expect(sec9?.paragraphs?.some((p) => p.includes('Executable test scripts (e.g. k6) are not generated in this work package'))).toBe(true);
    });
  });

  describe('3. Versioning, Staleness, and Drift Detection', () => {
    it('detects contract drift when version, ID, or calculation values change', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        artefactVersion: 'v1.0-draft'
      });

      // Same contract -> not stale
      const freshness = evaluateArtefactStaleness(strategy, postResolutionContract);
      expect(freshness.isStale).toBe(false);
      expect(freshness.reasons.length).toBe(0);

      // Mutated/evolved contract version
      const evolvedContract = {
        ...postResolutionContract,
        version: 'v1.0-approved'
      };
      const versionStaleness = evaluateArtefactStaleness(strategy, evolvedContract);
      expect(versionStaleness.isStale).toBe(true);
      expect(versionStaleness.reasons[0]).toContain('version evolved from "v0.1-draft" to "v1.0-approved"');

      // Tagging function preserves content and marks status as STALE
      const taggedArtefact = checkAndTagArtefactStaleness(strategy, evolvedContract);
      expect(taggedArtefact.status).toBe('STALE');
      expect(taggedArtefact.approvalReadiness.status).toBe('STALE');
      expect(taggedArtefact.approvalReadiness.canApprove).toBe(false);
      // Original strategy remains untouched (pure function)
      expect(strategy.status).toBe('BLOCKED');
    });
  });

  describe('4. Markdown Exporter', () => {
    it('exports a clean, structured Markdown representation with TOC and tables', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const md = exportArtefactToMarkdown(strategy);
      expect(md).toContain('# Performance Strategy — Black Friday 2026 Readiness');
      expect(md).toContain('## Table of Contents');
      expect(md).toContain('## 1.0 Document Control & Governance');
      expect(md).toContain('## 7.0 Workload Strategy & Required Demand');
      expect(md).toContain('| 8.75 orders/second |');
      expect(md).toContain('> ⛔ **BLOCKER**');
      expect(md).toContain('> 💡 **PECP METHODOLOGY GUIDANCE**');
    });
  });

  describe('5. M2.1 Artefact Governance Gate Compliance', () => {
    it('does not invent execution schedules or durations in Test Plan or Strategy', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const testPlan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      // Section 11 of Strategy
      const stratSec11 = strategy.sections.find((s) => s.sectionNumber === '11.0');
      expect(stratSec11?.status).toBe('UNRESOLVED');
      expect(stratSec11?.callouts?.some((c) => c.type === 'GUIDANCE')).toBe(true);
      const stratRows = stratSec11?.tables?.[0].rows || [];
      expect(stratRows.every((r) => String(r[3]).includes('NOT_SUPPLIED'))).toBe(true);

      // Section 9 of Test Plan
      const planSec9 = testPlan.sections.find((s) => s.sectionNumber === '9.0');
      expect(planSec9?.status).toBe('UNRESOLVED');
      expect(planSec9?.callouts?.some((c) => c.type === 'GUIDANCE')).toBe(true);
      const planRows = planSec9?.tables?.[0].rows || [];
      expect(planRows.every((r) => String(r[4]).includes('NOT_SUPPLIED'))).toBe(true);
    });

    it('does not fabricate assumptions in Strategy Section 6.0', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec6 = strategy.sections.find((s) => s.sectionNumber === '6.0');
      expect(sec6).toBeDefined();

      const tableRows = sec6?.tables?.[0]?.rows || [];
      // Must not fabricate "Steady-state equilibrium assumed across operational test windows"
      expect(tableRows.some((r) => String(r[1]).includes('Steady-state equilibrium assumed'))).toBe(false);

      // Must include PECP methodology guidance
      const guidanceCallout = sec6?.callouts?.find((c) => c.type === 'GUIDANCE');
      expect(guidanceCallout).toBeDefined();
      expect(guidanceCallout?.text).toContain('PECP Methodology Guidance');
    });

    it('documents fingerprint as non-cryptographic drift checksum', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const sec1 = strategy.sections.find((s) => s.sectionNumber === '1.0');
      const fpRow = sec1?.tables?.[0].rows.find((r) => r[0] === 'Contract Fingerprint');
      expect(fpRow?.[2]).toBe('Deterministic non-cryptographic drift checksum');
    });

    it('respects generation timestamp semantics with explicit timestamp or clock', () => {
      const fixedTime = '2026-11-20T14:30:00.000Z';
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        generationTimestamp: fixedTime
      });

      expect(strategy.generationTimestamp).toBe(fixedTime);
      const sec1 = strategy.sections.find((s) => s.sectionNumber === '1.0');
      const genRow = sec1?.tables?.[0].rows.find((r) => r[0] === 'Generated Date');
      expect(genRow?.[1]).toBe(fixedTime);

      const clockTime = '2026-12-01T09:00:00.000Z';
      const plan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE,
        clock: () => clockTime
      });

      expect(plan.generationTimestamp).toBe(clockTime);
    });

    it('does not invent abort thresholds in Section 14 or Section 15', () => {
      const strategy = generatePerformanceStrategy({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      const testPlan = generatePerformanceTestPlan({
        contract: postResolutionContract,
        intelligenceItems: RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
        projectSummary: RETAILCO_PROJECT_FIXTURE
      });

      // Strategy Section 15: no hardcoded "Error Rate > 5%" or "saturation > 95%"
      const stratSec15 = strategy.sections.find((s) => s.sectionNumber === '15.0');
      const govRows = stratSec15?.tables?.[0].rows || [];
      expect(govRows.some((r) => String(r[1]).includes('Error Rate > 5%'))).toBe(false);
      expect(govRows.some((r) => String(r[1]).includes('saturation > 95%'))).toBe(false);

      // Test Plan Section 14: PASS condition does not invent "< 1%" error budget when not in contract
      const planSec14 = testPlan.sections.find((s) => s.sectionNumber === '14.0');
      const evalRows = planSec14?.tables?.[0].rows || [];
      const passRow = evalRows.find((r) => r[0] === 'PASS');
      expect(passRow?.[2]).not.toContain('< 1%');
      expect(passRow?.[2]).toContain('Every defined canonical acceptance criterion passes');
    });
  });
});
