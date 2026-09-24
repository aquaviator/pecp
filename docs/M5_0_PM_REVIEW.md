# PECP M5.0 Project Manager Review

## Latest Verdict

**M5.0 — HOLD / NOT CLOSED**

The first PM correction has been implemented successfully and authoritative remote CI is now green.

However, the final platform audit found two material architectural/data-fidelity blockers and two smaller zero-invention persistence/API issues that should be corrected now, before M5.1 adds identity and concurrent real users.

Do **not** create M5.0.1.

Correct M5.0 in place.

---

## Authoritative remote state

Final correction implementation currently on `master`:

`52cbee7798cd313a5c81edbf8f2de9488a68d46c`

GitHub Actions run:

`35984161067`

Job:

`107582787261`

Conclusion:

**SUCCESS**

Verified remotely:

- deterministic `npm ci`: PASS
- TypeScript typecheck: PASS
- web tests: 29 files / 478 tests PASS
- API/platform tests: 5 files / 23 tests PASS
- RetailCo Reference Lab: 10/10 PASS
- total automated tests: **511**
- production web build: PASS
- transaction rollback suite: 6/6 PASS
- ApiIntelligenceService: 5/5 PASS
- ApiProjectService: 4/4 PASS
- API-mode ServiceContext boundary: 3/3 PASS

The submitted report's test totals are therefore substantively correct, although the prose saying "31 test files" is inaccurate. Remote evidence is 29 web + 5 API + 1 Reference Lab = **35 test files/suites**.

---

## Previous blockers now accepted

The following first-audit blockers are resolved:

1. **Deterministic lockfile** — resolved. Clean remote `npm ci` passes.
2. **Current record + revision atomicity** — a database-agnostic `IUnitOfWork` exists and SQLite rollback tests cover injected write/revision failures.
3. **API-mode mock fallback** — API mode now uses API/unavailable adapters rather than Mock services.
4. **Intelligence web adapter** — `ApiIntelligenceService` exists for item reads and mutation/approval calls reject pending M5.1 identity.
5. **Rollback tests** — 6 failure-injection tests exist.
6. **Runtime DB source-control protection** — `data/`, `*.db`, `*.db-wal`, `*.db-shm` are ignored.
7. **Architecture documentation** — updated for `IUnitOfWork`.
8. **Remote CI** — green.

These corrections are accepted.

---

# Remaining blocking corrections

## 1. Async Unit of Work is not safe under concurrent API requests

This is the most important remaining issue.

`SqliteDatabase.execute()` keeps transaction nesting in one mutable instance field:

`transactionDepth`

and holds a SQLite transaction open while awaiting asynchronous repository/application operations.

That works for deliberately nested calls in a single logical request, but it does not distinguish:

- a nested transaction belonging to the same request; from
- a second independent Fastify request arriving while the first transaction is awaiting.

With two concurrent requests on the same `SqliteDatabase` instance, request B can observe request A's non-zero `transactionDepth` and be treated as a nested SAVEPOINT inside request A's transaction.

Consequences can include:

- one successful request being committed or rolled back as part of another request;
- a rollback in request A affecting writes made by request B;
- savepoint ordering/depth being controlled by interleaved request completion rather than logical transaction ownership.

This is unacceptable for the persistent platform boundary, especially immediately before M5.1 introduces real users.

### Required correction

Make top-level Unit of Work execution exclusive per SQLite connection while preserving true same-operation nesting.

Acceptable design:

- serialize independent top-level `execute()` operations with an async mutex/queue;
- identify genuine nested execution using request/async-context ownership, for example Node `AsyncLocalStorage`, or refactor the application service so internal helper calls do not recursively open a second top-level Unit of Work;
- SAVEPOINT nesting must only apply to the same logical Unit of Work;
- unrelated Fastify requests must never share a transaction.

Do not add a heavyweight dependency merely for a mutex unless necessary.

### Required concurrency regression tests

Add tests that deliberately interleave two asynchronous operations against the same SQLite database connection.

At minimum prove:

1. two concurrent successful project creates both persist with correct revisions;
2. request A pauses inside its transaction while request B attempts a mutation, and B does not join A's transaction;
3. request A fails/rolls back while concurrent request B succeeds, and B's successful state remains committed;
4. concurrent auto-organisation/project creation does not corrupt revision numbering or leave/erase unrelated tenant state.

The test must include an actual async barrier/delay so it would fail against the current shared-`transactionDepth` implementation.

---

