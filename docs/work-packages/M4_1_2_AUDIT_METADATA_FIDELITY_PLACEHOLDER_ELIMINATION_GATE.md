# Work Package: M4.1.2 — Audit Metadata Fidelity & Placeholder Elimination Gate

## Objective

Remove the final audit-facing invented values from M4.1 so both VALID and invalid Performance Evidence Packages contain only source-backed facts.

This is the final M4.1 closure gate.

Read:

- `docs/M4_1_1_PM_REVIEW.md`;
- `docs/work-packages/M4_1_1_EVIDENCE_PACKAGE_SEMANTIC_INTEGRITY_ZERO_INVENTION_GATE.md`;
- `docs/work-packages/M4_1_CANONICAL_PERFORMANCE_EVIDENCE_PACKAGE.md`;
- `docs/M4_0_CLOSURE.md`.

Do not render PDF/DOCX/HTML.
Do not publish externally.
Do not perform release certification.
Do not run k6.

## 1. Remove all literal provenance placeholders

No package field or lineage identity may use fabricated values such as:

- `unknown`;
- empty string as a missing canonical ID.

Refactor domain optionality for invalid-package outputs where required.

For missing endpoint IDs:

- omit the lineage edge, or
- model an explicit missing binding issue without creating a fake node ID.

A VALID package must have all required identities.

## 2. Preserve exact execution metadata

Do not default:

- executionMode -> CANONICAL;
- operationalStatus -> UNKNOWN;
- executionRunId -> empty string.

A VALID package requires source-backed execution metadata.

At minimum validate presence of:

- executionRunId;
- executionMode;
- operationalStatus;
- startedAt;
- completedAt;
- repositoryCommitSha / commitSha according to canonical Results requirements;
- bundleFingerprint where required by execution provenance.

Missing required execution metadata => INVALID_PROVENANCE or INCOMPLETE_REQUIRED_EVIDENCE with a specific issue.

The package may represent failed/blocked executions. Do not require EXECUTION_COMPLETED unless a separate package type later demands it.

## 3. Eliminate missing-Acceptance summary synthesis

For malformed/missing Acceptance input:

- do not synthesize workload status INVALID;
- do not synthesize isPrerequisiteMet=false;
- do not synthesize empty rationale;
- do not synthesize an Acceptance verdict.

Update `EvidencePackageSummary` invalid-package optionality where needed.

If the source Acceptance genuinely says workload status INVALID, preserve INVALID exactly.

## 4. Preserve canonical Test Definition status

Replace the invented component status:

`ACTIVE`

with the exact:

`testDefinition.status`.

Add tests using at least two legitimate Test Definition statuses to prove no rewriting occurs.

## 5. Remove invented Canonical Results status

Do not set:

`CANONICAL_RESULTS.status = 'INGESTED'`

unless the canonical Results model later defines that status.

For M4.1.2 leave Results component status absent.

Package generation status and data-quality state already describe validity separately.

## 6. Validate required identities before VALID status

A package may only remain VALID when all required components have the source identities needed for the audit chain.

Check required component identity for:

- Performance Contract;
- Test Definition;
- Execution Run;
- Raw Evidence Inventory;
- Canonical Results run binding;
- Acceptance Evaluation;
- Findings Register.

A PRESENT component without its required identity must not silently remain valid.

## 7. Deterministic invalid-package output

Invalid input must still produce a deterministic package manifest.

Rules:

- include available factual source fields only;
- preserve specific generation issues;
- omit unavailable semantic fields;
- compute package SHA-256 over this normalized invalid representation;
- derive package ID from digest;
- no wall-clock values in digest.

## 8. Tests

Add explicit regressions for:

- no literal `unknown` anywhere in generated package JSON;
- no empty string used as missing execution identity;
- missing executionMode -> invalid package, no CANONICAL substitution;
- missing operationalStatus -> invalid package, no UNKNOWN substitution;
- missing run ID -> invalid package, no fabricated lineage node;
- missing Acceptance workload prerequisite fields do not synthesize INVALID/false/empty rationale;
- genuine Acceptance workload status INVALID remains INVALID;
- Test Definition READY_FOR_EXECUTION status preserved;
- Test Definition APPROVED status preserved where fixture permits;
- CANONICAL_RESULTS status absent;
- valid RetailCo package contains no placeholder values;
- invalid package remains deterministic across repeated generation;
- caller-supplied generation timestamp still does not affect digest/id;
- authoritative RetailCo remains VALID + INCONCLUSIVE + one finding + zero defects.

## 9. Authoritative RetailCo invariant

The final valid package must continue to preserve:

- Contract and Test Definition exact authority;
- execution run identity;
- business demand 8.75 orders/second;
- scheduler demand 109.375 journey_iterations/second;
- ramp-up 300s;
- steady-state 900s;
- ramp-down 120s;
- total 1320s;
- Checkout PASS at 0.3906885 ms against p95 < 2000ms;
- Error Rate PASS at 0 against rate < 0.005;
- Acceptance INCONCLUSIVE;
- one WORKLOAD_ATTAINMENT_UNRESOLVED finding;
- zero Defect Candidates;
- package status VALID;
- stable SHA-256 package digest/id.

## Definition of Done

M4.1.2 is complete when:

1. no literal provenance placeholders remain;
2. execution metadata is source-faithful with no CANONICAL/UNKNOWN defaults;
3. missing Acceptance state is not synthesized;
4. Test Definition status is canonical;
5. Canonical Results has no invented lifecycle status;
6. VALID requires complete required audit identities;
7. invalid package output is deterministic and zero-invention;
8. authoritative RetailCo remains unchanged;
9. normal CI is green.

Stop and provide an M4.1.2 completion report for PM audit.
