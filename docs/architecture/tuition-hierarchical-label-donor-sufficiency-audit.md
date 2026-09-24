# Tuition hierarchical label and donor sufficiency audit

Date: 2026-09-09

This is a data and label sufficiency audit for the tuition field. It does not implement a hierarchical estimator, alter the exact-evidence rail, change promotion semantics, modify Benchmark V3, continue Remediation 13, run Benchmark #9, call a paid provider, commit, or push. The preceding MVP report remains unchanged; this report records the bounded extension requested after that report found five exact labels but only four independent tariff groups.

The deterministic record and freeze manifest are [the audit dataset](data/tuition-hierarchical-label-donor-sufficiency.json) and [the freeze manifest](data/tuition-hierarchical-label-donor-sufficiency-freeze.json). A flat row view with the requested field names is [available as JSONL](data/tuition-hierarchical-label-donor-sufficiency-rows.jsonl). The common tuition record and compatibility contract are [defined here](data/tuition-sufficiency-contract.json).

## 1. Retained evidence searched

The search covered the retained material available in this workspace and its sibling preflight worktrees:

- all 32 retained pipeline inventories under `docs/benchmarks/runs`, `docs/benchmarks/remediation-smokes`, remediation replays and the sibling `data-platform-benchmark5-preflight-*` through `data-platform-benchmark8-preflight-*` worktrees;
- each inventory's `sources.jsonl`, `effective_field_assertions.jsonl`, `field_assertions.jsonl`, `best_assertion_decisions.jsonl`, `shared_fact_bundles.jsonl`, `url_graph_edges.jsonl`, `programmes.jsonl`, `review_queue.json`, and raw HTML/PDF payloads;
- the local SQLite crawl/cache databases, including `_cache/deepseek_cache.sqlite` where present;
- the frozen tuition rows in `docs/benchmarks/2026-08-30-phase-3f-ground-truth-v2.jsonl`, all twelve human-review packets, the correction packets, and the review-complete record;
- the current retained V3 pipeline outputs for source and inheritance context. No new run, benchmark, crawl, refetch, or provider call was made.

The retained inventory contains 5,006 source rows, 925 URL/content-hash source versions, 232 URLs, 301 effective tuition assertions, 71 local SQLite cache databases, 1,495 unique cache records (273 containing tuition context), 4,626 source-graph edges (312 unique discovered/target edge pairs), and 199 retained programme records. Of the 925 source versions, 851 have a locally available raw payload whose decompressed checksum matches the retained content hash. The remaining source versions are retained metadata or duplicate URL representations and were not treated as independent evidence.

No MongoDB URI or Supabase service key is configured in the local environment, so there was no locally accessible remote evidence store to query. That is reported as an environment limitation, not as evidence that a remote store is empty.

## 2. Candidate population and conservative labels

The frozen benchmark roster contains 36 tuition programme candidates across 12 institutions. Eleven have terminal human-review state `FOUND`; the other 25 are `NEEDS_REVIEW` or unlabelled. The sufficiency audit has 12 `KNOWN_EXACT` target labels: the eleven terminal `FOUND` rows plus the previously audited Harvard Data Science SM first-year row. The latter is explicitly named in the retained SEAS table, has a stated first-year basis and cycle, and is carried forward with that basis only. The benchmark's separate semantic state remains `NEEDS_REVIEW`; this audit does not silently rewrite the benchmark artifact.

The 12 labels are:

