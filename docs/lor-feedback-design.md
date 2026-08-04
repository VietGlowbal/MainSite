# LOR Strategy & Quality Review Design

Date: 2026-07-31
Status: Approved

## Understanding summary

- Keep the dedicated `/apply/[applicationId]/lor-feedback` page and turn it into one guided workspace for F7.1, F7.2, drafting, and F7.3.
- F7.1 captures who the recommender is, how and how long they know the applicant, and which saved experiences they directly observed.
- F7.2 recommends credible traits and experiences, warns against weakly supported topics, and produces a Recommendation Brief.
- The user writes or pastes the letter after completing the strategy steps; file upload and submission remain out of scope.
- F7.3 evaluates the letter against nine fixed quality dimensions and returns complete, actionable feedback.
- Use trusted application, programme, activity, and achievement data already stored in Supabase. Do not read a CV or browse external sorun durces.
- Preserve Essay Review's editor, inline suggestions, loading, quota, and autosave behavior wherever they still fit the LOR contract.

## Assumptions

- Only the authenticated owner may read or change an application's LOR strategy, draft, or review.
- The MVP stores one recommender strategy and one latest LOR draft per application.
- `student_activities` and `student_achievements` are the available structured reflection evidence. There is no separate persisted Applicant Identity Model, so the AI must not invent identity traits beyond stored evidence.
- Missing activities do not block the flow. The strategy explicitly reports limited evidence and lets the user continue.
- Missing programme context does not block a general review; programme-fit guidance is marked as limited.
- One AI request produces F7.1 and F7.2 together, and a second request performs F7.3 after a letter exists.
- The feature supports preparation and feedback; it does not verify recommender identity, send the brief, or submit a recommendation.
- Existing Essay Review behavior remains backward compatible.

## Final design

### User flow

The LOR page uses three stages:

1. **Recommender Strategy** — collect the four F7.1 answers and generate F7.1/F7.2.
2. **Letter Draft** — show the Recommendation Brief beside the existing LOR editor.
3. **Quality Review** — run F7.3 and render the complete review.

The visual direction is an editorial review desk: restrained application styling, a clear stage rail, evidence badges, and a nine-dimension score ledger. The existing application typography and tokens remain authoritative. The design feasibility and impact index is 13: strong context fit, feasibility, performance, and maintainability with enough visual distinction in the evidence and scoring views.

The workspace uses the same shared shell as the current Apply experience: `TopNav`, `MobileNav`, `Container`, `bg-surface`, semantic foreground and border colors, and the `gb-*` typography, spacing, and radius scales. The stage rail is the distinguishing anchor. No new visual dependency, data request, animation system, or LOR behavior is introduced by the theme alignment.

### F7.1 — Recommender–Evidence Matching

Collect:

- recommender type: subject teacher, homeroom teacher, school counselor, research supervisor, club advisor, internship supervisor, employer, volunteer supervisor, coach, academic mentor, or other;
- a free-text relationship description;
- relationship duration: less than 6 months, 6–12 months, 1–2 years, or more than 2 years;
- optional observed experiences selected from the owner's `student_activities` and `student_achievements` rows.

The output contains a relationship summary, `strongInsights`, and `limitedInsights`. Every insight must be traceable to the relationship or a selected evidence row. Unselected experiences are not evidence that the recommender observed them.

### F7.2 — Recommended Traits & Experiences

The same strategy request ranks possible topics using relevance to the programme, observation likelihood, evidence strength, distinctiveness, and complementarity.

Each recommended topic contains the trait, rationale, selected evidence reference, a natural way to raise it with the recommender, priority, and confidence. The response also identifies topics not to prioritize and why. A generated Recommendation Brief uses conditional language, preserves the recommender's independence, and never asks them to claim an unobserved fact.

### F7.3 — Complete LOR Quality Review

The review returns exactly these dimensions:

| Dimension                 | Maximum |
| ------------------------- | ------: |
| Recommender Context       |       5 |
| Specific Evidence         |      10 |
| Quality Depth             |      10 |
| Recommender Voice         |      10 |
| Evidence Credibility      |      10 |
| Applicant Differentiation |      10 |
| Growth & Potential        |      10 |
| Complementarity           |      10 |
| Recommendation Strength   |       5 |

