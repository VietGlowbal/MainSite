# GlowBal Matching Engine — Implementation Plan

## 1. Objective

Implement the **Matching Engine / Matching Report** for GlowBal.

The purpose of this module is to evaluate how well an applicant's current profile aligns with a selected university programme and, when applicable, scholarship criteria.

The Matching Engine compares:

```text
Target Profile
+
Academic Profile
+
Evidence Bank
+
Personal Report

→ Programme Alignment
→ Strengths
→ Gaps
→ Positioning Opportunities
```

The system must **not** behave like a generic similarity scorer.

Core matching unit:

```text
Programme Criterion
        ↕
Applicant Evidence
```

Every conclusion should answer:

```text
What is the criterion?
What applicant evidence is relevant?
How strong is the alignment?
Why?
What is missing?
What should the applicant do or emphasize?
```

The Matching Report must explain **why the applicant is aligned or misaligned**, rather than simply outputting a score.

---

# 2. Scope

Included:

- Programme criterion normalization
- Academic requirement matching
- Competency matching
- Values / motivation matching
- Selection criteria matching
- Scholarship criteria matching
- Applicant evidence retrieval
- Evidence-to-criterion mapping
- Alignment classification
- Strength detection
- Gap detection
- Evidence coverage
- Positioning opportunities
- Confidence and provenance
- Optional UI score derivation
- Matching report generation
- Incremental recomputation
- Matching evaluation suite

Not included:

- Target Profile web scraping
- Academic Profile generation
- Evidence Bank extraction
- Personal Report generation
- Strategy Report generation
- Planner generation
- Final Review

---

# 3. Dependencies

Required upstream state:

```ts
interface MatchingDependencies {
  targetProfile: TargetProfile;
  academicProfile: AcademicProfile;
  evidenceBank: EvidenceItem[];
  personalReport: PersonalReport;
}
```

Optional context:

```ts
interface OptionalMatchingContext {
  identitySignals?: IdentitySignals;
  directionSignals?: DirectionSignals;
  scholarshipTarget?: ScholarshipTarget;
}
```

If required upstream data is missing, return a structured dependency error instead of asking the LLM to reconstruct it.

```json
{
  "status": "blocked",
  "missingDependencies": ["targetProfile"]
}
```

---

# 4. Core Design Principle

Matching should be implemented in three layers:

```text
LAYER 1
Deterministic criterion preparation

LAYER 2
Evidence retrieval + semantic reasoning

LAYER 3
Deterministic aggregation + report rendering
```

Do not place the entire algorithm inside one LLM prompt.

## Code should handle

- Criterion normalization
- Criterion IDs
- Evidence retrieval
- Filtering
- Weighting
- Coverage calculation
- Score aggregation
- Thresholds
- Sorting
- Deduplication
- Cache invalidation
- Schema validation

## LLM should handle

- Semantic interpretation
- Evidence relevance
- Alignment reasoning
- Missing evidence explanation
- Nuanced fit assessment
- Positioning opportunities
- Human-readable explanations

---

# 5. Matching Dimensions

Recommended initial dimensions:

```text
1. Academic Requirements
2. Academic Preparation
3. Programme Competencies
4. Selection Criteria
5. Programme Values
6. Motivation / Direction
7. Experience Relevance
8. Evidence Strength
9. Scholarship Criteria
```

Not every programme will contain all dimensions. Missing dimensions must stay missing; do not invent criteria.

---

# 6. Target Criterion Model

Normalize relevant Target Profile elements into one common criterion format.

```ts
type CriterionCategory =
  | "academic_requirement"
  | "academic_preparation"
  | "competency"
  | "selection_criterion"
  | "programme_value"
  | "motivation"
  | "experience"
  | "scholarship";

interface MatchingCriterion {
  id: string;
  category: CriterionCategory;
  label: string;
  description: string;

  importance:
    | "critical"
    | "high"
    | "medium"
    | "low";

  requirementType:
    | "hard"
    | "soft"
    | "preference"
    | "unknown";

  sourceRefs: string[];
  sourceText?: string;

  expectedSignals: string[];
  negativeSignals?: string[];

  metadata?: Record<string, unknown>;
}
```

---

# 7. Criterion Normalization

Create:

```ts
normalizeTargetProfile(
  targetProfile: TargetProfile
): MatchingCriterion[]
```

