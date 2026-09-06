# Phase 3B — acquisition-platform shadow implementation

Status: `SLICE B — PASS` after independent OpenCode review and Codex triage.
This document records the measured implementation boundary; it is not
authorization for Slice C or D work.

## Delivered boundary

- `AcquisitionIntent`, `SourceCandidate`, and `AcquisitionAttempt` have stable
  deterministic identifiers, JSON-safe serialization, and explicit
  pre-assertion failures.
- `AcquisitionPlanner` maps field needs to ordered source classes. It performs
  no fetch, crawl, extraction, validation, or promotion.
- `SourceRegistry` provides deterministic adapter order. `SourceResolver`
  evaluates independent authority, relationship, temporal, relevance, and
  applicability factors and records admission decisions.
- Existing `CatalogueDiscovery` remains the implementation of official native,
  sitemap, manual, and Coursedog discovery. `AcquisitionPlatformBackend` wraps
  it only in `platform_shadow` mode; `legacy` remains the default.
- Structured IPEDS/College Scorecard metadata, manual URLs, PDFs, JSON APIs,
  search candidates, archive candidates, Scrapy link-graph capability, and
  Crawl4AI render capability have common candidate representations. Search
  emits candidates only; archive sources are always `HISTORICAL/ARCHIVE`.
- Related-party fetch admission requires an explicit per-institution
  `external_source_rules` entry, exact adapter/authority/relationship match,
  and relationship evidence. The existing safe fetcher still enforces URL/SSRF,
  redirect, throttling, and content-size limits; robots checks can receive only
  the resolver-approved domain set.
- Raw persistence still precedes accepted parsing in the established pipeline.
  The fixture flow demonstrates admitted related candidate → safe fetch →
  remote `RawEvidenceStore`; it does not perform a live fetch.

## Staging migrations

`supabase-crawl-source-resolution-v3.sql` is additive and assumes the earlier
unapplied `supabase-crawl-acquisition-v3.sql`. It stores resolution decisions
and concise discovery evidence joined to a run/candidate. It has no raw payload
columns, no promotion logic, and no canonical-table change. Live schema and
migration application were not performed in this Slice.

## Verification

Measured locally on 2026-08-29:

```text
PYTHONPATH=src python -m pytest                         254 passed
python -m compileall -q src                              passed
git diff --check                                        passed
```

No Node checks were run: the workspace retains Node 22.15.0 while the project
requires a Node 24.19.x baseline. No live crawl, production database, or
external source request was run.

## Deliberately excluded

Coverage/missing-state policy, recovery planning, inference, source conflict
resolution, programme/university identity migration, promotion-v3, read-model
changes, legacy parser cutover, scholarship migration, and target-country mass
crawls remain outside this Slice.

## Review-fix pass

The Slice B follow-up makes platform_shadow observationally safe: it always
returns the exact legacy programme-candidate list, including URL spelling and
tracking query details, while separately recording resolution. The bounded
acquire_intent path now runs planner, registry, and resolver; reuses a fresh
cycle-compatible remote raw snapshot before network fetch; and requires remote
durability for an accepted fetch. Source graph artifacts are generated through
the shared serializers and the importer conditionally imports them in FK order
only when the two additive migrations are available. Otherwise its result
explicitly reports crawl_acquisition_v3_available=0 and leaves local lineage
artifacts intact. External-domain grants are exact-rule scoped, final URLs are
checked against the admitted domain set, and a minimum authority is enforced
before score admission.

## Final review follow-up

`crawl_source_candidates.source_identity` is deliberately nullable `text`, not
UUID: structured-provider resource identities are opaque strings. A fake
Supabase REST-client contract test now proves that, when the additive v3 tables
are available, source-graph rows are inserted in foreign-key order; when they
are absent, the importer completes its v2 import and reports
`crawl_acquisition_v3_available=0`. Neither path sends raw bodies to Supabase.

## Review disposition

OpenCode final review and targeted re-review report P0/P1 PASS. The retry
attempt identity enhancement (separating operation idempotency from retry
ordinal) is accepted as a production-hardening follow-up; current stable IDs
remain intentionally idempotent. The provider source-identity type mismatch
was fixed by using nullable opaque `text`, and the optional-v3 importer now has
fake-client contract coverage for FK ordering and unavailable-table fallback.
