# GlowBal SEO Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Also load `@seo-audit`, `@schema-markup`, `@content-strategy`, and `@ai-seo` only when the corresponding task starts.

**Goal:** Make every indexable GlowBal URL crawlable, canonical, content-complete, and measurable; prevent private/draft URLs from entering Google; then add server-rendered Vietnamese SEO pages and a sustainable content program.

**Architecture:** Introduce one explicit indexability contract shared by sitemap generation, private-route metadata, publication validation, and regression tests. Preserve current English canonical URLs, add separate server-rendered `/vi/...` URLs with reciprocal `hreflang`, and keep client-side translation only for private application UI. Treat Supabase `geo_articles` as the canonical public news store and require a hard publication-quality gate before a row can become public.

**Tech Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Vitest, Playwright, Supabase GEO CMS, Vercel, Google Search Console.

---

## 0. Handoff rules and verified baseline

This plan was prepared from the repository and production site on **2026-08-25**.

Verified production observations:

- `/`, `/robots.txt`, and `/sitemap.xml` return `200`.
- `robots.txt` allows crawling and references the canonical sitemap.
- The sitemap currently contains 115 URLs.
- `/apply` is in the sitemap but redirects to `/auth?redirect=%2Fapply`.
- The auth destination is currently `index, follow`, has no canonical, and has no H1.
- Sitemap timestamps are generated with `new Date()` instead of content update dates.
- Public news articles do not emit self-canonical metadata.
- At least one public article exposes draft-quality description/content (`A Glowbal draft guide...`, `TODO_SOURCE_REQUIRED`).
- The default document is `<html lang="en">`; Vietnamese is currently applied on the client through `LanguageProvider`/`DomTranslator`, not through an indexable Vietnamese URL.
- Exact brand search can surface the homepage, but the name competes with similarly named entities such as “Via Glowbal”.

This is an SEO-readiness plan, not a ranking guarantee. Search Console can report a URL as indexed while Google does not serve it for a particular query because relevance, quality, authority, locale, device, and competition still determine ranking.

### Existing user changes that must be preserved

At plan creation, the worktree already contained unrelated changes:

```text
M src/features/ai-strategy-dashboard/domain/compile-plan.test.ts
M src/features/ai-strategy-dashboard/domain/compile-plan.ts
?? glowbal-resend-v2/
```

Do not edit, stage, revert, or commit those paths as part of SEO work. Prefer a dedicated worktree. If working in the current tree, stage exact SEO paths only.

### Required project reading before implementation

Read:

- `AGENTS.md`
- `docs/README.md`
- Search `docs/current-status.md` for `SEO`, `sitemap`, `robots`, `canonical`, `GEO`, and `news`.
- `GEO_CMS_SPEC.md`
- `docs/verification.md`
- Next 16 local docs:
  - `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md`
  - `node_modules/next/dist/docs/01-app/02-guides/json-ld.md`
  - `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`

Use Semble first for repository searches. The repo has `.codegraph/`; use CodeGraph before broad reads. Before changing `listGeoGuides`, run GitNexus impact analysis. The measured impact during planning was `MEDIUM`: five direct callers across `/news`, news detail generation, related articles, and sitemap.

---

## Target indexability contract

### Public and indexable

- `/`
- `/about`
- `/how-it-works`
- `/news`
- `/news/[published-slug]`
- `/universities`
- `/universities/[valid-id]`
- `/advisors`
- `/advisors/[valid-id]`
- `/scholarships` only after the signed-out response contains useful public content
- Equivalent `/vi/...` routes only after Task 5 ships

### Private or non-search destinations

- `/auth`
- `/apply/**`
- `/profile/**`
- `/dashboard/**`
- `/admin/**`
- `/onboarding/**`
- `/ai-strategy/**`
- Payment return, review, status, and success routes
- Draft, archived, preview, and admin news URLs

Private URLs must be `noindex`. Do not solve this with only `Disallow` in `robots.txt`: crawlers need access to see the `noindex` directive.

---

### Task 1: Capture a Search Console baseline

**Files:**

- Create: `docs/seo-baseline-2026-08-25.md`
- Modify: none outside documentation

