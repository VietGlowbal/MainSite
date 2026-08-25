# SEO baseline — 2026-08-25

Working baseline for `docs/plans/2026-08-25-seo-improvement-implementation-plan.md`.
Every claim below names its source and date. No unrun check is marked passing.

## Search Console export

**BLOCKED: GSC access required.** No Search Console property export (Search
Results, page indexing, sitemaps, CWV, manual actions) was available to this
session. Query cohorts, index coverage counts, and CWV numbers are therefore
NOT recorded here — do not invent them. Revisit this section when the owner
grants GSC access; the plan's Task 1 steps apply unchanged.

## Production observations (measured by the plan author, 2026-08-25)

Source: the implementation plan §0, verified against the live site on
2026-08-25 before this document existed.

- `/`, `/robots.txt`, and `/sitemap.xml` return `200`.
- `robots.txt` allows crawling and references the canonical sitemap.
- The sitemap contains **115 URLs**, including `/apply`, which redirects to
  `/auth?redirect=%2Fapply`.
- The auth destination is `index, follow` with no canonical and no H1.
- Sitemap timestamps are generated with `new Date()` at request time, not from
  content update dates.
- Public news articles emit no self-canonical metadata.
- At least one public article exposes draft-quality description/content.
- `<html lang="en">` is the default; Vietnamese is client-side only
  (`LanguageProvider`/`DomTranslator`), not an indexable URL.

## GEO news source audit (measured live, read-only REST queries, 2026-08-25)

Enumerated with the service-role key via PostgREST (never guessed names):
`geo_articles` columns are `id, slug, title, description, excerpt,
key_takeaway, body, topic, tags, hero_image, hero_image_style,
reading_time_minutes, meta, status, source, pipeline_cluster_id, author_id,
published_at, created_at, updated_at`.

Rows (5 total, newest first):

| status | source | slug |
|---|---|---|
| draft | pipeline | uk-computer-science-comparison-for-vietnamese-undergraduate-applicant |
| **published** | pipeline | uk-cost-guide-for-vietnamese-undergraduate-applicant |
| **published** | pipeline | uk-data-science-scholarship-guide-for-vietnamese-master-s-applicant |
| draft | pipeline | computer-science-comparison-for-vietnamese-undergraduate-applicant |
| draft | pipeline | best-uk-computer-science-degrees-for-vietnamese-students-in-2027 |

Findings:

1. The public draft-quality articles come from **DB rows marked `published`
   with `source='pipeline'`** — not from the legacy file fallback and not from a
   stale deployment. Both published rows carry the generator placeholder copy
   "A Glowbal draft guide for vietnamese … applicant" in `description` and
   `excerpt`.
2. Both published rows' `body` fields contain **zero** `TODO_SOURCE_REQUIRED`
   markers (the pipeline sanitizer already strips those tokens), so the
   draft-quality signal lives in the description/excerpt text, not in leftover
   body markers.

Remediation recommendation per plan Task 2 Step 6 (owner approval required for
any production row change): rewrite + republish both slugs at the same URL if
the topics are worth keeping; otherwise archive until an evidence-backed
rewrite exists. No production row was modified during this work.

## Code-side state before this plan (measured in-repo, 2026-08-25)

- `src/lib/geo-content.ts` already filters non-published rows out of every
  public reader (`listGeoGuides`, `getGeoGuide`) and prefers the DB over legacy
  files by slug.
- The admin publish transition already runs a checklist validator
  (`validateArticleForPublish`: title/description/body/topic/hero/alt), but it
  has no placeholder or unverified-claims checks.
- `src/app/universities/[id]/page.tsx` already emits a self-canonical;
  `/news/[slug]` and `/mentors/[id]` did not.
- Root layout sets `metadataBase` from `SITE_URL`
  (`https://glowbal-education.com`, owner-confirmed 31/07).

## Follow-ups recorded but not done here

- Private route families outside the plan's layout list (`/my-universities`,
  `/writer`, `/coordinator`, `/payment/*`, `/plus/*`) still rely on signed-out
  redirects rather than explicit noindex metadata; Googlebot is always
  signed out, so it only ever meets their redirect targets.
- Vietnamese server-rendered routes (plan Task 7) are intentionally NOT started
  in this pass; they gate on Tasks 2–6 being green and deployable first.
