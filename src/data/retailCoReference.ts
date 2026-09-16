import {
  IntelligenceItem,
  IntelligenceConflict,
  UserJourney,
  WorkloadParameters,
  PerformanceContract,
  EngineeringArtefact,
  K6TestDefinition,
  ExecutionRun,
  PerformanceFinding,
  ProviderConnector
} from '../types';

export const INITIAL_CONNECTORS: ProviderConnector[] = [
  { category: 'RequirementProvider', name: 'Azure DevOps Boards', mode: 'MOCK', status: 'CONNECTED', details: 'Project: RetailCo-Digital (Epics & NFRs sync)' },
  { category: 'TelemetryProvider', name: 'Dynatrace & Prometheus', mode: 'MOCK', status: 'CONNECTED', details: 'Production Cluster: retailco-eu-west1-prod' },
  { category: 'ExecutionProvider', name: 'k6 Customer Runner', mode: 'LIVE', status: 'CONNECTED', details: 'Local container runtime on customer infra' },
  { category: 'PublishingProvider', name: 'Azure DevOps / Confluence', mode: 'MOCK', status: 'CONNECTED', details: 'Evidence packages & defect export ready' },
  { category: 'AIProvider', name: 'Customer BYOAI Gateway', mode: 'MOCK', status: 'CONNECTED', details: 'Advisory/Extraction only; PECP owns canonical state' }
];

export const INITIAL_INTELLIGENCE_ITEMS: IntelligenceItem[] = [
  {
    id: 'intel-1',
    key: 'peak_hourly_orders',
    category: 'VOLUME',
    title: 'Peak Hourly Order Volume (Black Friday)',
    value: 48000,
    unit: 'orders/hr',
    canonicalState: 'APPROVED',
    provenance: {
      source: 'Azure DevOps Epic #10492: Black Friday 2026 Capacity',
      sourceRef: 'ADO-RETAILCO-10492',
      sourceType: 'ALM',
      timestamp: '2026-08-20T14:30:00Z',
      confidencePct: 98,
      approvedBy: 'Lead Performance Architect (H. Jensen)',
      approvalTimestamp: '2026-08-22T09:15:00Z',
      rationale: 'Derived from 2025 peak volume (38,000/hr) + 26% commercial projection.'
    },
    notes: 'Primary peak hour dimension for Black Friday 2026 peak window (19:00 - 21:00 UTC).'
  },
  {
    id: 'intel-2',
    key: 'peak_aggregate_tps',
    category: 'VOLUME',
    title: 'Peak Aggregate Throughput Demand',
    value: 8200,
    unit: 'req/sec',
    canonicalState: 'CONFLICTING',
    provenance: {
      source: 'Production APM Telemetry (Dynatrace 2025 peak snapshot)',
      sourceRef: 'DYN-RECORDING-BF25-PEAK',
      sourceType: 'TELEMETRY',
      timestamp: '2026-08-21T11:00:00Z',
      confidencePct: 92,
      rationale: 'Real observed aggregate request volume across all frontends.'
    },
    conflictingValue: 5000,
    conflictingSource: 'Business Architecture Strategy Doc v1.2 (dated March 2025)',
    notes: 'Architecture document under-estimated API traffic amplification from modern SPA caching misses.'
  },
  {
    id: 'intel-3',
    key: 'checkout_p95_sla',
    category: 'LATENCY_SLA',
    title: 'Checkout & Payment Service p95 Latency',
    value: 350,
    unit: 'ms',
    canonicalState: 'APPROVED',
    provenance: {
      source: 'SLA Performance Contract 2026-R3',
      sourceRef: 'CONTRACT-SLA-R3-SEC4',
      sourceType: 'DOCUMENT',
      timestamp: '2026-08-15T16:00:00Z',
      confidencePct: 100,
      approvedBy: 'Head of Engineering (E. Vance)',
      approvalTimestamp: '2026-08-16T10:00:00Z'
    },
    notes: 'Hard failure gate. If checkout p95 exceeds 350ms under peak, release is blocked.'
  },
  {
    id: 'intel-4',
    key: 'catalog_search_p95_sla',
    category: 'LATENCY_SLA',
    title: 'Catalog Search & Browse p95 Latency',
    value: 200,
    unit: 'ms',
    canonicalState: 'APPROVED',
    provenance: {
      source: 'Digital Customer Experience Guidelines v2',
      sourceRef: 'DCX-2026-GUIDE',
      sourceType: 'DOCUMENT',
      timestamp: '2026-08-10T12:00:00Z',
      confidencePct: 95,
      approvedBy: 'Product Principal (M. Rossi)'
    },
    notes: 'Cached faceted search API response target.'
  },
  {
    id: 'intel-5',
    key: 'browse_to_purchase_ratio',
    category: 'BUSINESS_MIX',
    title: 'Browse to Purchase Ratio (Conversion Funnel)',
    value: '4.2%',
    unit: 'conversion',
    canonicalState: 'OBSERVED',
    provenance: {
      source: 'Google Analytics 4 & Data Warehouse',
      sourceRef: 'BQ-GA4-FUNNEL-Q3',
      sourceType: 'TELEMETRY',
      timestamp: '2026-08-25T08:00:00Z',
      confidencePct: 96,
      rationale: 'Observed over trailing 90 days active traffic.'
    },
    notes: 'For every 100 browse/search sessions, approx 4.2 complete checkout.'
  },
  {
    id: 'intel-6',
    key: 'user_think_time_avg',
    category: 'CONCURRENCY',
    title: 'Average User Think Time Between Steps',
    value: 4.5,
    unit: 'sec',
    canonicalState: 'INFERRED',
    provenance: {
      source: 'BYOAI Traffic Behavior Synthesizer',
      sourceRef: 'AI-INFER-LOGS-SESSION-77',
      sourceType: 'AI_EXTRACT',
      timestamp: '2026-08-26T09:30:00Z',
      confidencePct: 84,
      rationale: 'Calculated median interval between user HTTP requests in active sessions.'
    },
    notes: 'AI candidate extraction. Requires formal approval before locking workload model.'
  },
  {
    id: 'intel-7',
    key: 'database_connection_pool_limit',
    category: 'INFRASTRUCTURE',
    title: 'PostgreSQL RDS Maximum Connection Limit',
    value: 1200,
    unit: 'conn',
    canonicalState: 'STALE',
    provenance: {
      source: 'Terraform Config: db_retailco_prod (Branch: legacy-2024)',
      sourceRef: 'TF-INFRA-DB-PROD-L98',
      sourceType: 'ALM',
      timestamp: '2024-11-12T10:00:00Z',
      confidencePct: 65,
      rationale: 'Configuration committed 2 years ago, suspected superseded by RDS Proxy.'
    },
    notes: 'Needs verification against active AWS infrastructure.'
  },
  {
    id: 'intel-8',
    key: 'payment_gateway_rate_limit',
    category: 'INFRASTRUCTURE',
    title: 'Payment Gateway (Stripe/Adyen) Mock Rate Cap',
    value: 650,
    unit: 'trans/sec',
    canonicalState: 'MANUAL',
    provenance: {
      source: 'Payment Engineering Team Agreement',
      sourceRef: 'PAY-ARCH-MEMO-44',
      sourceType: 'MANUAL',
      timestamp: '2026-08-24T15:45:00Z',
      confidencePct: 90,
      approvedBy: 'Payments Lead (S. Chen)'
    },
    notes: 'Virtualized payment gateway service capacity constraint.'
  }
];

