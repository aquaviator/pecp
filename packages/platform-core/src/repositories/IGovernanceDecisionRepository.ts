// IGovernanceDecisionRepository
// Persistence interface for immutable governance decisions (approvals and withdrawals)
// Defined according to BUILD-CONTRACT-ARTEFACT-APPROVALS

import {
  GovernanceTargetType,
  GovernanceDecisionRecord
} from '@pecp/pe-domain';

export interface IGovernanceDecisionRepository {
  recordDecision(record: GovernanceDecisionRecord): Promise<void>;
  listDecisionsForTarget(
    projectId: string,
    targetType: GovernanceTargetType,
    targetId: string,
    targetRevisionNumber: number
  ): Promise<GovernanceDecisionRecord[]>;
  getLatestDecisionForTarget(
    projectId: string,
    targetType: GovernanceTargetType,
    targetId: string,
    targetRevisionNumber: number
  ): Promise<GovernanceDecisionRecord | null>;
  listDecisionsForProject(projectId: string): Promise<GovernanceDecisionRecord[]>;
}
