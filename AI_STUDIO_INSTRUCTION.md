# AI Studio Instruction: Build Real Strategy and Test Plan Workflow

## Manual transfer workflow (applies to every task)

Andy performs BOTH repository transfers manually through AI Studio:

1. ChatGPT writes the build instruction into GitHub and provides a short instruction to read it.
2. Andy manually pulls the repository changes into AI Studio.
3. AI Studio reads the instruction already present in its workspace, implements the assigned product change, and runs local verification.
4. Andy manually pushes the finished changes from AI Studio to GitHub.
5. ChatGPT checks the resulting remote implementation commit and its CI evidence before preparing the next build instruction.

Do not attempt terminal-based `git fetch`, `git pull`, or `git push` as part of this handoff. Do not request GitHub credentials, change remotes, force-push, reset the workspace, or discard local work to resolve synchronization. Terminal write credentials are not required for Andy's manual transfer workflow.

Local Git inspection is permitted. If a local commit exists, label its SHA as LOCAL. Do not assume that it is the SHA produced by Andy's subsequent manual push. The remote commit and CI state must be read from GitHub after the manual push, not inferred from a local build.

Finish implementation by preserving the working changes and saying they are ready for Andy's manual push. Pending manual transfer is a handoff state, not a product-code defect. Report genuine implementation or test failures separately.

This workflow clarification does not authorize repeating an already delivered feature, adding new product scope, or starting a reporting cycle. Preserve existing implementation and complete only genuinely missing work in the assigned slice.

## Active task

Repository: `aquaviator/pecp`
Target branch: `master`
Task: implement the next usable product slice, from the real compiled Performance Contract to persisted Performance Strategy and Performance Test Plan artefacts in the portal.

This replaces the preceding intelligence-to-contract build instruction. It is an implementation task, not a request for an audit, plan, milestone report, completion report, or closure document. Build the working capability in this run. Do not reopen M5.2 or require a new PM reporting cycle.

## Starting point

The previous product slice is committed as:

`4a82fc7a431bc3757b360528b4168d5f04218171`

Commit message: `feat: integrate performance contract service`.

The earlier SHA `ac57a3bab0ec7ced5efca4db1317a4c278e6af20` is the M5.2 closure base, NOT the new implementation commit. Do not reset to it or present it as your delivery SHA.

Remote CI run `37202826658`, job `111437833676`, completed successfully for the implementation. Its logs show 491 web tests, 118 API tests, and 10 Reference Lab tests: 619 passing, plus successful npm ci, TypeScript checks, and production web build. These are baseline execution results, not a production or security certification.

Use the repository state Andy has manually pulled into AI Studio, including this instruction. Inspect local state before editing and preserve later commits and legitimate local changes. Do not perform repository synchronization yourself. If the required instruction or source is absent, describe the exact missing prerequisite without requesting credentials or attempting destructive recovery. If this slice is already partly present, complete its missing production paths instead of duplicating them; if already delivered, do not rebuild it merely to perform a handoff.

## User-visible outcome

A user working in a real persisted project can:

1. Review the project's live Performance Contract and its readiness/blocking reasons.
2. Generate a Performance Strategy or Performance Test Plan using the existing deterministic engines.
3. Read the full structured document in the portal, including supplied values, unresolved sections, and source lineage.
4. Retrieve the saved document revision after refreshing or restarting the API.
5. Download that revision as Markdown using the existing exporter.
6. See when an upstream source or governing input changes, then regenerate a new revision without losing the previous document.

This must work in API mode against persisted project data, not merely against a reference fixture or browser memory. The documents are PECP customer-facing engineering outputs, not development progress reports.

## Reuse the existing product

Read the current code needed for implementation, including:

- `docs/PRODUCT_CONSTITUTION.md`
- `packages/platform-core/src/services/PerformanceContractService.ts`
- `packages/workload-engine/src/contractCompiler.ts`
- the existing PerformanceContract and EngineeringArtefact types in `@pecp/pe-domain`
- `packages/artefact-engine/src/strategyGenerator.ts`
- `packages/artefact-engine/src/testPlanGenerator.ts`
- `packages/artefact-engine/src/staleness.ts`
- `packages/artefact-engine/src/exportMarkdown.ts`
- `apps/api/src/app.ts`, current repositories, migrations, transaction, permission, and idempotency patterns
- `apps/web/src/services/ServiceContext.tsx`, `ContractPage.tsx`, and the existing artefact pages/components
- existing artefact, Northstar, API-mode, and DOM tests

