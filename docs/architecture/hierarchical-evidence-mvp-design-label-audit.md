# Hierarchical evidence MVP: design and label audit

Date: 2026-09-09. Decision: **INCONCLUSIVE — continue research only.**

The audited sample does not establish the coverage/error/uncertainty/cost trade-off required to implement an estimation layer. A single exploratory sibling estimate matches its reference, but both rows belong to one source table. A whole-source holdout produces no estimates. This is insufficient evidence for the MVP, not evidence that hierarchical estimation is inherently ineffective.

## 1. Scope and preservation

The committed baseline is feature/data-platform at 5b37ccd07d5cf912272099b07488f5af56e22aca. Local Remediation 13 remains separate and paused. The existing architecture audit is [the prior report](data-platform-hierarchical-evidence-uncertainty-audit.md); its recommendation D is a strategic hypothesis, not empirical authorization.

This audit uses stored Run #8 artifacts and retained HTML. No production, policy, schema, benchmark, historical output, or existing documentation was edited. Only this new report is authorized. No live database query, crawler, provider, official benchmark, Rem13 validation, commit, or push was performed.

Primary evidence root, relative to the repository:

    ../data-platform-benchmark8-preflight-20260908T123218Z/
      docs/benchmarks/runs/phase3f-v3-run-20260908T134122Z/

Below, R means that directory and P means R/pipeline-run. Evidence is indexed by P/sources.jsonl; candidate observations are in P/effective_field_assertions.jsonl. Benchmark records supply programme identifiers, not new financial labels.

Run #8 pipeline-output SHA-256:

    87ec1dc88da485c746edbca5615cf00c7543cf3111a66d2949fcb6f4fd4bf74f

Labels below are independent audit annotations about the retained sources. They do not replace frozen GT or imply that the production exact rail accepted a value. Local retained, hash-verifiable evidence is adequate for reproducible offline annotation; it is not a claim that production durable-provenance requirements have passed.

## 2. Hypothesis and criteria fixed before estimation

Hypothesis: compatible authoritative neighbours can provide useful missing-exact financial estimates at lower incremental acquisition cost, with uncertainty that identifies unreliable predictions.

The provisional gates were stated before calculating predictions:

- Non-abstained usable estimate coverage at least 60% of eligible missing-exact/held-out targets.
- Median absolute relative error at most 15%.
- At most 10% of predictions with error greater than 30%; none greater than 50%.
- Higher uncertainty must discriminate higher empirical error.
- At least eight independent numerical targets before considering implementation supported.
- Exact assertions and safety/promotion semantics must remain untouched.
- Material acquisition savings must be demonstrable; zero new calls alone does not establish positive utility.

These are exploratory screens, not statistical certification. Eight targets still cannot establish a population catastrophic-error rate or calibrate a 90% interval. A later deployment decision needs substantially more independent policy groups.

Failure versus insufficient evidence: crossing an error/coverage gate with an adequate sample is a failed experiment. Too few independent labels/predictions is INCONCLUSIVE. Here the coverage screen is unmet and the data gate is unmet; implementation is unjustified. Criteria were not relaxed after inspecting predictions.

## 3. Target definitions and sample

Tuition means the published charge for the specified programme, audience, cycle, and unit. It excludes living expenses and non-tuition fees. Units remain explicit; annual, semester, and entire-programme amounts are never pooled.

For this audit, additional_fees means the total required non-tuition charges for the specified attendance period and student profile. A collection of named fees is not automatically that total. Waivable insurance, tuition-credit deposits, optional services, penalties, borrowing costs, and variable course materials must be distinguished. This aggregate lacks enough trustworthy labels and is removed from numerical estimation, while retained as a label/abstention audit.

Application_fee is omitted. The initial assertion inventory contained only four non-null observations across four entities; this is not strong enough support for expanding an already sparse experiment.

| ID | Institution | Programme | Degree/financial structure |
| --- | --- | --- | --- |
| 01 | MIT | Artificial Intelligence and Decision Making, Course 6-4 | Undergraduate, common standard term tariff |
| 03 | MIT | Chemical Engineering, Course 10 | Undergraduate, same tariff lineage |
| 05 | Harvard | Data Science SM | Graduate SEAS, unequal first/second-year charges |
| 10 | Duke | Accelerated Daytime MBA | Professional MBA, nine-month cohort charge |
| 11 | Duke | MEng AI + Materials | Campus MEng Materials Science track, three semesters |
| 12 | Duke | MEng Biomedical Engineering | Campus MEng, shared faculty policy |
| 17 | Cornell | Computer Science BS | Engineering undergraduate annual tariff |
| 20 | UCLA | Biostatistics MPH | Professional degree; generic graduate rates may not apply |
| 23 | Université de Montréal | MSc Computer Science | Per-term, residency/status-dependent estimated charges |
| 28 | ETH Zurich | Data Science | Graduate, retained combined tuition/semester-fee amount |

