# University data crons

Two scheduled jobs keep the universities list fresh. Both run on **Vercel Cron
Jobs** (configured in `vercel.json`) and are protected by `CRON_SECRET`.

## 1. Image refresh — `/api/cron/university-images`

Fills in missing `image_url` / `logo_url` on universities. Most rows ship with
empty image links; this resolves a campus/city hero image and a logo from
Wikipedia / Wikidata / Commons (reusing `src/lib/wiki-images.ts`) and writes them
back.

- **Schedule:** daily at 03:00 UTC.
- **Idempotent:** only touches rows still missing an image or a logo, and never
  blanks an existing value.
- **Throttled:** processes up to 40 rows per run (`?limit=`, max 100) to stay
  within the function timeout and be gentle on the Wikipedia APIs. Over a few
  runs it backfills the whole table, then has nothing left to do.
- **Status:** ✅ Ready to use — the only dependency (Wikipedia) is reachable.

Manual run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://glowbal-education.com/api/cron/university-images?limit=100"
```

## 2. Discovery — `/api/cron/discover-universities`

Finds universities we don't have yet and adds them, tagged `source='auto'` for
review. Uses the free [Hipolabs universities dataset][hipolabs] (no API key).

- **Schedule:** weekly, Mondays at 04:00 UTC.
- **Disabled by default.** It is inert until you set
  `ENABLE_UNIVERSITY_DISCOVERY=true`, so scheduling it can never silently dilute
  the curated list.
- **Conservative:** only inserts names not already present (case-insensitive),
  capped at 25 per run, restricted to the countries in
  `UNIVERSITY_DISCOVERY_COUNTRIES` (defaults to GlowBal's core destinations).
- **Caveat — data quality:** Hipolabs only provides a name + country + domain.
  Discovered rows therefore have **no rankings, tuition, strengths, or editorial
  copy** — they're intentionally sparse until enriched, and they appear in the
  live search immediately once added. They're tagged `source='auto'` so you can
  build a review queue (`select * from universities where source = 'auto'`).
- **Status:** ⚠️ Scaffolded and safe, but **off** pending a decision on the data
  source + whether auto-added rows should publish straight to search or sit in a
  review state first. (The Hipolabs endpoint was unreachable from the dev
  sandbox; it should work from Vercel, but confirm before enabling.)

[hipolabs]: https://github.com/Hipo/university-domains-list

## Environment variables

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Vercel injects this and sends it as `Authorization: Bearer …` to cron routes. Set it in Project → Settings → Environment Variables. |
| `SUPABASE_SERVICE_ROLE_KEY` | Already configured; also accepted as a bearer token for manual runs. |
| `ENABLE_UNIVERSITY_DISCOVERY` | Set to `true` to turn on the discovery cron. Omitted/`false` = inert. |
| `UNIVERSITY_DISCOVERY_COUNTRIES` | Optional, comma-separated list of countries to discover (e.g. `United Kingdom,Vietnam,Singapore`). |

## Database

Apply `supabase-university-source.sql` once in the Supabase SQL editor to add the
`source` column used by both the discovery cron and the mentor-signup
"add my university" flow. The crons fall back gracefully if it isn't applied yet,
but the review queue depends on it.
