# AI Studio Instruction: Resume Contract and Artefact Approval Workflow

## Active task

- Repository: `aquaviator/pecp`
- Target branch after Andy's manual transfer: `master`
- Task identifier: `BUILD-CONTRACT-ARTEFACT-APPROVALS`
- Instruction revision: `2`
- Task mode: `RESUME AND COMPLETE PRODUCT CODE`

Build persisted, version-specific human approval for the Performance Contract, Performance Strategy and Performance Test Plan in the existing product UI and governed API.

This is a CONTINUATION of the interrupted approvals implementation, not a new feature or an instruction to rebuild completed work. Do not respond only with "Understood". Once workspace access is available, inspect the retained implementation, finish this slice, test it, and leave the working changes ready for Andy's manual push.

Product approval controls are functionality for PECP customers. This task is NOT a development PM audit, milestone review, reporting exercise or request to reopen M5.2.

## Resume checkpoint: interrupted workspace and failing partial implementation

### What is actually on GitHub

The remote partial implementation inspected on 5 October 2026 is:

`5f9f28921fc73fc21edee8586387c0f375fa2f02`

Commit message: `feat: add governance decisions and contract reviews`.

Its parent is the original approvals instruction commit `084f2bb1a3b52481e98af829476ea7ca1511651b`. This partial implementation is retained on GitHub; do not reset to the earlier Strategy/Test Plan or M5.2 state. This instruction-only change does not repair product code or certify the partial implementation.

The worker reported migration 6, contract-review and governance-decision repositories, domain/permission extensions, artefact-to-contract revision storage, and contract review/decision service methods. Treat these as existing work to inspect and reuse, NOT as independently verified finished functionality. Preserve any additional legitimate local changes not included in the remote checkpoint.

### Workspace recovery boundary

The worker reported a Studio applet filesystem failure containing `java.lang.IllegalStateException: Timed out waiting for applet file system condition to be met` with a 180,000 ms timeout. That report does not establish that the outage is still present, what caused it, or that a refresh will fix it.

After Andy has restored access and safely transferred this instruction, perform one small workspace file read and one minimal terminal check. If access works, continue implementation immediately without asking for another development approval. If access still fails with the same infrastructure error, stop repeating long failing operations; return the exact remaining access blocker without claiming that files changed or tests ran.

Do not recreate the project, reset the workspace, clear customer data or discard unpushed changes to work around the outage. Do not attempt terminal Git synchronization. Andy handles any refresh/reopen and manual transfer; do not claim to have repaired Google's applet environment. Before a manual pull that would replace local files, any additional local work must be preserved or reconciled, not overwritten. If this instruction cannot yet be read in the workspace, preserve the existing work and identify the missing transfer rather than inventing the task contents.

### Concrete remote CI failures to fix first

GitHub Actions run `37286869706`, job `111687728411`, ran against `5f9f28921fc73fc21edee8586387c0f375fa2f02`:

- Deterministic dependency install: SUCCESS.
- TypeScript typecheck: FAILURE, exit code 2.
- Unit tests: SKIPPED.
- Production build: SKIPPED.

The inspected job logs contain these failures. Locations refer to the partial implementation and may move during the repair:

1. `apps/api/src/persistence/sqlite/SqliteContractRevisionRepository.ts`, lines 51, 88, 99 and 112: TS2339, `getRawDb` does not exist on `SqliteDatabase`.
2. `apps/api/src/persistence/sqlite/SqliteGovernanceDecisionRepository.ts`, lines 54, 93, 116 and 135: the same TS2339 error.
3. `packages/platform-core/src/services/PerformanceContractService.ts`, lines 306, 343 and 633: TS2322, `string | undefined` assigned to required `string`.
4. The same service, lines 324 and 651: TS2322, a synthesized principal with `platformRole: 'USER'` and potentially absent organisation ID is not an `AuthenticatedPrincipal`.

