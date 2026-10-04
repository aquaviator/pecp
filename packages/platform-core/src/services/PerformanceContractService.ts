// PerformanceContractService
// Governed intelligence-to-performance-contract bridge service
// Defined according to M5.2 Work Package & Intelligence-to-Performance Contract Product Slice

import {
  ProjectSummary,
  IntelligenceItem,
  PerformanceContract,
  ContractStatus,
  ContractFieldProvenance,
  ContractBlockingIssue,
  CompiledFieldValue,
  PerformanceContractCompilationResult,
  computeContractFingerprint,
  IntelligenceCategory,
  CanonicalState,
  ReviewStatus
} from '@pecp/pe-domain';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import {
  IProjectRepository,
  IIntelligenceRepository,
  ISourceRepository,
  IExtractionRepository,
  IChecklistRepository,
  IOrganisationMembershipRepository,
  AuthenticatedPrincipal,
  AuthorizationPolicy
} from '../index.js';

export interface PerformanceContractServiceDependencies {
  projectRepository: IProjectRepository;
  intelligenceRepository: IIntelligenceRepository;
  sourceRepository?: ISourceRepository;
  extractionRepository?: IExtractionRepository;
  checklistRepository?: IChecklistRepository;
  membershipRepository?: IOrganisationMembershipRepository;
}

export type FieldEligibilityStatus =
  | 'USABLE'
  | 'MISSING'
  | 'CONFLICTING'
  | 'AMBIGUOUS'
  | 'STALE'
  | 'UNAPPROVED'
  | 'INVALID_TYPE'
  | 'INVALID_OR_MISSING_UNIT'
  | 'INVALID_PROVENANCE';

export interface FieldEligibilityEvaluation {
  fieldKey: string;
  title: string;
  category: IntelligenceCategory;
  status: FieldEligibilityStatus;
  isEligible: boolean;
  item?: IntelligenceItem;
  blockingReason?: string;
  remediationGuidance?: string;
  provenance?: ContractFieldProvenance;
}

export class PerformanceContractService {
  private readonly projectRepo: IProjectRepository;
  private readonly intelligenceRepo: IIntelligenceRepository;
  private readonly sourceRepo?: ISourceRepository;
  private readonly extractionRepo?: IExtractionRepository;
  private readonly checklistRepo?: IChecklistRepository;
  private readonly membershipRepo?: IOrganisationMembershipRepository;

  constructor(deps: PerformanceContractServiceDependencies) {
    this.projectRepo = deps.projectRepository;
    this.intelligenceRepo = deps.intelligenceRepository;
    this.sourceRepo = deps.sourceRepository;
    this.extractionRepo = deps.extractionRepository;
    this.checklistRepo = deps.checklistRepository;
    this.membershipRepo = deps.membershipRepository;
  }

