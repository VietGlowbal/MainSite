# Current project status

Last reconciled: **2026-08-08 (Asia/Bangkok)**

Code snapshot: **working tree**, branched from `main` at `b610087` (PR #158,
"Fix Overview page being skipped, auto-firing analysis for returning
students", merged). Not yet committed/pushed at the time this document was
written — see "Last completed work" below for what the working tree
contains. `origin/main` has since moved one commit further (`15948d2`, an
unrelated GEO auto-publish) than the base this branch restarted from.

This is the first file a coding agent should read. It records the present state
of the repository, the last completed work, its impact, the verification state,
and the next risks. Detailed design history remains in the other files in this
directory. If this file conflicts with the code, the code wins.

## Repository state

- Stack: Next.js `16.2.3`, React `19.2.4`, TypeScript 5, Supabase/Postgres,
  OpenAI and DeepSeek-backed AI paths, Vitest, and Playwright.
- Two pre-existing untracked documents must be preserved: `TECH_SOLUTION.md`
  and `docs/audit-2026-08-03.md`. They are owner/session work, not generated
  build output.
- The working tree has real uncommitted work: a FOURTH same-day fix on this
  same feature, and the biggest one — see the next section and
  `docs/known-issues.md §5g`.

## Last completed work

| Commit | Completed work | User and system impact |
|---|---|---|
| *(uncommitted)* | **Fixed a same-day production incident (the fourth on this feature today, and the root cause of the whole day's trouble)**: `personal_summary_completed_at`/`achievements_completed_at` (`student_profiles`) were **never written by any code in this repository** — confirmed by a full-repo grep, three read sites and zero writes. Every student's reflections were permanently "incomplete" no matter how many times they submitted both steps, which is what made §5e/§5f's symptoms possible in the first place and would have made a student finishing achievements bounce straight back to reflections in an infinite loop even after those fixes. Also fixed: Overview's CTA (§5f's fix) pointed at "whatever the real next step is," which for a returning student resolved straight to the analysis-trigger gate, skipping reflections anyway — reported the same day as "it goes straight into doing the strategy building." And wired `?return=` through the reflection forms' submit handlers (§5f's flagged-but-unfixed gap), for the application-originated case specifically. See `docs/known-issues.md §5g`. | `POST /api/reflection` now sets both completion timestamps on submit. `strategy/page.tsx`'s Overview CTA always targets the reflection flow's start, unconditionally. `reflection-about-form.tsx`/`reflection-evidence-form.tsx` now read and carry forward `?return=`, landing a student back at their application's analysis gate after reflections instead of an old per-student report page — every other (non-application) entry point into those forms is unchanged. |
| `b610087` (#158) | Fixed a same-day production incident: Overview was only shown to a student with neither reflection step done, so a returning student (reflections globally already marked complete) skipped it entirely. See `docs/known-issues.md §5f`. | `strategy/page.tsx` gated Overview on `!state.aiAnalysisComplete` (per-application) instead of the shared reflection flags; `/apply/[applicationId]/page.tsx` simplified to bounce to `/ai-strategy/[id]/strategy` rather than duplicating the decision. |
| `dac93c0` (#157) | Fixed a same-day production incident: `fetchOnboardingState`'s `aiAnalysisComplete` only checked the Personal Report, not the Matching Report, letting an incomplete analysis reach the F7 page. See `docs/known-issues.md §5e`. | `aiAnalysisComplete` now requires both reports; the F7 workspace redirects to the analysis gate on a `needsInputs` response instead of retrying the same doomed call. |
| `573db50` (#156) | Retired the free `/apply/[applicationId]` checklist/match-insights UI (now a pure onboarding redirect) and built F7 "Personalized Strategy" — a new, separate, read-only, downloadable-PDF report page, deliberately distinct from the task-tracking Planner. | Clicking into an application lands wherever the student actually is in the gated pipeline (Reflection → Personal Report → Matching Report → Personalized Strategy → Planner). New `application_strategy_recommendations` table; one new OpenAI call synthesising the Personal Report and Matching Report into six sections, written in English by product decision. |
| `f845ddb` | Added genUI content blocks to AI-generated recommendations. | Every recommendation's detail page body now comes from one of three AI-chosen shapes (`structured_table`/`long_text`/`checklist`) declared at generation time, or none when the task routes to a tool. Depends on an unrun migration — see `docs/known-issues.md §0d`. |
| `de4a7fe` | Made Planner List/Calendar/Board view switching client-side. | Switching `?view=` no longer refetches the dynamic server page; the URL remains bookmarkable while the UI changes immediately. |
| `169ca25` | Centralized optimistic Planner state and added deadline editing to the list. | Status and deadline edits appear in all three planner views without a reload; failed writes roll back per edit. |
| `8d3da8f` | Put the brand-red application context bar on the six primary per-application surfaces. | Overview, Personal Report, Matching Report, Planner, CV builder, and Statement now expose a consistent way back to the rest of the application. Route groups changed file placement only; public URLs did not change. LOR intentionally remains outside this six-item bar. |
| `2acd09e` | Moved the CV Builder target-profile, generation, and review calls to OpenAI and made English the source UI language. | `OPENAI_API_KEY` now powers those CV paths; Vietnamese remains available through the static i18n dictionary. Other AI routes still use a mix of OpenAI and DeepSeek. |
| `01397eb` + `7cd8261` | Split product help from Strategy. | `/how-it-works` explains the whole product; `/ai-strategy` explains stage 3. The global nav points to the help page, while application surfaces link into Strategy. |

## What is built now

### Student journey

- Discovery: `/universities`, numeric university details, `/scholarships`,
  `/mentors`, mentor profiles, `/news`, and the public marketing pages.
- Onboarding and profile: the onboarding flow plus the profile subpages remain
  the source of student context.
- My Portal: `/apply` is the post-login landing and combines saved universities
  with application progress. The bare `/my-universities` permanently redirects
  to `/apply`; its subject picker and legacy task children still exist.
- Per-application work: `/apply/[applicationId]` is now a pure redirect (no
  checklist UI of its own) — it sends the student to wherever they are in the
  onboarding pipeline via `fetchOnboardingState`/`nextOnboardingStep`. The
  shared application navigation exposes Personal Report, Matching Report,
  **Personalized Strategy**, Planner, CV builder, and Statement. The analysis
  and planner pages live below `/ai-strategy/[applicationId]/strategy/*`.
- Strategy: applicant portrait, programme-fit report, the **Personalized
  Strategy report (F7)** — a separate, read-only, downloadable-PDF report,
  not part of the Planner — recommendation board, recommendation
  detail/coach/evidence flows, and List/Calendar/Board planner views are
  implemented.
- Documents: CV hub/import/content/layout/review/target-profile flows, the
  OpenAI-backed CV Builder compatibility routes, Statement feedback, LOR
  recommender strategy, and the nine-dimension LOR quality review are present.
- Earlier report routes (`/ai-strategy/report` and
  `/ai-strategy/matching[/applicationId]`) remain implemented alongside the
  newer application-specific portrait and fit routes. Do not assume the two
  generations are interchangeable when changing navigation or persistence.

### Platform and operations

- Supabase SQL is stored as standalone `supabase-*.sql` files; this repository
  still has no ordered migration runner. Repository presence does not prove a
  migration is live.
- CI runs base typecheck, strict typecheck, lint, coverage-gated Vitest, and a
  production build. Playwright E2E runs on pull requests and uploads its report
  on failure; it deliberately does not gate the daily GEO push to `main`.
- GEO content generation and publication remain a separate scheduled pipeline.
- The pre-launch site lock is controlled by `SITE_LOCK_ENABLED`; API routes,
  cron routes, and webhooks bypass it and therefore need their own auth.

## Architecture facts and current gaps

- The intended shape is `app` → feature API/domain/UI/hook slices → shared/server
  leaves, with legacy `src/components` and `src/lib` still load-bearing.
- The current feature directories are `ai-strategy-dashboard`,
  `application-strategy`, `apply`, `auth`, `marketing`, `mentorship`,
  `onboarding`, `scholarships`, and `universities`.
- `eslint.config.mjs` enforces Feature-Sliced boundaries for all of those except
  **`ai-strategy-dashboard`**, which is absent from its `FEATURES` registry.
  That feature currently imports `@/features/apply/hooks`, so adding it to the
  registry is not a mechanical one-line change; decide where the shared upload
  behavior belongs first.
- Two pages remain in the admin-client debt allowlist:
  `src/app/admin/page.tsx` and `src/app/plus/success/page.tsx`.
- AI provider use is mixed, not a fallback ladder. CV Builder and several
  strategy paths use OpenAI; LOR, Personal Report, Match Insights, and other
  legacy paths still use DeepSeek. A failure of one provider does not
  automatically fail over to the other.
- `.env.example` documents `OPENAI_API_KEY` but not `DEEPSEEK_API_KEY`, even
  though live routes require the latter. Treat environment setup documentation
  as incomplete until that is reconciled.

## Verification snapshot

Measured on 2026-08-08 against the uncommitted working tree described above
(`npx` invocations, equivalent to the `npm run` scripts):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **Pass**, 0 errors (ran after `rm -rf .next/types`). |
| `npx tsc -p tsconfig.strict.json` | **Pass**, 0 errors. |
| `npx eslint .` | **Pass:** 0 errors, 23 warnings, all pre-existing and unrelated to this session's changes. |
| `npx vitest run` | **Pass: 1677 passed, 2 todo, 156 files passed, 0 failed.** New `src/app/api/reflection/route.test.ts` covers the completion-flag upserts. |
| `npm run build` | Not rerun in this pass. |
| `npm run test:e2e` | Not rerun in this pass. |

The owner reported running "supabase" migration(s) and merging #157 earlier
today, so §0e may now be resolved — **not independently re-verified in this
pass**. `supabase-strategy-recommendation-report.sql` (§0f)'s status is also
unconfirmed. Re-run the SQL checks in §0e/§0f before assuming either is
done. Manual click-through has still not been done in this session — only
automated checks above. Given §5g's finding (a flag silently never being
written, for what may have been the product's entire lifetime), a manual
click-through of the FULL flow — Overview → reflections → achievements →
analysis → intro → Personalized Strategy → Planner, on a genuinely fresh
student account — is now the highest-value verification step available,
higher than re-running the automated gates again.

## Open risks that still deserve priority

The dated audit remains the detailed evidence record. A code-only recheck on
2026-08-06 found no commit that obviously closes its highest-priority items:

- `/api/translate` is still an unauthenticated OpenAI-backed translation path.
- `/api/newsletter/notify` still needs a fail-closed secret check to be treated
  as safe independently of deployment configuration.
- the Next.js course-import path still needs the same SSRF protections as the
  Python ingestion service;
- `src/server/observability/index.ts` is still a placeholder, so there is no
  centralized alerting or structured error pipeline;
- Plus fulfilment still depends on the success page rather than a Stripe
  webhook/reconciliation path;
- live migration and stranded-job claims were not re-queried during this docs
  pass. Revalidate production before repeating the audit's counts as current.

See [audit-2026-08-03.md](audit-2026-08-03.md) for the point-in-time audit and
[known-issues.md](known-issues.md) for historical traps and regression notes.

## Handoff protocol

After material work, update this file in the same change:

1. move the code snapshot to the new commit or say `working tree` if uncommitted;
2. add the completed work and its user/system impact;
3. record migrations, environment changes, and any externally applied state;
4. record exact verification results and blockers;
5. remove or rewrite risks that the change actually closed;
6. link a detailed design, plan, or incident note instead of turning this file
   into a chronological diary.