Inspect `SqliteDatabase` and an existing working SQLite repository, then use the supported database access/transaction pattern. Do not mask missing methods with `any`, bypass Unit of Work isolation, weaken TypeScript checks or expose an unrestricted raw database API just to silence these errors.

Validate real project organisation ownership before constructing persisted records. Reject invalid/missing required ownership explicitly; do not invent an organisation ID, empty-string tenant, or a type assertion in place of validation.

The inspected contract-save path contains a fallback `principal || { userId: 'system-actor', ... role: 'PERFORMANCE_LEAD' }`; CI also reports a synthetic reviewer path. Remove synthetic authority from production review-save, approve and withdraw mutations. Require a real authenticated principal and recheck current permission in the protected transaction. Do not merely replace `'USER'` with another enum value to make the invented actor compile. Test fixtures may supply explicit test principals through the supported test boundary; they must not create a production authentication bypass.

Fix these integration failures, then continue the remaining product implementation in this same task. Do not stop after restoring typecheck or create a separate audit cycle. The historical 632-test baseline is NOT a successful test result for this partial commit.

### Remaining implementation to complete

Inspect local state first because some work may have survived beyond the reported checkpoint. Complete only missing or incorrect paths:

1. Finish `ArtefactService.submitArtefactDecision` (or the equivalent production method), exact saved-contract revision binding, parent decision lineage, withdrawal and current-validity projection.
2. Wire the new repositories, membership/identity checks, audit service and Unit of Work into the actual application composition. Verify migrations on both a new database and an existing database upgraded without data loss. Do not duplicate migration 6 or rewrite an already-applied migration to repair it; use an additive migration when a schema correction is necessary.
3. Implement authenticated contract review save/list/read/decision routes and revision-scoped artefact decision routes specified below. Keep CSRF, required preconditions, current authority and safe idempotency behaviour.
4. Wire API service adapters and the actual Contract, Strategy, Test Plan and document-viewer controls: Save for Review, exact-revision selection, rationale/confirmation, approve, withdraw, history and validity banners.
5. Preserve generation/regeneration, revision history, complete document previews and Markdown downloads. Finish invalidation and historical/current-status behaviour across all reads and exports.
6. Execute the acceptance scenarios below, including real persisted API and DOM tests; run the full install/typecheck/test/build sequence and leave the completed workspace ready for Andy's manual push.

The full original acceptance scope follows. The resume checkpoint changes the starting state and order of work, not the required behaviour.

## Manual transfer workflow

Andy performs BOTH transfers manually through AI Studio:

1. ChatGPT puts the full build handover in GitHub and supplies a short paragraph pointing to it.
2. Andy manually pulls the changes into AI Studio.
3. AI Studio reads this file from its workspace, implements the active task and runs local verification.
4. Andy manually pushes the implementation back to GitHub.
5. ChatGPT inspects the delivered remote code and CI before issuing another task.

Do not run terminal `git fetch`, `git pull` or `git push`. Do not request GitHub credentials, change remotes, force-push, reset the workspace, delete data or discard legitimate local changes. Local Git inspection is permitted. Any local commit SHA must be labelled LOCAL; it is not proof of the remote SHA created by Andy's later push.

A pending manual push is a handoff state, not a product defect. Remote CI for new work is unverified until that push and subsequent inspection. Preserve the workspace and finish with "Ready for Andy's manual push" only when this slice is implemented and local verification succeeds. If interrupted again, distinguish completed, incomplete and unverified work rather than claiming completion.

## Starting point and delivered work to preserve

Current partial implementation to preserve and complete:

- `5f9f28921fc73fc21edee8586387c0f375fa2f02`: interrupted approvals implementation, with the failing CI described above.

Earlier delivered work and instructions:

- `084f2bb1a3b52481e98af829476ea7ca1511651b`: original approvals build instruction, not a product implementation.
- `67b17ecaef61e44e65a7cad636947a101055fa64`: manual-transfer instruction update, not a product implementation.
- `0a3c61d71605da80bf1d99ec78a8edbe5c3dd5f1`: delivered Strategy/Test Plan workflow, including artefact persistence, API routes, portal generation, history, Markdown export and freshness projection.
- `4a82fc7a431bc3757b360528b4168d5f04218171`: delivered persisted intelligence-to-contract compilation slice.

