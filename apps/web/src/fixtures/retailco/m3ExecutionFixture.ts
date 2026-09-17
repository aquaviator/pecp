import {
  PerformanceContract,
  IntelligenceItem,
  JourneyDefinition,
  WorkloadSchedule,
  WorkloadPopulationRelationship,
  ExecutionIntelligenceOverrides
} from '@pecp/pe-domain';
import { RETAILCO_PROJECT_FIXTURE } from './projectFixture.js';
import { RETAILCO_INTELLIGENCE_ITEMS_FIXTURE } from './intelligenceFixture.js';

/**
 * Governed Lineage: Workload Population Relationship for RetailCo Reference Lab (M3.0.3).
 * Explicitly connects business attainment target (8.75 orders/s) to the k6 scheduler
 * arrival rate (109.375 mixed journey iterations/s) via the checkout journey share (0.08).
 */
export const RETAILCO_M3_POPULATION_RELATIONSHIP: WorkloadPopulationRelationship = {
  id: 'rel-retailco-bf26-orders-to-iterations',
  formulaIdentifier: 'TARGET_DIVIDED_BY_JOURNEY_SHARE',
  inputBusinessTarget: {
    value: 8.75,
    unit: 'orders/second',
    sourceCalculationId: 'calc-throughput-second'
  },
  relevantJourneyKey: 'checkout',
  journeyShare: 0.08,
  contributionPerSuccessfulEvent: 1,
  outputSchedulerRate: {
    value: 109.375,
    population: 'JOURNEY_ITERATION',
    unit: 'journey_iterations/second'
  },
  description:
    'Lineage derivation: 8.75 orders/second business workload demand / 0.08 checkout journey share = 109.375 mixed journey iterations/second (each successful checkout submission yields 1 order)',
  sourceIntelligenceIds: ['intel-peak-orders']
};

/**
 * M3 Execution-Ready RetailCo Workload Schedule.
 * Explicitly provides canonical stage durations and target arrival rates (Constitution §10, M3.0.3).
 * Open arrival model driving 109.375 journey iterations/second to attain 8.75 orders/second.
 */
export const RETAILCO_M3_WORKLOAD_SCHEDULE: WorkloadSchedule = {
  id: 'sched-retailco-bf26-forecast-v1',
  executionModel: 'OPEN',
  arrivalPopulation: 'JOURNEY_ITERATION',
  populationRelationship: RETAILCO_M3_POPULATION_RELATIONSHIP,
  totalDurationSeconds: 1320, // 22 minutes total
  peakArrivalRate: 109.375,
  rateUnit: 'journey_iterations/second',
  timeUnit: 'seconds',
  startRate: 0,
  stages: [
    {
      durationSeconds: 300,
      targetArrivalRate: 109.375,
      description: 'Ramp-up stage: 5 minutes linear ramp from 0 to peak scheduler arrival rate (109.375 journey_iterations/s)'
    },
    {
      durationSeconds: 900,
      targetArrivalRate: 109.375,
      description: 'Steady-state peak stage: 15 minutes at sustained peak scheduler arrival rate (109.375 journey_iterations/s)'
    },
    {
      durationSeconds: 120,
      targetArrivalRate: 0,
      description: 'Ramp-down stage: 2 minutes cooldown to 0 journey_iterations/s'
    }
  ]
};

/**
 * M3 Execution-Ready RetailCo Journey Definitions.
 * Explicitly defines HTTP verbs, routes, weights, and think times for all 5 canonical journeys.
 */
