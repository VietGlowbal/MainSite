# GlowBal Matching Report V3 — Agent Implementation Prompt

You are working on the GlowBal Matching Report architecture.

Repository:
VietGlowbal/MainSite

Before changing anything:
1. Pull/fetch the latest `main`.
2. Record the exact HEAD SHA you are reviewing.
3. Inspect the current implementation before assuming this prompt is still perfectly aligned with HEAD.
4. Read the existing Matching, Personal Report, Target Profile, Evidence Bank, F5, repository, route, UI, Strategy and test code.
5. Read:
   - docs/plans/2026-08-26-glowbal-matching-engine-implementation.md
   - docs/strategy-reports-spec.md
   - any current Matching/Personal Report architecture docs that HEAD references.
6. Do not overwrite unrelated work.
7. Do not redesign working infrastructure unnecessarily.
8. Do not claim anything is fixed unless you actually implemented and tested it.

======================================================================
PRODUCT GOAL
======================================================================

Implement the canonical Matching Report flow as:

Applicant structured profile
+
University / Programme / Scholarship structured target data
+
Evidence Bank for verification/provenance

→ UNIVERSITY FIT
→ PROGRAMME FIT
→ KEY TAKEAWAYS

The Matching Report answers:

"How and why does this applicant currently align with this specific
university/programme, where are the evidence-backed gaps, and what should
they strategically emphasize or improve?"

It must NOT answer:

"What is the applicant's probability/chance/likelihood of admission?"

A Fit Score is an alignment score only.

The report must explain WHY the applicant is aligned/misaligned and must
preserve evidence/provenance.

======================================================================
CRITICAL ARCHITECTURAL PRINCIPLES — MUST PRESERVE
======================================================================

Do NOT throw away the good parts of the current implementation.

Preserve:

- application-scoped ownership
- application_id + user_id on every application read/write
- confirmed snapshot isolation
- exact Personal Report lineage
- exact source analysis lineage
- Evidence Bank versioning
- Target Profile versioning
- deterministic hard-requirement evaluation
- evidence IDs/provenance
- direct vs supporting evidence distinction
- report_only evidence cannot become direct evidence
- conflicting evidence handling
- LLM cannot override deterministic hard requirements
- exact cache
- incremental reuse where valid
- version-aware reuse invalidation
- previous complete report preservation on generation failure
- no partial report persistence
- scholarship isolation
- legacy readers/fallbacks
- migration-missing behaviour
- concurrency-safe duplicate insert handling
- admission-probability language guards

Do not add:

- embeddings
- vector DB
- a new framework/library unless absolutely required
- arbitrary live website crawling during Matching generation
- generic "agent memory" as evidence
- applicant facts that are not traceable to the confirmed snapshot/evidence
- heuristic admission probabilities

======================================================================
CURRENT CORE PROBLEM
======================================================================

The current infrastructure is reasonably mature, but the canonical
Matching product logic still follows the old/generalized architecture:

Target Profile
→ generic MatchingCriterion[]
→ evidence retrieval
→ generic semantic alignment
→ strengths/gaps
→ old F5 ProgrammeFit
→ summary

This is NOT sufficient for the new product framework.

The new canonical report must explicitly model:

1. University Fit
2. Programme Fit
3. Key Takeaways

The old F5 framework may remain for legacy/downstream compatibility but
must NOT be treated as the canonical Programme Fit defined below.

======================================================================
TASK 0 — BASELINE AUDIT BEFORE EDITING
======================================================================

Inspect at minimum:

src/lib/ai/matching/
  domain.ts
  criteria.ts
  evidence.ts
  aggregation.ts
  reasoner.ts
  report.ts
  generation.ts

src/lib/ai/target-profile/
  domain.ts
  generation.ts
  repository.ts

src/lib/ai/applicant-state/
src/shared/evidence/
src/shared/evaluation/f5-programme-fit.ts

src/features/apply/domain/personal-report.ts
src/features/apply/domain/personal-canvas-details.ts
src/features/apply/domain/matching-report-presentation.ts

src/features/apply/api/ai-reports-repository.ts
src/features/apply/api/personal-report-generation.ts