Remote CI run `37204286038`, job `111442128394`, completed successfully for `0a3c61d...`, with dependency installation, TypeScript checks, tests and production web build passing. Its implementation handoff reported a local baseline of 496 web + 126 API + 10 Reference Lab = 632 tests; remeasure actual totals locally rather than copying them as new execution evidence.

Do not reset to these SHAs. Work from the state Andy has pulled, preserving later work. Do not rebuild the delivered generators, source intake or document pages from scratch. Inspect the actual local implementation and extend its missing approval paths.

## User-visible outcome

An engineer saves a reviewable revision of the live Performance Contract. An authorised reviewer opens that exact revision, sees its values, provenance and blocking reasons, records a rationale and explicitly approves it. The user then generates or opens a Strategy and Test Plan bound to that contract revision and approves each exact document revision separately.

The screens retain who approved what and when across refresh and API restart. A material source/input change, contract supersession or approval withdrawal removes current approval validity for affected downstream documents without rewriting historical content. The UI explains what needs review, re-binding or regeneration.

This slice stops at reliable product approvals. Do NOT implement new test generation, k6 bundle delivery, runner execution or release certification here. Approval of a contract or document must never be displayed as proof that an executable test is ready or that a performance test passed.

## Existing architecture to inspect and reuse

Read only the code needed for this implementation, including:

- `docs/PRODUCT_CONSTITUTION.md`
- `packages/pe-domain/src/index.ts` and `packages/pe-domain/src/intake.ts`
- `packages/workload-engine/src/contractCompiler.ts`
- `packages/platform-core/src/services/PerformanceContractService.ts`
- `packages/platform-core/src/services/ArtefactService.ts`
- `packages/platform-core/src/services/AuthorizationPolicy.ts`, `AuditService.ts` and the applicable intake approval/revision patterns
- `packages/platform-core/src/types.ts`, existing repository interfaces, idempotency and Unit-of-Work contracts
- `apps/api/src/persistence/sqlite/SqliteDatabase.ts`, `SqliteArtefactRepository.ts`, `SqliteContractRevisionRepository.ts` and `SqliteGovernanceDecisionRepository.ts`
- `apps/api/src/app.ts` and existing authentication/CSRF handling
- `packages/artefact-engine/src/staleness.ts`, the generators and Markdown exporter
- `apps/web/src/pages/project/ContractPage.tsx`, `StrategyPage.tsx`, `TestPlanPage.tsx`
- `apps/web/src/components/artefacts/ArtefactDocumentViewer.tsx`, ServiceContext, relevant interfaces and API adapters
- Northstar intake, performance-contract, artefact-workflow, RBAC and DOM interaction tests.

Reuse existing canonical models, generators and fingerprints. Do not build a parallel contract schema, approval engine in React, new design system or client-only source of authority.

## 1. Persist immutable contract review revisions

The current live compilation is a read model. Add the smallest persistent review-revision capability in platform-core and the existing SQLite provider, reusing any equivalent repository already present. Use additive migrations; do not drop or recreate customer tables.

Provide an explicit user mutation such as "Save for Review" that records the current server-compiled contract as an immutable numbered revision. GET compilation/read/history routes must not create revisions as a side effect. Do not persist every page refresh as a new version.

A review revision must include project/organisation ownership, revision identity, frozen canonical content, full relevant input/provenance binding, creation metadata and the compiler/binding version where applicable. Source values come from server repositories, not a submitted contract JSON or client approval flag. Saving a blocked draft for inspection may be supported, but approval must remain impossible while its required prerequisites are unresolved.

Expose the exact reviewed revision, content fingerprint and input binding to the UI. Keep the live working compilation distinct from the saved revision so a reviewer cannot unknowingly approve content different from what is displayed. Newly saved changed content is not automatically approved. Superseded revisions remain accessible as historical records but cannot be newly approved for current use.

