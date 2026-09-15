# Stage 1 external mass-ingestion report

Run: `stage1-20260915-main` (real network, Mongo/object storage, remote raw mode; promotion disabled).
This report is generated from the immutable run artifacts; no provider or downstream semantics were changed after ingestion.

## A. Frozen Stage 1 manifest

- Manifest: `C:\Users\ADMIN\orca\workspaces\MainSite\data-platform\docs\architecture\data\external-field-stage1-20260915\stage1-population-manifest.json`
- SHA-256: `2607bb4ae5218770f903a657443734751d93a53acb572edadc6542f0b8006277`
- Population: **209 institutions / 418 programmes / 7 countries**
- Countries: `CH, FI, FR, NL, SE, UK, US`
- Institutions by country: `{"CH": 12, "FI": 3, "FR": 48, "NL": 28, "SE": 3, "UK": 33, "US": 82}`
- Programmes by country: `{"CH": 24, "FI": 6, "FR": 96, "NL": 56, "SE": 6, "UK": 66, "US": 164}`
- Degree levels: `{"bachelor": 251, "master": 167}`
- Disciplines: `{"business": 27, "computer science": 131, "data science": 17, "engineering": 103, "other": 140}`

The manifest was frozen before execution and was not edited to remove difficult targets.

## B. Execution summary

- Started: `2026-09-15T08:05:33+00:00`; completed: `2026-09-15T10:11:29+00:00`.
- Checkpoints: `{'COMPLETED': 209}`; 209 completed, 0 PARTIAL, 0 terminal failures.
- Programmes discovered: **418**.
- Deep extraction: `410` attempted / `355` extracted.
- Accepted external semantic assertions: **1187** ({"department": 9, "institution": 146, "programme": 1032}); promoted deterministic metadata rows: **478**.
- Run classification: **A2 - STAGE 1 HEALTHY WITH NON-BLOCKING TARGET/PROVIDER GAPS**; systemic failures: `0`; integrity gate: `PASS`.

## C. Provider execution

The adapter slot denominator includes only admitted provider candidates. Onisep source rows do not carry the runner's linked programme ID, so its target-attempt column is intentionally reported as `0` by the frozen analyzer; the authoritative Onisep materialisation result is shown as matched rows `95/144`.

| provider | country/scope | eligible | attempted | exact target match | raw persisted | materialised docs | materialisation rows | proposals | accepted | review | errors | HTTP failures |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| college_scorecard_bulk | US / institution | 82 | 82 | 82 | 82 | 82 | 82/82 | 221 | 122 | 99 | 0 (-) | 0 |
| swissuniversities_tuition | CH / institution | 12 | 12 | 12 | 12 | 12 | 12/12 | 26 | 24 | 2 | 8 ({'PERMANENT_PROVIDER_ERROR': 8}) | 0 |
| onisep_higher_ed | FR / programme | 96 | 0 | 0 | 144 | 95 | 95/144 | 501 | 494 | 7 | 1 ({'NO_EXTERNAL_FIELD_SOURCE': 1}) | 0 |
| discover_uni_hesa | UK / programme | 66 | 58 | 58 | 58 | 57 | 57/58 | 490 | 448 | 42 | 6 ({'NO_EXTERNAL_FIELD_SOURCE': 1, 'PERMANENT_PROVIDER_ERROR': 5}) | 0 |
| duo_rio_ho | NL / programme | 56 | 16 | 16 | 16 | 16 | 16/16 | 46 | 45 | 1 | 40 ({'NO_EXTERNAL_FIELD_SOURCE': 40}) | 0 |
| susa_navet_event | SE / programme | 6 | 6 | 6 | 6 | 6 | 6/6 | 13 | 13 | 0 | 0 (-) | 0 |
| susa_navet_info | SE / programme | 6 | 6 | 6 | 6 | 6 | 6/6 | 23 | 22 | 1 | 0 (-) | 0 |
| studyinfo_hakukohde | FI / programme | 6 | 6 | 6 | 6 | 6 | 6/6 | 8 | 8 | 0 | 0 (-) | 0 |
| studyinfo_toteutus | FI / programme | 6 | 6 | 6 | 6 | 6 | 6/6 | 0 | 0 | 0 | 0 (-) | 0 |
| studyinfo_valintaperuste | FI / programme | 6 | 6 | 6 | 6 | 6 | 6/6 | 18 | 11 | 7 | 0 (-) | 0 |

