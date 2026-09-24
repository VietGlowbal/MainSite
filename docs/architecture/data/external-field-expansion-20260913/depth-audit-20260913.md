# External field-bearing depth audit - 2026-09-13

This pass stayed source-first and used only the already verified Discover Uni
and DUO RIO ecosystems. It did not add a provider, touch official university
web crawling, or change evidence resolution, acceptance policy, H1-H4,
uncertainty, storage, promotion, canonical truth, or Benchmark V3.

The bounded external-only rerun was
`external-coverage-bounded-20260913i`. It used the existing main-worktree
environment file `D:\projects\Glowbal\MainSite\.env.local`; credentials were
not printed. Both target institutions completed and both raw sources were
persisted through the durable rail.

## A. Discover Uni deep exploitation

Official sample: [Nottingham Computer Science with Year in Industry](https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/)
(`PUBUKPRN=10007154`, `KISCourse=G407`, `KISMODE=Full-time`). The retained
source is a government dataset/programme record and the exact target match is
the source-native institution/course route.

### Employment trace

The pre-depth external replay retained seven source-backed employment values,
but none were accepted. Depending on the model response shape, the concrete
acceptance diagnostic was `VALUE_SUPPORT_UNRESOLVED` or
`UNSUPPORTED_VALUE_FORMAT`; the source itself was not missing the values.

The new provider-gated deterministic parser reads the labelled cards from the
same snapshot. It creates seven unique semantic proposals and leaves the
source-labelled survey periods as context (never as an academic cycle).

| Stage | Result |
| --- | --- |
| Fetch/read | 1 Discover Uni HTML source, HTTP 200 |
| Durable raw persistence | 1 raw document; `raw_document_id=ffb4b6da-9c2a-40bb-9841-916ac4ff9111` in run `i` |
| Materialisation | 1 exact text-window materialisation; entity match `institution_name=University of Nottingham` |
| Unique employment proposals | 7 |
| Initial validation | 7 `NEEDS_REVIEW` structured employment assertions (high-risk fields) |
| Semantic acceptance | 7 `ACCEPT_WITH_UNKNOWN_CONTEXT`, all `RULE_VALIDATED` and `OBSERVED` |

Accepted programme-scoped values are:

1. `80%` go on to work and/or study, `15 months after the course`, for the
   explicitly named BSc graduates at The University of Nottingham.
2. `80%` of students go on to work and/or study; cohort
   `students graduating 2022-23`; source `Graduate Outcomes survey`.
3. `95%` in highly skilled work; cohort `students graduating 2021-23`.
4. `90%` Information Technology Professionals; cohort `students graduating
   2021-23`.
5. `5%` Business and public service associate professionals; cohort
   `students graduating 2021-23`.
6. `0%` in other work; cohort `students graduating 2021-23`.
7. `5%` in unknown work; cohort `students graduating 2021-23`.

All seven acceptance decisions have no blocking reason and record only
`AUDIENCE_UNKNOWN`: the page does not explicitly declare an audience dimension.
The exact period, population/cohort, percentage, occupation label (where
present), raw hash, source URL and run lineage remain attached. `academic_cycle`
is `null` because these are outcome periods, not programme-cycle labels.

### Other explicit course fields

The same source record also exposes and now retains as deterministic catalogue
metadata (not invented semantic facts):

| Source label | Literal value | Product treatment |
| --- | --- | --- |
| Study mode | `Full time` | `catalogue_attribute`; projected to programme/offering |
| Length | `4 year course` | `catalogue_attribute`; projected to programme |
| Location | `The University of Nottingham` | `catalogue_attribute`; projected to programme/offering campus |

No explicit current programme status was present. `Distance learning: Not
Available`, `Placement year: Compulsory`, `Year abroad: Not Available`, and
`Foundation year: Optional` are course characteristics, not a status or an
admission deadline, so they were not remapped. The run produced eight accepted
`career_outcomes` observations as well as the seven accepted employment rows.

## B. DUO RIO structured-record audit