## 2. Store approval decisions separately from immutable content

Implement explicit approve and withdraw-approval actions for:

- a saved Performance Contract revision;
- a saved Performance Strategy revision;
- a saved Performance Test Plan revision.

Decisions must record the authenticated actor ID and display name, server decision time, a required non-blank rationale, target project/entity/revision, exact content/input binding and a monotonic decision revision or equivalent optimistic concurrency token. Keep an append-only decision history; withdrawal creates another decision and never deletes the original approval.

The API must not trust submitted approver identity, approval time, readiness, permissions, document contents or status. Use existing audit infrastructure for successful/denied/failed mutations as appropriate. Approval write, active-decision update and success-audit event must be atomic. Failures must not leave a phantom approval.

Preserve the distinctions between canonical state, review status, readiness, the historical decision and present approval validity. `READY_FOR_APPROVAL` is not `APPROVED`. Existing ContractStatus does not include STALE; use compatible freshness/validity metadata and existing states rather than casually adding an incompatible status. A historical approved snapshot can remain historically approved while its current-use validity is stale, superseded or withdrawn.

Never update saved document bodies or old contract payloads just to make a current approval label look correct. Detail/history/export responses should distinguish the immutable generated content from current approval/freshness metadata. An export must not present a historically approved but now invalid revision as currently approved.

## 3. Bind each decision to the exact evidence reviewed

Use the canonical fingerprinting/lineage path, extending it minimally with a clearly versioned review/input binding where needed. Approval validity must cover the actual reviewed content and its governing inputs, including typed values, units, relevant checklist definitions, intelligence revisions, selected candidates, active intelligence decisions, and source IDs/version IDs/digests/locators/excerpts where present. Include supplementary architecture/environment/test-data/observability inputs actually used by document generation.

Do not invent provenance or timestamps. Store actual save/decision times separately from semantic hashes. Attach relevant provenance BEFORE calculating a content binding intended to cover it. Do not create a hash cycle in which approval changes its own input digest and instantly invalidates itself. Status/version presentation and approval overlays must not be mistaken for changed engineering inputs; retain separate input/content and decision bindings as necessary. Preserve existing stored fingerprints rather than silently relabelling historical records with a new algorithm.

On approval, re-read current project authority, the exact persisted target, governing inputs, active decisions and readiness within the same serialized Unit of Work as the protected write. Require both the expected target/decision revision and the expected input/content binding observed by the client. Missing/malformed preconditions are rejected; stale or conflicting expectations return 409 with refresh guidance and no partial write.

A contract can only be approved when its saved content still corresponds to current eligible governed intelligence and the existing approval readiness rules permit it. A document can only be approved when its exact saved revision is current, passes its own readiness rules, and is bound to an exact currently valid approved contract revision. Matching only a project ID, title, numeric workload or the latest contract flag is insufficient.

Keep pre-approval draft generation available as the existing product supports it. For an approvable document, generation must save the exact governing contract revision and complete input binding. Older documents without the necessary immutable binding remain readable; require regeneration rather than retroactively claiming they were generated from a saved approved revision. If a document was generated from an explicitly saved review revision before that same revision was approved, its original binding must remain intact and be validated, not replaced with a newer contract.

Some integration paths in the starting code compute contract/input state before entering the save transaction. Move or revision-check all relevant reads, permission checks and writes needed by this slice within the actual atomic boundary. Merely adding a transaction around the final INSERT is not sufficient. Make these targeted product fixes as part of the build, not another audit/report cycle.

Do not pass ineligible narrative intelligence into generators as accepted facts. Fix that integration where necessary for approval: excluded assertions must remain visibly unresolved/blocked according to existing rules. An unsafe previously generated document must not be approved solely because its stored status says READY_FOR_APPROVAL; validate its generation binding and require regeneration if needed.

## 4. Implement durable invalidation without automatic reapproval

Re-evaluate current validity on live contract, document list/detail/history/export and each protected approval action. Correctness must not depend on a browser page being open.

