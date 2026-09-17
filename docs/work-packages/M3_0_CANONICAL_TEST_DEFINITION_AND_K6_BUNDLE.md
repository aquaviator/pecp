# Work Package: M3.0 — Canonical Test Definition → Deterministic k6 Bundle

## Objective

Begin M3 by creating PECP's engine-neutral executable test model and deterministic k6 bundle generation layer.

M3.0 must transform governed Performance Contract + canonical execution intelligence into:

1. a canonical, engine-neutral Test Definition; and
2. a deterministic k6 execution bundle/configuration generated from that Test Definition.

M3.0 does **not** yet need to execute the test against the Reference Lab. That is the next M3 gate.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M0_CLOSURE.md`
- `docs/M1_CLOSURE.md`
- `docs/M2_CLOSURE.md`
- M1/M2 gate documents

Do not begin Results/Evidence work.

---

## 1. Canonical Test Definition

Extend `packages/pe-domain` with a small engine-neutral executable test model.

Include concepts such as:

- `TestDefinition`
- `TestDefinitionStatus`
- `TestScenario`
- `JourneyDefinition`
- `JourneyStep`
- `WorkloadSchedule`
- `ExecutionPrecondition`
- `ExecutionParameter`
- `WorkloadAttainmentRequirement`
- `TestDefinitionIssue`
- source Performance Contract id/version/fingerprint
- source artefact references where useful
- generation timestamp/version

The model must be independent of k6/JMeter.

Do not put JavaScript/k6 syntax into the canonical Test Definition.

---

## 2. Authoritative execution-input law

No executable schedule may be invented by the compiler.

The Test Definition may only become executable when canonical project intelligence explicitly supplies the required execution parameters, such as where applicable:

- target workload / arrival rate;
- execution model (open/closed where explicitly selected);
- ramp stages or arrival-rate stages;
- durations;
- journey mix;
- endpoint/request definitions;
- test data references;
- environment/base URL reference;
- required headers/auth references;
- execution preconditions.

If any mandatory parameter is absent, emit a structured blocker / `NOT_SUPPLIED` issue.

PECP methodology guidance may recommend what should be supplied, but must not create executable values.

---

## 3. Contract gate

A canonical Test Definition must bind to a specific Performance Contract id/version/fingerprint.

Rules:

- `BLOCKED` Performance Contract -> Test Definition may be generated for review but status must be `BLOCKED` / non-executable;
- `READY_FOR_APPROVAL` contract is still not automatically executable unless all execution-specific prerequisites are present and approved;
- approved workload demand must be preserved separately from NFR acceptance criteria;
- no executable test may silently resolve upstream ambiguity;
- no test definition may infer session concurrency from order throughput.

---

## 4. M3 execution-ready RetailCo reference state

Do not mutate the historical M0/M1/M2 RetailCo fixtures.

Create a new explicit M3 execution-ready RetailCo fixture / manifest representing a later governed state in which the missing execution information has been supplied and approved.

At minimum it must explicitly provide canonical values for:

- approved Performance Contract suitable for execution;
- checkout latency percentile resolution;
- session-arrival information if session concurrency is required;
- base URL / Reference Lab target reference;
- journey definitions for Browse, Search, Basket, Checkout and Account;
- explicit workload schedule / stage durations;
- any required test data identifiers;
- all values required to generate the k6 bundle.

These are synthetic Reference Lab facts and must be clearly stored as reference data, not hidden generator defaults.

The existing M1/M2 blocked RetailCo scenario must remain intact for governance demonstrations.

Create a machine-readable M3 expected-output manifest under:

`reference-library/retailco/`

---

## 5. Stable k6 runtime architecture

Implement the preferred architecture:

**stable PECP k6 runtime + generated configuration + generated/reference journey modules**

rather than generating one large opaque standalone script.

The intent is to preserve PECP's canonical model and avoid an irreversible script-ejection model.

Create a clear structure, for example:

`execution/k6-runtime/`

with a stable runtime that consumes a generated PECP k6 config/bundle.

The exact file layout may be refined, but maintain these boundaries:

- stable runtime code owned by PECP;
- deterministic generated configuration;
- journey modules separated from runtime orchestration;
- no customer secrets embedded in generated files;
- no environment-specific credentials hard-coded.

---

## 6. k6 provider / bundle compiler

Create a deterministic transformation layer, preferably as a shared package or provider module, that compiles `TestDefinition` into a k6 execution bundle.

The generated bundle should represent, where present in canonical data:

- scenarios/executors;
- stages / arrival rates;
- journey weights;
- base URL reference;
- thresholds derived only from **defined executable acceptance criteria**;
- workload-attainment metadata;
- test data references;
- source Test Definition id/version/fingerprint.

Important:

- Do not convert ambiguous criteria into k6 thresholds.
- Do not manufacture p95/p99.
- Do not manufacture stages/durations.
- Do not embed secrets/tokens/passwords.
- Do not generate a false PASS criterion from workload demand.

---

## 7. Secret / credential boundary

Introduce the minimum domain concept for credential references if required by the generated execution model.

Use references only, such as:

`CredentialReference { provider, referenceId, purpose }`

No raw secret values may appear in:

- canonical Test Definition;
- generated k6 config;
- committed fixtures;
- logs/tests.

Do not implement full secret-store integrations in M3.0.

---

## 8. Determinism and fingerprints

Test Definition compilation and k6 bundle generation must support explicit supplied generation timestamps / clocks.

Identical canonical inputs + identical supplied timestamp/version must produce identical deterministic output.

Introduce a deterministic non-cryptographic fingerprint/checksum for Test Definition / generated bundle drift if useful.

Label it accurately. Do not call it cryptographic unless a cryptographic primitive is actually used.

---

## 9. Portal implementation

Update the **Tests** page from placeholder status to a governed M3.0 view showing:

- canonical Test Definition status;
- source Performance Contract binding;
- execution readiness / blockers;
- scenarios and journeys;
- workload schedule;
- executable acceptance thresholds;
- required workload-attainment target;
- generated k6 bundle/config preview;
- source traceability;
- clear warning when execution cannot proceed.

Do not run k6 from the browser.

Do not place compilation logic in React components.

---

## 10. Tests

Add meaningful tests covering at minimum:

### Canonical Test Definition

- blocked M2 RetailCo contract generates a non-executable blocked Test Definition;
- unresolved execution inputs remain blockers;
- M3 execution-ready reference data produces an executable Test Definition;
- source contract binding is preserved;
- workload demand and NFR acceptance remain distinct;
- no hidden schedule values are invented.

### k6 bundle generation

- deterministic output for identical Test Definition + timestamp;
- generated scenarios reflect only explicit canonical schedules;
- generated thresholds include only executable/defined acceptance criteria;
- ambiguous criteria are excluded and surfaced as issues;
- workload attainment metadata is preserved separately;
- no raw credentials/secrets appear;
- journey weights derive from canonical Test Definition;
- no k6-specific syntax leaks back into the canonical domain model.

### Web integration

- Tests page consumes Test Definition / k6 provider output;
- blocked source shows non-executable state;
- execution-ready reference scenario renders executable bundle preview;
- no hidden RetailCo fallback schedule exists in React.

---

## 11. CI / lockfile discipline

Adding new workspace packages requires regenerating and committing the root `package-lock.json` in the same work package.

Before completion run from a clean repository root:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions must be green on `master`.

---

## 12. Non-goals

Do not implement in M3.0:

- live k6 process execution;
- Docker execution provider;
- Azure DevOps pipeline execution;
- JMeter;
- results ingestion;
- PASS/FAIL verdict engine;
- findings/defects;
- Evidence Package;
- ADO/Jira connectors;
- database persistence;
- authentication/RBAC;
- real secret-store integration;
- M4 work.

---

## Definition of Done

M3.0 is complete when:

1. an engine-neutral canonical Test Definition exists;
2. blocked upstream state remains visibly non-executable;
3. an explicit M3 RetailCo execution-ready reference state exists without modifying historical blocked scenarios;
4. PECP can deterministically compile that Test Definition to a k6 runtime/config bundle;
5. generated execution schedules come only from canonical approved execution intelligence;
6. defined acceptance criteria become k6 thresholds only when fully executable;
7. workload attainment remains a distinct execution requirement;
8. no raw secrets are embedded;
9. Tests page shows real Test Definition and bundle preview;
10. tests prove deterministic / governance behaviour;
11. `npm ci`, lint, tests and build pass;
12. GitHub Actions is green on `master`;
13. no live execution or M4 scope has started.

## Completion report

Report:

- domain contracts added;
- canonical Test Definition model;
- execution-readiness rules;
- RetailCo M3 reference state;
- k6 runtime/bundle architecture;
- k6 mapping rules;
- secret-reference handling;
- tests added and counts;
- lint/build results;
- GitHub Actions run result;
- unresolved design questions.

Stop after M3.0. Do not begin live execution.
