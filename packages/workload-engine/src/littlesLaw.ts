import {
  CalculationLineage,
  BlockedCalculation,
  TimeUnit,
  ThroughputUnit
} from '@pecp/pe-domain';

export interface LittlesLawParams {
  arrivalRate: number;
  arrivalRateUnit: ThroughputUnit;
  residenceTime: number;
  residenceTimeUnit: TimeUnit;
  flowPopulation: string; // e.g. 'user_sessions' or 'checkout_transactions'
  sourceArrivalId?: string;
  sourceResidenceId?: string;
}

/**
 * Deterministic Little's Law computation: L = λ × W
 *
 * Valid only when λ (arrival rate) and W (residence time) belong to
 * the exact same flow population.
 */
export function calculateLittlesLaw(params: LittlesLawParams): CalculationLineage {
  const {
    arrivalRate,
    arrivalRateUnit,
    residenceTime,
    residenceTimeUnit,
    flowPopulation,
    sourceArrivalId = 'intel-arrival-rate',
    sourceResidenceId = 'intel-residence-time'
  } = params;

  if (arrivalRate <= 0 || isNaN(arrivalRate)) {
    throw new Error(`Invalid arrival rate for Little's Law: ${arrivalRate}`);
  }
  if (residenceTime <= 0 || isNaN(residenceTime)) {
    throw new Error(`Invalid residence time for Little's Law: ${residenceTime}`);
  }

  // Standardize arrival rate to per_second (λ)
  let lambdaPerSecond: number;
  switch (arrivalRateUnit) {
    case 'per_second':
      lambdaPerSecond = arrivalRate;
      break;
    case 'per_minute':
      lambdaPerSecond = arrivalRate / 60;
      break;
    case 'per_hour':
      lambdaPerSecond = arrivalRate / 3600;
      break;
  }

  // Standardize residence time to seconds (W)
  let residenceSeconds: number;
  switch (residenceTimeUnit) {
    case 'seconds':
      residenceSeconds = residenceTime;
      break;
    case 'minutes':
      residenceSeconds = residenceTime * 60;
      break;
    case 'hours':
      residenceSeconds = residenceTime * 3600;
      break;
  }

  // L = λ × W
  const concurrency = Number((lambdaPerSecond * residenceSeconds).toFixed(2));

  return {
    calculationId: `calc-littles-law-${Date.now()}`,
    outputParameter: `concurrency_${flowPopulation}`,
    outputValue: concurrency,
    unit: `concurrent_${flowPopulation}`,
    formulaIdentifier: 'littles_law_L_equals_lambda_times_W',
    humanReadableExplanation: `Calculated average concurrency of ${concurrency} ${flowPopulation} using Little's Law (L = λ × W) with arrival rate λ = ${lambdaPerSecond.toFixed(4)} ${flowPopulation}/sec and residence time W = ${residenceSeconds.toFixed(1)} seconds.`,
    derivationSteps: [
      `Normalized arrival rate (λ): ${lambdaPerSecond.toFixed(4)}/sec (from ${arrivalRate} ${arrivalRateUnit})`,
      `Normalized residence duration (W): ${residenceSeconds} sec (from ${residenceTime} ${residenceTimeUnit})`,
      `L = λ × W = ${lambdaPerSecond.toFixed(4)} × ${residenceSeconds} = ${concurrency} concurrent ${flowPopulation}`
    ],
    structuredSteps: [
      {
        operator: '×',
        operand: residenceSeconds,
        unit: 'seconds',
        result: concurrency,
        description: "Little's Law L = λ × W"
      }
    ],
    inputValues: [
      {
        parameter: `arrival_rate_${flowPopulation}`,
        value: arrivalRate,
        unit: arrivalRateUnit,
        sourceId: sourceArrivalId
      },
      {
        parameter: `residence_time_${flowPopulation}`,
        value: residenceTime,
        unit: residenceTimeUnit,
        sourceId: sourceResidenceId
      }
    ],
    sourceIntelligenceIds: [sourceArrivalId, sourceResidenceId].filter(Boolean),
    timestamp: new Date().toISOString(),
    assumptions: [
      `System is assumed to be in steady-state equilibrium where arrival rate equals departure rate for ${flowPopulation}.`
    ]
  };
}

/**
 * Checks whether session concurrency can be calculated from available inputs.
 *
 * CRITICAL M1 LAW:
 * Peak orders/hour + average session duration is NOT sufficient by itself to derive concurrent sessions.
 * Concurrency must NOT be inferred from business throughput unless the required arrival-rate / session
 * relationship is explicitly available.
 */
export function evaluateSessionConcurrency(inputs: {
  hasSessionArrivalRate: boolean;
  sessionArrivalRate?: number;
  sessionArrivalRateUnit?: ThroughputUnit;
  sourceSessionArrivalId?: string;
  hasSessionDuration: boolean;
  sessionDuration?: number;
  sessionDurationUnit?: TimeUnit;
  sourceSessionDurationId?: string;
  hasOrderThroughput: boolean;
  orderThroughput?: number;
  orderThroughputUnit?: ThroughputUnit;
  sourceOrderThroughputId?: string;
}): {
  canCalculate: boolean;
  calculation?: CalculationLineage;
  blocked?: BlockedCalculation;
} {
  // If we have explicit session arrival rate + session duration of the same population:
  if (
    inputs.hasSessionArrivalRate &&
    inputs.sessionArrivalRate &&
    inputs.hasSessionDuration &&
    inputs.sessionDuration
  ) {
    const calc = calculateLittlesLaw({
      arrivalRate: inputs.sessionArrivalRate,
      arrivalRateUnit: inputs.sessionArrivalRateUnit || 'per_hour',
      residenceTime: inputs.sessionDuration,
      residenceTimeUnit: inputs.sessionDurationUnit || 'minutes',
      flowPopulation: 'sessions',
      sourceArrivalId: inputs.sourceSessionArrivalId,
      sourceResidenceId: inputs.sourceSessionDurationId
    });
    return { canCalculate: true, calculation: calc };
  }

  // Otherwise, if we have order throughput + session duration, or missing session arrival rate:
  const availableInputs = [];
  if (inputs.hasOrderThroughput && inputs.orderThroughput) {
    availableInputs.push({
      parameter: 'order_throughput',
      value: inputs.orderThroughput,
      unit: inputs.orderThroughputUnit || 'orders/hour',
      sourceId: inputs.sourceOrderThroughputId
    });
  }
  if (inputs.hasSessionDuration && inputs.sessionDuration) {
    availableInputs.push({
      parameter: 'session_duration',
      value: inputs.sessionDuration,
      unit: inputs.sessionDurationUnit || 'minutes',
      sourceId: inputs.sourceSessionDurationId
    });
  }

  const blocked: BlockedCalculation = {
    calculationId: 'calc-concurrent-sessions',
    outputParameter: 'concurrent_sessions',
    status: 'BLOCKED',
    calculated: false,
    formulaIdentifier: 'littles_law_concurrency',
    reason:
      'Average session duration is known, but session arrival rate is not. Peak order throughput cannot be assumed to equal session arrival rate.',
    requiredIntelligence: [
      'Peak session starts/hour OR an approved relationship that converts business orders into session arrivals.'
    ],
    missingPrerequisites: ['session_arrival_rate'],
    availableInputs
  };

  return { canCalculate: false, blocked };
}
