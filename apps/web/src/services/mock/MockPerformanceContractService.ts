// MockPerformanceContractService
// In-memory compiler adapter for Mock mode in the PECP Web portal

import {
  PerformanceContractCompilationResult,
  ContractBlockingIssue,
  CompiledFieldValue,
  ContractFieldProvenance,
  computeContractFingerprint
} from '@pecp/pe-domain';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { IPerformanceContractService } from '../interfaces/IPerformanceContractService';
import { IProjectService } from '../interfaces/IProjectService';
import { IIntelligenceService } from '../interfaces/IIntelligenceService';

export class MockPerformanceContractService implements IPerformanceContractService {
  private readonly projectService: IProjectService;
  private readonly intelligenceService: IIntelligenceService;

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
}
