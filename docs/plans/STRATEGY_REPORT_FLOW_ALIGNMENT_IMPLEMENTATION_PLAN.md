# Strategy Report — Flow Alignment & Implementation Plan

**Repository:** `VietGlowbal/MainSite`  
**Reviewed HEAD:** `6127a7235a07fa9524fa366ad9541dfdc8a274db`  
**Source of truth:** Strategy Report flow provided by the user (`Pasted markdown(2).md`)  
**Scope:** canonical Strategy Report generation, persistence, prompts, prioritisation, Planner handoff, and UI.

> Before implementation, fetch the latest `main`. If HEAD has advanced, re-audit the changed Strategy files and apply this plan against the actual latest HEAD.

---

# 1. Executive Summary

The current Strategy implementation already has strong infrastructure:

- application-scoped generation
- Personal Report + Matching Report consumption
- a structured F8 JSON report
- append-only persistence
- input hashing
- Matching Report V3 support
- editable priority overrides
- deterministic Planner handoff
- historical F7 fallback support
- a multi-section Strategy UI

However, the canonical F8 product logic is still only partially aligned with the required Strategy flow.

## Current alignment estimate

| Area | Current state | Approx. alignment |
|---|---|---:|
| Strategic Overview | Present but incomplete | ~65% |
| Prioritisation | AI-authored table, missing required factor framework | ~45% |
| Profile Development | Academic / Experience / Differentiation only | ~30% |
| Strategic Status System | Missing | ~10% |
| Activity-Level Analysis | Missing | ~10% |
| Core Narrative Direction | Generic narrative exists | ~55% |
| Supporting Themes | Present | ~70% |
| Narrative Tension / Gap | Missing | ~10% |
| Narrative Options | Missing in canonical F8 | ~10% |
| Strategic Roadmap | Strongest current section | ~80% |
| Provenance / evidence refs | Weak in Strategy output | ~35% |
| Input lineage consistency | Good foundation, but raw mutable activities leak in | ~65% |
| UI alignment | Partial | ~60% |

**Overall product-flow alignment: roughly 50–60%.**

The key architectural change should be:

```text
Canonical upstream inputs
        ↓
Strategy Context
        ↓
Profile + Activity Diagnosis
        ↓
Deterministic Prioritisation
        ↓
Narrative Strategy Synthesis
        ↓
Strategic Roadmap
        ↓
Strategy Report V3
        ↓
UI + Planner
```

Do **not** solve the remaining gaps by making the current one-shot F8 prompt larger.

---

# 2. Required Product Structure

The canonical Strategy Report should have exactly four top-level sections:

```text
1. Strategic Overview
2. Profile Development Strategy
3. Narrative Strategy
4. Strategic Roadmap
```

The existing `Strategic Priority Table` should become part of **Strategic Overview**, not remain a fifth top-level section.

---

# 3. Current Runtime Flow

Current generation is approximately:

```text
course_application
        ↓
latest application Personal Report
        +
latest complete Matching Report
        +
CURRENT user student_achievements
        +
CURRENT user student_activities
        +
minimal university career fields
        ↓
buildUserPrompt()
        ↓
ONE large F8 LLM call
        ↓
StrategyReportV2
        ↓
application_strategy_recommendations.report_v2
        ↓
StrategyReportV2View
        ↓
Planner deliverables
```

Main implementation areas:

```text
src/lib/ai/strategy-recommendation.ts

src/app/api/applications/[id]/strategy/recommendation/route.ts

src/features/ai-strategy-dashboard/domain/recommendation.ts

src/features/ai-strategy-dashboard/ui/strategy-report-v2-view.tsx

src/features/ai-strategy-dashboard/ui/strategy-recommendation-workspace.tsx

src/features/ai-strategy-dashboard/ui/strategy-recommendation-report.tsx

src/features/ai-strategy-dashboard/api/fetch-planning-context-sources.ts

src/features/ai-strategy-dashboard/domain/compile-planning-context.ts
```

---

# 4. Preserve the Existing Good Infrastructure

Do not rewrite these without a concrete reason:

- application + user scoping
- Personal Report lineage
- Matching Report V3 support
- append-only Strategy versions
- input hashing
- no admission probability rule
- Zod validation boundary
- student overrides stored separately
- completed Planner progress preserved across regeneration
- archive instead of destructive Planner deletion
- V3 Matching preferred over F5
- historical F7/F8 readers
- Strategy loading/generation workspace
- deterministic Planner handoff from roadmap deliverables
- current tool links:
  - Personal Canvas
  - CV Builder
  - Statement Writer

The new Strategy V3 should reuse those foundations.

---

# 5. P0 — Fix Strategy Input Architecture

## Current problem

The generation route reads current mutable:

```text
student_achievements
student_activities
```

directly from the user profile.

This can produce:

```text
Personal Report from snapshot A
+
Matching Report from snapshot A
+
activities edited after snapshot A
=
one Strategy Report with mixed lineage
```

That breaks canonical report consistency.

## Required architecture

Create a typed canonical:

```ts
StrategyInputContext
```

built from exact upstream versions.

Recommended source graph:

