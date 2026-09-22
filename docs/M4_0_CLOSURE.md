# M4.0 Closure — Canonical Findings & Defect Candidate Model

## Status

**M4.0 — CLOSED ✅**

PECP now converts governed Acceptance Evaluations into deterministic, provenance-bound Findings and Defect Candidates without inventing root cause, severity, workflow metadata or performance defects from inconclusive evidence.

## Authoritative final implementation

Final M4.0 implementation SHA:

`ea6b0cc7cb5d92bf599bc26fbe760882e65b2728`

Final CI run:

`35706788473`

Result: **SUCCESS**

Verified:

- 20 Vitest files;
- 343 Vitest tests;
- 31 Findings/Defect Candidate tests;
- 10 Reference Lab service tests;
- 353 combined tests;
- TypeScript typecheck passed;
- production build passed.

## Closed capabilities

M4.0 now provides:

- canonical `CanonicalFinding` model;
- canonical `DefectCandidate` model;
- immutable `FindingsRegister`;
- deterministic SHA-256 finding/candidate/register identities;
- Acceptance Evaluation digest verification before Findings generation;
- complete Acceptance-to-Results provenance validation;
- optional current Contract/Test Definition drift validation;
- explicit Findings generation validity state;
- PASS => no invented findings;
- PASS_WITH_OBSERVATION => explicit non-blocking observation findings only;
- FAIL => evidence-backed performance findings under attained workload;
- INCONCLUSIVE => no SUT performance defect candidates;
- workload unresolved/not-attained/invalid findings;
- provenance/integrity/evaluability/corroboration findings;
- blocking governed-observation findings;
- explicit Defect Candidate eligibility rules;
- zero-invention candidate evidence;
- canonical target semantics;
- immutable outputs without caller-input side effects.

## Core governance law

A performance Defect Candidate is eligible only when the governed Acceptance Evaluation proves:

1. Acceptance verdict = FAIL;
2. workload prerequisite = ATTAINED;
3. provenance is valid;
4. execution/evidence integrity is valid;
5. a canonical criterion failed;
6. the observed and governed comparison evidence is complete;
7. the Findings generation chain remains cryptographically intact.

An INCONCLUSIVE run can never produce a performance defect merely because an individual criterion detail looks poor.

## Authoritative RetailCo outcome

The authoritative reference path remains:

- Checkout p95 = `0.3906885 ms` against `p95 < 2000 ms` => PASS detail;
- HTTP failure rate = `0` against `rate < 0.005` => PASS detail;
- steady-state workload attainment = UNRESOLVED;
- Acceptance overall = INCONCLUSIVE;
- Findings generation = VALID;
- exactly one `WORKLOAD_ATTAINMENT_UNRESOLVED` finding;
- zero performance Defect Candidates.

This is the intended PECP behavior.

## Boundary after closure

M4.0 creates governed findings and defect candidates.

It does not:

- create live Jira tickets;
- create Azure DevOps work items;
- infer root cause;
- assign priority/owner/sprint;
- create the final Performance Evidence Package;
- publish customer reports;
- perform an external release-certification workflow.

## Closure decision

**M4.0 is formally CLOSED.**

Programme position:

`M3.3 ✅ -> M4.0 ✅`

Next authorized stage:

**M4.1 — Canonical Performance Evidence Package & Audit Manifest**