Material changes to governing intelligence, selected candidates, source versions, relevant checklist requirements or document inputs invalidate affected current approvals. A new source version with the SAME number still represents different evidence and must not inherit the old decision. Preserve the original evidence and decision history.

Withdrawing a contract approval removes the validity of dependent document approvals for current use. Saving a genuinely changed superseding contract revision or generating a replacement document revision must not copy approvals to the new revision. Regenerating identical document text also does not approve a new revision automatically.

Rebinding/reapproving intelligence does not revive an old contract or document approval. Restoring an identical numeric value or undoing an edit must not silently resurrect a previous decision. Use durable revision/decision lineage or recorded invalidation, not equality of the final number alone. New explicit decisions are required against the correct current revisions. Track document dependency on the governing contract decision/binding so withdrawing and later reapproving the parent does not automatically reactivate the child's earlier approval.

Expose a clear status/reason and remediation in the UI. Preserve old bytes, exact source bindings and historical decisions; do not erase history or silently regenerate on reads.

## 5. Use explicit permissions, authenticated APIs and safe retries

Extend the existing central Permission/AuthorizationPolicy contracts minimally for contract review writes and contract/document approval; keep frontend capability display aligned with the same policy. Do not use a broad "not VIEWER" shortcut for approval.

Role policy for this slice:

- PLATFORM_ADMIN follows the existing platform-admin policy.
- ORG_ADMIN and PERFORMANCE_LEAD may save contract review revisions and make contract/document approval or withdrawal decisions in their organisation.
- PERFORMANCE_ENGINEER may save review revisions and generate documents but may NOT approve or withdraw approvals.
- REVIEWER may read and approve/withdraw within their organisation, but gains no document-generation or general project-edit permission. This follows the existing distinction between review decisions and generation rights.
- VIEWER is read-only and may NOT save or approve/withdraw.

Do not introduce mandatory dual-approval or unrelated role redesign. Refresh current account/membership/session authority at protected writes and idempotent replay boundaries; stale principal membership data must not authorise a revoked reviewer. Deny unauthenticated and foreign-project access. Cookie mutations retain CSRF protection. Unrelated existing permissions must not be widened or removed.

Use current API conventions. Reuse equivalent routes if present; otherwise a suitable family is:

- `POST /api/v1/projects/:projectId/performance-contract/revisions`
- `GET /api/v1/projects/:projectId/performance-contract/revisions`
- `GET /api/v1/projects/:projectId/performance-contract/revisions/:revisionNumber`
- `POST /api/v1/projects/:projectId/performance-contract/revisions/:revisionNumber/decisions`
- `POST /api/v1/projects/:projectId/artefacts/:artefactId/revisions/:revisionNumber/decisions`
- revision-scoped decision-history reads, or history included in the existing detail responses.

These route shapes guide the implementation; do not duplicate working equivalents. Approval and withdrawal are explicit decision actions, not client-controlled status PATCHes. Generation/list/read/export APIs already delivered must remain working and reflect current approval validity.

Scope idempotency records to actor, organisation/project, operation, target revision and canonical payload. Same-key same-operation retries must not duplicate approval/audit events or revisions. A changed payload/target/actor must not replay someone else's operation. Reauthorise every replay. Reserve/check/write the idempotency result atomically with the protected mutation so concurrent identical requests cannot double-approve. If an original decision is replayed after invalidation, make clear that it is a historical receipt; never advertise renewed current validity.

## 6. Wire the actual Contract, Strategy and Test Plan screens

Use the existing components and services in API mode against durable data. Add focused controls for Save for Review, review-revision selection, Approve Revision and Withdraw Approval with a rationale field and explicit confirmation identifying the target revision. A confirmation is a customer-product action, not a request to Andy for development permission.

Display the exact revision being inspected, current versus historical state, readiness/blocking reasons, active approval validity, approver/time/rationale and decision history. An approved badge may appear only after server confirmation. Disable unavailable actions with useful reasons, including missing approved parent contract and stale/historical target state; server enforcement remains authoritative.

