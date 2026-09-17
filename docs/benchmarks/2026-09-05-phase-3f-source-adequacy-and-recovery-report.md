# Phase 3F source adequacy and field-directed recovery report

Status: diagnostic remediation only. Official benchmark #4 was not run.

## 1. Scope and integrity

The audit used the sealed output from `phase3f-v2-run-20260905T030109Z` and
read frozen truth only after that output was sealed. Expected values were not
passed to discovery, fetching, parsing, extraction, identity, coverage,
quality, promotion, or projection.

Frozen inputs were unchanged:

| Artifact | SHA-256 |
| --- | --- |
| `docs/benchmarks/2026-09-01-phase-3f-ground-truth-v2-frozen.jsonl` | `97308474e88eecc8165a94aae4a9bcfe104ec8da6807efdd0a2ad8de74e8e0d4` |
| `docs/benchmarks/2026-08-30-phase-3f-roster-v2.md` | `7518c63696e7a29ef3d4f3584b2338995d86e5d06d478d192d28562926394139` |
| `docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.md` | `47c2b2446dbd0ba2e9ebdd955ba972999ed76de4c7e8f188edea9f43ba837e91` |
| `docs/benchmarks/2026-09-01-phase-3f-scorer-contract-v1.json` | `720bc47dde66fce4ceb740cf766e28433bc5553b1882ca87da06e861ae890d99` |

Official sealed output hashes remained unchanged:

| Run | Pipeline-output SHA-256 |
| --- | --- |
| `phase3f-v2-run-20260901T120410Z` | `d966c5fbb2a82df2bd462a029bd141352f9c97d629f505d5b0645f615e161fbc` |
| `phase3f-v2-run-20260903T065023Z` | `d3042a5e6ba84b44bc94d90a02170a9c47eb45bbb2562b388d85a43c8e4fb8df` |
| `phase3f-v2-run-20260905T030109Z` | `ed6d1ff3e916a38d3977e1fa9b91742734b881bec8777ab7ad992f39af1a90a8c` |

The current derived audit matrix hash is
`15544db9e10a29e4342090a2c288c8dba2d7b5b7dcad25a220b106772386a891`.

## 2. Resolved-case population

The audit covers 122 confirmed primary resolved cases: 118 `FOUND` truth
cases and 4 `NOT_REQUIRED` truth cases. The six reviewed-ambiguous cases were
not included. The matrix is:

`docs/benchmarks/runs/phase3f-v2-run-20260905T030109Z/run3-field-evidence-audit.jsonl`

The companion audit is:

`docs/benchmarks/2026-09-05-phase-3f-source-adequacy-audit.md`

## 3. Field evidence availability

`FIELD_EVIDENCE_DISCOVERY_RECALL` is reported conservatively as direct,
field-supporting evidence fetched divided by 122. Fetched field-relevant
material is shown separately because it still needs semantic verification.

| Field | Cases | Direct support fetched | Material fetched | Ambiguous | Upstream | Downstream |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `programme_identity` | 34 | 25 | 30 | 5 | 9 | 25 |
| `credential` | 30 | 25 | 26 | 1 | 5 | 25 |
| `programme_status` | 0 | 0 | 0 | 0 | 0 | 0 |
| `tuition` | 11 | 6 | 10 | 4 | 1 | 10 |
| `application_deadline` | 4 | 1 | 4 | 3 | 0 | 4 |
| `english_requirement` | 24 | 13 | 17 | 4 | 11 | 13 |
| `major_admissions_requirement` | 19 | 13 | 17 | 4 | 2 | 17 |
| **Total** | **122** | **83** | **104** | **21** | **28** | **94** |

Therefore:

- Confirmed field-supporting evidence fetched: **83/122 = 68.03%**.
- Field-relevant material fetched, including ambiguous material: **104/122 = 85.25%**.
- Supporting material absent or blocked: **18**.
- No confirmed resolved `programme_status` cases exist in the frozen primary population; this is not a missing audit row.

Source-family distribution for the 104 material-fetched cases:

| Source family | Cases |
| --- | ---: |
| `PROGRAMME_SPECIFIC_OFFICIAL` | 71 |
| `CENTRAL_OR_SPECIALIST_OFFICIAL` | 28 |
| `OFFICIAL_OTHER` | 4 |
| `OFFICIAL_PDF` | 1 |
| `RELATED_AUTHORITATIVE` | 0 |
| `HISTORICAL_OFFICIAL` | 0 |

All direct evidence decisions are conservative automated triage. Official
authority alone is not treated as field evidence.

## 4. Per-institution evidence recall

The first recall column counts direct support; material recall includes
ambiguous field-relevant material.