```text
Application
│
├── exact Personal Report version
│     ├── Core Identity
│     ├── Driving Forces
│     ├── Signature Pattern
│     ├── Emerging Themes
│     ├── Personal Positioning
│     ├── Proven Capabilities
│     ├── Social Proof
│     ├── Growth Signals
│     └── exact source-analysis lineage
│
├── exact Matching Report V3
│     ├── University Fit
│     ├── Programme Fit
│     ├── Hard Requirements
│     ├── Strengths
│     ├── Gaps
│     ├── Positioning Opportunities
│     ├── Key Takeaways
│     ├── Scholarship Alignment
│     └── Target Profile lineage
│
├── exact source analysis / Evidence Bank
│     └── activity/achievement evidence + CMCAITF interpretations
│
├── exact Target Profile referenced by Matching
│     ├── university facts
│     ├── programme requirements
│     ├── curriculum/outcomes
│     ├── opportunities
│     ├── scholarship
│     └── target provenance
│
└── Application Context
      ├── application status
      ├── deadline
      ├── intake
      ├── selected scholarship
      └── requirement state
```

### Rule

Do not re-read mutable global activities as a second source of applicant truth.

For activity-level Strategy analysis, reconstruct canonical experience context from:

1. exact confirmed snapshot/source analysis
2. canonical Personal Report `Proof of Me`
3. Evidence Bank / interpretation payload

in that order.

---

# 6. Proposed `StrategyInputContext`

Suggested shape:

```ts
type StrategyInputContext = {
  lineage: {
    applicationId: string;

    personalReportVersionId: string;
    personalReportInputHash: string | null;
    sourceAnalysisVersionId: string | null;
    confirmedSnapshotId: string | null;

    matchingReportId: string;
    matchingInputHash: string | null;
    matchingContractVersion: string;
    matchingEngineVersion: string;

    targetProfileVersionId: string | null;
    selectedScholarshipVersionId: string | null;
  };

  applicant: {
    coreIdentity;
    drivingForces;
    signaturePattern;
    emergingThemes;
    provenCapabilities;
    socialProof;
    personalPositioning;
    growthSignals;
    futureDirection;
  };

  activities: StrategyActivityContext[];

  matching: {
    universityFit;
    programmeFit;
    hardRequirements;
    strengths;
    gaps;
    positioningOpportunities;
    keyTakeaways;
    scholarshipAlignment;
  };

  target: {
    university;
    programme;
    requirements;
    opportunities;
    scholarship;
    targetSourceIndex;
  };

  application: {
    status;
    deadline;
    daysUntilDeadline;
    intake;
  };

  evidenceIndex;
};
```

Do not use Personal Report `narrativeDetails` as factual applicant evidence.

Canonical structured findings remain the Strategy source of truth.

---

# 7. Reuse Existing Planning Infrastructure Carefully

The repo already contains:

```text
fetchPlanningContextSources()
compilePlanningContext()
```

with useful deterministic handling for:

- requirements
- requirement gaps
- unresolved requirements
- hard constraints
- deadlines
- evidence tiers
- provenance
- source diagnostics

Reuse those **source adapters and deterministic helpers** where appropriate.

But do not feed the full existing `PlanningContext` directly into Strategy V3 if it contains a previous Strategy recommendation.

Avoid:

```text
old Strategy
→ new Strategy generation
→ old Strategy becomes evidence for itself
```

Previous Strategy content is allowed only for:

- cache/reuse
- historical fallback
- preserving overrides
- preserving Planner progress

not as evidence supporting new strategic conclusions.

---

# 8. Introduce `StrategyReportV3`

Keep historical V2/F8 and F7 parsing.

Prefer storing V3 in the existing JSONB report column if possible rather than adding a migration solely because the column is named `report_v2`.

Add an explicit version:

```ts
contractVersion: 'strategy-report-v3'
```

Suggested top-level shape:

```ts
StrategyReportV3 {
  contractVersion;
  generatedAt;

  strategicOverview;
  profileDevelopmentStrategy;
  narrativeStrategy;
  strategicRoadmap;

  evidenceIndex;
  targetSourceIndex;

  metadata;
}
```

Use a strict Zod schema for V3.

---

# 9. Section 1 — Strategic Overview

Purpose:

> Give the applicant a one-screen strategic diagnosis before they read detailed recommendations.

It should answer:

```text
What is already convincing?
What is underdeveloped?
What is unclear?
What could become differentiated?

If only 2–3 things improve,
which changes create the highest strategic return?

What should the application communicate more strongly?
```

---

# 10. Current Position Contract

Current code only has:

```text
profile
keyStrength
biggestChallenge
```

Expand to:

```ts
currentPosition: {
  summary: string;

  profileStrength: {
    statement: string;
    evidenceIds: string[];
    metricIds: string[];
  };

  keyChallenge: {
    statement: string;
    gapIds: string[];
    requirementIds: string[];
  };

  unclearArea?: {
    statement: string;
    basis: string[];
  };

  differentiatedPotential?: {
    statement: string;
    evidenceIds: string[];
    metricIds: string[];
  };
}
```

Applicant-facing framework:

```text
Profile Strength
→ Key Challenge
→ Strategic Opportunity
```

---

# 11. Strategic Opportunity

Add a first-class field:

```ts
strategicOpportunity: {
  statement: string;
  priorityKeys: string[];
}
```

Core question:

> If the applicant improves only 2–3 things, which changes would create the largest improvement in application quality?

This is not synonymous with:

```text
weakest metric
```

The highest-value opportunity may be:

- deepen a strong existing experience
- consolidate fragmented experiences
- clarify future direction
- fix a requirement
- add stronger evidence
- reposition existing work
- genuinely build a missing dimension

---

# 12. Strategic Goal

