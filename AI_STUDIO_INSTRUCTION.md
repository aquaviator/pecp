# AI Studio Instruction — PECP Product Build

## Current State

Repository: `aquaviator/pecp`

Current authoritative base:

`ac57a3bab0ec7ced5efca4db1317a4c278e6af20`

M5.2 is formally CLOSED.

The user has now authorized the next product-build phase.

This is no longer a reporting/audit task. Build the product.

Do not create PM reports, audit reports, completion reports, closure reports, or speculative roadmap documents unless explicitly required by this instruction.

## Build Objective

Implement the first production slice that connects **real governed intelligence from M5.2** to the existing deterministic **PECP Performance Contract / workload engineering pipeline**.

The product must be able to take approved project intelligence already persisted through the M5.2 intake workflow and deterministically compile it into the same canonical engineering model used by the existing workload, artefact, execution and evidence engines.

The governing principle is:

```
real source
  -> extracted evidence
  -> governed intelligence
  -> approved intelligence
  -> canonical performance contract
  -> existing deterministic PECP engines
```

No invented values. No hidden defaults. No AI-generated authority.

## Non-Negotiable Product Rules

Preserve the PECP Constitution and all previously established invariants.

1. **Source authority remains visible**
   - Every compiled contract value must retain provenance back to the governing IntelligenceItem and, where applicable, its source binding / source version / locator / excerpt.
   - Do not flatten provenance into untraceable primitive values.

2. **Only eligible governed intelligence may become authoritative contract input**
   - Approved intake-managed records may compile.
   - `CONFLICTING`, `AMBIGUOUS`, `STALE`, missing, invalid-contract, or unapproved required records must not silently become usable contract values.
   - The compiler must return explicit blocking issues for unusable required inputs.

3. **No invention**
   - Do not introduce fallback workload values, percentages, durations, units, mixes, peaks, concurrency or schedules.
   - Do not reuse historical hard-coded defaults removed by earlier semantic gates.

4. **Typed values stay typed**
   - Preserve number vs string distinctions.
   - Preserve absent unit vs supplied unit.
   - Reject incompatible value-kind or unit contracts rather than coercing them invisibly.

5. **Deterministic output**
   - Same authoritative project state must produce the same contract content and fingerprint.
   - Volatile runtime timestamps must not alter semantic fingerprints.

6. **Backward compatibility**
   - Existing reference fixtures/tests and deterministic engine behavior must remain green.
   - Do not bypass or replace existing `@pecp/pe-domain`, `@pecp/workload-engine`, `@pecp/artefact-engine`, execution or evidence contracts.
   - Integrate M5.2 intake with them.

## Required Product Slice

### 1. Define the governed compilation boundary

Add a production service in the appropriate platform/core domain layer that compiles persisted project intelligence into the existing canonical performance contract input/model.

Use existing domain types wherever possible.

Do not create a parallel duplicate contract model if the repo already contains an authoritative one.

The service should conceptually support:

```ts
compileProjectPerformanceContract(projectId, principal)
```

or the equivalent that fits the current architecture.

It must read persisted project intelligence from the authoritative repository, not mock fixture state.

### 2. Introduce explicit input eligibility evaluation

For every mapped contract field, evaluate whether the current IntelligenceItem is usable.

At minimum distinguish:

- usable / approved
- missing
- conflicting
- ambiguous
- stale
- unapproved
- invalid type
- invalid/missing required unit
- invalid provenance/source binding where required

Return deterministic structured issues rather than throwing generic strings for ordinary governance gaps.

Use existing canonical/review states and issue models if available.

### 3. Compile provenance into lineage

For each successfully compiled contract field, preserve lineage sufficient to answer:

- which IntelligenceItem produced this value;
- which intelligence revision was compiled;
- approval snapshot / approval revision where applicable;
- source ID;
- source version ID;
- SHA-256/source digest where present;
- locator;
- excerpt where present;
- whether the value was imported, manual, calculated, inferred or otherwise represented by the canonical state.

Do not fabricate missing provenance fields.

### 4. Connect to the existing workload / contract compiler

Where the existing PECP engine already performs deterministic calculations or workload construction, feed the governed input into that existing path.

Do not duplicate calculation logic inside the API/service layer.

Existing calculation lineage must remain intact and should compose with the new intake lineage.

### 5. Add governed API exposure

Expose the compiled contract or compilation result through the existing governed API architecture.

Use the existing authentication/RBAC model.

Minimum useful endpoint shape may be:

`GET /api/v1/projects/:projectId/performance-contract`

or an equivalent consistent with existing route conventions.

The response must make clear:

- whether the contract is compile-ready / blocked;
- compiled canonical values when eligible;
- deterministic blocking issues;
- provenance/lineage;
- semantic fingerprint / binding identifier where the existing contract model supports it.

Do not return a fabricated partial contract as if it were approved/ready.

### 6. Surface it in the product UI

Add the smallest useful portal experience that lets a user see the result of the real intelligence-to-contract bridge.

Use the existing project/intelligence/contract pages and design language.

The UI must show, at minimum:

- contract readiness;
- authoritative compiled values;
- blocked fields and reasons;
- provenance/source link or source locator information where available.

Do not build a new design system.

Do not add chat/LLM UI.

### 7. Prove the real Northstar flow

Extend the Northstar reference scenario so that the already-governed intake state produces a canonical contract only after the required intelligence is valid and approved.

Prove at least:

1. Approved `24,000 orders/hr` from the governed Northstar source compiles into the appropriate canonical workload/contract field.
2. The competing `30,000 orders/hr` assertion blocks compilation while the item is `CONFLICTING`.
3. Resolving the conflict and approving the chosen candidate enables compilation.
4. Replacing/superseding the bound source invalidates the approval to `STALE` and causes the contract to become blocked again.
5. Reapproval against the current source/revision restores compile readiness.
6. Provenance in the compiled output points to the exact governing source version/candidate used.
7. A database restart preserves the same canonical compilation result and semantic fingerprint.

### 8. Product regression tests

Add tests at the correct layers:

- domain/service tests for eligibility and mapping;
- API integration tests for real persisted project state;
- at least one DOM-capable portal interaction test for readiness/provenance rendering;
- Northstar end-to-end integration coverage.

Test negative paths, not only success.

## Scope Guard

Do NOT implement in this slice:

- external LLM/BYOAI ingestion;
- Jira/Azure DevOps/Confluence/SharePoint connectors;
- new k6 execution behavior;
- JMeter;
- Kubernetes;
- billing/subscriptions;
- marketing/public website;
- M5.2 changes unless required to fix a regression discovered by this implementation.

This slice is the product bridge from **real governed intelligence** into the **existing canonical deterministic PECP engineering pipeline**.

## Build Method

1. Inspect the existing authoritative contract/domain/workload compiler before changing code.
2. Reuse existing models and engines.
3. Implement the smallest coherent production slice.
4. Run:
   - `npm ci`
   - `npm run lint`
   - `npm test`
   - `npm run build`
5. Commit all implemented product changes to `master` only when the full suite is green.

## Required Final Response

Do not write a milestone report.

Return only a concise implementation handoff containing:

1. commit SHA;
2. product capability now working;
3. files/components materially changed;
4. exact new API route(s);
5. exact new/changed UI behavior;
6. test totals and build/lint result;
7. any genuine product blocker that remains.

If implementation succeeds, stop there.

Do not create an audit cycle or ask for permission to continue.
