// IContractRevisionRepository
// Persistence interface for immutable project contract review revisions
// Defined according to BUILD-CONTRACT-ARTEFACT-APPROVALS

import { ContractStatus } from '@pecp/pe-domain';

export interface ContractRevisionRecord {
  id: string;
  projectId: string;
  organisationId: string;
  revisionNumber: number;
  status: ContractStatus;
  contractId: string;
  version: string;
  fingerprint: string;
  inputRevisionDigest: string;
  contentJson: string;
  provenanceJson: string;
  recordedAt: string;
  actorUserId: string;
  actorDisplayName: string;
}

export interface IContractRevisionRepository {
  createRevision(record: ContractRevisionRecord): Promise<void>;
  getByRevisionNumber(
    projectId: string,
    revisionNumber: number
  ): Promise<ContractRevisionRecord | null>;
  getLatestRevision(projectId: string): Promise<ContractRevisionRecord | null>;
  listRevisions(projectId: string): Promise<ContractRevisionRecord[]>;
}
