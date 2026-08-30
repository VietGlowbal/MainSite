# GlowBal AI Implementation Plan

## 1. Objective

Implement the AI backend for the GlowBal application flow.

The UI is already completed. The primary focus is the AI reasoning, structured state, evidence grounding, orchestration, validation, and response generation.

The system must **not** be implemented as a collection of independent chatbots or giant prompts.

Core architecture:

```text
Raw User Data
    ↓
Structured Applicant State
    ↓
AI Analysis Modules
    ↓
Evidence / Provenance Validation
    ↓
State Update
    ↓
Contextual AI Response
```

The central principle is:

> LLM = reasoning engine  
> Applicant State = memory  
> Evidence Bank = source of truth  
> Context Builder = decides what AI sees  
> Structured Output = controls what AI returns  
> Validators = decide whether an AI result is acceptable

---

# 2. High-Level Architecture

```text
                    ┌────────────────────┐
                    │   USER / UI DATA   │
                    └─────────┬──────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────┐
│               AI ORCHESTRATION LAYER              │
│                                                   │
│  Input Validator                                  │
│       ↓                                           │
│  Context Builder                                  │
│       ↓                                           │
│  AI Module Router                                 │
│       ↓                                           │
│  LLM Structured Generation                       │
│       ↓                                           │
│  Evidence / Hallucination Validator               │
│       ↓                                           │
│  State Updater                                    │
└────────────────────────┬──────────────────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ APPLICANT STATE  │
                │                  │
                │ target_profile   │
                │ academic_profile │
                │ activities       │
                │ evidence_bank    │
                │ identity_signals │
                │ personal_report  │
                │ matching_report  │
                │ strategy         │
                │ tasks            │
                │ final_review     │
                └──────────────────┘
```

Do **not** implement this:

```text
User Input
→ Giant Prompt
→ Markdown Answer
```

Implement this instead:

```text
Raw Data
→ Structured State
→ Analysis
→ Validation
→ Save
→ Response Renderer
```

---

# 3. Core Applicant AI State

Create one shared state object representing everything the AI knows about the applicant.

Example TypeScript interface:

```ts
interface ApplicantAIState {
  applicantId: string;

  targetProfile?: TargetProfile;
  academicProfile?: AcademicProfile;

  activities: Activity[];
  evidenceBank: EvidenceItem[];

  identitySignals?: IdentitySignals;
  directionSignals?: DirectionSignals;

  personalReport?: PersonalReport;
  matchingReport?: MatchingReport;
  strategyReport?: StrategyReport;

  planner?: PlannerState;

  applicationDocuments?: ApplicationDocuments;

  finalReview?: FinalReview;
}
```

This state should be the AI system's single source of structured context.

Do not ask the model to reconstruct the applicant from raw conversation history on every request.

---

# 4. Evidence Layer

The evidence system is one of the most important parts of the architecture.

Always preserve the distinction between:

```text
User Input
→ Raw Evidence
→ AI Interpretation
→ Verified Evidence
```

Never let the model silently upgrade vague user statements into concrete achievements.

## Evidence schema

```ts
interface EvidenceItem {
  id: string;

  sourceType:
    | "activity"
    | "reflection"
    | "academic"
    | "document";

  sourceId: string;

  rawEvidence: string;

  interpretation: string[];

  claims: Claim[];

  confidence: number;

  verificationStatus:
    | "raw"
    | "inferred"
    | "verified"
    | "conflicting";

  missingInformation?: string[];
}
```

Example user input:

```text
I helped organize a charity event.
```

Invalid AI interpretation:

```text
Led a 20-person team and raised $10,000.
```

Correct structured result:

```json
{
  "rawEvidence": "I helped organize a charity event.",
  "interpretation": [
    "Participated in event organization"
  ],
  "claims": [
    {
      "claim": "Organizational experience",
      "support": "direct",
      "confidence": 0.85
    }
  ],
  "missingInformation": [
    "What was your role?",
    "How many participants were involved?",
    "What did you personally do?",
    "Was there a measurable outcome?"
  ]
}
```

---

# 5. Common AI Module Interface

Do not implement every module using unrelated logic.

Create a reusable AI module contract.

```ts
interface AIModule<I, O> {
  buildContext(
    state: ApplicantAIState
  ): Promise<AIContext>;

  validateInput(
    input: I
  ): ValidationResult;

  generate(
    input: I,
    context: AIContext
  ): Promise<O>;

  validateOutput(
    output: O,
    context: AIContext
  ): Promise<ValidationResult>;

  save(
    applicantId: string,
    output: O
  ): Promise<void>;
}
```

