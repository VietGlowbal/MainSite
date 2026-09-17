# Tuition live population expansion — evidence topology experiment

This is a topology experiment only. It did not extract tuition values, create
assertions, run an estimator, or change canonical/product truth.

The frozen population is
[`tuition-live-population-topology-manifest.json`](data/tuition-live-population-topology-manifest.json)
(SHA-256
`0bb9a1b8a937dae3f33c4ef9dedc6470ec48da381e3ecb19daade61ead7ea8be`). It was
written before live acquisition and contains 40 targets at 20 institutions.
The run ID is `tuition-live-topology-20260909`, target cycle `2025-26`, and the
run allowed zero LLM, DeepSeek, provider-extraction, or other paid calls.

## Frozen population

The roster has two targets per institution. Its stratification is:

| Dimension | Counts |
| --- | --- |
| Region | US 20, Europe 10, Asia 4, North America 4, Oceania 2 |
| Degree | bachelor 16, master 22, professional 2 |
| Institution type | public 24, private 16 |
| Field/domain | STEM 36, business 1, professional 1, humanities/social science 2 |
| Pricing structure stratum | institution-wide-likely 17, faculty-likely 20, programme-specific-likely 3 |

No target was added or removed after acquisition began.

## Live acquisition and persistence

The runner used the existing `SafeFetcher`, robots policy, redirect and URL
safety checks, parser registry, source resolver, and local raw-evidence path.
`discovery_only=True` prevented assertion extraction. Remote durable storage was
not configured in this environment, so this isolated run is locally durable in
its run directory; it was not imported into product storage.

| Measure | Result |
| --- | ---: |
| Source-resource attempts | 162 of a 220 research cap: 40 frozen programme resources, 50 government resources, 72 link-derived hierarchy resources |
| External links discovered | 26; all rejected before fetch because no explicit external-domain rule applied |
| HTTP requests | 119 |
| HTTP retrievals | 74 (71 status 200, 3 status 202) |
| HTTP failures | 45 (18 status 404, 10 status 429, 6 status 403, 11 network errors) |
| Retrieved bytes | 18,594,838 |
| Persisted source documents | 36 (29 HTML, 7 PDF) |
| Wall clock | 6 minutes 2 seconds (13:54:53–14:00:55 UTC) |
| LLM / DeepSeek / provider calls | 0 / 0 / 0 |
| Assertions or estimator predictions | 0 / 0 |

The acquisition ledger is
[`acquisition-ledger.jsonl`](data/tuition-live-population-topology-run-20260909/acquisition-ledger.jsonl).
The request-level telemetry is
[`request-telemetry.jsonl`](data/tuition-live-population-topology-run-20260909/request-telemetry.jsonl).
All 40 frozen programme URLs received a ledger entry. Twenty-nine produced a
persisted E0 document; eleven did not (four 404s, three 403s, two robots
blocks, and two Oxford policy-unreachable entries).

The government attempts were admitted with correct candidate metadata but did
not produce documents: all 40 IPEDS resources were blocked by the NCES robots
policy and all 10 College Scorecard calls returned HTTP 429. No JSON resource
was persisted. This is reported as an acquisition result, not as evidence that
government data do not exist.

## Source classes actually exercised

The registry reported `manual_source`, `official_catalogue`,
`college_scorecard`, and `ipeds`. Link-derived PDF candidates used the existing
`PdfDocumentCandidateAdapter` directly. Search and archive adapters were not
enabled. The table distinguishes candidate configuration from persisted
documents and effective topology edges.

