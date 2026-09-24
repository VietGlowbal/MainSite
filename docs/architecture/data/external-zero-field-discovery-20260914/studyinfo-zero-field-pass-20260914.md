# External zero-field pass — Studyinfo / Opintopolku — 2026-09-14

This follow-up stayed inside the external authoritative-provider objective. It
did not research additional providers, crawl university pages, or change the
resolver, acceptance policy, hierarchy, uncertainty, storage, promotion,
canonical truth, or Benchmark V3. The only implementation changes were a
declarative Studyinfo field-shape correction and a narrow structured-record
materializer guard that prevents a metadata-only matched record from falling
back to unbounded raw text.

## A. Programme-status semantic audit

The product field is **admissions/application status**, not registry lifecycle
status. `ProgrammeRecord.programme_status` is validated against admissions
states (`accepting_applications`, `closed`, `not_accepting_applications`, and
explicitly evidenced `active`), and the existing programme-status regression
tests require application-open wording and a current applicable window.

Consequences:

- Susa-navet `ACTIVE` remains unaccepted. It is an offering/registry status and
  does not prove that applications are open.
- Studyinfo `tila`/publication markers are ignored and are not mapped.
- Studyinfo `hakuAuki=true` is a genuine application-window signal, but the
  smoke's proposal quoted only `hakuAuki=True`; the unchanged validator
  correctly rejected it as `PROGRAMME_STATUS_NOT_EXPLICIT`. No acceptance
  relaxation was made. The source is retained as ready for a future
  provider-specific evidence wording fix.

## B. Zero-field matrix before this pass

The following were zero accepted external assertions at the start of this
follow-up (Susa-covered `intakes`, `final_deadline`, and
`subject_prerequisites` are intentionally excluded):

| Priority | Field group | State before |
| --- | --- | --- |
| P0 | `priority_deadline`, `funding_deadline`, `international_deadline` | Zero |
| P0 | `rolling_admission`, `application_fee` | Zero |
| P0 | IELTS overall/subscores, TOEFL, Duolingo, standardized tests | Zero |
| P0 | minimum degree, minimum GPA, GPA scale | Zero |
| P1 | required documents, recommendations, SOP/essay, portfolio, work experience | Zero |
| P1 | scholarships, amounts, funding, amounts, eligibility | Zero |
| P2 | programme status and explicit academic/programme cycle | Zero |

## C. Provider researched

Only one new ecosystem was researched in this pass:

