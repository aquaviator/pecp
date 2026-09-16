import {
  ProjectSummary,
  IntelligenceItem,
  PerformanceContract,
  ContractStatus,
  AcceptanceCriterion,
  CalculationLineage,
  BlockedCalculation,
  WorkloadInput
} from '@pecp/pe-domain';
import { convertThroughput } from './throughput';
import { evaluateSessionConcurrency } from './littlesLaw';
import { evaluateWorkloadReadiness } from './readiness';

export interface CompileContractOptions {
  projectSummary: ProjectSummary;
  intelligenceItems: IntelligenceItem[];
  version?: string;
  allowCandidatePreview?: boolean;
  compilationTimestamp?: string | Date;
}

interface ParsedCriterion {
  operator?: string;
  thresholdValue?: number;
  unit?: string;
  percentile?: number;
  scope?: string;
  target?: string;
}

/**
 * Parses criterion properties strictly from source intelligence without inventing magic numbers.
 */
function parseCriterionFromItem(item: IntelligenceItem): ParsedCriterion {
  let operator: string | undefined;
  let thresholdValue: number | undefined;
  let unit: string | undefined = item.unit || undefined;
  let percentile: number | undefined;
  let scope: string | undefined;

  // Extract operator and threshold
  if (typeof item.value === 'number') {
    thresholdValue = item.value;
  } else if (typeof item.value === 'string') {
    const trimmed = item.value.trim();
    const opMatch = trimmed.match(/^(<=|>=|<|>|==|=)\s*([\d,.]+)\s*(.*)$/);
    if (opMatch) {
      operator = opMatch[1];
      const parsed = parseFloat(opMatch[2].replace(/,/g, ''));
      if (!isNaN(parsed)) {
        thresholdValue = parsed;
      }
      if (opMatch[3] && !unit) {
        unit = opMatch[3].trim();
      }
    } else {
      const numMatch = trimmed.match(/[\d,.]+/);
      if (numMatch) {
        const parsed = parseFloat(numMatch[0].replace(/,/g, ''));
        if (!isNaN(parsed)) {
          thresholdValue = parsed;
        }
      }
    }
  }

  // Extract percentile if explicitly declared in title, value, or source location
  // Do not extract from notes (which often discuss why a percentile is missing or ambiguous)
  if (item.ambiguityReason && /percentile.*not defined/i.test(item.ambiguityReason)) {
    percentile = undefined;
  } else {
    const titleAndValue = `${item.title} ${item.value ?? ''} ${item.sourceLocation ?? ''}`;
    const pMatch = titleAndValue.match(/\bp(\d{2,3})\b/i) || titleAndValue.match(/(\d{2,3})(?:th|st|nd|rd)\s*percentile/i);
    if (pMatch) {
      const p = parseInt(pMatch[1], 10);
      if (!isNaN(p) && p > 0 && p <= 100) {
        percentile = p;
      }
    }
  }

  // Derive scope from source location or title if known
  if (item.sourceLocation && item.sourceLocation.toLowerCase().includes('checkout')) {
    scope = 'Checkout API Flow';
  } else if (item.title.toLowerCase().includes('search')) {
    scope = 'Search & Catalog API';
  } else if (item.sourceDocument) {
    scope = item.sourceDocument;
  }

  // Construct target string if threshold is known
  let target: string | undefined;
  if (thresholdValue !== undefined) {
    const op = operator || '';
    const u = unit ? ` ${unit}` : '';
    target = `${op} ${thresholdValue}${u}`.trim();
  }

  return { operator, thresholdValue, unit, percentile, scope, target };
}

/**
 * Pure deterministic compiler that produces a Draft Performance Contract
 * from project summary and upstream intelligence items.
 *
 * Adheres strictly to Constitution §3, §5, §7, §8:
 * - Never silently selects candidates or invents throughput calculations from conflicting items.
 * - Retains full calculation lineage for all derivations.
 * - Never invents default percentiles or magic numbers.
 * - Accurately reports readiness blockers preventing formal approval.
 */
