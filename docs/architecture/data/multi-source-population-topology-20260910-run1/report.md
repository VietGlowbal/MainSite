# Bounded multi-source population topology experiment

Run: `multi-source-population-topology-20260910-3df3e02f`

This report covers bounded acquisition/topology only. No LLM, assertion, estimator, promotion, or canonical-truth operation was run.

## A. Repo inspection

Reused `SmokePipeline`, `SourceEcosystemConfig`, provider catalogue/registry, `external_source_expansion` planner, SafeFetcher policy checks, remote raw evidence, and structured staging. The prior university-only topology runner was not modified.

## B. Population

13 institutions across 8 countries and 4 regions were frozen before acquisition. See `population-manifest.json` for the fixed selection and provider assignments.

## C. Source coverage

| Source class | Attempted | Success/raw yield | No-yield | Runtime/credential |
| --- | ---: | ---: | ---: | ---: |
| accreditation | 7 | 0 | 7 | 0 |
| archive | 1 | 0 | 1 | 0 |
| external_authoritative | 5 | 0 | 5 | 0 |
| government_dataset | 14 | 0 | 14 | 0 |
| official_partner | 2 | 0 | 2 | 0 |
| official_registry | 5 | 0 | 5 | 0 |
| official_web | 13 | 12 | 0 | 0 |
| search_discovery | 3 | 0 | 3 | 0 |

Source classes with raw yield: official_web.

## D. Topology findings

Topology levels observed: {"E0": 9, "E2": 11}. Independent non-E0 edges: 11. Institutions with at least two yielding source classes: 0.

Applicable official programme/homepage paths are kept separate from external paths. External raw resources are recorded as E4 availability and are not treated as tuition truth or predictive donors.

## E. Metrics

Provider yield: `{"official_web": 20}`. Top-provider edge share: 100.00%. HTTP requests: 645; retrieved bytes recorded by telemetry: 41677147.

## F. Failures

Provider-level statuses and failure codes are in `provider-attempts.jsonl` and `provider-status.json`. Credential, upstream/runtime, no-yield, and code/config classifications are preserved without converting expected access restrictions into code bugs.

## G. Safety/invariant checks

Search snippet factual assertions: 0. Archive current-truth promotion: 0. Heavy local raw files: 0. `max_local_temp_bytes`: 0. LLM/provider extraction calls: 0/0.

## H. Tests

The focused deterministic ingestion suites were run separately and their exact result is recorded in the final task response. The experiment itself uses the existing deterministic serialization and aggregation code path.

## I. Artifacts

* `population-manifest.json` — frozen population and assignments
* `provider-status.json` / `provider-attempts.jsonl` — bounded acquisition ledger
* `topology-edges.jsonl` — source topology edges with provenance
* `coverage-summary.json` — coverage, diversity, concentration, safety, and acceptance metrics
* `report.md` — this report

## J. Decision

C — TOPOLOGY INSUFFICIENT; ACQUISITION ECOSYSTEM REQUIRES FURTHER WORK