| Source class | Configured | Discovered | Admitted | Fetched/retrieved | Persisted | Linked to target | Useful topology edges | Authority / relationship and field scope |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| official_web | 40 unique frozen resources (71 candidate rows) | 101 | 101 | 29 documents | 29 | 41 effective edges (56 raw links) | 30 | `OFFICIAL` / `DIRECT_OFFICIAL`; programme and related university web pages; expected field `tuition` |
| official_catalogue | 9 unique catalogue/bulletin/handbook resources | 9 | 9 | 9 URLs fetched through the duplicate manual-seed candidate | 0 with this class label; the same 9 documents persisted as `official_web` | 0 with this class label; their edges are in `official_web` | included in the official_web count | `OFFICIAL` / `DIRECT_OFFICIAL`; candidate metadata was correct, but manual seed precedence won the persisted candidate |
| pdf | 0 preconfigured resources; link-derived only | 11 | 11 | 7 | 7 | 7 | 5 | `OFFICIAL`; `pdf_document`; programme appendices, faculty brochure, and tuition schedules |
| government_dataset (IPEDS) | 40 candidate rows; 4 unique dataset resources | 40 | 40 | 0 (40 robots blocks) | 0 | 0 | 0 | `GOVERNMENT` / `GOVERNMENT`; provider `IPEDS`, collection `2024-25`; institution metadata/taxonomy scope, not programme exact tuition |
| government_dataset (College Scorecard) | 10 candidate rows; 10 unique resources | 10 | 10 | 0 (10 HTTP 429) | 0 | 0 | 0 | `GOVERNMENT` / `GOVERNMENT`; provider `CollegeScorecard`, dataset `college-scorecard-2024-school-search`; institution metadata scope |
| external_authoritative | 0 | 26 | 0 | 0 | 0 | 0 | 0 | `OTHER` / `OTHER_RELATED`; discovery-only external links rejected by domain admission |
| structured university API | 0; disabled and no resources configured | 0 | 0 | 0 | 0 | 0 | 0 | Not exercised |
| search discovery | 0; no provider configured | 0 | 0 | 0 | 0 | 0 | 0 | Not exercised; snippets never became evidence |
| archive | 0; disabled because available support is fixture-only | 0 | 0 | 0 | 0 | 0 | 0 | Not exercised; no historical evidence promoted |
| partner, accreditor, official application system, aggregator, government portal, official finance | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No resources were configured or fetched |

The persisted source rows are in
[`sources.jsonl`](data/tuition-live-population-topology-run-20260909/sources.jsonl).
Each persisted row has an explicit source class, adapter ID, authority,
relationship, raw-document ID, content hash, and local raw path. Persisted rows
are all official university-controlled sources (`OFFICIAL`), either HTML or
PDF. Government candidate rows retain provider, dataset, cycle, and
`GOVERNMENT` metadata even though no government raw document was retrieved.

## Effective topology

The raw runner records every selected link. Several catalogues expose one
document under multiple navigation labels, and programme PDFs can be companions
to E0 rather than hierarchy donors. The offline review therefore keeps the raw
files and writes an effective one-edge-per-target/document/lineage dataset:

* raw: 63 edges and 36 policy lineages;
* effective: 48 edges and 36 policy lineages;
* 15 duplicate-labelled edges removed;
* 33 effective E0 edges, 2 E1 edges, 1 E2 edge, 12 E3 edges, and 0 E4 edges.

Raw edges are preserved in
[`topology-edges-raw.json`](data/tuition-live-population-topology-run-20260909/topology-edges-raw.json)
and `.jsonl`. The effective dataset is
[`topology-edges.json`](data/tuition-live-population-topology-run-20260909/topology-edges.json)
and
[`topology-edges.jsonl`](data/tuition-live-population-topology-run-20260909/topology-edges.jsonl).
The deterministic review rules and counts are in
[`topology-edge-normalization.json`](data/tuition-live-population-topology-run-20260909/topology-edge-normalization.json).

| Level | Effective edges | Targets | Target rate | Applicability observations |
| --- | ---: | ---: | ---: | --- |
| E0 programme-specific | 33 | 29 | 72.5% | Direct programme scope; three PDFs are programme companions |
| E1 faculty/department/school | 2 | 2 | 5.0% | One ambiguous UNSW computing-options brochure; one NTU CCDS schedule directly covering the MSc tariff |
| E2 institution/central | 1 | 1 | 2.5% | One ambiguous UdeM graduate-admissions guide |
| E3 sibling/comparable programme | 12 | 12 | 30.0% | One potentially comparable same-degree ETH path; eleven degree-mismatched or otherwise related paths |
| E4 government/external authoritative | 0 | 0 | 0.0% | No government or external document persisted |

