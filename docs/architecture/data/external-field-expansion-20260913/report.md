# External field-bearing expansion — 2026-09-13

> Continuation results for the source-first Discover Uni and DUO RIO pass are
> in [`coverage-rerun-report.md`](coverage-rerun-report.md). This document
> records the earlier Onisep/Scorecard/swissuniversities expansion snapshot.

This pass kept the durable raw rail, field materialisation, semantic
acceptance, provenance/bundle selection, cycle handling and H1–H4 engine
unchanged. It added one verified provider adapter/configuration and one
generic cache-retention correction required for programme-linked views of a
shared national export.

## A. External provider coverage map by country

| Country/region | Provider/resource | Decision | Verified target yield |
| --- | --- | --- | --- |
| United States | College Scorecard bulk | IMPLEMENT (existing, rerun) | institution tuition: 4 accepted observations |
| United States | IPEDS bulk | DEFER | configured institution/tuition/programme taxonomy; no new bounded target run |
| United States | Common App grid | DEFER | admissions/deadline/test fields verified in prior inspection; direct access blocked |
| Australia | CRICOS live register | DEFER | programme tuition/fees/status/duration verified; direct access blocked |
| Australia | CRICOS data.gov.au CSV export | DEFER | exact programme row and tuition/fee fields verified; portal robots.txt blocks the official export |
| Australia | Course Seeker | DEFER | comparison fields documented; no compliant machine endpoint verified |
| Canada | Statistics Canada table 37-10-0121 | REJECT for target assertions | aggregate tuition/compulsory fees by level; no institution/programme key |
| United Kingdom | HESA/Discover Uni | DEFER | official distribution describes XML/CSV course data; live package access not verified |
| France | Onisep Idéo initial higher-education CSV | IMPLEMENT | programme identity and credential: 4 accepted observations |
| Germany | anabin | DEFER | recognition registry; no bounded field-bearing row retained |
| Switzerland | swissuniversities tuition table | IMPLEMENT (existing, rerun) | 2 tuition + 1 compulsory-fee observation accepted |
| Netherlands | Studiekeuze123/RIO/HOVI | DEFER | programme/deadline/admission/outcome fields documented; professional access gated |
| Singapore | MOE data.gov.sg course statistics | REJECT for target assertions | course-category intake/enrolment/graduates; no stable target programme key |
| Japan | e-Stat | DEFER | official API configured; target programme schema/credentials not verified |
| European Union | Eurostat education API | REJECT for target assertions | national indicators only |
| Global | UNESCO UIS | REJECT for target assertions | national indicators only |

The full source ledger, including URLs, schema samples, identifiers, scope,
temporal semantics, access state and decisions, is
[`source-verification-ledger.json`](source-verification-ledger.json).

## B. Provider → verified field matrix

| Provider | Identity/credential | Tuition/fees | Admissions/deadlines | Language/tests | Funding/outcomes | Scope |
| --- | --- | --- | --- | --- | --- | --- |
| College Scorecard bulk | institution identifiers | tuition | — | — | — | institution |
| swissuniversities | institution row | domestic/foreign tuition; compulsory fees | — | — | — | institution |
| Onisep Idéo | programme label; qualification type; certificate nature | schooling-cost column is empty for both bounded Sorbonne rows | — | — | — | programme |
| CRICOS | course identity/status/credential | tuition and non-tuition fee | intake field is not guaranteed | — | — | programme |
| Common App | institution row | application fee | deadlines/rolling/test policy | English requirement | — | institution |
| HESA/Discover Uni | course/institution identifiers | course finance fields are documented | admissions fields are documented | — | outcomes documented | programme |
| Studiekeuze123/RIO/HOVI | programme/diploma/ECTS | statutory tuition context | intakes/deadlines/admission rules | — | employment indicators | programme |
| Singapore MOE | course categories | — | — | — | intake/enrolment/graduates | aggregate |
| Eurostat/UNESCO/e-Stat | national statistical dimensions | — | — | — | national indicators | national |

## C. Implemented, extended and rejected

Measured ledger totals: 17 provider candidates researched; 10 had an actual
field-bearing row or API response inspected, 3 were implemented, 9 deferred,
and 5 rejected for the target assertion contract. The verified count includes
deferred/rejected resources whose scope or access policy prevents safe target
assertions.

