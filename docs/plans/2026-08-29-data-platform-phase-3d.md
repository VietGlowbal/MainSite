# Data-platform Phase 3D — identity, quality-gated promotion, and product reads

Status: **Slice D PASS** (shadow-mode, fixture-backed, policy-initial;
migration unapplied and production cutover deferred).

## Delivered

- `identity.py` provides conservative programme and university identity
  resolution. Official/institution/national/accreditor identifiers, curator
  mappings, corroborated official evidence, verified domains, aliases,
  cycle/offering versions, joint-programme institution roles, relationship
  events, and immutable decision records are represented explicitly. URL,
  slug, title similarity, and translation similarity alone never auto-merge.
- `product_safety.py` provides a versioned `ProductSafetyContract` and
  lifecycle states (`DISCOVERED`, `PARTIAL`, `REVIEWABLE`, `PRODUCT_SAFE`,
  `REJECTED`, `RETIRED`). Critical field gates require acceptable Slice C
  assessments, current applicable authority/verification, durable lineage,
  and no unresolved identity, conflict, review, stale, or prohibited inferred
  truth.
- `promotion_v3.py` is a shadow promotion boundary. It evaluates dry-runs,
  emits machine-readable blockers and projection diffs, uses stable
  run-independent fingerprints, applies idempotently, preserves projection
  history, and records immutable attempts, policy versions, prior/new values,
  and changed fields. It does not fetch and does not replace legacy
  `promote_crawl_run`.
- `product_read.py` exposes verified-current values separately from partial,
  reviewable, historical, and advisory-inferred values. High-volatility
  inference cannot become verified current product truth.
- `supabase-identity-promotion-v3.sql` is additive and unapplied. It adds
  identity registries, aliases/offerings/relationships, decision and quality
  metadata, promotion audits/history, canonical identity linkage, and
  product-safe views without copying raw bodies or editing applied migrations.
- `test_identity_promotion_slice_d.py` covers identity fixtures, university
  safety, aliases and URL changes, joint programmes, lifecycle/product safety,
  lineage, dry-run/idempotency/update/retirement, advisory reads, migration
  invariants, legacy compatibility, and differential reporting.

## Verification

Measured on 2026-08-29 from `services/data-ingestion`:

```text
$env:PYTHONPATH='src'; python -m pytest tests/test_identity_promotion_slice_d.py -q
16 passed in 0.09s
$env:PYTHONPATH='src'; python -m pytest
280 passed in 6.91s
$env:PYTHONPATH='src'; python -m compileall -q src
pass
git diff --check
pass
```

The required live database schema probe was unavailable because this
workspace has no `.env.local`; no Slice D migration was applied. Node
22.15.0 was left unchanged and Node 24.19.x verification remains deferred.

## Review and routing

Antigravity was assigned the high-risk implementation to a Sonnet worker, but
the provider returned a 402 insufficient-balance error before repository
effects. Luna performed the bounded fallback implementation while preserving
the same test and review gates; no Flash, Pro, or Opus implementation task was
needed. OpenCode performed an independent broad review and a targeted
read-only re-review of the six Slice D artifacts and test file. Both reported
P0/P1 PASS; the targeted review reported zero P0/P1/P2/P3 findings. The
orchestration runtime revoked the dispatch capability before those reports
could be acknowledged as lifecycle messages, but the completed terminal
reports were captured and read. The broad review's out-of-scope P2 findings
were rejected (Slice B/C boundaries) and its compatibility-timeline P3 was
deferred to later convergence work. No Terra/Sol escalation was required.

## Classification

- Production-ready: conservative identity decisions, explicit contract
  evaluation, bounded/idempotent in-memory promotion semantics, audit and
  read-model separation covered by tests.
- Shadow-mode: promotion-v3 and product-safe views; legacy promotion remains
  executable and canonical consumers are not cut over.
- Fixture-backed/policy-initial: identity benchmarks, safety thresholds,
  differential results, and field policy calibration; this is not
  production-calibrated.
- Deferred: live migration/schema verification, production rollout, legacy
  parser convergence, direct-write shutdown, full scholarship migration,
  Node 24.19.x verification, and Slice F benchmarking.

## Scope guard

No legacy parser cutover, direct-write shutdown, full scholarship canonical
migration, destructive canonical PK migration, production rollout, or
modification of the existing `promote_crawl_run` behavior was performed.
