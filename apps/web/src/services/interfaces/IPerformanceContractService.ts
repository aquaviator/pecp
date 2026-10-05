import {
  PerformanceContractCompilationResult,
  ContractReviewRevision,
  SaveContractReviewRevisionInput,
  SubmitDecisionInput
} from '@pecp/pe-domain';

export interface IPerformanceContractService {
  getPerformanceContract(projectId: string): Promise<PerformanceContractCompilationResult>;
  saveContractReviewRevision?(
    projectId: string,
    input?: SaveContractReviewRevisionInput
  ): Promise<ContractReviewRevision>;
  listContractReviewRevisions?(projectId: string): Promise<ContractReviewRevision[]>;
  getContractReviewRevision?(
    projectId: string,
    revisionNumber: number
  ): Promise<ContractReviewRevision>;
  submitContractDecision?(
    projectId: string,
    revisionNumber: number,
    input: SubmitDecisionInput
  ): Promise<ContractReviewRevision>;
}
