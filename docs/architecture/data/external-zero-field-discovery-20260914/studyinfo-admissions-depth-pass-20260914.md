# External zero-field pass — Studyinfo selection criteria — 2026-09-14

This pass continued the source-first external-provider objective. It used the
official Finnish Studyinfo / Opintopolku selection-criteria JSON backend and
the existing durable external rail. It did not revisit already accepted
fields, crawl university pages, bypass access controls, or change generic
resolution, acceptance policy, H1–H4, uncertainty, storage, promotion,
canonical truth, or Benchmark V3.

## A. Remaining field matrix before discovery

The following were the remaining zero accepted external fields at the start
of this pass. Previously accepted `intakes`, `final_deadline`,
`subject_prerequisites`, `rolling_admission`, `minimum_degree`, and
`required_documents` were not reimplemented.

| Priority | Field | State before |
| --- | --- | --- |
| P0 | `minimum_gpa` | Zero |
| P0 | IELTS overall/subscores, TOEFL, Duolingo | Zero |
| P0 | `application_fee`, `priority_deadline`, `international_deadline` | Zero |
| P0 | standardized-test requirements | Zero |
| P1 | recommendation letters, SOP/essays, portfolio, work experience | Zero |
| P2 | scholarships, amounts, funding, eligibility, funding deadline, GPA scale, programme status, explicit academic/programme cycle | Zero |

## B. Providers researched

Only the already verified Finnish ecosystem was deepened; no unrelated
provider expansion was performed.

