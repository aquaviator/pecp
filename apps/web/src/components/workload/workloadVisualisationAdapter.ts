// Pure Deterministic Workload Visualisation Adapter (M4.3)
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md
// Invariant: Pure presentation adapter, no wall clock, no caller-object mutation, no rate invention, no weight normalization.

import {
  ResultsReportVisualisationHook,
  ResultsReportVisualisationStage,
  ResultsReportJourneyDistributionItem,
  TestDefinition
} from '@pecp/pe-domain';

export interface SchedulerDataPoint {
  elapsedSeconds: number;
  rate: number | null;
  stageIndex?: number;
  label?: string;
}

export interface JourneySeriesDataPoint {
  elapsedSeconds: number;
  totalSchedulerRate: number | null;
  [journeyKey: string]: number | null | undefined;
}

export interface JourneyVisualisationMeta {
  key: string;
  name: string;
  percentage: number | null;
  weight: number | null;
  peakRate: number | null;
  color: string;
}

export interface WorkloadVisualisationSummary {
  executionModel: string | null;
  population: string | null;
  rateUnit: string | null;
  startRate: number | null;
  peakArrivalRate: number | null;
  totalDurationSeconds: number | null;
  businessTarget: {
    metric: string | null;
    targetValue: number | null;
    unit: string | null;
    timeBasis: string | null;
  } | null;
  populationRelationshipText: string | null;
  journeySumPercentage: number | null;
  isDistributionComplete: boolean;
}

export interface WorkloadVisualisationData {
  hasData: boolean;
  schedulerPoints: SchedulerDataPoint[];
  journeySeriesPoints: JourneySeriesDataPoint[];
  journeyMetadata: JourneyVisualisationMeta[];
  validationIssues: string[];
  summary: WorkloadVisualisationSummary;
}

// Distinct, accessible palette for journeys in dark workbench UI
const JOURNEY_PALETTE = [
  '#0284c7', // sky-600
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
  '#14b8a6'  // teal-500
];

function cleanFloat(val: number): number {
  return Math.round(val * 100000000) / 100000000;
}

/**
 * Builds deterministic series for scheduler and journey distribution visualisation.
 * Never mutates input hook.
 * Preserves missing startRate as null/absent without inventing 0.
 * Preserves exact stage sequence (load, stress, soak, spike, custom).
 * Does not normalize journey weights/percentages.
 */
export function buildWorkloadVisualisationSeries(
  hook: ResultsReportVisualisationHook | null | undefined
): WorkloadVisualisationData {
  if (!hook) {
    return {
      hasData: false,
      schedulerPoints: [],
      journeySeriesPoints: [],
      journeyMetadata: [],
      validationIssues: ['No visualisation hook provided in Results Report.'],
      summary: {
        executionModel: null,
        population: null,
        rateUnit: null,
        startRate: null,
        peakArrivalRate: null,
        totalDurationSeconds: null,
        businessTarget: null,
        populationRelationshipText: null,
        journeySumPercentage: null,
        isDistributionComplete: false
      }
    };
  }

  const validationIssues: string[] = [];
  const stages: ResultsReportVisualisationStage[] = hook.stages ? [...hook.stages] : [];
  const journeys: ResultsReportJourneyDistributionItem[] = hook.journeyDistribution
    ? [...hook.journeyDistribution]
    : [];

  const schedulerSummary = hook.scheduler;
  const businessTarget = hook.businessTarget
    ? {
        metric: hook.businessTarget.metric ?? null,
        targetValue: hook.businessTarget.targetValue ?? null,
        unit: hook.businessTarget.unit ?? null,
        timeBasis: hook.businessTarget.timeBasis ?? null
      }
    : null;

  const populationRelationshipText: string | null =
    (hook as any).populationRelationship?.description ||
    (hook as any).populationRelationshipText ||
    (hook as any).relationshipText ||
    null;

  // Inspect journey percentages / weights without normalizing
  let sumPercentage = 0;
  let hasValidPercentages = false;
  journeys.forEach((j) => {
    if (j.percentage != null) {
      sumPercentage += j.percentage;
      hasValidPercentages = true;
    } else if (j.weight != null) {
      sumPercentage += j.weight * 100;
      hasValidPercentages = true;
    }
  });

  const isDistributionComplete =
    hasValidPercentages && Math.abs(sumPercentage - 100) < 0.01;

  if (journeys.length > 0 && !isDistributionComplete) {
    validationIssues.push(
      `Governed journey distribution totals ${sumPercentage}% (does not equal 100%). Preserving exact unnormalized values.`
    );
  }

  const peakRate = schedulerSummary?.peakArrivalRate ?? null;

  // Build Journey Metadata
  const journeyMetadata: JourneyVisualisationMeta[] = journeys.map((j, idx) => {
    const key = j.journeyKey || j.journeyId || `journey-${idx}`;
    const weight =
      j.weight != null
        ? j.weight
        : j.percentage != null
        ? j.percentage / 100
        : null;
    const peakPerJourney =
      peakRate != null && weight != null ? cleanFloat(peakRate * weight) : null;

    return {
      key,
      name: j.name,
      percentage: j.percentage ?? (weight != null ? cleanFloat(weight * 100) : null),
      weight,
      peakRate: peakPerJourney,
      color: JOURNEY_PALETTE[idx % JOURNEY_PALETTE.length]
    };
  });

  // Build Scheduler Points
  const schedulerPoints: SchedulerDataPoint[] = [];

  if (stages.length > 0) {
    const firstStage = stages[0];
    const initialRate =
      firstStage.startArrivalRate !== undefined
        ? firstStage.startArrivalRate
        : schedulerSummary?.startRate !== undefined
        ? schedulerSummary.startRate
        : null;

    schedulerPoints.push({
      elapsedSeconds: firstStage.startTimeSeconds,
      rate: initialRate,
      label: initialRate != null ? `t=0s: ${initialRate}` : 't=0s: absent'
    });

    stages.forEach((stage, idx) => {
      schedulerPoints.push({
        elapsedSeconds: stage.endTimeSeconds,
        rate: stage.targetArrivalRate,
        stageIndex: stage.stageIndex ?? idx + 1,
        label: `Stage ${idx + 1}: ${stage.targetArrivalRate}`
      });
    });
  }

  // Build Journey Series Data Points
  const journeySeriesPoints: JourneySeriesDataPoint[] = schedulerPoints.map((point) => {
    const entry: JourneySeriesDataPoint = {
      elapsedSeconds: point.elapsedSeconds,
      totalSchedulerRate: point.rate
    };

    journeyMetadata.forEach((meta) => {
      if (point.rate == null || meta.weight == null) {
        entry[meta.key] = null;
      } else {
        // Presentation-only derived calculation: schedulerRate * journeyWeight
        entry[meta.key] = cleanFloat(point.rate * meta.weight);
      }
    });

    return entry;
  });

  const totalDurationSeconds =
    stages.length > 0 ? stages[stages.length - 1].endTimeSeconds : null;

  return {
    hasData: stages.length > 0 || journeys.length > 0,
    schedulerPoints,
    journeySeriesPoints,
    journeyMetadata,
    validationIssues,
    summary: {
      executionModel: schedulerSummary?.executionModel ?? null,
      population: schedulerSummary?.population ?? null,
      rateUnit: schedulerSummary?.rateUnit ?? null,
      startRate: schedulerSummary?.startRate ?? null,
      peakArrivalRate: peakRate,
      totalDurationSeconds,
      businessTarget,
      populationRelationshipText,
      journeySumPercentage: hasValidPercentages ? sumPercentage : null,
      isDistributionComplete
    }
  };
}

