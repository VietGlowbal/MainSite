# GLOWBAL News CMS — Design Spec

Status: **Phases 1–2 and 4 implemented. Phase 3 (the generation pipeline) was
removed on 2026-09-20** and is not coming back unless the owner asks.

> **What changed on 2026-09-20.** The owner retired the AI generator and its
> daily cron. Deleted: `scripts/geo/**`, `data/geo/**`, `content/geo/**`,
> `public/generated/news/**`, `geo.tsconfig.json`, every `geo:*` npm script,
> `.github/workflows/geo-content-pipeline.yml`, and the "Import from files"
> backfill (`POST /api/admin/news/import`, plus `listLegacyFileGuides()`).
> The five seeded markdown guides were all `status: draft`, which the public
> reader has always filtered out, so **no reader-facing page was lost**; the
> cron's only effect for its last 100+ runs was bumping `lastUpdated` by a day.
>
> What survives is the CMS: `geo_articles` is now the *only* source of /news,
> admins author in `/admin/news`, and **Section 7 below is historical** — read
> it as the plan that was dropped, not as how anything works.

## 1. Goal

Give admins an in-site editor to **create, edit, publish, archive, and delete**
GLOWBAL News articles ("GEO guides"), with non-admins fully locked out — and do
it in a way that **builds on the existing GitHub Actions GEO pipeline** rather
than replacing it, while opening the door to:

- publishing **many different GEO article types** over time, and
- **multi-article linking / hubs** so AI search engines (the "GEO" play) can
  better understand and surface GLOWBAL.

## 2. How the system works today

| Concern | Today |
| --- | --- |
| Storage | The `geo_articles` table (`sql/supabase-geo-cms.sql`). Hero images live in the `news-images` Supabase Storage bucket; a row with no `hero_image` falls back to `public/news/placeholder-cover.svg`. |
| Read path | `src/lib/geo-content.ts` reads `geo_articles` (published rows only); `/news` lists, `/news/[slug]` renders. Every read passes `hasPlaceholderPublicationQuality()` — see below. |
| Authoring | Admins write in `/admin/news`. There is no automated generation and no scheduled job. |
| Admin auth | `isAdmin(userId)` (env `ADMIN_USER_IDS` **or** `student_profiles.is_admin`); `/admin/*` gated server-side; admin writes use the service-role `createAdminClient()` |

The read-side placeholder gate is **not** dead weight now the generator is
gone: rows the pipeline wrote before 2026-09-20 outlived it, and two of them
were measured shipping "A Glowbal draft guide …" copy while marked `published`
(2026-08-25). `sanitizeContent()` exists for the same reason.

## 3. Target architecture — DB-backed canonical store

Move the **source of truth into Supabase**. The site reads from the DB
(with ISR + on-demand revalidation), so admin edits go live in seconds, and the
GEO pipeline writes generated drafts straight into the DB.

```
                ┌─────────────────────────────────────────┐
                │              Supabase (DB)                │
   admin CMS ──▶│  geo_articles        (canonical store)    │◀── GEO pipeline
   (in-site)    │  geo_article_links   (the GEO graph)      │    (service role)
                └───────────────┬───────────────────────────┘
                                │ read (published only, anon-readable)
                                ▼
                   /news (list)   /news/[slug] (article)
                   ISR + on-demand revalidation on publish/edit
```

Why DB-backed (vs git-committing from the editor):

- **Live edits** — no rebuild/redeploy round-trip for a typo fix.
- **RLS** gives a clean admin-only write boundary (published rows are the only
  thing the public can read).
- **The graph** (`geo_article_links`) is naturally relational and powers
  related-articles, topic hubs, and the internal-link structure GEO rewards.
- The pipeline still does all the hard generation work; it just `upsert`s into
  the DB instead of `git commit`ing files.

## 4. Data model

See `supabase-geo-cms.sql`. Two tables, mirroring the existing scholarships
migration conventions (guarded DDL, `touch_*_updated_at` trigger, published-read
+ service-role RLS).