Every major AI feature should follow this structure.

---

# 6. Module 0 — Target Profile

## Input

```text
University
+ Programme URL
+ Optional Scholarship
```

## Processing

Extract:

- Programme requirements
- Curriculum
- Academic expectations
- Competencies
- Values
- Selection criteria
- Scholarship criteria
- Eligibility
- Application requirements
- Deadlines

## Important architecture rule

The Target Profile is an external reference point for downstream evaluation.

Create it once and reuse it.

Do **not** re-analyse the same university/programme from scratch in every downstream AI request.

## Recommended pipeline

```text
Programme URL
    ↓
Crawler / Page Extractor
    ↓
Cleaned Content
    ↓
LLM Structured Extraction
    ↓
TargetProfile
    ↓
Cache / Database
```

The LLM should not be responsible for raw web crawling.

## Output schema

```ts
interface TargetProfile {
  university: {
    name: string;
    values: string[];
  };

  programme: {
    name: string;
    description: string;
    curriculumThemes: string[];
  };

  academicRequirements: Requirement[];

  competencies: Competency[];

  selectionCriteria: Criterion[];

  scholarshipCriteria?: Criterion[];

  applicationRequirements: Requirement[];

  deadlines: Deadline[];

  sources: SourceReference[];
}
```

Cache by a stable programme identifier or URL hash.

Example:

```text
programme_url_hash
→ target_profile
```

---

# 7. Module 1A — Academic Analyzer

## Input

- Qualification type
- Curriculum
- GPA
- Grades
- Relevant subjects
- Test scores

## Objectives

The model should determine:

```text
What do we know?
What academic strengths are demonstrated?
What gaps exist?
Which programme requirements appear satisfied?
Which requirements appear unmet?
What information is missing?
```

The system must **not** produce admission probability predictions.

Example prohibited response:

```text
You have an 80% chance of admission.
```

## Output schema

```ts
interface AcademicProfile {
  strengths: AcademicSignal[];

  gaps: AcademicSignal[];

  relevantSubjects: SubjectSignal[];

  requirementAssessment: {
    requirementId: string;

    status:
      | "meets"
      | "possibly_meets"
      | "does_not_meet"
      | "insufficient_information";

    evidenceIds: string[];

    explanation: string;
  }[];
}
```

---

# 8. Module 1B — Experience Analyzer

This should be treated as a core reasoning module.

## Input

Required:

- Activity type
- Role
- Organisation
- Level
- Timeline
- Description

Optional reflection framework:

```text
Context
→ Motivation
→ Challenge
→ Action
→ Impact
→ Transformation
```

## AI processing

Extract:

- Context
- Motivation
- Challenges
- Actions
- Ownership
- Competencies
- Evidence
- Impact
- Learning
- Transformation
- Missing details

## Output schema

```ts
interface ActivityAnalysis {
  activityId: string;

  context?: string;
  motivation?: string;
  challenge?: string;

  actions: string[];

  ownership: string[];

  capabilities: CompetencySignal[];

  impact: ImpactEvidence[];

  transformation?: string[];

  evidenceIds: string[];

  completeness: {
    score: number;
    missingFields: string[];
  };

  followUpQuestions: string[];
}
```

---

# 9. Adaptive Follow-Up Engine

Do not rely only on static reflection questions.

The AI should inspect what is missing from the current evidence and ask the most useful next question.

Example:

```text
User:
I participated in a robotics competition.

Detected:
role = missing
action = missing
impact = missing
```

AI:

```text
What part of the robot were you personally responsible for?
```

After the user answers:

```text
Update Evidence
→ Recalculate Missing Fields
→ Ask Next Highest-Value Question
```

Simple rule-based version:

```ts
if (!activity.actionEvidence) {
  ask(actionQuestion);
} else if (!activity.ownershipEvidence) {
  ask(ownershipQuestion);
} else if (!activity.impactEvidence) {
  ask(impactQuestion);
} else if (!activity.learningEvidence) {
  ask(transformationQuestion);
} else {
  activity.complete = true;
}
```

The question generation itself can be performed by the LLM, but question priority should be partially controlled by deterministic logic.

---

# 10. Module 1C — Reflection Analyzer

Do not simply summarize reflection answers.

The AI should identify cross-answer patterns.

## Output schema

```ts
interface IdentitySignals {
  values: Signal[];

  motivations: Signal[];

  interests: Signal[];

  strengths: Signal[];

  preferences: Signal[];

  recurringThemes: Theme[];

  direction: {
    academicInterests: Signal[];

    careerThemes: Signal[];

    preferredEnvironment: Signal[];

    clarity:
      | "low"
      | "medium"
      | "high";
  };
}
```

