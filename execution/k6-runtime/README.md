# PECP Stable k6 Runtime

This directory contains PECP's stable, reusable execution runtime for Grafana k6 (Constitution §10, Work Package M3.0).

## Architecture

PECP deliberately avoids the "script ejection" anti-pattern (where a tool generates one giant opaque standalone script that quickly drifts from canonical models).

Instead, PECP uses a decoupled three-layer architecture:
1. **Stable PECP Runtime (`execution/k6-runtime/src/`)**: Owned and maintained by PECP. Contains runner orchestration, weighted journey dispatching, custom workload arrival demand tracking, and summary hooks.
2. **Generated Configuration (`config.json`)**: Deterministically compiled from the canonical `TestDefinition`. Contains scenario execution options (`ramping-arrival-rate`), stages, and thresholds derived strictly from defined acceptance criteria.
3. **Generated / Reference Journey Modules (`journeys.js`)**: Clean modular transaction functions with metric tags, think times, and credential reference lookups.

## Security & Credential Boundary (Constitution §11)

No customer credentials, tokens, or passwords are embedded into generated code or committed fixtures. Authentication headers are resolved dynamically from environment variables using `CredentialReference` mapping (e.g. `__ENV['RETAILCO_CHECKOUT_AUTH_TOKEN']`).

## Workload Demand Attainment vs NFR Acceptance Criteria

Workload demand (e.g. 8.75 orders/second) is tracked via custom metrics (`pecp_workload_arrival_demand`) as an authoritative **prerequisite** for test evaluation, not converted into a false PASS/FAIL criterion.
