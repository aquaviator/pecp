# PECP M3.2 Project Manager Review

## Status

**M3.2 — NOT ACCEPTED YET**

The architectural direction is strong and normal CI is green, but the current implementation does not yet satisfy the core M3.2 requirement that the **authoritative M3.1B GitHub Actions evidence artifact can be deterministically ingested without invention**.

A narrow correction gate is required before M3.2 can close.

## Authoritative remote implementation

The completion report cites local commit:

`3654390`

The authoritative GitHub implementation commit is:

`4ff4895425a16bf83c69465722e3cb6aee4e061d`

Normal CI:

`35584060125`

Result:

**SUCCESS**

Verified:

- 18 Vitest files passed;
- **221 Vitest tests passed**;
- **10 RetailCo Reference Lab TAP tests passed**;
- combined **231 tests**;
- TypeScript typecheck passed;
- production build passed.

The local/remote SHA difference is not itself a product defect, but the remote GitHub SHA is the authority.

## What is accepted

The following M3.2 design choices are directionally correct:

- canonical Results domain types are in `@pecp/pe-domain`;
- ingestion/parsing logic is outside the web UI;
- execution provenance is represented;
- scheduler observations and business events have separate structures;
- k6 threshold observations are not translated into a PECP verdict;
- the final PECP verdict boundary remains `PECP_PERFORMANCE_VERDICT_NOT_EVALUATED`;
- checksum/integrity and credential-leakage concepts exist;
- Reference Lab business-event corroboration exists;
- missing `pecp_workload_attainment_rate` is not silently populated from the existing synthetic fixture.

These are good foundations.

## Blocking findings

### 1. The “authoritative” test fixture is reconstructed synthetic data, not the authoritative M3.1B artifact

`apps/web/src/fixtures/retailco/m31bAuthoritativeRunFixture.ts` creates:

- `MOCK_CONFIG_CONTENT`;
- `MOCK_JOURNEYS_CONTENT`;
- `MOCK_ENTRYPOINT_CONTENT`;
- `MOCK_RUNTIME_CONTENT`;
- `MOCK_STDOUT_CONTENT`;
- a hand-built `AUTHORITATIVE_M3_1B_SUMMARY_JSON`;
- a hand-built manifest with checksums calculated over those mock bytes.

That is not the GitHub Actions artifact produced by run:

`35577599469`

Artifact:

`10629771462`

`m3-1b-evidence-canonical-35577599469`

The actual artifact was independently downloaded and inspected. The synthetic fixture differs materially from it.

Examples:

- actual `http_req_duration.p(95)` = approximately `0.330927`, fixture = `1.11`;
- actual Checkout `p(95)` = approximately `0.3906885`, fixture = `1.55`;
- actual `vus_max.max` = `282`, fixture = `281`;
- actual root checks are journey-specific checks, not one synthetic `status 200 or 201` check;
- the actual summary schema differs structurally from the fixture.

Tests that pass against reconstructed “authoritative” data do not prove ingestion of the authoritative artifact.

### 2. The parser does not parse the actual authoritative k6 summary-export schema

The authoritative GitHub artifact's `canonical/summary.json` has metrics in the form:

- counters: `metrics.<name>.count`, `metrics.<name>.rate`;
- trends: `metrics.<name>.avg/min/med/max/p(...)`;
- rates: `metrics.<name>.value/passes/fails`;
- thresholds: direct boolean entries under `thresholds`;
- root checks: an object/map keyed by check name.

The current parser expects:

- `metric.values.count/rate`;
- `metric.values.p(95)`;
- threshold entries shaped like `{ ok: boolean }`;
- `root_group.checks` to be an array;
- `state.testRunDurationMs` to be present.

That expectation matches the older repository-local M3.1B evidence file, not the authoritative GitHub Actions artifact.

As written, the authoritative run would leave major metrics undefined or incorrectly classified.

M3.2 cannot close until the exact artifact format from run `35577599469` is ingested successfully.

### 3. Generic ingestion still injects RetailCo/default values

`resultsIngestion.ts` currently supplies values when source evidence is absent, including:

- `schedulerPopulation ?? 'JOURNEY_ITERATION'`;
- scheduler peak fallback to `0`;
- hard-coded schedule identity `black_friday_2026_readiness___forecast_test`;
- actual iterations fallback to `0`;
- dropped iterations fallback to `0`;
- governed metric fallback to `orders`;
- governed target fallback to `8.75`;
- governed unit fallback to `orders/second`;
- observed business event count fallback to `0`;
- workload target fallback to `8.75`;
- governed population fallback to `JOURNEY_ITERATION`;
- hard-coded workload-attainment formula units / RetailCo schedule description.

This directly violates the M3.2 rule:

**No values are invented.**

Absence must be represented as absent/unresolved with data-quality lineage, not converted into a plausible RetailCo value or zero.

### 4. k6 `pecp_workload_attainment_rate` has the wrong canonical metric type

The stable runtime declares:

`pecp_workload_attainment_rate`

as a k6 `Rate`.

The Results Model currently types:

`pecpWorkloadAttainmentRate?: K6CounterMetric`

and the parser attempts to parse it using counter semantics.

This must be corrected before future Acceptance Engine work.

### 5. Required evidence completeness is not enforced for every required raw artifact

Missing files are represented as `ABSENT`, but the ingestion pipeline does not consistently create a data-quality issue for every required M3.1B evidence file.

For example, a missing `config.json`, `journeys.js`, `entrypoint.js`, `runtime.js`, stdout or stderr can be represented as absent without necessarily making the result incomplete/integrity-invalid.

M3.2 requires required raw evidence absence to be explicit and govern completion.

Add a generic required-artifact issue such as:

`MISSING_REQUIRED_ARTIFACT`

or equivalent.

### 6. Reference Lab evidence is modeled but not represented in the evidence inventory

`RawEvidenceInventory` includes `referenceLabMetrics`, but ingestion never populates it.

Because Reference Lab before/after/delta evidence is embedded in the execution manifest, represent its source explicitly, e.g.:

`execution-manifest.json#/referenceLabMetrics`

or another governed source locator.

### 7. Workload attainment needs an explicit unresolved steady-state/required-basis state

The current model calculates a whole-test average business-event rate and an attainment ratio, which is a legitimate raw derived observation.

However, the Contract target is not proven to use the full-shaped-test average as its acceptance measurement basis.

The current canonical result should therefore explicitly distinguish:

1. **FULL_TEST_AVERAGE_OBSERVATION** — deterministically derived from raw evidence; and
2. **STEADY_STATE / CONTRACT_ACCEPTANCE_ATTAINMENT** — unresolved with the current summary-only evidence.

A note string alone is not strong enough for the future Acceptance Engine boundary.

Do not allow M3.3 to consume the full-test-average ratio as if it were the governed acceptance attainment.

## Why the current tests did not catch this

The “real repository evidence” test reads:

`evidence/m3-1b/canonical/summary.json`

from source control.

That file is the older local canonical run evidence with the nested `values` summary structure.

The authoritative closure artifact for GitHub Actions run `35577599469` is a different evidence set and has a different summary-export shape.

Therefore CI proves compatibility with the older repository-local evidence and synthetic fixtures, not yet with the authoritative closure artifact.

## Decision

Do not start M3.3.

Complete:

**M3.2.1 — Authoritative Evidence Fidelity & Zero-Invention Gate**

Then re-audit M3.2.

No new real k6 run is required. Use the already-preserved authoritative artifact from workflow run `35577599469`.