Signal:

```ts
interface Signal {
  label: string;

  evidenceIds: string[];

  strength:
    | "weak"
    | "moderate"
    | "strong";

  confidence: number;

  reasoning: string;
}
```

A theme should only be labelled strong when supported by multiple independent pieces of evidence.

---

# 11. Module 2A — Personal Report Engine

## Input

```text
Academic Profile
+
Evidence Bank
+
Identity Signals
+
Direction Signals
```

## Processing

Find patterns across experiences and distinguish:

```text
Repeated Pattern
vs
Isolated Activity
```

The AI should identify:

- Core identity
- Driving forces
- Proven capabilities
- Social proof
- Areas for growth
- Competitive advantages
- Key takeaways
- Evidence strength

## Output schema

```ts
interface PersonalReport {
  snapshot: {
    summary: string;
  };

  canvas: {
    coreIdentity: Insight[];

    drivingForces: Insight[];

    provenCapabilities: Insight[];

    socialProof: Insight[];

    growthAreas: Insight[];
  };

  competitiveAdvantages: Insight[];

  keyTakeaways: Insight[];

  evidenceCoverage: {
    strongEvidence: string[];

    weakEvidence: string[];

    insufficientEvidence: string[];
  };
}
```

## Critical rule

Do not generate a polished applicant identity or personal brand when evidence is insufficient.

Prefer:

```text
Current evidence suggests X,
but there is insufficient evidence to establish Y.
```

over unsupported conclusions.

---

# 12. Module 2B — Matching Engine

Matching must be evidence-based.

Do not implement it as only a similarity score.

Core logic:

```text
Programme Criterion
        ↕
Applicant Evidence
```

## Fit signal schema

```ts
interface FitSignal {
  criterionId: string;

  applicantEvidenceIds: string[];

  alignment:
    | "strong"
    | "moderate"
    | "weak"
    | "missing";

  reasoning: string;

  opportunity?: string;
}
```

## Output schema

```ts
interface MatchingReport {
  strengths: FitSignal[];

  gaps: FitSignal[];

  programmeAlignment: FitSignal[];

  scholarshipAlignment?: FitSignal[];

  positioningOpportunities: PositioningOpportunity[];
}
```

The report must explain **why** the applicant is aligned or misaligned.

Recommended response structure:

```text
criterion
→ evidence
→ assessment
→ reasoning
→ gap
→ opportunity
```

If the UI displays a fit score, treat it only as a secondary visualization.

The reasoning and evidence mapping are the primary output.

---

# 13. Module 3 — Strategy Engine

Convert analysis into strategic action.

The strategy layer must be separated into:

## A. Profile Development Strategy

Question:

```text
What should the applicant develop or do?
```

Examples:

- Build stronger evidence for an important competency
- Strengthen academic preparation
- Pursue a relevant project
- Collect measurable impact
- Clarify career direction

## B. Narrative Strategy

Question:

```text
How should the applicant communicate and position what they already have?
```

Examples:

- Core narrative
- Supporting themes
- Evidence to emphasize
- Evidence to de-emphasize
- Narrative risks
- Story coherence

## Output schema

```ts
interface StrategyReport {
  priorities: StrategicPriority[];

  profileStrategy: {
    develop: StrategyItem[];

    strengthen: StrategyItem[];

    evidence: StrategyItem[];
  };

  narrativeStrategy: {
    coreNarrative: string;

    supportingThemes: string[];

    evidenceIds: string[];

    emphasize: string[];

    deEmphasize: string[];
  };

  roadmap: RoadmapItem[];
}
```

## Priority logic

Do not let the model decide priority entirely on its own.

Use a deterministic scoring layer where possible.

Example:

```text
priority_score =
    programmeImportance
  × gapSeverity
  × actionability
  × timeUrgency
```

LLM performs semantic evaluation.

Code performs scoring and ordering.

---

# 14. Module 4 — Planner AI

The UI is already built.

The AI backend only needs to convert strategy into executable tasks.

## Input

```text
Strategic Priorities
+
Roadmap
+
Target Deadlines
+
Application Requirements
+
Current Progress
+
User Availability
+
Preferences
```

## Output schema

```ts
interface PlannerTask {
  id: string;

  title: string;

  description: string;

  type:
    | "profile"
    | "research"
    | "writing"
    | "document"
    | "application";

  priority: number;

  deadline?: string;

  estimatedEffort?: number;

  dependencies: string[];

  evidenceGoal?: string;

  status:
    | "todo"
    | "doing"
    | "done";
}
```

Planner generation is mainly orchestration and prioritization rather than deep reasoning.

