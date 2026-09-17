# Hierarchical evidence proof-of-strategy — tuition

This is a bounded offline strategy test. It uses the frozen tuition target list and does not implement a resolver, estimator service, schema, API, calibration model, mentor loop or production change. Benchmark V3, exact-evidence promotion semantics, Remediation 13 and the existing inference code are unchanged.

The authoritative input is the [label/donor sufficiency freeze](data/tuition-hierarchical-label-donor-sufficiency-freeze.json). The strategy snapshot is frozen in the [proof-of-strategy manifest](data/tuition-hierarchical-proof-of-strategy-freeze.json). The machine-readable result is [the strategy audit](data/tuition-hierarchical-proof-of-strategy-audit.json), with the [acquisition ledger](data/tuition-hierarchical-proof-of-strategy-acquisition-ledger.jsonl) and [donor graph](data/tuition-hierarchical-proof-of-strategy-donor-graph.json).

## Frozen evaluation population

The experiment kept all 12 frozen exact tuition targets. They represent 6 institutions and 10 independent target policy clusters. The target-label gate therefore remains PASS. No target label, currency, basis, cycle, audience, residency or policy cluster was changed after the earlier freeze.

The donor gate was precommitted to require at least eight frozen targets with an independent compatible donor surviving row holdout, whole-source holdout and policy-lineage holdout. A same-source Harvard CSE sibling remains a row-only sensitivity candidate; it is not an independent donor.

## Bounded acquisition

One tranche was used: 24 of 24 permitted official HTML/PDF requests, one recovery round, zero provider calls, zero paid LLM calls, zero tokens and zero JS-render requests. Two PDF URLs were attempted; the remainder were HTML. Every request was recorded with target, candidate URL, expected hierarchy, compatibility, expected independence, information value and cost before retrieval in the ledger.

The earlier sufficiency report’s proposal contained several convenient programmes that were not in the frozen target list. The scope audit preserved those requests as misses rather than silently turning them into new targets. Five requests were fully aligned to a frozen target (Harvard and Cornell), three were partial Duke checks that failed the MBA compatibility gate, and sixteen were mismatched convenience-target requests. None entered the evaluation population. This is a limitation of the tranche, not a relabelling of the frozen set.

The fetched official sources illustrate why the hard gates matter:

* Harvard’s 2026–2027 schedule explicitly puts CSE SM and Data Science SM in one SEAS table at $67,504, so the apparent H3 donor is one policy lineage, not independent support ([Harvard cost schedule](https://gsas.harvard.edu/apply/cost-attendance-2026-2027)).
* Duke’s Pratt page gives MEng tuition as an estimated $35,680 per semester and identifies a different MEng regime; this cannot donate to the frozen nine-month Accelerated MBA full-programme value ([Duke Engineering tuition](https://masters.pratt.duke.edu/admissions/tuition-financial-aid/)).
* Northwestern’s SPS page exposes programme-specific per-unit and quarter rates, but the fetched Information Systems pages were convenience graduate targets rather than the frozen undergraduate dual degrees ([Northwestern SPS finance](https://www.northwestern.edu/sfs/tuition/graduate/school-of-professional-studies.html)).
* The University of Tokyo central page gives ¥535,800 annual graduate tuition, but it is a foreign, non-frozen target and no cross-currency prior is permitted ([University of Tokyo tuition](https://www.u-tokyo.ac.jp/en/prospective-students/tuition_fees.html)).
* ETH reports CHF 804 per semester as tuition plus semester fees, which violates the tuition-only contract ([ETH financial information](https://ethz.ch/en/studies/financial.html)).
* Sorbonne’s 2026/2027 master fee is €255, with differentiated non-EU rules and exemptions that require audience/residency resolution before reuse ([Sorbonne tuition rules](https://www.sorbonne-universite.fr/en/education/study-sorbonne-university/enrolment-procedures-and-tuition-fees)).
* Michigan’s College of Engineering table is per-credit with resident/nonresident bands, not an annual target basis ([Michigan Engineering tuition](https://ro.umich.edu/tuition-residency/tuition-fees/2026-2027/undergraduate/full-term/college-engineering-undergraduate)).

### Donor yield curve

The yield curve is cumulative independent donors surviving all three holdouts. It is zero at every checkpoint. The five fully aligned and three partial requests are the only requests that can be interpreted as frozen-target acquisition; the sixteen mismatched rows are retained for auditability and never count as donor coverage.

| Requests through | Independent donors added | Targets with an independent donor | Observation |
| ---: | ---: | ---: | --- |
| 4 | 0 | 0 | Harvard rows dependent; Duke candidate failed or was incompatible |
| 8 | 0 | 0 | No policy-independent donor |
| 12 | 0 | 0 | Cornell programme/central rows dependent or unverified |
| 16 | 0 | 0 | Foreign convenience targets rejected before estimation |
| 20 | 0 | 0 | No compatible policy lineage for a frozen target |
| 24 | 0 | 0 | Hard cap reached |

The marginal donor yield is therefore zero. The scope defect means this tranche cannot prove that every possible frozen-target URL was exhausted, but it also produced no evidence that relaxing search breadth would create independent donors.

## Donor graph and sufficiency

The full graph is in the [JSON donor graph](data/tuition-hierarchical-proof-of-strategy-donor-graph.json). Its frozen-target summary is:

| Target family | H1 | H2 | H3 | H4 | Result |
| --- | --- | --- | --- | --- | --- |
| MIT AI+D / Chemical Engineering | empty or same standard UG tariff | same tariff | sibling same tariff | none | dependent |
| Harvard CS AB | Harvard College tariff | empty | empty | none | dependent |
| Harvard Data Science SM | SEAS schedule | general GSAS tariff | CSE SM in same table | none | dependent, incompatible or row-only |
| Princeton Astro AB / CS MSE | same UG or regular graduate tariff | empty | empty | none | dependent |
| Duke Accelerated MBA | Pratt MEng estimate | empty | BME MEng scope-only | none | incompatible or ambiguous |
| Northwestern dual degrees | same UG tariff | empty | sibling rows in same table | none | dependent |
| Cornell MPS AEM | professional Tier 1 tariff | central row unverified | same target scope | none | dependent or ambiguous |
| Cornell CS BS / Information Science BS | same endowed/CALS tariff | central row unverified | equal-number cross-tariff rows | none | dependent or misleading |

Strict counts are H1 **0**, H2 **0**, H3 **0**, H4 **0**. Candidate records represent H1, H2 and H3; no H4 candidate survived. There are 0 targets with an independent donor, 12 without one, 0 independent donor policy clusters, 0 whole-source survivors and 0 policy-lineage survivors. The only apparent H3 success is the source-dependent Harvard CSE row allowed for row-holdout sensitivity only.

The absence has several causes rather than one missing URL: institution and faculty tuition rows are often the same tariff lineage; named programme exceptions defeat nearby central rates; degree and professional/academic regimes differ; residency and audience alter tariffs; and per-credit, per-semester, annual and full-programme bases cannot be converted for this test. Numerically equal Cornell values remain a misleading-donor control.

**DONOR SUFFICIENCY: FAIL.**

## H1 — coverage

Useful estimate coverage is 0/12 = **0%**, against the 60% screening gate. No frozen target had an admissible independent donor after policy-lineage holdout. The result does not support the claim that bounded hierarchical evidence exists often enough for tuition.

## H2 — accuracy and uncertainty

The donor gate failed, so the precommitted stop rule prohibited prediction. Methods A (nearest compatible independent donor), B (weighted compatible donors) and C (robust weighted median) were **NOT RUN**. There are no case predictions, absolute errors, relative errors, tail-error rates or maximum error to report. The product simulation classifies all 12 frozen targets as `ABSTAIN`; there are zero auto-display estimates, zero warning estimates and zero mentor-review estimates.

The uncertainty questions are all **NOT MEASURABLE**:

* donor distance cannot be compared with error;
* support or policy-lineage count cannot be compared with error;
* donor dispersion cannot be compared with error; and
* bad estimates cannot be identified before truth because no estimate was allowed.

No calibrated probability is claimed. Verified facts remain separate from hypothetical estimates throughout the ledger and graph.

## H3 — economics

The tranche consumed 24 official requests and yielded zero reusable independent donors. It made zero provider calls, used zero paid extraction, and needed no JS rendering. The frozen exact-recovery counterfactual is five `CACHE_ONLY`, four `CHEAP_FETCH` and three `MULTI_SOURCE_RECOVERY` targets. For this population, the observed hierarchical path has no request, provider or latency saving to offset its acquisition and audit work; it cannot demonstrate positive ROI.

The current tranche did not have a stopwatch instrument for manual phases. It records request outcomes but does not invent minute values. The prior retained-evidence freeze measured 9.39 analyst wall minutes for search and label/donor audit (2.50 target-label review, 1.75 donor audit, 0.70 normalization and 0.39 policy clustering); those figures are the available human-cost baseline, not a fabricated measurement of this web tranche. Manual review therefore remains a real cost, and no human-effort saving is demonstrated.

## Strategy verdict and next decision

All three hypotheses are not jointly supported: H1 fails at zero useful coverage, H2 is not measurable under the mandatory donor gate, and H3 shows no relative cost advantage. The evidence is consistent with a tuition domain where shared tariffs and strict applicability rules make independent hierarchical donors rare. The scope correction also prevents claiming that one more broad crawl would solve the problem; the yield curve is already flat and the authorized cap is exhausted.

Do not implement hierarchical tuition architecture. Do not change exact-evidence semantics, promotion, Benchmark V3 or production code. The next user decision is whether to close this tuition strategy line or separately authorize a corrected frozen-target-only value-of-information test; no automatic second tranche is proposed.

D — STRATEGY NOT SUPPORTED FOR TUITION
