# Strategy reports — build spec

Written 2026-08-20. Decisions confirmed by the owner on the same date.

Sources:

- `AI_Evaluation_Framework_Architecture___GlowBal.pdf` — the Matching Report
  and Strategy Report layouts. Authoritative for items 4 and 5.
- `UX_Flow___UI_2.pdf` — the Applicant Persona Analysis / Personal Canvas
  layout. Authoritative for item 3.
- The owner's framework document, for the F5 weights, the scoring formulas and
  the Final Feedback section.

Where this spec and the code disagree, this spec is the intent and the code is
the current state. Neither overrides the evidence contract in
`docs/ai-strategy-canonical-architecture.md`.

## Decisions in force

1. **Five scored dimensions**, not the four in the report mock. No schema
   change needed — `programmeFitSchema` in `src/features/apply/domain/ai-reports.ts`
   already has exactly the five F5 keys.
2. **Percentages stay**, including the headline match score. See "Keeping the
   percentage honest" below for how this coexists with the
   no-admission-probability rule.
3. **`strong_match` is added** as a fourth band.
4. **F7 is the LOR framework; the Strategy Report engine becomes F8.**
   ⚠️ Recorded from a reply of "same reply", read as accepting the
   recommendation. This one is worth a explicit yes or no before the rename
   lands, because it touches doc headings and identifiers in several places.
5. **The Execution Roadmap and the Planner task contract are designed in one
   pass**, not built now and rebuilt later.
6. **Final Check gets a proposed scope** — drafted below, no prior scope.

## Matching Report

Canonical route `/ai-strategy/[applicationId]/matching-report`, unchanged.

### F5 engine

`src/shared/evaluation/f5-programme-fit.ts` is interfaces-only today and
`buildProgrammeFitPlaceholder()` returns `not_available` for everything. Fill
it in against the existing types.

Weights, from the framework document:

| Dimension | Weight | Existing key |
|---|---|---|
| Academic competitiveness | 25% | `academicCompetitiveness` |
| Persona / programme alignment | 25% | `personaAlignment` |
| Career direction alignment | 20% | `careerDirection` |
| Financial feasibility | 15% | `financialFeasibility` |
| Application readiness | 15% | `applicationReadiness` |

`F5_score = 0.25·Academic + 0.25·Persona + 0.20·Career + 0.15·Financial + 0.15·Readiness`

Missing-metric rule, unchanged from the existing contract: drop the term and
its weight, renormalise the rest to sum to 1, and disclose the renormalisation
in `limitations`. Never substitute a default.

### Classification

Rule-based, never a weighted sum. Hard gates come first and override
everything:

```
IF any hard eligibility filter fails
   (required subjects, minimum qualification, language,
    citizenship, deadline passed)
   -> currently_ineligible

ELSE IF academicCompetitiveness is not assessed
   -> insufficient_data

ELSE by academic band against the programme's typical admitted range:
   clearly above the range      -> safety
   upper half of the range      -> strong_match
   lower half of the range      -> match
   below the range              -> reach
```

Persona, career and financial dimensions are reported alongside the band and
never move it. This is what "separate minimum entry requirements from
competitiveness" means in practice, and it is why readiness carries the lowest
scored weight — it is really a gate, not a graded metric.

Code changes for the new band: add `'strong_match'` to
`ProgrammeFitClassification` in `f5-programme-fit.ts` and to the
`classification` enum in `programmeFitSchema`, plus the label and tier-colour
maps in the UI. Existing rows keep their stored values, so this is additive.

### Keeping the percentage honest

The percentage stays. It needs two things to stay compatible with the evidence
contract.

**It is a match score, not a chance of admission.** It is computed from the
weighted rubric above and measures alignment between profile and programme.
Never label or describe it as likelihood, odds, chance or probability, and put
one line of copy under the headline number saying what it measures. The
contract forbids emitting an admission probability; it does not forbid scoring
fit, so this is fine as long as the wording never drifts.

**Dimension scores need finer granularity than they have.** `fitDimensionSchema.score`
is currently `z.number().int().min(1).max(5)`. Five integers can only ever
render as 20 / 40 / 60 / 80 / 100 percent, so the mock's 75%, 92%, 88% are not
reachable. Drop `.int()` and allow one decimal place. Percentage is then:

```
percent = round((score - 1) / 4 * 100)
```

This uses the full 0-100 range, so a genuine 1 out of 5 reads as 0% rather than
a misleadingly encouraging 20%. If you would rather a floor, `score / 5 * 100`
is the alternative and it is a one-line change — worth deciding once, now.

A dimension with `status: 'not_available'` renders as "not assessed" and shows
no percentage at all. It never renders as 0%.

`confidence` is already `z.number().int().min(0).max(100)`, so the confidence
percentage needs no change.

### Report sections

Six, in this order.

1. **Overall Match Summary.** Match score, application readiness and confidence
   as three figures, with the band beside the match score. Then a fit statement
   ("High / Moderate / Emerging level of alignment because…") and two to three
   strongest alignments in the form fit aspect → evidence → interpretation.
2. **Fit Breakdown & Why You Match.** Five rows, one per scored dimension, each
   with its percentage and a plain-language meaning. Then a per-dimension table:
   current assessment → supporting evidence → why this matters → admissions
   perspective. The mock names "Programme Fit" and "Values Fit" as separate
   rows; both map to `personaAlignment`. Splitting them into two scored
   dimensions would mean a sixth weight and a reweighting, so for now they are
   one row. Flagging in case that was intended as two.
3. **Hard Criteria Assessment.** Requirement → current status → assessment →
   potential risk → recommendation. Driven off `eligibility`, which already has
   the five gates typed.