Reuse `generatePerformanceStrategy`, the existing Test Plan generator, Markdown exporter, canonical fingerprinting, and staleness functions. Discover exact existing function and route names before changing them. Keep the existing section structure, structured tables, unresolved issues, and source references. Do not replace the generators with summaries, placeholder documents, new templates, or a parallel contract model.

## 1. Add the production contract-to-artefact service

Implement a service in the existing platform layer, or extend an equivalent service already present, for generating, listing, retrieving, and exporting project artefact revisions.

Generation must obtain its contract from the authoritative persisted-project compilation path. It must not trust a client-submitted contract, source excerpt, approval state, or fingerprint as the truth.

Read the project, relevant intelligence, checklist, source bindings, and compilation state as one consistent input snapshot. Use the existing Unit of Work or an equivalent revision-checked boundary. Revalidate relevant state and current permission before committing the generated revision. Do not combine pre-change contract values with post-change provenance.

Use the existing canonical contract fingerprint. Bind the artefact to the exact contract and input snapshot used for generation, including intelligence revisions, relevant approval decisions, source version IDs/digests, locators, and excerpts where supplied. Include supplementary narrative inputs used by the generators, such as architecture or environment intelligence, in the input binding: changing those must not leave an apparently current document just because a workload number stayed the same.

Use the existing fingerprint/lineage mechanism where sufficient. Extend it minimally where necessary rather than adding competing calculations or hidden alternate authorities. Exclude request-time clocks from semantic fingerprints; store actual generation time separately. Never invent a historical timestamp to make results deterministic.

## 2. Preserve readiness, approval, and missing-information semantics

`READY_FOR_APPROVAL` is not `APPROVED`, and neither successful compilation nor document generation authorizes execution.

Generate draft/reviewable artefacts according to the existing engine rules. Do not add automatic contract or document approval. Existing explicit BLOCKED draft previews may remain available, but must visibly carry their issues and must never be presented as approved or executable output.

Only eligible, source-governed facts may populate authoritative document statements and numerical calculations. Do not pass raw unfiltered intelligence into generators in a way that promotes stale, conflicting, ambiguous, or unapproved assertions to accepted facts. Preserve excluded-input reasons through the existing issue/section models.

Missing architecture, environments, test data, observability, acceptance thresholds, timing, or journey information must remain explicitly NOT_SUPPLIED, UNRESOLVED, or the equivalent established state. Do not manufacture values to complete a document. An approved 24,000 orders/hr alone does not establish every prerequisite for a complete Test Plan.

Preserve demand versus NFR separation, typed values, absent-unit semantics, calculation lineage, and the distinction between business orders and HTTP requests. Keep Northstar/RetailCo specifics in their explicit reference data, not generic product defaults.

Make only integration fixes necessary for this slice, with focused regression tests. Do not broadly redesign the compiler or weaken established gates to get artefacts to render.

## 3. Persist revisions and expose authenticated APIs

Reuse existing artefact storage/contracts if available; otherwise introduce the smallest repository and additive migration required.

Each saved revision must retain project/tenant ownership, artefact type, revision identity, original structured content, generation metadata, and the exact input/contract binding. Restarting the service must not regenerate or silently replace a saved revision.

Regeneration creates a new revision and preserves prior content and historical source lineage. Repeated delivery of the same generation request with the same idempotency key must not create duplicate revisions. Reusing that key with a changed payload must reject rather than replay a different operation.

Expose generation, list/history, read, and Markdown download through the existing API conventions. Reuse equivalent routes if present; otherwise a suitable family is:

- `POST /api/v1/projects/:projectId/artefacts`
- `GET /api/v1/projects/:projectId/artefacts`
- `GET /api/v1/projects/:projectId/artefacts/:artefactId`
- `GET /api/v1/projects/:projectId/artefacts/:artefactId/export?format=markdown`

Use the actual domain artefact-type identifiers and make revision selection unambiguous. These paths are suggested, not authority to duplicate an existing API.

Generation requests must include the expected contract/input binding observed by the user. Recompute and compare server-side at the consistent write boundary; a stale expectation returns 409 with actionable refresh guidance and no partial write. If the existing semantic fingerprint excludes relevant input lineage, also bind/check the governing input revision digest.

Enforce current authentication, tenant/project access, existing role permissions, CSRF for cookie-authenticated mutations, input validation, and idempotent replay reauthorization. Read-only users must not gain generation permission. A foreign artefact ID must not bypass project scoping on read or download. Use the existing audit event infrastructure for mutations, not a new audit-report document.

## 4. Make source drift visible without rewriting history

Use the current contract and complete generation-input binding to evaluate document freshness on read/list/export, reusing the existing staleness machinery.