| Target(s) | Institution / programme | Frozen tuition record | Target policy cluster |
| --- | --- | --- | --- |
| GT-V2-01, GT-V2-03 | MIT / Artificial Intelligence and Decision Making; Chemical Engineering | USD 66,720 annual, 2026–27, standard undergraduate fall + spring tariff | PC-MIT-UG-STANDARD-2026 |
| GT-V2-04 | Harvard / Computer Science AB | USD 62,226 annual, 2026–27, Harvard College undergraduate tariff | PC-HARVARD-COLLEGE-UG-2026 |
| GT-V2-05 | Harvard / Data Science SM | USD 67,504 first year, 2026–27, SEAS master's tariff | PC-HARVARD-SEAS-2026 |
| GT-V2-07 | Princeton / Astrophysical Sciences AB | USD 68,140 annual, 2026–27, undergraduate tariff | PC-PRINCETON-UG-2026 |
| GT-V2-08 | Princeton / Computer Science MSE | USD 65,210 annual, 2026–27, regular graduate tuition; SHP is separate | PC-PRINCETON-GRAD-REGULAR-2026 |
| GT-V2-10 | Duke / Accelerated Daytime MBA | USD 107,900 full nine-month programme, Class of 2027 | PC-DUKE-ACCEL-MBA-2027 |
| GT-V2-13, GT-V2-15 | Northwestern / Liberal Arts and Music; Communication and Music | USD 71,802 annual, 2026–27, full-time undergraduate tariff; mandatory fees separate | PC-NORTHWESTERN-UG-2026 |
| GT-V2-16 | Cornell / Applied Economics and Management MPS | USD 73,946 annual (the source also states USD 36,973 per semester), 2026–27 | PC-CORNELL-PROFESSIONAL-TIER1-2026 |
| GT-V2-17 | Cornell / Computer Science BS | USD 73,946 annual, 2026–27, endowed Ithaca Engineering undergraduate tariff | PC-CORNELL-ENDOWED-ITHACA-UG-2026 |
| GT-V2-18 | Cornell / Information Science BS | USD 73,946 annual, 2026–27, CALS nonresident undergraduate tariff | PC-CORNELL-CALS-NONRESIDENT-UG-2026 |

Two MIT programmes and two Northwestern programmes share one tariff and therefore count once each for independent-policy purposes. Cornell's three rows are retained as separate clusters because the source describes three different governing tariff categories (professional tier, endowed Ithaca, and CALS nonresident), even though two amounts are numerically equal. That is a conservative policy-lineage decision: a later review may collapse them, but no estimator may treat a same-table duplicate as independent without documenting the collapse.

The target-only count is therefore 12 exact targets, 10 independent target policy groups, and 6 institutions. It clears the numerical target gate (at least 8 targets, 5 institutions, and 8 policy/source groups), subject to the donor gate below.

## 3. Normalization and exclusions

Every retained record uses currency, amount, basis, academic cycle, audience, residency, degree level, programme, faculty/department, delivery mode, campus and duration/load where the source establishes them. Published bases are preserved. No incompatible per-term, per-semester, annual, per-credit or full-programme values were converted to manufacture a comparison. No currency conversion or cross-country prior was used. Tuition is separated from fees, cost of attendance, deposits, aid, insurance and living costs.

The normalization pass count is 12. Twenty-four candidates were rejected from the exact target population because the source was an estimate or subject to confirmation, the cycle or audience/residency applicability was missing, the amount combined tuition and fees, programme applicability was unresolved, or the target was unlabelled. The main rejected examples are Duke Pratt's estimated MEng schedule, Montréal's explicitly estimated status-dependent amount, UCLA's approximate or 2024–25 graduate schedules, ETH's combined tuition/semester-fee amount without a cycle, Sorbonne's audience-dependent national/differentiated fee regime, and the unresolved Michigan cases. `additional_fees`, application fee, living cost, COA and funding were not added to the population.

## 4. Donor audit

Compatibility was applied before hierarchy distance. The strict donor whitelist is empty after policy-lineage holdout. The only plausible donor is the Harvard CSE SM row at USD 67,504 first year. It is useful for a row-only sensitivity because it is a named sibling with the same degree category, faculty, cycle, currency and basis, but it is in the same SEAS source document and policy lineage as the Data Science target. It is removed by whole-source and policy-lineage holdout and is not an independent donor.

| Donor candidate | Level | Value / source | Result |
| --- | --- | --- | --- |
| Harvard CSE SM → Harvard Data Science SM | H3 | USD 67,504 first year; the SEAS cost table | Row-only exploratory candidate; strict whitelist false because the source and policy lineage are shared |
| Harvard general GSAS tariff → Data Science SM | H2 | USD 59,048 full year; the same retained GSAS cost page | Reject: the page explicitly gives SEAS CSE/Data Science a special structure |
| Duke campus MEng → Accelerated MBA | H1 | USD 35,680 per semester; Pratt MEng page | Reject: professional MBA versus academic MEng, incompatible basis, and the source is estimated/subject to confirmation |
| MIT graduate tariff → MIT undergraduate targets | H2 | USD 33,360 per term; MIT graduate catalogue | Reject: degree category and tariff regime mismatch |
| Princeton graduate tariff → Princeton undergraduate target | H3 | USD 65,210 annual | Reject: degree category mismatch |
| Northwestern sibling dual degree → Northwestern sibling dual degree | H3 | USD 71,802 annual | Reject: both rows share one undergraduate tariff lineage |
| Cornell CS BS ↔ Cornell Information Science BS | H3 | USD 73,946 annual on both rows | Reject as the misleading numerical-similarity control: different college/residency tariff regimes and faculty scopes |

