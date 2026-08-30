# Personal Report Post-Review Fix Plan

**Repository:** `VietGlowbal/MainSite`  
**Baseline reviewed:** `e18a6bd015a450d7aa6723f92270768de03a98cf`  
**Baseline commit:** `feat: enforce personal report narrative spec`

> Before implementation, fetch the latest `main`. If HEAD has advanced, review the diff first and apply this plan against the actual latest HEAD.

---

## 1. Objective

The latest Personal Report architecture already has a strong foundation:

- structured Q1–Q7 `ReflectionFinding`
- richer activity evidence extraction
- deterministic F1–F4 evaluation
- canonical Personal Canvas
- structured `narrativeDetails`
- two-batch narrative synthesis
- section-scoped evidence IDs
- word-length guards
- hypothesis guards
- prompt/cache versioning
- UI consumption of structured narrative

This plan does **not** redesign those parts.

The goal is to remove the remaining contract and semantic-boundary bugs so the runtime becomes:

```text
Confirmed Snapshot
→ Evidence Extraction
→ Cross-source Validation
→ Deterministic Evaluation
→ Canonical Personal Report / Canvas
→ Constrained Narrative Details
→ UI
```

### Critical invariant

> Applicant-facing AI narrative may improve wording, but must never alter the canonical structured Personal Report meaning consumed by Matching.

---

## 2. Priority Order

1. **P0** — eliminate duplicate/contradictory narrative output contract
2. **P0** — stop `narrativeDetails` overwriting canonical report semantics
3. **P0** — remove invalid semantic fallbacks between activity evidence fields
4. **P0/P1** — fix isolated vs corroborated reflection routing
5. **P1** — ground newly extracted factual activity evidence
6. **P1** — preserve that evidence in Evidence Bank
7. **P1** — fix Social Proof provenance
8. **P1** — make Key Takeaway evidence scopes independent
9. **P1** — render the full structured Key Takeaways in UI
10. **P1** — section-scope numeric grounding
11. **P1** — improve `ReflectionFinding` near-verbatim sanitization
12. **P2** — block report-mechanics prose and improve applicant-facing voice
13. **P2** — fix failure telemetry
14. Run focused + full validation

Do **not** start with cosmetic prompt edits.

---

# Phase 1 — Narrative Contract Cleanup

## Task 1. Make `narrativeDetails` the only V4 AI writing contract

### Current problem

The new narrative prompt asks for structured sections inside `narrativeDetails`, but runtime still requires legacy AI-authored output such as:

- `coreIdentity`
- `drivingForce`
- `signaturePattern`
- `emergingThemes`
- `personalPositioning`
- `proofOfMe`

at the same time.

This causes:

- duplicated output
- wasted tokens
- parser/prompt mismatch
- inconsistent semantics
- higher truncation risk
- unnecessary model work

Tests currently hide the problem because mocked responses manually include both output formats.

### Target behavior

```text
Deterministic report
        ↓
AI returns narrativeDetails only
        ↓
Validation
        ↓
UI
```

Canonical deterministic report fields stay intact.

### Required changes

- Do not require legacy narrative sections in V4 provider responses.
- Remove/bypass canonical-presence validation for V4 structured batches.
- Keep old stored-report readers for backward compatibility.
- Avoid generating the same semantic content twice.

### Acceptance criteria

- A provider response containing only requested `narrativeDetails` succeeds.
- No duplicate legacy prose is required.
- Old stored reports still render safely.
- AI output size is reduced.

---

## Task 2. Make `narrativeDetails` strictly additive

### Current problem

`applyNarrativeSynthesis()` currently overwrites canonical fields with long AI prose, for example:

```ts
coreIdentity.headline =
  narrativeDetails.coreIdentity.identityStatement
```

and:

```ts
personalPositioning.statement =
  narrativeDetails.profilePositioning.profileNarrative
```

and:

```ts
personalPositioning.whyThisFits =
  positioningOptions.map(...)
```

These fields are not semantically equivalent. Matching also reads these canonical fields.

### Required invariant

Narrative synthesis must not mutate deterministic semantic fields.

After synthesis, these remain unchanged:

