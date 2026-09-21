# Work Package: M3.2.1 — Authoritative Evidence Fidelity & Zero-Invention Gate

## Objective

Correct M3.2 so that PECP deterministically ingests the **actual authoritative M3.1B GitHub Actions artifact** with zero source-value invention and zero semantic conflation.

This is a correction gate for M3.2, not M3.3.

Authoritative source:

- GitHub Actions run: `35577599469`
- repository SHA: `76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`
- artifact ID: `10629771462`
- artifact name: `m3-1b-evidence-canonical-35577599469`
- artifact digest: `sha256:0165c41c27ccdd852400f1499870bdc3e0e164544efe86591928fdfce6cbae91`

Read:

- `docs/M3_1B_CLOSURE.md`
- `docs/work-packages/M3_2_RESULTS_MODEL_RAW_EVIDENCE_INGESTION.md`
- `docs/M3_2_PM_REVIEW.md`

Do not implement M3.3 Acceptance Engine.
Do not assign a PECP final performance verdict.

## 1. Replace reconstructed authority with actual authoritative artifact fixture

Do not label hand-built `MOCK_*` data as authoritative.

Create a deterministic CI-safe fixture from the exact canonical evidence produced by artifact `10629771462`.

Preferred options:

- commit the small 40 KB authoritative ZIP as a test fixture and extract it to a temp directory during tests; or
- commit the exact canonical artifact files under a dedicated immutable test-fixture directory.

The fixture must preserve exact authoritative bytes/checksums for at least:

- execution-manifest.json;
- summary.json;
- config.json;
- journeys.js;
- entrypoint.js;
- runtime.js.

If stdout/stderr are omitted from source-control fixture for repository policy reasons, provide exact checksum/size metadata plus dedicated fixture bytes where required to prove inventory validation. Do not silently substitute reconstructed content.

Do not overwrite the production/reference `evidence/m3-1b/canonical` directory with fixture data.

## 2. Parse the actual k6 v0.54.0 summary-export shape

The parser must support the schema actually present in the authoritative artifact.

The authoritative artifact includes direct metric fields rather than the older nested `values` representation.

Support exact observed forms for:

- counters;
- trends;
- gauges;
- rates;
- threshold maps;
- root-group checks.

Maintain backward compatibility with the older nested shape only if intentionally required and explicitly tested.

Do not normalize an absent raw field to zero.

For every normalized field:

- source present → parse exact value;
- source absent → `undefined` / explicit unavailable state;
- malformed source → parser/data-quality issue.

## 3. Threshold semantics must be grounded in the actual k6 schema

The authoritative artifact threshold entries are not shaped as `{ ok: boolean }`.

Determine the exact k6 v0.54.0 summary-export meaning of the boolean threshold value and encode that mapping explicitly.

Preserve:

- raw threshold value;
- raw metric source;
- normalized engine observation status;
- parser schema/version.

Do not infer PASS/FAIL at PECP level.

Add tests using the exact authoritative threshold bytes.

## 4. Root checks must parse the authoritative structure

The authoritative `root_group.checks` is a map/object keyed by check name.

Support that format and preserve individual journey-specific checks.

Do not replace them with a synthetic aggregate check.

## 5. Remove all generic RetailCo/default injection

Remove project-specific and plausible-default fallbacks from generic results ingestion.

Specifically remove defaults such as:

- JOURNEY_ITERATION when source is absent;
- orders;
- 8.75;
- orders/second;
- hard-coded RetailCo scenario name;
- 300/900/120 schedule prose;
- zero for absent iterations/dropped iterations/business events;
- k6 as an assumed engine if absent.

Where canonical model fields are required, update the type to support explicit unresolved/missing state or create a data-quality issue.

Missing evidence must never become a valid-looking observation.

## 6. Correct metric semantics for pecp_workload_attainment_rate

The stable runtime declares `pecp_workload_attainment_rate` as k6 `Rate`.

