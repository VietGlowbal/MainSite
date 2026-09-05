# Performance — Core Web Vitals

Opened **2026-09-05** after Vercel Speed Insights reported a Real Experience
Score of **57/100** (Desktop, production, 7 days). This is the working record
for front-end performance: what was measured, what was fixed, and what is still
open. Numbers here are measured, never estimated — if a row has no measurement
it says so.

## The production symptom (2026-09-05, before any fix)

| Metric | Value | Target |
|---|---|---|
| Real Experience Score | 57 | 90 |
| First Contentful Paint | 4.64s | < 1.8s |
| Largest Contentful Paint | 4.67s | < 2.5s |
| Cumulative Layout Shift | 0.20 | < 0.1 |
| Interaction to Next Paint | 102ms | good |
| First Input Delay | 4ms | good |
| Time to First Byte | 0.27s | good |

**Geography matters more than the aggregate suggests.** Of 958 events, 871 were
Vietnam (RES 56); the US scored 86 and Australia 84 on the same pages. The
product is not slow because the server is slow — TTFB is 0.27s. It was slow
because of how many bytes had to move before anything could paint, which is a
problem you only see from a Vietnamese connection.

### Two popular theories that the measurements killed

Both were checked first because they would have been the biggest wins. Neither
is real — don't spend time re-deriving them:

- **Three.js / the globe is not in any initial bundle.** Every call site already
  uses `next/dynamic` with `ssr: false` (`components/landing/home/hero-globe.tsx`,
  `components/onboarding/onboarding-globe-quiz.tsx`, `components/landing-globe.tsx`).
  The 1,754 KB three.js chunk loads on zero routes at first paint.
- **Fonts are correct.** `next/font/google`, self-hosted, metric-matched
  fallbacks (`ascent-override`, `size-adjust`) for all three families, and
  preloaded — via the HTTP `Link:` header, *not* `<link>` tags in `<head>`. If
  you grep the HTML for a font preload and find nothing, look at the response
  headers before concluding anything.

Also ruled out: images (one raw `<img>` in the whole codebase, on
`/mentors/[id]`), and server data fetching as an FCP cause.

## Fixed

### 1. The Vietnamese catalog shipped on every route

`lib/i18n-dictionary.ts` is 534 KB of source and composes into `i18n-catalog`.
It was a *static* import in `lib/i18n.tsx`, `lib/dom-translate.tsx` and
`lib/i18n/locale.ts` — all three reachable from the root layout — so it sat in
the first-load bundle of all 260 routes: **584 KB raw / 178 KB gzipped, a third
of the JS transfer**, on `/terms` exactly as much as on `/`.

English never reads it. `t()` returns the source string before the lookup:

```ts
if (lang === 'en') return interpolate(en, vars);   // lib/i18n.tsx
```

The catalog now lives behind a dynamic import in
[`lib/i18n-catalog-runtime.ts`](../src/lib/i18n-catalog-runtime.ts).

> ⚠️ **The invariant: never `import` `i18n-catalog` from a module the client can
> reach.** One static import anywhere in the client graph puts all 584 KB back
> into every route and silently undoes this. `getCatalog()` is the only
> client-side entry point. The three sanctioned exceptions are
> `app/vi/layout.tsx`, `app/vi/vi-catalog.tsx` and `src/__tests__/setup.ts`,
> each commented in place.

**`/vi/*` deliberately keeps the eager catalog** — those routes render
Vietnamese server-side, so an async load would paint English and swap, which is
the layout shift this work removes. Priming needs *both* halves, and this is the
trap that cost one build:

- `app/vi/vi-catalog.tsx` is `'use client'`, so importing it from the server
  layout yields a **client reference, not the module** — the server does not
  evaluate it until React renders the element, which is *after* child server
  components have run. Shipped that way, `/vi/about` rendered its heading in
  English (its copy comes from a server component; `/vi` and `/vi/universities`
  happened to work because theirs is client-side).
- So `app/vi/layout.tsx` also imports the catalog directly and primes at module
  scope, which evaluates at module load — strictly before any route under `/vi`
  renders. Server imports are not bundled for the browser, so this is free.

### 2. The nav caused essentially all of the CLS

`SiteNavigation` renders server-side with `sessionReady = false`, so
`primaryAction`, `secondaryAction` and the avatar are all withheld until
`NavigationSessionProvider` finishes `supabase.auth.getUser()` and then a
`student_profiles` query — two sequential round-trips after hydration.

Withholding them is deliberate and still happens (a completed student must not
see the first-time onboarding CTA flash). The bug was that it also made the bar
**4px shorter** until the session resolved. Measured at 1440×900:

```
DIV.flex.shrink-0.items-center   1319,17  89x34  ->  1013,14  398x46
MAIN                             0,69  1440x831  ->  0,73  1440x827
```

The header grew, `<main>` — essentially the whole viewport — moved down with it,
and that near-1.0 impact fraction multiplied the actions' own 306px sideways
move: **0.199 of the site's 0.20 CLS, in one shift.**