Do not turn the Strategic Goal into a fixed identity.

Use:

```ts
strategicGoal: {
  directionOfImprovement: string;
  communicationGoal: string;
}
```

Bad:

```text
Become a human-centered EdTech entrepreneur.
```

Good:

```text
Strengthen the connection between educational interests,
product-building evidence and long-term academic direction.
```

The goal describes the **direction of improvement**.

---

# 13. P0 — Implement the Required Prioritisation Model

Every potential intervention must be evaluated against:

```text
Impact
× Relevance
× Evidence Gap
× Feasibility
× Urgency
```

The source document specifies the factors but not a numeric scale.

## Recommended implementation rubric

Use an internal 0–4 scale:

```text
0 = none / irrelevant / infeasible
1 = low
2 = moderate
3 = high
4 = critical / exceptional
```

This is an **implementation rubric**, not an admissions score.

Deterministically calculate:

```ts
rawPriority =
  impact *
  relevance *
  evidenceGap *
  feasibility *
  urgency;
```

Optionally normalize internally for sorting.

Do not expose it as an admissions-style percentage.

---

# 14. Ownership of Each Priority Factor

Do not let one final writer invent all factor values freely.

## Impact

Semantic judgement based on:

- likely improvement to application quality
- importance of the affected profile dimension
- connection to current strength/gap

## Relevance

Grounded in:

- programme requirement
- University Fit / Programme Fit
- target opportunity
- target source refs

High relevance requires target-side support.

## Evidence Gap

Prefer deterministic derivation from:

```text
requirement gap
evidence gap
experience gap
positioning gap
Personal Report evidence weakness
```

## Feasibility

Consider:

- days until deadline
- required time/depth
- current foundation
- whether an existing experience can be deepened

## Urgency

Prefer deterministic inputs:

- deadline
- hard requirement
- application stage
- dependency order

---

# 15. Intervention Candidate Layer

Create:

```ts
StrategyInterventionCandidate
```

Potential sources:

```text
hard requirement gap
Matching critical gap
Matching strategic direction
Personal growth opportunity
Profile Development diagnosis
Activity development opportunity
Narrative tension
Evidence gap
```

Recommended kinds:

```ts
type InterventionKind =
  | 'maintain'
  | 'deepen_existing'
  | 'consolidate_existing'
  | 'reposition_existing'
  | 'build_missing_dimension'
  | 'add_evidence'
  | 'fix_requirement';
```

Important product rule:

> Not every weakness requires a new activity.

Prefer:

```text
Maintain
Develop
Consolidate
Reposition
```

before:

```text
Build something new
```

unless the evidence genuinely shows a missing dimension.

---

# 16. Top 3 Priorities Contract

Do not store Top 3 as bare strings.

Use:

```ts
topPriorities: Array<{
  key: string;
  title: string;
  why: string;
  suggestedDirection: string;

  factors: {
    impact: number;
    relevance: number;
    evidenceGap: number;
    feasibility: number;
    urgency: number;
  };

  basisRefs: string[];
}>;
```

Rules:

- maximum 3
- deterministic ranking
- do not pad weak priorities
- hard requirement may outrank narrative improvement
- low evidence coverage alone is not a capability weakness
- a new activity should not outrank deepening/consolidating existing evidence unless justified

---

# 17. Section 2 — Profile Development Strategy

Current F8 only contains:

```text
Academic
Experience
Differentiation
```

The required profile-level diagnosis contains:

```text
Academic
Experience
Differentiation
Evidence
```

Every relevant area also needs a strategic status.

---

# 18. Strategic Status System

Add:

```ts
type ProfileStrategyStatus =
  | 'maintain'
  | 'develop'
  | 'consolidate'
  | 'build';
```

## Maintain

Already sufficiently strong.

Explain why further investment has relatively low strategic return.

## Develop

Relevant foundation exists but needs depth.

Explain exactly what deeper means, e.g.:

```text
more responsibility
longer commitment
measurable outcome
process improvement
mentoring
more complex problem ownership
```

## Consolidate

Multiple relevant experiences exist but are fragmented.

Prefer connecting/deepening/evidencing them over adding another similar activity.

## Build

An important dimension is genuinely missing.

Output must follow:

```text
Gap
→ Why it matters
→ Possible routes
→ Recommended route
→ Evidence expected
```

---

# 19. Profile-Level Diagnosis Contract

Use an extensible area contract:

```ts
ProfileAreaDiagnosis {
  key: string;

  category:
    | 'academic'
    | 'experience'
    | 'differentiation'
    | 'evidence';

  label: string;
  status: ProfileStrategyStatus;

  diagnosis: string;
  whyItMatters: string;
  suggestedDirection: string;

  evidenceIds: string[];
  metricIds: string[];
  requirementIds: string[];
  targetSourceRefs: string[];
}
```

---

# 20. Academic Diagnosis

Evaluate only relevant dimensions:

```text
GPA / academic performance
relevant coursework
academic progression
subject-specific preparation
standardized tests
academic achievements
research readiness where relevant
```

Do not force research recommendations for a target that does not value research.

---

# 21. Experience Diagnosis

Profile-level Experience diagnosis should synthesize:

```text
Relevance
Role
Depth
Progression
Impact
Evidence
Future Potential
```

This summary does not replace activity-level analysis.

---

# 22. Differentiation Diagnosis

Answer:

> What target-relevant combination could become relatively distinctive?

Use evidence-backed combinations from:

