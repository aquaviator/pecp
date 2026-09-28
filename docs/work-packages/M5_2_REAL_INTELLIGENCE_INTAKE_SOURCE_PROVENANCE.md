# M5.2 Work Package: Real Intelligence Intake, Source Provenance & Review

## Status and authority

**READY TO IMPLEMENT. Not implemented or closed by this document.**

This is the next bounded product slice after M5.1. The design decisions explicitly introduced below define M5.2; they are not claims about existing implementation.

Verified planning baseline: `571414571566c1a9070bd56d129477bccc5eedcf`, containing `docs/M5_1_CLOSURE.md`.

Accepted runtime baseline: `0f3f3f3b7541fa73c4c3bd5260f12235daa0b9fe`; final M5.1 documentation revision: `7e3b90bf122a3b23d50cb9667e131b60fdaf18fb`. Recorded verification: 487 web + 86 API + 10 Reference Lab = 583 tests. Existing warnings/advisories remain release-hardening notes, not permission to claim a warning-free build.

Governing sources:
- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M5_0_CLOSURE.md`
- `docs/M5_1_CLOSURE.md` and `docs/M5_1_PM_REVIEW.md`
- `docs/platform/M5_0_PLATFORM_ARCHITECTURE.md`
- `docs/platform/M5_0_API.md`
- `docs/security/M5_1_IDENTITY_RBAC_ARCHITECTURE.md`
- current domain, platform, repository and authenticated web-client contracts.

Do not reopen M5.1 or recreate its authentication architecture. Narrow integration changes required for real editable intelligence are authorized here. Do not begin M5.3.

## 1. Customer outcome and scope

An authenticated customer must be able to create or open a real persisted project, save an actual brief, upload supported source files, inspect their extracted content, capture structured intelligence with exact source references, see explicitly defined gaps/conflicts, and have an authorized human approve the current version. Sources, decisions and history must survive restart.

The completed workflow is:

`Login -> Project -> Source capture -> Content inspection -> Explicit intelligence mapping -> Gap/conflict review -> Authorized approval -> Durable provenance`

M5.2 is not another RetailCo-only screen, a filename recorder, or a universal autonomous document analyst.

**The key separation is Source bytes -> Extracted content -> Unapproved intelligence -> Reviewed/approved intelligence.** Text extraction is not interpretation, approval or proof that the business statement is correct.

### Required input scope

| Input | Required behavior |
| --- | --- |
| Project brief / pasted text | Preserve exact supplied UTF-8 content as a versioned source; expose line/character locators. |
| Manual stakeholder assertion | Persist a versioned statement attributed to the authenticated recorder. Preserve separately any supplied speaker/date; do not authenticate an alleged speaker by assumption. |
| `.txt`, `.md` | Strict UTF-8 extraction with stable line/character locations. Render as inert text in M5.2. |
| `.csv` | Parse quoted records correctly; preserve row/column locators and original field strings. Explicit mapping, not guessing column meaning. |
| `.json` | Parse bounded JSON and expose stable JSON Pointer locations. Support an explicit, documented structured-intelligence import schema. |
| `.docx` | Extract supported body text/table content with paragraph/table/cell locators and declared limitations. Do not invent page numbers. |
| Text-based `.pdf` | Extract page-located text, preserve page indexes and parser limitations. Do not claim accurate diagram/table interpretation from flattened text. |

XLSX/XLS, legacy DOC, macro-enabled Office files, PPTX, images, OCR, password-protected documents, arbitrary archives and remote URL crawling are outside this work package. Reject unsupported input explicitly. Scanned/image-only or unreadable PDFs must report `NO_EXTRACTABLE_TEXT`/`NEEDS_MANUAL_REVIEW`, not a successful empty analysis. A user can supply a separate manual assertion instead.

The first spreadsheet intake path is CSV. No implicit promise of XLSX support.

## 2. Architecture and package boundaries

Keep the existing React/TypeScript/Vite, Fastify, platform-core and SQLite architecture.

- `@pecp/pe-domain`: shared source-reference/value/review types and additive canonical metadata where justified. No HTTP, filesystem or parser dependencies.
- `@pecp/platform-core`: intake application services, authorization, mapping/validation, revision/state rules, repository/parser interfaces and deterministic summary projection.
- `apps/api`: multipart/HTTP transport, SQLite implementations, bounded document parser adapters and runtime wiring.
- `apps/web`: authenticated API adapters, upload/source inspection, mapping forms and canonical read-only status presentation.

Add focused intake services/routes rather than placing all parsing and workflow logic in `app.ts` or growing React into an engineering engine. A separate worker service, message broker, vector database or new framework is not needed.

Parser adapters must return content and diagnostics, never approved canonical values. Dependency selection must verify actual Node 22 compatibility, maintenance/security status and real parser APIs. Do not guess library versions or signatures; pin chosen compatible parser versions and commit the npm lockfile. Use maintained Fastify-compatible multipart handling.

### Embedded storage decision for this milestone

For the bounded embedded provider, store original source bytes as private SQLite BLOBs behind repository contracts. This deliberately allows source version + bytes + metadata + audit to commit atomically in the existing database. It is not a universal enterprise-storage recommendation. Document backup/database-growth tradeoffs and leave a clean content-repository seam for future object storage.

Do not expose BLOBs through static hosting, return them in list responses, or use user filenames as database identifiers/filesystem paths. Existing database source-control exclusions remain mandatory.

## 3. Source and provenance model [I01]

Introduce source records with server-generated IDs and immutable source versions. At minimum represent:

- project and organisation ownership;
- source ID, source kind (`BRIEF`, `MANUAL_ASSERTION`, `UPLOAD`) and supplied display title/name;
- version ID and monotonically increasing version number;
- original byte size, detected format/media type and SHA-256 of the exact original bytes;
- current-version pointer on the logical source;
- captured timestamp and authenticated recorder ID/display snapshot;
- optional supplied authored-at/speaker/external-reference metadata, clearly distinct from server capture evidence;
- extraction state, diagnostics and references to versioned extraction results.

A checksum verifies content identity, not the truth or safety of its content. No FNV historical fingerprint migration is authorized.

Store original bytes unchanged. Any text normalization creates a separately identified extraction representation with its own digest, parser ID/version and documented normalization. Do not hash normalized text and label that the original-file digest.

A source binding must identify the project, source, immutable source version, original digest and the applicable extraction ID/version plus locator. Locators must resolve within the stored representation. When a claim contains a quoted excerpt, verify it against that representation. Distinguish a human interpretation/mapping from a verbatim excerpt; existence of the excerpt does not automatically validate the interpretation.

Represent text offsets with a documented character convention. CSV uses record/column locations, JSON uses pointers, DOCX uses content indexes, PDF uses actual page indexes plus extracted-segment locations. Never fabricate a page or line number the parser cannot support.

Manual entry is a legitimate source path, but must be labelled manual and attributed to its recorder, not disguised as an imported document fact.

## 4. Upload and extraction boundary [I02]

Authorize before accepting/parsing upload content. Preserve M5.1 cookie authentication, `X-PECP-CSRF` and tenant checks. Be careful about Fastify hook ordering: do not use a buffering body hook that processes unauthorized uploads before the authorization boundary.

Introduce documented configurable operational limits. M5.2 defaults:

- one file per upload request;
- 10 MiB maximum original file;
- 100 MiB aggregate retained source bytes per project, including old versions;
- 1 MiB maximum brief/assertion text;
- 2 MiB maximum extracted UTF-8 text per extraction;
- 200 PDF pages;
- 50 MiB maximum expanded DOCX content;
- 30-second extraction deadline.

These are provider/resource policies, not customer workload/NFR values. Validate configuration and enforce limits before unbounded allocation; test boundary failures. Bound JSON nesting/collection size and DOCX archive entry count as documented parser policies.

Use an allowlist and validate format/content consistency; do not trust filename extension or client Content-Type alone. Reject corrupt documents, unsafe paths/control characters in filenames, unsupported encryption/macros, oversized/truncated requests and resource-limit breaches with safe errors. Handle disconnects and release parser resources. Do not call a truncated upload successful.

Run expensive parsing outside the SQLite write lock, using a bounded execution mechanism that can actually terminate on timeout for CPU-bound parsers. Persist the source first with `NOT_PROCESSED`, then commit an extraction result or explicit failure in a short separate transaction. Interrupted extraction remains distinguishable from success and can be retried. No pretend progress percentages or ephemeral jobs presented as durable queues.

Do not execute embedded scripts, macros, formulas, links or instructions. Do not fetch external document relationships or URLs. Extracted Markdown/HTML/script-like content must be displayed escaped as data, not executed via `dangerouslySetInnerHTML`.

All originals/extractions remain customer-controlled and permission-gated. Do not send them to public conversion services, AI providers or public malware scanners. Warn users not to upload credentials. Do not claim comprehensive secret detection or malware scanning unless implemented and verified; validation is not a clean-bill-of-health scan. Avoid source bodies/excerpts in operational logs, error responses or audit metadata. Application credentials must never enter sources through logging or fixtures.

An authenticated original-download endpoint must use attachment disposition, safe filename handling, `nosniff` and private/no-store caching. Never provide a public share link.

## 5. Persistence, transactions and retries [I03]

Add ordered migrations after the existing migration 003; do not rewrite previously applied migrations.

Persist logical sources, immutable source versions/originals, extraction results/segments, intelligence revision snapshots, source bindings, requirement-checklist revisions and the necessary request-idempotency records. A compact relational design is acceptable; do not create competing canonical stores.

Use composite project-scoped constraints and foreign keys so a source version or candidate from another project cannot be attached even if its ID or hash is known.

Required atomic units include:

1. New source/version, original bytes, current pointer and successful capture audit.
2. Extraction result/diagnostics and completion/failure audit.
3. Intelligence mutation, revision snapshot, bindings, applicable project counters and audit.
4. Source supersession and invalidation of affected current approvals, including history and audit.
5. Approval/resolution against an expected current revision plus approval record and audit.

Use the existing asynchronous `IUnitOfWork` and connection ownership/mutex correctly. Audit insertion failure must roll back the associated successful mutation. The existing `SqliteIntelligenceRepository.saveItems()` synchronous transaction helper must be aligned with the owning asynchronous Unit of Work for these new writes; it must not bypass serialization or accidentally open an unrelated transaction. Preserve unrelated item rows.

Do not hold a transaction while receiving a file or waiting for parsing. After parsing, recheck authorization, current source/version and write preconditions inside the transaction before applying results to current workflow state. Persisted old-version extraction may remain historical, but cannot silently become current.

Create endpoints and extraction retries need scoped idempotency. Scope keys by project, authenticated actor and operation; bind them to the request payload/content digest. Replay returns the original successful result without duplicate source versions, claims or success audits. Same key with a different payload returns 409. Reauthorize replays. Do not reveal duplicate hashes across tenants.

Restart tests must prove byte equality, digests, references, versions and review state, not just a surviving project name.

## 6. Capturing structured intelligence [I04]

Provide two genuine non-AI paths:

**Manual/source-assisted capture:** a user chooses a source passage or enters a stakeholder assertion, then explicitly supplies the intelligence key, category, title, typed value, optional unit, relevant source references and any ambiguity note.

**Explicit structured import:** CSV or versioned PECP JSON records use a documented mapping/schema. Preview validates and shows proposed records before a separate user-confirmed apply. CSV values remain strings unless the mapping explicitly declares a supported numeric field; reject invalid/non-finite conversions. JSON null/missing is not numeric zero. Preserve zero, empty/missing distinctions and supplied units.

Free-form PDF/DOCX/prose extraction does not automatically identify the meaning of every number. Do not implement a universal regex that labels every occurrence of users/seconds/orders as a requirement. Unmapped content remains inspectable source content. This is the deliberate boundary before future BYOAI.

Reuse `IntelligenceItem`, `IntelligenceCandidate`, categories and canonical/review states. Add provenance/revision metadata compatibly, or use an explicitly versioned persistence envelope around the same canonical item. Historical pure fixtures and engine fingerprints must not be regenerated merely to accommodate new optional fields.

New API-created intelligence must always be intake-managed/versioned. Server assigns IDs, capture actor, dates, history, state transitions and revision metadata. Reject attempts to set approval authority/history/approved state through generic create/edit/import DTOs.

New manual values start `MANUAL`; explicit source mappings/imports start `IMPORTED`; approval state is `UNREVIEWED`. `FOUND` means present for review, not proven correct or approved. Unclear meanings stay `AMBIGUOUS` with a reason and cannot be approved merely by pressing a button.

For a missing required field, produce a gap record without inventing a value/source/candidate. Do not introduce `DRAFT` as a canonical intelligence state.

## 7. Conflict, revision and approval laws [I05]

A project field key has explicitly declared semantics. Only compare competing assertions mapped to that same field and context. Do not combine different business populations, time periods or metrics just because their labels look similar. Context belongs in explicit key/field metadata or distinct keys, not an inferred merge.

Multiple differing assertions for the same field must preserve the candidate values and provenance and mark the current field `CONFLICTING`. Equality includes type and supplied unit; no automatic averaging, majority vote, latest-wins or unit-equivalence assumption. Matching values from independent sources retain all source support; retries are not new support.

Introduce optimistic concurrency on intake-managed records and source/checklist versions. A mutation/approval submits `expectedRevision` or an equivalent documented conditional request. Missing required precondition fails explicitly; stale revision returns 409 with no partial writes. Do not accept last-write-wins approvals.

Material changes to value, unit, field meaning, candidate set or source binding create a new revision and invalidate current approval. Preserve the old approved snapshot and its actor, time, source versions and decision record. Clear current `approvedBy`, `approvedById` and `approvalDate` when current approval is invalidated; preserve those in history instead.

Approval/resolution must bind the exact current content revision and source-version references inspected by the reviewer. Validate inside the Unit of Work. An intake-managed field cannot be approved while missing, ambiguous, unresolved-conflicting, stale or bound to an unavailable/invalid reference. Explicit resolution chooses an eligible candidate; missing unit stays missing and must not inherit a previous candidate's unit.

Use M5.1 authenticated actors and permissions. Ordinary intake edits cannot approve. Existing `/approve` and `/resolve` endpoints must enforce the new preconditions for intake-managed records; update API adapters/UI accordingly. Do not leave a legacy endpoint as a bypass for new managed records. Existing legacy reference data is not automatically converted into fictional source versions or historical approvals; identify any legacy unbound state clearly and preserve existing reference-engine behavior.

A source replacement creates a new immutable source version. It does not rewrite old references. Linked current intake records become `STALE`/require review and their current approvals cease to be valid; old versions remain inspectable. A new extraction never moves an old approval automatically. Rebinding to the new source is an explicit material edit followed by a new authorized review.

Do not rewrite historical runs, accepted contracts or frozen evidence packages. Downstream consumers must continue to receive existing stale/conflicting/unapproved state so established gates remain effective. Production-wide downstream regeneration is not part of M5.2.

## 8. Explicit gap checklist and truthful summary [I06]

Add a small versioned, project-configured required-field checklist: field key, title, category, optional expected value kind/unit and whether required. Checklist editing requires `INTELLIGENCE_WRITE`. No arbitrary universal field set is silently installed. Reuse existing governed definitions only when their identity and semantics are explicit; otherwise show `NOT_CONFIGURED` until a user supplies the checklist.

Gap checks answer whether configured fields are missing, ambiguous, conflicting, stale, invalid for the declared field contract or awaiting approval. This is checklist coverage, not certification that the entire performance project is ready. No configured checklist or an empty checklist must not become 100% readiness.

Create a separately named server-owned `IntakeReviewSummary` with a schema/policy version and precise count definitions, including:

- distinct uploaded-file sources with original bytes stored;
- current versions successfully text-extracted versus failed/pending/manual-review;
- brief/manual-assertion counts separately;
- current intelligence fields by category and review/approval state;
- configured required fields and open gaps;
- current conflicting fields and pending human reviews.

The summary is a deterministic query/projection of persisted intake state. React displays it without synthesizing engineering meaning.

Do not manufacture the old `IntelligenceReviewSummary.documentsAnalysed`, `requirementsFound` or readiness sections from arbitrary item counts. Keep the legacy mock/reference summary separate, or introduce a clearly documented adapter only for genuinely equivalent fields.

Legacy `uploadedDocumentNames` are declared attachment metadata, not proof of uploaded bytes. Do not fabricate source records from filenames. Use new source-inventory counts in the new intake UI. Any transition of existing project counters must explicitly document the new basis, retain bootstrap metadata and preserve historical fixture semantics. New conflict/requirement count updates must use the defined persisted field categories, not browser decrements or number-of-paragraph heuristics.

## 9. Authorization and audit [I07]

Extend the permission policy narrowly with `SOURCE_WRITE` and `INTELLIGENCE_WRITE`.

| Role | Source/intelligence read | SOURCE_WRITE | INTELLIGENCE_WRITE | Existing resolve/approve |
| --- | --- | --- | --- | --- |
| PLATFORM_ADMIN | Global implemented permissions | Yes | Yes | Preserve |
| ORG_ADMIN | Own organisation | Yes | Yes | Preserve |
| PERFORMANCE_LEAD | Own organisation | Yes | Yes | Preserve |
| PERFORMANCE_ENGINEER | Own organisation | Yes | Yes | No |
| REVIEWER | Own organisation | No | No | Yes, existing policy |
| VIEWER | Own organisation | No | No | No |

Use existing `INTELLIGENCE_READ` for source/fragment/provenance read, combined with project visibility. Preserve every existing M5.1 permission assignment. Resolve still requires both `INTELLIGENCE_RESOLVE` and `INTELLIGENCE_APPROVE`.

All source endpoints, including download, versions, extraction and fragment lookup, are tenant/project scoped. Application-service entrypoints independently enforce trusted actor and scope; do not rely only on hidden UI buttons or a client organisation ID. Revalidate applicable authority at mutation commit when work has waited on parsing or locking.

Audit source capture/new version/extraction outcome, intelligence create/edit/import, checklist changes, approval invalidation and existing approvals/resolutions using registered audit actions. Record identifiers/digests/revisions/status and authenticated actor, not raw document bodies, values containing secrets, session/CSRF tokens or parser internals. Protected mutation denials follow the existing safe denial-audit pattern.

## 10. API contract [I08]

Implement versioned, project-scoped routes under `/api/v1/projects/:projectId`:

| Method/path suffix | Purpose |
| --- | --- |
| `GET /sources` | Source metadata list, no original bodies. |
| `POST /sources/text` | Brief or manual assertion capture. |
| `POST /sources/upload` | One actual multipart file. |
| `GET /sources/:sourceId` | Metadata/current version. |
| `GET /sources/:sourceId/versions` | Immutable version inventory. |
| `POST /sources/:sourceId/versions` | Explicit new text/file version, conditional on current revision. |
| `GET /sources/:sourceId/versions/:versionId/content` | Authorized original download. |
| `POST /sources/:sourceId/versions/:versionId/extract` | Bounded extraction/retry, never approval. |
| `GET /sources/:sourceId/versions/:versionId/extraction` | Versioned fragments and diagnostics. |
| `POST /intelligence` | Explicit unapproved source-assisted/manual capture. |
| `PATCH /intelligence/:itemId` | Version-checked material edit; invalidate approval. |
| `GET /intelligence/:itemId/history` | Persisted snapshots/decisions/source bindings. |
| `POST /intelligence/import-preview` | Validate explicit CSV/JSON mapping without mutating intelligence. |
| `POST /intelligence/import-apply` | Version-bound confirmed import, all-or-nothing. |
| `GET /intelligence-requirements` | Required-field checklist/version. |
| `PUT /intelligence-requirements` | Version-checked checklist update. |
| `GET /intelligence-intake-summary` | Defined source-backed summary and gap records. |

Preserve existing item reads, `/approve` and `/resolve`; extend their version preconditions as specified above. Route names may be consolidated only with an equivalent documented contract and full tests, not by dropping capabilities.

Import preview/apply must bind the source version, mapping schema and proposed payload digest/current field revisions. Recompute/validate on apply rather than trusting a browser-supplied approved-looking preview. Preview creates no canonical items or success-mutation audits; failed apply leaves no partial items.

Use consistent envelopes and controlled status codes: 400 validation, 401 no identity, 403 insufficient permission, concealed cross-tenant 404, 409 revision/idempotency/conflict, 413 resource limit, 415 unsupported format, 500 sanitized internal failure. Failed extraction is also a recorded source-processing outcome, not silently an empty successful list. Genuine empty lists remain valid; malformed success envelopes throw client contract errors.

## 11. Portal workflow [I09]

Build a functional Sources/Intake area in project navigation and extend Intelligence Review without redesigning the whole portal.

Required UI:
- save/view/edit brief through immutable versions;
- actual supported-file upload with limits/help and visible errors;
- source inventory, version history, digest, actual processing state and original download;
- safe fragment/text inspection with locators;
- explicit capture form for key/category/value type/value/unit/source binding;
- explicit CSV/JSON mapping preview and confirm action;
- competing-candidate/source comparison and authorized decision actions;
- checklist editor and source-backed gap/summary views;
- material edit warnings, stale/reapproval indicators and stale-view conflict handling;
- history showing the exact approved source version and actor.

Wire all API-mode services through the existing authenticated `ApiClient`. Add multipart support without manually setting an invalid FormData Content-Type boundary; retain credentials and CSRF. Add download handling without leaking session tokens to URLs/storage.

Create/use a source-service interface through ServiceContext. API mode must not instantiate mock source/intelligence fallbacks. MOCK mode remains explicitly isolated and deterministic.

Handle project switching/session loss by clearing prior project content and cancelling/ignoring stale requests. Display distinct loading, genuinely empty, unsupported, failed and forbidden states. Do not leave prior-tenant source text visible after a failed new-project load.

Connect `NewProjectModal` to the real flow: after successful project creation, capture the supplied brief and actually upload selected files; filenames alone are not a completed upload. If a subsequent upload fails, keep the successfully created project, report the failed step and allow retry without duplicating the project. Do not claim atomicity across unrelated HTTP requests.

A form that is never wired into the actual App/ServiceProvider/navigation is incomplete.

## 12. Reference scenario [I10]

Create separate synthetic intake fixtures under `reference-library/northstar/m5-2/`. Do not edit RetailCo reference truth or its fingerprints.

Scenario: Northstar Retail / Holiday Peak 2027, intent FORECAST, with another isolated tenant for negative tests.

Put these explicitly fictional example values in fixture files only:

1. An ambiguous brief: 'Support 100,000 users and keep checkout fast.' Store faithfully. It must not automatically become concurrent users, VUs, an arrival rate or an approved latency target.
2. A forecast source explicitly stating 24,000 completed orders in the identified peak hour.
3. A separate stakeholder assertion of 30,000 completed orders for the same declared period/population. Explicitly map both to the same key; produce a conflict without choosing a winner.
4. A project checklist requiring peak business throughput and checkout latency. The missing latency value appears as a gap with no invented threshold.
5. A permitted reviewer resolves the peak-demand conflict and approves an explicitly supplied latency criterion. Record the exact source/actor/revision; an engineer cannot approve.
6. A new forecast version explicitly changes the peak figure to 36,000. Preserve the original bytes and decision but invalidate the affected current approval. A stale revision approval request fails.
7. Restart and prove all versions, bytes, provenance and states persist.

Add small real DOCX and text-PDF fixtures to test the actual parsers, plus CSV/JSON, malformed and no-text fixtures. Never embed real credentials/customer documents. Generated test assets are synthetic, not customer evidence.

No live k6 execution or final performance verdict is part of this scenario. Existing engine regression suites prove compatibility.

## 13. Verification matrix [I11]

Map every I01-I12 requirement to concrete test names and evidence in the completion report. Do not predeclare a fixed final test count.

Required tests:

- Source byte/digest fidelity, immutable versions, declared filename versus real upload distinction, cross-project reference constraints, restart durability.
- Actual supported parser behavior and source locators; corruption, unsupported format, no-text PDF, truncation, limit and timeout paths. Do not substitute mocked extractor tests for all real-format coverage.
- Authenticated cookie/CSRF multipart uploads, source reads/downloads, role matrix, cross-tenant direct-ID access, forged actor/approval/history/source references.
- Source assisted capture, manual attribution, explicit structured mapping, exact zero, absent unit, numeric-string preservation and no implicit free-text requirement invention.
- Matching-source corroboration versus retry duplicate, conflict creation, missing configured field, unconfigured checklist, exact persisted count definitions.
- Expected-revision checks; material-edit invalidation; source supersession; old source availability; exact selected-candidate binding; no inherited unit; blocked approval of missing/ambiguous/stale managed data.
- Source/audit, intelligence/audit and approval/audit failure-injection rollback. An import with one invalid row does not partially apply.
- Barrier-based concurrency: competing field edits, source replacement versus approval, same-key idempotent submissions. No successful decision may bind an unseen newer revision.
- API client multipart credentials/CSRF, envelope validation, error propagation and no mocks.
- Actual App/route-level UI interactions for capture/upload/mapping/review, not just isolated static text snapshots. Exercise with a DOM-capable harness and real API integration; use a browser smoke run when available and report it separately. Never label server-render/string assertions as a browser walkthrough.
- All historical M0-M5.1 regression suites remain valid; do not weaken tests or rewrite authoritative evidence to make intake pass.

## 14. Implementation order and delivery [I12]

Implement consecutive vertical slices with tests, within this one work package:

1. Source/revision contracts and bounded upload/text persistence + authorization/audit.
2. Parser adapters and source inspection endpoints.
3. Explicit mapping/import + intelligence revisions + conflict/approval/source-change rules.
4. Checklist/summary and complete portal wiring.
5. Northstar end-to-end reference, negative/concurrency tests, docs and clean CI.

Do not stop after scaffolding if the remaining work is implementable. Equally, do not claim completeness or hide failures if an environment/tool limitation prevents a required gate. Record the exact blocker and preserve completed work.

Create:
- `docs/intelligence/M5_2_INTAKE_ARCHITECTURE.md`
- `docs/intelligence/M5_2_API.md`
- `docs/intelligence/M5_2_OPERATOR_GUIDE.md`
- `docs/M5_2_COMPLETION_REPORT.md`

Document actual input support/limits, locators, state transitions, role permissions, source storage/backup implications, parsing limitations, idempotency, error semantics and tested workflow. Do not invent commands, response envelopes or future provider functionality. Examples must match source and executable tests.

Preserve the normal npm 10.9.8 root verification contract. After necessary dependency changes, commit manifests and the actual synchronized root `package-lock.json`. Check its committed blob and remote counterpart; `bun.lock` is not npm installation evidence.

From a fresh worktree/check-out of the committed revision run real:

```
npm ci
npm run lint
npm run test
npm run build
```

No dry-run substitution, fallback npm install in CI, force upgrades, hidden test exclusion or fake success. Include the new tests in the existing normal CI path. Do not unnecessarily start load-test workflows.

Commit/push through the available repository synchronization mechanism. Inspect the CI run bound to the actual remote SHA when possible. Local and remote SHAs may differ; report both accurately. If remote push/access is unavailable, give the exact limitation and local commit/file evidence rather than inventing a run ID or declaring remote success.

## 15. Definition of Done and scope guard

M5.2 is audit-ready only when I01-I12 are implemented and traced to verification: real source capture; supported extraction; durable versions and valid locators; explicit unapproved intelligence; truthful gaps/conflicts; version-safe human decisions; tenant/CSRF/audit protection; authenticated functional portal; actual reference/negative/concurrency tests; accurate docs; clean normal CI or an honestly reported external verification blocker (which does not count as closure).

No BYOAI/LLM calls, embeddings/vector search, live ADO/Jira/document connectors, URL scraping, OCR, unsupported format expansion, public authority website, billing, production runner orchestration, new workload math, final certification or evidence-package redesign. These remain separate decisions. No automatic migration of private Workspace material into app fixtures.

Return **M5.2 Completion Report for PM Audit** with:
- actual local/remote SHAs, base, lockfile blob, GitHub run/job and per-step outcomes;
- exact test counts by suite and warnings/advisories separately;
- I01-I12 requirement-to-test mapping;
- implemented endpoints/formats/limits and parser dependency versions;
- schema/revision/source binding decisions and operational storage tradeoffs;
- permission, rollback, concurrency, idempotency and source-change approval proofs;
- Northstar workflow evidence and UI test method;
- genuine limitations and deferred scope;
- confirmation no real k6 run, M5.3 or self-closure.

Do not author your own PM approval or closure record.

## Engineering reference links

Use primary documentation for implementation details; these do not replace PECP requirements:
- OWASP file upload guidance: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Fastify multipart documentation: https://github.com/fastify/fastify-multipart
- Maintainer multipart advisory to consider when selecting a patched compatible version: https://github.com/fastify/fastify-multipart/security/advisories/GHSA-vmph-573x-85f6
