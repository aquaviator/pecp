import crypto from 'crypto';

export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export const AUTHORITATIVE_M3_1B_FACTS = {
  workflowRunId: '35577599469',
  repositoryCommitSha: '76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82',
  k6Version: '0.54.0',
  durationSeconds: 1321.161,
  durationMs: 1321161.0,
  iterations: 120981,
  iterationRate: 91.5892,
  droppedIterations: 8,
  businessEvents: 9671,
  businessEventRate: 7.3215,
  referenceLabOrderCreated: 9671,
  referenceLabTotalRequests: 120982,
  artifactId: '10629771462',
  artifactDigest: '0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91',
  artifactName: 'm3-1b-evidence-canonical-35577599469',
  runId: 'pecp-ref-canonical-1789978991064',
  expectedPerformanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED'
} as const;

// Materialized source bundle contents
export const MOCK_CONFIG_CONTENT = JSON.stringify({
  scenarios: {
    black_friday_2026_readiness___forecast_test: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 150,
      maxVUs: 350,
      stages: [
        { target: 109, duration: '300s' },
        { target: 109, duration: '900s' },
        { target: 0, duration: '120s' }
      ]
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    'http_req_duration{journey:checkout}': ['p(95)<2000']
  }
}, null, 2);

export const MOCK_JOURNEYS_CONTENT = `// Authoritative M3.1B Journeys
export function runJourneys(client, context) {
  // checkout, search, browse, basket, account
}
`;

export const MOCK_ENTRYPOINT_CONTENT = `// Authoritative M3.1B Entrypoint
import { runJourneys } from './journeys.js';
export default function() {
  runJourneys();
}
`;

export const MOCK_RUNTIME_CONTENT = `// PECP Canonical k6 Runtime v1.0.0
export const runtimeVersion = '1.0.0';
`;

export const MOCK_STDOUT_CONTENT = `
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: entrypoint.js
     output: -

  scenarios: (100.00%) 1 scenario, 350 max VUs, 22m0s max duration (incl. graceful stop):
           * black_friday_2026_readiness___forecast_test: 109.38 iterations/s for 22m0s (maxVUs: 150-350)

running (22m01.2s), 000/281 VUs, 120981 complete and 0 interrupted iterations
`;

export const MOCK_STDERR_CONTENT = '';

// Precompute checksums
export const MOCK_CONFIG_CHECKSUM = computeSha256(MOCK_CONFIG_CONTENT);
export const MOCK_JOURNEYS_CHECKSUM = computeSha256(MOCK_JOURNEYS_CONTENT);
export const MOCK_ENTRYPOINT_CHECKSUM = computeSha256(MOCK_ENTRYPOINT_CONTENT);
export const MOCK_RUNTIME_CHECKSUM = computeSha256(MOCK_RUNTIME_CONTENT);
export const MOCK_STDOUT_CHECKSUM = computeSha256(MOCK_STDOUT_CONTENT);
export const MOCK_STDERR_CHECKSUM = computeSha256(MOCK_STDERR_CONTENT);