Support loading, errors, retry and 409 refresh. Do not silently retry an approval against a newer revision after conflict: refresh and require the user to inspect and explicitly confirm the new target. A delayed response after project/revision switching must not apply to a different document or preserve an approval button/rationale for an abandoned target.

Keep full document previews, history, generation/regeneration and Markdown downloads functional. Preserve explicit reference/mock mode, but never fall back to fixtures on an API failure. Do not use a homepage HTTP 200 or a success toast as evidence of the whole workflow.

## 7. Executable acceptance scenarios

Add focused service/API/persistence and DOM interaction tests, preserving the existing suite. Prove at least:

1. A real persisted Northstar project obtains eligible approved intelligence through the governed intake path, saves a contract review revision and approves that exact revision as an authorised reviewer. All needed fixture inputs are explicit test data, not production defaults.
2. Both document types bind to the approved contract revision, preserve full content/provenance, accept separate explicit approval decisions and show consistent status/history/export metadata.
3. Missing, conflicting, stale, invalid-provenance or required unapproved inputs cannot be bypassed with forged status/identity/content fields. An approved 24,000 orders/hr alone is not an invented complete Test Plan.
4. Missing expected bindings fail; changed source/input/target/decision revisions return 409 without a partial decision, including source replacement racing approval and approval racing supersession.
5. Same-number/new-source-version changes and relevant narrative/checklist changes invalidate affected approvals. Unrelated project changes do not invalidate another project's approvals.
6. Rebinding intelligence, generating a new document revision and explicitly reapproving produce the correct new chain; prior content/decisions remain unchanged. Withdrawal and later parent reapproval do not resurrect child decisions.
7. Refresh and full API/database restart preserve revision history, decisions, input hashes and current validity. Different request clocks do not change semantic input identity.
8. Role-matrix, CSRF, cross-tenant/project and revoked-membership cases are enforced for approve, withdraw, history and replay. REVIEWER can decide but cannot generate; PERFORMANCE_ENGINEER can generate/save but cannot approve. Production mutation service calls without an authenticated principal fail rather than constructing a synthetic actor.
9. Same-key retries and concurrent duplicate submissions cause one mutation and one successful audit event; changed-key-payload collisions fail. Simulated audit/persistence failure rolls back the protected mutation.
10. DOM tests drive saving/opening a revision, rationale/confirmation, success/error/409, withdrawal, stale banners, revision switching and out-of-order project responses. Cover API-mode service wiring as well as real persisted API integration.

Use genuine fixtures and real SQLite transactions for integration tests, not hard-coded successful response objects as a substitute. Do not weaken assertions, skip failing tests or bypass readiness to complete the task.

## Build boundaries and completion

Implement this coherent approval slice now. Do not stop at an implementation plan or protocol acknowledgement. Keep M5.2 intake and the completed artefact workflow intact, making only the necessary approval/integrity integration fixes. Do not create PM reports, new milestone IDs, audit/closure documents or speculative roadmap files.

Out of scope: k6 execution, new Test Definition/bundle delivery, CI runner connectors, external publishing, BYOAI/LLMs, notifications/email approval routing, rich-text editing, billing, deployment-platform changes and unrelated dependency upgrades. Existing business approval audit events and small API/operator notes necessary to use this feature are allowed.

Run `npm ci`, `npm run lint`, `npm test` and `npm run build`. Exercise the real persisted API workflow; use browser tooling when available or accurately identify DOM/API tests as the execution evidence. Report the actual test totals and any genuine incomplete behaviour. Never call local verification remote CI. The failing remote checkpoint is not repaired until the implementation changes pass the checks; this instruction update alone changes no product code.

Preserve the finished workspace for Andy's manual push. Return only a short implementation handoff: exact UI steps and API routes now working; local verification totals/results; any LOCAL commit SHA if created; readiness for manual push; and genuine unresolved implementation blockers. No terminal pull/push, credential request, report cycle or permission request to begin this assigned build.
