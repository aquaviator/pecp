# Work Package: M3.1A — RetailCo Reference Lab Foundation & Execution Preflight

## Objective

Build the deterministic RetailCo Reference Performance Lab target required for M3 live execution, verify that the canonical M3 Test Definition matches the actual lab surface, and complete the last preflight safety checks before any k6 run.

This work package **does not run the governed k6 load test**. It prepares the target and proves it is safe and coherent enough for M3.1B live execution.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M3_0_CLOSURE.md`
- `docs/work-packages/M3_0_CANONICAL_TEST_DEFINITION_AND_K6_BUNDLE.md`
- M3.0.1, M3.0.2 and M3.0.3 gate documents

Do not begin results verdict processing or M4.

---

## 1. Build the actual RetailCo Reference Lab

The current `reference-lab/` contains only `.gitkeep`. Replace that placeholder with a real deterministic Reference Lab implementation.

Create a small, dependency-light service under a clear location such as:

`reference-lab/retailco/`

Prefer the simplest implementation that can reliably sustain the M3 Reference workload and be run locally / in Docker. Node.js built-in HTTP APIs are acceptable if they keep the lab small and deterministic.

The healthy baseline service must expose at minimum the routes required by the canonical M3 RetailCo journeys:

- `GET /health`
- `GET /ready`
- `GET /api/v1/products/featured`
- `GET /api/v1/products/search?q=...`
- `POST /api/v1/basket/items`
- `POST /api/v1/orders/checkout`
- `GET /api/v1/customers/me/orders`

Responses must be deterministic enough for regression testing.

Do not add unrelated application features.

---

## 2. Make the lab facts match canonical reference intelligence

The Reference Lab is executable test data. Its behaviour must agree with the M3 reference fixture rather than forcing the fixture to lie about the lab.

Required:

- Browse route returns HTTP 200;
- Search route returns HTTP 200;
- Basket add accepts the governed RetailCo synthetic payload and returns HTTP 200;
- Checkout accepts the governed RetailCo checkout payload and returns HTTP 201 when authorised;
- Account history returns HTTP 200;
- the successful Checkout submission represents exactly one `order_created` business event for the M3 synthetic relationship;
- Checkout must reject missing/incorrect credentials without exposing secret values;
- health/readiness endpoints must accurately report lab state.

If existing M3 precondition text claims an implementation fact that the lab does not actually implement, correct the M3 execution-ready reference fixture so the precondition describes what the lab can truly verify. Do not alter historical M0/M1/M2 fixtures.

Do not claim a physical database contains 100,000 accounts or 50,000 SKUs unless the lab actually implements that fact. It is acceptable to represent deterministic synthetic cardinality profiles if they are labelled accurately as profiles rather than stored rows.

---

## 3. Ephemeral credential handling

Do not commit a live or reusable test secret.

The Reference Lab checkout endpoint and the k6 bundle must receive the same credential value only at runtime through environment variables / process environment.

Tests may generate an ephemeral token dynamically during execution. Do not hard-code secret values into:

- repository fixtures;
- source code;
- generated k6 files;
- manifests;
- logs.

The lab must fail safely when the expected credential configuration is absent.

---

## 4. Reference Lab route/contract manifest

Add a machine-readable Reference Lab surface manifest, for example:

`reference-lab/retailco/reference-lab-manifest.json`

It should describe enough stable behaviour to validate the canonical Test Definition, including:

- service/version;
- route path;
- method;
- expected healthy status;
- whether auth is required;
- whether a request payload is required;
- business-event contribution where applicable.

This manifest is Reference Lab truth, not a customer production contract.

Add deterministic tests proving the M3 RetailCo journey definitions agree with the actual lab manifest.

---

## 5. Minimal deterministic service behaviour

Implement only what the first governed run needs.

Suggested deterministic responses:

- featured/search return small synthetic product payloads;
- basket endpoint validates required fields and returns a stable synthetic basket reference;
- checkout validates auth and required checkout fields, then returns a synthetic order id / success payload;
- account-history returns a small synthetic order-history payload.

Do not require a large real database merely to satisfy fictional cardinality numbers.

The service may maintain lightweight in-memory request/order counters for debugging, but do not build the PECP Results Model here.

---

## 6. Docker / local execution

Provide a repeatable local target for M3.1B.

At minimum include:

- `Dockerfile`;
- a simple local run command;
- health check;
- documented environment variables;
- deterministic port configuration;
- no committed credentials.

A small Docker Compose file is acceptable if useful, but do not pull PECP itself into the container architecture.

Use a localhost-accessible target for preflight rather than the fictitious DNS name `reference-lab.retailco.internal` unless that DNS mapping is actually supplied by the Docker/network setup.

The M3 execution-ready environment reference must ultimately point to a target that the execution runner can resolve.

---

## 7. Final population-relationship preflight hardening

Before live execution, close two remaining generic semantic checks identified at M3.0 closure.

### 7.1 Units / population consistency

When a `WorkloadPopulationRelationship` is present, validate:

- `inputBusinessTarget.unit` matches the `WorkloadAttainmentRequirement.unit`;
- `outputSchedulerRate.population` matches `WorkloadSchedule.arrivalPopulation`;
- `outputSchedulerRate.unit` matches `WorkloadSchedule.rateUnit`;
- business and scheduler units are not silently treated as equivalent merely because numeric values happen to match.

Mismatches must block execution with structured issues.

### 7.2 Business-event contribution consistency

Validate that:

- `contributionPerSuccessfulEvent` is finite and greater than zero;
- the referenced journey exists;
- at least one governed step in that journey emits the relevant business event;
- the emitted `BusinessEventContribution.contribution` matches the relationship contribution;
- the governed success status used for the event agrees with the step expected status;
- event metric/unit semantics agree with the workload-attainment relationship where applicable.

Do not use `|| 1` or another fallback to repair invalid relationship data.

---

## 8. Reference Lab automated tests

Add focused tests covering at minimum:

- `/health` returns healthy status;
- `/ready` returns accurate readiness;
- Browse route healthy response;
- Search route healthy response;
- Basket validates and accepts canonical payload;
- Checkout returns 401/403 when credential is absent/invalid;
- Checkout returns 201 with an ephemeral valid credential and canonical payload;
- Account history returns healthy response;
- no secret value is echoed in responses/log-friendly error bodies;
- route manifest and M3 canonical journey steps agree;
- Checkout event semantics align with `order_created = 1`;
- corrected population unit/population checks block mismatches;
- corrected event-contribution checks block mismatches.

Tests should start the Reference Lab on an ephemeral/local test port and shut it down cleanly.

Do not invoke k6 in these tests.

---

## 9. Root CI integration

The Reference Lab must become part of repository quality gates.

Update the root workspace/scripts only as much as necessary so the authoritative CI run verifies both the PECP web/packages and Reference Lab tests.

If `reference-lab/*` becomes an npm workspace, regenerate and commit the root `package-lock.json` in the same work package.

From a clean root, run:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions on `master` must remain green.

---

## 10. Preflight artefact for M3.1B

Produce a machine-readable preflight manifest under `reference-library/retailco/` or `reference-lab/retailco/` that records the expected first-run bindings without recording a real result.

Include at minimum:

- Reference Lab service version;
- target URL reference strategy;
- route-manifest version;
- Test Definition id/version/fingerprint;
- k6 runtime version/source id;
- scheduler peak `109.375 journey_iterations/second`;
- business attainment target `8.75 orders/second`;
- Checkout contribution `1 order`;
- required credential reference id;
- expected healthy thresholds from the approved contract;
- status: `READY_FOR_LIVE_EXECUTION` only when all preflight checks pass.

Do not fabricate a test result.

---

## Non-goals

Do not:

- execute the full k6 workload against the Reference Lab;
- ingest `summary.json` into a PECP Results Model;
- assign PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE;
- generate findings/evidence packages;
- add production observability integrations;
- add JMeter;
- begin M4.

---

## Definition of Done

M3.1A is complete when:

1. a real RetailCo Reference Lab service exists in the repository;
2. all canonical M3 journey routes are implemented and tested;
3. checkout auth uses runtime-only credentials and fails safely;
4. Reference Lab manifest and canonical Test Definition agree;
5. Reference Lab execution-ready URL/network strategy is real and resolvable;
6. population relationship unit/population semantics are validated;
7. business-event contribution semantics are validated against the governed journey step;
8. no k6 live load run has occurred;
9. root tests/typecheck/build pass including Reference Lab verification;
10. GitHub Actions is green on `master`;
11. a preflight manifest says whether M3.1B may start.

## Completion report

Report:

- Reference Lab architecture/files;
- routes and healthy behaviour;
- auth/credential approach;
- reference manifest alignment;
- population relationship hardening;
- business-event contribution hardening;
- Docker/local-run strategy;
- tests added and totals;
- root CI changes;
- GitHub Actions result;
- preflight status for M3.1B;
- unresolved design questions.

Stop after M3.1A. Do not run k6 load against the lab.