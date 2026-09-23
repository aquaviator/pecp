# Work Package: M4.2.1 — Export Semantic Integrity, Cryptographic Binding & Visualisation Fidelity Gate

## Objective

Harden M4.2 so export and publication projections contain no invented engineering semantics, companion source objects are independently verified, publication cryptographic identity binds the full export meaning, and the visualisation hook faithfully supports arbitrary governed workload schedules.

This is the M4.2 correction/closure gate.

Read:

- `docs/M4_2_PM_REVIEW.md`;
- `docs/work-packages/M4_2_CANONICAL_EXPORT_PUBLICATION_CONTRACT.md`;
- `docs/M4_1_CLOSURE.md`;
- `docs/M4_0_CLOSURE.md`.

Do not call external APIs.
Do not rerun k6.
Do not infer root cause.
Do not perform release certification.
Do not render PDF/DOCX.

## 1. Remove Results Report semantic defaults

Refactor `RenderNeutralResultsReport` so source-backed fields can remain absent for invalid/audit-only package exports.

Remove fallbacks that synthesize:

- zero business/scheduler demand;
- `orders`;
- `orders/second`;
- `journey_iterations/second`;
- `JOURNEY_ITERATION`;
- `OPEN`;
- `UNRESOLVED`;
- `false`;
- fabricated workload rationale;
- `INCONCLUSIVE`;
- empty canonical identity strings.

Rules:

- VALID source package must provide all values required for a READY report;
- invalid/audit-only source may omit unavailable semantic fields;
- Markdown/HTML use explicit `[GOVERNED ABSENCE]` presentation;
- JSON/render-neutral model preserves absence.

## 2. Correct Defect Candidate target type and projection

Change destination-neutral defect payload target fields to preserve canonical target strings.

Use:

- `acceptanceCriterionReference.target?: string`;
- `expectedCriterion.target?: string`.

Do not call `Number(...target)`.

Keep:

- operator;
- numeric thresholdValue;
- unit;

as separate governed comparison semantics.

Add regression using canonical target:

`p95 < 2000ms`

and prove it remains exactly that string in the defect payload and serialized export.

## 3. Independently verify supplied Findings Register

Import/reuse `verifyFindingsRegisterDigest()`.

Before using a supplied Findings Register:

1. verify register SHA-256 schema/digest/id;
2. verify nested Finding digests;
3. verify nested Defect Candidate digests;
4. compare verified register id/digest with Evidence Package component.

Tampered content with unchanged stored digest must produce `BLOCKED_INVALID_SOURCE`.

Do not generate defect payloads from an unverified Findings Register.

## 4. Fully verify supplied Test Definition

Before using supplied Test Definition for journey distribution or schedule visualization:

- verify canonical id;
- verify version;
- recompute `computeTestDefinitionFingerprint()`;
- compare fingerprint to its stored fingerprint and Evidence Package TEST_DEFINITION component.

Same-id content drift must block normal publication.

## 5. Strengthen optional Strategy/Test Plan binding

When supplied, compare to Evidence Package component:

- id;
- version;
- source Contract fingerprint;
- canonical artefact status.

If package component says ABSENT/STALE/SUPERSEDED/INVALID, do not silently publish it as a current normal artifact.

Do not treat source Contract fingerprint as an artefact-content fingerprint.

## 6. Bind full ExportArtifact semantics into bundle digest

Update Publication Bundle digest payload to bind, for each artifact:

- id;
- artifactType;
- sourceId;
- sourceVersion;
- sourceFingerprint;
- sourceDigest;
- format;
- mediaType;
- contentDigest;
- normalized metadata;
- publicationEligibility;
- blockingReasons.

Sort artifacts and non-semantic collections deterministically.

The digest must change if any of those governed semantics change.

## 7. Harden Publication Bundle verifier

Verify:

- `bundleDigest.algorithm === 'SHA-256'`;
- `bundleDigest.schemaVersion === 'publication-bundle-v1'`;
- bundle digest value;
- bundle id derives from digest;
- every artifact content digest;
- every artifact id derivation rule;
- every defect payload digest/id derivation rule.

Tampering any bound semantic field must fail verification.

## 8. Generic governed workload visualisation projection

Refactor `ResultsReportVisualisationHook` to represent exact schedule semantics, not a fixed load-test template.

Recommended model:

### scheduler

- executionModel?;
- population?;
- rateUnit?;
- startRate?;
- peakArrivalRate?;

### businessTarget

- metric?;
- targetValue?;
- unit?;
- timeBasis?;

### stages[]

For each governed source stage:

