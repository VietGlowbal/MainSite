# Data Platform: Hierarchical Evidence, Uncertainty, and Cost-Aware Architecture Audit

Date: 2026-09-09

Scope: read-only architecture and feasibility audit of the local
data-platform worktree. No production code, frozen benchmark artifact,
official benchmark, provider, commit, or push was changed or run for this
audit. This report is the only repository file created by the audit.

## Executive decision

The current platform should remain the exact-evidence foundation. It already
contains valuable safety primitives: durable raw-evidence references, source
authority and relationship metadata, temporal and applicability gates,
assertion lineage, explicit operational failure states, identity safeguards,
quality-gated promotion, and a separate advisory inference path.

The proposed direction is technically feasible, but the current code is not
yet a general hierarchical probabilistic system. It contains conservative
institution-level assertion sharing and a narrowly defined historical
recurrence estimator. A broad Bayesian hierarchy would be premature because
the available observations are sparse, mostly uncalibrated, and not yet
separated into training labels, validation labels, and product outcomes.

The recommendation is a staged hybrid:

    verified exact-evidence rail
            |
            +--> bounded hierarchical evidence resolver
            |          |
            |          +--> advisory estimator for permitted fields
            |                         |
            |                         +--> calibrated uncertainty
            |                                      |
            |                                      +--> cost-aware stopping
            |
            +--> existing quality-gated product rail

The estimate rail must be additive and read-model-only. It must never
overwrite a verified value, turn FOUND into an estimate, or make an estimate
eligible for identity, live status, exact deadline, admissions eligibility,
or another safety decision.

## 1. Method and workspace state

I used three modes as requested:

1. Factual inventory: claims about current behavior are tied to source files,
   classes, functions, SQL definitions, artifacts, or tests. Design documents
   are treated as intent unless implementation confirms them.
2. Architecture exploration: hierarchy, uncertainty, cost policy, options,
   and mitigations are proposals and are labeled as such.
3. Adjudication: options are scored on a five-point favorable scale. These
   scores are architecture judgments, not benchmark measurements.

The local checkout was:

| Item | Observed value |
| --- | --- |
| Repository | C:\Users\ADMIN\orca\workspaces\MainSite\data-platform |
| Branch | feature/data-platform |
| HEAD | 5b37ccd07d5cf912272099b07488f5af56e22aca |
| Pre-existing status entries | 84 |
| Pre-existing modified entries | 11 |
| Pre-existing untracked entries | 73 |
| Pre-existing tracked-diff fingerprint | 3f83b721d959ccc8b033b1225e742c1f464b5981e1a7a9072ead3f9967e20cab |

The worktree was already dirty. The local Remediation 13 set was separated
from unrelated work as follows:

| Classification | Files or directories |
| --- | --- |
| Local Remediation 13 production | services/data-ingestion/src/glowbal_ingestion/config.py, deepseek.py, pipeline.py, and untracked source_recovery.py |
| Local Remediation 13 tests/tooling | services/data-ingestion/tests/test_remediation13_operational_recovery.py and scripts/analyze_phase3f_remediation13.py |
| Local Remediation 13 report/diagnostics | docs/benchmarks/2026-09-08-phase3f-remediation-13-operational-recovery-report.md and docs/benchmarks/remediation13/ |
| Local Remediation 13 status metadata | docs/current-status.md |
| Unrelated tracked application work | package.json, the three import/seed scripts, src/app/api/applications/from-course-url/route.ts, src/lib/course-parser/job-processor.ts, and src/lib/ingestion/ingestion-job-queue.ts |
| Unrelated untracked convergence/SQL | src/lib/ingestion/convergence.ts, its test, and the three supabase-*-v3.sql files for convergence/source resolution/evidence quality |
| Historical benchmark material | untracked dated benchmark reports, review batches, run directories, and remediation artifacts under docs/benchmarks/ |
| Other untracked material | docs/runbooks/ and other generated or historical directories |

No dirty file was used for a committed implementation claim without labeling
it as local. The Remediation 13 diff is an architecture signal, not a
committed design baseline.

The official Run #8 pipeline output was checked directly. Its SHA-256 is
87ec1dc88da485c746edbca5615cf00c7543cf3111a66d2949fcb6f4fd4bf74f. The
frozen V3 anchors in the checkout also matched:

| Artifact | SHA-256 |
| --- | --- |
| V3 freeze manifest | d798b2031a342f3de37c2dd3844638a8b0a015a815846605db8e4572a1ec409c |
| Frozen GT V3 | af91cf8d7df798edff98fa15588e4399800d06e6b9eed59a0b751590491dbafc |
| Scorer v2 JSON | 86d651860b25e3a3bef1ffe3b6e172b21a1f930febdb31c886b43930981579c8 |
| Machine scorer | 68e9a7412c4fd3dd8d933e549ef343dcd63f4ee2685cdf2316051b765128bad7 |

No provider call, refetch, benchmark execution, test suite, commit, or push
was performed for this audit.

## 2. Current architecture map

The implementation is best represented as two related rails. The legacy
execution rail produces the benchmark result; newer acquisition and quality
components observe or stage additional facts around it.

    institution seeds / configured source bundles
        -> CatalogueDiscovery / discovery backend
        -> SafeFetcher and access policy
        -> raw snapshot retention
        -> HTML/PDF/JSON parser registry
        -> deterministic facts and DeepSeek extraction
        -> validation and runtime acceptance
        -> FieldAssertion records
        -> best assertion selection / consolidation
        -> coverage, conflict, recovery, historical inference
        -> promotion v3 safety evaluation
        -> canonical projection, product export/read, human review

The official runner has a sealing boundary before frozen scoring.
scripts/run_phase3f_v3_benchmark.py records the dynamic Git revision,
seals the execution projection, and records that the scorer was not invoked
before sealing. This is an appropriate exact-evidence benchmark boundary.

### Acquisition and source evidence

