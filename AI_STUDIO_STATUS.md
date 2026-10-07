# PECP AI Studio Cold-Start Status

## Purpose

This file lets a brand-new Google AI Studio Build chat resume PECP without depending on the previous Studio conversation.

The repository is authoritative. Chat history is not.

## Manual Transfer Workflow

Andy performs repository transfer manually:

1. ChatGPT writes/updates the handover in GitHub.
2. Andy manually pulls repository changes into AI Studio.
3. AI Studio reads this status file and `AI_STUDIO_INSTRUCTION.md`.
4. AI Studio implements and verifies the active task.
5. Andy manually pushes the completed changes back to GitHub.
6. ChatGPT verifies the remote implementation and CI, then prepares the next handover.

AI Studio must not run terminal git fetch/pull/push, request credentials, change remotes, reset/discard local work, or assume its local commit SHA is the remote delivery SHA.

## Current Product Position

PECP has progressed beyond reference-only development into a persisted governed platform.

Delivered product spine includes:

- persistent organisations/projects and governed Fastify API;
- local identity, sessions, RBAC and audit authority;
- real source intake for text/CSV/JSON/DOCX/PDF with provenance and source versioning;
- conflict, approval, supersession and stale-intelligence governance;
- real persisted intelligence -> deterministic Performance Contract compilation;
- persisted Performance Strategy and Performance Test Plan generation;
- artefact revision history, Markdown export and upstream-drift detection;
- persisted version-specific Contract / Strategy / Test Plan approval decisions;
- parent-contract approval dependency and no-resurrection semantics;
- existing deterministic Test Definition, k6 compiler/runtime, Results, Acceptance, Findings and Evidence engines from earlier closed milestones.

The remaining work is to finish the approval backend concurrency/binding guarantees before wiring the real approved-project workflow into persisted Test Definition generation and downstream execution.

## Last Delivered Product Commit

`708b1b9549e2ef373b20ff9c95eaccd6a891a63f`

Commit:
`feat: enhance contract decision consistency and safety`

Remote CI:
- Run: `37443588955`
- Job: `112202941526`
- Result: SUCCESS
- Web: 501 passed
- API: 132 passed
- Reference Lab: 10 passed
- Total: 643 passed
- TypeScript checks: PASS
- Production web build: PASS

This green CI is a regression baseline, not evidence that the remaining targeted concurrency cases are already complete.

## Current Repository Head Before Studio Pull

The current handover instruction was prepared in commit:

`c5404c2e0ab1b5d62eac2e7a8400d0e0e6093ec1`

This is an instruction-only commit on top of the delivered product implementation.

## Active Development Task

Task ID:

`BUILD-CONTRACT-ARTEFACT-APPROVALS`

Instruction revision:

`4`

Authoritative task file:

`AI_STUDIO_INSTRUCTION.md`

The task is NOT to rebuild approvals. It is the bounded completion of three remaining backend paths:

### B1 — Artefact generation transaction boundary

Make generation revision allocation, governing-input reads, current authority, scoped idempotency, revision write, success audit and idempotency receipt one serialized atomic operation.

Concurrent same-key generation must create one revision only.

### B2 — Authority check inside protected boundary

Re-read current account/session/membership authority after acquiring the protected write boundary for contract review saves/decisions and artefact generation/decisions.

Queued operations must observe committed revocation/demotion before writing.

### B3 — Mandatory exact reviewed-input bindings

Require and validate exact target revision, decision revision, immutable content fingerprint and governing-input binding for protected review/decision operations.

Save-for-review and generate/regenerate must also use server-issued preview/current binding tokens rather than silently substituting current server state.

The full requirements, source observations and executable regression cases are in `AI_STUDIO_INSTRUCTION.md`.

## Scope Guard

Do not begin the next product slice until B1/B2/B3 are implemented and locally verified.

Specifically do not yet start:

- persisted Test Definition generation;
- k6 bundle delivery;
- customer runner orchestration;
- live results ingress;
- connectors;
- BYOAI;
- billing;
- deployment redesign;
- PM/audit/closure reporting.

## Dependency Advisory Note

The last inspected CI installation reported four dependency advisories: one moderate, one high and two critical.

This is not yet triaged for applicability.

Do not perform blind or forced dependency upgrades as part of the approval task. Preserve it as release-hardening work unless a dependency is shown to block or directly compromise the active feature.

## Fresh AI Studio Chat Startup

A new AI Studio chat should:

1. Read this file completely.
2. Read `AI_STUDIO_INSTRUCTION.md` completely.
3. Inspect local working-tree changes before editing.
4. Preserve any legitimate unpushed work.
5. Execute the active task rather than summarising it.
6. Run the required focused regression tests and full verification.
7. Leave completed changes ready for Andy's manual push.
8. Return a concise implementation handoff only.

Do not ask Andy to restate the project history unless a repository file required by the active instruction is genuinely missing.
