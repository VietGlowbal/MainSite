# Source-first zero-field pass - 2026-09-14

This pass stayed inside the external authoritative-provider objective. It
verified one new public government ecosystem, Skolverket Susa-navet, and
extended the existing declarative structured-data bridge. No official-
university crawl, resolver redesign, hierarchy change, uncertainty change,
storage change, promotion change, or global acceptance relaxation was made.

The prior candidate ledger remains at
[`external-field-expansion-20260913/source-verification-ledger.json`](../external-field-expansion-20260913/source-verification-ledger.json).
Its Common App, CRICOS, HESA, Studiekeuze123, IPEDS, MonMaster and OUInfo
access results were not silently retried or bypassed in this pass.

## A. Zero-field matrix before discovery

| Priority | Field group | State before this pass |
| --- | --- | --- |
| P0 | Intakes and all deadline types | Zero accepted external assertions |
| P0 | Rolling admission and application fee | Zero accepted external assertions |
| P0 | IELTS, IELTS subscores, TOEFL, Duolingo, standardized tests | Zero accepted numeric/requirement assertions |
| P0 | Minimum degree, minimum GPA, GPA scale, subject prerequisites | Zero accepted external assertions |
| P1 | Required documents, recommendations, SOP/essay, portfolio, work experience | Zero accepted external assertions |
| P1 | Scholarships, scholarship amount, funding, funding amount, funding eligibility | Zero accepted external assertions |
| P2 | Programme status and explicit academic/programme cycle | Zero accepted external assertions |

## B. Provider researched and real schema/records inspected

