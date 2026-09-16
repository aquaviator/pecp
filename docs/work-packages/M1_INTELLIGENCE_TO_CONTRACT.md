# Work Package: M1 — Intelligence → Deterministic Workload Model → Draft Performance Contract

## Objective

Create the first real PECP engineering vertical slice after M0.

M1 must transform approved/candidate project intelligence into:

1. a deterministic workload model with explicit calculation lineage; and
2. a versioned **draft Performance Contract** that truthfully exposes unresolved blocking issues rather than inventing missing information.

M1 is not allowed to execute tests or generate professional strategy/test-plan documents.

---

## Governing principles

Read and obey `docs/PRODUCT_CONSTITUTION.md` first.

The following are non-negotiable:

- The canonical PE model is authoritative.
- AI is not used for workload mathematics.
- No unexplained magic numbers.
- Missing or ambiguous inputs must remain visible.
- A draft contract may be generated with unresolved issues, but it must not become approvable if blocking intelligence remains unresolved.
- Do not infer concurrency from business throughput unless the required arrival-rate/session relationship is explicitly available.
- Workload mathematics must be pure, deterministic and unit tested.

---

## 1. Extract shared domain contracts from the portal

The web app must not permanently own PECP domain types.

Create a shared workspace package:

`packages/pe-domain/`

Move or define the authoritative shared TypeScript contracts required by M1 there, including at minimum:

- `CanonicalState`
- `ReviewStatus`
- `EngineeringIntent`
- `IntelligenceCategory`
- `IntelligenceItem`
- `IntelligenceCandidate`
- provenance/history structures
- workload-model structures
- workload-calculation structures
- workload issue/readiness structures
- Performance Contract structures
- contract status/readiness structures

Update `apps/web` to consume the shared package rather than duplicate authoritative domain definitions.

Do not create circular dependencies between packages and the web app.

---

## 2. Create deterministic workload engine package

Create:

`packages/workload-engine/`

This package must contain pure TypeScript domain logic only.

No React.
No network calls.
No database access.
No AI calls.

### Initial supported calculations

Implement explicit, unit-aware functions for at least:

### Business throughput conversion

Example:

`31,500 orders/hour = 525 orders/minute = 8.75 orders/second`

This is a unit conversion only. It must NOT be described as user/session arrival rate unless the source intelligence explicitly says so.

### Little's Law / concurrency calculation

Support:

`L = λ × W`

where:

- `L` = average concurrency / number in system
- `λ` = arrival rate of the same flow population
- `W` = average residence/session time

The engine must reject or block calculations when dimensional meaning is incompatible.

For example:

**Peak orders/hour + average session duration is NOT sufficient by itself to derive concurrent sessions.**

The engine must report a structured missing-prerequisite issue rather than calculating a misleading value.

### Growth/headroom transformations

Support explicit transformations where source values are supplied, such as:

`base × (1 + growth) × (1 + headroom)`

Do not invent default growth/headroom percentages.

### Journey distribution validation

- validate percentages sum to the expected whole within explicit tolerance;
- surface invalid totals;
- preserve source lineage.

---

## 3. Calculation lineage / explainability

Every derived workload value must expose structured lineage, including:

- calculation id
- output parameter
- output value
- unit
- formula identifier
- human-readable explanation
- input values
- source intelligence ids
- timestamp/version if appropriate
- warnings or assumptions

Example display concept:

```
Peak business throughput
31,500 orders/hour
÷ 60
= 525 orders/minute
÷ 60
= 8.75 orders/second

Source: intel-peak-orders
```

For blocked calculations:

```
Concurrent sessions: NOT CALCULATED

Reason:
Average session duration is known, but session arrival rate is not.
Peak order throughput cannot be assumed to equal session arrival rate.

Required intelligence:
Peak session starts/hour OR an approved relationship that converts business orders into session arrivals.
```

---

## 4. Workload readiness model

Introduce a structured workload readiness result.

It must distinguish at least:

- `READY`
- `PARTIAL`
- `BLOCKED`

and return structured issues such as:

- missing prerequisite
- ambiguous source
- conflicting source
- unapproved critical value
- incompatible units/semantics
- invalid journey distribution

Do not reduce readiness to a decorative percentage.

---

## 5. Draft Performance Contract compiler

Create a deterministic compiler/service that transforms current canonical intelligence + workload output into a **Draft Performance Contract**.

The contract should include at minimum:

