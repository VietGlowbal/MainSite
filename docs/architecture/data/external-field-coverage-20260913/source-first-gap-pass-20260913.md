# Source-first external field coverage pass — 2026-09-13

This pass stayed within the external-provider objective. It reused the
verified provider ledger and extended the existing Onisep Idéo government
dataset because a real programme-cost row was verified. No official-university
crawl, resolver redesign, general acceptance relaxation, H1–H4 change,
uncertainty change, storage change, promotion-logic change, canonical-truth change,
or Benchmark V3 work was performed.

## A. Remaining-gap matrix before this pass

| Priority group | State before pass | Source-first result |
| --- | --- | --- |
| Programme tuition | Zero at programme scope; only institution tuition existed | Onisep row verified and accepted below |
| Programme mandatory/additional fees | Zero at programme scope | No compliant accessible row admitted |
| Deadlines, priority/funding/international/final deadlines, intakes, rolling admission, application fee | Zero | Common App/OUInfo routes blocked; Studiekeuze123 gated |
| Minimum degree, GPA, GPA scale, prerequisites | Zero | IPEDS/OUInfo fields inspected; compliant target retrieval blocked |
| IELTS, subscores, TOEFL, Duolingo, standardized tests | Zero numeric thresholds | Flags/schemas inspected, but no compliant target evidence |
| Documents, recommendations, SOP/essay, portfolio, work experience | Zero | IPEDS ADM schema has several indicators; bulk access blocked |
| Scholarships and funding | Zero | No verified scalable field-bearing source retained |
| Programme status | Zero | CRICOS/MonMaster fields verified, routes blocked |
| Duration, location, delivery mode | Existing external metadata only (Discover Uni/DUO) | Onisep adds explicit French programme metadata |

The full candidate ledger (including previously verified providers and prior
rejections) remains at
[`source-verification-ledger.json`](source-verification-ledger.json).

## B. Providers researched and real schemas/records inspected