Identifiers are the GT-V2 row numbers solely for joining retained records. Montréal's runtime route label is “Admission And Regulations”; the source-native programme page establishes the subject of this audit. Duke's materials page explicitly identifies the MEng Materials Science and Engineering AI + Materials track, preventing confusion with AI for Product Innovation.

Ten programmes, seven institutions, undergraduate/graduate/professional structures, USD/CAD/CHF, two languages, programme/faculty/central pages. This is a deliberately heterogeneous convenience sample, not a representative estimate for US-50/Asia-50.

Desired H4 authoritative external evidence and independent numerical true-conflict pairs were not established in this audited sample. Instead it includes conflicting-looking but non-comparable observations and abstention cases. We did not manufacture either missing stratum or call scope differences true contradictions.

## 4. Reference evidence register

All amounts below were checked against retained source-native text, not accepted from an LLM assertion alone. Each financial page's decompressed raw SHA-256 matched its sources.jsonl content_hash.

| Ref | Source URL and source-native locator | Scope / cycle / unit |
| --- | --- | --- |
| S1 | https://catalog.mit.edu/mit/undergraduate-education/costs/ — standard undergraduate tuition, fall/spring | Institution UG; 2026–27; USD 33,360 per standard term |
| S2 | https://gsas.harvard.edu/apply/cost-attendance-2026-2027 — SEAS master's tuition table, Data Science SM row | SEAS/programme; 2026–27; USD 67,504 first year; 33,752 second-year single term |
| S3 | https://www.fuqua.duke.edu/programs/accelerated-daytime-mba/tuition-costs — Class of 2027 COA and tuition paragraph | Programme; entering August 2026; USD 107,900 nine-month programme tuition |
| S4 | https://masters.pratt.duke.edu/admissions/tuition-financial-aid/ — campus MEng general tuition and estimated costs | Faculty MEng; 2026–27; USD 35,680 semester; figures subject to confirmation |
| S5 | https://catalog.cornell.edu/general-information/tuition/ — undergraduate endowed-college tariff, not professional degree tier | Institution/college; 2026–27; USD 73,946 annual engineering UG |
| S6 | https://grad.ucla.edu/funding/tuition/ — approximate graduate tuition and fees, professional exceptions | Generic graduate; retained page does not establish target cycle/professional rate |
| S7 | https://admission.umontreal.ca/programmes/maitrise-en-informatique/admission-and-regulations/ — fee estimate by student status | Programme; 2025–26; CAD per 15-credit full-time term; explicitly an estimate |
| S8 | https://ethz.ch/en/studies/financial.html — tuition and semester fees combined | Institution; CHF 804/semester combined; current applicable cycle not established |

These are provenance URLs, not pages fetched during this audit.

Raw payloads under P/raw/html:

| Ref | Gzip filename | SHA-256 of decompressed raw |
| --- | --- | --- |
| S1 | 86c45e257c5cb3ebac3b470f819efa8a8eb7eaf721934661ce422386d7b4b0ac.html.gz | a9843ce2cad7334c46ec3cac0d777dfd70fb7440e39f473f1b6e819df3a2504c |
| S2 | 87bc995466121f9a4788fa07c27798c6b73ce90844a5623f484504ed194c715d.html.gz | c1791bf9ea1ebc0a32e1c57a686341f70a2a616ada3966cad39a72bd9293389d |
| S3 | d451e255474ee36ecb3d1e95f3a0d8b09a3d88d195efdc2adaf1c4e9880a7873.html.gz | 6b00e41d7a2413f9f4a3b060ad9e74b6b4ebafdde558ca23b78e8c300d788d13 |
| S4 | 3917d63f063e92d012c83d8a8d4f149b57230a341876a9f280a888c2448ee3c7.html.gz | 9868fddbe328a40fb84f9e8995987a277bc2ff2187f095ab3fbdeef9fc026d06 |
| S5 | 63465aa0d8e38960470673644c0cdcd3b8c3d11cd5cef099fae85513d715ace5.html.gz | 6e1895fe284fce96891dee3b261244d7be58f3c4eaab0af0806a48efe154809e |
| S6 | c219f88ed41856ed52347fadd1cfa983c2e1e58e0c53416eb6aba2b029e74eda.html.gz | 379390e6a17a6bd3951528969839591f6f720059eaf6b805e775df66c01b7397 |
| S7 | 2075461544211a862a95497457eac37353dcace588a4af597c357fde43ba34b5.html.gz | b0dce25975fc2c6bef9918819e88f041920231812cbea0817e06ba7cdd3b64db |
| S8 | 3750fca15e7baf3e7aff4092ab0d95419317f724cb3494334e85a0300c469cfc.html.gz | b9014d95f661396cc4af9be469c0f805f22a81f6beb5e349584a04e45193ac1c |

