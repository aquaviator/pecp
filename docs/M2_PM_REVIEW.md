# M2 Project Manager Review

## Decision

**M2 is conditionally accepted but remains OPEN.**

The deterministic artefact engine, Strategy/Test Plan views, traceability model, staleness handling, Markdown export, and RetailCo M2 reference manifest are materially implemented. However, the M2 gate cannot close until CI is green and several source-governance defects are corrected.

## Verified strengths

- `@pecp/artefact-engine` exists outside the portal and is consumed by the web app.
- Strategy and Test Plan are generated from the Performance Contract/canonical intelligence rather than static page fixtures.
- BLOCKED contract state propagates into non-approvable artefacts.
- Workload demand remains structurally separate from NFR acceptance criteria.
- Session concurrency remains blocked where the session-arrival prerequisite is absent.
- Ambiguous checkout percentile is carried forward rather than invented.
- Environment/test-data/observability sections can surface NOT_SUPPLIED.
- Artefact-to-contract drift detection exists.
- RetailCo M2 reference expectations exist.

## Gate failures

### 1. GitHub CI is red

The M2 commit added the new `@pecp/artefact-engine` workspace/dependency without regenerating the root npm lockfile. GitHub Actions fails at deterministic `npm ci`, so tests/typecheck/build have not been independently verified for the M2 commit.

### 2. Test Plan invents project-specific execution schedules

The generated Test Plan currently hard-codes execution details that do not exist in canonical intelligence, including examples such as:

- single-user baseline;
- 10-minute baseline;
- 15-minute ramp;
- 60-minute steady state;
- 4-hour soak;
- 80–100% demand;
- 120–150% stress demand;
- 10% steps every 10 minutes.

These are engineering decisions, not source-derived facts, and therefore cannot appear as authoritative project plan values unless supplied/approved.

### 3. Strategy invents assumptions and test parameters

The Strategy generator inserts a default `Steady-state equilibrium assumed...` assumption when none is supplied, plus concrete test durations, virtual-user counts, percentages and test sequencing. M2 artefacts must preserve missing information rather than create a parallel source of truth.

### 4. Invented preconditions / abort criteria

The generators include project-specific operational detail not present in canonical state, such as synthetic account seeding, APM collector heartbeat checks, error-rate abort thresholds, CPU/memory saturation thresholds and fixed timing windows.

Generic PECP methodology may be displayed as clearly labelled guidance, but must never masquerade as approved project parameters.

### 5. Fingerprint wording

`computeContractFingerprint()` currently uses FNV-1a 32-bit. This is a deterministic drift checksum/fingerprint, not a cryptographic binding. Product/report wording must not describe it as cryptographic unless a cryptographic hash implementation is deliberately introduced.

### 6. Generation timestamp semantics

Artefact generators currently fall back to contract creation time / a fixed date when generation time is not supplied. `Generated Date` should represent the generation event, not an unrelated fallback. Deterministic tests should supply a timestamp explicitly.

## Required correction

Execute `docs/work-packages/M2_1_ARTEFACT_GOVERNANCE_GATE.md` and do not start M3.