| Institution | Cases | Direct | Direct recall | Material | Material recall | Upstream |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Cornell | 14 | 10 | 71.43% | 12 | 85.71% | 3 |
| Duke | 11 | 7 | 63.64% | 11 | 100.00% | 4 |
| ETH Zurich | 12 | 12 | 100.00% | 12 | 100.00% | 0 |
| Harvard | 10 | 8 | 80.00% | 9 | 90.00% | 2 |
| MIT | 10 | 6 | 60.00% | 10 | 100.00% | 0 |
| Northwestern | 9 | 6 | 66.67% | 9 | 100.00% | 1 |
| Princeton | 9 | 2 | 22.22% | 2 | 22.22% | 7 |
| Sorbonne Universite | 8 | 5 | 62.50% | 8 | 100.00% | 1 |
| UCLA | 10 | 9 | 90.00% | 10 | 100.00% | 1 |
| University of Michigan | 10 | 2 | 20.00% | 3 | 30.00% | 7 |
| University of Tokyo | 12 | 11 | 91.67% | 11 | 91.67% | 1 |
| Universite de Montreal | 7 | 5 | 71.43% | 7 | 100.00% | 1 |

Princeton and Michigan are the clearest upstream source-adequacy risks.
Harvard and Tokyo have blocked or insufficient cases, but most of their
resolved-case material was fetched.

## 5. Upstream versus downstream diagnosis

| Bucket | Cases | Share |
| --- | ---: | ---: |
| `UPSTREAM_EVIDENCE_GAP` | 28 | 22.95% |
| `DOWNSTREAM_PROCESSING_GAP` | 94 | 77.05% |

Upstream subcategories:

| Subcategory | Cases | Meaning |
| --- | ---: | --- |
| Expected/related supporting source not fetched | 14 | No supporting document was present in fetched material. |
| Fetched field context but support not proven | 6 | A relevant official page was fetched, but the field relationship was not established. |
| Source access blocked or fetch failed | 4 | The candidate could not become evidence because access failed or robots blocked it. |
| Fetched candidate source insufficient for field | 4 | The page was fetched but belongs to the wrong/insufficient field scope. |

Downstream subcategories:

| Subcategory | Cases | Meaning |
| --- | ---: | --- |
| Supported evidence fetched but not resolved/projected | 83 | Raw/evidence signals support the field, but the runtime result remained unresolved. |
| Fetched field context requires downstream semantic processing | 11 | Applicability, scope, temporal or field semantics still need processing. |

The diagnostic classification is **ACCEPTANCE_DOMINANT**: 94 downstream cases
versus 28 upstream cases, with most direct support already fetched. The next
major remediation should therefore focus on extraction/selection/acceptance
and projection, while keeping a bounded recovery path for the 28 upstream
cases.

## 6. Why required-source discovery was 100%

The existing `required_source_discovery_recall` measures routed programme and
source-bundle discovery/admission. It does not prove that a fetched source
contains the field-specific fact. This audit adds field-level support
classification without changing the frozen scorer contract.

The current run contains programme-specific, central/specialist and PDF
material, but no admitted related-authority or search-index evidence. The
search adapter in the repository is fixture-oriented; search snippets were
not used as facts.

## 7. Field adequacy findings

- Tuition is usually present in fetched material (10/11 material), but scope
  still needs downstream separation of tuition, fees, budgets and residency.
- Deadline evidence was field-relevant in all four cases, but only one case
  had a direct support signal. Deadline type, programme scope and cycle remain
  the dominant acceptance checks.
- English evidence is mixed: 13 direct, 4 ambiguous, and 11 upstream. Central
  language policy must not be inherited without a proven programme/audience
  relationship.
- Major-admissions evidence is mostly present (17/19 material), but curriculum,
  application-component, placement and post-admission statements require
  downstream semantic separation.
- Identity and credential evidence is present for most cases, but Princeton and
  Michigan have missing/blocked source paths that need generic acquisition
  recovery.
- No primary resolved programme-status cases are available for this audit.

Historical applicable evidence was not identified as a separate positive
class. Historical material remains admissible for diagnosis only when its
temporal relation is proven; it was not promoted as current evidence.

## 8. Generic field-directed recovery change

The pipeline's bounded link-recovery map was extended so unresolved fields can
select appropriate official link categories without using truth or roster
answers:

- identity, credential and status: programme-detail/catalogue links;
- major admissions: admissions and curriculum links;
- application deadline: deadline, programme-admissions and international links;
- English: English-requirement, international-admissions and programme-admissions links.

Tuition and the existing curriculum/admissions categories were retained. The
change is generic, source-only, and does not alter acceptance, Product Safety,
scoring or truth.

