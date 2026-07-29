# Design system — what already exists

`src/styles/tokens.css` (391 lines) is the single source of truth for values.
This file lists **names**, so you can reach for the right utility without opening
it. Never hard-code a colour, spacing step or radius; eslint blocks raw hex in
`src/features/**` and `src/shared/ui/**`.

Three layers: primitive (`@theme`) → semantic (`:root`) → utility (`@theme inline`).
The indirection is what makes a re-theme a one-file change, so add tokens at the
right layer rather than aliasing at the call site.

---

## Primitives in `src/shared/ui`

Import from `@/shared/ui` (the barrel), never a deep path.

| Component | Notes |
|---|---|
| `Button` | `variant`: `primary` · `primary-on-dark` · `secondary` · `secondary-on-dark`. `size`: `sm`(36) · `md`(40) · `lg`(44) · `xl`(48). Renders `<a>` when `href` is set. Carries the kit's skeuomorphic bevel — it is in every button instance in the design, easy to mistake for noise. |
| `Container` | 1280 max, 16/32 gutters. The class list is a constant on purpose — see the comment before editing it. |
| `Section` | |
| `TopNav` | `tone`: `dark` \| `light`. Optional `user` (avatar + name) for the signed-in state, or `secondaryAction`. |
| `MobileNav` | Fixed header + full-screen sheet. |
| `Footer` | Dark band, columns, social, optional `ratings`. |
| `Avatar` | `size`: `sm`(32, default) · `lg`(60 — the applications-list crest slot). Initials fallback either way. |
| `Badge` | `outline` · `brand-subtle` · `neutral` · `reach` · `recommend` · `safe`. Use `admissionBadgeVariant()` to map an `AdmissionCategory`. ⚠️ Bakes in `whitespace-nowrap` — a long real value (a university name, not the mockup's short placeholder) overflows past its container into whatever sits next to it in a flex/grid row. Give it its own line and put `truncate` on a wrapping `<span>` inside, don't rely on the pill to wrap or shrink. |
| `Pagination` | `paginationRange()` is exported and unit-tested separately. Renders nothing when `totalPages <= 1`. |
| `Modal` | Scrim + centred panel. Owns Escape, scroll lock, focus-in/focus-return. **Not a focus trap** — Tab can still walk into the page behind. |
| `FormField`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio` | `name` doubles as the id so these stay Server Components (`useId` would force `'use client'` onto every form page). `controlClasses(invalid, extra)` for anything hand-rolled. |
| `Metric`, `FeatureCard`, `CheckItem`/`CheckList`, `RatingsBadge` | |
| `KitIcon` + `ICONS` | Stroked Untitled UI icons. |
| `BrandIcon` + `BRAND_ICONS` | **Filled** social marks — `KitIcon`'s stroke treatment renders them hollow, hence the split. |
| `InstagramMark` | ⚠️ Not design art. No Instagram mark exists in Figma; this is the shape the old site shipped. |

### Icon sizing is not `size-6`

Each export's viewBox is the *stroked bounds of the artwork*, smaller than the
icon frame and usually not square (`markerPin02` is 15×18.33 in a 20px frame).
`KitIcon` scales `art` by `frame / art.frame`. Dropping an icon into a square
`size-6` stretches it ~10% and shifts it off centre.

`ICONS`: `zapFast` `checkCircle` `messageChatCircle` `zap` `chartBreakoutSquare`
`messageSmileCircle` `chevronDown` `arrowRight` `arrowUpRight` `markerPin02`
`clock` `gift01`. `d` accepts a string or an array of strings (a few icons are
genuinely two paths; concatenating them joins the shapes with a stray line).

---

## Token names

**Colour utilities** — `bg-*` / `text-*` / `border-*`:

- surfaces: `surface`, `surface-hover`, `surface-muted`, `surface-inverse`, `surface-inverse-strong`, `surface-inverse-deep`, `surface-frosted`
- foreground: `fg`, `fg-secondary`, `fg-tertiary`, `fg-muted`, `fg-brand`, `fg-on-inverse`, `fg-on-inverse-secondary`, `fg-on-inverse-muted`, `fg-error`
- lines: `line`, `line-strong`, `line-on-inverse`, `line-on-image`, `line-error`
- brand: `brand`, `brand-hover`, `brand-subtle`, `brand-surface`, `on-brand`
- tiers: `tier-reach`/`on-tier-reach`, `tier-recommend`/`on-tier-recommend`, `tier-safe`/`on-tier-safe`
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

Matching is **exact**, not prefix, so `/guides` gets its own chrome while
`/guides/[slug]` stays on the app chrome.

Current members: `/dev/home` `/universities` `/auth` `/onboarding` `/about`
`/guides` `/my-universities` `/apply` `/mentors` `/dev/saved-list`
`/coming-soon`. Forgetting to add a route here is the actual failure mode, not a
hypothetical — it happened to `/apply` and was caught by screenshotting the
finished page.

---

## CSS quarantine

`src/app/globals.css` is 5,375 **unlayered** lines that out-rank Tailwind
utilities. A new component is immune as long as it:

- uses none of `.glowbal-*` `.auth-*` `.glow-*` `.profile-*` `.cosmic-*`
  `.cosmos-*` `.onboarding-*` `.geo-*` `.explorer-*`
- does not render inside `.geo-article` `.cosmos-light-zone`
  `.onboarding-form-shell` `.auth-secure-notice` `.profile-upload-tip`
  `.profile-empty-state` `.cosmic-step-card` `.glowbal-nav-pill-admin`

---

## i18n

`src/lib/i18n-dictionary.ts` maps **English source string → Vietnamese**. There is
no DOM-walking translator: a string is only translated where `t()` / `useT()` /
`<T k="…" />` is actually called.

The redesigned pages currently render **plain English literals** and add the
matching dictionary keys, so a later pass wiring `t()` is mechanical. Keep doing
that — a literal that does not match its key character-for-character will never
translate. Duplicate keys are a TypeScript error (TS1117), so check before adding.