- `coreIdentity`
- `drivingForce`
- `signaturePattern`
- `emergingThemes`
- `personalPositioning`
- `proofOfMe`
- `keyTakeaways`
- `canvasDetails`

Only presentation fields should change, primarily:

- `narrativeDetails`
- `snapshot` where snapshot is explicitly presentation-only

### Must not mutate

- `coreIdentity.headline`
- `coreIdentity.recurringRole`
- `coreIdentity.recurringBehaviours`
- `coreIdentity.valueOrientation`
- `drivingForce.repeatedMotivations`
- `drivingForce.isHypothesis`
- `personalPositioning.statement`
- `personalPositioning.whyThisFits`
- positioning booleans/status
- signature pattern maturity
- theme maturity
- capability scores
- confidence
- evidence strength
- availability

### Matching regression test

Test:

```text
deterministic Personal Report
→ buildApplicantMatchingContext()
→ apply narrative synthesis
→ buildApplicantMatchingContext()
```

The canonical Matching context must be semantically identical before and after narrative overlay.

---

# Phase 2 — Activity Evidence Semantics

## Task 3. Remove invalid cross-dimension fallbacks

### Current problem

The pipeline currently substitutes one semantic field for another:

```text
Context → Trigger
Domain Theme → Problem
Action → Ownership
Action → Method
```

These dimensions are not interchangeable.

### Required mapping

```ts
context: cmcaitf.context ?? null
trigger: roleTheme.trigger ?? null
problem: roleTheme.problem ?? null
motivation: cmcaitf.motivation ?? null
challenge: cmcaitf.challenge ?? null
action: cmcaitf.action ?? null
ownership: roleTheme.ownership ?? null
method: roleTheme.method ?? null
impact: cmcaitf.impact ?? null
transformation: cmcaitf.transformation ?? null
future: cmcaitf.future ?? null
role: roleTheme.role ?? null
domainTheme: roleTheme.domainTheme ?? null
```

Apply the same rule inside `synthesisInputFromReport()`.

Unsupported semantic dimension = `null`.

---

## Task 4. Ground `trigger`, `problem`, `ownership`, and `method`

These are factual evidence extractions and should receive post-model grounding.

### Required behavior

Run grounding against the exact source free text used during extraction.

Unsupported model output becomes `null`.

### Example test

Source:

> I joined a team that built a chatbot.

Model:

```text
ownership = Led development of the chatbot
```

Expected:

```text
ownership = null
```

Source:

> I designed the retrieval architecture and decided how responses were ranked.

A properly supported ownership/method finding may survive.

---

## Task 5. Persist the full activity evidence bundle in Evidence Bank

`NarrativeActivity` now contains:

- context
- trigger
- problem
- motivation
- challenge
- action
- ownership
- method
- impact
- transformation
- future
- role
- domainTheme
- candidateCapabilitySignals

Persist the full structured bundle as AI interpretation:

```ts
payload: {
  role,
  domainTheme,
  context,
  trigger,
  problem,
  motivation,
  challenge,
  action,
  ownership,
  method,
  impact,
  transformation,
  future,
  candidateCapabilitySignals
}
```

Preserve:

```text
origin = ai_extraction
sourceRefs = canonical activity/achievement IDs
```

This remains interpretation, not verified raw evidence.

---

# Phase 3 — Reflection Routing

## Task 6. Fix `isolated` vs `repeated` routing

Prefer a typed structure:

```ts
type NarrativeReflectionFinding = {
  finding: ReflectionFinding;
  status: 'isolated' | 'repeated';
};
```

Do not lose status when passing reflection findings to the writer.

### Core Identity rules

May establish identity from:

- repeated Q1
- repeated Q2
- repeated Q3
- recurring cross-activity patterns

Isolated Q1/Q2/Q3 may only appear as:

- self-reported
- emerging
- hypothesis

They cannot establish:

- defining trait
- value orientation
- identity conclusion

### Driving Force rules

Q1–Q3 may be used, but each finding must retain status.

Repeated signals can support recurring motivation.

Isolated signals remain self-reported/emerging.

### Q4

Capability self-report only. Q4 alone does not create a proven capability.

### Q5–Q7

Direction, growth, and environment only. Do not use them as generic motivation sources.

---

## Task 7. Improve near-verbatim sanitization