The server validates all nine scores, sums the raw score out of 85, and computes `Math.round(rawScore * 100 / 85)`. It derives the recommendation label deterministically: 80–100 `Strong and credible`, 65–79 `Credible but needs strengthening`, 45–64 `Limited or uneven`, and 0–44 `Weak or generic`.

The complete response includes the normalized score, recommendation label, summary, dimension rationales, What Works Well, What Could Be Stronger with safe suggestions, Profile Coverage, inline suggestions, and a checklist. Exact quotes must come from the submitted letter. Missing evidence produces a question or clearly marked placeholder, never a fabricated claim.

### Architecture and persistence

Add `application_lor_strategies` with one owner-scoped row per application. It stores the four recommender inputs, selected evidence references, F7.1 perspective, F7.2 recommendations, Recommendation Brief, and timestamps. Row-level security checks both `user_id` and application ownership.

Add `/api/ai/lor-strategy`. It authenticates the user, verifies application ownership, reloads selected activity and achievement IDs under the same user, loads bounded programme context, validates the AI response, and saves the strategy.

Keep `/api/ai/analyze-statement` as the existing LOR review entry point. Its LOR branch loads the saved strategy and selected evidence server-side, then returns a validated LOR-specific extension of `AIAnalysis`. The statement branch is unchanged. Draft content and the latest F7.3 result continue to live in `personal_statements` with `doc_type = 'recommendation_letter'`.

### Security, reliability, and scale

- Treat all free text and stored content as untrusted data, never instructions.
- Never accept evidence text, programme facts, or total scores from the client.
- Bound relationship text, evidence count, programme context, strategy output, and letter length.
- Return `401` for unauthenticated requests, `404` for inaccessible applications, `400` for invalid input or evidence IDs, `402` for exhausted review allowance, and `502` for invalid AI output.
- Preserve editor text when strategy generation, review, or autosave fails and expose a retry action.
- One strategy and one review request per explicit user action are sufficient for expected individual-application scale.

### Verification

Use test-driven development:

- schema and deterministic score-normalization tests;
- F7.1/F7.2 API authentication, ownership, evidence scoping, prompt-boundary, invalid-response, and persistence tests;
- F7.3 tests for all nine dimensions, recommendation thresholds, saved-strategy context, missing-strategy fallback, and CV/profile exclusion;
- workspace tests for activity selection, restored state, step transitions, Recommendation Brief, dimension ledger, feedback sections, and retry states;
- regression tests for Essay Review, statement draft isolation, LOR task routing, typecheck, lint, full unit suite, and production build.

## Decision log

| Decision                                                                    | Alternatives                                                                            | Reason                                                                                     |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| One three-stage LOR workspace                                               | Separate pages; a mode selector inside Essay Review                                     | Keeps the flow understandable without duplicating navigation or the editor                 |
| One`application_lor_strategies` row per application                       | Store strategy inside`personal_statements.ai_analysis`; fully normalized child tables | Prevents strategy/review overwrite with the smallest durable schema                        |
| Generate F7.1 and F7.2 in one request                                       | One call per phase; deterministic templates only                                        | Both phases use the same trusted context and can share validation and persistence          |
| Dedicated F7.1/F7.2 API, existing F7.3 API branch                           | One generic LOR endpoint; three endpoints                                               | Separates preparation from review while retaining the working review path                  |
| Reload selected evidence server-side                                        | Trust evidence content from the browser                                                 | Prevents cross-user access and prompt manipulation                                         |
| Use reflection evidence but never CV data                                   | CV/profile context; programme-only context                                              | F7.1/F7.2 need observed experiences, while the stated LOR scope excludes CV-derived claims |
| Validate nine raw dimension scores and derive totals server-side            | Trust the model's total                                                                 | Makes the 85-point rubric and`/100` score internally consistent                          |
| Preserve Essay Review primitives and add an LOR result extension            | Force LOR into the old generic shape; build a new editor                                | Reuses proven interactions without discarding F7.3 detail                                  |
| Apply shared website chrome and design tokens across the dedicated LOR page | Recolor the existing fullscreen layout; embed LOR inside the application workspace      | Matches the current Apply experience without changing the LOR architecture or state flow   |