- contract id
- project id
- version
- engineering intent
- contract status
- source intelligence references
- approved business/workload inputs
- deterministic workload calculations
- acceptance criteria that are sufficiently defined
- unresolved issues
- calculation lineage references
- approval readiness

### Initial statuses

Use a small explicit status model such as:

- `DRAFT`
- `BLOCKED`
- `READY_FOR_APPROVAL`
- `APPROVED`
- `SUPERSEDED`

Do not mark RetailCo's M1 contract approved automatically.

The existing ambiguous checkout requirement (`< 2 seconds` with no percentile) must remain visible as unresolved.

If required information for a full workload is missing, the contract must show the workload section as partial/blocked rather than inventing values.

---

## 6. RetailCo M1 reference behaviour

Use the existing RetailCo fixtures as the first M1 scenario.

After the peak-order conflict is resolved to the approved candidate:

- PECP may deterministically convert `31,500 orders/hour` into order throughput units.
- PECP must preserve the 8-minute session-duration intelligence separately.
- PECP must NOT infer concurrent sessions from order throughput + session duration alone.
- PECP must identify the missing session-arrival prerequisite for a session concurrency calculation.
- The checkout `< 2 seconds` criterion remains ambiguous until percentile is supplied.
- The resulting Performance Contract must therefore be a truthful draft with unresolved/blocking issues.

This behaviour is intentional and is a key PECP quality principle.

---

## 7. Portal implementation

Update the Workload page to consume the workload engine and display:

- approved/current workload inputs
- converted throughput values
- available deterministic calculations
- formulas and lineage
- blocked calculations
- required missing intelligence
- workload readiness

Update the Performance Contract page to render a real M1 draft generated from current canonical data rather than the M0 static blueprint.

The UI must not perform workload maths itself.

All calculation logic belongs in the workload-engine package.

---

## 8. Tests

Add meaningful automated tests covering at minimum:

### Workload engine

- `31,500 orders/hour` converts correctly to `525/min` and `8.75/sec`.
- session concurrency is blocked when only order throughput + session duration are available.
- Little's Law calculates correctly when a valid session arrival rate and session duration are explicitly supplied.
- growth/headroom calculations use only explicit supplied values.
- invalid journey-distribution totals are rejected/flagged.
- unit/semantic mismatch is surfaced rather than silently coerced.

### Contract compiler

- compiles a draft contract from RetailCo intelligence.
- preserves engineering intent `FORECAST`.
- includes calculation lineage.
- exposes ambiguous checkout percentile as unresolved.
- does not fabricate concurrent sessions.
- refuses approval readiness when blocking intelligence remains.

### Web integration

At least one test must verify the Workload/Contract view-model or service path consumes package outputs rather than reproducing calculation logic in components.

---

## 9. Reference-library foundation

Begin moving PECP reference truth out of portal-only fixtures.

Create a minimal version-controlled RetailCo scenario under:

`reference-library/retailco/`

At minimum include a machine-readable scenario manifest / ground-truth expectations for M1.

Do not yet build the full document/HLD library. That is a later work package.

The M1 truth file should state expected behaviour, including that session concurrency is intentionally **not derivable** from the current inputs.

---

## 10. Non-goals

Do not implement in M1:

- real AI document extraction
- Azure DevOps API connection
- Jira
- database persistence
- backend API server
- authentication
- k6 generation or execution
- JMeter
- Strategy generation
- Test Plan generation
- PDF/DOCX publishing
- telemetry ingestion
- advanced forecasting algorithms
- statistical regression
- M2 work

---

## Definition of Done

M1 is complete when:

1. authoritative shared M1 domain contracts live outside the portal;
2. workload calculations are deterministic, pure and tested;
3. PECP refuses invalid business-throughput → session-concurrency assumptions;
4. RetailCo produces correct throughput conversions and explicit missing prerequisites;
5. the Workload page is powered by the workload engine;
6. the Performance Contract page shows a real versioned draft compiled from canonical intelligence;
7. unresolved/ambiguous/blocking items remain visible;
8. tests, typecheck and build pass;
9. GitHub CI passes on the authoritative branch;
10. no M2 functionality has been started.

## Completion report

At completion report:

- files/packages created
- domain contracts introduced/moved
- formulas implemented
- readiness/blocking rules
- RetailCo M1 outcome
- tests added and results
- lint/build results
- CI run
- unresolved design questions

Stop after M1.
