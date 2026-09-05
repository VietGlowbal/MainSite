# docs/ — project context and session handoff

Routing guidance refreshed on **2026-08-13** so a fresh coding session can find
the current implementation, latest completed work, impact, and verification
state without re-deriving them. If these files contradict the code, the code
wins. Point-in-time plans and audits are labelled as such and must not be
mistaken for a live status board.

The durable handoff is [current-status.md](current-status.md). Update it after
material work; keep detailed design history in the topic-specific documents.

**Two facts worth more than the rest of this pack:**

1. The Figma file has **three** canvases and Figma's own page index lists only
   two. Building from the wrong one has already cost a rebuild. See the top of
   [redesign-status.md](redesign-status.md) before picking a frame.
2. **Verify claims about the database against the database — and *enumerate*,
   never guess at names.** Three sessions have now burned the owner's time here:
   two by trusting a `.sql` file or a stale to-do instead of querying, and one by
   probing three invented table names, missing on all three, and reporting that
   the course catalogue did not exist. It did. Do not preserve a table count in
   prose; enumerate the current schema with one call — **`/db-schema` runs this
   for you** and also prints the per-table column and row-count variants:

   ```bash
   node --env-file=.env.local -e "const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SERVICE_ROLE_KEY;fetch(u+'/rest/v1/',{headers:{apikey:k}}).then(r=>r.json()).then(d=>console.log(Object.keys(d.definitions).sort().join('\n')))"
   ```

   ⚠️ **`jq` is not installed on this machine.** This line used to carry a
   `curl … | jq` pipeline that could never have run here; it was replaced on
   2026-08-15 after being verified live (93 tables). Do not reintroduce `jq`
   into a documented command without checking it exists.

   See [known-issues.md §0](known-issues.md) for the migration trap and
   [§1a](known-issues.md) for the guessing one.

   The REST spec above answers table shape, row counts and RLS *behaviour*, but
   not policy text, indexes, or `pg_proc` grants. For those run
   [`sql/introspect.sql`](../sql/introspect.sql) in the Supabase SQL editor — one
   read-only statement returning a single JSON cell, safe on production — and
   paste the result back.

   **It was run on 2026-09-05T16:26Z and the results are written up in**
   [`audit-2026-09-05-database.md`](audit-2026-09-05-database.md) **§2 and §4.**
   Headline: 0 of 108 tables have RLS disabled, 0 of 5 views lack
   `security_invoker`, 0 of 31 definer functions has an unpinned `search_path`,
   and no policy anywhere uses the weak `USING (auth.uid() IS NOT NULL)` form.
   That run also **closed [known-issues.md §0g](known-issues.md)**, which had
   stood at "🔴 OPEN, most urgent item in this file" on the belief that the RPC
   hardening migration had never been applied — `pg_proc.proacl` shows it had.
   Re-run the file rather than trusting these numbers if the date matters. **Do not conclude a function is locked down from the
   `REVOKE` in a `.sql` file:** several files in `sql/` were never applied
   (2026-09-05: `add_selected_courses_to_apply` is defined in the repo and absent
   from the live database). Grants live in `pg_proc.proacl`, not in the repo.

   ⚠️ **The migrations moved on 2026-09-05.** The 95 `supabase-*.sql` files that
   lived at the repo root are now in [`sql/`](../sql/). The PreToolUse guard
   matches on filename, so it still fires; prose elsewhere in this repo may still
   name them without the `sql/` prefix.

## Read order

Use this table as a router: load the smallest set of documents needed for the
task. Search the durable status file for the affected feature instead of reading
unrelated history end to end.

| File | Read it when |
|---|---|
| [current-status.md](current-status.md) | Search first for the affected feature, recent work, verification, risks, and resume point. Read it end to end only for broad audits or session handoffs. |
| [feature-2-plan.md](feature-2-plan.md) · [strategy-reports-spec.md](strategy-reports-spec.md) | Before touching any of the four Strategy reports. The plan is the sequenced twelve-part breakdown with the owner's decisions recorded; the spec carries the F5 weights, the classification rule, the report layouts and a build-status table of what is and is not implemented. |
| [plans/2026-08-23-feature-2-parts-5-9-execution-v2.md](plans/2026-08-23-feature-2-parts-5-9-execution-v2.md) | **Before executing any Parts 5–9 work** (Planner mobile/reminders, GenUI task UI, CV/Essay consolidation, Final Check gaps). Active wave plan post-PR #216 merge, with the READY/GATE/BLOCKED matrix and the open owner questions. |
| [redesign-status.md](redesign-status.md) | When changing a route or comparing it with Figma. It is the route/frame decision ledger, not the primary current-status file. |
| [known-issues.md](known-issues.md) | Before touching `/universities`, `/my-universities`, `/mentors`, saving, auth — **or any `sql/supabase-*.sql` file**. §0 is the migration trap; §1b is the mentorship RLS gap. |
| [design-system.md](design-system.md) | Before writing any component. Token names, the primitives that already exist. |
| [performance.md](performance.md) | Before touching `lib/i18n*`, the nav headers, or anything you expect to change bundle size or Core Web Vitals. Carries the measured baseline, **the rule that `i18n-catalog` must never be statically imported from client-reachable code**, and the two theories (the globe, the fonts) that measurement already ruled out. |
| [architecture.md](architecture.md) | Before adding a file under `features/`, `shared/`, or `server/`. |
| [verification.md](verification.md) | Before claiming anything works. Commands, the latest measured local baseline, CI behavior, and how to see gated pages. |
| [audit-2026-08-03.md](audit-2026-08-03.md) | For the security/operations audit evidence. It is a dated snapshot; use its revalidation banner before quoting a finding as current. |
| [audit-2026-09-05-database.md](audit-2026-09-05-database.md) | Before touching RLS, an RPC, a `sql/supabase-*.sql` file, or anything schema-shaped. Full map of the 113 live relations, measured RLS posture per table, the `achiever_profiles` mentor-PII exposure, and the case for a migration baseline. Dated snapshot — re-measure before quoting. |
| [plans/](plans/) and the `*-design.md` files | For original intent and decisions. Their headers say whether implementation completed and where it landed. |

