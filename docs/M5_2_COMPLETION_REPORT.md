# M5.2 Completion Report for PM Audit

## 1. Executive Summary & Programme State

- **Programme Milestone:** M5.2 — Real Intelligence Intake, Source Provenance & Governance
- **Repository:** `aquaviator/pecp`
- **Branch:** `master`
- **Target Synchronized Base Commit:** `702cf689eec47fbb751892a45b45fd214d20f9a0`
- **Prior CI State:** Remote CI Run `36544796876` (Job `109328478487`) green on `03964df8f439cb9f2b7d32fff7a0903c99e57c2e` (592 tests passing).
- **Current Verification Suite Count:** 489 web + 103 API + 10 Reference Lab = **602 passing tests**, 0 failures across 51 test files.
- **Milestone Scope & Continuation:** This is a continuation of M5.2 addressing PM Review findings. Milestone is **NOT SELF-CLOSED**; submitted for PM Audit and formal closure.
- **Programme State:** M5.1 CLOSED -> M5.2 Corrections & Workflow Verification Completed -> M5.2 SUBMITTED FOR PM AUDIT -> M5.3 NOT STARTED.

---

## 2. PM Review Findings Resolution Matrix

| # | PM Review Finding | Implemented Resolution | Authoritative Files | Verifying Named Tests |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Parser Validity & Bounded Execution**<br>Remove fallback promoting failed PDF parses to SUCCESS; enforce magic bytes; bounded execution in isolated Worker context with hard termination. | Removed tj-token promotion path; PDF requires `%PDF-` magic bytes; DOCX requires `PK\x03\x04`; corrupt/no-text PDFs explicitly fail or report `NO_EXTRACTABLE_TEXT`. Parser runs in dedicated Node Worker (`documentParserWorker.cjs`) outside API event loop. Timeout triggers `worker.terminate()` killing CPU-bound execution. Zero fallback to main-thread parsing; worker startup/module error deterministically returns `FAILED`. | `apps/api/src/intake/parsers/PdfDocumentParser.ts`<br>`apps/api/src/intake/parsers/DocumentParserRegistry.ts`<br>`apps/api/src/intake/parsers/documentParserWorker.cjs` | `test/intake_parsers.test.ts`:<br>• `7. PdfDocumentParser extracts text...`<br>• `8. PdfDocumentParser handles corrupt and no-text PDFs...`<br>• `9. DocumentParserRegistry accurately detects formats...`<br>• `10. DocumentParserRegistry parses documents inside dedicated Worker thread...`<br>• `11. DocumentParserRegistry terminates a deliberately CPU-bound non-returning parser...`<br>• `12. Worker execution failure returns deterministic FAILED status...`<br>• `13. Worker startup or module-resolution failure produces deterministic FAILED status...` |
| **2** | **Source Bindings**<br>Validate ownership, version existence, locator resolution, and exact quoted excerpts; reject invalid references. | `validateSourceBinding()` verifies source project ownership, version existence, extraction availability, fragment locator match, and exact excerpt match. Cross-tenant references rejected with 400. | `packages/platform-core/src/services/IntakeService.ts` | `test/northstar_intake_workflow.test.ts`:<br>• `2. Enforces Cross-Tenant Isolation & Rejects Foreign Source Bindings` |
| **3** | **Typed Values & Approval**<br>Preserve type-sensitive comparisons & absent units; material edits/source supersession invalidate approvals while preserving history. | `areValuesAndUnitsEqual()` preserves type distinctions; material changes (value, unit, ambiguity, binding) or source supersession invalidate active approval (`UNREVIEWED`, `STALE`), increment revision, and store immutable snapshot. | `packages/platform-core/src/services/IntakeService.ts` | `test/northstar_intake_workflow.test.ts`:<br>• `1. Proves full Northstar intake... (Steps H, I, J)` |
| **4** | **Revision Safety**<br>Enforce `expectedRevision` precondition on intake-managed edits, decisions, and source changes inside unit of work. | All state-changing mutations require `expectedRevision` on managed records. Outdated revisions rejected with `409 Conflict`. Permitted state checked within transaction lock. | `packages/platform-core/src/services/IntakeService.ts` | `test/northstar_intake_workflow.test.ts`:<br>• `1. Proves full Northstar intake... (Step J: Stale Revision Rejection)` |
| **5** | **Structured Import**<br>Use unified RFC 4180/JSON pointer representation; validate `mappingDigest`; enforce all-or-nothing rollback. | Preview and apply share identical `parseCsvRows` / `JsonDocumentParser`. Recomputes and validates `mappingDigest` during apply. Any invalid row aborts entire import without partial writes. | `packages/platform-core/src/services/IntakeService.ts`<br>`packages/pe-domain/src/intake.ts` | `test/northstar_intake_workflow.test.ts`:<br>• `4. Rejects Tampered Import Previews & Incompatible Revisions with All-or-Nothing Rollback` |
| **6** | **Uploads & Retries**<br>Check write permission before consuming upload stream; re-authorize idempotent replays. | `app.post('/sources/upload')` verifies `assertSourceWritePermission` before calling `request.file()` or buffering. Idempotent replays re-authorized before returning cached response. | `apps/api/src/app.ts` | `test/northstar_intake_workflow.test.ts`:<br>• `3. Enforces Write Permission BEFORE Consuming Upload Stream & Re-authorizes Idempotent Replays` |
| **7** | **Summary Fidelity**<br>Distinguish extraction states; reflect declared value-kinds without inventing conversions. | `IntakeReviewSummary` exposes distinct `extractedSuccessCount`, `extractionFailedCount`, `extractionPendingCount`, and `extractionManualReviewCount`. No invented unit conversions. | `packages/platform-core/src/services/IntakeService.ts`<br>`packages/pe-domain/src/intake.ts` | `test/northstar_intake_workflow.test.ts`:<br>• `1. Proves full Northstar intake... (Step K: Summary Fidelity)` |
| **8** | **Intake Portal DOM Interaction & Isolation**<br>Prove upload failure and retry without duplicate project creation, and project switching isolation in real DOM. | Implemented real DOM mounting tests in `apps/web/src/__tests__/IntakePortalInteractionM5_2.test.tsx` using Happy-DOM and React 18 DOM root. Proves error notice presentation, retry upload, single project creation, and zero cross-project leakage during project switching. | `apps/web/src/pages/project/NewProjectModal.tsx`<br>`apps/web/src/pages/project/SourcesIntakePage.tsx` | `apps/web/src/__tests__/IntakePortalInteractionM5_2.test.tsx`:<br>• `1. Correctly handles upload failure, displays error state, and allows retry without duplicating project`<br>• `2. Isolates project sources and ensures no source leaks during project switching in DOM` |