acquisition.py defines AcquisitionIntent, SourceCandidate, and
AcquisitionAttempt. A candidate carries source class, authority, relationship,
relationship evidence, expected field groups, temporal state, freshness, fetch
strategy, cost class, and provider/dataset identity
(services/data-ingestion/src/glowbal_ingestion/acquisition.py:56-150 and
:232-246).

source_adapters.py provides SourceRegistry, SourceResolver,
AcquisitionPlanner, and adapters for catalogues, PDFs, JSON APIs, structured
datasets, related sources, search fixtures, and archives
(source_adapters.py:121-357 and :360-646). The resolver scores authority,
relationship, temporal state, relevance, and cycle applicability
(source_adapters.py:232-316). This is already a useful admission primitive.

The planner has field-group source orders. Tuition uses finance/web/
government/PDF/archive classes; language uses international and central
admissions; deadlines use central admissions/web/PDF/archive
(source_adapters.py:319-357). This is a rule-based source hierarchy, not yet
a general evidence-distance or expected-value controller.

The wiring limitation is explicit in the current pipeline:
AcquisitionPlatformBackend is constructed as a shadow companion to the legacy
discovery algorithm, and the comment says it is not a crawler or acquisition
replacement (pipeline.py:554-579). The quality layer is also described as
shadow-only and does not own the existing fetcher or canonical writer
(pipeline.py:3173-3233). The current benchmark therefore does not execute a
complete hierarchical source resolver as its primary acquisition path.

fetcher.py:55-190 implements SafeFetcher, including URL validation, redirect
limits, throttling, allowed domains, response handling, and access policy.
This is a safety boundary to retain. A hierarchy must rank eligible sources;
it must not bypass access controls.

The source-scope audit is:

| Relationship | Represented now | Actively searched as a universal fallback? |
| --- | --- | --- |
| Direct programme official | Source relationship, programme URL, page types | Yes in the legacy configured/discovery path |
| Department/faculty/school | Source relationship and OrganisationUnit model; related-link adapters | Partly; depends on configured/discovered links |
| Parent institution | Source relationship and shared institution bundles | Partly; inheritance is explicit and policy-limited |
| Central admissions | Source relationship and field-group planner | Partly; configured source bundles and adapters, not a universal live frontier |
| International admissions | Represented and planned for language/admissions | Partly |
| Finance office | Represented and planned for tuition/fees | Partly |
| Government/accreditor | Source authority/relationship and structured adapters | Candidate/admission support exists; not universal fallback |
| Official partner | Represented by authority/relationship rules | Candidate admission requires relationship evidence |
| Catalogue/PDF | Page types, adapters, parser support, planner classes | Available when discovered/configured |
| Archive | Authority/relationship, archive adapter, historical policy | Available for permitted historical recovery |
| Aggregator/search | Enumerated as lower-authority sources and discovery adapters | Discovery only or policy-limited; not direct truth |

Thus the current system mainly recognizes source relationships and admits
already-known candidates. It does not consistently traverse all relationships
as a field-specific fallback hierarchy. This is the central reuse opportunity
for a rule-based first stage.

### Raw evidence and parsing

raw_evidence.py:64-128 defines immutable snapshot inputs with canonical URL,
payload hash, content type, retrieval time, cycle, language, HTTP status,
safe response headers, source authority/relationship, and acquisition run
identity. RawEvidenceStore exposes retrieval by raw document ID, hash, and
source identity.

mongo_raw_evidence.py:159-206 stores small payloads inline and larger payloads
in object storage using the content hash. The staged Supabase acquisition
migration deliberately stores references and audit metadata, not raw bodies
(supabase-crawl-acquisition-v3.sql:1-4 and :31-94).

parser_registry.py separates parser identity/version from raw documents and
has HTML, PDF, and JSON parser boundaries. parsing.py supplies HTML, PDF,
sitemap, page-type, and visible-text parsing. deterministic.py is explicitly
limited to high-precision facts safer than an LLM guess
(deterministic.py:391-445). This is the correct place to add deterministic
numeric extraction later.

### Extraction and assertions

extraction_provider.py defines a provider-neutral request/result protocol.
deepseek.py validates structured output and requires each fact confidence to
be a number in [0,1] (deepseek.py:567-587). That number is supplied by the
model response; it is not a measured probability of correctness.

models.py:70-119 defines:

- VerificationStatus: discovered, fetched, AI extracted, rule validated,
  needs review, human verified, rejected;
- EpistemicState: observed, derived, inferred;
- TemporalState: current, historical, future, target-cycle estimate,
  unknown;
- SourceAuthority and SourceRelationship;
- policy, page, and organisation-unit classifications.

FieldAssertion is the central evidence-bearing object
(models.py:556-600). It stores value or null reason, source URL/type,
evidence and locator, scope, audience, academic cycle, retrieval time,
confidence, verification status, extractor/model/schema versions,
applicability evidence, raw-document ID, parser/provider identity,
degree/country, applicability state, publication and validity dates,
epistemic state, temporal state, source authority, and source relationship.
This is a strong base for a second rail because provenance and scope are
attached to the assertion rather than hidden in a final value.

best_assertions.py groups and ranks assertions using semantic completeness,
cycle, verification, and a confidence component (best_assertions.py:210-282).
That ranking must not be reinterpreted as calibrated probability without a
calibration study.

### Validation, coverage, recovery, and inference

runtime_acceptance.py contains field-specific gates. It has dedicated
programme-status diagnostics that record status candidate, explicit open
evidence, cycle/intake, window dates, current applicability, programme
applicability, acceptance reason, and rejection reason
(runtime_acceptance.py:403-463). It has separate tuition, deadline, English,
and major-admissions reason functions (runtime_acceptance.py:477-633).
This field-risk policy must remain in front of any hierarchy.

coverage.py:144-356 distinguishes FOUND, NEEDS_REVIEW, stale evidence,
conflict, not-published/not-required, source-not-found, access-blocked,
fetch/parse/extraction failures, and not-evaluated. It treats operational
failure as different from absence and uses field policy to decide whether an
assertion is acceptable.

