# AI Studio Instruction: Complete Approval Transaction and Revision Safety

## Active task

- Repository: `aquaviator/pecp`
- Task identifier: `BUILD-CONTRACT-ARTEFACT-APPROVALS`
- Instruction revision: `3`
- Task mode: `IMPLEMENT TARGETED PRODUCT FIXES`
- Preparation date: 5 October 2026

Continue the delivered approval workflow. Implement the remaining transaction, exact-revision binding, replay and UI retry safeguards below. This is product-code work, not a PM audit, report, acknowledgement, milestone closure or instruction to rebuild the feature. Preserve the implemented Contract, Strategy and Test Plan screens, persistence, decision history and withdrawal functionality.

Do not begin test-definition generation, k6 bundle delivery or test execution in this task. Those are the next product direction, not authority to skip these existing approval requirements.

## Manual transfer workflow

Andy manually pulls instructions from GitHub into AI Studio and manually pushes finished changes back. ChatGPT maintains this handover and checks the resulting remote implementation and CI.

Read the instruction already present in your workspace. Do not run terminal `git fetch`, `git pull` or `git push`; request credentials; change remotes; reset the workspace; delete customer data; or discard legitimate local changes. Local Git inspection is permitted. Label any local commit SHA LOCAL, never as proof of remote delivery. Preserve additional work Andy has not pushed. A pending manual push is a handoff state, not a product defect.

If the workspace is inaccessible, make one small access check and report the exact infrastructure blocker without repeating long failing operations or claiming execution. Otherwise implement immediately without another permission or acknowledgement round.

## Delivered checkpoint

Remote implementation inspected: `fd28ad77d9f9dfb6758932b88ec5866a43be4ca8`.

Commit message: `feat: implement contract revision and governance tracking`.

Its parent is the revision-2 instruction commit `efe888864cccbdea736150c2b8eafe1014d9ea86`. The earlier interrupted partial commit `5f9f28921fc73fc21edee8586387c0f375fa2f02` is not the current delivery baseline. Do not reset to any of these SHAs.

Remote CI run `37293561661`, job `111709414913`, completed successfully for `fd28ad77...`. Inspected logs show:

- Web: 34 test files, 499 passed.
- API: 23 test files, 132 passed.
- Reference Lab: 10 passed.
- Total: 641 passed.
- Deterministic install, TypeScript checks and production web build: passed.

These are observed regression results, not proof that every concurrency and validity requirement is implemented. This instruction-only update does not repair product code. Work from Andy's pulled state and retain later legitimate changes.

## Source observations motivating this continuation

These observations refer to the inspected commit, not a claim that a live exploit or failing race test was executed by ChatGPT. First capture the affected behaviour in focused regression tests, then fix the implementation in this run.

1. In `packages/platform-core/src/services/ArtefactService.ts`, `submitArtefactDecision` reads the target revision, live compilation, intelligence, parent approval and existing decisions before `unitOfWork.execute(executeDecision)`. The closure inserts the previously constructed decision and success audit. Rechecking a permission against the same principal object inside that closure does not refresh membership or the target's state.
2. In that method, expected target revision, content fingerprint and decision revision are checked only when supplied. The content check also accepts `revRecord.sourceContractFingerprint` in place of the document content hash. Two different documents bound to the same contract must not be treated as identical reviewed content. The approval integration test currently exercises successful document approval without a content/input binding.
3. Idempotency lookup is before the protected transaction, and its saved response is written after the decision transaction. Replays return cached detail JSON, including the old validity projection, without recomputing present validity. These patterns do not establish atomic concurrent retries or a truthful current approved badge after withdrawal.
4. `getArtefact` evaluates the selected target's validity using input staleness, but only adds an older-revision check when evaluating other history entries. `submitArtefactDecision` does not compare the target to the artefact's current revision before approving. Test the selected-old-revision detail and approval paths explicitly.
5. In `apps/web/src/pages/project/StrategyPage.tsx`, the shared error banner's Retry button invokes `handleGenerate()` even when the error came from an approval/withdrawal action. The decision callbacks guard completion by project ID, not by the full project/entity/revision/request target. The shown withdrawal payload sends the parent contract fingerprint as the expected document fingerprint. Correct the corresponding Test Plan/Contract paths where they share the pattern.

Relevant evidence paths:

