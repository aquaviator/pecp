# PECP M5.2 Project Manager Review

## Decision and evidence scope

**M5.2: IN PROGRESS / NOT READY FOR CLOSURE.**

Review date: 2026-09-29.

The submitted update is accepted as a verified implementation increment, not proof that the entire Real Intelligence Intake, Source Provenance & Review work package is complete. Do not discard the substantial implementation or introduce M5.2.1. Continue M5.2 in place. M5.1 stays closed and M5.3 is not authorized.

This review inspects commit metadata, the baseline-to-implementation comparison, selected implementation source, the full governing work package, actual CI step results and job logs. It is not an independent local test run, PDF rendering exercise, browser walkthrough, exhaustive security assessment or production certification. Findings below are source-derived unless described as CI execution evidence. Existing code not discussed here is not automatically approved.

## 1. Authoritative remote verification

| Item | Observed reference/result |
| --- | --- |
| Repository / branch | aquaviator/pecp / master |
| Audited implementation | `03964df8f439cb9f2b7d32fff7a0903c99e57c2e` |
| Parent / work-package baseline | `932e489d79fbdc6baa3169a5ed5e5641323c16a8` |
| Workflow | CI |
| Run | `36544796876` |
| Job | `109328478487` |
| Conclusion | SUCCESS |
| Actual npm ci | PASS |
| Root TypeScript checks | PASS |
| Web | 30 files, 487 tests PASS |
| API/platform | 18 files, 95 tests PASS |
| Reference Lab | 10 tests PASS |
| Combined | 592 tests PASS |
| Production web build | PASS |

The CI job ran Node v22.23.2 and npm 10.9.8. Unlike previous milestones' failed dependency-delivery attempts, the current remote install is successful. Do not reopen that resolved lockfile issue without evidence of a new failure.

The test delta is exactly nine new parser tests in `apps/api/test/intake_parsers.test.ts`. Comparison with the work-package baseline shows no new web test file or full intake workflow/rollback/concurrency test suite in this implementation. The existing 487 web tests and historical API tests remain valuable regression coverage, but do not establish the new intake behavior required by I01-I12.

CI still reports two moderate dependency advisories and existing deprecation, experimental SQLite, browser-externalization and bundle-size warnings. Record them accurately; do not claim warning-free or vulnerability-free verification. This review does not determine the advisories' impact.

## 2. Implementation to preserve

The commit contains more than parser changes. Preserve the added source/intake domain contracts, SQLite migration and repositories, IntakeService, source/intelligence endpoints, source API adapter, SourcesIntakePage, App/navigation/ServiceContext wiring, NewProjectModal integration and Northstar fixture inputs.

Original-byte hashing and separate extraction-text hashing are visible in the source workflow. Preserve that distinction: a digest demonstrates identity of the hashed representation, not correctness of extracted text, authenticity of a claim or validity of a locator.

Do not rebuild authentication, replace the database architecture, rerun k6 or change historical RetailCo evidence. Correct the existing implementation and complete its required tests.

## 3. Parser validity, locators and enforceable limits [I01, I02, I11]

### PDF fallback manufactures successful, page-located evidence

Source: `apps/api/src/intake/parsers/PdfDocumentParser.ts`, the catch branch following `pdfParse()`.

After the actual parser rejects the file, the fallback scans the whole raw file for literal `(...) Tj` patterns, joins matches and returns SUCCESS with one fragment labelled `page:1`. The code does not establish that the text belongs to page 1. It also substitutes a one-page count if no page match exists. Mere occurrences of `/Pages` or `stream` can turn another parser failure into NO_EXTRACTABLE_TEXT.

The fallback SUCCESS path returns before the later page/output-limit checks. Generic limitations about diagrams and reading order do not disclose or repair this unproven page binding.

Required correction:

- Do not promote failed parser output to authoritative SUCCESS with invented page metadata.
- Remove this fixture-driven recovery from the governed extraction path, or keep any deliberately supported recovery explicitly non-authoritative and ineligible for source-backed approval until real structure/location is validated.
- Use valid synthetic PDF fixtures with sound structure rather than weakening production validation to accommodate handcrafted fixture errors.
- Prove real multi-page attribution, corrupt/truncated structure, valid no-text PDFs and page/output limits with regression tests. Merely finding expected text and the string `page:1` is insufficient.

### Timeout wrapper does not terminate parser work

Source: `apps/api/src/intake/parsers/DocumentParserRegistry.ts`.

The current registry calls parser.parse on the same execution path and races its promise against setTimeout. There is no worker/process termination or parser cancellation boundary. This does not meet the work package's explicit requirement to terminate CPU-bound parsing when the deadline is reached.

Use a bounded server-side execution mechanism with actual termination, cleanup and explicit timeout outcome. Keep parsing outside the SQLite write lock. Prove termination and absence of late successful writes, not just timer rejection.

