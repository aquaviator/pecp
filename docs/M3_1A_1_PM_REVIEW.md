# PECP M3.1A.1 Project Manager Review

## Status

**M3.1A — REFERENCE LAB COMPLETE, PREFLIGHT COMPILER HARDENING REQUIRED BEFORE LIVE EXECUTION**

The M3.1A.1 implementation is present on authoritative `master` and GitHub Actions run `35337730828` is green.

Verified:
- RetailCo Reference Lab service exists and is covered by native HTTP tests;
- ephemeral test credentials are generated at runtime;
- the Reference Lab manifest includes the supported metrics route;
- Test Definition, contract, runtime and bundle fingerprints are carried into the preflight artefact;
- approved criterion identifiers and provider threshold expressions are aligned;
- deterministic preflight validation catches several drift cases;
- root test command runs 157 Vitest tests plus 10 Reference Lab native tests.

## Remaining pre-live issue

The new preflight compiler can still manufacture a READY_FOR_LIVE_EXECUTION artefact from missing or weakly checked data.

This is a governance defect because the preflight artefact is the authority that permits M3.1B.

### 1. No fallback engineering values in preflight generation

`buildExecutionPreflightManifest()` currently contains fallbacks including:
- default p95 aggregation;
- default `<` operator;
- default threshold `0`;
- default workload attainment `8.75 orders/second`;
- default Checkout relationship share `0.08`;
- default event contribution `1`;
- default scheduler population;
- default localhost target values.

These values must never be invented by the preflight compiler.

The preflight layer must only bind to values already present in the compiled Test Definition, k6 bundle and Reference Lab manifest. Missing mandatory bindings must produce PREFLIGHT_BLOCKED.

### 2. Contract approval must not be inferred from an identifier

Current preflight logic uses the presence of the word `approved` in the source contract id as a contract-approval signal.

Preflight must use governed status carried by authoritative compiled state, not string naming conventions.

### 3. Route-manifest alignment must be semantic

A route count such as `routes.length >= 7` is not sufficient proof of alignment.

Preflight must verify required journey routes by method/path and the governed route semantics required for execution:
- expected healthy status;
- auth requirement / scheme where applicable;
- payload requirement;
- business-event contribution where applicable.

### 4. Target resolvability cannot be hard-coded true

`targetResolvable: true` is not evidence.

M3.1A may use an explicit preflight probe result supplied by the lab verification step, or a source-driven verified readiness input. The builder itself must not assert network reality it has not observed.

### 5. Credential bindings must be derived, not hard-coded to Checkout

The compiler currently stamps Checkout route / Bearer scheme into every credential binding.

For RetailCo this happens to be correct, but the generic compiler must derive the binding from governed journey and Reference Lab route data. It must not assume all credentials are Checkout Bearer credentials.

### Decision

Do not start M3.1B until these preflight-authority issues are removed and GitHub CI remains green.

This is a small M3.1A.2 correction. It does not reopen M3.0 and does not add new product scope.
