// MockArtefactService
// In-memory mock adapter for Engineering Artefacts

import {
  ArtefactListItem,
  ArtefactDetailResponse,
  GenerateArtefactInput,
  EngineeringArtefact,
  ArtefactStalenessResult,
  ArtefactRevisionSummary
} from '@pecp/pe-domain';
import {
  generatePerformanceStrategy,
  generatePerformanceTestPlan,
  evaluateArtefactStaleness,
  checkAndTagArtefactStaleness,
  exportArtefactToMarkdown
} from '@pecp/artefact-engine';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { ProjectSummary } from '../../types';
import { IArtefactService } from '../interfaces/IArtefactService';
import { IProjectService } from '../interfaces/IProjectService';
import { IIntelligenceService } from '../interfaces/IIntelligenceService';

export class MockArtefactService implements IArtefactService {
  private readonly projectService: IProjectService;
  private readonly intelligenceService: IIntelligenceService;
  private storage = new Map<
    string,
    {
      artefact: EngineeringArtefact;
      revisions: Array<{
        revisionNumber: number;
        artefact: EngineeringArtefact;
        recordedAt: string;
      }>;
    }
  >();

  constructor(
    projectService: IProjectService,
    intelligenceService: IIntelligenceService
  ) {
    this.projectService = projectService;
    this.intelligenceService = intelligenceService;
  }

  private storageKey(projectId: string, artefactType: string): string {
    return `${projectId}:${artefactType}`;
  }

  private async getProjectOrFallback(projectId: string): Promise<ProjectSummary> {
    const p = await this.projectService.getProjectById(projectId);
    if (p) return p;
    return {
      id: projectId,
      name: `Project ${projectId}`,
      organisation: 'Default Org',
      organisationId: 'default-org',
      intent: 'FORECAST',
      description: 'Default project',
      createdDate: new Date().toISOString(),
      status: 'ACTIVE',
      documentsCount: 0,
      requirementsCount: 0,
      conflictsCount: 0
    };
  }

  async listArtefacts(projectId: string): Promise<ArtefactListItem[]> {
    const project = await this.getProjectOrFallback(projectId);
    const intelligenceItems = await this.intelligenceService.getIntelligenceItems(projectId);
    const contract = compileDraftPerformanceContract({
      projectSummary: project,
      intelligenceItems,
      version: 'v0.1-draft'
    });

    const results: ArtefactListItem[] = [];
    for (const [key, val] of this.storage.entries()) {
      if (key.startsWith(`${projectId}:`)) {
        const staleness = evaluateArtefactStaleness(val.artefact, contract);
        results.push({
          id: val.artefact.id,
          projectId,
          artefactType: val.artefact.type,
          title: val.artefact.title,
          currentRevisionNumber: val.revisions.length,
          status: staleness.isStale ? 'STALE' : val.artefact.status,
          staleness,
          updatedAt: val.revisions[val.revisions.length - 1]?.recordedAt || val.artefact.generationTimestamp
        });
      }
    }

    return results;
  }

