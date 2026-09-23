import {
  IExecutionEvidenceService,
  ExecutionEvidenceState
} from '../interfaces/IExecutionEvidenceService';
import {
  AUTHORITATIVE_RETAILCO_CONTRACT,
  AUTHORITATIVE_RETAILCO_TEST_DEFINITION,
  AUTHORITATIVE_RETAILCO_EXECUTION_RESULT,
  AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION,
  AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER,
  AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE,
  AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE,
  AUTHORITATIVE_RETAILCO_RESULTS_REPORT,
  AUTHORITATIVE_RETAILCO_RAW_ARTIFACT_SUMMARY
} from '../../fixtures/retailco/authoritativeRetailCoExecutionEvidence';

export class MockExecutionEvidenceService implements IExecutionEvidenceService {
  async getExecutionEvidenceState(projectId: string): Promise<ExecutionEvidenceState> {
    // Check if the project is RetailCo reference project
    const isRetailCo =
      projectId.startsWith('proj-retailco') ||
      projectId === 'proj-retailco-bf2026';

    if (isRetailCo) {
      return JSON.parse(
        JSON.stringify({
          projectId,
          hasExecuted: true,
          executionResult: AUTHORITATIVE_RETAILCO_EXECUTION_RESULT,
          acceptanceEvaluation: AUTHORITATIVE_RETAILCO_ACCEPTANCE_EVALUATION,
          findingsRegister: AUTHORITATIVE_RETAILCO_FINDINGS_REGISTER,
          evidencePackage: AUTHORITATIVE_RETAILCO_EVIDENCE_PACKAGE,
          publicationBundle: AUTHORITATIVE_RETAILCO_PUBLICATION_BUNDLE,
          resultsReport: AUTHORITATIVE_RETAILCO_RESULTS_REPORT,
          verifiedTestDefinition: AUTHORITATIVE_RETAILCO_TEST_DEFINITION,
          contract: AUTHORITATIVE_RETAILCO_CONTRACT,
          rawArtifactSummary: AUTHORITATIVE_RETAILCO_RAW_ARTIFACT_SUMMARY
        })
      );
    }

    // Default unexecuted state for new/empty projects
    return {
      projectId,
      hasExecuted: false,
      executionResult: null,
      acceptanceEvaluation: null,
      findingsRegister: null,
      evidencePackage: null,
      publicationBundle: null,
      resultsReport: null,
      verifiedTestDefinition: null,
      contract: null,
      rawArtifactSummary: null
    };
  }
}
