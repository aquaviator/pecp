# M3.3 Closure - Deterministic Acceptance Engine

## Status

**M3.3 - CLOSED ✅**

PECP now has a deterministic, provenance-bound Acceptance Engine that converts governed canonical execution results into controlled performance verdicts without relying on provider threshold booleans as the source of truth.

## Authoritative final implementation

Final M3.3 implementation SHA:

`7b0eb4c27b5c3a3d2a33046c640433d3dc0be97d`

Final normal CI:

`35703833593`

Result: **SUCCESS**

Verified:

- 19 Vitest files;
- 312 Vitest tests;
- 72 Acceptance Engine tests;
- 10 Reference Lab service tests;
- 322 combined tests;
- TypeScript typecheck passed;
- production build passed.

## Closed capabilities

M3.3 now provides:

- canonical Acceptance domain model;
- PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE verdicts;
- mandatory provenance and drift gates;
- Test Definition self-integrity verification;
- Contract to Test Definition criterion semantic parity;
- execution/evidence integrity gate;
- workload-attainment prerequisite enforcement;
- explicit tolerance handling with no default tolerance;
- Results-side workload target/unit/population authority checks;
- governed workload source registry;
- independent canonical criterion evaluation;
- deterministic operator and unit normalization;
- exact metric + threshold-expression corroboration;
- same-metric threshold-expression drift detection;
- blocking governed-observation handling;
- deterministic evaluation metadata;
- caller-input purity;
- immutable Acceptance Evaluation output;
- dedicated SHA-256 Acceptance Evaluation decision digest;
- independent SHA-256 known-answer verification;
- stable deterministic evaluation id;
- full authoritative source-to-verdict lineage.

## Acceptance governance law

The closed engine enforces:

- PASS = governed workload attained + all defined canonical criteria pass + no governed non-blocking observations;
- FAIL = governed workload attained + one or more defined canonical criteria fail;
- PASS_WITH_OBSERVATION = governed workload attained + all defined canonical criteria pass + explicit governed non-blocking observation(s);
- INCONCLUSIVE = workload not attained/unresolved/invalid, execution or evidence invalid, provenance inconsistent, criterion not evaluable, corroboration conflict, or blocking governed observation.

Critical invariant:

**A performance criterion failure cannot produce overall FAIL unless required workload attainment has first been proven.**

## Authoritative RetailCo outcome

The authoritative reference run demonstrates the rule correctly:

- Checkout p95 = `0.3906885 ms` against `p95 < 2000 ms` -> criterion PASS;
- HTTP failure rate = `0` against `rate < 0.005` -> criterion PASS;
- acceptance-basis workload = UNRESOLVED because steady-state time-sliced attainment evidence was not captured;
- overall verdict = **INCONCLUSIVE**.

PECP therefore refuses to issue a false PASS merely because provider thresholds are green.

## Cryptographic decision binding

Each Acceptance Evaluation includes a deterministic:

- algorithm: `SHA-256`;
- schemaVersion: `acceptance-evaluation-v1`;
- 64-character lowercase digest.

The digest binds the normalized decision semantics, gates, workload result, criterion evaluations, corroboration, governed observations and final verdict reasons.

Historical Contract/Test Definition FNV-1a drift fingerprints remain unchanged for compatibility with authoritative execution evidence.

## Boundary after closure

M3.3 ends at governed acceptance decision.

It does not:

- create Findings;
- claim root cause;
- create Jira or Azure DevOps defects;
- generate the final Performance Evidence Package;
- publish/export customer artifacts;
- perform release certification beyond the governed acceptance verdict.

Those are downstream stages.

## Closure decision

**M3.3 is formally CLOSED.**

Programme position:

`M3.0 ✅ -> M3.1A ✅ -> M3.1B ✅ -> M3.2 ✅ -> M3.3 ✅`

Next authorized stage:

**M4.0 - Canonical Findings & Defect Candidate Model**
