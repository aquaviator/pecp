# PECP M3.0.2 PM Review — Arrival Population Semantics

## Status

**M3.0.2 implementation quality: PASS**

**M3.0 milestone: REMAINS OPEN pending M3.0.3 semantic correction**

The M3.0.2 pre-live validity gate is materially implemented and GitHub CI is green. The generated k6 bundle now has valid ramping-arrival-rate schema, one authoritative runtime source, mandatory-precondition gating, explicit provider threshold failures, safe credential resolution and execution-structure validation.

However, PM review found one critical semantic mismatch that must be corrected before live Reference Lab execution.

## Critical finding — scheduler arrival population is being conflated with business order throughput

The current RetailCo M3 reference model has:

- approved business demand: **8.75 orders/second** (31,500 orders/hour);
- a mixed journey distribution: Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%;
- a k6 `ramping-arrival-rate` schedule whose stage target is **8.75**.

For k6 `ramping-arrival-rate`, the stage target is the rate at which **iterations are started** per `timeUnit`. It is not automatically a business transaction or order rate.

In the current runtime, one iteration selects exactly one weighted journey. Therefore a mixed-journey executor running at 8.75 iterations/second with Checkout weighted at 8% does **not** represent 8.75 orders/second. If one successful Checkout iteration creates one order, the expected order-producing iteration rate would be approximately 0.7 orders/second, not 8.75.

That would violate PECP's core semantic law established in M1: business throughput must not be silently reinterpreted as another flow population.

## Required correction

Before live execution, PECP must explicitly distinguish:

1. **scheduler arrival population/rate** — the flow k6 is actually starting, such as journey iterations/second or sessions/second; and
2. **business workload attainment** — the required business event rate, such as orders/second.

A business target may drive a scheduler rate only when an explicit, governed relationship exists between the populations.

For the synthetic RetailCo Reference Lab, it is acceptable to define a governed relationship such as:

- Checkout share = 8%;
- one successful Checkout journey = one order;
- required order throughput = 8.75 orders/second;
- required mixed journey iteration rate = 8.75 / 0.08 = **109.375 journey iterations/second**.

But that relationship must be explicit reference data with lineage. It must never be inferred by the k6 provider simply because both values happen to exist.

## Secondary cleanup

The current domain permits a schedule `timeUnit` of seconds or minutes while the k6 provider currently emits `timeUnit: '1s'`. The provider should derive its k6 `timeUnit` consistently from the canonical scheduler rate unit or reject incompatible schedule units rather than produce contradictory metadata.

## Gate decision

Do **not** execute k6 against the Reference Lab yet.

Complete `docs/work-packages/M3_0_3_ARRIVAL_POPULATION_AND_ATTAINMENT_SEMANTICS.md` first.
