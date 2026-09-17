# Eurostat external-source configuration fix — 2026-09-10

The bounded live audit identified one Eurostat `government_dataset` failure:
the provider catalogue configured an `offset` paginator with
`offset_parameter: startPeriod`. The generic paginator correctly translated
that contract into `startPeriod=0&limit=100`, but Eurostat treats
`startPeriod` as a period dimension and does not accept this offset/limit
request shape. The endpoint itself was healthy when queried with a valid
country filter.

## Scope and fix

The generic pagination implementation was left unchanged. Its bounded page,
offset, cursor, and no-pagination behavior remains covered by the existing
adapter tests. The Eurostat catalogue entry was changed only at the provider
configuration layer:

- removed the invalid offset pagination block;
- added `format=JSON` to the existing `lang=en` parameters;
- mapped the seed `country_code` to Eurostat's `geo` parameter so each request
  is a bounded country slice.

The resulting candidate for a German seed is:

`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/educ_uoe_enrt01?lang=en&format=JSON&geo=DE`

No other provider, adapter, admission rule, raw-storage path, staging schema,
exact-evidence behavior, benchmark, inference, estimator, or promotion logic
was changed.

## Deterministic verification

The focused external/acquisition/raw/staging regression set passed **70/70**:

```text
python -m pytest \
  services/data-ingestion/tests/test_external_acquisition.py \
  services/data-ingestion/tests/test_source_ecosystem.py \
  services/data-ingestion/tests/test_source_adapters.py \
  services/data-ingestion/tests/test_acquisition.py \
  services/data-ingestion/tests/test_raw_evidence.py \
  services/data-ingestion/tests/test_supabase_storage.py -q
```

The new regression assertion verifies that Eurostat emits `geo`, `format`,
and `lang` and never emits `startPeriod` or `limit`. Existing generic
pagination tests remain in the same run.

## Bounded live result

Run directory:
`docs/architecture/data/eurostat-fix-live-20260910/`

| Check | Result |
|---|---|
| Provider | `eurostat_education` |
| Source class | `government_dataset` |
| Requests | 3 (two robots checks plus one dataset request) |
| Dataset request | HTTP 200 |
| Resource | JSON, 110,098 payload bytes |
| Acquisition statuses | `DISCOVERED → ADMITTED → RAW_PERSISTED` |
| LLM/provider extraction calls | 0 |

The raw payload was retained at:
`raw/json/bab3e4b862a3039432d2603414d6e1645b885c1b7544a989da451cbcd913ef4c.json.gz`.

The persisted `sources.jsonl` and `source_ecosystem_fetches.jsonl` rows carry:

```text
source_class        = government_dataset
source_authority    = GOVERNMENT
source_relationship = GOVERNMENT
provider_id         = eurostat_education
dataset_id          = educ_uoe_enrt01
academic_cycle      = 2023
content_type        = application/json
http_status         = 200
content_hash        = 81222b2deb85cdbd33a748e42288ba4f723a6f6ac0adef16d55ab3b14f350b88
raw_document_id     = 08cfe55e-1a8d-4afa-805c-498d9387d6bc
```

This check used the existing local raw/staging boundary and did not write to
Supabase. The source row and acquisition artifact preserve the same
provenance fields that a later staging/import run consumes.

## Result

The defect was provider configuration, not a generic pagination bug. The
corrected Eurostat provider is operational for a bounded live acquisition.

A — EUROSTAT FIXED