/**
 * Deterministically constructs a ResultsReportVisualisationHook from a TestDefinition.
 * Pure presentation helper: no wall clock, no mutation, no invented rates or units.
 * Preserves exact stage order, computes cumulative start/end times,
 * preserves startRate, targetArrivalRate, and exact journey weights/percentages.
 */
export function buildVisualisationHookFromTestDefinition(
  testDef: TestDefinition | null | undefined
): ResultsReportVisualisationHook | null {
  if (!testDef) return null;

  const scenario = testDef.scenarios?.[0];
  const schedule = scenario?.workloadSchedule;
  const attainment =
    scenario?.attainmentRequirement || (testDef as any).workloadAttainment;

  const stages: ResultsReportVisualisationStage[] = (schedule?.stages || []).map(
    (stage, idx, all) => {
      const prevEnd =
        idx === 0
          ? 0
          : all.slice(0, idx).reduce((sum, s) => sum + s.durationSeconds, 0);
      const startArrivalRate =
        (stage as any).startArrivalRate !== undefined
          ? (stage as any).startArrivalRate
          : idx === 0
          ? schedule?.startRate ?? null
          : all[idx - 1].targetArrivalRate;

      return {
        stageIndex: idx + 1,
        name: stage.description ?? null,
        durationSeconds: stage.durationSeconds,
        startTimeSeconds: prevEnd,
        endTimeSeconds: prevEnd + stage.durationSeconds,
        startArrivalRate,
        targetArrivalRate: stage.targetArrivalRate
      };
    }
  );

  const journeys = testDef.journeys || scenario?.journeyDistribution || [];
  const journeyDistribution: ResultsReportJourneyDistributionItem[] = journeys.map(
    (j) => ({
      journeyId: j.id,
      journeyKey: (j as any).key || (j as any).journeyKey,
      name: j.name,
      percentage: j.percentage ?? null,
      weight: j.weight ?? null,
      description: (j as any).description ?? null
    })
  );

  const relationship =
    scenario?.populationRelationship || (testDef as any).populationRelationship;

  return {
    scheduler: schedule
      ? {
          executionModel: schedule.executionModel ?? null,
          population: schedule.arrivalPopulation ?? null,
          rateUnit: schedule.rateUnit ?? null,
          startRate: schedule.startRate ?? null,
          peakArrivalRate: schedule.peakArrivalRate ?? null
        }
      : null,
    businessTarget: attainment
      ? {
          metric: attainment.metric ?? null,
          targetValue: attainment.targetValue ?? null,
          unit: attainment.unit ?? null,
          timeBasis: (attainment as any).timeBasis ?? null
        }
      : null,
    stages,
    journeyDistribution,
    ...(relationship ? { populationRelationship: relationship } : {})
  } as ResultsReportVisualisationHook;
}

