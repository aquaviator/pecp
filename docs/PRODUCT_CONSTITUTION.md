# PECP Product Constitution v1.0

## 1. Product definition

PECP is a subscription-based, customer-deployed Performance Engineering Control Plane that converts project intelligence into governed performance models, professional engineering artefacts, executable performance tests, and traceable performance evidence while integrating with the customer's existing AI, ALM, CI/CD, observability and execution ecosystem.

## 2. Commercial deployment model

- Production customers run PECP in infrastructure they control.
- Hosted environments are for demonstration/reference use only unless a future hosted edition is explicitly introduced.
- Docker/VM-friendly deployment comes before Kubernetes-specific assumptions.
- Kubernetes/Helm and offline/air-gapped deployment are future supported envelopes, not mandatory entry requirements.
- Subscription value comes from the PE methodology, software, connector ecosystem, updates, governance, compatibility maintenance and support.

## 3. BYOAI principle

Customers use their own approved AI provider, credentials and credits wherever possible.

AI may:
- read and classify documents;
- extract candidate intelligence;
- identify gaps and conflicts;
- draft and summarise;
- explain evidence;
- drive PECP through governed APIs/MCP.

AI must not become the authoritative engineering state or security boundary.

PECP deterministically owns:
- canonical state;
- provenance;
- workload mathematics;
- approvals;
- test definitions;
- execution orchestration;
- results;
- acceptance evaluation;
- audit and evidence.

Humans retain approval and engineering judgement for material decisions.

## 4. Source-agnostic intelligence

The destination field matters more than how it was populated. Manual entry, uploaded documents, Azure DevOps, Jira, production telemetry, spreadsheets, APIs and future AI providers all populate the same canonical Performance Engineering model.

## 5. Canonical model first

The canonical PE model is authoritative. Portal screens, generated documents, external tickets, AI responses and execution scripts are views/adapters around the canonical model rather than competing sources of truth.

## 6. Performance Engineering Intents

PECP supports the following first-class intents:

- DISCOVERY — What can this system handle?
- REPRESENTATIVE — What does the live system actually do?
- FORECAST — What future workload should we prepare for?
- INVESTIGATIVE — Can we reproduce and isolate a performance problem?
- CERTIFICATION — Does this release satisfy agreed performance requirements?

Traditional test types such as load, stress, soak and spike exist beneath these engineering intents.

## 7. Provenance

Every material value must be able to answer where it came from and why it exists. Important values carry source, source reference/location, state, timestamp, history, approval and calculation lineage where relevant.

Canonical states include:
- MISSING
- OBSERVED
- MANUAL
- IMPORTED
- INFERRED
- CALCULATED
- CONFLICTING
- STALE
- APPROVED
- SUPERSEDED

AI-derived values must not silently become authoritative.

## 8. Documents and publishing

Documents are generated views over the canonical model.

PECP should produce professional artefacts including:
- Performance Strategy;
- Performance Test Plan;
- Workload Model;
- NFR Review;
- Risk & Assumption Register;
- Results Report;
- Performance Evidence Package;
- Executive Summary;
- structured stories, defects and investigation items.

Publishing/export targets may include Azure DevOps, Jira, Confluence, SharePoint, DOCX, PDF, HTML and API/JSON.

Approvals are version-specific. Material upstream changes can invalidate prior approvals.

## 9. Provider/connector architecture

External systems are providers, not core dependencies.

Provider categories include:
- RequirementProvider
- PublishingProvider
- ExecutionProvider
- TelemetryProvider
- SourceControlProvider
- PipelineProvider
- SecretProvider
- AIProvider

Every important connector should support a common contract and the conceptual modes MOCK / SANDBOX / LIVE where practical.

Connector quality should include versioned fixtures, contract tests, compatibility metadata and drift/deprecation monitoring where feasible.

## 10. Execution

PECP orchestrates execution rather than replacing CI/CD or building a proprietary load-generation cloud for the Sellable MVP.

The first execution engine is k6.

Before committing to full generated TypeScript, evaluate a stable PECP k6 runtime + generated configuration + project-specific journey modules against full script generation.

The canonical Test Definition must remain execution-engine-neutral.

## 11. Security

- No raw secrets in canonical models, generated scripts, Git, logs or generated documents.
- Use credential references and customer-controlled secret stores/CI secrets.
- PECP itself enforces RBAC, approvals and audit regardless of AI behaviour.
- Customer data, documents, telemetry and credentials remain customer-controlled in the primary deployment model.

## 12. Reference Intelligence Library and Reference Performance Lab

These are mandatory early development assets, not optional test garnish.

The Reference Intelligence Library contains realistic fictional project estates with good, bad, stale, missing and conflicting intelligence plus hidden machine-readable ground truth.

The Reference Performance Lab contains executable reference applications with known transactions, bottlenecks and failure modes.

Every major PECP capability must be demonstrable and automatically verifiable against at least one reference scenario before it is considered complete.

The first reference organisation is RetailCo, centred on Black Friday 2026 readiness.

## 13. Sellable MVP boundary

PECP 1.0 is commercially viable when a customer can:

1. install PECP in their environment;
2. create an organisation/project;
3. start from a brief, uploaded documents or Azure DevOps;
4. optionally use their own configured AI provider;
5. extract structured performance intelligence;
6. identify missing, ambiguous, stale and conflicting information;
7. resolve and approve intelligence;
8. calculate a defensible workload;
9. create a versioned Performance Contract;
10. generate a professional Strategy and Test Plan;
11. approve those artefacts;
12. produce a k6 test from the approved model;
13. execute through a supported customer-controlled runner;
14. capture actual execution results;
15. evaluate PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE;
16. create structured findings/defects;
17. generate a Performance Evidence Package;
18. export/publish the outputs;
19. retain full source-to-result traceability.

Anything outside this boundary requires an explicit backlog decision.

## 14. Development workstreams

- Product Experience — portal/UI, primarily accelerated through Google AI Studio.
- Platform Engineering — repo/Codex: domain model, APIs, workload engine, persistence, security, publishing.
- Integration & Test Engineering — repo/Codex: connectors, k6 runtime, mocks, Reference Lab and contract/E2E testing.

These workstreams meet through versioned API/schema contracts.

## 15. Development law

1. Canonical PE model is authoritative.
2. AI Studio does not invent backend architecture.
3. AI is optional for core product operation.
4. AI-derived material requires provenance and governed approval.
5. External products are providers/connectors.
6. Every major connector has deterministic mock coverage.
7. No feature is complete without reference scenario validation.
8. No raw secrets in models/scripts/logs/documents.
9. Broad architecture, narrow implementation.
10. Sellable MVP scope wins over feature enthusiasm.