**External access required:** Google Search Console property for `https://glowbal-education.com/`.

**Step 1: Export baseline data**

Export aggregated, non-sensitive data for:

- Search Results: last 16 months and last 28 days.
- Dimensions: query, page, country, device.
- Page indexing: all indexed and excluded reasons.
- Sitemaps.
- Core Web Vitals.
- Manual Actions and Security Issues.
- URL Inspection for `/`, `/news`, one news article, `/universities/1`, and `/advisors`.

If Search Console access is unavailable, stop only this task, record `BLOCKED: GSC access required`, and continue with code-only tasks. Do not invent metrics.

**Step 2: Create query cohorts**

Record separate baselines for:

- Brand EN: `GlowBal`, `GlowBal education`.
- Brand VI: `GlowBal du học`, `GlowBal học bổng`.
- Non-brand English.
- Non-brand Vietnamese.

For each cohort record impressions, clicks, CTR, average position, and top landing pages.

**Step 3: Record index coverage**

Document:

- Expected indexable URL count.
- Indexed URL count.
- Discovered/crawled but not indexed count.
- Duplicate/canonical exclusions.
- Redirected URLs submitted in sitemap.
- Soft 404 or server-error URLs.

**Step 4: Commit the measured baseline**

```powershell
git add docs/seo-baseline-2026-08-25.md
git commit -m "docs(seo): record search visibility baseline"
```

**Acceptance:** Every recorded claim names its source and date. No unrun check is marked passing.

---

### Task 2: Add a hard publication-quality gate for GEO news

**Files:**

- Modify: `scripts/geo/qualityCheck.ts`
- Modify: `src/lib/geo-content.ts`
- Modify: `src/app/api/admin/news/[id]/route.ts`
- Modify if status changes are centralized there: `src/lib/geo-cms.ts`
- Test: `src/lib/geo-content-public.test.ts`
- Create: `scripts/geo/qualityCheck.test.ts` or use the existing test location for GEO scripts
- Create or modify: the focused admin-news route test next to `src/app/api/admin/news/[id]/route.ts`

**Step 1: Inspect the live publication source**

Enumerate the current `geo_articles` schema and rows; do not guess table or column names. Identify whether the public draft-quality articles come from:

- DB rows marked `published`,
- legacy file fallback,
- or a stale production deployment.

Do not archive, unpublish, update, or delete production rows without explicit owner approval. Save measured findings in the SEO baseline document.

**Step 2: Write failing public-read tests**

Cover these behaviors:

- `listGeoGuides()` excludes `draft` and `archived` content.
- `getGeoGuide()` returns `null` for non-published content.
- A DB row cannot appear public merely because its slug matches a legacy draft.
- DB remains canonical by slug only when the DB row is actually publishable.

Run:

```powershell
npx vitest run src/lib/geo-content-public.test.ts
```

Expected before implementation: at least one new regression assertion fails.

**Step 3: Write failing publication-validation tests**

A request to change an article to `published` must be rejected if any of these are true:

- Body or description contains `TODO_SOURCE_REQUIRED`.
- Description contains `draft guide`, `placeholder`, or equivalent generator placeholder copy.
- No verified official source is present when the content makes tuition, admissions, scholarship, visa, ranking, or deadline claims.
- The configured human-review requirement has not been satisfied.
- Required title, description, body, slug, or publication date is missing.

Return a structured `400` response with actionable blocker codes. Do not silently downgrade to draft during an explicit publish request.

**Step 4: Implement one reusable validator**

Create one pure publication validator and call it from both:

- the GEO quality pipeline, and
- the admin status transition to `published`.

Do not duplicate regexes or blocker rules between the script and API.

**Step 5: Run focused tests**

```powershell
npx vitest run src/lib/geo-content-public.test.ts
npx vitest run scripts/geo/qualityCheck.test.ts
```

Expected: all focused tests pass.

**Step 6: Prepare production remediation**

For each currently public draft-quality URL, produce one recommendation:

- Rewrite and republish at the same URL when the topic is valuable; preferred.
- Archive temporarily when an evidence-backed rewrite cannot ship promptly.