| Provider | Country | Authority | Official access | Decision |
| --- | --- | --- | --- | --- |
| Studyinfo / Opintopolku `valintaperuste` | FI | Finnish National Agency for Education | Public HTTPS JSON `GET` to the official `konfo-backend` endpoint; [official Studyinfo](https://opintopolku.fi/konfo/en/sivu/what-is-studyinfo) | **IMPLEMENT / EXTEND_EXISTING** |

Known dead ends were carried forward rather than retried or bypassed:
Common App (no compliant route), CRICOS (no compliant official access), HESA
bulk (access blocked), and Studiekeuze123 professional data (access gated).

## C. Real schemas and records inspected

All three exact records returned HTTP 200 and were persisted as durable remote
JSON objects. The records were matched by their source-native `id`, not by a
name heuristic.

| Record | Exact official JSON | Real paths inspected | Verified semantics |
| --- | --- | --- | --- |
| Haaga-Helia bachelor | [`60a36d5e…f8df222`](https://opintopolku.fi/konfo-backend/valintaperuste/60a36d5e-bdd3-4509-8125-85c36f8df222) | `id`, `nimi.en`, `metadata.valintatavat.0.kynnysehto.en`, `metadata.hakukelpoisuus.en` | SAT is explicitly named; the threshold text contains the SAT test and 500-point section requirements. Numeric fragments were retained as review where the quote did not align to the full threshold. |
| Haaga-Helia master | [`88fc8a7e…8e7`](https://opintopolku.fi/konfo-backend/valintaperuste/88fc8a7e-9804-478d-bf45-18af037bf8e7) | same selection/eligibility paths | GMAT/GRE is explicit, GMAT minimum total is 530; eligibility explicitly requires 24 months or 60 months of work experience depending on prior qualification, with employer-certificate verification. |
| University of Eastern Finland | [`33012799…b6d`](https://opintopolku.fi/konfo-backend/valintaperuste/33012799-b01f-435e-8083-851d47fb4b6d) | `id`, `nimi.en`, `metadata.hakukelpoisuus.en`, `metadata.lisatiedot.en` | IELTS academic minimum overall 6.0; TOEFL iBT minimum overall 78; PTE/C1/C2/YKI alternatives; explicit tuition-waiver/scholarship policy and a source-native 2026–2027 academic-year phrase. |

The machine-readable verification ledger is
[`studyinfo-admissions-depth-ledger.json`](studyinfo-admissions-depth-ledger.json).

## D. Verified useful source

The exact `valintaperuste` records add real fields that were previously zero:

- named SAT, GMAT and GRE admission-test requirements;
- an explicit GMAT minimum total score of 530;
- IELTS academic minimum overall 6.0;
- TOEFL iBT minimum overall 78; and
- work-experience eligibility, including source-stated durations and
  verification wording.

The UEF record also contains an explicit scholarship/tuition-waiver policy.
It was materialized durably but did not yield a non-null semantic proposal in
this run, so it is reported as source-ready rather than accepted. No amount or
funding deadline is present in the inspected text.

## E. Rejected, blocked, and gated sources/fields

No access restriction was bypassed. The known provider stop states remain:

- **ACCESS_BLOCKED:** Common App, CRICOS, HESA bulk, and previously inspected
  OUInfo/IPEDS indicator routes.
- **ACCESS_GATED:** Studiekeuze123 professional/OData data requiring
  registration or licensing.
- **NO_VERIFIED_SCALABLE_SOURCE:** numeric IELTS subscores, Duolingo, GPA and
  GPA scale, funding amounts/deadlines, and a programme academic-cycle field.

Within Studyinfo itself, no numeric application fee or explicit
priority/international deadline label was present. `hakuAuki`/application
windows remain source-native application signals and are not converted to
unsupported deadline types or programme status.

## F. Sources implemented / extended

The existing declarative `government_dataset` + `structured_rows` adapter was
extended only where the inspected schema required it:

1. Added `studyinfo_valintaperuste` with exact source-native IDs in the smoke
   manifest and mappings for standardized tests, IELTS overall, TOEFL,
   work-experience, scholarship policy, and explicit-year context.
2. Added the optional structured `title_column` so a matched record keeps its
   source title alongside literal mapped values; mapping guidance is appended
   after literal values.
3. Passed the exact linked programme ID through the narrow programme-source
   validator path, so an exact external ID binding is not rejected merely
   because the endpoint title omits the human programme name.
4. Added numeric-leaf support for structured standardized-test values and a
   regression that prevents declarative mapping guidance from becoming a
   source-excerpt fact when a mapped field is empty.

No factual value is hard-coded, and no global acceptance or hierarchy rule was
changed.

## G. New accepted external assertions

Bounded provider-only run:
[`runs/studyinfo-admissions-depth-20260914-v5/`](runs/studyinfo-admissions-depth-20260914-v5/)

| Metric | Result |
| --- | ---: |
| Institutions / programmes | 2 / 3 |
| Exact records attempted / matched | 3 / 3 |
| Durable raw JSON objects persisted | **3** |
| Structured record materialisations | **3** |
| Non-null field candidates | **24** |
| Runtime assertion rows (including null/review placeholders) | **46** |
| Effective accepted external assertions | **17** |
| Review assertions | **4** |
| Rejected assertions | **3** (academic-cycle proposals with evidence not in the materialized snapshot) |
| Provider errors / candidate drops | **0 / 0** |

All 17 accepted assertions are `OBSERVED`, provenance-complete, and
programme-scoped. They retain the exact source URL, content hash, raw document
ID, provider/dataset IDs, and acquisition run ID. Their source temporal state
is `UNKNOWN`; no academic cycle was fabricated. Optional audience context is
left `UNKNOWN` when the record does not state it.

| Provider | Country | Field | Accepted count | Scope | Source-supported examples |
| --- | --- | --- | ---: | --- | --- |
| Studyinfo `valintaperuste` | FI | `standardized_tests` | **10** | programme | SAT; GMAT 530 total; GRE; PTE 54; C1/C2 alternatives; UEF IELTS/TOEFL alternatives |
| Studyinfo `valintaperuste` | FI | `work_experience` | **5** | programme | Haaga master 24/60 months and employer-certificate rules; one explicit no-requirement observation |
| Studyinfo `valintaperuste` | FI | `ielts_overall` | **1** | programme | IELTS (academic) minimum overall 6.0 |
| Studyinfo `valintaperuste` | FI | `toefl` | **1** | programme | TOEFL iBT minimum overall 78 |

The UEF scholarship/waiver policy was present in the literal mapped source
window, but produced no non-null semantic proposal; scholarship acceptance is
therefore **0**. Four standardized-test fragments remain review-only because
their evidence did not establish complete row/threshold alignment. Three
academic-cycle proposals were rejected with `EVIDENCE_NOT_FOUND_IN_SOURCE`;
application/start/academic-year text was not promoted to a programme cycle.

## H. Previously-zero fields now covered

| Field group | Result |
| --- | --- |
| Standardized-test requirements | **ACCEPTED_EXTERNAL** — 10 programme assertions (SAT, GMAT/GRE, PTE, C1/C2 and related named tests) |
| IELTS overall | **ACCEPTED_EXTERNAL** — one FI programme, 6.0 overall |
| TOEFL | **ACCEPTED_EXTERNAL** — one FI programme, 78 overall |
| Work experience | **ACCEPTED_EXTERNAL** — four Haaga master eligibility assertions plus one explicit no-requirement observation for the UEF programme |
| Scholarship policy | **VERIFIED_SOURCE_READY_FOR_IMPLEMENTATION** — UEF policy is durable/materialized, but no non-null proposal was produced |
| IELTS subscores / Duolingo | Still zero; no matching numeric field in inspected records |
| Application fee / priority or international deadline | Still zero; Studyinfo only exposed source-native application windows/boolean fee context, and other verified routes are blocked/gated |
| Minimum GPA / GPA scale | Still zero |
| Recommendations / SOP / portfolio | Still zero |
| Funding amounts / eligibility / deadline | No accepted assertion; only a scholarship/waiver policy is source-ready |
| Programme status / academic cycle | No accepted assertion; application-window boolean and year phrases are not mapped without explicit compatible semantics |

## I. Final field-state matrix

Each remaining priority field has one evidence-backed terminal state. The four
newly accepted groups are included so the change from the zero baseline is
explicit.

| Field | Final state | Evidence / stopping reason |
| --- | --- | --- |
| `minimum_gpa` | **ACCESS_BLOCKED** | Verified OUInfo/IPEDS indicator routes were unavailable; no compliant numeric route was available in this pass. |
| `IELTS overall` | **ACCEPTED_EXTERNAL** | UEF exact record: IELTS academic minimum overall 6.0. |
| `IELTS subscores` | **NO_VERIFIED_SCALABLE_SOURCE** | No IELTS subscore value was present; YKI subtests are not IELTS subscores. |
| `TOEFL` | **ACCEPTED_EXTERNAL** | UEF exact record: TOEFL iBT minimum overall 78. |
| `Duolingo` | **NO_VERIFIED_SCALABLE_SOURCE** | No Duolingo value in inspected records or a compliant retained route. |
| `application_fee` | **ACCESS_BLOCKED** | Common App/OUInfo routes are blocked or gated; Studyinfo provides only a boolean paid-application signal, not a numeric fee. |
| `priority_deadline` | **ACCESS_BLOCKED** | No explicit priority label in Studyinfo; verified alternative routes are blocked. |
| `international_deadline` | **ACCESS_BLOCKED** | No explicit international label in Studyinfo; verified alternative routes are blocked. |
| `standardized_test_requirements` | **ACCEPTED_EXTERNAL** | Studyinfo exact records provide named SAT, GMAT/GRE, PTE, C1/C2 and related test requirements. |
| `recommendation_letters` | **ACCESS_BLOCKED** | Verified indicator/partner routes are blocked; Studyinfo records inspected did not state recommendation requirements. |
| `SOP / essays` | **ACCESS_BLOCKED** | Verified indicator/partner routes are blocked; no explicit Studyinfo value. |
| `portfolio` | **ACCESS_BLOCKED** | Verified indicator/partner routes are blocked; no explicit Studyinfo value. |
| `work_experience` | **ACCEPTED_EXTERNAL** | Haaga master selection criteria explicitly state 24/60-month alternatives and verification. |
| `scholarships` | **VERIFIED_SOURCE_READY_FOR_IMPLEMENTATION** | UEF literal policy says tuition-fee applicants can apply for waivers and scholarships; mapping is durable, but this run emitted no non-null proposal. |
| `scholarship_amount` | **NO_VERIFIED_SCALABLE_SOURCE** | No amount in the inspected policy. |
| `funding` | **NO_VERIFIED_SCALABLE_SOURCE** | Only a specific waiver/scholarship policy was verified; no generic funding field. |
| `funding_amount` | **NO_VERIFIED_SCALABLE_SOURCE** | No amount in the inspected policy. |
| `funding_eligibility` | **VERIFIED_SOURCE_READY_FOR_IMPLEMENTATION** | UEF explicitly limits waiver/scholarship applications to applicants subject to tuition fees; no separate accepted product assertion yet. |
| `funding_deadline` | **NO_VERIFIED_SCALABLE_SOURCE** | No funding deadline in the inspected records. |
| `gpa_scale` | **NO_VERIFIED_SCALABLE_SOURCE** | No scale definition in the inspected records. |
| `programme_status` | **VERIFIED_SOURCE_READY_FOR_IMPLEMENTATION** | Studyinfo `hakuAuki` is an application-window signal, but current explicit-status validation correctly leaves its boolean-only wording unaccepted. |
| `explicit academic/programme cycle` | **NO_VERIFIED_SCALABLE_SOURCE** | Year phrases are application/tuition context, not an explicit programme cycle; three unsupported proposals were rejected. |

Previously accepted external groups remain unchanged: `intakes`,
`final_deadline`, `subject_prerequisites`, `rolling_admission`,
`minimum_degree`, and `required_documents`.

## J. Direct / H1 / H2 / H3 / H4

The existing evaluator was run unchanged on the accepted v5 bundle:
[`studyinfo-hierarchy-v7.json`](studyinfo-hierarchy-v7.json).

| Field | Direct candidates / usable / applied | H1 candidates / usable / applied | H2 candidates / usable / applied | H3 candidates / usable / applied | H4 candidates / usable / applied | Abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `ielts_overall` | 1 / 1 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 3 |
| `standardized_tests` | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 3 |
| `toefl` | 1 / 1 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 3 |
| `work_experience` | 1 / 1 / 1 | 0 / 0 / 0 | 0 / 0 / 0 | 4 / 0 / 0 | 0 / 0 / 0 | 3 |

The standardized-test direct bundle abstains because the target has
materially conflicting test assertions; no precedence rule was added. H3 has
four sibling candidates for work experience, but none is compatible enough to
use. H1, H2, and H4 have no usable donor. Support count is zero for all
applied direct rows; no inferred uncertainty was generated.

## K. Tests and artifacts

Executed after the implementation:

- `python -m pytest -q tests/test_core.py tests/test_semantic_acceptance.py tests/test_external_field_evidence.py` — **262 passed**.
- `python -m pytest -q` from `services/data-ingestion` — **662 passed**.
- `python -m compileall -q services/data-ingestion/src` — passed.
- `python services/data-ingestion/run.py validate-config --config docs/architecture/data/external-zero-field-discovery-20260914/studyinfo-admissions-depth-smoke.json` — valid.
- `python -m json.tool` for the provider and smoke configurations — passed.
- Durable provider smoke `studyinfo-admissions-depth-20260914-v5` — 2/2 institutions, 3/3 records, 3/3 raw objects, 0 errors.
- Existing hierarchy evaluator — v7 output generated successfully.

Artifacts:

- [`external-providers.json`](../../../../services/data-ingestion/configs/external-providers.json)
- [`studyinfo-admissions-depth-smoke.json`](studyinfo-admissions-depth-smoke.json)
- [`studyinfo-admissions-depth-ledger.json`](studyinfo-admissions-depth-ledger.json)
- [`runs/studyinfo-admissions-depth-20260914-v5/coverage_report.json`](runs/studyinfo-admissions-depth-20260914-v5/coverage_report.json)
- [`runs/studyinfo-admissions-depth-20260914-v5/raw_persistence_events.jsonl`](runs/studyinfo-admissions-depth-20260914-v5/raw_persistence_events.jsonl)
- [`runs/studyinfo-admissions-depth-20260914-v5/external_field_materializations.jsonl`](runs/studyinfo-admissions-depth-20260914-v5/external_field_materializations.jsonl)
- [`runs/studyinfo-admissions-depth-20260914-v5/field_assertions.jsonl`](runs/studyinfo-admissions-depth-20260914-v5/field_assertions.jsonl)
- [`runs/studyinfo-admissions-depth-20260914-v5/effective_field_assertions.jsonl`](runs/studyinfo-admissions-depth-20260914-v5/effective_field_assertions.jsonl)
- [`runs/studyinfo-admissions-depth-20260914-v5/semantic_acceptance_decisions.jsonl`](runs/studyinfo-admissions-depth-20260914-v5/semantic_acceptance_decisions.jsonl)
- [`studyinfo-hierarchy-v7.json`](studyinfo-hierarchy-v7.json)

No commit or push was made.
