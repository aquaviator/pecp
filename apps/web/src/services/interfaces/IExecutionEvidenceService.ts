import {
  CanonicalExecutionResult,
  AcceptanceEvaluation,
  FindingsRegister,
  PerformanceEvidencePackage,
  PublicationBundle,
  RenderNeutralResultsReport,
  TestDefinition,
  PerformanceContract
} from '@pecp/pe-domain';

export interface RawEvidenceFileItem {
  name: string;
  checksum: string;
  description: string;
}

export interface RawEvidenceArtifactSummary {
  artifactId: string;
  artifactName: string;
  artifactDigest: string;
  durationSeconds: number;
  iterations: number;
  iterationRate: number;
  droppedIterations: number;
  businessEvents: number;
  businessEventRate: number;
  k6Version: string;
  workflowRunId: string;
  commitSha: string;
  files: RawEvidenceFileItem[];
}

export interface ExecutionEvidenceState {
  projectId: string;
  hasExecuted: boolean;
  executionResult: CanonicalExecutionResult | null;
  acceptanceEvaluation: AcceptanceEvaluation | null;
  findingsRegister: FindingsRegister | null;
  evidencePackage: PerformanceEvidencePackage | null;
  publicationBundle: PublicationBundle | null;
  resultsReport: RenderNeutralResultsReport | null;
  verifiedTestDefinition: TestDefinition | null;
  contract: PerformanceContract | null;
  rawArtifactSummary: RawEvidenceArtifactSummary | null;
}

export interface IExecutionEvidenceService {
  getExecutionEvidenceState(projectId: string): Promise<ExecutionEvidenceState>;
}
