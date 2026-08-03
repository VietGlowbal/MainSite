# LOR Strategy & Quality Review Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use test-driven-development and execute this plan task-by-task in the current feature branch.

**Goal:** Deliver the approved F7.1 recommender matching, F7.2 trait/brief generation, and F7.3 nine-dimension quality review in the existing LOR workspace.

**Architecture:** Add one shared LOR contract module, one owner-scoped Supabase strategy table, and one strategy route. Keep the existing LOR draft path and extend its review response without changing generic Essay Review behavior. Load only programme data and user-selected reflection evidence server-side.

**Tech Stack:** Next.js App Router 16, React 19, TypeScript, Zod, Supabase/Postgres RLS, Vitest, Testing Library, DeepSeek JSON responses.

---

### Task 1: Lock the LOR contracts and deterministic scoring

**Files:**
- Create: `src/lib/ai/lor.ts`
- Create: `src/lib/ai/lor.test.ts`

**Step 1: Write failing tests**

Cover the exact nine dimension IDs and maxima, raw score calculation, `/100` normalization, all recommendation thresholds, duplicate/missing dimension rejection, and the F7.1/F7.2 input/output schemas.

```ts
expect(finalizeLorReview(validModelReview).score).toBe(84);
expect(() => finalizeLorReview(reviewWithDuplicateDimension)).toThrow();
```

**Step 2: Verify RED**

Run: `npm.cmd test -- src/lib/ai/lor.test.ts`

Expected: FAIL because `@/lib/ai/lor` does not exist.

**Step 3: Implement the minimum contract**

Export Zod schemas and inferred types for recommender inputs, evidence references, F7.1/F7.2 output, and the F7.3 model response. Implement `finalizeLorReview()` so the server, not the model, supplies the dimension maxima, raw total, normalized score, recommendation label, and checklist.

**Step 4: Verify GREEN**

Run the focused test and typecheck.

---

### Task 2: Add owner-scoped Supabase persistence

**Files:**
- Create: `supabase-lor-strategy.sql`
- Test: `src/__tests__/lor-strategy-schema.test.ts`

**Step 1: Write a failing migration contract test**

Assert the SQL creates `application_lor_strategies`, enforces one row per application, enables RLS, scopes all CRUD policies to `authenticated` users with `auth.uid() = user_id`, includes `USING` and `WITH CHECK` for updates, indexes ownership columns, and explicitly grants Data API access to `authenticated` and `service_role`.

**Step 2: Verify RED**

Run: `npm.cmd test -- src/__tests__/lor-strategy-schema.test.ts`

Expected: FAIL because the migration is absent.

**Step 3: Write the idempotent SQL**

Store recommender inputs, selected evidence JSON, perspective JSON, recommendations JSON, excluded topics JSON, recommendation brief, and timestamps. Reference `course_applications` and `auth.users`; do not add views or privileged functions.

**Step 4: Verify GREEN**

Run the focused test. A live migration check is required at deployment because this repository has no Supabase CLI project or connected Supabase MCP.

---

### Task 3: Implement F7.1/F7.2 strategy generation

**Files:**
- Create: `src/app/api/ai/lor-strategy/route.ts`
- Create: `src/app/api/ai/lor-strategy/route.test.ts`

**Step 1: Write failing route tests**

Cover `401`, malformed input `400`, inaccessible application `404`, selected evidence IDs that do not belong to the user `400`, trusted programme/evidence prompt construction, no CV/profile query, invalid AI response `502`, successful upsert, and safe response minimization.

**Step 2: Verify RED**

Run: `npm.cmd test -- src/app/api/ai/lor-strategy/route.test.ts`

Expected: FAIL because the route is absent.

**Step 3: Implement the POST handler**

Validate with `LorStrategyInputSchema`, re-authorize with `fetchApplicationWorkspace`, reload selected rows from `student_activities` and `student_achievements` using both `user_id` and requested IDs, call DeepSeek once, validate with `LorStrategySchema`, and upsert one strategy row on `application_id`.

**Step 4: Verify GREEN**

Run focused tests, route lint, and typecheck.

---

### Task 4: Upgrade F7.3 to the complete quality framework

**Files:**
- Modify: `src/app/api/ai/analyze-statement/route.ts`
- Modify: `src/app/api/ai/analyze-statement/route.test.ts`
- Modify: `src/lib/types.ts`

**Step 1: Add failing LOR review tests**

Require all nine dimensions, saved recommender strategy and selected evidence in the prompt, deterministic normalized score and label, missing-strategy fallback, exact-quote safety, and continued exclusion of uploaded CV/profile fields. Keep generic statement tests unchanged.

**Step 2: Verify RED**

Run: `npm.cmd test -- src/app/api/ai/analyze-statement/route.test.ts`

Expected: FAIL because the endpoint still returns the generic four-field response.

**Step 3: Implement the LOR branch**

Load the saved strategy after application ownership is established, validate selected evidence again, ask the model for dimension scores and detailed sections, call `finalizeLorReview()`, and return the extended `LorReview`. Parse generic statement responses with the existing schema.

**Step 4: Verify GREEN**

Run the route tests and all existing statement tests.

---

### Task 5: Build the three-stage LOR workspace

**Files:**
- Create: `src/components/statement/LorStrategyWorkspace.tsx`
- Create: `src/components/statement/LorStrategyWorkspace.test.tsx`
- Modify: `src/components/statement/StatementFeedbackWorkspace.tsx`
- Modify: `src/components/statement/StatementFeedbackWorkspace.test.tsx`
- Modify: `src/components/statement/StatementWriter.tsx`
- Modify: `src/components/statement/StatementWriter.test.tsx`

**Step 1: Write failing UI tests**

Cover the four F7.1 fields, activity/achievement selection, restored saved strategy, generation request, F7.1 perspective, F7.2 ranked recommendations, excluded topics, Recommendation Brief, stage transitions, and review-start synchronization.

**Step 2: Verify RED**

Run the three focused component test files.

**Step 3: Implement the minimum UI**

Add an editorial stage rail in LOR mode. Use a focused client component for strategy state and keep `StatementWriter` as the letter editor/reviewer. Add only the callback/control props needed to move from draft to quality review. Generic statement mode must render exactly as before.

**Step 4: Verify GREEN**

Run focused UI tests plus accessibility-oriented role/name assertions.

---

### Task 6: Render complete F7.3 feedback and verify the feature

**Files:**
- Modify: `src/components/statement/StatementWriter.tsx`
- Modify: `src/components/statement/StatementWriter.test.tsx`
- Modify: `docs/lor-feedback-design.md` only if implementation deviations require a decision-log update

**Step 1: Add failing rendering tests**

Assert the normalized score and label, nine-dimension ledger, What Works Well, What Could Be Stronger, Profile Coverage, and existing inline suggestion behavior.

**Step 2: Verify RED, implement, and verify GREEN**

Render the LOR-only sections without changing generic `AIAnalysis` presentation.

**Step 3: Run repository checks**

Run targeted lint, `npm.cmd run typecheck`, focused tests, the full unit suite, and `npm.cmd run build`. Run `git diff --check` and GitNexus change detection before handoff.

**Step 4: Handoff**

Report changed files, verification evidence, and the unapplied Supabase migration. Do not commit or push unless the user explicitly asks.