Responsibilities:

1. Convert heterogeneous Target Profile fields into standard criteria.
2. Preserve source provenance.
3. Assign stable IDs.
4. Avoid duplicate criteria.
5. Keep hard requirements separate from soft fit signals.
6. Keep scholarship criteria separate.
7. Do not invent importance if source data does not support it.

If importance is unknown:

```text
importance = medium
```

and store:

```ts
{
  importanceSource: "default"
}
```

---

# 8. Applicant Evidence Model

Normalize candidate evidence into:

```ts
interface MatchingEvidence {
  id: string;

  sourceType:
    | "academic"
    | "activity"
    | "reflection"
    | "personal_report";

  sourceId: string;

  rawEvidence?: string;
  interpretedSignal: string;

  evidenceStrength:
    | "strong"
    | "moderate"
    | "weak";

  verificationStatus:
    | "raw"
    | "inferred"
    | "verified"
    | "conflicting";

  confidence: number;

  tags: string[];
  competencies?: string[];
  academicSignals?: string[];
  values?: string[];
  directionSignals?: string[];
}
```

---

# 9. Evidence Retrieval

Do not send the entire Evidence Bank to the model for every criterion.

Implement:

```ts
retrieveEvidenceForCriterion({
  criterion,
  applicantState,
  topK
}): Promise<MatchingEvidence[]>
```

Use hybrid retrieval:

```text
Structured filtering
+
Semantic retrieval
```

Examples:

### Academic criterion
Prefer:
- Academic Profile
- Grades
- Test results
- Relevant subjects

### Leadership criterion
Prefer:
- Activities tagged leadership
- Ownership evidence
- Responsibility evidence
- Personal Report capability signals

### Programme values
Prefer:
- Reflection
- Motivations
- Relevant activities
- Repeated personal patterns

---

# 10. Retrieval Strategy

Recommended first implementation:

```text
Step 1
Criterion category filter

Step 2
Tag / competency matching

Step 3
Semantic similarity

Step 4
Evidence quality reranking

Step 5
Top-K evidence
```

Pseudo-code:

```ts
const candidates = filterEvidenceByCategory(
  criterion,
  applicantEvidence
);

const ranked = candidates.map((evidence) => ({
  evidence,
  score:
      semanticSimilarity(criterion, evidence) * 0.45
    + tagOverlap(criterion, evidence) * 0.20
    + evidenceQuality(evidence) * 0.25
    + verificationBonus(evidence) * 0.10
}));

return ranked
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);
```

Weights should be configurable.

---

# 11. Hard Requirement Matching

Hard requirements must be handled separately from semantic programme fit.

Examples:

```text
IELTS >= 7.0
Mathematics required
Minimum GPA requirement
Required qualification
Portfolio required
```

Use deterministic logic whenever possible.

```ts
type RequirementStatus =
  | "meets"
  | "possibly_meets"
  | "does_not_meet"
  | "insufficient_information"
  | "not_applicable";

interface HardRequirementMatch {
  criterionId: string;
  status: RequirementStatus;

  applicantValue?: string | number;
  requiredValue?: string | number;

  evidenceIds: string[];
  explanation: string;
}
```

The LLM may explain the result, but must not override deterministic numeric checks.

---

# 12. Semantic Criterion Matching

For non-hard criteria, call the Matching Reasoner.

```ts
interface CriterionMatchInput {
  criterion: MatchingCriterion;
  evidence: MatchingEvidence[];

  personalContext?: {
    coreIdentity?: string[];
    motivations?: string[];
    direction?: string[];
  };
}
```

Expected output:

```ts
interface CriterionMatchResult {
  criterionId: string;

  alignment:
    | "strong"
    | "moderate"
    | "weak"
    | "missing";

  evidenceIds: string[];
  directEvidenceIds: string[];
  supportingEvidenceIds: string[];

  reasoning: string;
  missingEvidence: string[];

  evidenceQuality:
    | "strong"
    | "mixed"
    | "weak"
    | "none";

  confidence: number;
  positioningOpportunity?: string;
}
```

---

# 13. Alignment Definitions

## Strong

Use when:

- Multiple relevant evidence items exist, or one highly specific strong item exists
- Applicant evidence directly demonstrates the criterion
- Evidence is verified or strongly grounded
- Little inference is required