---

# 15. Module 5 — Workspace AI Assistant

Do not build multiple unrelated AI assistants.

Build one contextual assistant with workspace routing.

Supported workspace types:

```text
Writing
Planning
Comparison
Evidence
Recommendation
Requirement
Review
```

## Context routing example

```ts
switch (workspace) {
  case "essay":
    return [
      targetProfile,
      personalReport,
      strategyReport.narrativeStrategy,
      evidenceBank,
      essayDraft
    ];

  case "cv":
    return [
      evidenceBank,
      personalReport,
      targetProfile,
      cvDraft
    ];

  case "requirements":
    return [
      targetProfile,
      applicationProgress
    ];
}
```

Do not inject the entire applicant database into every prompt.

Only provide task-relevant context.

---

# 16. Workspace Assistant Modes

Implement at least three interaction modes.

## ASK

Example:

```text
What should I talk about in this essay?
```

AI returns strategic guidance based on the applicant's evidence and target programme.

## COACH

Example:

```text
Help me improve this paragraph.
```

Recommended response:

```text
Problem
→ Explanation
→ Suggested Direction
```

## REVIEW

Example:

```text
Review my essay.
```

Recommended output:

```text
Strength
Issue
Evidence
Recommendation
Severity
```

Optional future mode:

```text
GENERATE
```

If generation is implemented, all factual claims must remain grounded in the Evidence Bank.

---

# 17. Module 6 — Final Review Engine

Do not implement Final Review as one giant prompt.

Break it into specialized validators.

Recommended validators:

```text
ConsistencyValidator
EvidenceValidator
RequirementValidator
PositioningValidator
NarrativeValidator
AuthenticityValidator
ProgrammeAlignmentValidator
```

---

# 18. Consistency Validator

Extract claims from each application document.

Example:

```text
CV:
Led project for 3 years.

Essay:
I spent two years working on the project.
```

Output:

```text
Potential contradiction detected.
```

Validator should identify:

- Conflicting dates
- Conflicting durations
- Conflicting roles
- Conflicting organization names
- Conflicting achievements
- Conflicting academic facts

---

# 19. Evidence Validator

Pipeline:

```text
Document Claim
      ↓
Evidence Retrieval
      ↓
Evidence Comparison
      ↓
SUPPORTED
PARTIALLY_SUPPORTED
UNSUPPORTED
CONFLICTING
```

Every important claim in final application documents should ideally map to applicant-provided evidence.

---

# 20. Programme Alignment Validator

Build a coverage matrix.

Example:

```text
Target programme competencies:

Research       ✅
Leadership     ✅
Collaboration  ❌
```

The validator should identify important target competencies or criteria that are missing from the final application.

---

# 21. Narrative Validator

Check whether application documents communicate a coherent applicant identity.

Example problem:

```text
CV positions applicant primarily as a researcher.

Essay positions applicant entirely as an entrepreneur.

No evidence connects the two.
```

Return:

- Narrative conflict
- Severity
- Supporting evidence
- Recommended correction

---

# 22. Authenticity Validator

Check whether AI-generated or user-written claims are grounded in applicant evidence.

Flag:

- Unsupported achievements
- Unverified numerical impact
- Inflated ownership
- Fabricated leadership
- Fabricated awards
- Claims inconsistent with raw evidence

---

# 23. AI Response Contract

The LLM should **not** return arbitrary Markdown directly from core reasoning modules.

Use structured JSON output.

Example:

```json
{
  "answer": "...",
  "insights": [],
  "evidence_refs": [],
  "warnings": [],
  "missing_information": [],
  "follow_up_questions": [],
  "confidence": 0.86
}
```

Backend flow:

```text
LLM
↓
Schema Validation
↓
Evidence Validation
↓
State Update
↓
Response Renderer
↓
UI
```

---

# 24. Prompt Architecture

Do not use one mega system prompt.

Recommended structure:

```text
/prompts
    base.system.ts

    target-profile.prompt.ts

    academic-analysis.prompt.ts

    activity-analysis.prompt.ts

    reflection-analysis.prompt.ts

    personal-report.prompt.ts

    matching.prompt.ts

    strategy.prompt.ts

    workspace-assistant.prompt.ts

    final-review/
        consistency.prompt.ts
        evidence.prompt.ts
        requirements.prompt.ts
        positioning.prompt.ts
        narrative.prompt.ts
        authenticity.prompt.ts
```

---

# 25. Base System Prompt Rules

The common system prompt should contain invariant rules.

Recommended minimum:

