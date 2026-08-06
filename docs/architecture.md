# Architecture

Last reconciled with `main` at `de4a7fe` on **2026-08-06**.

`eslint.config.mjs` is the authority for the boundaries it actually registers.
This file explains the intended shape and records both the enforced rules and
the current enforcement gap.

```
src/app/                              thin routes; orchestrate only
src/features/<domain>/{api,domain,ui,hooks}/
src/shared/{ui,lib,types}/            leaf — depends on nothing internal
src/server/{db,auth,cache,observability}/
src/components/, src/lib/             pre-FSD; still load-bearing
```

Current feature directories: `ai-strategy-dashboard`, `application-strategy`,
`apply`, `auth`, `marketing`, `mentorship`, `onboarding`, `scholarships`, and
`universities`. (`marketing` is primarily public page composition.)

⚠️ `eslint.config.mjs` registers every directory above **except
`ai-strategy-dashboard`** in its `FEATURES` array. That means the boundary rules
below are intended for it but are not currently applied to it. The omission is
not safe to repair blindly: `ai-strategy-dashboard/ui/evidence-upload.tsx`
currently imports `@/features/apply/hooks`, which would become a cross-feature
lint error. Move that upload behavior to `shared/` or choose an explicit feature
owner before adding the missing registry entry.

## Rules

1. `app/` never imports `@/server/db` — go through a repository in `features/*/api`.
2. `features/*/ui` never imports `features/*/api`.
3. No cross-feature imports — shared code moves up to `shared/` or `server/`.
4. `shared/*` depends on nothing in `features/`, `app/`, `server/`.
5. `createAdminClient` bypasses RLS — only in `src/server`, an API route, or a repository.
6. No raw hex in `src/features/**` or `src/shared/ui/**`.

### The flat-config trap

Flat config does **not** merge rule options. Two blocks both setting
`no-restricted-imports` means the last one matching a file *replaces* the first,
silently losing its patterns. The zones in `eslint.config.mjs` are written to be
mutually exclusive, each carrying the full union that applies to it. A new block
setting that rule must not overlap an existing zone.

### `ADMIN_CLIENT_DEBT`

A hardcoded list of pages that still build the RLS-bypassing service-role client
inline. **It may shrink, never grow** — a new offender fails lint. Down to two:
`src/app/admin/page.tsx` and `src/app/plus/success/page.tsx`. The entries removed
so far are kept as comments in `eslint.config.mjs` saying what replaced them,
which is the record of the list shrinking.

## Strict TypeScript

Files under `features/`, `shared/`, `server/` also compile under
`tsconfig.strict.json`: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
`exactOptionalPropertyTypes`. Run `npm run typecheck:strict` as well as
`npm run typecheck` — the base pass will not catch these.

`exactOptionalPropertyTypes` is why props are declared `foo?: string | undefined`
rather than `foo?: string`: callers forward an optional straight through.

## Data access

| Port | Where | Key methods |
|---|---|---|
| `UniversityQueries` | `features/universities/api` | `list()` `getById()` `getByIds()` `facets()` · `listAllForLegacyExplorer()` is **deprecated** — do not add callers |
| `ProgrammeQueries` | `features/universities/api` | `byUniversityId()`. Reads `catalog_programmes` for the subject picker (Figma `375:13546`). An empty catalogue is a normal answer and the caller falls back to `universities.strengths`. The earlier 82-of-106 count was a 2026-07-31 production snapshot, not a code invariant. |
| `ScholarshipQueries` | `features/scholarships/api` | `listPublished()` `byUniversityIds()` `byIds()` `getById()` `facets()`. `byUniversityIds` now also carries `conditions`/`insight`/`applies_to_text` (added for the saved-list scholarship detail panel, Figma `337:19349`) — one join wider rather than a second round trip per scholarship a student opens. |

Both are swappable via `setUniversityQueries()` / `setScholarshipQueries()` — the
test seam. Import the **port type**, never the adapter.

`user_universities` / `user_scholarships` are read straight through the
request-scoped Supabase client in page components (RLS scopes them to the user).
That is the existing pattern in `src/app/apply/page.tsx`.

**Always check the `error` from a Supabase read.** A failed read and an empty
table render identically, so an unchecked error becomes a page that quietly lies —
which is exactly how the missing `user_universities` table went unnoticed. At
minimum `console.error`, as the repositories do.

⚠️ **And an RLS filter is not an error at all.** The read succeeds and returns
zero rows, so error-checking cannot catch it. Twice now that has shipped a page
that was simply empty — or 404 — for signed-out visitors, with nothing logged:
the mentor directory, then `/mentors/[id]` (known-issues §1b). If a page is
reachable from the guest nav, **test it against the anon key**, not only a
signed-in session.

### Public reads that bypass RLS — `src/lib/mentors.ts`

Not FSD (`src/lib` is pre-FSD, and rule 5 permits the admin client in a
repository), but it is the only place in the codebase deliberately serving
*public* data through the service role, so the pattern is worth stating:

1. **Filter for visibility inside the query, never in the caller.**
   `.eq('status','approved')`, `.eq('is_visible', true)`, `.eq('status','open')`.
   Bypassing RLS means the query is the only gate left.
2. **Project onto an explicit public type — never `select('*')`.**
   `PublicMentor` exists because `achiever_profiles` also holds `legal_name`,
   `date_of_birth`, `stripe_account_id` and four verification-document storage
   keys, and the old code handed the whole row to a `'use client'` component,
   which serialises it into the page.
3. **Validate the id before the round trip.** A malformed uuid makes Postgres
   raise on the cast rather than return nothing.