### `geo_articles`
Canonical article. Key columns:

- `id uuid`, `slug text unique`, `title`
- `description`, `excerpt`, `key_takeaway`
- `body text` — markdown (same format the pipeline emits; rendered by the
  existing `ArticleBody` component)
- `topic`, `tags text[]`
- `hero_image`, `hero_image_style`
- `reading_time_minutes` (null → derived at read time)
- `meta jsonb` — preserves the richer `GeoPageMetadata` shape
  (`supportCards`, `supportAssets`, `toc`, `schema` blocks, `openGraph`,
  `canonicalUrl`, `pageType`, `heroImagePrompt`) without a column per field
- `status` (`draft|published|archived`), `source` (`manual|pipeline`)
- `pipeline_cluster_id` — provenance back to the topic cluster
- `author_id`, `published_at`, `created_at`, `updated_at`

### `geo_article_links` — the GEO graph
Directed, typed, weighted edges between articles:

- `relation`: `related | cluster | prerequisite | next | cites`
- `weight`: surfacing strength / ordering

This is the foundation for **multi-article linking / hosting**: related-article
rails, topic **hubs/pillars** (`cluster`), guided reading paths
(`prerequisite`/`next`), and citation edges (`cites`) that map onto schema.org
and strengthen the internal-link graph AI search crawlers reward.

### RLS
- Public (anon + authenticated) can `select` **published** rows only — articles
  must be crawlable by AI search, so unlike scholarships this includes `anon`.
- `service_role` has full access. Admin writes go through admin-gated API routes
  using `createAdminClient()`, so we deliberately **don't** add a per-row
  `is_admin` write policy — that also keeps env-bootstrapped admins
  (`ADMIN_USER_IDS`, who have no `student_profiles` row) working.

## 5. Editor UX

- `/admin/news` — list of all articles (any status) with status badges, a
  "Pipeline" marker for generated rows, and per-row Edit / Publish-Unpublish /
  Delete.
- `/admin/news/new` and `/admin/news/[id]/edit` — a single `ArticleEditor`:
  - Title (auto-suggests slug), editable slug, subtitle/dek, key takeaway,
    Markdown body (with live reading-time estimate), topic, status, tags,
    excerpt, hero image URL.
  - "Advanced metadata (JSON)" escape hatch that round-trips the `meta` blob, so
    pipeline-authored richness (support cards, TOC, schema) is never lost when an
    admin edits.
  - "Save" and "Save & publish".
- Workflow: `draft → published → archived`, freely reversible. `published_at` is
  stamped by the DB trigger the first time a row goes live.

## 6. API surface (this PR)

All guarded by `isAdmin()`; writes via the service-role client in
`src/lib/geo-cms.ts`.

| Method | Route | Action |
| --- | --- | --- |
| GET | `/api/admin/news` | list all articles |
| POST | `/api/admin/news` | create |
| GET | `/api/admin/news/:id` | fetch one |
| PATCH | `/api/admin/news/:id` | update / change status |
| DELETE | `/api/admin/news/:id` | delete |

## 7. GEO pipeline integration (Phase 3) — DROPPED 2026-09-20

> Historical. The pipeline this section integrates with no longer exists, and
> `geo:sync-db` was never built. Kept as the record of a design that was
> considered and abandoned, so nobody re-derives it by accident.

The pipeline kept `geo:questions → cluster → draft → sources → quality →
images → metadata`. The only change is the publish step:

- Replace the `git add … && git commit` step with a `geo:sync-db` script that
  **upserts** each generated draft into `geo_articles` (by `slug`), setting
  `source='pipeline'` and `pipeline_cluster_id`, mapping `GeoPageMetadata` →
  columns + `meta`.
- Quality gates map to `status`: `publishable → published` (if
  `config.directPublishToSite`), otherwise `draft` for human review in the CMS.
- The existing markdown/JSON files become an **export** artifact (or are dropped
  once the DB is canonical). `createContentPR.ts` remains available for teams who
  prefer PR review over direct DB publish.