## Root-level documents this router does NOT cover

Fourteen `.md` files sit at the repository root. They predate `docs/` and none
of them is a live status board — several are point-in-time implementation
summaries whose claims have not been reconciled since they were written. Do not
read them speculatively; open one only when the row below matches your task.

| Root file | Open it when |
|---|---|
| `README.md`, `SETUP.md` | Environment, install, env vars, running locally. `SETUP.md` is the fuller one. |
| `AGENTS.md`, `CLAUDE.md` | Always loaded automatically — no need to open them. |
| `ADMISSION_FIT_FEATURE.md` | Changing reach/recommend/safe tiering or `src/lib/admission-fit.ts`. |
| `GEO_CMS_SPEC.md` | Working on the GEO/news CMS or the `geo:*` npm scripts. |
| `UNIVERSITY_CRONS.md` | Touching university data crons or refresh scheduling. |
| `NEWSLETTER_*.md` (5 files) | Newsletter work only. `NEWSLETTER_SYSTEM.md` is the entry point; the other four are architecture, deployment checklist, an implementation summary, and an end-user guide. Read one, not five. |
| `MENTORSHIP_REDESIGN.md` | Historical redesign summary. `known-issues.md §1b` is the live mentorship record — prefer it. |
| `TECH_SOLUTION.md` | Original solution overview. Predates the FSD migration; treat as intent, not current architecture. |

`.kiro/specs/` holds four older feature specs (`ai-application-strategy`,
`ai-course-selector`, `ai-strategy-dashboard`, `university-explorer`). They are
requirement/design/task documents from an earlier planning tool, not a status
board — `.kiro/specs/ai-course-selector/tasks.md` alone is 1,678 lines. Consult
them for original intent only.

## Things NOT written here, on purpose

- **Product brief, tech stack, Figma coding rules** → `CLAUDE.md`; verify version
  claims against `package.json` before relying on them.
- **The FSD boundary rules as enforced** → `eslint.config.mjs`. It is the authority; `architecture.md` only explains the intent.
- **Token values** → `src/styles/tokens.css`. It is the authority; `design-system.md` lists names, not numbers.

## Figma

- **File key:** `SQ74qw05FiTg5NivzY8Djv` — confirmed live 2026-08-01 from a URL
  the owner supplied. The file is named "GLOWBAL - Edtech (Copy)".
  URL shape: `https://figma.com/design/SQ74qw05FiTg5NivzY8Djv/...?node-id=<a>-<b>`
  ⚠️ **FIVE stale keys have now been recorded in this repo.** None resolve:
  `5Ip9znpaxp6RVByU7Qr35l` (believed live on 2026-07-31 — this line said so),
  `Ut5pryBVlc1MpxI4IrnkIm` (believed live on 2026-07-28 — this line said so
  then, too), `oveiFvtHONGfkZwXqfmPKc` (an earlier version of THIS file,
  believed live on 2026-07-27), `aGN2e7Ms9HpD5EdUSydowr` (older still), and
  `4gHWPze5ngIizbTtujEcQL` (still in the header comment of
  `src/styles/tokens.css`). **The key moves roughly every time the owner sends a
  link.** Do not trust this line either — take the key from whatever URL they
  paste. The canvas node ids have been stable across all of them.
- **Canvases — there are THREE, and Figma's page index lists only two:**

  | Canvas | Node | Role |
  |---|---|---|
  | **Khanh Linh - Chi** | **`375:9842`** | **Authoritative.** 58 top-level frames. |
  | UI Final - Dev | `104:2941` | What the code was built from. 37 frames. |
  | Tính năng | `32:1997` | Older superset, 76 frames. Retired. |

  ⚠️ `375:9842` **does not appear** when `get_metadata` is called without a
  `nodeId` — that lists only the other two. You will not find this canvas by
  browsing; pass the node id directly.

  ⚠️ On the 2026-08-01 key the owner's links point at **`375:9843`**, a
  *section* named "Dev" that wraps the same 58 frames. `get_metadata` on it
  returns 1.3M characters — too large to read back, so it lands in a
  `tool-results` file. Parse that file rather than re-requesting: it is one JSON
  array of `{type, text}`, and joining the `text` fields gives the whole canvas
  as indented XML you can grep for a frame name offline. That is the cheapest
  way to find a node id in this file and costs one MCP call.

  `375:9842` is a superset of `104:2941`: on 2026-07-28 every frame the code had
  already been built from was **byte-identical** across the two. Only four
  frames differ and roughly eighteen are net-new. The per-frame comparison is in
  [redesign-status.md](redesign-status.md); do not redo it.
