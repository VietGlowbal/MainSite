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

**The `[applicationId]` skeleton is now confirmed on screen** (2026-09-05, with
a GlowBal Plus + admin account the owner supplied). Its `aria-busy="true"`
wrapper was observed ahead of the real content on `/strategy`,
`/matching-report` and `/cv/content`, with the header and the rose
`ApplicationNav` band already occupying their space behind it and **CLS 0.0018**
on every one. The band is a server component that fades in via
`animate-gb-app-nav-reveal`, so it is laid out from the first paint even though
it is still transparent when the skeleton appears — which is why the swap costs
nothing.

### 5. `globals.css` was 84% dead

The CSS quarantine described in `CLAUDE.md` had **404 class selectors, of which
340 matched nothing anywhere** — whole screens' worth of styling for pages that
no longer exist.

⚠️ **Two independent checks agreed before a byte was deleted, and the second one
is the one that matters.** A grep can only prove a name is absent from the
source; it cannot prove the browser never applies the rule. So every candidate
was also checked against the live DOM: 65 page loads across 47 routes, signed in
as Plus + admin *and* signed out (the anonymous pass matters — `/auth` and
`/onboarding` redirect away when you have a session, and `auth-*` was the
largest dead family at 93 selectors), collecting every class on every element.
**1,281 distinct classes were seen live and not one of them was on the delete
list.** The five apparent "dynamic class" sites the grep flagged were all false
positives — a Jitsi meeting slug, an email idempotency key, an `.ics` filename
and an `aria-labelledby` id — so no class name is assembled at runtime.

Deletion was rule-level and deliberately conservative: a rule went only if
*every* selector in its comma list was anchored on a dead class. A rule like
`.glow-card, .glowbal-card { … }` stays whole if either half is live, which is
why 21 unreferenced names survive.

| | before | after |
|---|---|---|
| `globals.css` | 5,042 lines / 126 KB | **1,192 lines / 34 KB** |
| class selectors | 404 (340 dead) | **83 (21 unreferenced)** |
| render-blocking CSS, raw | 332 KB | **273 KB** |
| render-blocking CSS, gzipped | 51.1 KB | **41.3 KB** |

**The audit over-estimated this one and the record should say so.** Item 5
assumed trimming the quarantine would take a large bite out of the 324 KB. It
did not: deleting 74% of the source moved the compiled bundle by 18%, because
most of that file is Tailwind's generated utilities, not legacy CSS. −9.8 KB
gzipped off the critical path of every route is still worth having, and the
maintenance win is larger than the byte win — but the remaining 273 KB will not
yield to more deleting. It needs per-route CSS, which Turbopack does not do for
a global stylesheet.

Verified with a 28-route pixel diff (authenticated, full-page, 1440×1000)
before and after: 19 routes byte-identical. The nine that differed were re-shot
against the *same* build and eight differed again, so they are animation frames,
not regressions; the ninth (`planner`) was the repeating GlowBal watermark
inside the rose band at a different point in its loop. No screenshot changed
height. `npx playwright test` then passed 54 with one failure that **fails
identically on a clean tree** — see the note at the end of this file.

### 6. `/universities/matches` re-read the whole catalogue per request

Three separate problems, all in `loadUniversityRecommendations`:

- **The payload.** It asked for all 593 `catalog_programmes` rows with all 12
  columns. Ranking reads eight fields; `academic_units` alone is **192 kB
  against 58 kB for everything ranking uses** (`pg_column_size`, measured). A
  new `allForMatching()` on the programme port selects only the eight, and the
  port returns a `MatchingProgramme` — a `Pick`, so the fat columns are not
  merely unused, they are unavailable.
- **The serialisation.** The programme read went through
  `byUniversityIds(everyUniversityId)`, so it could not start until the
  university read had returned the ids — for a filter that matched every row
  anyway. Both reads now go out together.
- **No caching.** Neither table depends on who is asking. The pair is now one
  `unstable_cache` entry tagged `universities`. Only the student's profile row
  is still read per request, in parallel.

⚠️ **Caching `catalog_programmes` needed an invalidation path it did not have,
and the first version of this shipped without one.** The `universities` tag is
expired by the nightly `discover-universities` cron and by
`/api/admin/universities/revalidate` — but neither touches programmes. The
actual writer is `scripts/import-university-programs-csv.mjs --apply`, which
wrote straight to Postgres and pinged nothing. Before this fix that was
harmless, because programmes were read fresh every time; after it, an operator
importing corrected programmes would have had students ranked against the old
catalogue for up to twelve hours with nothing on screen to say so. The importer
now calls that endpoint itself on a verified apply, non-fatally and loudly —
a failed ping prints the exact command to run rather than failing an import that
already succeeded. Any future writer of that table must do the same.

⚠️ **The cached value has to stay JSON-serialisable.** `unstable_cache` writes
through the Next data cache and a `Map` comes back as `{}`, which is why
`allForMatching` returns a flat array and the grouping happens outside the cache
boundary. ⚠️ It also throws `Invariant: incrementalCache missing` outside a
request context, so unit tests mock `next/cache` — the convention
`directory-loader.test.ts` next door already used.

**And the page was rendering two headers.** `nav-reveal.tsx` suppresses the app
chrome for `/universities`, but by *exact* match, and the numeric-id regex next
to it does not accept a word — so `/universities/matches` got the app header on
top of the one it ships itself. The only thing preventing two visible headers
was this, in `globals.css`:

```css
body:has(.glowbal-main-content [data-testid='nav-header']) [data-global-navigation] { display: none; }
```

That fires when the page's own header parses, which is *after* the app header
has painted. `<main>` was measured jumping from `y=73 h=827` to `y=0 h=900` — a
full-viewport shift worth **0.0507**, i.e. essentially all of this route's CLS.
Both match routes are now in `OWN_CHROME_ROUTES` and the rule never has to fire.

