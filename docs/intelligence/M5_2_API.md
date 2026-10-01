# M5.2 Real Intelligence Intake & Provenance API Specification

## 1. Authentication & Security Headers

All intake and intelligence endpoints require authenticated identity and enforce role-based access control (RBAC).

- **Bearer Token**: `Authorization: Bearer <raw_session_token>`
- **Cookie Session**: Cookie `pecp_session=<token>` accompanied by `X-PECP-CSRF: <csrf_token>` on state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Idempotency**: `Idempotency-Key: <uuid>` or `X-Idempotency-Key: <uuid>`.

---

## 2. Source Management Endpoints

### 2.1 List Project Sources
`GET /api/v1/projects/:projectId/sources`
- **Permission**: `INTELLIGENCE_READ` or `PROJECT_VIEW`
- **Response `200 OK`**:
```json
{
  "items": [
    {
      "id": "src-9b48c1e2",
      "projectId": "proj-northstar-1",
      "title": "Holiday Peak Forecast 2027",
      "kind": "UPLOAD",
      "format": "CSV",
      "currentVersionNumber": 1,
      "currentVersionId": "ver-a4f78129",
      "createdAt": "2027-10-01T12:00:00.000Z",
      "updatedAt": "2027-10-01T12:00:00.000Z"
    }
  ]
}
```

### 2.2 Capture Text/Brief Source
`POST /api/v1/projects/:projectId/sources/text`
- **Permission**: `SOURCE_WRITE` (`PERFORMANCE_ENGINEER`, `PERFORMANCE_LEAD`, `ORG_ADMIN`, `PLATFORM_ADMIN`)
- **Request Body**:
```json
{
  "title": "Executive Performance Brief",
  "text": "Support 100,000 concurrent sessions during Cyber Monday peak.",
  "kind": "BRIEF",
  "suppliedSpeaker": "Head of Retail",
  "suppliedAuthoredAt": "2027-10-01T09:00:00.000Z"
}
```
- **Response `201 Created`**:
```json
{
  "source": { ... },
  "version": { ... },
  "extraction": { ... }
}
```

### 2.3 Upload File Source
`POST /api/v1/projects/:projectId/sources/upload`
- **Permission**: `SOURCE_WRITE` (Verified **before** multipart payload is consumed).
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Raw binary or text payload (up to 10 MiB limit).
  - `title` (optional): Human-readable title.
- **Supported Formats**: CSV, JSON, DOCX, PDF, PLAIN_TEXT.
- **Response `201 Created`**: Returns `{ source, version, extraction }`.

### 2.4 Create New Source Version (Source Replacement)
`POST /api/v1/projects/:projectId/sources/:sourceId/versions`
- **Permission**: `SOURCE_WRITE`
- **Body / Multipart Fields**:
  - `file` / `text`: Revised content.
  - `expectedRevision`: **Required**. Current `currentVersionNumber` of the source (optimistic locking).
- **Side Effect**: Invalides approvals on all intelligence items bound to this source, setting their state to `STALE` and `UNREVIEWED`.
- **Response `201 Created`**: Returns `{ version, extraction }`.

### 2.5 Retrieve Raw Source Content
`GET /api/v1/projects/:projectId/sources/:sourceId/versions/:versionId/content`
- **Permission**: `INTELLIGENCE_READ`
- **Response `200 OK`**: Returns raw binary stream with appropriate `Content-Type` and `Content-Disposition`.

### 2.6 Retrieve Extraction Result
`GET /api/v1/projects/:projectId/sources/:sourceId/versions/:versionId/extraction`
- **Permission**: `INTELLIGENCE_READ`
- **Response `200 OK`**:
```json
{
  "id": "ext-6218dafe",
  "sourceVersionId": "ver-a4f78129",
  "parserId": "pecp-csv-parser",
  "parserVersion": "1.0.0",
  "status": "SUCCESS",
  "plainText": "...",
  "fragments": [
    {
      "id": "frag-1",
      "locator": "row:1,col:2",
      "text": "24000",
      "characterRange": [30, 35]
    }
  ],
  "contentDigest": "sha256:...",
  "extractedAt": "2027-10-01T12:00:01.000Z"
}
```

---

## 3. Intelligence & Provenance Endpoints

### 3.1 List Intelligence Items
`GET /api/v1/projects/:projectId/intelligence`
- **Permission**: `INTELLIGENCE_READ`
- **Query Parameters**:
  - `category` (optional): Filter by `WORKLOAD`, `REQUIREMENTS`, etc.
  - `canonicalState` (optional): Filter by `IMPORTED`, `APPROVED`, `CONFLICTING`, `STALE`, `MANUAL`.
- **Response `200 OK`**: `{ items: [...] }`

### 3.2 Capture Intelligence Item / Assertion
`POST /api/v1/projects/:projectId/intelligence`
- **Permission**: `INTELLIGENCE_WRITE`
- **Request Body**:
```json
{
  "key": "peak_orders_per_hr",
  "title": "Peak Orders per Hour",
  "category": "WORKLOAD",
  "value": 24000,
  "unit": "orders/hr",
  "sourceBinding": {
    "sourceId": "src-9b48c1e2",
    "sourceVersionId": "ver-a4f78129",
    "locator": "row:1,col:2",
    "excerpt": "24000"
  }
}
```
- **Response `201 Created`**: Returns created or updated `IntelligenceItem`. If a differing value already exists, transitions item to `CONFLICTING`.