`TopNav` now takes `actionsPending` and reserves a button's height with an
invisible, inert spacer. It is a real `Button` rather than a fixed height so it
tracks the design instead of a magic number. Both headers pass it —
`components/site-navigation.tsx` and the `AppTopNav` inside
`components/nav-reveal.tsx`, which has the same pattern for pages that do not
ship their own chrome.

### 3. The `/ai-strategy/*` cluster sent nothing until every await resolved

All 27 routes had **zero `loading.tsx` and zero `<Suspense>`**, so no shell
flushed until auth, the entitlement gate and the page's own report query had all
completed. That is why the cluster sat at RES 40–68 against a 0.27s TTFB.

Two changes:

- **`'/ai-strategy/'` added to `PROTECTED_ROUTES` in `src/proxy.ts`.** ⚠️ The
  trailing slash is load-bearing: `/ai-strategy` itself is the public Strategy
  Hub, and `startsWith` is what tests the list, so `'/ai-strategy/'` matches
  every child and not the hub. All 26 children already redirected anonymous
  visitors themselves; deciding at the edge stops the server rendering a page
  nobody will see, and keeps that redirect a real 307 now that a shell can flush
  before a page-level `redirect()` runs. It costs no extra round-trip —
  `getClaims()` already ran for these paths.
- **`app/ai-strategy/[applicationId]/loading.tsx`.**

⚠️ **The boundary is at `[applicationId]`, not at `/ai-strategy`, and moving it
up would be a product regression.** Next wraps a segment's `loading.tsx` around
the children of that segment's *layout*, so at this level `layout.tsx` still
runs its session check and its GlowBal Plus entitlement gate to completion
server-side. One level up, the shell would flush first and demote
`redirect('/plus?application=…')` into a client-side bounce — a student without
Plus would watch a skeleton of a page they are not entitled to, then get sent
away. The same reasoning is why the skeleton needs no header of its own: the
layout has already painted the nav, footer and rose `ApplicationNav` band, so
nothing above the skeleton can move and the swap costs no layout shift.

**Deferred, deliberately:** `/ai-strategy/personal-report` (85 visits) and
`/ai-strategy/reflection/*` (~108). They render `ReflectionChrome` themselves
with `nav={<ApplicationNavFromReturn/>}`, which returns `null` unless a
`?return=` param is present — and a `loading.tsx` cannot see search params. A
segment-level skeleton would therefore sometimes omit a band that the real page
then adds, shifting a full viewport of content down by the band's height: order
0.1 CLS, undoing much of fix 2. These need in-page `<Suspense>` around the
report body with the chrome resolved in the shell, which is a real refactor of
both pages, not a file drop. Left for a follow-up rather than done badly.

### 4. A barrel file put framer-motion on every route

`src/app/layout.tsx` → `nav-reveal.tsx` → `@/features/marketing/ui` (the barrel)
→ `home-metrics.tsx` → `home-metrics-grid.tsx` → **framer-motion**.

Both global nav components asked the barrel for one pure function,
`getMarketingNavPresentation`, which actually lives in the featherweight
`nav-items` module. The barrel also re-exports every Home page composition, so
that one import put **247 KB of animation library into the first-load bundle of
all 260 routes** — `/terms` included, which animates nothing.

⚠️ **Deep-importing `@/features/marketing/ui/nav-items` is not the fix, and
ESLint will reject it** — `NO_DEEP_FEATURE_IMPORT` in `eslint.config.mjs` bans
three-segment feature paths. The sanctioned route is a *slice*: a thin
re-export at `src/features/marketing/<name>.ts`, the pattern `strategy-help.ts`
already established and `navigation.ts` already used. So `navigation.ts` grew
`getMarketingNavPresentation` and its types, and three more slices were added
for the compositions that had no lightweight entry point:

| Slice | For |
|---|---|
| `marketing/navigation` | header + footer items — eleven consumers, including both global navs |
| `marketing/strategy-guide` | `/how-it-works` |
| `marketing/strategy-hub` | `/ai-strategy` |
| `marketing/about` | `/about` (and `/vi/about`, which re-exports it) |

Framer-motion now ships only on `/` and `/vi` — the Home page, which genuinely
animates.

**Supabase stays, and that is the right call.** The 222 KB / 59 KB gzipped
client is reached by `navigation-session.tsx`, `navigation-roles.tsx` and
`saved-nav-link.tsx`, all mounted globally and all needing real auth state for
the header. Deferring it behind a dynamic import would save 59 KB gzipped but
delay sign-in state on every page across three components. Not worth it at that
price; revisit only if the header's auth story changes.

> ⚠️ **Do not import `@/features/marketing/ui` from anything global.** It is a
> page-composition barrel and it reaches framer-motion. `src/app/page.tsx` and
> `/vi` legitimately use it; everything else should take a slice, adding one if
> the thing it needs has none.

### Measured result