## Moderate

Use when:

- Relevant evidence exists
- Criterion is partially demonstrated
- Evidence is less complete or less direct
- Some inference is required

## Weak

Use when:

- Only indirect evidence exists
- Evidence quality is low
- Evidence is vague
- Criterion is only partially demonstrated

## Missing

Use when:

- No meaningful evidence supports the criterion
- Retrieved evidence is irrelevant
- Existing evidence cannot reasonably support the criterion

Do not mark a criterion strong simply because the applicant sounds generally impressive.

---

# 14. Evidence Quality

Separate:

```text
Criterion Alignment
```

from:

```text
Evidence Quality
```

Example:

```json
{
  "alignment": "weak",
  "evidenceQuality": "weak",
  "reasoning": "The activity suggests leadership responsibility, but ownership, decisions and impact are not sufficiently documented."
}
```

---

# 15. Fit Signal Schema

```ts
interface FitSignal {
  criterionId: string;
  category: CriterionCategory;
  criterionLabel: string;

  applicantEvidenceIds: string[];

  alignment:
    | "strong"
    | "moderate"
    | "weak"
    | "missing";

  evidenceQuality:
    | "strong"
    | "mixed"
    | "weak"
    | "none";

  reasoning: string;
  missingEvidence: string[];

  confidence: number;
  opportunity?: string;
}
```

---

# 16. Matching Report Schema

```ts
interface MatchingReport {
  id: string;
  applicantId: string;
  targetProfileId: string;
  generatedAt: string;

  overall: {
    summary: string;
    strongestAlignment: string[];
    mostImportantGaps: string[];
    evidenceCoverage: number;
  };

  academicRequirements: HardRequirementMatch[];
  programmeAlignment: FitSignal[];

  strengths: MatchingStrength[];
  gaps: MatchingGap[];
  positioningOpportunities: PositioningOpportunity[];

  scholarshipAlignment?: {
    criteria: FitSignal[];
    strengths: MatchingStrength[];
    gaps: MatchingGap[];
  };

  metadata: {
    version: string;
    model: string;
    inputStateVersion: string;
  };
}
```

---

# 17. Strength Model

A headline strength should satisfy:

```text
High relevance
+
Strong evidence
+
Useful differentiation or programme alignment
```

```ts
interface MatchingStrength {
  id: string;
  title: string;
  description: string;

  criterionIds: string[];
  evidenceIds: string[];

  strength:
    | "high"
    | "medium";

  whyItMatters: string;
  positioningUse?: string;
}
```

---

# 18. Gap Model

```ts
type GapType =
  | "hard_requirement"
  | "missing_evidence"
  | "weak_evidence"
  | "capability_gap"
  | "academic_gap"
  | "direction_gap"
  | "positioning_gap";

interface MatchingGap {
  id: string;
  type: GapType;

  title: string;
  description: string;

  criterionIds: string[];
  currentEvidenceIds: string[];

  severity:
    | "critical"
    | "high"
    | "medium"
    | "low";

  fixability:
    | "high"
    | "medium"
    | "low";

  evidenceNeeded?: string[];
  whyItMatters: string;
}
```

Important distinctions:

```text
Missing evidence ≠ Capability gap
Weak evidence ≠ Missing capability
Positioning gap ≠ Profile-development gap
```

---

# 19. Positioning Opportunity Model

Positioning opportunity means:

```text
Applicant already has useful evidence
but it can be framed more effectively
against programme expectations.
```

Do not use positioning to hide real gaps.

```ts
interface PositioningOpportunity {
  id: string;
  title: string;

  criterionIds: string[];
  evidenceIds: string[];

  currentInterpretation: string;
  recommendedPositioning: string;
  rationale: string;

  confidence: number;
}
```

---

# 20. End-to-End Matching Pipeline

```text
1. Load Target Profile
       ↓
2. Normalize Matching Criteria
       ↓
3. Load Applicant Structured State
       ↓
4. Build Applicant Evidence Candidates
       ↓
5. Evaluate Hard Requirements
       ↓
6. Retrieve Evidence per Semantic Criterion
       ↓
7. LLM Criterion Reasoning
       ↓
8. Validate Evidence References
       ↓
9. Aggregate Fit Signals
       ↓
10. Detect Strengths
       ↓
11. Detect Gaps
       ↓
12. Generate Positioning Opportunities
       ↓
13. Calculate Evidence Coverage
       ↓
14. Optional UI Score Calculation
       ↓
15. Generate Matching Summary
       ↓
16. Persist Matching Report
```

