# PECP M1 Closure

## Status

**M1 — Intelligence → Deterministic Workload Model → Draft Performance Contract: CLOSED**

Closure date: 2026-09-16
Authoritative branch: `master`
Validated implementation head at closure: `1d3f342ec809c7873ad9cb41df3ac0c09d8ec16d`

## Gate evidence

M1 and its hardening gates established the first real PECP engineering vertical slice:

- authoritative shared PE domain contracts in `packages/pe-domain`;
- pure deterministic workload logic in `packages/workload-engine`;
- workload calculations with explicit lineage;
- Little's Law guardrails that refuse invalid business-throughput → session-concurrency assumptions;
- explicit workload readiness states and blockers;
- governed conflict behaviour where unresolved candidates cannot silently become authoritative calculations;
- a post-resolution RetailCo M1 scenario where 31,500 orders/hour is formally approved before throughput conversion;
- a versioned draft Performance Contract compiled from canonical intelligence;
- acceptance criteria that remain ambiguous when executable semantics are incomplete;
- workload demand kept distinct from system-performance/NFR acceptance criteria;
- deterministic compilation when supplied the same inputs and compilation timestamp;
- Workload and Performance Contract portal views driven by canonical project data rather than hidden RetailCo defaults;
- a version-controlled RetailCo reference manifest defining expected M1 behaviour.

## Governance outcome

M1 deliberately demonstrates that PECP may know enough to calculate one engineering value while still refusing to calculate or approve another.

For the RetailCo Black Friday 2026 reference scenario:

- 31,500 approved orders/hour converts deterministically to 525 orders/minute and 8.75 orders/second;
- average session duration remains a separate approved input;
- concurrent sessions are **not calculated** because session arrival rate is missing;
- the checkout response-time criterion remains **AMBIGUOUS** because no percentile is defined;
- the Performance Contract therefore remains **BLOCKED** and not approvable.

This behaviour is intentional and is a core PECP trust property.

## CI gate

GitHub Actions on `master` passed:

1. deterministic `npm ci`;
2. TypeScript typecheck;
3. unit/integration tests;
4. production build.

## Technical debt carried forward

Minor implementation cleanup that does not invalidate M1 may be addressed in later work packages without changing M1 semantics, including stricter unit typing and reducing remaining non-authoritative parsing conveniences.

No M2 capability is included in this closure.