Scope checks include the retained Cornell Computer Science BS programme page (Duffield College of Engineering) and https://mems.duke.edu/academics/masters/meng-ai-materials/ (30 credits, campus, three semesters). Raw sources and assertions are linked through content hash/URL, not assumed independent because entity IDs differ.

## 5. Label audit: all 20 targets

“Exact” below means an exact published tariff at the retained snapshot and specified scope, not a guarantee of a future individual invoice. Full-time standard enrolment is assumed only where the source explicitly defines that tariff. No currency conversion or invented credits/years conversion is performed.

| Case | Field | Label | Reference and label-quality finding |
| --- | --- | --- | --- |
| 01 | tuition | KNOWN_EXACT | S1 USD 33,360/term, 2026–27 standard UG; official applicable tariff; excludes light load and summer |
| 03 | tuition | KNOWN_EXACT | S1 same tariff, same qualifications; duplicate policy observation |
| 05 | tuition | KNOWN_EXACT | S2 USD 67,504 first year Data Science SM, 2026–27, full-time; do not substitute second-year 33,752 |
| 10 | tuition | KNOWN_EXACT | S3 USD 107,900 nine-month accelerated MBA, Class of 2027; excludes COA and deposit double counting |
| 11 | tuition | AMBIGUOUS | S4 quotes 35,680/semester but labels cost table estimated/subject to confirmation; conservative exclusion pending independent final tariff |
| 12 | tuition | AMBIGUOUS | S4 same uncertainty; not a second independent tariff |
| 17 | tuition | KNOWN_EXACT | S5 USD 73,946/year, 2026–27 endowed Engineering UG. The identically priced professional tier is not the label |
| 20 | tuition | AMBIGUOUS | S6 approximate 21,115 resident / 36,297 nonresident annual tuition-plus-fees; professional MPH applicability and cycle unproven |
| 23 | tuition | AMBIGUOUS | S7 CAD 11,668.65 international tuition/term is explicitly estimated, 2025–26; status/thesis distinctions; not exact current truth |
| 28 | tuition | AMBIGUOUS | S8 CHF 804 combines tuition and semester fees; cycle and decomposition unproven |
| 01 | additional_fees | NO_REFERENCE | S1 mentions student-life charge without amount. Application fee 75 is not the required attendance aggregate |
| 03 | additional_fees | NO_REFERENCE | Same missing aggregate as 01 |
| 05 | additional_fees | AMBIGUOUS | S2 health/service/council components have waiver, enrolment and timing conditions; no universal aggregate |
| 10 | additional_fees | AMBIGUOUS | S3 insurance waiver, variable course packs, conditional loan fees; aggregate depends on profile |
| 11 | additional_fees | AMBIGUOUS | S4 estimated health/insurance/activity/service/transcript/recreation charges; insurance and one-time timing matter |
| 12 | additional_fees | AMBIGUOUS | Same S4 conditional/estimated aggregate |
| 17 | additional_fees | NO_REFERENCE | S5's USD 100 swim-test penalty is conditional, not the programme's required non-tuition aggregate |
| 20 | additional_fees | AMBIGUOUS | S6 combined tuition/fees cannot isolate the target |
| 23 | additional_fees | AMBIGUOUS | S7 CAD 701.62 is explicitly an estimated additional-fee figure for a particular historical student profile |
| 28 | additional_fees | AMBIGUOUS | S8 combined amount cannot isolate required fees |

