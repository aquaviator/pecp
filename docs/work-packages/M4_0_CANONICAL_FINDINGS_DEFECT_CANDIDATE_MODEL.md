# Work Package: M4.0 - Canonical Findings & Defect Candidate Model

## Objective

Introduce PECP's governed Findings layer.

M4.0 converts a closed M3.3 `AcceptanceEvaluation` plus its canonical Results evidence into structured, provenance-bound engineering findings and defect candidates.

The Findings layer must describe what the governed evidence proves without inventing root cause, severity, ownership, remediation or external ticket state.

This implements Constitution §13 step 16:

**create structured findings/defects**

and prepares, but does not yet implement, the Performance Evidence Package in step 17.

Read:

- `docs/M3_3_CLOSURE.md`;
- `docs/M3_2_CLOSURE.md`;
- `docs/PRODUCT_CONSTITUTION.md`;
- canonical Results and Acceptance domain models.

Do not generate the final Evidence Package.
Do not publish to Jira or Azure DevOps.
Do not assign root cause.
Do not perform release certification.
Do not run k6.

## 1. Findings governance law

A Finding is a governed engineering statement derived from canonical evidence.

A Defect Candidate is a Finding that is eligible for downstream defect publication because the evidence proves a genuine acceptance failure under valid workload.

The following rules are mandatory.

### FAIL

If Acceptance overall verdict is FAIL:

- create one deterministic performance finding for each failed canonical criterion;
- failed criterion finding may be eligible as a Defect Candidate;
- preserve criterion id, observed value, threshold, scope and evidence lineage;
- do not invent root cause.

### INCONCLUSIVE

If overall verdict is INCONCLUSIVE:

- do not create an SUT performance defect from failed criterion detail;
- create governance/execution/evidence findings only for the reason(s) that made the evaluation inconclusive;
- example: unresolved workload attainment should create an explicit workload-evidence finding, not a latency defect.

### PASS

PASS should not manufacture findings.

Return an empty Findings collection unless another explicitly governed finding source is supplied.

### PASS_WITH_OBSERVATION

Create a non-defect Observation Finding for each explicit governed non-blocking observation.

Do not turn an observation into a defect automatically.

## 2. Canonical Finding domain model

Add engine-neutral types in `@pecp/pe-domain`.

Recommended minimum:

### FindingType

- `PERFORMANCE_CRITERION_FAILURE`
- `WORKLOAD_ATTAINMENT_UNRESOLVED`
- `WORKLOAD_NOT_ATTAINED`
- `WORKLOAD_EVIDENCE_INVALID`
- `EXECUTION_INTEGRITY_ISSUE`
- `PROVENANCE_CONFLICT`
- `CRITERION_NOT_EVALUABLE`
- `THRESHOLD_CORROBORATION_CONFLICT`
- `BLOCKING_GOVERNED_OBSERVATION`
- `NON_BLOCKING_OBSERVATION`

Do not add a type unless deterministic source evidence exists.

### FindingClassification

- `PERFORMANCE`
- `GOVERNANCE`
- `EVIDENCE_QUALITY`
- `EXECUTION_VALIDITY`
- `OBSERVATION`

### FindingStatus

Initial M4.0 lifecycle may be limited to:

- `OPEN`
- `ACKNOWLEDGED`
- `SUPERSEDED`

Do not invent resolution workflow if not implemented.

### CanonicalFinding

Preserve at minimum:

- finding id;
- finding type;
- classification;
- title;
- factual description;
- source Acceptance Evaluation id/digest;
- source execution run id;
- source Contract id/version/fingerprint;
- source Test Definition id/version/fingerprint;
- source criterion id where applicable;
- observed value/unit where applicable;
- canonical threshold/operator/unit where applicable;
- workload prerequisite status;
- evidence source paths/references;
- governed observation id where applicable;
- defect eligibility;
- deterministic reason;
- finding fingerprint/digest.

Severity should be optional unless supplied by governed source policy.

Root cause should not be populated by M4.0.

## 3. Defect Candidate model

A Defect Candidate is not an external Jira/ADO ticket.

Recommended fields:

- candidate id;
- source finding id;
- title;
- factual problem statement;
- acceptance criterion reference;
- observed evidence summary;
- expected governed criterion;
- execution run reference;
- evidence references;
- publication eligibility;
- blocking reasons to publication;
- deterministic digest.

Do not include:

- invented assignee;
- sprint;
- priority;
- severity;
- component/team;
- root cause;
- due date.

Those require explicit customer configuration or human decision.

## 4. Deterministic finding generation

Implement a pure engine function, for example:

`generateFindings(...)`

Inputs:

- `AcceptanceEvaluation`;
- `CanonicalExecutionResult`;
- optionally approved Contract and Test Definition only where required to preserve source lineage.

Output:

- immutable `FindingsRegister`;
- deterministic finding ordering;
- deterministic digest.

No wall-clock calls.

## 5. Evidence and provenance validation

Before generating findings, verify the supplied Acceptance Evaluation belongs to the supplied Results execution.

At minimum bind/check:

- source execution run id;
- Acceptance Evaluation SHA-256 digest;
- Contract id/version/fingerprint;
- Test Definition id/version/fingerprint;
- Results execution identity.

Mismatch must not produce normal findings.

Represent it as a provenance conflict / invalid Findings generation result.

## 6. FAIL behavior

For each `AcceptanceCriterionEvaluation.status = FAIL` when overall Acceptance verdict = FAIL:

Create one `PERFORMANCE_CRITERION_FAILURE` finding.

Example factual wording structure:

`Checkout Response Time p95 observed 2450 ms against governed requirement p95 < 2000 ms.`

Do not write:

- "database bottleneck caused latency";
- "application is under-provisioned";
- "CPU saturation caused failure";

unless those facts exist as separate governed evidence.

A valid FAIL finding is defect-eligible.

## 7. INCONCLUSIVE behavior

Generate findings from the governing reason, not incidental criterion details.

### RetailCo authoritative expectation

Authoritative RetailCo Acceptance is:

- latency detail PASS;
- error-rate detail PASS;
- workload prerequisite UNRESOLVED;
- overall INCONCLUSIVE.

M4.0 must generate:

- one governance/evidence finding representing unresolved acceptance-basis workload attainment;
- zero performance failure findings;
- zero defect candidates.

Suggested type:

`WORKLOAD_ATTAINMENT_UNRESOLVED`

The finding must explain that steady-state workload attainment could not be proven from available time-sliced evidence.

It must not state that the SUT failed performance.

## 8. Workload NOT_ATTAINED behavior

If workload prerequisite status = NOT_ATTAINED:

- create `WORKLOAD_NOT_ATTAINED`;
- classify as GOVERNANCE / EXECUTION_VALIDITY as appropriate;
- not defect-eligible as a performance defect;
- preserve observed workload, target, required minimum and units.

Do not interpret criterion failures from an under-driven test as SUT defects.

## 9. Invalid evidence/provenance behavior

If Acceptance is INCONCLUSIVE because provenance or execution integrity failed:

Generate corresponding governed findings such as:

- `PROVENANCE_CONFLICT`;
- `EXECUTION_INTEGRITY_ISSUE`;
- `WORKLOAD_EVIDENCE_INVALID`;
- `THRESHOLD_CORROBORATION_CONFLICT`.

Do not create SUT defects from these conditions.

## 10. PASS_WITH_OBSERVATION behavior

Each explicit governed non-blocking observation may generate:

`NON_BLOCKING_OBSERVATION`

with:

- source observation id;
- source;
- description;
- provenance reference;
- no automatic defect eligibility.

Do not generate additional observations from arbitrary warnings or logs.

## 11. Defect eligibility law

A performance finding is defect-eligible only when all are true:

1. Acceptance overall verdict = FAIL;
2. workload prerequisite = ATTAINED;
3. source criterion status = FAIL;
4. Acceptance provenance gate valid;
5. Acceptance operational integrity gate valid;
6. source evidence is available;
7. finding is bound to the Acceptance Evaluation digest.

Anything else is not a performance defect candidate.

## 12. Root cause boundary

M4.0 must never infer root cause from:

- response time;
- error rate;
- dropped iterations;
- VUs;
- server counters;
- logs;
- observations.

Root cause may later be:

- supplied by governed telemetry evidence;
- manually classified;
- produced by a future investigation workflow with explicit evidence.

Until then root cause remains absent.

## 13. Deterministic identity and cryptographic binding

Findings Register and Defect Candidates should use deterministic SHA-256 digests.

Bind at least:

- Acceptance Evaluation digest;
- finding type/classification;
- source criterion/observation;
- observed evidence;
- threshold evidence;
- execution identity;
- defect eligibility.

Do not include wall-clock time.

## 14. Tests

Add deterministic tests for:

- authoritative RetailCo INCONCLUSIVE -> exactly one workload-unresolved finding and zero defects;
- PASS -> zero findings;
- FAIL with one failed criterion -> one performance finding and one defect candidate;
- FAIL with multiple failed criteria -> one finding/candidate per failed criterion;
- NOT_ATTAINED + failed criterion detail -> workload finding, zero performance defect;
- criterion NOT_EVALUABLE -> criterion-evidence finding, zero defect;
- provenance conflict -> provenance finding, zero defect;
- execution integrity issue -> execution finding, zero defect;
- threshold corroboration conflict -> evidence conflict finding, zero defect;
- blocking governed observation -> blocking-observation finding, zero defect;
- PASS_WITH_OBSERVATION -> non-blocking observation finding, zero defect;
- no root cause invention;
- no severity invention;
- deterministic ordering;
- identical inputs -> identical SHA-256 digests;
- source Acceptance digest change -> finding digest change;
- mismatch between Acceptance and Results -> invalid generation result.

Normal CI remains fast and k6-independent.

## Explicit non-goals

M4.0 does not:

- create actual Jira tickets;
- create actual Azure DevOps work items;
- generate Evidence Package;
- publish Confluence/SharePoint pages;
- produce DOCX/PDF reports;
- assign root cause;
- assign owners/priorities/sprints;
- change Acceptance verdict;
- rerun tests.

## Definition of Done

M4.0 is complete when:

1. canonical Finding and Defect Candidate types exist;
2. deterministic Findings generation exists outside UI;
3. Acceptance/Results provenance is verified;
4. FAIL generates criterion failure findings only under attained workload;
5. INCONCLUSIVE never becomes an SUT performance defect;
6. authoritative RetailCo generates workload-unresolved finding and zero defects;
7. PASS produces no invented findings;
8. PASS_WITH_OBSERVATION preserves explicit observations only;
9. root cause/severity/ownership are never invented;
10. finding/defect identities are deterministic and cryptographically bound;
11. normal CI is green.

Stop and provide an M4.0 completion report for PM audit.