```text
1. Never invent applicant facts.

2. Every applicant-specific conclusion must be grounded
   in provided evidence.

3. Clearly distinguish:
   - observed evidence
   - interpretation
   - inference
   - missing information

4. Do not make admission probability predictions.

5. When evidence is insufficient,
   explicitly state insufficient evidence.

6. Preserve applicant ownership.
   Advise and improve without fabricating experiences.
```

Module-specific prompts should contain only task-specific logic.

---

# 26. Context Builder

Implement a centralized context builder.

Example API:

```ts
buildAIContext({
  task,
  applicantId,
  workspace,
  documentId
});
```

The Context Builder should choose:

```text
Required Structured Context
+
Optional Structured Context
+
Retrieved Raw Evidence
+
Current User Input
```

Example for Matching:

```text
Target Profile
Academic Profile
Evidence Bank
Personal Report
```

Example for Strategy:

```text
Personal Report
Matching Report
```

Example for Essay Review:

```text
Essay Draft
Target Profile
Narrative Strategy
Relevant Evidence
Relevant Personal Report Insights
```

---

# 27. Storage Strategy

Do not use pure RAG for everything.

Use two layers.

## Structured State

Store in PostgreSQL or equivalent structured storage:

```text
Target Profile
Academic Profile
Identity Signals
Personal Report
Matching Report
Strategy
Requirements
Tasks
Metadata
```

## Evidence Retrieval

Use vector search or hybrid retrieval for long-form/raw material:

```text
Activity descriptions
Reflections
CV drafts
Essay drafts
SOP drafts
LoR drafts
Long programme content
```

Recommended AI context:

```text
Structured State
+
Retrieved Raw Evidence
→ LLM
```

This is more reliable than pure vector retrieval.

---

# 28. Provenance

Every AI insight should contain evidence provenance.

Example:

```ts
{
  insight: "Demonstrates sustained research interest",

  evidenceIds: [
    "activity_12",
    "reflection_4",
    "course_5"
  ],

  confidence: 0.91
}
```

Benefits:

1. UI can support a "Why?" interaction.
2. Final Review can verify generated claims.
3. AI conclusions can be audited.
4. Hallucinations are easier to detect.
5. Reports can differentiate strong evidence from weak inference.

---

# 29. Recommended Backend Flow

```text
TARGET
Programme URL
     ↓
Target Profile
     │
     ├─────────────────────────────┐
     │                             │
     ▼                             │
APPLICANT INPUT                    │
                                   │
Academic ───→ Academic Profile     │
                                   │
Activities ─→ Evidence Bank        │
                 ↑                 │
Reflection ─→ Identity Signals     │
                 │                 │
                 ▼                 │
           Personal Report         │
                 │                 │
                 ├─────────────────┘
                 ▼
           Matching Report
                 │
                 ▼
           Strategy Report
                 │
                 ▼
              Planner
                 │
                 ▼
        Workspace Assistant
                 │
                 ▼
         Application Docs
                 │
                 ▼
          Final Review
```

---

# 30. Implementation Milestones

Do not ask the coding agent to build everything in one pass.

Use the following milestones.

```text
M0
AI Infrastructure

M1
Target Profile

M2
Academic + Experience + Reflection Analysis

M3
Evidence Bank + Provenance

M4
Personal Report

M5
Matching + Strategy

M6
Workspace AI

M7
Final Review

M8
Evaluation + Guardrails
```

---

# 31. Milestone M0 — AI Infrastructure

## Tasks

- [ ] Define shared TypeScript schemas
- [ ] Define database models
- [ ] Create `ApplicantAIState`
- [ ] Create LLM client abstraction
- [ ] Support model configuration
- [ ] Implement structured-output generation
- [ ] Implement JSON/schema validation
- [ ] Implement retry logic
- [ ] Implement structured output repair
- [ ] Implement prompt registry
- [ ] Implement Context Builder
- [ ] Implement common AI module interface
- [ ] Implement AI logging
- [ ] Implement model latency/token metrics
- [ ] Implement AI error handling
- [ ] Implement feature flags for AI modules

## Acceptance Criteria

- Every LLM call goes through one shared abstraction.
- Every structured module validates the result before saving.
- Prompt definitions are separated from business logic.
- Context construction is centralized.
- Applicant state can be loaded by applicant ID.

---

# 32. Milestone M1 — Target Profile

## Tasks

- [ ] Implement programme URL ingestion
- [ ] Implement page extraction / crawler adapter
- [ ] Clean extracted programme content
- [ ] Define `TargetProfile` schema
- [ ] Implement Target Profile generation
- [ ] Extract programme requirements
- [ ] Extract competencies
- [ ] Extract programme values
- [ ] Extract academic requirements
- [ ] Extract scholarship criteria
- [ ] Extract deadlines
- [ ] Extract application requirements
- [ ] Attach source references
- [ ] Cache generated Target Profiles
- [ ] Prevent unnecessary re-analysis