| Provider | Country | Authority | Official resource / access | Decision |
| --- | --- | --- | --- | --- |
| Finnish Studyinfo / Opintopolku `konfo-backend` | FI | Finnish National Agency for Education | Public HTTPS JSON `GET`; [dependency route list](https://dependencies.ops.opintopolku.fi/url_dependencies.html); checked robots policy without bypassing it | **IMPLEMENT / EXTEND_EXISTING** |

Known previously verified blockers were not retried: Common App (no compliant
route), CRICOS (no compliant official access), HESA bulk (access blocked), and
Studiekeuze123 professional data (access gated).

## D. Real schemas and records inspected

The exact public JSON records were fetched and persisted for two targets:

| Record | Exact identifier | Real fields inspected | Scope/semantics |
| --- | --- | --- | --- |
| Bachelor application target | `hakukohdeOid=1.2.246.562.20.00000000000000091904` | `hakuNimi`, `hakuajat`, `pohjakoulutusvaatimus`, `liitteet` | Programme/application-target; `hakuNimi` explicitly names “Rolling admission”; dates are application-window dates |
| Master application target | `hakukohdeOid=1.2.246.562.20.00000000000000088243` | `hakuNimi`, `hakuajat`, `pohjakoulutusvaatimus`, `liitteet` | Programme/application-target; prior-education options include a University Bachelor degree |
| Linked offerings | `toteutusOid=1.2.246.562.17.00000000000000009871` and `1.2.246.562.17.00000000000000011598` | `hakuAuki`, `hakutiedot`, `tila`, offering identity | Programme/offering; `hakuAuki` is an application-window flag; `tila` is registry publication state |

The application-target records also expose source-native application dates (for
example 2026-08-12 through 2026-09-30 for the rolling route and 2026-08-31
through 2026-09-10 for the master route). They were not relabelled as priority,
funding, international, or final deadlines because those types were not
explicitly named by the source.

The machine-readable verification ledger is
[`studyinfo-source-verification-ledger.json`](studyinfo-source-verification-ledger.json).

## E. Verified useful source

Studyinfo contains explicit missing fields beyond the frozen providers:

- a named rolling-admission route;
- source-native prior-education options that support a minimum-degree
  observation for the master target; and
- source-native application-document names in `liitteet`.

The exact OID is the programme identifier. No institution or programme fact is
hard-coded in the adapter; target OIDs remain declarative experiment input.

## F. Rejected / blocked / gated sources

No new candidate was rejected after implementation. Existing verified stopping
states remain:

- **ACCESS_BLOCKED:** Common App, CRICOS, HESA bulk, and previously inspected
  OUInfo/IPEDS retrieval routes where the real fields could not be retrieved
  compliantly.
- **ACCESS_GATED:** Studiekeuze123 professional/OData data requiring
  registration or licensing.
- **NO_VERIFIED_SCALABLE_SOURCE:** no verified external source currently
  retained for funding deadlines, numeric English thresholds, GPA scale,
  scholarships/funding amounts or eligibility, or an academic-cycle field.

## G. Source implemented / extended

The existing `government_dataset` + `structured_rows` bridge was extended only
declaratively:

- `studyinfo_hakukohde` maps the exact first
  `pohjakoulutusvaatimus.0.nimi.en` option to `minimum_degree`, the exact
  first `liitteet.0.nimi.en` item to `required_documents`, and an explicitly
  named rolling route to `rolling_admission`.
- `studyinfo_toteutus` maps `hakuAuki` as an application-window signal and
  retains `hakutiedot` as source-native window metadata. Registry publication
  markers are not mapped.
- Provider schema context requires atomic literal values and complete
  requirement evidence; it does not change global acceptance rules.
- The structured materializer now keeps bounded metadata-only context instead
  of returning the original raw JSON when all optional field values are false
  or absent. This prevents unrelated registry fields from entering semantic
  extraction.

## H. New accepted external assertions

Validation run:
[`runs/studyinfo-zero-field-20260914-haaga-v5/`](runs/studyinfo-zero-field-20260914-haaga-v5/)

| Metric | Result |
| --- | ---: |
| Institutions / programmes | 1 / 2 |
| Raw JSON sources persisted | **4** remote durable objects |
| Exact source records materialized | **4/4**; all had bounded materialized context |
| Field-bearing semantic proposals | **7** non-null proposals (11 runtime assertion rows including null placeholders) |
| Accepted external assertions | **4**, all `OBSERVED`, `RULE_VALIDATED`, programme scope |
| Errors / candidate drops | **0 / 0** |

Accepted rows:

| Provider | Country | Field | Value | Scope | Temporal representation |
| --- | --- | --- | --- | --- | --- |
| `studyinfo_hakukohde` | FI | `rolling_admission` | `true` | programme | Source phrase names August–September 2026; normalized cycle `2026` |
| `studyinfo_hakukohde` | FI | `minimum_degree` | `University Bachelor's degree` | programme | No academic cycle inferred |
| `studyinfo_hakukohde` | FI | `required_documents` | `Required educational certificates` | programme | No cycle; source-native attachment title |
| `studyinfo_hakukohde` | FI | `required_documents` | `Completing your qualification in autumn 2026` | programme | Source-native attachment title; no deadline type inferred |

All four rows retain the exact source URL, content hash, raw document ID,
provider ID, dataset ID, and acquisition run ID.

Rejected/review trace:

- Bachelor `minimum_degree` is correctly `FIELD_NOT_APPLICABLE`.
- Two `programme_status` proposals were rejected by the unchanged explicit
  admissions-status guard (one `hakuAuki=True`, one registry marker).
- The original multi-item document/degree shapes caused conflicts or unresolved
  requirement evidence. The provider-only shape correction reduced each
  mapping to one literal source item; no generic conflict or acceptance rule
  was changed.

## I. Previously-zero fields now covered

| Field group | Result |
| --- | --- |
| Rolling admission | **ACCEPTED_EXTERNAL** — one FI programme |
| Minimum degree | **ACCEPTED_EXTERNAL** — one FI master programme |
| Required documents | **ACCEPTED_EXTERNAL** — two FI programmes, one source-native document title each |
| Priority/funding/international deadlines | Still zero; source dates were not given unsupported deadline types |
| Application fee | Still zero |
| IELTS/TOEFL/Duolingo/standardized thresholds | Still zero; no numeric threshold was present in inspected records |
| Minimum GPA/GPA scale/prerequisites | Still zero for this provider; no GPA field was inspected |
| Recommendations/SOP/portfolio/work experience | Still zero; no such explicit field was selected |
| Scholarships/funding and amounts/eligibility | Still zero |
| Programme status | Source-ready application-window flag, but no accepted row; registry lifecycle marker remains excluded |
| Academic/programme cycle | Still zero; application dates/start terms remain source-native temporal metadata |

## J. Final priority-field state matrix

This matrix classifies every remaining priority field individually. Existing
Susa-accepted fields are shown separately above and are not downgraded.

| Field | Final state | Evidence / exact stopping reason |
| --- | --- | --- |
| `priority_deadline` | **ACCESS_BLOCKED** | Common App/OUInfo real indicators, no compliant target route |
| `funding_deadline` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified source with an explicit funding deadline |
| `international_deadline` | **ACCESS_BLOCKED** | Common App/OUInfo route blocked; visibility flags are not deadlines |
| `rolling_admission` | **ACCEPTED_EXTERNAL** | Studyinfo `hakuNimi` explicitly says Rolling admission |
| `application_fee` | **ACCESS_BLOCKED** | Common App/Studiekeuze/OUInfo routes blocked or gated |
| `minimum_degree` | **ACCEPTED_EXTERNAL** | Studyinfo master `pohjakoulutusvaatimus.0.nimi.en` |
| `minimum_gpa` | **ACCESS_BLOCKED** | Verified OUInfo/IPEDS indicator routes unavailable |
| `gpa_scale` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified source with a scale definition |
| `IELTS overall` | **NO_VERIFIED_SCALABLE_SOURCE** | Existing indicators are non-numeric; no compliant numeric source |
| `IELTS subscores` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified numeric subscore source |
| `TOEFL` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified numeric threshold source |
| `Duolingo` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable numeric source |
| `standardized-test requirements` | **ACCESS_BLOCKED** | Common App/IPEDS indicators cannot be retrieved compliantly |
| `required_documents` | **ACCEPTED_EXTERNAL** | Studyinfo `liitteet.0.nimi.en` on two exact targets |
| `recommendation_letters` | **ACCESS_BLOCKED** | IPEDS indicator route blocked |
| `SOP / essays` | **ACCESS_BLOCKED** | IPEDS indicator route blocked |
| `portfolio` | **ACCESS_BLOCKED** | IPEDS indicator route blocked |
| `work_experience` | **ACCESS_BLOCKED** | IPEDS indicator route blocked |
| `scholarships` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained field-bearing authoritative source |
| `scholarship_amount` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative amount source |
| `funding` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained field-bearing authoritative source |
| `funding_amount` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative amount source |
| `funding_eligibility` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative eligibility source |
| `programme_status` | **VERIFIED_SOURCE_READY_FOR_IMPLEMENTATION** | Studyinfo `hakuAuki` is a source-native application-window signal; current evidence wording remains rejected |
| `explicit academic/programme cycle` | **NO_VERIFIED_SCALABLE_SOURCE** | Studyinfo and Susa expose application/intake dates, not an academic-cycle field |

## K. Direct / H1 / H2 / H3 / H4

The existing hierarchy evaluator was run unchanged over the four accepted
Studyinfo rows:
[`studyinfo-hierarchy-v5.json`](studyinfo-hierarchy-v5.json).

| Field | Direct candidates / usable / applied | H1 | H2 | H3 | H4 | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rolling_admission` | 1 / 1 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 0 / 0 | 0 / 0 / 0 | 2 |
| `minimum_degree` | 1 / 1 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 1 / 0 / 0 | 0 / 0 / 0 | 2 |
| `required_documents` | 2 / 2 / 2 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 2 |

The H3 candidates were incompatible sibling targets (different field
applicability/degree context), so they were not usable. H1, H2 and H4 had no
usable donor. No hierarchy gate was weakened.

## L. Tests and artifacts

Executed:

- `python -m pytest -q services/data-ingestion/tests/test_external_field_evidence.py` — **19 passed**.
- `python -m pytest -q tests` from `services/data-ingestion` — **656 passed**.
- `python -m compileall -q src` from `services/data-ingestion` — passed.
- `python -m json.tool configs/external-providers.json` — passed.
- `python services/data-ingestion/run.py validate-config --config docs/architecture/data/external-zero-field-discovery-20260914/studyinfo-zero-field-smoke.json` — valid.
- Durable Studyinfo smoke v5 — 1/1 institution, 2/2 programmes, 4/4 sources, 0 errors.
- Existing H1–H4 evaluator — output written successfully.

Artifacts:

- [`external-providers.json`](../../../../services/data-ingestion/configs/external-providers.json)
- [`studyinfo-zero-field-smoke.json`](studyinfo-zero-field-smoke.json)
- [`studyinfo-source-verification-ledger.json`](studyinfo-source-verification-ledger.json)
- [`runs/studyinfo-zero-field-20260914-haaga-v5/coverage_report.json`](runs/studyinfo-zero-field-20260914-haaga-v5/coverage_report.json)
- [`runs/studyinfo-zero-field-20260914-haaga-v5/external_field_materializations.jsonl`](runs/studyinfo-zero-field-20260914-haaga-v5/external_field_materializations.jsonl)
- [`runs/studyinfo-zero-field-20260914-haaga-v5/field_assertions.jsonl`](runs/studyinfo-zero-field-20260914-haaga-v5/field_assertions.jsonl)
- [`runs/studyinfo-zero-field-20260914-haaga-v5/effective_field_assertions.jsonl`](runs/studyinfo-zero-field-20260914-haaga-v5/effective_field_assertions.jsonl)
- [`runs/studyinfo-zero-field-20260914-haaga-v5/semantic_acceptance_decisions.jsonl`](runs/studyinfo-zero-field-20260914-haaga-v5/semantic_acceptance_decisions.jsonl)
- [`studyinfo-hierarchy-v5.json`](studyinfo-hierarchy-v5.json)

No commit or push was made.