Counts of independent compatible donors are H1: 0, H2: 0, H3: 0, and H4: 0. There is one H3 row-only exploratory candidate, but it is not an independent donor and is not allowed by the strict whitelist. No H4 authoritative external donor was established. H5 remains out of scope.

The controls are explicit rather than manufactured: three true-abstention targets (MIT standard undergraduate, Princeton regular graduate, and Duke MBA), two misleading equal-number Cornell donor directions, and one Harvard SEAS policy-exception control. No genuine same-scope disagreement was found. The missing strata are H4 and a genuine same-scope conflict.

## 5. Holdout and freeze

The dataset freezes target rows, target-derived assertions, source IDs, policy clusters, normalization, donor blacklist/whitelist, compatibility dimensions and success criteria. The data file SHA-256 is recorded in the freeze manifest.

Row holdout removes the target row and all target-derived assertions. The Harvard CSE row is retained only for the row-only exploratory sensitivity. Whole-source holdout removes the complete target source and descendants. Policy-lineage holdout removes every URL, mirror, inherited assertion, and same-tariff representation in the target policy cluster. Whole-source and policy-lineage holdout both produce zero allowed donors. No labels may be changed after an estimator error; any later change must be a documented annotation defect.

Candidate uncertainty inputs are recorded for later offline work: effective independent support count, policy-lineage count, hierarchy level, distance, donor dispersion, cycle distance, authority and scope-match completeness. These are inputs, not calibrated probabilities.

## 6. Cost and annotation ledger

The measured analyst wall time for this extension was 9.39 minutes: 4.05 minutes for the retained-evidence search and 5.34 minutes for the freeze audit. The freeze interval allocation is 2.50 minutes for target-label review (0.069 minutes per the 36 candidates), 1.75 minutes for the 13 donor rows (0.135 minutes per donor row), 0.70 minutes for normalization (0.019 minutes per candidate), and 0.39 minutes for the 10 policy clusters (0.039 minutes per cluster). These are measured batch allocations, not claims about independent historical reviewer stopwatch times; the historical review packets did not record reviewer duration.

The recovery counterfactual is recorded per candidate in the dataset. Acquisition classes are CACHE_ONLY (five cases), CHEAP_FETCH (four), MULTI_SOURCE_RECOVERY (three), JS_RENDER (zero), PDF (eight), and LLM_EXTRACTION (sixteen). HUMAN_REVIEW is an overlay on all twelve exact labels. A cache-only classification means the retained raw/cache can plausibly support recovery; it does not claim the benchmark source URL was fetched in this task. No new requests or provider calls were made.

## 7. Sufficiency decision and estimator authorization

The exact-label and target-policy numerical gate passes: 12 exact targets, 6 institutions, and 10 independent policy clusters. The hierarchical evaluation gate fails: zero independent compatible donors survive policy-lineage holdout, the only row-only sibling donor is source-dependent, whole-source predictions would be zero, and no uncertainty/error ordering can be measured. Coverage, error and catastrophic-error criteria were therefore not evaluated. The existing simple offline methods A–D were not rerun and no estimator rerun was authorized.

Dataset sufficiency is **FAIL for the hierarchical donor-backed gate**. The target-label subgate passes, but the evaluation population is not sufficient for the question this experiment is meant to answer.

## 8. Bounded acquisition proposal

Retained evidence is insufficient for a donor-backed evaluation population, but the retained labels and six institutions make a bounded tranche informative. The proposed tranche is eight named target/donor pair candidates, with a hard stop after at most 24 official HTML/PDF requests, zero planned provider calls, and no cross-currency or cross-country prior. A pair is counted only if the new documents establish two compatible records in distinct policy lineages after clustering; a duplicate central tariff is reported as a miss rather than counted.

