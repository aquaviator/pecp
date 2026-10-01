# AI Studio Instruction — PECP M5.2 Final Independent Re-Audit

## Authority

Repository: `aquaviator/pecp`

This file is the current execution instruction for AI Studio.

Do not rely on prior chat history as authority. Read the repository evidence and the exact commit delta identified below.

## Current Programme State

- M5.0: CLOSED
- M5.1: CLOSED
- M5.2: CORRECTIONS IMPLEMENTED, PENDING FINAL INDEPENDENT PM RE-AUDIT
- M5.3: NOT STARTED / NOT AUTHORIZED

M5.2 must not be self-closed by the implementation worker.

## Authoritative Commits

Original M5.2 governing baseline:

`932e489d79fbdc6baa3169a5ed5e5641323c16a8`

Initial M5.2 implementation:

`03964df8f439cb9f2b7d32fff7a0903c99e57c2e`

Prior PM audit baseline:

`702cf689eec47fbb751892a45b45fd214d20f9a0`

Implementation previously audited and held for corrections:

`0e12b7696de389b77b18baae9a0a06bcb922937e`

Current correction commit / current master:

`413b597d52f25365d9e8dc710bee067b537e8768`

Commit message:

`feat(intake): implement worker-based document parsing`

The final re-audit MUST focus on the exact correction delta:

`0e12b7696de389b77b18baae9a0a06bcb922937e..413b597d52f25365d9e8dc710bee067b537e8768`

Do not reopen previously resolved findings unless this correction delta regressed them.

## Remote CI Evidence

GitHub Actions run:

`36849383088`

Commit:

`413b597d52f25365d9e8dc710bee067b537e8768`

Status:

`completed / success`

The implementation worker reported the following full verification results:

- apps/web: 31 test files, 489 passed, 0 failed
- apps/api: 19 test files, 103 passed, 0 failed
- reference-lab/retailco: 1 test file, 10 passed, 0 failed
- total: 602 tests passed across 51 test files
- lint: clean
- production build: successful

Independently confirm the relevant remote CI evidence. Do not accept these numbers solely because this file records them.

## Governing Documents To Read

Read at minimum:

- `docs/work-packages/M5_2_REAL_INTELLIGENCE_INTAKE_SOURCE_PROVENANCE.md`
- `docs/M5_2_PM_REVIEW.md`
- `docs/M5_2_COMPLETION_REPORT.md`
- `docs/intelligence/M5_2_INTAKE_ARCHITECTURE.md`
- `docs/intelligence/M5_2_API.md`
- `docs/intelligence/M5_2_OPERATOR_GUIDE.md`

Also inspect all files changed in the correction delta.

## Context: Previous Final Audit Decision

The previous independent PM audit returned:

`HOLD — CORRECTIONS REQUIRED`

It identified two remaining blockers only:

1. The parser worker execution path was not genuinely bounded because worker module resolution failed and the implementation fell back to unbounded direct parsing on the main thread.
2. M5.2 lacked DOM-capable portal interaction evidence for upload retry/project identity preservation and project-switch source isolation.

All other prior M5.2 findings had been assessed as resolved.

## Re-Audit Task

Perform the independent final Project Manager re-audit of the M5.2 correction delta.

Do not implement, repair, redesign, refactor, merge, deploy, or begin M5.3.

Do not mark M5.2 closed before completing the audit.

### Gate 1 — Genuinely Bounded Parser Execution

Inspect at minimum:

- `apps/api/src/intake/parsers/DocumentParserRegistry.ts`
- `apps/api/src/intake/parsers/documentParserWorker.cjs`
- `apps/api/test/intake_parsers.test.ts`

Independently verify:

1. Parser work actually executes outside the Fastify/API main event loop.
2. The worker entrypoint resolves successfully in the real test/CI runtime.
3. A real timeout invokes `worker.terminate()`.
4. Deliberately CPU-bound or non-returning parser work is actually terminated.
5. Worker startup failure, worker runtime failure, or module-resolution failure returns deterministic `FAILED` output.
6. There is no silent fallback to unbounded main-thread `parser.parse(...)`.
7. Normal PDF, DOCX, CSV, JSON and text parsing semantics remain intact.
8. The test proving termination exercises a real worker execution boundary rather than only mocking `terminate()`.

A `Promise.race` or timer that merely returns control to the caller is not sufficient if the parser continues executing.

### Gate 2 — DOM-Capable Portal Interaction Evidence

Inspect at minimum:

- `apps/web/src/__tests__/IntakePortalInteractionM5_2.test.tsx`
- the real components and services driven by that test

Independently verify both required scenarios.

#### A. Upload Failure and Retry

Confirm the DOM test proves:

1. Project creation occurs once.
2. Initial source upload fails.
3. The failure is visibly represented in the UI.
4. Retry is available.
5. Retry does not create a duplicate project.
6. Retry succeeds against the existing project identity.
7. Successful completion fires the intended callback / completion path.
8. Loading/error state is cleared correctly.

#### B. Project Switching Isolation

Confirm the DOM test proves:

1. Project A sources load.
2. Switching to Project B removes Project A source state from the rendered UI.
3. Project B sources load independently.
4. Switching back restores Project A sources.
5. There is no cross-project / cross-tenant source-state leakage.

The test must mount and drive the actual React DOM path. Mock-service unit testing alone is insufficient.

### Gate 3 — Regression & Documentation Truthfulness

Verify:

- the exact correction commit passes remote CI;
- the full regression suite remains green;
- the Northstar workflow remains green;
- previously resolved M5.2 provenance, revision, conflict, structured-import, source-supersession, upload-security and summary-fidelity behaviour has not been regressed by this delta;
- `docs/M5_2_COMPLETION_REPORT.md` accurately reports the corrected state;
- `docs/intelligence/M5_2_INTAKE_ARCHITECTURE.md` no longer overstates worker execution guarantees;
- no M5.3 implementation or scope leakage has occurred.

## Required Re-Audit Output

Return:

### A. Exact Evidence Inspected

List the exact commit delta, changed files, governing documents, tests and CI run inspected.

### B. Correction 1 Decision

`RESOLVED`, `PARTIALLY RESOLVED`, or `OPEN`

Give exact technical evidence.

### C. Correction 2 Decision

`RESOLVED`, `PARTIALLY RESOLVED`, or `OPEN`

Give exact technical evidence.

### D. Regression Assessment

State whether the correction delta regressed any previously resolved M5.2 requirement.

### E. Documentation Fidelity

Identify any statement stronger than executable evidence.

### F. Exact CI Evidence

Record the exact commit, run ID, conclusion and observed test/build/typecheck results.

### G. Scope Guard

Confirm whether M5.3 remains untouched.

### H. Final M5.2 Decision

Use exactly one of:

- `APPROVED FOR FORMAL CLOSURE`
- `HOLD — CORRECTIONS REQUIRED`

If HOLD, define only the smallest remaining M5.2 correction set. Do not create M5.2.1.

If APPROVED, do not begin M5.3. State that the next action is a separate formal M5.2 closure commit/documentation action.

## Prohibition

Do not infer approval from green CI alone.

Do not trust the implementation worker's execution summary without repository evidence.

Do not perform implementation work during this audit.
