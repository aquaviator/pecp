# Work Package: M3.0.1 — Execution Governance Gate

## Objective

Close M3.0 without beginning live execution.

The canonical Test Definition and k6 bundle architecture are substantially present, but PM review identified hidden executable defaults and a disconnect between the generated bundle and the intended PECP stable k6 runtime.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M2_CLOSURE.md`
- `docs/work-packages/M3_0_CANONICAL_TEST_DEFINITION_AND_K6_BUNDLE.md`
- `docs/M3_0_PM_REVIEW.md`

Do not run k6 against the Reference Lab in this work package.

---

## 1. Remove invented workload-attainment defaults

In `compileTestDefinition()`:

- remove the fallback `8.75 orders/second` workload target;
- remove any default workload-attainment tolerance such as `5%`;
- if no governed workload-attainment target exists, emit a blocking `NOT_SUPPLIED` issue and make the Test Definition non-executable;
- if tolerance is required for later evaluation, model it as optional canonical execution intelligence and leave it unresolved when absent.

Tests must prove an unrelated contract cannot acquire an 8.75/sec target or 5% tolerance.

---

## 2. Preconditions must be source-driven

Do not generate executable preconditions or verification methods merely because explicit preconditions were not supplied.

Remove fallback project facts such as:

- HTTP GET `/health` verification;
- database/SKU cardinality verification;
- assumptions that a supplied base URL means the environment is ready;
- synthetic data readiness statements not present in canonical execution intelligence.

If no preconditions are supplied:

- retain an empty/unsupplied precondition collection;
- emit appropriate issue/readiness state where preconditions are mandatory;
- PECP methodology recommendations may be surfaced separately as guidance, not executable project state.

The approved M3 RetailCo fixture may explicitly supply its own Reference Lab preconditions because those are reference facts.

---

## 3. Require approved source contract for execution readiness

Make the source-contract execution gate explicit:

- `APPROVED` contract + all approved execution prerequisites may yield `READY_FOR_EXECUTION`;
- `BLOCKED` contract -> `BLOCKED` Test Definition;
- `DRAFT` or `READY_FOR_APPROVAL` contract -> reviewable but non-executable Test Definition;
- no downstream execution definition may bypass contract approval.

Add tests for `READY_FOR_APPROVAL` not becoming executable.

---

## 4. Stable PECP k6 runtime must be the real runtime

The intended architecture is:

`Canonical Test Definition -> generated config/journey declarations -> stable PECP k6 runtime`

The current generated entrypoint duplicates common orchestration/metrics instead of actually consuming `execution/k6-runtime/`.

Correct this so that:

- common metrics live in the stable runtime;
- weighted journey orchestration lives in the stable runtime;
- common HTTP execution/check behaviour lives in the stable runtime;
- generated customer/reference content remains configuration + journey-specific declarations/modules;
- generated bundle explicitly references or packages the versioned PECP runtime required to execute it;
- tests prove the generated entrypoint uses the stable runtime rather than duplicating its responsibilities.

Do not create one opaque monolithic generated script.

---

## 5. k6 provider sizing must be explicit or governed provider policy

Remove hidden magic-number sizing from the provider:

- no unexplained `rate: 1`;
- no hidden `max(20, peak * 3)` preallocated VUs;
- no hidden `max(100, peak * 12)` max VUs.

Choose one of these governed approaches:

### A. Explicit execution intelligence

Add optional k6 provider-capacity settings to execution/provider configuration and require them where k6 needs them.

or

### B. Versioned provider policy

Define a named/versioned `K6ProviderPolicy` that deterministically derives required k6 capacity settings. Provider-derived values must include:

- policy/version;
- formula/rule identifier;
- source input;
- derived output;
- explanation.

They must be clearly presented as **provider-derived runtime capacity**, not customer workload truth.

Prefer the smallest implementation that preserves correctness.

---

## 6. Journey steps may not invent request behaviour

Remove provider fallbacks that change request semantics:

- `thinkTimeSeconds || 1`;
- `expectedStatusCode || 200`;
- automatic `{ syntheticPayload: true }` bodies for POST/PUT.

Required:

- explicitly supplied `0` think time remains valid;
- expected status code must be explicit if PECP is going to assert one;
- request body semantics for methods requiring a body must come from canonical journey-step data;
- extend engine-neutral `JourneyStep` minimally with a request payload/body concept if required, such as a literal synthetic reference payload, test-data reference, or body-template reference;
- do not put k6-specific syntax in the canonical model;
- if a required body/status is absent, the affected journey must not silently become executable.

The M3 RetailCo Reference Lab fixture must explicitly supply any bodies needed by Basket/Checkout.

---

## 7. Threshold mapping must be strict

The k6 provider may only translate fully structured executable criteria.

Remove:

- default operator `<`;
- provider-side numeric recovery from display `target` strings.

Require explicit structured:

- operator;
- threshold value;
- unit;
- percentile where the metric requires one.

Unit handling must be explicit and tested:

- `0.5 %` -> `0.005` rate;
- `0.005 rate` -> `0.005` rate;
- seconds -> milliseconds for k6 duration threshold mapping;
- unsupported units produce a provider issue rather than silent coercion.

---

## 8. Contract fingerprint scope must be unambiguous

M2 and M3 must not expose two different values both described as the authoritative fingerprint of the same Performance Contract.

Either:

- consolidate an authoritative deterministic contract drift-checksum function shared by artefact and test layers; or
- explicitly rename/scope the M3 digest so it cannot be confused with the M2 contract fingerprint.

Prefer consolidation if it can be done without architectural sprawl.

All fingerprints/checksums remain non-cryptographic unless a cryptographic primitive is actually introduced.

---

## 9. Tests

Add meaningful tests covering at minimum:

- no 8.75/sec fallback if workload demand is absent;
- no 5% workload tolerance fallback;
- no fabricated preconditions or verification probes;
- `READY_FOR_APPROVAL` source contract is non-executable;
- generated k6 entrypoint consumes the stable runtime;
- no hidden VU sizing constants unless represented by explicit provider policy with lineage;
- zero think time remains zero;
- missing status/body does not gain a provider default;
- POST/PUT body originates from canonical journey data;
- threshold mapping has no operator/value fallbacks;
- `%` and `rate` unit conversions are correct;
- contract fingerprint/checksum scope is consistent;
- all existing M3 reference behaviour still works.

---

## 10. CI discipline

If package contracts/dependencies change, regenerate the root npm lockfile in the same work package.

Run from a clean root:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions on `master` must be green.

---

## Non-goals

Do not:

- execute k6 against the Reference Lab;
- ingest live results;
- implement PASS/FAIL verdict processing;
- implement findings/evidence packages;
- add JMeter;
- add live connectors;
- begin M4.

---

## Definition of Done

M3.0 may close when:

1. Canonical Test Definition contains no hidden project-specific execution defaults.
2. Source contract approval is enforced before execution readiness.
3. Preconditions are canonical facts, not generated guesses.
4. The generated k6 bundle genuinely uses the stable PECP k6 runtime architecture.
5. k6 provider resource sizing is explicit or governed by a transparent versioned provider policy.
6. Journey request semantics are fully source-driven.
7. Provider threshold mapping is strict and unit-correct.
8. Contract drift-checksum naming/implementation is unambiguous across layers.
9. Tests, typecheck and build pass.
10. GitHub Actions is green on `master`.
11. No live test execution has begun.

## Completion report

Report:

- workload-attainment fallback corrections;
- precondition model correction;
- source-contract approval rule;
- stable runtime integration design;
- k6 provider sizing decision;
- journey payload/status/think-time semantics;
- threshold mapping corrections;
- fingerprint/checksum consolidation/scoping;
- tests added and total count;
- lint/build results;
- GitHub Actions run result;
- unresolved design questions.

Stop after M3.0.1. Do not start live execution.