Represent it using rate semantics, not counter semantics.

If absent in the authoritative summary:

- normalized metric remains absent;
- record the appropriate explicit availability/quality observation if required;
- do not create zero values.

## 7. Enforce required raw-artifact completeness

For all eight canonical M3.1B evidence files, absence must result in an explicit data-quality issue and `dataQuality.isComplete = false`.

Required:

- execution-manifest.json;
- summary.json;
- k6-stdout.log;
- k6-stderr.log;
- config.json;
- journeys.js;
- entrypoint.js;
- runtime.js.

Add a generic issue code such as `MISSING_REQUIRED_ARTIFACT` if appropriate.

Validate:

- presence;
- checksum;
- size where authoritative size is provided.

## 8. Represent Reference Lab evidence provenance explicitly

Reference Lab before/after/delta is embedded in the execution manifest.

Populate a raw-evidence/source reference for it using a governed locator such as:

`execution-manifest.json#/referenceLabMetrics`

Preserve capture timestamps and delta values.

## 9. Separate full-test average from contract-basis attainment

Represent at least two concepts explicitly:

### Full-test average observation

Derived from the authoritative raw counter rate or event count/time basis.

This is descriptive raw/derived evidence.

### Acceptance-basis / steady-state attainment

For the current M3.1B evidence this remains:

`UNRESOLVED_INSUFFICIENT_TIME_SERIES`

unless there is authoritative stage/window evidence proving the governed measurement basis.

Do not store one generic attainment ratio that can later be mistaken for the acceptance basis.

M3.3 must be forced to consume the governed acceptance-basis observation, not a convenient whole-run average.

## 10. Authoritative invariant tests

Add tests against the exact M3.1B artifact proving at minimum:

- run id = `pecp-ref-canonical-1789978991064`;
- repository SHA = `76c2dfd7d829d3152aa2c4f6a98d9cd08e7efd82`;
- workflow run = `35577599469`;
- k6 version = `0.54.0`;
- duration = `1321.161s`;
- iterations = `120981`;
- dropped iterations = `8`;
- business events = `9671`;
- Reference Lab order_created = `9671`;
- total Reference Lab request delta = `120982`;
- bundle fingerprint = `fp-256b6329`;
- `pecp_workload_attainment_rate` is absent;
- no final PECP performance verdict is assigned.

Also assert exact authoritative summary values rather than reconstructed ones for at least:

- `http_req_duration.p(95)`;
- Checkout `p(95)`;
- `vus_max`;
- journey-specific root checks.

## 11. Negative tests

Add tests proving:

- missing each required artifact makes results incomplete;
- missing source workload target does not become 8.75;
- missing metric does not become 0;
- missing scheduler population does not become JOURNEY_ITERATION;
- malformed direct k6 metric is surfaced;
- malformed nested/legacy metric is surfaced where supported;
- threshold raw boolean mapping is deterministic;
- root-check map parsing is deterministic;
- checksum mismatch remains an integrity error;
- credential leakage remains fatal;
- business-event count mismatch remains an integrity error and not a PECP FAIL.

## 12. Normal CI

Normal CI must remain k6-independent and green.

No new 22-minute execution is required for this gate.

## Definition of Done

M3.2.1 is complete when:

1. the actual authoritative M3.1B artifact is the principal ingestion fixture;
2. its exact k6 summary schema is parsed successfully;
3. authoritative values are preserved exactly;
4. all generic RetailCo/default fallbacks are removed;
5. absent values remain absent/unresolved;
6. `pecp_workload_attainment_rate` has correct Rate semantics;
7. all required artifacts govern completeness;
8. Reference Lab evidence provenance is explicit;
9. full-test-average and acceptance-basis attainment cannot be conflated;
10. no final PECP performance verdict is evaluated;
11. normal CI is green.

Stop and provide an M3.2.1 completion report for PM audit.