export const RETAILCO_M3_JOURNEYS: JourneyDefinition[] = [
  {
    id: 'journey-browse',
    key: 'browse',
    name: 'Browse Catalog',
    weight: 0.55,
    percentage: 55,
    steps: [
      {
        id: 'step-browse-featured',
        name: 'View Featured Products',
        method: 'GET',
        path: '/api/v1/products/featured',
        expectedStatusCode: 200,
        thinkTimeSeconds: 2
      }
    ]
  },
  {
    id: 'journey-search',
    key: 'search',
    name: 'Search Catalog',
    weight: 0.20,
    percentage: 20,
    steps: [
      {
        id: 'step-search-query',
        name: 'Query Product Catalog',
        method: 'GET',
        path: '/api/v1/products/search?q=electronics',
        expectedStatusCode: 200,
        thinkTimeSeconds: 3
      }
    ]
  },
  {
    id: 'journey-basket',
    key: 'basket',
    name: 'Basket Operations',
    weight: 0.15,
    percentage: 15,
    steps: [
      {
        id: 'step-basket-add',
        name: 'Add SKU to Basket',
        method: 'POST',
        path: '/api/v1/basket/items',
        expectedStatusCode: 200,
        thinkTimeSeconds: 2,
        requestPayload: {
          type: 'JSON_LITERAL',
          contentType: 'application/json',
          value: { sku: 'SKU-ELECTRONICS-9921', quantity: 1 },
          description: 'Canonical basket add request payload'
        }
      }
    ]
  },
  {
    id: 'journey-checkout',
    key: 'checkout',
    name: 'Order Checkout',
    weight: 0.08,
    percentage: 8,
    steps: [
      {
        id: 'step-checkout-submit',
        name: 'Submit Order Checkout',
        method: 'POST',
        path: '/api/v1/orders/checkout',
        expectedStatusCode: 201,
        thinkTimeSeconds: 4,
        requestPayload: {
          type: 'JSON_LITERAL',
          contentType: 'application/json',
          value: {
            basketId: 'basket-active-ref',
            paymentMethod: 'SYNTHETIC_CARD_TEST',
            shippingAddressId: 'addr-ref-primary'
          },
          description: 'Canonical order checkout submission payload'
        },
        credentialReferences: [
          {
            provider: 'ENV_VAR',
            referenceId: 'RETAILCO_CHECKOUT_AUTH_TOKEN',
            purpose: 'Checkout API Authorization'
          }
        ],
        businessEventContribution: {
          eventKey: 'order_created',
          metric: 'orders',
          unit: 'orders',
          contribution: 1,
          expectedStatus: 201,
          description: '1 order attained per successful checkout submission'
        }
      }
    ]
  },
  {
    id: 'journey-account',
    key: 'account',
    name: 'Account Overview',
    weight: 0.02,
    percentage: 2,
    steps: [
      {
        id: 'step-account-orders',
        name: 'View Customer Order History',
        method: 'GET',
        path: '/api/v1/customers/me/orders',
        expectedStatusCode: 200,
        thinkTimeSeconds: 2
      }
    ]
  }
];

/**
 * Canonical Execution Intelligence for M3 Reference Lab.
 */
export const RETAILCO_M3_EXECUTION_INTELLIGENCE: ExecutionIntelligenceOverrides = {
  schedule: RETAILCO_M3_WORKLOAD_SCHEDULE,
  journeys: RETAILCO_M3_JOURNEYS,
  populationRelationship: RETAILCO_M3_POPULATION_RELATIONSHIP,
  targetEnvironmentBaseUrlRef: 'http://reference-lab.retailco.internal:8080',
  testDataIdentifiers: [
    'customer_account_pool_100k',
    'sku_catalog_active_50k',
    'synthetic_payment_tokens_v1'
  ],
  credentialReferences: [
    {
      provider: 'ENV_VAR',
      referenceId: 'RETAILCO_CHECKOUT_AUTH_TOKEN',
      purpose: 'Checkout API Authorization'
    }
  ],
  preconditions: [
    {
      id: 'precond-env-lab',
      category: 'ENVIRONMENT',
      statement: 'Reference Lab environment online and accessible at http://reference-lab.retailco.internal:8080',
      isSatisfied: true,
      verificationMethod: 'HTTP GET /health probe'
    },
    {
      id: 'precond-data-pool',
      category: 'TEST_DATA',
      statement: '100,000 customer accounts and 50,000 active SKUs seeded in Reference Lab database',
      isSatisfied: true,
      verificationMethod: 'SQL SELECT count(*) on test data tables'
    },
    {
      id: 'precond-gov-approved',
      category: 'GOVERNANCE',
      statement: 'Performance Contract formally approved by Lead Performance Architect',
      isSatisfied: true,
      verificationMethod: 'PECP Contract Governance Audit'
    }
  ]
};

