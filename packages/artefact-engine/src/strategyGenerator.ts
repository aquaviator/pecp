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

export interface ArtefactGenerationOptions {
  contract: PerformanceContract;
  intelligenceItems?: IntelligenceItem[];
  projectSummary?: ProjectSummary;
  /**
   * Explicit ISO timestamp representing the artefact generation event.
   * If not provided, clock() will be called to capture the generation time.
   */
  generationTimestamp?: string;
  /**
   * Optional clock function returning an ISO timestamp string.
   * Used when generationTimestamp is omitted.
   */
  clock?: () => string;
  artefactVersion?: string;
  author?: string;
  organisation?: string;
}

/**
 * Deterministically generates a structured Performance Strategy artefact
 * from canonical Performance Contract, Project Summary, and Intelligence Items.
 * Adheres strictly to Constitution §5 & §8 and M2 requirements.
 */
export function generatePerformanceStrategy(
  options: ArtefactGenerationOptions
): EngineeringArtefact {
  const {
    contract,
    intelligenceItems = [],
    projectSummary,
    artefactVersion = 'v0.1-draft',
    author = 'PECP Governance Engine',
    organisation = projectSummary?.organisation || 'Customer Organisation'
  } = options;

  const generationTimestamp =
    options.generationTimestamp ??
    (options.clock ? options.clock() : new Date().toISOString());

  const fingerprint = computeContractFingerprint(contract);
  const isBlocked =
    contract.status === 'BLOCKED' ||
    !contract.approvalReadiness.canApprove ||
    contract.approvalReadiness.blockingReasons.length > 0;

  const artefactStatus: ArtefactStatus = isBlocked ? 'BLOCKED' : 'READY_FOR_APPROVAL';

  // Map unresolved issues from contract to artefact issues
  const unresolvedIssues: ArtefactIssue[] = [
    ...contract.unresolvedIssues.map((issue) => ({
      id: issue.id,
      title: `Unresolved Issue: ${issue.parameter}`,
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

  // Helper to find intelligence by category
  const findByCategory = (cat: string) =>
    intelligenceItems.filter((i) => i.category === cat);

  const hasSuppliedContent = (items: IntelligenceItem[]) =>
    items.some((i) => i.canonicalState !== 'MISSING' && i.value !== undefined && i.value !== null && i.value !== '');

  const businessContextItems = findByCategory('BUSINESS_CONTEXT');
  const architectureItems = findByCategory('ARCHITECTURE');
  const environmentItems = findByCategory('ENVIRONMENT');
  const testDataItems = findByCategory('TEST_DATA');
  const observabilityItems = findByCategory('OBSERVABILITY');

  const sections: ArtefactSection[] = [];

  // 1. Document Control
  const docControlTable: ArtefactTable = {
    id: 'table-doc-control',
    caption: 'Document Governance & Upstream Contract Binding',
    headers: ['Property', 'Value', 'Governance Rule'],
    rows: [
      ['Document Title', `Performance Strategy — ${contract.projectName}`, 'Must match project name'],
      ['Artefact Version', artefactVersion, 'Incremented upon revision'],
      ['Document Status', artefactStatus, isBlocked ? 'Carries blocking upstream issues' : 'Ready for review'],
      ['Generated Date', generationTimestamp, 'Deterministic timestamp'],
      ['Bound Performance Contract ID', contract.id, 'Authoritative upstream source'],
      ['Bound Contract Version', contract.version, 'Must match contract version'],
      ['Contract Fingerprint', fingerprint, 'Deterministic non-cryptographic drift checksum'],
      ['Engineering Intent', contract.engineeringIntent, 'Authoritative PE intent (Constitution §6)'],
      ['Author / Generator', author, 'Governed engine compilation'],
      ['Organisation', organisation, 'Owning organisation']
    ]
  };

  sections.push({
    id: 'sec-1-doc-control',
    sectionNumber: '1.0',
    title: 'Document Control & Governance',
    status: 'COMPLETE',
    summary:
      'Governed document metadata and authoritative binding to upstream canonical Performance Contract.',
    paragraphs: [
      'This document is a deterministic view compiled from the canonical Performance Engineering model in accordance with PECP Constitution §5 and §8.',
      'Documents in PECP do not constitute an independent or competing source of truth. All metrics, workload demands, assumptions, and acceptance criteria are bound to the upstream Performance Contract specified below.'
    ],
    tables: [docControlTable],
    callouts: isBlocked
      ? [
          {
            type: 'BLOCKER',
            text: `Upstream Performance Contract ${contract.id} (${contract.version}) is currently BLOCKED. This Performance Strategy inherits this blocked status and cannot be formally approved until all blocking issues are resolved.`
          }
        ]
      : [
          {
            type: 'INFO',
            text: `Compiled against valid Performance Contract ${contract.id} (${contract.version}).`
          }
        ]
  });

  // 2. Executive / Business Context
  const businessParagraphs: string[] = [];
  if (projectSummary?.description) {
    businessParagraphs.push(projectSummary.description);
  }
  if (businessContextItems.length > 0) {
    businessContextItems.forEach((item) => {
      businessParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Defined'} (${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else if (!projectSummary?.description) {
    businessParagraphs.push(
      'Detailed commercial context has not been explicitly supplied in canonical project intelligence.'
    );
  }

  sections.push({
    id: 'sec-2-business-context',
    sectionNumber: '2.0',
    title: 'Executive & Business Context',
    status: businessContextItems.length > 0 || projectSummary?.description ? 'COMPLETE' : 'NOT_SUPPLIED',
    summary: 'Commercial objectives, business horizons, and performance objectives.',
    paragraphs: businessParagraphs,
    sourceIntelligenceIds: businessContextItems.map((i) => i.id)
  });

  // 3. Performance Engineering Intent
  const intentExplanations: Record<string, string> = {
    FORECAST:
      'The engineering intent of this engagement is FORECAST (Constitution §6): "What future workload should we prepare for?" Sizing capacity targets, identifying architectural bottlenecks, and evaluating headroom for anticipated commercial volume.',
    REPRESENTATIVE:
      'The engineering intent is REPRESENTATIVE (Constitution §6): "What does the live system actually do?" Modeling and replicating realistic production workload profiles.',
    DISCOVERY:
      'The engineering intent is DISCOVERY (Constitution §6): "What can this system handle?" Finding breaking points, resource saturation limits, and non-linear degradation cliffs.',
    INVESTIGATIVE:
      'The engineering intent is INVESTIGATIVE (Constitution §6): "Can we reproduce and isolate a performance problem?" Pinpointing root causes of observed system degradation.',
    CERTIFICATION:
      'The engineering intent is CERTIFICATION (Constitution §6): "Does this release satisfy agreed performance requirements?" Validating deployment readiness against non-negotiable criteria.'
  };

  sections.push({
    id: 'sec-3-intent',
    sectionNumber: '3.0',
    title: 'Performance Engineering Intent',
    status: 'COMPLETE',
    summary: `Primary engineering purpose: ${contract.engineeringIntent}`,
    paragraphs: [
      intentExplanations[contract.engineeringIntent] ||
        `Engineering intent is set to ${contract.engineeringIntent}.`,
      'Traditional testing types (load, stress, endurance, spike) are organized beneath this engineering intent to ensure testing activities directly answer commercial objectives rather than executing arbitrary tests.'
    ]
  });

  // 4. Scope
  const inScopeInputs = contract.workloadInputs;
  const inScopeCriteria = contract.acceptanceCriteria;
  const scopeRows = [
    ...inScopeInputs.map((input) => [
      'Workload Target',
      input.title,
      `${input.value} ${input.unit}`,
      input.canonicalState,
      input.sourceDocument || input.sourceId
    ]),
    ...inScopeCriteria.map((crit) => [
      'Acceptance Criterion',
      crit.metric,
      `${crit.scope}: ${crit.target}`,
      crit.status,
      crit.sourceIntelligenceId || 'Contract'
    ])
  ];

  sections.push({
    id: 'sec-4-scope',
    sectionNumber: '4.0',
    title: 'Scope & Transactional Boundaries',
    status: scopeRows.length > 0 ? 'COMPLETE' : 'NOT_SUPPLIED',
    summary: 'System boundaries, transactional journeys, and evaluative targets included in this strategy.',
    paragraphs: [
      'The scope of this Performance Strategy encompasses the transactional endpoints, critical user journeys, and architectural boundaries for which canonical intelligence and performance criteria have been declared.'
    ],
    tables:
      scopeRows.length > 0
        ? [
            {
              id: 'table-scope-items',
              caption: 'In-Scope Performance Evaluative Targets',
              headers: ['Scope Type', 'Component / Journey', 'Target / Bound', 'Status', 'Provenance Reference'],
              rows: scopeRows
            }
          ]
        : undefined
  });

  // 5. System / Architecture Context
  const archParagraphs: string[] = [];
  const archCallouts: ArtefactCallout[] = [];
  let archStatus: ArtefactSection['status'] = 'COMPLETE';

  if (architectureItems.length > 0) {
    architectureItems.forEach((item) => {
      archParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Configured'} (Source: ${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else {
    archStatus = 'NOT_SUPPLIED';
    archParagraphs.push(
      'System topology, architecture specifications, hosting boundaries, and external integration points have not been supplied in canonical project intelligence.'
    );
    archCallouts.push({
      type: 'WARNING',
      text: 'No architecture assumptions have been fabricated. Infrastructure sizing and dependency bottlenecks must be evaluated once architecture specifications are supplied.'
    });
  }

  sections.push({
    id: 'sec-5-architecture',
    sectionNumber: '5.0',
    title: 'System & Architecture Context',
    status: archStatus,
    summary: 'Architectural tiers, microservices topology, database pooling, and network boundaries.',
    paragraphs: archParagraphs,
    callouts: archCallouts.length > 0 ? archCallouts : undefined,
    sourceIntelligenceIds: architectureItems.map((i) => i.id)
  });

  // 6. Performance Risks and Assumptions
  const riskCallouts: ArtefactCallout[] = [];
  const assumptionsList: string[] = [];

  contract.workloadCalculations.forEach((c) => {
    if (c.assumptions && c.assumptions.length > 0) {
      assumptionsList.push(...c.assumptions);
    }
  });

  const assumptionRows = assumptionsList.map((a, idx) => [
    `ASSUMP-${idx + 1}`,
    a,
    'Governed Calculation'
  ]);

  if (contract.blockedWorkloadCalculations.length > 0) {
    contract.blockedWorkloadCalculations.forEach((bc) => {
      riskCallouts.push({
        type: 'BLOCKER',
        text: `Calculation Risk (${bc.outputParameter}): ${bc.reason}`
      });
    });
  }

  riskCallouts.push({
    type: 'GUIDANCE',
    text: 'PECP Methodology Guidance: All mathematical calculations require auditable assumptions. When specific operational conditions (such as cache hit ratios or concurrency distributions) are assumed, they must be recorded in canonical intelligence.'
  });

  sections.push({
    id: 'sec-6-risks-assumptions',
    sectionNumber: '6.0',
    title: 'Performance Risks & Assumptions',
    status: riskCallouts.some((c) => c.type === 'BLOCKER') ? 'BLOCKED' : 'COMPLETE',
    summary: 'Governed engineering assumptions and unmitigated performance risks.',
    paragraphs: [
      assumptionsList.length > 0
        ? 'Every calculation in PECP carries explicit mathematical assumptions. In accordance with Constitution §7, assumptions are auditable and cannot be silently introduced.'
        : 'No explicit project-specific assumptions are recorded in canonical intelligence.'
    ],
    tables:
      assumptionRows.length > 0
        ? [
            {
              id: 'table-assumptions',
              caption: 'Governed Engineering Assumptions',
              headers: ['ID', 'Assumption Statement', 'Origin'],
              rows: assumptionRows
            }
          ]
        : undefined,
    callouts: riskCallouts.length > 0 ? riskCallouts : undefined
  });

  // 7. Workload Strategy
  const workloadRows: Array<Array<string | number | boolean>> = [];
  const workloadCallouts: ArtefactCallout[] = [];

  contract.workloadCalculations.forEach((calc) => {
    workloadRows.push([
      calc.calculationId,
      calc.outputParameter,
      `${calc.outputValue} ${calc.unit}`,
      calc.formulaIdentifier,
      calc.humanReadableExplanation
    ]);
  });

  // Check for blocked Little's Law
  const blockedConcurrency = contract.blockedWorkloadCalculations.find(
    (b) => b.outputParameter === 'concurrent_sessions' || b.calculationId.includes('littles-law')
  );

  if (blockedConcurrency) {
    workloadCallouts.push({
      type: 'BLOCKER',
      text: `Session Concurrency: BLOCKED. ${blockedConcurrency.reason} Little's Law (L = λ × W) requires arrival rate of the same flow population. PECP refuses to equate business order throughput with session arrival rate without an approved conversion ratio.`
    });
  }

  sections.push({
    id: 'sec-7-workload-strategy',
    sectionNumber: '7.0',
    title: 'Workload Strategy & Required Demand',
    status: blockedConcurrency ? 'BLOCKED' : 'COMPLETE',
    summary: 'Authoritative workload demand targets, throughput derivations, and concurrency modeling.',
    paragraphs: [
      'Workload demand targets define the required transactional throughput that the system under test must achieve during evaluation.',
      'PECP enforces strict mathematical guardrails: unit conversions (e.g. hourly orders to per-second orders) are verified, and Little\'s Law (L = λ × W) requires arrival rate and residence time to belong to the identical flow population.'
    ],
    tables:
      workloadRows.length > 0
        ? [
            {
              id: 'table-workload-calculations',
              caption: 'Governed Workload Throughput & Demand Calculations',
              headers: ['Calculation ID', 'Parameter', 'Derived Value', 'Formula Identifier', 'Lineage Explanation'],
              rows: workloadRows
            }
          ]
        : undefined,
    callouts: workloadCallouts
  });

  // 8. Journey / Transaction Model
  // Look for journey distribution from intelligence
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
        journeyItem.sourceDocument || journeyItem.source || 'Canonical Intelligence'
      ]);
    } else if (typeof journeyItem.value === 'string') {
      // e.g. "Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%"
      const parts = journeyItem.value.split(',').map((s) => s.trim());
      journeyRows = parts.map((part) => {
        const match = part.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*%/);
        if (match) {
          const name = match[1].trim();
          const pct = parseFloat(match[2]);
          return [
            name,
            `${pct}%`,
            (pct / 100).toFixed(2),
            journeyItem.sourceDocument || journeyItem.source || 'Canonical Intelligence'
          ];
        }
        return [
          part,
          'Specified',
          'N/A',
          journeyItem.sourceDocument || journeyItem.source || 'Canonical Intelligence'
        ];
      });
    }
  }

  if (journeyRows.length === 0) {
    journeyStatus = 'NOT_SUPPLIED';
  }

  sections.push({
    id: 'sec-8-journey-model',
    sectionNumber: '8.0',
    title: 'Journey & Transaction Distribution Model',
    status: journeyStatus,
    summary: 'Operational mix and traffic weightings across user workflows.',
    paragraphs: [
      journeyStatus === 'COMPLETE'
        ? 'User workflow distribution derived from canonical intelligence, representing relative operational intensity across user journeys.'
        : 'User journey distribution has not been supplied in canonical intelligence. Individual journey weights must be confirmed prior to test scripting.'
    ],
    tables:
      journeyRows.length > 0
        ? [
            {
              id: 'table-journey-mix',
              caption: 'Approved Journey Mix & Relative Weightings',
              headers: ['Journey Name', 'Proportion (%)', 'Relative Weight', 'Provenance Reference'],
              rows: journeyRows
            }
          ]
        : undefined
  });

  // 9. Performance Requirements and Acceptance Criteria
  const criteriaRows = contract.acceptanceCriteria.map((c) => [
    c.id,
    c.metric,
    c.scope,
    c.target,
    c.operator || 'Not defined',
    c.thresholdValue !== undefined ? c.thresholdValue : 'Not defined',
    c.unit || 'Not defined',
    c.percentile ? `p${c.percentile}` : 'MISSING',
    c.status,
    c.ambiguityNotice || 'Defined and verifiable'
  ]);

  const ambiguousCriteria = contract.acceptanceCriteria.filter((c) => c.status === 'AMBIGUOUS');
  const criteriaCallouts: ArtefactCallout[] = [];

  if (ambiguousCriteria.length > 0) {
    ambiguousCriteria.forEach((ac) => {
      criteriaCallouts.push({
        type: 'BLOCKER',
        text: `Ambiguous Acceptance Criterion "${ac.metric}" (${ac.id}): ${ac.ambiguityNotice || 'Lacks executable operational semantics (e.g. response-time percentile). Required for automated gate evaluation.'}`
      });
    });
  }

  criteriaCallouts.push({
    type: 'INFO',
    text: 'Separation of Concerns (M1/M2): Required workload demand (e.g. 31,500 orders/hr = 8.75 orders/sec) is governed as workload demand and is NOT rewritten as a system-performance/NFR latency or error criterion.'
  });

  sections.push({
    id: 'sec-9-acceptance-criteria',
    sectionNumber: '9.0',
    title: 'Performance Requirements & Acceptance Criteria',
    status: ambiguousCriteria.length > 0 ? 'BLOCKED' : 'COMPLETE',
    summary: 'Measurable non-functional acceptance criteria and automated release gate thresholds.',
    paragraphs: [
      'Acceptance criteria define the quantitative bounds that the system under test must satisfy under target workload demand.',
      'In accordance with PECP governance, criteria must be operationally unambiguous: comparison operators, thresholds, units, and response-time percentiles (e.g. p95, p99) must be explicitly defined for automated evaluation.'
    ],
    tables: [
      {
        id: 'table-criteria',
        caption: 'Performance Acceptance Criteria Specification',
        headers: ['ID', 'Metric', 'Scope', 'Target Expression', 'Operator', 'Threshold', 'Unit', 'Percentile', 'Status', 'Governance Notice'],
        rows: criteriaRows
      }
    ],
    callouts: criteriaCallouts
  });

  // 10. Test Approach
  sections.push({
    id: 'sec-10-test-approach',
    sectionNumber: '10.0',
    title: 'Test Approach & Methodological Framing',
    status: 'COMPLETE',
    summary: 'Systematic approach for evaluating system behavior under load.',
    paragraphs: [
      `The testing methodology is designed to fulfill the ${contract.engineeringIntent} intent: establishing whether the system reliably sustains projected peak volume while satisfying all defined acceptance criteria.`,
      'Testing proceeds through progressive workload increments: from single-user baseline calibration, to stepped workload ramp-up, through steady-state peak capacity testing, and finally stress limits to quantify architectural headroom.'
    ]
  });

  // 11. Test Types / Engineering Activities
  const approvedThroughputCalc = contract.workloadCalculations.find(
    (c) => c.outputParameter === 'order_throughput_per_second' || c.outputParameter.includes('throughput')
  );
  const peakDemandLabel = approvedThroughputCalc
    ? `${approvedThroughputCalc.outputValue} ${approvedThroughputCalc.unit || 'ops/sec'} (Approved Peak Demand)`
    : 'Approved Target Peak Demand';

  const testTypesTable: ArtefactTable = {
    id: 'table-test-types',
    caption: 'Proposed Performance Engineering Activities [PECP Methodology Guidance]',
    headers: ['Activity / Test Type', 'Methodology Objective', 'Workload Target', 'Execution Duration', 'Project Definition Status'],
    rows: [
      [
        'Baseline Calibration',
        'Measure single-user baseline latency and verify test script telemetry',
        'NOT_SUPPLIED (Single-user baseline target unresolved)',
        'NOT_SUPPLIED (Unresolved baseline duration)',
        'PROPOSED (Guidance) — Parameters NOT_SUPPLIED'
      ],
      [
        'Peak Load Test',
        'Evaluate system under approved peak workload demand',
        peakDemandLabel,
        'NOT_SUPPLIED (Unresolved steady-state duration)',
        'PROPOSED (Guidance) — Duration NOT_SUPPLIED'
      ],
      [
        'Endurance / Soak Test',
        'Identify memory leaks, connection pool exhaustion, and slow resource degradation',
        'NOT_SUPPLIED (Unresolved sustained load ratio)',
        'NOT_SUPPLIED (Unresolved soak window)',
        'PROPOSED (Guidance) — Parameters NOT_SUPPLIED'
      ],
      [
        'Headroom / Stress Test',
        'Quantify breaking threshold and recovery behavior beyond peak capacity',
        'NOT_SUPPLIED (Unresolved stress increments)',
        'NOT_SUPPLIED (Unresolved ramp profile)',
        'PROPOSED (Guidance) — Parameters NOT_SUPPLIED'
      ]
    ]
  };

  sections.push({
    id: 'sec-11-test-types',
    sectionNumber: '11.0',
    title: 'Test Types & Engineering Activities',
    status: 'UNRESOLVED',
    summary: 'Specific testing activities proposed beneath the primary engineering intent.',
    paragraphs: [
      `The testing activity types outlined below represent standard PECP performance engineering methodology beneath the ${contract.engineeringIntent} intent.`,
      'Project-specific execution parameters including ramp durations, steady-state windows, and soak/stress boundaries have not been supplied in canonical intelligence and remain UNRESOLVED.'
    ],
    tables: [testTypesTable],
    callouts: [
      {
        type: 'GUIDANCE',
        text: 'PECP Methodology Guidance: The engineering activities listed above are methodological proposals. Concrete execution schedules, virtual user distributions, ramp rates, and soak durations must be formally supplied in canonical intelligence and approved before test execution.'
      }
    ]
  });

  // 12. Environment Strategy
  const envParagraphs: string[] = [];
  const envCallouts: ArtefactCallout[] = [];
  let envStatus: ArtefactSection['status'] = 'COMPLETE';

  if (hasSuppliedContent(environmentItems)) {
    environmentItems.forEach((item) => {
      envParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Specified'} (${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else {
    envStatus = 'NOT_SUPPLIED';
    envParagraphs.push(
      'Test environment architecture, target topology, and infrastructure configuration have not been supplied in canonical intelligence.'
    );
    envCallouts.push({
      type: 'WARNING',
      text: 'Test environment parity is currently unverified. Test results cannot be extrapolated to production without validated infrastructure scaling ratios.'
    });
  }

  sections.push({
    id: 'sec-12-environment',
    sectionNumber: '12.0',
    title: 'Environment Strategy & Parity Context',
    status: envStatus,
    summary: 'Target infrastructure, environment scaling factors, and network isolation.',
    paragraphs: envParagraphs,
    callouts: envCallouts.length > 0 ? envCallouts : undefined,
    sourceIntelligenceIds: environmentItems.map((i) => i.id)
  });

  // 13. Test Data Strategy
  const dataParagraphs: string[] = [];
  const dataCallouts: ArtefactCallout[] = [];
  let dataStatus: ArtefactSection['status'] = 'COMPLETE';

  if (hasSuppliedContent(testDataItems)) {
    testDataItems.forEach((item) => {
      dataParagraphs.push(
        `${item.title}: ${item.value ? String(item.value) : 'Specified'} (${item.sourceDocument || item.source || 'Canonical Intelligence'}).`
      );
    });
  } else {
    dataStatus = 'NOT_SUPPLIED';
    dataParagraphs.push(
      'Test data strategy, data volume requirements, and test datasets have not been supplied in canonical intelligence.'
    );
    dataCallouts.push({
      type: 'WARNING',
      text: 'Test data generation procedures and cleanup scripts must be defined prior to test execution to prevent synthetic data caching artifacts.'
    });
  }

  sections.push({
    id: 'sec-13-test-data',
    sectionNumber: '13.0',
    title: 'Test Data Strategy',
    status: dataStatus,
    summary: 'Data volume requirements, test dataset specifications, and provisioning strategy.',
    paragraphs: dataParagraphs,
    callouts: dataCallouts.length > 0 ? dataCallouts : undefined,
    sourceIntelligenceIds: testDataItems.map((i) => i.id)
  });

  // 14. Observability / Monitoring Strategy
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
      'Observability configuration, metric collection endpoints, and telemetry tooling have not been supplied in canonical intelligence.'
    );
    obsCallouts.push({
      type: 'WARNING',
      text: 'Telemetry infrastructure must be configured prior to testing to enable distributed root-cause bottleneck analysis.'
    });
  }

  sections.push({
    id: 'sec-14-observability',
    sectionNumber: '14.0',
    title: 'Observability & Telemetry Strategy',
    status: obsStatus,
    summary: 'Telemetry collection and system metric aggregation.',
    paragraphs: obsParagraphs,
    callouts: obsCallouts.length > 0 ? obsCallouts : undefined,
    sourceIntelligenceIds: observabilityItems.map((i) => i.id)
  });

  // 15. Entry / Exit / Governance Conditions
  const governanceTable: ArtefactTable = {
    id: 'table-governance-conditions',
    caption: 'Governed Entry, Exit, and Abort Criteria',
    headers: ['Condition Category', 'Criterion', 'Governance Verification Rule'],
    rows: [
      ['Entry Condition', 'Performance Contract Approved', 'Upstream Performance Contract must be approved and not blocked'],
      ['Entry Condition', 'Environment Parity Confirmed', 'Target environment configuration defined and verified against canonical criteria'],
      ['Entry Condition', 'Test Data Provisioned', 'Required test datasets provisioned and partitioned'],
      ['Exit Condition', 'Workload Demand Attained', 'Test run achieved target throughput without test runner saturation'],
      ['Exit Condition', 'All Acceptance Criteria Evaluated', 'Every defined canonical acceptance criterion evaluated against target thresholds'],
      ['Exit Condition', 'Zero Blocking Defects', 'No unresolved critical or blocking performance defects open'],
      ['Abort Condition', 'Governed Circuit Breaker', 'Test run aborted if execution environment fails or unrecoverable non-SUT error occurs']
    ]
  };

  sections.push({
    id: 'sec-15-governance',
    sectionNumber: '15.0',
    title: 'Entry, Exit & Governance Conditions',
    status: 'COMPLETE',
    summary: 'Stage gates, release criteria, and automated circuit-breaker abort conditions.',
    paragraphs: [
      'Strict entry and exit criteria prevent wasteful execution in uncalibrated environments and ensure auditability of performance evidence.'
    ],
    tables: [governanceTable],
    callouts: [
      {
        type: 'GUIDANCE',
        text: 'PECP Methodology Guidance: Generic governance stage gates apply across all engagements. Project-specific abort thresholds and acceptance limits must derive strictly from canonical intelligence and Performance Contract specifications.'
      }
    ]
  });

  // 16. Unresolved Decisions / Blockers
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
    // If not already in blockerRows
    if (!blockerRows.some((r) => r[3] === reason)) {
      blockerRows.push([
        `BLK-REASON-${idx + 1}`,
        'Approval Blocker',
        'BLOCKING',
        reason,
        'Resolve upstream intelligence and recompile Performance Contract.'
      ]);
    }
  });

  sections.push({
    id: 'sec-16-unresolved-blockers',
    sectionNumber: '16.0',
    title: 'Unresolved Decisions & Approval Blockers',
    status: blockerRows.length > 0 ? 'BLOCKED' : 'COMPLETE',
    summary: 'Active blockers preventing document approval and execution release gating.',
    paragraphs: [
      blockerRows.length > 0
        ? `This Performance Strategy carries ${blockerRows.length} unresolved issue(s) or blocker(s) from upstream canonical intelligence. In accordance with PECP Constitution §7, these items are preserved visibly rather than papered over with unverified defaults.`
        : 'All upstream intelligence issues, calculation prerequisites, and acceptance criteria semantics have been resolved.'
    ],
    tables:
      blockerRows.length > 0
        ? [
            {
              id: 'table-blockers',
              caption: 'Active Blocking Issues & Remediation Requirements',
              headers: ['Issue ID', 'Parameter / Topic', 'Severity', 'Description', 'Required Remediation'],
              rows: blockerRows
            }
          ]
        : undefined,
    callouts:
      blockerRows.length > 0
        ? [
            {
              type: 'BLOCKER',
              text: 'This document cannot be approved until all blocking issues above have been resolved in upstream canonical intelligence.'
            }
          ]
        : undefined
  });

  // 17. Traceability / Source References
  const traceRows: Array<Array<string | number | boolean>> = [];

  contract.sourceIntelligenceReferences.forEach((ref) => {
    const fullItem = intelligenceItems.find((i) => i.id === ref.id);
    traceRows.push([
      ref.id,
      ref.key,
      ref.title,
      ref.canonicalState,
      ref.reviewStatus,
      fullItem?.sourceDocument || 'Project Repository',
      fullItem?.sourceLocation || 'Canonical Model'
    ]);
  });

  sections.push({
    id: 'sec-17-traceability',
    sectionNumber: '17.0',
    title: 'Traceability & Source Intelligence References',
    status: 'COMPLETE',
    summary: 'Provenance matrix tracing all strategy elements back to canonical source intelligence.',
    paragraphs: [
      'In accordance with Constitution §7, every material value in this strategy can answer where it came from and why it exists.'
    ],
    tables: [
      {
        id: 'table-traceability-matrix',
        caption: 'Canonical Provenance & Source Intelligence Matrix',
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
    id: `strat-${contract.projectId}-${artefactVersion}`,
    projectId: contract.projectId,
    projectName: contract.projectName,
    type: 'PERFORMANCE_STRATEGY',
    title: `Performance Strategy — ${contract.projectName}`,
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
      targetAudience: 'Performance Architects, Engineering Leads, Product Stakeholders',
      governanceGate: 'M2 Artefact Review'
    }
  };
}