The diagnostic runner gained `--field-directed-recovery`, guarded so it can
only run with `--rows`. It remains roster-bound (`manual_only=True`) so native
catalogue traversal cannot replace selected diagnostic programmes with
unrelated catalogue candidates. A first attempted recovery run,
`phase3f-source-recovery-9prog-20260905T071849Z`, was preserved as
`INVALID_DIAGNOSTIC_COMPOSITION` because it selected non-roster catalogue
candidates; it produced no sealed output and was not scored. The corrected
smoke used a new run ID.

No benchmark case IDs, expected values, or truth-derived runtime branches were
added.

## 9. Corrected targeted recovery smoke

Run:

`phase3f-source-recovery-9prog-20260905T072353Z`

Selected roster rows: `4, 7, 8, 10, 16, 18, 26, 35, 36`.

| Metric | Result |
| --- | ---: |
| Programmes attempted/terminal | 9/9 |
| Programme candidates discovered | 9 |
| Sources fetched | 73 (69 HTML, 4 PDF) |
| Assertions total | 393 |
| Raw non-null assertions | 146 |
| Effective assertions | 216 |
| Effective non-null assertions | 117 |
| Projected `FOUND` | 0 |
| Projected `NEEDS_REVIEW` | 42 |
| Projected `ACCESS_BLOCKED` | 20 |
| Projected `EXTRACTION_FAILED` | 1 |
| `NOT_EVALUATED` | 0 |
| `PARSE_FAILED` | 0 |
| `PRODUCT_SAFE` | 0 |

Recovery telemetry:

- 5 programmes entered field-coverage retry.
- 3 field-coverage retry sources were fetched across 10 completed retry groups.
- Runtime acquisition registry intents/candidates/admissions were 0 because
  the benchmark-compatible pipeline path keeps the platform acquisition layer
  shadow-only.
- The 3 retry URLs were already present in the official run #3 source graph;
  no new canonical URL or new supporting evidence was proven.
- DeepSeek metrics: 56 calls, 58 logical requests, 53 successful calls, 3
  failed groups, 0 retries, 0 HTTP 429, 481,866 prompt tokens and 48,497
  completion tokens. Cost was unavailable.

The smoke therefore validates that bounded field-category link recovery runs
without changing truth isolation, but it does not yet demonstrate new source
family discovery or additional runtime FOUND coverage. Recovery success
criteria are **not met**.

The sealed smoke output is:

`docs/benchmarks/remediation-smokes/phase3f-source-recovery-9prog-20260905T072353Z/pipeline-output.json`

SHA-256:

`4e11ffbe5ec197b354160ade7168cf031cf6d530e598612bbf1e6f439e6b389e`

Manifest:

`docs/benchmarks/remediation-smokes/phase3f-source-recovery-9prog-20260905T072353Z/run-manifest.json`

Summary:

`docs/benchmarks/remediation-smokes/phase3f-source-recovery-9prog-20260905T072353Z/recovery-smoke-summary.json`

## 10. Tests and validation

- Field-directed recovery, acquisition, source-adapter and remediation tests:
  **36 passed**.
- Full data-ingestion test discovery with the correct service-root
  `PYTHONPATH`: **335 passed**.
- Unchanged benchmark scorer tests: **13 passed**.
- `compileall` for ingestion source and scripts: **PASS**.
- JSON/JSONL validation: **PASS** for frozen inputs, sealed run manifests,
  pipeline output and the 122-row evidence matrix.
- Frozen input and official run #1/#2/#3 output hashes: **PASS**.
- Secret scan: **PASS**; no API key or bearer token was written to artifacts
  or diagnostics.
- `git diff --check`: **PASS**.

The first full-test invocation from repository root had one import error
because `test_core.py` requires `services/data-ingestion` itself on
`PYTHONPATH`; the corrected invocation above passed all 335 tests.

## 11. Remaining blockers

1. The dominant blocker is downstream acceptance/selection/projection: direct
   field support exists for 83 cases but is not becoming usable runtime values.
2. Princeton and Michigan still need generic source-family recovery for their
   missing or blocked field evidence.
3. Field-directed recovery currently reuses the existing link graph; external
   search and related-authority adapters are not wired into this benchmark
   path, so no new canonical source was proven.
4. The smoke still has 20 access-blocked projected fields and one extraction
   failure; these are operational evidence, not safe semantic passes.

## 12. Gate classification

- Field evidence audit: **PASS** (122 cases classified; official sealed output untouched).
- Generic recovery implementation: **PASS** (bounded category mapping and roster-bound smoke guard).
- Recovery smoke success: **BLOCKED** (no new supporting evidence and no projected `FOUND`).
- **FULL BENCHMARK RUN #4: BLOCKED**.
- Official benchmark #4: **NOT RUN**.
- Slice F: **NO-GO**.

No official benchmark, scorer-methodology change, truth change, later Slice F
gate, failure matrix, schema/RLS gate, regression suite, or rollout was run.
