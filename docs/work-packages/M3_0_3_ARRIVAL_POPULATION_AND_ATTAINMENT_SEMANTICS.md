# Work Package: M3.0.3 — Arrival Population & Workload Attainment Semantics

## Objective

Close the final semantic gap before any live Reference Lab execution.

PECP must distinguish the rate of **iterations/sessions/journeys started by the execution engine** from the rate of **business outcomes that must be attained**, such as orders/second.

A k6 arrival-rate executor schedules iterations. It must not silently treat a business order-throughput target as an iteration-arrival rate when mixed journeys are being selected.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M2_CLOSURE.md`
- `docs/work-packages/M3_0_CANONICAL_TEST_DEFINITION_AND_K6_BUNDLE.md`
- `docs/work-packages/M3_0_1_EXECUTION_GOVERNANCE_GATE.md`
- `docs/work-packages/M3_0_2_PRE_LIVE_EXECUTION_VALIDITY_GATE.md`
- `docs/M3_0_2_PM_REVIEW.md`

Do **not** execute k6 against the Reference Lab in this work package.

---

## 1. Introduce explicit scheduler-arrival population semantics

Extend the engine-neutral execution model minimally so a `WorkloadSchedule` explicitly states what population the executor is starting.

Use a small model such as:

- `JOURNEY_ITERATION`
- `SESSION`
- `TRANSACTION`

or an equivalent explicit representation.

Requirements:

- schedule stage targets must have an unambiguous population and rate unit;
- `journey_iterations/second` is not the same semantic quantity as `orders/second`;
- provider code must not rename one population into another;
- k6 bundle metadata must preserve scheduler population/rate separately from workload-attainment targets.

---

## 2. Keep business workload attainment separate from scheduler arrival rate

`WorkloadAttainmentRequirement` remains the required business demand / business event target.

For RetailCo:

- required business attainment remains **8.75 orders/second**;
- this is not automatically the k6 `ramping-arrival-rate` stage target.

The Test Definition and portal must show these as separate concepts, for example:

- Scheduled mixed-journey arrival rate: `109.375 journey_iterations/second`
- Required business outcome: `8.75 orders/second`

Do not implement PASS/FAIL verdict processing yet.

---

## 3. Explicit governed population relationship

If a scheduler rate is derived from a business-event target, the relationship must be explicit and traceable.

For the synthetic RetailCo Reference Lab, define an approved reference relationship:

- Checkout journey share = `0.08`;
- each **successful Checkout journey** contributes exactly `1 order`;
- required business target = `8.75 orders/second`;
- therefore required mixed journey arrival rate = `8.75 / 0.08 = 109.375 journey iterations/second`.

This is acceptable only because it is explicit Reference Lab truth.

Represent the relationship in canonical/reference data with enough lineage to explain:

- input business target;
- relevant journey/event share;
- contribution per successful event;
- formula identifier;
- output scheduler rate;
- source/reference ids.

Do not make the k6 provider discover or guess this relationship.

If no explicit relationship exists for a project that needs one, execution must remain blocked.

---

## 4. Add workload-attainment signal / business-event contribution

The execution model must identify how a business outcome is observed during execution.

Add the minimum engine-neutral concept required to state that a successful step contributes to an attainment metric, for example:

- event key: `order_created`;
- metric/unit: `orders`;
- contribution: `1`;
- journey/step: Checkout submit;
- success condition based on the explicitly governed expected status.

The stable k6 runtime may record this as a custom metric/counter, but must not turn it into an NFR threshold or verdict in M3.0.3.

Requirements:

- business-attainment metric is separate from iteration-arrival metric;
- only successful governed business-event steps contribute;
- no hidden assumption that every iteration equals one order.

---

## 5. Correct RetailCo M3 execution-ready reference state

Preserve all earlier M0/M1/M2 blocked/historical fixtures.

Update only the M3 execution-ready Reference Lab state so that it explicitly contains:

- business target: `8.75 orders/second`;
- scheduler population: `JOURNEY_ITERATION` (or equivalent);
- mixed-journey scheduler peak: `109.375 journey iterations/second` for the approved synthetic relationship above;
- Checkout share: 8%;
- successful Checkout submit contribution: 1 order;
- explicit lineage explaining the relationship;
- existing explicit schedule durations, endpoints, payloads, credential references and acceptance criteria.

Update the M3 machine-readable manifest accordingly.

The resulting model must make it impossible to read `109.375` as the customer business order target or `8.75` as the mixed-journey iteration rate.

---

## 6. k6 provider mapping

For `ramping-arrival-rate`:

- stage targets must map from the canonical **scheduler arrival rate** only;
- k6 `timeUnit` must be consistent with the canonical scheduler rate unit/population;
- do not use business-attainment target as `startRate` or stage target unless the canonical relationship is explicitly 1:1 for that scenario;
- bundle metadata must carry both scheduler-arrival semantics and business-attainment semantics.

The provider should reject incompatible/unsupported scheduler rate units rather than silently coerce them.

---

## 7. Stable runtime metrics

Refine runtime metric naming/recording so the following are distinguishable:

1. scheduler/iteration activity, e.g. iterations started; and
2. business attainment, e.g. successful `order_created` events.

Do not claim the iteration counter proves order-demand attainment.

A custom Counter tagged with the business-event key is acceptable for M3.0.3.

No results model or verdict engine is required yet.

---

## 8. Portal clarity

Update the Tests page so the execution-ready M3 view visibly distinguishes:

- scheduler population and arrival rate;
- business workload-attainment target;
- the explicit relationship/lineage between them;
- the business-event signal used to observe attainment.

The UI must not imply that 8.75 orders/sec equals 8.75 mixed journey iterations/sec.

---

## 9. Tests

Add tests proving at minimum:

- a mixed-journey Test Definition cannot use `8.75 orders/second` directly as its k6 iteration rate without an explicit 1:1 relationship;
- RetailCo Reference Lab scheduler peak is `109.375 journey_iterations/second` while business attainment remains `8.75 orders/second`;
- Checkout share is 8% and successful Checkout contribution is 1 order;
- deterministic relationship lineage explains `8.75 / 0.08 = 109.375`;
- generated k6 stages use scheduler-arrival rate, not business-attainment rate;
- business attainment is recorded via a separate custom metric/event signal;
- provider rejects unsupported/incompatible arrival-rate units/populations;
- no NFR threshold is created from the business-attainment metric;
- earlier blocked M1/M2 scenarios remain unchanged;
- all existing M3 governance tests continue to pass.

---

## 10. CI discipline

Run from clean root:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

GitHub Actions on `master` must be green.

---

## Non-goals

Do not:

- execute k6 against the Reference Lab;
- build results ingestion;
- evaluate PASS/FAIL/INCONCLUSIVE from real runs;
- add findings/evidence;
- add JMeter;
- begin M4.

---

## Definition of Done

M3.0 may close only when:

1. scheduler arrival population/rate is explicit and engine-neutral;
2. business workload attainment remains a separate governed concept;
3. any mapping between the two is explicit, traceable and non-inferred;
4. RetailCo M3 reference state no longer equates 8.75 orders/sec with mixed-journey iteration rate;
5. k6 stages use scheduler rate only;
6. business-event attainment is observable via a distinct runtime metric/signal;
7. tests/typecheck/build pass;
8. GitHub Actions is green on `master`;
9. no live Reference Lab execution has begun.

## Completion report

Report:

- domain changes for scheduler population semantics;
- workload-attainment relationship model;
- RetailCo M3 scheduler/business rates and lineage;
- runtime attainment signal implementation;
- k6 provider mapping changes;
- portal presentation changes;
- tests added and totals;
- lint/build results;
- GitHub Actions result;
- unresolved design questions.

Stop after M3.0.3. Do not begin M3.1 live execution.
