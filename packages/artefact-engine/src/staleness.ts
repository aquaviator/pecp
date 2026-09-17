import {
  PerformanceContract,
  EngineeringArtefact,
  ArtefactStalenessResult
} from '@pecp/pe-domain';

/**
 * Computes a deterministic, non-cryptographic drift checksum/fingerprint of a Performance Contract.
 * Detects structural or value drift in calculations, criteria, readiness, or issues.
 * Uses 32-bit FNV-1a for lightweight, environment-agnostic drift detection.
 * NOTE: This is a deterministic drift checksum, NOT a cryptographic hash or signature.
 */
export function computeContractFingerprint(contract: PerformanceContract): string {
  const digestPayload = {
    id: contract.id,
    version: contract.version,
    status: contract.status,
    intent: contract.engineeringIntent,
    calculations: contract.workloadCalculations.map((c) => ({
      id: c.calculationId,
      param: c.outputParameter,
      value: c.outputValue,
      unit: c.unit
    })),
    blockedCalculations: contract.blockedWorkloadCalculations.map((bc) => ({
      id: bc.calculationId,
      param: bc.outputParameter,
      reason: bc.reason
    })),
    criteria: contract.acceptanceCriteria.map((ac) => ({
      id: ac.id,
      metric: ac.metric,
      target: ac.target,
      status: ac.status,
      percentile: ac.percentile
    })),
    issues: contract.unresolvedIssues.map((issue) => ({
      id: issue.id,
      type: issue.type,
      severity: issue.severity
    })),
    canApprove: contract.approvalReadiness.canApprove
  };

  const str = JSON.stringify(digestPayload);
  // FNV-1a 32-bit hash implementation
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Pure function evaluating whether an existing engineering artefact is stale
 * relative to the current live Performance Contract.
 */
export function evaluateArtefactStaleness(
  artefact: EngineeringArtefact,
  currentContract: PerformanceContract
): ArtefactStalenessResult {
  const currentFingerprint = computeContractFingerprint(currentContract);
  const reasons: string[] = [];

  if (artefact.sourceContractId !== currentContract.id) {
    reasons.push(
      `Source Performance Contract ID changed from "${artefact.sourceContractId}" to "${currentContract.id}".`
    );
  }

  if (artefact.sourceContractVersion !== currentContract.version) {
    reasons.push(
      `Source Performance Contract version evolved from "${artefact.sourceContractVersion}" to "${currentContract.version}".`
    );
  }

  if (
    artefact.sourceContractFingerprint &&
    artefact.sourceContractFingerprint !== currentFingerprint
  ) {
    reasons.push(
      'Upstream Performance Contract content, calculations, or readiness state changed since artefact generation.'
    );
  }

  return {
    isStale: reasons.length > 0,
    reasons,
    currentContractVersion: currentContract.version,
    artefactContractVersion: artefact.sourceContractVersion,
    currentContractFingerprint: currentFingerprint,
    artefactContractFingerprint: artefact.sourceContractFingerprint
  };
}

/**
 * Returns a new artefact instance marked as STALE if upstream contract changed.
 * Does not mutate the original object, and preserves all generated contents and audit notes.
 */
export function checkAndTagArtefactStaleness(
  artefact: EngineeringArtefact,
  currentContract: PerformanceContract
): EngineeringArtefact {
  const staleness = evaluateArtefactStaleness(artefact, currentContract);
  if (!staleness.isStale) {
    return artefact;
  }

  // If already STALE or SUPERSEDED, keep status
  if (artefact.status === 'STALE' || artefact.status === 'SUPERSEDED') {
    return artefact;
  }

  return {
    ...artefact,
    status: 'STALE',
    approvalReadiness: {
      ...artefact.approvalReadiness,
      canApprove: false,
      status: 'STALE',
      blockingReasons: [
        ...artefact.approvalReadiness.blockingReasons,
        ...staleness.reasons
      ],
      unresolvedIssuesCount: artefact.approvalReadiness.unresolvedIssuesCount + staleness.reasons.length
    }
  };
}