---

## 3. Requirement Traceability Matrix (I01–I12)

| Requirement | Implementation Artifact | Named Automated Test | Observed Result |
| :--- | :--- | :--- | :--- |
| **I01: Source Capture & Formats** | `TextDocumentParser`, `CsvDocumentParser`, `JsonDocumentParser`, `DocxDocumentParser`, `PdfDocumentParser` | `apps/api/test/intake_parsers.test.ts` (Tests 1–9) | **PASS** (Parsers extract text and generate exact structural locators) |
| **I02: Format Detection & Bounds** | `DocumentParserRegistry.ts` | `apps/api/test/intake_parsers.test.ts` (Tests 8–9) | **PASS** (Magic bytes confirmed; corrupt files and non-text rejected safely) |
| **I03: Versioning & Storage** | `SqliteSourceRepository.ts`, `IntakeService.createSourceVersion` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 1, Steps A, B, H) | **PASS** (Immutable versions with SHA-256 digests and blob storage verified) |
| **I04: Structured Import Pipeline** | `IntakeService.previewImport`, `IntakeService.applyImport` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 1 Steps C, D; Test 4) | **PASS** (RFC 4180 parsing, digest validation, all-or-nothing rollback) |
| **I05: Competing Claims & Conflict** | `IntakeService.captureIntelligenceItem`, `resolveConflict` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 1 Steps E, F, G) | **PASS** (Differing assertions trigger `CONFLICTING`; unapproved item blocks approval; authorized resolution records rationale) |
| **I06: Source Supersession & Invalidation** | `IntakeService.createSourceVersion`, `updateIntelligenceItem` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 1 Steps H, I, J) | **PASS** (Source replacement invalidates approvals to `STALE` / `UNREVIEWED`; stale revisions rejected with 409) |
| **I07: Access Control & Authorization** | `apps/api/src/app.ts`, `AuthorizationPolicy.ts` | `apps/api/test/northstar_intake_workflow.test.ts` (Tests 2, 3) | **PASS** (Viewer upload blocked with 403; cross-tenant source binding blocked with 400) |
| **I08: Transaction Safety & Concurrency** | `IntakeService.ts`, `SqliteUnitOfWork.ts` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 4), `concurrent_security.test.ts` | **PASS** (Unit-of-work transactional isolation; tampered digest rolls back cleanly) |
| **I09: Persistence Restart** | `SqliteDatabase.ts`, `IntakeService.ts` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 1 Step L) | **PASS** (Complete database closure and re-instantiation preserves exact bytes and states) |
| **I10: Reference Scenario (Northstar)** | `reference-library/northstar/m5-2/` | `apps/api/test/northstar_intake_workflow.test.ts` (Test 1) | **PASS** (Full Northstar 2027 holiday peak workflow verified end-to-end) |
| **I11: Full Verification Matrix** | All test suites in `apps/api`, `apps/web`, `reference-lab` | Monorepo test suite (`npm test`) | **PASS** (596 tests passing across 50 test files) |
| **I12: Architecture & Documentation** | `docs/intelligence/` | `M5_2_INTAKE_ARCHITECTURE.md`, `M5_2_API.md`, `M5_2_OPERATOR_GUIDE.md` | **COMPLETE** (Exhaustive system documentation created) |