A replaced source, material intelligence edit, changed selected candidate, or invalidated approval must make affected artefacts visibly stale or blocked for current use. This also applies when a new source version contains the same numerical value but changes the governing evidence.

Preserve the originally saved content and bindings. Keep current freshness metadata separate or use the established non-mutating status projection. Never rewrite history to make an older revision appear to have used the new source.

After re-binding and approval of current intelligence, regeneration creates a new correctly bound revision. Older revisions remain available as clearly labelled historical documents and do not silently regain approval or current status. Any historical download must be explicitly identifiable as historical/stale where applicable.

## 5. Wire the actual portal

Use the existing Contract and artefact pages and design language. Add working Generate Strategy and Generate Test Plan actions, or connect existing actions where already present.

The experience must include:

- meaningful readiness and blocking messages before generation;
- loading, failure, retry, and success handling;
- full structured document preview, not only a JSON modal or a success toast;
- source/locator information for supplied values and working navigation to existing source inspection where supported;
- saved revision selection/history and Markdown download;
- stale-input warnings and regenerate/refresh actions;
- correct permission-based controls and server-side enforcement;
- project switching that clears previous documents and ignores late responses for an abandoned project.

Add API-backed service adapters through ServiceContext. Keep explicitly selected reference/mock mode working, but never silently fall back to fixtures on an API error. Do not claim the production workflow works because the demo homepage responds with HTTP 200.

Do not add a new design system, chat panel, external AI call, rich-text editing system, or document approval subsystem in this slice.

## 6. Prove the product through executable tests

Extend existing tests at the relevant layers, rather than writing a report. Cover at least:

1. A persisted Northstar project with explicitly supplied and approved required inputs generates both full artefacts through the real service/API. Its 24,000 orders/hr value and source lineage appear correctly. Additional required fixture inputs must be supplied through the governed flow, never injected into production defaults.
2. Competing 30,000 orders/hr or stale/unapproved inputs cannot produce an apparently ready/approved artefact. Preserve the existing explicit blocked-draft behaviour where used.
3. The returned contract fingerprint, generator binding, saved metadata, retrieved document, and export agree about the generation input. Tampered client values cannot override the server's contract.
4. Source replacement after preview produces a stale-expectation rejection with no partial write; a concurrent replacement cannot produce a mixed-source revision.
5. Re-binding/reapproval and regeneration create a new revision. Earlier content/lineage remain unchanged, including the same-number/new-source-version case and changes to narrative inputs outside workload calculations.
6. Restart preserves saved content, version history, fingerprints/bindings, and correct freshness assessment. Identical semantic input remains deterministic despite different request times.
7. Authentication, viewer write denial, cross-tenant/project isolation, download access, and idempotent retry behaviour remain enforced.
8. DOM-capable interaction tests drive generation, document preview, errors/retry, history/download, source drift, and project switching with an out-of-order response. Service mocks are appropriate for focused DOM tests, but the service/API path must also have real persistence integration coverage.

Keep the existing 619-test baseline green and add meaningful coverage. Do not remove assertions, skip tests, suppress errors, or use a hard-coded expected response to simulate completion.

## 7. Build and hand off the working result

Run `npm ci`, `npm run lint`, `npm test`, and `npm run build`. Exercise the new workflow in API mode with a persisted project. Use browser interaction tooling if available; otherwise report exactly which DOM/API execution provided evidence and do not claim a manual browser walkthrough.

After local checks pass, preserve the finished implementation in the AI Studio workspace for Andy's manual push. Do not run terminal-based Git synchronization or attempt to acquire write credentials. If a local commit was created, record its exact SHA as LOCAL, not as proof of remote delivery. State that remote CI is unverified until the manual push has occurred and its resulting GitHub run has been inspected. A pending manual push does not require an audit report or a separate credential-repair task.

Do not introduce new k6 runs or engine behaviour, JMeter, connectors, BYOAI, billing, deployment platforms, marketing work, or unrelated dependency upgrades. Do not run forced dependency upgrades to remove warnings. Normal tests and small operational/API notes needed to use this capability are permitted; PM reports, re-audits, milestone closure documents, and speculative plans are not the deliverable.

Return a compact handoff containing only:

- readiness for Andy's manual push, plus the exact LOCAL implementation commit SHA if one exists;
- what the user can now do, with exact UI navigation/clicks and implemented API routes;
- test totals and local install/typecheck/build results; keep remote CI separate and do not infer its state;
- any genuine unfinished behaviour or blocker, scoped to this slice.

Stop after implementing and handing off this slice. Do not self-authorize unrelated work or initiate another audit/report cycle.