Sanitize recursively rather than dropping an entire Q finding when one nested field is too close to raw source text.

For scalar string:

```text
near-verbatim → null
```

For array:

```text
near-verbatim item → remove item
```

Keep all other valid fields.

Drop the whole finding only when no meaningful content remains.

---

# Phase 4 — Social Proof Provenance

## Task 8. Add provenance directly to `SocialProofMetric`

Extend:

```ts
type SocialProofMetric = {
  key: ...
  label: string;
  value: number;
  caption: string;
  evidenceIds: string[];
};
```

Optionally:

```ts
sourceActivityIds?: string[];
```

The function calculating:

- `teamMembersLed`
- `communityReach`
- `yearsOfCommitment`
- `quantifiedOutcomes`

already knows which Proof Card created the metric. Capture provenance there, not later.

---

# Phase 5 — Key Takeaways

## Task 9. Give each Key Takeaway its own evidence scope

Create independent allowed evidence sets.

### What Makes You Stand Out

Allowed from:

- Core Identity
- repeated Signature Pattern
- Personal Positioning
- relevant repeated themes

### Competitive Advantage

Allowed from:

- Proven Capabilities
- Social Proof
- Personal Positioning
- capability evidence

### Growth Opportunity

Allowed from:

- Growth Areas
- capability gaps
- Positioning gaps
- intended direction
- Q5/Q6/Q7 where relevant

A takeaway must cite only its own allowed evidence set.

---

## Task 10. Render the complete structured takeaway in UI

When `narrativeDetails.keyTakeaways` exists, use it as the applicant-facing copy.

### Stand Out

Render:

- insight
- evidencePattern
- whyItMatters

### Competitive Advantage

Render:

- advantageStatement
- supportingEvidence
- applicationRelevance

### Growth Opportunity

Render:

- growthArea
- currentGap
- recommendedDirection
- whyItMatters

Deterministic `scope`, `confidence`, and evidence count may remain as compact metadata.

Do not mix new AI narrative with old deterministic prose templates.

Legacy reports without `narrativeDetails` keep the fallback UI.

---

# Phase 6 — Narrative Validation

## Task 11. Make numeric grounding section-specific

Build allowed numeric values separately for:

- Snapshot
- Core Identity
- Capabilities
- Social Proof
- Positioning
- Stand Out
- Competitive Advantage
- Growth Opportunity

A number present elsewhere in the same batch must not authorize use in an unrelated section.

For Social Proof, numbers should primarily come from `canvasDetails.socialProof` plus exact supporting evidence.

---

## Task 12. Ban report-mechanics prose

Applicant-facing narrative should never explain internal report machinery.

Explicitly forbid:

- the report
- this report
- the system
- the framework
- evidence framework
- generation process
- confirmed snapshot
- verification methodology

when used to explain how the report works.

Bad:

> The report is grounded in seven evidence items.

Good:

> The current evidence is strongest around technical project work, while broader behavioural patterns are still emerging.

Evidence maturity controls certainty; it should not become default prose content.

---

## Task 13. Improve applicant-facing voice

Prefer `you / your` for V4 applicant-facing narrative.

Do not necessarily reject every sentence without second-person language, but flag/reject output dominated by:

- “The applicant...”
- “The candidate...”

where the product section is explicitly applicant-facing.

Continue rejecting first-person source voice.

---

## Task 14. Fix failure telemetry

Separate narrative validation failures.

Recommended codes:

```text
invalid_word_length
hypothesis_promotion
unsupported_narrative_fact
unsupported_narrative_voice
report_mechanics_prose
invalid_evidence_scope
```

Do not classify hypothesis promotion as word-length failure.

---

# Phase 7 — Narrative Batching

## Task 15. Preserve two calls, remove duplicate prose

Keep the useful concurrent two-batch architecture.

### Batch A

- snapshot
- coreIdentity
- drivingForce
- profilePositioning

### Batch B

- provenCapabilities
- socialProof
- keyTakeaways

Signature Pattern and Emerging Themes should remain deterministic support inputs unless there is a real UI requirement for separate AI narrative.

Do not force legacy duplicate objects for compatibility.

After reducing output size, reassess token limits.

---

# Phase 8 — Cache and Versioning