Persisted raw objects by adapter sum to **342**; all 342 source-ecosystem fetches ended `RAW_PERSISTED`. Onisep contributed 144 persisted records (95 matched, 49 unmatched structured rows). Discover Uni contributed 58 source routes (57 materialisation rows; one identity-not-found document).
The prior canary's 94/98 (95.92%) slot rate is not a like-for-like denominator: Stage 1 includes the 49 explicit Onisep no-match rows and the one Discover identity-not-found row. Stage 1 therefore reports 292/342 materialisation rows matched (85.38%) while durable fetch persistence itself is 342/342 (100%).

## D. Country coverage

`Any-field programme/institution targets` counts a target with at least one accepted external field; it is not a claim that every field is present. Top-covered-field values below are accepted evidence units, so a field can exceed the programme count when a target has multiple source-supported rows.

| country | institutions | programmes | eligible slots | attempted | exact matches | materialised rows | any-field programme targets | any-field institution targets | recorded errors | top covered fields | top missing fields |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| CH | 12 | 24 | 12 | 12 | 12 | 12 | 0 | 8 | 8 | tuition=15, additional_fees=9 | academic_cycle, application_fee, application_url, career_outcomes |
| FI | 3 | 6 | 18 | 18 | 18 | 18 | 4 | 0 | 0 | standardized_tests=4, required_documents=3, curriculum_overview=2, intakes=2 | academic_cycle, additional_fees, application_fee, application_url |
| FR | 48 | 96 | 96 | 0 | 0 | 95 | 94 | 0 | 1 | curriculum_overview=168, duration=95, delivery_mode=95, location=95 | academic_cycle, additional_fees, application_fee, application_url |
| NL | 28 | 56 | 56 | 16 | 16 | 16 | 16 | 0 | 40 | programme_identity=16, credential=16, programme_focus=13, programme_language=9 | academic_cycle, additional_fees, application_fee, application_url |
| SE | 3 | 6 | 12 | 12 | 12 | 12 | 6 | 0 | 0 | curriculum_overview=7, programme_identity=6, final_deadline=6, programme_language=6 | academic_cycle, additional_fees, application_fee, application_url |
| UK | 33 | 66 | 66 | 58 | 58 | 57 | 51 | 0 | 6 | employment_outcomes=128, career_outcomes=119, delivery_mode=57, duration=57 | academic_cycle, additional_fees, application_fee, application_url |
| US | 82 | 164 | 82 | 82 | 82 | 82 | 0 | 60 | 0 | tuition=122 | academic_cycle, additional_fees, application_fee, application_url |

## E. External field coverage

Accepted/review/missing are target counts. Programme and institution denominators are kept separate; promoted metadata (duration, location, mode, language) is included where it passed deterministic validation.

| field | programme accepted | review | missing | coverage | institution accepted | review | missing | coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| programme_identity | 167/418 | 0 | 251 | 39.95% | 0/209 | 0 | 209 | 0.00% |
| credential | 158/418 | 0 | 260 | 37.80% | 0/209 | 0 | 209 | 0.00% |
| programme_status | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| academic_cycle | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| tuition | 5/418 | 98 | 315 | 1.20% | 68/209 | 0 | 141 | 32.54% |
| additional_fees | 0/418 | 0 | 418 | 0.00% | 8/209 | 0 | 201 | 3.83% |
| duration | 152/418 | 0 | 266 | 36.36% | 0/209 | 0 | 209 | 0.00% |
| location | 150/418 | 0 | 268 | 35.89% | 0/209 | 0 | 209 | 0.00% |
| delivery_mode | 161/418 | 0 | 257 | 38.52% | 0/209 | 0 | 209 | 0.00% |
| programme_language | 15/418 | 0 | 403 | 3.59% | 0/209 | 0 | 209 | 0.00% |
| career_outcomes | 27/418 | 0 | 391 | 6.46% | 0/209 | 0 | 209 | 0.00% |
| employment_outcomes | 21/418 | 8 | 389 | 5.02% | 0/209 | 0 | 209 | 0.00% |
| intakes | 7/418 | 0 | 411 | 1.67% | 0/209 | 0 | 209 | 0.00% |
| final_deadline | 6/418 | 0 | 412 | 1.44% | 0/209 | 0 | 209 | 0.00% |
| rolling_admission | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| minimum_degree | 1/418 | 3 | 414 | 0.24% | 0/209 | 0 | 209 | 0.00% |
| subject_prerequisites | 4/418 | 2 | 412 | 0.96% | 0/209 | 0 | 209 | 0.00% |
| required_documents | 3/418 | 0 | 415 | 0.72% | 0/209 | 0 | 209 | 0.00% |
| standardized_tests | 2/418 | 0 | 416 | 0.48% | 0/209 | 0 | 209 | 0.00% |
| work_experience | 2/418 | 0 | 416 | 0.48% | 0/209 | 0 | 209 | 0.00% |
| ielts_overall | 2/418 | 0 | 416 | 0.48% | 0/209 | 0 | 209 | 0.00% |
| ielts_subscores | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| toefl | 2/418 | 0 | 416 | 0.48% | 0/209 | 0 | 209 | 0.00% |
| duolingo | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| application_fee | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| priority_deadline | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| international_deadline | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| funding_deadline | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| minimum_gpa | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| gpa_scale | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| recommendation_letters | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| sop_essay_requirements | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| portfolio | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| scholarships | 2/418 | 2 | 414 | 0.48% | 0/209 | 0 | 209 | 0.00% |
| funding | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| funding_amount | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| funding_eligibility | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |
| application_url | 0/418 | 0 | 418 | 0.00% | 0/209 | 0 | 209 | 0.00% |