export const AUTHORITATIVE_M3_1B_SUMMARY_JSON = {
  state: {
    isStdOutTTY: false,
    isStdErrTTY: false,
    testRunDurationMs: AUTHORITATIVE_M3_1B_FACTS.durationMs
  },
  metrics: {
    iterations: {
      type: 'counter',
      contains: 'default',
      values: {
        count: AUTHORITATIVE_M3_1B_FACTS.iterations,
        rate: AUTHORITATIVE_M3_1B_FACTS.iterationRate
      }
    },
    dropped_iterations: {
      type: 'counter',
      contains: 'default',
      values: {
        count: AUTHORITATIVE_M3_1B_FACTS.droppedIterations,
        rate: 0.00605
      }
    },
    http_reqs: {
      type: 'counter',
      contains: 'default',
      values: {
        count: AUTHORITATIVE_M3_1B_FACTS.iterations,
        rate: AUTHORITATIVE_M3_1B_FACTS.iterationRate
      }
    },
    http_req_failed: {
      type: 'rate',
      contains: 'default',
      values: {
        passes: 0,
        fails: AUTHORITATIVE_M3_1B_FACTS.iterations,
        rate: 0
      },
      thresholds: {
        'rate<0.005': {
          ok: true
        }
      }
    },
    checks: {
      type: 'rate',
      contains: 'default',
      values: {
        passes: 120981,
        fails: 0,
        rate: 1.0
      }
    },
    vus: {
      type: 'gauge',
      contains: 'default',
      values: {
        value: 0,
        min: 0,
        max: 281
      }
    },
    vus_max: {
      type: 'gauge',
      contains: 'default',
      values: {
        value: 281,
        min: 274,
        max: 281
      }
    },
    data_received: {
      type: 'counter',
      contains: 'data',
      values: {
        count: 65000000,
        rate: 49198.0
      }
    },
    data_sent: {
      type: 'counter',
      contains: 'data',
      values: {
        count: 20210000,
        rate: 15297.0
      }
    },
    http_req_duration: {
      type: 'trend',
      contains: 'time',
      values: {
        min: 0.29,
        med: 0.68,
        avg: 0.75,
        max: 29.35,
        'p(90)': 0.98,
        'p(95)': 1.11,
        'p(99)': 1.61
      }
    },
    'http_req_duration{journey:checkout}': {
      type: 'trend',
      contains: 'time',
      values: {
        min: 0.40,
        med: 0.85,
        avg: 0.95,
        max: 28.5,
        'p(90)': 1.30,
        'p(95)': 1.55,
        'p(99)': 2.40
      },
      thresholds: {
        'p(95)<2000': {
          ok: true
        }
      }
    },
    iteration_duration: {
      type: 'trend',
      contains: 'time',
      values: {
        min: 2000,
        med: 2002,
        avg: 2360.2,
        max: 4033,
        'p(90)': 3002,
        'p(95)': 4002,
        'p(99)': 4003
      }
    },
    pecp_journey_duration_ms: {
      type: 'trend',
      contains: 'time',
      values: {
        min: 2000,
        med: 2002,
        avg: 2360.2,
        max: 4033,
        'p(90)': 3002,
        'p(95)': 4002,
        'p(99)': 4003
      }
    },
    pecp_business_attainment_events: {
      type: 'counter',
      contains: 'default',
      values: {
        count: AUTHORITATIVE_M3_1B_FACTS.businessEvents,
        rate: AUTHORITATIVE_M3_1B_FACTS.businessEventRate
      }
    },
    pecp_workload_arrival_demand: {
      type: 'counter',
      contains: 'default',
      values: {
        count: AUTHORITATIVE_M3_1B_FACTS.iterations,
        rate: AUTHORITATIVE_M3_1B_FACTS.iterationRate
      }
    }
    // Invariant: pecp_workload_attainment_rate is deliberately omitted because it was absent in raw summary!
  },
  root_group: {
    name: '',
    path: '',
    id: 'd41d8cd98f00b204e9800998ecf8427e',
    groups: [],
    checks: [
      {
        name: 'status 200 or 201',
        path: '::status 200 or 201',
        id: '202c676d16f8ef1a7cf75cfb34e40e34',
        passes: 120981,
        fails: 0
      }
    ]
  }
};

export const MOCK_SUMMARY_CONTENT = JSON.stringify(AUTHORITATIVE_M3_1B_SUMMARY_JSON, null, 2);
export const MOCK_SUMMARY_CHECKSUM = computeSha256(MOCK_SUMMARY_CONTENT);