---

# 21. Matching Service

```ts
class MatchingService {
  async generateMatchingReport(
    applicantId: string,
    targetProfileId: string
  ): Promise<MatchingReport>;

  async recomputeCriterion(
    applicantId: string,
    targetProfileId: string,
    criterionId: string
  ): Promise<FitSignal>;

  async getMatchingReport(
    applicantId: string,
    targetProfileId: string
  ): Promise<MatchingReport | null>;
}
```

---

# 22. Criterion Reasoner

```ts
class CriterionMatchingReasoner {
  async evaluate(
    input: CriterionMatchInput
  ): Promise<CriterionMatchResult>;
}
```

Responsibilities:

- Evaluate only one criterion or a small coherent batch
- Use only provided evidence
- Return structured JSON
- Cite evidence IDs
- Identify missing evidence
- Avoid applicant-wide conclusions outside criterion scope

---

# 23. Prompt Design

Recommended file:

```text
/prompts/matching/criterion-matching.prompt.ts
```

System rules:

```text
You evaluate applicant evidence against one programme criterion.

Rules:

1. Use only supplied applicant evidence.
2. Never invent applicant facts.
3. Do not reward generic impressiveness.
4. Evaluate the specific criterion only.
5. Distinguish direct evidence from indirect evidence.
6. Weak or vague evidence must not become strong alignment.
7. Missing evidence must be labelled missing.
8. Every applicant-specific statement must map to evidence IDs.
9. Do not make admission probability predictions.
10. Do not treat programme marketing language as a strict requirement unless represented as such in the criterion.
```

---

# 24. Criterion Prompt Example

Input:

```json
{
  "criterion": {
    "id": "criterion_leadership",
    "label": "Leadership",
    "description": "Evidence of initiative, responsibility and ability to influence others.",
    "importance": "high",
    "expectedSignals": [
      "initiative",
      "ownership",
      "responsibility",
      "decision making",
      "team influence"
    ]
  },
  "evidence": [
    {
      "id": "evidence_12",
      "rawEvidence": "I coordinated weekly meetings for a team project.",
      "interpretation": "Coordination responsibility",
      "verificationStatus": "raw"
    }
  ]
}
```

Expected result:

```json
{
  "criterionId": "criterion_leadership",
  "alignment": "moderate",
  "evidenceIds": ["evidence_12"],
  "directEvidenceIds": ["evidence_12"],
  "supportingEvidenceIds": [],
  "reasoning": "The applicant demonstrates coordination responsibility, which supports leadership alignment. However, current evidence does not yet show decision-making authority, initiative or measurable influence on the team.",
  "missingEvidence": [
    "Examples of decisions personally made",
    "Evidence of initiative",
    "Evidence of impact on team performance"
  ],
  "evidenceQuality": "mixed",
  "confidence": 0.82
}
```

---

# 25. Evidence Reference Validation

After LLM output:

```ts
validateEvidenceReferences(
  result,
  retrievedEvidence
)
```

Reject or repair if:

- Model references unknown evidence ID
- Model references evidence not provided in prompt
- Reasoning claims facts absent from evidence
- Strong alignment has no supporting evidence
- Missing alignment contains fabricated evidence

---

# 26. Hallucination Guardrails

Basic checks:

```text
Strong alignment
→ must have >= 1 strong direct evidence
  OR multiple moderate direct evidence items

Moderate alignment
→ must have at least one relevant evidence item

Weak alignment
→ can have indirect / incomplete evidence

Missing
→ should not contain supporting evidence claims
```

Keep these thresholds configurable.

---

# 27. Coverage Metric

Coverage should mean:

```text
How much of the programme's relevant criteria
currently have meaningful applicant evidence?
```

Example deterministic mapping:

```text
strong   = 1.00
moderate = 0.65
weak     = 0.25
missing  = 0.00
```

Weighted coverage:

```text
coverage =
Σ(criterionWeight × alignmentValue)
/
Σ(criterionWeight)
```

Example criterion weights:

```text
critical = 4
high     = 3
medium   = 2
low      = 1
```