- ⚠️ The sitemap frame (`123:2864`, "Dg-final") **no longer exists in the file**
  — see known-issues.md §6.1.
- **Per-frame node ids:** see [redesign-status.md](redesign-status.md).
- ⚠️ **The Figma MCP server is rate-limited on the owner's Education plan.**
  A session doing frame-by-frame work will exhaust it — budget the calls:
  `get_metadata` on a whole canvas costs one call and answers most structural
  questions offline (the response is written to a file you can parse), whereas
  one `get_screenshot` per frame burns the allowance fast.

## Workflow that worked for design → code

1. `get_metadata` on the frame first — cheap, gives structure and child node ids.
2. Load the `figma-design-to-code` skill, then `get_design_context` on the
   *smallest* node you need (a card, not the page). Whole-page calls are large
   and mostly repeat the chrome.
3. Icons: `curl` the asset URL, read the SVG, add the path data to
   `ICONS`/`BRAND_ICONS` in `src/shared/ui/icons.tsx`. Do not hand-draw icons and
   do not commit the remote URL — it expires in ~7 days.
4. Map everything else onto `src/shared/ui` primitives before writing new markup.

## Judgment calls that kept recurring

These came up on nearly every frame. They are not style preferences — each one
was a decision to ship something different from the mockup, and each is recorded
in a comment at the top of the file that made it.

- **Never ship fabricated content.** The Untitled UI kit fills frames with fake
  testimonials, fake bylines ("Olivia Rhye"), and claims like "offices around the
  world". Attaching those to real universities is a false statement about the
  product, not lorem ipsum. Ship the layout, show `MissingContent`, and ask.
- **Never build a control with no backend.** Two dead controls were removed from
  `/auth` (remember-me, forgot-password) and one was omitted from the scholarship
  dialog (the redeem-a-code field — no voucher concept exists in the schema).
- **Prefer data over hardcoded lists.** The blog's category tabs come from
  `listGeoTopics()`, not the frame's five fixed strings; a tab with no posts
  behind it is a dead control.
- **Real data breaks mockup geometry.** Every frame assumes every field is
  present and short. Real rows have null rankings, missing images, and deadlines
  that are prose paragraphs. Clamp, set a min-height, and keep the prose rather
  than mangling it.
- **A frame name is not a schema.** "Chi tiết voucer" on `337:19349` reads like a
  redeem-a-code dialog and is not one — every field on it maps to a real
  `scholarships` column. Check the actual table before assuming a frame hits the
  same wall a similarly-named one did.
- **A public directory should not need an account to render.** `achiever_profiles`
  had no public-read RLS policy, so the mentor directory was silently empty for
  every signed-out visitor — an RLS filter is not an error, so nothing surfaced
  it. If a page is reachable from the guest nav, verify it against the anon key,
  not just a signed-in session.
- **Rebuilding a page's chrome is not enough on its own.** A page that ships its
  own `TopNav`/`MobileNav`/`Footer` still needs adding to `OWN_CHROME_ROUTES` in
  `src/components/nav-reveal.tsx`, or the legacy app sidebar renders on top of
  it. Screenshot the finished page before calling it done — this is easy to miss
  in a diff and obvious in a render.
- **A frame can be broken, and copying it faithfully then ships the break.** The
  mentor profile's calendar (`375:21725`) is a stretched component instance whose
  date grid wrapped to **ten** columns under a seven-label weekday header, so
  dates no longer sit under their weekday. Its booking section also carries the
  heading from the section two blocks above it. Neither is a design decision.
  When geometry contradicts what the component *is*, rebuild the behaviour and
  write down why.
- **Check what the API requires before trusting the frame's flow.** That same
  page's "Đặt lịch ngay" goes straight from slot to payment, but
  `POST /api/mentorship/checkout` refuses a booking without `help_topic` — the
  one field telling the mentor what to prepare. The gap is the design's, not the
  API's; the fix is to ask for it, never to invent a value that satisfies a
  validator.
- **Never edit a migration that has already been applied.** `ADD COLUMN IF NOT
  EXISTS` matches names, not types, so re-running it can never repair a wrong
  column. Add a guarded follow-up instead — [known-issues.md §0](known-issues.md).
- **Crawled data is not editorial data.** `catalog_programmes`, `courses` and the
  `crawl_*` tables are AI-extracted: names run to 154 characters of concatenated
  facets, `verification_status` is `NEEDS_REVIEW` on 96% of rows *by default*
  (it is not a warning), and the same subject appears at several degree levels.
  Shape it before it reaches a student, and shape it by measuring the whole
  table rather than the four rows on your screen — see
  [known-issues.md §1a](known-issues.md).
