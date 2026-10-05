// MockPerformanceContractService
// In-memory compiler adapter for Mock mode in the PECP Web portal

import {
  PerformanceContractCompilationResult,
  ContractBlockingIssue,
  CompiledFieldValue,
  ContractFieldProvenance,
  computeContractFingerprint,
  ContractReviewRevision,
  SaveContractReviewRevisionInput,
  SubmitDecisionInput,
  GovernanceDecisionSummary
} from '@pecp/pe-domain';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { IPerformanceContractService } from '../interfaces/IPerformanceContractService';
import { IProjectService } from '../interfaces/IProjectService';
import { IIntelligenceService } from '../interfaces/IIntelligenceService';

export class MockPerformanceContractService implements IPerformanceContractService {
  private readonly projectService: IProjectService;
  private readonly intelligenceService: IIntelligenceService;
  private revisionsMap = new Map<string, ContractReviewRevision[]>();

  constructor(projectService: IProjectService, intelligenceService: IIntelligenceService) {
    this.projectService = projectService;
    this.intelligenceService = intelligenceService;
  }

  async getPerformanceContract(projectId: string): Promise<PerformanceContractCompilationResult> {
    const project = await this.projectService.getProjectById(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const items = await this.intelligenceService.getIntelligenceItems(projectId);

    const contract = compileDraftPerformanceContract({
      projectSummary: project,
      intelligenceItems: items,
      version: 'v0.1-draft',
      compilationTimestamp: project.createdDate || '2026-08-19T10:00:00.000Z'
    });

    const compiledValues: Record<string, CompiledFieldValue> = {};
    const blockingIssues: ContractBlockingIssue[] = [];
    const provenanceList: ContractFieldProvenance[] = [];

    for (const item of items) {
      const isApproved = item.canonicalState === 'APPROVED' || item.approvalState === 'APPROVED';
      const isConflicting = item.canonicalState === 'CONFLICTING' || item.reviewStatus === 'CONFLICTING';
      const isStale = item.canonicalState === 'STALE' || item.reviewStatus === 'STALE';

      if (isConflicting || isStale || (!isApproved && item.category === 'WORKLOAD')) {
        blockingIssues.push({
          fieldKey: item.key,
          title: item.title,
          issueType: isConflicting ? 'CONFLICTING_SOURCE' : isStale ? 'STALE_SOURCE' : 'UNAPPROVED_CRITICAL_VALUE',
          reason: isConflicting
            ? `Field '${item.title}' is conflicting across multiple candidates`
            : isStale
            ? `Field '${item.title}' is stale because bound source was modified`
            : `Field '${item.title}' is unapproved`,
          severity: 'BLOCKING',
          remediationGuidance: 'Review in Intelligence Review portal.',
          intelligenceItemId: item.id
        });
      } else if (isApproved && item.value !== undefined) {
        const primaryBinding = item.sourceBindings && item.sourceBindings.length > 0 ? item.sourceBindings[0] : undefined;
        const prov: ContractFieldProvenance = {
          fieldKey: item.key,
          intelligenceItemId: item.id,
          intelligenceRevision: item.revision ?? 1,
          canonicalState: item.canonicalState,
          reviewStatus: item.reviewStatus,
          approvalRevision: item.activeApprovalSnapshot?.revision,
          approvedBy: item.activeApprovalSnapshot?.approvedByUserDisplayName || item.approvedBy,
          approvedAt: item.activeApprovalSnapshot?.approvedAt || item.approvalDate,
          sourceId: primaryBinding?.sourceId,
          sourceVersionId: primaryBinding?.sourceVersionId,
          sourceVersionNumber: primaryBinding?.sourceVersionNumber,
          sourceSha256: primaryBinding?.originalSha256,
          locator: primaryBinding?.locator,
          excerpt: primaryBinding?.excerpt,
          value: item.value,
          unit: item.unit
        };
        compiledValues[item.key] = {
          key: item.key,
          title: item.title,
          value: item.value,
          unit: item.unit,
          provenance: prov
        };
        provenanceList.push(prov);
      }
    }

    const fingerprint = computeContractFingerprint(contract);
    contract.fingerprint = fingerprint;
    contract.provenance = provenanceList;

    return {
      projectId: project.id,
      projectName: project.name,
      engineeringIntent: project.intent,
      status: contract.status,
      isCompileReady: contract.status === 'READY_FOR_APPROVAL' && blockingIssues.length === 0,
      fingerprint,
      contract,
      compiledValues,
      blockingIssues,
      provenance: provenanceList,
      compiledAt: contract.createdAt
    };
  }

  async saveContractReviewRevision(
    projectId: string,
    input?: SaveContractReviewRevisionInput
  ): Promise<ContractReviewRevision> {
    const comp = await this.getPerformanceContract(projectId);
    const existing = this.revisionsMap.get(projectId) || [];
    const nextRev = existing.length + 1;

    const rev: ContractReviewRevision = {
      id: `mock-contract-rev-${projectId}-${nextRev}`,
      projectId,
      organisationId: 'default-org',
      revisionNumber: nextRev,
      status: comp.contract.status,
      contractId: comp.contract.id,
      version: comp.contract.version,
      fingerprint: comp.fingerprint,
      inputRevisionDigest: `digest-${comp.fingerprint}`,
      contract: comp.contract,
      provenance: comp.provenance,
      recordedAt: new Date().toISOString(),
      actorUserId: 'mock-user',
      actorDisplayName: 'Mock Engineer',
      activeDecision: null,
      approvalValidity: {
        isValid: false,
        state: 'NOT_APPROVED',
        reasons: ['Contract review revision has not been approved.'],
        activeDecision: null
      }
    };

    existing.push(rev);
    this.revisionsMap.set(projectId, existing);
    return rev;
  }

  async listContractReviewRevisions(projectId: string): Promise<ContractReviewRevision[]> {
    const list = this.revisionsMap.get(projectId) || [];
    return [...list].reverse();
  }

  async getContractReviewRevision(
    projectId: string,
    revisionNumber: number
  ): Promise<ContractReviewRevision> {
    const list = this.revisionsMap.get(projectId) || [];
    const found = list.find((r) => r.revisionNumber === revisionNumber);
    if (!found) {
      throw new Error(`Contract review revision ${revisionNumber} not found`);
    }
    return found;
  }

  async submitContractDecision(
    projectId: string,
    revisionNumber: number,
    input: SubmitDecisionInput
  ): Promise<ContractReviewRevision> {
    const rev = await this.getContractReviewRevision(projectId, revisionNumber);
    const decisionSummary: GovernanceDecisionSummary = {
      id: `decision-${Date.now()}`,
      decisionType: input.decisionType,
      rationale: input.rationale,
      actorDisplayName: 'Mock Reviewer',
      actorUserId: 'mock-reviewer',
      decidedAt: new Date().toISOString(),
      targetContentFingerprint: rev.fingerprint,
      targetInputDigest: rev.inputRevisionDigest,
      decisionRevision: 1
    };

    rev.activeDecision = decisionSummary;
    if (input.decisionType === 'APPROVE') {
      rev.approvalValidity = {
        isValid: true,
        state: 'CURRENTLY_VALID',
        reasons: [],
        activeDecision: decisionSummary
      };
    } else {
      rev.approvalValidity = {
        isValid: false,
        state: 'WITHDRAWN',
        reasons: [`Approval was withdrawn: ${input.rationale}`],
        activeDecision: decisionSummary
      };
    }

    return rev;
  }
}
