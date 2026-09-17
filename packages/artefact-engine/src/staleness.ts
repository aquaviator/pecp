import {
  PerformanceContract,
  EngineeringArtefact,
  ArtefactStalenessResult,
  computeContractFingerprint
} from '@pecp/pe-domain';

export { computeContractFingerprint };

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