conflicts.py compares values only when semantic scope, audience, cycle, and
other dimensions overlap. It can auto-resolve by authority, temporal,
verification, and relationship ranking or retain a review state
(conflicts.py:175-354). This prevents different-scope observations becoming
one statistical sample.

recovery.py:39-48 defines a bounded RecoveryBudget with rounds, attempts,
source-class diversity, requests, render cost, LLM cost, and elapsed seconds.
RecoveryPlanner:103-247 uses round, attempt, request, source-class, and
frontier limits and returns a versioned RecoveryDecision. The current planner
does not enforce every declared budget dimension: the render, LLM, and
elapsed-time fields are declared but are not consumed by the planner. This is
a reuse opportunity, not an existing VOI controller.

inference.py:58-122 defines a provenance-bearing InferenceRecord. Its
constructor forces product_safe false and verification_required true.
InferenceEngine:125-220 supports only historical recurrence: enough observed
historical assertions for the same programme/field, consistent value,
acceptable authority, bounded cycle horizon, and confidence above a
field-policy floor. confidence_decay:222-236 is a hand-built score from
history consistency, age, horizon, volatility, and source quality. It is not
trained or calibrated. It does not implement faculty backoff, sibling
similarity, external statistical priors, distributions, or learned residuals.

quality.py:22-145 composes coverage, recovery, conflicts, and inference, but
the pipeline invokes it as a shadow observer. Its output is persisted in
quality JSONL streams and optional additive tables rather than becoming the
canonical product write.

### Inheritance

inheritance.py:21-91 identifies inheritable fields and explicitly constrains
volatile fields. is_shareable:186-210 requires institution scope, a semantic
value, evidence, a source URL, no validation errors, and explicit
applicability evidence for high-impact fields. SharedBundleKey contains
institution, degree level, audience, academic cycle, and field
(inheritance.py:97-115).

cache_shared_assertions:239-313 stores native institution assertions and
refuses to create inheritance chains. inherited_assertions_for_programme:
343-424 clones only compatible, current-enough shared assertions with lineage
back to the source assertion. Volatile fields are restricted to the latest
cycle (inheritance.py:320-340).

This is a primitive form of hierarchical backoff, but only a conservative
institution-level sharing mechanism. It is not a similarity model and does
not infer a sibling programme value.

### Promotion, review, and product

promotion_v3.py:298-515 evaluates identity, coverage, conflicts, lineage,
policy versions, and inference blockers before proposing a canonical
projection. product_safety.py:143-305 rejects missing identity, operational
failure states, unresolved conflicts, inferred critical values, stale
critical values, missing lineage, insufficient authority, unknown
applicability, and uncompleted review.

product_read.py:74-135 already separates verified current values, historical
values, and advisory inferred values. Inferred values are exposed as
ADVISORY_INFERRED, retain a target-cycle estimate state, require verification,
and carry supporting assertion/raw-document IDs. They are not verified current
data.

product_export.py:98-225 emits approved structured facts or safe source
excerpts. A NEEDS_REVIEW assertion can be shown as a citation, but cannot
drive eligibility until human approval.

review_approval.py:116-230 validates that review CSV rows exactly match
fingerprints, assertion IDs, field, source URL, evidence, and structured
value before applying decisions. It writes HUMAN_VERIFIED or REJECTED states
and tracks display/eligibility modes. This is a safe input point for mentor
corrections.

### Persistence

The repository contains additive, explicitly shadow/unapplied SQL for the
newer architecture. supabase-crawl-acquisition-v3.sql:8-94 defines intents,
source candidates, and acquisition attempts. It adds raw-document, parser,
authority, relationship, temporal, provider, prompt, and schema references
to staging assertions (:96-144).

supabase-evidence-quality-v3.sql:10-64 defines versioned field policies and
coverage assessments. :66-84 defines conflict records. Its inference table
(:86-130) provides method/version, support IDs, confidence, volatility,
horizon, verification-required, allowed exposure, status, supersession, and a
hard product_safe=false check. It can be extended or complemented by an
estimate table, but should not be repurposed as a verified-value table.

The identity/promotion migration is also additive and shadow-oriented. It
defines programme entities, identifiers, aliases, offerings, relationships,
identity decisions, quality evaluations, promotion evaluations, audit, and
projection history (supabase-identity-promotion-v3.sql:1-27, :32-95, and
later promotion tables). Repository SQL establishes intended schema, not proof
that every migration is applied; this audit did not query the database.

## 3. Current epistemic model

| Capability | Current state | Assessment |
| --- | --- | --- |
| Observed/derived/inferred | EpistemicState on FieldAssertion; inference records force INFERRED | Strong reusable primitive |
| Verification lifecycle | VerificationStatus plus review approval | Strong, but confidence is not calibration |
| Temporal state | Current/historical/future/target estimate/unknown | Strong for exact safety |
| Applicability | Assertion applicability state/evidence and field gates | Strong exact gate; export features for estimation needed |
| Source authority/relationship | Enums, candidate admission, field policy, conflict ranking | Strong metadata; hierarchy search only partly wired |
| Inheritance | Institution/degree/audience/cycle bundles with no chains | Useful level-1 backoff |
| Historical inference | Same-programme recurrence only, advisory | Implemented narrowly |
| Cross-programme inference | Absent from InferenceEngine | Missing |
| Faculty/department residual | Organisation units exist, no statistical join/model | Partial entity model |
| Institution prior | Assertions/inheritance exist | Rule-level only |
| External prior | Source classes exist, no statistical prior | Missing |
| Distribution/interval | Absent from InferenceRecord and product estimate model | Missing |
| Confidence calibration | No calibration table or held-out correctness mapping | Missing |
| Acquisition cost ledger | Candidate cost class, recovery budgets, run metrics | Partial |
| Human correction | Fingerprints, queue, CSV approval, verification status | Strong workflow; no residual-learning loop |
| Estimate product semantics | Advisory inferred read exposure | Partial; no explicit estimate distribution model |