Implemented/extended:

- `onisep_higher_ed`: added to
  [`external-providers.json`](../../../../services/data-ingestion/configs/external-providers.json), with semicolon CSV parsing, exact UAI + Onisep AF matching, source-native update metadata, programme scope and no inferred cycle.
- Existing `college_scorecard_bulk` and `swissuniversities_tuition` were rerun
  through the frozen provider bridge and acceptance rail.
- The configured-source cache now keys views by canonical URL plus programme
  link, drops unmatched external views, and retains programme-linked matches.
  This is generic and does not change factual dedupe/conflict policy.

Rejected/deferred candidates were not turned into evidence adapters merely from
documentation claims. Aggregate national statistics remain context-only unless
an exact target identifier and safe scope are available.

## D. Accepted external assertions

Combined accepted-only hierarchy input contains 11 unique `OBSERVED` rows:

| Provider | Country | Field | Scope | Institution/programme | Value/context |
| --- | --- | --- | --- | --- | --- |
| College Scorecard | US | tuition | institution | MIT | USD 53,450/year, domestic; USD 53,450/year, international; `academic_cycle=null`; Most-Recent-Cohorts snapshot |
| College Scorecard | US | tuition | institution | Cornell | USD 59,282/year, domestic; USD 59,282/year, international; `academic_cycle=null`; Most-Recent-Cohorts snapshot |
| swissuniversities | CH | tuition | institution | ETH Zurich | CHF 730/semester domestic; CHF 2,190/semester international; cycle 2026–2027 |
| swissuniversities | CH | additional_fees | institution | ETH Zurich | CHF 74/semester compulsory fee; cycle 2026–2027 |
| Onisep Idéo | FR | programme_identity | programme | Sorbonne Licence Informatique; Sorbonne Master Informatique | source-native labels `licence mention informatique` and `master mention informatique` |
| Onisep Idéo | FR | credential | programme | Sorbonne Licence Informatique; Sorbonne Master Informatique | source-native `licence` and `master` |

Onisep raw snapshot hash:
`bf0ff9a929fecfe1974dcc64639baec0496be306ce750ce9211f611329408104`.
The bounded run used exact AF.86527 (Licence) and AF.84654 (Master) rows;
both assertions retain `academic_cycle=null`, CSV parser `csv-structured/v2`,
provider `onisep_higher_ed`, dataset
`ideo-actions-formation-initiale-univers-enseignement-superieur`, and run
`onisep-sorbonne-bounded-20260913d`.

