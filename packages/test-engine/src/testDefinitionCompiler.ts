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

    // Validate request payload requirement for mutating HTTP methods
    for (const journey of journeys) {
      for (const step of journey.steps) {
        if (['POST', 'PUT', 'PATCH'].includes(step.method)) {
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
  // Never invent fake probes or assume URL presence means readiness.
  const preconditions: ExecutionPrecondition[] = executionIntelligence?.preconditions
    ? [...executionIntelligence.preconditions]
    : [];

  for (const precond of preconditions) {
    if (!precond.isSatisfied) {
      issues.push({
        id: `issue-precond-${precond.id}`,
        type: 'UNSATISFIED_PRECONDITION',
        severity: 'WARNING',
        parameter: precond.statement,
        description: `Precondition not verified: ${precond.statement}`,
        remediationGuidance: `Verify precondition via ${precond.verificationMethod || 'manual check'}.`
      });
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