  /**
   * Compiles the authoritative Performance Contract from persisted governed intelligence.
   * Enforces RBAC, input eligibility, provenance preservation, and pure deterministic calculations.
   */
  async compileProjectPerformanceContract(
    projectId: string,
    principal?: AuthenticatedPrincipal
  ): Promise<PerformanceContractCompilationResult> {
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      const err = new Error(`Project '${projectId}' not found`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (principal) {
      const canRead =
        AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', project.organisationId) ||
        AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', project.organisationId);

      if (!canRead) {
        const err = new Error('PROJECT_READ permission required');
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // 1. Fetch real persisted project intelligence
    const intelligenceItems = await this.intelligenceRepo.listByProject(projectId);

    // 2. Fetch project checklist if configured
    const checklist = this.checklistRepo ? await this.checklistRepo.getChecklist(projectId) : null;

    // 3. Evaluate Input Eligibility
    const evaluations: FieldEligibilityEvaluation[] = [];
    const blockingIssues: ContractBlockingIssue[] = [];
    const compiledValues: Record<string, CompiledFieldValue> = {};
    const provenanceList: ContractFieldProvenance[] = [];

    // 3a. Evaluate primary Workload Throughput requirement
    const peakOrdersItem = intelligenceItems.find(
      (item) => item.key === 'peak_orders_per_hr' || item.key === 'peak_hourly_orders' || item.key === 'peak_orders'
    );

    const peakOrdersEval = this.evaluateFieldEligibility(peakOrdersItem, 'peak_orders_per_hr', {
      title: 'Peak Orders per Hour',
      category: 'WORKLOAD',
      required: true,
      expectedValueKind: 'NUMBER',
      expectedUnit: ['orders/hr', 'orders/hour', 'per_hour', 'orders/sec', 'orders/second']
    });
    evaluations.push(peakOrdersEval);

    // 3b. Evaluate configured checklist items if any
    if (checklist && checklist.items && checklist.items.length > 0) {
      for (const reqDef of checklist.items) {
        // Skip peak_orders_per_hr if already evaluated above
        if (reqDef.key === 'peak_orders_per_hr' || reqDef.key === 'peak_hourly_orders' || reqDef.key === 'peak_orders') {
          continue;
        }

        const matchingItem = intelligenceItems.find((i) => i.key === reqDef.key);
        const reqEval = this.evaluateFieldEligibility(matchingItem, reqDef.key, {
          title: reqDef.title,
          category: reqDef.category,
          required: reqDef.required,
          expectedValueKind: reqDef.expectedValueKind,
          expectedUnit: reqDef.expectedUnit
        });
        evaluations.push(reqEval);
      }
    }

    // 3c. Evaluate all other items in WORKLOAD, REQUIREMENTS, and ACCEPTANCE_CRITERIA categories
    for (const item of intelligenceItems) {
      const alreadyEvaluated = evaluations.some((e) => e.fieldKey === item.key);
      if (!alreadyEvaluated) {
        if (
          item.category === 'WORKLOAD' ||
          item.category === 'REQUIREMENTS' ||
          item.category === 'ACCEPTANCE_CRITERIA'
        ) {
          const itemEval = this.evaluateFieldEligibility(item, item.key, {
            title: item.title,
            category: item.category,
            required: false,
            expectedValueKind: typeof item.value === 'number' ? 'NUMBER' : 'ANY'
          });
          evaluations.push(itemEval);
        }
      }
    }

    // 4. Assemble blocking issues and compiled values from evaluations
    for (const ev of evaluations) {
      if (!ev.isEligible) {
        const issueType =
          ev.status === 'MISSING'
            ? 'MISSING_PREREQUISITE'
            : ev.status === 'CONFLICTING'
            ? 'CONFLICTING_SOURCE'
            : ev.status === 'STALE'
            ? 'STALE_SOURCE'
            : ev.status === 'AMBIGUOUS'
            ? 'AMBIGUOUS_SOURCE'
            : ev.status === 'UNAPPROVED'
            ? 'UNAPPROVED_CRITICAL_VALUE'
            : ev.status === 'INVALID_TYPE'
            ? 'INVALID_VALUE_TYPE'
            : ev.status === 'INVALID_OR_MISSING_UNIT'
            ? 'INCOMPATIBLE_UNITS_SEMANTICS'
            : 'MISSING_SOURCE_PROVENANCE';

        blockingIssues.push({
          fieldKey: ev.fieldKey,
          title: ev.title,
          issueType,
          reason: ev.blockingReason || `Field '${ev.title}' is not eligible for contract compilation (${ev.status})`,
          severity: 'BLOCKING',
          remediationGuidance: ev.remediationGuidance || 'Review and resolve governance gaps in the intelligence portal.',
          intelligenceItemId: ev.item?.id
        });
      } else if (ev.item && ev.provenance) {
        compiledValues[ev.fieldKey] = {
          key: ev.fieldKey,
          title: ev.title,
          value: ev.item.value!,
          unit: ev.item.unit,
          provenance: ev.provenance
        };
        provenanceList.push(ev.provenance);
      }
    }

    // 5. Invoke existing canonical workload / contract compiler
    const contract = compileDraftPerformanceContract({
      projectSummary: project,
      intelligenceItems,
      version: 'v0.1-draft',
      compilationTimestamp: project.createdDate || '2026-08-19T10:00:00.000Z'
    });

    // 6. Connect governance issues to contract readiness
    if (blockingIssues.length > 0) {
      contract.status = 'BLOCKED';
      contract.approvalReadiness.canApprove = false;
      for (const issue of blockingIssues) {
        if (!contract.approvalReadiness.blockingReasons.includes(issue.reason)) {
          contract.approvalReadiness.blockingReasons.push(issue.reason);
        }
      }
      contract.approvalReadiness.unresolvedIssuesCount = contract.approvalReadiness.blockingReasons.length;
    }

    const isCompileReady = blockingIssues.length === 0 && contract.approvalReadiness.canApprove;
    const status: ContractStatus = isCompileReady ? 'READY_FOR_APPROVAL' : 'BLOCKED';
    contract.status = status;

    // 7. Compute deterministic fingerprint and attach lineage
    const fingerprint = computeContractFingerprint(contract);
    contract.fingerprint = fingerprint;
    contract.provenance = provenanceList;

    return {
      projectId: project.id,
      projectName: project.name,
      engineeringIntent: project.intent,
      status,
      isCompileReady,
      fingerprint,
      contract,
      compiledValues,
      blockingIssues,
      provenance: provenanceList,
      compiledAt: contract.createdAt
    };
  }

  /**
   * Deterministically evaluates input eligibility for a given field according to PECP governance laws.
   */
  evaluateFieldEligibility(
    item: IntelligenceItem | undefined,
    fieldKey: string,
    options: {
      title: string;
      category: IntelligenceCategory;
      required: boolean;
      expectedValueKind?: 'STRING' | 'NUMBER' | 'ANY';
      expectedUnit?: string | string[];
    }
  ): FieldEligibilityEvaluation {
    const { title, category, required, expectedValueKind, expectedUnit } = options;

    // 1. Missing check
    if (!item) {
      if (required) {
        return {
          fieldKey,
          title,
          category,
          status: 'MISSING',
          isEligible: false,
          blockingReason: `Required contract input '${title}' (${fieldKey}) is MISSING from governed project intelligence.`,
          remediationGuidance: `Capture, import, or specify an authoritative value for '${title}' in the intake portal.`
        };
      }
      return {
        fieldKey,
        title,
        category,
        status: 'MISSING',
        isEligible: true
      };
    }

    // 2. Stale check (§7 [I05])
    const isStale = item.canonicalState === 'STALE' || item.reviewStatus === 'STALE';
    if (isStale) {
      return {
        fieldKey,
        title: item.title,
        category: item.category,
        status: 'STALE',
        isEligible: false,
        item,
        blockingReason: `Field '${item.title}' (${item.key}) is STALE because its bound source document was modified or superseded. Re-approval against the current source revision is required.`,
        remediationGuidance: 'Re-review the updated source version, update source bindings if necessary, and re-approve the value.'
      };
    }

    // 3. Conflicting check (§7 [I04])
    const isConflicting =
      item.canonicalState === 'CONFLICTING' ||
      item.reviewStatus === 'CONFLICTING' ||
      Boolean(
        item.candidates &&
        item.candidates.length > 1 &&
        item.canonicalState !== 'APPROVED' &&
        item.approvalState !== 'APPROVED'
      );

    if (isConflicting) {
      const candidatesCount = item.candidates?.length ?? 2;
      return {
        fieldKey,
        title: item.title,
        category: item.category,
        status: 'CONFLICTING',
        isEligible: false,
        item,
        blockingReason: `Field '${item.title}' (${item.key}) is in a CONFLICTING state across ${candidatesCount} competing candidates. An authoritative candidate must be formally selected and approved.`,
        remediationGuidance: 'Review competing assertion candidates in the Intelligence Review portal and select the authoritative value.'
      };
    }

    // 4. Ambiguous check
    const isAmbiguous =
      item.reviewStatus === 'AMBIGUOUS' ||
      Boolean(item.ambiguityReason && item.ambiguityReason.trim().length > 0);

    if (isAmbiguous) {
      return {
        fieldKey,
        title: item.title,
        category: item.category,
        status: 'AMBIGUOUS',
        isEligible: false,
        item,
        blockingReason: `Field '${item.title}' (${item.key}) is AMBIGUOUS: ${item.ambiguityReason || 'Lacks executable operational semantics.'}`,
        remediationGuidance: 'Disambiguate the field specification, percentile, or threshold before approval.'
      };
    }

    // 5. Unapproved check (§8 [I06])
    const isApproved =
      item.canonicalState === 'APPROVED' ||
      item.approvalState === 'APPROVED';

    if (!isApproved) {
      return {
        fieldKey,
        title: item.title,
        category: item.category,
        status: 'UNAPPROVED',
        isEligible: false,
        item,
        blockingReason: `Field '${item.title}' (${item.key}) has not been formally approved as an authoritative contract input.`,
        remediationGuidance: 'A designated Performance Lead or Admin must review and approve this item before contract compilation.'
      };
    }

    // 6. Type contract check
    if (expectedValueKind === 'NUMBER') {
      let isNumeric = false;
      if (typeof item.value === 'number' && !isNaN(item.value)) {
        isNumeric = true;
      } else if (typeof item.value === 'string') {
        const clean = item.value.replace(/,/g, '').trim();
        const parsed = parseFloat(clean);
        if (!isNaN(parsed) && parsed > 0) {
          isNumeric = true;
        }
      }

      if (!isNumeric) {
        return {
          fieldKey,
          title: item.title,
          category: item.category,
          status: 'INVALID_TYPE',
          isEligible: false,
          item,
          blockingReason: `Field '${item.title}' (${item.key}) requires a valid positive numeric value, but received '${item.value}'.`,
          remediationGuidance: 'Correct the field value to a valid number.'
        };
      }
    }

    // 7. Unit contract check
    if (expectedUnit) {
      const allowedUnits = Array.isArray(expectedUnit) ? expectedUnit : [expectedUnit];
      const actualUnit = item.unit?.trim().toLowerCase();
      if (!actualUnit) {
        return {
          fieldKey,
          title: item.title,
          category: item.category,
          status: 'INVALID_OR_MISSING_UNIT',
          isEligible: false,
          item,
          blockingReason: `Field '${item.title}' (${item.key}) is missing a required engineering unit (expected: ${allowedUnits.join(', ')}).`,
          remediationGuidance: `Specify a compatible engineering unit (${allowedUnits.join(', ')}).`
        };
      }

      const isUnitCompatible = allowedUnits.some((u) => u.toLowerCase() === actualUnit);
      if (!isUnitCompatible) {
        return {
          fieldKey,
          title: item.title,
          category: item.category,
          status: 'INVALID_OR_MISSING_UNIT',
          isEligible: false,
          item,
          blockingReason: `Field '${item.title}' (${item.key}) specifies unit '${item.unit}', which is incompatible with required unit(s): ${allowedUnits.join(', ')}.`,
          remediationGuidance: `Supply a compatible unit (${allowedUnits.join(', ')}).`
        };
      }
    }

    // 8. Provenance / Source Binding check (§2 [I01], §7 [I05])
    if (item.intakeManaged && item.canonicalState === 'IMPORTED') {
      if (!item.sourceBindings || item.sourceBindings.length === 0) {
        return {
          fieldKey,
          title: item.title,
          category: item.category,
          status: 'INVALID_PROVENANCE',
          isEligible: false,
          item,
          blockingReason: `Imported field '${item.title}' (${item.key}) lacks required source provenance bindings.`,
          remediationGuidance: 'Re-bind the item to an authoritative source document version.'
        };
      }
    }

    // 9. Item is fully USABLE & Eligible
    const primaryBinding = item.sourceBindings && item.sourceBindings.length > 0 ? item.sourceBindings[0] : undefined;
    const provenance: ContractFieldProvenance = {
      fieldKey,
      intelligenceItemId: item.id,
      intelligenceRevision: item.revision ?? 1,
      canonicalState: item.canonicalState,
      reviewStatus: item.reviewStatus,
      approvalRevision: item.activeApprovalSnapshot?.revision,
      approvedBy: item.activeApprovalSnapshot?.approvedByUserDisplayName || item.approvedBy,
      approvedAt: item.activeApprovalSnapshot?.approvedAt || item.approvalDate,
      decisionNote: item.activeApprovalSnapshot?.decisionNote,
      sourceId: primaryBinding?.sourceId,
      sourceVersionId: primaryBinding?.sourceVersionId,
      sourceVersionNumber: primaryBinding?.sourceVersionNumber,
      sourceSha256: primaryBinding?.originalSha256,
      locator: primaryBinding?.locator,
      excerpt: primaryBinding?.excerpt,
      value: item.value!,
      unit: item.unit
    };

    return {
      fieldKey,
      title: item.title,
      category: item.category,
      status: 'USABLE',
      isEligible: true,
      item,
      provenance
    };
  }
}
