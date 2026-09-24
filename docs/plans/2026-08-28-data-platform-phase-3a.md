# Data platform Phase 3A — Slice A foundation

Status: targeted OpenCode review and real non-production MongoDB/Supabase
Storage verification passed. Node 24 verification remains deferred by user
decision.

Scope is limited to durable raw-evidence and provider/parser foundations. It
does not change discovery, canonical promotion, programme/university identity,
coverage/recovery, inference, legacy application parsing, or product reads.

## Added foundation

- Storage-neutral `RawEvidenceStore`, immutable `RawDocument` snapshots, and
  content-addressed payload deduplication contracts.
- Lazy, injected `MongoRawEvidenceStore` plus S3-compatible and Supabase
  Storage object-store adapters. MongoDB is raw evidence only; no raw payload
  is sent to Supabase tables.
- Supabase Storage uses direct immutable no-upsert creates; a duplicate is
  accepted only after an exact retained-payload GET verification, without a
  metadata-endpoint preflight.
- `RAW_EVIDENCE_MODE=local|remote|dual`: remote/dual persists a snapshot before
  accepted parsing/extraction; persistence failure emits `RAW_PERSIST_FAILED`
  and fails that source rather than claiming durable retention.
- Versioned parser registry for HTML, JSON, PDF, and plain text. Structured
  JSON remains structured.
- Provider-neutral extraction contracts and errors. The DeepSeek adapter keeps
  legacy `DEEPSEEK_*` operation and supports generic extraction environment
  names. Deterministic stages no longer require LLM credentials at run start.
- Additive `supabase-crawl-acquisition-v3.sql` for acquisition metadata and
  durable raw-document references only. It does not store raw bodies or change
  promotion.

## Measured verification

From `services/data-ingestion`, with `PYTHONPATH=src` to ensure tests exercise
this worktree rather than the stale editable package at `D:\projects\Glowbal`:

- `python -m pytest tests/test_raw_evidence.py tests/test_extraction_provider.py`
  — **22 passed**.
- `python -m pytest tests/test_supabase_storage.py tests/test_raw_evidence.py`
  — **21 passed**.
- `python -m pytest` — **233 passed**.
- `python -m compileall -q src` — **passed**.
- `git diff --check` — **passed**.

- Targeted OpenCode review — **PASS**.
- Real non-production MongoDB verification — **PASS**.

The unqualified `python -m pytest` environment currently imports
`glowbal_ingestion` from the stale external editable path and therefore cannot
be treated as a valid worktree test command until the package is installed from
this checkout or `PYTHONPATH=src` is set.

## Known blockers / non-claims

- Node 22.15.0 remains installed; Node 24.19.x and repository dependencies are
  still required before Node verification can be considered complete.
- Real non-production MongoDB and Supabase Storage verification passed,
  including bucket resolution, large-PDF upload/retrieval/checksum, immutable
  duplicate handling, Mongo object references, local-artifact deletion and
  remote-only reprocessing, missing/unavailable behavior, and the
  `RAW_PERSIST_FAILED` no-dangling-snapshot invariant. No credential, endpoint,
  object path, or response body is recorded here.
- The migration is intentionally strictly additive and has not been applied to
  any database. Live-schema enumeration was not performed because this phase
  must not connect to production infrastructure.
- `dual` mode is a temporary migration mode. Its exit requires real
  Mongo/object-store integration tests, remote retention monitoring, and an
  approved production cutover; it is not a new permanent source of truth.