This is not an admission probability.

---

# 28. Optional Overall Fit Score

If UI requires a percentage:

```text
Fit Score ≠ Admission Chance
```

```ts
interface FitScore {
  value: number;

  label:
    | "strong_current_alignment"
    | "moderate_current_alignment"
    | "limited_current_alignment";

  explanation: string;
}
```

Use deterministic derivation.

Do not let the LLM invent the numeric score.

---

# 29. Hard Requirement Overrides

A high semantic alignment score must not hide a failed mandatory requirement.

Example:

```text
Programme Fit: Strong

BUT

Mandatory IELTS requirement: Not Met
```

Critical eligibility issues should render before general strengths.

---

# 30. Strength Detection

Recommended candidate rule:

```text
criterion alignment == strong
AND criterion importance >= medium
AND evidence quality != weak
```

Then optionally synthesize related criteria into one strength theme.

---

# 31. Gap Detection

Rules:

```text
critical hard requirement failure
→ critical gap

high importance + missing alignment
→ high gap

high importance + weak alignment
→ high/medium gap

medium importance + missing
→ medium gap

strong underlying evidence but poor criterion connection
→ positioning gap
```

Gap severity should be mainly deterministic.

---

# 32. Gap Prioritization

Recommended:

```text
gap_priority =
    criterionImportance
  × alignmentDeficit
  × requirementCriticality
  × actionabilityModifier
```

Example values:

```text
criterionImportance:
critical = 4
high = 3
medium = 2
low = 1

alignmentDeficit:
missing = 1.0
weak = 0.7
moderate = 0.3
strong = 0
```

This output feeds Strategy later.

---

# 33. Scholarship Matching

Keep scholarship matching separate from programme matching.

```text
Programme Matching

Scholarship Matching
```

Possible scholarship dimensions:

- Academic excellence
- Leadership
- Community contribution
- Research promise
- Nationality / region eligibility
- Financial eligibility
- Required documents

Hard scholarship eligibility should be deterministic where possible.

---

# 34. Personal Report Usage

Personal Report can provide context but must not replace raw evidence.

Bad:

```text
Personal Report says the user is a leader.
Therefore leadership alignment = strong.
```

Correct:

```text
Personal Report suggests leadership as a repeated pattern.
Matching Engine resolves underlying evidence IDs.
Criterion alignment is based on evidence, not the label alone.
```

---

# 35. Academic Profile Usage

Academic requirements should prefer structured Academic Profile data.

Do not retrieve unrelated activities to compensate for a hard academic requirement.

---

# 36. Incremental Recompute

Do not regenerate the whole report after every small evidence update.

Example:

```text
new leadership activity
↓
recompute:
Leadership
Teamwork
Initiative
```

Not necessarily:

```text
English requirement
Mathematics requirement
Portfolio requirement
```

Recommended dependency index:

```ts
interface MatchingDependencyIndex {
  evidenceId: string;
  affectedCriterionIds: string[];
}
```

---

# 37. Matching Cache

Persist:

```text
Applicant State Version
Target Profile Version
Matching Engine Version
Prompt Version
Model Version
```

Conceptual cache key:

```text
applicant_state_version
+
target_profile_version
+
matching_engine_version
```

---

# 38. Stale Report Detection

Invalidate Matching when:

- Target Profile changes
- Academic Profile changes
- Evidence Bank changes materially
- Personal Report changes materially
- Matching algorithm version changes

Do not regenerate for irrelevant UI changes.

---

# 39. API Endpoints

Example:

```text
POST /api/matching/generate
GET  /api/matching/:targetProfileId
POST /api/matching/:targetProfileId/recompute
GET  /api/matching/:targetProfileId/criteria
GET  /api/matching/:targetProfileId/gaps
GET  /api/matching/:targetProfileId/strengths
```

---

# 40. Suggested Project Structure

```text
src/
└── ai/
    └── modules/
        └── matching/
            ├── matching.service.ts
            ├── matching.types.ts
            ├── criterion-normalizer.ts
            ├── criterion-retriever.ts
            ├── criterion-reasoner.ts
            ├── hard-requirement-matcher.ts
            ├── evidence-ranker.ts
            ├── fit-aggregator.ts
            ├── strength-detector.ts
            ├── gap-detector.ts
            ├── positioning-generator.ts
            ├── coverage-calculator.ts
            ├── fit-score.ts
            ├── matching-validator.ts
            ├── matching-cache.ts
            └── __tests__/
```