### 3.3 Update Intelligence Item
`PATCH /api/v1/projects/:projectId/intelligence/:itemId`
- **Permission**: `INTELLIGENCE_WRITE`
- **Request Body**:
```json
{
  "expectedRevision": 2,
  "title": "Peak Orders per Hour (Revised)",
  "value": 26000,
  "unit": "orders/hr"
}
```
- **Response `200 OK`**: Returns updated item with incremented revision. Material changes invalidate active approvals.

### 3.4 Resolve Conflicting Intelligence Item
`POST /api/v1/projects/:projectId/intelligence/:itemId/resolve`
- **Permission**: Requires **both** `INTELLIGENCE_RESOLVE` and `INTELLIGENCE_APPROVE` (`PERFORMANCE_LEAD`, `ORG_ADMIN`, `PLATFORM_ADMIN`).
- **Request Body**:
```json
{
  "chosenCandidateId": "cand-9f81a7b2",
  "expectedRevision": 2,
  "rationale": "Accepted certified forecast CSV over informal stakeholder brief."
}
```
- **Response `200 OK`**: Transitions item to `APPROVED` / `FOUND`, creates `activeApprovalSnapshot`, and appends resolution audit entry.

### 3.5 Approve Intelligence Item
`POST /api/v1/projects/:projectId/intelligence/:itemId/approve`
- **Permission**: `INTELLIGENCE_APPROVE`
- **Request Body**:
```json
{
  "expectedRevision": 3
}
```
- **Response `200 OK`**: Returns approved item. Fails with `400` if item is `CONFLICTING`, `AMBIGUOUS`, `STALE`, or missing a value. Fails with `409` if `expectedRevision` does not match current item revision.

---

## 4. Structured Import Endpoints

### 4.1 Preview Structured Import
`POST /api/v1/projects/:projectId/intelligence/import-preview`
- **Permission**: `INTELLIGENCE_READ`
- **Request Body**:
```json
{
  "sourceId": "src-9b48c1e2",
  "sourceVersionId": "ver-a4f78129",
  "mappings": [
    {
      "sourceColumnOrKey": "declared_value",
      "targetKey": "peak_orders_per_hr",
      "title": "Peak Orders per Hour",
      "category": "WORKLOAD",
      "valueKind": "NUMBER",
      "unit": "orders/hr"
    }
  ]
}
```
- **Response `200 OK`**:
```json
{
  "sourceId": "src-9b48c1e2",
  "sourceVersionId": "ver-a4f78129",
  "sourceVersionNumber": 1,
  "sourceDigest": "sha256:...",
  "format": "CSV",
  "proposedItems": [
    {
      "key": "peak_orders_per_hr",
      "title": "Peak Orders per Hour",
      "category": "WORKLOAD",
      "value": 24000,
      "unit": "orders/hr",
      "sourceLocation": "row:1,col:2",
      "excerpt": "24000"
    }
  ],
  "validCount": 1,
  "invalidCount": 0,
  "mappingDigest": "a5e8f4..."
}
```

### 4.2 Apply Structured Import
`POST /api/v1/projects/:projectId/intelligence/import-apply`
- **Permission**: `INTELLIGENCE_WRITE`
- **Request Body**:
```json
{
  "sourceId": "src-9b48c1e2",
  "sourceVersionId": "ver-a4f78129",
  "mappings": [ ... ],
  "mappingDigest": "a5e8f4...",
  "expectedRevisions": {
    "peak_orders_per_hr": 1
  }
}
```
- **Response `201 Created`**:
```json
{
  "appliedCount": 1,
  "items": [ ... ]
}
```
- **Failure Modes**:
  - `409 Conflict`: `mappingDigest` does not match recomputed digest (tampering/stale preview) or `expectedRevisions` mismatch.
  - `400 Bad Request`: `invalidCount > 0` (strict all-or-nothing rollback).

---

## 5. Summary & Requirements Endpoints

### 5.1 Intelligence Requirements Checklist
`GET /api/v1/projects/:projectId/intelligence-requirements`
`PUT /api/v1/projects/:projectId/intelligence-requirements`
- Manages the required field definitions for the project, declared value kinds (`NUMBER` vs `STRING`), required units, and gap criteria.

### 5.2 Intake Review Summary
`GET /api/v1/projects/:projectId/intelligence-intake-summary`
- **Permission**: `INTELLIGENCE_READ`
- **Response `200 OK`**:
```json
{
  "policyVersion": "1.0.0",
  "projectId": "proj-northstar-1",
  "uploadedFilesCount": 1,
  "extractedSuccessCount": 1,
  "extractionFailedCount": 0,
  "extractionPendingCount": 0,
  "extractionManualReviewCount": 0,
  "briefSourcesCount": 1,
  "manualAssertionsCount": 0,
  "totalIntelligenceFields": 1,
  "fieldsByCategory": {
    "WORKLOAD": 1,
    "REQUIREMENTS": 0,
    ...
  },
  "unreviewedFieldsCount": 1,
  "approvedFieldsCount": 0,
  "conflictingFieldsCount": 0,
  "ambiguousFieldsCount": 0,
  "staleFieldsCount": 0,
  "requiredFieldsCount": 4,
  "missingRequiredFieldsCount": 3,
  "gaps": [ ... ]
}
```
