import {
  PerformanceContract,
  IntelligenceItem,
  ProjectSummary,
  TestDefinition,
  TestDefinitionStatus,
  TestScenario,
  JourneyDefinition,
  WorkloadSchedule,
  WorkloadAttainmentRequirement,
  ExecutionPrecondition,
  ExecutionParameter,
  TestDefinitionIssue,
  AcceptanceCriterion,
  CredentialReference,
  ExecutionIntelligenceOverrides,
  computeContractFingerprint
} from '@pecp/pe-domain';
import { computeTestDefinitionFingerprint } from './fingerprint.js';

export type { ExecutionIntelligenceOverrides };

export interface CompileTestDefinitionOptions {
  contract: PerformanceContract;
  intelligenceItems?: IntelligenceItem[];
  projectSummary?: ProjectSummary;
  testDefinitionId?: string;
  version?: string;
  generationTimestamp?: string;
  clock?: () => string;
  executionIntelligence?: ExecutionIntelligenceOverrides;
}

/**
 * Pure compiler: transforms governed PerformanceContract + canonical intelligence into
 * an engine-neutral Canonical Test Definition according to Constitution §10 and M3.0 laws.
 *
 * Enforces:
 * 1. Upstream Contract Gate: Only APPROVED contracts may yield READY_FOR_EXECUTION.
 *    BLOCKED contract produces BLOCKED. DRAFT or READY_FOR_APPROVAL produces NOT_EXECUTABLE.
 * 2. Authoritative Execution-Input Law: NEVER invents execution schedules, durations, endpoints,
 *    workload targets (e.g. 8.75/s), tolerances (e.g. 5%), or preconditions.
 * 3. Workload Demand Separation: Required throughput is tracked as a prerequisite WorkloadAttainmentRequirement,
 *    strictly separated from NFR response time criteria.
 * 4. Journey Step Integrity: POST/PUT/PATCH steps require explicit requestPayload.
 * 5. Criteria Cleanliness: Ambiguous criteria (missing percentiles) are excluded from executable criteria.
 * 6. Secret Reference Boundary: Credential references only; never embeds raw tokens.
 */