## 2. ApiIntelligenceService invents IntelligenceReviewSummary semantics in the browser

The item read adapter is correct, but `getIntelligenceSummary()` currently calculates:

- `documentsAnalysed` from the number of distinct `sourceDocument` values;
- `requirementsFound` from total IntelligenceItem count;
- `performanceRequirements` from REQUIREMENTS + WORKLOAD item count;
- `conflicts` and `missingInformation` from local item-state counting;
- `readinessSections` as an invented empty array.

Those values are not equivalent to the canonical `IntelligenceReviewSummary` contract.

For example, a document referenced by an intelligence item is not proof that it represents the complete count of documents analysed, and all intelligence items are not necessarily requirements.

This reintroduces a client-side semantic calculation pattern that PECP has explicitly eliminated elsewhere.

### Required correction

For M5.0, do **not** synthesize an `IntelligenceReviewSummary` from raw items.

Use one of these source-faithful approaches:

**Preferred narrow M5.0 approach:**

- `ApiIntelligenceService.getIntelligenceSummary()` explicitly reports the capability as unavailable until a canonical/persisted Intelligence Review Summary exists;
- update the Intelligence page so summary unavailability does not prevent the supported item read model from rendering;
- show a neutral governed absence/unavailable state for the summary.

OR, if implementing a summary read endpoint:

- persist/read the actual `IntelligenceReviewSummary` as source state;
- do not derive fields with changed semantics merely to fill the interface.

Do not start M5.2 extraction/intake logic.

Update tests so they prove there is no client-side invented summary.

---

## 3. Corrupt bootstrap JSON is silently repaired into an empty document list

`SqliteProjectRepository.getBootstrapMetadata()` currently catches JSON parse failure for `uploaded_document_names_json` and substitutes:

`[]`

That changes corrupted persisted state into a valid-looking empty document list.

For a provenance/governance product, corrupted persistence must be surfaced rather than silently normalized.

### Required correction

- malformed persisted bootstrap JSON must throw a controlled persistence-integrity error;
- API 500 handling may still return the safe generic external error envelope;
- do not leak SQL/path/internal payloads;
- add a corruption test proving malformed JSON is not returned as `[]`.

---

## 4. API list adapters silently coerce malformed responses into empty lists

`ApiProjectService.getProjects()` and `ApiIntelligenceService.getIntelligenceItems()` currently use patterns equivalent to:

`data.items || []`

If a successful HTTP response is malformed and omits `items`, the browser silently turns a contract failure into a legitimate empty collection.

That is a small but real zero-invention violation.

### Required correction

For HTTP 2xx responses:

- validate the expected list envelope;
- if `items` is absent or not an array, throw an API contract error;
- preserve a genuine source empty array exactly.

Add tests distinguishing:

- `{ items: [] }` => valid empty result;
- `{}` or malformed `items` => explicit contract error.

No full schema framework is required for M5.0.

---

# Non-blocking observations

- The API/platform dependency direction remains correct.
- SQLite remains appropriate as the embedded/reference persistence provider.
- CORS/auth hardening belongs to M5.1/security and should not be pulled into this correction.
- Production API container compilation remains M5.6; current TypeScript/runtime validation is sufficient for M5.0.
- M0-M4 engine purity remains intact.
- M5.1 has not started.

---

# Required verification before final resubmission

From clean repository state:

1. `npm ci` — PASS
2. root TypeScript checks — PASS
3. web tests — PASS
4. API/platform tests — PASS
5. RetailCo Reference Lab — PASS
6. production web build — PASS
7. existing rollback failure-injection tests — PASS
8. new concurrent Unit-of-Work isolation tests — PASS
9. API-mode no-mock-fallback tests — PASS
10. intelligence summary zero-invention test — PASS
11. corrupt bootstrap JSON integrity test — PASS
12. malformed API list-envelope tests — PASS
13. persistence restart test — PASS
14. normal GitHub `CI` — SUCCESS

---

# Closure condition

M5.0 can close when:

- unrelated concurrent requests cannot share a SQLite transaction;
- Intelligence Review Summary is source-backed or explicitly unavailable, never client-invented;
- corrupt persisted bootstrap metadata is surfaced rather than silently repaired;
- malformed API list envelopes are surfaced rather than converted to empty state;
- all existing M5.0 corrections remain intact;
- authoritative remote CI remains green.

No new product capability is required.

## Programme state

`M4.3 ✅ → M5.0 remote CI ✅ / final concurrency + zero-invention hardening required → M5.1 NOT STARTED`
