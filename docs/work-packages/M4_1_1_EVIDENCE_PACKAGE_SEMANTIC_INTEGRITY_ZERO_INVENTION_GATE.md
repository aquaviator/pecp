# Work Package: M4.1.1 — Evidence Package Semantic Integrity & Zero-Invention Gate

## Objective

Harden the M4.1 Performance Evidence Package so every summary field, component reference and lineage edge preserves the exact semantics of its governed source.

This gate corrects business-vs-scheduler workload semantics, stage-duration fidelity, Results integrity propagation, lineage verification, component identity and remaining zero-invention fallbacks.

Read:

- `docs/M4_1_PM_REVIEW.md`;
- `docs/work-packages/M4_1_CANONICAL_PERFORMANCE_EVIDENCE_PACKAGE.md`;
- `docs/M4_0_CLOSURE.md`;
- `docs/M3_3_CLOSURE.md`;
- M3.2 Results domain and M3.0.3 population/attainment semantics.

Do not render PDF/DOCX/HTML.
Do not publish externally.
Do not create Jira/ADO tickets.
Do not perform release certification.
Do not rerun k6.

## 1. Separate business workload demand from scheduler demand

Refactor `EvidencePackageSummary.workloadDemand`.

Do not use a field named `targetRps` for business throughput.

Recommended structure:

### businessDemand

- targetValue?;
- unit?;
- metric/key where governed;
- timeBasis where available.

### schedulerDemand

- peakArrivalRate?;
- unit?;
- population?;
- executionModel?;
- startRate?.

Use source values only.

For authoritative RetailCo preserve:

- business demand = 8.75 orders/second;
- scheduler demand = 109.375 journey_iterations/second;
- scheduler population = JOURNEY_ITERATION;
- execution model = OPEN.

Never substitute one population for the other.

## 2. Correct stage-duration semantics

Do not assign total duration to steady-state duration.

Represent at minimum:

- totalDurationSeconds;
- rampUpSeconds when governed;
- steadyStateSeconds when governed;
- rampDownSeconds when governed.

For RetailCo the exact values are:

- ramp-up = 300;
- steady-state = 900;
- ramp-down = 120;
- total = 1320.

Derive semantic stage roles only from explicit governed stage information.

The current fixture descriptions explicitly identify Ramp-up, Steady-state peak and Ramp-down.

If a generic schedule does not make stage role deterministically identifiable, leave the semantic duration absent and preserve the raw stages separately if needed.

Do not infer "middle stage = steady state" as a universal rule without an explicit v1 policy documented/tested.

## 3. Propagate canonical Results integrity into package validity

Inspect M3.2 `results.dataQuality`.

A VALID package requires at minimum:

- required raw evidence complete;
- `hasIntegrityErrors === false`;
- no fatal governed data-quality issue;
- no credential leakage.

Add package generation status:

`INVALID_RESULTS_INTEGRITY`

if useful to distinguish this condition.

Bind the status and exact governed issues into package digest.

Do not hide a Results integrity failure behind present evidence files.

## 4. Use one governed raw-evidence validity calculation

Calculate a single internal raw-evidence validity result and reuse it for:

- package generation status;
- RAW_EVIDENCE_INVENTORY component presence;
- evidenceSummary.dataQualityAndIntegrity.rawEvidenceComplete;
- EXECUTION_RUN -> RAW_EVIDENCE_INVENTORY lineage verification;
- RAW_EVIDENCE_INVENTORY -> CANONICAL_RESULTS lineage verification.

At minimum require:

- non-empty inventory;
- all required references PRESENT;
- Results completeness true;
- no Results integrity errors.

Do not set lineage `verified: true` from `rawReferences.length > 0` alone.

## 5. Correct CANONICAL_RESULTS component identity

Do not label either:

- execution artifact digest;
- execution bundle fingerprint;

as a fingerprint/digest of `CANONICAL_RESULTS`.

For M4.1.1 either:

A. leave the canonical Results component fingerprint/digest absent and bind it through execution run id + upstream Acceptance/Package digest; or

B. introduce a genuine deterministic `canonical-results-v1` SHA-256 digest over the normalized canonical Results model.

If option B is chosen:

- define the digest schema explicitly;
- exclude wall-clock/non-semantic instability;
- add known deterministic tests;
- preserve M3.2 zero-invention semantics.

Do not change historical execution artifact/bundle identities.

## 6. Remove semantic fallback invention

A VALID package must never depend on placeholder/default semantics.

