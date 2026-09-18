import { TestDefinition, K6ExecutionBundle } from '@pecp/pe-domain';

/**
 * Deterministic, non-cryptographic FNV-1a 32-bit checksum for drift detection.
 * NOTE: This is an environment-agnostic drift checksum, NOT a cryptographic hash or signature.
 */
export function computeStringChecksum(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Computes deterministic non-cryptographic drift checksum of a TestDefinition.
 */
export function computeTestDefinitionFingerprint(def: Omit<TestDefinition, 'fingerprint'>): string {
  const digestPayload = {
    id: def.id,
    version: def.version,
    status: def.status,
    sourceContractId: def.sourceContractId,
    sourceContractVersion: def.sourceContractVersion,
    sourceContractFingerprint: def.sourceContractFingerprint,
    sourceContractStatus: def.sourceContractStatus,
    scenarios: def.scenarios.map((s) => ({
      id: s.id,
      schedule: {
        model: s.workloadSchedule.executionModel,
        stages: s.workloadSchedule.stages,
        totalDuration: s.workloadSchedule.totalDurationSeconds,
        peakRate: s.workloadSchedule.peakArrivalRate
      },
      attainment: s.attainmentRequirement
    })),
    journeys: def.journeys.map((j) => ({
      id: j.id,
      key: j.key,
      weight: j.weight,
      steps: j.steps.map((st) => ({ id: st.id, method: st.method, path: st.path }))
    })),
    executableCriteria: def.executableCriteria.map((c) => ({
      id: c.id,
      metric: c.metric,
      target: c.target,
      status: c.status
    })),
    ambiguousCriteria: def.ambiguousCriteria.map((c) => ({
      id: c.id,
      metric: c.metric,
      target: c.target,
      status: c.status
    })),
    isExecutable: def.isExecutable,
    blockingReasons: def.blockingReasons
  };

  return computeStringChecksum(JSON.stringify(digestPayload));
}

/**
 * Computes deterministic non-cryptographic drift checksum of a K6ExecutionBundle.
 */
export function computeBundleFingerprint(bundle: Omit<K6ExecutionBundle, 'fingerprint'>): string {
  const digestPayload = {
    id: bundle.id,
    testDefinitionId: bundle.testDefinitionId,
    testDefinitionVersion: bundle.testDefinitionVersion,
    testDefinitionFingerprint: bundle.testDefinitionFingerprint,
    isExecutable: bundle.isExecutable,
    options: bundle.options,
    fileHashes: bundle.files.map((f) => ({
      filename: f.filename,
      checksum: computeStringChecksum(f.content)
    }))
  };

  return computeStringChecksum(JSON.stringify(digestPayload));
}
