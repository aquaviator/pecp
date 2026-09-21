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
 * Extracts the inner metric value dictionary if wrapped in `.values`,
 * or returns the object itself if flat (as in k6 v0.54.0 summary export).
 */
function getMetricSource(entry: any): any {
  if (!entry || typeof entry !== 'object') return undefined;
  if (entry.values && typeof entry.values === 'object') {
    return entry.values;
  }
  return entry;
}

/**
 * Parses a raw k6 trend metric value object into a normalized K6TrendDistribution.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseTrendValues(entry: any): K6TrendDistribution | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const min = src.min !== undefined && src.min !== null ? Number(src.min) : undefined;
  const max = src.max !== undefined && src.max !== null ? Number(src.max) : undefined;
  const avg = src.avg !== undefined && src.avg !== null ? Number(src.avg) : undefined;
  const med = src.med !== undefined && src.med !== null ? Number(src.med) : undefined;
  const p90 = src['p(90)'] !== undefined && src['p(90)'] !== null ? Number(src['p(90)']) : undefined;
  const p95 = src['p(95)'] !== undefined && src['p(95)'] !== null ? Number(src['p(95)']) : undefined;
  const p99 = src['p(99)'] !== undefined && src['p(99)'] !== null ? Number(src['p(99)']) : undefined;
  if (
    min === undefined &&
    max === undefined &&
    avg === undefined &&
    med === undefined &&
    p90 === undefined &&
    p95 === undefined &&
    p99 === undefined
  ) {
    return undefined;
  }
  return { min, max, avg, med, p90, p95, p99 };
}

/**
 * Parses a raw k6 counter metric value object into a normalized K6CounterMetric.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseCounterValues(entry: any): K6CounterMetric | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const count = src.count !== undefined && src.count !== null ? Number(src.count) : undefined;
  const rate = src.rate !== undefined && src.rate !== null ? Number(src.rate) : undefined;
  if (count === undefined && rate === undefined) return undefined;
  return { count, rate };
}

/**
 * Parses a raw k6 gauge metric value object into a normalized K6GaugeMetric.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseGaugeValues(entry: any): K6GaugeMetric | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const value = src.value !== undefined && src.value !== null ? Number(src.value) : undefined;
  const min = src.min !== undefined && src.min !== null ? Number(src.min) : undefined;
  const max = src.max !== undefined && src.max !== null ? Number(src.max) : undefined;
  if (value === undefined && min === undefined && max === undefined) return undefined;
  return { value, min, max };
}

/**
 * Parses a raw k6 rate metric value object into a normalized K6RateMetric.
 * In k6 summary exports, rate metrics provide `passes`, `fails`, and rate value in `value` or `rate`.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseRateValues(entry: any): K6RateMetric | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const passes = src.passes !== undefined && src.passes !== null ? Number(src.passes) : undefined;
  const fails = src.fails !== undefined && src.fails !== null ? Number(src.fails) : undefined;
  const rate = src.rate !== undefined && src.rate !== null
    ? Number(src.rate)
    : (src.value !== undefined && src.value !== null ? Number(src.value) : undefined);
  if (passes === undefined && fails === undefined && rate === undefined) return undefined;
  return { passes, fails, rate };
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
      const src = getMetricSource(metricData);
      for (const [expr, threshResult] of Object.entries(metricData.thresholds as Record<string, any>)) {
        let status: ThresholdObservationStatus = 'UNAVAILABLE';
        let engineResult: boolean | null = null;
        let parserSchemaVersion = 'k6-v0.54.0-summary-export';

        if (typeof threshResult === 'boolean') {
          // In k6 v0.54.0 summary export, boolean indicates whether the threshold breached/failed:
          // false = threshold did NOT breach (passed), true = threshold breached (failed)
          engineResult = !threshResult;
          status = threshResult ? 'OBSERVED_FAILED' : 'OBSERVED_PASSED';
          parserSchemaVersion = 'k6-v0.54.0-summary-export';
        } else if (threshResult && typeof threshResult === 'object') {
          if (typeof threshResult.ok === 'boolean') {
            engineResult = threshResult.ok;
            status = threshResult.ok ? 'OBSERVED_PASSED' : 'OBSERVED_FAILED';
            parserSchemaVersion = 'legacy-object-threshold';
          }
        }

        // Determine observed value from metric source where possible
        let observedValue: number | string | undefined;
        if (src && typeof src === 'object') {
          if (expr.includes('p(95)')) {
            observedValue = src['p(95)'];
          } else if (expr.includes('p(99)')) {
            observedValue = src['p(99)'];
          } else if (expr.includes('p(90)')) {
            observedValue = src['p(90)'];
          } else if (expr.includes('avg')) {
            observedValue = src.avg;
          } else if (expr.includes('rate')) {
            observedValue = src.rate !== undefined ? src.rate : src.value;
          } else if (expr.includes('count')) {
            observedValue = src.count;
          }
        }

        thresholdObservations.push({
          metric: metricKey,
          expression: expr,
          status,
          engineResult,
          observedValue,
          rawSource: metricData,
          rawThresholdValue: threshResult,
          parserSchemaVersion
        });
      }
    }
  }

  // Extract root group checks (supports both object map in v0.54.0 and array in legacy shapes)
  const rootChecks: K6CheckMetric[] = [];
  const checksSource = parsed.root_group?.checks;
  if (Array.isArray(checksSource)) {
    for (const c of checksSource) {
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
  } else if (checksSource && typeof checksSource === 'object') {
    for (const [checkKey, checkVal] of Object.entries(checksSource)) {
      if (checkVal && typeof checkVal === 'object') {
        const c = checkVal as any;
        rootChecks.push({
          name: String(c.name ?? checkKey),
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
    iterations: parseCounterValues(rawMetrics.iterations),
    droppedIterations: parseCounterValues(rawMetrics.dropped_iterations),
    httpReqs: parseCounterValues(rawMetrics.http_reqs),
    httpReqFailed: parseRateValues(rawMetrics.http_req_failed),
    checks: parseRateValues(rawMetrics.checks),
    vus: parseGaugeValues(rawMetrics.vus),
    vusMax: parseGaugeValues(rawMetrics.vus_max),
    dataReceived: parseCounterValues(rawMetrics.data_received),
    dataSent: parseCounterValues(rawMetrics.data_sent),
    httpReqDuration: parseTrendValues(rawMetrics.http_req_duration),
    httpReqWaiting: parseTrendValues(rawMetrics.http_req_waiting),
    httpReqConnecting: parseTrendValues(rawMetrics.http_req_connecting),
    httpReqReceiving: parseTrendValues(rawMetrics.http_req_receiving),
    httpReqBlocked: parseTrendValues(rawMetrics.http_req_blocked),
    httpReqSending: parseTrendValues(rawMetrics.http_req_sending),
    httpReqDurationExpected: parseTrendValues(rawMetrics['http_req_duration{expected_response:true}']),
    httpReqDurationCheckout: parseTrendValues(rawMetrics['http_req_duration{journey:checkout}']),
    iterationDuration: parseTrendValues(rawMetrics.iteration_duration),
    pecpJourneyDurationMs: parseTrendValues(rawMetrics.pecp_journey_duration_ms),
    pecpBusinessAttainmentEvents: parseCounterValues(rawMetrics.pecp_business_attainment_events),
    pecpWorkloadArrivalDemand: parseCounterValues(rawMetrics.pecp_workload_arrival_demand),
    // Correct metric semantics for pecp_workload_attainment_rate: Rate, not Counter
    pecpWorkloadAttainmentRate: rawMetrics.pecp_workload_attainment_rate
      ? parseRateValues(rawMetrics.pecp_workload_attainment_rate)
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
