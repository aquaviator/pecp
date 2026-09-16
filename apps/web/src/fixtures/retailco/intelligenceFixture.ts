import { IntelligenceItem, IntelligenceReviewSummary } from '../../types';

export const RETAILCO_INTELLIGENCE_ITEMS_FIXTURE: IntelligenceItem[] = [
  {
    id: 'intel-peak-orders',
    key: 'peak_hourly_orders',
    title: 'Peak Hourly Order Volume',
    category: 'WORKLOAD',
    canonicalState: 'CONFLICTING',
    reviewStatus: 'CONFLICTING',
    unit: 'orders/hour',
    value: '31,500 (Candidate)',
    source: 'Multiple Conflicting Sources',
    sourceDocument: 'Strategy 2024 / HLD v4 / Business Forecast 2026',
    sourceLocation: 'Sections: Strategy §4.1, HLD §8.2, Forecast §2',
    capturedDate: '2026-08-15T11:20:00Z',
    approvalState: 'UNREVIEWED',
    notes: 'Three competing values found across upstream project artefacts. Authoritative candidate has not been selected.',
    candidates: [
      {
        id: 'cand-1',
        value: '18,000',
        unit: 'orders/hour',
        source: 'Performance Strategy 2024',
        sourceDocument: 'Doc: RetailCo-Perf-Strat-2024.docx',
        sourceLocation: 'Page 14, Section 4.1 "Historical Peak Volumes"',
        canonicalState: 'SUPERSEDED',
        reviewStatus: 'STALE',
        capturedDate: '2024-11-05T10:00:00Z',
        notes: 'Superseded historical baseline from previous retail season.'
      },
      {
        id: 'cand-2',
        value: '24,000',
        unit: 'orders/hour',
        source: 'Retail Platform HLD v4',
        sourceDocument: 'Doc: Architecture-HLD-v4.2.pdf',
        sourceLocation: 'Page 38, Section 8.2 "Capacity Envelope"',
        canonicalState: 'IMPORTED',
        reviewStatus: 'FOUND',
        capturedDate: '2026-04-12T14:30:00Z',
        notes: 'Engineering sizing assumption calculated prior to revised marketing forecasts.'
      },
      {
        id: 'cand-3',
        value: '31,500',
        unit: 'orders/hour',
        source: 'Black Friday 2026 Business Forecast',
        sourceDocument: 'Doc: BF26-Commercial-Demand-Model.xlsx',
        sourceLocation: 'Sheet "Forecast Summary", Cell F18',
        canonicalState: 'IMPORTED',
        reviewStatus: 'FOUND',
        capturedDate: '2026-08-01T09:15:00Z',
        notes: 'Commercial projection representing 31% year-over-year surge.'
      }
    ],
    history: [
      { date: '2026-08-15T11:20:00Z', action: 'Ingested candidates from 3 documents', actor: 'Intelligence Ingestion Pipeline' },
      { date: '2026-08-15T11:21:00Z', action: 'Classified reviewStatus as CONFLICTING', actor: 'Deterministic Model Validator' }
    ]
  },
  {
    id: 'intel-session-duration',
    key: 'avg_session_duration',
    title: 'Average User Session Duration',
    category: 'WORKLOAD',
    canonicalState: 'APPROVED',
    reviewStatus: 'FOUND',
    unit: 'minutes',
    value: 8,
    source: 'Previous Performance Strategy',
    sourceDocument: 'Doc: RetailCo-Perf-Strat-2024.docx',
    sourceLocation: 'Section 4.3 "User Behavioral Characteristics"',
    capturedDate: '2026-08-15T11:20:00Z',
    approvalState: 'APPROVED',
    approvedBy: 'Lead Performance Architect',
    approvalDate: '2026-08-18T16:00:00Z',
    history: [
      { date: '2026-08-15T11:20:00Z', action: 'Imported from Performance Strategy 2024', actor: 'Intelligence Ingestion' },
      { date: '2026-08-18T16:00:00Z', action: 'Approved as baseline residence time', actor: 'Lead Performance Architect' }
    ],
    notes: 'Imported parameter representing median desktop and mobile session length.'
  },
  {
    id: 'intel-checkout-latency',
    key: 'checkout_response_time',
    title: 'Checkout Response Time Target',
    category: 'ACCEPTANCE_CRITERIA',
    canonicalState: 'IMPORTED',
    reviewStatus: 'AMBIGUOUS',
    unit: 'seconds',
    value: '< 2',
    source: 'NFR-021',
    sourceDocument: 'Azure DevOps Work Item #49201',
    sourceLocation: 'Acceptance Criteria: "Checkout should respond within 2 seconds."',
    capturedDate: '2026-08-16T10:00:00Z',
    approvalState: 'UNREVIEWED',
    ambiguityReason: 'Response-time percentile is not defined (e.g. median, p90, p95, p99, or maximum).',
    history: [
      { date: '2026-08-16T10:00:00Z', action: 'Imported from ADO NFR-021', actor: 'Requirements Ingestion' },
      { date: '2026-08-16T10:01:00Z', action: 'Flagged as AMBIGUOUS: Missing statistical percentile definition', actor: 'NFR Quality Linter' }
    ],
    notes: 'Engineering requires clarification whether requirement represents p95 or absolute maximum ceiling.'
  },
  {
    id: 'intel-error-rate',
    key: 'max_error_rate',
    title: 'Maximum Allowed HTTP Error Rate',
    category: 'ACCEPTANCE_CRITERIA',
    canonicalState: 'APPROVED',
    reviewStatus: 'FOUND',
    unit: '%',
    value: 0.5,
    source: 'NFR-022',
    sourceDocument: 'Azure DevOps Work Item #49202',
    sourceLocation: 'Acceptance Criteria: "Error rate must remain below 0.5% under peak load."',
    capturedDate: '2026-08-16T10:05:00Z',
    approvalState: 'APPROVED',
    approvedBy: 'Engineering Governance Board',
    approvalDate: '2026-08-19T11:00:00Z',
    history: [
      { date: '2026-08-16T10:05:00Z', action: 'Imported from ADO NFR-022', actor: 'Requirements Ingestion' },
      { date: '2026-08-19T11:00:00Z', action: 'Formally accepted as hard release threshold', actor: 'Governance Board' }
    ],
    notes: 'Applies to 5xx server-side responses across all authenticated and unauthenticated APIs.'
  },
  {
    id: 'intel-journey-distribution',
    key: 'journey_distribution',
    title: 'User Journey Traffic Distribution',
    category: 'WORKLOAD',
    canonicalState: 'APPROVED',
    reviewStatus: 'FOUND',
    unit: 'mix %',
    value: 'Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%',
    source: 'Digital Analytics Log Extract & Platform HLD',
    sourceDocument: 'Doc: Architecture-HLD-v4.2.pdf',
    sourceLocation: 'Appendix B: "Traffic Distribution Ratios"',
    capturedDate: '2026-08-16T11:30:00Z',
    approvalState: 'APPROVED',
    approvedBy: 'Performance Lead',
    approvalDate: '2026-08-19T14:00:00Z',
    history: [
      { date: '2026-08-16T11:30:00Z', action: 'Extracted from Platform HLD v4', actor: 'Intelligence Ingestion' },
      { date: '2026-08-19T14:00:00Z', action: 'Validated against historical GA4 telemetry', actor: 'Performance Lead' }
    ],
    notes: 'Journey weighting matrix: Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%.'
  },
  {
    id: 'intel-db-pool',
    key: 'db_connection_pool',
    title: 'Primary Aurora PostgreSQL Max Pool Size',
    category: 'ARCHITECTURE',
    canonicalState: 'STALE',
    reviewStatus: 'STALE',
    unit: 'connections',
    value: 800,
    source: 'Terraform Config: db_retailco_prod (2024 snapshot)',
    sourceDocument: 'Git Repo: retailco-infra-tf',
    sourceLocation: 'modules/rds/variables.tf:line 44',
    capturedDate: '2024-10-18T09:00:00Z',
    approvalState: 'UNREVIEWED',
    history: [
      { date: '2026-08-16T12:00:00Z', action: 'Flagged STALE: Infrastructure configuration over 18 months old', actor: 'Linter' }
    ],
    notes: 'Configuration likely obsolete following deployment of RDS Proxy in Q1 2026.'
  },
  {
    id: 'intel-test-data-seed',
    key: 'sku_dataset_cardinality',
    title: 'Active Product SKU Test Pool Cardinality',
    category: 'TEST_DATA',
    canonicalState: 'MISSING',
    reviewStatus: 'MISSING',
    source: 'Test Data Strategy',
    sourceDocument: 'Pending Data Architecture Specification',
    sourceLocation: 'Unassigned',
    capturedDate: '2026-08-16T12:30:00Z',
    approvalState: 'UNREVIEWED',
    history: [
      { date: '2026-08-16T12:30:00Z', action: 'Identified as MISSING required parameter', actor: 'Readiness Validator' }
    ],
    notes: 'Required to model realistic cache hit ratios in Redis catalog cache.'
  }
];