export const INITIAL_CONFLICTS: IntelligenceConflict[] = [
  {
    id: 'conf-1',
    itemId: 'intel-2',
    field: 'Peak Aggregate Throughput Demand (req/sec)',
    sourceA: {
      source: 'Production Telemetry (Dynatrace 2025 Peak)',
      value: 8200,
      unit: 'req/sec',
      state: 'OBSERVED',
      timestamp: '2026-08-21T11:00:00Z'
    },
    sourceB: {
      source: 'Business Architecture Strategy Doc v1.2',
      value: 5000,
      unit: 'req/sec',
      state: 'MANUAL',
      timestamp: '2025-03-14T10:00:00Z'
    },
    impact: 'HIGH',
    recommendation: 'Accept Production Telemetry value (8,200 req/sec) with a 15% safety buffer (target: 9,430 req/sec). The architecture document neglected client-side polling and micro-frontend assets.',
    status: 'PENDING'
  },
  {
    id: 'conf-2',
    itemId: 'intel-7',
    field: 'PostgreSQL Database Connection Ceiling',
    sourceA: {
      source: 'Active AWS CloudWatch RDS Config',
      value: 2500,
      unit: 'conn',
      state: 'OBSERVED',
      timestamp: '2026-08-28T09:00:00Z'
    },
    sourceB: {
      source: 'Legacy Terraform Repo (2024)',
      value: 1200,
      unit: 'conn',
      state: 'STALE',
      timestamp: '2024-11-12T10:00:00Z'
    },
    impact: 'MEDIUM',
    recommendation: 'Supercede legacy Terraform setting (1,200) with CloudWatch verified RDS Proxy pool size (2,500 conn).',
    status: 'PENDING'
  }
];