src/features/apply/ui/matching-report-view.tsx
src/features/apply/ui/matching-report/**

src/app/api/applications/[id]/match-insights/**
Strategy/downstream consumers of Matching Report

src/lib/ai/runtime/prompt-registry.ts

all related tests.

Search globally for:

reportV2
programmeFit
fit_dimensions
fit_classification
MATCH_PROMPT_VERSION
MATCHING_PROMPT_BUNDLE_VERSION
matching-report-v2
matching-v2
application_match_analyses
getLatestApplicationMatchingAnalysis
getMatchingAnalysisByInputHash

Before writing code, produce an internal dependency map of every Matching
Report reader and writer so a V3 report cannot silently break downstream
consumers.

======================================================================
TASK 1 — FIX THE FIRST-GENERATION SCORE DATA FLOW
======================================================================

This is P0.

Current generation behaviour must NOT derive the canonical new report
score from a previous Matching Report row.

A first-ever Matching generation must be fully computable from current
canonical inputs.

Remove the architectural dependency:

latest Matching record
→ ProgrammeFitInput
→ current canonical fit score

The previous Matching report is allowed ONLY for:

- selective reuse
- legacy fallback
- preserving the old report after a failed regeneration

It must not be the source of truth for current fit.

First generation must work when:

latestRecord === null

and still produce real University Fit and Programme Fit metrics whenever
enough current data exists.

Update tests that currently expect a first generation to use an F5
placeholder. That behaviour must no longer be treated as correct for the
new canonical report.

Do not replace missing input with zero.

Use explicit:
- assessed
- limited
- not_available

or equivalent typed states.

======================================================================
TASK 2 — INTRODUCE THE NEW MATCHING REPORT CONTRACT
======================================================================

Create a new additive contract, preferably:

MATCHING_REPORT_CONTRACT_VERSION = `matching-report-v3`
MATCHING_ENGINE_VERSION = `matching-v3.x.x`
MATCHING_PROMPT_BUNDLE_VERSION = `matching-prompts-v3.x.x`

Do NOT destructively delete V2 parsing.

Repository readers must support:

V3 first
→ V2 fallback
→ legacy F5 fallback

Prefer keeping the existing JSONB persistence column if it safely stores
a versioned JSON contract; do not add a database migration solely because
the column name contains "v2".

If the actual database schema constrains the contract and a new column is
required, use an additive migration. Never destructive rename/drop.

The canonical V3 contract should contain approximately:

MatchingReportV3 {
  contractVersion
  generatedAt

  overall {
    summary
    overallAlignmentScore?       // only if product semantics justify it
    evidenceCoverage
    confidence
  }

  universityFit {
    score
    status
    confidence
    coverage
    summary
    metrics: {
      academicReadiness
      valuesAlignment
      communityContribution
      learningEnvironment
      distinctiveOpportunity
    }
  }

  programmeFit {
    score
    status
    confidence
    coverage
    summary
    metrics: {
      interestMotivation
      capability
      experienceExposure
      careerFutureDirection
    }

    strongestAlignment
    potentialGap
    strategicInterpretation
  }

  hardRequirements [...]

  scholarshipAlignment | null

  strengths [...]
  gaps [...]
  positioningOpportunities [...]

  keyTakeaways {
    strongestFit
    competitiveAdvantage
    criticalGap
    strategicDirection
  }

  evidenceIndex
  targetSourceIndex

  metadata {
    matchingEngineVersion
    promptBundleVersion
    metricPromptVersion
    summaryPromptVersion
    targetProfileVersionId
    personalReportVersionId
    personalReportInputHash
    sourceAnalysisVersionId
    confirmedSnapshotId
    evidenceBankVersion
    model
    aiCallCount
    reusedMetricIds / reusedSubmetricIds
  }
}

Use strict Zod schemas.

Do not allow arbitrary unknown properties.

Cross-validate IDs in `.superRefine()`.

Validation must reject:

- duplicate metric/submetric IDs
- unknown evidence IDs
- unknown target source refs
- summary refs not represented in the report
- scholarship refs inside normal programme fit
- hard requirements inside semantic scoring results
- duplicated semantic results
- missing semantic result when one was requested

======================================================================
TASK 3 — BUILD A REAL ApplicantMatchingContext
======================================================================

Create a canonical adapter such as:

src/lib/ai/matching/applicant-context.ts

Do NOT send only a couple of Personal Report prose paragraphs into the
Matching reasoner.

Build a typed `ApplicantMatchingContext` from the exact current Personal
Report version + exact confirmed snapshot + Evidence Bank.

Consume structured fields that already exist.

At minimum expose:

academic {
  records
  gradesSummary
  curriculum
}

coreIdentity {
  recurringRole
  recurringBehaviours
  valueOrientation
  confidence
  evidenceIds
}

drivingForces {
  repeatedMotivations
  confirmed/hypothesis state
  confidence
  evidenceIds
}

signaturePattern {
  patternStrength
  steps
  supportingExperienceCount
  confidence
  evidenceIds
}

emergingThemes {
  theme
  status
  supportingExperiences
  confidence
  evidenceIds
}

provenCapabilities {
  name
  evidenceStrength/score if canonical Personal Report exposes it
  recurrence/evidence count
  verifiedEvidenceCount
  supportingEvidenceIds
}

socialProof {
  teamMembersLed
  communityReach
  yearsOfCommitment
  quantified outcomes
  other explicitly supported metrics
}

personalPositioning {
  statement
  authenticity
  differentiation
  coherence
  directionAlignment
  credibility
  confidence
  evidenceIds
}

growthSignals
competitiveAdvantages
personalReportKeyTakeaways

futureDirection {
  intendedDirection
  academicDirection
  careerDirection
}

preferredEnvironment

Do not copy every Personal Report string blindly.

Use structured fields.

IMPORTANT:

Personal Report is interpretation context.

Personal Report must NOT become raw/direct evidence merely because its
text says something.

Every applicant-specific factual conclusion still needs evidence IDs from
the canonical Evidence Bank / confirmed snapshot.

If a Personal Report insight references evidence IDs, preserve that
relationship.

======================================================================
TASK 4 — PRESERVE STRUCTURED CMCAITF IN MATCHING
======================================================================

Current Evidence Bank can contain CMCAITF interpretations, but Matching
currently flattens them too aggressively.

Expose the relevant structured CMCAITF dimensions to the Matching
context:

- Context
- Motivation
- Challenge
- Action
- Impact
- Transformation
- Future

Do NOT promote AI interpretation payload into direct evidence.

Model it as contextual interpretation attached to source-backed evidence.

For example:

MatchingEvidenceContext {
  claimId
  direct
  sourceRefs
  interpretationRefs

  cmcaitf?: {
    motivation
    action
    impact
    transformation
    future
  }
}

Only expose CMCAITF fields when they are traceable to the referenced
evidence/source.

This is particularly important for:

- Interest & Motivation Fit
- Capability Fit
- Experience & Exposure Fit
- Community & Contribution Fit
- Career & Future Direction Fit

======================================================================
TASK 5 — EXPAND TARGET PROFILE INTO UNIVERSITY + PROGRAMME CONTEXT
======================================================================

Current TargetProfile is too generic.

Do not remove current requirements/sources fields.

Add structured target-side data needed by the new framework.

The target profile should distinguish:

TargetProfile {
  programme identity

  universityProfile {
    mission
    values
    educationalPhilosophy
    studentProfile

    learningEnvironment {
      teachingModel
      experientialLearning
      classStructure
      interdisciplinaryOpportunities
      researchOpportunities
      entrepreneurship
      mentorship
      communityProgrammes
    }

    distinctiveOpportunities [...]
  }

  programmeProfile {
    description
    curriculum [...]
    learningOutcomes [...]
    preferredCompetencies [...]
    teachingStyle
    careerPathways [...]
    opportunities [...]
  }

  requirements [...]

  scholarshipProfile | null

  deadlines [...]

  missingInformation [...]

  sources [...]
}

Every structured field/opportunity must have provenance.

Do not fabricate source references.

Use structures similar to:

TargetFact {
  value/text
  sourceRefs[]
}

TargetOpportunity {
  id
  type:
    research_lab |
    club |
    entrepreneurship |
    competition |
    industry_partnership |
    exchange |
    community_initiative |
    special_programme |
    scholarship |
    other

  label
  detail
  sourceRefs[]
}

If current ingested catalogue data does not provide an item:

do not invent it.

Record explicit missingInformation where useful.

======================================================================
TASK 6 — UPDATE TARGET PROFILE EXTRACTION
======================================================================

Keep deterministic extraction first.

Do not crawl websites during Matching generation.

Use only already-ingested source data.

Expand `target_profile_extraction` so the model may extract structured:

- university mission/value/philosophy
- student profile
- teaching/learning environment
- experiential learning
- research opportunities
- mentorship
- entrepreneurship
- community programmes
- programme curriculum themes
- learning outcomes
- preferred competencies
- teaching style
- career pathways
- programme-specific opportunities
- scholarship criteria/opportunities
- normal admission requirements

The model output MUST cite an input source index for every extracted item.

Programmatically convert source indexes → canonical source refs.

Reject unknown indexes.

Do not let the extractor infer generic university facts from its own
knowledge.

Bump Target Profile schema/prompt versions when the contract changes.

Cache invalidation must follow the target profile source fingerprint.

======================================================================
TASK 7 — FIX DEADLINE ROUTING
======================================================================

Current Target Profile stores deadlines separately but Matching hard-gate
logic primarily searches normalized criteria.

Make deadline eligibility deterministic from canonical deadline data.

Do not require deadline text to accidentally become a generic criterion
just to be evaluated.

Deadline status should distinguish:

- met
- not_met
- unknown

If applicant/application timing cannot be determined reliably, return
unknown.

Do not guess.

Add tests proving a TargetProfile deadline reaches current eligibility.

======================================================================
TASK 8 — SELECTED SCHOLARSHIP FLOW
======================================================================

Audit how an application chooses/targets a scholarship.

Do NOT evaluate arbitrary scholarships merely because the university has
several published scholarships.

If the application has a canonical selected scholarship relation/key:

pass it into Target Profile resolution and Matching.

If no selected scholarship exists:

scholarshipAlignment should normally be null rather than pretending every
available scholarship is the student's target.

Do not guess schema field names.

Inspect the current repository/schema first.

Scholarship must remain separate from normal University/Programme Fit
scores.

A scholarship failure must not automatically change programme alignment.

======================================================================
TASK 9 — IMPLEMENT UNIVERSITY FIT
======================================================================

Create explicit typed University Fit metrics.

Overall University Fit weights:

Academic Readiness                  25%
Values Alignment                    25%
Community & Contribution Fit        20%
Learning Environment Fit            15%
Distinctive Opportunity Fit         15%

The top-level University Fit score must be computed deterministically
from the metric scores.

Do not ask the LLM to calculate weighted formulas.

Use a shared deterministic weighted-score helper.

Missing/not_available submetrics must NOT silently become zero.

Represent coverage explicitly.

If some submetrics are unavailable, use a documented shared missing-data
policy and expose the limitation. Prefer renormalizing over assessed
metrics plus an explicit coverage/confidence signal rather than treating
missing evidence as applicant failure.

Do not invent threshold labels if the product does not already define
them. Search the current spec/constants first.

----------------------------------------------------------------------
9A. Academic Readiness — 25% of University Fit
----------------------------------------------------------------------

Sub-metrics:

Academic Performance        40%
Requirement Coverage        25%
Programme Preparation       20%
Academic Challenge          15%

Formula:

AR =
0.40 * AcademicPerformance
+ 0.25 * RequirementCoverage
+ 0.20 * ProgrammePreparation
+ 0.15 * AcademicChallenge

Reuse deterministic hard requirement / Academic Analyzer logic wherever
possible.

Academic Performance:
compare current academic performance against stated expectations.

Requirement Coverage:
required qualifications/subjects/tests currently met.

Programme Preparation:
relevant coursework/projects/research/academic activities.

Academic Challenge:
rigour/challenge of curriculum or academically demanding work, but only
when evidence supports it.

For the explicit Academic Readiness evidence rubric preserve:

0   = no evidence / clearly does not meet
25  = major gap / limited evidence
50  = partially meets expectations
75  = meets expectations with solid evidence
100 = clearly exceeds expectations

Do not turn "no data" into 0 if the requirement itself is unknown.
Use not_available/insufficient_information when appropriate.

Hard requirements remain deterministic and separate from the soft
Academic Readiness score.

----------------------------------------------------------------------
9B. Values Alignment — 25%
----------------------------------------------------------------------

Sub-metrics:

Value Match              35%
Behavioural Evidence     30%
Motivation Match         20%
Consistency              15%

Inputs should include:

Applicant:
- Q1-Q4 derived structured signals
- recurring behaviours
- value orientation
- activity evidence
- CMCAITF reflection
- Core Identity
- Driving Forces
- Personal Positioning

University:
- mission
- core values
- educational philosophy
- student profile
- programme philosophy where relevant

Important:

Stating "I value innovation" is weaker than repeated evidence of
innovation-related behaviour.

Do not award strong behavioural evidence from Personal Report prose alone.

----------------------------------------------------------------------
9C. Community & Contribution Fit — 20%
----------------------------------------------------------------------

Sub-metrics:

Contribution Evidence      35%
Leadership & Initiative     25%
Collaboration               20%
Community Impact            20%

Inputs should reuse:

- leadership roles
- activities
- team projects
- teaching / mentoring
- clubs / organisations
- initiatives created
- explicit number of people reached
- stakeholder collaboration
- sustained contribution
- Personal Report strengths
- Social Proof fields such as teamMembersLed/communityReach/yearsOfCommitment
  when actually present

Formula:

CC =
0.35 * ContributionEvidence
+ 0.25 * LeadershipInitiative
+ 0.20 * Collaboration
+ 0.20 * CommunityImpact

Do not infer community impact solely from prestigious activity names.

----------------------------------------------------------------------
9D. Learning Environment Fit — 15%
----------------------------------------------------------------------

Sub-metrics:

Learning Style Match                35%
Academic Experience Match           25%
Collaboration & Community Match     20%
Development Opportunity Match       20%

Applicant side:

- Q7 preferred environment
- study preferences if available
- preferred learning/collaboration style
- research/project preference
- mentorship preference
- extracurricular preference

University side:

- teaching model
- experiential learning
- class structure
- interdisciplinary opportunities
- research opportunities
- entrepreneurship
- mentorship
- community programmes

This metric requires BOTH sides.

If target-side environment data is missing:
do not generate a confident score from applicant Q7 alone.

----------------------------------------------------------------------
9E. Distinctive Opportunity Fit — 15%
----------------------------------------------------------------------

Sub-metrics:

Opportunity Relevance         35%
Capability–Opportunity Match  25%
Future Goal Relevance         25%
Specificity / Uniqueness      15%

Applicant:

- Core Identity
- Driving Forces
- Proven Capabilities
- Personal Positioning
- experiences
- future direction
- intended major

University/programme:

- research labs
- clubs
- entrepreneurship ecosystem
- competitions
- industry partnerships
- exchange opportunities
- community initiatives
- special programmes
- scholarships/development programmes

The result should answer:

"Why is THIS university/programme particularly useful for THIS applicant?"

Do not output generic statements that would fit any university.

A high Specificity score requires named, source-backed target
opportunities.

======================================================================
TASK 10 — IMPLEMENT THE NEW PROGRAMME FIT
======================================================================

Do NOT use the old F5 five dimensions as the canonical Programme Fit.

Canonical Programme Fit weights:

Interest & Motivation Fit           30%
Capability Fit                      25%
Experience & Exposure Fit           20%
Career & Future Direction Fit       25%

Overall Programme Fit score is deterministic from those four metrics.

----------------------------------------------------------------------
10A. Interest & Motivation Fit — 30%
----------------------------------------------------------------------

Sub-metrics:

Interest Evidence              30%
Personal Motivation            30%
Problem–Field Connection       25%
Consistency Across Evidence    15%

Inputs:

- About Yourself Q1-Q4 structured signals
- Direction Q5-Q6
- CMCAITF Motivation
- Personal Report Driving Forces
- Personal Positioning
- repeated activity themes
- actual programme subject/theme/curriculum

Distinguish:

stated career preference
vs
repeated evidence-backed interest.

A statement such as "I want to study X" alone must not create a strong
Interest Evidence score.

----------------------------------------------------------------------
10B. Capability Fit — 25%
----------------------------------------------------------------------

Sub-metrics:

Core Capability Match       40%
Evidence Strength           30%
Capability Depth            20%
Transferability             10%

First determine:

"What capabilities does this programme actually value?"

Then compare against:

"What capabilities has this applicant actually demonstrated?"

Reuse:

- Target Profile preferred competencies
- Personal Report proven capabilities
- Proof of Me
- capability ratings if canonical
- activity evidence
- CMCAITF Action / Impact / Transformation
- leadership/project/competition evidence
- Personal Positioning

Do NOT compare programme capability labels against generic self-reported
traits alone.

Strong capability alignment requires grounded applicant evidence.

----------------------------------------------------------------------
10C. Experience & Exposure Fit — 20%
----------------------------------------------------------------------

Sub-metrics:

Field Relevance          40%
Depth of Engagement      25%
Application / Practice   20%
Breadth of Exploration   15%

Model or derive an explicit engagement stage:

participation
→ exploration
→ application
→ meaningful_engagement

Use:

- activity descriptions
- type
- role
- duration
- CMCAITF
- projects
- research
- competitions
- relevant outputs/outcomes
- recurrence

Do not treat "joined a club once" and "built/applied something for two
years" as equivalent evidence.

Do not infer duration when none is present.

----------------------------------------------------------------------
10D. Career & Future Direction Fit — 25%
----------------------------------------------------------------------

Sub-metrics:

Goal–Programme Relevance       40%
Skill–Goal Connection          25%
Trajectory Consistency         20%
Future Opportunity Relevance   15%

Applicant:

- Q5
- Q6
- Driving Forces
- Core Identity
- Proven Capabilities
- Personal Positioning
- target problem/future direction

Programme:

- curriculum
- learning outcomes
- career pathways
- programme-specific opportunities

This should answer:

"Does this programme make strategic sense for where this applicant wants
to go next?"

Do not merely score whether the intended career string contains words
also present in the course title.

======================================================================
TASK 11 — METRIC REASONING CONTRACT
======================================================================

The current generic criterion reasoner can be reused as a primitive where
useful, but the new canonical product should reason in metric/submetric
terms.

Create a strict schema similar to:

MetricEvaluationResult {
  metricId
  submetricId

  status:
    assessed |
    limited |
    not_available

  score: number 0..100 | null

  confidence: number 0..1

  reasoning

  applicantEvidenceIds[]
  targetSourceRefs[]

  missingEvidence[]

  limitations[]
}

Every requested semantic submetric must receive exactly ONE result.

Reject:

- missing submetric
- duplicate submetric
- unknown metric ID
- unknown submetric ID
- applicant evidence not supplied to the batch
- target source refs not supplied to the batch

Batch by top-level metric or another small deterministic grouping.

Do not create huge all-report prompts.

Track ACTUAL successful model call counts.

Do not infer aiCallCount from expected batch size.

If any required semantic batch fails:

FAIL THE ENTIRE REGENERATION.

Do not use partial results.

Do not persist a partial report.

The previous complete report must remain untouched.

======================================================================
TASK 12 — METRIC-SPECIFIC EVIDENCE PACKS
======================================================================

Do not send the entire Evidence Bank to every submetric.

Create deterministic evidence selection per metric/submetric.

Each evidence pack should contain:

- relevant Evidence Bank claims
- direct/supporting state
- verification status
- source refs
- relevant structured interpretation context
- relevant Personal Report structured context
- relevant target facts/source refs

Use top-K limits.

Preserve deterministic ordering.

Examples:

Values Alignment:
values + behaviour + motivation evidence.

Community Contribution:
leadership/team/community/outcome evidence.

Capability Fit:
capability and application evidence.

Experience Exposure:
activity duration/role/output/CMCAITF.

Career Fit:
future direction + capability + programme pathway/opportunity.

Incremental reuse hashes should be submetric-specific.

Do NOT hash the entire Personal Report prose into every metric if only one
small structured field is relevant.

A submetric input hash should include:

- metric/submetric definition
- weights/version
- relevant applicant structured fields
- retrieved applicant evidence
- relevant target structured fields/source refs
- prompt version
- matching engine version

Changing unrelated data should not invalidate every semantic metric.

======================================================================
TASK 13 — EVIDENCE / PROVENANCE SAFETY
======================================================================

Keep and strengthen current provenance behaviour.

Personal Report:
interpretation context only.

Evidence Bank direct evidence:
must be source-backed according to current canonical rules.

AI interpretation:
never direct evidence.

report_only:
never direct evidence.

conflicting:
must not silently become "verified".

A strong semantic score should require appropriate evidence.

If model outputs strong alignment but no valid grounded applicant
evidence exists, downgrade/reject according to deterministic validation.

Do not simply remove hallucinated IDs and continue pretending confidence
is unchanged.

When references are invalidated, recompute:

- evidence quality
- alignment if necessary
- confidence if necessary

Persist a compact `evidenceIndex` for evidence actually referenced by the
report so UI/downstream consumers can show meaningful provenance.

Example:

evidenceIndex: {
  [id]: {
    label
    category
    status
    sourceRefs
  }
}

Do not require the UI to display opaque IDs such as `ev-123`.

Likewise persist/hydrate a `targetSourceIndex` for referenced target
sources:

ref
title
url
retrievedAt

======================================================================
TASK 14 — HARD REQUIREMENTS
======================================================================

Keep hard requirements deterministic.

The LLM must never override:

- GPA threshold
- test threshold
- required qualification
- required subject
- language requirement
- required application document
- scholarship hard eligibility
- deadline where deterministically known

Do not classify optional document/portfolio/essay/transcript/reference as
hard merely because the noun appears.

Hard requires explicit semantics such as:

required
mandatory
must submit
must provide
minimum
at least
equivalent

Missing verified document should not automatically become a definitive
`does_not_meet` unless current business rules support that conclusion.

Keep insufficient_information distinct.

Hard criteria must never enter semantic LLM scoring batches.

======================================================================
TASK 15 — KEY TAKEAWAYS
======================================================================

Implement first-class structured:

keyTakeaways {
  strongestFit
  competitiveAdvantage
  criticalGap
  strategicDirection
}

These outputs MUST NOT introduce new claims.

They must be derived from already-evaluated:

- University Fit metrics
- Programme Fit metrics
- hard requirements
- strengths
- gaps
- Personal Report structured findings
- evidence/provenance

Use deterministic candidate selection first.

Use ONE constrained final narrative synthesis call for wording if needed.

----------------------------------------------------------------------
15A. Strongest Fit
----------------------------------------------------------------------

Identify 1–2 strongest areas across University + Programme Fit.

Require:

- strong score/alignment
- non-trivial evidence coverage
- evidence IDs
- target relevance

Return:

title
description
metricIds
evidenceIds
targetSourceRefs
whyItMatters
applicationLeverage

----------------------------------------------------------------------
15B. Competitive Advantage
----------------------------------------------------------------------

Do NOT simply choose the highest metric.

Cross-reference:

- repeated applicant capabilities
- Personal Positioning
- competitiveAdvantages from Personal Report
- social proof
- University Fit
- Programme Fit
- target relevance
- evidence

Ask:

1. What does the applicant repeatedly demonstrate?
2. Is it relevant to this target?
3. Is the combination meaningfully distinctive/specific?
4. Is it supported by concrete evidence?

Return a grounded positioning advantage.

If evidence does not support a genuine advantage, explicitly say the
advantage is still emerging rather than inventing differentiation.

----------------------------------------------------------------------
15C. Critical Gap
----------------------------------------------------------------------

Prioritization order should consider:

1. failed hard requirement
2. very low/high-importance fit metric
3. missing evidence on a high-value criterion
4. real experience/capability weakness
5. positioning issue

Use taxonomy compatible with product meaning:

requirement_gap
evidence_gap
experience_gap
positioning_gap

You may preserve more specific internal types if useful, but the product
must be able to distinguish these four concepts.

Do not label lack of evidence as lack of ability.

----------------------------------------------------------------------
15D. Strategic Direction
----------------------------------------------------------------------

Recommend what the applicant should prioritize next.

It must be derived from:

- strongest fit
- critical gap
- programme/university requirements
- opportunity fit
- applicant existing trajectory

No new applicant claims.

Return:

priority
action
rationale
relatedMetricIds
relatedGapIds
evidenceIds
targetSourceRefs

======================================================================
TASK 16 — GAP DERIVATION
======================================================================

Refactor gaps so the following distinctions are real:

Evidence Gap:
the applicant may possess the capability but current evidence does not
prove it.

Experience Gap:
current source-backed evidence shows insufficient actual exposure/depth.

Positioning Gap:
relevant evidence exists but is not connected/presented effectively.

Requirement Gap:
explicit hard requirement is not currently satisfied.

Never use:
"No evidence → applicant lacks capability"

as an automatic inference.

Priority should be deterministic based on:

- hard/soft
- metric importance
- deficit
- fixability
- target specificity
- evidence state

======================================================================
TASK 17 — FINAL SUMMARY
======================================================================

Final Matching summary must be generated only AFTER:

- hard requirement evaluation
- University Fit
- Programme Fit
- strengths
- gaps
- opportunities
- scholarship fit
- Key Takeaways

Exactly ONE successful final narrative-summary call per regenerated
report.

Cache hit:
ZERO AI calls.

The summary must reference only known:

- metric IDs
- evidence IDs
- target source refs

Programmatically reject unknown IDs.

Programmatically guard against statements such as:

- admission chance
- probability of admission
- likelihood of acceptance
- guaranteed admission
- will be admitted
- X% chance of admission

Also reject a summary saying all requirements are met when a hard
requirement failed.

======================================================================
TASK 18 — OLD F5 COMPATIBILITY
======================================================================

Do NOT delete F5 immediately.

However:

F5 Programme Fit is NOT the canonical Programme Fit in Matching V3.

Do not map the new 4 Programme Fit metrics into F5 dimensions using
arbitrary heuristics.

Do not derive the V3 score from F5.

Do not derive current V3 inputs from previous F5 rows.

Audit every legacy/downstream F5 consumer.

Preferred transition:

V3-capable consumers:
read V3 directly.

Legacy consumers:
continue reading valid legacy/F5 rows or explicitly supported
compatibility fields.

If a current F5 value can only be produced by reusing stale previous
values, do not present it as the current V3 result.

Document the compatibility decision clearly.

======================================================================
TASK 19 — CACHE / REUSE / VERSIONING
======================================================================

Exact report cache identity must include enough current lineage to ensure
correctness:

- application scope
- confirmedSnapshotId
- sourceAnalysisVersionId
- Personal Report version/id
- Personal Report input hash
- Target Profile version
- Target Profile schema version
- Evidence Bank version
- Matching contract version
- Matching engine version
- metric prompt version
- summary prompt version
- scoring formula/spec version if separate
- selected scholarship identity/version where applicable

Exact cache check must happen before:

- OpenAI configuration rejection
- free regeneration cooldown

so a cached report works with zero AI access.

Reuse previous metric/submetric results only when:

- contract version matches
- metric engine version matches
- prompt version matches
- metric definition/weight version matches
- relevant target input matches
- relevant applicant input matches
- evidence references still exist
- evidence/provenance validation still passes

A changed unrelated applicant field should not force every metric to
recompute.

======================================================================
TASK 20 — PERSISTENCE
======================================================================

Never persist:

- partial semantic batches
- report with invalid provenance
- report with missing required metric outputs
- report whose summary failed validation

Order:

build current inputs
→ exact cache
→ evaluate deterministic pieces
→ evaluate semantic metrics
→ aggregate formulas
→ derive strengths/gaps/takeaways
→ final summary
→ strict schema validation
→ persistence

If persistence encounters the unique exact-cache race:

reread the exact existing row and return it.

Do not surface a harmless concurrent duplicate as generation failure.

Keep previous complete report when regeneration fails.

======================================================================
TASK 21 — REPOSITORY READERS
======================================================================

Update canonical readers so:

V3 is actually selected and parsed.

Do not filter V3 rows using only old prompt constants.

Do not hide V3 rows because their prompt version differs from legacy.

Latest report selection should:

1. prefer newest valid V3
2. then newest valid V2
3. then valid legacy/F5

Malformed newest row must not hide an older valid report.

`getMatchingAnalysisByInputHash()` must use the complete cache identity
necessary to avoid ambiguous `maybeSingle()` behaviour across engine/
prompt versions.

All report loaders should be application + user scoped.

======================================================================
TASK 22 — STRATEGY / DOWNSTREAM CONSUMERS
======================================================================

Audit downstream:

- Strategy Report
- application strategy dashboard
- CV-related context
- Essay/SOP context
- Final Review context
- coach/context builders
- any matching report API response

V3-aware Strategy should consume:

- University Fit
- Programme Fit
- strengths
- gaps
- positioning opportunities
- Key Takeaways
- scholarship alignment
- evidence provenance

It must not silently fetch a stale legacy row just because the old
`prompt_version` constant matches.

Preserve legacy fallback.

Do not break existing users with V2/legacy rows.

======================================================================
TASK 23 — UI REBUILD TO MATCH PRODUCT FRAMEWORK
======================================================================

Do not merely rename old F5 UI labels.

Render the actual new V3 fields.

Canonical top-level UI sections:

1. UNIVERSITY FIT
2. PROGRAMME FIT
3. KEY TAKEAWAYS

Hard requirements and Scholarship can appear as clearly separated
supporting blocks, but do not turn the report into the current generic
eight-section layout.

----------------------------------------------------------------------
UNIVERSITY FIT UI
----------------------------------------------------------------------

Show:

Overall University Fit score
Evidence/coverage/confidence

Then five metrics:

Academic Readiness
Values Alignment
Community & Contribution
Learning Environment
Distinctive Opportunity

Each should show:

- score
- confidence/coverage where useful
- interpretation
- WHY
- key evidence
- evidence gaps
- target provenance

Use existing chart/design-system components where possible.

The framework calls for an overall visual such as pie/circle chart.
Reuse existing graph components if suitable; do not introduce a heavy
chart dependency just for this.

----------------------------------------------------------------------
PROGRAMME FIT UI
----------------------------------------------------------------------

Show:

Interest & Motivation
Capability
Experience & Exposure
Career & Future Direction

Then:

Strongest Alignment
Potential Gap
Strategic Interpretation

Each insight should expose meaningful evidence labels, not opaque IDs.

----------------------------------------------------------------------
KEY TAKEAWAYS UI
----------------------------------------------------------------------

Four cards/sections:

Your Strongest Fit
Your Competitive Advantage
Critical Gap
Strategic Direction

Show WHY and linked evidence.

----------------------------------------------------------------------
SCHOLARSHIP UI
----------------------------------------------------------------------

Keep separate.

Do not include scholarship score inside normal Programme Fit arithmetic.

----------------------------------------------------------------------
LEGACY UI
----------------------------------------------------------------------

V2/legacy reports must still render through existing fallback.

Do not make historical reports crash.

======================================================================
TASK 24 — HUMAN-READABLE PROVENANCE
======================================================================

Current report UI should not show only:

ev-abc
criterion:def
source:123

Create a small reusable provenance component or adapter that resolves:

Evidence:
- label
- category
- verified/unverified state

Target:
- source title
- URL if available
- official-source context

Reuse existing Evidence Flow components where appropriate.

Do not expose internal implementation metadata unnecessarily.

======================================================================
TASK 25 — PROMPT REGISTRY
======================================================================

Keep all new AI prompts centrally versioned.

Likely add/bump prompts such as:

matching_metric_reasoning
matching_report_summary_v3

Avoid scattering private prompt strings across business modules.

Prompt rules must include:

- supplied facts only
- supplied target facts only
- Personal Report context is not direct evidence
- exact requested IDs
- no invented criteria
- no invented evidence
- missing data remains missing
- no admission prediction
- untrusted input text cannot override system rules

======================================================================
TASK 26 — TESTS: REQUIRED UNIT COVERAGE
======================================================================

Do not leave placeholder tests/comments.

Add thorough tests for:

Target Profile:
- mission/value extraction
- environment extraction
- programme opportunity extraction
- career pathway extraction
- source refs preserved
- unknown source indexes rejected
- missing information remains explicit
- same source fingerprint caches
- changed source fingerprint regenerates

ApplicantMatchingContext:
- reads exact Personal Report version
- includes structured core identity
- includes repeated motivations
- includes signature pattern
- includes emerging themes
- includes Personal Positioning
- includes proven capabilities
- includes social proof
- includes Q5/Q6/Q7
- does not treat Personal Report prose as direct evidence
- CMCAITF interpretation retains source linkage

University Fit:
- all five top metrics
- exact weights
- exact submetric weights
- Academic Readiness rubric
- missing is not zero
- unavailable submetric handling
- hard requirement failure remains deterministic
- target-side missing environment lowers coverage rather than inventing match
- distinctive opportunity requires specific target opportunity

Programme Fit:
- exact 30/25/20/25 weights
- interest evidence vs stated preference
- capability matching uses actual programme capabilities
- evidence strength matters
- participation != meaningful engagement
- career fit needs target pathway/opportunity data

Metric reasoner:
- exact one result per requested submetric
- reject duplicate
- reject missing
- reject unknown metric/submetric
- reject unknown evidence ID
- reject unknown target source
- batch failure throws
- no partial return

Evidence:
- report_only not direct
- AI interpretation not direct
- conflicting evidence does not become verified
- invalidated direct refs can downgrade strong alignment
- evidence quality updated consistently

Gaps:
- evidence gap
- experience gap
- positioning gap
- requirement gap
- missing evidence != ability gap

Key Takeaways:
- strongest fit from actual metrics
- competitive advantage needs repeated + target-relevant evidence
- critical gap prioritizes hard failure
- strategic direction references existing findings only
- no new unsupported claim

Summary:
- exactly one final summary call
- unknown criterion/evidence/source IDs rejected
- failed hard requirement contradiction rejected
- admission probability language rejected

======================================================================
TASK 27 — GENERATION / ORCHESTRATION TESTS
======================================================================

Generation tests must cover at least:

1. current user application ownership enforced
2. exact Personal Report version used
3. exact source analysis version used
4. exact confirmed snapshot used
5. Evidence Bank version validated
6. target profile exact version used
7. FIRST EVER report produces real V3 metrics with no previous Matching row
8. first generation does NOT depend on F5 placeholder
9. exact cache returns before AI config check
10. exact cache returns before cooldown
11. cache hit performs zero metric calls
12. cache hit performs zero summary calls
13. changed target profile invalidates report cache
14. changed Personal Report invalidates relevant cache
15. unchanged submetrics are selectively reused
16. incompatible prompt version prevents reuse
17. incompatible engine version prevents reuse
18. missing evidence prevents stale reuse
19. semantic batch failure inserts nothing
20. final summary failure inserts nothing
21. previous complete report remains available on failure
22. hard requirement evaluator uses zero LLM calls
23. scholarship remains isolated
24. selected scholarship identity participates in cache
25. deadline reaches eligibility
26. optional portfolio/doc does not become hard
27. persistence failure throws/returns correct typed failure
28. concurrent duplicate insert rereads exact row
29. actual AI call counts stored correctly
30. successful regeneration persists complete V3 + lineage

Do not mock so aggressively that first-generation scoring is never
actually exercised.

Have at least one realistic integration-style compose/generation test
using real scoring/aggregation helpers with only the model call mocked.

======================================================================
TASK 28 — REPOSITORY TESTS
======================================================================

Test:

- newest valid V3 preferred
- V3 reader parses contract
- V2 fallback
- legacy fallback
- malformed latest V3 does not hide valid previous report
- cache lookup is version-aware
- exact duplicate race reread
- application/user scoping
- migration missing behaviour
- report JSON selected by page query
- Strategy reader can see canonical V3

======================================================================
TASK 29 — UI TESTS
======================================================================

Test V3 renders:

UNIVERSITY FIT
- overall
- all five metric names

PROGRAMME FIT
- all four metric names
- strongest alignment
- potential gap
- strategic interpretation

KEY TAKEAWAYS
- strongest fit
- competitive advantage
- critical gap
- strategic direction

Also test:

- human-readable evidence references
- hard requirement failure
- scholarship section when selected
- no scholarship section when none
- V2 fallback
- legacy fallback
- not_available renders "Not assessed", never "0%"
- no admission-probability wording

======================================================================
TASK 30 — PERFORMANCE / CALL COUNT
======================================================================

Avoid one model call per submetric if safe batching can be used.

Batch a small number of related submetrics while maintaining exact
ID validation.

Goals:

- deterministic work first
- semantic metric batches second
- exactly one final summary call
- cache = zero AI calls
- reuse unchanged metric/submetric outputs
- do not resend giant Personal Report/evidence payloads repeatedly

Track actual calls.

Do not fake metadata call counts from expected batch counts.

======================================================================
TASK 31 — ERROR BEHAVIOUR
======================================================================

Distinguish:

not_ready
migration_missing
not_configured
cached
cooldown
regenerated
hard server/generation failure

Do not convert persistence/system failures into "not_ready".

On regeneration failure:

- return/retain previous complete report where the route currently supports it
- do not write broken V3
- surface an actionable error

======================================================================
TASK 32 — CLEANUP ONLY AFTER NEW FLOW WORKS
======================================================================

After V3 works:

remove only genuinely dead Matching code.

Do NOT delete:

- F5 shared engine
- legacy reader support
- historical contract schemas
- migrations required for old rows

unless you prove there are no consumers.

Prefer marking compatibility adapters clearly.

======================================================================
EXPECTED FILE ORGANIZATION
======================================================================

Do not force this exact naming if current repo conventions suggest
something better, but the implementation should separate concerns.

A reasonable result might look like:

src/lib/ai/matching/
  domain.ts
  applicant-context.ts
  metric-definitions.ts
  metric-evidence.ts
  metric-reasoner.ts
  university-fit.ts
  programme-fit.ts
  hard-requirements.ts / aggregation.ts
  takeaways.ts
  report.ts
  generation.ts

Keep pure scoring/aggregation functions testable without Supabase/OpenAI.

Do not put all V3 logic into `generation.ts`.

======================================================================
DEFINITION OF DONE
======================================================================

The work is NOT complete until all of the following are true:

A brand-new application with:
- confirmed snapshot
- Personal Report
- Evidence Bank
- Target Profile

and NO previous Matching Report

can generate:

University Fit:
- Academic Readiness
- Values Alignment
- Community Contribution
- Learning Environment
- Distinctive Opportunity

Programme Fit:
- Interest & Motivation
- Capability
- Experience & Exposure
- Career & Future Direction

Key Takeaways:
- Strongest Fit
- Competitive Advantage
- Critical Gap
- Strategic Direction

with:

- evidence-backed WHY
- applicant evidence IDs
- target source refs
- hard requirement status
- correct formula weights
- explicit missing-data handling
- scholarship isolation
- exact lineage
- cache/reuse
- no admissions probability

AND the canonical UI renders those actual V3 fields.

======================================================================
MANDATORY VERIFICATION
======================================================================

Run the focused suites first.

At minimum:

npm test -- src/lib/ai/matching
npm test -- src/lib/ai/target-profile
npm test -- src/features/apply/api/ai-reports-repository.test.ts
npm test -- src/app/api/applications/[id]/match-insights/route.test.ts
npm test -- src/features/apply/ui/matching-report-view.test.tsx

Run all relevant Strategy tests touched by the change.

Then run:

npm run lint
npm run typecheck
npm test
npm run build:ci
git diff --check

If a command does not exist on current HEAD:
inspect package.json and run the repository's actual equivalent.

Do NOT say tests passed if the command was not executed.

Do NOT hide failing unrelated tests.
Clearly separate:

- failures caused by this change
- pre-existing failures
- environment failures

======================================================================
FINAL REVIEW BEFORE CLAIMING COMPLETION
======================================================================

Before finishing, manually trace one realistic first-generation example:

confirmed snapshot
→ exact source analysis
→ Evidence Bank
→ Personal Report structured context
→ Target Profile
→ University Fit evidence packs
→ five University Fit metrics
→ University Fit weighted result
→ Programme Fit evidence packs
→ four Programme Fit metrics
→ Programme Fit weighted result
→ hard requirements
→ strengths/gaps/opportunities
→ Key Takeaways
→ final summary
→ strict V3 validation
→ persistence
→ repository read
→ Matching UI
→ Strategy downstream

Specifically confirm there is NO hidden path:

previous Matching Report
→ current canonical score

and NO hidden path:

Personal Report prose
→ treated as direct/raw evidence.

======================================================================
FINAL RESPONSE FORMAT
======================================================================

When finished, report:

1. HEAD reviewed before changes
2. final commit/working-tree state
3. architecture changes
4. bugs fixed
5. new files
6. modified files
7. database migration if any
8. exact University Fit implementation
9. exact Programme Fit implementation
10. exact Key Takeaways implementation
11. how Personal Report structured data is consumed
12. how target data was expanded
13. evidence/provenance guarantees
14. cache/reuse behaviour
15. F5 compatibility behaviour
16. Strategy/downstream changes
17. UI changes
18. tests added
19. commands actually executed
20. exact pass/fail counts
21. remaining deviations from the product framework
22. unresolved blockers

Do not summarize with only "implemented successfully".

I need evidence that the full runtime flow works.

======================================================================
NON-NEGOTIABLE PRODUCT RULES
======================================================================

- Personal Report is interpretation/context, not direct evidence.
- Raw evidence is used to verify applicant claims.
- Hard requirements are deterministic.
- LLM cannot override hard requirements.
- Missing evidence is not proof of missing ability.
- Fit is alignment, not admission probability.
- Scholarship is separate.
- First generation cannot depend on a previous Matching row.
- Cache hit = zero AI calls.
- Regeneration = exactly one final summary AI call.
- Any semantic batch failure = fail whole regeneration.
- Any summary failure = fail whole regeneration.
- Never persist partial report.
- Preserve previous complete report on failure.
- Every applicant-specific insight must be traceable to evidence.
- Every target-specific insight must be traceable to target sources.
- Do not fabricate programme opportunities.
- Do not fabricate university philosophy/values.
- Do not silently convert missing data to zero.
- Do not rename old architecture without maintaining compatibility.
- Do not rewrite unrelated user-owned files.
