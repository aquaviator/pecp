// PECP Canonical Performance Evidence Package Generator (M4.1)
// Defined according to docs/work-packages/M4_1_CANONICAL_PERFORMANCE_EVIDENCE_PACKAGE.md
// Invariants:
// 1. Pure, deterministic package generation outside the UI. Never invent root cause or release certification.
// 2. Acceptance and Findings SHA-256 cryptographic digest integrity must be verified.
// 3. Strict provenance validation between Contract, Test Definition, Results, Acceptance, and Findings.
// 4. Package generation validity is strictly separate from the Acceptance evaluation verdict.
// 5. Output is deep-frozen without mutating or freezing caller-owned inputs.

import {
  PerformanceContract,
  TestDefinition,
  CanonicalExecutionResult,
  AcceptanceEvaluation,
  FindingsRegister,
  EngineeringArtefact,
  PerformanceEvidencePackage,
  EvidencePackageGenerationStatus,
  EvidencePackageComponentReference,
  RawEvidencePackageItem,
  EvidencePackageSummary,
  EvidencePackageWorkloadDemand,
  EvidencePackageLineage,
  EvidencePackageLineageEdge,
  ComponentPresenceStatus,
  computeContractFingerprint
} from '@pecp/pe-domain';
import {
  computeTestDefinitionFingerprint,
  computeEvidencePackageDigest
} from './fingerprint.js';
import { verifyAcceptanceEvaluationDigest } from './acceptanceEngine.js';
import { verifyFindingsRegisterDigest } from './findingsGenerator.js';

export interface GeneratePerformanceEvidencePackageInput {
  contract: PerformanceContract;
  testDefinition: TestDefinition;
  results: CanonicalExecutionResult;
  acceptanceEvaluation: AcceptanceEvaluation;
  findingsRegister: FindingsRegister;
  strategy?: EngineeringArtefact;
  testPlan?: EngineeringArtefact;
  generationTimestamp?: string;
}

export interface VerifyPerformanceEvidencePackageDigestResult {
  isValid: boolean;
  recomputedDigest: string;
  expectedDigest?: string;
  error?: string;
}

/**
 * Deep freezes an object and its nested properties to enforce immutability without mutating caller inputs.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Builds normalized payload for Performance Evidence Package cryptographic digest computation.
 * Excludes wall-clock timestamps to guarantee strict determinism.
 */