export const INITIAL_JOURNEYS: UserJourney[] = [
  {
    id: 'journey-1',
    name: 'Browse Catalog & Item Details',
    description: 'Home page landing, department navigation, product listing, and detailed SKU viewing.',
    mixPercentage: 55,
    avgResponseTargetMs: 120,
    p95TargetMs: 250,
    thinkTimeSec: 3.5,
    stepsCount: 4,
    endpoint: '/api/v1/catalog/products',
    criticalPath: false
  },
  {
    id: 'journey-2',
    name: 'Faceted Search & Filtering',
    description: 'Instant search typing, filter by size/color/brand, faceted aggregations.',
    mixPercentage: 25,
    avgResponseTargetMs: 90,
    p95TargetMs: 200,
    thinkTimeSec: 2.5,
    stepsCount: 3,
    endpoint: '/api/v1/search/faceted',
    criticalPath: false
  },
  {
    id: 'journey-3',
    name: 'Cart Management & Bag Updates',
    description: 'Add to cart, quantity update, coupon code evaluation, cart drawer fetch.',
    mixPercentage: 12,
    avgResponseTargetMs: 150,
    p95TargetMs: 300,
    thinkTimeSec: 4.0,
    stepsCount: 3,
    endpoint: '/api/v1/cart/items',
    criticalPath: true
  },
  {
    id: 'journey-4',
    name: 'Checkout & Payment Processing',
    description: 'Shipping calculation, address verification, payment tokenization, order placement.',
    mixPercentage: 8,
    avgResponseTargetMs: 220,
    p95TargetMs: 350,
    thinkTimeSec: 6.0,
    stepsCount: 5,
    endpoint: '/api/v1/checkout/orders',
    criticalPath: true
  }
];

export const INITIAL_WORKLOAD: WorkloadParameters = {
  peakHourlyTransactions: 48000,
  targetTps: 1850,
  averageSessionDurationSec: 45,
  calculatedVirtualUsers: 3450,
  littlesLawEquation: 'N = X × R → 3,450 VUs = 1,850 req/sec × (1.2s Service Time + 0.66s Pacing)',
  rampUpMinutes: 10,
  steadyStateMinutes: 45,
  rampDownMinutes: 5,
  safetyMarginPct: 20
};

export const INITIAL_CONTRACT: PerformanceContract = {
  id: 'contract-bf26-v1',
  version: 'v1.0-APPROVED',
  title: 'RetailCo Black Friday 2026 Performance Contract',
  intent: 'CERTIFICATION',
  targetEnvironment: 'Staging / Pre-Production Performance Lab',
  status: 'APPROVED',
  approvedAt: '2026-08-25T16:00:00Z',
  approvedBy: 'Performance Governance Board (H. Jensen, E. Vance)',
  concurrencyCap: 4500,
  slaGates: [
    {
      journeyId: 'journey-1',
      journeyName: 'Browse Catalog & Item Details',
      p95MaxMs: 250,
      errorRateMaxPct: 0.5,
      minimumThroughputTps: 1000
    },
    {
      journeyId: 'journey-2',
      journeyName: 'Faceted Search & Filtering',
      p95MaxMs: 200,
      errorRateMaxPct: 0.2,
      minimumThroughputTps: 450
    },
    {
      journeyId: 'journey-3',
      journeyName: 'Cart Management & Bag Updates',
      p95MaxMs: 300,
      errorRateMaxPct: 0.1,
      minimumThroughputTps: 220
    },
    {
      journeyId: 'journey-4',
      journeyName: 'Checkout & Payment Processing',
      p95MaxMs: 350,
      errorRateMaxPct: 0.05,
      minimumThroughputTps: 150
    }
  ],
  failureThresholds: {
    overallErrorRatePct: 1.0,
    consecutiveFailedHealthchecks: 3
  }
};