The existing model can support a safe VERIFIED/REVIEW_REQUIRED/ESTIMATED
distinction additively. It should not use FOUND for all three. FOUND
participates in exact coverage and promotion semantics; an estimate needs a
separate exposure and lifecycle.

## 3A. Gap analysis

The following table separates an implemented primitive from an implemented
end-to-end capability.

| Proposed capability | Already exists | Partial | Missing | Reusable component | Complexity |
| --- | --- | --- | --- | --- | --- |
| Hierarchical source relationships | SourceRelationship, SourceCandidate, SourceResolver, OrganisationUnit | Traversal is configured/shadow in parts | One operational field-specific frontier | source_adapters.py, source_graph.py, inheritance.py | Medium |
| Evidence distance | Authority, relationship, temporal, relevance, applicability factors | No durable multi-dimensional feature vector | Versioned distance/evidence record | SourceAdmissionDecision, FieldAssertion | Medium |
| Cross-programme inference | None in InferenceEngine | Sibling sources can be discovered/configured | Similarity/reference-set builder | SourceGraph, ProgrammeRecord | High |
| Faculty/department backoff | OrganisationUnit and programme relationship entities | No statistical use | Applicability-aware unit resolver | OrganisationUnit, inheritance | Medium |
| Institution prior | Shared institution bundles | Rule-level exact inheritance only | Prior/estimate with sample shrinkage | SharedBundleKey, FieldPolicy | Medium |
| External authoritative prior | Source classes and adapters | Exact external candidates only | Statistical external reference sets | SourceCandidate, raw evidence | Medium |
| Distributional output | Confidence scalar and historical InferenceRecord | Advisory inferred values exist | Range/distribution/quantile schema | InferenceRecord, ProductReadSnapshot | Medium |
| Epistemic uncertainty | Verification, temporal, applicability, operational states | No combined estimate decomposition | Explicit evidence-missing component for estimates | CoverageAssessment | Medium |
| Aleatoric uncertainty | Volatility enum | No variance model | Population variability component | FieldPolicy, estimate record | Medium |
| Calibration | None | Model confidence is stored and ranked | Held-out calibration data and metrics | Review workflow, benchmark artifacts | Medium |
| VOI | RecoveryBudget and next-action fields | Bounded recovery, no expected utility | Utility/cost policy | RecoveryPlanner, FieldPolicy | Medium |
| Cost-aware stopping | Request/attempt limits and some RunMetrics | Several budget fields are not enforced | Unified cost ledger and stop reason | RecoveryBudget, RunMetrics | Medium |
| Mentor residual | Review fingerprints, queue, CSV, HUMAN_VERIFIED | No estimate correction object | Versioned estimate/correction records | review_approval.py | Medium |
| Feedback learning | None | Stored review decisions can become labels | Source/calibration/model update loop | approved_assertions.py, review data | High |
| Estimated product output | Advisory inferred read exposure | No general estimate read model | Separate estimate serializer/read path | product_read.py, product_export.py | Medium |
| Estimation benchmark | Frozen exact V3 benchmark | Exact artifacts can supply labels after review | Separate estimation contract and scorer | V3 sealing/reporting conventions | Medium |

## 4. Local Remediation 13 audit

The uncommitted Remediation 13 work is useful as an operational-reliability
signal, but it does not supply a hierarchical estimator.

Valuable exact-evidence infrastructure:

- source_recovery.py:1-6 explicitly ranks already-known candidates without
  discovery, access-policy bypass, or semantic acceptance.
- source_recovery.py:99-118 adds a programme-scope guard before fallback.
- source_recovery.py:139-176 uses deterministic score components and
  canonical-URL tie-breaking.
- The local pipeline diff bounds fallback candidates and records primary and
  fallback attempts.
- The local deepseek diff adds HTTP-class metrics, malformed-fact isolation,
  and bounded context-group isolation.
- The local RunMetrics addition persists provider statistics at report time.

These changes belong on the exact rail even if an estimate layer is later
built. They reduce avoidable variance before estimation.

Limitations:

1. The local scope check is a URL host/path heuristic. It compares explicit
   path tokens such as course, programme, and program
   (source_recovery.py:62-118). It is not a maintained institution graph or
   semantic proof of programme identity.
2. The local recovery ranks configured/known URLs. Its own module says it does
   not discover new URLs (source_recovery.py:1-6), so it is bounded fallback
   ordering, not the full proposed hierarchy.
3. scripts/analyze_phase3f_remediation13.py:72-121 classifies from persisted
   candidate/error fields. Its offline output records zero provider calls,
   refetches, and new URLs, but it does not execute the production fetcher or
   extraction pipeline. It writes safety counters as diagnostic output
   (:254-280); those counters are not a newly executed safety evaluation.
4. The local changes do not add calibrated uncertainty, a distribution, or a
   separate estimate product model. The benchmark's newer acquisition and
   quality layers remain partly shadow paths.

The correct treatment is to retain deterministic ordering, bounded fallback,
raw provenance, and provider observability on the verified rail. The heuristic
scope check must not become the sole applicability rule for estimates.

## 5. Proposed evidence hierarchy

A single linear level is too crude. Source authority and evidence distance are
different dimensions: an official central admissions page can be more
authoritative than a programme page for a general English policy while being
less specific for a programme deadline. The resolver should emit a feature
vector plus a policy decision, not one opaque distance number.