Inventory: **5 KNOWN_EXACT, 0 KNOWN_RANGE, 12 AMBIGUOUS, 3 NO_REFERENCE**. Tuition: 5 exact / 5 ambiguous. Fees: 7 ambiguous / 3 no reference. Five programme labels reduce to **four independent tariff groups across four institutions** because MIT 01/03 share S1. No exact-label denominator of 20 is legitimate.

Sensitivity: treating S4's published semester tariff as an exact quoted rate would add two programme labels, but only one independent tariff group: seven labels/five groups. It still fails the eight-independent-target gate and creates no independent neighbours after hiding the shared policy. Conservative label treatment is not decisive to the recommendation.

No genuine source-stated range for the selected exact target survives. UCLA residency categories are not a range; ETH living-cost ranges are a different field; Pratt extended-track cost ranges concern another programme/duration. Excluding them avoids manufactured range labels.

Notable annotation hazards:
- Harvard's retained assertion can expose the second-year amount while the first-year table row is the actual target.
- Cornell's professional rate equals the undergraduate rate numerically. A zero numerical error would conceal a degree-scope failure.
- Duke's USD 4,000 deposit is credited to tuition. Adding it again overstates fees.
- S3 direct non-tuition components total 9,134 including insurance, or 4,844 excluding insurance. Neither is an unconditional all-required-cost label because course-pack and student-profile conditions remain.
- Montréal's exact decimal precision does not make an explicitly estimated amount exact truth.

## 6. Hierarchy and comparability audit

For finance, use compatibility gates before hierarchy ranking. A source legally governing the charge can outrank a nearby organisational page. H4 is not automatically weaker than H3 if an authoritative government schedule explicitly governs the target.

Observed financial source scopes before hiding: H0 programme-specific pages for 05/10/23 (three target associations); H1 faculty policy for 11/12 (two); H2 institution policies for 01/03/17/20/28 (five). These ten associations are not ten independent sources. H3: two named Harvard CSE comparator rows, one effective tariff lineage. No usable H4/H5 donor established in the selected inventory.

The following is the conceptual candidate feature vector. Y/N/? are match judgments, not learned scores. Every row is an evidence class; repeated programme assertions of that class are collapsed.

| Candidate | Level / authority | Entity / degree / faculty / discipline | Audience / cycle / age | Currency / basis / directness | Disposition |
| --- | --- | --- | --- | --- | --- |
| MIT common UG tariff | H2 official | Parent; UG Y; faculty broad; discipline broad | Standard UG Y; 2026–27 Y; contemporaneous | USD Y; term Y; direct policy | Exact-applicable label, hide shared tariff for both targets |
| Harvard general GSAS 59,048 | H1/H2 official | Parent; graduate Y; SEAS exception N; discipline broad | Standard graduate; 2026–27 Y | USD/year Y; general policy | Reject because explicit special-rate exception |
| Harvard CSE SM 67,504 | H3 official | Sibling; master's Y; SEAS Y; related computing | Full-time Y; 2026–27 Y; contemporaneous | USD first-year Y; direct sibling row | Exploratory donor, same-source dependence |
| Harvard CSE ME 67,504 first year | H3 official | Sibling; master's Y; SEAS Y; related computing | Full-time Y; 2026–27 Y | USD first-year Y; direct sibling row | Collapse with CSE tariff cluster; differing credential noted |
| Duke campus MEng 35,680 | H1 official | Parent; MEng Y; Pratt Y; listed programmes | Campus full-time Y; 2026–27 Y | USD/semester Y; estimated tariff page | Ambiguous reference; shared target policy hidden |
| Duke engineering management 36,225 | H1/H3 official | Same faculty; different degree/family | Similar cycle; target scope N | USD/semester Y | Reject degree/programme-family mismatch |
| Duke MBA charge | H0 official | Exact MBA, incomparable to MEng | Cohort/cycle Y | USD nine-month programme | Label only; no MBA donor established |
| Cornell professional tier 73,946 | H2 official | Parent; degree N; faculty/domain mixed | 2026–27 Y | USD/year Y | Reject even though number equals UG tariff |
| UCLA generic graduate | H2 official | Parent; MPH applicability ? | Residency split; cycle ? | USD; tuition-plus-fees N; approximate | Reject |
| Montréal MSc table | H0 official | Exact programme; thesis status ? | Residency distinctions; 2025–26 stale for target | CAD/15-credit term; estimate | Reject numerical label and current donor |
| ETH combined charge | H2 official | Parent; degree scope broad | Audience/cycle ? | CHF; combined basis N | Reject |

