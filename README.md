# PECP — Performance Engineering Control Plane

PECP is a customer-deployed Performance Engineering Control Plane for turning project intelligence into governed performance models, professional engineering artefacts, executable performance tests, and traceable performance evidence.

## Product Principles

- Customer-deployed commercial software; hosted environments are for demo/reference use only.
- Bring Your Own AI (BYOAI): customers use their approved AI/provider/credits.
- AI assists interpretation, extraction, drafting and explanation; PECP owns deterministic engineering state, calculations, provenance, execution, governance and audit.
- Source-agnostic intelligence: manual entry, documents, Azure DevOps, Jira, telemetry and AI populate the same canonical PE model.
- Execution and tooling are provider-based. PECP integrates with k6, JMeter, CI/CD, APM/observability, ALM and publishing ecosystems rather than replacing them.
- Every major capability must be validated against the PECP Reference Intelligence Library and Reference Performance Lab.

## Monorepo Architecture

```
pecp/
├── apps/
│   ├── web/               # Portal UI (React 18 + Vite + Tailwind)
│   ├── api/               # Future backend services (M1+)
│   └── worker/            # Future background worker (M1+)
├── packages/              # Shared packages and libraries
├── connectors/            # External integration providers (ADO, Jira, etc.)
├── execution/             # Test execution orchestration (k6 runtime)
├── reference-library/     # Reference intelligence datasets (RetailCo, etc.)
├── reference-lab/         # Executable reference workloads and environments
├── deployment/            # Docker, VM, and Helm infrastructure definitions
├── tests/                 # End-to-end and integration test suites
├── docs/                  # Authoritative documentation (PRODUCT_CONSTITUTION.md)
└── .github/workflows/     # CI/CD pipelines (GitHub Actions)
```

## Development & Build Commands

All commands can be executed from the repository root via npm workspaces:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the web development server on port 3000 (`0.0.0.0:3000`) |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) across the portal codebase |
| `npm run test` | Runs the unit test suite via Vitest |
| `npm run build` | Compiles the production portal bundle into `dist/` |
| `npm run preview` | Previews the compiled production build locally on port 3000 |

## Sellable MVP Lifecycle

Brief / Documents / Azure DevOps → Intelligence Extraction → Gap & Conflict Review → Approved Workload Model → Performance Contract → Strategy & Test Plan → Approval → k6 Test → Customer-Controlled Execution → Results → Findings → Performance Evidence → Publish / Export.

## Current Milestone

**M0.1: Foundation Hardening** (Completed)

See `docs/PRODUCT_CONSTITUTION.md` for authoritative product laws and architectural specifications.