## Task 16. Review and bump semantic versions correctly

Review:

```text
PERSONAL_REPORT_EXTRACTION_VERSION
PERSONAL_REPORT_CONTRACT_VERSION
REPORT_PROMPT_VERSIONS.report_narrative_synthesis
REPORT_PROMPT_VERSIONS.narrative_activity_extraction
REPORT_PROMPT_VERSIONS.reflection_signal_extraction
```

Only bump versions whose semantic output changed.

Cache identity must continue including:

- snapshot
- inputHash
- engineVersion
- extractionVersion
- narrativePromptVersion
- reportContractVersion

Reusable stored analysis must be invalidated when extraction semantics change.

---

# Phase 9 — Matching Boundary

## Task 17. Prove Matching consumes canonical Personal Report only

Audit:

```text
src/lib/ai/matching/applicant-context.ts
```

Matching may consume canonical:

- Core Identity
- Driving Forces
- Signature Pattern
- Emerging Themes
- Proven Capabilities
- Social Proof
- Personal Positioning
- Direction Signals
- Evidence Bank

It must not accidentally treat these applicant-facing prose fields as canonical facts:

- `narrativeDetails.profileNarrative`
- AI Positioning Options
- AI Key Takeaways
- AI Identity Statement

Add a regression proving narrative generation cannot alter Matching's canonical semantic context.

---

# Phase 10 — Tests

## Contract tests

1. V4 response containing only `narrativeDetails` succeeds.
2. Duplicate legacy AI sections are not required.
3. Two concurrent batches merge correctly.
4. Missing required structured section fails cleanly.

## Additive semantics tests

5. Narrative application does not mutate canonical Core Identity.
6. Narrative application does not mutate canonical Positioning.
7. Narrative application does not mutate Driving Force.
8. Narrative application does not mutate capability scores/confidence.
9. Matching context is identical before/after narrative synthesis.

## Activity evidence tests

10. Action does not become ownership.
11. Action does not become method.
12. Domain Theme does not become problem.
13. Context does not become trigger.
14. Unsupported ownership becomes null.
15. Explicit grounded ownership survives.

## Reflection tests

16. Isolated Q1/Q2/Q3 cannot become corroborated.
17. Repeated Q1/Q2/Q3 can feed Core Identity.
18. Driving Force retains per-finding status.
19. Q4 remains self-reported capability evidence.
20. Q5/Q6/Q7 do not become motivation.
21. Near-verbatim one field does not delete the entire finding.

## Social Proof tests

22. `teamMembersLed` has exact evidence IDs.
23. `communityReach` has exact evidence IDs.
24. `yearsOfCommitment` has exact evidence IDs.
25. Missing numeric Social Proof is omitted, not zero.

## Key Takeaway tests

26. Stand Out cannot cite Growth-only evidence.
27. Competitive Advantage cannot cite Growth-only evidence.
28. Growth Opportunity cannot cite unrelated evidence.
29. V4 UI renders complete structured takeaways.
30. Legacy UI fallback still works.

## Narrative validation tests

31. A number from Capability cannot leak into Social Proof prose.
32. Invented number is rejected.
33. Hypothesis promotion is rejected with correct code.
34. First-person voice is rejected.
35. Report-mechanics prose is rejected/prevented.
36. Applicant-facing second-person output is accepted.

---

# Phase 11 — Manual Quality Fixtures

## Fixture A — Mature profile

Input:

```text
4+ activities
repeated behaviour
corroborated Q1–Q3
Q4 present
Q5–Q7 complete
quantified impact
multiple capabilities
```

Expected:

- rich identity
- 4–5 traits only if supported
- non-hypothesis Driving Force when justified
- 3–4 canonical capabilities
- meaningful capability combination
- grounded Social Proof
- coherent Positioning
- strategic Key Takeaways

## Fixture B — Emerging profile

Input:

```text
2 activities
one repeated signal
multiple isolated reflections
```

Expected:

- cautious language
- fewer traits
- hypothesis preserved
- capabilities not overstated

## Fixture C — Sparse profile

Input:

```text
1 activity
mostly isolated self-report
little verification
```

Expected:

- no generic praise
- no invented identity
- no invented capability
- null/unavailable sections where appropriate