Sibling comparability requires same institution, compatible degree, discipline/faculty, campus/delivery, full-/part-time status, audience, cycle, currency and basis. Unknown required dimensions cause abstention, not a small weight penalty. No currency conversion, cross-country prior, or degree-duration imputation.

## 7. Leakage prevention and experiment methods

The held-out target is programme tuition. Authoritative evidence explicitly applying a central tariff to a programme is still target evidence: it cannot become its own “institution fallback” or be laundered through another programme assertion.

Procedure:
1. Keep label values in an evaluation map, separate from donor inputs.
2. Remove the target row, all derived assertions, repeated captures and shared target-policy lineage.
3. Do not treat Run7/Run8 copies, duplicate URLs, or inherited copies as independent neighbours.
4. The only exploratory exception is a row-level holdout at S2: whitelist only the independently named CSE rows; omit the Data Science row and associated annual/second-year calculations. This permits a sibling comparison but not source-independent validation.
5. Repeat with entire S2 source withheld. This stricter sensitivity is the decisive generalization check here.
6. Exact factual acceptance/promotion is not invoked or changed. Calculations are isolated in-memory Python, not new runtime code.

No claim is made to have simulated a general automated resolver: compatible donors were manually audited from the stated retained inventory. This is a label-constrained feasibility experiment.

Methods and preliminary abstention:
- A institution fallback: compatible H2 tariff from independent retained evidence; reject known exceptions.
- B nearest sibling: compatible H3 donor, deterministic similarity order then donor ID; one effective lineage permitted only as a mentor-review exploratory estimate.
- C weighted neighbours: compatible donors weighted by degree/faculty/cycle/audience/authority matches; at least two independent policy lineages.
- D robust hierarchy: weighted median over the same compatible independent donors, at least two lineages.
- Missing units/currency/cycle, stale-only support, wrong audience/degree, no comparable source, or unresolved same-scope disagreement → INSUFFICIENT_COMPARABLE_EVIDENCE.
- Multiple copies of one policy never increase support count or shrink an interval.

The two Harvard CSE rows have weights 3 (SM) and 2 (ME), then are collapsed to one shared-tariff cluster with maximum weight 3. No estimator is tuned against the target value. The numerical result is unaffected by these weights because only one effective donor remains. Methods C/D do not pretend a singleton supports a robust ensemble.

## 8. Case-level results

“Hidden” includes shared applicable policy as well as direct programme evidence. A dash means no estimate/error, not zero. This table reports B, the sole non-abstaining method; A/C/D abstain on all targets.

| Case | Field | Exact reference | Hidden? | Pre-holdout levels | B estimate | Error | Uncertainty | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | tuition | USD 33,360/term | Yes, S1 shared tariff | H2 | — | — | No independent donor | ABSTAIN |
| 03 | tuition | USD 33,360/term | Yes, S1 shared tariff | H2 | — | — | No independent donor | ABSTAIN |
| 05 | tuition | USD 67,504 first year | Yes, target row; whole-source sensitivity below | H0/H1/H3 | USD 67,504 | USD 0; 0% | HIGH/unquantified; support one policy | MENTOR_REVIEW |
| 10 | tuition | USD 107,900 programme | Yes | H0 | — | — | No compatible MBA donor | ABSTAIN |
| 11 | tuition | Ambiguous quotation | Yes, applicable S4 policy | H1 | — | Not evaluable | Reference and donor insufficiency | ABSTAIN |
| 12 | tuition | Ambiguous quotation | Yes, applicable S4 policy | H1 | — | Not evaluable | Same | ABSTAIN |
| 17 | tuition | USD 73,946/year | Yes, UG tariff | H2 | — | — | Professional donor invalid | ABSTAIN |
| 20 | tuition | Ambiguous | No usable exact label | H2 | — | Not evaluable | Scope/cycle/unit | ABSTAIN |
| 23 | tuition | Ambiguous estimate | No usable exact label | H0 | — | Not evaluable | Stale/estimated/student status | ABSTAIN |
| 28 | tuition | Ambiguous combined figure | No usable exact label | H2 | — | Not evaluable | Decomposition/cycle | ABSTAIN |
| 01/03/05/10/11/12/17/20/23/28 | additional_fees | Individually classified in section 5 | Labels/components excluded from donors | H0/H1/H2 | — for every case | Not evaluable | Aggregate/profile incomplete | ABSTAIN for every case |

