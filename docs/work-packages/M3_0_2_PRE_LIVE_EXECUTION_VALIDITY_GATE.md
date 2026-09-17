# Work Package: M3.0.2 — Pre-Live Execution Validity Gate

## Objective

Close M3.0 by proving that the generated k6 bundle is structurally valid, governed, and safe to execute before any live Reference Lab run begins.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M2_CLOSURE.md`
- `docs/work-packages/M3_0_CANONICAL_TEST_DEFINITION_AND_K6_BUNDLE.md`
- `docs/work-packages/M3_0_1_EXECUTION_GOVERNANCE_GATE.md`
- `docs/M3_0_1_PM_REVIEW.md`

Do **not** execute k6 against the Reference Lab in this work package.

---

## 1. Correct k6 ramping-arrival-rate schema

The generated scenario uses `executor: 'ramping-arrival-rate'`.

For this executor:

- use `startRate`, not `rate`;
- `timeUnit` must be explicit;
- stage targets/durations must come only from the canonical WorkloadSchedule;
- do not add an unexplained provider value merely to satisfy schema.

For the RetailCo M3 schedule, if the intended start is zero then that zero must be represented canonically or derived transparently from the first ramp semantics and tested.

Add tests that inspect the generated config and prove the scenario uses valid ramping-arrival-rate properties.

---

## 2. Establish one authoritative stable k6 runtime source

There must be exactly one maintained PECP stable-runtime implementation.

Current duplication exists between:

- `execution/k6-runtime/src/*`; and
- the runtime source embedded inside `packages/test-engine/src/k6Compiler.ts`.

Refactor so generated bundles package/reference the authoritative runtime source rather than maintaining a second implementation string.

Acceptable approaches include:

- a shared runtime-source module consumed by both the repository runtime and bundle compiler; or
- another deterministic build-time packaging mechanism with one canonical source.

Requirements:

- no parallel hand-maintained runtime implementations;
- generated `runtime.js` must be traceable to the authoritative runtime version/source;
- runtime version must be exposed in bundle metadata;
- tests should detect drift between packaged runtime and authoritative runtime.

Do not move customer-specific journeys into the stable runtime.

---

## 3. Supplied execution preconditions must gate executability

Preconditions remain source-driven. Do not fabricate them.

When an execution precondition is supplied:

- if it is marked/treated as mandatory and `isSatisfied: false`, Test Definition must be non-executable;
- emit a structured blocking issue and blocking reason;
- `READY_FOR_EXECUTION` is permitted only when all mandatory supplied preconditions are satisfied.

If no preconditions are supplied and they are not declared mandatory for that Test Definition, keep the collection empty without inventing checks.

Add tests proving an approved contract + valid schedule/journeys + one failed mandatory precondition cannot become `READY_FOR_EXECUTION`.

---

## 4. Provider threshold mapping failures must be explicit

The k6 provider may only compile thresholds it understands exactly.

For every criterion in `TestDefinition.executableCriteria`:

- either map it successfully into a k6 threshold; or
- emit a provider compilation issue explaining why it cannot be mapped.

If a required executable criterion cannot be represented by the provider, the resulting k6 bundle must be non-executable.

Do not silently drop unsupported units, operators, percentiles, metric/scope semantics, or criterion types.

Add tests for at least:

- valid latency criterion mapping;
- valid `%` error rate mapping;
- valid `rate` error mapping;
- unsupported unit => explicit provider issue + non-executable bundle.

---

## 5. Required credential references must fail safely

Generated code must never send a fabricated placeholder credential such as `Bearer NOT_CONFIGURED`.

For credential-referenced journey steps:

- generated code should read the referenced environment variable / credential binding;
- if the required value is absent at runtime, fail fast with a clear PECP credential-resolution error before sending the affected request;
- do not log the credential value;
- do not embed raw secrets in generated files, fixtures, tests or metadata.

Add tests proving:

- no placeholder bearer/token value is emitted;
- missing required credential reference produces an explicit runtime failure path;
- generated code still contains only the credential reference identifier.

---

## 6. Minimal execution-structure validation

Before a Test Definition or k6 bundle can be executable, validate the structural invariants that are necessary for safe execution:

- journey weights/percentages form a valid distribution within explicit tolerance;
- schedule stages are non-empty and durations are positive;
- schedule `totalDurationSeconds` matches the explicit stage-duration sum or is otherwise explicitly derived/validated;
- schedule `peakArrivalRate` matches the maximum explicit stage target or is explicitly explained;
- journey steps contain valid supported HTTP methods and non-empty paths;
- mutating request payload requirements from M3.0.1 remain enforced.

Do not invent corrected values. Invalid structures produce blocking issues.

---

## 7. Tests and CI

Add focused tests for every correction above.

From a clean repository root run:

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`

Regenerate and commit `package-lock.json` if dependencies/workspaces change.

GitHub Actions on authoritative `master` must pass.

---

## Non-goals

Do not:

- run k6 against the Reference Lab;
- add result ingestion;
- calculate PASS/FAIL verdicts from real executions;
- add findings/evidence generation;
- add JMeter;
- begin M4.

---

## Definition of Done

M3.0 may close when:

1. generated ramping-arrival-rate config uses valid k6 executor semantics;
2. one authoritative stable runtime source exists and generated bundles package/reference it deterministically;
3. failed mandatory supplied preconditions block execution;
4. provider threshold mapping cannot silently discard executable criteria;
5. required credential references fail safely without placeholder secrets;
6. execution schedule/journey structural invariants are validated;
7. all tests/typecheck/build pass;
8. GitHub Actions is green on `master`;
9. no live Reference Lab execution has begun.

## Completion report

Report:

- k6 scenario schema correction;
- authoritative runtime source design/versioning;
- precondition gating semantics;
- provider threshold issue model;
- credential runtime failure behaviour;
- structural validation rules;
- tests added and totals;
- lint/build results;
- GitHub Actions result;
- unresolved design questions.

Stop after M3.0.2. Do not begin M3.1 live execution.