Notable accepted coverage: programme identity 167/418, credential 158/418, programme tuition 5/418 (98 additional review targets), institution tuition 68/209, institution additional fees 8/209, duration 152/418, location 150/418, delivery mode 161/418, programme language 15/418, career outcomes 27/418, employment outcomes 21/418 (8 review), intakes 7/418, final deadline 6/418, required documents 3/418, and standardized/IELTS/TOEFL evidence from the Finnish routes. Zero groups remain explicit in the table (for example application fee, priority/international/funding deadlines, rolling admission, minimum GPA, IELTS subscores, Duolingo, GPA scale, recommendation/SOP/portfolio, funding amounts/eligibility, and application URL).

## F. Hierarchy (unchanged H1-H4 evaluator)

| level | candidates | usable | applied |
|---|---:|---:|---:|
| Direct | 633 | 633 | 633 |
| H1 | 0 | 0 | 0 |
| H2 | 292 | 0 | 0 |
| H3 | 137 | 110 | 110 |
| H4 | 0 | 0 | 0 |

Abstentions: **7832**. H1/H2/H4 applied zero; H2 had 292 candidates but none passed compatibility, H3 applied 110 of 137 candidates. No hierarchy gate was changed.

## G. Runtime and resource usage

- Runtime: **7555.987 seconds** (~2.10 hours).
- HTTP requests: `342` successful / `0` failed; durable raw sources: `342`.
- Durable object bytes: **5,771,126,972**; object-store writes use remote raw mode. Mongo-inline sources: `82`.
- Structured materialisations: `292` matched documents; total materialisation rows `342` with `292` matched (85.38%).
- LLM: `2552` calls, `24` failures, max in-flight `1`; cache `4` hits / `2564` misses.
- Scheduler limits: global `2`, institution `2`, programme `1`, per-domain `1`.
- Local heavy raw bytes: `0`; configured `max_local_temp_bytes=0`.

## H. Resume/checkpoint activity

- State: `C:\Users\ADMIN\orca\workspaces\MainSite\data-platform\docs\architecture\data\external-field-stage1-20260915\runs\stage1-20260915-main\crawl_state.sqlite`; manifest/config identity was recorded in `resume-report.json` (config fingerprint `31b2a02c6729af46523f3a1f10309712c502d4492c251f3851ace34162e6fed2`).
- This Stage 1 process was a fresh run (`resumed=false`), so it had no interruption to continue: skipped `0`, continued `0`. All 209 checkpoints ended `COMPLETED`; no PARTIAL checkpoints remained.
- The same production resume CLI was exercised in the preceding controlled hardening test; the Stage 1 run retained the resulting state/checkpoint implementation and did not create a replacement population.

## I. Failure taxonomy

- Crawl/error records: `55` total. Rollout taxonomy: `{"SEMANTIC": 13, "TARGET_LEVEL_SOURCE_ABSENCE": 42}`.
- `TARGET_LEVEL_SOURCE_ABSENCE` = 42 (DUO 40, Onisep 1, frozen Manchester Discover Uni 1); these are expected target-level source gaps and did not stop the run.
- `SEMANTIC` = 13 terminal extraction-provider records caused by DeepSeek HTTP 402 (five Discover Uni targets and eight Swissuniversities target records). The provider stats recorded 14 HTTP 402 responses in total; one did not create a crawl-error row.
- No `ACCESS_BLOCKED`, `RATE_LIMIT`, `NETWORK_TRANSIENT`, `HTTP_404`, `PROVIDER_FORMAT`, `PARSER`, `PERSISTENCE`, or `SYSTEMIC_CODE_BUG` records occurred in the crawl error stream. One DeepSeek HTTP 5xx was retried; the remaining LLM failures were isolated schema/envelope/evidence validation responses.

