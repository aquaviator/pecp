// M4.3.1: Generic Non-RetailCo Regressions & Zero-Invention Fidelity Gate
// Defined according to docs/work-packages/M4_3_1_PORTAL_ZERO_INVENTION_CANONICAL_PROJECTION_REFERENCE_FIDELITY_GATE.md §§10-12
// Proves that no RetailCo values or UI-layer engineering fallbacks bleed into generic projects.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServiceProvider } from '../services/ServiceContext';
import { ResultsPage } from '../pages/project/ResultsPage';
import { FindingsPage } from '../pages/project/FindingsPage';
import { EvidencePage } from '../pages/project/EvidencePage';
import { ExecutionsPage } from '../pages/project/ExecutionsPage';
import { WorkloadProfileChart } from '../components/workload/WorkloadProfileChart';
import { ProjectSummary } from '../types';
import { ExecutionEvidenceState } from '../types';
import { ResultsReportVisualisationHook } from '@pecp/pe-domain';

const GENERIC_FINTECH_PROJECT: ProjectSummary = {
  id: 'proj-fintech-payment-switch',
  name: 'FinTech Payment Switch API',
  organization: 'GlobalPay',
  version: 'v2.1',
  status: 'ACTIVE',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-20T00:00:00Z'
};

const GENERIC_EVIDENCE_STATE_NO_DEFAULTS: ExecutionEvidenceState = {
  projectId: 'proj-fintech-payment-switch',
  hasExecuted: true,
  executionResult: {
    run: {
      executionRunId: 'run-payment-switch-44810',
      executionBundleFingerprint: 'fp-fintech-bundle-99',
      executionArtifactDigest: 'digest-fintech-artifact-1234',
      startedAt: '2026-09-22T10:00:00Z',
      completedAt: '2026-09-22T10:15:00Z',
      durationSeconds: 900
      // operationalStatus omitted -> must NOT default to COMPLETED
    } as any,
    metrics: {
      iterations: { count: 45000 },
      // pecpBusinessAttainmentEvents omitted -> must NOT default to 9671
      metricsData: {}
    } as any,
    thresholdObservations: []
  } as any,
  acceptanceEvaluation: {
    id: 'eval-fintech-44810',
    evaluationDigest: { algorithm: 'SHA-256', schemaVersion: 'v1', value: 'eval-digest-abc' },
    // overallVerdict omitted -> must NOT default to INCONCLUSIVE
    // workloadPrerequisite omitted -> must NOT default to UNRESOLVED
    criterionEvaluations: [
      {
        criterionId: 'crit-auth-latency',
        metric: 'Authorization Latency',
        observedValue: 42.5,
        // observedUnit omitted -> must NOT default to ms
        status: 'PASS',
        canonicalThresholdValue: 50,
        operator: '<'
      }
    ],
    verdictReasons: []
  } as any,
  findingsRegister: {
    id: 'findings-fintech-44810',
    registerDigest: { algorithm: 'SHA-256', schemaVersion: 'v1', value: 'findings-digest-abc' },
    // generationStatus omitted -> must NOT default to VALID
    findings: [
      {
        id: 'finding-custom-1',
        title: 'Custom Latency Warning',
        findingType: 'PERFORMANCE_CRITERIA_DEVIATION',
        // classification omitted -> must NOT default to GOVERNANCE
        status: 'OPEN',
        factualDescription: 'Custom telemetry observation',
        evidenceSourcePaths: ['custom.log']
      }
    ],
    defectCandidates: []
  } as any,
  evidencePackage: {
    id: 'pep-fintech-44810',
    packageDigest: { algorithm: 'SHA-256', schemaVersion: 'v1', value: 'pep-digest-abc' },
    // packageGenerationStatus omitted -> must NOT default to VALID
    components: [
      {
        componentType: 'PERFORMANCE_CONTRACT',
        canonicalId: 'contract-fintech-v2.1',
        version: 'v2.1',
        presenceStatus: 'PRESENT'
      },
      {
        componentType: 'RAW_EVIDENCE_INVENTORY',
        canonicalId: 'raw-fintech-44810',
        presenceStatus: 'PRESENT'
      }
    ],
    lineage: {
      edges: [
        {
          fromComponent: 'PERFORMANCE_CONTRACT',
          toComponent: 'TEST_DEFINITION',
          bindingType: 'SPECIFIES',
          verified: true
        }
      ]
    },
    rawEvidenceInventory: []
  } as any,
  publicationBundle: {
    id: 'bundle-fintech-44810',
    bundleDigest: { algorithm: 'SHA-256', schemaVersion: 'v1', value: 'bundle-digest-abc' },
    overallReadiness: 'READY',
    publicationReadiness: {
      DOWNLOAD: { status: 'READY', blockingReasons: [] }
      // Other destinations omitted -> must NOT invent them
    },
    artifacts: []
  } as any,
  resultsReport: {
    id: 'report-fintech-44810',
    reportDigest: 'report-digest-abc',
    workloadDemand: {
      businessDemand: 500,
      businessDemandUnit: 'tx/s',
      schedulerDemand: 500,
      schedulerDemandUnit: 'tx/s',
      schedulerPopulation: 'PAYMENT_TRANSACTION',
      executionModel: 'CLOSED'
    },
    scheduleTimings: {
      rampUpSeconds: 60,
      steadyStateSeconds: 780,
      rampDownSeconds: 60,
      totalDurationSeconds: 900
    },
    criterionOutcomes: [
      {
        key: 'crit-auth-latency',
        metric: 'Authorization Latency',
        observedValue: 42.5,
        status: 'PASS'
      }
    ],
    visualisationHook: {
      scheduler: {
        executionModel: 'CLOSED',
        population: 'PAYMENT_TRANSACTION',
        rateUnit: 'tx/s',
        startRate: 50,
        peakArrivalRate: 500
      },
      businessTarget: {
        metric: 'Target TPS',
        targetValue: 500,
        unit: 'tx/s',
        timeBasis: 'STEADY_STATE_PEAK'
      },
      stages: [
        {
          stageIndex: 1,
          name: 'Ramp-up',
          durationSeconds: 60,
          startTimeSeconds: 0,
          endTimeSeconds: 60,
          startArrivalRate: 50,
          targetArrivalRate: 500
        },
        {
          stageIndex: 2,
          name: 'Steady Peak',
          durationSeconds: 780,
          startTimeSeconds: 60,
          endTimeSeconds: 840,
          startArrivalRate: 500,
          targetArrivalRate: 500
        }
      ],
      journeyDistribution: [
        { journeyKey: 'card_auth', name: 'Card Authorization', weight: 0.7, percentage: 70 },
        { journeyKey: 'settlement', name: 'Settlement', weight: 0.3, percentage: 30 }
      ]
    }
  } as any,
  verifiedTestDefinition: null,
  contract: null,
  rawArtifactSummary: null
};

