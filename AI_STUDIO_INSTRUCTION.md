# AI Studio Instruction: Finish the Remaining Approval Backend Paths

## Active task

- Repository: `aquaviator/pecp`
- Task identifier: `BUILD-CONTRACT-ARTEFACT-APPROVALS`
- Instruction revision: `4`
- Task mode: `IMPLEMENT REMAINING BACKEND FIXES AND REGRESSION TESTS`
- Prepared: 6 October 2026

Continue the existing approval implementation. This is NOT a new feature, a full re-audit, a reporting task or an acknowledgement request. Complete B1, B2 and B3 below, preserving the delivered UI and governance behaviour. Do not rebuild the approval screens, generators, source intake or repositories. Do not begin test definitions, k6 bundle delivery or execution.

The previous instruction's safety requirements remain in force. This revision pinpoints the remaining source-level gaps instead of asking you to repeat the whole build. Capture the failing cases in executable backend tests first, fix the paths, and finish with locally verified changes ready for Andy's manual push.

## Manual transfer workflow

ChatGPT writes the handover in GitHub. Andy manually pulls it into Studio. Studio implements and tests. Andy manually pushes the finished changes. ChatGPT then reads the actual remote commit and CI.

Do not run terminal `git fetch`, `git pull` or `git push`. Do not request credentials, alter remotes, reset/discard legitimate work, recreate the project or delete customer data. Local Git inspection is allowed. Label any local commit SHA LOCAL; do not infer the SHA of Andy's subsequent manual push. Uncommitted working changes are an acceptable handoff when clearly identified. Pending manual transfer is not a product defect.

Use the workspace Andy has pulled and preserve later local changes. If this file is absent, identify that prerequisite rather than inventing its contents. If the filesystem is unavailable, make one small check and report the exact access failure without repeated long attempts or claims of completed work.

## Verified delivery checkpoint

Remote implementation: `708b1b9549e2ef373b20ff9c95eaccd6a891a63f`.

Parent instruction commit: `88d1b32800637b043697034f3dff4c6f5399c94c`.

Remote CI run `37443588955`, job `112202941526`, completed successfully. The inspected logs show:

- Web: 34 files, 501 passed.
- API: 23 files, 132 passed.
- Reference Lab: 10 passed.
- Total: 643 passed.
- `npm ci`, TypeScript checks and production web build: successful.

These are verified baseline execution results, not evidence that the missing backend cases below passed. No additional race or failure-injection test was executed by ChatGPT. Findings below are grounded in the delivered source and diff.

Preserve the delivered document content fingerprints, explicit initial decision revision 0, decision idempotency improvements, historical-revision checks, separate UI error recovery, async target guards and modal cleanup. Do not reset to this or an older SHA.

## Source evidence and bounded correction set

### B1. Artefact generation still has an incomplete transaction boundary

In `packages/platform-core/src/services/ArtefactService.ts::generateArtefact`, at the checkpoint:

- project access and idempotency lookup occur before the Unit of Work;
- contract resolution, intelligence reads, `nextRevisionNumber` allocation and generation occur before `executeSave`;
- `executeSave` checks the same captured principal, writes the already-built records and success audit;
- the idempotency receipt is saved AFTER the Unit of Work returns;
- the replay payload hash omits actor, operation and `contractRevisionNumber`, and returns cached detail JSON;
- expected contract fingerprint is checked only when truthy.

The route in `apps/api/src/app.ts` directly invokes this service; it does not wrap the entire operation in another transaction. Therefore the existing INSERT transaction alone does not satisfy the prior generation/concurrent-retry requirement.

**Implement:** move current-authority resolution, scoped idempotency lookup, consistent governing-input reads, expected-binding checks, current revision lookup/allocation, generation, record writes, mandatory success audit and receipt write into one existing serialized Unit of Work, or an equivalent fully revision-checked atomic operation. For this bounded implementation prefer the existing reentrant serialized Unit of Work. Do not invent a separate lock or bypass its database connection.

Calculate the next revision only after entering the protected boundary. Include actor, organisation/project, operation, exact requested contract revision and all meaningful generation inputs/expectations in the idempotency identity/payload. Do not replay an earlier generation when the same key is submitted for a different governing contract revision. Reauthorize before any replay. Persist the receipt atomically with the generated revision and success audit. If any of those writes fails, roll back all of them.

Return an identifiable original operation receipt separately from fresh present-state validity, or use the existing response convention with equivalent unambiguous meaning. Do not return stale cached approval/readiness metadata as current. Preserve immutable content and historical lineage. A retry must not allocate an extra revision.