export const INITIAL_ARTEFACTS: EngineeringArtefact[] = [
  {
    id: 'art-1',
    type: 'STRATEGY',
    title: 'RetailCo Black Friday 2026 Performance Strategy',
    version: '1.2',
    author: 'Principal Performance Engineer',
    generatedDate: '2026-08-26',
    approvalStatus: 'APPROVED',
    approvedBy: 'Governance Board',
    markdownContent: `# RetailCo Black Friday 2026 Performance Engineering Strategy

## Executive Summary
This strategy document governs the performance validation lifecycle for RetailCo's digital e-commerce platforms leading up to the 2026 Black Friday & Cyber Monday trading window.

## Engineering Intent: CERTIFICATION
The primary intent for this testing cycle is **CERTIFICATION**: confirming that the release candidate adheres to non-functional requirements (NFRs), demonstrates zero memory leakage under sustained 45-minute peak load, and enforces hard failure gates on the checkout funnel.

## In-Scope Services
1. **Catalog API**: High-volume read workload with Redis cache layer.
2. **Search Engine**: ElasticSearch cluster with faceted aggregations.
3. **Cart & Inventory**: Stateful reservation subsystem.
4. **Checkout & Payment**: Synchronous payment gateway integration with circuit breaker fallback.

## Execution Architecture
- Engine: **k6 (v0.51+)**
- Runner: Customer-controlled distributed k6 runner in VPC.
- Observability: Prometheus scrape endpoints, Dynatrace distributed tracing, PECP Evidence Collector.`
  },
  {
    id: 'art-2',
    type: 'TEST_PLAN',
    title: 'Black Friday Peak Load & Soak Test Plan',
    version: '1.0',
    author: 'Performance Test Lead',
    generatedDate: '2026-08-27',
    approvalStatus: 'APPROVED',
    approvedBy: 'H. Jensen',
    markdownContent: `# Performance Test Plan: BF26 Peak Simulation

## Test Scenarios
1. **Smoke Validation (50 VUs, 3 min)**: Verify API contracts, auth tokens, and response signatures.
2. **Peak Workload Certification (3,450 VUs, 60 min)**:
   - 10 min ramp-up
   - 45 min steady-state at 1,850 TPS
   - 5 min graceful ramp-down
3. **Spike Resistance (5,000 VUs, 10 min)**: 3x step increase to assess queueing delay and auto-scaling reaction.

## Acceptance Criteria
- Aggregate HTTP Error Rate < 0.5%
- Checkout p95 Latency ≤ 350ms
- Catalog Search p95 Latency ≤ 200ms
- No database deadlock errors in PostgreSQL RDS logs.`
  }
];

export const INITIAL_K6_SCRIPT = `import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// PECP Generated Test Suite — RetailCo Black Friday 2026 Workload Model
// Generated deterministically from Approved Performance Contract v1.0
export const options = {
  scenarios: {
    retailco_peak_certification: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 800 },   // Warm-up ramp
        { duration: '3m', target: 3450 },  // Little's Law Target Concurrency
        { duration: '10m', target: 3450 }, // Sustained peak load
        { duration: '2m', target: 0 },     // Graceful cooldown
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],                                   // Contract Error Gate: <1%
    'http_req_duration{journey:browse}': ['p(95)<250'],                  // SLA: Browse p95 < 250ms
    'http_req_duration{journey:search}': ['p(95)<200'],                  // SLA: Search p95 < 200ms
    'http_req_duration{journey:cart}': ['p(95)<300'],                    // SLA: Cart p95 < 300ms
    'http_req_duration{journey:checkout}': ['p(95)<350'],                // SLA: Checkout p95 < 350ms
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://lab.retailco.internal';

export default function () {
  const rand = Math.random() * 100;

  // Journey Mix Partitioning (Governed by PECP Workload Matrix)
  if (rand < 55) {
    // 55% Browse Catalog
    group('Journey: Browse Catalog', function () {
      const res = http.get(\`\${BASE_URL}/api/v1/catalog/products?limit=24\`, {
        tags: { journey: 'browse' },
      });
      check(res, {
        'status is 200': (r) => r.status === 200,
        'catalog latency < 250ms': (r) => r.timings.duration < 250,
      });
      sleep(3.5); // Think time
    });
  } else if (rand < 80) {
    // 25% Search & Filtering
    group('Journey: Faceted Search', function () {
      const res = http.get(\`\${BASE_URL}/api/v1/search/faceted?q=electronics&category=4\`, {
        tags: { journey: 'search' },
      });
      check(res, {
        'status is 200': (r) => r.status === 200,
        'search latency < 200ms': (r) => r.timings.duration < 200,
      });
      sleep(2.5); // Think time
    });
  } else if (rand < 92) {
    // 12% Cart Operations
    group('Journey: Cart Management', function () {
      const payload = JSON.stringify({ skuId: 'SKU-9942', quantity: 1 });
      const res = http.post(\`\${BASE_URL}/api/v1/cart/items\`, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { journey: 'cart' },
      });
      check(res, {
        'cart status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      });
      sleep(4.0);
    });
  } else {
    // 8% Checkout & Order Placement (Critical Path)
    group('Journey: Checkout & Payment', function () {
      const payload = JSON.stringify({ paymentMethod: 'TOKENIZED_CARD_4242', orderAmount: 189.50 });
      const res = http.post(\`\${BASE_URL}/api/v1/checkout/orders\`, payload, {
        headers: { 'Content-Type': 'application/json' },
        tags: { journey: 'checkout' },
      });
      check(res, {
        'order accepted (201)': (r) => r.status === 201,
        'payment approved in time': (r) => r.timings.duration < 350,
      });
      sleep(6.0);
    });
  }
}
`;

