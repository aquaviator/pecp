# PECP M4.2 Project Manager Review

## Status

**M4.2 — NOT CLOSED YET**

The Canonical Export & Publication Contract has been implemented and normal CI is green. The architecture is directionally correct: export/publication sits outside the UI, the verified Performance Evidence Package is used as the source boundary, no external side effects occur, and RetailCo is projected as VALID package + INCONCLUSIVE Acceptance with zero defect payloads.

However, the live implementation contains several material semantic-integrity gaps in Results Report projection, defect payload projection, companion-object verification, publication-bundle cryptographic binding, and the workload visualisation hook.

A consolidated correction gate is required:

**M4.2.1 — Export Semantic Integrity, Cryptographic Binding & Visualisation Fidelity Gate**

Do not begin live connectors.

## Authoritative implementation

Implementation SHA:

`c5fdb050d2ac7405a2c3640a3a0f3d304a571738`

CI run:

`35841101055`

Result: **SUCCESS**

Verified:

- 22 Vitest files passed;
- **418 Vitest tests passed**;
- **16 M4.2 Export/Publication tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- **428 combined tests**;
- TypeScript typecheck passed;
- production build passed.

## Accepted M4.2 capabilities

Verified in live code:

- export/publication domain model exists outside UI;
- Evidence Package digest is verified before normal publication;
- invalid package can be blocked or represented as audit-only;
- deterministic JSON Evidence Package export exists;
- deterministic render-neutral Results Report exists;
- deterministic Markdown and HTML report projections exist;
- no external Jira/ADO/Confluence/SharePoint network action occurs;
- destination readiness is explicit;
- SHA-256 artifact content digests exist;
- Publication Bundle digest exists;
- outputs are deep-frozen;
- generation timestamps are excluded from bundle digest;
- RetailCo remains INCONCLUSIVE with one workload-unresolved finding and zero defect payloads.

## Blocking findings

### 1. Results Report reintroduces forbidden semantic defaults

`generateResultsReport()` currently supplies fallback engineering values when source fields are absent, including:

- scheduler unit -> `journey_iterations/second`;
- scheduler target -> `0`;
- business metric -> `orders`;
- business target -> `0`;
- business unit -> `orders/second`;
- contract/test definition/run identifiers -> empty strings;
- scheduler population -> `JOURNEY_ITERATION`;
- execution model -> `OPEN`;
- workload status -> `UNRESOLVED`;
- prerequisite met -> `false`;
- workload rationale -> `Workload attainment evaluation unresolved.`;
- Acceptance verdict -> `INCONCLUSIVE`.

Those are valid values only when supplied by canonical evidence. They are not safe defaults.

This is especially important because M4.2 explicitly allows invalid packages to be exported as `AUDIT_ONLY_NOT_PUBLISHABLE`. An audit-only export must describe absence, not fabricate plausible engineering values.

Required:

- make report fields optional where source data can be absent;
- preserve source values exactly;
- human-readable Markdown/HTML may render `[GOVERNED ABSENCE]`;
- JSON/render-neutral report must not replace absence with a domain value.

### 2. Defect Candidate target semantics are corrupted

M4.0 defines:

`DefectCandidate.acceptanceCriterionReference.target?: string`

and:

`DefectCandidate.expectedGovernedCriterion.target?: string`.

M4.2 currently converts these strings with:

`Number(candidate....target)`.

A governed target such as:

`p95 < 2000ms`

therefore becomes `NaN` in memory and `null` when JSON serialized.

The M4.2 domain incorrectly types these projected target fields as `number | null`.

Required:

- preserve canonical target strings exactly as strings;
- keep numeric threshold in the separate `thresholdValue` field;
- never parse a governed target expression into a number.

### 3. Supplied Findings Register content is not independently verified

`generatePublicationBundle()` compares the supplied Findings Register component:

- id;
- stored digest.

It does not call `verifyFindingsRegisterDigest()`.

A modified Findings Register can retain its old id/digest and still be exported because the stored digest matches the Evidence Package component reference even though the actual Findings content no longer matches that digest.

Required:

- independently verify supplied Findings Register digest and nested Finding/Defect Candidate digests;
- then compare its verified id/digest to the Evidence Package component.

### 4. Supplied Test Definition verification is too weak

The supplied Test Definition is currently checked only by id.

The Results Report visualisation and journey distribution are built from the supplied Test Definition, so a same-id but modified Test Definition can change exported report content while still passing component validation.

Required:

- recompute `computeTestDefinitionFingerprint(testDefinition)`;
- require id/version/fingerprint to match the Evidence Package TEST_DEFINITION component;
- reject drift before using it for report/visualisation content.

### 5. Strategy/Test Plan companion validation is incomplete

Supplied Strategy/Test Plan content is exported when component ids match.

At minimum verify against the package component:

- canonical id;
- version;
- source Contract fingerprint;
- status/currentness represented by the package.

Do not describe source Contract fingerprint as an artefact-content fingerprint.

Where no upstream content digest exists, do not pretend full content cryptographic equivalence has been proven.

### 6. Publication Bundle digest does not bind complete artifact semantics

The top-level bundle digest currently binds only a subset of each ExportArtifact:

- artifactType;
- format;
- sourceId;
- contentDigest;
- publicationEligibility.

It omits semantic metadata including:

- artifact id;
- sourceVersion;
- sourceFingerprint;
- sourceDigest;
- mediaType;
- metadata;
- artifact blockingReasons.

The work package requires the bundle identity to bind source artefact identity, exact exported semantic content, publication readiness and blocking reasons.

Required:

- normalize and bind all semantically meaningful ExportArtifact fields;
- sort maps/lists deterministically where order is not semantic.

### 7. Bundle verifier does not verify bundle envelope identity

`verifyPublicationBundleDigest()` verifies artifact content hashes, defect payload hashes and bundle digest value.

It does not explicitly validate:

- bundle digest algorithm = SHA-256;
- bundle digest schema = publication-bundle-v1;
- bundle id derives from digest.

Add these checks.

### 8. Export artifact identity is not independently checked

Artifact ids are derived from content digest during generation, but verifier does not verify that relationship.

Required:

- verify each ExportArtifact id matches its governed artifact-type/format/content-digest identity rule;
- ensure source digest/fingerprint metadata is bound by bundle digest.

### 9. Visualisation hook is load-test specific and contains defaults

The current visualisation hook reconstructs only:

- ramp-up;
- steady-state;
- ramp-down.

It does so from summary durations and applies scheduler peak as the target rate for ramp-up/steady-state.

It loses source schedule information such as:

- scheduler `startRate`;
- arbitrary stage sequences;
- exact stage start/end rate;
- cumulative time boundaries.

That is insufficient for generic PECP visualisation of:

- load;
- stress;
- soak;
- spike;
- custom schedules.

It also defaults missing visualisation values to plausible values such as 0, orders, and journey_iterations/second.

Required:

- when verified Test Definition is supplied, project the exact governed `workloadSchedule` stages;
- expose `startRate` for the schedule;
- for every stage preserve duration and target arrival rate;
- derive cumulative start/end seconds deterministically;
- preserve scheduler population/unit/execution model;
- do not assume three stages;
- no default rates/units/populations;
- journey distribution must preserve exact governed percentages/weights;
- report/visualisation data remains a projection only, never canonical truth.

### 10. Source Acceptance verdict fallback remains

Publication Bundle sets:

`sourceAcceptanceVerdict = evidencePackage... ?? 'INCONCLUSIVE'`.

For a VALID Evidence Package, Acceptance verdict must already exist. For invalid audit-only packages, absence must remain absence.

Required:

- remove synthesized INCONCLUSIVE fallback;
- update publication domain optionality for audit-only invalid sources if necessary;
- normal READY bundle requires exact source verdict.

## Decision

The Studio-created `docs/M4_2_CLOSURE.md` is premature and is superseded by this PM review.

Do not begin live external connector work.

Complete:

**M4.2.1 — Export Semantic Integrity, Cryptographic Binding & Visualisation Fidelity Gate**

Then re-audit M4.2.