- stageIndex;
- source description/name if supplied;
- durationSeconds;
- startTimeSeconds;
- endTimeSeconds;
- startArrivalRate;
- targetArrivalRate.

The next stage's start rate is the prior stage's target rate, with the first stage using governed schedule `startRate`.

This enables accurate:

- load;
- stress;
- soak;
- spike;
- custom schedule

plots without chart-library coupling.

Do not infer a ramp/steady/ramp-down classification unless the source explicitly provides it.

### journeyDistribution[]

Preserve exact:

- journey id/name;
- percentage/weight;
- governed description if supplied.

Validate the distribution only where the canonical Test Definition already defines the rule. Do not normalize or invent missing weights in the export layer.

## 9. Remove source verdict fallback

Normal READY publication requires a source-backed Acceptance verdict.

For invalid audit-only source packages:

- allow sourceAcceptanceVerdict to be absent if source is absent;
- never synthesize INCONCLUSIVE.

Update domain optionality where required.

## 10. Report digest semantic completeness

Review `buildResultsReportDigestPayload()`.

Bind all semantically meaningful report fields, including:

- project/execution identity;
- workload demand units/populations;
- full visualisation schedule;
- criterion target/operator/unit/observed unit;
- Acceptance verdict/reasons;
- Findings/Defect summary;
- package integrity.

Exclude only generation-time metadata that is intentionally non-semantic.

Tampering any semantic report field must change `reportDigest`.

## 11. Regression matrix

Add tests for:

- invalid/audit-only report does not invent zero rates or default units/populations/verdict;
- Markdown/HTML show governed absence for missing values;
- Defect target string `p95 < 2000ms` preserved exactly;
- tampered Findings content with unchanged stored digest blocked;
- same-id modified Test Definition fingerprint blocked;
- Test Definition version mismatch blocked;
- Strategy version/source binding mismatch blocked when supplied;
- Test Plan version/source binding mismatch blocked when supplied;
- artifact sourceDigest tamper changes bundle verification outcome;
- artifact mediaType tamper changes bundle verification outcome;
- artifact metadata tamper changes bundle verification outcome;
- artifact blockingReasons tamper changes bundle verification outcome;
- bundle algorithm/schema/id tamper rejected;
- defect payload id tamper rejected;
- report semantic-field tamper changes report digest;
- caller timestamp still excluded from report/bundle identity where designed;
- generic two-stage custom schedule projected exactly;
- stress-style multi-stage increasing schedule projected exactly;
- non-zero scheduler startRate preserved;
- authoritative RetailCo schedule projected exactly;
- RetailCo journey mix preserved exactly:
  - Browse 55%;
  - Search 20%;
  - Basket 15%;
  - Checkout 8%;
  - Account 2%;
- authoritative RetailCo remains READY for DOWNLOAD/API;
- authoritative RetailCo remains INCONCLUSIVE with zero defect payloads.

## 12. Authoritative RetailCo invariant

Preserve exactly:

- source Evidence Package = VALID;
- Acceptance = INCONCLUSIVE;
- workload = UNRESOLVED;
- business target = 8.75 orders/second;
- scheduler peak = 109.375 journey_iterations/second;
- scheduler start rate = 0;
- scheduler population = JOURNEY_ITERATION;
- execution model = OPEN;
- stages:
  - 300s -> 109.375;
  - 900s -> 109.375;
  - 120s -> 0;
- journey distribution:
  - Browse 55%;
  - Search 20%;
  - Basket 15%;
  - Checkout 8%;
  - Account 2%;
- Checkout p95 = 0.3906885 ms PASS;
- HTTP failure rate = 0 PASS;
- one WORKLOAD_ATTAINMENT_UNRESOLVED finding;
- zero Defect Candidates/payloads;
- DOWNLOAD/API = READY;
- external live destinations remain blocked pending connector configuration.

## Definition of Done

M4.2.1 is complete when:

1. render-neutral report contains no invented engineering defaults;
2. Defect target strings are preserved exactly;
3. supplied Findings Register is independently verified;
4. supplied Test Definition content fingerprint is independently verified;
5. optional artefact companion bindings are stronger;
6. Publication Bundle digest binds full artifact semantics;
7. bundle verifier checks algorithm/schema/id/artifact/payload identities;
8. visualisation hook faithfully represents arbitrary governed schedules;
9. source verdict is never synthesized;
10. report digest binds complete semantic content;
11. authoritative RetailCo behavior remains unchanged;
12. normal CI is green.

Stop and provide an M4.2.1 completion report for PM audit.