| Provider | Authority and official resource | Real record/schema | Verified fields and semantics | Access / decision |
| --- | --- | --- | --- | --- |
| **Susa-navet** | Swedish National Agency for Education (Skolverket), [OpenAPI 3.0.3 YAML](https://api.skolverket.se/susa-navet/susa-navet-emil3.yaml), [official API documentation](https://www.skolverket.se/om-skolverket/oppna-data/api-for-utbildningstillfallen-susa-navet) | Public JSON `educationEvents/e.uoh.kth.cbiot.32101.20262` and `educationInfos/i.uoh.kth.cbiot.32101.20262`; `/api-info` reports active API 3.0.3 | Event: exact id/provider, `status=ACTIVE`, `content.application.last=2026-04-15`, `content.extensions[0].startPeriod.period={year:2026,semester:HT,periodNumber:4}`, tuition fee object, location, instruction language. Info: English title, degree, explicit Swedish eligibility/prerequisite text, education level, credits, status and registry dates. Programme scope. | Public HTTPS JSON GET; no authentication or registration. The API and `/susa-navet` robots probes returned HTTP 404; no published disallow was bypassed. **IMPLEMENT**. |

Source-native identifier matching is exact: event id plus `content.providers=p.uoh.kth`,
and info id. The KTH programme link is retained in both materialisations.
`startPeriod.period` is a source-native intake period (`2026 HT`), not an
invented academic cycle. The application `last` value is a closing date. The
record contains no tuition currency, so no SEK value was inferred. The
`visibleToSwedishApplicants` / `visibleToInternationalApplicants` flags remain
policy context and were not converted to an international deadline.

The full machine-readable ledger is
[`source-verification-ledger.json`](source-verification-ledger.json).

## C. Verified useful source and implementation

The existing `government_dataset` adapter was extended declaratively with two
provider entries:

- `susa_navet_event` maps status, application closing date, source-native start
  period and the literal tuition object, plus language/application-policy
  metadata.
- `susa_navet_info` maps the English programme title, source credential,
  literal eligibility/prerequisite text and registry status, plus credits,
  education-level and record-edit metadata.

The reusable structured materializer now supports exact nested JSON paths and
array indexes (for example `content.application.last` and
`content.providers`), while retaining the complete remote source and bounded
JSON parsing. No factual KTH value is hard-coded.

One concrete downstream defect was corrected: the existing final-deadline
validator accepted `final`, `application deadline`, and `applications close`,
but rejected the source's semantically equivalent labelled value
`Application closing date`. The narrow term addition is covered by a focused
external-government deadline test; it does not alter cycle, scope, currency,
or acceptance gates.

## D. Provider validation result

Run:
[`runs/susa-navet-20260914-kth-deadline-fix/`](runs/susa-navet-20260914-kth-deadline-fix/)

| Metric | Susa-navet result |
| --- | ---: |
| Institutions / programmes | 1 / 1 |
| Exact matched source records | 2 (event + info) |
| Durable raw sources persisted | 2 remote raw objects; no local heavy copy |
| Field materialisations | 2 structured records; 8 non-null field candidates |
| Semantic proposals | 10 runtime assertions, 8 non-null proposals |
| Effective accepted assertions | **5**, all `OBSERVED`, `RULE_VALIDATED`, programme scope |
| Errors / source candidates rejected | 0 / 0 |

Accepted assertions:

| Provider | Country | Field | Scope | Accepted source value/context |
| --- | --- | --- | --- | --- |
| `susa_navet_info` | SE | `programme_identity` | programme | `Degree Programme in Biotechnology` |
| `susa_navet_info` | SE | `credential` | programme | source degree label (`Civilingenjörsexamen`) |
| `susa_navet_event` | SE | `intakes` | programme | source-native `{year: 2026, semester: HT, periodNumber: 4}` |
| `susa_navet_event` | SE | `final_deadline` | programme | `2026-04-15`, labelled `Application closing date` and associated with the source-native intake event |
| `susa_navet_info` | SE | `subject_prerequisites` | programme | literal Swedish eligibility/subject-prerequisite string |

The event status `ACTIVE` is retained as source data but its proposal is
rejected with `PROGRAMME_STATUS_NOT_EXPLICIT`: the existing product status
validator uses an admissions-state vocabulary (`applications open`,
`accepting applications`, etc.), and `ACTIVE` in this registry is not evidence
that applications are currently open. Tuition proposals (first `70500`, total
`783000`) are rejected with `TUITION_CURRENCY_MISSING`; the API record has no
currency. No unsupported status or tuition assertion was promoted.

Temporal/scope audit: all five accepted rows are programme-scoped. The intake
row retains `year=2026`, `semester=HT`, and `periodNumber=4`; the deadline is
the event's `application.last=2026-04-15` in that intake context; identity,
credential and prerequisites have no invented cycle. Currency and fee basis
are absent for the rejected tuition object.

## E. Previously-zero fields now covered

- **Intakes:** `ACCEPTED_EXTERNAL`, one programme assertion, source-native
  2026 HT period.
- **Final deadline:** `ACCEPTED_EXTERNAL`, one programme assertion,
  2026-04-15.
- **Subject prerequisites:** `ACCEPTED_EXTERNAL`, one programme assertion,
  explicit source text.
- **Programme language context:** Susa exposes `swe` as metadata, but this is
  not an IELTS/TOEFL/Duolingo threshold and does not fill the language-
  requirement group.
- **Programme status:** source field exists but remains not accepted because
  `ACTIVE` is registry status rather than explicit admissions-open evidence.
- **Programme cycle:** the source exposes a start/intake period and registry
  edit dates, not an academic-cycle field; no cycle was fabricated.

## F. Rejected, blocked, and gated candidates

No new candidate was implemented without a real schema/record. The existing
verification ledger records the following stopping states:

- Common App, OUInfo and the public IPEDS/NCES retrieval route expose useful
  deadline, fee, test, GPA or document indicators but have no compliant target
  route in this environment: **ACCESS_BLOCKED**.
- Studiekeuze123 professional data is **ACCESS_GATED** (registration/licensing
  required); HESA bulk and CRICOS remain **ACCESS_BLOCKED** / no compliant
  official route.
- No verified scalable authoritative source was retained for funding deadlines,
  Duolingo/subscores, scholarships or funding amounts/eligibility.

## G. Final priority-field state matrix

| Priority field | Final state | Exact reason |
| --- | --- | --- |
| `intakes` | **ACCEPTED_EXTERNAL** | Susa event `startPeriod.period` |
| `priority_deadline` | **ACCESS_BLOCKED** | Common App/OUInfo real fields, no compliant route |
| `funding_deadline` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified source retained with this field |
| `international_deadline` | **ACCESS_BLOCKED** | Common App/OUInfo routes blocked; Susa visibility is not a deadline |
| `final_deadline` | **ACCEPTED_EXTERNAL** | Susa `application.last`, explicit closing-date label |
| `rolling_admission` | **ACCESS_BLOCKED** | Common App/Studiekeuze/OUInfo routes blocked or gated |
| `application_fee` | **ACCESS_BLOCKED** | Common App/Studiekeuze/OUInfo routes blocked or gated |
| `IELTS overall` | **NO_VERIFIED_SCALABLE_SOURCE** | Existing Common App/IPEDS records expose policy/indicator fields, not a verified numeric IELTS threshold |
| `IELTS subscores` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified numeric subscore source |
| `TOEFL` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified numeric TOEFL threshold source; existing routes expose only policy/indicator fields |
| `Duolingo` | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable numeric source |
| `standardized-test requirements` | **ACCESS_BLOCKED** | Common App/IPEDS test indicators, routes blocked |
| `minimum degree` | **ACCESS_BLOCKED** | OUInfo/IPEDS evidence, target access blocked |
| `minimum GPA` | **ACCESS_BLOCKED** | OUInfo/IPEDS schemas, target access blocked |
| `GPA scale` | **NO_VERIFIED_SCALABLE_SOURCE** | Inspected schemas expose GPA/grade indicators or ranges, not a verified programme GPA scale |
| `subject prerequisites` | **ACCEPTED_EXTERNAL** | Explicit Susa eligibility text |
| `required documents` | **ACCESS_BLOCKED** | IPEDS ADM indicators verified, NCES target retrieval blocked |
| `recommendation letters` | **ACCESS_BLOCKED** | IPEDS ADM indicator verified, NCES target retrieval blocked |
| `SOP / essays` | **ACCESS_BLOCKED** | IPEDS personal-statement indicator verified, route blocked |
| `portfolio` | **ACCESS_BLOCKED** | IPEDS portfolio indicator verified, route blocked |
| `work experience` | **ACCESS_BLOCKED** | IPEDS work-experience indicator verified, route blocked |
| `scholarships` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative field-bearing source |
| `scholarship amount` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative amount source |
| `funding` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative field-bearing source |
| `funding amount` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative amount source |
| `funding eligibility` | **NO_VERIFIED_SCALABLE_SOURCE** | No retained authoritative eligibility source |
| `programme status` | **VERIFIED_SOURCE_READY_FOR_IMPLEMENTATION** | Susa has registry `ACTIVE`; existing validator correctly requires admissions-state wording |
| `explicit academic/programme cycle` | **NO_VERIFIED_SCALABLE_SOURCE** | Susa has source-native intake/registry dates, not a cycle field |

## H. Direct / H1 / H2 / H3 / H4

The unchanged hierarchy evaluator was run over the five accepted Susa rows:
[`susa-navet-hierarchy.json`](susa-navet-hierarchy.json).

All five are direct programme assertions (identity, credential, intake,
closing date, prerequisites). H1, H2, H3 and H4 each have zero candidates,
zero usable donors and zero applied in this one-programme population; there is
no compatible independent donor. The evaluator reports one direct slot per
accepted field and one direct abstention per field because the target already
has a direct fact. No hierarchy compatibility gate was changed.

## I. Tests and artifact paths

- `python -m pytest -q services/data-ingestion/tests/test_external_field_evidence.py` -> 18 passed.
- `python -m pytest -q services/data-ingestion/tests/test_semantic_acceptance.py` -> 47 passed (includes the `Application closing date` regression).
- `python -m pytest -q services/data-ingestion/tests` -> 655 passed.
- `python services/data-ingestion/run.py validate-config --config docs/architecture/data/external-zero-field-discovery-20260914/susa-navet-smoke.json` -> 1 institution, valid.
- Provider catalogue JSON parse -> 32 providers, valid.
- Durable smoke run -> 1/1 institution completed, 2/2 sources persisted, 0 errors.
- Hierarchy smoke -> 5 direct accepted rows; H1-H4 all zero.

Primary artifacts:

- [`susa-navet-smoke.json`](susa-navet-smoke.json)
- [`source-verification-ledger.json`](source-verification-ledger.json)
- [`runs/susa-navet-20260914-kth-deadline-fix/coverage_report.json`](runs/susa-navet-20260914-kth-deadline-fix/coverage_report.json)
- [`runs/susa-navet-20260914-kth-deadline-fix/external_field_materializations.jsonl`](runs/susa-navet-20260914-kth-deadline-fix/external_field_materializations.jsonl)
- [`runs/susa-navet-20260914-kth-deadline-fix/field_assertions.jsonl`](runs/susa-navet-20260914-kth-deadline-fix/field_assertions.jsonl)
- [`runs/susa-navet-20260914-kth-deadline-fix/effective_field_assertions.jsonl`](runs/susa-navet-20260914-kth-deadline-fix/effective_field_assertions.jsonl)
- [`runs/susa-navet-20260914-kth-deadline-fix/semantic_acceptance_decisions.jsonl`](runs/susa-navet-20260914-kth-deadline-fix/semantic_acceptance_decisions.jsonl)
- [`susa-navet-hierarchy.json`](susa-navet-hierarchy.json)

No commit or push was made.
