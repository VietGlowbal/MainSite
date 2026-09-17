# External field-bearing coverage continuation — 2026-09-13

This continuation stayed source-first and bounded. It used the existing
`government_dataset` adapter and field-evidence bridge, made one provider
envelope fix required by the verified DUO route, and changed no resolver,
acceptance, hierarchy, uncertainty, storage, promotion, canonical-truth, or
Benchmark V3 behavior. The live run used the main-worktree environment file
`D:\projects\Glowbal\MainSite\.env.local` (secrets were not printed).

## A. Sources researched and real schemas inspected

| Provider/resource | Official resource and inspected sample | Verified schema/fields | Scope and temporal semantics |
| --- | --- | --- | --- |
| HESA / Discover Uni course details | [Nottingham Computer Science with Year in Industry](https://discoveruni.gov.uk/course-details/10007154/G407/Full-time/) | `PUBUKPRN=10007154`, `KISCourse=G407`, `KISMODE=Full-time`; programme name, BSc (Hons), course length, programme-qualified Graduate Outcomes/employment cards and graduate views | Programme. The page labels outcome periods (Graduate Outcomes students graduating 2021–23 and NSS 2024–25); no programme academic cycle was inferred. |
| HESA Unistats distribution | [HESA Unistats tools/downloads](https://www.hesa.ac.uk/support/tools-and-downloads/unistats) | Official distribution documentation describes XML/CSV course-level data; no direct bulk package was used in the run | Programme distribution documented; direct package route was not used because the accessible static Discover Uni record already supplied a compliant field-bearing route. |
| DUO RIO higher-education overview | [DUO dataset](https://onderwijsdata.duo.nl/datasets/ho_opleidingsoverzicht), [CKAN package API](https://onderwijsdata.duo.nl/api/3/action/package_show?id=ho_opleidingsoverzicht), [filtered Datastore record](https://onderwijsdata.duo.nl/api/3/action/datastore_search?resource_id=ffffa7ad-e6a2-4ba7-9fc2-a09df4128555&limit=1&filters=%7B%22ONDERWIJSBESTUURID%22%3A%22107B605%22%2C%22OPLEIDINGSEENHEIDCODE%22%3A%221001O8897%22%7D) | Exact row: `ONDERWIJSBESTUURID=107B605`, `OPLEIDINGSEENHEIDCODE=1001O8897`, `NAAM_LANG=Data Science and Artificial Intelligence Technology`, `GRAAD=MASTER`, `NIVEAU=WO-MA`, `STUDIELAST=120`, `BEGINDATUM=2024-09-01`, `AANGEBODEN_OPLEIDING_BEGINDATUM=2023-12-22`, `VOERTAAL=NLD` | Programme. Row/offering dates are source-native and retained in the durable structured payload; RIO has no academic-cycle label. The API returns the row under `result.records`. |
| IPEDS COST1 | [IPEDS data files](https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx?year=-1), configured [COST1_2024.zip](https://nces.ed.gov/ipeds/datacenter/data/COST1_2024.zip) | `UNITID` institution key and COST1 institution finance/tuition columns | Institution; IPEDS data-year semantics. No new target field beyond the existing Scorecard contract was admitted in this run. |

The existing Common App and CRICOS schema/access findings remain in the prior
ledger; they were not retried here because their official routes remain blocked
by the published robots policy.

## B. Verified field-bearing sources

1. **Discover Uni course-details** — compliant static official route. It has
   programme identity/credential and programme-qualified career/employment
   outcome cards for the exact course route.
2. **DUO RIO Datastore JSON** — compliant official CKAN API. The filtered
   response contains one exact programme row with source-native identity and
   award fields plus additional date/language/ECTS columns retained as context.

Both sources are `government_dataset`, have programme resolution, exact target
identifiers, durable raw lineage, and passed the source admission policy.

## C. Rejected/deferred sources and reasons

This continuation researched four relevant ecosystems/routes (HESA/Discover
Uni, DUO RIO/Studiekeuze123, IPEDS, and the previously verified blocked
Common App/CRICOS routes). Two routes were implemented; the remaining routes
were deferred or rejected below.

| Source | Decision | Exact reason |
| --- | --- | --- |
| HESA bulk Unistats package | DEFER for this bounded run | Official distribution schema was verified, but the static Discover Uni route supplied the retrievable outcome fields needed here; no additional package adapter was justified. |
| IPEDS COST1 | DEFER | Institution finance/tuition scope duplicates the existing College Scorecard coverage for this objective; no new field-bearing target assertion was added. |
| Studiekeuze123 professional OData | DEFER | Official source description documents programme/deadline/admission/outcome fields, but live machine access requires registration/terms and no licensed row was retained. |
| Common App requirements grid | DEFER — NO COMPLIANT ACCESS PATH FOUND | Required fields were verified previously, but the published official route is robots-blocked; no bypass or substitute was used. |
| CRICOS direct/bulk routes | DEFER — NO COMPLIANT ACCESS PATH FOUND | Programme tuition/fees/status/duration/location were verified previously, but the direct and data.gov.au routes are robots-blocked; no bypass or university-web replacement was used. |

## D. Adapters extended/implemented

No new Python provider adapter was necessary. The existing declarative
`government_dataset` adapter was configured for both providers.

- Discover Uni uses a source-native URL template and a text-window
  materialiser with exact course identifiers/name patterns and an explicit
  outcome-period context.
- DUO RIO now uses the official filtered CKAN Datastore JSON endpoint instead
  of the large CSV download. The previous run proved the concrete failure:
  raw CSV persisted, then `STREAMING_PARSE_FAILED` because the CSV parser has
  no streaming parser. The API returns one exact row within the bounded inline
  limit. The field bridge now accepts the declarative `record_path=
  result.records` envelope. Identity/credential are the only mapped facts;
  RIO dates, ECTS, language code and nullable location/flags are not converted
  into unsupported cycle, duration, language-test, status, or admission facts.

## E. New accepted external coverage

Run: [`external-coverage-bounded-20260913e`](runs/external-coverage-bounded-20260913e/)

| Provider | Raw sources persisted | Field materialisations | Non-null semantic proposals | Accepted assertions | Review |
| --- | ---: | ---: | ---: | ---: | ---: |
| DUO RIO | 1 | 1 exact row | 2 | 2 | 0 |
| Discover Uni | 1 | 1 exact course page | 13 | 6 | 7 |
| **External total** | **2** | **2** | **15** | **8** | **7** |

The run also wrote 21 runtime assertions, including six explicit null slots for
fields not published by the selected records. There were no fetch errors or
rejected assertions.

Proposal/acceptance breakdown (all non-null proposals are programme-scoped):

| Provider | Field | Proposals | Accepted | Needs review |
| --- | --- | ---: | ---: | ---: |
| DUO RIO | `programme_identity` | 1 | 1 | 0 |
| DUO RIO | `credential` | 1 | 1 | 0 |
| Discover Uni | `programme_identity` | 1 | 1 | 0 |
| Discover Uni | `credential` | 1 | 1 | 0 |
| Discover Uni | `career_outcomes` | 4 | 4 | 0 |
| Discover Uni | `employment_outcomes` | 7 | 0 | 7 |

Accepted rows (all `OBSERVED`, `RULE_VALIDATED`, `scope=programme`):

| Provider | Field | Count | Accepted source value/context |
| --- | --- | ---: | --- |
| DUO RIO | `programme_identity` | 1 | Data Science and Artificial Intelligence Technology; exact RIO identifiers above |
| DUO RIO | `credential` | 1 | `MASTER` |
| Discover Uni | `programme_identity` | 1 | Computer Science with Year in Industry |
| Discover Uni | `credential` | 1 | BSc (Hons) |
| Discover Uni | `career_outcomes` | 4 | GBP 35,000 median earnings; 75% usefulness; 90% meaningfulness; 100% future-fit, each retaining the source's “15 months after” context where present |

Discover Uni also produced seven source-backed `employment_outcomes` proposals
(80% work/study, 95% highly skilled work, occupation percentages and other-work
categories). All seven stopped at acceptance with
`VALUE_SUPPORT_UNRESOLVED` and remain `NEEDS_REVIEW`; no acceptance rule was
relaxed.

Temporal representation was preserved rather than fabricated: DUO and Discover
assertions have `academic_cycle=null` and `temporal_state=UNKNOWN`. DUO's
`BEGINDATUM`/offering date remains in its durable structured payload, while
Discover's labelled 2021–23/2024–25 observation periods remain source evidence
and are not converted into an academic cycle.

## F. Previously-zero fields now covered

- UK programme identity and credential: accepted from Discover Uni.
- Netherlands programme identity and credential: accepted from DUO RIO.
- Programme-level external `career_outcomes`: four accepted Discover Uni
  observations (the first accepted outcome coverage in this bounded provider
  expansion).
- `employment_outcomes` is **not** yet accepted; seven values are review-only.
- Programme tuition/fees, deadlines/intakes, application fee, language-test
  thresholds, minimum degree/GPA, document/recommendation/SOP requirements,
  scholarships/funding, and accepted status/duration/location remain zero in
  this run.

## G. Direct/H1/H2/H3/H4 contribution

The existing hierarchy engine was called unchanged with only the eight accepted
external rows from this run. It saw two programme targets and no parent units,
sibling donors, or verified peer donors.

| Field | Accepted direct rows | Hierarchy direct | H1 | H2 | H3 | H4 | Non-direct abstentions | Support/uncertainty |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `programme_identity` | 2 | 2 | 0 | 0 | 0 | 0 | 0 | No inherited donor; support/uncertainty empty |
| `credential` | 2 | 2 | 0 | 0 | 0 | 0 | 0 | No inherited donor; support/uncertainty empty |
| `career_outcomes` | 4 | 0 | 0 | 0 | 0 | 0 | 2 | One `DIRECT_TARGET_CONFLICT`, one `NO_COMPATIBLE_DONOR`; no donor support/uncertainty |

The hierarchy engine's direct count for `career_outcomes` is zero because the
Nottingham target has multiple direct outcome values and the frozen evaluator
does not choose among a conflicting direct bundle. The accepted rows remain in
the effective external bundle; this is safe abstention, not an acceptance or
hierarchy change.

Usable external donors in this bounded run:

- tuition: **0**;
- mandatory/additional fees: **0**;
- admissions/deadlines: **0**;
- language/test: **0**;
- funding: **0**;
- H1/H2/H3/H4 outcome donors: **0** (direct outcome conflict/no compatible
  donor).

## H. Remaining no-source/access gaps

- No compliant programme tuition/fee source was selected for these targets;
  CRICOS remains the verified programme-level candidate but is robots-blocked.
- Common App remains the verified institution/applicant-policy candidate for
  deadlines, application fees and test/language flags, but its official route
  is robots-blocked.
- DUO RIO's inspected row has no tuition and no explicit academic-cycle label;
  its nullable dates/location and code flags were deliberately not promoted to
  unsupported deep fields.
- Discover Uni's seven employment values need the existing evidence-support
  resolution path; the exact blocking stage is validation/acceptance, not
  fetch, materialisation, or semantic extraction.
- No accepted scalable external source was retained for GPA thresholds,
  language scores, required documents, recommendations/SOP, scholarships, or
  funding in this bounded scope.

## I. Next scale-up candidates only if still necessary

No new provider is required to explain this run. The bounded next step, only if
the remaining fields justify it, is to scale exact Discover Uni identifiers
across allowed course-detail routes and obtain licensed Studiekeuze123/RIO
OData access under its published terms. Those are access/coverage follow-ups,
not resolver or acceptance redesigns.

## J. Tests and artifact paths

- Focused ingestion suite: `rtk pytest -q tests/test_external_field_evidence.py tests/test_external_acquisition.py tests/test_source_ecosystem.py tests/test_field_aware_source_selection.py` → **80 passed**.
- Full ingestion suite: `rtk pytest -q` → **638 passed**.
- Provider catalogue JSON validation → **pass**.
- `run.py validate-config` for [`external-coverage-bounded-20260913.json`](external-coverage-bounded-20260913.json) → **pass**.
- Source-registry smoke: both provider candidates formatted with exact target
  identifiers and were admitted by the source resolver → **pass**.
- Main-environment durable external-only run (`external-coverage-bounded-20260913e`) → **ok**, 2/2 institutions completed, 2/2 sources fetched/persisted, 0 errors.
- Unchanged H1–H4 evaluation output was captured from
  `evaluate_external_hierarchy.evaluate(...)` using the run's accepted rows;
  the reproducible summary is [`hierarchy/external-coverage-bounded-20260913e.json`](hierarchy/external-coverage-bounded-20260913e.json).
- Main artifacts: [`source-verification-ledger.json`](source-verification-ledger.json), [`external-providers.json`](../../../../services/data-ingestion/configs/external-providers.json), [`external-coverage-bounded-20260913.json`](external-coverage-bounded-20260913.json), and all JSONL traces under [`runs/external-coverage-bounded-20260913e`](runs/external-coverage-bounded-20260913e/), especially `source_ecosystem_fetches.jsonl`, `raw_persistence_events.jsonl`, `external_field_materializations.jsonl`, `extraction_events.jsonl`, `field_assertions.jsonl`, `semantic_acceptance_decisions.jsonl`, and `effective_field_assertions.jsonl`.

No commit or push was made.
