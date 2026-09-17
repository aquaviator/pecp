// ============================================================================
// PECP Stable k6 Runtime (Authoritative Module v1.0.0)
// Architecture: Single authoritative execution runtime for metrics, HTTP execution,
// journey orchestration, and credential resolution.
// ============================================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const PECP_RUNTIME_VERSION = '1.0.0';
export const PECP_RUNTIME_SOURCE_ID = 'pecp-stable-k6-runtime-v1.0.0';

// 1. Core Metrics (Prerequisite workload arrival demand, business attainment events, & journey duration trends)
export const workloadArrivalDemand = new Counter('pecp_workload_arrival_demand');
export const workloadAttainmentRate = new Rate('pecp_workload_attainment_rate');
export const businessAttainmentEvents = new Counter('pecp_business_attainment_events');
export const journeyDurationTrend = new Trend('pecp_journey_duration_ms', true);

// 2. Governed Credential Resolution (Constitution §11, M3.0.2)
// Fails fast if required credential reference is not configured. Never logs secret.
export function resolveCredential(referenceId, purpose) {
  const envVal = typeof __ENV !== 'undefined' ? __ENV[referenceId] : undefined;
  if (!envVal || typeof envVal !== 'string' || envVal.trim() === '') {
    const purposeText = purpose ? ` for "${purpose}"` : '';
    throw new Error(
      `PECP Credential Resolution Error: Required credential reference "${referenceId}"${purposeText} is not configured in __ENV. Execution halted safely.`
    );
  }
  return envVal;
}

// 3. HTTP Helper (No invented defaults: explicit expectedStatus, thinkTimeSeconds, and business events)
export function executeStep(stepConfig) {
  const {
    method = 'GET',
    url,
    body,
    headers = {},
    tags = {},
    expectedStatus,
    thinkTimeSeconds = 0,
    businessEvent
  } = stepConfig;

  const params = {
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    tags
  };

  let res;
  const verb = method.toUpperCase();
  if (verb === 'GET') {
    res = http.get(url, params);
  } else if (verb === 'POST') {
    res = http.post(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else if (verb === 'PUT') {
    res = http.put(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else if (verb === 'DELETE') {
    res = http.del(url, params);
  } else if (verb === 'PATCH') {
    res = http.patch(url, typeof body === 'string' ? body : JSON.stringify(body || {}), params);
  } else {
    res = http.get(url, params);
  }

  // Check expected status ONLY if explicitly defined
  let statusOk = true;
  if (expectedStatus !== undefined && expectedStatus !== null) {
    statusOk = check(res, {
      [`${tags.name || 'Step'} status is ${expectedStatus}`]: (r) => r.status === expectedStatus
    });
  }

  // Record business attainment event contribution if explicitly defined and step succeeded
  if (businessEvent && statusOk) {
    const contribution = typeof businessEvent.contribution === 'number' ? businessEvent.contribution : 1;
    businessAttainmentEvents.add(contribution, {
      event_key: businessEvent.eventKey,
      metric: businessEvent.metric || 'orders'
    });
  }

  // Sleep ONLY if explicitly provided and greater than zero
  if (typeof thinkTimeSeconds === 'number' && thinkTimeSeconds > 0) {
    sleep(thinkTimeSeconds);
  }

  return res;
}

// 4. Journey Selection & Orchestration
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