At target level, 29/40 targets (72.5%) have any persisted evidence, 13/40
(32.5%) have at least one non-E0 path, 13/40 (32.5%) have a target-relative
independent non-E0 path, and 14/40 (35.0%) have at least two distinct policy
lineages. Only 2/40 targets (5.0%) have two independent non-E0 paths. The
single potentially comparable non-E0 edge is the ETH Robotics, Systems and
Control target linked to the same-institution Data Science programme. The
directly applicable NTU faculty schedule is a shared factual policy path; it is
not treated as a predictive donor. Eleven targets have no persisted evidence.

The `independent` flag is target-relative: a sibling document is independent
of that target's E0 document even when it is also the E0 document of another
frozen target. Global reuse is still visible through the lineage ID: 12 of the
36 effective lineages occur on two target edges, and only 3 non-E0 edges use a
lineage that is novel relative to every E0 document in the population. This
prevents population-wide reuse from being mistaken for multiple independent
policy families.

### Breakdowns

Counts are target counts; a target is counted once in each level column when
that level exists for it.

| Stratum | n | E0 | E1 | E2 | E3 | E4 | ≥1 non-E0 | ≥2 non-E0 paths |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| All targets | 40 | 29 | 2 | 1 | 12 | 0 | 13 | 2 |
| bachelor | 16 | 11 | 1 | 0 | 0 | 0 | 1 | 0 |
| master | 22 | 17 | 1 | 1 | 11 | 0 | 11 | 2 |
| professional | 2 | 1 | 0 | 0 | 1 | 0 | 1 | 0 |
| private | 16 | 13 | 0 | 0 | 5 | 0 | 5 | 0 |
| public | 24 | 16 | 2 | 1 | 7 | 0 | 8 | 2 |
| US | 20 | 16 | 0 | 0 | 6 | 0 | 6 | 0 |
| Europe | 10 | 4 | 0 | 0 | 2 | 0 | 2 | 0 |
| Asia | 4 | 3 | 1 | 0 | 1 | 0 | 1 | 1 |
| North America | 4 | 4 | 0 | 1 | 2 | 0 | 2 | 1 |
| Oceania | 2 | 2 | 1 | 0 | 1 | 0 | 2 | 0 |
| STEM | 36 | 25 | 2 | 1 | 11 | 0 | 12 | 2 |
| business | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| professional field | 1 | 1 | 0 | 0 | 1 | 0 | 1 | 0 |
| humanities/social science | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |
| institution-wide-likely | 17 | 12 | 1 | 0 | 0 | 0 | 1 | 0 |
| faculty-likely | 20 | 14 | 1 | 1 | 10 | 0 | 10 | 2 |
| programme-specific-likely | 3 | 3 | 0 | 0 | 2 | 0 | 2 | 0 |

The full per-target effective record is
[`target-topology-summary.json`](data/tuition-live-population-topology-run-20260909/target-topology-summary.json).

## Yield and diminishing returns

The runner's checkpoints are retained in
[`yield-checkpoints.jsonl`](data/tuition-live-population-topology-run-20260909/yield-checkpoints.jsonl),
with a final effective point in
[`yield-curve-effective.json`](data/tuition-live-population-topology-run-20260909/yield-curve-effective.json).

| Resource attempts | HTTP requests | Targets with any evidence | Raw paths | Unique lineages |
| ---: | ---: | ---: | ---: | ---: |
| 90 | 65 | 14 | 28 | 15 |
| 100 | 69 | 15 | 30 | 16 |
| 110 | 79 | 17 | 34 | 18 |
| 120 | 87 | 20 | 41 | 23 |
| 150 | 113 | 27 | 56 | 32 |
| 160 | 118 | 29 | 63 | 36 |
| 162 (final) | 119 | 29 | 63 raw / 48 effective | 36 |

The final 42 resource attempts after the 120-resource checkpoint added nine
targets with evidence; the last 12 attempts added two targets and mostly
additional links. The curve does not show a reliable external-source yield:
government resources contributed zero documents throughout, and the source
classes represented after the first checkpoint remained university HTML, PDF,
and failed government candidates. This is a useful bound on the current
acquisition path, not a claim that blocked providers have no data.