### Complete the declared resource and format policies

The registry falls back to PLAIN_TEXT when unknown bytes decode as UTF-8. That is not a strict allowed-format/content-consistency rule; for example, invalid content declared as PDF must not quietly become an accepted plain-text source.

Enforce the existing supported-format policy consistently. Bound real UTF-8 byte length, not JavaScript string length labelled as bytes. Keep all successful and recovery paths under the same limits. Check limits before unbounded allocation where the work package requires it. Make documented operational limits genuinely configurable/validated instead of assuming the fixed INTAKE_LIMITS constants satisfy that requirement.

## 4. Source binding, typed values and approval validity [I01, I04, I05]

Source: `packages/platform-core/src/services/IntakeService.ts`, captureIntelligenceItem, updateIntelligenceItem, createSourceVersion and approveIntelligenceItem.

Observed gaps:

- Capture checks source/version existence but copies the supplied locator and excerpt without resolving them against the stored extraction or checking the quoted content.
- Update silently skips a proposed source binding if its source/version cannot be found, rather than rejecting the request.
- Existing and new values are converted using String(...) for equality. This collapses typed distinctions such as numeric 24000 versus string "24000", contrary to I05.
- The same-value path increments the revision and can add a new source binding without invalidating an existing approval.
- Source/material-edit invalidation clears approvedBy/approvedById/approvalDate, but leaves activeApprovalSnapshot on the current item.
- The inspected approval method blocks conflicting, ambiguous and stale states but does not explicitly reject MISSING/absent-value managed data or validate its referenced extraction/locator/current-source state before approval.

Required correction:

- Centralize project-scoped source-binding validation. Resolve source version, original digest, extraction identity, locator and optional exact excerpt; reject unresolved, invalid, foreign or unsupported references.
- Preserve value type and missing-unit semantics during comparison. Do not invent legacy candidate source names/locations to make a new managed record appear fully sourced.
- Bind each competing candidate to its own supporting immutable source references, not only to a field-wide list that does not identify which source supports the chosen value.
- Treat a material binding/candidate-set change as a new reviewable revision. Invalidate every current approval representation, including activeApprovalSnapshot; retain the prior approved state only as historical evidence.
- Validate managed-record approval/resolution eligibility inside the Unit of Work, including absence and source validity. Update both API adapters and UI precondition handling; do not leave an older route as a bypass.
- Prove rejected fake locators/excerpts, type-sensitive conflict handling, source supersession, selected-candidate provenance, absent units and reapproval end to end.

## 5. Revision preconditions, authorization and transactional decisions [I03, I05, I07]

Observed source patterns:

- createSourceVersion checks expectedRevision only when supplied, before entering the mutation Unit of Work.
- updateChecklist and approveIntelligenceItem also skip revision checks when expectedRevision is absent.
- Source aggregate-storage checks happen outside the write lock.
- assertProjectAccess relies on the supplied principal's membership snapshot. The membership repository is declared in dependencies but is not retained/used to refresh authority by IntakeService.
- The separate post-parse persistence transactions do not recheck current permission and workflow preconditions after waiting for extraction.

Required correction:

For new intake-managed state, require an explicit valid expected revision or the documented equivalent. Preserve the explicit legacy-reference compatibility boundary, not a universal optional-precondition bypass. Move relevant reads/checks and writes under the same serialized Unit of Work and re-evaluate current authority after waiting.

Prove competing source-version creation, checklist edits, field edits, source replacement versus approval, revoked write authority during parsing, aggregate quota races and failure rollback. No successful approval may bind content the reviewer did not inspect.

## 6. Structured import must consume the same source representation [I04, I08]

Source: IntakeService.previewImport and applyImport.

Observed gaps:

- CSV preview splits raw content on newlines and commas and trims/strips quotes, bypassing CsvDocumentParser. Quoted commas, multiline fields and whitespace therefore do not preserve the parser's record semantics.
- CSV preview uses rowIdx + 1 for data records while the parser test asserts data-record locator `row:1,col:2`; preview and extracted reference numbering are not consistently bound.
- JSON pointer traversal does not decode pointer escapes and uses broad Number/String coercions. Boolean/object/empty-string cases need explicit declared-type handling, not automatic conversion into plausible values.
- applyImport accepts mappingDigest and expectedRevisions, but does not compare the submitted mapping digest with the recomputed preview or enforce the expected revisions. It records the submitted digest in audit metadata instead. Despite its comment, preview is computed before entering the transaction.

Required correction:

Reuse one validated parsed record/pointer representation for extraction, preview, locators and apply. Preserve source strings until explicit supported type mapping is validated. Bind preview/apply to source version, mapping schema/digest, proposed payload and current field revisions. Revalidate at commit; reject tampered/stale confirmation and leave no partially applied intelligence or success audit.

