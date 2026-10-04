import { PerformanceContractCompilationResult } from '@pecp/pe-domain';

export interface IPerformanceContractService {
  getPerformanceContract(projectId: string): Promise<PerformanceContractCompilationResult>;
}