Prompts:

```text
src/ai/prompts/matching/
├── criterion-matching.prompt.ts
├── strength-synthesis.prompt.ts
├── positioning.prompt.ts
└── summary.prompt.ts
```

Schemas:

```text
src/ai/schemas/
├── matching-criterion.schema.ts
├── criterion-match.schema.ts
└── matching-report.schema.ts
```

---

# 41. LLM Call Strategy

Avoid one LLM call containing all programme criteria and all applicant evidence.

Recommended:

```text
Hard requirements
→ deterministic

Semantic criteria
→ small coherent batches
```

Example batches:

```text
Batch A:
Research
Analytical thinking
Technical preparation

Batch B:
Leadership
Teamwork
Initiative

Batch C:
Values
Motivation
Direction
```

Benefits:

- Lower hallucination risk
- Easier debugging
- Easier retries
- Better provenance
- Easier partial recompute

---

# 42. Model Context Contract

Every semantic matching call should contain only:

```text
Criterion(s)
Relevant Target Profile Source
Relevant Applicant Evidence
Minimal Personal Context
Matching Rules
Output Schema
```

Do not include:

- Entire application history
- All programme pages
- Unrelated planner tasks
- Full conversation history
- Unrelated drafts

---

# 43. Matching Summary Generation

Generate summary only after structured criterion evaluation is complete.

Input:

```text
Structured Fit Signals
Structured Strengths
Structured Gaps
Structured Positioning Opportunities
Hard Requirement Results
```

Summary prompt rule:

```text
You are summarizing an already-completed structured matching analysis.
Do not create new applicant claims.
Do not introduce programme criteria not present in the input.
```

---

# 44. UI-Oriented Report Sections

Recommended order:

```text
1. Current Alignment Snapshot
2. Critical Requirements
3. Strongest Alignment Areas
4. Important Gaps
5. Programme Criteria Breakdown
6. Positioning Opportunities
7. Scholarship Alignment
8. Evidence That Would Improve This Assessment
```

---

# 45. Explainability

Every displayed insight should support:

```text
Why?
```

Required provenance:

```text
FitSignal
→ Criterion
→ Target source

FitSignal
→ Evidence IDs
→ Applicant source
```

---

# 46. Empty / Incomplete Applicant Handling

Correct behavior:

```text
Programme strongly values research.

Applicant currently has no research evidence.

Alignment: Missing

Reason:
No current evidence demonstrates research capability.

Evidence needed:
Research project, investigation, research output,
or more detailed description of existing relevant work.
```

Do not infer capabilities from unrelated signals.

---

# 47. Conflicting Evidence

If evidence conflicts, do not choose the version that improves fit.

Mark conflict and reduce confidence.

```json
{
  "alignment": "weak",
  "evidenceQuality": "weak",
  "confidence": 0.43,
  "missingEvidence": [
    "Clarification of actual role and level of responsibility"
  ]
}
```

---

# 48. Confidence

Confidence should reflect:

- Evidence specificity
- Evidence consistency
- Evidence verification
- Criterion clarity
- Number of relevant evidence items

Alignment and confidence are different concepts.

Example:

```text
Alignment = Weak
Confidence = High
```

is valid when the system is highly confident evidence is missing.

---

# 49. Logging and Observability

Log:

```text
matching_report_id
applicant_id
target_profile_id
state_version
criteria_count
hard_requirement_count
semantic_criterion_count
llm_call_count
retrieved_evidence_count
validation_failures
retry_count
latency
token_usage
model
prompt_version
engine_version
```

Avoid logging sensitive raw applicant text unnecessarily.

---

# 50. Error Handling

```ts
type MatchingErrorCode =
  | "MISSING_TARGET_PROFILE"
  | "MISSING_APPLICANT_STATE"
  | "INVALID_CRITERION"
  | "LLM_GENERATION_FAILED"
  | "SCHEMA_VALIDATION_FAILED"
  | "INVALID_EVIDENCE_REFERENCE"
  | "MATCHING_VALIDATION_FAILED";
```

Retry only recoverable failures.

---

# 51. Unit Tests