export const AUTHORITATIVE_M3_1B_MANIFEST = {
  runId: AUTHORITATIVE_M3_1B_FACTS.runId,
  executionMode: 'CANONICAL',
  operationalStatus: 'EXECUTION_COMPLETED',
  commitSha: AUTHORITATIVE_M3_1B_FACTS.repositoryCommitSha,
  repositoryCommitSha: AUTHORITATIVE_M3_1B_FACTS.repositoryCommitSha,
  workflowRunId: AUTHORITATIVE_M3_1B_FACTS.workflowRunId,
  timestamps: {
    startedAt: '2026-09-21T08:23:11.065Z',
    completedAt: '2026-09-21T08:45:12.226Z',
    durationSeconds: AUTHORITATIVE_M3_1B_FACTS.durationSeconds
  },
  engine: {
    name: 'k6',
    version: AUTHORITATIVE_M3_1B_FACTS.k6Version,
    fullVersionString: 'k6 v0.54.0 (commit/baba871c8a, go1.23.1, linux/amd64)',
    isPinnedExpected: true,
    binaryPath: 'k6'
  },
  target: {
    baseUrl: 'http://localhost:53112',
    probeResult: {
      baseUrl: 'http://localhost:53112',
      verifiedAt: '2026-09-21T08:23:11.065Z',
      healthStatus: 'healthy',
      readyStatus: 'ready',
      isResolvable: true,
      httpStatusHealth: 200,
      httpStatusReady: 200
    }
  },
  pecpBinding: {
    sourceContractId: 'contract-proj-retailco-bf26-v1.0-approved',
    sourceContractVersion: 'v1.0',
    sourceContractFingerprint: 'fp-0dad9ae4',
    sourceContractStatus: 'APPROVED',
    testDefinitionId: 'test-def-proj-retailco-bf2026-v1.0',
    testDefinitionVersion: 'v1.0',
    testDefinitionFingerprint: 'fp-6911db94',
    bundleFingerprint: 'fp-256b6329',
    runtimeVersion: '1.0.0',
    runtimeSourceId: 'pecp-stable-k6-runtime-v1.0.0',
    schedulerArrival: {
      population: 'JOURNEY_ITERATION',
      peakRate: 109.375,
      unit: 'journey_iterations/second'
    },
    businessAttainment: {
      metric: 'orders',
      targetValue: 8.75,
      unit: 'orders/second'
    }
  },
  preflight: {
    manifestTimestamp: '2026-09-21T08:23:10.950Z',
    status: 'READY_FOR_LIVE_EXECUTION',
    isValid: true,
    blockingReasons: []
  },
  credentials: [
    {
      referenceId: 'RETAILCO_CHECKOUT_AUTH_TOKEN',
      purpose: 'Checkout API Authorization',
      provider: 'ENV_VAR',
      injectedAs: 'TARGET_BASE_URL & k6 -e RETAILCO_CHECKOUT_AUTH_TOKEN',
      maskedValue: '***REDACTED_EPHEMERAL***'
    }
  ],
  materializedFiles: [
    {
      filename: 'config.json',
      path: '/artifacts/canonical/config.json',
      sizeBytes: Buffer.byteLength(MOCK_CONFIG_CONTENT),
      checksum: MOCK_CONFIG_CHECKSUM
    },
    {
      filename: 'journeys.js',
      path: '/artifacts/canonical/journeys.js',
      sizeBytes: Buffer.byteLength(MOCK_JOURNEYS_CONTENT),
      checksum: MOCK_JOURNEYS_CHECKSUM
    },
    {
      filename: 'entrypoint.js',
      path: '/artifacts/canonical/entrypoint.js',
      sizeBytes: Buffer.byteLength(MOCK_ENTRYPOINT_CONTENT),
      checksum: MOCK_ENTRYPOINT_CHECKSUM
    },
    {
      filename: 'runtime.js',
      path: '/artifacts/canonical/runtime.js',
      sizeBytes: Buffer.byteLength(MOCK_RUNTIME_CONTENT),
      checksum: MOCK_RUNTIME_CHECKSUM
    }
  ],
  k6ExitCode: 0,
  rawArtefacts: {
    summaryJson: {
      path: '/artifacts/canonical/summary.json',
      sizeBytes: Buffer.byteLength(MOCK_SUMMARY_CONTENT),
      checksum: MOCK_SUMMARY_CHECKSUM
    },
    stdoutLog: {
      path: '/artifacts/canonical/k6-stdout.log',
      sizeBytes: Buffer.byteLength(MOCK_STDOUT_CONTENT),
      checksum: MOCK_STDOUT_CHECKSUM
    },
    stderrLog: {
      path: '/artifacts/canonical/k6-stderr.log',
      sizeBytes: Buffer.byteLength(MOCK_STDERR_CONTENT),
      checksum: MOCK_STDERR_CHECKSUM
    },
    configJson: {
      filename: 'config.json',
      path: '/artifacts/canonical/config.json',
      sizeBytes: Buffer.byteLength(MOCK_CONFIG_CONTENT),
      checksum: MOCK_CONFIG_CHECKSUM
    },
    journeysJs: {
      filename: 'journeys.js',
      path: '/artifacts/canonical/journeys.js',
      sizeBytes: Buffer.byteLength(MOCK_JOURNEYS_CONTENT),
      checksum: MOCK_JOURNEYS_CHECKSUM
    },
    entrypointJs: {
      filename: 'entrypoint.js',
      path: '/artifacts/canonical/entrypoint.js',
      sizeBytes: Buffer.byteLength(MOCK_ENTRYPOINT_CONTENT),
      checksum: MOCK_ENTRYPOINT_CHECKSUM
    },
    runtimeJs: {
      filename: 'runtime.js',
      path: '/artifacts/canonical/runtime.js',
      sizeBytes: Buffer.byteLength(MOCK_RUNTIME_CONTENT),
      checksum: MOCK_RUNTIME_CHECKSUM
    }
  },
  referenceLabMetrics: {
    before: {
      requestCountsByRoute: {
        '/health': 2,
        '/ready': 2,
        '/api/v1/metrics': 1
      },
      statusCounts: { '200': 5 },
      businessAttainmentEvents: { order_created: 0 },
      totalRequests: 5,
      capturedAt: '2026-09-21T08:23:11.100Z'
    },
    after: {
      requestCountsByRoute: {
        '/health': 2,
        '/ready': 2,
        '/api/v1/metrics': 2,
        '/api/v1/products/search': 24003,
        '/api/v1/products/featured': 66713,
        '/api/v1/orders/checkout': 9671,
        '/api/v1/basket/items': 18195,
        '/api/v1/customers/me/orders': 2399
      },
      statusCounts: {
        '200': 111316,
        '201': 9671
      },
      businessAttainmentEvents: { order_created: 9671 },
      totalRequests: 120987,
      capturedAt: '2026-09-21T08:45:12.200Z'
    },
    delta: {
      totalRequests: AUTHORITATIVE_M3_1B_FACTS.referenceLabTotalRequests,
      requestsByRoute: {
        '/health': 0,
        '/ready': 0,
        '/api/v1/metrics': 1,
        '/api/v1/products/search': 24003,
        '/api/v1/products/featured': 66713,
        '/api/v1/orders/checkout': 9671,
        '/api/v1/basket/items': 18195,
        '/api/v1/customers/me/orders': 2399
      },
      statusCounts: {
        '200': 111311,
        '201': 9671
      },
      orderCreatedEvents: AUTHORITATIVE_M3_1B_FACTS.referenceLabOrderCreated,
      durationSeconds: 1321.100
    }
  },
  businessAttainment: {
    metric: 'orders',
    orderCreatedEventsObserved: AUTHORITATIVE_M3_1B_FACTS.businessEvents,
    targetArrivalRate: 8.75
  },
  performanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED',
  verdictDisclaimer: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED: M3.1B is strictly an execution proof. No PECP PASS/FAIL/INCONCLUSIVE performance verdict is evaluated or assigned.',
  issues: []
};

export const AUTHORITATIVE_M3_1B_ARTIFACT_REFERENCE = {
  id: AUTHORITATIVE_M3_1B_FACTS.artifactId,
  name: AUTHORITATIVE_M3_1B_FACTS.artifactName,
  digest: AUTHORITATIVE_M3_1B_FACTS.artifactDigest,
  retentionExpiresAt: '2026-12-20'
};