| Level | Evidence relationship | Allowed meaning |
| --- | --- | --- |
| L0 | Direct programme/offering evidence from an admissible official or designated authoritative source | Exact observation for the stated programme, audience, cycle, intake, and scope |
| L1 | Department/faculty/school source with explicit programme, degree, audience, or applicability link | Scoped shared evidence; exact only when the link is explicit and field policy permits |
| L2 | Institution central admissions, finance, international, catalogue, or official policy source | Shared policy; exact only for matching degree/audience/cycle and institution-governed fields |
| L3 | Government, accreditor, official application system, official partner, or authoritative structured source | Exact external observation for its own scope; not automatically programme-specific |
| L4 | Sibling programme or degree-family evidence with measured similarity | Advisory estimate or prior; never silently promoted to a programme fact |
| L5 | Country, institution-family, discipline, degree-level, or global statistical prior | Distributional advisory estimate only; evidence about a reference population |

Sibling and statistical levels must not be called evidence of the target
programme in product copy.

### Evidence-distance vector

Use a versioned vector containing at least:

    programme_granularity
    organisation_relationship
    degree_level_match
    field_domain_match
    audience_match
    cycle_match
    temporal_freshness
    source_authority
    source_relationship
    applicability_proof
    source_quality
    sample_size
    agreement

Hard failures must remain separate from distance. A wrong audience is not
merely farther away; it is ineligible for exact use. A scalar score can rank
eligible candidates after hard gates, but it must not be the product's
uncertainty value. A learned ranker should wait for adjudicated outcomes.

## 6. Field-risk policy matrix

The tiers below are proposed product policy, not current implementation.

| Field family | Tier | Exact-only? | Maximum backoff | Estimate allowed? | Uncertainty/review rule |
| --- | --- | --- | --- | --- | --- |
| programme_identity | T0 | Yes | L0 or explicit authoritative identifiers | No | Ambiguity, wrong granularity, or missing identifier remains reviewable |
| credential | T0 | Yes for the target programme | L0; L1/L2 only with explicit applicability | No as a fact | Never use roster or sibling credential; review variant ambiguity |
| programme_status | T0 | Yes | L0 current programme/offering evidence | No | Current cycle, intake, audience, and open-window proof required |
| exact deadline / intake / application URL | T0 | Yes | L0; L1/L2 only with explicit target applicability | No exact estimate | Cycle, audience, deadline type, and scope must be proven |
| minimum degree / subject prerequisite | T1 | Yes for eligibility | L0-L2 with explicit applicability | Advisory likelihood only | Never put an inferred threshold in eligibility |
| GPA / test threshold | T1 | Yes for eligibility | L0-L2 with degree/audience/cycle match | Bounded advisory range | Wide interval or abstain with small samples |
| English minimum | T1 | Yes for eligibility | L0-L3 when an authoritative minimum explicitly applies | Advisory policy likelihood only | Separate minimum, recommendation, waiver, and taught-in-English |
| required documents / application components | T1 | Yes for checklist | L0-L2 explicit audience/degree policy | Advisory summary only | Preserve omission uncertainty and provenance |
| tuition / mandatory fees | T1 exact; T2 advisory | Exact value cannot be estimated into canonical data | L0-L3 exact when period, currency, audience, residency, credential, and scope match | Yes as range/distribution | Log scale; robust estimate; wide interval or abstain under weak samples |
| application fee | T1 | Prefer exact | L0-L3 with cycle/audience applicability | Limited advisory range | High volatility; do not use sibling fee as exact |
| scholarships / funding amount | T2 | Exact for a named award | L0-L3 for named policy; L4-L5 advisory | Yes | Separate eligibility and amount; show freshness and scope |
| living costs | T2 | No exact programme fact | L2-L5 | Yes | Geographic distribution and interval; distinguish from institutional charges |
| admission difficulty / competitiveness | T3 | No canonical fact | L2-L5 | Yes | Calibrated class distribution; never an institutional guarantee |
| career outcomes | T3 | Exact reported outcome only | L0-L3 reported statistics; L4-L5 estimate | Yes | Show cohort, time window, and selection limits |
| programme fit / recommendation | T3 | No | L3-L5 plus user profile | Yes | Expose reasons and uncertainty; mentor/user correction expected |
| programme focus / curriculum overview | T1/T2 | Exact description preferred | L0-L2; L4 similarity summary | Yes only as labeled summary | Never turn sibling curriculum into a requirement |

Hard prohibitions are identity, live status, exact deadline/intake, exact
application URL, legal/visa requirements, and eligibility thresholds. An
estimate may be a separate warning or research lead, but cannot populate the
fact or eligibility rail.

## 7. Numerical estimation and uncertainty

Run #8 contains candidate tuition assertions for 21 programme entities and
additional-fee assertions for 14 entities, but the stored tuition sample is
marked NEEDS_REVIEW. These are evidence inputs, not clean labels. A complex
country/faculty/institution/programme random-effects model would overstate
certainty on this sample.

The first estimator should:

1. normalize currency, fee period, residency, credential, audience, cycle,
   and scope;
2. retain but exclude assertions that fail semantic validation;
3. use only adjudicated exact labels for calibration and evaluation;
4. compute a robust weighted median or trimmed weighted mean within a
   comparable reference set;
5. produce an empirical weighted-quantile interval that expands with
   evidence distance and shrinks with effective sample size;
6. abstain when no comparable reference set exists.

For tuition, use a log scale for skew and multiplicative error. Report the
original currency/period and reference population. A point estimate alone is
not sufficient.

| Model | Fit now | Reason |
| --- | --- | --- |
| Weighted empirical estimate | Good first baseline | Explainable and workable with small samples under strict comparability |
| Robust weighted median | Best first numeric point estimate | Resistant to outliers and fee-period mistakes |
| Hierarchical Bayesian/random effects | Later | Useful partial pooling, but needs labels and validated grouping |
| Mixed effects with fixed features | Later | Can add covariates but does not solve label quality or shift |
| Quantile regression | Later | Useful for intervals with more labels |
| Simple residual hierarchy | Preferred intermediate | Global estimate plus scoped residuals with shrinkage and sample gates |

The conceptual residual model is useful:

    log(value) =
        global level
        + country residual
        + institution residual
        + faculty residual
        + programme-family residual
        + programme residual