The Onisep dataset and export are official resources:
[dataset description](https://www.data.gouv.fr/datasets/ideo-actions-de-formation-initiale-univers-enseignement-superieur),
[CSV export](https://api.opendata.onisep.fr/downloads/605344579a7d7/605344579a7d7.csv).

## E. Coverage before vs after

| Metric | Before this expansion pass | After |
| --- | ---: | ---: |
| Implemented external field-bearing providers in this pass | 2 validated providers | 3 validated providers |
| Accepted external assertions | 7 (Scorecard + swissuniversities) | 11 (plus 4 Onisep) |
| Accepted programme identity assertions | 0 | 2 |
| Accepted credential assertions | 0 | 2 |
| Accepted institution tuition assertions | 4 | 6 |
| Accepted institution compulsory/additional fee assertions | 1 | 1 |
| Accepted programme-level tuition/deadline/admission/language/funding/outcome assertions | 0 | 0 |

The Onisep bounded run itself completed one institution, discovered two
programmes, persisted three source fetches, materialised two exact rows, made
four non-null semantic proposals, and accepted all four as `RULE_VALIDATED`
`OBSERVED` assertions. Its remaining six requested slots were explicit
`NOT_PUBLISHED`/null rather than inferred.

## F. Direct and H1–H4 contribution

The existing H1–H4 engine was run unchanged over eight bounded target
programmes (MIT, Cornell, ETH Zurich and Sorbonne targets) and the 11 accepted
external rows. “Candidate slots” counts donor candidates considered at a level;
“usable/applied” counts candidates that passed existing compatibility and were
actually used.

| Field | Direct | H1 candidates/usable/applied | H2 candidates/usable/applied | H3 candidates/usable/applied | H4 candidates/usable/applied | Abstentions excluding direct |
| --- | ---: | --- | --- | --- | --- | ---: |
| tuition | 0 | 0/0/0 | 12/0/0 | 0/0/0 | 0/0/0 | 8 |
| additional_fees | 0 | 0/0/0 | 2/0/0 | 0/0/0 | 0/0/0 | 8 |
| programme_identity | 2 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | 6 |
| credential | 2 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 | 6 |

Thus usable external tuition donors = **0** and usable external fee donors =
**0** under the unchanged compatibility gates. The six tuition donors and one
fee donor remain provenance-complete accepted observations, but H2 rejects them
for existing degree/target compatibility; cross-institution H4 rejects them for
`PEER_ATTRIBUTES_UNVERIFIED`. No H1 parent or H3 sibling records were supplied.
Support counts and uncertainty are therefore empty/not measurable for applied
donors. This is safe abstention, not scope narrowing.

## G. Access and robots blockers

- CRICOS direct course fetch remains blocked by the existing robots policy; its
  verified course schema is retained as a deferred compliant-provider target.
- Common App's official requirements grid is verified but direct retrieval is
  robots-blocked in the bounded environment.
- HESA/Discover Uni's official distribution page describes machine-readable
  Unistats data, but the live distribution/package path was not retrievable in
  this pass. See [HESA Unistats distribution](https://www.hesa.ac.uk/support/tools-and-downloads/unistats)
  and [Discover Uni provider information](https://discoveruni.gov.uk/information-providers/).
- Course Seeker is an official Australian comparison service, but no compliant
  API/bulk/static export was verified; see the [Australian Government course
  finder](https://www.education.gov.au/higher-education/find-course-study).
- The official CRICOS bulk CSV is field-bearing and matches exact provider/course
  identifiers (for example UNSW CRICOS `00098G`/`0101866`), but the
  `data.gov.au` host currently disallows `/` in `robots.txt`; it was inspected
  for schema only and not fetched through the ingestion rail. The [CRICOS
  dataset](https://data.gov.au/data/dataset/cricos) remains a deferred candidate.
- Studiekeuze123 professional OData access is gated by provider terms; no live
  licensed row was retained. Its official source catalogue documents the
  programme/deadline/admission/outcome fields.

No robots policy was bypassed and no blocked source was promoted to evidence.

## H. Priority fields without a verified scalable accepted source

Every requested priority slot is classified below. `REVIEW_EXTERNAL` is empty
in this bounded pass because no non-null external proposal was left in review;
all implemented provider outputs were accepted or explicitly null.

| Priority field | External status | Basis |
| --- | --- | --- |
| programme identity | `ACCEPTED_EXTERNAL` | Onisep programme rows |
| credential | `ACCEPTED_EXTERNAL` | Onisep qualification rows |
| programme status | `ACCESS_BLOCKED` | CRICOS status field verified, live/bulk paths blocked |
| academic cycle | `SOURCE_FOUND_NO_SAFE_MATCH` | Scorecard/Onisep publish source-native snapshots/update dates, not cycles |
| tuition | `ACCEPTED_EXTERNAL` | Scorecard, swissuniversities |
| mandatory fees | `ACCEPTED_EXTERNAL` | swissuniversities compulsory-fee row |
| additional fees | `ACCEPTED_EXTERNAL` | swissuniversities compulsory-fee row |
| application fee | `ACCESS_BLOCKED` | Common App grid field verified, retrieval blocked |
| intakes | `NO_VERIFIED_SOURCE` | no exact target programme export retained |
| priority deadline | `ACCESS_BLOCKED` | Common App deadline field verified, retrieval blocked |
| funding deadline | `ACCESS_BLOCKED` | Common App deadline field verified, retrieval blocked |
| international deadline | `ACCESS_BLOCKED` | Common App deadline field verified, retrieval blocked |
| final deadline | `ACCESS_BLOCKED` | Common App deadline field verified, retrieval blocked |
| rolling admission | `ACCESS_BLOCKED` | Common App policy field verified, retrieval blocked |
| minimum degree | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| minimum GPA | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| GPA scale | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| subject prerequisites | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| IELTS | `ACCESS_BLOCKED` | Common App language field verified, retrieval blocked |
| IELTS subscores | `NO_VERIFIED_SOURCE` | no exact subscore row retained |
| TOEFL | `ACCESS_BLOCKED` | Common App test-policy field verified, retrieval blocked |
| Duolingo | `NO_VERIFIED_SOURCE` | no exact target row retained |
| standardized tests | `ACCESS_BLOCKED` | Common App test-policy field verified, retrieval blocked |
| required documents | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| recommendation letters | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| SOP / essays | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| portfolio | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| work experience | `NO_VERIFIED_SOURCE` | no scalable external target row retained |
| scholarships | `NO_VERIFIED_SOURCE` | no external scholarship registry row retained |
| scholarship amount | `NO_VERIFIED_SOURCE` | no external scholarship amount row retained |
| funding | `NO_VERIFIED_SOURCE` | no external funding record retained |
| funding amount | `NO_VERIFIED_SOURCE` | no external funding amount row retained |
| funding eligibility | `NO_VERIFIED_SOURCE` | no external funding eligibility row retained |
| career outcomes | `ACCESS_BLOCKED` | HESA/Studiekeuze outcome fields documented, package/access unavailable |
| employment outcomes | `ACCESS_BLOCKED` | HESA/Studiekeuze outcome fields documented, package/access unavailable |
| programme duration | `SOURCE_FOUND_NO_SAFE_MATCH` | Onisep exposes duration, but frozen assertion contract has no slot |
| campus/location | `SOURCE_FOUND_NO_SAFE_MATCH` | Onisep exposes commune/region, but no accepted slot |
| delivery mode | `SOURCE_FOUND_NO_SAFE_MATCH` | Onisep exposes study mode, but no accepted slot |

The Onisep duration/location/study-mode values were intentionally not relabelled
into another field, and Scorecard temporal metadata remains source-native rather
than being converted to an academic cycle.

## I. Recommended next scale-up order

1. Obtain a compliant HESA/Discover Uni distribution package and implement its
   UKPRN + KISCourse programme rows in one pass (identity, credential,
   admissions, tuition and outcomes).
2. Obtain a robots-compliant CRICOS bulk/API/static endpoint (the data.gov.au
   schema is already verified) and retain exact CRICOS provider/course-code
   matching for AU programme tuition/fees/duration.
3. Request licensed Studiekeuze123/RIO/HOVI OData access; implement one NL
   adapter for programme identity, diploma/ECTS, deadlines, admission rules and
   outcomes.
4. Run IPEDS COST1/C2024_A against bounded US identifiers to add institution
   finance/taxonomy corroboration where its native year and basis are explicit.
5. Only then revisit Canada/Singapore/Japan national datasets if a stable
   institution/programme identifier is exposed; do not turn aggregate tables
   into target-programme assertions.

## J. Tests and artifacts

Focused validation passed:

- `rtk pytest -q services/data-ingestion/tests/test_field_aware_source_selection.py` — 16 passed after the provider-view cache regression.
- Combined focused external materialisation/acquisition/selection suite — 74
  passed, including the programme-linked shared-export cache regression, CSV/
  JSON row-list handling and explicit-null-cycle cases.
- `rtk python -m compileall -q services/data-ingestion/src` — passed.
- `rtk python -m py_compile docs/architecture/data/external-field-expansion-20260913/evaluate_external_hierarchy.py` — passed.
- `rtk python docs/architecture/data/external-field-expansion-20260913/evaluate_external_hierarchy.py` — wrote the frozen-engine result to [`hierarchy/hierarchical-evaluation.json`](hierarchy/hierarchical-evaluation.json).

Primary artifacts:

- [`population-config.json`](population-config.json)
- [`source-verification-ledger.json`](source-verification-ledger.json)
- [`onisep-sorbonne-bounded-20260913d`](runs/onisep-sorbonne-bounded-20260913d/manifest.json)
- [`Onisep materialisations`](runs/onisep-sorbonne-bounded-20260913d/external_field_materializations.jsonl)
- [`Onisep assertions`](runs/onisep-sorbonne-bounded-20260913d/field_assertions.jsonl)
- [`hierarchical-evaluation.json`](hierarchy/hierarchical-evaluation.json)

No commit or push was performed.
