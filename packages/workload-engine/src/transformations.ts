import {
  CalculationLineage,
  CalculationLineageInput,
  JourneyDistribution,
  JourneyDistributionItem
} from '@pecp/pe-domain';

export interface GrowthHeadroomParams {
  baseValue: number;
  baseUnit: string;
  growthPercentage?: number; // e.g. 20 for +20%
  headroomPercentage?: number; // e.g. 30 for +30%
  sourceBaseId?: string;
  sourceGrowthId?: string;
  sourceHeadroomId?: string;
  parameterName?: string;
}

/**
 * Applies explicit growth and headroom transformations.
 * Formula: base × (1 + growth) × (1 + headroom)
 *
 * In accordance with Constitution §3 and M1 Work Package §2:
 * "Do not invent default growth/headroom percentages."
 */
export function applyGrowthAndHeadroom(params: GrowthHeadroomParams): CalculationLineage {
  const {
    baseValue,
    baseUnit,
    growthPercentage,
    headroomPercentage,
    sourceBaseId = 'intel-base-value',
    sourceGrowthId,
    sourceHeadroomId,
    parameterName = 'scaled_workload_demand'
  } = params;

  if (baseValue < 0 || isNaN(baseValue)) {
    throw new Error(`Invalid base value for growth calculation: ${baseValue}`);
  }

  const growthFactor = growthPercentage !== undefined ? growthPercentage / 100 : 0;
  const headroomFactor = headroomPercentage !== undefined ? headroomPercentage / 100 : 0;

  const valueAfterGrowth = baseValue * (1 + growthFactor);
  const finalValue = Number((valueAfterGrowth * (1 + headroomFactor)).toFixed(2));

  const inputValues: CalculationLineageInput[] = [
    {
      parameter: 'base_value',
      value: baseValue,
      unit: baseUnit,
      sourceId: sourceBaseId
    }
  ];

  const derivationSteps: string[] = [`Base value: ${baseValue} ${baseUnit}`];

  if (growthPercentage !== undefined) {
    inputValues.push({
      parameter: 'growth_percentage',
      value: `${growthPercentage}%`,
      sourceId: sourceGrowthId
    });
    derivationSteps.push(
      `Apply growth factor (${growthPercentage}%): ${baseValue} × ${(1 + growthFactor).toFixed(2)} = ${valueAfterGrowth.toFixed(2)}`
    );
  }

  if (headroomPercentage !== undefined) {
    inputValues.push({
      parameter: 'engineering_headroom_percentage',
      value: `${headroomPercentage}%`,
      sourceId: sourceHeadroomId
    });
    derivationSteps.push(
      `Apply engineering headroom (${headroomPercentage}%): ${valueAfterGrowth.toFixed(2)} × ${(1 + headroomFactor).toFixed(2)} = ${finalValue}`
    );
  }

  derivationSteps.push(`Final scaled value: ${finalValue} ${baseUnit}`);

  return {
    calculationId: `calc-growth-headroom-${Date.now()}`,
    outputParameter: parameterName,
    outputValue: finalValue,
    unit: baseUnit,
    formulaIdentifier: 'base_times_one_plus_growth_times_one_plus_headroom',
    humanReadableExplanation: `Calculated ${parameterName} of ${finalValue} ${baseUnit} starting from baseline ${baseValue} ${baseUnit}${growthPercentage !== undefined ? ` with +${growthPercentage}% projected growth` : ''}${headroomPercentage !== undefined ? ` and +${headroomPercentage}% engineering buffer` : ''}.`,
    derivationSteps,
    inputValues,
    sourceIntelligenceIds: [sourceBaseId, sourceGrowthId, sourceHeadroomId].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    ),
    timestamp: new Date().toISOString(),
    assumptions: [
      'Growth and headroom factors are compounded sequentially.'
    ]
  };
}

/**
 * Validates journey distribution percentages.
 *
 * Ensures all journey percentages sum to 100% within the explicit tolerance.
 * Preserves source lineage and flags invalid totals.
 */
export function validateJourneyDistribution(
  journeys: JourneyDistributionItem[],
  tolerance: number = 0.01,
  sourceIds: string[] = []
): JourneyDistribution {
  if (!journeys || journeys.length === 0) {
    return {
      journeys: [],
      totalPercentage: 0,
      isValid: false,
      tolerance,
      validationError: 'No journey distribution items provided.',
      sourceIntelligenceIds: sourceIds
    };
  }

  const totalPercentage = Number(
    journeys.reduce((sum, j) => sum + (j.percentage || 0), 0).toFixed(4)
  );

  const delta = Math.abs(totalPercentage - 100);
  const isValid = delta <= tolerance;

  let validationError: string | undefined;
  if (!isValid) {
    validationError = `Journey distribution total is ${totalPercentage}%, which deviates from 100% by ${delta.toFixed(2)}% (allowed tolerance: ±${tolerance}%).`;
  }

  return {
    journeys: journeys.map((j) => ({
      ...j,
      weight: Number(((j.percentage || 0) / 100).toFixed(4))
    })),
    totalPercentage,
    isValid,
    tolerance,
    validationError,
    sourceIntelligenceIds: sourceIds
  };
}