/**
 * M3 Governed Approved Performance Contract.
 * Resolves upstream NFR ambiguity (NFR-021 defined as p95 < 2000ms).
 */
export const RETAILCO_M3_APPROVED_CONTRACT: PerformanceContract = {
  id: 'contract-proj-retailco-bf26-v1.0-approved',
  projectId: RETAILCO_PROJECT_FIXTURE.id,
  projectName: RETAILCO_PROJECT_FIXTURE.name,
  version: 'v1.0',
  engineeringIntent: 'FORECAST',
  status: 'APPROVED',
  createdAt: '2026-08-19T10:00:00Z',
  updatedAt: '2026-08-25T14:00:00Z',
  approvedBy: 'Lead Performance Architect',
  approvedAt: '2026-08-25T14:00:00Z',
  sourceIntelligenceReferences: [
    {
      id: 'intel-peak-orders',
      key: 'peak_hourly_orders',
      title: 'Peak Hourly Order Volume',
      canonicalState: 'APPROVED',
      reviewStatus: 'FOUND'
    },
    {
      id: 'intel-checkout-latency',
      key: 'checkout_response_time',
      title: 'Checkout Response Time Target',
      canonicalState: 'APPROVED',
      reviewStatus: 'FOUND'
    }
  ],
  workloadInputs: [
    {
      id: 'input-peak-orders',
      key: 'peak_hourly_orders',
      title: 'Peak Hourly Order Volume',
      value: 31500,
      unit: 'orders/hour',
      canonicalState: 'APPROVED',
      reviewStatus: 'FOUND',
      sourceId: 'intel-peak-orders'
    }
  ],
  workloadCalculations: [
    {
      calculationId: 'calc-throughput-hourly',
      outputParameter: 'hourly_orders',
      outputValue: 31500,
      unit: 'orders/hour',
      formulaIdentifier: 'throughput_time_unit_conversion',
      humanReadableExplanation: 'Authoritative peak order baseline of 31,500 orders/hour',
      inputValues: [{ parameter: 'peak_hourly_orders', value: 31500, unit: 'orders/hour' }],
      sourceIntelligenceIds: ['intel-peak-orders'],
      timestamp: '2026-08-25T14:00:00Z'
    },
    {
      calculationId: 'calc-throughput-second',
      outputParameter: 'per_second_orders',
      outputValue: 8.75,
      unit: 'orders/second',
      formulaIdentifier: 'throughput_time_unit_conversion',
      humanReadableExplanation: 'Deterministic rate conversion: 31,500 / 3,600 = 8.75 orders/second',
      inputValues: [{ parameter: 'hourly_orders', value: 31500, unit: 'orders/hour' }],
      sourceIntelligenceIds: ['intel-peak-orders'],
      timestamp: '2026-08-25T14:00:00Z'
    }
  ],
  blockedWorkloadCalculations: [],
  workloadReadiness: {
    status: 'READY',
    isReady: true,
    blockingIssuesCount: 0,
    warningIssuesCount: 0,
    issues: [],
    summary: 'Workload model fully calculated and approved with 8.75 orders/second target demand.'
  },
  acceptanceCriteria: [
    {
      id: 'ac-checkout-latency',
      key: 'checkout_response_time',
      metric: 'Checkout Response Time',
      target: 'p95 < 2000ms',
      operator: '<',
      thresholdValue: 2000,
      unit: 'ms',
      percentile: 95,
      scope: 'Checkout API',
      status: 'DEFINED',
      isBlockingForApproval: false
    },
    {
      id: 'ac-global-error-rate',
      key: 'global_error_rate',
      metric: 'HTTP Error Rate',
      target: '< 0.5%',
      operator: '<',
      thresholdValue: 0.005,
      unit: 'rate',
      scope: 'Global',
      status: 'DEFINED',
      isBlockingForApproval: false
    }
  ],
  unresolvedIssues: [],
  calculationLineageReferences: ['calc-throughput-hourly', 'calc-throughput-second'],
  approvalReadiness: {
    canApprove: true,
    blockingReasons: [],
    unresolvedIssuesCount: 0
  }
};
