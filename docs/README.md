# docs/ — session handoff notes

Written 2026-07-26 at the end of the Figma redesign push, updated through
2026-07-30, so a fresh session can skip re-deriving what a previous one already
established. **Not product documentation** — `AGENTS.md` bans that, and these
files exist because the owner asked for a handoff pack. If they ever contradict
the code, the code wins.

**Two facts worth more than the rest of this pack:**

1. The Figma file has **three** canvases and Figma's own page index lists only
   two. Building from the wrong one has already cost a rebuild. See the top of
   [redesign-status.md](redesign-status.md) before picking a frame.
2. **Verify claims about the database against the database.** Two separate
   sessions have now burned the owner's time by trusting a `.sql` file or a
   stale to-do instead of querying — most recently four pointless re-runs of a
   migration that could never have worked. See
   [known-issues.md §0](known-issues.md), which includes the one-liner that
   reads live column types.

## Read order

| File | Read it when |
|---|---|
| [redesign-status.md](redesign-status.md) | **Always first.** What is rebuilt, what is still legacy, which Figma node maps to which route. |
| [known-issues.md](known-issues.md) | Before touching `/universities`, `/my-universities`, `/mentors`, saving, auth — **or any `supabase-*.sql` file**. §0 is the migration trap; §1b is the mentorship RLS gap. |
| [design-system.md](design-system.md) | Before writing any component. Token names, the primitives that already exist. |
| [architecture.md](architecture.md) | Before adding a file under `features/`, `shared/`, or `server/`. |
| [verification.md](verification.md) | Before claiming anything works. Commands, baselines, how to see gated pages. |

## Things NOT written here, on purpose

- **Product brief, tech stack, Figma coding rules** → `CLAUDE.md`. Still current.
- **The FSD boundary rules as enforced** → `eslint.config.mjs`. It is the authority; `architecture.md` only explains the intent.
- **Token values** → `src/styles/tokens.css`. It is the authority; `design-system.md` lists names, not numbers.
- **The launch plan** → `LAUNCH_PLAN.md` (untracked, at repo root).

## Figma

- **File key:** `Ut5pryBVlc1MpxI4IrnkIm` — confirmed live 2026-07-28 from URLs
  the owner supplied. The file is named "GLOWBAL - Edtech (Copy)".
  URL shape: `https://figma.com/design/Ut5pryBVlc1MpxI4IrnkIm/...?node-id=<a>-<b>`
  ⚠️ **THREE stale keys have been recorded in this repo.** None of them resolve:
  `oveiFvtHONGfkZwXqfmPKc` (an earlier version of THIS file, believed live on
  2026-07-27), `aGN2e7Ms9HpD5EdUSydowr` (older still), and
  `4gHWPze5ngIizbTtujEcQL` (still in the header comment of
  `src/styles/tokens.css`). The key moves. Verify against the owner's URL rather
  than trusting any of these, including the one above.
- **Canvases — there are THREE, and Figma's page index lists only two:**

  | Canvas | Node | Role |
  |---|---|---|
  | **Khanh Linh - Chi** | **`375:9842`** | **Authoritative.** 58 top-level frames. |
  | UI Final - Dev | `104:2941` | What the code was built from. 37 frames. |
  | Tính năng | `32:1997` | Older superset, 76 frames. Retired. |

  ⚠️ `375:9842` **does not appear** when `get_metadata` is called without a
  `nodeId` — that lists only the other two. You will not find this canvas by
  browsing; pass the node id directly.

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
