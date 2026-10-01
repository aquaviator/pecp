# M5.2 Real Intelligence Intake, Source Provenance & Governance Architecture

## 1. System Overview & Purpose

Milestone 5.2 establishes the authoritative **Intelligence Intake, Extraction, and Provenance** layer in the Performance Engineering Control Plane (`aquaviator/pecp`). It transforms unverified stakeholder text, specifications, and data files into governed, auditable performance intelligence candidates with verifiable source bindings.

The architecture enforces strict provenance: every intelligence value must trace to an exact byte-level or structural locator in an immutable, tenant-isolated source version. Material edits, competing assertions, and source replacements trigger deterministic governance state transitions and approval invalidations.

---

## 2. Document Parsers & Extraction Engine

The platform provides a pluggable, bounded-execution document parsing registry (`DocumentParserRegistry`) supporting five canonical source formats:

| Format | Extension / MIME | Parser Implementation | Parser Version | Resource Limit | Locator Convention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PLAIN_TEXT** | `.txt`, `.md`, `text/plain`, `text/markdown` | `TextDocumentParser` | `1.0.0` | 512 KiB | `char:<start>-<end>` |
| **CSV** | `.csv`, `text/csv` | `CsvDocumentParser` | `1.0.0` | 10 MiB | `row:<r>,col:<c>` |
| **JSON** | `.json`, `application/json` | `JsonDocumentParser` | `1.0.0` | 10 MiB | RFC 6901 JSON Pointer (e.g. `/sla/p95_ms`) |
| **DOCX** | `.docx`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `DocxDocumentParser` | `1.0.0` | 10 MiB | `p:<index>` |
| **PDF** | `.pdf`, `application/pdf` | `PdfDocumentParser` | `1.1.1` | 10 MiB | `page:<page_number>` |

### 2.1 Format Detection & Magic Byte Verification
Format detection avoids naive file extension reliance:
- **PDF**: Confirms leading magic bytes `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`). Files named `.pdf` without this signature are rejected with `UNSUPPORTED_MEDIA_TYPE`.
- **DOCX**: Confirms standard PK zip signature (`PK\x03\x04`). Rejects corrupted or encrypted ZIP archives safely.
- **CSV / JSON / Plain Text**: Validates UTF-8 encoding and schema structure.

### 2.2 Bounded Server-Side Execution
- Synchronous parser execution is bound to a default timeout of 15,000 ms.
- Parsing failures, password-protected files, or empty text streams produce explicit non-success states (`FAILED`, `NO_EXTRACTABLE_TEXT`, `NEEDS_MANUAL_REVIEW`) and never promote corrupt documents to `SUCCESS`.

---

## 3. Immutable Source Versioning & Storage

Sources are organized under projects with immutable versioning:

1. **Source Metadata (`SourceMetadata`)**:
   - `id`: Globally unique identifier (`src-<uuid>`)
   - `projectId`: Tenant-isolated project scope
   - `kind`: `UPLOAD`, `BRIEF`, or `MANUAL_ASSERTION`
   - `format`: Declared and verified format
   - `currentVersionNumber`: Monotonically increasing version counter
   - `currentVersionId`: Active version pointer

2. **Source Version (`SourceVersion`)**:
   - `id`: Unique version identifier (`ver-<uuid>`)
   - `versionNumber`: Sequence number (1, 2, ...)
   - `sha256`: Cryptographic content hash of the raw byte buffer
   - `byteSize`: Raw payload length
   - `extractionId`: Pointer to deterministic extraction result
   - `extractionStatus`: `PENDING`, `SUCCESS`, `FAILED`, `NO_EXTRACTABLE_TEXT`, `NEEDS_MANUAL_REVIEW`

3. **Blob Storage**:
   - Blobs are persisted in SQLite blob storage (`source_blobs`) keyed by `(project_id, source_id, version_id)`.
   - Content retrieval requires authenticated project read permission (`INTELLIGENCE_READ` / `PROJECT_VIEW`).

---

## 4. Source Binding & Provenance Validation

Every intelligence item or candidate can bind to one or more sources via `SourceBindingReference`:

```typescript
export interface SourceBindingReference {
  projectId: string;
  sourceId: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
  originalSha256: string;
  extractionId: string;
  locator: string;
  excerpt?: string;
}
```

### 4.1 Binding Integrity Rules (`validateSourceBinding`)
When a binding is created or updated, the system strictly validates:
1. **Tenant & Project Ownership**: The referenced `sourceId` must belong to the caller's active `projectId`. Cross-tenant or foreign project references are rejected with `400 Bad Request`.
2. **Version Existence**: The referenced `sourceVersionId` must exist on the specified source.
3. **Extraction Existence**: The referenced version must have a completed `ExtractionResult`.
4. **Locator Resolution**: The specified `locator` must resolve to an actual `ExtractedFragment` in the extraction result.
5. **Exact Excerpt Corroboration**: If an `excerpt` string is provided, it must match the text at the resolved locator or within the extracted text.

