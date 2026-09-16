import {
  IntelligenceItem,
  WorkloadIssue,
  WorkloadReadiness,
  WorkloadReadinessStatus
} from '@pecp/pe-domain';

/**
 * Evaluates the deterministic readiness of project intelligence for workload modeling.
 *
 * Checks for:
 * - Conflicting intelligence (e.g. conflicting peak orders)
 * - Ambiguous requirements (e.g. latency targets missing percentile)
 * - Missing prerequisites for Little's Law (e.g. session arrival rate missing when session duration is present)
 * - Unapproved critical values
 *
 * In accordance with Constitution §3 & M1 §4:
 * "Do not reduce readiness to a decorative percentage."
 */
export function evaluateWorkloadReadiness(
  items: IntelligenceItem[],
  options?: {
    hasJourneyDistribution?: boolean;
    journeyDistributionValid?: boolean;
    journeyValidationError?: string;
  }
): WorkloadReadiness {
  const issues: WorkloadIssue[] = [];

  // 1. Check for CONFLICTING items
  const conflictingItems = items.filter(
    (item) =>
      item.canonicalState === 'CONFLICTING' ||
      item.reviewStatus === 'CONFLICTING' ||
      (item.candidates && item.candidates.length > 1)
  );

  for (const item of conflictingItems) {
    issues.push({
      id: `issue-conflict-${item.id}`,
      type: 'CONFLICTING_SOURCE',
      parameter: item.key,
      severity: 'BLOCKING',
      sourceIntelligenceId: item.id,
      description: `Conflicting values exist for "${item.title}". Multiple source candidates are present and unresolved.`,
      remediationGuidance:
        'Resolve the conflict by formally approving one candidate or obtaining consensus from architecture/business stakeholders.'
    });
  }

  // 2. Check for AMBIGUOUS items (especially in REQUIREMENTS and ACCEPTANCE_CRITERIA)
  const ambiguousItems = items.filter(
    (item) =>
      item.reviewStatus === 'AMBIGUOUS' ||
      item.canonicalState === 'MISSING' ||
      (item.ambiguityReason && item.ambiguityReason.length > 0)
  );

  for (const item of ambiguousItems) {
    const isCheckoutLatency = item.key.includes('checkout') || item.key.includes('latency');
    issues.push({
      id: `issue-ambiguous-${item.id}`,
      type: 'AMBIGUOUS_SOURCE',
      parameter: item.key,
      severity: isCheckoutLatency ? 'BLOCKING' : 'WARNING',
      sourceIntelligenceId: item.id,
      description:
        item.ambiguityReason ||
        `Item "${item.title}" is ambiguous (e.g. missing percentile, scope, or distribution profile).`,
      remediationGuidance:
        isCheckoutLatency
          ? 'Supply explicit percentile target (e.g., p95 or p99 < 2.0s) to enable automated gate evaluation.'
          : 'Clarify target scope and measurement boundary.'
    });
  }

  // 3. Check for Little's Law prerequisites: Session Arrival Rate vs Session Duration
  const sessionDurationItem = items.find((i) => i.key === 'session_duration');
  const sessionArrivalItem = items.find(
    (i) => i.key === 'session_arrival_rate' || i.key === 'user_arrival_rate'
  );
  const peakOrdersItem = items.find(
    (i) => i.key === 'peak_hourly_orders' || i.key === 'peak_orders'
  );

  if (sessionDurationItem && !sessionArrivalItem) {
    issues.push({
      id: 'issue-missing-session-arrival-rate',
      type: 'MISSING_PREREQUISITE',
      parameter: 'session_arrival_rate',
      severity: 'BLOCKING',
      sourceIntelligenceId: sessionDurationItem.id,
      description:
        'Average session duration is known, but session arrival rate is missing. Little\'s Law (L = λ × W) requires the arrival rate of the same flow population.',
      remediationGuidance:
        peakOrdersItem
          ? 'Provide peak session starts/hour OR an approved conversion ratio from business orders to session arrivals. Do NOT infer session concurrency directly from order throughput.'
          : 'Provide peak session starts/hour from user telemetry or marketing analytics.'
    });
  }

  // 4. Journey distribution validation check if provided
  if (options?.hasJourneyDistribution && options.journeyDistributionValid === false) {
    issues.push({
      id: 'issue-invalid-journey-distribution',
      type: 'INVALID_JOURNEY_DISTRIBUTION',
      parameter: 'journey_distribution',
      severity: 'BLOCKING',
      description:
        options.journeyValidationError ||
        'Journey distribution percentages do not sum to 100%.',
      remediationGuidance:
        'Normalize journey percentages so that user workflow allocations total exactly 100%.'
    });
  }

  // 5. Compute overall readiness status
  const blockingCount = issues.filter((i) => i.severity === 'BLOCKING').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

  let status: WorkloadReadinessStatus;
  let isReady = false;
  let summary = '';

  if (blockingCount > 0) {
    status = 'BLOCKED';
    summary = `Workload model is BLOCKED by ${blockingCount} critical prerequisite issue${blockingCount > 1 ? 's' : ''}. Mathematical synthesis must not fabricate missing parameters.`;
  } else if (warningCount > 0) {
    status = 'PARTIAL';
    summary = `Workload model is PARTIALLY ready with ${warningCount} warning issue${warningCount > 1 ? 's' : ''}. Key throughput calculations are available but downstream gates require review.`;
  } else {
    status = 'READY';
    isReady = true;
    summary = 'All required workload parameters, arrival rates, and NFR percentiles are approved and mathematically consistent.';
  }

  return {
    status,
    isReady,
    blockingIssuesCount: blockingCount,
    warningIssuesCount: warningCount,
    issues,
    summary
  };
}