No AUTO_DISPLAY_ESTIMATE or DISPLAY_WITH_WARNING is supported by the empirical evidence. Harvard is a candidate for mentor review, not validated product-ready useful coverage.

### Method comparison

Coverage denominator is the ten tuition targets treated as missing-exact/held-out. On the five exact-label rows, the one prediction is 1/5, but that is not the product coverage denominator.

| Method | Non-abstained candidate coverage | MAE | Median absolute relative error | >30% error rate | Abstention | Complexity |
| --- | --- | --- | --- | --- | --- | --- |
| A institution | 0/10 | Unavailable | Unavailable | Unavailable | 10/10 | Low |
| B nearest sibling, row holdout | 1/10 = 10% | USD 0, N=1 | 0%, N=1 | 0/1, not a population bound | 9/10 | Low |
| C weighted neighbours | 0/10 | Unavailable | Unavailable | Unavailable | 10/10 | Low–medium |
| D weighted median | 0/10 | Unavailable | Unavailable | Unavailable | 10/10 | Low–medium |
| A/B/C/D, whole-source holdout | Each 0/10 | Unavailable | Unavailable | Unavailable | Each 10/10 | Same |

Validated useful coverage is not established. The reported 10% is an exploratory non-abstention upper bound before mentor approval, far below 60%. Zero error over one dependent comparison is not evidence of precision preservation for estimated output. Exact rail preservation here is by non-modification, not a newly executed correctness benchmark.

### Evidence-level comparison

| Level | Numerical predictions | Median error | Dispersion / support | Recommendation |
| --- | --- | --- | --- | --- |
| H1 | 0 | Unavailable | Insufficient independent compatible evidence | Acquire labels before modelling |
| H2 | 0 | Unavailable | Applicable shared policy was label evidence | Reuse for exact applicability, do not claim estimation success |
| H3 | 1 exploratory; 0 source-held-out | 0% for one | Two equal rows, one tariff lineage | Mentor review only |
| H4 | 0 | Unavailable | Not represented as usable donor | No conclusion |
| H5 | 0 | Unavailable | No prior trained or justified | Do not build |

### Numerical reproducibility

Audited label map: 01=33360, 03=33360, 05=67504, 10=107900, 17=73946, each with units from section 5. Prediction code receives no label map. Its sole surviving row-holdout donor cluster is:

    target: 05
    cluster: SEAS-CSE-2026
    members: CSE SM first-year 67504; CSE ME first-year 67504
    level: H3
    effective support: 1
    representative weight: 3

A filters to H2 and abstains. B returns the representative value. C/D require two clusters and abstain. Whole-source holdout removes the cluster. Error is calculated afterward against labels. These operations were executed in memory; no estimator implementation file was added.

## 9. Residuals and uncertainty findings

The general GSAS first-two-year amount is USD 59,048. The SEAS Data Science/CSE first-year amount is 67,504: difference 8,456. A naive general-rate estimate would underpredict Data Science by 12.5267%. It is an explicitly incompatible policy probe, not a valid A prediction.

Within the retained SEAS table the first-year values agree, suggesting a shared tariff. That is one policy schedule, not independent observations establishing a faculty random effect. Same-faculty, cross-faculty, same-degree, and cross-degree residual variances cannot be estimated credibly from this inventory. Cornell demonstrates that a wrong-degree donor can have the right number; error alone does not certify semantics.

Evidence distance versus error: **not measurable** (one evaluated hierarchy level, one prediction). Dispersion versus error: **not measurable**. Reliable/bad-estimate separation: **not demonstrated**. No rank correlation, bucket monotonicity or interval coverage claim is possible.

The provisional output should retain point, source level, effective support count, uncertainty reasons and an optional descriptive observed range. A singleton must have interval=null/INSUFFICIENT_SUPPORT, not [67504,67504] advertised as certainty. Equal correlated rows do not justify zero uncertainty. No “90% interval,” calibrated probability, or LLM-confidence interpretation is reported.

Monotonicity remains a hypothesis, not a rule proved here. A directly applicable central tariff can be more informative than an adjacent faculty's unrelated professional schedule. Compatibility and legal scope precede distance.

## 10. Normalization feasibility

Implementation references: [FieldAssertion](../../services/data-ingestion/src/glowbal_ingestion/models.py) at line 556 stores value_json, audience, cycle, scope, degree_level, source relationship/authority, evidence and lineage. [validation.py](../../services/data-ingestion/src/glowbal_ingestion/validation.py) around lines 1480–1540 checks tuition cycle, fee period, audience and duplicate tuition/fees. Representability is not reliable population completeness.

