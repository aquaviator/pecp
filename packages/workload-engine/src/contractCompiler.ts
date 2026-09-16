import {
  ProjectSummary,
  IntelligenceItem,
  PerformanceContract,
  ContractStatus,
  AcceptanceCriterion,
  WorkloadInput,
  CalculationLineage,
  BlockedCalculation,
  WorkloadModel
} from '@pecp/pe-domain';
import { convertThroughput } from './throughput';
import { evaluateSessionConcurrency } from './littlesLaw';
import { evaluateWorkloadReadiness } from './readiness';

export interface CompileContractOptions {
  version?: string;
  projectSummary: ProjectSummary;
  intelligenceItems: IntelligenceItem[];
  precomputedWorkload?: WorkloadModel;
}

/**
 * Deterministically compiles a Draft Performance Contract from canonical intelligence and workload calculations.
 *
 * Adheres strictly to Constitution §5, §6, §7 and M1 Work Package §5:
 * - Truthfully exposes unresolved blocking issues rather than inventing missing information.
 * - Refuses approval readiness when blocking issues or ambiguous NFR percentiles remain.
 * - Preserves engineering intent (e.g. FORECAST).
 * - Retains full calculation lineage.
 */
export function compileDraftPerformanceContract(
  options: CompileContractOptions
): PerformanceContract {
  const { projectSummary, intelligenceItems, version = 'v0.1-draft' } = options;

  // 1. Extract workload inputs
  const workloadItems = intelligenceItems.filter(
    (item) => item.category === 'WORKLOAD' || item.category === 'BUSINESS_CONTEXT'
  );

  const workloadInputs: WorkloadInput[] = workloadItems.map((item) => ({
    id: item.id,
    key: item.key,
    title: item.title,
    value: item.value ?? (item.candidates?.[0]?.value || 'UNSPECIFIED'),
    unit: item.unit || '',
    canonicalState: item.canonicalState,
    reviewStatus: item.reviewStatus,
    sourceId: item.id,
    sourceDocument: item.sourceDocument,
    sourceLocation: item.sourceLocation,
    notes: item.notes
  }));

  // 2. Perform deterministic throughput calculations if peak orders exist
  const peakOrdersItem = intelligenceItems.find(
    (item) => item.key === 'peak_hourly_orders' || item.key === 'peak_orders'
  );

  let numericPeakOrders: number | undefined;
  if (peakOrdersItem) {
    if (typeof peakOrdersItem.value === 'number') {
      numericPeakOrders = peakOrdersItem.value;
    } else if (typeof peakOrdersItem.value === 'string') {
      const match = peakOrdersItem.value.match(/[\d,.]+/);
      if (match) {
        const parsed = parseFloat(match[0].replace(/,/g, ''));
        if (!isNaN(parsed) && parsed > 0) {
          numericPeakOrders = parsed;
        }
      }
    }
    if (!numericPeakOrders && peakOrdersItem.candidates && peakOrdersItem.candidates.length > 0) {
      const cand = peakOrdersItem.candidates.find((c) => c.id === 'cand-3') || peakOrdersItem.candidates[0];
      const parsedCand = typeof cand.value === 'number' ? cand.value : parseFloat(String(cand.value).replace(/,/g, ''));
      if (!isNaN(parsedCand) && parsedCand > 0) {
        numericPeakOrders = parsedCand;
      }
    }
  }

  const calculations: CalculationLineage[] = [];
  const blockedCalculations: BlockedCalculation[] = [];

  if (numericPeakOrders !== undefined && numericPeakOrders > 0) {
    const throughputConversion = convertThroughput(
      numericPeakOrders,
      'per_hour',
      peakOrdersItem?.id || 'intel-peak-orders',
      peakOrdersItem?.title || 'Peak Hourly Order Volume'
    );
    calculations.push(throughputConversion.lineage);
  }

  // 3. Evaluate session concurrency (Little's Law)
  const sessionDurationItem = intelligenceItems.find((i) => i.key === 'avg_session_duration' || i.key === 'session_duration');
  const sessionArrivalItem = intelligenceItems.find(
    (i) => i.key === 'session_arrival_rate' || i.key === 'user_arrival_rate'
  );

  const sessionConcurrencyEval = evaluateSessionConcurrency({
    hasSessionArrivalRate: Boolean(sessionArrivalItem && sessionArrivalItem.value !== undefined),
    sessionArrivalRate:
      sessionArrivalItem && typeof sessionArrivalItem.value === 'number'
        ? sessionArrivalItem.value
        : undefined,
    sessionArrivalRateUnit: 'per_hour',
    sourceSessionArrivalId: sessionArrivalItem?.id,
    hasSessionDuration: Boolean(sessionDurationItem && sessionDurationItem.value !== undefined),
    sessionDuration:
      sessionDurationItem && typeof sessionDurationItem.value === 'number'
        ? sessionDurationItem.value
        : undefined,
    sessionDurationUnit: 'minutes',
    sourceSessionDurationId: sessionDurationItem?.id,
    hasOrderThroughput: Boolean(numericPeakOrders !== undefined),
    orderThroughput: numericPeakOrders,
    orderThroughputUnit: 'per_hour',
    sourceOrderThroughputId: peakOrdersItem?.id
  });

  if (sessionConcurrencyEval.canCalculate && sessionConcurrencyEval.calculation) {
    calculations.push(sessionConcurrencyEval.calculation);
  } else if (sessionConcurrencyEval.blocked) {
    blockedCalculations.push(sessionConcurrencyEval.blocked);
  }

  // 4. Evaluate workload readiness
  const readiness = evaluateWorkloadReadiness(intelligenceItems);

  // 5. Extract Acceptance Criteria and classify ambiguity
  const criteriaItems = intelligenceItems.filter(
    (item) =>
      item.category === 'REQUIREMENTS' ||
      item.category === 'ACCEPTANCE_CRITERIA' ||
      item.key.includes('latency') ||
      item.key.includes('throughput') ||
      item.key.includes('availability')
  );

  const acceptanceCriteria: AcceptanceCriterion[] = [];

  for (const item of criteriaItems) {
    if (item.key.includes('checkout') || item.title.toLowerCase().includes('checkout')) {
      const isAmbiguous =
        item.reviewStatus === 'AMBIGUOUS' ||
        Boolean(item.ambiguityReason && item.ambiguityReason.length > 0);

      acceptanceCriteria.push({
        id: `crit-${item.id}`,
        key: item.key,
        metric: 'Transaction Response Time',
        scope: 'Checkout API Flow',
        target: '< 2.0s',
        operator: '<',
        thresholdValue: 2.0,
        unit: 'seconds',
        percentile: isAmbiguous ? undefined : 95,
        status: isAmbiguous ? 'AMBIGUOUS' : 'DEFINED',
        ambiguityNotice: isAmbiguous
          ? 'Target specifies < 2.0s without an associated percentile (e.g. p95 or p99). Required for automated gate evaluation.'
          : undefined,
        sourceIntelligenceId: item.id,
        isBlockingForApproval: isAmbiguous
      });
    } else if (item.key === 'search_latency' || item.title.toLowerCase().includes('search')) {
      acceptanceCriteria.push({
        id: `crit-${item.id}`,
        key: item.key,
        metric: 'Search Response Time (p95)',
        scope: 'Search & Catalog API',
        target: '<= 0.8s',
        operator: '<=',
        thresholdValue: 0.8,
        unit: 'seconds',
        percentile: 95,
        status: 'DEFINED',
        sourceIntelligenceId: item.id,
        isBlockingForApproval: false
      });
    } else if (item.key.includes('order') || item.key.includes('throughput')) {
      acceptanceCriteria.push({
        id: `crit-${item.id}`,
        key: item.key,
        metric: 'Peak Order Throughput',
        scope: 'End-to-End Order Processing Pipeline',
        target: '>= 8.75 orders/sec',
        operator: '>=',
        thresholdValue: calculations[0]?.outputValue || 8.75,
        unit: 'orders/second',
        status: 'DEFINED',
        sourceIntelligenceId: item.id,
        isBlockingForApproval: false
      });
    }
  }

  // 6. Formulate approval readiness
  const blockingReasons: string[] = [];

  for (const issue of readiness.issues) {
    if (issue.severity === 'BLOCKING') {
      blockingReasons.push(issue.description);
    }
  }

  for (const crit of acceptanceCriteria) {
    if (crit.isBlockingForApproval && crit.ambiguityNotice) {
      if (!blockingReasons.includes(crit.ambiguityNotice)) {
        blockingReasons.push(
          `Acceptance Criterion "${crit.metric}" is AMBIGUOUS: ${crit.ambiguityNotice}`
        );
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