Official source: [DUO RIO higher-education overview](https://onderwijsdata.duo.nl/datasets/ho_opleidingsoverzicht)
via the filtered [CKAN Datastore record](https://onderwijsdata.duo.nl/api/3/action/datastore_search?resource_id=ffffa7ad-e6a2-4ba7-9fc2-a09df4128555&limit=1&filters=%7B%22ONDERWIJSBESTUURID%22%3A%22107B605%22%2C%22OPLEIDINGSEENHEIDCODE%22%3A%221001O8897%22%7D).
The exact row is selected by `ONDERWIJSBESTUURID=107B605` and
`OPLEIDINGSEENHEIDCODE=1001O8897`; the API envelope is `result.records`.

The inspected row has 44 retained columns. The classification below covers
every column; `D` means `DIRECT_PRODUCT_FIELD`, `C` means `USEFUL_CONTEXT`,
`A` means `AMBIGUOUS`, and `N` means `NOT_RELEVANT` transport data.

| Classification | Columns |
| --- | --- |
| **D - DIRECT_PRODUCT_FIELD** | `OPLEIDINGSEENHEIDCODE`, `NAAM_LANG`, `INTERNATIONALE_NAAM`, `GRAAD`, `VORM`, `VOERTAAL`, `ONDERWIJSLOCATIECODE`, `ONDERWIJSLOCATIESTRAAT`, `ONDERWIJSLOCATIEPLAATS` |
| **C - USEFUL_CONTEXT** | `ONDERWIJSBESTUURID`, `ONDERWIJSBESTUUR_NAAM`, `ONDERWIJSAANBIEDERID`, `ONDERWIJSAANBIEDER_NAAM`, `SOORT`, `ERKENDEOPLEIDINGSCODE`, `ERKENNER`, `BEGINDATUM`, `EINDDATUM`, `NIVEAU`, `STUDIELAST`, `EQF`, `NLQF`, `WAARDEDOCUMENTSOORT`, `PENVOERDER`, `EIGENNAAM`, `EIGENNAAM_DUITS`, `EIGENNAAM_ENGELS`, `AANGEBODEN_OPLEIDING_BEGINDATUM`, `AANGEBODEN_OPLEIDING_EINDDATUM`, `EERSTE_INSTROOMDATUM`, `LAATSTE_INSTROOMDATUM`, `DEFICIENTIE`, `EISEN_WERKZAAMHEDEN`, `PROPEDEUTISCHE_FASE`, `STUDIEKEUZECHECK`, `VERSNELD_TRAJECT`, `AANGEBODEN_OPLEIDINGCODE`, `EIGEN_AANGEBODEN_OPLEIDINGSLEUTEL`, `OMSCHRIJVING` |
| **A - AMBIGUOUS** | `VARIANT_VAN`, `WEBSITE`, `SAMENWERKEND_MET`, `BUITENLANDSEPARTNER` |
| **N - NOT_RELEVANT** | `_id` (CKAN transport row number) |

The target values include `NAAM_LANG=Data Science and Artificial Intelligence
Technology`, `GRAAD=MASTER`, `NIVEAU=WO-MA`, `STUDIELAST=120`,
`BEGINDATUM=2024-09-01T00:00:00`, `AANGEBODEN_OPLEIDING_BEGINDATUM=2023-12-22T00:00:00`,
`VORM=VOLTIJD`, and `VOERTAAL=NLD`. Location and intake-date columns are null
for this row.

The run persisted one raw row, materialised two mapped facts and six metadata
observations, and accepted two programme-scoped assertions:

- `programme_identity`: `Data Science and Artificial Intelligence Technology`;
- `credential`: `MASTER`.

`VOERTAAL=NLD` and `VORM=VOLTIJD` are promoted as source-native catalogue
attributes. Programme/offering dates, `STUDIELAST=120`, and `NIVEAU=WO-MA` are
retained as `context_only`. None is mapped to IELTS/TOEFL, a deadline,
duration, or an academic cycle. No value was fabricated from a null column.

## C. HESA / Discover Uni distribution

The official HESA schema documentation was inspected, including the
[Discover Uni distribution/file structure](https://www.hesa.ac.uk/collection/c23061/discover_uni_dataset_file_structure),
[KIS course mode](https://www.hesa.ac.uk/collection/c25061/a/kismode),
[course-location entity](https://www.hesa.ac.uk/collection/c25061/a/courselocation),
and [KIS course identifier](https://www.hesa.ac.uk/collection/c25061/a/kiscourseid).
The documented distribution contains one XML file plus CSV files and exposes
source-native fields such as `KISCOURSEID`, `KISMODE`, `NUMSTAGE` (course
stages/length guidance), `CourseLocation.LOCID`/`UCASCOURSEID`, `KISAIM`,
support/employment URLs and linked HESA course years. The [Office for Students
description](https://www.officeforstudents.org.uk/for-providers/student-protection-and-choice/discover-uni-and-the-discover-uni-dataset/discover-uni-dataset/)
confirms that C25061 combines provider course data with NSS, Graduate Outcomes
and LEO information and covers courses relevant to the next academic year.

The runtime could not retrieve the HESA package or even `robots.txt`: each of
the official support/collection URLs returned HTTP 403. No unauthenticated
bulk sample row was therefore persisted. The compliant static Discover Uni
route already supplies exact course identity, mode, length, location and
outcome cards for this bounded target. Decision: **DEFER - ACCESS_BLOCKED; no
bulk adapter implemented**. This is an access decision, not evidence that the
documented schema lacks fields.

## D. Studiekeuze123 / RIO / HOVI

The official [Studiekeuze123 source description](https://www.studiekeuze123.nl/bronnen)
states that RIO supplies programme name, diploma and ECTS while HOVI supplies
institution-provided language, intake moments, deadlines, descriptions and
other programme characteristics. The [release documentation](https://www.studiekeuze123.nl/release-december-2022)
states that professional users receive the Studiekeuzedatabase through a REST
API (OData), and the product/access page documents request/terms requirements.

The public DUO CKAN RIO route used above is compliant and implemented. The
Studiekeuze123 professional OData route requires registration/licensing and
terms; no authenticated sample record was available in this runtime. Decision:
**ACCESS_GATED / DEFER**. No adapter was written against an inaccessible
interface and no university-web substitute was used.

## E. CRICOS compliant-access discovery

The official [CRICOS site](https://cricos.education.gov.au/) confirms that it
is the Australian Government register of providers and courses. The official
[data.gov.au dataset](https://data.gov.au/data/dataset/cricos) and the
[Providers, Courses, Locations export](https://www.data.gov.au/data/dataset/cricos/resource/63fd9610-5bea-438c-bac7-29289d38cfbb)
publish CSV/ZIP/XLSX resources. The inspected schema/record contains the
source-native CRICOS course code, course name/credential/status, tuition,
non-tuition fee, estimated total course cost, duration and location.

Access checks were explicit: `https://data.gov.au/robots.txt` returns
`User-agent: * Disallow: /`; `https://cricos.education.gov.au/robots.txt`
disallows `/Course` and related record paths. The live course route and the
bulk download therefore cannot be fetched through the compliant ingestion rail
in this runtime. Decision: **DEFER - NO COMPLIANT OFFICIAL ACCESS**. No robots
bypass or UNSW university-web replacement was used.

## F. External coverage breadth before vs after

The table distinguishes accepted semantic assertions from deterministic
catalogue metadata. Counts are for the two-provider run `i`; the existing
Scorecard/swissuniversities/Onisep foundation is unchanged and was not rerun.

| Field group | Before this depth pass | After run `i` | Evidence/status |
| --- | --- | --- | --- |
| Programme identity | already covered | 2 accepted assertions | Discover Uni 1; DUO RIO 1; programme scope |
| Credential | already covered | 2 accepted assertions | Discover Uni 1; DUO RIO 1; programme scope |
| Programme status | 0 | 0 | No explicit current status in either selected record |
| Duration | 0 accepted field facts | 1 catalogue attribute | Discover Uni `4 year course`; no RIO duration inference |
| Location | 0 accepted field facts | 1 catalogue attribute | Discover Uni `The University of Nottingham`; RIO location null |
| Delivery mode | 0 accepted field facts | 2 catalogue attributes | Discover Uni `Full time`; RIO `VOLTIJD` |
| Tuition / fees | 0 in these two providers | 0 | No tuition/fee field in selected records |
| Deadlines / intakes | 0 | 0 | No explicit application deadline/intake value |
| Language requirement | 0 | 0 | RIO `VOERTAAL=NLD` is teaching-language metadata, not a threshold |
| Eligibility / degree / GPA | 0 | 0 | No explicit threshold in selected records |
| Documents / recommendations / SOP / portfolio | 0 | 0 | Source does not publish these for the selected records |
| Funding / scholarships | 0 | 0 | No explicit funding value |
| Career outcomes | existing coverage | 8 accepted assertions in run `i` | Discover Uni programme-scoped outcome cards |
| Employment outcomes | 0 accepted; 7 review proposals | 7 accepted assertions | Discover Uni deterministic cards; programme scope |

Run `i` accepted 19 non-null external semantic assertions: Discover Uni 17
(identity 1, credential 1, career 8, employment 7) and DUO RIO 2 (identity 1,
credential 1). All 19 are `OBSERVED`, `RULE_VALIDATED`, and programme-scoped.
The run also recorded nine deterministic external metadata observations and
promoted five catalogue attributes (Discover mode/duration/location and RIO
mode/language); RIO dates, load and level remain context-only.

## G. Direct and H1-H4 contribution

The existing hierarchy engine was run unchanged over the 19 accepted rows. The
reproducible summary is
[`hierarchy/external-coverage-bounded-20260913i.json`](hierarchy/external-coverage-bounded-20260913i.json).

| Field | Direct target available | H1 | H2 | H3 | H4 | Abstentions | Reason |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `programme_identity` | 2/2 | 0 | 0 | 0 | 0 | 2 engine no-inference records | direct rows available |
| `credential` | 2/2 | 0 | 0 | 0 | 0 | 2 engine no-inference records | direct rows available |
| `career_outcomes` | 0 | 0 | 0 | 0 | 0 | 2 | one `DIRECT_TARGET_CONFLICT`, one `NO_COMPATIBLE_DONOR` |
| `employment_outcomes` | 0 | 0 | 0 | 0 | 0 | 2 | one `DIRECT_TARGET_CONFLICT`, one `NO_COMPATIBLE_DONOR` |

The engine reports direct availability separately from hierarchy inference
records; it intentionally does not create an inference record for a direct
row. Nottingham has multiple accepted outcome rows, so it abstains rather than
choosing one. There are no parent units, sibling programmes or peer
institutions in this bounded population. Consequently usable external donors
are: tuition **0**, fees **0**, admissions/deadlines **0**, language/test **0**,
funding **0**, and H1-H4 donors **0**. No compatibility gate was weakened and
no uncertainty value was altered.

## H. Remaining gaps by exact status

- **ACCEPTED_EXTERNAL:** Discover Uni identity, credential, career and
  employment observations; DUO RIO identity and credential; explicit catalogue
  mode/duration/location/language metadata described above.
- **SOURCE_HAS_FIELD_BUT_PIPELINE_GAP:** HESA bulk documentation exposes
  scalable mode/length/location/outcome structures, but the package could not
  be retrieved in this runtime. It remains a source/access follow-up, not a
  reason to add an adapter without a sample package.
- **ACCESS_GATED:** Studiekeuze123 professional OData/HOVI distribution
  (registration, licence and terms required).
- **ACCESS_BLOCKED:** HESA official distribution endpoints (HTTP 403), CRICOS
  direct course paths and data.gov.au export path under their published robots
  policies; Common App remains in the same previously verified robots-blocked
  state and was not retried.
- **SOURCE_MISSING_FIELD:** the inspected DUO RIO row has no tuition, fee,
  admission threshold, document, recommendation, SOP, portfolio, funding or
  employment field; the selected Discover Uni route has no application
  deadline, GPA, document or funding field.
- **NO_VERIFIED_SOURCE:** no compliant, field-bearing programme tuition/fee or
  admissions-threshold source was available for these exact two target records
  after the access checks above.

## I. Scale-up candidates only if still necessary

No new provider is required to explain this pass. The bounded, low-risk scale
paths are (1) apply the deterministic Discover Uni identifier/materialisation
path to more allowed course-detail routes, and (2) obtain licensed
Studiekeuze123 OData access under its published terms. Neither requires a
resolver, acceptance, hierarchy or storage redesign.

## J. Tests and artifacts

- `rtk python -m pytest -q tests/test_core.py tests/test_semantic_acceptance.py tests/test_external_field_evidence.py tests/test_external_acquisition.py tests/test_source_ecosystem.py tests/test_field_aware_source_selection.py` -> **317 passed**.
- Full ingestion suite `rtk python -m pytest -q` -> **644 passed**.
- Live Discover Uni parser smoke -> **7 deterministic employment facts**, all
  source URL/provider/provenance attached.
- `rtk python -m py_compile` for changed ingestion modules -> **pass**.
- `rtk python run.py validate-config --config ..\\..\\docs\\architecture\\data\\external-field-expansion-20260913\\external-coverage-bounded-20260913.json` -> **pass**.
- Bounded rerun `external-coverage-bounded-20260913i` -> **2/2 institutions,
  2/2 sources fetched/persisted, 0 errors**; 32 runtime assertions, 26
  non-null, 0 rejected, 7 initial review rows, 19 unique non-null semantic
  candidates, 9 metadata observations and 5 promoted attributes.
- Main run artifacts: [`run manifest`](runs/external-coverage-bounded-20260913i/manifest.json), [`sources`](runs/external-coverage-bounded-20260913i/sources.jsonl), [`raw persistence`](runs/external-coverage-bounded-20260913i/raw_persistence_events.jsonl), [`materialisations`](runs/external-coverage-bounded-20260913i/external_field_materializations.jsonl), [`metadata`](runs/external-coverage-bounded-20260913i/external_programme_metadata.jsonl), [`extraction events`](runs/external-coverage-bounded-20260913i/extraction_events.jsonl), [`field assertions`](runs/external-coverage-bounded-20260913i/field_assertions.jsonl), [`acceptance decisions`](runs/external-coverage-bounded-20260913i/semantic_acceptance_decisions.jsonl), and [`effective assertions`](runs/external-coverage-bounded-20260913i/effective_field_assertions.jsonl).

No commit or push was made.