Keep pre-approval BLOCKED/draft document generation available where the existing product supports it, with truthful blockers. Do not promote unapproved assertions to authoritative facts or silently substitute a newer contract. Reuse existing generators and stored bindings.

### B2. Document authority is still checked before lock acquisition

In `ArtefactService.ts::submitArtefactDecision`, the real `membershipRepo.get(orgId, principal.userId)` lookup and role check occur BEFORE `executeDecision` is passed to `unitOfWork.execute`. The transaction closure starts with idempotency lookup and does not repeat that live authority check. A valid permission read before waiting is not proof of permission when the write begins.

`PerformanceContractService` has moved its save/decision work further inside its Unit of Work; preserve that improvement. Check the shared protected paths for current account/session validation too, rather than assuming refreshed membership alone establishes all current authority.

**Implement:** after acquiring the protected boundary, resolve the current project/organisation and real authenticated account, active session and current membership/permissions through the existing supported interfaces. Perform this before idempotent replay and before a new mutation. Cover contract review save, contract approve/withdraw, document generation and document approve/withdraw consistently. Do not trust a captured PLATFORM_ADMIN flag after account/session revocation; follow the actual existing platform-admin policy using fresh authority.

An inexpensive preflight check outside the transaction is permitted for early rejection, but it cannot replace inside-boundary validation. Inspect actual repository/service method signatures before use. Do not introduce a fabricated system actor, another nonexistent helper, unchecked casts, or a broad role bypass. Keep the established role matrix unchanged.

Required write dependencies must fail closed when unavailable. Remove the silent non-transactional protected-write fallback. Do not break a pure read-only compiler merely because a write dependency is absent; reject the protected mutation before it writes. Keep denial logging consistent with the existing architecture so a rolled-back write does not accidentally erase required denial evidence. Successful audit and business writes remain atomic.

### B3. The complete reviewed input binding is still optional or omitted

At the checkpoint:

- `submitContractDecision` and `submitArtefactDecision` only compare `expectedInputDigest` when it is truthy;
- `saveContractReviewRevision` defaults its input to `{}` and only checks `expectedFingerprint` if supplied;
- generation likewise permits an omitted expected contract binding; the route forwards `expectedInputRevision`, but the shown generation path does not enforce it;
- revision validation uses numeric/NaN/range checks without enforcing safe integers;
- the previous successful integration requests were amended with document content fingerprints, but still omit the full expected input binding.

**Implement:** enforce the required review preconditions end to end, using the actual shared types and existing fingerprint utilities. Extend types, adapters and UI payloads only as needed to carry server-issued expectations.

For APPROVE and WITHDRAW, require:

1. the exact expected target revision, a safe positive integer;
2. expected decision revision, a safe non-negative integer, explicitly 0 when none exists;
3. the exact immutable target content fingerprint, not the parent's fingerprint;
4. the exact expected governing-input binding returned for the inspected revision.

Bind document approval to the governing saved contract revision and decision identity the reviewer inspected. If the expected input token currently covers only generation inputs, expose and validate the parent decision identity separately or use a versioned combined review token that covers it. A withdrawal/reapproval of the parent between preview and submission must require refresh and explicit reconfirmation, not silently switch the child's approval dependency to the new parent decision. Do not create a hash cycle where the child's own approval changes its input identity.

For Save for Review and Generate/Regenerate, require the expected current compilation/input binding from the user's preview, and the applicable exact selected parent revision/expected current revision. Expose the complete binding in the read/preview response so the client can actually obtain it. Do not require a token the API never returns. First-time generation must have a supported read/preview route for its binding; extend an appropriate existing read model minimally if needed. GET must not create revisions.

Carry these fields through `apps/api/src/app.ts`, shared domain/platform types, existing API/mock services, ContractPage, StrategyPage and TestPlanPage. Never silently fill missing expectations with server-current values or copy a different field to bypass validation. Use canonical field names with explicit supported aliases, not arbitrary fallback values. Retain read access to historical records; require a new review/regeneration when old data cannot provide a safe binding, without backfilling invented provenance.

Malformed/missing/null/blank/wrong-type preconditions return 400. Well-formed stale or mismatched bindings return 409 with useful refresh guidance and no partial write. Enforce safe-integer validation on route and payload revision coordinates. Preserve exact source/candidate/approval/checklist/narrative lineage, typed values and units. Do not broaden compilation readiness or manufacture missing inputs to make the positive tests pass.

## Implementation method: test the specific gaps, not just the old green suite

