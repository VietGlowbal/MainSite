# Data-platform Phase 3C — coverage, recovery, conflicts, and inference

Status: **Slice C PASS** (shadow-mode, fixture-backed, policy-initial; migration
unapplied and no production promotion cutover).

## Delivered

- `quality_models.py` defines independent availability, applicability,
  verification, temporal, epistemic, authority, volatility, criticality, and
  conflict dimensions plus `CoverageAssessment` and observability metrics.
- `field_policy.py` provides a versioned declarative registry for field groups,
  criticality, volatility, freshness, authorities, terminal states, recovery,
  and inference eligibility.
- `CoverageEngine` evaluates semantic states from effective assertions and
  acquisition failures. Explicit NOT_PUBLISHED and NOT_REQUIRED require
  evidence/policy proof; failed discovery remains SOURCE_NOT_FOUND.
- `RecoveryPlanner` emits only Slice B `AcquisitionIntent` objects. It has no
  fetcher/network dependency, uses source-class frontiers and fingerprints, and
  bounds rounds, attempts, and source diversity. Retained fresh raw evidence is
  reusable by metadata reference.
- `conflicts.py` performs applicability-aware conflict identity and deterministic
  precedence using scope, audience, cycle, temporal state, authority,
  relationship, and verification; unresolved ties remain review cases.
- `InferenceEngine` is isolated and explicit. Historical recurrence carries
  supporting assertion/raw-document IDs, method/version, confidence, horizon,
  volatility, and verification-required advisory semantics. Reconciliation can
  confirm, contradict, supersede, or invalidate estimates.
- `supabase-evidence-quality-v3.sql` is additive and unapplied. It stores
  policy, coverage, conflict, inference, and lineage metadata only; raw bodies
  remain in Slice A remote evidence storage.
- `SmokePipeline` invokes the quality facade after effective assertions are
  assembled and writes shadow-only coverage, conflict, recovery, inference,
  and summary streams. The hook is metadata-only and does not change product
  records or promotion.

## Required fixture coverage

`tests/test_quality_slice_c.py` covers tuition intent composition, failure
states, absence-proof safety, stale history, applicability-aware conflicts,
policy versioning, recurrence inference and reconciliation, raw evidence reuse,
and idempotent recovery. The tuition fixture proves:

```text
SOURCE_NOT_FOUND → programme_finance AcquisitionIntent → Slice B boundary
→ recovered assertion → FOUND / acceptable
```

## Verification

Measured on 2026-08-29 from `services/data-ingestion`:

```text
$env:PYTHONPATH='src'; python -m pytest
264 passed in 7.05s
$env:PYTHONPATH='src'; python -m compileall -q src
pass
git diff --check
pass
```

OpenCode independent review: P0 PASS, P1 PASS. Three P2 observations were
triaged: the duplicate applicability enum was accepted and fixed; an unrelated
provider-startup behavior concern was rejected as outside Slice C; cross-run
inference persistence deduplication was deferred because explicit reconciliation
is present and durable read orchestration is outside this shadow layer. OpenCode
targeted re-review verified the accepted fix and reported no remaining P0/P1/P2
finding. No Terra/Sol escalation was required.

## Scope guard

No programme identity migration, promotion-v3 cutover, canonical read-model
cutover, legacy parser migration, direct-write shutdown, scholarship canonical
migration, or live application of the new migration was performed.