/**
 * Post-resolution M1 Reference Scenario Fixture.
 *
 * Demonstrates the system state AFTER the peak orders conflict has been
 * formally resolved to 31,500 orders/hour (cand-3) by the Lead Architect.
 *
 * Preserves the original 3 candidates in history, provides an approved
 * current value for throughput conversion, and retains remaining blockers
 * (session arrival rate missing, checkout latency percentile ambiguous).
 */
export const RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE: IntelligenceItem[] = [
  {
    id: 'intel-peak-orders',
    key: 'peak_hourly_orders',
    title: 'Peak Hourly Order Volume',
    category: 'WORKLOAD',
    canonicalState: 'APPROVED',
    reviewStatus: 'FOUND',
    unit: 'orders/hour',
    value: 31500,
    source: 'Black Friday 2026 Business Forecast',
    sourceDocument: 'Doc: BF26-Commercial-Demand-Model.xlsx',
    sourceLocation: 'Sheet "Forecast Summary", Cell F18',
    capturedDate: '2026-08-01T09:15:00Z',
    approvalState: 'APPROVED',
    approvedBy: 'Lead Performance Architect',
    approvalDate: '2026-08-19T10:00:00Z',
    notes: 'Authoritative candidate formally approved from Black Friday 2026 Business Forecast (cand-3: 31,500 orders/hour) resolving upstream strategy variance.',
    candidates: [
      {
        id: 'cand-1',
        value: '18,000',
        unit: 'orders/hour',
        source: 'Performance Strategy 2024',
        sourceDocument: 'Doc: RetailCo-Perf-Strat-2024.docx',
        sourceLocation: 'Page 14, Section 4.1 "Historical Peak Volumes"',
        canonicalState: 'SUPERSEDED',
        reviewStatus: 'STALE',
        capturedDate: '2024-11-05T10:00:00Z',
        notes: 'Superseded historical baseline from previous retail season.'
      },
      {
        id: 'cand-2',
        value: '24,000',
        unit: 'orders/hour',
        source: 'Retail Platform HLD v4',
        sourceDocument: 'Doc: Architecture-HLD-v4.2.pdf',
        sourceLocation: 'Page 38, Section 8.2 "Capacity Envelope"',
        canonicalState: 'SUPERSEDED',
        reviewStatus: 'STALE',
        capturedDate: '2026-04-12T14:30:00Z',
        notes: 'Superseded by formal resolution event selecting cand-3 (31,500 orders/hour).'
      },
      {
        id: 'cand-3',
        value: '31,500',
        unit: 'orders/hour',
        source: 'Black Friday 2026 Business Forecast',
        sourceDocument: 'Doc: BF26-Commercial-Demand-Model.xlsx',
        sourceLocation: 'Sheet "Forecast Summary", Cell F18',
        canonicalState: 'APPROVED',
        reviewStatus: 'FOUND',
        capturedDate: '2026-08-01T09:15:00Z',
        notes: 'Approved authoritative candidate representing 31% commercial year-over-year surge.'
      }
    ],
    history: [
      { date: '2026-08-15T11:20:00Z', action: 'Ingested candidates from 3 documents', actor: 'Intelligence Ingestion Pipeline' },
      { date: '2026-08-15T11:21:00Z', action: 'Classified reviewStatus as CONFLICTING', actor: 'Deterministic Model Validator' },
      {
        date: '2026-08-19T10:00:00Z',
        action: 'Formally resolved conflict selecting candidate cand-3 (31,500 orders/hour)',
        actor: 'Lead Performance Architect',
        note: 'Approved commercial demand projection for Black Friday 2026'
      }
    ]
  },
  ...RETAILCO_INTELLIGENCE_ITEMS_FIXTURE.slice(1)
];