- Hero/support image generation still writes to `public/generated/news/…`; the
  DB stores the resulting URLs. (Phase 4 can move uploads to Supabase Storage.)

A `geo:sync-db` upsert keeps the pipeline idempotent: re-runs update existing
rows by slug instead of creating duplicates, and never clobber an admin's manual
edits if we guard on `source='pipeline'`.

## 8. Read-path cutover (Phase 2 — DONE in this PR)

- `src/lib/geo-content.ts` now reads **DB-first, file-fallback**: `listGeoGuides`
  / `getGeoGuide` / `listGeoTopics` / `listRelatedGeoGuides` are async and merge
  published `geo_articles` rows over the legacy file guides (DB wins by slug).
  Any DB failure (no env at build, table not migrated) degrades gracefully to
  files, so `next build` without Supabase env still works.
- `/news` and `/news/[slug]` are ISR (`export const revalidate =
  300`); `generateStaticParams` enumerates DB + file slugs and new slugs render
  on-demand.
- The admin API calls `revalidatePath('/news' | '/news/:slug')` on
  create / update / delete, so edits appear within seconds without a redeploy.
- `sitemap.ts` is async and includes DB-published slugs.

## 9. Backfill / migration (Phase 3 — partially DONE in this PR)

**Removed 2026-09-20 — nothing left to back-fill.** The "Import from files"
button and `POST /api/admin/news/import` read the markdown guides, and those
files are gone. Rows already imported from them are untouched and still live in
`geo_articles`.

`upsertArticleBySlug` itself is still used by the CMS write path, and still
**never clobbers** an admin-authored row (`source='manual'`) — those return
`skipped`, so human edits always win.

## 10. Multi-article linking / GEO hosting (Phase 4 — DONE in this PR)

- **Link-management UI**: the editor (edit mode) has a "Linked articles (GEO
  graph)" panel — pick a target article + relation
  (`related`/`cluster`/`next`/`prerequisite`/`cites`), add/remove edges, save.
  Backed by `GET`/`PUT /api/admin/news/:id/links` and
  `listLinksForArticle` / `replaceArticleLinks`.
- **Public usage**: `/news/[slug]` "Related articles" now prefers the explicit
  graph (`listLinkedPublishedGuides`, weight-ordered) and falls back to the
  topic heuristic when an article has no edges yet.
- **schema.org**: each article page emits JSON-LD (`Article` + `BreadcrumbList`,
  plus a passthrough `FAQPage` from `meta.schema.faq`), with `relatedLink`
  pointing at the linked guides — explicit structure for AI search.

Remaining Phase 4 nice-to-haves (not in this PR): dedicated topic **hub pages**
rendered from `cluster` edges, and moving hero/support image uploads to Supabase
Storage so they happen in-editor rather than via the pipeline's filesystem.

## 11. Security

- Every write path re-checks `isAdmin()` server-side (never trust the client).
- RLS denies the public any non-published row even if an endpoint were misused.
- Service-role key stays server-only (`src/lib/geo-cms.ts` is never imported
  into a client component).
- Markdown is rendered by the existing `ArticleBody` sanitiser; admin-authored
  HTML follows the same path as pipeline content.

## 12. Phased rollout

1. **Phase 1 (this PR)** — schema + RLS, admin CMS list + editor + CRUD API,
   admin tab.
2. **Phase 2 (this PR)** — DB read path (DB-first, file-fallback) + ISR +
   on-demand revalidation. Articles created/published in the CMS now appear on
   the live `/news` pages.
3. **Phase 3 (partly this PR)** — admin "Import from files" backfill shipped;
   remaining: a headless `geo:sync-db` step in the GitHub Actions pipeline.
4. **Phase 4 (this PR)** — link-graph editor + API, graph-driven related rails,
   schema.org JSON-LD. Remaining: topic hub pages + Storage image uploads.

> Phases 1–2 are backwards-compatible: with no DB rows, the site renders exactly
> the file-based content it does today; the DB layer only ever *adds* or
> *overrides* by slug.
