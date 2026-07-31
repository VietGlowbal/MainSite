# Design system — what already exists

`src/styles/tokens.css` (532 lines) is the single source of truth for values.
This file lists **names**, so you can reach for the right utility without opening
it. Never hard-code a colour, spacing step or radius; eslint blocks raw hex in
`src/features/**` and `src/shared/ui/**`.

Three layers: primitive (`@theme`) → semantic (`:root`) → utility (`@theme inline`).
The indirection is what makes a re-theme a one-file change, so add tokens at the
right layer rather than aliasing at the call site.

---

## Primitives in `src/shared/ui`

Import from `@/shared/ui` (the barrel), never a deep path — with one documented
exception, the loading hooks; see that row.

| Component | Notes |
|---|---|
| `Button` | `variant`: `primary` · `primary-on-dark` · `secondary` · `secondary-on-dark`. `size`: `sm`(36) · `md`(40) · `lg`(44) · `xl`(48). Renders `<a>` when `href` is set. Carries the kit's skeuomorphic bevel — it is in every button instance in the design, easy to mistake for noise. |
| `Container` | 1280 max, 16/32 gutters. The class list is a constant on purpose — see the comment before editing it. |
| `Section` | |
| `TopNav` | `tone`: `dark` \| `light`. Optional `user` (avatar + name) for the signed-in state, or `secondaryAction`. |
| `MobileNav` | Fixed header + full-screen sheet. |
| `Footer` | Dark band, columns, social, optional `ratings`. |
| `Avatar` | `size`: `sm`(32, default) · `lg`(60 — the applications-list crest slot). Initials fallback either way. |
| `Badge` | `outline` · `brand-subtle` · `neutral` · `reach` · `recommend` · `safe` · `brand-chip` · `info-chip`. Use `admissionBadgeVariant()` to map an `AdmissionCategory`. The two `-chip` variants are `brand-subtle`'s geometry one type step down (`text-gb-xs`, not `sm`) — the mentor profile's chip rows bind `Text xs/Medium`, so they cannot reuse the pills without rendering 2px larger. `info-chip` is blue because a help topic is a *category*, not a risk level; see the note on `--color-gb-blue-*` for why it is not the visually identical `recommend`. ⚠️ Bakes in `whitespace-nowrap` — a long real value (a university name, not the mockup's short placeholder) overflows past its container into whatever sits next to it in a flex/grid row. Give it its own line and put `truncate` on a wrapping `<span>` inside, don't rely on the pill to wrap or shrink. |
| `Pagination` | `paginationRange()` is exported and unit-tested separately. Renders nothing when `totalPages <= 1`. |
| `Modal` | Scrim + centred panel. Owns Escape, scroll lock, focus-in/focus-return. **Not a focus trap** — Tab can still walk into the page behind. |
| `FormField`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio` | `name` doubles as the id so these stay Server Components (`useId` would force `'use client'` onto every form page). `controlClasses(invalid, extra)` for anything hand-rolled. |
| `MultiSelect` | Search field over a scrolling checkbox list with a Reset / Select all footer (Figma `375:11536`, `375:11616`). `single` collapses it to one answer and hides Select all. ⚠️ Row height is **50px**, set by the 24px checkbox + 2px margin — not the 20px text line. Sizing the viewport off the text clips rows mid-line. |
| `Stepper` | The five-step spine for both apply journeys. **Two sequences, one component** — read its header before choosing labels; several frames mix them. |
| `ScoreRing` | Banded percentage gauge. Promoted out of `apply-list-client.tsx` (was `ProgressGauge`, Figma `337:18813`); reused on the application list, workspace header and match analysis. |
| `ProgressBar` | Determinate **and** indeterminate in one component, deliberately — keeping them together is what stops the indeterminate one being faked with a bar animated to 90%. |
| `RangeHistogram` | Two-handle range with the real distribution drawn behind it (Reflection's budget question). The bars are data, not decoration. |
| `RepeatableFieldset` | A list of identical sub-forms the student can grow — Reflection's achievements and activities. |
| `GlobeLoader` / `LoadingOverlay` | `size="sm"` shares a panel with other content; `"md"` is the standalone popup. ⚠️ **The one documented exception to "always import from the barrel".** `useLoadingIndicator` & co. *are* re-exported from `@/shared/ui` for discoverability, but take them from `@/shared/ui/loading-overlay` unless you also need a component: reaching through the barrel for a hook drags every primitive above into the module's graph. With ~40 call sites, several under test, that pulled ~300 uncovered branches into the coverage denominator and broke the ratchet in `vitest.config.ts` — plus dead weight in the bundle of every page that saves a form. |
| `Metric`, `FeatureCard`, `CheckItem`/`CheckList`, `RatingsBadge` | |
| `KitIcon` + `ICONS` | Stroked Untitled UI icons. |
| `BrandIcon` + `BRAND_ICONS` | **Filled** social marks — `KitIcon`'s stroke treatment renders them hollow, hence the split. |
| `VerifiedMark` | The seal beside a verified mentor's name (Figma `375:21653`). Two filled paths in two colours, so not a `KitIcon`: the seal takes `currentColor` (pair it with `text-fg-verified`), the tick is hard white. Renders an accessible `title` by default — "verified" is information, not decoration. Pass `title={null}` where adjacent text already says it. |
| `InstagramMark`, `SearchMark` | ⚠️ Not design art. Neither mark exists in Figma; these are the shapes the old site shipped. |

### Icon sizing is not `size-6`

Each export's viewBox is the *stroked bounds of the artwork*, smaller than the
icon frame and usually not square (`markerPin02` is 15×18.33 in a 20px frame).
`KitIcon` scales `art` by `frame / art.frame`. Dropping an icon into a square
`size-6` stretches it ~10% and shifts it off centre.

`ICONS`: `zapFast` `checkCircle` `messageChatCircle` `zap` `chartBreakoutSquare`
`messageSmileCircle` `send` `chevronDown` `arrowRight` `arrowLeft` `arrowUpRight`
`markerPin02` `plus` `clock` `gift01`. `d` accepts a string or an array of
strings (a few icons are genuinely two paths; concatenating them joins the
shapes with a stray line).

---

## Token names

**Colour utilities** — `bg-*` / `text-*` / `border-*`:

- surfaces: `surface`, `surface-hover`, `surface-muted`, `surface-inverse`, `surface-inverse-strong`, `surface-inverse-deep`, `surface-frosted`
- foreground: `fg`, `fg-secondary`, `fg-tertiary`, `fg-muted`, `fg-brand`, `fg-on-inverse`, `fg-on-inverse-secondary`, `fg-on-inverse-muted`, `fg-error`
- lines: `line`, `line-strong`, `line-on-inverse`, `line-on-image`, `line-error`
- brand: `brand`, `brand-hover`, `brand-subtle`, `brand-surface`, `on-brand`
- tiers: `tier-reach`/`on-tier-reach`, `tier-recommend`/`on-tier-recommend`, `tier-safe`/`on-tier-safe`
- informational: `info-subtle` (bg) / `fg-info` (text) — the pair behind `Badge`'s
  `info-chip`. Resolves to the same Figma Blue/50 + Blue/600 as the `recommend`
  tier and is deliberately **not** an alias of it: a tier is a risk
  classification, an info chip is a category label, and repainting the tier scale
  must not silently repaint every blue chip. Same reasoning `tier-reach` already
  uses to avoid aliasing `brand`.
- verified: `fg-verified` — Blue/500, the seal behind `VerifiedMark`'s tick.
- over-image: `scrim` (gradient target), `surface-frosted`

**Spacing** `gb-*` — `xxs` 2 · `xs` 4 · `sm` 6 · `md` 8 · `lg` 12 · `xl` 16 ·
`2xl` 20 · `3xl` 24 · `4xl` 32 · `5xl` 40 · `6xl` 48 · `7xl` 64 · `9xl` 96.
**Not** Tailwind's 4px scale — `sm` is 6 and `lg` is 12. Plus `gb-btn-xl` (18) and
`gb-input-x`/`gb-input-y` (14/10 → the 44px control height).

**Radius** `rounded-gb-*` — `none` `xs`(4) `sm`(6) `md`(8) `lg`(10) `xl`(12)
`2xl`(16) `full`. Much tighter than the legacy `rounded-[1.5rem]`/`[2rem]`.

**Type** `text-gb-*` — `xs` `sm` `md` `lg` `xl` `display-xs` `display-sm`
`display-md` `display-lg` `display-xl`. Body Inter (`font-sans`), display
Bricolage Grotesque (`font-display`). Display sizes take
`tracking-gb-display-tight` (-2%) or `-open` (+2%); the design genuinely uses both.

**Shadow** `shadow-gb-xs`, `shadow-gb-lg`, `shadow-gb-xs-skeuomorphic`.

**Width** `max-w-gb-width-sm`(480) `max-w-gb-width-xl`(768) `max-w-gb-desktop`(1280).
⚠️ Named `gb-width-*`, not `gb-sm`/`gb-xl`: Tailwind resolves `max-w-<key>`
against both `--container-*` and `--spacing-*`, and spacing wins — `max-w-gb-xl`
silently returned 16px. Do not rename these.

---

## Page chrome

Pages that render their own `TopNav`/`Footer` must:

1. Wrap in `gb-page-full-bleed` (drops the app sidebar gutter), plus
   `gb-has-mobile-header` if they also ship their own fixed `MobileNav` — that
   modifier restores the mobile top offset the plain full-bleed class removes.
2. Add the exact pathname to `OWN_CHROME_ROUTES` in
   `src/components/nav-reveal.tsx`, or the global sidebar + mobile nav double up
   (two elements behind the `nav-header` test id, which the testid contract
   forbids, and two mobile navs — exactly what `mobile-nav.spec.ts` guards).

Matching is **exact** by default, so `/news` gets its own chrome while
`/news/[slug]` stays on the app chrome.

Current members: `/` `/dev/home` `/universities` `/auth` `/onboarding` `/about`
`/news` `/my-universities` `/my-universities/program` `/apply` `/mentors`
`/dev/saved-list` `/coming-soon` `/ai-strategy` `/dev/apply-workspace`.
Forgetting to add a route here is the actual failure mode, not a hypothetical —
it happened to `/apply` and was caught by screenshotting the finished page.

Note `/my-universities/program` is listed separately rather than folded into a
`/my-universities` prefix: the `[id]` task pages between them are still on the
app chrome, so a prefix would silently strip their sidebar.

Two escapes from exact matching, both in the same file:

- `OWN_CHROME_PREFIXES` — currently just `/ai-strategy`. Only for subtrees where
  **every** descendant is rebuilt; a prefix silently covers routes that do not
  exist yet, so a legacy page added underneath one loses its navigation with
  nothing to say so.
- **Id-shaped matchers**, for a rebuilt detail page whose siblings are not
  rebuilt and so cannot take a prefix: `/universities/<digits>` (vs the legacy
  `/universities/vinuni`) and `/mentors/<uuid>` (vs `/mentors/apply`). The id's
  *shape* is what separates them. When the legacy sibling retires, collapse the
  matcher into a prefix entry.

---

## CSS quarantine

`src/app/globals.css` is 5,379 **unlayered** lines that out-rank Tailwind
utilities. A new component is immune as long as it:

- uses none of `.glowbal-*` `.auth-*` `.glow-*` `.profile-*` `.cosmic-*`
  `.cosmos-*` `.onboarding-*` `.geo-*` `.explorer-*`
- does not render inside `.geo-article` `.cosmos-light-zone`
  `.onboarding-form-shell` `.auth-secure-notice` `.profile-upload-tip`
  `.profile-empty-state` `.cosmic-step-card` `.glowbal-nav-pill-admin`

---

## i18n

⚠️ **Corrected 2026-07-30.** This section used to say there is no DOM-walking
translator. There is: `src/lib/dom-translate.tsx`, mounted globally in
`src/app/layout.tsx`. The rest of that note was right about *what to write*, but
wrong about *why*, which changes what a missing dictionary key costs.

`src/lib/i18n-dictionary.ts` maps **English source string → Vietnamese**, and
`DomTranslator` seeds its cache from it (`new Map(Object.entries(dictionary))`).
So every visible string gets translated one of two ways:

| | How | Cost |
|---|---|---|
| **In the dictionary** | Exact lookup, instant, offline | free, and reviewed by a human |
| **Not in the dictionary** | Machine-translated via `/api/translate` (OpenAI), then cached in `localStorage` | an API call, and nobody has read the output |

That is the real reason a literal must match its key **character-for-character**:
a near-miss does not fall back to English, it silently becomes an unreviewed
machine translation of a string you thought you had authored.

Keep rendering **plain English literals** and adding the matching keys.
Duplicate keys are a TypeScript error (TS1117) — check before adding.

Things that follow from how the translator works, each of which has bitten:

- **Do not interpolate into a sentence.** `{name} hasn't published…` renders as
  two adjacent text nodes: the sentence can never match a dictionary key, so it
  is machine-translated forever, and the node pair is fragile under hydration
  (it produced a real mismatch on `/mentors/[id]`). Write one literal, and keep
  names out of translatable sentences.
- **`SKIP_TAGS`** — `SCRIPT` `STYLE` `NOSCRIPT` `CODE` `PRE` `TEXTAREA` `SVG`
  `PATH` are never walked.
- **Attributes**: `placeholder`, `aria-label`, `title` are translated. An
  input's `value` is deliberately never touched.
- **`[data-no-auto-translate]`** opts a subtree out — the nav and the
  news/guide pages use it because they already translate via the dictionary.
- **PII routes are excluded from machine translation entirely**, so nothing
  personal reaches OpenAI: `/profile` `/apply` `/dashboard` `/admin`
  `/onboarding` `/my-universities` `/auth`. Those pages still localise through
  the static dictionary. ⚠️ A new route holding user data must be added to
  `PII_ROUTE_PREFIXES`. `/mentors/[id]` is **not** on the list and does not need
  to be — it renders only the public `PublicMentor` projection — but a page
  showing a student's own bookings would.