Use actual SQLite repositories, the real Unit of Work and the existing authenticated API composition. Add focused cases to `apps/api/test/contract_artefact_approval_workflow.test.ts`, `artefact_workflow_api.test.ts` or a clearly named neighbouring backend test. The delivered diff added two DOM cases and amended existing API requests; it did not establish the barrier-controlled backend cases requested in instruction revision 3.

Before fixing B1/B2/B3, add and run the corresponding tests against the current implementation and observe the expected failures where present. Keep the tests after the repair. Do not turn tests into mocked successful service responses. Updating old success payloads is necessary but is not the new regression coverage.

Required executable cases:

| Case | Exercise and required result |
| --- | --- |
| Generation receipt rollback | Inject failure in the real generation receipt persistence seam. Revision, current pointer and successful audit must all remain unchanged. Remove the fault and retry once; exactly one new revision is saved. |
| Concurrent generation retry | Release two same-actor, same-payload, same-key generation requests together through the actual serialized service. Both refer to the same result, with one revision increment, one success audit and one receipt. |
| Generation identity collision | Same key with a different actor, target project, operation or selected contract revision must not replay the earlier generation. No extra write on rejection. |
| Revocation while queued | Pause the protected operation immediately before its real transaction starts, AFTER any preflight permission check. Commit membership revocation/demotion using the normal authority path, then release the queued document decision/generation. It must be denied without a successful decision, revision or audit. Repeat for account/session invalidation through supported seams. |
| Competing decisions | Two different keys with the same expected decision revision produce one success and one 409, not two decisions or an uncaught uniqueness error. Same-key concurrent approval commits one decision and success audit. |
| Upstream change while queued | Commit source/input change, target supersession or parent withdrawal while the protected operation is queued. Its stale preview must be rejected before writing. If approval legitimately wins first, the later source change must invalidate it; both legal serial orderings need not both fail. |
| Required preconditions | Omit each required input/content/revision token individually; try null, blank, wrong type and fractional revision. Assert 400 and no write. Submit well-formed mismatches and assert 409. Exact current bindings then succeed. Cover saves, generation, contract decisions and document decisions. |
| Parent decision change after preview | Read a document approval target/token, withdraw then reapprove its parent, submit the old child token. Reject; require newly inspected parent dependency and explicit child approval. |
| Replay after drift or withdrawal | Preserve the original receipt, return truthful current invalidity and no new approval. A now-revoked actor cannot replay. Historical list/detail/export stay consistent. |
| Mandatory dependency/write failure | Missing protected-write dependencies, or injected mandatory audit/receipt failure, cannot leave a partial revision or decision. Restart does not revive partial data. |

Use narrow dependency-injection barriers or existing test seams, not sleep-based timing guesses and not new public test-control endpoints. A barrier must be placed so the inside-lock check can actually observe the committed revocation; pausing while already holding the same lock would deadlock the test. Do not mock the Unit of Work into immediate success.

Keep the already-added DOM retry/isolation tests green. Add only the client contract coverage needed for B3: initial 0 decision revision, exact content/input/parent tokens, and 409 refresh requiring reconfirmation without generating a document or approving a newer target automatically.

Do not suppress errors, remove assertions, skip required tests or claim that the existing six sequential approval tests prove these races. Test names and actual assertions/results must correspond.

## Scope, dependency advisory note and finish

This is a bounded completion of the existing approvals task. No new milestone, PM report, audit document, closure file, design system, approval role, dual-approval requirement, test engine feature, connector, BYOAI, billing or deployment change is authorised. Preserve all earlier source/approval history, no-resurrection rules and working portal functionality. Apply additive migrations only if truly necessary; do not rewrite deployed migrations or erase data.

The latest CI installation log also reported four dependency advisories: one moderate, one high and two critical. The log alone does not identify affected paths or establish exploitability. Do not describe the dependency set as warning-free or production-certified. Keep this flagged for dependency triage; do not perform blind or forced bulk upgrades in this approval fix. A brief unresolved advisory note is sufficient for this handoff, not another report.

Run `npm ci`, `npm run lint`, `npm test` and `npm run build` after the targeted tests pass. Execute the real persisted API flow, not only a homepage HTTP 200 or applet compilation. Remeasure suite totals. Keep local results distinct from remote CI for the baseline.

Leave all changes preserved for Andy's manual push. Return only: B1/B2/B3 implementation outcomes, exact new backend test names with observed local results, relevant API/client binding changes, full local test/typecheck/build outcomes, any LOCAL SHA if one exists, and genuine remaining blockers. Do not claim all requirements satisfied when any named case was not implemented or run. Do not stop at a protocol acknowledgement, a list of intended changes or after UI-only edits.
