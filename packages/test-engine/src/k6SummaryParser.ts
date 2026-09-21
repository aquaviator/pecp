import type {
  K6SummaryMetrics,
  K6CounterMetric,
  K6GaugeMetric,
  K6RateMetric,
  K6TrendDistribution,
  K6CheckMetric,
  ThresholdObservation,
  ThresholdObservationStatus
} from '@pecp/pe-domain';

/**
 * Parses a raw k6 trend metric value object into a normalized K6TrendDistribution.
 */
function parseTrendValues(values: any): K6TrendDistribution | undefined {
  if (!values || typeof values !== 'object') return undefined;
  return {
    min: Number(values.min ?? 0),
    max: Number(values.max ?? 0),
    avg: Number(values.avg ?? 0),
    med: Number(values.med ?? 0),
    p90: Number(values['p(90)'] ?? 0),
    p95: Number(values['p(95)'] ?? 0),
    p99: Number(values['p(99)'] ?? 0)
  };
}

/**
 * Parses a raw k6 counter metric value object into a normalized K6CounterMetric.
 */
function parseCounterValues(values: any): K6CounterMetric | undefined {
  if (!values || typeof values !== 'object') return undefined;
  return {
    count: Number(values.count ?? 0),
    rate: Number(values.rate ?? 0)
  };
}

/**
 * Parses a raw k6 gauge metric value object into a normalized K6GaugeMetric.
 */
function parseGaugeValues(values: any): K6GaugeMetric | undefined {
  if (!values || typeof values !== 'object') return undefined;
  return {
    value: Number(values.value ?? 0),
    min: Number(values.min ?? 0),
    max: Number(values.max ?? 0)
  };
}

/**
 * Parses a raw k6 rate metric value object into a normalized K6RateMetric.
 */
function parseRateValues(values: any): K6RateMetric | undefined {
  if (!values || typeof values !== 'object') return undefined;
  return {
    passes: Number(values.passes ?? 0),
    fails: Number(values.fails ?? 0),
    rate: Number(values.rate ?? 0)
  };
}

export interface K6SummaryParseResult {
  metrics: K6SummaryMetrics;
  thresholdObservations: ThresholdObservation[];
  durationMs: number;
}

/**
 * Deterministically parses the raw k6 summary JSON exported by k6 v0.54.0.
 * Invariant: Preserves raw metric names and values. Never invents absent metrics.
 */