## Applicability, lineage, and product interpretation

The experiment records topology, not tuition estimates. A direct policy path and
a predictive donor are kept separate:

* The NTU CCDS PDF states the graduate Master of Science tuition schedule and
  directly covers the MSc Data Science target. It is a factual E1 applicability
  path; it is not a backoff estimate.
* The UNSW PDF is a faculty-level computing-options brochure without a tuition
  value, so it is E1 but `AMBIGUOUS` for a tuition donor.
* The UdeM graduate guide is E2 but generic and `AMBIGUOUS` for the target
  tuition.
* The 12 E3 paths are programme pages or comparable programme material. Only
  the ETH same-degree path is `POTENTIALLY_COMPARABLE`; degree-mismatched paths
  remain `RELATED_BUT_NOT_APPLICABLE`.
* No E4 government or external evidence was retrieved. No donor value was
  normalized or used for estimation.

There is therefore no coverage/error/uncertainty result to report and no
held-out estimator test was run. The available topology is insufficient to
justify estimator testing: only one non-E0 path is potentially comparable,
only two targets have multiple non-E0 paths, and E4/API source classes did not
survive acquisition. A later estimator test would need a new bounded source
tranche after the provider/robots limitations are resolved; it must use this
manifest and these effective edges as the audit baseline.

## Cost and measurement limits

Measured live cost was 119 SafeFetcher HTTP calls, 18.6 MB, and 6 minutes 2
seconds, with no LLM/provider work. Exact-evidence recovery cost was not run as
a counterfactual, so this experiment cannot claim a request, latency, or human
effort saving. Manual annotation time was not instrumented by the runner; the
four PDF scope reviews and duplicate-lineage review are recorded in the
normalization artifact but have no defensible minute measurement. No mentor or
product review queue was invoked.

The main missing source classes for a stronger topology test are retrievable
IPEDS/Scorecard resources, configured university JSON APIs, central
finance/registrar pages, partner/accreditor sources, search-backed discovery,
and a production archive adapter. The current data remains mostly
university-controlled web content: 29 HTML documents and 7 official PDFs,
with zero persisted government, API, archive, partner, accreditor, or
aggregator documents. Nine catalogue-like URLs were configured and fetched,
but their persisted source class is `official_web` because the manual-seed and
configured-resource candidates shared a URL; this is a provenance/configuration
limitation, not a new catalogue population.

## Required summary

1. Frozen population: 40 targets, 20 institutions.
2. Geography/degree/domain: US 20, Europe 10, Asia 4, North America 4, Oceania 2; bachelor 16, master 22, professional 2; STEM 36 of 40.
3. Source classes actually exercised: official web, link-derived PDF, admitted-but-failed IPEDS and College Scorecard, and rejected external-link discovery.
4. Live resources/requests: 162 source-resource attempts and 119 HTTP calls.
5. E0: 29/40 targets (72.5%).
6. E1: 2/40 (5.0%).
7. E2: 1/40 (2.5%).
8. E3: 12/40 (30.0%).
9. E4: 0/40 (0.0%).
10. Independent non-E0 evidence: 13/40 target-relative; 3 globally novel non-E0 edges; 15 unique non-E0 lineages.
11. Multiple paths: 14/40 with at least two lineages; 2/40 with at least two non-E0 paths.
12. Source-class contribution: 29 HTML and 7 PDF documents persisted; government/API/external classes persisted none.
13. Diminishing returns: +9 target evidence paths from attempts 120–162, only +2 in the final 12 attempts; government yield stayed zero.
14. Cost: 18,594,838 bytes and 6m02s; zero provider/LLM tokens.
15. Human review: not timed; no assertion or mentor review was performed.
16. Major missing classes: retrievable government/API, finance/registrar, partners/accreditors, search, and production archive.
17. Topology verdict: the acquired graph is sparse outside E0 and concentrated in same-institution web/PDF material.
18. Held-out estimator testing: NOT JUSTIFIED; no estimator was run and no production architecture change is authorized.

C — TOPOLOGY SPARSE / LIMITED