## Acceptance Criteria

- Same programme URL does not require a full new AI analysis on every request.
- Every extracted criterion can be traced to source content.
- Missing information is explicitly represented as missing.

---

# 33. Milestone M2 — Academic / Experience / Reflection

## Tasks

### Academic

- [ ] Define `AcademicProfile`
- [ ] Implement academic normalization
- [ ] Implement academic strengths extraction
- [ ] Implement academic gaps extraction
- [ ] Implement programme requirement mapping
- [ ] Implement insufficient-information handling
- [ ] Prevent admission probability prediction

### Experience

- [ ] Define `ActivityAnalysis`
- [ ] Implement activity analyzer
- [ ] Implement Context extraction
- [ ] Implement Motivation extraction
- [ ] Implement Challenge extraction
- [ ] Implement Action extraction
- [ ] Implement Impact extraction
- [ ] Implement Transformation extraction
- [ ] Implement ownership extraction
- [ ] Implement capability extraction
- [ ] Implement missing-information detection

### Follow-Up

- [ ] Implement adaptive follow-up priority logic
- [ ] Generate contextual follow-up questions
- [ ] Update activity evidence after user answers
- [ ] Stop asking once evidence is sufficient

### Reflection

- [ ] Define `IdentitySignals`
- [ ] Implement value extraction
- [ ] Implement motivation extraction
- [ ] Implement interest extraction
- [ ] Implement preference extraction
- [ ] Implement recurring-theme detection
- [ ] Implement direction clarity analysis
- [ ] Attach evidence provenance

---

# 34. Milestone M3 — Evidence Bank

## Tasks

- [ ] Define `EvidenceItem`
- [ ] Define `Claim`
- [ ] Define provenance format
- [ ] Preserve raw user evidence
- [ ] Store AI interpretation separately
- [ ] Implement verification status
- [ ] Implement confidence values
- [ ] Implement evidence deduplication
- [ ] Implement evidence merge logic
- [ ] Implement evidence conflict detection
- [ ] Implement evidence retrieval
- [ ] Support evidence lookup by source
- [ ] Support evidence lookup by competency
- [ ] Support evidence lookup by programme criterion

## Acceptance Criteria

No AI-generated applicant claim can become a verified fact unless it can be traced to user evidence or another trusted source.

---

# 35. Milestone M4 — Personal Report

## Tasks

- [ ] Implement cross-evidence pattern detection
- [ ] Detect repeated vs isolated patterns
- [ ] Generate Applicant Snapshot
- [ ] Generate Core Identity insights
- [ ] Generate Driving Forces
- [ ] Generate Proven Capabilities
- [ ] Generate Social Proof
- [ ] Generate Growth Areas
- [ ] Generate Competitive Advantages
- [ ] Generate Key Takeaways
- [ ] Implement evidence coverage assessment
- [ ] Implement insufficient-evidence behavior

## Acceptance Criteria

Every important Personal Report insight must:

- contain evidence references;
- expose confidence or strength;
- avoid unsupported personality claims;
- distinguish repeated evidence from isolated examples.

---

# 36. Milestone M5 — Matching + Strategy

## Matching Tasks

- [ ] Build Programme Criterion ↔ Applicant Evidence mapping
- [ ] Implement alignment levels
- [ ] Implement reasoning for every alignment result
- [ ] Detect missing evidence
- [ ] Detect applicant strengths
- [ ] Detect applicant gaps
- [ ] Generate positioning opportunities
- [ ] Support scholarship matching

## Strategy Tasks

- [ ] Implement profile-development strategy
- [ ] Implement narrative strategy
- [ ] Generate strategic priorities
- [ ] Implement priority scoring
- [ ] Generate roadmap
- [ ] Link strategy items to matching gaps
- [ ] Link strategy items to evidence
- [ ] Distinguish develop vs strengthen vs reposition

## Acceptance Criteria

Every strategic recommendation should answer:

```text
Why does this matter?
What evidence/gap caused it?
What should the applicant do?
How important is it?
What target criterion does it affect?
```

---

# 37. Milestone M6 — Workspace AI

## Tasks

- [ ] Implement Workspace Router
- [ ] Implement workspace-specific Context Builder
- [ ] Implement ASK mode
- [ ] Implement COACH mode
- [ ] Implement REVIEW mode
- [ ] Ground responses in Applicant State
- [ ] Ground factual claims in Evidence Bank
- [ ] Retrieve only relevant context
- [ ] Support document-level context
- [ ] Support conversation context without using conversation as factual source of truth
- [ ] Return structured response metadata
- [ ] Expose evidence references to UI

