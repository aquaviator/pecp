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

  // 6b. Workload Population & Attainment Relationship Semantics (M3.0.3)
  // PECP distinguishes the rate of iterations/sessions started by the executor
  // from the rate of business outcomes that must be attained.
  const populationRelationship =
    executionIntelligence?.populationRelationship || schedule.populationRelationship;

  if (populationRelationship) {
    schedule.populationRelationship = populationRelationship;
  }
  if (!schedule.arrivalPopulation) {
    schedule.arrivalPopulation = populationRelationship?.outputSchedulerRate?.population || 'JOURNEY_ITERATION';
  }

  const isMixedJourneys = journeys.length > 1 || (journeys.length === 1 && journeys[0].weight < 0.999);

  if (isMixedJourneys && workloadAttainment) {
    // 1. A mixed-journey schedule cannot use business outcome rate units (e.g. 'orders/second') directly
    const unitLower = (schedule.rateUnit || '').toLowerCase();
    const attainmentUnitLower = (workloadAttainment.unit || '').toLowerCase();
    if (unitLower.includes('order') || (attainmentUnitLower && unitLower === attainmentUnitLower)) {
      issues.push({
        id: 'issue-invalid-population-rate-unit',
        type: 'BUSINESS_WORKLOAD_UNIT_ON_MIXED_SCHEDULE',
        severity: 'BLOCKING',
        parameter: 'schedule.rateUnit',
        description: `Mixed-journey workload schedule specifies business outcome rate unit "${schedule.rateUnit}". Scheduler arrival rate must express executor population (e.g. "journey_iterations/second") rather than business outcome units.`,
        remediationGuidance: 'Specify a scheduler arrival population (e.g. JOURNEY_ITERATION) and arrival rate unit, and provide an explicit population relationship.'
      });
      blockingReasons.push(`Mixed-journey schedule cannot use business outcome unit "${schedule.rateUnit}" directly as executor arrival rate (BUSINESS_WORKLOAD_UNIT_ON_MIXED_SCHEDULE).`);
    }

    // 2. A mixed-journey Test Definition cannot use the business target rate directly as its scheduler arrival rate without an explicit relationship
    if (!populationRelationship) {
      issues.push({
        id: 'issue-missing-population-relationship',
        type: 'POPULATION_RELATIONSHIP_MISSING',
        severity: 'BLOCKING',
        parameter: 'populationRelationship',
        description: `Mixed-journey Test Definition requires an explicit governed population relationship (POPULATION_RELATIONSHIP_MISSING) establishing the lineage between business attainment demand (${workloadAttainment.targetValue} ${workloadAttainment.unit}) and mixed-journey scheduler arrival rate (${schedule.peakArrivalRate} ${schedule.rateUnit || 'journey_iterations/second'}).`,
        remediationGuidance: 'Define an explicit WorkloadPopulationRelationship establishing the lineage between business attainment demand and mixed-journey scheduler arrival rate.'
      });
      blockingReasons.push(`Mixed-journey Test Definition requires an explicit population relationship for business attainment target ${workloadAttainment.targetValue} ${workloadAttainment.unit} (POPULATION_RELATIONSHIP_MISSING).`);
    }

    // 3. If a population relationship is supplied, validate its consistency and lineage
    if (populationRelationship) {
      if (Math.abs(populationRelationship.inputBusinessTarget.value - workloadAttainment.targetValue) > 0.001) {
        issues.push({
          id: 'issue-population-rel-target-mismatch',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'inputBusinessTarget.value',
          description: `Population relationship business target (${populationRelationship.inputBusinessTarget.value}) does not match upstream contract workload attainment target (${workloadAttainment.targetValue}).`,
          remediationGuidance: 'Ensure inputBusinessTarget matches the approved workload attainment demand.'
        });
        blockingReasons.push(`Population relationship business target (${populationRelationship.inputBusinessTarget.value}) does not match contract target (${workloadAttainment.targetValue}).`);
      }

      // 7.1 Units / population consistency
      if (populationRelationship.inputBusinessTarget.unit !== workloadAttainment.unit) {
        issues.push({
          id: 'issue-population-rel-unit-mismatch',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'inputBusinessTarget.unit',
          description: `Population relationship business target unit ("${populationRelationship.inputBusinessTarget.unit}") does not match contract workload attainment unit ("${workloadAttainment.unit}").`,
          remediationGuidance: 'Ensure inputBusinessTarget.unit matches the contract workload attainment requirement unit.'
        });
        blockingReasons.push(`Population relationship business target unit ("${populationRelationship.inputBusinessTarget.unit}") does not match contract unit ("${workloadAttainment.unit}").`);
      }

      if (schedule.arrivalPopulation && populationRelationship.outputSchedulerRate.population !== schedule.arrivalPopulation) {
        issues.push({
          id: 'issue-population-rel-arrival-population-mismatch',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'outputSchedulerRate.population',
          description: `Population relationship output population ("${populationRelationship.outputSchedulerRate.population}") does not match schedule arrival population ("${schedule.arrivalPopulation}").`,
          remediationGuidance: 'Align outputSchedulerRate.population with schedule.arrivalPopulation.'
        });
        blockingReasons.push(`Population relationship output population ("${populationRelationship.outputSchedulerRate.population}") does not match schedule arrival population ("${schedule.arrivalPopulation}").`);
      }

      if (populationRelationship.outputSchedulerRate.unit !== schedule.rateUnit) {
        issues.push({
          id: 'issue-population-rel-rate-unit-mismatch',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'outputSchedulerRate.unit',
          description: `Population relationship output rate unit ("${populationRelationship.outputSchedulerRate.unit}") does not match schedule rate unit ("${schedule.rateUnit}").`,
          remediationGuidance: 'Align outputSchedulerRate.unit with schedule.rateUnit.'
        });
        blockingReasons.push(`Population relationship output rate unit ("${populationRelationship.outputSchedulerRate.unit}") does not match schedule rate unit ("${schedule.rateUnit}").`);
      }

      if (journeys.length > 1 && populationRelationship.inputBusinessTarget.unit === populationRelationship.outputSchedulerRate.unit) {
        issues.push({
          id: 'issue-population-rel-silent-unit-equivalence',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'outputSchedulerRate.unit',
          description: `Mixed-journey workload cannot equate business attainment unit ("${populationRelationship.inputBusinessTarget.unit}") directly with scheduler arrival rate unit ("${populationRelationship.outputSchedulerRate.unit}").`,
          remediationGuidance: 'Distinguish between business event attainment unit and mixed-journey scheduler arrival rate unit.'
        });
        blockingReasons.push(`Mixed-journey workload equates business unit with scheduler arrival unit ("${populationRelationship.outputSchedulerRate.unit}").`);
      }

      // 7.2 Business-event contribution consistency
      const hasValidContribution =
        typeof populationRelationship.contributionPerSuccessfulEvent === 'number' &&
        Number.isFinite(populationRelationship.contributionPerSuccessfulEvent) &&
        populationRelationship.contributionPerSuccessfulEvent > 0;

      if (!hasValidContribution) {
        issues.push({
          id: 'issue-population-rel-invalid-contribution',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'contributionPerSuccessfulEvent',
          description: `Population relationship contributionPerSuccessfulEvent must be a positive finite number (received ${populationRelationship.contributionPerSuccessfulEvent}).`,
          remediationGuidance: 'Specify a positive finite contribution per successful event.'
        });
        blockingReasons.push(`Invalid population relationship contribution (${populationRelationship.contributionPerSuccessfulEvent}).`);
      }

      const targetJourney = journeys.find((j) => j.key === populationRelationship.relevantJourneyKey);
      if (!targetJourney) {
        issues.push({
          id: 'issue-population-rel-journey-not-found',
          type: 'POPULATION_RELATIONSHIP_MISMATCH',
          severity: 'BLOCKING',
          parameter: 'relevantJourneyKey',
          description: `Population relationship targets journey "${populationRelationship.relevantJourneyKey}" which is not defined in journey distribution.`,
          remediationGuidance: 'Ensure relevantJourneyKey references a valid canonical journey key.'
        });
        blockingReasons.push(`Population relationship references missing journey "${populationRelationship.relevantJourneyKey}".`);
      } else {
        if (Math.abs(targetJourney.weight - populationRelationship.journeyShare) > 0.001) {
          issues.push({
            id: 'issue-population-rel-share-mismatch',
            type: 'POPULATION_RELATIONSHIP_MISMATCH',
            severity: 'BLOCKING',
            parameter: 'journeyShare',
            description: `Population relationship journeyShare (${populationRelationship.journeyShare}) does not match journey "${targetJourney.name}" weight (${targetJourney.weight}).`,
            remediationGuidance: 'Ensure journeyShare matches the canonical journey weight.'
          });
          blockingReasons.push(`Population relationship journey share (${populationRelationship.journeyShare}) does not match journey weight (${targetJourney.weight}).`);
        }

        // At least one governed step in target journey emits the relevant business event
        const stepsWithContribution = (targetJourney.steps || []).filter(
          (s) => Boolean(s.businessEventContribution)
        );

        if (stepsWithContribution.length === 0) {
          issues.push({
            id: 'issue-population-rel-no-event-step',
            type: 'POPULATION_RELATIONSHIP_MISMATCH',
            severity: 'BLOCKING',
            parameter: 'relevantJourneyKey',
            description: `Referenced journey "${targetJourney.name}" (${targetJourney.key}) has no governed step emitting a business event contribution.`,
            remediationGuidance: 'Ensure at least one step in the target journey defines businessEventContribution.'
          });
          blockingReasons.push(`Referenced journey "${targetJourney.key}" has no step emitting business event contribution.`);
        } else {
          for (const step of stepsWithContribution) {
            const eventContrib = step.businessEventContribution!;
            // Emitted contribution matches relationship contribution
            if (hasValidContribution && eventContrib.contribution !== populationRelationship.contributionPerSuccessfulEvent) {
              issues.push({
                id: `issue-step-event-contrib-mismatch-${step.id}`,
                type: 'POPULATION_RELATIONSHIP_MISMATCH',
                severity: 'BLOCKING',
                parameter: 'businessEventContribution.contribution',
                description: `Step "${step.name}" (${step.id}) business event contribution (${eventContrib.contribution}) does not match population relationship contributionPerSuccessfulEvent (${populationRelationship.contributionPerSuccessfulEvent}).`,
                remediationGuidance: 'Align step businessEventContribution with the population relationship contribution.'
              });
              blockingReasons.push(`Step "${step.id}" business event contribution mismatch (${eventContrib.contribution} vs ${populationRelationship.contributionPerSuccessfulEvent}).`);
            }

            // Governed success status used for event agrees with step expected status
            if (eventContrib.expectedStatus !== step.expectedStatusCode) {
              issues.push({
                id: `issue-step-event-status-mismatch-${step.id}`,
                type: 'POPULATION_RELATIONSHIP_MISMATCH',
                severity: 'BLOCKING',
                parameter: 'businessEventContribution.expectedStatus',
                description: `Step "${step.name}" (${step.id}) business event expectedStatus (${eventContrib.expectedStatus}) does not match step expectedStatusCode (${step.expectedStatusCode}).`,
                remediationGuidance: 'Ensure business event expectedStatus equals step expectedStatusCode.'
              });
              blockingReasons.push(`Step "${step.id}" business event expected status mismatch (${eventContrib.expectedStatus} vs ${step.expectedStatusCode}).`);
            }

            // Event metric/unit semantics agree with workload-attainment relationship where applicable
            const attainmentBaseUnit = (workloadAttainment.unit || '').split('/')[0].trim().toLowerCase();
            const eventUnit = (eventContrib.unit || '').toLowerCase();
            const eventMetric = (eventContrib.metric || '').toLowerCase();

            const metricAgrees =
              !eventMetric ||
              workloadAttainment.metric.toLowerCase().includes(eventMetric) ||
              workloadAttainment.unit.toLowerCase().includes(eventMetric) ||
              (attainmentBaseUnit && eventMetric.includes(attainmentBaseUnit));

            const unitAgrees =
              !eventUnit ||
              !attainmentBaseUnit ||
              attainmentBaseUnit.includes(eventUnit) ||
              eventUnit.includes(attainmentBaseUnit);

            if (!metricAgrees || !unitAgrees) {
              issues.push({
                id: `issue-step-event-metric-mismatch-${step.id}`,
                type: 'POPULATION_RELATIONSHIP_MISMATCH',
                severity: 'BLOCKING',
                parameter: 'businessEventContribution.metric',
                description: `Step "${step.name}" (${step.id}) event metric/unit ("${eventContrib.metric}" / "${eventContrib.unit}") does not agree with contract workload attainment ("${workloadAttainment.metric}" / "${workloadAttainment.unit}").`,
                remediationGuidance: 'Ensure step event metric and unit align with the contract attainment semantics.'
              });
              blockingReasons.push(`Step "${step.id}" event metric/unit mismatch ("${eventContrib.metric}" vs "${workloadAttainment.unit}").`);
            }
          }
        }

        // Check math: targetValue / (journeyShare * contribution) - NO fallback
        if (hasValidContribution && populationRelationship.journeyShare > 0) {
          const contribution = populationRelationship.contributionPerSuccessfulEvent;
          const expectedSchedulerRate =
            populationRelationship.inputBusinessTarget.value / (populationRelationship.journeyShare * contribution);
          if (Math.abs(populationRelationship.outputSchedulerRate.value - expectedSchedulerRate) > 0.01) {
            issues.push({
              id: 'issue-population-rel-math-mismatch',
              type: 'POPULATION_RELATIONSHIP_MISMATCH',
              severity: 'BLOCKING',
              parameter: 'outputSchedulerRate.value',
              description: `Derived scheduler rate (${populationRelationship.outputSchedulerRate.value}) does not match formula target / (share * contribution) (expected ~${expectedSchedulerRate.toFixed(3)}).`,
              remediationGuidance: 'Ensure outputSchedulerRate is accurately computed from inputBusinessTarget / (journeyShare * contribution).'
            });
            blockingReasons.push(`Derived scheduler rate (${populationRelationship.outputSchedulerRate.value}) does not match formula derivation (expected ~${expectedSchedulerRate.toFixed(3)}).`);
          }

          // Validate schedule.peakArrivalRate matches outputSchedulerRate
          if (Math.abs(schedule.peakArrivalRate - populationRelationship.outputSchedulerRate.value) > 0.01) {
            issues.push({
              id: 'issue-schedule-rel-peak-rate-mismatch',
              type: 'POPULATION_RELATIONSHIP_MISMATCH',
              severity: 'BLOCKING',
              parameter: 'schedule.peakArrivalRate',
              description: `Schedule peakArrivalRate (${schedule.peakArrivalRate}) does not match derived population relationship scheduler rate (${populationRelationship.outputSchedulerRate.value}).`,
              remediationGuidance: 'Align schedule peakArrivalRate and stage targets with the derived scheduler arrival rate.'
            });
            blockingReasons.push(`Schedule peakArrivalRate (${schedule.peakArrivalRate}) does not match population relationship rate (${populationRelationship.outputSchedulerRate.value}).`);
          }
        }
      }
    }
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
    populationRelationship,
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
    sourceContractStatus: contract.status,
    generationTimestamp,
    scenarios: [scenario],
    journeys,
    preconditions,
    parameters,
    executableCriteria,
    ambiguousCriteria,
    workloadAttainment,
    populationRelationship,
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