| Requirement | Status in audited representation/data | Finding |
| --- | --- | --- |
| Currency | SUPPORTED representation; partial population | Structured financial values can carry currency; combined or textual values still require inspection |
| Period / unit basis | PARTIAL | fee_period exists and is validated; annual/term/full programme/per-credit cannot be freely interchanged |
| Academic cycle | PARTIAL | First-class assertion field; missing/stale/estimated applicability remains in S6–S8 |
| Audience/residency | PARTIAL | audience exists; detailed residency, insurance, thesis and funding profiles are not uniformly normalized |
| Degree | PARTIAL | degree_level exists; professional exceptions require source-native scope checks |
| Duration/load | PARTIAL | Programme text may state credits/semesters; no automatic conversion is warranted from every candidate |
| Mandatory/optional/waiver | MISSING as consistently populated comparable fee contract in this sample | Additional-fee values mix deposits, penalties and waived charges |
| Tuition versus COA/fees | PARTIAL | Existing semantic checks help; S6/S8 cannot be decomposed from retained figures |
| Independent policy lineage | PARTIAL | URL/hash/inherited links exist; repeated rows still need audited policy clustering |
| Source-stated estimate versus final tariff | PARTIAL | Source text distinguishes this; numeric precision alone does not |

Specific rejected comparisons: Harvard year-one versus one-term second year; Pratt semester versus total/accelerated summer schedule; Cornell BS versus MEng; UCLA resident versus nonresident and professional exceptions; Montréal 2025–26/15-credit/status estimates versus current charges; ETH combined tuition/fees. No averaging across USD/CAD/CHF. No extrapolation from per-credit without actual load.

Additional_fees is currently less suitable than tuition. A future experiment could define a single named mandatory fee with explicit student conditions, but silently changing the target to make this audit pass would be invalid.

## 11. Cost and Pareto assessment

P/sources.jsonl contains **356 source rows and 190 unique URLs** for Run8. 356/36 = 9.89 source rows per programme is a storage aggregate, not HTTP attempts per programme. Duplicates, redirects, robots checks, retries and failed requests prevent treating rows as exact cost.

The current retained official artifacts do not establish complete provider-attempt/token totals for this counterfactual. No authoritative dollar cost, request savings, token savings, latency savings, or avoided recovery-round count is calculable for the ten targets.

Measured current-task acquisition: **0 network requests, 0 provider calls, 0 tokens purchased, 0 recovery rounds**. Stored parsing and the small in-memory calculation incur local CPU and substantial manual label-review effort; these are not free product costs.

Conditional cost statement: if a stored estimate causes a future exact-recovery attempt to be skipped, its incremental network/provider work is avoided. The number and price depend on the unexecuted recovery path. If exact recovery would already stop or reuse cache, savings may be zero. Maintaining common tariffs and labelling/comparability work must be amortized across users/programmes.

| Method | Candidate coverage gain over held-out exact-only | Error evidence | Uncertainty utility | Incremental acquisition | Pareto finding |
| --- | --- | --- | --- | --- | --- |
| Exact-only, no new acquisition | 0 | Abstains | Honest missing evidence | Zero | Valid conservative baseline |
| A | 0 | None | No improvement | Zero | No demonstrated benefit |
| B | +10 points exploratory; source-held-out +0 | One dependent zero-error result | Unvalidated | Zero | Only candidate for further research |
| C | 0 | None | Support insufficient | Zero | No justification for added ensemble complexity yet |
| D | 0 | None | Support insufficient | Zero | Robustness advantage not testable |

No favourable production ROI is established. Cached explicit policy applicability may yield value without estimation; evaluate it separately from withheld-label estimation.

## 12. Mentor review and feedback design

All ten fee targets and nine tuition targets abstain. The one exploratory tuition estimate needs mentor review because support is dependent and uncertainty unvalidated. Mentor workload/correction rate was not observed and must not be reported as low.

A minimal future immutable feedback event could link:

    entity_id, field, target_scope, cycle, audience, currency, unit
    estimate_id, estimator_version, point, interval, uncertainty_reasons
    evidence_ids, policy_cluster_ids, evidence_level
    mentor_value_or_abstention, mentor_reason, correction_evidence_ids
    actor_id, created_at, supersedes_event_id, expiry_or_review_at
    residual (only for matching numeric units/scope)