export function buildEvidencePackageDigestPayload(pkg: {
  packageGenerationStatus: EvidencePackageGenerationStatus;
  generationIssues: string[];
  projectId?: string;
  projectName?: string;
  engineeringIntent?: string;
  sourceExecutionRunId?: string;
  sourceContract: {
    id?: string;
    version?: string | number;
    fingerprint?: string;
    status?: string;
  };
  sourceTestDefinition: {
    id?: string;
    version?: string;
    fingerprint?: string;
  };
  acceptanceEvaluation: {
    id?: string;
    digest?: string;
    overallVerdict?: string;
  };
  findingsRegister: {
    id?: string;
    digest?: string;
    generationStatus?: string;
    totalFindings: number;
    totalDefectCandidates: number;
  };
  components: EvidencePackageComponentReference[];
  rawEvidenceInventory: RawEvidencePackageItem[];
  evidenceSummary: EvidencePackageSummary;
  lineage: EvidencePackageLineage;
}) {
  return {
    packageGenerationStatus: pkg.packageGenerationStatus,
    generationIssues: [...pkg.generationIssues].sort(),
    projectId: pkg.projectId ?? null,
    projectName: pkg.projectName ?? null,
    engineeringIntent: pkg.engineeringIntent ?? null,
    sourceExecutionRunId: pkg.sourceExecutionRunId ?? null,
    sourceContract: {
      id: pkg.sourceContract.id ?? null,
      version: pkg.sourceContract.version != null ? String(pkg.sourceContract.version) : null,
      fingerprint: pkg.sourceContract.fingerprint ?? null,
      status: pkg.sourceContract.status ?? null
    },
    sourceTestDefinition: {
      id: pkg.sourceTestDefinition.id ?? null,
      version: pkg.sourceTestDefinition.version != null ? String(pkg.sourceTestDefinition.version) : null,
      fingerprint: pkg.sourceTestDefinition.fingerprint ?? null
    },
    acceptanceEvaluation: {
      id: pkg.acceptanceEvaluation.id ?? null,
      digest: pkg.acceptanceEvaluation.digest ?? null,
      overallVerdict: pkg.acceptanceEvaluation.overallVerdict ?? null
    },
    findingsRegister: {
      id: pkg.findingsRegister.id ?? null,
      digest: pkg.findingsRegister.digest ?? null,
      generationStatus: pkg.findingsRegister.generationStatus ?? null,
      totalFindings: pkg.findingsRegister.totalFindings,
      totalDefectCandidates: pkg.findingsRegister.totalDefectCandidates
    },
    components: [...pkg.components]
      .sort((a, b) => {
        if (a.componentType !== b.componentType) {
          return a.componentType.localeCompare(b.componentType);
        }
        return (a.canonicalId || '').localeCompare(b.canonicalId || '');
      })
      .map((c) => ({
        componentType: c.componentType,
        canonicalId: c.canonicalId ?? null,
        version: c.version != null ? String(c.version) : null,
        fingerprint: c.fingerprint ?? null,
        digest: c.digest ?? null,
        algorithm: c.algorithm ?? null,
        schemaVersion: c.schemaVersion ?? null,
        status: c.status ?? null,
        sourceContractFingerprint: c.sourceContractFingerprint ?? null,
        executionBundleFingerprint: c.executionBundleFingerprint ?? null,
        executionArtifactDigest: c.executionArtifactDigest ?? null,
        sourceLocator: c.sourceLocator ?? null,
        isRequired: c.isRequired,
        presenceStatus: c.presenceStatus
      })),
    rawEvidenceInventory: [...pkg.rawEvidenceInventory]
      .sort((a, b) => a.filename.localeCompare(b.filename))
      .map((r) => ({
        evidenceType: r.evidenceType,
        filename: r.filename,
        presenceStatus: r.presenceStatus,
        checksum: r.checksum ?? null,
        sizeBytes: r.sizeBytes ?? null,
        sourceLocator: r.sourceLocator ?? null
      })),
    lineageEdges: [...pkg.lineage.edges]
      .sort((a, b) => {
        const keyA = `${a.fromComponent}:${a.fromId}->${a.toComponent}:${a.toId}`;
        const keyB = `${b.fromComponent}:${b.fromId}->${b.toComponent}:${b.toId}`;
        return keyA.localeCompare(keyB);
      })
      .map((e) => ({
        fromComponent: e.fromComponent,
        fromId: e.fromId,
        toComponent: e.toComponent,
        toId: e.toId,
        bindingType: e.bindingType,
        verified: e.verified,
        details: e.details
      })),
    evidenceSummary: {
      execution: {
        executionRunId: pkg.evidenceSummary.execution.executionRunId ?? null,
        executionMode: pkg.evidenceSummary.execution.executionMode ?? null,
        operationalStatus: pkg.evidenceSummary.execution.operationalStatus ?? null,
        startedAt: pkg.evidenceSummary.execution.startedAt ?? null,
        completedAt: pkg.evidenceSummary.execution.completedAt ?? null,
        durationSeconds: pkg.evidenceSummary.execution.durationSeconds ?? null
      },
      workloadDemand: {
        businessDemand: pkg.evidenceSummary.workloadDemand.businessDemand
          ? {
              targetValue: pkg.evidenceSummary.workloadDemand.businessDemand.targetValue ?? null,
              unit: pkg.evidenceSummary.workloadDemand.businessDemand.unit ?? null,
              metric: pkg.evidenceSummary.workloadDemand.businessDemand.metric ?? null,
              timeBasis: pkg.evidenceSummary.workloadDemand.businessDemand.timeBasis ?? null
            }
          : null,
        schedulerDemand: pkg.evidenceSummary.workloadDemand.schedulerDemand
          ? {
              peakArrivalRate: pkg.evidenceSummary.workloadDemand.schedulerDemand.peakArrivalRate ?? null,
              unit: pkg.evidenceSummary.workloadDemand.schedulerDemand.unit ?? null,
              population: pkg.evidenceSummary.workloadDemand.schedulerDemand.population ?? null,
              executionModel: pkg.evidenceSummary.workloadDemand.schedulerDemand.executionModel ?? null,
              startRate: pkg.evidenceSummary.workloadDemand.schedulerDemand.startRate ?? null
            }
          : null,
        profileType: pkg.evidenceSummary.workloadDemand.profileType ?? null,
        totalDurationSeconds: pkg.evidenceSummary.workloadDemand.totalDurationSeconds ?? null,
        rampUpSeconds: pkg.evidenceSummary.workloadDemand.rampUpSeconds ?? null,
        steadyStateSeconds: pkg.evidenceSummary.workloadDemand.steadyStateSeconds ?? null,
        rampDownSeconds: pkg.evidenceSummary.workloadDemand.rampDownSeconds ?? null
      },
      workloadAttainment: pkg.evidenceSummary.workloadAttainment
        ? {
            status: pkg.evidenceSummary.workloadAttainment.status ?? null,
            isPrerequisiteMet:
              pkg.evidenceSummary.workloadAttainment.isPrerequisiteMet != null
                ? pkg.evidenceSummary.workloadAttainment.isPrerequisiteMet
                : null,
            observedValue: pkg.evidenceSummary.workloadAttainment.observedValue ?? null,
            targetValue: pkg.evidenceSummary.workloadAttainment.targetValue ?? null,
            unit: pkg.evidenceSummary.workloadAttainment.unit ?? null,
            derivationStatus: pkg.evidenceSummary.workloadAttainment.derivationStatus ?? null,
            rationale: pkg.evidenceSummary.workloadAttainment.rationale ?? null
          }
        : null,
      criterionOutcomes: [...pkg.evidenceSummary.criterionOutcomes].sort((a, b) =>
        a.criterionId.localeCompare(b.criterionId)
      ),
      acceptanceVerdict: pkg.evidenceSummary.acceptanceVerdict
        ? {
            verdict: pkg.evidenceSummary.acceptanceVerdict.verdict ?? null,
            reasons: [...(pkg.evidenceSummary.acceptanceVerdict.reasons ?? [])].sort()
          }
        : null,
      findingsSummary: pkg.evidenceSummary.findingsSummary
        ? {
            generationStatus: pkg.evidenceSummary.findingsSummary.generationStatus ?? null,
            totalFindings: pkg.evidenceSummary.findingsSummary.totalFindings,
            byType: pkg.evidenceSummary.findingsSummary.byType,
            byClassification: pkg.evidenceSummary.findingsSummary.byClassification,
            totalDefectCandidates: pkg.evidenceSummary.findingsSummary.totalDefectCandidates
          }
        : null,
      dataQualityAndIntegrity: pkg.evidenceSummary.dataQualityAndIntegrity
    }
  };
}

/**
 * Recomputes and verifies the cryptographic digest of a PerformanceEvidencePackage.
 */