export function compileTestDefinition(options: CompileTestDefinitionOptions): TestDefinition {
  const { contract, intelligenceItems = [], projectSummary, executionIntelligence } = options;

  const version = options.version || 'v1.0-draft';
  const id = options.testDefinitionId || `test-def-${contract.projectId}-${contract.version}`;
  const generationTimestamp =
    options.generationTimestamp ||
    (options.clock ? options.clock() : contract.updatedAt || '2026-08-25T14:00:00.000Z');

  const issues: TestDefinitionIssue[] = [];
  const blockingReasons: string[] = [];

  // 1. Authoritative Contract Fingerprint & Governance Gate
  const contractFingerprint = computeContractFingerprint(contract);

  if (contract.status === 'BLOCKED') {
    issues.push({
      id: 'issue-contract-blocked',
      type: 'UPSTREAM_CONTRACT_BLOCKED',
      severity: 'BLOCKING',
      parameter: 'contract.status',
      description: 'Upstream Performance Contract is in BLOCKED status. An executable test cannot be generated.',
      remediationGuidance: 'Resolve upstream contract blockers and attain approved status before execution.'
    });
    blockingReasons.push('Upstream Performance Contract is in BLOCKED status.');
  } else if (contract.status !== 'APPROVED') {
    issues.push({
      id: 'issue-contract-not-approved',
      type: 'UPSTREAM_CONTRACT_NOT_APPROVED',
      severity: 'BLOCKING',
      parameter: 'contract.status',
      description: `Upstream Performance Contract is in ${contract.status} status and has not been approved. Only APPROVED contracts may yield executable test definitions.`,
      remediationGuidance: 'The Performance Contract must be approved by the Lead Performance Architect before downstream execution readiness.'
    });
    blockingReasons.push(`Upstream Performance Contract must be in APPROVED status for execution readiness (current status: ${contract.status}).`);
  }

  // 2. Workload Demand Attainment Requirement (Strictly separate from NFRs)
  // Extract approved per-second throughput rate from contract calculations or inputs
  const throughputCalc =
    contract.workloadCalculations.find(
      (c) => c.outputParameter.toLowerCase().includes('second') || c.unit.toLowerCase().includes('second')
    ) ||
    contract.workloadCalculations.find((c) => c.formulaIdentifier.includes('throughput'));

  let workloadAttainment: WorkloadAttainmentRequirement | undefined;
  let targetRate: number | undefined;
  let targetUnit: string | undefined;

  if (throughputCalc) {
    targetRate = throughputCalc.outputValue;
    targetUnit = throughputCalc.unit;
    workloadAttainment = {
      metric: 'Target Workload Arrival Demand',
      targetValue: targetRate,
      unit: targetUnit,
      evaluationType: 'WORKLOAD_DEMAND',
      description: `Target arrival demand of ${targetRate} ${targetUnit} must be sustained across steady-state windows. Workload attainment is an authoritative prerequisite for test validity, NOT an NFR response time criterion.`,
      tolerancePercentage: executionIntelligence?.workloadTolerancePercentage, // Optional: never defaulted
      isPrerequisiteForEvaluation: true
    };
  } else {
    // DO NOT INVENT A FALLBACK TARGET RATE OR TOLERANCE
    issues.push({
      id: 'issue-workload-demand-not-supplied',
      type: 'NOT_SUPPLIED',
      severity: 'BLOCKING',
      parameter: 'workload_demand',
      description: 'Workload demand attainment target (e.g. required orders/second) is NOT_SUPPLIED in contract workload calculations.',
      remediationGuidance: 'Ensure the Performance Contract includes an approved throughput calculation.'
    });
    blockingReasons.push('Workload demand attainment target is NOT_SUPPLIED in contract workload calculations.');
  }

  // 3. Acceptance Criteria Partitioning (Defined vs Ambiguous)
  const executableCriteria: AcceptanceCriterion[] = [];
  const ambiguousCriteria: AcceptanceCriterion[] = [];

  for (const criterion of contract.acceptanceCriteria) {
    const isLatency =
      criterion.metric.toLowerCase().includes('latency') ||
      criterion.metric.toLowerCase().includes('response') ||
      criterion.metric.toLowerCase().includes('duration') ||
      criterion.unit === 'ms' ||
      criterion.unit === 'seconds' ||
      criterion.unit === 's';

    const isAmbiguous =
      criterion.status === 'AMBIGUOUS' ||
      (isLatency && (criterion.percentile === null || criterion.percentile === undefined));

    if (isAmbiguous) {
      ambiguousCriteria.push(criterion);
      issues.push({
        id: `issue-ambiguous-${criterion.id}`,
        type: 'AMBIGUOUS_CRITERIA',
        severity: 'BLOCKING',
        parameter: criterion.metric,
        description: `Acceptance criterion "${criterion.metric}" (${criterion.target}) is ambiguous: ${
          criterion.ambiguityNotice || 'missing percentile/threshold'
        }. Excluded from executable test thresholds.`,
        remediationGuidance: 'Define precise mathematical percentile (e.g. p95 or p99) in canonical intelligence.'
      });
      blockingReasons.push(`Acceptance criterion "${criterion.metric}" is ambiguous (${criterion.ambiguityNotice || 'missing percentile'}).`);
    } else if (criterion.status === 'DEFINED') {
      executableCriteria.push(criterion);
    }
  }

  // 4. Authoritative Execution-Input Law: Workload Schedule
  let schedule: WorkloadSchedule;
  if (executionIntelligence?.schedule) {
    schedule = executionIntelligence.schedule;

    // Structural validation for schedule stages & durations (M3.0.2)
    if (!schedule.stages || schedule.stages.length === 0) {
      issues.push({
        id: 'issue-empty-schedule-stages',
        type: 'INVALID_EXECUTION_STRUCTURE',
        severity: 'BLOCKING',
        parameter: 'schedule.stages',
        description: 'Workload schedule contains no stages.',
        remediationGuidance: 'Define at least one schedule stage.'
      });
      blockingReasons.push('Workload schedule contains no stages.');
    } else {
      let stageDurationSum = 0;
      let maxTargetArrivalRate = 0;

      for (let i = 0; i < schedule.stages.length; i++) {
        const stage = schedule.stages[i];
        if (typeof stage.durationSeconds !== 'number' || stage.durationSeconds <= 0) {
          issues.push({
            id: `issue-invalid-stage-duration-${i}`,
            type: 'INVALID_EXECUTION_STRUCTURE',
            severity: 'BLOCKING',
            parameter: `schedule.stages[${i}].durationSeconds`,
            description: `Schedule stage ${i + 1} duration must be positive (received: ${stage.durationSeconds}s).`,
            remediationGuidance: 'Stage durations must be positive numbers.'
          });
          blockingReasons.push(`Schedule stage ${i + 1} has non-positive duration (${stage.durationSeconds}s).`);
        } else {
          stageDurationSum += stage.durationSeconds;
        }

        if (typeof stage.targetArrivalRate === 'number') {
          if (stage.targetArrivalRate > maxTargetArrivalRate) {
            maxTargetArrivalRate = stage.targetArrivalRate;
          }
        }
      }

      // Validate totalDurationSeconds matches sum of stages
      if (schedule.totalDurationSeconds !== stageDurationSum) {
        issues.push({
          id: 'issue-schedule-duration-mismatch',
          type: 'INVALID_EXECUTION_STRUCTURE',
          severity: 'BLOCKING',
          parameter: 'schedule.totalDurationSeconds',
          description: `Schedule totalDurationSeconds (${schedule.totalDurationSeconds}s) does not match sum of stage durations (${stageDurationSum}s).`,
          remediationGuidance: 'Ensure totalDurationSeconds equals the sum of all stage durations.'
        });
        blockingReasons.push(`Schedule totalDurationSeconds (${schedule.totalDurationSeconds}s) does not match stage duration sum (${stageDurationSum}s).`);
      }

      // Validate peakArrivalRate matches maximum stage target arrival rate
      if (Math.abs(schedule.peakArrivalRate - maxTargetArrivalRate) > 0.001) {
        issues.push({
          id: 'issue-schedule-peak-rate-mismatch',
          type: 'INVALID_EXECUTION_STRUCTURE',
          severity: 'BLOCKING',
          parameter: 'schedule.peakArrivalRate',
          description: `Schedule peakArrivalRate (${schedule.peakArrivalRate}) does not match maximum stage target arrival rate (${maxTargetArrivalRate}).`,
          remediationGuidance: 'Ensure peakArrivalRate matches the maximum targetArrivalRate across schedule stages.'
        });
        blockingReasons.push(`Schedule peakArrivalRate (${schedule.peakArrivalRate}) does not match maximum stage target arrival rate (${maxTargetArrivalRate}).`);
      }
    }
  } else {
    // Schedule NOT supplied in canonical intelligence: DO NOT INVENT ONE!
    schedule = {
      id: `sched-${id}-not-supplied`,
      executionModel: 'OPEN',
      stages: [],
      totalDurationSeconds: 0,
      peakArrivalRate: 0,
      rateUnit: targetUnit || 'arrivals/second',
      timeUnit: 'seconds'
    };
    issues.push({
      id: 'issue-schedule-not-supplied',
      type: 'NOT_SUPPLIED',
      severity: 'BLOCKING',
      parameter: 'workload_schedule',
      description: 'Execution schedule (ramp stages, steady-state durations, arrival rates) is NOT_SUPPLIED in canonical intelligence.',
      remediationGuidance: 'Canonical project intelligence must explicitly supply approved execution stage durations and arrival rates.'
    });
    blockingReasons.push('Execution schedule (stages, durations, arrival rates) is NOT_SUPPLIED in canonical intelligence.');
  }

  // 5. Target Environment Base URL Reference
  const targetEnvironmentBaseUrlRef =
    executionIntelligence?.targetEnvironmentBaseUrlRef ||
    intelligenceItems.find((i) => i.category === 'ENVIRONMENT' && i.canonicalState === 'APPROVED')?.value?.toString() ||
    '';

  if (!targetEnvironmentBaseUrlRef) {
    issues.push({
      id: 'issue-env-not-supplied',
      type: 'NOT_SUPPLIED',
      severity: 'BLOCKING',
      parameter: 'targetEnvironmentBaseUrlRef',
      description: 'Target environment / Reference Lab base URL reference is NOT_SUPPLIED in canonical intelligence.',
      remediationGuidance: 'Specify approved Reference Lab base URL reference in environment intelligence.'
    });
    blockingReasons.push('Target environment / Reference Lab base URL reference is NOT_SUPPLIED.');
  }

  // 6. Journey Definitions & Step Details
  let journeys: JourneyDefinition[] = [];
  if (executionIntelligence?.journeys && executionIntelligence.journeys.length > 0) {
    journeys = executionIntelligence.journeys;

    // Structural validation: Journey distribution weights & percentages (M3.0.2)
    const totalWeight = journeys.reduce((sum, j) => sum + (typeof j.weight === 'number' ? j.weight : 0), 0);
    const totalPercentage = journeys.reduce((sum, j) => sum + (typeof j.percentage === 'number' ? j.percentage : 0), 0);

    if (Math.abs(totalWeight - 1.0) > 0.01) {
      issues.push({
        id: 'issue-invalid-journey-weights',
        type: 'INVALID_EXECUTION_STRUCTURE',
        severity: 'BLOCKING',
        parameter: 'journeys.weight',
        description: `Journey distribution weights sum to ${totalWeight.toFixed(4)} (expected 1.0 within +/-0.01 tolerance).`,
        remediationGuidance: 'Ensure canonical journey weights sum to 1.0 (100%).'
      });
      blockingReasons.push(`Journey distribution weights sum to ${totalWeight.toFixed(4)} (expected 1.0).`);
    }

    if (Math.abs(totalPercentage - 100) > 1.0) {
      issues.push({
        id: 'issue-invalid-journey-percentages',
        type: 'INVALID_EXECUTION_STRUCTURE',
        severity: 'BLOCKING',
        parameter: 'journeys.percentage',
        description: `Journey distribution percentages sum to ${totalPercentage}% (expected 100% within +/-1% tolerance).`,
        remediationGuidance: 'Ensure canonical journey percentages sum to 100%.'
      });
      blockingReasons.push(`Journey distribution percentages sum to ${totalPercentage}% (expected 100%).`);
    }

    // Step-level structural validation and mutating payload checks
    for (const journey of journeys) {
      if (typeof journey.weight !== 'number' || journey.weight <= 0 || journey.weight > 1) {
        issues.push({
          id: `issue-invalid-journey-weight-${journey.id}`,
          type: 'INVALID_EXECUTION_STRUCTURE',
          severity: 'BLOCKING',
          parameter: `journey.weight.${journey.id}`,
          description: `Journey "${journey.name}" has invalid weight ${journey.weight} (must be between 0 and 1).`,
          remediationGuidance: 'Set journey weight to a valid fraction between 0.0 and 1.0.'
        });
        blockingReasons.push(`Journey "${journey.name}" has invalid weight (${journey.weight}).`);
      }

      if (!journey.steps || journey.steps.length === 0) {
        issues.push({
          id: `issue-empty-journey-steps-${journey.id}`,
          type: 'INVALID_EXECUTION_STRUCTURE',
          severity: 'BLOCKING',
          parameter: `journey.steps.${journey.id}`,
          description: `Journey "${journey.name}" (${journey.id}) contains no steps.`,
          remediationGuidance: 'Define at least one step for the user journey.'
        });
        blockingReasons.push(`Journey "${journey.name}" contains no steps.`);
      } else {
        for (const step of journey.steps) {
          const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
          if (!step.method || !validMethods.includes(step.method.toUpperCase())) {
            issues.push({
              id: `issue-invalid-step-method-${step.id}`,
              type: 'INVALID_EXECUTION_STRUCTURE',
              severity: 'BLOCKING',
              parameter: `step.method.${step.id}`,
              description: `Step "${step.name}" (${step.id}) has unsupported HTTP method "${step.method}". Supported methods: ${validMethods.join(', ')}.`,
              remediationGuidance: 'Specify a valid supported HTTP method.'
            });
            blockingReasons.push(`Step "${step.name}" has unsupported HTTP method "${step.method}".`);
          }

          if (!step.path || typeof step.path !== 'string' || step.path.trim().length === 0 || !step.path.startsWith('/')) {
            issues.push({
              id: `issue-invalid-step-path-${step.id}`,
              type: 'INVALID_EXECUTION_STRUCTURE',
              severity: 'BLOCKING',
              parameter: `step.path.${step.id}`,
              description: `Step "${step.name}" (${step.id}) has invalid or empty path "${step.path}". Must be non-empty and start with "/".`,
              remediationGuidance: 'Provide a valid relative path starting with "/".'
            });
            blockingReasons.push(`Step "${step.name}" has invalid or empty endpoint path.`);
          }

          // Mutating payload check
          if (['POST', 'PUT', 'PATCH'].includes(step.method.toUpperCase())) {
            if (!step.requestPayload) {
              issues.push({
                id: `issue-step-payload-missing-${step.id}`,
                type: 'NOT_SUPPLIED',
                severity: 'BLOCKING',
                parameter: `step.requestPayload.${step.id}`,
                description: `Request payload is NOT_SUPPLIED for HTTP ${step.method} step "${step.name}" (${step.id}) in journey "${journey.name}".`,
                remediationGuidance: 'Supply an explicit RequestPayloadDefinition for steps that require an HTTP body.'
              });
              blockingReasons.push(`HTTP ${step.method} step "${step.name}" (${step.id}) requires an explicit requestPayload.`);
            }
          }
        }
      }
    }
  } else {
    // Journey steps NOT supplied
    issues.push({
      id: 'issue-journeys-not-supplied',
      type: 'NOT_SUPPLIED',
      severity: 'BLOCKING',
      parameter: 'journeys',
      description: 'Journey step definitions (HTTP methods, endpoints, think times) are NOT_SUPPLIED in canonical intelligence.',
      remediationGuidance: 'Provide approved transaction definitions and endpoint routes for all user journeys.'
    });
    blockingReasons.push('Journey step definitions (HTTP methods, endpoints, think times) are NOT_SUPPLIED.');
  }

  // 7. Preconditions: Strictly source-driven only.
  // When an execution precondition is supplied and marked/treated as mandatory,
  // if isSatisfied is false, TestDefinition MUST be non-executable (Constitution §10, M3.0.2).
  const preconditions: ExecutionPrecondition[] = executionIntelligence?.preconditions
    ? [...executionIntelligence.preconditions]
    : [];

  for (const precond of preconditions) {
    if (!precond.isSatisfied) {
      const isMandatory = precond.isMandatory !== false; // Defaults to mandatory
      const precondAny = precond as any;
      const precondText = precond.statement || precondAny.description || precondAny.name || precond.id;
      issues.push({
        id: `issue-precond-${precond.id}`,
        type: 'UNSATISFIED_PRECONDITION',
        severity: isMandatory ? 'BLOCKING' : 'WARNING',
        parameter: `precondition.${precond.id}`,
        description: `Precondition not satisfied: "${precondText}" (${precond.id})`,
        remediationGuidance: `Verify and satisfy precondition via ${precond.verificationMethod || 'system verification'} before execution.`
      });
      if (isMandatory) {
        blockingReasons.push(`Mandatory execution precondition "${precondText}" (${precond.id}) is unsatisfied.`);
      }
    }
  }

  // 8. Parameters
  const parameters: ExecutionParameter[] = [
    {
      key: 'target_arrival_rate',
      label: 'Target Arrival Throughput',
      value: targetRate !== undefined ? targetRate : 'NOT_SUPPLIED',
      unit: targetUnit,
      isSupplied: targetRate !== undefined
    },
    {
      key: 'target_environment_base_url',
      label: 'Target Environment Base URL',
      value: targetEnvironmentBaseUrlRef || 'NOT_SUPPLIED',
      isSupplied: Boolean(targetEnvironmentBaseUrlRef)
    },
    {
      key: 'execution_model',
      label: 'Execution Workload Model',
      value: schedule.executionModel,
      isSupplied: Boolean(schedule.stages.length > 0)
    },
    {
      key: 'total_duration_seconds',
      label: 'Total Test Duration',
      value: schedule.totalDurationSeconds,
      unit: 'seconds',
      isSupplied: schedule.totalDurationSeconds > 0
    }
  ];

  // 9. Scenarios
  const scenario: TestScenario = {
    id: `scenario-${contract.projectId}-${contract.engineeringIntent.toLowerCase()}`,
    name: `${contract.projectName} - ${contract.engineeringIntent} Test`,
    engineeringIntent: contract.engineeringIntent,
    workloadSchedule: schedule,
    journeyDistribution: journeys,
    attainmentRequirement: workloadAttainment,
    targetEnvironmentBaseUrlRef
  };

  // 10. Status & Executability: Contract MUST be APPROVED and have zero blocking reasons
  const isExecutable =
    contract.status === 'APPROVED' &&
    blockingReasons.length === 0 &&
    schedule.stages.length > 0 &&
    journeys.length > 0 &&
    Boolean(targetEnvironmentBaseUrlRef);

  let status: TestDefinitionStatus = 'DRAFT';
  if (contract.status === 'BLOCKED') {
    status = 'BLOCKED';
  } else if (!isExecutable) {
    status = 'NOT_EXECUTABLE';
  } else {
    status = 'READY_FOR_EXECUTION';
  }

  const credentialReferences = executionIntelligence?.credentialReferences || [];

  const partialDef: Omit<TestDefinition, 'fingerprint'> = {
    id,
    projectId: contract.projectId,
    projectName: contract.projectName,
    version,
    status,
    engineeringIntent: contract.engineeringIntent,
    sourceContractId: contract.id,
    sourceContractVersion: contract.version,
    sourceContractFingerprint: contractFingerprint,
    generationTimestamp,
    scenarios: [scenario],
    journeys,
    preconditions,
    parameters,
    executableCriteria,
    ambiguousCriteria,
    workloadAttainment,
    issues,
    isExecutable,
    blockingReasons,
    credentialReferences
  };

  const fingerprint = computeTestDefinitionFingerprint(partialDef);

  return {
    ...partialDef,
    fingerprint
  };
}
