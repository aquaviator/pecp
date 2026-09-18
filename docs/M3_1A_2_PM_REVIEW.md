# PECP M3.1A.2 Project Manager Review

## Status

**M3.1A — REFERENCE LAB COMPLETE, PREFLIGHT AUTHORITY STILL HAS BINDING COMPLETENESS DEFECTS**

The M3.1A.2 implementation is present on authoritative `master` and GitHub Actions run `35340773522` is green.

Verified:
- governed source contract status is now carried into Test Definition;
- target probe evidence is supplied by real /health and /ready calls in tests;
- no-fallback tests cover missing workload attainment, population relationship, criterion operator/percentile/value and target URL;
- route-count heuristics were replaced with journey-step route checks;
- credential route/scheme binding is derived;
- authoritative RetailCo preflight validates;
- 176 Vitest tests and 10 native Reference Lab tests pass.

## Remaining pre-live defects

These are validator/binding completeness defects. They do not reopen M3.0 or the Reference Lab implementation.

### 1. Residual fallback values remain in the preflight builder

`buildExecutionPreflightManifest()` still contains source-authority fallbacks, including:
- a fixed default preflight timestamp;
- fallback service/version values;
- fallback k6 runtime version/source id when the compiled bundle does not provide them;
- fallback text such as `event` in checkout contribution rendering.

A preflight authority must block missing required bindings rather than repairing them.

### 2. Supplied source contract is not identity-bound to the Test Definition

When `sourceContract` is supplied, the builder/validator uses its status but does not prove that its id/version/fingerprint matches the Test Definition's source contract binding.

An unrelated APPROVED contract could therefore be supplied as approval evidence for a Test Definition bound to another contract.

Required: exact source contract id/version/fingerprint/status consistency.

### 3. READY law is not fully enforced by the validator

`validateExecutionPreflightManifest()` does not require every `preflightChecks` boolean to be true.

A tampered manifest may retain `status: READY_FOR_LIVE_EXECUTION` while one of the checks is false, yet validation can still succeed if no other issue is detected.

Required: READY only when every declared check is true and independently re-proven.

### 4. Threshold binding is not set-complete

The validator checks thresholds that are present in the manifest, but does not prove that every executable Test Definition criterion is represented exactly once.

A required threshold could be deleted from the manifest and escape validation.

When the source Performance Contract is supplied, executable criteria must also be proven to originate from that contract rather than only from a mutable Test Definition copy.

### 5. Governed workload binding is partial

Validation currently checks scheduler peak/unit/population, business target value and population relationship id, but not the full governed semantics.

It must also bind:
- business metric and unit;
- population relationship formula identifier;
- relevant journey key;
- journey share;
- contribution per successful event;
- derived scheduler rate.

### 6. Credential binding is only reference-id complete

The validator proves a required credential reference id exists, but does not compare provider, purpose, enforced route and enforced scheme.

It also derives from the Test Definition top-level credential list rather than proving that every credential reference used by a journey step is represented at the top level.

Required: exact union and exact semantic binding, with no missing or orphan references.

### 7. Route matching is prefix-based, not exact-path semantic

Current route matching permits `step.path.startsWith(route.path)`, which can make a route such as `/api/v1/foo-extra` appear to match `/api/v1/foo`.

Required: compare normalized URL pathnames exactly while allowing query-string differences where the manifest intentionally describes the route without a query.

Payload and auth semantics must be checked in both directions, and business-event metric/unit must be included in the comparison.

### 8. Target probe is not bound to the target being authorised

The supplied probe can prove one base URL healthy while the Test Definition names a different target URL.

Required:
- normalized probe base URL must match the Test Definition target;
- successful HTTP status evidence for /health and /ready must be required;
- manifest verified-probe metadata must match the supplied probe.

### 9. Fingerprint terminology

All PECP fingerprints/checksums in this layer remain deterministic **non-cryptographic** drift checksums. Completion reports and code comments must not describe them as cryptographic unless the implementation changes to a cryptographic primitive.

## Decision

Do not begin M3.1B until the final binding-completeness gate below passes on GitHub `master`.

This is a narrow M3.1A.3 correction. It adds no new product capability and does not run k6.