export const RETAILCO_INTELLIGENCE_SUMMARY_FIXTURE: IntelligenceReviewSummary = {
  documentsAnalysed: 5,
  requirementsFound: 28,
  performanceRequirements: 11,
  conflicts: 3,
  missingInformation: 7,
  readinessSections: [
    {
      id: 'business-context',
      title: 'Business Context',
      status: 'VERIFIED',
      summary: '3 of 4 core commercial drivers defined; 1 peak forecast variance pending resolution.',
      verifiedCount: 3,
      totalCount: 4,
      notes: 'Black Friday revenue target (£42M) and commercial trading peak window (19:00-21:00 UTC) documented.'
    },
    {
      id: 'architecture',
      title: 'Architecture',
      status: 'VERIFIED',
      summary: 'Microservices topology, API gateway, and container cluster specifications imported.',
      verifiedCount: 6,
      totalCount: 7,
      notes: 'Redis cluster and Aurora PostgreSQL instances identified; RDS Proxy sizing pending confirmation.'
    },
    {
      id: 'workload',
      title: 'Workload',
      status: 'ATTENTION_REQUIRED',
      summary: 'Conflicting peak hourly order candidates (18k vs 24k vs 31.5k). Journey mix captured.',
      verifiedCount: 4,
      totalCount: 7,
      notes: 'Candidate volumes require formal governance resolution before workload modeling.'
    },
    {
      id: 'acceptance-criteria',
      title: 'Acceptance Criteria',
      status: 'ATTENTION_REQUIRED',
      summary: '11 NFRs imported; 1 ambiguous latency metric (NFR-021 missing percentile).',
      verifiedCount: 9,
      totalCount: 11,
      notes: 'Error rate ceiling (0.5%) and availability threshold (99.95%) approved.'
    },
    {
      id: 'test-data',
      title: 'Test Data',
      status: 'INCOMPLETE',
      summary: 'Catalog SKU distribution and customer account pool cardinalities missing.',
      verifiedCount: 1,
      totalCount: 4,
      notes: 'Synthetic data generator required to prevent hot-key caching anomalies during load tests.'
    },
    {
      id: 'environment',
      title: 'Environment',
      status: 'VERIFIED',
      summary: 'Pre-production Performance Lab topology verified at 1:1 scale with production.',
      verifiedCount: 5,
      totalCount: 5,
      notes: 'Dedicated VPC isolated from QA; payment virtualisation service endpoint mapped.'
    },
    {
      id: 'observability',
      title: 'Observability',
      status: 'VERIFIED',
      summary: 'Dynatrace APM agent injection and Prometheus telemetry endpoints confirmed.',
      verifiedCount: 4,
      totalCount: 4,
      notes: 'Distributed tracing enabled with high-fidelity sampling during test windows.'
    }
  ]
};

export const RETAILCO_M1_INTELLIGENCE_SUMMARY_FIXTURE: IntelligenceReviewSummary = {
  ...RETAILCO_INTELLIGENCE_SUMMARY_FIXTURE,
  conflicts: 2,
  readinessSections: RETAILCO_INTELLIGENCE_SUMMARY_FIXTURE.readinessSections.map((sec) =>
    sec.id === 'workload'
      ? {
          ...sec,
          status: 'VERIFIED',
          summary: 'Peak hourly order candidate resolved and approved (31,500 orders/hour). Journey mix captured.',
          verifiedCount: 5,
          notes: 'Authoritative peak order baseline approved for deterministic throughput conversion.'
        }
      : sec
  )
};