| Pair candidate | Evidence classes and retained starting URLs | Expected requests | Information value |
| --- | --- | ---: | --- |
| Harvard Data Science SM target + CSE SM sibling donor | programme pages plus current SEAS cost schedule: `https://gsas.harvard.edu/program/data-science`, `https://gsas.harvard.edu/program/computational-science-and-engineering`, `https://gsas.harvard.edu/apply/cost-attendance-2026-2027` | 3 | Tests H3 with same degree/faculty/cycle while checking whether separate programme documents create an independent lineage |
| Duke AI + Materials MEng target + Biomedical Engineering MEng donor | programme pages plus Pratt faculty schedule: `https://mems.duke.edu/academics/masters/meng-ai-materials/`, `https://bme.duke.edu/academics/masters/meng-bme/`, `https://masters.pratt.duke.edu/admissions/tuition-financial-aid/` | 3 | Tests H1 faculty backoff and programme exceptions; rejects the pair if the parent estimate or basis is not exact |
| Northwestern Information Systems–Data Science MS target + a named SPS computing master's sibling | retained target PDF/catalogue and SPS tuition policy: `https://catalogs.northwestern.edu/sps/graduate/information-systems/information-systems-ms-data-science-specialization/`, `https://www.northwestern.edu/sfs/tuition/graduate/school-of-professional-studies.html` | 2–3 | Tests H1/H3 within one professional graduate faculty with an explicit cycle and basis |
| Cornell MPS Applied Economics and Management target + another named Professional Degree Tier 1 MPS | Cornell programme catalogue plus bursar schedule: `https://dyson.cornell.edu/programs/graduate/mps/admissions/`, `https://catalog.cornell.edu/general-information/tuition/` | 2–3 | Tests whether a programme row and professional parent tariff are independent or one policy lineage; equal-number traps remain visible |
| University of Tokyo Computer Science master + Information and Communication Engineering master | current programme admission guides and institution tuition: `https://www.i.u-tokyo.ac.jp/edu/course/cs/cs_admission_guide2027_en.pdf`, `https://www.u-tokyo.ac.jp/en/prospective-students/tuition_fees.html` | 2–3 | Adds an H2 institution donor with the same graduate degree, JPY basis and current cycle if both programme scopes are explicit |
| ETH Zurich Data Science MSc + Cyber Security MSc | programme pages plus financial schedule: `https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/data-science.html`, `https://ethz.ch/en/studies/master/degree-programmes/engineering-sciences/cyber-security.html`, `https://ethz.ch/en/studies/financial.html` | 3 | Tests same-institution H3/H2 support after separating tuition from semester fees and establishing the cycle |
| Sorbonne Master Informatique MIND + SAR | named parcours pages plus 2026/27 central schedule: `https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-mind`, `https://sciences.sorbonne-universite.fr/formation-sciences/masters/master-informatique/parcours-sar`, `https://www.sorbonne-universite.fr/en/education/study-sorbonne-university/enrolment-procedures-and-tuition-fees` | 3 | Tests H3 sibling support while resolving initial/differentiated fees and residency before any numeric use |
| University of Michigan Aerospace Engineering BS + a named College of Engineering BS sibling | current College of Engineering tuition schedule plus programme pages: `https://ro.umich.edu/tuition-residency/tuition-fees/2026-2027/undergraduate/full-term/college-engineering-undergraduate` | 2–3 | Adds a domestic/nonresident undergraduate pair with explicit residency bands; only a programme-specific second policy survives clustering |

The expected tranche is 16–24 requests and zero paid-provider calls. Deterministic HTML/PDF extraction is the default. If a required document needs JS rendering, LLM extraction or a paid provider, stop at that item and request a revised authorization rather than silently expanding the tranche. The tranche's success condition is at least eight donor-backed targets with eight distinct target policy/source groups, five or more institutions, and at least one surviving H1, H2 and H3 example. If the eight-pair tranche collapses to duplicate policy lineages or remains below that condition, further crawling is not justified without a new value-of-information decision.

## 9. Required next action

Authorize the single bounded acquisition tranche above (up to 24 official requests, zero planned provider calls), then re-run this label/donor audit and freeze a replacement manifest. Do not run an estimator until eight independent compatible donor-backed targets survive row, whole-source and policy-lineage checks.

D — RETAINED DATA INSUFFICIENT, BOUNDED ACQUISITION JUSTIFIED