export function compileDraftPerformanceContract(
  options: CompileContractOptions
): PerformanceContract {
  const { projectSummary, intelligenceItems, version = 'v0.1-draft' } = options;

  const timestampStr = options.compilationTimestamp
    ? (typeof options.compilationTimestamp === 'string'
        ? options.compilationTimestamp
        : options.compilationTimestamp.toISOString())
    : (projectSummary.createdDate || '2026-08-19T10:00:00.000Z');

  // 1. Map Workload Inputs faithfully without silently choosing candidates
  const workloadItems = intelligenceItems.filter(
    (item) => item.category === 'WORKLOAD'
  );

  const workloadInputs: WorkloadInput[] = workloadItems.map((item) => ({
    id: item.id,
    key: item.key,
    title: item.title,
    value: item.value ?? (item.candidates && item.candidates.length > 0 ? 'UNRESOLVED_CANDIDATES' : 'UNSPECIFIED'),
    unit: item.unit || '',
    canonicalState: item.canonicalState,
    reviewStatus: item.reviewStatus,
    sourceId: item.id,
    sourceDocument: item.sourceDocument,
    sourceLocation: item.sourceLocation,
    notes: item.notes
  }));

  // 2. Perform deterministic throughput calculations if peak orders exist and is approved
  const peakOrdersItem = intelligenceItems.find(
    (item) => item.key === 'peak_hourly_orders' || item.key === 'peak_orders'
  );

  const calculations: CalculationLineage[] = [];
  const blockedCalculations: BlockedCalculation[] = [];

  const isPeakOrdersConflicting = Boolean(
    peakOrdersItem &&
      (peakOrdersItem.canonicalState === 'CONFLICTING' ||
        peakOrdersItem.reviewStatus === 'CONFLICTING' ||
        (peakOrdersItem.candidates &&
          peakOrdersItem.candidates.length > 1 &&
          peakOrdersItem.canonicalState !== 'APPROVED' &&
          peakOrdersItem.approvalState !== 'APPROVED'))
  );

  const isPeakOrdersApproved = Boolean(
    peakOrdersItem &&
      !isPeakOrdersConflicting &&
      (peakOrdersItem.canonicalState === 'APPROVED' ||
        peakOrdersItem.approvalState === 'APPROVED')
  );

  let numericPeakOrders: number | undefined;

  if (peakOrdersItem) {
    if (isPeakOrdersConflicting || !isPeakOrdersApproved) {
      // Constitution §3 & M1.1 §2: Unresolved conflicting items must NOT become authoritative calculations.
      blockedCalculations.push({
        calculationId: `calc-blocked-throughput-${peakOrdersItem.id}`,
        outputParameter: 'order_throughput_per_second',
        status: 'BLOCKED',
        calculated: false,
        formulaIdentifier: 'throughput_time_unit_conversion',
        reason: isPeakOrdersConflicting
          ? 'Peak hourly order volume is in a CONFLICTING state across multiple competing candidates. An authoritative candidate must be formally selected and approved before compilation.'
          : 'Peak hourly order volume has not been formally approved as an authoritative workload input.',
        requiredIntelligence: [
          'Formal approval and resolution of peak_hourly_orders candidate to an authoritative value'
        ],
        missingPrerequisites: ['approved_peak_hourly_orders'],
        availableInputs: [
          {
            parameter: 'peak_hourly_orders',
            value: peakOrdersItem.value ?? 'UNSPECIFIED',
            unit: peakOrdersItem.unit || 'orders/hour',
            sourceId: peakOrdersItem.id,
            sourceTitle: peakOrdersItem.title
          }
        ]
      });
    } else {
      // Governed current value that is explicitly resolved/approved
      if (typeof peakOrdersItem.value === 'number') {
        numericPeakOrders = peakOrdersItem.value;
      } else if (typeof peakOrdersItem.value === 'string') {
        const clean = peakOrdersItem.value.replace(/,/g, '').trim();
        const parsed = parseFloat(clean);
        if (!isNaN(parsed) && parsed > 0) {
          numericPeakOrders = parsed;
        }
      }
    }
  }

  if (numericPeakOrders !== undefined && numericPeakOrders > 0) {
    const throughputConversion = convertThroughput(
      numericPeakOrders,
      'per_hour',
      peakOrdersItem?.id || 'intel-peak-orders',
      peakOrdersItem?.title || 'Peak Hourly Order Volume',
      {
        calculationId: `calc-throughput-${peakOrdersItem?.id || 'peak'}-${numericPeakOrders}`,
        timestamp: timestampStr
      }
    );
    calculations.push(throughputConversion.lineage);
  }

  // 3. Evaluate session concurrency (Little's Law)
  const sessionDurationItem = intelligenceItems.find(
    (i) =>
      i.key === 'avg_session_duration' ||
      i.key === 'session_duration' ||
      i.key === 'average_session_duration'
  );
  const sessionArrivalItem = intelligenceItems.find(
    (i) =>
      i.key === 'session_arrival_rate' ||
      i.key === 'user_arrival_rate' ||
      i.key === 'session_starts_per_hour' ||
      i.key === 'session_arrivals'
  );

  const sessionConcurrencyEval = evaluateSessionConcurrency({
    hasSessionArrivalRate: Boolean(sessionArrivalItem && sessionArrivalItem.value !== undefined),
    sessionArrivalRate:
      sessionArrivalItem && typeof sessionArrivalItem.value === 'number'
        ? sessionArrivalItem.value
        : undefined,
    sessionArrivalRateUnit: (sessionArrivalItem?.unit as any) || 'per_hour',
    sourceSessionArrivalId: sessionArrivalItem?.id,
    hasSessionDuration: Boolean(sessionDurationItem && sessionDurationItem.value !== undefined),
    sessionDuration:
      sessionDurationItem && typeof sessionDurationItem.value === 'number'
        ? sessionDurationItem.value
        : undefined,
    sessionDurationUnit: (sessionDurationItem?.unit as any) || 'minutes',
    sourceSessionDurationId: sessionDurationItem?.id,
    hasOrderThroughput: Boolean(numericPeakOrders !== undefined),
    orderThroughput: numericPeakOrders,
    orderThroughputUnit: 'per_hour',
    sourceOrderThroughputId: peakOrdersItem?.id,
    calculationId: 'calc-littles-law-sessions',
    timestamp: timestampStr
  });

  if (sessionConcurrencyEval.canCalculate && sessionConcurrencyEval.calculation) {
    calculations.push(sessionConcurrencyEval.calculation);
  } else if (sessionConcurrencyEval.blocked) {
    blockedCalculations.push(sessionConcurrencyEval.blocked);
  }

  // 4. Evaluate workload readiness
  const readiness = evaluateWorkloadReadiness(intelligenceItems);

  // 5. Extract Acceptance Criteria without magic numbers or manufactured defaults
  const criteriaItems = intelligenceItems.filter(
    (item) =>
      item.category === 'REQUIREMENTS' ||
      item.category === 'ACCEPTANCE_CRITERIA'
  );

  const acceptanceCriteria: AcceptanceCriterion[] = [];

  for (const item of criteriaItems) {
    const parsed = parseCriterionFromItem(item);
    const isCheckout = item.key.includes('checkout') || item.title.toLowerCase().includes('checkout');
    const isLatency = item.key.includes('latency') || item.key.includes('response_time');

    // Executable semantics check according to M1.2 Requirement 3:
    // An acceptance criterion may be DEFINED only when required executable semantics are present:
    // metric/scope, thresholdValue, unit, and operator. Latency criteria additionally require percentile.
    const isMissingOperator = !parsed.operator;
    const isMissingThreshold = parsed.thresholdValue === undefined;
    const isMissingUnit = !parsed.unit || parsed.unit.trim().length === 0;
    const isAmbiguousPercentile = isLatency && parsed.percentile === undefined;

    const isAmbiguous =
      item.reviewStatus === 'AMBIGUOUS' ||
      Boolean(item.ambiguityReason && item.ambiguityReason.length > 0) ||
      isMissingOperator ||
      isMissingThreshold ||
      isMissingUnit ||
      isAmbiguousPercentile;

    let ambiguityNotice: string | undefined;
    if (isAmbiguousPercentile) {
      ambiguityNotice = item.ambiguityReason || `Target specifies ${parsed.target || 'latency'} without an associated percentile (e.g. p95 or p99). Required for automated gate evaluation.`;
    } else if (isMissingOperator) {
      ambiguityNotice = item.ambiguityReason || `Criterion "${item.title}" (${item.key}) lacks an explicit comparison operator (<, <=, >, >=, ==) in canonical intelligence.`;
    } else if (isMissingThreshold || isMissingUnit) {
      ambiguityNotice = item.ambiguityReason || `Criterion "${item.title}" lacks a complete numeric threshold or unit in canonical intelligence.`;
    } else if (isAmbiguous) {
      ambiguityNotice = item.ambiguityReason || `Criterion "${item.title}" is ambiguous or lacks executable operational semantics.`;
    }

    acceptanceCriteria.push({
      id: `crit-${item.id}`,
      key: item.key,
      metric: item.title,
      scope: parsed.scope || 'System Under Test',
      target: parsed.target || (typeof item.value === 'string' ? item.value : 'UNSPECIFIED'),
      operator: parsed.operator as AcceptanceCriterion['operator'],
      thresholdValue: parsed.thresholdValue,
      unit: parsed.unit || item.unit || '',
      percentile: parsed.percentile,
      status: isAmbiguous ? 'AMBIGUOUS' : 'DEFINED',
      ambiguityNotice,
      sourceIntelligenceId: item.id,
      isBlockingForApproval: isAmbiguous
    });
  }

  // Note: According to M1.2 Requirement 4, approved workload demand (e.g. 31,500/hr = 8.75/sec)
  // remains in workloadCalculations as an engineering workload demand target and is NOT silently
  // injected into NFR performance acceptance criteria.

  // 6. Formulate approval readiness
  const blockingReasons: string[] = [];

  for (const issue of readiness.issues) {
    if (issue.severity === 'BLOCKING' && !blockingReasons.includes(issue.description)) {
      blockingReasons.push(issue.description);
    }
  }

  for (const crit of acceptanceCriteria) {
    if (crit.isBlockingForApproval && crit.ambiguityNotice) {
      const msg = `Acceptance Criterion "${crit.metric}" is AMBIGUOUS: ${crit.ambiguityNotice}`;
      if (!blockingReasons.includes(msg)) {
        blockingReasons.push(msg);
      }
    }
  }

  for (const blocked of blockedCalculations) {
    const blockedMsg = `Workload calculation for "${blocked.outputParameter}" is BLOCKED: ${blocked.reason}`;
    if (!blockingReasons.includes(blockedMsg)) {
      blockingReasons.push(blockedMsg);
    }
  }

  const canApprove = blockingReasons.length === 0;

  // 7. Determine contract status
  let status: ContractStatus;
  if (!canApprove) {
    status = 'BLOCKED';
  } else {
    status = 'READY_FOR_APPROVAL';
  }

  return {
    id: `contract-${projectSummary.id}-${version}`,
    projectId: projectSummary.id,
    projectName: projectSummary.name,
    version,
    engineeringIntent: projectSummary.intent,
    status,
    createdAt: timestampStr,
    updatedAt: timestampStr,
    sourceIntelligenceReferences: intelligenceItems.map((item) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      canonicalState: item.canonicalState,
      reviewStatus: item.reviewStatus
    })),
    workloadInputs,
    workloadCalculations: calculations,
    blockedWorkloadCalculations: blockedCalculations,
    workloadReadiness: readiness,
    acceptanceCriteria,
    unresolvedIssues: readiness.issues,
    calculationLineageReferences: calculations.map((c) => c.calculationId),
    approvalReadiness: {
      canApprove,
      blockingReasons,
      unresolvedIssuesCount: blockingReasons.length
    }
  };
}