Do not request indexing for an article until placeholder text and unverified claims are removed.

**Step 7: Commit**

```powershell
git add scripts/geo/qualityCheck.ts scripts/geo/qualityCheck.test.ts src/lib/geo-content.ts src/lib/geo-content-public.test.ts src/app/api/admin/news/[id]/route.ts src/lib/geo-cms.ts
git commit -m "fix(seo): enforce public news quality gate"
```

Stage only files that actually changed.

**Acceptance:** No public news response or sitemap entry can contain `TODO_SOURCE_REQUIRED`, generator draft descriptions, or a non-published article.

---

### Task 3: Implement the private/public indexability contract

**Files:**

- Create: `src/lib/seo/indexability.ts`
- Create: `src/lib/seo/indexability.test.ts`
- Create: `src/app/auth/layout.tsx`
- Modify or create the nearest layouts for private route families under `src/app/apply`, `src/app/profile`, `src/app/dashboard`, `src/app/admin`, `src/app/onboarding`, and `src/app/ai-strategy`
- Modify if needed: `src/proxy.ts`
- Test: add focused metadata tests next to the relevant layout/page tests

**Step 1: Write a failing contract test**

The test table must classify representative paths from both lists above. At minimum:

```text
/                         public
/news/example              public
/universities/1            public
/advisors/abc              public
/auth                      private
/auth?redirect=%2Fapply    private
/apply                     private
/profile/academic          private
/dashboard                 private
/admin/news                private
/ai-strategy/example       private
```

Run:

```powershell
npx vitest run src/lib/seo/indexability.test.ts
```

Expected before implementation: FAIL because the contract module does not exist.

**Step 2: Implement the pure classifier**

The classifier must operate on pathnames, not full query strings. Keep the public allowlist small and explicit; authenticated product routes default to private.

**Step 3: Add noindex metadata**

Add metadata at the narrowest shared layout level that covers each private family:

```ts
export const metadata = {
  robots: { index: false, follow: false },
};
```

Ensure `/auth?redirect=...` inherits `noindex, nofollow`. Do not create canonicals that collapse many private user states onto one public page.

**Step 4: Evaluate response headers**

If Next metadata cannot cover a redirect response before rendering, add `X-Robots-Tag: noindex, nofollow` to the private redirect response in `src/proxy.ts`. Preserve all auth, site-lock, cache, cookie, and redirect behavior.

Before editing `proxy`, run CodeGraph/GitNexus impact and inspect its existing navigation tests.

**Step 5: Test metadata and redirects**

Verify:

- `/auth` renders `noindex, nofollow`.
- `/apply` remains auth-protected.
- The redirect or final auth response is not indexable.
- Public marketing pages remain `index, follow`.

**Step 6: Commit**

```powershell
git add src/lib/seo src/app/auth src/app/apply src/app/profile src/app/dashboard src/app/admin src/app/onboarding src/app/ai-strategy src/proxy.ts
git commit -m "fix(seo): enforce route indexability contract"
```

Stage exact changed paths instead of directories when a directory contains unrelated work.

**Acceptance:** Auth, application, dashboard, admin, onboarding, AI-strategy, and payment-state pages cannot be indexed; public landing pages remain indexable.

---

### Task 4: Make the sitemap truthful and stable

**Files:**

- Modify: `src/app/sitemap.ts`
- Create: `src/app/sitemap.test.ts`
- Modify if real timestamps are not exposed: `src/lib/geo-content.ts` and the university public query types/repository

**Step 1: Write failing sitemap tests**

Assert:

- `/apply` is absent.
- No private, draft, archived, redirected, or duplicate URL is emitted.
- `/about` and `/how-it-works` are present.
- `/scholarships` is present only after it has a useful signed-out public response.
- All URLs use `SITE_URL`.
- Repeated calls with identical source data produce identical `lastModified` values.
- News timestamps come from stored publish/update data.
- University timestamps come from stored data or are omitted when unavailable.

Run:

```powershell
npx vitest run src/app/sitemap.test.ts
```

Expected before implementation: FAIL for `/apply` and unstable timestamps.

