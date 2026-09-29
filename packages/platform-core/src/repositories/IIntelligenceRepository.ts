// IIntelligenceRepository
// Defined according to M5.0 Work Package §7 & M5.2 Work Package §6 [I04]

import { IntelligenceItem, CanonicalState, ReviewStatus } from '@pecp/pe-domain';

export interface IntelligenceRevisionSnapshot {
  id: string;
  itemId: string;
  projectId: string;
  organisationId: string;
  revisionNumber: number;
  recordedAt: string;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  canonicalState: CanonicalState;
  reviewStatus: ReviewStatus;
  valueText?: string | null;
  valueNumber?: number | null;
  unit?: string | null;
  approvalState: 'UNREVIEWED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedByUserId?: string | null;
  sourceBindingsJson: string;
  candidatesJson?: string | null;
  snapshotJson: string;
}

export interface IIntelligenceRepository {
  listByProject(projectId: string): Promise<IntelligenceItem[]>;
  getById(projectId: string, itemId: string): Promise<IntelligenceItem | null>;
  saveItems(projectId: string, items: IntelligenceItem[]): Promise<void>;
  saveRevisionSnapshot(snapshot: IntelligenceRevisionSnapshot): Promise<void>;
  listRevisionSnapshots(projectId: string, itemId: string): Promise<IntelligenceRevisionSnapshot[]>;
  getRevisionSnapshot(
    projectId: string,
    itemId: string,
    revisionNumber: number
  ): Promise<IntelligenceRevisionSnapshot | null>;
}