```text
Personal Report capabilities
Social Proof
Positioning
Matching fit
```

Avoid unsupported claims about the applicant pool.

Prefer:

```text
could become a differentiator
creates a target-relevant combination
```

unless comparative evidence actually exists.

---

# 23. Evidence Diagnosis

This is missing from current F8 and should become a first-class dimension.

It should answer:

```text
Which important claims are strongly supported?
Which claims are weak?
Where is proof missing?
Which evidence improvement has real strategic value?
```

Use Evidence Bank tiers and Matching evidence coverage.

Never convert:

```text
lack of proof
```

into:

```text
lack of ability
```

---

# 24. P0 — Add Activity-Level Analysis

The required Strategy flow explicitly analyses each significant experience / achievement.

Current canonical F8 does not implement it.

Create:

```ts
ActivityStrategyAnalysis
```

for each canonical experience.

Suggested structure:

```ts
ActivityStrategyAnalysis {
  activityId: string;
  title: string;

  dimensions: {
    relevance;
    responsibility;
    depth;
    progression;
    impact;
    evidence;
    reflection;
    futurePotential;
  };

  classification:
    | 'maintain'
    | 'develop'
    | 'consolidate'
    | 'reposition'
    | 'deprioritize';

  diagnosis: string;
  recommendedMove: string;

  evidenceIds: string[];
  targetSourceRefs: string[];
}
```

---

# 25. Activity-Level Questions

For every activity ask:

```text
Relevance
How directly does it support the target?

Responsibility
What did the applicant actually own?

Depth
How deeply were they involved?

Progression
Did responsibility/depth increase?

Impact
What changed because of the applicant?

Evidence
Can contribution/impact be demonstrated?

Reflection
What did the applicant learn or change?

Future Potential
Can this existing experience still produce stronger evidence?
```

Never infer ownership from mere participation.

Never infer progression without supporting temporal/depth evidence.

---

# 26. Activity Classification

Allowed:

```text
Maintain
Develop
Consolidate
Reposition
Deprioritize
```

## Maintain

Strong and sufficiently developed.

## Develop

Relevant foundation but can gain depth/impact/responsibility.

## Consolidate

Best strengthened together with other related experiences.

## Reposition

Useful transferable evidence, but currently framed poorly for the target.

## Deprioritize

Limited strategic value for this target.

`Deprioritize` does not mean the activity is bad.

---

# 27. Section 3 — Narrative Strategy

Current F8 has:

```text
Core Narrative
Themes
Consistency Check
```

The required flow needs:

```text
A. Core Narrative Direction
B. Supporting Themes
C. Narrative Tension / Gap
D. Narrative Options
```

---

# 28. Core Narrative Direction

Do not begin with generic essay prose.

Model the causal structure explicitly:

```ts
coreNarrativeDirection: {
  originTrigger: string | null;
  recurringMotivation: string | null;
  actions: string[];
  capabilitiesDeveloped: string[];
  emergingDirection: string | null;

  insight: string;
  evidenceIds: string[];
}
```

Required causal chain:

```text
Origin / Trigger
→ Recurring Motivation
→ Actions
→ Capability Developed
→ Emerging Direction
```

The model must detect progression, not merely keyword repetition.

---

# 29. Theme ≠ Narrative

A theme is:

```text
Accessibility
```

A narrative is:

```text
Encountered education barriers
→ understood accessibility problems
→ experimented with technology
→ built solutions
→ developed an academic direction
```

Prompt and schema must keep these concepts separate.

---

# 30. Supporting Themes

Return 3–5 only when supported.

Do not pad to three.

Each theme:

```ts
{
  key: string;
  title: string;
  evidenceIds: string[];
  significance: string;
}
```

Framework:

```text
Theme
→ Evidence
→ Significance
```

---

# 31. Narrative Tension / Gap

Add a first-class diagnosis.

Allowed types:

```ts
type NarrativeGapType =
  | 'motivation_action_gap'
  | 'action_impact_gap'
  | 'experience_future_gap'
  | 'fragmentation';
```

Output:

```text
Observed Gap
→ Evidence
→ Why It Matters
→ Possible Direction
```

Do not use the current generic `Consistency Check` as a substitute.

It may remain as internal/supporting diagnostic data.

---

# 32. Narrative Options

Generate 2–3 plausible narrative directions when evidence supports them.

Do not force three.

Suggested contract:

```ts
NarrativeOption {
  key: string;
  title: string;

  centralIdea: string;
  whyItEmerges: string;

  supportingExperienceIds: string[];
  whatCouldStrengthenIt: string;

  evaluation: {
    evidenceStrength: 'high' | 'medium' | 'low';
    personalAuthenticity: 'high' | 'medium' | 'low';
    programmeRelevance: 'high' | 'medium' | 'low';
    differentiation: 'high' | 'medium' | 'low';
    developmentPotential: 'high' | 'medium' | 'low';
  };

  strategicFit: 'high' | 'medium' | 'low';
}
```

Rules:

- these are narrative directions, not fixed identities
- every option must be evidence-backed
- programme relevance must be target-grounded
- differentiation cannot claim rarity without comparative evidence
- one option is acceptable if only one is defensible

---

# 33. Section 4 — Strategic Roadmap

This is the current implementation's strongest area.

Preserve Planner integration and improve semantic constraints.

Use four canonical phases:

```text
1. Strengthen Foundation
2. Build Competitive Advantages
3. Craft Application
4. Finalise & Optimise
```

