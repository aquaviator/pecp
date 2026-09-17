# Work Package: M2.1 — Artefact Governance Gate

## Objective

Close M2 without starting M3 by removing invented project-specific engineering facts from generated Strategy/Test Plan artefacts and restoring green deterministic CI.

Read and obey:

- `docs/PRODUCT_CONSTITUTION.md`
- `docs/M1_CLOSURE.md`
- `docs/work-packages/M2_ENGINEERING_ARTEFACTS.md`
- `docs/M2_PM_REVIEW.md`

## 1. Repair deterministic npm CI

The M2 GitHub Actions run fails because `@pecp/artefact-engine` is absent from the committed root lockfile.

Required:

- regenerate root `package-lock.json` with npm 10.9.8 after all M2 workspace changes;
- `npm ci` from a clean checkout must succeed;
- then `npm run lint`, `npm run test`, and `npm run build` must pass;
- GitHub Actions on `master` must be green;
- do not weaken CI or reintroduce install fallbacks.

## 2. No invented execution schedules

The current Test Plan hard-codes project-specific schedules and workload percentages that are not present in canonical intelligence.

Remove authoritative use of unsourced values including, but not limited to:

- 1 virtual user baseline;
- 10-minute baseline;
- 15-minute ramps;
- 60-minute steady state;
- 4-hour / 4–8-hour soak;
- 80–100% demand;
- 120–150% demand;
- 10% steps every 10 minutes;
- `Until saturation` as if already approved for this project.

Rules:

- exact ramp profiles, durations, proportions, VU counts, soak windows and stress limits must come from canonical intelligence / approved scenario definitions;
- if not supplied, render `NOT_SUPPLIED`, `UNRESOLVED`, or equivalent;
- PECP methodology may say that baseline/load/stress/soak activities are available or may be appropriate beneath the selected intent, but any such content must be clearly labelled as **PECP methodology guidance / proposed activity**, not an approved project parameter;
- proposed methodology must not make an artefact approvable if required project-specific parameters remain unresolved.

## 3. No invented Strategy assumptions

Remove the default assumption:

`Steady-state equilibrium assumed across operational test windows.`

and any equivalent assumption inserted solely because the source contains none.

If no assumptions are supplied:

- state that no explicit project assumptions are currently recorded; or
- mark the relevant assumption content `NOT_SUPPLIED` / review required.

Methodological principles are allowed if clearly identified as PECP methodology, not project assumptions.

## 4. Remove unsourced execution preconditions and verification methods

Current artefacts include concrete preconditions such as synthetic account seeding, account-login smoke checks, APM collector heartbeat verification, baseline latency/ping checks and similar details without source intelligence.

Required:

- project-specific preconditions and verification methods must be source-driven;
- generic governance gates may remain, e.g. contract approved, zero blocking issues, environment/test data/observability readiness established;
- where a category is NOT_SUPPLIED, do not invent a concrete tool, test-data mechanism, check or procedure;
- generated text must not imply the customer uses APM, synthetic accounts, SKU pools, payment virtualisation, ping checks, heartbeat collectors, etc. unless present in canonical intelligence.

## 5. Remove invented abort and acceptance thresholds

The Strategy/Test Plan currently contains unsourced thresholds such as:

- error rate > 5% abort;
- PASS evidence requiring error rate < 1%;
- CPU/memory > 95% for > 5 minutes;
- infrastructure saturation ceilings not defined in canonical acceptance criteria.

Required:

- no abort threshold or pass/fail metric may be manufactured;
- PASS = required workload attained + every **defined canonical acceptance criterion** passes;
- FAIL = required workload attained + one or more defined canonical acceptance criteria fail;
- PASS_WITH_OBSERVATION = required workload attained + defined blocking criteria pass + governed non-blocking observations exist;
- INCONCLUSIVE = required workload not attained, run invalid/aborted for non-SUT reasons, or required acceptance criteria are not evaluable;
- any numeric threshold must trace to canonical intelligence / Performance Contract.

## 6. Keep product methodology separate from project facts

Introduce a clear distinction wherever the artefact engine adds PECP's own engineering methodology.