- `packages/platform-core/src/services/ArtefactService.ts`
- `packages/platform-core/src/services/PerformanceContractService.ts`
- `apps/api/test/contract_artefact_approval_workflow.test.ts`
- `apps/web/src/pages/project/StrategyPage.tsx`

Read the actual API route validation and repository/Unit-of-Work implementations too. Do not treat a method comment or a test named "atomic" as evidence of a race having been exercised.

## 1. Make the protected operation atomic, not just the final INSERT

Reuse the existing serialized Unit of Work, repository interfaces, authentication and audit infrastructure. Require the production dependencies necessary for correctness. Do not fall back to a non-transactional protected write when a dependency is missing.

For contract review saving, contract decisions, document generation/revision allocation and document decisions, fix the same pattern wherever it is present on the shared approval path. Within one serialized operation, or an equivalent fully revision-checked atomic boundary:

- resolve the real project and organisation;
- validate the current authenticated actor/account, session and membership authority through the existing supported repositories/services;
- check the scoped idempotency record;
- read the exact saved target and current revision pointer;
- read consistent governing inputs, checklist, source bindings and parent decision state;
- validate required client expectations, readiness and current-use eligibility;
- allocate the next revision/decision number;
- write the revision or decision, its mandatory success audit and idempotency receipt together.

Do not hold one database connection in a transaction and accidentally perform the decision write on a different connection or bypass the existing mutex. Preserve reentrant Unit-of-Work behaviour for legitimate nested service calls; do not introduce a deadlock. Repository uniqueness constraints should reinforce the application checks.

Keep all genuine historical decisions and immutable content. Use additive schema changes only when necessary; do not rewrite an applied migration or recreate existing tables/data to make tests pass. Database access must use the existing supported provider interface.

## 2. Require the exact reviewed binding

For APPROVE and WITHDRAW, require a valid expected target revision, current decision revision (including explicit 0 for no decision), and exact target content/input binding. Expose these values in the real detail response so the client can submit what the user actually viewed. Use existing fields where appropriate, extending shared types only as necessary.

Reject missing, null, blank, malformed or wrong-type preconditions explicitly with 400; well-formed stale/mismatching expectations return 409 with refresh guidance and no successful mutation. Reject unknown decision actions. Do not silently populate missing expectations with server-current state.

A document's parent contract fingerprint is not a substitute for that document's content fingerprint. Bind the decision to the immutable document revision, complete generation-input binding and parent revision/decision dependency. Continue using existing canonical hash/lineage utilities; keep semantic/content/input identity separate from presentation status, decision identity and request-time timestamps. Do not create a hash that changes merely because the approval itself was added.

On contract saving and document generation, validate the expected input/revision binding consistently where the operation establishes a review target. Do not permit missing preconditions as a general legacy bypass. Older stored revisions remain readable; require an explicit new revision/regeneration when a safe binding cannot be established instead of retroactively inventing lineage.

An APPROVE action may only approve a current, unsuperseded target whose existing readiness and source-eligibility rules pass. Do not auto-approve, fabricate missing engineering inputs, weaken blocked-state rules or change the role matrix to obtain success. Historical decisions remain visible, but cannot authorise present use of a superseded revision. Preserve the ability to explicitly withdraw an existing historical approval where the established product policy permits it; withdrawal must not promote a historical target to current.

## 3. Make retries safe and current validity truthful

Scope idempotency to the real actor, organisation/project, operation, target revision and canonical request payload. Concurrent delivery of the same operation/key must commit one mutation, one decision/revision increment and one success audit. Changed payload/target/actor reuse must not replay another operation.

Check/reserve/store the receipt atomically with the protected mutation. An idempotency or success-audit persistence failure must roll back the operation rather than leave an approval that the caller believes failed. Do not suppress the exception or weaken rollback tests.

Reauthorise every replay using current authority. Return the original operation receipt without creating a new decision, but clearly separate it from recomputed present approval validity. An approval receipt replayed after source change, withdrawal or supersession must not return a fresh-looking CURRENTLY_VALID result. Immutable receipt/history and live validity are distinct parts of the response.

Use a consistent validity evaluation for list, selected detail, history, export and protected writes. Selecting an older revision must not make its approval currently valid when the same revision is shown as superseded in history. Export notices and badges must agree.

Preserve the delivered no-resurrection rule: parent withdrawal/reapproval, source replacement with the same number, re-binding intelligence or regenerating identical text cannot revive the child's old approval decision. New explicit decisions are required for the correct current chain. Relevant narrative/checklist inputs and source/candidate/decision lineage must remain in validity checks, not just final numeric workload equality.