Prefer exact server-owned keys:

```ts
strengthen_foundation
build_competitive_advantages
craft_application
finalise_optimise
```

---

# 34. Roadmap Phase Contract

Each phase:

```ts
{
  phaseKey;

  name;
  goal;
  keyActions[];
  deliverables[];
  successCriteria[];
  estimatedTimeline;

  linkedPriorityKeys[];
}
```

This directly supports the required table:

```text
Goal
Key Actions
Deliverables
Success Criteria
Estimated Timeline
```

---

# 35. Roadmap Must Respect Deadline Feasibility

Current timelines are largely free-form model text.

Roadmap feasibility should use:

```text
current date
application deadline
hard requirements
dependency ordering
```

Do not recommend:

```text
a sustained 12-week research project
```

if submission is in 10 days.

When deadline is close:

- compress phases
- overlap phases where necessary
- prioritize mandatory requirements
- prioritize evidence/positioning fixes over unrealistic new profile building
- explicitly state what is no longer feasible

---

# 36. Preserve Planner Handoff

Keep:

```text
one Planner task per deliverable
completed state preserved
removed recommendations archived
tool links preserved
```

But improve semantic identity of generated tasks.

---

# 37. P0 — Stable Keys Must Be Server-Derived

Current F8 asks the model to create "deterministic slugs".

An LLM cannot guarantee deterministic identity across regenerations.

Yet those keys control:

```text
student overrides
Planner reconciliation
task preservation
```

Fix this.

## Priority key

Derive from canonical intervention candidate ID:

```text
strategy-priority::{candidateId}
```

## Phase key

Hardcode the canonical four phase keys.

## Deliverable key

Derive server-side from stable semantics such as:

```text
phaseKey
+
linkedPriorityKey
+
deliverableKind
```

## Activity analysis key

Use canonical activity ID.

## Narrative theme / option key

Generate server-side after validation from stable supporting basis.

Never use model-generated wording as persistent semantic identity.

---

# 38. Recommended AI Architecture

Do not make the current F8 prompt larger.

Use bounded stages.

---

## Stage A — Profile Diagnosis

Prompt:

```text
strategy_profile_diagnosis
```

Input:

```text
canonical Personal Report
Matching V3
requirements
target context
application/deadline context
```

Output:

```text
Academic area diagnoses
Experience diagnosis
Differentiation diagnosis
Evidence diagnosis
status candidates
```

No roadmap.

No final overview prose.

---

## Stage B — Activity-Level Analysis

Prompt:

```text
strategy_activity_analysis
```

Batch canonical activities, e.g. 6–8 per call.

Each requested activity ID must return exactly one result.

Reject:

- missing ID
- duplicate ID
- unknown ID
- invented evidence ID
- invented target ref

Run batches concurrently where safe.

If a required batch fails:

```text
fail regeneration
preserve previous complete Strategy report
```

Do not partially persist.

---

## Stage C — Deterministic Prioritisation

No model call.

Inputs:

```text
profile diagnoses
activity analyses
Matching gaps
hard requirements
Personal growth signals
deadline
```

Build intervention candidates.

Evaluate:

```text
Impact
× Relevance
× Evidence Gap
× Feasibility
× Urgency
```

Select the canonical Top 3.

The final writer cannot reorder them.

---

## Stage D — Strategy Synthesis

Prompt:

```text
strategy_report_synthesis
```

Input:

```text
canonical context
profile diagnoses
activity analyses
deterministically ranked priorities
```

Output only applicant-facing synthesis for:

```text
Strategic Overview
Narrative Strategy
Strategic Roadmap
```

The model may not:

- re-rank priorities
- change profile status
- change gap type
- create a new applicant fact
- invent a requirement
- invent a university opportunity
- change deadline facts
- imply admissions probability

---

# 39. Prompt Registry

The current Strategy prompts are hardcoded inside:

```text
src/lib/ai/strategy-recommendation.ts
```

For Strategy V3, use the central prompt/version architecture used by newer report systems.

Recommended keys:

```text
strategy_profile_diagnosis
strategy_activity_analysis
strategy_report_synthesis
```

Track versions independently.

Every prompt version must participate in cache identity.

---

# 40. Evidence / Provenance

Strategy conclusions should preserve refs from upstream.

Use fields such as:

```text
evidenceIds
metricIds
gapIds
requirementIds
targetSourceRefs
activityIds
```

as applicable.

Examples:

## Current Position strength

```text
Personal capability evidence
+
Matching strong metric
```

## Build recommendation

```text
Matching experience gap
+
target programme requirement/opportunity
```

## Narrative option

```text
activity IDs
+
reflection-supported pattern
+
programme relevance target refs
```

## Roadmap action

```text
linkedPriorityKeys
```

Persist compact:

```text
evidenceIndex
targetSourceIndex
```

for readable UI provenance.

---

# 41. Future Recommendation ≠ Existing Evidence

AI may propose future possibilities only inside explicitly future-looking fields:

```text
possible routes
recommended route
roadmap action
deliverable
```

Never present a proposed opportunity as something the applicant has already done.

Maintain a strict boundary:

```text
existing evidence
≠
recommended future action
```

---

# 42. Cache Ordering

Current route checks AI configuration before completing exact Strategy cache resolution.

Fix order:

```text
load application/current canonical inputs
→ build StrategyInputContext
→ calculate exact input hash
→ exact cache lookup
→ if hit: return with 0 AI calls
→ only then require AI configuration
→ generate
```