---

## 5. Competing Assertions & Conflict Governance

Performance intelligence frequently involves competing claims from different stakeholders (e.g. commercial forecasts vs. engineering observations).

### 5.1 Candidate Provenance
When competing assertions are captured for the same field key:
- Each claim is retained as an independent `IntelligenceCandidate`.
- Each candidate preserves its own `source`, `sourceDocument`, `sourceLocation`, `value`, `unit`, and `sourceBindings`.
- The aggregate item transitions to:
  - `canonicalState`: `CONFLICTING`
  - `reviewStatus`: `CONFLICTING`
  - `approvalState`: `UNREVIEWED` (any prior approval is immediately invalidated)

### 5.2 Conflict Resolution Law
- Items in `CONFLICTING` status **cannot be approved directly**.
- Resolving a conflict requires explicit invocation of `/api/v1/projects/:projectId/intelligence/:itemId/resolve` by an actor with both `INTELLIGENCE_RESOLVE` and `INTELLIGENCE_APPROVE` permissions (`PERFORMANCE_LEAD`, `ORG_ADMIN`, or `PLATFORM_ADMIN`).
- Resolution records:
  - `chosenCandidateId`: The selected candidate
  - `rationale`: Authoritative justification for the selection
  - `expectedRevision`: Revision precondition check preventing race conditions

---

## 6. Approval Invalidation & Revision Preconditions

### 6.1 Approval Snapshot Invariance
Approved intelligence items contain an `activeApprovalSnapshot` recording:
- `revision`: Item revision at time of approval
- `approvedAt`: ISO timestamp
- `approvedByUserId`: User ID of approving authority
- `approvedByUserDisplayName`: Display name of approving authority
- `boundSourceVersionIds`: Array of source versions supporting the approval
- `value`: Approved typed value
- `unit`: Approved unit of measurement

### 6.2 Deterministic Invalidation Invariants
A current approval is invalidated (`approvalState -> UNREVIEWED`, clearing `approvedBy` and `activeApprovalSnapshot`) whenever:
1. **Material Value/Unit Change**: The item's value or unit is modified.
2. **Ambiguity Flagging**: The item is flagged with an ambiguity reason.
3. **New Source Binding**: A source binding is added or modified.
4. **Source Supersession**: An underlying source version bound to the item is superseded by a newer version (`createSourceVersion`). The item transitions to `canonicalState: STALE` and `reviewStatus: STALE`.

Historical approval decisions and snapshots are preserved in the immutable revision history (`intelligence_revisions`) and cannot be altered.

### 6.3 Concurrency & Revision Safety
Every state-changing mutation on an intake-managed record (`updateIntelligenceItem`, `resolveConflict`, `approveIntelligenceItem`, `createSourceVersion`) enforces an optimistic concurrency check against `expectedRevision`. If the current revision does not match the submitted revision, the mutation fails with `409 Conflict`.

---

## 7. Structured Import Pipeline (CSV & JSON)

The platform supports governed, bulk ingestion of structured metrics and requirements through an all-or-nothing two-phase workflow:

1. **Phase 1: Preview (`POST /intelligence/import-preview`)**:
   - Parses the underlying source version using the canonical parser (`parseCsvRows` or `JsonDocumentParser`).
   - Resolves columns or RFC 6901 JSON pointers (`~1` for `/`, `~0` for `~`).
   - Validates typed values (`NUMBER` vs `STRING`), finite numeric limits, and target keys.
   - Computes a SHA-256 `mappingDigest` over the normalized mapping specification.
   - Returns valid and invalid counts, along with extracted proposed items.

2. **Phase 2: Apply (`POST /intelligence/import-apply`)**:
   - Executes inside a transactional `Unit of Work`.
   - Recomputes the preview from the raw source bytes and validates that `mappingDigest` matches the client submission (preventing preview tampering or schema drift).
   - Aborts with `400 Bad Request` if any row is invalid (strict all-or-nothing guarantee; no partial writes).
   - Validates optional `expectedRevisions` for each target field key.
   - Persists intelligence items with exact source bindings and records an `INTELLIGENCE_IMPORT` audit event.

---

## 8. Upload Safety & Idempotent Retries

1. **Pre-Consumption Authorization**:
   - Multipart file upload routes verify `SOURCE_WRITE` permissions before invoking `request.file()` or buffering payloads, preventing unauthorized denial-of-service or memory consumption.

2. **Idempotency & Concurrent Retries**:
   - Upload and mutation requests support `Idempotency-Key` / `X-Idempotency-Key`.
   - The scoped key `${projectId}:${userId}:${action}:${key}` stores the SHA-256 payload hash, response status, and response JSON.
   - Replays with identical payload hashes re-authorize the caller and return the cached response without duplicate side effects or project creation. Replays with differing payloads fail with `409 Conflict`.
