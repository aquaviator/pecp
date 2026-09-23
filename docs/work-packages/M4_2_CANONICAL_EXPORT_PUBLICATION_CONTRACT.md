# Work Package: M4.2 — Canonical Export & Publication Contract

## Objective

Introduce the deterministic export/publication boundary that converts closed PECP artefacts into destination-neutral publication bundles without allowing external systems to change canonical PECP truth.

This begins Constitution §13 step 18:

**export/publish the outputs**

M4.2 defines the canonical export model and payload preparation layer. It does not yet perform live Jira, Azure DevOps, Confluence or SharePoint network actions.

Read:

- `docs/M4_1_CLOSURE.md`;
- `docs/M4_0_CLOSURE.md`;
- `docs/PRODUCT_CONSTITUTION.md`;
- canonical Strategy/Test Plan, Results, Acceptance, Findings and Evidence Package models.

Do not rerun k6.
Do not infer root cause.
Do not alter Acceptance verdicts.
Do not create live external records in M4.2.

## 1. Export governance law

External destinations are projections of PECP canonical state.

They are never the source of truth for:

- workload;
- Acceptance verdict;
- Findings;
- Defect Candidate eligibility;
- Evidence Package validity.

Export/publishing may transform presentation, but must not silently alter engineering meaning.

## 2. Canonical export domain

Add engine-neutral domain types.

Recommended:

### ExportArtifactType

- PERFORMANCE_STRATEGY
- PERFORMANCE_TEST_PLAN
- RESULTS_REPORT
- PERFORMANCE_EVIDENCE_PACKAGE
- FINDINGS_REGISTER
- DEFECT_CANDIDATE

### ExportFormat

Initial:

- JSON
- MARKDOWN
- HTML

Reserve DOCX/PDF for a rendering work package unless implemented deterministically here.

### PublicationDestination

- DOWNLOAD
- API
- CONFLUENCE
- SHAREPOINT
- JIRA
- AZURE_DEVOPS

Destination existence does not imply connector implementation.

### ExportArtifact

Preserve:

- artefact type;
- canonical source id/version;
- source fingerprint/digest;
- format;
- media type;
- deterministic content digest;
- render-neutral metadata;
- publication eligibility;
- blocking reasons.

### PublicationBundle

Preserve:

- bundle id;
- schema version;
- source Evidence Package id/digest;
- source Acceptance verdict;
- source Findings Register digest;
- export artifacts;
- requested destinations;
- publication readiness;
- deterministic SHA-256 digest;
- generatedAt from governed/caller context only.

## 3. Input authority

M4.2 should accept a verified `PerformanceEvidencePackage`.

Where individual Strategy/Test Plan/Findings objects are required to construct content, verify they match the package component references.

Do not trust an Evidence Package digest alone if underlying content needed for rendering is independently supplied.

## 4. Verify Evidence Package integrity

Before creating a publication bundle:

- verify `performance-evidence-package-v1` digest;
- verify package id derives from digest;
- require packageGenerationStatus = VALID for normal publication readiness.

An invalid package may be exported for audit/diagnostic purposes only if explicitly marked:

`AUDIT_ONLY_NOT_PUBLISHABLE`

It must never masquerade as a normal customer publication.

## 5. Evidence Package export

Create a deterministic export representation suitable for download/API.

Initial canonical output should support JSON.

JSON export must:

- preserve package schema and digest;
- preserve Acceptance verdict unchanged;
- preserve Findings counts/types;
- preserve raw evidence references without embedding large logs;
- preserve lineage;
- contain no credentials.

## 6. Render-neutral Results Report model

Build a deterministic Results Report projection from the verified Evidence Package.

Include factual sections such as:

- project/execution identity;
- workload demand;
- scheduler demand;
- schedule/timings;
- workload attainment status;
- canonical criterion outcomes;
- Acceptance verdict and reasons;
- Findings summary;
- Defect Candidate summary;
- evidence/package integrity summary.

Do not infer root cause or recommendation unless supplied by a later governed workflow.

The Results Report is a view, not a new source of truth.

## 7. Human-readable formats

Support deterministic Markdown and/or HTML projections from the render-neutral Results Report model.

Rules:

- no AI-generated prose required;
- no invented narrative;
- tables/sections derive from canonical data;
- missing source values render as governed absence, not guessed text;
- Acceptance verdict remains exact.