Production build, `npm start`, Playwright at 1440×900, 5 Mbps / 80ms RTT / 4×
CPU throttle. Local FCP is not comparable to the production figure — localhost
has no real network — but the CLS and bundle numbers are.

First-load JS, gzipped. "Baseline" is before any of this work; the middle column
isolates the catalog fix so the two effects can be told apart.

| Route | Baseline | after 1+2 | after 3+4 | framer? | dict? |
|---|---|---|---|---|---|
| `/terms` | 552 | 374 | **304** | no | no |
| `/about` | — | 375 | **310** | no | no |
| `/news` | — | — | **310** | no | no |
| `/advisors` | — | — | **312** | no | no |
| `/ai-strategy` | — | 375 | **315** | no | no |
| `/universities` | — | 391 | **321** | no | no |
| `/scholarships` | — | — | **323** | no | no |
| `/plus` | — | 399 | **328** | no | no |
| `/` | — | 375 | 377 | **yes** | no |
| `/vi/about` | — | — | 488 | no | **yes** |
| `/vi` | 553 | 553 | 555 | **yes** | **yes** |

`/terms` is the clean before/after on one route: **552 → 304 KB gzipped, −45%.**
`/` keeps framer-motion because the Home page animates; `/vi/*` keeps the
catalog because it renders Vietnamese server-side. Both are correct.

CLS, same harness (Playwright, production build, 1440×900, 5 Mbps / 80ms / 4×
CPU):

| Route | before | after |
|---|---|---|
| `/` | 0.2000 | **0.0036** |
| `/terms` | 0.1985 | **0.0035** |
| `/about` | 0.2065 | **0.0114** |
| `/plus` | — | **0.0035** |
| `/ai-strategy` | — | **0.0035** |

`/about`'s residual 0.0114 is a separate pre-existing shift in its card overlays
(`SPAN.absolute.inset-x-0.bottom-0`, growing 170→196px), not the nav.

Local FCP: `/` 1212 → 1064ms, `/terms` 1036 → 992ms, `/about` 848 → 800ms,
`/ai-strategy` 916ms. Treat these as directional only — localhost has no real
network, and the whole point of the byte reduction is what it does to a
Vietnamese connection. Judge it against Speed Insights after deploy.

**Not exercised locally:** the `[applicationId]` streaming path needs an
authenticated Plus session, which this work had no way to mint. The boundary is
confirmed compiled (Turbopack emits
`src_app_ai-strategy_[applicationId]_loading_tsx_*.js`) and the proxy's edge
redirects were verified by hand — `/ai-strategy` 200, every child 307 to
`/auth?redirect=…` — but the skeleton itself has not been seen on screen. Worth
a look on the first preview deploy.

## Still open, in priority order

Ordered by visit volume × severity, from the 2026-09-05 audit.

| # | Route(s) | Root cause | Fix | Effort |
|---|---|---|---|---|
| 3b | `/ai-strategy/personal-report` (85), `/ai-strategy/reflection/*` (~108) | Still no streaming — a segment `loading.tsx` is unsafe here because the conditional `ApplicationNavFromReturn` band would shift a viewport of content (see fix 3 above) | in-page `<Suspense>` around the report body, chrome resolved in the shell; or give the band a reserved height so a segment skeleton becomes safe | M |
| 5 | all | `globals.css` compiles to 324 KB / 50 KB gz, render-blocking, with 425 legacy selectors | trim the quarantine (see `CLAUDE.md`) | M–L |
| 6 | `/universities/matches` | pulls 99 universities + all 593 `catalog_programmes` rows (454 KB JSON, ~640ms measured) and ranks them, per render | cache/narrow the query; add `loading.tsx` | M |
| 7 | `/ai-strategy/[applicationId]/*` | The layout calls `supabase.auth.getUser()` and so does each page — two Auth API round-trips per request. `server/auth/server-identity.ts` already wraps `getClaims()` in React `cache()`, which verifies the JWT locally and dedupes per request | move both onto `getServerIdentity()` | M, security-adjacent — review carefully |

**`/universities/matches` scores RES 0 but is not crashing.** Vercel runtime
errors for the 7 days to 2026-09-05 show **no errors on that route**. With 8
visits it is a small sample of a genuinely heavy page, not a hang — do not chase
it as a bug.

### Not a Core Web Vitals issue, but live

`/api/translate` returned **55 errors across 11 users, 2026-08-30 → 09-04**:
`"You have no credits remaining"` (OpenAI `insufficient_quota`). Every
Vietnamese-toggled page that hits an uncached string fails silently and renders
English. This is a billing problem, not a code one.

## How to re-measure

```powershell
npm.cmd run build
npm.cmd start
```

Then, for first-load JS, fetch a route and sum the chunks its HTML references —
the build's own summary does not break this down per route under Turbopack.
For CLS, drive it with Playwright and read `layout-shift` entries with their
`sources`, which name the offending elements; attribution is the whole point,
because a CLS number on its own tells you nothing about what moved. Throttle the
context (5 Mbps / 80ms / 4× CPU) or everything looks fine locally.
