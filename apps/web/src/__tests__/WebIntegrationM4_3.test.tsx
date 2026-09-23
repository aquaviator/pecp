// M4.3: Execution-to-Evidence Portal & Workload Visualisation Integration Tests
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServiceProvider } from '../services/ServiceContext';
import { ResultsPage } from '../pages/project/ResultsPage';
import { FindingsPage } from '../pages/project/FindingsPage';
import { EvidencePage } from '../pages/project/EvidencePage';
import { ExecutionsPage } from '../pages/project/ExecutionsPage';
import { WorkloadProfileChart } from '../components/workload/WorkloadProfileChart';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import { AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE } from '../fixtures/retailco/authoritativeRetailCoExecutionEvidence';

describe('Web Integration: M4.3 Execution-to-Evidence Portal', () => {
  describe('1. ResultsPage — Governed Execution Results & Acceptance Law', () => {
    it('renders authoritative RetailCo run with INCONCLUSIVE acceptance and UNRESOLVED workload prerequisite', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <ResultsPage
            project={RETAILCO_PROJECT_FIXTURE}
            initialEvidenceState={AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // Run and identity
      expect(html).toContain('pecp-ref-canonical-1789978991064');
      expect(html).toContain('EXECUTION_COMPLETED');

      // Acceptance verdict: MUST be INCONCLUSIVE, NEVER PASS or FAIL
      expect(html).toContain('Canonical Acceptance Verdict:');
      expect(html).toContain('INCONCLUSIVE');

      // Workload prerequisite: MUST be UNRESOLVED
      expect(html).toContain('Workload Prerequisite:');
      expect(html).toContain('UNRESOLVED');
      expect(html).toContain('UNRESOLVED_INSUFFICIENT_TIME_SERIES');

      // Workload Prerequisite Law callout
      expect(html).toContain('Workload Prerequisite Law');

      // Criteria Evaluations table
      expect(html).toContain('Contract Performance Criteria Evaluations');
      expect(html).toContain('ac-checkout-latency');
      expect(html).toContain('0.3906885');
      expect(html).toContain('PASS');
      expect(html).toContain('ac-global-error-rate');

      // Business Target vs Scheduler Peak separation in Workload Profile
      expect(html).toContain('8.75 orders/second');
      expect(html).toContain('109.375 journey_iterations/second');
      expect(html).toContain('JOURNEY_ITERATION');
      expect(html).toContain('OPEN');

      // Population Relationship Law
      expect(html).toContain('Population Relationship Law');
      expect(html).toContain('8.75 orders/second business demand ÷ 8% checkout journey share = 109.375');

      // Corroboration and Data Integrity
      expect(html).toContain('120,981');
      expect(html).toContain('9671');
      expect(html).toContain('100% Corroborated');
    });

    it('renders clean governed empty state when no execution run exists', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <ResultsPage
            project={{ ...RETAILCO_PROJECT_FIXTURE, id: 'proj-empty' }}
            initialEvidenceState={{
              projectId: 'proj-empty',
              hasExecuted: false,
              executionResult: null,
              acceptanceEvaluation: null,
              findingsRegister: null,
              evidencePackage: null,
              publicationBundle: null,
              resultsReport: null,
              verifiedTestDefinition: null,
              contract: null,
              rawArtifactSummary: null
            }}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('No Test Execution Runs Ingested Yet');
    });
  });

  describe('2. FindingsPage — Governed Findings & Defect Eligibility Law', () => {
    it('renders exact single governance finding and enforces 0 eligible defect candidates', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <FindingsPage
            project={RETAILCO_PROJECT_FIXTURE}
            initialEvidenceState={AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // Register header
      expect(html).toContain(AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE.findingsRegister.id);
      expect(html).toContain('Total Governed Findings');
      expect(html).toContain('Eligible Defect Candidates');

      // Finding: Workload Attainment Unresolved
      expect(html).toContain('WORKLOAD_ATTAINMENT_UNRESOLVED');
      expect(html).toContain('GOVERNANCE');

      // Defect Eligibility Law: Inconclusive test CANNOT emit defect candidates
      expect(html).toContain('0 Defect Candidates Eligible for Publication');
      expect(html).toContain('Defect Eligibility Law');
    });

    it('renders clean empty state for unexecuted project', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <FindingsPage
            project={{ ...RETAILCO_PROJECT_FIXTURE, id: 'proj-empty' }}
            initialEvidenceState={{
              projectId: 'proj-empty',
              hasExecuted: false,
              executionResult: null,
              acceptanceEvaluation: null,
              findingsRegister: null,
              evidencePackage: null,
              publicationBundle: null,
              resultsReport: null,
              verifiedTestDefinition: null,
              contract: null,
              rawArtifactSummary: null
            }}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('No Findings Ingested Yet');
    });
  });

  describe('3. EvidencePage — Package Validity vs Acceptance Separation & Lineage', () => {
    it('renders VALID package integrity alongside INCONCLUSIVE acceptance verdict', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <EvidencePage
            project={RETAILCO_PROJECT_FIXTURE}
            initialEvidenceState={AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // Package Identity
      expect(html).toContain(AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE.evidencePackage.id);

      // Crucial separation: Package Integrity is VALID, Acceptance Verdict is INCONCLUSIVE
      expect(html).toContain('Evidence Package Integrity');
      expect(html).toContain('VALID');
      expect(html).toContain('Acceptance Verdict');
      expect(html).toContain('INCONCLUSIVE');
      expect(html).toContain('proves cryptographic integrity');
      expect(html).toContain('mean the performance test passed');

      // Six mandatory component lineages
      expect(html).toContain('Six Mandatory Evidence Lineage Components');
      expect(html).toContain('1. Performance Contract');
      expect(html).toContain('2. Verified Test Definition');
      expect(html).toContain('3. Execution Run &amp; Ingress');
      expect(html).toContain('4. Raw Runner Telemetry Artifacts');
      expect(html).toContain('5. Canonical Execution Results');
      expect(html).toContain('6. Acceptance Evaluation &amp; Findings');

      // Publication Readiness matrix
      expect(html).toContain('Governed Publication Readiness &amp; Export Destinations');
      expect(html).toContain('DOWNLOAD');
      expect(html).toContain('API');
      expect(html).toContain('CONFLUENCE');
      expect(html).toContain('BLOCKED');

      // Download Action buttons
      expect(html).toContain('Evidence Package JSON');
      expect(html).toContain('Results Report JSON');
      expect(html).toContain('Findings Register JSON');
      expect(html).toContain('Publication Bundle JSON');
    });
  });

  describe('4. ExecutionsPage — Customer-Controlled Runner Status', () => {
    it('renders customer-controlled runner execution metrics and provenance', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <ExecutionsPage
            project={RETAILCO_PROJECT_FIXTURE}
            initialEvidenceState={AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('pecp-ref-canonical-1789978991064');
      expect(html).toContain('k6 v0.54.0');
      expect(html).toContain('Exit Code: 0');
      expect(html).toContain('120,981');
      expect(html).toContain('9,671');
      expect(html).toContain('35577599469');
      expect(html).toContain('76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82');
    });
  });

  describe('5. WorkloadProfileChart — Visualisation Fidelity', () => {
    it('renders workload profile chart with full stage and journey mix information', () => {
      const hook = AUTHORITATIVE_RETAILCO_EXECUTION_EVIDENCE.resultsReport!.visualisationHook;
      const rawHtml = renderToString(
        <WorkloadProfileChart visualisationHook={hook} showBusinessDemandKpi={true} />
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // Business Demand vs Scheduler Peak Separation
      expect(html).toContain('8.75 orders/second');
      expect(html).toContain('109.375 journey_iterations/second');
      expect(html).toContain('JOURNEY_ITERATION');
      expect(html).toContain('OPEN');

      // View Buttons
      expect(html).toContain('Scheduler Profile');
      expect(html).toContain('Journey Mix (Stacked)');
      expect(html).toContain('Schedule Table');

      // Schedule boundaries
      expect(html).toContain('Steady Peak: 109.375 journey_iterations/second');
      expect(html).toContain('Total: 1320s');
    });

    it('renders absence notice when visualisation hook is null or empty', () => {
      const rawHtml = renderToString(<WorkloadProfileChart visualisationHook={null} />);
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('No Governed Workload Schedule Available to Visualise');
      expect(html).toContain('PECP never fabricates synthetic load profiles');
    });
  });
});