## 8. Defect Candidate publication payload

Create destination-neutral defect payloads from eligible Defect Candidates.

Preserve factual fields:

- source finding id;
- title;
- factual problem statement;
- canonical criterion reference;
- observed value/unit;
- governed threshold/operator/unit;
- execution run id;
- evidence references;
- Acceptance/Evidence Package references.

Do not invent:

- priority;
- severity;
- assignee;
- team/component;
- sprint;
- due date;
- root cause.

Destination-specific required fields not available from PECP must become publication blockers.

## 9. Publication readiness

Recommended statuses:

- READY
- BLOCKED_INVALID_SOURCE
- BLOCKED_MISSING_DESTINATION_CONFIGURATION
- BLOCKED_MISSING_REQUIRED_FIELD
- AUDIT_ONLY_NOT_PUBLISHABLE

Do not default destination configuration.

## 10. Deterministic identity

Use SHA-256 for:

- each export artifact content digest;
- destination-neutral publication payload digest;
- top-level Publication Bundle digest.

Bind:

- source Evidence Package digest;
- source artefact identity;
- exact exported semantic content;
- publication readiness;
- blocking reasons;
- requested destination type.

Exclude wall-clock timestamp from digest.

## 11. No live connector side effects

M4.2 must not:

- create Jira issues;
- create Azure DevOps work items;
- write Confluence pages;
- write SharePoint files;
- upload artifacts.

Those actions belong to connector/publishing execution after this canonical boundary is proven.

## 12. Authoritative RetailCo expected output

For the current authoritative package:

- source package = VALID;
- Acceptance = INCONCLUSIVE;
- one workload-unresolved Finding;
- zero Defect Candidates.

Expected M4.2 behavior:

- JSON Evidence Package export = READY;
- Results Report projection = READY;
- Markdown/HTML representation may be READY;
- no Defect Candidate publication payloads;
- no claim that RetailCo passed performance;
- no external publishing action.

## 13. FAIL scenario expected output

For a synthetic valid FAIL package with eligible Defect Candidates:

- package/report exports = READY;
- each eligible Defect Candidate may produce a destination-neutral defect payload;
- publication to Jira/ADO remains BLOCKED until destination configuration is supplied in a later connector layer.

## 14. Tests

Add deterministic tests for:

- authoritative RetailCo export preserves INCONCLUSIVE;
- PASS export;
- FAIL export;
- PASS_WITH_OBSERVATION export;
- invalid Evidence Package -> not normally publishable;
- tampered package digest rejected;
- JSON deterministic;
- Markdown/HTML deterministic if implemented;
- Results Report contains exact business and scheduler demand separately;
- exact RetailCo timings 300/900/120/1320;
- Findings summary preserved;
- zero Defect Candidates => zero defect payloads;
- FAIL with eligible candidate => one neutral defect payload;
- missing destination configuration blocks live-publication readiness;
- no priority/severity/owner/root-cause invention;
- identical inputs -> identical artifact/bundle digests;
- timestamp excluded from digest;
- output immutable;
- caller input purity.

## 15. Visualisation hook

Do not implement chart rendering as canonical truth.

However, the Results Report model should expose enough governed data for a UI/rendering layer to plot:

- total scheduler load over time;
- business workload target;
- journey distribution;
- ramp/steady/ramp-down stages.

This prepares the workload visualisation feature without coupling chart libraries into the canonical engine.

## Explicit non-goals

M4.2 does not:

- call external SaaS APIs;
- generate customer-signed certification;
- infer diagnostics/root cause;
- rerun tests;
- replace canonical PECP state with published copies.

## Definition of Done

M4.2 is complete when:

1. canonical export/publication domain exists;
2. verified Evidence Package is the source boundary;
3. deterministic JSON export exists;
4. render-neutral Results Report projection exists;
5. human-readable projection is deterministic if implemented;
6. Defect Candidates can become destination-neutral payloads without invention;
7. invalid packages cannot masquerade as publishable;
8. export/publication identities are SHA-256 bound;
9. RetailCo preserves VALID package + INCONCLUSIVE verdict + zero defect payloads;
10. no external side effects occur;
11. normal CI is green.

Stop and provide an M4.2 completion report for PM audit.