---

# Files to Inspect

At minimum:

```text
src/lib/ai/personal-report-v2.ts
src/lib/ai/personal-report-narrative-synthesis.ts
src/lib/ai/personal-report-narrative-synthesis.test.ts

src/lib/ai/evaluation/narrative-activity-extraction.ts
src/lib/ai/evaluation/narrative-activity-extraction.test.ts

src/lib/ai/evaluation/reflection-signal-extraction.ts
src/lib/ai/evaluation/reflection-signal-extraction.test.ts

src/lib/ai/runtime/prompt-registry.ts

src/shared/evaluation/engine.ts
src/shared/evaluation/f4-narrative-identity.ts

src/shared/evidence/build-evidence-bank.ts

src/features/apply/domain/personal-report.ts
src/features/apply/domain/personal-canvas-details.ts

src/features/apply/api/personal-report-generation.ts

src/features/apply/ui/personal-report/applicant-snapshot.tsx
src/features/apply/ui/personal-report/core-identity.tsx
src/features/apply/ui/personal-report/driving-force.tsx
src/features/apply/ui/personal-report/personal-report-insights.tsx
src/features/apply/ui/personal-report/personal-report-snapshot-insights.tsx
src/features/apply/ui/personal-report/personal-positioning.tsx
src/features/apply/ui/personal-report/key-takeaways.tsx
src/features/apply/ui/personal-report/personal-report-print.tsx

src/lib/ai/matching/applicant-context.ts
```

Inspect actual repository paths before assuming they are unchanged.

---

# Verification Commands

Discover the actual focused tests first.

Run the closest real suites, including:

```bash
npm test -- src/lib/ai/personal-report-narrative-synthesis.test.ts
npm test -- src/lib/ai/evaluation/reflection-signal-extraction.test.ts
npm test -- src/lib/ai/evaluation/narrative-activity-extraction.test.ts
npm test -- src/shared/evaluation
npm test -- src/features/apply/domain
npm test -- src/features/apply/api/personal-report-generation.test.ts
npm test -- src/features/apply/ui/personal-report

npm run typecheck
npm run typecheck:strict
npm run lint
npm test
npm run build:ci
git diff --check
```

If an exact path does not exist:

1. locate the real test
2. run that suite
3. report the exact command used

Never claim a command passed if it was not executed.

If full Vitest still has failures, report:

```text
test name
file
failure
whether introduced by this patch
```

---

# Definition of Done

The work is complete only when all of these are true:

- V4 provider writes only structured narrative output.
- Narrative prose is additive and cannot mutate canonical Personal Report semantics.
- Matching canonical context is invariant to Personal Report narrative wording.
- Activity evidence dimensions are not cross-filled.
- Trigger/problem/ownership/method are grounded.
- Rich activity interpretation survives into Evidence Bank.
- Isolated Reflection signals stay isolated.
- Social Proof metrics carry exact provenance.
- Each Key Takeaway has its own evidence scope.
- UI renders structured V4 takeaways without mixing old machine-template prose.
- Numeric grounding is section-specific.
- Reflection near-verbatim sanitization is field-level.
- Report-mechanics prose is blocked.
- Cache/version invalidation remains correct.
- Focused tests, typecheck, lint, and build pass.
- Full test-suite status is reported truthfully.

---

# Final Implementation Report Required

When implementation is complete, report:

1. HEAD fixed
2. files changed
3. V4 narrative contract before vs after
4. whether duplicate legacy AI output was removed
5. proof `narrativeDetails` no longer mutates canonical Personal Report
6. proof Matching context is unchanged by narrative prose
7. final activity evidence dimensions
8. grounding rules for trigger/problem/ownership/method
9. Q1–Q7 isolated/repeated routing
10. Social Proof provenance contract
11. evidence scope for each Key Takeaway
12. final UI rendering behavior
13. numeric grounding behavior
14. prompt/cache versions changed
15. AI call count before/after
16. token budgets before/after
17. focused tests executed
18. full test result
19. typecheck/lint/build result
20. remaining deviations

Do not claim completion without proving:

> Applicant-facing AI narrative improves presentation only; canonical Personal Report semantics remain deterministic and stable for downstream Matching.
