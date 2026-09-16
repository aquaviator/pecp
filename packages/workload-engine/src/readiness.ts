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

  // 1. Check for CONFLICTING items based on governed state / explicit unresolved status
  const conflictingItems = items.filter((item) => {
    // If an item has been formally resolved/approved, historical candidates kept for provenance do not create an active conflict
    if (item.canonicalState === 'APPROVED' || item.approvalState === 'APPROVED') {
      return false;
    }
    if (item.canonicalState === 'CONFLICTING' || item.reviewStatus === 'CONFLICTING') {
      return true;
    }
    if (item.candidates && item.candidates.length > 1) {
      const activeCandidates = item.candidates.filter(
        (c) =>
          c.canonicalState !== 'SUPERSEDED' &&
          c.canonicalState !== 'STALE' &&
          c.reviewStatus !== 'STALE'
      );
      if (activeCandidates.length > 1) {
        return true;
      }
    }
    return false;
  });

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
  const sessionDurationItem = items.find(
    (i) =>
      i.key === 'session_duration' ||
      i.key === 'avg_session_duration' ||
      i.key === 'average_session_duration' ||
      i.key === 'user_session_duration' ||
      i.key.toLowerCase().includes('session_duration')
  );
  const sessionArrivalItem = items.find(
    (i) =>
      i.key === 'session_arrival_rate' ||
      i.key === 'user_arrival_rate' ||
      i.key === 'session_starts_per_hour' ||
      i.key === 'session_arrivals' ||
      i.key === 'session_arrival'
  );
  const peakOrdersItem = items.find(
    (i) => i.key === 'peak_hourly_orders' || i.key === 'peak_orders'
  );

  if (sessionDurationItem && !sessionArrivalItem) {
    // Avoid duplicate issue if already reported
    const alreadyReported = issues.some(
      (iss) => iss.parameter === 'session_arrival_rate' && iss.type === 'MISSING_PREREQUISITE'
    );
    if (!alreadyReported) {
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
  }

  // 4. Check for UNAPPROVED_CRITICAL_VALUE on critical workload/acceptance inputs
  // Critical inputs that must be approved before authoritative contract calculation
  const criticalKeys = new Set([
    'peak_hourly_orders',
    'peak_orders',
    'order_throughput',
    'journey_distribution',
    'checkout_response_time',
    'checkout_latency',
    'max_error_rate'
  ]);

  for (const item of items) {
    const isCritical =
      criticalKeys.has(item.key) ||
      item.category === 'WORKLOAD' ||
      item.category === 'ACCEPTANCE_CRITERIA';

    if (!isCritical) continue;

    // Check if already covered by CONFLICTING_SOURCE, AMBIGUOUS_SOURCE, or MISSING_PREREQUISITE
    const alreadyHasSemanticIssue = issues.some(
      (iss) => iss.sourceIntelligenceId === item.id
    );
    if (alreadyHasSemanticIssue) continue;

    // Check if formally approved
    const isApproved =
      item.canonicalState === 'APPROVED' ||
      item.approvalState === 'APPROVED';

    if (!isApproved) {
      issues.push({
        id: `issue-unapproved-${item.id}`,
        type: 'UNAPPROVED_CRITICAL_VALUE',
        parameter: item.key,
        severity: 'BLOCKING',
        sourceIntelligenceId: item.id,
        description: `Critical parameter "${item.title}" (${item.key}) has not been formally approved.`,
        remediationGuidance:
          'Review and formally approve the authoritative value before using it in contractual baseline models.'
      });
    }
  }

  // 5. Journey distribution validation check if provided
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