## 4. Finish the UI integration for the stricter contract

Update the existing Contract, Strategy, Test Plan, document viewer, API adapters and explicit mock implementations together. Preserve full previews, saved revision selection, generation, downloads and provenance.

Use the exact content/input binding returned for the displayed revision. Send initial expected decision revision 0 explicitly. Do not substitute a parent hash or locally invented approval metadata.

Separate load, generation, approval, withdrawal and export error recovery. Retrying a failed approval must not generate a document or save another contract revision. A 409 must refresh the review information and require the user to inspect/reconfirm the intended target; do not automatically approve a newer revision.

Guard asynchronous results using project, entity/type, target revision and request identity, including A-to-B-to-A navigation. Clear abandoned rationale/confirmation state when the target changes. A late result may not approve, replace or unlock controls on another selected revision. Do not rely solely on matching the project ID.

Keep the established role policy: engineers may save/generate but not decide; reviewers may decide but not generate; viewers remain read-only; lead/admin privileges stay as defined in the central policy. Server enforcement remains authoritative, including CSRF on cookie mutations and revoked session/membership checks. No synthetic system actor or role fallback in production.

## 5. Executable regression cases

Extend the existing approval integration and DOM suites with focused cases that fail for the observed gaps. Preserve the 641-test behaviour baseline, adjusting existing requests to supply newly required truthful preconditions rather than removing assertions. Do not duplicate the generators or manufacture complete Test Plan inputs.

Prove, with real SQLite integration and controlled ordering rather than timing guesses:

1. Missing/malformed expected target, decision, content and input bindings are rejected for both contract and document mutations; the exact current bindings succeed. A parent fingerprint alone cannot approve a different document.
2. Two identical concurrent approval requests with one idempotency key yield one decision and one success audit. Two competing requests with different keys but the same expected decision revision produce one winner and a deterministic conflict, not two successful decisions or an uncaught uniqueness exception.
3. Source/input replacement, parent withdrawal, target supersession and membership revocation that commit while an approval waits for the write boundary are observed before it writes. Add barrier-controlled tests that force the ordering. When approval legitimately commits first, the later upstream mutation invalidates it; do not write a test asserting that both serial orderings must fail.
4. Failure of decision/revision storage, required success audit or idempotency persistence leaves no partial protected operation. A valid retry can then succeed once.
5. Replay after withdrawal/drift returns the original receipt plus invalid present validity, not a renewed approval. A revoked actor cannot replay it. Foreign project/actor/operation collisions remain rejected.
6. After revision 2 exists, directly fetching revision 1 cannot label it currently valid; newly approving revision 1 is rejected. List, detail, history and Markdown export remain consistent without modifying old bytes. Verify after database restart.
7. Parent withdrawal followed by reapproval does not resurrect a child decision. Re-binding the same numerical value to a new source requires the new explicit review chain.
8. DOM tests simulate an approval error followed by Retry and assert that generation/save is NOT called. Simulate 409 and revision/project changes, then resolve old requests out of order. The selected target, rationale, decision token and badge remain correct. Exercise actual page/service wiring, not only a standalone modal.

Use existing dependency-injection seams or narrowly scoped test barriers; do not add public production endpoints for test control. A passing general concurrency suite is not a substitute for driving these approval operations.

## Completion and scope

Implement the fixes and tests in this run. Do not stop after writing a plan, listing issues or acknowledging the handover. This continuation fulfils the existing approval task; it does not reopen M5.2 or authorise a new PM reporting cycle.

Run `npm ci`, `npm run lint`, `npm test` and `npm run build`. Verify the persisted API workflow and actual DOM interactions. Report actual outcomes, not the historical 641 count as though it were a new run. Keep remote CI separate from local verification.

Out of scope: test-definition/bundle features, load execution, new connectors, BYOAI, billing, deployment redesign, unrelated dependency upgrades, new approval roles or mandatory dual approval. Keep other previously specified governance, provenance, human-attribution and zero-invention requirements intact.

Leave the working changes ready for Andy's manual push. Return only a compact handoff: product behaviour corrected, API/client contract changes, focused tests and full local verification results, exact LOCAL SHA if one exists, and any genuine unfinished behaviour. Do not create PM reports, audit documents, completion reports or closure files.