**Step 2: Implement the smallest sitemap correction**

- Remove `/apply`.
- Add `/about` and `/how-it-works`.
- Do not use `new Date()` as a generic last-modified value.
- Use actual article `updated_at`/`published_at`.
- For static pages without a trustworthy date, omit `lastModified`.
- For university rows without a trustworthy update column, omit `lastModified` until the repository exposes one.
- Preserve the fail-soft university section behavior, but log enough context to diagnose omissions.

Do not spend time tuning sitemap `priority` or `changeFrequency`; correctness matters more.

**Step 3: Run focused and related tests**

```powershell
npx vitest run src/app/sitemap.test.ts src/lib/geo-content-public.test.ts
```

Expected: PASS.

**Step 4: Commit**

```powershell
git add src/app/sitemap.ts src/app/sitemap.test.ts src/lib/geo-content.ts
git commit -m "fix(seo): publish only canonical URLs in sitemap"
```

**Acceptance after deployment:** Every sitemap URL returns `200`, is self-canonical, is `index, follow`, and contains useful public content.

---

### Task 5: Complete canonical metadata and structured data

**Files:**

- Modify: `src/app/news/[slug]/page.tsx`
- Modify: `src/app/universities/[id]/page.tsx`
- Modify: `src/app/mentors/[id]/page.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/lib/seo/json-ld.ts`
- Create: `src/lib/seo/json-ld.test.ts`
- Create focused metadata tests next to each dynamic page

**Step 1: Write failing news metadata tests**

For a published article, require:

- Self-canonical `/news/[slug]`.
- Absolute Open Graph URL.
- Open Graph and Twitter title, description, and image where available.
- `Article.mainEntityOfPage` equals canonical URL.
- `dateModified` uses actual update data, not a copy of publish date.
- No metadata is returned for a missing/non-public article beyond safe not-found behavior.

**Step 2: Extend the public article model**

Expose both `publishedAt` and `updatedAt` from file/DB readers. Preserve backward compatibility for legacy content by falling back to `publishedAt` only when no update timestamp exists.

**Step 3: Implement news canonical metadata**

Use `metadataBase`/`SITE_URL` consistently. Do not hardcode an alternative host.

**Step 4: Add factual university JSON-LD**

Emit `CollegeOrUniversity` only from verified fields:

- Name.
- Canonical GlowBal page URL.
- Logo/image when valid.
- Official website via `officialWebsite()` when known.
- Location/address only when stored and verified.

Do not invent ranking, fees, acceptance rate, coordinates, or reviews.

**Step 5: Add advisor canonical and safe Person schema**

Use only fields intentionally public in the advisor public DTO. Do not expose private/legal/payment/verification fields.

**Step 6: Normalize homepage organization identity**

- Use `GlowBal` consistently instead of mixed `GLOWBAL`/`Glowbal` where it identifies the entity.
- Add `sameAs` only for confirmed official profiles.
- Add contact details only when owner-approved and public.
- Do not add fabricated reviews or aggregate ratings.

**Step 7: Validate JSON-LD serialization**

Tests must prove JSON-LD is valid JSON and that user/editor-controlled strings cannot break out of the script payload. Follow the local Next 16 JSON-LD guide for safe serialization.

**Step 8: Run tests and commit**

```powershell
npx vitest run src/lib/seo/json-ld.test.ts
npm run typecheck
npm run lint
git add src/app/news/[slug]/page.tsx src/app/universities/[id]/page.tsx src/app/mentors/[id]/page.tsx src/app/page.tsx src/lib/seo
git commit -m "feat(seo): complete canonical metadata and entity schema"
```

**Acceptance:** Every public detail template emits one self-canonical URL; structured data reflects visible, verified content and passes Google's Rich Results Test where eligible.

---

### Task 6: Decide and fix the `/scholarships` public contract

**Files:**

- Modify: `src/app/scholarships/page.tsx`
- Modify: `src/features/scholarships/directory-loader.ts`
- Modify: `src/features/scholarships/ui/**` only where required
- Modify: `src/app/sitemap.ts`
- Test: existing scholarships page/directory tests; add a signed-out regression test