Add quoted/multiline CSV, escaped JSON Pointer, invalid coercion, preview-tamper, stale-source/stale-field and all-or-nothing failure tests through the real API/service path.

## 7. Upload authorization and idempotency are not complete [I02, I03, I07, I08]

Source: `apps/api/src/app.ts`, source text/upload routes.

- The upload route calls request.file()/toBuffer() before calling the application service that enforces the target project's SOURCE_WRITE permission. Authentication alone is not this project permission check.
- Idempotency lookup/replay returns a stored result before the service's project authorization check.
- Idempotency persistence happens after source capture/extraction returns, outside the mutation transaction. Two simultaneous requests can both miss the entry and create separate source state; a failure after capture and before storing the replay record also leaves duplicate-retry risk.
- Upload replay digest uses file bytes without all semantic request metadata.

Required correction:

Authorize the target operation before consuming/buffering the file and reauthorize every replay. Implement an atomic scoped reservation/result protocol or equivalent so concurrent same-key requests cannot create duplicate versions/claims/success audits. Bind all relevant request fields, not bytes alone. Define crash/retry and pending-extraction behavior without claiming atomicity across separate HTTP requests or parser execution.

Keep source and extraction metadata, processing outcomes and audit writes transactionally consistent as already specified. Audit protected mutation denials through the established pattern. Sanitize errors/audit metadata; source content and raw parser diagnostics must not be exposed as uncontrolled operational error details.

## 8. Summary and checklist semantics need negative cases [I06]

In getIntakeReviewSummary, any uploaded-version extraction state other than SUCCESS or FAILED is counted as pending. Thus NO_EXTRACTABLE_TEXT can be shown as pending processing rather than a completed manual-review outcome.

Checklist evaluation currently checks field existence/review flags but does not enforce declared expected value-kind/unit, or recognize all missing-value cases independently of field existence.

Preserve explicit no-text/manual-review outcomes, genuinely pending work, failed work and success separately. Validate declared field contracts without inventing conversions or readiness. Show NOT_CONFIGURED for no effective required checklist and test exact count definitions.

## 9. End-to-end evidence and required documentation [I09-I12]

The source UI and service wiring are present. Do not report that they are absent. Their new functional behavior is not yet established by the unchanged web test suite.

The Northstar source fixture files exist, but the nine new tests read them to test parsers. They do not execute the required authenticated scenario from project creation through conflicting assertions, missing requirement, reviewer decision, supersession, stale approval rejection and restart of source bytes/revisions.

Complete the original I11 matrix, including:

- actual cookie/CSRF multipart API flow and protected original download;
- source, intelligence and approval audit-failure rollback;
- cross-project source/version/candidate/fragment rejection;
- concurrent source/field/approval and idempotency operations with real barriers;
- complete Northstar reference workflow;
- new DOM-capable portal interactions, real API integration, project-switch/session-loss state cleanup and upload retry without duplicate projects;
- malformed source-client envelopes and no mock fallback;
- explicit browser-smoke evidence only if actually run.

Do not chase a target test count. Supply I01-I12 -> concrete implementation -> named test -> observed result traceability. Keep historical tests, but do not present their existence as evidence of untested new behavior.

Direct reads at the audited SHA returned Not Found for docs/intelligence and docs/M5_2_COMPLETION_REPORT.md. Create the four required documents:

- `docs/intelligence/M5_2_INTAKE_ARCHITECTURE.md`
- `docs/intelligence/M5_2_API.md`
- `docs/intelligence/M5_2_OPERATOR_GUIDE.md`
- `docs/M5_2_COMPLETION_REPORT.md`

Use exact implemented commands, parser versions, formats/limits, locator conventions, response envelopes and state transitions. Separate input hash from extraction representation hash. Do not repeat the previous milestone's documentation-invention cycle.

## 10. Efficient continuation and acceptance boundary

This is one continuation of the existing M5.2 scope, not a new work package or a request to start over.

1. Add failing regressions for the identified parser/provenance and transaction/import gaps.
2. Correct the shared parser/binding/transaction paths rather than add special behavior for fixtures.
3. Prove the complete Northstar API journey, then portal interactions.
4. Complete requirement traceability and source-accurate documentation.
5. Run real npm ci, npm run lint, npm run test and npm run build in an isolated checkout of the committed revision.
6. Preserve the synchronized root lockfile and inspect normal GitHub CI for the actual delivered SHA.
7. Return an accurate M5.2 Completion Report for PM Audit with local/remote identities, test counts, warnings and named requirement evidence.

A future clean CI run remains necessary but is not alone sufficient for milestone closure. This progress review is intentionally not a claim that every remaining defect has been enumerated. The existing I01-I12 specification remains the acceptance checklist; no additional product capabilities are authorized here.

**Programme state: M5.1 CLOSED -> M5.2 substantial implementation, CI green, intake integrity and workflow verification incomplete -> M5.3 NOT STARTED.**
