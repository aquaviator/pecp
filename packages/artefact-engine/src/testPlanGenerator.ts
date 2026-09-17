import {
  PerformanceContract,
  ProjectSummary,
  IntelligenceItem,
  EngineeringArtefact,
  ArtefactSection,
  ArtefactIssue,
  ArtefactTable,
  ArtefactCallout,
  ArtefactStatus,
  ArtefactSourceReference
} from '@pecp/pe-domain';
import { computeContractFingerprint } from './staleness.js';
import type { ArtefactGenerationOptions } from './strategyGenerator.js';

/**
 * Deterministically generates a structured Performance Test Plan artefact
 * from canonical Performance Contract, Project Summary, and Intelligence Items.
 * Adheres strictly to Constitution §5 & §8 and M2 requirements.
 */
export function generatePerformanceTestPlan(
  options: ArtefactGenerationOptions
): EngineeringArtefact {
  const {
    contract,
    intelligenceItems = [],
    projectSummary,
    generationTimestamp = contract.createdAt || '2026-09-16T00:00:00.000Z',
    artefactVersion = 'v0.1-draft',
    author = 'PECP Governance Engine',
    organisation = projectSummary?.organisation || 'Customer Organisation'
  } = options;

  const fingerprint = computeContractFingerprint(contract);
  const isBlocked =
    contract.status === 'BLOCKED' ||
    !contract.approvalReadiness.canApprove ||
    contract.approvalReadiness.blockingReasons.length > 0;

  const artefactStatus: ArtefactStatus = isBlocked ? 'BLOCKED' : 'READY_FOR_APPROVAL';

  // Map unresolved issues
  const unresolvedIssues: ArtefactIssue[] = [
    ...contract.unresolvedIssues.map((issue) => ({
      id: issue.id,
      title: `Unresolved Blocker: ${issue.parameter}`,
      description: issue.description,
      severity: issue.severity,
      category:
        issue.type === 'INVALID_JOURNEY_DISTRIBUTION' || issue.type === 'MISSING_PREREQUISITE'
          ? ('WORKLOAD' as const)
          : issue.type === 'AMBIGUOUS_SOURCE'
          ? ('ACCEPTANCE_CRITERIA' as const)
          : ('GOVERNANCE' as const),
      sourceIntelligenceId: issue.sourceIntelligenceId,
      remediationGuidance: issue.remediationGuidance
    }))
  ];

  const findByCategory = (cat: string) =>
    intelligenceItems.filter((i) => i.category === cat);

  const hasSuppliedContent = (items: IntelligenceItem[]) =>
    items.some((i) => i.canonicalState !== 'MISSING' && i.value !== undefined && i.value !== null && i.value !== '');

  const environmentItems = findByCategory('ENVIRONMENT');
  const testDataItems = findByCategory('TEST_DATA');
  const observabilityItems = findByCategory('OBSERVABILITY');

  const sections: ArtefactSection[] = [];

  // 1. Document Control
  const docControlTable: ArtefactTable = {
    id: 'table-testplan-doc-control',
    caption: 'Performance Test Plan Control & Binding',
    headers: ['Property', 'Value', 'Governance Role'],
    rows: [
      ['Document Title', `Performance Test Plan — ${contract.projectName}`, 'Must reflect project scope'],
      ['Artefact Version', artefactVersion, 'Version tracking'],
      ['Document Status', artefactStatus, isBlocked ? 'Blocked by unresolved upstream issues' : 'Ready for approval'],
      ['Generated Date', generationTimestamp, 'Deterministic timestamp'],
      ['Bound Performance Contract ID', contract.id, 'Upstream authoritative contract'],
      ['Bound Contract Version', contract.version, 'Must match contract version'],
      ['Contract Fingerprint', fingerprint, 'Drift detection digest'],
      ['Engineering Intent', contract.engineeringIntent, 'Authoritative PE intent'],
      ['Author / Generator', author, 'Governed generation engine'],
      ['Organisation', organisation, 'Owning organisation']
    ]
  };

  sections.push({
    id: 'sec-1-doc-control',
    sectionNumber: '1.0',
    title: 'Document Control & Governance',
    status: 'COMPLETE',
    summary: 'Governed test plan metadata and upstream contract binding.',
    paragraphs: [
      'This Performance Test Plan is deterministically generated from canonical project intelligence and the governed Performance Contract in accordance with Constitution §8.',
      'It defines execution targets, workload profiles, acceptance evaluation rules, and execution preconditions without introducing unverified assumptions.'
    ],
    tables: [docControlTable],
    callouts: isBlocked
      ? [
          {
            type: 'BLOCKER',
            text: `Upstream Performance Contract ${contract.id} (${contract.version}) is BLOCKED. This Performance Test Plan inherits the blocked state and cannot be executed for release certification until all blockers are remediated.`
          }
        ]
      : [
          {
            type: 'INFO',
            text: `Generated against valid Performance Contract ${contract.id} (${contract.version}).`
          }
        ]
  });

  // 2. Purpose and Scope
  sections.push({
    id: 'sec-2-purpose-scope',
    sectionNumber: '2.0',
    title: 'Purpose & Execution Scope',
    status: 'COMPLETE',
    summary: 'Operational purpose of the test plan and boundaries of execution.',
    paragraphs: [
      `The purpose of this Test Plan is to operationalize testing for ${contract.projectName} under the ${contract.engineeringIntent} intent.`,
      'The plan specifies the exact workload demand targets that must be sustained during test execution, the in-scope user journeys, and the pass/fail evaluation rules for non-functional criteria.'
    ]
  });

  // 3. Source Performance Contract
  const contractSummaryTable: ArtefactTable = {
    id: 'table-source-contract',
    caption: 'Bound Performance Contract Summary',
    headers: ['Contract Property', 'Value', 'Source Details'],
    rows: [
      ['Contract ID', contract.id, 'Canonical contract identifier'],
      ['Contract Version', contract.version, 'Target release gate version'],
      ['Contract Status', contract.status, isBlocked ? 'BLOCKED' : 'APPROVED'],
      ['Workload Readiness', contract.workloadReadiness.status, `${contract.workloadReadiness.blockingIssuesCount} blocking issues`],
      ['Approval Readiness', contract.approvalReadiness.canApprove ? 'CAN_APPROVE' : 'BLOCKED', `${contract.approvalReadiness.unresolvedIssuesCount} unresolved items`],
      ['Source References', `${contract.sourceIntelligenceReferences.length} items`, 'Governed intelligence items']
    ]
  };

  sections.push({
    id: 'sec-3-source-contract',
    sectionNumber: '3.0',
    title: 'Source Performance Contract',
    status: 'COMPLETE',
    summary: 'Direct reference to the authoritative Performance Contract governing this plan.',
    paragraphs: [
      'Every test activity in this plan derives its authoritative parameters from the bound Performance Contract below. Any modification to contract metrics requires re-compilation of this test plan.'
    ],
    tables: [contractSummaryTable]
  });

  // 4. Engineering Intent
  sections.push({
    id: 'sec-4-intent',
    sectionNumber: '4.0',
    title: 'Engineering Intent',
    status: 'COMPLETE',
    summary: `Primary engineering objective: ${contract.engineeringIntent}`,
    paragraphs: [
      `This test plan is formulated specifically for the ${contract.engineeringIntent} intent (Constitution §6).`,
      'Unlike exploratory testing, all test scenarios are designed to evaluate whether the system satisfies anticipated future operational demand without performance degradation or resource exhaustion.'
    ]
  });

  // 5. In-Scope Journeys / Transactions
  const journeyItem = intelligenceItems.find(
    (i) => i.key === 'journey_distribution' || i.title.toLowerCase().includes('journey')
  );
  let journeyRows: Array<Array<string | number | boolean>> = [];
  let journeyStatus: ArtefactSection['status'] = 'COMPLETE';

  if (journeyItem && journeyItem.value) {
    if (Array.isArray(journeyItem.value)) {
      journeyRows = journeyItem.value.map((j: { name: string; percentage: number }) => [
        j.name,
        `${j.percentage}%`,
        (j.percentage / 100).toFixed(2),
        'In Scope for Scripting'
      ]);
    }
  }

  if (journeyRows.length === 0) {
    journeyStatus = 'NOT_SUPPLIED';
  }

  sections.push({
    id: 'sec-5-journeys',
    sectionNumber: '5.0',
    title: 'In-Scope Journeys & User Workflows',
    status: journeyStatus,
    summary: 'User workflows, transaction paths, and relative mix proportions.',
    paragraphs: [
      journeyStatus === 'COMPLETE'
        ? 'The following user journeys are in scope for performance evaluation, weighted according to approved canonical distribution.'
        : 'User journey mix has not been supplied in canonical intelligence. Journey weights must be confirmed prior to test execution.'
    ],
    tables:
      journeyRows.length > 0
        ? [
            {
              id: 'table-testplan-journeys',
              caption: 'In-Scope User Journeys and Execution Weights',
              headers: ['Journey Name', 'Proportion (%)', 'Execution Weight', 'Scope Status'],
              rows: journeyRows
            }
          ]
        : undefined
  });

  // 6. Workload Model and Required Demand
  // M2 Requirement 5: Required workload demand belongs in workload / execution-attainment sections
  const demandRows: Array<Array<string | number | boolean>> = [];

  contract.workloadCalculations.forEach((c) => {
    demandRows.push([
      c.outputParameter,
      c.outputValue,
      c.unit,
      'Required Attainment Target',
      c.formulaIdentifier
    ]);
  });

  const demandCallouts: ArtefactCallout[] = [
    {
      type: 'INFO',
      text: 'Execution-Attainment Principle: Required workload demand represents the operational throughput that must be sustained during test execution. It is governed as workload demand and is distinct from NFR latency/error acceptance criteria.'
    }
  ];

  const blockedConcurrency = contract.blockedWorkloadCalculations.find(
    (b) => b.outputParameter === 'concurrent_sessions' || b.calculationId.includes('littles-law')
  );

  if (blockedConcurrency) {
    demandCallouts.push({
      type: 'BLOCKER',
      text: `Session Concurrency Target: BLOCKED. ${blockedConcurrency.reason} Engine refuses to guess concurrent virtual users without approved session arrival rates.`
    });
  }

  sections.push({
    id: 'sec-6-workload-demand',
    sectionNumber: '6.0',
    title: 'Workload Model & Required Demand',
    status: blockedConcurrency ? 'BLOCKED' : 'COMPLETE',
    summary: 'Operational throughput targets that must be attained during test execution.',
    paragraphs: [
      'A performance test run cannot be evaluated as PASS if the test harness fails to attain the required operational demand defined below.',
      'Throughput targets are derived from approved upstream intelligence and represent the steady-state transactional load.'
    ],
    tables: [
      {
        id: 'table-required-demand',
        caption: 'Authoritative Workload Demand Targets',
        headers: ['Parameter', 'Target Value', 'Unit', 'Role in Evaluation', 'Derivation Formula'],
        rows: demandRows
      }
    ],
    callouts: demandCallouts
  });

  // 7. Workload Calculations and Lineage
  const lineageRows = contract.workloadCalculations.map((c) => [
    c.calculationId,
    c.outputParameter,
    `${c.outputValue} ${c.unit}`,
    c.formulaIdentifier,
    c.humanReadableExplanation,
    c.timestamp
  ]);

  sections.push({
    id: 'sec-7-lineage',
    sectionNumber: '7.0',
    title: 'Workload Calculations & Mathematical Lineage',
    status: 'COMPLETE',
    summary: 'Auditable derivation steps and calculation provenance for all workload numbers.',
    paragraphs: [
      'In accordance with Constitution §7, every calculation step is deterministic and auditable. Unit conversions and Little\'s Law calculations preserve complete provenance.'
    ],
    tables: [
      {
        id: 'table-lineage-details',
        caption: 'Calculation Provenance and Mathematical Lineage',
        headers: ['Calculation ID', 'Output Parameter', 'Value', 'Formula Identifier', 'Explanation', 'Calculation Timestamp'],
        rows: lineageRows
      }
    ]
  });

  // 8. Performance Acceptance Criteria
  const criteriaRows = contract.acceptanceCriteria.map((c) => [
    c.id,
    c.metric,
    c.scope,
    c.target,
    c.operator || 'None',
    c.thresholdValue !== undefined ? c.thresholdValue : 'None',
    c.unit || 'None',
    c.percentile ? `p${c.percentile}` : 'MISSING',
    c.status,
    c.isBlockingForApproval ? 'BLOCKING' : 'NON_BLOCKING'
  ]);

  const ambiguousCriteria = contract.acceptanceCriteria.filter((c) => c.status === 'AMBIGUOUS');
  const criteriaCallouts: ArtefactCallout[] = [];

  if (ambiguousCriteria.length > 0) {
    ambiguousCriteria.forEach((ac) => {
      criteriaCallouts.push({
        type: 'BLOCKER',
        text: `Criterion "${ac.metric}" (${ac.id}) is AMBIGUOUS: ${ac.ambiguityNotice || 'Missing percentile specification (e.g. p95 or p99). Automated gate evaluation is blocked.'}`
      });
    });
  }

  sections.push({
    id: 'sec-8-acceptance-criteria',
    sectionNumber: '8.0',
    title: 'Performance Acceptance Criteria',
    status: ambiguousCriteria.length > 0 ? 'BLOCKED' : 'COMPLETE',
    summary: 'Quantitative criteria for release gate decisions.',
    paragraphs: [
      'Acceptance criteria specify the latency thresholds, error rate budgets, and throughput ceilings that determine whether a test run satisfies non-functional requirements.',
      'Note: Performance criteria are evaluated only when the required workload demand from Section 6.0 has been attained.'
    ],
    tables: [
      {
        id: 'table-testplan-criteria',
        caption: 'Governed Performance Acceptance Criteria',
        headers: ['ID', 'Metric', 'Scope', 'Target', 'Operator', 'Threshold', 'Unit', 'Percentile', 'Status', 'Gate Impact'],
        rows: criteriaRows
      }
    ],
    callouts: criteriaCallouts.length > 0 ? criteriaCallouts : undefined
  });

  // 9. Test Scenarios
  const peakThroughputCalc = contract.workloadCalculations.find(
    (c) => c.outputParameter === 'order_throughput_per_second'
  );
  const throughputText = peakThroughputCalc
    ? `${peakThroughputCalc.outputValue} ${peakThroughputCalc.unit}`
    : 'Approved target throughput';

  const scenariosTable: ArtefactTable = {
    id: 'table-scenarios',
    caption: 'Defined Execution Scenarios',
    headers: ['Scenario ID', 'Scenario Name', 'Workload Target', 'Ramp Profile', 'Steady State', 'Evaluation Goal'],
    rows: [
      [
        'SCEN-01',
        'Baseline Health Calibration',
        'Low load (single user)',
        'Immediate',
        '10 mins',
        'Verify zero script errors and baseline response times'
      ],
      [
        'SCEN-02',
        'Peak Load Capacity Test',
        `100% Demand (${throughputText})`,
        '15 min stepped ramp',
        '60 mins',
        'Validate all defined acceptance criteria at full projected volume'
      ],
      [
        'SCEN-03',
        'Soak / Endurance Test',
        `80% - 100% Demand (${throughputText})`,
        '15 min ramp',
        '4 hours',
        'Detect memory leakage, pool exhaustion, and slow degradation'
      ],
      [
        'SCEN-04',
        'Stress / Headroom Discovery',
        'Stepped 120% -> 150% demand',
        '10% steps every 10 mins',
        'Until saturation',
        'Determine breaking threshold and graceful degradation cliff'
      ]
    ]
  };

  sections.push({
    id: 'sec-9-scenarios',
    sectionNumber: '9.0',
    title: 'Test Scenarios & Workload Schedules',
    status: 'COMPLETE',
    summary: 'Structured execution schedules for evaluating system stability across operational profiles.',
    paragraphs: [
      'Scenarios are designed to exercise the system through controlled workload ramps, sustained steady states, and saturation sweeps.',
      'Note (M2 Scope): Executable test scripts (e.g. k6) are not generated in this work package. Script generation will occur in M3 following contract approval.'
    ],
    tables: [scenariosTable]
  });

  // 10. Environment
  const envParagraphs: string[] = [];
  const envCallouts: ArtefactCallout[] = [];
  let envStatus: ArtefactSection['status'] = 'COMPLETE';

  if (hasSuppliedContent(environmentItems)) {
    environmentItems.forEach((item) => {
      envParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Defined'} (${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else {
    envStatus = 'NOT_SUPPLIED';
    envParagraphs.push(
      'Target test environment infrastructure, hardware scaling ratios, and database configuration have not been supplied in canonical intelligence.'
    );
    envCallouts.push({
      type: 'WARNING',
      text: 'Environment configuration unresolved. Test execution cannot proceed without a verified target environment specification.'
    });
  }

  sections.push({
    id: 'sec-10-environment',
    sectionNumber: '10.0',
    title: 'Environment & Infrastructure Setup',
    status: envStatus,
    summary: 'Target environment topology and deployment prerequisites.',
    paragraphs: envParagraphs,
    callouts: envCallouts.length > 0 ? envCallouts : undefined,
    sourceIntelligenceIds: environmentItems.map((i) => i.id)
  });

  // 11. Test Data
  const dataParagraphs: string[] = [];
  const dataCallouts: ArtefactCallout[] = [];
  let dataStatus: ArtefactSection['status'] = 'COMPLETE';

  if (hasSuppliedContent(testDataItems)) {
    testDataItems.forEach((item) => {
      dataParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Defined'} (${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else {
    dataStatus = 'NOT_SUPPLIED';
    dataParagraphs.push(
      'Test data volumes, synthetic user account pools, SKU inventory counts, and credential partitions have not been supplied in canonical intelligence.'
    );
    dataCallouts.push({
      type: 'WARNING',
      text: 'Test data strategy unresolved. Synthetic account datasets must be provisioned before test execution.'
    });
  }

  sections.push({
    id: 'sec-11-test-data',
    sectionNumber: '11.0',
    title: 'Test Data & Synthetic Datasets',
    status: dataStatus,
    summary: 'Data volume requirements, credential pooling, and data isolation.',
    paragraphs: dataParagraphs,
    callouts: dataCallouts.length > 0 ? dataCallouts : undefined,
    sourceIntelligenceIds: testDataItems.map((i) => i.id)
  });

  // 12. Observability / Evidence Collection
  const obsParagraphs: string[] = [];
  const obsCallouts: ArtefactCallout[] = [];
  let obsStatus: ArtefactSection['status'] = 'COMPLETE';

  if (hasSuppliedContent(observabilityItems)) {
    observabilityItems.forEach((item) => {
      obsParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Configured'} (${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else {
    obsStatus = 'NOT_SUPPLIED';
    obsParagraphs.push(
      'Observability agents, APM distributed tracing configurations, and server utilization metric endpoints have not been supplied in canonical intelligence.'
    );
    obsCallouts.push({
      type: 'WARNING',
      text: 'Evidence collection tooling unresolved. Observability collectors must be mapped to enable automated gate evaluation and root cause diagnostic tracing.'
    });
  }

  sections.push({
    id: 'sec-12-observability',
    sectionNumber: '12.0',
    title: 'Observability & Evidence Collection',
    status: obsStatus,
    summary: 'Telemetry collection, APM tracing, and diagnostic metric aggregation.',
    paragraphs: obsParagraphs,
    callouts: obsCallouts.length > 0 ? obsCallouts : undefined,
    sourceIntelligenceIds: observabilityItems.map((i) => i.id)
  });

  // 13. Execution Preconditions
  const preconditionsTable: ArtefactTable = {
    id: 'table-preconditions',
    caption: 'Mandatory Execution Preconditions',
    headers: ['Prerequisite Category', 'Requirement', 'Verification Method'],
    rows: [
      ['Contract Approval', 'Performance Contract formally approved (not BLOCKED)', 'PECP governance check'],
      ['Blocker Resolution', 'Zero active blocking issues in canonical model', 'Automated readiness gate'],
      ['Environment Readiness', 'Target environment healthy, baseline latency verified', 'Ping / smoke test check'],
      ['Test Data Provisioning', 'Synthetic accounts seeded and validated', 'Account login smoke test'],
      ['Observability Readiness', 'APM tracing collectors receiving active telemetry', 'Collector heartbeat verify']
    ]
  };

  sections.push({
    id: 'sec-13-preconditions',
    sectionNumber: '13.0',
    title: 'Execution Preconditions & Readiness Gates',
    status: 'COMPLETE',
    summary: 'Mandatory prerequisites required before initiating performance test runs.',
    paragraphs: [
      'To prevent invalid runs and false performance evidence, execution is blocked until all preconditions below are certified.'
    ],
    tables: [preconditionsTable]
  });

  // 14. Pass / Fail / Inconclusive Rules
  const evaluationRulesTable: ArtefactTable = {
    id: 'table-eval-rules',
    caption: 'Governed Test Run Evaluation Rules (Constitution §13)',
    headers: ['Evaluation Verdict', 'Governed Definition', 'Required Evidence Condition'],
    rows: [
      [
        'PASS',
        'System satisfies all non-functional acceptance criteria under required workload demand.',
        '1. Required workload demand achieved.\n2. All defined acceptance criteria pass.\n3. Error rate within budget (< 1%).\n4. Infrastructure within saturation ceilings.'
      ],
      [
        'FAIL',
        'System breached one or more acceptance criteria under required workload demand.',
        '1. Required workload demand achieved.\n2. One or more acceptance criteria breached (e.g. latency ceiling exceeded).'
      ],
      [
        'PASS_WITH_OBSERVATION',
        'Core criteria passed, but sub-critical anomalies observed.',
        '1. Required demand achieved.\n2. Primary criteria passed.\n3. Non-blocking observation noted (e.g. temporary queue spike).'
      ],
      [
        'INCONCLUSIVE',
        'Test run could not be authoritatively evaluated.',
        '1. Required workload demand was NOT attained (e.g. test harness bottleneck, cloud throttling).\n2. Unhandled test script abort or network failure.\n3. Acceptance criteria ambiguous or non-evaluable.'
      ]
    ]
  };

  sections.push({
    id: 'sec-14-eval-rules',
    sectionNumber: '14.0',
    title: 'Pass / Fail / Inconclusive Evaluation Rules',
    status: 'COMPLETE',
    summary: 'Strict classification rules for test run outcomes.',
    paragraphs: [
      'In PECP, test runs are classified according to strict evidentiary rules. A run where the load generator failed to deliver the required demand cannot be graded as PASS or FAIL—it is strictly INCONCLUSIVE.'
    ],
    tables: [evaluationRulesTable]
  });

  // 15. Risks / Assumptions / Blockers
  const blockerRows: Array<Array<string | number | boolean>> = [];

  contract.unresolvedIssues.forEach((issue) => {
    blockerRows.push([
      issue.id,
      issue.parameter,
      issue.severity,
      issue.description,
      issue.remediationGuidance
    ]);
  });

  contract.approvalReadiness.blockingReasons.forEach((reason, idx) => {
    if (!blockerRows.some((r) => r[3] === reason)) {
      blockerRows.push([
        `BLK-REASON-${idx + 1}`,
        'Approval Blocker',
        'BLOCKING',
        reason,
        'Resolve in canonical intelligence before proceeding to execution.'
      ]);
    }
  });

  sections.push({
    id: 'sec-15-risks-blockers',
    sectionNumber: '15.0',
    title: 'Risks, Assumptions & Execution Blockers',
    status: blockerRows.length > 0 ? 'BLOCKED' : 'COMPLETE',
    summary: 'Active blockers preventing test plan approval and execution.',
    paragraphs: [
      blockerRows.length > 0
        ? `This Performance Test Plan carries ${blockerRows.length} active blocker(s). Execution is prohibited until these blockers are remediated.`
        : 'All execution blockers have been resolved.'
    ],
    tables:
      blockerRows.length > 0
        ? [
            {
              id: 'table-testplan-blockers',
              caption: 'Active Execution Blockers and Remediation Guidance',
              headers: ['ID', 'Topic', 'Severity', 'Description', 'Required Remediation'],
              rows: blockerRows
            }
          ]
        : undefined,
    callouts:
      blockerRows.length > 0
        ? [
            {
              type: 'BLOCKER',
              text: 'Test execution is BLOCKED. Upstream intelligence gaps must be resolved in the canonical model.'
            }
          ]
        : undefined
  });

  // 16. Traceability
  const traceRows = contract.sourceIntelligenceReferences.map((ref) => {
    const fullItem = intelligenceItems.find((i) => i.id === ref.id);
    return [
      ref.id,
      ref.key,
      ref.title,
      ref.canonicalState,
      ref.reviewStatus,
      fullItem?.sourceDocument || 'Project Repository',
      fullItem?.sourceLocation || 'Canonical Model'
    ];
  });

  sections.push({
    id: 'sec-16-traceability',
    sectionNumber: '16.0',
    title: 'Traceability Matrix',
    status: 'COMPLETE',
    summary: 'Full bidirectional traceability to canonical intelligence.',
    paragraphs: [
      'Every test parameter, workload rate, and evaluation criterion traces directly to canonical intelligence items below.'
    ],
    tables: [
      {
        id: 'table-testplan-traceability',
        caption: 'Canonical Traceability Matrix',
        headers: ['Item ID', 'Key', 'Title', 'Canonical State', 'Review Status', 'Source Document', 'Source Location'],
        rows: traceRows
      }
    ]
  });

  const sourceRefs: ArtefactSourceReference[] = contract.sourceIntelligenceReferences.map((ref) => {
    const fullItem = intelligenceItems.find((i) => i.id === ref.id);
    return {
      id: ref.id,
      key: ref.key,
      title: ref.title,
      canonicalState: ref.canonicalState,
      reviewStatus: ref.reviewStatus,
      sourceDocument: fullItem?.sourceDocument,
      sourceLocation: fullItem?.sourceLocation
    };
  });

  return {
    id: `plan-${contract.projectId}-${artefactVersion}`,
    projectId: contract.projectId,
    projectName: contract.projectName,
    type: 'PERFORMANCE_TEST_PLAN',
    title: `Performance Test Plan — ${contract.projectName}`,
    version: artefactVersion,
    status: artefactStatus,
    engineeringIntent: contract.engineeringIntent,
    sourceContractId: contract.id,
    sourceContractVersion: contract.version,
    sourceContractFingerprint: fingerprint,
    sourceIntelligenceReferences: sourceRefs,
    generationTimestamp,
    sections,
    unresolvedIssues,
    approvalReadiness: {
      canApprove: !isBlocked,
      status: artefactStatus,
      blockingReasons: isBlocked ? [...contract.approvalReadiness.blockingReasons] : [],
      unresolvedIssuesCount: unresolvedIssues.length
    },
    metadata: {
      author,
      organisation,
      classification: 'Commercial Confidential / Engineering Governance',
      targetAudience: 'Performance Engineers, QA Leads, Platform Operations',
      governanceGate: 'M2 Artefact Review'
    }
  };
}