| Provider/ecosystem | Official resource and real sample | Verified fields and semantics | Access/decision |
| --- | --- | --- | --- |
| **Onisep Idéo** (France) | [dataset page](https://opendata.onisep.fr/data/605344579a7d7/2-ideo-actions-de-formation-initiale-univers-enseignement-superieur.htm), [CSV export](https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv) | 32-column semicolon CSV. Exact `UAI=0561687E`, `AF.5992`: programme label, `FOR type=licence`, certificate nature, `AF coût scolarité`, duration `3 ans`, mode `temps plein, cours en présentiel`, location `Arradon`; source row also has update metadata. Programme scope; UAI + AF identifiers; cost text explicitly says `3470 à 6600 euros par an` and `... en 2026`; `AF date de modification=26/03/2026` is an update date, not an academic cycle. | HTTP 200 public CSV, robots-compliant; **EXTEND_EXISTING / IMPLEMENTED**. |
| Discover Uni / HESA static route | [exact Nottingham course](https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/) | Exact `PUBUKPRN`, `KISCourse`, `KISMODE`; programme identity, award, course length, location, mode and labelled career/employment observations. Outcome periods remain source-native (not academic cycles). | Static route accessible and already implemented. |
| HESA Unistats distribution | [HESA tools/downloads](https://www.hesa.ac.uk/support/tools-and-downloads/unistats) | Official XML/CSV course-distribution schema documented; no retrieved package added fields beyond the accessible Discover Uni route in this pass. | **ACCESS_BLOCKED / DEFER** for bulk distribution; no adapter added. |
| DUO RIO | [dataset](https://onderwijsdata.duo.nl/datasets/ho_opleidingsoverzicht), [package API](https://onderwijsdata.duo.nl/api/3/action/package_show?id=ho_opleidingsoverzicht), [Datastore API](https://onderwijsdata.duo.nl/api/3/action/datastore_search) | Exact filtered row `ONDERWIJSBESTUURID=107B605`, `OPLEIDINGSEENHEIDCODE=1001O8897`; name, `GRAAD=MASTER`, level, ECTS, offering dates, `VOERTAAL=NLD`, form/flags. Dates and language are source metadata, not deadlines, duration or IELTS/TOEFL. | Public CKAN JSON; **IMPLEMENTED** (existing). |
| IPEDS / NCES | [complete data files](https://nces.ed.gov/Ipeds/help/complete-data-files), [ADM 2024 form](https://nces.ed.gov/ipeds/use-the-data/download-survey-material/2024/admissions/package_14_102.pdf) | `UNITID`; institution-level ADM selection indicators (GPA/rank, recommendations, portfolio, English, SAT/ACT, work experience, personal statement) and numeric test percentiles. MIT `166683`, Cornell `190415` were verified identifiers. COST1 finance is institution scope and duplicates Scorecard for this objective. | Schema real; target bulk/profile retrieval blocked in this environment. **ACCESS_BLOCKED / DEFER**, no adapter. |
| Common App | [requirements grid](https://content.commonapp.org/Files/ReqGrid.pdf) | Institution/applicant-policy row exposes first-year deadlines, US/international fees, testing and English flags. | Published route is robots-blocked; **NO COMPLIANT ACCESS PATH / DEFER**. |
| CRICOS | [verified course record](https://cricos.education.gov.au/Course/CourseDetails.aspx?CourseCode=0101866) | Exact course code `0101866`; identity, credential/status, tuition, non-tuition fee, estimated total cost, duration and location. | Direct and data.gov.au distribution routes are robots-blocked; **NO COMPLIANT OFFICIAL ACCESS / DEFER**. |
| Studiekeuze123 professional OData | [official portal](https://www.studiekeuze123.nl/) | Documentation/metadata indicate programme, intake/deadline, admission and outcome fields. | Registration/licensing/terms required; no licensed row retained. **ACCESS_GATED / DEFER**. |
| Mon Master | [official API catalogue](https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-mon_master) | Real record contained mention/parcours, alternance, modality, place, session and capacity/outcome counts. | Official `/api/` access is robots-disallowed. **ACCESS_BLOCKED / DEFER**. |
| OUInfo / OUAC | [real programme record](https://ouinfo.ca/programs/orc/) | CS degree, English, grade range, subject prerequisites, Ottawa location, 2027–28 validity. | `robots.txt` disallows the site; no official API/export found. **ACCESS_BLOCKED / DEFER**. |
| Parcoursup open data | [official dataset](https://data.education.gouv.fr/explore/dataset/fr-esr-parcoursup/) | Aggregate formation identity/location/UAI/code and application/admission statistics; no detailed programme deadline, GPA or requirement fields in the inspected schema. | **NO_VERIFIED_SCALABLE_SOURCE** for the missing detailed fields; no adapter. |

Other national/indicator candidates in the ledger (StatCan, Course Seeker,
Singapore MOE, Japan e-Stat, Eurostat, UNESCO UIS, accreditation registries,
and catalogue search endpoints) were rejected/deferred because they duplicate
existing institution/identity coverage, expose aggregates rather than the
missing product fields, or had no compliant target-access route. No new
provider was added merely to increase provider count.

## C. Verified useful source and D. adapter work

Onisep is the only source extended in this pass. The existing declarative
`government_dataset` adapter now supports the source-native row context needed
by this record:

- `schema_context` is rendered beside the selected source row without adding
  facts;
- a configured credential column (`FOR type`) is retained with the tuition
  line;
- a declarative `render_pattern` exposes only the annual segment of the cost
  text; the durable raw CSV remains unchanged;
- tuition evidence is re-anchored to the complete materialised source line if
  the model returns a truncated quote;
- French `par an` is treated as a source-native annual/year basis only.

These are narrow external structured-data propagation fixes. They do not
change generic resolver gates or acceptance policy. No blocked provider was
bypassed and no factual value was hard-coded.

## E. Bounded external validation and new accepted coverage

Run: [`onisep-programme-fee-rerun-20260913h`](runs/onisep-programme-fee-rerun-20260913h/).

The run used the existing durable Mongo/object-store path, remote raw mode and
`max_local_temp_bytes=0`:

| Metric | Onisep result |
| --- | ---: |
| Fetches | 2 (anchor + deep; same source hash) |
| Durable raw sources persisted | 2 object-store documents, one unique 26.5 MB CSV hash; no local heavy copy |
| Exact field materialisation | 1 row (`UAI=0561687E` + `AF.5992`), 4 non-null semantic field candidates |
| Metadata materialisations | 3 (`duration`, `delivery_mode`, `campus`), all `RULE_VALIDATED` catalogue observations |
| Semantic proposals | 4 non-null: identity 1, credential 1, tuition 2 (EUR 3470 and 6600/year) |
| Effective accepted assertions | **3**, all `OBSERVED`, `RULE_VALIDATED`, programme scope |
| Errors / rejected assertions | 0 / 0 |

For context, the accepted external baseline that was not re-fetched in this
Onisep-only smoke remains:

| Provider | Country | Field | Scope | Accepted count |
| --- | --- | --- | --- | ---: |
| College Scorecard | US | `tuition` | institution | 4 |
| swissuniversities | CH | `tuition` | institution | 2 |
| swissuniversities | CH | `additional_fees` | institution | 1 |
| Onisep Idéo (previous Sorbonne rows) | FR | `programme_identity` + `credential` | programme | 4 |
| Discover Uni | UK | `programme_identity` | programme | 1 |
| Discover Uni | UK | `credential` | programme | 1 |
| Discover Uni | UK | `career_outcomes` | programme | 8 |
| Discover Uni | UK | `employment_outcomes` | programme | 7 |
| DUO RIO | NL | `programme_identity` | programme | 1 |
| DUO RIO | NL | `credential` | programme | 1 |

The current external effective baseline plus this pass is therefore 33 accepted
rows (10 rows in the hierarchy smoke when restricted to the current Scorecard,
Swiss and UCO Onisep exact-target fixtures; the prior Sorbonne Onisep and
Discover Uni/DUO rows remain in their existing artifacts).

Accepted assertion breakdown:

| Provider | Country | Field | Scope | Accepted value |
| --- | --- | --- | --- | --- |
| Onisep Idéo | FR | `programme_identity` | programme | `licence mention information-communication` |
| Onisep Idéo | FR | `credential` | programme | `licence` |
| Onisep Idéo | FR | `tuition` | programme | **EUR 3,470 per year**; the source literal is `3,470–6,600 euros per year, according to income` |

The source range produced two semantic amount proposals. The existing
effective-bundle selection kept one point value (the lower endpoint) for the
single tuition slot; the complete range remains in the evidence line and the
competing proposal is retained in `field_assertions.jsonl`. No total cost,
audience, or academic cycle was invented. The `2026` text and `26/03/2026`
record update are source-native temporal context only.

The three additional source-backed programme metadata observations are:

- duration: `3 ans`;
- delivery mode: `temps plein, cours en présentiel`;
- location/campus: `Arradon`.

## F. Previously-zero groups now covered

- **Programme tuition:** `ACCEPTED_EXTERNAL` at programme scope (Onisep,
  annual EUR observation; range preserved in evidence).
- **Programme duration/location/delivery mode:** `ACCEPTED_EXTERNAL` as
  deterministic catalogue metadata (Onisep; these groups already had narrower
  Discover Uni/DUO metadata coverage).
- Programme identity and credential were already accepted externally and were
  revalidated for the exact Onisep row.
- Career and employment outcomes remain accepted from Discover Uni; this pass
  did not alter that route.

No accepted programme-level mandatory fee, deadline/intake, language
threshold, eligibility/GPA, document, scholarship/funding or programme-status
assertion was manufactured.

## G. Direct/H1/H2/H3/H4 contribution

The frozen hierarchy engine was evaluated unchanged over the accepted
Scorecard, swissuniversities and current Onisep effective rows (7 programme
targets, 4 institutions). The artifact-only evaluation command used the
existing evaluator with the current Onisep run substituted; it did not modify
the engine.
Discover Uni/DUO were not re-fetched for this provider-only change; their
unchanged direct/outcome hierarchy result is retained in
[`external-coverage-bounded-20260913i.json`](../external-field-expansion-20260913/hierarchy/external-coverage-bounded-20260913i.json).

| Field | Direct | H1 | H2 | H3 | H4 | Abstentions | H2 candidates | Support / uncertainty |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `tuition` | **1** (Onisep UCO) | 0 | 0 | 0 | 0 | 6 | 12 | Direct row has no donor support; inherited rows have no accepted compatible donor |
| `additional_fees` | 0 | 0 | 0 | 0 | 0 | 7 | 2 | No compatible donor |
| `programme_identity` | 1 | 0 | 0 | 0 | 0 | 6 | 0 | Direct only; no hierarchy transfer |
| `credential` | 1 | 0 | 0 | 0 | 0 | 6 | 0 | Direct only; no hierarchy transfer |

Usable external donors after the unchanged compatibility gates:

- tuition: **0 inherited donors** (the new Onisep value is direct only);
- mandatory/additional fees: **0**;
- admissions/deadlines: **0**;
- language/test: **0**;
- funding: **0**.

The new direct programme assertion therefore does not silently become an
institution or peer value.

## H. Remaining gaps and I. next candidates

No new provider is justified by this pass. The remaining statuses below are
the stopping result after inspecting a real schema/record and access route;
they are not invitations to bypass a restriction. The next scale-up candidate
is the same Onisep CSV across more exact UAI+AF identifiers. CRICOS/Common App,
HESA bulk and Studiekeuze123 require a compliant access-state change before
implementation.

## J. Final priority field-state matrix

| Field | Final state | Evidence / stopping reason |
| --- | --- | --- |
| Programme tuition | **ACCEPTED_EXTERNAL** | Onisep UCO programme row, EUR annual source range; effective 3,470 lower endpoint |
| Programme mandatory/additional fees | **ACCESS_BLOCKED** | ETH compulsory fees are accepted at institution scope; CRICOS has programme non-tuition-fee schema, but official routes are robots-blocked |
| Priority deadline | **ACCESS_BLOCKED** | Common App/OUInfo real fields, no compliant route |
| International deadline | **ACCESS_BLOCKED** | Common App/OUInfo real fields, no compliant route |
| Final deadline | **ACCESS_BLOCKED** | Common App/OUInfo real fields, no compliant route |
| Funding deadline | **NO_VERIFIED_SCALABLE_SOURCE** | No verified external source with this field |
| Intakes | **ACCESS_BLOCKED** | Common App/Studiekeuze123/OUInfo routes blocked or gated |
| Rolling admission | **ACCESS_BLOCKED** | Common App/Studiekeuze123/OUInfo routes blocked or gated |
| Application fee | **ACCESS_BLOCKED** | Common App/Studiekeuze123/OUInfo routes blocked or gated |
| Minimum degree | **ACCESS_BLOCKED** | OUInfo/IPEDS evidence exists, target access blocked |
| Minimum GPA | **ACCESS_BLOCKED** | OUInfo/IPEDS schemas inspected, no compliant retrieval |
| GPA scale | **ACCESS_BLOCKED** | OUInfo/IPEDS schemas inspected, no compliant retrieval |
| Subject prerequisites | **ACCESS_BLOCKED** | OUInfo record verified, robots-blocked |
| IELTS | **ACCESS_BLOCKED** | Common App/IPEDS schema evidence is blocked; no compliant threshold route |
| IELTS subscores | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable numeric subscore source |
| TOEFL | **ACCESS_BLOCKED** | Common App/IPEDS schema evidence is blocked; no compliant threshold route |
| Duolingo | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable source in inspected ecosystems |
| Standardized-test requirements | **ACCESS_BLOCKED** | Common App/IPEDS test fields, routes blocked |
| Required documents | **ACCESS_BLOCKED** | IPEDS ADM indicators verified, NCES target distribution blocked |
| Recommendation letters | **ACCESS_BLOCKED** | IPEDS ADM indicators verified, NCES target distribution blocked |
| SOP / essays | **ACCESS_BLOCKED** | IPEDS personal-statement indicator verified, NCES target distribution blocked |
| Portfolio | **ACCESS_BLOCKED** | IPEDS portfolio indicator verified, NCES target distribution blocked |
| Work experience | **ACCESS_BLOCKED** | IPEDS work-experience indicator verified, NCES target distribution blocked |
| Scholarships | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable authoritative field-bearing source retained |
| Scholarship amount | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable authoritative field-bearing source retained |
| Funding | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable authoritative field-bearing source retained |
| Funding amount | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable authoritative field-bearing source retained |
| Funding eligibility | **NO_VERIFIED_SCALABLE_SOURCE** | No verified scalable authoritative field-bearing source retained |
| Programme status | **ACCESS_BLOCKED** | CRICOS/MonMaster status/session fields, official machine routes blocked |
| Programme duration / location / delivery mode | **ACCEPTED_EXTERNAL** | Onisep deterministic metadata plus existing Discover Uni/DUO metadata |
| Programme language context | **ACCEPTED_EXTERNAL** | DUO RIO literal `VOERTAAL`; this is not a test threshold |
| Career / employment outcomes | **ACCEPTED_EXTERNAL** | Existing Discover Uni programme-qualified observations |

## K. Tests and artifact paths

Measured checks:

- `rtk pytest -q services/data-ingestion/tests/test_external_field_evidence.py services/data-ingestion/tests/test_semantic_acceptance.py` → **63 passed**;
- `rtk pytest -q tests` from `services/data-ingestion` → **647 passed**;
- `rtk cmd /c python -m compileall -q services/data-ingestion/src` → **pass**;
- provider catalogue JSON parse → **pass**;
- `run.py validate-config` for
  [`onisep-programme-fee-bounded-20260913.json`](onisep-programme-fee-bounded-20260913.json)
  → **ok**;
- bounded durable run → **ok**, 1/1 institution completed, 2/2 sources
  persisted, 0 errors;
- unchanged hierarchy evaluator smoke → **pass**, direct Onisep tuition/identity/credential present, H1–H4 all zero.

Primary evidence files:

- [`coverage_report.json`](runs/onisep-programme-fee-rerun-20260913h/coverage_report.json)
- [`raw_persistence_events.jsonl`](runs/onisep-programme-fee-rerun-20260913h/raw_persistence_events.jsonl)
- [`external_field_materializations.jsonl`](runs/onisep-programme-fee-rerun-20260913h/external_field_materializations.jsonl)
- [`field_assertions.jsonl`](runs/onisep-programme-fee-rerun-20260913h/field_assertions.jsonl)
- [`effective_field_assertions.jsonl`](runs/onisep-programme-fee-rerun-20260913h/effective_field_assertions.jsonl)
- [`review_queue.json`](runs/onisep-programme-fee-rerun-20260913h/review_queue.json)
- [`external_programme_metadata.jsonl`](runs/onisep-programme-fee-rerun-20260913h/external_programme_metadata.jsonl)
- [`sources.jsonl`](runs/onisep-programme-fee-rerun-20260913h/sources.jsonl)
- [`source-first-fee-pass-20260913.json`](hierarchy/source-first-fee-pass-20260913.json)

No commit or push was made.
