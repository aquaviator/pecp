# M4.2 Closure — Canonical Export & Publication Contract

## Status

**M4.2 — CLOSED ✅**

PECP now provides a deterministic, destination-neutral canonical export and publication boundary implemented outside the UI. The verified `PerformanceEvidencePackage` serves as the authoritative boundary for deterministic package exports, render-neutral results reports, human-readable projections, and destination-neutral defect candidate payloads without external mutation or invented fields.

## Final Verification Summary

- **22 Vitest Test Files passed (22/22)**
- **418 Vitest Tests passed (418/418)**
- **16 Canonical Export & Publication Contract tests (`ExportPublicationContractM4_2.test.ts`)**
- **10 RetailCo Reference Lab tests passed (10/10)**
- **428 Combined Tests passed (428/428)**
- **TypeScript typecheck passed (`tsc --noEmit` via `npm run lint`)**
- **Production applet compilation passed (`npm run build`)**

## Closed Capabilities

M4.2 now provides:

1. **Canonical Export & Publication Domain Model (`@pecp/pe-domain/exportPublication.ts`)**:
   - `ExportArtifactType`, `ExportFormat`, `PublicationDestination`, `PublicationReadinessStatus`, `ExportArtifact`, `DestinationNeutralDefectPayload`, `RenderNeutralResultsReport`, `ResultsReportVisualisationHook`, `PublicationBundle`, and `PublicationBundleDigest`.
2. **Verified Evidence Package as Mandatory Source Boundary**:
   - Requires valid `PerformanceEvidencePackage` cryptographically checked prior to export/publication.
   - Rejects tampered digests or non-`VALID` packages with `BLOCKED_INVALID_SOURCE` (or `AUDIT_ONLY_NOT_PUBLISHABLE` when `allowAuditOnly` is requested).
3. **Deterministic JSON Package & Report Export**:
   - Exact canonical JSON export of the Evidence Package (`evidence-package-<id>.json`).
   - Pure, render-neutral Results Report export (`results-report-<id>.json`).
4. **Deterministic Human-Readable Projections**:
   - Markdown projection (`results-report-<id>.md`) and HTML projection (`results-report-<id>.html`) rendering governed metrics and explicit absence indicators deterministically.
5. **Destination-Neutral Defect Candidate Publication Payloads**:
   - Pure factual defect payloads projecting from governed `DefectCandidate` models.
   - Enforces strict zero-invention law: NO fabricated priority, severity, assignee, team/component, sprint, due date, or diagnostic root cause.
6. **Explicit Publication-Readiness States and Blocking Reasons**:
   - Per-destination gating: `READY`, `BLOCKED_MISSING_DESTINATION_CONFIGURATION`, `BLOCKED_INVALID_SOURCE`, `AUDIT_ONLY_NOT_PUBLISHABLE`.
   - Live external destinations (`JIRA`, `AZURE_DEVOPS`, `CONFLUENCE`, `SHAREPOINT`) are explicitly gated by configuration presence; unconfigured destinations are blocked without failure.
7. **SHA-256 Cryptographic Identities**:
   - Every export artifact content digest is bound by SHA-256 (`contentDigest`).
   - The entire `PublicationBundle` is sealed with SHA-256 (`bundleDigest`).
   - Generation timestamps are strictly excluded from digest calculation to guarantee bitwise reproducibility across runs.
8. **Governed Visualisation Hook**:
   - Exposes scheduler load over time (109.375 journey_iterations/second), business workload target (8.75 orders/second), journey distribution, and execution stages (ramp-up 300s, steady-state 900s, ramp-down 120s) without coupling chart libraries into domain core.
9. **Immutability & Caller Purity**:
   - Deep-frozen return structures; zero mutation of caller inputs or canonical records.

## Authoritative RetailCo Export Outcome

Under the authoritative RetailCo reference run:

- **Source Package**: VALID;
- **Acceptance Verdict**: INCONCLUSIVE;
- **Business Workload Demand**: 8.75 orders/second;
- **Scheduler Demand**: 109.375 journey_iterations/second;
- **Execution Timings**: 300s ramp-up / 900s steady-state / 120s ramp-down / 1320s total;
- **Criteria Evaluations**: Checkout p95 = 0.3906885ms (PASS), HTTP Error Rate = 0 (PASS);
- **Findings Summary**: 1 Finding (`WORKLOAD_ATTAINMENT_UNRESOLVED`);
- **Defect Candidates**: 0;
- **Defect Payloads**: 0 (zero defect candidates yields exactly zero payloads);
- **Publication Readiness**: `READY` for DOWNLOAD and API; `BLOCKED_MISSING_DESTINATION_CONFIGURATION` for external live destinations.

## Invariant Boundaries Preserved

M4.2 does NOT:
- Call external Jira, Azure DevOps, Confluence, or SharePoint APIs;
- Rerun k6 tests or alter Acceptance verdicts;
- Infer root causes or diagnose failures;
- Generate customer-signed certification or replace canonical PECP state with published copies.