  async getArtefact(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number
  ): Promise<ArtefactDetailResponse> {
    const project = await this.getProjectOrFallback(projectId);
    const intelligenceItems = await this.intelligenceService.getIntelligenceItems(projectId);
    const contract = compileDraftPerformanceContract({
      projectSummary: project,
      intelligenceItems,
      version: 'v0.1-draft'
    });

    let entry:
      | {
          artefact: EngineeringArtefact;
          revisions: Array<{
            revisionNumber: number;
            artefact: EngineeringArtefact;
            recordedAt: string;
          }>;
        }
      | undefined;

    // Search by key
    const typeKey = this.storageKey(projectId, artefactIdOrType);
    if (this.storage.has(typeKey)) {
      entry = this.storage.get(typeKey);
    } else {
      for (const val of this.storage.values()) {
        if (val.artefact.id === artefactIdOrType && val.artefact.projectId === projectId) {
          entry = val;
          break;
        }
      }
    }

    if (!entry) {
      // Auto-generate if not yet generated
      const type = artefactIdOrType.includes('TEST_PLAN')
        ? 'PERFORMANCE_TEST_PLAN'
        : 'PERFORMANCE_STRATEGY';
      return this.generateArtefact(projectId, { artefactType: type });
    }

    const targetRev = revisionNumber
      ? entry.revisions.find((r) => r.revisionNumber === revisionNumber)
      : entry.revisions[entry.revisions.length - 1];

    const currentArtefact = targetRev ? targetRev.artefact : entry.artefact;
    const staleness = evaluateArtefactStaleness(currentArtefact, contract);
    const projectedArtefact = checkAndTagArtefactStaleness(currentArtefact, contract);

    const revisionSummaries: ArtefactRevisionSummary[] = entry.revisions.map((r) => ({
      id: `${entry!.artefact.id}-rev-${r.revisionNumber}`,
      revisionNumber: r.revisionNumber,
      status: r.artefact.status,
      recordedAt: r.recordedAt,
      actorDisplayName: 'Mock User',
      sourceContractFingerprint: r.artefact.sourceContractFingerprint
    }));

    return {
      artefact: projectedArtefact,
      staleness,
      currentRevisionNumber: entry.revisions.length,
      revisions: revisionSummaries
    };
  }

  async generateArtefact(
    projectId: string,
    input: GenerateArtefactInput
  ): Promise<ArtefactDetailResponse> {
    const project = await this.getProjectOrFallback(projectId);
    const intelligenceItems = await this.intelligenceService.getIntelligenceItems(projectId);
    const contract = compileDraftPerformanceContract({
      projectSummary: project,
      intelligenceItems,
      version: 'v0.1-draft'
    });

    const key = this.storageKey(projectId, input.artefactType);
    const existing = this.storage.get(key);
    const nextRev = existing ? existing.revisions.length + 1 : 1;
    const versionString = `v${nextRev}.0-draft`;
    const now = new Date().toISOString();

    const options = {
      contract,
      intelligenceItems,
      projectSummary: project,
      artefactVersion: versionString,
      author: input.author || 'Mock Author',
      organisation: project.organisation,
      generationTimestamp: now
    };

    const artefact: EngineeringArtefact =
      input.artefactType === 'PERFORMANCE_STRATEGY'
        ? generatePerformanceStrategy(options)
        : generatePerformanceTestPlan(options);

    artefact.id = `artefact-${input.artefactType === 'PERFORMANCE_STRATEGY' ? 'strategy' : 'testplan'}-${projectId}`;
    artefact.projectId = projectId;
    artefact.projectName = project.name;

    const revisionItem = {
      revisionNumber: nextRev,
      artefact,
      recordedAt: now
    };

    if (existing) {
      existing.artefact = artefact;
      existing.revisions.push(revisionItem);
    } else {
      this.storage.set(key, {
        artefact,
        revisions: [revisionItem]
      });
    }

    const staleness: ArtefactStalenessResult = {
      isStale: false,
      reasons: [],
      currentContractVersion: contract.version,
      artefactContractVersion: artefact.sourceContractVersion,
      currentContractFingerprint: contract.fingerprint || '',
      artefactContractFingerprint: artefact.sourceContractFingerprint
    };

    const storedEntry = this.storage.get(key)!;
    const revisionSummaries: ArtefactRevisionSummary[] = storedEntry.revisions.map((r) => ({
      id: `${artefact.id}-rev-${r.revisionNumber}`,
      revisionNumber: r.revisionNumber,
      status: r.artefact.status,
      recordedAt: r.recordedAt,
      actorDisplayName: input.author || 'Mock Author',
      sourceContractFingerprint: r.artefact.sourceContractFingerprint
    }));

    return {
      artefact,
      staleness,
      currentRevisionNumber: nextRev,
      revisions: revisionSummaries
    };
  }

  async exportArtefactMarkdown(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number
  ): Promise<string> {
    const detail = await this.getArtefact(projectId, artefactIdOrType, revisionNumber);
    let md = exportArtefactToMarkdown(detail.artefact);
    if (detail.staleness.isStale) {
      md = `> ⚠️ **STALE ARTEFACT NOTICE**: Upstream contract changed.\n\n---\n\n` + md;
    }
    return md;
  }
}