4. **Mirror the write-side rules the API will enforce.** The booking calendar
   filters to slots `POST /api/mentorship/checkout` will actually accept, so the
   student is not offered a time that 409s at payment.

Anything added here should read the same way, and should shrink back to the
request-scoped client once the anon read policies exist.

## Routing / gating

`src/proxy.ts` (Next middleware) runs before every page. As of this session it
also carries a **pre-launch site lock** (`src/lib/site-gate.ts`,
`src/app/coming-soon/`). That lock is checked first and is independent of
everything below: it decides whether the site is reachable at all; the
auth/onboarding logic decides who's signed in once it is.

Current auth/onboarding gating:

- `PROTECTED_ROUTES` = `/apply` `/profile` `/dashboard` `/my-universities`
  `/writer` `/admin` `/onboarding/complete` → signed-out users get
  `/auth?redirect=<path>`.
- Signed-in users hitting `/auth` are redirected to `?redirect` if present,
  otherwise **`/apply`** — that is the current post-login landing after the
  saved-list/application merge.
- Onboarding gate: `/apply`, `/my-universities/*`, and `/profile` require either
  `onboarding_completed` or the legacy completion fallback (`study_level` plus
  at least one `preferred_countries` value), else `/onboarding`.
- Exact `/about`, `/news`, `/universities`, and `/mentors` requests bypass the
  Supabase auth round trip. `/universities` also receives a 12-hour CDN cache
  policy with a 24-hour stale-while-revalidate window.

Consequence: `/apply` is double-gated and can be hard to reach in a test.
`/dev/saved-list` remains the preview for the saved-list portion; the full
application workspace has `/dev/apply-workspace`.

## Navigation strategy (added 02/08)

Three layers, deliberately separate. If you are adding a page, you touch layer 3
and usually nothing else.

**1. Global — the top bar.** `shared/ui/top-nav.tsx`. Same on every page; its
contents are owner-owned, do not add product-specific entries to it. It is now
`position: sticky` and hides off the top edge once scrolled, returning when the
pointer comes within 90px of the top, when focus enters it, or on scroll-up
(`shared/ui/use-nav-reveal.ts`).

> ⚠️ It moves by animating `top`, **never** `transform`. `NavDropdown`'s panel is
> `position: fixed` to escape the nav's `overflow-hidden`; any `transform` on an
> ancestor makes the header a containing block again and the panel gets clipped.
> The ⚠️ note on `NavDropdown` says the same thing from the other side.

**2. Contextual — the application bar.** `components/application-nav.tsx`
(server, reads onboarding state) → `components/application-sub-nav.tsx` (client,
resolves the active entry) → `shared/ui/sub-nav.tsx` (dumb primitive). Mounted
in `app/ai-strategy/[applicationId]/layout.tsx`, passed as the `nav` slot into
the `/apply/[applicationId]` overview, and mounted for the `/apply` document
tools by `app/apply/[applicationId]/(features)/layout.tsx`. The route group does
not change URLs. It answers "what else belongs to THIS application" — a
different question per row in My Portal, which is why it is not in the top bar.

As of 2026-08-06 the bar is a full-bleed `bg-brand` band with `tone="on-brand"`
breadcrumbs/sub-navigation. It covers the six primary surfaces: Overview,
Personal Report, Matching Report, Planner, CV builder, and Statement. The LOR
workspace is deliberately outside that six-item model and keeps its own return
link.

Entries a student cannot reach yet render **locked, not hidden**: the planner
route redirects into onboarding until the analysis is done, so linking it early
bounces them, and hiding it tells them nothing about what finishing unlocks.

**3. Positional — breadcrumbs.** `shared/ui/breadcrumbs.tsx`, driven entirely by
`shared/lib/app-routes.ts`. A new page needs a row in `ROUTES` (+ `CRUMB_HREFS`
if it has ancestors) and nothing else — no per-page trail, no wiring.

> **The trail is not the URL.** Parents come from the registry because the
> journey's shape and the path's shape differ: the parent of
> `/ai-strategy/<id>/strategy/analysis/portrait` is `/apply/<id>`, which shares
> no prefix with it. Chopping segments would offer `/ai-strategy/<id>/strategy/
> analysis` (redirects on arrival) and `/ai-strategy/<id>` (not a page).

An empty trail is a real answer — `/auth`, `/onboarding`, `/coming-soon` and `/`
return `[]` on purpose, and a one-crumb trail is suppressed as furniture.

### Rules

- **Dynamic crumbs** declare `{ key, fallback }`. Pass the real name via
  `labels={{ application: courseName }}`; the fallback shows when you cannot.
  The key is a separate field from the display label on purpose — deriving one
  from the other meant a rename silently broke every caller.
- **Never translate a dynamic crumb.** It holds a course or a person's name.
  `breadcrumbs.tsx` only runs registry labels through `t()`.
- **A view worth linking to belongs in the URL.** The planner's list/calendar/
  board is `?view=` (`domain/planner.ts#parsePlannerView`) for exactly this
  reason. Since `de4a7fe`, changing it uses `history.replaceState` rather than
  a Next Router navigation: the URL stays linkable without refetching the
  dynamic Server Component. List, calendar, and board also share one optimistic
  recommendation state, so edits made in one view appear in the other two.

## Test-id contract

`src/shared/lib/testids.ts` is a contract between Playwright and the UI. Tests
select on these ids, a URL, or a network response — **never** a CSS class (the
stylesheet is being replaced) and **never** visible copy (the app is bilingual and
all copy is being rewritten).

Definition of done for a rewritten screen: every id still resolves to exactly one
element. Renaming one means updating `tests/e2e` in the same commit. Add ids when
a flow needs them; do not sprinkle them speculatively.
