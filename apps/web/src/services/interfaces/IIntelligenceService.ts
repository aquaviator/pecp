import { IntelligenceItem, IntelligenceReviewSummary } from '../../types';

export interface IIntelligenceService {
  getIntelligenceSummary(projectId: string): Promise<IntelligenceReviewSummary>;
  getIntelligenceItems(projectId: string): Promise<IntelligenceItem[]>;
  getIntelligenceItemById(projectId: string, itemId: string): Promise<IntelligenceItem | null>;
  resolveIntelligenceConflict(
    projectId: string,
    itemId: string,
    chosenCandidateId: string,
    rationale?: string
  ): Promise<IntelligenceItem>;
  approveIntelligenceItem(
    projectId: string,
    itemId: string,
    approverName: string
  ): Promise<IntelligenceItem>;
}