## J. Integrity verification

- Accepted rows checked: `1187`.
- Missing provenance: `{"provider_id": 0, "raw_document_id": 0, "source_authority": 0, "source_content_hash": 0, "source_relationship": 0, "source_url": 0}`; bad scope rows `0`; unknown providers `0`.
- Duplicate effective assertion keys: `0` (no canonical promotion was run); invalid provider IDs: `0`; fabricated scope/cycle/currency: `0` observed in accepted rows.
- Raw local bytes: `0`; heavy-local-copy violation: `False`; configured limit: `0`.

## K. Provider concentration

- Semantic accepted assertions: `{"college_scorecard_bulk": {"count": 122, "share_percent": 10.28}, "discover_uni_hesa": {"count": 448, "share_percent": 37.74}, "duo_rio_ho": {"count": 45, "share_percent": 3.79}, "onisep_higher_ed": {"count": 494, "share_percent": 41.62}, "studyinfo_hakukohde": {"count": 8, "share_percent": 0.67}, "studyinfo_valintaperuste": {"count": 11, "share_percent": 0.93}, "susa_navet_event": {"count": 13, "share_percent": 1.1}, "susa_navet_info": {"count": 22, "share_percent": 1.85}, "swissuniversities_tuition": {"count": 24, "share_percent": 2.02}}`.
- Accepted evidence units including promoted metadata: `{"college_scorecard_bulk": {"count": 122, "share_percent": 7.33}, "discover_uni_hesa": {"count": 617, "share_percent": 37.06}, "duo_rio_ho": {"count": 63, "share_percent": 3.78}, "onisep_higher_ed": {"count": 779, "share_percent": 46.79}, "studyinfo_hakukohde": {"count": 8, "share_percent": 0.48}, "studyinfo_valintaperuste": {"count": 11, "share_percent": 0.66}, "susa_navet_event": {"count": 19, "share_percent": 1.14}, "susa_navet_info": {"count": 22, "share_percent": 1.32}, "swissuniversities_tuition": {"count": 24, "share_percent": 1.44}}`. Onisep and Discover Uni account for the largest shares because their programme records expose multiple validated fields; this is concentration by actual evidence, not duplicated effective keys.

## L. Stage 1 readiness

**A2 — STAGE 1 HEALTHY WITH NON-BLOCKING TARGET/PROVIDER GAPS.**

All 209 institutions completed, durable persistence and bounded remote storage remained healthy, source/target failures were isolated, and integrity counters are zero. The non-blocking gaps are legitimate source absence for 42 target records and depleted DeepSeek balance near the run tail (24 isolated LLM failures; no rate-limit or persistence failure). Replenish/monitor the extraction-provider balance before the next larger run so avoidable semantic gaps do not grow.

## M. Recommendation for next rollout

Proceed with a staged next run of approximately **1,000 programmes**, using the same frozen-manifest/checkpoint/resume path, after the extraction-provider quota is replenished. Keep target-level source absence classified rather than replacing difficult targets; retain promotion disabled or isolated until the production publication gate is explicitly approved.

## N. Quality sample, tests, and artifacts

- Evidence sample: [`stage1-quality-sample.json`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/stage1-quality-sample.json) — 37 accepted assertion samples plus one materialisation-only provider sample, covering all seven countries and all provider adapters (including Studyinfo toteutus, which had no accepted assertion).
- Read-only integrity verification: [`stage1-integrity-check.json`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/stage1-integrity-check.json) — 1,187 accepted rows / 1,187 unique effective keys; 0 duplicate extras, 0 missing IDs/hashes, 0 invalid bindings, 0 cycle mismatches, 0 local raw bytes.
- Metrics: [`stage1-metrics.json`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/stage1-metrics.json); manifest: [`stage1-population-manifest.json`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/stage1-population-manifest.json); ledger: [`stage1-source-ledger.json`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/stage1-source-ledger.json); config: [`stage1-config.json`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/stage1-config.json).
- Run artifacts: [`runs/stage1-20260915-main`](C:/Users/ADMIN/orca/workspaces/MainSite/data-platform/docs/architecture/data/external-field-stage1-20260915/runs/stage1-20260915-main) including raw persistence, source/materialisation, assertions, checkpoint, and coverage reports.
- Analysis checks executed after ingestion: artifact analyzer, deterministic quality-sample generation, JSON/manifest/config validation, Python compile, focused ingestion regression suite, full ingestion suite, and `git diff --check`. No commit or push was performed.
