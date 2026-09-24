# PECP M4.3 Closure

## Milestone

**M4.3 — Execution-to-Evidence Portal & Workload Visualisation**

## Status

**CLOSED ✅**

M4.3 is formally closed following completion of the M4.3.1 Portal Zero-Invention, Canonical Projection & Reference Fidelity Gate and independent PM audit.

## Authoritative Implementation

Final M4.3.1 implementation SHA:

`8f44962826f07fce99ec975f39c1e6248a04e796`

Final authoritative CI run:

`35978004170`

Conclusion:

**SUCCESS**

Verification:

- 26 Vitest files passed
- 466 Vitest tests passed
- 10 RetailCo Reference Lab tests passed
- 476 combined tests
- TypeScript typecheck passed
- production build passed

## Delivered Capability

M4.3 brings the closed M3/M4 execution-to-export spine into the PECP portal as governed read-only projections.

Delivered:

- project-scoped execution/evidence service boundary;
- governed Results experience;
- governed Findings and Defect Candidate experience;
- governed Performance Evidence Package experience;
- governed execution record/ingress experience;
- dynamic Publication Bundle readiness display;
- deterministic workload scheduler profile visualisation;
- journey distribution visualisation;
- accessible table equivalent;
- project-neutral workload visualisation adapter;
- Tests-page reuse of the shared workload visualisation;
- explicit business-demand versus scheduler-demand separation;
- browser-safe RetailCo reference snapshot protected against canonical engine drift;
- generic non-RetailCo zero-bleed regression coverage.

## Governing Semantics Preserved

The portal does not independently calculate engineering truth.

It projects canonical state produced by the deterministic PECP engines.

The following laws remain intact:

- business workload demand is distinct from scheduler population demand;
- missing source data is not silently defaulted;
- individual criteria PASS does not imply overall PASS;
- Acceptance cannot PASS when required workload attainment is unresolved;
- Findings do not invent root cause;
- defect publication requires governed eligibility;
- Evidence Package validity is distinct from Acceptance outcome;
- publication readiness is source-driven;
- React does not own canonical Acceptance/Findings/Evidence logic.

## Authoritative RetailCo Reference State

M4.3 preserves the established reference truth:

- business demand: 8.75 orders/second;
- scheduler peak: 109.375 journey_iterations/second;
- execution model: OPEN;
- scheduler population: JOURNEY_ITERATION;
- schedule: 300s ramp-up, 900s steady, 120s ramp-down;
- journey distribution: 55/20/15/8/2;
- execution run: `pecp-ref-canonical-1789978991064`;
- Acceptance: INCONCLUSIVE;
- workload prerequisite: UNRESOLVED;
- derivation: UNRESOLVED_INSUFFICIENT_TIME_SERIES;
- Checkout p95: 0.3906885 ms, PASS against p95 < 2000ms;
- HTTP failure rate: 0, PASS against rate < 0.005;
- Findings: exactly one `WORKLOAD_ATTAINMENT_UNRESOLVED`;
- Defect Candidates: zero;
- Evidence Package: VALID;
- six required lineage edges verified;
- DOWNLOAD/API publication readiness: READY.

## Scope Boundary

M4.3 does not add:

- live Jira/ADO/Confluence/SharePoint calls;
- production runner orchestration;
- new Acceptance semantics;
- new Findings semantics;
- new Evidence Package semantics;
- new Results ingestion semantics;
- root-cause inference;
- release certification.

Those remain future productisation/integration concerns.

## Programme State

`M0 ✅ → M1 ✅ → M2 ✅ → M3 ✅ → M4.0 ✅ → M4.1 ✅ → M4.2 ✅ → M4.3 ✅`

The next milestone must be selected from the remaining Sellable MVP/productisation boundary rather than extending M4.3.
