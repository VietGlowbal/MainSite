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

### Measured result

Production build, `npm start`, Playwright at 1440×900, 5 Mbps / 80ms RTT / 4×
CPU throttle. Local FCP is not comparable to the production figure — localhost
has no real network — but the CLS and bundle numbers are.

| Route | First-load JS before | after | CLS before | after |
|---|---|---|---|---|
| `/` | 1,784 KB / 552 gz | **1,203 KB / 375 gz** | 0.2000 | **0.0036** |
| `/terms` | 1,783 KB / 552 gz | **1,202 KB / 374 gz** | 0.1985 | **0.0035** |
| `/about` | 1,785 KB / 552 gz | **1,203 KB / 375 gz** | 0.2065 | **0.0114** |
| `/universities` | 1,829 KB / 566 gz | **1,248 KB / 391 gz** | — | — |
| `/apply`, `/profile` | — | **1,210 KB / 377 gz** | — | — |
| `/ai-strategy` | 1,784 KB / 552 gz | **1,203 KB / 375 gz** | — | — |
| `/vi`, `/vi/about` | 1,786 KB / 553 gz | 1,786 KB / 553 gz | — | — |

**−178 KB gzipped (−32%) on every route except `/vi/*`**, which is unchanged by
design. `/about`'s residual 0.0114 is a separate pre-existing shift in its card
overlays (`SPAN.absolute.inset-x-0.bottom-0`, growing 170→196px), not the nav.

Local FCP moved 1212→1068ms on `/`, 1036→996ms on `/terms`, 848→816ms on
`/about`. The real gain is on Vietnamese connections, where 178 KB is seconds
rather than milliseconds; confirm against Speed Insights after this deploys
rather than trusting the local delta.

## Still open, in priority order

Ordered by visit volume × severity, from the 2026-09-05 audit.

| # | Route(s) | Root cause | Fix | Effort |
|---|---|---|---|---|
| 3 | `/ai-strategy/*` (≈250 visits) | **Zero `loading.tsx` and zero `Suspense` across all 27 routes** — no shell is sent until every server await resolves; the approach is `getUser()` → `verifiedApplicationId()` → `Promise.all([...])`, three sequential Supabase hops | `loading.tsx` per segment; flatten the first two hops | M |
| 4 | all | framer-motion (241 KB) and the Supabase client (222 KB) are in the global baseline | audit which root-layout providers pull them; defer non-critical animation | M |
| 5 | all | `globals.css` compiles to 324 KB / 50 KB gz, render-blocking, with 425 legacy selectors | trim the quarantine (see `CLAUDE.md`) | M–L |
| 6 | `/universities/matches` | pulls 99 universities + all 593 `catalog_programmes` rows (454 KB JSON, ~640ms measured) and ranks them, per render | cache/narrow the query; add `loading.tsx` | M |

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