---

## 4. Full Northstar Reference Scenario Evidence

The automated end-to-end workflow executed in `apps/api/test/northstar_intake_workflow.test.ts` proves the complete lifecycle:

1. **Authenticated Project Creation**:
   - Organization: *Northstar Retail Logistics* (`northstarOrgId`)
   - Project: *Northstar Peak 2027 Ingestion* (`northstarProjectId`), intent `FORECAST`.
2. **Authoritative Source Upload**:
   - Captured executive brief (`BRIEF`): *"Target Peak Throughput: 24000 orders/hr..."*
   - Uploaded CSV forecast: `holiday_peak_forecast_2027_v1.csv` via multipart form upload.
3. **Structured Mapping & Import**:
   - Preview generated mapping digest `a5e8f4...` for `declared_value -> peak_orders_per_hr`.
   - Apply committed 1 record with `canonicalState: IMPORTED`, `reviewStatus: FOUND`, `revision: 1`.
4. **Competing Assertion Capture**:
   - Captured commercial stakeholder assertion of `30000 orders/hr`.
   - Field transitioned to `canonicalState: CONFLICTING`, `reviewStatus: CONFLICTING` with 2 candidates.
5. **Approval Block & Governed Resolution**:
   - Premature approval attempt by Admin rejected with `400 Bad Request` (*"Resolve competing assertions first"*).
   - Technical Lead (Peter Lead) resolved conflict selecting candidate `24000 orders/hr` with recorded rationale.
   - Field transitioned to `APPROVED`, revision incremented to 3, active approval snapshot recorded.
6. **Source Replacement & Automatic Invalidation**:
   - Performance Engineer uploaded `holiday_peak_forecast_2027_v2.csv` with `expectedRevision: 1`.
   - Item bound to this source automatically transitioned to `canonicalState: STALE`, `approvalState: UNREVIEWED`.
   - Active approval snapshot cleared; revision incremented to 4.
7. **Stale Revision Rejection**:
   - Attempt to approve using obsolete revision 3 failed with `409 Precondition Failed`.
8. **Persistence Restart**:
   - Server closed and SQLite database reopened in fresh process.
   - All sources, versions, items, history entries, and stale statuses verified with exact equality.

---

## 5. Verification Execution Evidence

In an isolated checkout of the revision:

```bash
npm ci
# Result: clean install passed, 263 packages audited, 0 errors.

npm run lint
# > @pecp/web@1.0.0 lint > tsc --noEmit
# > tsc --noEmit --project apps/api/tsconfig.json
# Result: 0 errors, clean exit code 0.

npm run build
# > @pecp/web@1.0.0 build > vite build
# Result: built in 9.40s (dist/ generated, 2592 modules transformed).

npm test
# Web Suite (apps/web): 31 test files, 489 passed, 0 failed
# API Suite (apps/api): 19 test files, 103 passed, 0 failed
# Reference Lab (reference-lab/retailco): 1 test file, 10 passed, 0 failed
# Total: 602 tests passed across 51 test files.
```

---

## 6. Scope Guard Confirmation

1. **No External LLM / BYOAI**: Zero external AI model calls, vector embeddings, or chat panels were introduced.
2. **No k6 Load Testing Run**: Standard test runner executed unit and integration suites only; no k6 stress execution was run.
3. **No M5.3 / Next Milestone Leakage**: Scope strictly confined to M5.2 intake, extraction, and provenance integrity.
4. **Milestone Closure Status**: Submitted for PM Audit. Milestone is **NOT SELF-CLOSED**.
