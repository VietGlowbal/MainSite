# Architecture

`eslint.config.mjs` is the authority — it enforces every boundary below with
`no-restricted-imports`. This file only explains why, and records the traps.

```
src/app/                              thin routes; orchestrate only
src/features/<domain>/{api,domain,ui,hooks}/
src/shared/{ui,lib,types}/            leaf — depends on nothing internal
src/server/{db,auth,cache,observability}/
src/components/, src/lib/             pre-FSD; still load-bearing
```

Features: `universities` `scholarships` `apply` `onboarding` `mentorship` `auth`
`marketing`. (`marketing` is `ui/` only — public page compositions, no repository.)

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
inline. **It may shrink, never grow** — a new offender fails lint. Currently:
`src/app/page.tsx`, `src/app/admin/page.tsx`, `src/app/plus/success/page.tsx`,
`src/app/universities/vinuni/page.tsx`.

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

## Routing / gating

`src/proxy.ts` (Next middleware) runs before every page. As of this session it
also carries a **pre-launch site lock** (`src/lib/site-gate.ts`,
`src/app/coming-soon/`) — see `LAUNCH_PLAN.md` for the launch-week context. That
lock is checked first and is independent of everything below: it decides whether
the site is reachable at all; the auth/onboarding logic decides who's signed in
once it is. Not part of the Figma redesign work this pack otherwise documents.

The auth/onboarding gating itself is unchanged:

- `PROTECTED_ROUTES` = `/profile` `/dashboard` `/my-universities` `/writer`
  `/admin` `/onboarding/complete` → signed-out users get
  `/auth?redirect=<path>`.
- Signed-in users hitting `/auth` are redirected to `?redirect` if present,
  otherwise **`/my-universities`** — so that page is the post-login landing.
- Onboarding gate: `/my-universities` and `/profile` also require a completed
  `student_profiles` row, else `/onboarding`.

Consequence: `/my-universities` is double-gated and hard to reach in a test.
That is why `/dev/saved-list` exists.

## Test-id contract

`src/shared/lib/testids.ts` is a contract between Playwright and the UI. Tests
select on these ids, a URL, or a network response — **never** a CSS class (the
stylesheet is being replaced) and **never** visible copy (the app is bilingual and
all copy is being rewritten).

Definition of done for a rewritten screen: every id still resolves to exactly one
element. Renaming one means updating `tests/e2e` in the same commit. Add ids when
a flow needs them; do not sprinkle them speculatively.
