import {
  ThroughputConversion,
  ThroughputUnit,
  CalculationLineage
} from '@pecp/pe-domain';

/**
 * Deterministic business throughput conversion.
 *
 * Converts transaction/order volumes across time bases (hour, minute, second).
 * In accordance with Constitution §3 and M1 Work Package §2:
 * "This is a unit conversion only. It must NOT be described as user/session
 * arrival rate unless the source intelligence explicitly says so."
 */
export function convertThroughput(
  baseRate: number,
  baseUnit: ThroughputUnit = 'per_hour',
  sourceId: string = 'intel-peak-orders',
  sourceTitle: string = 'Peak Hourly Order Volume'
): ThroughputConversion {
  if (baseRate < 0 || isNaN(baseRate)) {
    throw new Error(`Invalid throughput base rate: ${baseRate}`);
  }

  let hourlyRate: number;
  let perMinuteRate: number;
  let perSecondRate: number;

  switch (baseUnit) {
    case 'per_hour':
      hourlyRate = baseRate;
      perMinuteRate = Number((hourlyRate / 60).toFixed(4));
      perSecondRate = Number((perMinuteRate / 60).toFixed(4));
      break;
    case 'per_minute':
      perMinuteRate = baseRate;
      hourlyRate = Number((perMinuteRate * 60).toFixed(4));
      perSecondRate = Number((perMinuteRate / 60).toFixed(4));
      break;
    case 'per_second':
      perSecondRate = baseRate;
      perMinuteRate = Number((perSecondRate * 60).toFixed(4));
      hourlyRate = Number((perMinuteRate * 60).toFixed(4));
      break;
  }

  const derivationSteps: string[] = [
    `Base throughput: ${baseRate} [${baseUnit}]`,
    `÷ 60 = ${perMinuteRate} orders/minute`,
    `÷ 60 = ${perSecondRate} orders/second`
  ];

  const lineage: CalculationLineage = {
    calculationId: `calc-throughput-${Date.now()}`,
    outputParameter: 'order_throughput_per_second',
    outputValue: perSecondRate,
    unit: 'orders/second',
    formulaIdentifier: 'throughput_time_unit_conversion',
    humanReadableExplanation: `Converted peak business throughput of ${baseRate.toLocaleString()} orders/hour into ${perMinuteRate.toLocaleString()} orders/minute and ${perSecondRate.toLocaleString()} orders/second.`,
    derivationSteps,
    structuredSteps: [
      {
        operator: '÷',
        operand: 60,
        unit: 'seconds/minute',
        result: perMinuteRate,
        description: 'Hours to minutes conversion'
      },
      {
        operator: '÷',
        operand: 60,
        unit: 'minutes/second',
        result: perSecondRate,
        description: 'Minutes to seconds conversion'
      }
    ],
    inputValues: [
      {
        parameter: 'peak_business_demand',
        value: baseRate,
        unit: baseUnit,
        sourceId,
        sourceTitle
      }
    ],
    sourceIntelligenceIds: [sourceId],
    timestamp: new Date().toISOString(),
    assumptions: [
      'Throughput is assumed uniform across the peak hour duration unless burstiness curves are supplied.'
    ],
    warnings: [
      'This value reflects business order volume only. It cannot be used as user session arrival rate without an approved order-to-session conversion ratio.'
    ]
  };

  return {
    baseRate,
    baseUnit,
    hourlyRate,
    perMinuteRate,
    perSecondRate,
    lineage,
    semanticNotice:
      'Unit conversion of transaction/order volume only. This value must NOT be described as user/session arrival rate unless the source intelligence explicitly defines that relationship.'
  };
}