**Recommended product decision:** The scholarship directory preview is public; save, eligibility personalization, and AI strategy actions require authentication.

**Step 1: Write the signed-out failing test**

For a signed-out request to `/scholarships`, require:

- A rendered H1.
- A useful scholarship preview or explanatory landing content.
- A self-canonical URL.
- No private student data query.
- Protected actions link to auth with a safe return path.

Expected before implementation: FAIL because the current page redirects or emits an empty streamed shell for signed-out visitors.

**Step 2: Separate public reads from personalized reads**

- Load public, published scholarship data without requiring a user.
- Load saved scholarships, applications, profile, and entitlement state only when authenticated.
- Preserve all RLS/security boundaries.

**Step 3: Add `/scholarships` to the sitemap only after Step 2 passes**

If the owner rejects a public preview, keep the route out of the sitemap and add `noindex`; document that decision instead of leaving ambiguous metadata.

**Step 4: Test and commit**

```powershell
npm run typecheck
npx vitest run
git add src/app/scholarships src/features/scholarships src/app/sitemap.ts
git commit -m "feat(seo): expose crawlable scholarship preview"
```

**Acceptance:** Signed-out users and crawlers receive meaningful content or an explicit `noindex` decision—never an indexable empty shell.

---

### Task 7: Add server-rendered Vietnamese SEO routes

**Files:**

- Create or restructure according to Next 16 local docs: `src/app/vi/**`
- Modify: `src/app/layout.tsx`
- Modify: public marketing/content data modules required to render EN/VI deterministically
- Modify: `src/app/sitemap.ts`
- Modify: public page metadata to add `alternates.languages`
- Test: create locale routing, metadata, and content parity tests

**Do not start until Tasks 2–6 are green.** This is a separate milestone and should not be mixed into the technical-cleanup PR.

**Step 1: Define the first locale scope**

Ship Vietnamese server-rendered versions for:

- `/vi`
- `/vi/about`
- `/vi/how-it-works`
- `/vi/news`
- `/vi/news/[slug]`
- `/vi/universities`
- `/vi/universities/[id]`
- `/vi/advisors`
- `/vi/advisors/[id]`
- `/vi/scholarships` only when Task 6 selected the public option

Keep current unprefixed URLs as English and `x-default` in the first release to preserve existing canonicals.

**Step 2: Write failing locale metadata tests**

For every EN/VI pair, require:

- EN self-canonical.
- VI self-canonical.
- Reciprocal `hreflang="en"` and `hreflang="vi"`.
- `x-default` pointing to the unprefixed URL.
- Correct server-rendered `<html lang>` for the response architecture selected from the Next 16 docs.
- Visible main content in one language per URL.

**Step 3: Implement deterministic server content**

Do not use the runtime DOM translator or an OpenAI translation call as the SEO source. Store/review Vietnamese public content in a deterministic content source. Client translation can remain for private application UI.

**Step 4: Extend sitemap coverage**

Add only complete Vietnamese URLs. Do not publish locale URLs whose body is still English with translated chrome.

**Step 5: Run localization and build gates**

```powershell
node scripts/check-i18n.mjs --all
npm run typecheck
npm run typecheck:strict
npm run lint
npm run build:ci
```

**Step 6: Commit**

```powershell
git add src/app/vi src/app/layout.tsx src/app/sitemap.ts
git commit -m "feat(i18n-seo): add server-rendered Vietnamese pages"
```

**Acceptance:** Vietnamese public pages are crawlable without local storage, cookies, hydration, or translation API calls and have reciprocal locale metadata.

---

### Task 8: Add an automated SEO regression check

**Files:**