Cached Strategy must work when AI configuration is temporarily unavailable.

---

# 43. Exact Cache Only for Strategy V3

Current canonical route may accept:

```text
input hash matches
OR
source Personal/Matching IDs match
```

The lineage-only path can stale-hit if application context changes.

For Strategy V3:

```text
exact inputHash match
```

should be the only canonical generation cache hit.

Historical Strategy rows without modern hashes may still be readable.

They should not be treated as exact current-state cache hits.

---

# 44. Do Not Fall Back to a Fresh F7 Generation on V3 Failure

Current flow:

```text
F8 generation fails
→ run old F7 model
→ persist a different semantic report
```

For canonical Strategy V3:

```text
V3 generation failure
→ persist nothing
→ preserve previous valid report
→ return typed failure
```

Historical V2/F7 **read fallback** remains.

Legacy generation should not be the recovery path for failed V3 generation.

---

# 45. Reader Order

Do not read only the latest row and give up if it is malformed.

Scan a bounded number of recent rows.

Choose:

```text
newest valid Strategy V3
→ newest valid Strategy V2/F8
→ newest valid F7
```

Malformed newest report must not hide an older valid report.

---

# 46. Metadata

Recommended V3 metadata:

```ts
metadata: {
  strategyEngineVersion;
  reportContractVersion;

  profileDiagnosisPromptVersion;
  activityAnalysisPromptVersion;
  synthesisPromptVersion;

  priorityFormulaVersion;

  personalReportVersionId;
  personalReportInputHash;
  sourceAnalysisVersionId;
  confirmedSnapshotId;

  matchingReportId;
  matchingInputHash;
  matchingContractVersion;
  matchingEngineVersion;

  targetProfileVersionId;
  selectedScholarshipVersionId;

  applicationDeadlineEvaluatedAt;

  model;
  aiCallCount;
}
```

---

# 47. UI Information Architecture

Canonical V3 top navigation:

```text
1. Strategic Overview
2. Profile Development
3. Narrative Strategy
4. Strategic Roadmap
```

No fifth `Strategic Priority Table` top-level anchor.

---

# 48. UI — Strategic Overview

Purpose:

> One-screen diagnosis.

Recommended desktop structure:

```text
┌────────────────────────────────────────────────────────────┐
│ STRATEGIC OVERVIEW                                         │
│ Target: University · Programme · Deadline                  │
├───────────────────┬───────────────────┬────────────────────┤
│ Profile Strength  │ Key Challenge     │ Strategic Goal     │
│                   │                   │                    │
├────────────────────────────────────────────────────────────┤
│ STRATEGIC OPPORTUNITY                                      │
│ “If you improve only 2–3 things...”                        │
├────────────────────────────────────────────────────────────┤
│ TOP 3 PRIORITIES                                           │
│                                                            │
│ 01 Priority                                                │
│    Why it matters                                          │
│    Suggested direction                                     │
│    Impact · Relevance · Evidence Gap · Feasibility · Urgency│
│                                                            │
│ 02 ...                                                     │
│ 03 ...                                                     │
├────────────────────────────────────────────────────────────┤
│ EXPECTED OUTCOME                                           │
└────────────────────────────────────────────────────────────┘
```

Mobile:

- stack cards
- keep priority number visually dominant
- factor scores become compact chips
- no dense table

---

# 49. Priority Editing UI

Preserve student overrides.

But put the priority editor inside Strategic Overview or an expandable detail.

Primary presentation:

```text
Priority
Why
Suggested Direction
```

Expandable/editable detail may contain:

```text
Current Situation
Recommended Actions
Expected Impact
Factor values
```

This keeps current override functionality without creating a fifth report section.

---

# 50. UI — Profile Development

Top-level blocks/tabs:

```text
Academic
Experience
Differentiation
Evidence
```

Every area should show a status badge.

Suggested visual system:

```text
MAINTAIN     → positive / green
DEVELOP      → amber / brand
CONSOLIDATE  → purple / info
BUILD        → attention / red-orange
```

`BUILD` means strategically missing, not "bad applicant".

---

# 51. Academic UI

Use a compact matrix:

```text
Area                    Status       Diagnosis
Academic Performance    Maintain     ...
Relevant Coursework     Develop      ...
Research Readiness      Build        ...
```

Expand/click to show:

```text
Why it matters
Suggested direction
Evidence
Target basis
```

Only render relevant academic areas.

---

# 52. Activity-Level Analysis UI

Add a first-class subsection.

Desktop summary table:

```text
Activity / Achievement
Status
Relevance
Depth
Impact
Evidence
Future Potential
```

Expandable detail:

```text
Responsibility
Progression
Reflection
Diagnosis
Recommended Move
Evidence
Target relevance
```

Mobile: one activity card per item.

Example:

```text
CareerBridge
[DEVELOP]

Relevance         High
Depth             Moderate
Impact            Strong
Evidence          Moderate
Future Potential  High
```

Add filter chips:

```text
All
Maintain
Develop
Consolidate
Reposition
Deprioritize
```

---

# 53. UI — Narrative Strategy

The UI should make causal progression visible.

---

## 53.1 Core Narrative Direction

Desktop:

```text
Origin / Trigger
      ↓
Recurring Motivation
      ↓
Actions
      ↓
Capabilities Developed
      ↓
Emerging Direction
```

Use horizontal flow if space allows.

Mobile: vertical flow.

Below it show:

```text
Core Narrative Insight
```

Avoid presenting this as a permanent identity label.

---

## 53.2 Supporting Themes

Use 3–5 cards:

```text
Theme
Evidence
Significance
```

Do not use a generic tag cloud.

---

## 53.3 Narrative Tension / Gap

Use a visually distinct diagnostic card:

```text
NARRATIVE GAP
Experience → Future Gap

Observed gap
Evidence
Why it matters
Possible direction
```

Badge types:

```text
Motivation → Action
Action → Impact
Experience → Future
Fragmentation
```

---

## 53.4 Narrative Options

Render 2–3 cards side-by-side on desktop.

Each:

```text
Direction 1 — [Narrative Direction]
Strategic Fit: HIGH

Central idea

Why it emerges

Strongest supporting experiences
• ...
• ...

What could strengthen it

Evidence Strength       High
Authenticity            High
Programme Relevance     Medium
Differentiation         Medium
Development Potential   High
```

Do not call an option "your identity."

If highlighting one option, label it:

```text
Best-supported direction
```

---

# 54. UI — Strategic Roadmap

Use a four-phase timeline/stepper:

```text
1. Strengthen Foundation
2. Build Competitive Advantages
3. Craft Application
4. Finalise & Optimise
```

Each phase:

```text
Goal
Estimated Timeline

Key Actions
Deliverables
Success Criteria
```

Deliverables with known tools receive CTAs:

```text
Open Personal Canvas
Open CV Builder
Open Statement Writer
```

Keep:

```text
Add to Planner
```

and existing Planner reconciliation.

---

# 55. Roadmap + Planner State

Optionally display current execution state beside a deliverable:

```text
Not started
In progress
Completed
```

But Planner progress must not influence the original Strategy diagnosis.

Execution state is not evidence that a recommendation was strategically correct.

---

# 56. Recommended Code Organization

Exact filenames are optional, but separate responsibilities.

Suggested:

```text
src/lib/ai/strategy-v3/
  context.ts
  domain.ts
  profile-diagnosis.ts
  activity-analysis.ts
  intervention-candidates.ts
  prioritisation.ts
  synthesis.ts
  validation.ts
  generation.ts
```

Avoid putting all Strategy V3 logic into the existing:

```text
strategy-recommendation.ts
```

---

# 57. Validation Rules

Programmatically enforce:

- no admission probability
- no unknown activity ID
- no duplicate activity analysis
- no missing requested activity analysis
- no unknown evidence ID
- no unknown requirement ID
- no unknown Matching metric ID
- no unknown target source ref
- hard requirement cannot be overridden by Strategy prose
- BUILD cannot describe an invented completed activity
- strong target relevance requires target provenance
- roadmap phase keys are canonical
- server owns persistent keys
- deadline-infeasible roadmap must be rejected or explicitly constrained
- existing evidence and future recommendations remain separate
- Strategy output cannot create new applicant facts

---

# 58. Expected AI Call Count

## Exact cache hit

```text
0 AI calls
```

## Fresh generation with N significant activities

Approximately:

```text
1 profile diagnosis
+
ceil(N / batchSize) activity-analysis calls
+
1 final synthesis
```

Example:

```text
N = 10
batchSize = 6
→ 4 AI calls total
```

Run independent activity batches concurrently where safe.

Persist actual successful call count.

---

# 59. Failure Semantics

If any required profile/activity analysis fails:

```text
do not persist partial Strategy V3
preserve previous complete report
return typed generation failure
```

Same for final synthesis failure.

Do not silently downgrade to a newly generated F7 report.

---

# 60. Compatibility

Reader/UI order:

```text
Strategy V3
→ existing Strategy V2/F8
→ historical F7
```

UI:

```text
V3 → new four-section UI
V2 → current StrategyReportV2View
F7 → current StrategyRecommendationReport
```

Do not rewrite historical rows.

---

# 61. Implementation Waves

## Wave 0 — Dependency Audit

Before editing:

- pin HEAD
- list Strategy readers/writers
- inspect DB columns/migrations
- identify exact Personal lineage
- identify exact Matching lineage
- identify Target Profile version access
- identify canonical activity/evidence reconstruction path

Do not implement until this map is clear.

---

## Wave 1 — Canonical Strategy Context

Implement:

```text
StrategyInputContext
exact upstream lineage
activity reconstruction from snapshot/source analysis
application/target/deadline context
```

Remove mutable global activity dependency from canonical Strategy generation.

---

## Wave 2 — Strategy Report V3 Domain

Add strict schemas for:

```text
Strategic Overview
Profile Development
Activity-Level Analysis
Narrative Strategy
Strategic Roadmap
metadata/provenance
```

Add V3-first historical reader fallback.

---

## Wave 3 — Profile + Activity Diagnosis

Implement:

```text
Academic / Experience / Differentiation / Evidence
Maintain / Develop / Consolidate / Build

Activity:
Relevance
Responsibility
Depth
Progression
Impact
Evidence
Reflection
Future Potential

Maintain / Develop / Consolidate / Reposition / Deprioritize
```

---

## Wave 4 — Deterministic Prioritisation

Implement:

```text
intervention candidates
five priority factors
formula/ranking
Top 3 selection
```

No final narrative generation in this layer.

---

## Wave 5 — Narrative + Roadmap Synthesis

Implement:

```text
Strategic Overview wording
Core Narrative causal chain
Supporting Themes
Narrative Tension
Narrative Options
four-phase Roadmap
```

