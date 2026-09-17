# Bounded multi-source population topology experiment

Run: `multi-source-population-topology-20260910-77c4194a`

This report covers bounded acquisition/topology only. No LLM, assertion, estimator, promotion, or canonical-truth operation was run.

## A. Repo inspection

Reused `SmokePipeline`, `SourceEcosystemConfig`, provider catalogue/registry, `external_source_expansion` planner, SafeFetcher policy checks, remote raw evidence, and structured staging. The prior university-only topology runner was not modified.

## B. Population

13 institutions across 8 countries and 4 regions were frozen before acquisition. See `population-manifest.json` for the fixed selection and provider assignments.

## C. Source coverage

| Source class | Attempted | Success/raw yield | No-yield | Runtime/credential |
| --- | ---: | ---: | ---: | ---: |
| accreditation | 7 | 6 | 0 | 1 |
| archive | 1 | 0 | 1 | 0 |
| external_authoritative | 5 | 5 | 0 | 0 |
| government_dataset | 14 | 8 | 4 | 2 |
| official_partner | 2 | 2 | 0 | 0 |
| official_registry | 5 | 3 | 1 | 0 |
| official_web | 13 | 12 | 0 | 1 |
| search_discovery | 3 | 2 | 1 | 0 |

Source classes with raw yield: accreditation, external_authoritative, government_dataset, official_partner, official_registry, official_web, search_discovery.

## D. Topology findings

Topology levels observed: {"E0": 9, "E2": 11, "E4": 28}; missing levels: E1, E3. Independent non-E0 edges: 39. Institutions with at least two yielding source classes: 10.

Applicable official programme/homepage paths are kept separate from external paths. External raw resources are recorded as E4 availability and are not treated as tuition truth or predictive donors.

## E. Metrics

Provider yield: `{"abet": 3, "college_scorecard_bulk": 1, "common_app": 2, "cricos_australia": 1, "crossref": 2, "data_europa_eu": 2, "eqar": 2, "eqar_accreditation": 2, "eurostat_education": 3, "jabee": 1, "japan_estat": 1, "official_web": 20, "openalex": 3, "unesco_uis": 1, "usdoe_affordability": 4}`. Top-provider edge share: 41.67%. HTTP requests: 143; retrieved bytes recorded by telemetry: 9177243. Checkpoint yield is in `yield-checkpoints.jsonl`; stratum summaries are in `coverage-summary.json`.

## F. Failures

Provider-level statuses and failure codes are in `provider-attempts.jsonl` and `provider-status.json`. Credential, upstream/runtime, no-yield, and code/config classifications are preserved without converting expected access restrictions into code bugs.

Run status counts: `{"NOT_APPLICABLE": 1, "NO_YIELD": 7, "RUNTIME_BLOCKED": 4, "SUCCESS": 38}`. `NOT_APPLICABLE` providers were retained in the ledger without consuming acquisition requests.

## G. Safety/invariant checks

Search snippet factual assertions: 0. Archive current-truth promotion: 0. Heavy local raw files: 0. `max_local_temp_bytes`: 0. LLM/provider extraction calls: 0/0.

## H. Tests

Focused deterministic ingestion suites (source ecosystem, external acquisition, heavy raw streaming, raw evidence, and source adapters) passed 89/89. The experiment uses the existing deterministic serialization and aggregation code path.

## I. Artifacts

* `population-manifest.json` — frozen population and assignments
* `provider-status.json` / `provider-attempts.jsonl` — bounded acquisition ledger
* `topology-edges.jsonl` / `topology-matrix.json` — source topology edges and matrix with provenance
* `yield-checkpoints.jsonl` — cumulative acquisition yield checkpoints
* `coverage-summary.json` — coverage, diversity, concentration, safety, and acceptance metrics
* `durable-staging-verification.json` — live check of the Scorecard row in `crawl_external_structured_rows`
* `report.md` — this report

## J. Decision

A — TOPOLOGY SUFFICIENT FOR NEXT PHASE
