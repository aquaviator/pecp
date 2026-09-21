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
 * Validates and converts a metric value into a finite number.
 * Returns undefined if val is absent (undefined or null).
 * Throws a MALFORMED_METRIC error if a non-finite value (NaN, Infinity, or invalid string) is provided.
 */
export function parseFiniteNumber(val: any, metricName: string, fieldName: string): number | undefined {
  if (val === undefined || val === null) return undefined;
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw new Error(`MALFORMED_METRIC: Metric '${metricName}' field '${fieldName}' has invalid numeric value: ${String(val)}`);
  }
  return num;
}

/**
 * Parses a raw k6 trend metric value object into a normalized K6TrendDistribution.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseTrendValues(entry: any, metricName: string = 'trend'): K6TrendDistribution | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const min = parseFiniteNumber(src.min, metricName, 'min');
  const max = parseFiniteNumber(src.max, metricName, 'max');
  const avg = parseFiniteNumber(src.avg, metricName, 'avg');
  const med = parseFiniteNumber(src.med, metricName, 'med');
  const p90 = parseFiniteNumber(src['p(90)'], metricName, 'p(90)');
  const p95 = parseFiniteNumber(src['p(95)'], metricName, 'p(95)');
  const p99 = parseFiniteNumber(src['p(99)'], metricName, 'p(99)');
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
function parseCounterValues(entry: any, metricName: string = 'counter'): K6CounterMetric | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const count = parseFiniteNumber(src.count, metricName, 'count');
  const rate = parseFiniteNumber(src.rate, metricName, 'rate');
  if (count === undefined && rate === undefined) return undefined;
  return { count, rate };
}

/**
 * Parses a raw k6 gauge metric value object into a normalized K6GaugeMetric.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseGaugeValues(entry: any, metricName: string = 'gauge'): K6GaugeMetric | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const value = parseFiniteNumber(src.value, metricName, 'value');
  const min = parseFiniteNumber(src.min, metricName, 'min');
  const max = parseFiniteNumber(src.max, metricName, 'max');
  if (value === undefined && min === undefined && max === undefined) return undefined;
  return { value, min, max };
}

/**
 * Parses a raw k6 rate metric value object into a normalized K6RateMetric.
 * In k6 summary exports, rate metrics provide `passes`, `fails`, and rate value in `value` or `rate`.
 * If source is absent, returns undefined. Does not normalize absent fields to 0.
 */
function parseRateValues(entry: any, metricName: string = 'rate'): K6RateMetric | undefined {
  const src = getMetricSource(entry);
  if (!src) return undefined;
  const passes = parseFiniteNumber(src.passes, metricName, 'passes');
  const fails = parseFiniteNumber(src.fails, metricName, 'fails');
  const rawRate = src.rate !== undefined && src.rate !== null
    ? src.rate
    : (src.value !== undefined && src.value !== null ? src.value : undefined);
  const rate = parseFiniteNumber(rawRate, metricName, 'rate');
  if (passes === undefined && fails === undefined && rate === undefined) return undefined;
  return { passes, fails, rate };
}

export interface K6SummaryParseResult {
  metrics: K6SummaryMetrics;
  thresholdObservations: ThresholdObservation[];
  durationMs?: number;
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