describe('M4.3.1 Section 10: Generic / Non-RetailCo Absence & Non-Bleed Regressions', () => {
  it('1. ResultsPage: does not bleed RetailCo identifiers or default verdicts when fields absent', () => {
    const rawHtml = renderToString(
      <ServiceProvider>
        <ResultsPage
          project={GENERIC_FINTECH_PROJECT}
          initialEvidenceState={GENERIC_EVIDENCE_STATE_NO_DEFAULTS}
        />
      </ServiceProvider>
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Must NOT bleed RetailCo-specific constants or strings
    expect(html).not.toContain('8.75');
    expect(html).not.toContain('109.375');
    expect(html).not.toContain('orders/second');
    expect(html).not.toContain('journey_iterations/second');
    expect(html).not.toContain('RetailCo');
    expect(html).not.toContain('pecp-ref-canonical-1789978991064');
    expect(html).not.toContain('test-def-proj-retailco-bf2026-v1.0');
    expect(html).not.toContain('contract-proj-retailco-bf26-v1.0-approved');
    expect(html).not.toContain('120,981');
    expect(html).not.toContain('9671');
    expect(html).not.toContain('35577599469');
    expect(html).not.toContain('76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82');

    // Must NOT default Acceptance verdict to INCONCLUSIVE when verdict is omitted
    expect(html).not.toContain('Canonical Acceptance Verdict: INCONCLUSIVE');
    expect(html).toContain('NOT_EVALUATED');

    // Must NOT default Workload Prerequisite to UNRESOLVED when omitted
    expect(html).not.toContain('UNRESOLVED');
    expect(html).toContain('Workload Prerequisite:');
    expect(html).toContain('NOT_SUPPLIED');

    // Must NOT default operational status to COMPLETED
    expect(html).not.toContain('EXECUTION_COMPLETED');
    expect(html).toContain('NOT_SUPPLIED');

    // Must NOT default criterion unit to ms when unit is omitted
    expect(html).not.toContain('42.5 ms');
    expect(html).toContain('42.5 NOT_SUPPLIED');

    // Projects supplied generic data correctly
    expect(html).toContain('run-payment-switch-44810');
    expect(html).toContain('500 tx/s');
    expect(html).toContain('Authorization Latency');
  });

  it('2. FindingsPage: does not default generation status, verdict, or classification', () => {
    const rawHtml = renderToString(
      <ServiceProvider>
        <FindingsPage
          project={GENERIC_FINTECH_PROJECT}
          initialEvidenceState={GENERIC_EVIDENCE_STATE_NO_DEFAULTS}
        />
      </ServiceProvider>
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Must NOT bleed RetailCo
    expect(html).not.toContain('RetailCo');
    expect(html).not.toContain('pecp-ref-canonical-1789978991064');

    // Must NOT default generationStatus to VALID when omitted
    expect(html).not.toContain('Status: VALID');
    expect(html).toContain('Status: NOT_SUPPLIED');

    // Must NOT default classification to GOVERNANCE when omitted
    expect(html).not.toContain('Class: GOVERNANCE');
    expect(html).toContain('Class: NOT_SUPPLIED');

    // Shows supplied generic findings correctly
    expect(html).toContain('findings-fintech-44810');
    expect(html).toContain('Custom Latency Warning');
    expect(html).toContain('PERFORMANCE_CRITERIA_DEVIATION');
  });

  it('3. EvidencePage: dynamically projects actual components and does not invent statuses', () => {
    const rawHtml = renderToString(
      <ServiceProvider>
        <EvidencePage
          project={GENERIC_FINTECH_PROJECT}
          initialEvidenceState={GENERIC_EVIDENCE_STATE_NO_DEFAULTS}
        />
      </ServiceProvider>
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Must NOT bleed RetailCo
    expect(html).not.toContain('RetailCo');
    expect(html).not.toContain('pecp-ref-canonical-1789978991064');
    expect(html).not.toContain('0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91');

    // Package status omitted -> must NOT default to VALID
    expect(html).not.toContain('Integrity: VALID');
    expect(html).toContain('Integrity: NOT_SUPPLIED');

    // Acceptance verdict omitted -> must NOT default to INCONCLUSIVE
    expect(html).not.toContain('INCONCLUSIVE');
    expect(html).toContain('NOT_EVALUATED');

    // Dynamically projects only present components (2 in this case)
    expect(html).toContain('Governed Evidence Package Components (2)');
    expect(html).toContain('PERFORMANCE CONTRACT');
    expect(html).toContain('RAW EVIDENCE INVENTORY');

    // Does NOT invent components that were not in the package
    expect(html).not.toContain('FINDINGS REGISTER');
    expect(html).not.toContain('EXECUTION RUN');
    expect(html).not.toContain('CANONICAL RESULTS = INGESTED');

    // Publication readiness: only supplied DOWNLOAD destination is rendered
    expect(html).toContain('DOWNLOAD');
    expect(html).not.toContain('CONFLUENCE');
    expect(html).not.toContain('SHAREPOINT');
  });

  it('4. ExecutionsPage: does not inject hardcoded RetailCo fallback metrics or IDs', () => {
    const rawHtml = renderToString(
      <ServiceProvider>
        <ExecutionsPage
          project={GENERIC_FINTECH_PROJECT}
          initialEvidenceState={GENERIC_EVIDENCE_STATE_NO_DEFAULTS}
        />
      </ServiceProvider>
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Must NOT bleed RetailCo
    expect(html).not.toContain('pecp-ref-canonical-1789978991064');
    expect(html).not.toContain('120,981');
    expect(html).not.toContain('9671');
    expect(html).not.toContain('35577599469');
    expect(html).not.toContain('76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82');

    // Shows supplied generic execution details
    expect(html).toContain('run-payment-switch-44810');
    expect(html).toContain('45,000');
    expect(html).toContain('15m 0s'); // 900s dynamically formatted
  });
});

describe('M4.3.1 Section 11: WorkloadProfileChart Project-Neutrality Regressions', () => {
  it('1. Renders governed absence for missing rate and business units without default fallback', () => {
    const hookWithoutUnits: ResultsReportVisualisationHook = {
      scheduler: {
        executionModel: 'OPEN',
        population: 'CUSTOM_EVENT',
        rateUnit: undefined as any, // missing unit -> must NOT default to journey_iterations/second or units/s
        startRate: 10,
        peakArrivalRate: 100
      },
      businessTarget: {
        metric: 'Target Throughput',
        targetValue: 50,
        unit: undefined as any, // missing unit -> must NOT default to orders/second
        timeBasis: 'STEADY_STATE_PEAK'
      },
      stages: [
        {
          stageIndex: 1,
          name: 'Stage 1',
          durationSeconds: 120,
          startTimeSeconds: 0,
          endTimeSeconds: 120,
          startArrivalRate: 10,
          targetArrivalRate: 100
        }
      ],
      journeyDistribution: [
        { journeyKey: 'event_a', name: 'Event A', weight: 0.6, percentage: 60 }
      ]
    };

    const rawHtml = renderToString(
      <WorkloadProfileChart
        visualisationHook={hookWithoutUnits}
        initialView="JOURNEY_STACKED"
        showBusinessDemandKpi={true}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Must NOT contain fallback units
    expect(html).not.toContain('units/s');
    expect(html).not.toContain('orders/second');
    expect(html).not.toContain('journey_iterations/second');

    // Governed absence rendered
    expect(html).toContain('NOT_SUPPLIED');

    // Incomplete journey distribution (60%) must NOT claim 100% Corroborated
    expect(html).not.toContain('100% Corroborated');
    expect(html).toContain('Journey distribution total:');
    expect(html).toContain('60%');
  });

  it('2. 100% journey distribution displays neutral statement and never claims corroboration without telemetry proof', () => {
    const hookFullDistribution: ResultsReportVisualisationHook = {
      scheduler: {
        executionModel: 'OPEN',
        population: 'JOB',
        rateUnit: 'jobs/s',
        startRate: 0,
        peakArrivalRate: 200
      },
      businessTarget: {
        metric: 'Target Job Rate',
        targetValue: 200,
        unit: 'jobs/s',
        timeBasis: 'STEADY_STATE_PEAK'
      },
      stages: [
        {
          stageIndex: 1,
          name: 'Peak',
          durationSeconds: 300,
          startTimeSeconds: 0,
          endTimeSeconds: 300,
          startArrivalRate: 0,
          targetArrivalRate: 200
        }
      ],
      journeyDistribution: [
        { journeyKey: 'job_a', name: 'Job Alpha', weight: 0.7, percentage: 70 },
        { journeyKey: 'job_b', name: 'Job Beta', weight: 0.3, percentage: 30 }
      ]
    };

    const rawHtml = renderToString(
      <WorkloadProfileChart
        visualisationHook={hookFullDistribution}
        initialView="JOURNEY_STACKED"
        showBusinessDemandKpi={true}
      />
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Neutral distribution wording
    expect(html).toContain('Journey distribution total:');
    expect(html).toContain('100%');
    expect(html).not.toContain('100% Corroborated');

    // Must NOT contain RetailCo relationship statement
    expect(html).not.toContain('8.75');
    expect(html).not.toContain('109.375');
    expect(html).not.toContain('Population Relationship Law');
  });

  it('3. Renders governed population relationship only when explicitly supplied in presentation data', () => {
    const hookCustom: ResultsReportVisualisationHook = {
      scheduler: {
        executionModel: 'OPEN',
        population: 'REQUEST',
        rateUnit: 'req/s',
        startRate: 0,
        peakArrivalRate: 1000
      },
      businessTarget: {
        metric: 'Target Demand',
        targetValue: 100,
        unit: 'req/s',
        timeBasis: 'STEADY_STATE_PEAK'
      },
      stages: [
        {
          stageIndex: 1,
          name: 'Stage 1',
          durationSeconds: 60,
          startTimeSeconds: 0,
          endTimeSeconds: 60,
          startArrivalRate: 0,
          targetArrivalRate: 1000
        }
      ],
      journeyDistribution: [
        { journeyKey: 'api', name: 'API Call', weight: 1.0, percentage: 100 }
      ]
    };

    // When NOT supplied:
    const htmlWithoutRelation = renderToString(
      <WorkloadProfileChart visualisationHook={hookCustom} />
    ).replace(/<!-- -->/g, '');
    expect(htmlWithoutRelation).not.toContain('Population Relationship Law');

    // When supplied via presentation data:
    const htmlWithRelation = renderToString(
      <WorkloadProfileChart
        visualisationHook={hookCustom}
        populationRelationshipText="Custom Law: 100 req/s business demand ÷ 10% API share = 1000 req/s scheduler arrival rate."
      />
    ).replace(/<!-- -->/g, '');
    expect(htmlWithRelation).toContain('Population Relationship Law');
    expect(htmlWithRelation).toContain('Custom Law: 100 req/s business demand ÷ 10% API share = 1000 req/s scheduler arrival rate.');
  });
});
