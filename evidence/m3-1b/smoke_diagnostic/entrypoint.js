// ============================================================================
// PECP Governed k6 Entrypoint
// Source Test Definition: test-def-proj-retailco-bf2026-v1.0
// Engineering Intent: FORECAST
// Target Environment Ref: http://localhost:24642
// Fingerprint: fp-6911db94 (Deterministic drift checksum)
// Architecture: Thin orchestration delegating to PECP Stable k6 Runtime
// ============================================================================
import { executeIteration, workloadArrivalDemand, workloadAttainmentRate } from './runtime.js';
import { businessAttainmentEvents } from './runtime.js';
import { JOURNEY_WEIGHTS, JOURNEY_RUNNER_MAP } from './journeys.js';

// Load generated options and thresholds
export const options = (() => {
  const cfg = JSON.parse(open('./config.json'));
  if (cfg.scenarios) {
    for (const k of Object.keys(cfg.scenarios)) {
      const sc = cfg.scenarios[k];
      if (sc.stages && Array.isArray(sc.stages)) {
        sc.stages = sc.stages.map(function (st) {
          return Object.assign({}, st, { target: Math.round(st.target) });
        });
      }
    }
  }
  return cfg;
})();

// Re-export metrics for k6 engine discovery
export { workloadArrivalDemand, workloadAttainmentRate, businessAttainmentEvents };

const BASE_URL = __ENV['TARGET_BASE_URL'] || 'http://localhost:24642';

export default function () {
  executeIteration(JOURNEY_RUNNER_MAP, JOURNEY_WEIGHTS, BASE_URL, {});
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data, null, 2)
  };
}

function textSummary(data, options) {
  return `\n--- PECP k6 Test Execution Summary ---\nTest Definition: test-def-proj-retailco-bf2026-v1.0\nStatus: COMPLETED\n`;
}
