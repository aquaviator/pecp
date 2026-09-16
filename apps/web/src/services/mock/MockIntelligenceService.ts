import { IIntelligenceService } from '../interfaces/IIntelligenceService';
import { IntelligenceItem, IntelligenceReviewSummary } from '../../types';
import {
  RETAILCO_INTELLIGENCE_ITEMS_FIXTURE,
  RETAILCO_INTELLIGENCE_SUMMARY_FIXTURE,
  RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE,
  RETAILCO_M1_INTELLIGENCE_SUMMARY_FIXTURE
} from '../../fixtures/retailco/intelligenceFixture';

export class MockIntelligenceService implements IIntelligenceService {
  private items: Map<string, IntelligenceItem[]> = new Map();
  private summaries: Map<string, IntelligenceReviewSummary> = new Map();

  constructor() {
    // Seed with RetailCo baseline (3 conflicts, including unresolved peak orders)
    this.items.set('proj-retailco-bf2026', JSON.parse(JSON.stringify(RETAILCO_INTELLIGENCE_ITEMS_FIXTURE)));
    this.summaries.set('proj-retailco-bf2026', JSON.parse(JSON.stringify(RETAILCO_INTELLIGENCE_SUMMARY_FIXTURE)));

    // Also seed M1 post-resolution reference project for direct post-resolution testing
    this.items.set('proj-retailco-bf2026-m1', JSON.parse(JSON.stringify(RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE)));
    this.summaries.set('proj-retailco-bf2026-m1', JSON.parse(JSON.stringify(RETAILCO_M1_INTELLIGENCE_SUMMARY_FIXTURE)));
  }

  async getIntelligenceSummary(projectId: string): Promise<IntelligenceReviewSummary> {
    const summary = this.summaries.get(projectId);
    if (!summary) {
      // Default empty summary for newly created projects
      return {
        documentsAnalysed: 0,
        requirementsFound: 0,
        performanceRequirements: 0,
        conflicts: 0,
        missingInformation: 0,
        readinessSections: []
      };
    }
    return JSON.parse(JSON.stringify(summary));
  }

  async getIntelligenceItems(projectId: string): Promise<IntelligenceItem[]> {
    const list = this.items.get(projectId);
    if (!list) {
      return [];
    }
    return JSON.parse(JSON.stringify(list));
  }

  async getIntelligenceItemById(projectId: string, itemId: string): Promise<IntelligenceItem | null> {
    const list = this.items.get(projectId) || [];
    const item = list.find((i) => i.id === itemId);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async resolveIntelligenceConflict(
    projectId: string,
    itemId: string,
    chosenCandidateId: string,
    rationale?: string
  ): Promise<IntelligenceItem> {
    const list = this.items.get(projectId);
    if (!list) throw new Error(`Project ${projectId} not found in intelligence store`);

    const item = list.find((i) => i.id === itemId);
    if (!item) throw new Error(`Intelligence item ${itemId} not found`);

    if (!item.candidates || item.candidates.length === 0) {
      throw new Error(`Item ${itemId} has no candidates to resolve`);
    }

    const chosen = item.candidates.find((c) => c.id === chosenCandidateId);
    if (!chosen) {
      throw new Error(`Candidate ${chosenCandidateId} not found in item ${itemId}`);
    }

    // Apply resolution mutation on mock store
    item.value = chosen.value;
    if (chosen.unit) item.unit = chosen.unit;
    item.canonicalState = 'APPROVED';
    item.reviewStatus = 'FOUND';
    item.approvalState = 'APPROVED';
    item.approvedBy = 'Performance Lead';
    item.approvalDate = new Date().toISOString();
    item.source = chosen.source;
    item.sourceDocument = chosen.sourceDocument;
    item.sourceLocation = chosen.sourceLocation;
    item.notes = `Authoritative candidate selected from ${chosen.source}. ${rationale ? `Rationale: ${rationale}` : ''}`;

    item.history.push({
      date: new Date().toISOString(),
      action: `Resolved conflict in favor of candidate (${chosen.value} ${chosen.unit || ''})`,
      actor: 'Performance Lead',
      note: rationale || `Authoritative source: ${chosen.source}`
    });

    // Update summary counts
    const summary = this.summaries.get(projectId);
    if (summary && summary.conflicts > 0) {
      summary.conflicts -= 1;
      const workloadSec = summary.readinessSections.find((s) => s.id === 'workload');
      if (workloadSec) {
        workloadSec.status = 'VERIFIED';
        workloadSec.summary = 'Peak hourly order candidate resolved and approved as authoritative baseline.';
        workloadSec.verifiedCount += 1;
      }
    }

    return JSON.parse(JSON.stringify(item));
  }

  async approveIntelligenceItem(
    projectId: string,
    itemId: string,
    approverName: string
  ): Promise<IntelligenceItem> {
    const list = this.items.get(projectId);
    if (!list) throw new Error(`Project ${projectId} not found`);

    const item = list.find((i) => i.id === itemId);
    if (!item) throw new Error(`Item ${itemId} not found`);

    item.canonicalState = 'APPROVED';
    item.reviewStatus = 'FOUND';
    item.approvalState = 'APPROVED';
    item.approvedBy = approverName;
    item.approvalDate = new Date().toISOString();

    item.history.push({
      date: new Date().toISOString(),
      action: 'Item formally marked as APPROVED in canonical model',
      actor: approverName
    });

    return JSON.parse(JSON.stringify(item));
  }
}