Measured, production build, Playwright 1440×900 at 5 Mbps / 80ms / 4× CPU, cold
then warm:

| | before (cold / warm) | after (cold / warm) |
|---|---|---|
| document commit | 989 / 329 ms | **446 / 121 ms** |
| FCP | 1576 / 532 ms | **1076 / 368 ms** |
| fully loaded | 10845 / 2681 ms | **3618 / 2203 ms** |
| skeleton on screen | never | **1091 / 182 ms** |
| CLS | 0.0530 / 0.0530 | **0.0023 / 0.0025** |

### 7. Three Auth API round-trips per request in `/ai-strategy/*`

`supabase.auth.getUser()` is a network call to the Supabase Auth API. The
`[applicationId]` subtree made three of them on every request — the segment
layout, the page, and `ApplicationNav`'s own fallback, which the layout never
gave a `userId` to. From Vietnam that is three serial trips to Singapore before
the shell can flush.

`getServerIdentity()` in `src/server/auth/server-identity.ts` already wrapped
`getClaims()` in React `cache()`; `/apply/*` had been migrated onto it and
`/ai-strategy/*` had not. All 24 call sites in the cluster now use it, plus
`ApplicationNav` itself.

⚠️ **This is not a weaker check, and the reason is worth recording rather than
assuming.** `getClaims()` only skips the network when the project signs tokens
asymmetrically. This one does: a live access token's header reads
`{"alg":"ES256","kid":"…"}`, so the signature is verified locally against the
cached JWKS and a forged or tampered token fails exactly as it would at the Auth
API. Were the project ever moved back to the legacy HS256 shared secret,
`getClaims()` falls back to calling the Auth server — correctness holds either
way and only the speed-up is lost.

One real semantic difference: claims carry the `user_metadata` that was in the
token when it was issued, where `getUser()` returns it fresh. In practice
`/profile/personal` changes a name through `supabase.auth.updateUser()` from the
browser, which mints a new token immediately, so the two agree by the next
request. The two sites that read it (`cv/layout`, `personal-report`) use it only
to greet the student by name.

**Five public pages went the same way, and they matter more.** `/ai-strategy`,
`/how-it-works`, `/plus`, `/universities/[id]` and `/mentors/[id]` each called
`getUser()` for nothing but an `isSignedIn` boolean — on pages that render for
anonymous visitors too, so every guest was paying for an Auth API round-trip to
find out they were not signed in.

`ReflectionChrome`'s `user` prop went with it: it was in the type and never
destructured, so seven callers were threading a `User` object into nothing.

`src/__tests__/ai-strategy-auth-dedupe.test.ts` guards all of this, because the
regression is someone adding a *new* page with the old pattern — which no
runtime test of the existing pages would catch.

## Still open, in priority order

Ordered by visit volume × severity, from the 2026-09-05 audit.

| # | Route(s) | Root cause | Fix | Effort |
|---|---|---|---|---|
| 3b | `/ai-strategy/personal-report` (85), `/ai-strategy/reflection/*` (~108) | Still no streaming — a segment `loading.tsx` is unsafe here because the conditional `ApplicationNavFromReturn` band would shift a viewport of content (see fix 3 above) | in-page `<Suspense>` around the report body, chrome resolved in the shell; or give the band a reserved height so a segment skeleton becomes safe | M |
| 8 | all | 273 KB / 41 KB gz of render-blocking CSS remains after fix 5, and it is Tailwind utilities, not legacy — one global stylesheet serves all 260 routes | per-route CSS. Turbopack will not split a global stylesheet, so this means moving page-specific styling into CSS modules or component-scoped files — a real project, not a trim | L |
| 9 | `/ai-strategy/[applicationId]/planner` | Measured **11.5s** to fully loaded on a throttled cold load — the slowest page found during this work, and not yet investigated. The `loading.tsx` from fix 3 means it paints early, so it is no longer a blank wait, but something behind it is very slow | profile `ensureApplicationPlan` / `getCanonicalApplicationPlanner` | M |
| 10 | 19 remaining `getUser()` sites in `src/app` | Fix 7 converted the `/ai-strategy` cluster and five public pages; the rest of the app still pays an Auth API round-trip per request | same mechanical change onto `getServerIdentity()`, route group by route group | M |

**`/universities/matches` scored RES 0 and was never crashing.** Vercel runtime
errors for the 7 days to 2026-09-05 showed **no errors on that route**. With 8
visits it was a small sample of a genuinely heavy page — see fix 6 for what it
actually was.

### A pre-existing e2e failure, unrelated to this work

`tests/e2e/kitchen-sink.spec.ts › design tokens render as expected` fails, and
**it fails the same way on a clean checkout** — verified by stashing every change
in this round and re-running. The committed snapshot has the global site header;
the live page does not, and the page is 73px shorter than the baseline as a
result. The cause looks like the same `:has()` rule fix 6 describes: the kitchen
sink renders TopNav *demos* inside `.glowbal-main-content`, which hides
`[data-global-navigation]`. The baseline appears to predate that. Left alone
rather than re-recorded blind, because re-recording a snapshot is how a real
regression gets baked in.

⚠️ **`npx playwright test` will also fail 17 `home-preview.spec.ts` tests if a
server is already listening on :3000.** Playwright attaches to it instead of
spawning its own, and `playwright.config.ts` sets `ENABLE_DEV_ROUTES=1` only on
the server *it* starts — so `/dev/home` 404s and every assertion against it
fails. Stop your `npm start` before running e2e. The config's own ⚠️ warns about
the reuse; this is the specific way it bites.

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