Acceptable options include:

- a section/callout explicitly labelled `PECP Methodology Guidance`;
- a source/reference type identifying `PECP_METHOD` versus `CANONICAL_INTELLIGENCE`;
- a `PROPOSED` / `GUIDANCE` status if this can be added without unnecessary domain expansion.

The key rule is semantic: a reader must be able to tell whether a statement is:

1. governed project fact / approved parameter;
2. unresolved/missing project information; or
3. PECP methodology guidance.

Do not present category 3 as category 1.

## 7. Fingerprint accuracy

`computeContractFingerprint()` currently uses FNV-1a 32-bit.

For M2.1 either:

A. retain it as a deterministic drift fingerprint/checksum and explicitly label/document it as **non-cryptographic**, or

B. deliberately replace it with a true cryptographic hash suitable for both supported runtime contexts.

Do not use the words `cryptographic`, `cryptographically bound`, `security hash`, or equivalent for FNV-1a.

Staleness/drift tests must remain deterministic.

## 8. Correct generation timestamp semantics

A generated artefact's `Generated Date` must represent the artefact generation event.

Required:

- remove fixed-date fallbacks and avoid silently substituting source-contract creation time as artefact generation time;
- make `generationTimestamp` an explicit generation input, or provide an injected clock at the orchestration boundary;
- tests must supply fixed timestamps for reproducibility;
- portal generation may capture a real generation timestamp once per generated artefact instance, but generation logic itself must remain deterministic for the same supplied inputs.

## 9. Reference-library alignment

Update/extend the M2 reference expectations so they explicitly assert:

- no unsourced ramp duration;
- no unsourced steady-state duration;
- no unsourced soak duration;
- no unsourced stress percentages;
- no unsourced abort threshold;
- no unsourced PASS error-rate threshold;
- no invented environment/test-data/observability mechanisms;
- workload demand remains 31,500/hr = 525/min = 8.75/sec from approved canonical source;
- concurrency remains blocked;
- checkout percentile remains ambiguous;
- Strategy and Test Plan remain non-approvable for the RetailCo blocked scenario.

## 10. Tests

Add tests proving at minimum:

- empty/minimal canonical inputs do not produce concrete schedule durations, ramp percentages, VU counts or abort thresholds;
- RetailCo M2 artefacts do not contain `10 mins`, `60 mins`, `4 hours`, `120%`, `150%`, `5%` abort threshold, `95%` saturation threshold, or similar unless those values are explicitly added to source intelligence in the test;
- no default project assumption is inserted when none exists;
- PASS/FAIL/INCONCLUSIVE rules reference canonical criteria rather than hard-coded numeric thresholds;
- NOT_SUPPLIED environment/test-data/observability does not emit invented implementation details;
- deterministic artefact output remains identical for identical inputs plus supplied generation timestamp;
- fingerprint wording/metadata accurately reflects the chosen checksum/hash semantics.

## Non-goals

Do not begin M3.
Do not generate k6 scripts.
Do not add execution providers.
Do not add PDF/DOCX libraries.
Do not add backend/database/authentication.
Do not add real connectors or AI calls.
Do not redesign the overall portal.

## Definition of Done

M2 may be closed when:

1. GitHub CI is green on `master`;
2. Strategy/Test Plan contain no unsourced project-specific durations, workload percentages, VU counts, verification mechanisms or numeric abort/pass thresholds;
3. project facts, missing information and PECP methodology guidance are semantically distinguishable;
4. no default project assumption is fabricated;
5. pass/fail logic uses canonical acceptance criteria only;
6. fingerprint claims match the actual hashing implementation;
7. generated-date semantics are truthful and deterministic with an explicit timestamp/clock input;
8. reference manifest/tests prove these rules;
9. no M3 functionality has started.

## Completion report

Report:

- CI/lockfile repair;
- invented schedules/thresholds removed;
- how methodology guidance is distinguished from canonical project facts;
- assumption handling;
- pass/fail rule corrections;
- fingerprint decision;
- generation timestamp approach;
- reference-manifest changes;
- test count/results;
- GitHub Actions result;
- unresolved design questions.

Stop after M2.1.
