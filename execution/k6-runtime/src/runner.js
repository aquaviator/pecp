// PECP Stable k6 Runtime - Journey Orchestration Runner
import { workloadArrivalDemand, journeyDurationTrend } from './metrics.js';

/**
 * Selects a journey key based on canonical distribution weights.
 */
export function selectJourneyByWeight(weights) {
  const rand = Math.random();
  let cumulative = 0;
  for (const [journeyKey, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (rand <= cumulative) {
      return journeyKey;
    }
  }
  return Object.keys(weights)[0];
}

/**
 * Orchestrates a single iteration of user journey execution.
 */
export function executeIteration(journeyRunnerMap, weights, baseUrl, baseHeaders) {
  workloadArrivalDemand.add(1);
  const selectedKey = selectJourneyByWeight(weights);
  const runner = journeyRunnerMap[selectedKey];

  if (runner) {
    const startTime = new Date().getTime();
    runner(baseUrl, baseHeaders);
    const duration = new Date().getTime() - startTime;
    journeyDurationTrend.add(duration, { journey: selectedKey });
  }
}