## Acceptance Criteria

The assistant must produce materially different context depending on workspace.

Essay AI should not receive the same context bundle as Requirements AI.

---

# 38. Milestone M7 — Final Review

## Tasks

### Claim Extraction

- [ ] Extract claims from CV
- [ ] Extract claims from Essay
- [ ] Extract claims from SOP
- [ ] Extract claims from LoR
- [ ] Normalize dates, durations, roles, metrics, organization names

### Validators

- [ ] Consistency Validator
- [ ] Evidence Validator
- [ ] Requirement Validator
- [ ] Positioning Validator
- [ ] Narrative Validator
- [ ] Authenticity Validator
- [ ] Programme Alignment Validator

### Aggregation

- [ ] Aggregate issues
- [ ] Assign severity
- [ ] Deduplicate overlapping issues
- [ ] Rank fixes
- [ ] Generate submission checklist
- [ ] Generate final review report

## Acceptance Criteria

Every detected issue should provide:

```text
Issue Type
Severity
Affected Document
Affected Claim
Evidence
Reason
Recommended Fix
```

---

# 39. Milestone M8 — Evaluation Framework

Create an internal AI evaluation suite before production deployment.

Recommended initial dataset:

```text
50–100 synthetic applicant profiles
```

Include diverse cases:

- Strong applicant
- Weak applicant
- Incomplete profile
- Contradictory profile
- High-achievement profile
- Vague activities
- Missing measurable impact
- Strong academic / weak extracurricular
- Weak academic / strong extracurricular
- Programme misalignment
- Scholarship misalignment
- Unsupported application claims

## Core Evaluation Metrics

```text
Groundedness
Evidence Coverage
Hallucination Rate
Insight Quality
Gap Detection
Programme Alignment Reasoning
Follow-Up Question Quality
Consistency Detection
Strategy Actionability
Requirement Detection
Narrative Coherence
Unsupported Claim Detection
```

## Critical Tests

- [ ] AI refuses to infer unsupported impact
- [ ] AI distinguishes weak vs strong evidence
- [ ] AI identifies contradictory evidence
- [ ] AI avoids admission predictions
- [ ] AI avoids inventing applicant identity
- [ ] AI flags insufficient evidence
- [ ] AI maps recommendations to programme needs
- [ ] AI finds unsupported claims in final documents
- [ ] AI asks useful follow-up questions
- [ ] AI does not ask questions already answered
- [ ] AI does not overuse irrelevant context

---

# 40. Suggested Project Structure

```text
src/
├── ai/
│   ├── core/
│   │   ├── llm-client.ts
│   │   ├── structured-generation.ts
│   │   ├── context-builder.ts
│   │   ├── prompt-registry.ts
│   │   ├── ai-module.ts
│   │   └── errors.ts
│   │
│   ├── prompts/
│   │   ├── base.system.ts
│   │   ├── target-profile.prompt.ts
│   │   ├── academic-analysis.prompt.ts
│   │   ├── activity-analysis.prompt.ts
│   │   ├── reflection-analysis.prompt.ts
│   │   ├── personal-report.prompt.ts
│   │   ├── matching.prompt.ts
│   │   ├── strategy.prompt.ts
│   │   ├── workspace-assistant.prompt.ts
│   │   └── final-review/
│   │       ├── consistency.prompt.ts
│   │       ├── evidence.prompt.ts
│   │       ├── requirements.prompt.ts
│   │       ├── positioning.prompt.ts
│   │       ├── narrative.prompt.ts
│   │       └── authenticity.prompt.ts
│   │
│   ├── modules/
│   │   ├── target-profile/
│   │   ├── academic/
│   │   ├── experience/
│   │   ├── reflection/
│   │   ├── personal-report/
│   │   ├── matching/
│   │   ├── strategy/
│   │   ├── planner/
│   │   ├── workspace/
│   │   └── final-review/
│   │
│   ├── evidence/
│   │   ├── evidence-service.ts
│   │   ├── evidence-retriever.ts
│   │   ├── claim-validator.ts
│   │   └── provenance.ts
│   │
│   ├── schemas/
│   │   ├── applicant-state.schema.ts
│   │   ├── target-profile.schema.ts
│   │   ├── academic-profile.schema.ts
│   │   ├── activity.schema.ts
│   │   ├── evidence.schema.ts
│   │   ├── identity-signals.schema.ts
│   │   ├── personal-report.schema.ts
│   │   ├── matching-report.schema.ts
│   │   ├── strategy-report.schema.ts
│   │   └── final-review.schema.ts
│   │
│   └── evals/
│       ├── datasets/
│       ├── evaluators/
│       ├── fixtures/
│       └── run-evals.ts
│
├── services/
├── db/
├── api/
└── types/
```

