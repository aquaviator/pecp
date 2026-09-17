# PECP M3.0 Project Manager Review

## Status

**M3.0 — CONDITIONAL PASS / GATE REMAINS OPEN**

The core M3.0 architecture is present and GitHub CI is green. However, PM review identified remaining violations of the Authoritative Execution-Input Law and the intended stable-runtime architecture. These must be corrected before M3.0 is formally closed and before live k6 execution begins.

## Verified strengths

- `@pecp/test-engine` exists as a separate package.
- Canonical Test Definition structures are engine-neutral.
- A distinct M3 execution-ready RetailCo reference state exists without mutating earlier blocked scenarios.
- k6 bundle generation is deterministic and excludes ambiguous acceptance criteria.
- Workload attainment remains separate from NFR thresholds.
- Credential values are represented by references rather than committed raw secrets.
- `execution/k6-runtime/` exists as a PECP-owned stable runtime skeleton.
- GitHub Actions on `master` is green for the M3.0 implementation.

## Blocking corrections

### 1. Remove fallback workload demand

`compileTestDefinition()` currently falls back to `8.75 orders/second` when no qualifying throughput calculation exists and also introduces a default `tolerancePercentage: 5`.

These are project-specific executable values and must never be invented.

Required behaviour:

- no workload-attainment target if the governed contract does not provide one;
- emit a blocking `NOT_SUPPLIED` issue;
- tolerance must be explicit canonical execution intelligence or absent/unresolved.

### 2. Do not invent preconditions or verification mechanisms

When preconditions are absent, the compiler currently creates environment, test-data and governance preconditions with verification methods such as HTTP `/health`, database cardinality checks and governance audit checks.

These may be useful PECP methodology suggestions, but they are not customer project facts.

Required behaviour:

- unsupplied preconditions remain unsupplied;
- methodology recommendations may be represented separately as guidance, never as satisfied executable preconditions;
- presence of a base URL alone must not prove environment readiness.

### 3. Stable k6 runtime must actually be used

The repository contains `execution/k6-runtime/`, but generated `entrypoint.js` currently reimplements journey selection and metrics directly, while generated journeys call k6 APIs directly. The stable runtime is therefore not the actual orchestration layer.

Required behaviour:

- generated bundle must consume the PECP stable runtime or contain a deterministic packaged copy/reference of that stable runtime;
- orchestration, common metrics and common HTTP behaviour must not be duplicated into generated entrypoints;
- generated customer-specific material should remain configuration + journey declarations/modules.

### 4. Remove hidden k6 execution sizing defaults

The k6 compiler currently manufactures provider configuration including:

- `rate: 1`;
- `preAllocatedVUs = max(20, peakRate * 3)`;
- `maxVUs = max(100, peakRate * 12)`.

These values affect executable behaviour but are not sourced from canonical intelligence or an explicit, versioned provider policy.

Required behaviour:

- either require explicit provider capacity settings from execution intelligence; or
- introduce a clearly named/versioned **k6 provider policy** whose computed values are explicitly marked provider-derived, with formula/lineage and tests.

Hidden magic numbers are not acceptable.

### 5. Do not invent journey-step behaviour

Generated journey code currently supplies defaults such as:

- think time of 1 second when absent;
- expected HTTP status 200 when absent;
- `{ syntheticPayload: true }` for POST/PUT requests when no request body is defined.

This is an execution-governance failure.

Required behaviour:

- required step semantics must be explicitly supplied;
- zero think time must remain valid if explicitly supplied;
- missing expected status/body semantics must block the affected executable step or remain unresolved;
- add an engine-neutral request-body/payload reference/template concept if needed, without embedding k6-specific syntax in the canonical domain.

### 6. Threshold compiler must not repair incomplete criteria

The k6 threshold mapper currently defaults a missing operator to `<` and can parse a threshold from the display `target` string when structured `thresholdValue` is absent.

Required behaviour:

- provider compiler maps only fully structured executable criteria;
- no operator fallback;
- no provider-side threshold recovery from presentation strings;
- percentage vs rate units must be converted explicitly and correctly (`0.5%` = `0.005` rate, while `0.005 rate` remains `0.005`).

### 7. Contract execution gate

The M3 reference scenario correctly uses an `APPROVED` contract. The compiler should make the governance rule explicit: execution readiness requires an approved source contract, not merely a contract that is not `BLOCKED`.

A `READY_FOR_APPROVAL` contract may produce a reviewable Test Definition but must not become executable until approved.

### 8. Fingerprint consistency

M3 currently computes its own partial Performance Contract fingerprint while M2 has another contract fingerprint implementation. Two different values must not both be presented as the fingerprint of the same contract.

Required behaviour:

- consolidate on one authoritative deterministic Performance Contract drift-fingerprint function used by artefact and test-definition layers; or
- rename fingerprints so their scope is explicit and cannot be confused.

## Gate decision

The M3.0 implementation is architecturally strong enough to retain. This is a hardening pass, not a redesign.

M3.0 closes only after the above corrections pass tests, build and GitHub Actions on `master`.
