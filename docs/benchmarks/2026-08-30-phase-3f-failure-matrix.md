# Phase 3F failure, restart, and concurrency matrix

Date: 2026-08-30  
Scope: non-production checks and repository-controlled simulations only.

This matrix separates safety proven by deterministic tests from safety proven
against the configured non-production services. It is not a claim that the
unexecuted live worker/queue scenarios passed.

| Scenario | Result | Evidence / limitation |
|---|---|---|
| HTTP timeout | PASS (fixture) | Worker/extractor retry mapping tests; no controlled live HTTP fault endpoint. |
| HTTP 429 | PASS (transport classification fixture) | Provider error classification is covered; no live 429 injection. |
| HTTP 500 | PASS (transport classification fixture) | Storage/provider failure classification is covered; no live 500 injection. |
| Redirect failure / unsafe redirect | PASS (fixture) | Source-adapter fail-closed redirect tests; no live redirect-loop injection. |
| Robots denial | PASS (fixture) | Missing/blocked robots policy prevents fetch and persistence. |
| Mongo failure / timeout | PASS (fixture); PASS (bounded live smoke for normal path) | Simulated unavailable client maps to retryable raw-persistence failure; live outage injection was not performed. |
| Supabase Storage write failure | PASS (fixture) | No dangling snapshot is reported after object-write failure. |
| Supabase Storage missing object | PASS (bounded live smoke + fixture) | Deleted smoke object returned explicit raw-unavailable behavior; cleanup confirmed. |
| Postgres staging/identity/quality failure | NOT RUN | v3 tables are absent in the configured project; no mutation or fault injection was authorized. |
| Postgres transactional promotion failure | NOT RUN | v3 promotion migration is unapplied; no live canonical mutation was attempted. |
| Worker crash after raw persistence | NOT RUN | No live queue worker crash/restart test. |
| Worker crash after assertions | NOT RUN | No live queue worker crash/restart test. |
| Worker crash after quality | NOT RUN | No live queue worker crash/restart test. |
| Retry after interrupted promotion | PASS (fixture); live NOT RUN | Promotion fixture retains history and is idempotent; no live concurrent promotion. |
| Concurrent identity resolution | PASS (fixture); live NOT RUN | Registry fixture serializes creation; no multi-worker live test. |
| Concurrent promotion | PASS (fixture); live NOT RUN | Repeated-promotion fixture is stable; no multi-worker live test. |
| Duplicate job submission | NOT PROVEN | Existing stable-ID tests cover selected idempotency paths, but no live duplicate submission through the configured queue. |
| Stale-worker recovery | NOT RUN | No live claim/lease/restart scenario executed. |

## Re-run command

The relevant hardening set was re-run from `services/data-ingestion`:

```text
$env:PYTHONPATH='src'; python -m pytest tests/test_raw_evidence.py tests/test_supabase_storage.py tests/test_source_adapters.py tests/test_worker.py tests/test_identity_promotion_slice_d.py tests/test_quality_slice_c.py tests/test_core.py
```

Measured result: **260 passed in 6.50s**.

The full Python regression remains the required gate. This matrix has not
closed the blocking live restart/concurrency gate because the queue, v3 schema,
and transactional promotion paths were not exercised in the non-production
project.