---

# 41. Global AI Guardrails

Every module must follow these rules.

## Grounding

Never invent applicant facts.

## Evidence

Every applicant-specific conclusion should reference evidence where possible.

## Uncertainty

When evidence is insufficient, explicitly return:

```text
insufficient_information
```

or an equivalent structured state.

## Observation vs Inference

Separate:

```text
Observed
Interpreted
Inferred
Verified
```

## Admission Probability

Do not output admission probability without a separate explicitly approved prediction system.

## Applicant Ownership

Do not fabricate accomplishments to make an application stronger.

## Re-analysis

Do not repeatedly regenerate stable upstream state when cached structured data is available.

## Context Discipline

Do not send all applicant data to every LLM request.

## Structured Output

Core reasoning modules must use schema-constrained output.

## Validation

Never persist model output before validation succeeds.

---

# 42. Agent Execution Rules

The coding agent should follow these rules during implementation.

1. Complete milestones sequentially unless a dependency clearly allows parallel work.
2. Do not start downstream report modules before schemas and Evidence Bank are stable.
3. Do not encode major business logic only inside prompts.
4. Keep deterministic logic in code when practical.
5. Keep semantic interpretation in the LLM.
6. Validate every model-generated structured object.
7. Add tests for every schema and validator.
8. Avoid hardcoding one specific university or programme.
9. Keep model provider abstraction separate from module logic.
10. Add observability before production:
    - latency;
    - model;
    - token usage;
    - retry count;
    - validation failure;
    - evidence coverage.
11. Do not silently repair unsupported applicant claims.
12. Preserve raw source data before AI interpretation.
13. Make downstream outputs reproducible from stored state where practical.
14. Prefer explicit dependencies over hidden prompt context.

---

# 43. Recommended First Implementation Slice

Do not begin with the entire product.

Build one end-to-end vertical slice first:

```text
Target Profile
      ↓
Experience Input
      ↓
Evidence Bank
      ↓
Personal Report
      ↓
Matching
      ↓
Strategy
```

This slice validates the most important architecture:

```text
External Target
+
Applicant Evidence
→ Personal Understanding
→ Matching
→ Action
```

Only after this slice is stable should the agent expand heavily into Planner, Workspace AI, and Final Review.

---

# 44. Definition of Done

The AI backend can be considered architecturally complete when:

- [ ] Applicant State is persistent and structured
- [ ] Target Profile is generated and reusable
- [ ] Raw evidence is preserved
- [ ] AI interpretations are stored separately
- [ ] Evidence provenance works end-to-end
- [ ] Academic analysis works
- [ ] Experience analysis works
- [ ] Adaptive follow-ups work
- [ ] Reflection pattern detection works
- [ ] Personal Report works
- [ ] Matching explains alignment
- [ ] Strategy links recommendations to gaps
- [ ] Workspace AI receives contextual state
- [ ] Final Review validates documents against evidence
- [ ] Structured outputs are schema validated
- [ ] Hallucination guardrails are enforced
- [ ] Evaluation suite runs automatically
- [ ] AI traces can be inspected for debugging
- [ ] No core AI feature depends on uncontrolled giant prompts

---

# 45. Final Architecture Summary

The GlowBal AI layer should contain five conceptual layers:

```text
┌─────────────────────────────────────┐
│ 1. ORCHESTRATION                    │
│ Context / Routing / Prompt Selection│
├─────────────────────────────────────┤
│ 2. ANALYSIS MODULES                 │
│ Academic / Experience / Reflection  │
│ Personal / Matching / Strategy      │
├─────────────────────────────────────┤
│ 3. EVIDENCE LAYER                   │
│ Raw Evidence / Claims / Provenance  │
├─────────────────────────────────────┤
│ 4. GENERATIVE ASSISTANT             │
│ Ask / Coach / Review                │
├─────────────────────────────────────┤
│ 5. VALIDATION                       │
│ Evidence / Consistency / Requirement│
└─────────────────────────────────────┘
```

The system should be designed as an evidence-grounded reasoning pipeline, not a generic chatbot.

The quality of the product will primarily depend on:

1. Evidence quality
2. Context construction
3. Provenance
4. Structured reasoning
5. Validation
6. Evaluation quality

Model choice is important, but it should remain replaceable behind the common LLM client abstraction.
