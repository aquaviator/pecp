# Work Package: M2 — Performance Contract → Engineering Artefacts

## Objective

Turn the governed Performance Contract and canonical project intelligence into professional, versioned engineering artefacts without creating a second source of truth.

M2 must produce real **Performance Strategy** and **Performance Test Plan** artefacts from canonical PECP state.

The artefacts are generated views over the canonical model. They must preserve unresolved issues and may not invent missing engineering facts.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M0_CLOSURE.md`
- `docs/M1_CLOSURE.md`
- `docs/work-packages/M1_INTELLIGENCE_TO_CONTRACT.md`
- M1.1 and M1.2 gate documents

Do not begin M3 execution/k6 work.

---

## 1. Create shared artefact domain contracts

Extend `packages/pe-domain` with the minimum authoritative structures required for generated engineering artefacts.

Include concepts such as:

- `ArtefactType`
  - `PERFORMANCE_STRATEGY`
  - `PERFORMANCE_TEST_PLAN`
- `ArtefactStatus`
  - `DRAFT`
  - `BLOCKED`
  - `READY_FOR_APPROVAL`
  - `APPROVED`
  - `STALE`
  - `SUPERSEDED`
- `EngineeringArtefact`
- `ArtefactVersion`
- `ArtefactSection`
- `ArtefactSourceReference`
- `ArtefactIssue`
- `ArtefactApprovalReadiness`
- source contract id/version
- source intelligence references
- generation timestamp/version

Keep the model small and explicit.

Do not introduce database/persistence models in M2.

---

## 2. Create deterministic artefact engine

Create:

`packages/artefact-engine/`

This package must contain pure deterministic transformation logic only.

No React.
No network calls.
No database access.
No external AI calls.

It must accept canonical PECP state / Performance Contract and produce structured artefact models.

The artefact engine must not contain RetailCo-specific business values.

---

## 3. Performance Strategy generator

Generate a structured Performance Strategy containing appropriate sections derived from canonical state, for example:

1. Document Control
2. Executive / Business Context
3. Performance Engineering Intent
4. Scope
5. System / Architecture Context
6. Performance Risks and Assumptions
7. Workload Strategy
8. Journey / Transaction Model
9. Performance Requirements and Acceptance Criteria
10. Test Approach
11. Test Types / Engineering Activities
12. Environment Strategy
13. Test Data Strategy
14. Observability / Monitoring Strategy
15. Entry / Exit / Governance Conditions
16. Unresolved Decisions / Blockers
17. Traceability / Source References

The exact section structure may be refined where sensible, but the generator must remain deterministic and source-driven.

### Important

If information is absent:

- show `Not supplied`, `Unresolved`, or an explicit blocker;
- do not fabricate infrastructure, tooling, volumes, percentiles, environments, test data, or observability platforms.

A BLOCKED Performance Contract may still produce a **DRAFT / BLOCKED Strategy** for review, but that document must clearly carry the blockers and must not be approvable.

---

## 4. Performance Test Plan generator

Generate a structured Performance Test Plan from the same governed source model.

Initial sections should include at least:

1. Document Control
2. Purpose and Scope
3. Source Performance Contract
4. Engineering Intent
5. In-Scope Journeys / Transactions
6. Workload Model and Required Demand
7. Workload Calculations and Lineage
8. Performance Acceptance Criteria
9. Test Scenarios
10. Environment
11. Test Data
12. Observability / Evidence Collection
13. Execution Preconditions
14. Pass / Fail / Inconclusive Rules
15. Risks / Assumptions / Blockers
16. Traceability

Do not generate executable k6 scripts in M2.

Do not invent a concurrency target when M1 says it is blocked.

Do not invent a checkout percentile when M1 says it is ambiguous.

---

## 5. Separate workload attainment from NFR acceptance

Maintain the M1 semantic distinction:

- required workload demand belongs in workload / execution-attainment sections;
- latency/error/availability criteria belong in performance acceptance sections.

The artefacts may explain that a run cannot pass if required workload is not attained, but do not rewrite workload demand as a latency/error NFR.

---

## 6. Version and stale semantics

Every generated artefact must bind to:

- source Performance Contract id;
- source Performance Contract version;
- source intelligence references;
- generation version/timestamp.

Introduce deterministic stale detection at the artefact-model level.

At minimum, provide a pure function/service that can determine that an artefact is stale when its source contract id/version or relevant source fingerprint no longer matches the current source.

Do not implement database persistence.

Do not silently mutate an already approved artefact when source state changes.

---

## 7. Approval readiness

Artefact approval readiness must be derived from canonical state.

Rules:

- artefact generated from a BLOCKED contract is `BLOCKED` or equivalent and `canApprove: false`;
- unresolved blocking intelligence must be visible in the artefact;
- an artefact with a fully approvable source contract may become `READY_FOR_APPROVAL`;
- M2 does not need full user/RBAC approval persistence, but the domain and UI must clearly distinguish document status from source contract status.

Do not auto-approve generated documents.

---

## 8. Portal implementation

Replace the current placeholder Strategy and Test Plan screens with real generated M2 artefacts.

### Strategy page

Show:

- artefact title/type;
- version;
- source contract version;
- status / approval readiness;
- generated sections;
- blockers / unresolved items;
- source/traceability references;
- structured preview suitable for eventual professional export.

### Test Plan page

Show the equivalent governed Test Plan structure.

The portal must consume `@pecp/artefact-engine` outputs.

Do not reproduce generation rules inside React components.

---

## 9. Professional document presentation

The portal previews should look like professional engineering documents, not dashboard cards pasted together.

Use a document-oriented layout with:

- document title and metadata;
- section numbering;
- readable headings;
- tables where appropriate;
- source/traceability indicators;
- unresolved/blocker callouts;
- print-friendly structure.

M2 may provide structured HTML/print preview and machine-readable JSON/Markdown export if straightforward.

Do **not** add PDF/DOCX production libraries merely to satisfy M2. PDF/DOCX publishing belongs to a later publishing work package unless an existing lightweight implementation is naturally available without distorting scope.

---

## 10. RetailCo M2 reference behaviour

Use the RetailCo post-resolution M1 scenario.

Expected Strategy/Test Plan behaviour:

- engineering intent = `FORECAST`;
- approved business demand = 31,500 orders/hour = 525/min = 8.75/sec;
- journey distribution comes only from canonical intelligence;
- session concurrency remains explicitly unresolved because session arrival rate is missing;
- checkout response-time criterion remains ambiguous because percentile is missing;
- document carries these blockers into its unresolved-decision sections;
- artefact is not approvable while source Performance Contract is BLOCKED;
- no invented growth/headroom values;
- no invented environment, data, observability or execution details beyond what canonical intelligence actually contains.

Extend the reference library with an M2 expected-output manifest or machine-readable expectations.

---

## 11. Tests

Add meaningful automated tests covering at minimum:

### Strategy generator

- generated from Performance Contract/canonical inputs;
- preserves `FORECAST` intent;
- contains approved workload demand;
- carries blocked session-concurrency issue;
- carries ambiguous checkout percentile;
- does not invent missing sections/values;
- blocked source contract produces non-approvable artefact.

### Test Plan generator

- workload target is present as workload demand;
- acceptance criteria remain separate;
- no k6/execution script is generated;
- unresolved blockers are preserved;
- traceability to contract/intelligence exists.

### Version/stale logic

- same contract/version produces deterministic artefact content for the same supplied generation timestamp/version;
- changed source contract version marks prior artefact stale;
- approved artefact is not silently overwritten.

### Web integration

- StrategyPage and TestPlanPage consume artefact-engine output;
- pages do not contain RetailCo-specific fallback engineering values;
- blocked source displays blocked/non-approvable state.

---

## 12. Non-goals

Do not implement in M2:

- k6 script generation;
- test execution;
- JMeter;
- real ADO/Jira/Confluence/SharePoint connectors;
- real document publishing to external platforms;
- PDF/DOCX as a mandatory requirement;
- database persistence;
- authentication/RBAC;
- BYOAI calls;
- AI-generated engineering facts;
- results/acceptance engine;
- findings/evidence package;
- M3 work.

---

## Definition of Done

M2 is complete when:

1. shared artefact contracts exist outside the portal;
2. Strategy and Test Plan are generated deterministically from governed canonical state;
3. documents preserve missing/ambiguous/blocking information rather than filling gaps;
4. workload demand remains distinct from NFR acceptance;
5. artefacts carry source contract/intelligence traceability;
6. version/stale semantics are represented and tested;
7. blocked source contract produces blocked/non-approvable artefacts;
8. Strategy and Test Plan portal pages show real generated artefacts rather than placeholders;
9. RetailCo M2 reference expectations exist;
10. `npm ci`, lint, tests and build pass;
11. GitHub Actions is green on `master`;
12. no M3 functionality has started.

## Completion report

At completion report:

- packages/files created;
- artefact domain contracts;
- Strategy section model;
- Test Plan section model;
- blocker propagation rules;
- version/stale behaviour;
- RetailCo M2 outcome;
- tests added and counts;
- lint/build results;
- GitHub Actions run result;
- unresolved design questions.

Stop after M2.