## Criterion normalization
- [ ] Converts academic requirements
- [ ] Converts competencies
- [ ] Converts scholarship criteria
- [ ] Preserves source refs
- [ ] Deduplicates equivalent criteria
- [ ] Does not invent missing criteria

## Hard requirements
- [ ] Numeric threshold satisfied
- [ ] Numeric threshold failed
- [ ] Missing applicant value
- [ ] Required subject present
- [ ] Required subject absent

## Evidence ranking
- [ ] Relevant evidence ranks above irrelevant evidence
- [ ] Verified evidence receives quality bonus
- [ ] Weak semantic similarity does not dominate
- [ ] Category filtering works

## Aggregation
- [ ] Strong criterion contributes correctly
- [ ] Missing criterion contributes zero coverage
- [ ] Critical criterion receives larger weight
- [ ] Optional criteria do not dominate overall result

---

# 52. Integration Tests

## Case A — Strong match
Expected:
- Several strong alignments
- Few important gaps
- High evidence coverage

## Case B — Impressive but irrelevant applicant
Expected:
- Generic prestige does not inflate fit
- Irrelevant achievements remain irrelevant

## Case C — Vague evidence
Input:
```text
I led many projects.
```
Expected:
- Leadership is not automatically strong
- Evidence quality remains weak

## Case D — Missing mandatory requirement
Expected:
- Critical eligibility issue clearly surfaced

## Case E — Strong evidence but poor positioning
Expected:
- Positioning opportunity generated
- Not misclassified as capability gap

## Case F — Insufficient profile
Expected:
- Many missing alignments
- Low evidence coverage
- No invented strengths

---

# 53. Matching Evaluation Metrics

Track:

```text
Criterion Groundedness
Evidence Precision
Evidence Recall
Alignment Classification Accuracy
Gap Detection Accuracy
Strength Precision
Hard Requirement Accuracy
Positioning Opportunity Quality
Hallucination Rate
Evidence Reference Validity
Explanation Quality
Score Stability
Incremental Recompute Consistency
```

---

# 54. Critical Evaluation Tests

- [ ] No applicant fact invented
- [ ] No programme criterion invented
- [ ] Strong alignment always has real supporting evidence
- [ ] Missing evidence is correctly labelled
- [ ] Hard requirement failures are not hidden
- [ ] Generic impressive achievements do not inflate fit
- [ ] Personal Report labels are not treated as raw evidence
- [ ] Positioning gaps are distinguished from capability gaps
- [ ] Scholarship fit remains separate from programme fit
- [ ] Fit score is not described as admission probability
- [ ] Re-running unchanged state yields stable output
- [ ] Evidence IDs always exist
- [ ] Programme source refs always exist

---

# 55. Implementation Milestones

## MATCH-M0 — Schemas
- [ ] Define MatchingCriterion
- [ ] Define MatchingEvidence
- [ ] Define FitSignal
- [ ] Define HardRequirementMatch
- [ ] Define MatchingStrength
- [ ] Define MatchingGap
- [ ] Define PositioningOpportunity
- [ ] Define MatchingReport
- [ ] Add schema validation

## MATCH-M1 — Criterion Normalization
- [ ] Build Target Profile normalizer
- [ ] Assign criterion categories
- [ ] Preserve source references
- [ ] Deduplicate criteria
- [ ] Support programme + scholarship criteria
- [ ] Add tests

## MATCH-M2 — Applicant Evidence Preparation
- [ ] Normalize academic evidence
- [ ] Normalize Evidence Bank
- [ ] Resolve Personal Report provenance
- [ ] Build evidence tags
- [ ] Implement evidence retrieval
- [ ] Implement reranking
- [ ] Add retrieval tests

## MATCH-M3 — Hard Requirements
- [ ] Implement numeric requirement checks
- [ ] Implement categorical requirement checks
- [ ] Implement required subject checks
- [ ] Implement qualification checks
- [ ] Implement missing-data state
- [ ] Surface critical failures

## MATCH-M4 — Semantic Matching
- [ ] Build criterion matching prompt
- [ ] Implement CriterionMatchingReasoner
- [ ] Use structured output
- [ ] Implement alignment definitions
- [ ] Implement evidence quality classification
- [ ] Add missing-evidence generation
- [ ] Add confidence
- [ ] Validate evidence refs

