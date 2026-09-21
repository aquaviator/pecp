import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Resolves the path to the immutable authoritative M3.1B artifact fixture directory.
 */
export function getAuthoritativeFixtureDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical'),
    path.resolve(process.cwd(), '../../packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical'),
    path.resolve(__dirname, '../../../../../packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical'),
    path.resolve(__dirname, '../../../../packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(process.cwd(), 'packages/test-engine/fixtures/authoritative-m3-1b-run-35577599469/canonical');
}

const fixtureDir = getAuthoritativeFixtureDir();

// Load actual raw bytes from the authoritative M3.1B GitHub Actions artifact
export const AUTHORITATIVE_MANIFEST_RAW = fs.readFileSync(path.join(fixtureDir, 'execution-manifest.json'), 'utf8');
export const AUTHORITATIVE_SUMMARY_RAW = fs.readFileSync(path.join(fixtureDir, 'summary.json'), 'utf8');
export const AUTHORITATIVE_CONFIG_RAW = fs.readFileSync(path.join(fixtureDir, 'config.json'), 'utf8');
export const AUTHORITATIVE_JOURNEYS_RAW = fs.readFileSync(path.join(fixtureDir, 'journeys.js'), 'utf8');
export const AUTHORITATIVE_ENTRYPOINT_RAW = fs.readFileSync(path.join(fixtureDir, 'entrypoint.js'), 'utf8');
export const AUTHORITATIVE_RUNTIME_RAW = fs.readFileSync(path.join(fixtureDir, 'runtime.js'), 'utf8');
export const AUTHORITATIVE_STDOUT_RAW = fs.readFileSync(path.join(fixtureDir, 'k6-stdout.log'), 'utf8');
export const AUTHORITATIVE_STDERR_RAW = fs.readFileSync(path.join(fixtureDir, 'k6-stderr.log'), 'utf8');

// Parse JSON payloads
export const AUTHORITATIVE_M3_1B_MANIFEST = JSON.parse(AUTHORITATIVE_MANIFEST_RAW);
export const AUTHORITATIVE_M3_1B_SUMMARY_JSON = JSON.parse(AUTHORITATIVE_SUMMARY_RAW);

// Compute verified checksums
export const AUTHORITATIVE_CONFIG_CHECKSUM = computeSha256(AUTHORITATIVE_CONFIG_RAW);
export const AUTHORITATIVE_JOURNEYS_CHECKSUM = computeSha256(AUTHORITATIVE_JOURNEYS_RAW);
export const AUTHORITATIVE_ENTRYPOINT_CHECKSUM = computeSha256(AUTHORITATIVE_ENTRYPOINT_RAW);
export const AUTHORITATIVE_RUNTIME_CHECKSUM = computeSha256(AUTHORITATIVE_RUNTIME_RAW);
export const AUTHORITATIVE_STDOUT_CHECKSUM = computeSha256(AUTHORITATIVE_STDOUT_RAW);
export const AUTHORITATIVE_STDERR_CHECKSUM = computeSha256(AUTHORITATIVE_STDERR_RAW);
export const AUTHORITATIVE_SUMMARY_CHECKSUM = computeSha256(AUTHORITATIVE_SUMMARY_RAW);
export const AUTHORITATIVE_MANIFEST_CHECKSUM = computeSha256(AUTHORITATIVE_MANIFEST_RAW);

// Aliases for compatibility
export const MOCK_CONFIG_CONTENT = AUTHORITATIVE_CONFIG_RAW;
export const MOCK_JOURNEYS_CONTENT = AUTHORITATIVE_JOURNEYS_RAW;
export const MOCK_ENTRYPOINT_CONTENT = AUTHORITATIVE_ENTRYPOINT_RAW;
export const MOCK_RUNTIME_CONTENT = AUTHORITATIVE_RUNTIME_RAW;
export const MOCK_STDOUT_CONTENT = AUTHORITATIVE_STDOUT_RAW;
export const MOCK_STDERR_CONTENT = AUTHORITATIVE_STDERR_RAW;
export const MOCK_SUMMARY_CONTENT = AUTHORITATIVE_SUMMARY_RAW;

export const AUTHORITATIVE_M3_1B_FACTS = {
  workflowRunId: '35577599469',
  repositoryCommitSha: '76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82',
  k6Version: '0.54.0',
  durationSeconds: 1321.161,
  durationMs: 1321161.0,
  iterations: 120981,
  iterationRate: 91.58921038617193,
  droppedIterations: 8,
  businessEvents: 9671,
  businessEventRate: 7.321474063238597,
  referenceLabOrderCreated: 9671,
  referenceLabTotalRequests: 120982,
  artifactId: '10629771462',
  artifactDigest: '0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91',
  artifactName: 'm3-1b-evidence-canonical-35577599469',
  runId: 'pecp-ref-canonical-1789978991064',
  expectedPerformanceVerdict: 'PECP_PERFORMANCE_VERDICT_NOT_EVALUATED'
} as const;

export const AUTHORITATIVE_M3_1B_ARTIFACT_REFERENCE = {
  id: AUTHORITATIVE_M3_1B_FACTS.artifactId,
  name: AUTHORITATIVE_M3_1B_FACTS.artifactName,
  digest: AUTHORITATIVE_M3_1B_FACTS.artifactDigest,
  retentionExpiresAt: '2026-12-20'
};
