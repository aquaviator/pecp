# M5.2 Performance Intelligence Intake & Provenance Operator Guide

## 1. Introduction & Operator Responsibilities

This guide provides operational procedures for **Performance Engineers**, **Technical Leads**, and **Organisation Administrators** using the PECP Intelligence Intake & Provenance system.

Operators are responsible for:
1. Ingesting authoritative performance specifications, forecasts, and stakeholder briefs.
2. Mapping extracted data fragments to canonical workload and requirement fields.
3. Reviewing conflicting claims and issuing governed resolutions with clear rationales.
4. Ensuring that all required intelligence fields meet checklist criteria before advancing a project to execution.

---

## 2. Ingesting Documents & Briefs

### 2.1 File Upload Limits & Supported Types
Always ensure ingested files comply with format restrictions:
- **Maximum File Size**: 10 MiB per file.
- **Supported File Types**:
  - `CSV`: Metrics tables, hourly forecast curves, transactional logs.
  - `JSON`: Non-functional requirement specifications, architectural configuration.
  - `DOCX`: Architectural design documents, vendor contracts.
  - `PDF`: Published specifications, SLA agreements.
  - `TXT` / `MD`: Raw interview transcripts, executive briefs (up to 512 KiB).

### 2.2 Uploading via Web Portal
1. Navigate to the project’s **Intake & Sources** tab.
2. Click **Upload Source Document**.
3. Select the file and provide a descriptive title (e.g. *Northstar 2027 Holiday Peak Forecast*).
4. The system validates write permissions and extracts plain text and locators automatically.
5. Verify that the extraction status displays **SUCCESS**. If status displays **NEEDS_MANUAL_REVIEW** or **NO_EXTRACTABLE_TEXT** (e.g. scanned image PDF without OCR), provide manual assertions with exact text citations.

---

## 3. Structured Data Import (CSV & JSON)

When ingesting tabular or hierarchical files, use the **Structured Import Pipeline** rather than entering individual fields manually:

1. Click **Import from Source** next to the uploaded CSV or JSON file.
2. Define field mappings:
   - For CSV: Select the column header containing the metric (e.g. `declared_value`).
   - For JSON: Enter the RFC 6901 JSON Pointer (e.g. `/sla/p95_checkout_latency_ms`).
   - Select the target field key (e.g. `peak_orders_per_hr`), category (`WORKLOAD`), value kind (`NUMBER` or `STRING`), and unit (`orders/hr`).
3. Click **Preview Import**:
   - Inspect the extracted values and locators (`row:1,col:2`).
   - Check that `Invalid Rows: 0`.
4. Click **Apply Import**:
   - The platform verifies the cryptographic mapping digest and commits all records atomically.

---

## 4. Resolving Competing Assertions (Conflicts)

When different sources provide conflicting values for the same metric:
1. The field displays a red **CONFLICTING** status badge with an alert indicator.
2. Direct approval is blocked by the system until a human decision is recorded.
3. A **Technical Lead** or **Organisation Admin** must review the competing candidates:
   - Expand the conflict panel to inspect candidate sources, capture dates, and exact quoted excerpts.
   - Click **Resolve Conflict**.
   - Select the winning candidate.
   - Enter a mandatory **Resolution Rationale** (e.g. *Accepted certified capacity model over initial informal stakeholder estimate*).
4. Submitting the resolution transitions the field to **APPROVED**, records the active approval snapshot, and logs the decision to the audit log.

---

## 5. Source Replacement & Approval Invalidation

When an engineering document is updated:
1. Navigate to the source and click **Upload New Revision**.
2. Upload the updated file (e.g. `forecast_v2.csv`).
3. **Automatic System Reaction**:
   - The platform parses the new revision and issues a new version number.
   - **All intelligence items previously bound to this source immediately transition to `STALE` and `UNREVIEWED`**.
   - Current approval badges are cleared to prevent obsolete assumptions from governing tests.
4. **Operator Next Step**:
   - Review each stale field.
   - Confirm whether the new revision altered the target value.
   - Update the locator/excerpt if necessary and re-approve the item using the updated revision counter.

---

## 6. Common Operator Troubleshooting

| Error Code / Message | Root Cause | Operator Solution |
| :--- | :--- | :--- |
| **`409 Precondition Failed`** | Another user updated the record, or the expected revision was not provided. | Refresh the page to load the latest revision and retry your edit. |
| **`409 Mapping digest mismatch`** | Mappings were modified after preview, or the source file was updated. | Re-run the preview step to generate a fresh digest before applying. |
| **`415 UNSUPPORTED_MEDIA_TYPE`** | File extension does not match the actual magic bytes (e.g. renamed text file with `.pdf` extension). | Convert the file to true PDF/CSV format or upload as plain text. |
| **`413 RESOURCE_LIMIT_EXCEEDED`** | File exceeds 10 MiB limit or text source exceeds 512 KiB. | Compress or truncate document to include only relevant performance specification sections. |
| **`400 Locator could not be resolved`** | Specified locator (e.g. `row:5,col:3`) does not exist in extraction result. | Check extraction fragment list in the source details modal for valid locators. |
| **`403 FORBIDDEN`** | User lacks required permission (`SOURCE_WRITE` or `INTELLIGENCE_RESOLVE`). | Request role upgrade from your Organisation Administrator. |