All prose remains grounded in approved structured inputs.

---

## Wave 6 — Persistence / Cache

Fix:

```text
cache before AI config
exact hash cache only
V3 append-only persistence
fail-closed generation
reader fallback
metadata
```

---

## Wave 7 — UI

Build new V3 UI with exactly four top-level sections.

Reuse existing:

```text
Panel
Badge
Button
CheckList
override infrastructure
Planner handoff
tool links
```

Do not preserve the old information architecture where it conflicts with the product flow.

---

# 62. Required Tests

## Input / lineage

- exact Personal Report version used
- exact Matching V3 used
- exact source analysis / snapshot used
- mutable user activity changes cannot silently change Strategy without canonical lineage change
- exact Target Profile version used where available
- deadline context preserved
- selected scholarship context preserved
- cross-application isolation

## Cache

- exact cache happens before AI configuration
- cache hit = 0 AI calls
- Personal Report change invalidates
- Matching change invalidates
- Target Profile change invalidates
- deadline/application-context change invalidates
- prompt version change invalidates
- lineage-only stale cache is not accepted

## Profile Development

- four dimensions exist
- status enum exact
- missing evidence ≠ missing ability
- BUILD only when foundation is genuinely absent
- Consolidate can beat a new similar activity
- Academic diagnosis only includes relevant areas

## Activity Analysis

- every requested activity gets one result
- unknown activity rejected
- duplicate rejected
- ownership cannot be invented
- progression cannot be invented
- target relevance needs target refs
- classification enum exact
- Deprioritize does not label activity as poor quality

## Prioritisation

- all five factors exist
- deterministic ranking
- hard requirement urgency works
- infeasible action is demoted/capped
- top 3 are highest valid candidates
- no padding
- new activity does not automatically beat deepen/consolidate

## Narrative

- causal progression, not keyword summary
- themes only when supported
- exact gap taxonomy
- narrative options grounded
- no fixed-identity language
- no invented future direction
- no unsupported comparative rarity claim

## Roadmap

- exactly four canonical phases
- canonical order
- deadline feasibility enforced
- server-derived stable keys
- deliverable tool mapping correct
- Planner reconciliation preserves completed work

## UI

- exactly four V3 top-level sections
- Overview shows Strength → Challenge → Opportunity
- Top Priorities show Priority → Why → Suggested Direction
- five prioritisation factors visible
- Profile Development contains Academic / Experience / Differentiation / Evidence
- status badges render
- activity analysis visible
- causal Narrative flow visible
- Narrative Gap visible
- Narrative Options visible
- four Roadmap phases visible
- mobile layout works
- V2/F7 fallback still renders

---

# 63. Verification Commands

Discover actual test paths first.

Run the real equivalents of:

```bash
npm test -- src/lib/ai/strategy
npm test -- src/lib/ai/strategy-recommendation
npm test -- src/features/ai-strategy-dashboard/domain
npm test -- src/features/ai-strategy-dashboard/api
npm test -- src/features/ai-strategy-dashboard/ui/strategy-report
npm test -- src/app/api/applications/[id]/strategy/recommendation

npm run typecheck
npm run typecheck:strict
npm run lint
npm test
npm run build:ci
git diff --check
```

Never claim a test passed unless the command actually ran.

---

# 64. Definition of Done

A brand-new application with:

```text
current confirmed Personal Report
current Matching Report V3
current application/target context
no previous Strategy Report
```

must generate:

## Strategic Overview

```text
Current Position
Strategic Opportunity
Strategic Goal
Top 3 Priorities
Expected Outcome
```

## Profile Development Strategy

```text
Academic
Experience
Differentiation
Evidence

Maintain / Develop / Consolidate / Build

Activity-Level Analysis:
Relevance
Responsibility
Depth
Progression
Impact
Evidence
Reflection
Future Potential

Activity classifications:
Maintain
Develop
Consolidate
Reposition
Deprioritize
```

## Narrative Strategy

```text
Core Narrative Direction
Supporting Themes
Narrative Tension / Gap
2–3 Narrative Options when supported
```

## Strategic Roadmap

```text
Strengthen Foundation
Build Competitive Advantages
Craft Application
Finalise & Optimise
```

Every phase includes:

```text
Goal
Key Actions
Deliverables
Success Criteria
Estimated Timeline
```

And the entire report preserves upstream provenance.

---

# 65. Required Final Agent Report

At completion report:

1. HEAD reviewed
2. files changed
3. Strategy V3 contract
4. exact Strategy input lineage
5. removal of mutable raw activity dependency
6. Profile Development status implementation
7. activity-level analysis implementation
8. five-factor prioritisation implementation
9. Top 3 selection logic
10. Core Narrative causal-chain implementation
11. Narrative Gap taxonomy
12. Narrative Options implementation
13. four-phase Roadmap implementation
14. deadline feasibility handling
15. provenance/evidence refs
16. stable-key implementation
17. cache behaviour
18. actual AI call count
19. Planner compatibility
20. V2/F7 fallback behaviour
21. UI changes
22. tests actually run
23. exact pass/fail counts
24. remaining deviations from the Strategy source document

Do not finish with only:

```text
Strategy Report implemented.
```

Prove the full runtime path:

```text
Personal + Matching + Application Context
→ Profile / Activity Diagnosis
→ Deterministic Prioritisation
→ Narrative Strategy
→ Strategic Roadmap
→ Persistence
→ UI
→ Planner
```