## MATCH-M5 — Aggregation
- [ ] Aggregate FitSignals
- [ ] Calculate evidence coverage
- [ ] Implement criterion weighting
- [ ] Implement optional fit score
- [ ] Respect hard requirement overrides
- [ ] Add aggregation tests

## MATCH-M6 — Strengths / Gaps / Positioning
- [ ] Detect strength candidates
- [ ] Synthesize strength themes
- [ ] Detect gap candidates
- [ ] Classify gap types
- [ ] Calculate gap severity
- [ ] Calculate gap priority
- [ ] Generate positioning opportunities
- [ ] Validate all evidence refs

## MATCH-M7 — Matching Report
- [ ] Generate structured MatchingReport
- [ ] Generate final summary
- [ ] Prevent summary from introducing new claims
- [ ] Persist report
- [ ] Add report versioning
- [ ] Add stale detection
- [ ] Add incremental recomputation

## MATCH-M8 — API + UI Integration
- [ ] Create generate endpoint
- [ ] Create get report endpoint
- [ ] Create recompute endpoint
- [ ] Expose criteria
- [ ] Expose strengths
- [ ] Expose gaps
- [ ] Expose positioning opportunities
- [ ] Expose evidence provenance
- [ ] Add loading/error state contract

## MATCH-M9 — Evaluation
- [ ] Create synthetic matching dataset
- [ ] Create groundedness evaluator
- [ ] Create evidence reference evaluator
- [ ] Create alignment classification evaluator
- [ ] Create hard requirement evaluator
- [ ] Create gap evaluator
- [ ] Track hallucination rate
- [ ] Track score stability
- [ ] Add regression suite

---

# 56. Recommended First Vertical Slice

Implement this first:

```text
Target Profile Criteria
       ↓
Evidence Retrieval
       ↓
3–5 Semantic Criteria
       ↓
Criterion Match Results
       ↓
Strengths + Gaps
       ↓
Matching Report
```

Use one real programme fixture and one synthetic applicant fixture.

Do not implement every possible matching dimension before proving the core evidence-to-criterion pipeline.

---

# 57. Definition of Done

The Matching Engine is complete when:

- [ ] Target Profile criteria are normalized
- [ ] Every criterion has provenance
- [ ] Applicant evidence is retrieved selectively
- [ ] Hard requirements are evaluated deterministically
- [ ] Semantic criteria are evaluated with structured LLM output
- [ ] Strong/moderate/weak/missing definitions are enforced
- [ ] Evidence quality is separate from alignment
- [ ] Every FitSignal contains valid evidence references
- [ ] Missing evidence is explicitly represented
- [ ] Strengths are evidence-backed
- [ ] Gaps are classified by type
- [ ] Gap severity is deterministic where possible
- [ ] Positioning opportunities use existing evidence only
- [ ] Scholarship matching remains separate
- [ ] Evidence coverage is calculated
- [ ] Optional fit score is deterministic
- [ ] Fit score is never represented as admission probability
- [ ] Matching Report is persistent and versioned
- [ ] Incremental recomputation works
- [ ] Matching results are explainable in UI
- [ ] Regression/evaluation suite passes
- [ ] Hallucinated evidence references are rejected

---

# 58. Final Matching Architecture

```text
              TARGET PROFILE
                    │
                    ▼
          Criterion Normalizer
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
 Hard Requirements      Semantic Criteria
          │                   │
          ▼                   ▼
 Deterministic       Evidence Retrieval
 Evaluation                │
          │                 ▼
          │          LLM Criterion Reasoning
          │                 │
          │                 ▼
          │          Evidence Validation
          │                 │
          └─────────┬───────┘
                    ▼
                Fit Signals
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
      Strengths    Gaps   Positioning
          │         │         │
          └─────────┼─────────┘
                    ▼
            Fit Aggregation
                    │
                    ▼
            Matching Report
                    │
                    ▼
              Strategy Engine
```

---

# 59. Key Principle

The Matching Engine must answer:

```text
How does this applicant's actual evidence
map to what this specific programme values and requires?
```

It must **not** answer:

```text
Does this applicant generally look impressive?
```

All programme-specific conclusions must trace back to programme criteria.

All applicant-specific conclusions must trace back to applicant evidence.

That two-sided provenance is the foundation of the Matching Engine.
