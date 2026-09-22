import { TestDefinition, K6ExecutionBundle, AcceptanceEvaluationDigest } from '@pecp/pe-domain';

/**
 * Standard FIPS 180-4 SHA-256 implementation in pure TypeScript.
 * Browser, Node.js, and edge runtime compatible without external dependencies.
 */
function sha256Hex(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);

  // Encode UTF-8
  const utf8Bytes: number[] = [];
  for (let c = 0; c < ascii.length; c++) {
    let code = ascii.charCodeAt(c);
    if (code < 0x80) {
      utf8Bytes.push(code);
    } else if (code < 0x800) {
      utf8Bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      utf8Bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      c++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (ascii.charCodeAt(c) & 0x3ff));
      utf8Bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }

  const bitLength = utf8Bytes.length * 8;
  utf8Bytes.push(0x80);
  while ((utf8Bytes.length % 64) !== 56) {
    utf8Bytes.push(0);
  }

  const hi = Math.floor(bitLength / 0x100000000);
  const lo = bitLength >>> 0;
  utf8Bytes.push(
    (hi >>> 24) & 0xff,
    (hi >>> 16) & 0xff,
    (hi >>> 8) & 0xff,
    hi & 0xff,
    (lo >>> 24) & 0xff,
    (lo >>> 16) & 0xff,
    (lo >>> 8) & 0xff,
    lo & 0xff
  );

  for (i = 0; i < utf8Bytes.length; i += 4) {
    words.push(
      (utf8Bytes[i] << 24) |
      (utf8Bytes[i + 1] << 16) |
      (utf8Bytes[i + 2] << 8) |
      utf8Bytes[i + 3]
    );
  }

  const w = new Array(64);
  for (i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e, f, g, h] = hash;

    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j];
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, '0');
  }

  return result;
}

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

/**
 * Computes deterministic SHA-256 cryptographic digest of normalized acceptance evaluation content.
 * Adheres to M3.3.2 acceptance-evaluation-v1 schema without wall-clock timestamps.
 */
export function computeAcceptanceEvaluationDigest(payload: unknown): AcceptanceEvaluationDigest {
  const canonicalJson = JSON.stringify(payload);
  const hash = sha256Hex(canonicalJson);
  return {
    algorithm: 'SHA-256',
    schemaVersion: 'acceptance-evaluation-v1',
    value: hash
  };
}