export function verifyPerformanceEvidencePackageDigest(
  pkg: PerformanceEvidencePackage
): VerifyPerformanceEvidencePackageDigestResult {
  if (!pkg) {
    return {
      isValid: false,
      recomputedDigest: '',
      error: 'Evidence package is null or undefined.'
    };
  }

  if (!pkg.packageDigest) {
    return {
      isValid: false,
      recomputedDigest: '',
      error: 'Evidence package missing packageDigest object.'
    };
  }

  if (pkg.packageDigest.algorithm !== 'SHA-256') {
    return {
      isValid: false,
      recomputedDigest: '',
      expectedDigest: pkg.packageDigest.value,
      error: `Unsupported digest algorithm: '${pkg.packageDigest.algorithm}'. Expected 'SHA-256'.`
    };
  }

  if (pkg.packageDigest.schemaVersion !== 'performance-evidence-package-v1') {
    return {
      isValid: false,
      recomputedDigest: '',
      expectedDigest: pkg.packageDigest.value,
      error: `Unsupported digest schemaVersion: '${pkg.packageDigest.schemaVersion}'. Expected 'performance-evidence-package-v1'.`
    };
  }

  try {
    const payload = buildEvidencePackageDigestPayload(pkg);
    const recomputed = computeEvidencePackageDigest(payload).value;

    if (recomputed !== pkg.packageDigest.value) {
      return {
        isValid: false,
        recomputedDigest: recomputed,
        expectedDigest: pkg.packageDigest.value,
        error: `Evidence package digest mismatch: recomputed '${recomputed}' does not match stored '${pkg.packageDigest.value}'.`
      };
    }

    const expectedId = `pep-${recomputed.slice(0, 16)}`;
    if (pkg.id && pkg.id !== expectedId) {
      return {
        isValid: false,
        recomputedDigest: recomputed,
        expectedDigest: pkg.packageDigest.value,
        error: `Evidence package ID mismatch: '${pkg.id}' does not match expected '${expectedId}'.`
      };
    }

    return {
      isValid: true,
      recomputedDigest: recomputed,
      expectedDigest: pkg.packageDigest.value
    };
  } catch (err) {
    return {
      isValid: false,
      recomputedDigest: '',
      expectedDigest: pkg.packageDigest.value,
      error: `Failed to recompute evidence package digest: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/**
 * Generates a canonical Performance Evidence Package (M4.1).
 * Assembles the full source-to-result chain into a deterministic, tamper-evident audit manifest.
 */
export function generatePerformanceEvidencePackage(
  input: GeneratePerformanceEvidencePackageInput
): PerformanceEvidencePackage {
  const {
    contract,
    testDefinition,
    results,
    acceptanceEvaluation,
    findingsRegister,
    strategy,
    testPlan,
    generationTimestamp
  } = input;

  const generationIssues: string[] = [];
  let packageGenerationStatus: EvidencePackageGenerationStatus = 'VALID';

  const generatedAt =
    generationTimestamp ??
    results?.run?.timestamps?.completedAt ??
    acceptanceEvaluation?.evaluatedAt ??
    undefined;

  // -------------------------------------------------------------------------
  // 1. Upstream Cryptographic Integrity Verification (§4)
  // -------------------------------------------------------------------------

  // 1a. Verify Acceptance Evaluation
  if (!acceptanceEvaluation) {
    generationIssues.push('Acceptance evaluation is missing.');
    packageGenerationStatus = 'INVALID_ACCEPTANCE_INTEGRITY';
  } else {
    if (!acceptanceEvaluation.id || !acceptanceEvaluation.evaluationDigest?.value) {
      generationIssues.push('Acceptance evaluation is missing required id or digest.');
      packageGenerationStatus = 'INVALID_ACCEPTANCE_INTEGRITY';
    }
    if (!acceptanceEvaluation.overallVerdict) {
      generationIssues.push('Acceptance evaluation is missing required overallVerdict.');
      packageGenerationStatus = 'INVALID_ACCEPTANCE_INTEGRITY';
    }
    const acceptanceVerification = verifyAcceptanceEvaluationDigest(acceptanceEvaluation);
    if (!acceptanceVerification.isValid) {
      const errorMsg =
        acceptanceVerification.error ?? 'Acceptance evaluation digest verification failed.';
      generationIssues.push(errorMsg);
      packageGenerationStatus = 'INVALID_ACCEPTANCE_INTEGRITY';
    }
  }

  // 1b. Verify Findings Register & Individual Findings/Defect Candidates
  if (!findingsRegister) {
    generationIssues.push('Findings register is missing.');
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_FINDINGS_INTEGRITY';
    }
  } else {
    if (!findingsRegister.id || !findingsRegister.registerDigest?.value) {
      generationIssues.push('Findings register is missing required id or digest.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_FINDINGS_INTEGRITY';
      }
    }
    if (!findingsRegister.generationStatus) {
      generationIssues.push('Findings register is missing required generationStatus.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_FINDINGS_INTEGRITY';
      }
    }
    const findingsVerification = verifyFindingsRegisterDigest(findingsRegister);
    if (!findingsVerification.isValid) {
      const errorMsg =
        findingsVerification.error ?? 'Findings register digest verification failed.';
      generationIssues.push(errorMsg);
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_FINDINGS_INTEGRITY';
      }
    }

    if (findingsRegister.generationStatus && findingsRegister.generationStatus !== 'VALID') {
      generationIssues.push(
        `Findings register generation status is '${findingsRegister.generationStatus}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus =
          findingsRegister.generationStatus === 'INVALID_ACCEPTANCE_INTEGRITY'
            ? 'INVALID_ACCEPTANCE_INTEGRITY'
            : 'INVALID_FINDINGS_INTEGRITY';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Full Source Provenance Verification (§5)
  // -------------------------------------------------------------------------

  // 2a. Performance Contract Provenance
  const computedContractFingerprint = contract ? computeContractFingerprint(contract) : undefined;

  if (!contract) {
    generationIssues.push('Performance Contract is missing.');
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_PROVENANCE';
    }
  } else {
    if (!contract.id) {
      generationIssues.push('Performance Contract is missing required ID.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!contract.version) {
      generationIssues.push('Performance Contract is missing required version.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!computedContractFingerprint) {
      generationIssues.push('Performance Contract is missing computable fingerprint.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!contract.engineeringIntent) {
      generationIssues.push('Performance Contract is missing required engineeringIntent.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (contract.status !== 'APPROVED') {
      generationIssues.push(
        `Performance Contract '${contract.id}' is in '${contract.status}' status (must be 'APPROVED').`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.sourceContract?.fingerprint &&
      acceptanceEvaluation.sourceContract.fingerprint !== computedContractFingerprint
    ) {
      generationIssues.push(
        `Contract fingerprint '${computedContractFingerprint}' does not match Acceptance sourceContract fingerprint '${acceptanceEvaluation.sourceContract.fingerprint}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      results?.run?.sourceContract?.fingerprint &&
      results.run.sourceContract.fingerprint !== computedContractFingerprint
    ) {
      generationIssues.push(
        `Contract fingerprint '${computedContractFingerprint}' does not match Results sourceContract fingerprint '${results.run.sourceContract.fingerprint}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      testDefinition?.sourceContractFingerprint &&
      testDefinition.sourceContractFingerprint !== computedContractFingerprint
    ) {
      generationIssues.push(
        `Contract fingerprint '${computedContractFingerprint}' does not match Test Definition sourceContractFingerprint '${testDefinition.sourceContractFingerprint}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.sourceContract?.id &&
      acceptanceEvaluation.sourceContract.id !== contract.id
    ) {
      generationIssues.push(
        `Contract ID '${contract.id}' does not match Acceptance sourceContract ID '${acceptanceEvaluation.sourceContract.id}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      results?.run?.sourceContract?.id &&
      results.run.sourceContract.id !== contract.id
    ) {
      generationIssues.push(
        `Contract ID '${contract.id}' does not match Results sourceContract ID '${results.run.sourceContract.id}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      testDefinition?.sourceContractId &&
      testDefinition.sourceContractId !== contract.id
    ) {
      generationIssues.push(
        `Contract ID '${contract.id}' does not match Test Definition sourceContractId '${testDefinition.sourceContractId}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.sourceContract?.version &&
      String(acceptanceEvaluation.sourceContract.version) !== String(contract.version)
    ) {
      generationIssues.push(
        `Contract version '${contract.version}' does not match Acceptance sourceContract version '${acceptanceEvaluation.sourceContract.version}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      results?.run?.sourceContract?.version &&
      String(results.run.sourceContract.version) !== String(contract.version)
    ) {
      generationIssues.push(
        `Contract version '${contract.version}' does not match Results sourceContract version '${results.run.sourceContract.version}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      testDefinition?.sourceContractVersion &&
      String(testDefinition.sourceContractVersion) !== String(contract.version)
    ) {
      generationIssues.push(
        `Contract version '${contract.version}' does not match Test Definition sourceContractVersion '${testDefinition.sourceContractVersion}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
  }

  // 2b. Test Definition Provenance
  const computedTestDefinitionFingerprint = testDefinition
    ? computeTestDefinitionFingerprint(testDefinition)
    : undefined;

  if (!testDefinition) {
    generationIssues.push('Test Definition is missing.');
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_PROVENANCE';
    }
  } else {
    if (!testDefinition.id) {
      generationIssues.push('Test Definition is missing required ID.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!testDefinition.version) {
      generationIssues.push('Test Definition is missing required version.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!computedTestDefinitionFingerprint) {
      generationIssues.push('Test Definition is missing computable fingerprint.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (
      testDefinition.fingerprint &&
      testDefinition.fingerprint !== computedTestDefinitionFingerprint
    ) {
      generationIssues.push(
        `Test Definition fingerprint '${testDefinition.fingerprint}' does not match recomputed fingerprint '${computedTestDefinitionFingerprint}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.testDefinition?.fingerprint &&
      acceptanceEvaluation.testDefinition.fingerprint !== computedTestDefinitionFingerprint
    ) {
      generationIssues.push(
        `Test Definition fingerprint '${computedTestDefinitionFingerprint}' does not match Acceptance testDefinition fingerprint '${acceptanceEvaluation.testDefinition.fingerprint}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      results?.run?.testDefinition?.fingerprint &&
      results.run.testDefinition.fingerprint !== computedTestDefinitionFingerprint
    ) {
      generationIssues.push(
        `Test Definition fingerprint '${computedTestDefinitionFingerprint}' does not match Results testDefinition fingerprint '${results.run.testDefinition.fingerprint}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.testDefinition?.id &&
      acceptanceEvaluation.testDefinition.id !== testDefinition.id
    ) {
      generationIssues.push(
        `Test Definition ID '${testDefinition.id}' does not match Acceptance testDefinition ID '${acceptanceEvaluation.testDefinition.id}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      results?.run?.testDefinition?.id &&
      results.run.testDefinition.id !== testDefinition.id
    ) {
      generationIssues.push(
        `Test Definition ID '${testDefinition.id}' does not match Results testDefinition ID '${results.run.testDefinition.id}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.testDefinition?.version &&
      String(acceptanceEvaluation.testDefinition.version) !== String(testDefinition.version)
    ) {
      generationIssues.push(
        `Test Definition version '${testDefinition.version}' does not match Acceptance testDefinition version '${acceptanceEvaluation.testDefinition.version}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      results?.run?.testDefinition?.version &&
      String(results.run.testDefinition.version) !== String(testDefinition.version)
    ) {
      generationIssues.push(
        `Test Definition version '${testDefinition.version}' does not match Results testDefinition version '${results.run.testDefinition.version}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
  }

  // 2c. Execution Run Identity & Linkage
  const runId = results?.run?.executionRunId;
  if (!results?.run) {
    generationIssues.push('Execution run metadata is missing from canonical results.');
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_PROVENANCE';
    }
  } else {
    if (!results.run.executionRunId) {
      generationIssues.push('Execution run ID is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!results.run.executionMode) {
      generationIssues.push('Execution run executionMode is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!results.run.operationalStatus) {
      generationIssues.push('Execution run operationalStatus is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!results.run.timestamps?.startedAt) {
      generationIssues.push('Execution run startedAt timestamp is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!results.run.timestamps?.completedAt) {
      generationIssues.push('Execution run completedAt timestamp is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    const commitSha = results.run.repositoryCommitSha ?? results.run.commitSha;
    if (!commitSha) {
      generationIssues.push('Execution run repository/commit SHA is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (!results.run.bundleFingerprint) {
      generationIssues.push('Execution run bundleFingerprint is missing from canonical results.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
    if (
      acceptanceEvaluation?.sourceExecutionRunId &&
      acceptanceEvaluation.sourceExecutionRunId !== runId
    ) {
      generationIssues.push(
        `Execution Run ID '${runId}' does not match Acceptance sourceExecutionRunId '${acceptanceEvaluation.sourceExecutionRunId}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      findingsRegister?.sourceExecutionRunId &&
      findingsRegister.sourceExecutionRunId !== runId
    ) {
      generationIssues.push(
        `Execution Run ID '${runId}' does not match Findings sourceExecutionRunId '${findingsRegister.sourceExecutionRunId}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }

    if (
      acceptanceEvaluation?.canonicalResults?.executionRunId &&
      acceptanceEvaluation.canonicalResults.executionRunId !== runId
    ) {
      generationIssues.push(
        `Execution Run ID '${runId}' does not match Acceptance canonicalResults.executionRunId '${acceptanceEvaluation.canonicalResults.executionRunId}'.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
  }

  // 2d. Findings source Acceptance linkage
  if (
    findingsRegister &&
    acceptanceEvaluation &&
    findingsRegister.sourceAcceptanceEvaluationId !== acceptanceEvaluation.id
  ) {
    generationIssues.push(
      `Findings Register source Acceptance Evaluation ID '${findingsRegister.sourceAcceptanceEvaluationId}' does not match Acceptance Evaluation ID '${acceptanceEvaluation.id}'.`
    );
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_FINDINGS_INTEGRITY';
    }
  }

  if (
    findingsRegister &&
    acceptanceEvaluation &&
    findingsRegister.sourceAcceptanceEvaluationDigest !== acceptanceEvaluation.evaluationDigest?.value
  ) {
    generationIssues.push(
      `Findings Register source Acceptance Evaluation Digest '${findingsRegister.sourceAcceptanceEvaluationDigest}' does not match Acceptance Evaluation Digest '${acceptanceEvaluation.evaluationDigest?.value}'.`
    );
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_FINDINGS_INTEGRITY';
    }
  }

  // 2e. Governed Raw Evidence & Results Integrity (Unified Calculation) (§7, M4.1.1)
  const rawReferences = results?.evidenceInventory?.allReferences ?? [];
  const hasRawReferences = rawReferences.length > 0;
  const missingFiles = rawReferences.filter((r) => r.presenceStatus !== 'PRESENT');
  const allReferencesPresent = hasRawReferences && missingFiles.length === 0;
  const isResultsComplete = results?.dataQuality?.isComplete === true;
  const hasResultsIntegrityErrors = results?.dataQuality?.hasIntegrityErrors === true;
  const fatalIssues = results?.dataQuality?.issues?.filter((i) => i.severity === 'FATAL') ?? [];
  const errorIssues = results?.dataQuality?.issues?.filter((i) => i.severity === 'ERROR') ?? [];
  const hasCredentialLeak = results?.dataQuality?.issues?.some(
    (issue) => issue.code === 'CREDENTIAL_LEAKAGE_DETECTED'
  );

  const isRawEvidenceValid =
    hasRawReferences &&
    allReferencesPresent &&
    isResultsComplete &&
    !hasResultsIntegrityErrors &&
    fatalIssues.length === 0 &&
    !hasCredentialLeak;

  if (!hasRawReferences) {
    generationIssues.push('Raw evidence inventory is missing or contains zero references.');
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INCOMPLETE_REQUIRED_EVIDENCE';
    }
  } else if (missingFiles.length > 0) {
    generationIssues.push(
      `Raw evidence inventory has missing or unverified files: ${missingFiles.map((f) => f.filename).join(', ')}.`
    );
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INCOMPLETE_REQUIRED_EVIDENCE';
    }
  }

  if (results?.dataQuality?.isComplete === false) {
    generationIssues.push('Canonical results data quality marks execution results as incomplete.');
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INCOMPLETE_REQUIRED_EVIDENCE';
    }
  }

  if (hasResultsIntegrityErrors) {
    const errorDetails = [...fatalIssues, ...errorIssues]
      .map((i) => `[${i.code}] ${i.message}`)
      .join('; ');
    generationIssues.push(
      `Canonical results data quality reports integrity errors: ${errorDetails || 'hasIntegrityErrors is true'}.`
    );
    if (packageGenerationStatus === 'VALID') {
      packageGenerationStatus = 'INVALID_RESULTS_INTEGRITY';
    }
  }

  for (const fatal of fatalIssues) {
    if (fatal.code === 'CREDENTIAL_LEAKAGE_DETECTED') {
      generationIssues.push('Credential leakage detected in raw execution evidence.');
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    } else {
      generationIssues.push(`Fatal data quality issue [${fatal.code}]: ${fatal.message}.`);
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_RESULTS_INTEGRITY';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Optional Strategy and Test Plan Artefacts Validation (§6, M4.1.1)
  // -------------------------------------------------------------------------
  let strategyPresence: ComponentPresenceStatus = 'ABSENT';
  let strategyIssues: string[] | undefined;
  let strategyVerified = false;

  if (strategy) {
    if (strategy.status === 'SUPERSEDED') {
      strategyPresence = 'SUPERSEDED';
      strategyIssues = [
        `Performance Strategy '${strategy.id}' is SUPERSEDED and cannot serve as current evidence.`
      ];
      generationIssues.push(...strategyIssues);
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
      strategyVerified = false;
    } else if (strategy.status === 'STALE') {
      strategyPresence = 'STALE';
      strategyIssues = [
        `Performance Strategy '${strategy.id}' is in 'STALE' status.`
      ];
      generationIssues.push(...strategyIssues);
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
      strategyVerified = false;
    } else {
      const strategyContractMatches =
        contract &&
        strategy.sourceContractId === contract.id &&
        String(strategy.sourceContractVersion) === String(contract.version) &&
        computedContractFingerprint &&
        strategy.sourceContractFingerprint === computedContractFingerprint;

      if (strategyContractMatches) {
        strategyPresence = 'PRESENT';
        strategyVerified = true;
      } else {
        strategyPresence = 'STALE';
        strategyIssues = [
          `Performance Strategy '${strategy.id}' source contract (${strategy.sourceContractId} v${strategy.sourceContractVersion} fp:${strategy.sourceContractFingerprint}) does not match current approved Contract (${contract?.id} v${contract?.version} fp:${computedContractFingerprint}).`
        ];
        generationIssues.push(...strategyIssues);
        if (packageGenerationStatus === 'VALID') {
          packageGenerationStatus = 'INVALID_PROVENANCE';
        }
        strategyVerified = false;
      }
    }
  }

  let testPlanPresence: ComponentPresenceStatus = 'ABSENT';
  let testPlanIssues: string[] | undefined;
  let testPlanVerified = false;

  if (testPlan) {
    if (testPlan.status === 'SUPERSEDED') {
      testPlanPresence = 'SUPERSEDED';
      testPlanIssues = [
        `Performance Test Plan '${testPlan.id}' is SUPERSEDED and cannot serve as current evidence.`
      ];
      generationIssues.push(...testPlanIssues);
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
      testPlanVerified = false;
    } else if (testPlan.status === 'STALE') {
      testPlanPresence = 'STALE';
      testPlanIssues = [
        `Performance Test Plan '${testPlan.id}' is in 'STALE' status.`
      ];
      generationIssues.push(...testPlanIssues);
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
      testPlanVerified = false;
    } else {
      const testPlanContractMatches =
        contract &&
        testPlan.sourceContractId === contract.id &&
        String(testPlan.sourceContractVersion) === String(contract.version) &&
        computedContractFingerprint &&
        testPlan.sourceContractFingerprint === computedContractFingerprint;

      if (testPlanContractMatches) {
        testPlanPresence = 'PRESENT';
        testPlanVerified = true;
      } else {
        testPlanPresence = 'STALE';
        testPlanIssues = [
          `Performance Test Plan '${testPlan.id}' source contract (${testPlan.sourceContractId} v${testPlan.sourceContractVersion} fp:${testPlan.sourceContractFingerprint}) does not match current approved Contract (${contract?.id} v${contract?.version} fp:${computedContractFingerprint}).`
        ];
        generationIssues.push(...testPlanIssues);
        if (packageGenerationStatus === 'VALID') {
          packageGenerationStatus = 'INVALID_PROVENANCE';
        }
        testPlanVerified = false;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Component Inventory Assembly (§2, M4.1.1)
  // -------------------------------------------------------------------------
  const rawComponents: EvidencePackageComponentReference[] = [
    {
      componentType: 'PERFORMANCE_CONTRACT',
      canonicalId: contract?.id,
      version: contract?.version,
      fingerprint: computedContractFingerprint,
      status: contract?.status,
      isRequired: true,
      presenceStatus: contract ? 'PRESENT' : 'ABSENT'
    },
    {
      componentType: 'PERFORMANCE_STRATEGY',
      canonicalId: strategy?.id,
      version: strategy?.version,
      sourceContractFingerprint: strategy?.sourceContractFingerprint,
      status: strategy?.status,
      isRequired: false,
      presenceStatus: strategyPresence,
      issues: strategyIssues
    },
    {
      componentType: 'PERFORMANCE_TEST_PLAN',
      canonicalId: testPlan?.id,
      version: testPlan?.version,
      sourceContractFingerprint: testPlan?.sourceContractFingerprint,
      status: testPlan?.status,
      isRequired: false,
      presenceStatus: testPlanPresence,
      issues: testPlanIssues
    },
    {
      componentType: 'TEST_DEFINITION',
      canonicalId: testDefinition?.id,
      version: testDefinition?.version,
      fingerprint: computedTestDefinitionFingerprint,
      status: testDefinition?.status,
      isRequired: true,
      presenceStatus: testDefinition ? 'PRESENT' : 'ABSENT'
    },
    {
      componentType: 'EXECUTION_RUN',
      canonicalId: runId,
      version: results?.run?.repositoryCommitSha ?? results?.run?.commitSha,
      executionBundleFingerprint: results?.run?.bundleFingerprint,
      executionArtifactDigest: results?.run?.executionArtifact?.digest,
      status: results?.run?.operationalStatus,
      isRequired: true,
      presenceStatus: results?.run ? 'PRESENT' : 'ABSENT'
    },
    {
      componentType: 'RAW_EVIDENCE_INVENTORY',
      canonicalId: runId ? `raw-evidence-${runId}` : undefined,
      isRequired: true,
      presenceStatus: isRawEvidenceValid ? 'PRESENT' : 'INVALID',
      status: `${rawReferences.length} files`
    },
    {
      componentType: 'CANONICAL_RESULTS',
      canonicalId: runId ? `results-${runId}` : undefined,
      isRequired: true,
      presenceStatus: results ? 'PRESENT' : 'ABSENT'
    },
    {
      componentType: 'ACCEPTANCE_EVALUATION',
      canonicalId: acceptanceEvaluation?.id,
      version: acceptanceEvaluation?.version,
      digest: acceptanceEvaluation?.evaluationDigest?.value,
      algorithm: acceptanceEvaluation?.evaluationDigest?.algorithm,
      schemaVersion: acceptanceEvaluation?.evaluationDigest?.schemaVersion,
      status: acceptanceEvaluation?.overallVerdict,
      isRequired: true,
      presenceStatus: acceptanceEvaluation ? 'PRESENT' : 'ABSENT'
    },
    {
      componentType: 'FINDINGS_REGISTER',
      canonicalId: findingsRegister?.id,
      digest: findingsRegister?.registerDigest?.value,
      algorithm: findingsRegister?.registerDigest?.algorithm,
      schemaVersion: findingsRegister?.registerDigest?.schemaVersion,
      status: findingsRegister?.generationStatus,
      isRequired: true,
      presenceStatus: findingsRegister ? 'PRESENT' : 'ABSENT'
    }
  ];

  const components = rawComponents.sort((a, b) => {
    if (a.componentType !== b.componentType) {
      return a.componentType.localeCompare(b.componentType);
    }
    return (a.canonicalId || '').localeCompare(b.canonicalId || '');
  });

  for (const comp of components) {
    if (comp.isRequired && comp.presenceStatus === 'PRESENT' && !comp.canonicalId) {
      generationIssues.push(
        `Required component '${comp.componentType}' is present but lacks required canonical identity.`
      );
      if (packageGenerationStatus === 'VALID') {
        packageGenerationStatus = 'INVALID_PROVENANCE';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Raw Evidence Manifest Assembly (§7)
  // -------------------------------------------------------------------------
  const rawEvidenceInventory: RawEvidencePackageItem[] = rawReferences
    .map((ref) => ({
      evidenceType: ref.evidenceType,
      filename: ref.filename,
      presenceStatus: ref.presenceStatus,
      checksum: ref.checksum,
      sizeBytes: ref.sizeBytes,
      sourceLocator: ref.sourceLocator
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));

  // -------------------------------------------------------------------------
  // 6. Evidence Summary Assembly (§8, M4.1.1)
  // -------------------------------------------------------------------------
  const byType: Record<string, number> = {};
  const byClassification: Record<string, number> = {};

  if (findingsRegister?.findings) {
    for (const f of findingsRegister.findings) {
      byType[f.findingType] = (byType[f.findingType] ?? 0) + 1;
      byClassification[f.classification] = (byClassification[f.classification] ?? 0) + 1;
    }
  }

  const criterionOutcomes = (acceptanceEvaluation?.criterionEvaluations ?? []).map((c) => {
    const contractAc = contract?.acceptanceCriteria?.find((ac) => ac.id === c.criterionId);
    return {
      criterionId: c.criterionId,
      key: c.key,
      metric: c.metric,
      target: contractAc?.target,
      canonicalThresholdValue: c.canonicalThresholdValue,
      canonicalUnit: c.canonicalUnit,
      observedValue: c.observedValue,
      observedUnit: c.observedUnit,
      status: c.status,
      rationale: c.deterministicRationale
    };
  });

  // Stage duration fidelity: derive only from explicit governed stage information
  const scenarioSchedule = testDefinition?.scenarios?.[0]?.workloadSchedule;
  const stages = scenarioSchedule?.stages ?? [];

  let rampUpSeconds: number | undefined;
  let steadyStateSeconds: number | undefined;
  let rampDownSeconds: number | undefined;

  for (const st of stages) {
    const desc = (st.description ?? '').toLowerCase();
    if (desc.includes('ramp-up') || desc.includes('ramp up')) {
      rampUpSeconds = st.durationSeconds;
    } else if (desc.includes('steady-state') || desc.includes('steady state') || desc.includes('sustained peak')) {
      steadyStateSeconds = st.durationSeconds;
    } else if (desc.includes('ramp-down') || desc.includes('ramp down') || desc.includes('cooldown')) {
      rampDownSeconds = st.durationSeconds;
    }
  }

  // Workload separation: strictly separate business demand from scheduler demand
  const businessTargetValue =
    testDefinition?.workloadAttainment?.targetValue ??
    results?.acceptanceBasisAttainment?.governedDemand?.targetValue;
  const businessUnit =
    testDefinition?.workloadAttainment?.unit ??
    results?.acceptanceBasisAttainment?.governedDemand?.unit;
  const businessMetric =
    results?.acceptanceBasisAttainment?.governedDemand?.metric ??
    testDefinition?.workloadAttainment?.metric;
  const businessTimeBasis = results?.acceptanceBasisAttainment?.timeBasis;

  const hasBusinessDemand =
    businessTargetValue != null ||
    businessUnit != null ||
    businessMetric != null ||
    businessTimeBasis != null;

  const hasSchedulerDemand =
    scenarioSchedule?.peakArrivalRate != null ||
    scenarioSchedule?.rateUnit != null ||
    scenarioSchedule?.arrivalPopulation != null ||
    scenarioSchedule?.executionModel != null ||
    scenarioSchedule?.startRate != null;

  const workloadDemand: EvidencePackageWorkloadDemand = {
    businessDemand: hasBusinessDemand
      ? {
          targetValue: businessTargetValue,
          unit: businessUnit,
          metric: businessMetric,
          timeBasis: businessTimeBasis
        }
      : undefined,
    schedulerDemand: hasSchedulerDemand
      ? {
          peakArrivalRate: scenarioSchedule?.peakArrivalRate,
          unit: scenarioSchedule?.rateUnit,
          population: scenarioSchedule?.arrivalPopulation,
          executionModel: scenarioSchedule?.executionModel,
          startRate: scenarioSchedule?.startRate
        }
      : undefined,
    profileType: scenarioSchedule?.executionModel,
    totalDurationSeconds: scenarioSchedule?.totalDurationSeconds,
    rampUpSeconds,
    steadyStateSeconds,
    rampDownSeconds
  };

  const evidenceSummary: EvidencePackageSummary = {
    execution: {
      executionRunId: runId,
      executionMode: results?.run?.executionMode,
      operationalStatus: results?.run?.operationalStatus,
      startedAt: results?.run?.timestamps?.startedAt,
      completedAt: results?.run?.timestamps?.completedAt,
      durationSeconds: results?.run?.timestamps?.durationSeconds
    },
    workloadDemand,
    workloadAttainment: acceptanceEvaluation?.workloadPrerequisite
      ? {
          status: acceptanceEvaluation.workloadPrerequisite.status,
          isPrerequisiteMet: acceptanceEvaluation.workloadPrerequisite.isPrerequisiteMet,
          observedValue: acceptanceEvaluation.workloadPrerequisite.observedValue,
          targetValue: acceptanceEvaluation.workloadPrerequisite.targetValue,
          unit: acceptanceEvaluation.workloadPrerequisite.unit,
          derivationStatus: acceptanceEvaluation.workloadPrerequisite.derivationStatus,
          rationale: acceptanceEvaluation.workloadPrerequisite.rationale
        }
      : undefined,
    criterionOutcomes,
    acceptanceVerdict: acceptanceEvaluation?.overallVerdict
      ? {
          verdict: acceptanceEvaluation.overallVerdict,
          reasons: [...(acceptanceEvaluation?.verdictReasons ?? [])],
          evaluatedAt: acceptanceEvaluation?.evaluatedAt
        }
      : undefined,
    findingsSummary: findingsRegister?.generationStatus
      ? {
          generationStatus: findingsRegister.generationStatus,
          totalFindings: findingsRegister?.findings?.length ?? 0,
          byType,
          byClassification,
          totalDefectCandidates: findingsRegister?.defectCandidates?.length ?? 0
        }
      : undefined,
    dataQualityAndIntegrity: {
      provenanceValid: Boolean(acceptanceEvaluation?.provenanceGate?.isValid),
      operationalIntegrityValid: Boolean(acceptanceEvaluation?.operationalIntegrityGate?.isValid),
      rawEvidenceComplete: isRawEvidenceValid,
      governedObservationsCount: acceptanceEvaluation?.governedObservations?.length ?? 0,
      blockingObservationsCount:
        acceptanceEvaluation?.governedObservations?.filter((o) => o.isBlocking)?.length ?? 0
    }
  };

  // -------------------------------------------------------------------------
  // 7. Source-to-Result Lineage Graph (§9, M4.1.1)
  // -------------------------------------------------------------------------
  const lineageEdges: EvidencePackageLineageEdge[] = [];

  if (contract?.id && testDefinition?.id) {
    lineageEdges.push({
      fromComponent: 'PERFORMANCE_CONTRACT',
      fromId: contract.id,
      toComponent: 'TEST_DEFINITION',
      toId: testDefinition.id,
      bindingType: 'SPECIFIES',
      verified: Boolean(
        testDefinition.sourceContractId === contract.id &&
          computedContractFingerprint &&
          testDefinition.sourceContractFingerprint === computedContractFingerprint
      ),
      details: 'Contract specifies workload demand and acceptance criteria for Test Definition.'
    });
  }

  if (strategy?.id && contract?.id) {
    lineageEdges.push({
      fromComponent: 'PERFORMANCE_CONTRACT',
      fromId: contract.id,
      toComponent: 'PERFORMANCE_STRATEGY',
      toId: strategy.id,
      bindingType: 'GOVERNS',
      verified: strategyVerified,
      details: 'Contract governs Performance Strategy architecture and testing approach.'
    });
  }

  if (testPlan?.id && contract?.id) {
    lineageEdges.push({
      fromComponent: 'PERFORMANCE_CONTRACT',
      fromId: contract.id,
      toComponent: 'PERFORMANCE_TEST_PLAN',
      toId: testPlan.id,
      bindingType: 'GOVERNS',
      verified: testPlanVerified,
      details: 'Contract governs Performance Test Plan operational scope.'
    });
  }

  if (testDefinition?.id && runId) {
    lineageEdges.push({
      fromComponent: 'TEST_DEFINITION',
      fromId: testDefinition.id,
      toComponent: 'EXECUTION_RUN',
      toId: runId,
      bindingType: 'PRODUCES',
      verified: Boolean(
        results?.run?.testDefinition?.id === testDefinition.id &&
          computedTestDefinitionFingerprint &&
          results?.run?.testDefinition?.fingerprint === computedTestDefinitionFingerprint
      ),
      details: 'Test Definition compiled and executed in execution run.'
    });
  }

  if (runId) {
    lineageEdges.push({
      fromComponent: 'EXECUTION_RUN',
      fromId: runId,
      toComponent: 'RAW_EVIDENCE_INVENTORY',
      toId: `raw-evidence-${runId}`,
      bindingType: 'CAPTURES',
      verified: isRawEvidenceValid,
      details: 'Execution harness captured raw execution evidence logs and metrics.'
    });

    lineageEdges.push({
      fromComponent: 'RAW_EVIDENCE_INVENTORY',
      fromId: `raw-evidence-${runId}`,
      toComponent: 'CANONICAL_RESULTS',
      toId: `results-${runId}`,
      bindingType: 'PARSES',
      verified: isRawEvidenceValid && Boolean(results?.metrics),
      details: 'Ingestion engine parsed and corroborated canonical results from raw evidence.'
    });
  }

  if (runId && acceptanceEvaluation?.id) {
    lineageEdges.push({
      fromComponent: 'CANONICAL_RESULTS',
      fromId: `results-${runId}`,
      toComponent: 'ACCEPTANCE_EVALUATION',
      toId: acceptanceEvaluation.id,
      bindingType: 'EVALUATES',
      verified: Boolean(
        acceptanceEvaluation.canonicalResults?.executionRunId === runId &&
          acceptanceEvaluation.sourceExecutionRunId === runId
      ),
      details: 'Acceptance engine evaluated criteria and workload against canonical results.'
    });
  }

  if (acceptanceEvaluation?.id && findingsRegister?.id) {
    lineageEdges.push({
      fromComponent: 'ACCEPTANCE_EVALUATION',
      fromId: acceptanceEvaluation.id,
      toComponent: 'FINDINGS_REGISTER',
      toId: findingsRegister.id,
      bindingType: 'REGISTERS',
      verified: Boolean(
        findingsRegister.sourceAcceptanceEvaluationId === acceptanceEvaluation.id &&
          findingsRegister.sourceAcceptanceEvaluationDigest ===
            acceptanceEvaluation.evaluationDigest?.value
      ),
      details: 'Findings engine registered governed findings and defect candidates.'
    });
  }

  const lineage: EvidencePackageLineage = {
    edges: lineageEdges.sort((a, b) => {
      const keyA = `${a.fromComponent}:${a.fromId}->${a.toComponent}:${a.toId}`;
      const keyB = `${b.fromComponent}:${b.fromId}->${b.toComponent}:${b.toId}`;
      return keyA.localeCompare(keyB);
    })
  };

  // -------------------------------------------------------------------------
  // 8. Cryptographic Package Digest & Package Identity (§11, §12)
  // -------------------------------------------------------------------------
  const digestPayload = buildEvidencePackageDigestPayload({
    packageGenerationStatus,
    generationIssues,
    projectId: contract?.projectId,
    projectName: contract?.projectName,
    engineeringIntent: contract?.engineeringIntent,
    sourceExecutionRunId: runId,
    sourceContract: {
      id: contract?.id,
      version: contract?.version,
      fingerprint: computedContractFingerprint,
      status: contract?.status
    },
    sourceTestDefinition: {
      id: testDefinition?.id,
      version: testDefinition?.version,
      fingerprint: computedTestDefinitionFingerprint
    },
    acceptanceEvaluation: {
      id: acceptanceEvaluation?.id,
      digest: acceptanceEvaluation?.evaluationDigest?.value,
      overallVerdict: acceptanceEvaluation?.overallVerdict
    },
    findingsRegister: {
      id: findingsRegister?.id,
      digest: findingsRegister?.registerDigest?.value,
      generationStatus: findingsRegister?.generationStatus,
      totalFindings: findingsRegister?.findings?.length ?? 0,
      totalDefectCandidates: findingsRegister?.defectCandidates?.length ?? 0
    },
    components,
    rawEvidenceInventory,
    evidenceSummary,
    lineage
  });

  const packageDigest = computeEvidencePackageDigest(digestPayload);
  const packageId = `pep-${packageDigest.value.slice(0, 16)}`;

  const packageObject: PerformanceEvidencePackage = {
    id: packageId,
    schemaVersion: 'performance-evidence-package-v1',
    projectId: contract?.projectId,
    projectName: contract?.projectName,
    engineeringIntent: contract?.engineeringIntent,
    sourceExecutionRunId: runId,
    sourceContract: {
      id: contract?.id,
      version: contract?.version,
      fingerprint: computedContractFingerprint,
      status: contract?.status
    },
    sourceTestDefinition: {
      id: testDefinition?.id,
      version: testDefinition?.version,
      fingerprint: computedTestDefinitionFingerprint
    },
    acceptanceEvaluation: {
      id: acceptanceEvaluation?.id,
      digest: acceptanceEvaluation?.evaluationDigest?.value,
      overallVerdict: acceptanceEvaluation?.overallVerdict,
      evaluatedAt: acceptanceEvaluation?.evaluatedAt
    },
    findingsRegister: {
      id: findingsRegister?.id,
      digest: findingsRegister?.registerDigest?.value,
      generationStatus: findingsRegister?.generationStatus,
      totalFindings: findingsRegister?.findings?.length ?? 0,
      totalDefectCandidates: findingsRegister?.defectCandidates?.length ?? 0
    },
    packageGenerationStatus,
    generationIssues,
    components,
    rawEvidenceInventory,
    evidenceSummary,
    lineage,
    packageDigest,
    generatedAt
  };

  // Deep freeze newly generated package without mutating caller inputs (§13)
  return deepFreeze(packageObject);
}