Keep the machine estimate and mentor correction separate. A correction without evidence is not automatically verified truth. Compute a residual only for comparable quantities; null/ambiguous decisions need explicit reasons.

Reuse candidates: [inheritance.py](../../services/data-ingestion/src/glowbal_ingestion/inheritance.py) review_fingerprint and lineage mechanisms; [review_approval.py](../../services/data-ingestion/src/glowbal_ingestion/review_approval.py) ReviewDecision/process_review_csv; [approved_assertions.py](../../services/data-ingestion/src/glowbal_ingestion/approved_assertions.py) ApprovedAssertionRepository. These are existing review/provenance primitives, not an implemented estimate-residual learning system. No schema was changed.

## 13. Feasibility and smallest justified next step

| Dimension | Rating for a useful MVP now | Reason |
| --- | --- | --- |
| Data | LOW | Four independent exact policy groups; one dependent prediction |
| Normalization | LOW | Comparable tuition units require manual checks; aggregate fees unusable |
| Estimation | LOW empirical support | Arithmetic is easy; independent compatible neighbours are sparse |
| Uncertainty | LOW | No estimable error-distance relationship or interval performance |
| Product | MEDIUM design feasibility | Separate advisory semantics possible, but auto-display unsupported |
| Engineering | HIGH for a future small shadow experiment | Existing lineage/scope/review primitives reusable; integration remains unauthorized |

The prior architecture audit's “small MVP feasible” should now be qualified: an inventory/probe is feasible, an empirically justified estimated-product MVP is not yet supported by the retained sample.

No production architecture delta is recommended now. The smallest next task is a **stored-evidence label sufficiency extension**, tuition only:
1. Identify at least eight independent exact tariff targets and eligible non-target donors, with at least five institutions represented.
2. Include real field-compatible alternative policies, true same-scope disagreement, and abstention controls. If retained evidence lacks these, report a bounded evidence request for separate authorization.
3. Freeze target scope, unit, student profile, donor whitelist and policy/source holdout partitions before prediction.
4. Repeat all four simple methods with unchanged criteria; preserve a source-held-out result alongside row holdout.
5. Count human annotation time and define the future acquisition counterfactual before claiming cost savings.

Do not broaden into unrelated fields to reach N. Eight is a minimum feasibility screen, not deployment validation.

If a future experiment passes, the minimum sketch is an offline resolver over current source graph/inheritance lineage plus explicit compatibility filters, a simple estimator function and a separate report-only estimate record. Reuse FieldPolicy concepts without modifying current rules; reuse review fingerprints for feedback linkage. Only subsequent evidence should justify product storage/read-model work. Exact promotion remains unchanged.

What not to build now: Bayesian hierarchical models, learned similarity embeddings, cross-country priors, calibrated-probability badges, full VOI optimizers, automatic feedback training, broad estimate tables/product APIs, or generalized acceptance relaxation. No evidence here distinguishes their benefit from a single audited lookup.

## 14. Preservation and limitations

The pre-existing tracked-diff SHA-256 remains:

    3f83b721d959ccc8b033b1225e742c1f464b5981e1a7a9072ead3f9967e20cab

The previous architecture report hash remains:

    e474d9a1a2c91fccd13681e92612e2a9ab0d54dbfbf8d6286f517d77176aca3f

The frozen V3 manifest remains:

    d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c

This audit does not certify new pipeline correctness, complete Rem13, or reopen any exact-evidence gate. Tests/live smokes were not rerun because no implementation changed. Results concern the explicitly audited retained population; unqueried Mongo/Supabase stores or other raw pages may contain additional labels. Absence here is not proof of global data absence.

Final preservation check: all 5,242 files in the pre-existing architecture-audit snapshot matched their recorded hashes (zero mismatches). The eight financial raw payload hashes matched their source records; Run8 output and the tracked diff matched the hashes above. git diff --check passed, with only existing line-ending warnings. The new report also passed a separate trailing-whitespace/UTF-8 check.

## 15. Decision

**B — CONTINUE RESEARCH ONLY.**

The MVP is INCONCLUSIVE: only one source-dependent exploratory prediction, 10% candidate coverage and no measurable uncertainty signal; whole-source holdout yields zero predictions. Keep the exact-evidence rail and Slice F implementation paused for this direction. Next authorize only the bounded tuition label/donor sufficiency extension, not an estimation architecture implementation.
