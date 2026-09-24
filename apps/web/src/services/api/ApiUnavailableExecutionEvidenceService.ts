// ApiUnavailableExecutionEvidenceService
// Defined according to M5.0 PM Review Blocker 3
// Explicit unavailable boundary for execution & evidence in API mode.
// Invariant: Never silently instantiate mock services or return RetailCo reference data in API mode.

import { ExecutionEvidenceState, IExecutionEvidenceService } from '../interfaces/IExecutionEvidenceService';

export class ApiUnavailableExecutionEvidenceService implements IExecutionEvidenceService {
  async getExecutionEvidenceState(_projectId: string): Promise<ExecutionEvidenceState> {
    throw new Error(
      'ApiUnavailableExecutionEvidenceService: Execution evidence service is not available in API mode until live runner milestone. Mock/reference execution evidence is disabled in API mode.'
    );
  }
}