export const INITIAL_EXECUTION_RUNS: ExecutionRun[] = [
  {
    id: 'run-104',
    runNumber: 104,
    status: 'COMPLETED',
    startedAt: '2026-08-28T10:15:00Z',
    completedAt: '2026-08-28T10:32:00Z',
    durationSec: 1020,
    peakVus: 3450,
    totalRequests: 1887000,
    averageTps: 1850,
    p90LatencyMs: 185,
    p95LatencyMs: 312,
    p99LatencyMs: 440,
    errorRatePct: 0.18,
    verdict: 'PASS_WITH_OBSERVATION',
    observations: [
      'Passed all 4 journey SLA thresholds under nominal 1,850 TPS.',
      'Observation: Checkout p99 latency exhibited a 140ms tail spike between minute 11 and 14 during payment tokenization lock contention.',
      'Database connection pool reached 82% utilization on primary RDS replica.'
    ],
    metricsTimeline: [
      { timestampSec: 0, currentVus: 0, reqPerSec: 0, p95LatencyMs: 80, errorRatePct: 0.0 },
      { timestampSec: 60, currentVus: 400, reqPerSec: 220, p95LatencyMs: 110, errorRatePct: 0.0 },
      { timestampSec: 120, currentVus: 800, reqPerSec: 460, p95LatencyMs: 135, errorRatePct: 0.02 },
      { timestampSec: 180, currentVus: 1800, reqPerSec: 980, p95LatencyMs: 175, errorRatePct: 0.05 },
      { timestampSec: 240, currentVus: 2800, reqPerSec: 1510, p95LatencyMs: 230, errorRatePct: 0.08 },
      { timestampSec: 300, currentVus: 3450, reqPerSec: 1850, p95LatencyMs: 285, errorRatePct: 0.12 },
      { timestampSec: 420, currentVus: 3450, reqPerSec: 1860, p95LatencyMs: 312, errorRatePct: 0.18 },
      { timestampSec: 540, currentVus: 3450, reqPerSec: 1845, p95LatencyMs: 308, errorRatePct: 0.15 },
      { timestampSec: 660, currentVus: 3450, reqPerSec: 1855, p95LatencyMs: 320, errorRatePct: 0.19 },
      { timestampSec: 780, currentVus: 3450, reqPerSec: 1850, p95LatencyMs: 310, errorRatePct: 0.16 },
      { timestampSec: 900, currentVus: 1500, reqPerSec: 810, p95LatencyMs: 190, errorRatePct: 0.04 },
      { timestampSec: 1020, currentVus: 0, reqPerSec: 0, p95LatencyMs: 95, errorRatePct: 0.0 }
    ]
  }
];

export const INITIAL_FINDINGS: PerformanceFinding[] = [
  {
    id: 'find-1',
    code: 'FIND-BF26-01',
    title: 'Payment Tokenization Mutex Bottleneck on Peak Ramp',
    severity: 'MAJOR',
    category: 'RESOURCE_CONTENTION',
    journey: 'Checkout & Payment Processing',
    description: 'During steady-state peak load, p99 payment processing latency escalated to 440ms due to unindexed row-locking on the order_reservation table.',
    evidence: 'k6 run #104 p99 metric exceeded 400ms target during t=660s to t=780s. PostgreSQL logs show lock wait time of 115ms on tx_id 882941.',
    recommendation: 'Add compound index on (customer_id, reservation_status) and configure optimistic locking for order draft states.',
    exportedToALM: true,
    ticketRef: 'ADO-BUG-19821'
  },
  {
    id: 'find-2',
    code: 'FIND-BF26-02',
    title: 'Redis Cache Hit Ratio Degradation under Faceted Filter Queries',
    severity: 'MINOR',
    category: 'LATENCY_DEGRADATION',
    journey: 'Faceted Search & Filtering',
    description: 'Cache hit ratio dropped from 94% to 76% when users applied more than 3 simultaneous facet filters.',
    evidence: 'Dynatrace traces reveal 850 backend database hits per minute during faceted search spike.',
    recommendation: 'Implement canonical facet key normalization in Redis query key serializer.',
    exportedToALM: false
  }
];