- Create: `scripts/check-seo.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Create tests/fixtures only if the script logic is non-trivial

**Step 1: Define the check contract**

Against a configured base URL, the script must check representative routes and sitemap entries for:

- Expected status.
- Redirects in sitemap.
- Canonical presence and uniqueness.
- Robots meta.
- H1 count.
- Empty title/description.
- Placeholder markers: `TODO_SOURCE_REQUIRED`, `draft guide`, `lorem`, `placeholder`.
- Locale alternates after Task 7.

Use Node built-ins and existing dependencies; do not add an SEO package unless the existing stack cannot perform the check.

**Step 2: Add the npm command**

Add a command such as:

```json
"seo:check": "node scripts/check-seo.mjs"
```

The script must accept an explicit base URL so CI can test a local build and operations can test production.

**Step 3: Add CI without hiding failures**

Run the SEO check after the production build/server is available. If current CI architecture cannot start the app cheaply, add the equivalent assertions to Playwright rather than fetching production from CI.

**Step 4: Commit**

```powershell
git add scripts/check-seo.mjs package.json .github/workflows/ci.yml
git commit -m "test(seo): add metadata and crawl regression gate"
```

**Acceptance:** A private sitemap URL, missing canonical, indexable auth page, or public placeholder content fails CI.

---

### Task 9: Launch the first 90-day content program

**Files:**

- Create: `docs/seo-content-strategy.md`
- Create/update content through the GEO CMS; do not bypass the publication gate
- Modify: `geo_article_links` through the existing admin graph workflow
- Update: `docs/current-status.md` after material workflow changes

**Step 1: Build four topic pillars from real query data**

Use Search Console plus customer/sales/support language to prioritize:

1. Scholarships by country, level, and subject.
2. Study costs, deadlines, visas, and planning.
3. University/program comparisons.
4. Application strategy: CV, personal statement, interviews, and evidence.

Do not select keywords from search volume alone. Score each idea:

- Customer impact: 40%.
- Product/content fit: 30%.
- Search potential: 20%.
- Resource requirement: 10%.

**Step 2: Prepare the initial topic set**

Validate with GSC before finalizing. Candidate topics:

- Học bổng du học Anh cho sinh viên Việt Nam.
- Chi phí du học Anh theo bậc học.
- Học bổng Data Science bậc thạc sĩ tại Anh.
- Lập kế hoạch application từ deadline.
- So sánh trường theo học phí, học bổng, and admissions fit.
- Checklist hồ sơ học bổng.

**Step 3: Apply the article publication template**

Every article must include:

- One primary search intent.
- A direct 40–60 word answer near the top.
- Comparison table, checklist, or numbered process where appropriate.
- Official sources with access/verification dates.
- Named author and reviewer.
- Honest `publishedAt` and `updatedAt`.
- Internal links to its pillar, related university pages, related articles, and one relevant product CTA.
- No invented outcomes, rankings, success rates, testimonials, or scholarship guarantees.

**Step 4: Build hub/spoke links**

Use the existing `geo_article_links` graph. Each spoke links to its hub; each hub links to all relevant spokes. Avoid orphan pages.

**Step 5: Publish on a measured cadence**

Begin with a small batch of fully reviewed articles. Review indexing and impressions before scaling. Do not mass-publish thin programmatic pages.

**Step 6: Commit documentation**

```powershell
git add docs/seo-content-strategy.md docs/current-status.md
git commit -m "docs(seo): define content clusters and editorial gates"
```

**Acceptance:** Every published article passes the quality gate, belongs to a documented topic cluster, and has at least one incoming and one outgoing relevant internal link.

---

### Task 10: Strengthen GlowBal entity and off-page authority

**Files:**

- Modify where verified information is missing: `src/app/about/page.tsx`
- Create if approved: public editorial/source policy pages
- Modify: homepage Organization JSON-LD through Task 5's shared helper
- Create: `docs/seo-entity-checklist.md`

**Step 1: Normalize brand identity**

Use `GlowBal` consistently across title, description, Organization schema, social profiles, and editorial bylines. Keep the positioning specific enough to distinguish GlowBal from similarly named businesses.

**Step 2: Connect confirmed profiles**

Add only official profiles to `sameAs`. Confirm each URL with the owner before shipping.

**Step 3: Publish trust information**

Ensure users and crawlers can find:

- Real company/team information.
- Contact route/details approved for public use.
- Editorial and source-verification policy.
- Author/reviewer expertise.
- Privacy and terms.

**Step 4: Prepare off-page actions**

Document non-code work:

- Partner/founder/university profile links.
- Relevant case-study links.
- Legitimate media/industry mentions.
- Link reclamation for old `/guides/...` URLs.

Do not buy links, fabricate profiles, or create fake reviews.

**Step 5: Commit**

```powershell
git add src/app/about src/app/page.tsx src/lib/seo docs/seo-entity-checklist.md
git commit -m "feat(seo): strengthen verified brand entity signals"
```

**Acceptance:** The website and confirmed third-party profiles use one brand name, one canonical domain, and matching descriptions of the product.

---

### Task 11: Verify, deploy, and monitor

**Files:**

- Modify: `docs/current-status.md`
- Modify: `docs/seo-baseline-2026-08-25.md` with post-deploy measurements
- Modify task-specific docs if commands, architecture, or known risks changed

**Step 1: Run all repository gates**

```powershell
npm run typecheck
npm run typecheck:strict
npm run lint
node scripts/check-i18n.mjs --all
npm run test
npm run build:ci
npm run verify:pr
```

Record exact results; do not claim a check passed if it was not run.

**Step 2: Run GitNexus change detection**

Before commit/PR completion, run GitNexus detect-changes and review affected flows. Investigate any HIGH or CRITICAL risk before handoff.

**Step 3: Validate production after deployment**

Check:

- `/robots.txt` returns `200` and references the correct sitemap.
- `/sitemap.xml` returns `200` and only contains valid canonical URLs.
- Every sitemap URL returns `200` without auth redirects.
- `/auth` and representative private routes are `noindex`.
- Public pages have one H1 and one self-canonical.
- News and entity structured data pass the relevant validator.
- EN/VI pages have reciprocal locale annotations after Task 7.

**Step 4: Update Search Console once**

- Resubmit the sitemap after the sitemap fix deploys.
- Use URL Inspection/request indexing only for the homepage and a small set of highest-priority corrected/new pages.
- Do not repeatedly request indexing; recrawl requests do not guarantee inclusion or ranking.

**Step 5: Monitor weekly for eight weeks**

Track:

- Eligible vs indexed URLs.
- Exclusion reasons.
- Impressions, clicks, CTR, and average position.
- Brand EN/VI query visibility.
- Top 20 non-brand queries.
- Organic landing pages.
- Mobile Core Web Vitals.
- Crawl/server errors.
- AI citations/mentions for the same priority query set, if that is a business goal.

Compare 28 days post-deploy with the baseline and account for seasonality. Do not treat a ranking fluctuation over a few days as a regression without supporting data.

**Step 6: Update durable project status**

Record shipped behavior, exact verification results, external production actions, remaining risks, and links to the SEO baseline/content strategy.

```powershell
git add docs/current-status.md docs/seo-baseline-2026-08-25.md
git commit -m "docs(seo): record deployment verification and monitoring"
```

**Final acceptance criteria:**

- Zero private/auth/draft URLs in sitemap.
- Zero public placeholder markers.
- 100% sitemap URLs return `200`, self-canonical, indexable content.
- All private route families are `noindex`.
- Public article metadata includes canonical and accurate publish/update dates.
- Vietnamese SEO pages are server-rendered with reciprocal `hreflang` before being submitted.
- Search Console baseline and post-deploy measurements are documented.
- All required CI checks pass.

---

## Recommended delivery sequence

Use separate PRs/checkpoints:

1. **SEO safety:** Tasks 1–4 — content gate, indexability, sitemap.
2. **Metadata and public landing quality:** Tasks 5–6.
3. **Vietnamese SEO architecture:** Task 7.
4. **Automation:** Task 8.
5. **Content and authority:** Tasks 9–10.
6. **Deployment measurement:** Task 11.

Do not combine Vietnamese route restructuring with the P0 sitemap/private-indexing fix. The P0 changes should be deployable and measurable independently.

## Actions requiring owner approval or access

- Search Console exports and URL Inspection.
- Any production `geo_articles` status/content change.
- The decision to make `/scholarships` public or explicitly noindex.
- Confirmed official social/profile URLs for Organization `sameAs`.
- Any public contact/company/legal details not already approved.
- Final editorial review of scholarship, tuition, visa, admissions, ranking, or deadline claims.