Only levels with enough independent, comparable observations should be active.
With no observations, a level shrinks to its parent. With one or two
observations, it stays close to the parent and its interval stays wide. The
programme residual should wait for repeated, time-separated observations or
strong direct evidence.

For admission difficulty, fit, or likely-prerequisite classes, return a
probability vector or prediction set, not a single categorical fact. Start
with smoothed empirical proportions by a defined reference group. Require
held-out calibration before exposing probabilities. An LLM's self-reported
confidence is not calibration; see Guo et al.,
[On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html).

For numeric intervals, split conformal calibration is a possible later
component because it is model-agnostic and provides finite-sample marginal
coverage under exchangeability. It does not remove the need to test
distribution shift across countries, institutions, cycles, and programme
families. See the [JMLR conformal prediction material](https://www.jmlr.org/papers/volume25/23-1553.html).

Keep two uncertainty components internally:

- epistemic uncertainty: applicable evidence is missing and more acquisition
  or review may reduce it;
- aleatoric uncertainty: the quantity varies across a population or time,
  as with living cost or competitiveness.

The first product can expose one interval plus reason codes, but the internal
record should retain both components.

## 8. Cost, value of information, and stopping

Current cost inputs include SourceCandidate.cost_class and fetch_strategy,
acquisition intents and attempts, source/fetch/parser counts, provider
attempts/retries/failures/tokens in local Remediation 13 instrumentation,
elapsed/render counters in RunMetrics, and recovery round/request/source-class
limits.

The missing piece is a normalized immutable event ledger:

    candidate_id
    attempt number
    request class
    HTTP/render/PDF/parser/provider cost
    wall time
    tokens
    success probability estimate
    expected field decision impact
    failure class

The first practical VOI approximation is:

    expected reduction in decision loss
    -----------------------------------
    expected acquisition cost

Decision loss must be field-specific. A possible exact deadline has greater
loss from a wrong answer than a career-summary estimate. Do not calculate VOI
from LLM confidence alone.

The field-level stop policy should stop when:

1. verified exact state is reached;
2. a permitted advisory interval meets its width/calibration requirement;
3. remaining eligible frontier utility is below measured cost;
4. field budget is exhausted;
5. no eligible source frontier remains; or
6. mentor review has lower expected cost than another acquisition attempt.

This fits the existing FieldPolicy, RecoveryPlanner, and CoverageAssessment
interfaces. It needs a cost ledger and expected-utility features, not a new
fetcher.

## 9. Human and feedback layer

The existing fingerprint and review queue are suitable for a mentor residual
workflow. Add an independent record rather than mutating raw evidence:

    estimate_id
    target entity/field/scope/cycle
    machine estimate or distribution
    machine evidence IDs
    mentor value or correction
    residual / error class
    mentor role
    reason
    created_at / effective_at / expires_at
    model and policy versions

An accepted correction may affect later calibration only after it is marked as
a reviewed label. It must not rewrite the original FieldAssertion, raw
snapshot, or frozen benchmark artifact.

| Version | Behavior | Recommendation |
| --- | --- | --- |
| V1 | Store corrections and reasons | Required for MVP |
| V2 | Calibrate source reliability, confidence, and hierarchy weights | After a stable correction taxonomy |
| V3 | Train a learned residual/ranking model | Only after enough independent labels and drift monitoring |

## 10. Canonical storage and product semantics

Do not place estimates in canonical verified value columns. Use:

    crawl_field_assertions / programme projection
        = exact observed, derived, reviewed, or explicitly null facts

    estimate_records / estimate_support / calibration_records
        = advisory point/range/distribution with evidence distance and cost

    product_estimate_read_model
        = user-facing estimated exposure

The existing crawl_quality_inferences_v3 table can remain the historical
advisory inference store. It should gain a separately versioned estimate
subtype or be complemented by a table containing:

    estimate_kind
    distribution_json
    lower/upper quantiles
    epistemic_uncertainty
    aleatoric_uncertainty
    calibration_set/version
    evidence_level/vector
    effective/expiry time
    cost_summary
    allowed_exposure
    verification_required

product_read.py can expose verified_current, estimated_advisory, and
review_required. An estimate must never set use_for_eligibility,
PRODUCT_SAFE, or a verified current exposure. Existing product-safety and
export boundaries already enforce much of this separation.

## 11. Current code reuse matrix

| Current component | Keep | Extend | Replace | New layer |
| --- | :---: | :---: | :---: | --- |
| SourceGraph / URL edges | Yes | Add entity/scope relationships | No | Evidence-distance features |
| AcquisitionPlanner | Yes | Add candidate utility and field policy | No | VOI policy wrapper |
| RecoveryPlanner | Yes | Enforce all budgets and cost ledger | No | Cost-aware stop controller |
| SafeFetcher | Yes | Emit normalized cost/access events | No | No |
| FieldPolicy | Yes | Add estimate permission, max distance, review thresholds | No | Risk-tier registry |
| FieldAssertion | Yes | Add evidence-vector references if needed | No | No |
| InferenceRecord / InferenceEngine | Yes for advisory history | Add distributions and calibration refs | No initially | Hierarchical estimator |
| Institution inheritance | Yes | Add faculty/unit and explicit applicability edges | No | Similarity/reference builder |
| CoverageAssessment | Yes | Keep exact states separate from estimate outcome | No | Estimate decision record |
| Runtime acceptance | Yes | Expose explainable rejection features | No | Estimate eligibility policy |
| PromotionV3 | Yes | Reject estimates from canonical promotion | No | No |
| ProductSafety | Yes | Add estimate exposure rules | No | No |
| Product export/read | Yes | Add estimate read model and labels | No | Estimate serializer |
| Human review | Yes | Store corrections/residual labels | No | Calibration data set |
| Storage | Yes | Add additive estimate/support/calibration tables | No | Optional analytical store |
| Benchmark scorer | Freeze V3 | Add separate estimation scorer | No | Estimation benchmark V1 |

## 12. Architecture alternatives

Scores are 1 (unfavorable) to 5 (favorable). Precision means preserving the
current exact/safety contract. Cost means lower operating cost.

| Option | Effort | Migration risk | Useful coverage | Exact precision/safety | Calibration | Runtime/LLM cost | Web dependence | Mentor burden | Explainability | Scale | Time to product |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A. Exact-only continuation | 2 | 5 | 1 | 5 | 1 | 1 | 1 | 2 | 5 | 2 | 2 |
| B. Rule-based hierarchy | 3 | 3 | 3 | 4 | 2 | 4 | 3 | 3 | 5 | 4 | 4 |
| C. Probabilistic layer now | 5 | 2 | 4 | 2 | 2 | 3 | 3 | 2 | 2 | 3 | 2 |
| D. Hybrid staged architecture | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |

Option A preserves the strongest guarantees but cannot make many operational
or naturally variable fields useful at lower cost. It remains the required
rail for high-risk facts.

Option B is the smallest useful extension. It reuses source relationships,
inheritance, field policies, and recovery. It is explainable and likely to
reduce futile requests, but heuristic confidence is not probability.

Option C could produce coverage quickly but would confuse candidate assertions
with labels, overfit sparse groups, and create product risk before
calibration and correction storage exist. It is suitable for an experiment,
not immediate production.

Option D keeps the exact engine and safety contract intact, makes rule-based
hierarchy useful early, and lets probabilistic estimates earn exposure through
calibration. It is the preferred architecture. B is the runner-up and the
first implementation slice inside D. A is preserved as the baseline. C is
rejected as the immediate production strategy.

## 13. Feasibility, ROI, and failure modes

### Feasibility

Engineering feasibility is high for an advisory sidecar: raw evidence,
assertion lineage, source scope, policies, inheritance, recovery, inference,
review, and product-read interfaces exist. It is medium for fully integrating
the resolver because acquisition and quality are currently partly shadow
paths. Broad learned modelling is high risk until labels and grouping are
validated.

Data/statistical feasibility is low-to-medium today. Raw and candidate
observations exist, but NEEDS_REVIEW assertions are not labels, grouping is
not yet a validated modelling key, and mentor corrections are not yet a
residual dataset.

Product feasibility is high if estimates remain separate. Safety feasibility
is high if field tiers remain hard gates.

### Plausible effect ranges

These are planning ranges, not measurements:

| Measure | Exact-only | Hybrid target for permitted advisory fields |
| --- | --- | --- |
| Exact verified precision | Current gate | No regression; estimates excluded from denominator |
| Useful advisory coverage | Low when exact evidence is absent | +20 to +40 percentage points on selected low-risk fields if comparable evidence exists |
| New acquisition attempts | Bounded recovery | 20–50% fewer futile attempts after early low-VOI stopping |
| LLM calls | Current group extraction | 10–30% lower where deterministic/reused evidence applies; may rise during calibration |
| Latency | Includes blocked/fallback tails | Lower tail on fields stopped early; no improvement for genuine access barriers |
| Mentor load | Exact assertions/conflicts | Must remain bounded; estimates trigger review only by field risk/width |
| Incorrect estimate risk | No estimates | Controlled by separate exposure, calibration, prohibitions, and abstention |

These ranges are falsifiable only through the MVP.

### Failure modes and mitigations

| Failure mode | Mitigation |
| --- | --- |
| Sibling programmes differ materially | Similarity features, minimum sample size, group holdout, wide intervals |
| Institution policy is not programme-applicable | Applicability is a hard exact gate; retain scope and evidence |
| Country/institution drift | Group/time holdout, drift checks, broad intervals, abstention |
| Small-sample prior looks precise | Shrink to parent, expose effective sample size, block narrow intervals |
| Model confidence is mistaken for probability | Separate scores and calibrate on held-out labels |
| Mentor feedback is biased | Record reason/scope, sample independent review, delay training use |
| Correction becomes stale | Effective/expiry cycle and revalidation |
| Estimate overconfidence | Interval calibration, disagreement/freshness penalties, minimum width |
| Degree-level leakage | Degree in the key; no cross-level inheritance by default |
| Verified fact later contradicted | Assertion history, supersession, conflict state; no in-place mutation |
| Estimate overwrites canonical fact | Separate tables/read model and hard exposure checks |
| User misunderstands uncertainty | Label, range, scope, freshness, and review recommendation |
| Hierarchy causes crawl growth | Candidate cap, SafeFetcher/robots, VOI stop |
| Operational failure hidden as semantic uncertainty | Preserve blocked/fetch/extraction/not-found states until recovered |

## 14. Expected cost/coverage trade-off

The hybrid is economically preferable only for fields where the product
accepts bounded estimates. It is not a cheaper substitute for exact identity,
live application status, exact deadlines, or eligibility requirements.

For allowed advisory fields, early deterministic parsing and reuse should
reduce calls and latency; hierarchical reference sets can improve useful
coverage without claiming exact target facts. The cost can increase during
calibration if additional labels or mentor review are required. The first
experiment must measure cost per useful field rather than assume the
hierarchy is cheaper.

The official Run #8 shape illustrates the boundary: 21/21 critical precision,
zero incorrect concrete outputs, and seven zero safety counters coexisted with
21/122 resolved coverage and operational blocked/extraction states. That is a
reason to add a separate advisory channel, not a reason to relax the exact
rail.

## 15. Migration sequence

This sequence is recommended only if the MVP passes.

| Phase | Objective and code areas | Schema impact | Risk | Tests/benchmark | Exit criterion |
| --- | --- | --- | --- | --- | --- |
| M0 | Freeze exact rail: runtime_acceptance, CoverageEngine, PromotionV3, ProductSafety, V3 benchmark | None | Semantic drift | Existing exact/safety suite and V3 integrity | Exact behavior is a non-regression fixture |
| M1 | Add evidence feature vector and scope/similarity records around SourceCandidate, FieldAssertion, OrganisationUnit, SourceGraph | Additive metadata | False applicability | Scope, cycle, audience, degree, source-distance negatives | Every estimate support item is explainable |
| M2 | Operationalize bounded hierarchy using AcquisitionPlanner, inheritance, RecoveryPlanner, SafeFetcher | Acquisition audit rows | Duplicate fetcher/access bypass | Deterministic ordering, fallback bounds, robots, failure states | Stable eligible frontiers without exact-result change |
| M3 | Add EstimateRecord/support/calibration read model | Additive tables, no canonical overwrite | Estimate leaks into eligibility | Storage/read/promotion exclusion tests | Verified and estimated channels separate |
| M4 | Robust empirical estimator and calibration metrics | Estimator/calibration versions | Treating NEEDS_REVIEW as labels | Group holdout, error, interval coverage, calibration | MVP meets fixed criteria |
| M5 | Cost ledger and VOI stop policy in RecoveryPlanner/RunMetrics | Cost/event rows or immutable JSONL | Cheap but low-value actions win | Budget, no retry storm, Pareto dashboard | Lower cost per useful field |
| M6 | Mentor correction/residual records | Additive correction table | Feedback contamination | Provenance, expiry, reviewer agreement | Corrections reproducible/versioned |
| M7 | Calibrate weights and consider learned residual model | Model registry/calibration sets | Drift/overfit | Rolling holdout and subgroup calibration | Learned model beats robust baseline |

No phase modifies GT V3 or reinterprets its exact metrics.

## 16. Estimation benchmark and validation workflow

Keep Benchmark V3 frozen as EXACT-EVIDENCE BENCHMARK V3. Create a separate
ESTIMATION / DECISION-SUPPORT BENCHMARK V1 with labeled fields, scope
metadata, and explicit cost budgets. Report a Pareto dashboard:

    verified precision
    useful advisory coverage
    MAE / median absolute percentage error
    interval coverage and width
    Brier score for categorical probabilities
    expected calibration error
    abstention quality
    mentor correction rate
    requests/tokens per useful field
    latency/acquisition cost

Use this validation ladder:

    deterministic stored-evidence replay
        -> exact invariant/unit tests
        -> estimator calibration and holdout tests
        -> bounded live stability suite
        -> clean checkpoint
        -> rare official exact benchmark

## 17. MVP experiment

The smallest falsifiable experiment is a stored-evidence, no-network
comparison on numeric cost fields.

### Population and inputs

- Select 8–10 programme observations across at least 5 institutions from
  retained raw snapshots and assertions.
- Use tuition and additional_fees as primary fields. Include application_fee
  only if at least eight independent, scope-compatible adjudicated labels
  exist; otherwise call it data-insufficient.
- Require mentor-adjudicated exact labels with currency, period,
  residency/audience, credential, cycle, and programme/institution scope.
  Do not use NEEDS_REVIEW candidate values as labels.
- Split by institution or programme family, not random rows. Keep one
  time-separated check where possible.

### Baselines and estimator

1. Exact-only baseline: emit only a directly verified, scope-compatible value;
   otherwise abstain.
2. Rule hierarchy baseline: use explicit programme, organisation, and
   institution policy evidence with hard applicability gates.
3. Advisory estimator: robust weighted median on the log value, with weights
   from evidence level, authority, freshness, comparability, and agreement.
   Return a calibrated interval. Never write it into exact projection.

### Measures and provisional thresholds

Measure exact precision, useful coverage, median absolute percentage error,
interval coverage at nominal 80% and 90%, interval width, abstention rate,
mentor correction rate, source/LLM calls, tokens, latency, and cost per useful
field. Record separate epistemic/aleatoric reason codes.

The experiment supports the hybrid direction only if held-out institutions
meet all of these provisional criteria:

- exact verified precision and exact safety counters remain unchanged;
- useful coverage increases by at least 25 percentage points over exact-only
  on the selected fields;
- tuition median absolute percentage error is at most 20% after normalizing
  currency and period;
- nominal 80% intervals cover at least 70% and nominal 90% intervals cover at
  least 80% of held-out values;
- fewer than 25% of exposed estimates require mentor correction;
- estimates never change eligibility or a canonical verified field;
- stored-evidence execution uses zero provider and network calls.

If there are too few independent labels to evaluate these criteria, the idea
is data-infeasible for production at this stage and the exact rail remains
the product strategy.

## 18. Overall feasibility and ROI verdict

| Dimension | Verdict | Reason |
| --- | --- | --- |
| Engineering | Feasible in stages | Most boundaries exist; shadow wiring needs careful integration |
| Data | Small MVP feasible; broad hierarchy not yet | Raw/candidate evidence exists, clean labels/grouping are sparse |
| Statistical | Empirical baseline feasible; full hierarchy premature | Robust estimates and calibration should precede Bayesian residuals |
| Product | Feasible with separate estimate semantics | Existing read/product safety boundary is strong |
| Safety | Feasible with hard field tiers | Exact identity/status/deadline/eligibility rail remains authoritative |
| Cost | Likely favorable for permitted advisory fields | Early stopping and reuse can reduce futile acquisition |
| Main risk | Semantic leakage and overconfidence | A hierarchy can look complete while changing a field's meaning |
| Confidence | Medium-high | Reuse is clear; benefit must be proven by the MVP |

## 19. Final recommendation

**D. ADOPT HYBRID STAGED ARCHITECTURE.**

Keep the exact-evidence engine and frozen Benchmark V3 as the authoritative
rail. First extend existing rule-based source, inheritance, and recovery
primitives into a bounded explainable hierarchy. Then add a separate,
calibrated estimate read model for a small low-risk numeric MVP. Broader
probabilistic residual modelling should proceed only if the MVP demonstrates
useful coverage, calibrated uncertainty, lower cost per useful field, and
zero exact/safety regression.