4. **Gap & Risk Analysis.** Three critical gaps maximum, each gap → evidence →
   why it matters → impact level (five-star) → suggested direction. Then
   competitive gaps (not required, would raise competitiveness) and hidden
   risks (fragmentation, lack of focus).
5. **Admissions Perspective.** Four blocks: first impression, what strengthens
   your application, questions we still have, what we would like to see.
6. **Final Recommendation.** Overall conclusion → biggest strength and
   opportunity → transition into the Strategy Report.

F5 has no test file, alone among the frameworks. It needs one covering the
weighting, the renormalisation, each classification branch including the new
band, and the not-assessed paths.

## Strategy Report (F8)

Canonical route `/ai-strategy/[applicationId]/strategy-report`, unchanged.

Inputs are the structured `ProfileEvaluation` and `ProgrammeFitEvaluation`,
not `applicant_analyses`. Migrating off that legacy blob is a prerequisite, not
a follow-up.

1. **Strategic Overview.** Current position (current profile → key strength →
   biggest challenge) → strategic goal (primary objective → strategic
   positioning) → top three strategic priorities → expected outcome.
2. **Strategic Priority table.** Columns: priority, current situation, why it
   matters, recommended actions, expected impact, level of priority. **The mock
   marks this student-editable.** That makes it the first real consumer of the
   Planner task UI work, not a static table — it needs an editable-grid block
   type with persistence, and student edits must be stored separately from the
   generated values so a regenerate does not silently discard them.
3. **Profile Development Strategy.** Three sub-strategies. Academic and
   Experience both run current status → gap → strategic focus → expected
   outcome. Differentiation runs current competitive advantage → what makes you
   unique → how to amplify it → desired admissions perception.
4. **Narrative Strategy.** Core narrative (central story → supporting evidence
   → admissions value), three to five supporting themes each with rationale and
   evidence, then a consistency check: what supports the narrative, what feels
   disconnected, what to emphasise, what should play a supporting role.
5. **Execution Roadmap.** Four phases — strengthen foundation, build
   competitive advantages, craft application, finalise and optimise. Each phase
   carries goal, key actions, deliverables, success criteria and estimated
   timeline.

The roadmap section is marked unfinished in the source ("cái này e vẫn đang
ngâm cứu thêm ạ"). Per decision 5 it gets built once, which means the phase
shape and the Planner task contract are designed together:

- a phase becomes a Planner task category
- a key action becomes a task
- a deliverable maps to an existing tool where one exists (Personal Canvas, CV
  builder, statement writer) and to a genUI block where it does not
- success criteria become the task's completion condition rather than prose

This replaces the current `roadmap.prioritize` / `.avoid` path in
`generateRoadmapTasks`, which reconciles on (category, title). Keep that
reconciliation behaviour so regenerating updates in place instead of
duplicating.

## Personal Report additions

The UX Flow PDF matches the sections already built in
`src/features/apply/ui/personal-report/`. It adds four specifics that are not
in the current schema.

**Applicant Snapshot is 150-200 words with a defined shape**: overall identity
→ unique positioning → pattern seen across activities → potential, closing on a
single-sentence overall impression.

**Proven Capabilities carry a star rating**, split across soft, hard and meta
skills. Each capability needs name, tier, rating, why the engine concluded it,
and supporting evidence. This needs a schema addition. Apply the existing
discipline: no rating without evidence, and an unevidenced capability is
omitted or marked not rated rather than defaulted to three stars.

**Key Takeaways has three fixed named slots**, not a free list: What Makes You
Stand Out, Your Competitive Advantage, Your Growth Opportunity. Each is an
insight title, a one-sentence explanation, and why it matters for future
applications.

**Areas for Growth gets the structure it was missing.** Current gap → why it
matters → suggested direction. `docs/personal-canvas-report-ui.md` records this
section as "intentionally transitional until dedicated structured growth
recommendations are added to the report schema" — this is that schema. Worth
updating that note when it lands.

## Final Check — proposed scope

No prior scope existed. This is a proposal, drafted from the Final Feedback
section of the framework document. Treat it as a starting point to argue with.

Route: `/ai-strategy/[applicationId]/final-check`, currently `locked: true` in
`src/shared/lib/ai-strategy-route-model.ts` with no route directory.

Inputs: Personal Canvas, Matching Report, Strategy Report, the target
programme, and the student's actual application documents (CV, essay, LOR,
supporting materials).

1. **Overall Readiness.** Current application state → strength → critical
   concern → readiness percentage, closing on a single biggest takeaway. Same
   honesty rule as the match score: it measures completeness and internal
   consistency of the application, not chance of admission.
2. **Document-by-document review.** For each of CV, essay, LOR and other:
   purpose → evidence → strength → gap → strategic contribution, ending in a
   recommended action (keep / revise / strengthen / rewrite / add evidence)
   tiered as critical, strategic or polish.
3. **Narrative consistency audit.** Extract identity → motivation → values →
   capabilities → evidence → direction across every document, then report the
   core narrative, three to five narrative pillars, a document coverage map,
   five consistency checks (identity, motivation, evidence, factual,
   direction), and narrative balance — which theme dominates, which is
   important but thinly evidenced, which claims are unproven, which experiences
   are fragmented.

Proposed constraints:

- Gate on having at least a CV and an essay attached. Degrade gracefully with
  no LOR rather than blocking, and say which documents were absent.
- The review reads uploaded finals, so it needs the student to re-upload the
  version they are actually submitting. Reviewing a stale draft and calling it
  a final check is worse than not offering the feature.
- No submit-or-not advice, and no predicted outcome. Readiness plus specific
  actions only.
- Every finding cites the document and passage it came from, same evidence
  contract as everywhere else.

This is the piece that gives the CV and Essay merges somewhere to point, which
is the argument for scheduling it alongside them rather than last.