  let durationMs: number | undefined;
  if (parsed.state?.testRunDurationMs !== undefined && parsed.state?.testRunDurationMs !== null) {
    durationMs = parseFiniteNumber(parsed.state.testRunDurationMs, 'state', 'testRunDurationMs');
  }

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
            observedValue = parseFiniteNumber(src['p(95)'], metricKey, 'p(95)');
          } else if (expr.includes('p(99)')) {
            observedValue = parseFiniteNumber(src['p(99)'], metricKey, 'p(99)');
          } else if (expr.includes('p(90)')) {
            observedValue = parseFiniteNumber(src['p(90)'], metricKey, 'p(90)');
          } else if (expr.includes('avg')) {
            observedValue = parseFiniteNumber(src.avg, metricKey, 'avg');
          } else if (expr.includes('rate')) {
            const rawRate = src.rate !== undefined && src.rate !== null ? src.rate : src.value;
            observedValue = parseFiniteNumber(rawRate, metricKey, 'rate');
          } else if (expr.includes('count')) {
            observedValue = parseFiniteNumber(src.count, metricKey, 'count');
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
        const checkName = String(c.name ?? '');
        const passes = c.passes !== undefined && c.passes !== null
          ? parseFiniteNumber(c.passes, checkName, 'passes')
          : undefined;
        const fails = c.fails !== undefined && c.fails !== null
          ? parseFiniteNumber(c.fails, checkName, 'fails')
          : undefined;
        rootChecks.push({
          name: checkName,
          path: String(c.path ?? ''),
          id: String(c.id ?? ''),
          passes,
          fails
        });
      }
    }
  } else if (checksSource && typeof checksSource === 'object') {
    for (const [checkKey, checkVal] of Object.entries(checksSource)) {
      if (checkVal && typeof checkVal === 'object') {
        const c = checkVal as any;
        const checkName = String(c.name ?? checkKey);
        const passes = c.passes !== undefined && c.passes !== null
          ? parseFiniteNumber(c.passes, checkName, 'passes')
          : undefined;
        const fails = c.fails !== undefined && c.fails !== null
          ? parseFiniteNumber(c.fails, checkName, 'fails')
          : undefined;
        rootChecks.push({
          name: checkName,
          path: String(c.path ?? ''),
          id: String(c.id ?? ''),
          passes,
          fails
        });
      }
    }
  }

  // Normalize metrics
  const summaryMetrics: K6SummaryMetrics = {
    testRunDurationMs: durationMs,
    iterations: parseCounterValues(rawMetrics.iterations, 'iterations'),
    droppedIterations: parseCounterValues(rawMetrics.dropped_iterations, 'dropped_iterations'),
    httpReqs: parseCounterValues(rawMetrics.http_reqs, 'http_reqs'),
    httpReqFailed: parseRateValues(rawMetrics.http_req_failed, 'http_req_failed'),
    checks: parseRateValues(rawMetrics.checks, 'checks'),
    vus: parseGaugeValues(rawMetrics.vus, 'vus'),
    vusMax: parseGaugeValues(rawMetrics.vus_max, 'vus_max'),
    dataReceived: parseCounterValues(rawMetrics.data_received, 'data_received'),
    dataSent: parseCounterValues(rawMetrics.data_sent, 'data_sent'),
    httpReqDuration: parseTrendValues(rawMetrics.http_req_duration, 'http_req_duration'),
    httpReqWaiting: parseTrendValues(rawMetrics.http_req_waiting, 'http_req_waiting'),
    httpReqConnecting: parseTrendValues(rawMetrics.http_req_connecting, 'http_req_connecting'),
    httpReqReceiving: parseTrendValues(rawMetrics.http_req_receiving, 'http_req_receiving'),
    httpReqBlocked: parseTrendValues(rawMetrics.http_req_blocked, 'http_req_blocked'),
    httpReqSending: parseTrendValues(rawMetrics.http_req_sending, 'http_req_sending'),
    httpReqDurationExpected: parseTrendValues(rawMetrics['http_req_duration{expected_response:true}'], 'http_req_duration{expected_response:true}'),
    httpReqDurationCheckout: parseTrendValues(rawMetrics['http_req_duration{journey:checkout}'], 'http_req_duration{journey:checkout}'),
    iterationDuration: parseTrendValues(rawMetrics.iteration_duration, 'iteration_duration'),
    pecpJourneyDurationMs: parseTrendValues(rawMetrics.pecp_journey_duration_ms, 'pecp_journey_duration_ms'),
    pecpBusinessAttainmentEvents: parseCounterValues(rawMetrics.pecp_business_attainment_events, 'pecp_business_attainment_events'),
    pecpWorkloadArrivalDemand: parseCounterValues(rawMetrics.pecp_workload_arrival_demand, 'pecp_workload_arrival_demand'),
    // Correct metric semantics for pecp_workload_attainment_rate: Rate, not Counter
    pecpWorkloadAttainmentRate: rawMetrics.pecp_workload_attainment_rate
      ? parseRateValues(rawMetrics.pecp_workload_attainment_rate, 'pecp_workload_attainment_rate')
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