Remove fallbacks such as:

- missing engineering intent -> CERTIFICATION;
- missing Findings generation status -> VALID;
- missing canonical id/version/digest -> literal `unknown`;
- missing Acceptance verdict -> synthesized verdict.

Rules:

- required missing input => invalid/incomplete package;
- package fields remain absent where domain allows;
- if domain currently requires a value, update invalid-package modeling rather than fabricating one.

Typed compile-time required inputs do not remove the need for safe runtime validation.

## 7. Optional Strategy/Test Plan state fidelity

When supplied:

- source Contract id/version/fingerprint must match;
- canonical artefact status must be preserved;
- status STALE => component presence/currentness STALE and package issue;
- status SUPERSEDED => not current; surface explicit issue/state;
- DRAFT/READY_FOR_APPROVAL must not be described as approved;
- APPROVED remains approved.

Do not invent artefact content fingerprints.

The existing source Contract fingerprint may be represented explicitly as a source binding, not as an artefact-content digest.

## 8. Strengthen package component semantics

Review `EvidencePackageComponentReference` so generic `fingerprint` does not blur:

- content fingerprint/digest;
- source Contract fingerprint;
- execution bundle fingerprint;
- execution artifact digest.

Prefer explicit fields or use `fingerprint/digest` only when it truly belongs to that component.

The package should make clear what every cryptographic identity actually identifies.

## 9. Evidence-summary target fidelity

Criterion summary target must come from verified canonical Contract/Test Definition source.

Do not synthesize a human target string from incomplete fields when the source target is absent.

Observed value/unit, threshold/operator/unit and source path remain separate fields.

## 10. Complete M4.1 regression matrix

Add explicit tests for:

- authoritative RetailCo workload business demand = 8.75 orders/second;
- authoritative RetailCo scheduler demand = 109.375 journey_iterations/second;
- no business/scheduler substitution;
- RetailCo ramp-up 300 / steady-state 900 / ramp-down 120 / total 1320;
- generic Results `hasIntegrityErrors = true` => invalid package;
- raw evidence lineage edges not verified when evidence incomplete;
- canonical Results component does not carry execution artifact/bundle digest as its own fingerprint;
- missing engineering intent does not become CERTIFICATION;
- missing Findings generation status does not become VALID;
- missing Acceptance verdict/id/digest does not become a fabricated canonical value;
- PASS_WITH_OBSERVATION package remains VALID and preserves observation finding;
- tampered Defect Candidate digest => INVALID_FINDINGS_INTEGRITY;
- caller-supplied generation timestamp does not change package digest/id;
- Strategy status STALE;
- Strategy status SUPERSEDED;
- Test Plan status STALE/SUPERSEDED;
- authoritative RetailCo remains VALID package + INCONCLUSIVE Acceptance + one finding + zero defects.

## 11. Authoritative RetailCo expectation

After correction the exact package must preserve:

### Business demand

- target = 8.75;
- unit = orders/second.

### Scheduler demand

- peak = 109.375;
- unit = journey_iterations/second;
- population = JOURNEY_ITERATION;
- model = OPEN.

### Schedule

- ramp-up = 300s;
- steady-state = 900s;
- ramp-down = 120s;
- total = 1320s.

### Outcome

- package status = VALID;
- Acceptance = INCONCLUSIVE;
- workload prerequisite = UNRESOLVED;
- Checkout criterion PASS at 0.3906885 ms against p95 < 2000ms;
- Error Rate criterion PASS at 0 against rate < 0.005;
- one WORKLOAD_ATTAINMENT_UNRESOLVED finding;
- zero Defect Candidates;
- stable SHA-256 package digest/id.

## Definition of Done

M4.1.1 is complete when:

1. business workload and scheduler workload are structurally separate;
2. stage duration semantics are correct;
3. Results integrity errors prevent VALID package generation;
4. raw-evidence completeness and lineage share one governed validity calculation;
5. CANONICAL_RESULTS no longer carries a misleading artifact/bundle fingerprint;
6. remaining semantic defaults/placeholders are removed;
7. optional Strategy/Test Plan state is faithfully represented;
8. package component cryptographic identities are semantically explicit;
9. required missing source values cannot masquerade as valid package content;
10. M4.1 regression matrix is complete;
11. authoritative RetailCo package remains VALID while Acceptance remains INCONCLUSIVE;
12. normal CI is green.

Stop and provide an M4.1.1 completion report for PM audit.
