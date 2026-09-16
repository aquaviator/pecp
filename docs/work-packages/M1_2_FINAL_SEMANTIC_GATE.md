# Work Package: M1.2 — Final Semantic Gate

## Objective

Close the final M1 semantic quality gate without starting M2.

M1.1 is materially improved and GitHub CI is green, but PM review found remaining cases where the portal/workload readiness layer can still contradict the governed canonical model or introduce fixture-specific defaults.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M0_CLOSURE.md`
- `docs/work-packages/M1_INTELLIGENCE_TO_CONTRACT.md`
- `docs/work-packages/M1_1_M1_GATE_CORRECTIONS.md`

## 1. Resolved items must not remain conflicting merely because history is retained

The current readiness engine treats any intelligence item with more than one candidate as conflicting, even when the parent item has been formally resolved and is now `canonicalState: APPROVED`, `reviewStatus: FOUND`, and has an approval event.

This makes the post-resolution RetailCo scenario contradict its own reference manifest, which says the remaining blockers are only:

- missing session arrival rate;
- ambiguous checkout percentile.

Required:

- candidate history may remain attached for provenance;
- multiple historical candidates alone must NOT imply an active conflict once an authoritative value has been formally resolved/approved;
- active conflict detection must be based on governed state / explicit unresolved status, not candidate count alone;
- update post-resolution candidate states consistently. Non-selected candidates should no longer look simultaneously current if they have been superseded by the formal resolution;
- add a test proving `RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE` does not produce a `CONFLICTING_SOURCE` issue for `peak_hourly_orders`.

## 2. Remove fixture-specific defaults from WorkloadPage

The portal must display and orchestrate canonical data. It must not contain hidden RetailCo defaults that can become calculations.

The current WorkloadPage contains fixture-specific values such as:

- fallback peak orders `31500`;
- default growth `20%`;
- default headroom `30%`;
- hard-coded session duration `8 minutes`;
- hard-coded absence of session arrival rate;
- hard-coded journey distribution 55/20/15/8/2;
- hard-coded source ids/titles;
- a direct conflict-resolution button that always selects `cand-3`.

Required:

- derive displayed/current workload inputs from `IntelligenceItem` data supplied by the service;
- if growth/headroom intelligence is absent, show `Not supplied` / no transformation rather than applying a default;
- derive session duration and session-arrival inputs from canonical intelligence aliases;
- derive journey distribution from structured canonical intelligence. If the current M1 domain shape is not sufficiently structured, show the source value/readiness limitation rather than hard-coding RetailCo percentages in the component;
- no numeric fallback may be used as an engineering input;
- remove the one-click `cand-3` resolution decision from WorkloadPage. Conflict resolution belongs in the Intelligence Review experience where the user can inspect candidates and choose/justify the authoritative source;
- WorkloadPage may link/navigate back to Intelligence Review when resolution is required, but must not make the engineering decision itself.

Tests must prove WorkloadPage does not calculate 31,500, 20%, 30%, 8 minutes, or a 55/20/15/8/2 distribution when those values are absent from supplied intelligence.

## 3. Acceptance criteria must be executable only when sufficiently defined

The current compiler can produce a `DEFINED` acceptance criterion from a numeric value even when the comparison operator is absent. Example: `max_error_rate` carries value `0.5` and unit `%`, but the operator meaning (`<`, `<=`, etc.) is not currently a structured field on the item.

Required:

- an acceptance criterion may be `DEFINED` only when the required executable semantics are present: metric/scope as appropriate, threshold, unit, and operator; latency criteria additionally require percentile when percentile semantics are required;
- if an operator or other required semantic is not represented by canonical intelligence, mark the criterion ambiguous/unresolved rather than inventing it;
- do not infer `maximum`, `below`, `at least`, etc. merely from friendly titles unless that parsing rule is explicitly implemented against source text and tested;
- add a test proving a numeric error-rate value without an operator does not become an executable `DEFINED` criterion.

## 4. Keep workload demand distinct from performance acceptance

A required workload level and a system performance threshold are related but different concepts.

Current compiler behaviour adds a derived `Peak Order Throughput >= 8.75 orders/sec` entry into the same acceptance-criteria collection simply because the workload conversion exists.

For M1:

- retain 31,500/hour = 8.75/sec as an approved workload demand / workload-attainment requirement;
- do not silently turn business demand into an NFR/system-performance acceptance criterion;
- if the domain needs an explicit workload-attainment gate, model it clearly as such (for example a separate workload target/attainment requirement) or leave it in the workload section for M1;
- preserve the later product law that a test cannot PASS if the required workload was not achieved, but do not conflate that with latency/error NFR semantics.

## 5. Deterministic compiler timestamp

`compileDraftPerformanceContract()` is described as deterministic but currently calls `new Date()` internally for `createdAt` and `updatedAt`.

Required:

- make compilation time an explicit input/clock dependency, or otherwise separate deterministic contract content from runtime metadata;
- repeated compilation with identical inputs and an identical supplied compilation timestamp must produce identical contract content;
- add a deterministic-output test.

## 6. Test-quality hardening

M1 tests currently use `any[]` in readiness tests and include invalid review-status values such as `reviewStatus: 'APPROVED'`, which bypasses the actual `ReviewStatus` type.

Required:

- remove `any` from the new M1/M1.1/M1.2 domain tests where practical;
- use valid `IntelligenceItem` / `ReviewStatus` values (`FOUND`, etc.);
- tests must not pass by constructing states the real type system would reject;
- keep `tsc --noEmit` clean.

## 7. Reference-manifest consistency test

The RetailCo M1 manifest declares exactly two remaining semantic blockers after peak-order resolution.

Add a test or deterministic fixture assertion that the post-resolution scenario aligns with the manifest:

- no active `peak_hourly_orders` conflict;
- session arrival rate remains missing/blocking;
- checkout percentile remains ambiguous/blocking;
- approved peak demand converts to 525/min and 8.75/sec;
- session concurrency is not calculated.

## Non-goals

Do not implement M2 functionality.
Do not generate Strategy/Test Plan documents.
Do not add backend/database/authentication.
Do not add k6 execution.
Do not add real connectors or AI ingestion.
Do not redesign the general portal.

## Definition of Done

M1 may be formally closed when:

1. post-resolution provenance/history no longer creates a false active conflict;
2. WorkloadPage contains no hidden RetailCo engineering defaults;
3. conflict selection occurs in governed Intelligence Review, not as a preselected WorkloadPage action;
4. executable acceptance criteria cannot be `DEFINED` with missing operator/required semantics;
5. workload attainment is distinct from performance NFR acceptance;
6. contract compilation is reproducible for identical inputs + supplied timestamp;
7. M1 tests use valid typed states rather than `any` escape hatches;
8. reference manifest and actual post-resolution engine output agree;
9. `npm ci`, lint, tests and build pass;
10. GitHub Actions is green on `master`.

## Completion report

Report:

- readiness conflict-resolution correction;
- WorkloadPage defaults removed and how missing values display;
- acceptance-criterion semantic changes;
- workload-target vs NFR modelling decision;
- deterministic compiler timestamp approach;
- tests added/changed and counts;
- lint/build results;
- GitHub Actions run result;
- unresolved design questions.

Stop after M1.2. Do not begin M2.