export function parseK6SummaryJson(rawInput: string | Buffer | Record<string, any>): K6SummaryParseResult {
  let parsed: any;
  if (typeof rawInput === 'string' || Buffer.isBuffer(rawInput)) {
    try {
      parsed = JSON.parse(rawInput.toString('utf8'));
    } catch (err: any) {
      throw new Error(`PARSER_INCOMPATIBILITY: Failed to parse summary.json as valid JSON: ${err.message}`);
    }
  } else if (rawInput && typeof rawInput === 'object') {
    parsed = rawInput;
  } else {
    throw new Error('PARSER_INCOMPATIBILITY: Raw summary input is not a valid JSON string, Buffer, or object');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('PARSER_INCOMPATIBILITY: k6 summary payload must be a JSON object');
  }

  const durationMs = Number(parsed.state?.testRunDurationMs ?? 0);
  const rawMetrics: Record<string, any> = parsed.metrics ?? {};

  // Extract threshold observations across all metrics
  const thresholdObservations: ThresholdObservation[] = [];
  for (const [metricKey, metricData] of Object.entries(rawMetrics)) {
    if (metricData && typeof metricData === 'object' && metricData.thresholds) {
      for (const [expr, threshResult] of Object.entries(metricData.thresholds as Record<string, any>)) {
        let status: ThresholdObservationStatus = 'UNAVAILABLE';
        let engineResult: boolean | null = null;
        if (threshResult && typeof threshResult === 'object') {
          if (typeof threshResult.ok === 'boolean') {
            engineResult = threshResult.ok;
            status = threshResult.ok ? 'OBSERVED_PASSED' : 'OBSERVED_FAILED';
          }
        }

        // Determine observed value from metric values where possible
        let observedValue: number | string | undefined;
        const vals = metricData.values;
        if (vals && typeof vals === 'object') {
          if (expr.includes('p(95)')) {
            observedValue = vals['p(95)'];
          } else if (expr.includes('p(99)')) {
            observedValue = vals['p(99)'];
          } else if (expr.includes('p(90)')) {
            observedValue = vals['p(90)'];
          } else if (expr.includes('avg')) {
            observedValue = vals.avg;
          } else if (expr.includes('rate')) {
            observedValue = vals.rate;
          } else if (expr.includes('count')) {
            observedValue = vals.count;
          }
        }

        thresholdObservations.push({
          metric: metricKey,
          expression: expr,
          status,
          engineResult,
          observedValue,
          rawSource: threshResult
        });
      }
    }
  }

  // Extract root group checks
  const rootChecks: K6CheckMetric[] = [];
  if (Array.isArray(parsed.root_group?.checks)) {
    for (const c of parsed.root_group.checks) {
      if (c && typeof c === 'object') {
        rootChecks.push({
          name: String(c.name ?? ''),
          path: String(c.path ?? ''),
          id: String(c.id ?? ''),
          passes: Number(c.passes ?? 0),
          fails: Number(c.fails ?? 0)
        });
      }
    }
  }

  // Normalize metrics
  const summaryMetrics: K6SummaryMetrics = {
    testRunDurationMs: durationMs,
    iterations: parseCounterValues(rawMetrics.iterations?.values),
    droppedIterations: parseCounterValues(rawMetrics.dropped_iterations?.values),
    httpReqs: parseCounterValues(rawMetrics.http_reqs?.values),
    httpReqFailed: parseRateValues(rawMetrics.http_req_failed?.values),
    checks: parseRateValues(rawMetrics.checks?.values),
    vus: parseGaugeValues(rawMetrics.vus?.values),
    vusMax: parseGaugeValues(rawMetrics.vus_max?.values),
    dataReceived: parseCounterValues(rawMetrics.data_received?.values),
    dataSent: parseCounterValues(rawMetrics.data_sent?.values),
    httpReqDuration: parseTrendValues(rawMetrics.http_req_duration?.values),
    httpReqWaiting: parseTrendValues(rawMetrics.http_req_waiting?.values),
    httpReqConnecting: parseTrendValues(rawMetrics.http_req_connecting?.values),
    httpReqReceiving: parseTrendValues(rawMetrics.http_req_receiving?.values),
    httpReqBlocked: parseTrendValues(rawMetrics.http_req_blocked?.values),
    httpReqSending: parseTrendValues(rawMetrics.http_req_sending?.values),
    httpReqDurationExpected: parseTrendValues(rawMetrics['http_req_duration{expected_response:true}']?.values),
    httpReqDurationCheckout: parseTrendValues(rawMetrics['http_req_duration{journey:checkout}']?.values),
    iterationDuration: parseTrendValues(rawMetrics.iteration_duration?.values),
    pecpJourneyDurationMs: parseTrendValues(rawMetrics.pecp_journey_duration_ms?.values),
    pecpBusinessAttainmentEvents: parseCounterValues(rawMetrics.pecp_business_attainment_events?.values),
    pecpWorkloadArrivalDemand: parseCounterValues(rawMetrics.pecp_workload_arrival_demand?.values),
    // Explicitly undefined if absent: never default to 0 or invent a metric
    pecpWorkloadAttainmentRate: rawMetrics.pecp_workload_attainment_rate?.values
      ? parseCounterValues(rawMetrics.pecp_workload_attainment_rate.values)
      : undefined,
    rootChecks,
    rawMetrics
  };

  return {
    metrics: summaryMetrics,
    thresholdObservations,
    durationMs
  };
}
