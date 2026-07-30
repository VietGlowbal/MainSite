# Redesign status — route by route

As of 2026-07-28, branch `feat/UI-redesign`. 58 `page.tsx` files.

"Rebuilt" means: built from a Figma frame, 0 legacy class names in the page's own
files, tokens only, and verified (see [verification.md](verification.md)).

---

## ⚠️ Read this before picking a frame: the file has THREE canvases

| Canvas | Node | Top-level frames | Role |
|---|---|---|---|
| **Khanh Linh - Chi** | **`375:9842`** | **58** | **Authoritative as of 2026-07-28.** |
| UI Final - Dev | `104:2941` | 37 (≈28 screens) | What most of the code was built from. |
| Tính năng | `32:1997` | 76 (63 screens) | Older superset. Retired. |

`375:9842` is **invisible to Figma's page index** — `get_metadata` with no
`nodeId` returns only the other two. Pass the node id directly.

The designer migrates flows onto the newest dev canvas, and **migration means
redraw, not copy** — that has cost work once already:

> `/my-universities` was built from `223:8824` + `223:13022` on **Tính năng**.
> Those screens later migrated to UI Final - Dev as `337:18493` + `337:19141`.
> The migrated pair is **172px taller** and gained two dialogs that do not exist
> on the old canvas at all.

**But the `104:2941` → `375:9842` step was not a redraw.** The two canvases were
compared node by node (names, sizes, nesting) on 2026-07-28. Every frame the
code had already been built from is byte-identical on the new canvas:
`/universities`, `/auth`, `/apply`, `/my-universities`, both scholarship
dialogs, the major picker, and onboarding câu 1–5, 8, 9. **Do not re-derive
this, and do not re-do those pages.**

### The four frames that DID change

| Frame | `104:2941` → `375:9842` | Change | Status |
|---|---|---|---|
| Home | `104:7113` → `375:9844` | New scholarship-first hero; metrics 4 → 5 items with real figures; one nav label | **done 28/07** |
| Signed-in nav | `203:12356` → `375:10151` | 5 items → 4; "AI lên chiến lược" → "Lên Chiến lược Du học" | **done 28/07** |
| Onboarding câu 6 | `107:11086` → `375:11536` | +222px: gained an open multi-select (curriculum, then grading scale), each with Reset / Select all | **done 28/07, reworked 30/07** — see below |
| Onboarding câu 7 | `107:11165` → `375:11616` | +444px: English proficiency + score, then standardized test + score | **done 28/07, scores validated 30/07** |

Câu 9 differs only by `symbol` → `instance` on a flag graphic. Not a real change
— and it is now **deleted** anyway (owner, 30/07).

### The two net-new clusters

Both carry banner frames naming them:

- **`375:18836` "Apply"** — the `/ai-strategy` flow, redrawn from Tính năng onto
  the dev canvas, which by the rule above makes it safe to build. Stepper:
  *Reflection → Output report design → University Detail → Applycation Strategy
  → Submit Audit*. 18 frames; the node list is in
  [nav-items.tsx](../src/features/marketing/ui/nav-items.tsx).
- **`375:21186` "TÌM CỐ VẤN"** — `/mentors` (`375:21189`, unchanged in substance
  from the 154:8345 the browse page was built from) plus a **net-new
  `/mentors/[id]`** (`375:21633`).

---

## Rebuilt

| Route | Figma | Canvas | Notes |
|---|---|---|---|
| `/universities` | `105:8300`, `105:8247` | UI Final | Globe dropped for a flat filterable grid (owner's call). Kept `explorer-context` verbatim. **Cards navigate to `/universities/[id]` as of 30/07** — `detail-view.tsx` is deleted, see §Wiring below. Only 3 of 6 filter chips ship — the rest need DB columns that do not exist. |
| `/auth` | `105:8004`, `105:8037` | UI Final | Centered card, login + signup. All Supabase branches preserved. |
| `/onboarding` | `107:10574` + câu 1–8, plus `375:11536`/`375:11616` | mixed | **EIGHT steps since 30/07** (was nine). Câu 6 and câu 7 — the academic screens — sit at positions 6 and 7. ⚠️ **`supabase-academic-intake.sql` must be run before this ships**; it was extended on 30/07 and is safe to re-run. See the three owner decisions below. Câu 8 (awards) is still not built; it duplicates the /ai-strategy achievements input and nobody has decided which owns it. |
| `/apply` | `337:18767` | UI Final | **"My application".** Progress donut banded by `progress_percentage`, deadline, "Continue applying" → `/apply/[applicationId]`. Replaced the 1,455-line `apply-dashboard.tsx`. |
| `/my-universities` | `223:8824`, `223:13621`, `223:13022` + `337:19349` | mixed | Saved list. Base built from Tính năng, **so it is already behind `337:18493`**. The scholarship detail panel is built from the migrated `337:19349`. |
| `/mentors` | `154:8345` | **Tính năng** | Search + 4-across card grid. ⚠️ Not yet migrated — expect a pass when it is. |
| `/about` | `153:11401` | **Tính năng** | Net-new route. Real team from `lib/team.ts`. ⚠️ Same provenance risk. |
| `/guides` | `153:18266` | **Tính năng** | Blog list, data-driven topic tabs. ⚠️ Same provenance risk. |
| `/` | `375:9844` | **Khanh Linh - Chi** | **Promoted 28/07**, replacing the 976-line legacy landing. Ships no `MissingContent`: testimonials and FAQ are omitted outright, Features and the scholarship rail take `showPlaceholders={false}`. Owns its chrome, including its own `MobileNav` — without that a phone gets no navigation at all. |
| `/dev/home` | `375:9844` | **Khanh Linh - Chi** | Still here after the swap, on purpose: it keeps every section INCLUDING the placeholders, so the copy gaps stay visible. Renders no real data — check data against `/`. |
| `/universities/[id]` | `375:10629` | **Khanh Linh - Chi** | **Built 28/07, wired up + extended 30/07.** ONE page for all 97, keyed on the numeric id (there is no `slug` column). `/universities/vinuni` now 308-redirects here; VinUni's colleges, FAQ and AACC statement analyser render as extras from `src/lib/vinuni-content.ts`. See the notes below. |
| `/mentors/[id]` | `375:21633` | **Khanh Linh - Chi** | **Built 29/07.** Replaced `MentorProfile.tsx` + `BookMentorModal.tsx` + `MentorAvailabilityGrid.tsx`, all three deleted. Real 7-column booking calendar (the frame's is a broken 10-column instance — see below). Fixed two live bugs in the process: the page 404'd for every signed-out visitor, and it serialised the mentor's PII into the client payload. |
| `/dev/saved-list` | — | — | Dev-only preview of `/my-universities`, hydrated from the real repositories. |

### Deliberate departures from the frames

Each is documented in a comment at the top of the relevant file.

- **The "Explore 10,000+ universities worldwide…" subtitle is wrong on three
  frames** (`337:18767`, `154:8345`, and the saved list). It is the university
  search page's subtitle, left on the layer when those screens were duplicated
  from it. Rewritten each time to describe the actual page.
- **The kit's job-post card leaks "Remote" onto a map pin** on both the saved
  list and the applications list. There is no city column, so the pin carries
  country instead — a pin means a place.
- **`/mentors` drops the six "Chọn theo tiêu chí" chips.** They read QS rank,
  scholarships, acceptance rate, degree level, campus setting, program language —
  filters for choosing a *university*, meaningless against a mentor. The controls
  kept (name/university search, country, subject) map to real columns.
- **`/mentors` does not use the frame's footer.** `154:8345` still carries the
  stock Untitled UI footer — "Untitled UI", "© 2077 Untitled UI. All rights
  reserved." — which the designer has not replaced.
- **`/apply` keeps the course importer.** The frame draws no way to add an
  application, which would make the page a dead end and drop the Smart Course
  Importer. The paste-a-URL bar and `CourseSearchSessionModal` (the
  `?openCourseSearch` entry point from `/scholarships`) are retained.
- **`/apply` crests fall back to initials.** Only 4 of 29 live rows carry a
  `university_id` to join a `logo_url` from.
- **`/about` hero** — the frame claims "offices all around the world" over a world
  map. Untrue for a Vietnamese student startup; replaced with honest copy.
- **`/guides` cards** — no author byline (`GeoGuide` has no author field).
- **Scholarship dialog** — the "Mã học bổng" code field is still **not built**.
  No voucher / promo / redeem concept exists anywhere in the schema.

#### `/onboarding` — three owner decisions, 30/07

All three are owner instructions, not inferences. Each is documented in a comment
at the top of `src/app/onboarding/onboarding-wizard.tsx`.

1. **Câu 9 ("What kind of future are you building?") is deleted.** The wizard is
   eight steps and the pill reads `n/8`. `student_profiles.goals` is NOT written
   by this form any more — the upsert omits the column entirely, so a value from
   `/profile/goals` (which owns that answer, with more room) survives a re-run of
   onboarding. Sending `null` would have erased it. The Vietnamese strings for
   câu 9 stay in `i18n-dictionary.ts`: the legacy
   `components/onboarding/onboarding-single-page.tsx` still renders them.

2. **The progress bar navigates.** Each segment is a real `<button>` in a `<nav>`,
   so an answer can be corrected without pressing "Back" five times. It is NOT
   "jump anywhere": the frontier (`reachable`) is every step already seen, plus
   each consecutive step after that which is already answered. Jumping *forward*
   past a blank step would route around the same gate that disables "Continue"
   and land the student on the save button with câu 3 empty. The second half of
   the rule is what lets a returning student with a full draft go straight to the
   one answer they came to change.

   ⚠️ The draft that feeds this frontier is **untrusted input** — see
   `docs/known-issues.md` §00. Four components share its localStorage key, and a
   draft written before commit `09d3bc9` crashed câu 7 on every render once
   `isAnswered` started validating scores. It is now coerced in one tested place,
   `src/features/onboarding/domain/draft.ts`.

   ⚠️ **This is also why the draft is read after hydration, not in the `useState`
   initialiser.** A segment's `disabled` is derived from how much has been
   answered; a localStorage-derived first render disagrees with the server's HTML,
   and React does not patch up mismatched *attributes* — it keeps the server's.
   The symptom was a bar permanently locked at step 1 for anyone with a draft,
   with nothing on screen to explain it. `useSyncExternalStore` is the gate;
   `useEffect` + `setState` is not an option (`react-hooks/set-state-in-effect`).

3. **Câu 6 asks for a grade per curriculum, on that curriculum's own scale.**
   The frame draws ONE grading-scale list and ONE "Current GPA" box under a
   *checkbox* list of curricula, and that cannot hold the answer:

   - A student sitting the Vietnamese National Curriculum **and** AP has a 0–10
     average and a 4.0 GPA. One box makes them discard one, and whichever
     survives is stored without saying which curriculum it belongs to.
   - An IBDP student has **neither**. They have a total out of 45, which is not a
     GPA and does not fit a box labelled "10-point / 4.0".

   So each ticked curriculum renders its own scale picker (a `Radio` group, not a
   second searchable multi-select — that control was wrong for two options) and
   its own checked grade box. Same departure, same reason, as câu 7's per-test
   score fields.

   `src/features/onboarding/domain/academic-grading.ts` owns which scales each
   curriculum offers and what each one accepts, with 218 unit tests. Every scale
   is swept against known junk input, because **the reported bug was that the GPA
   box accepted "dsf"** — the only check was a `parseFloat` at save time whose
   `null` went to the database silently. Câu 7's score boxes had the same hole and
   now carry per-test formats (IELTS half bands 0–9, TOEFL whole 0–120, SAT steps
   of 10, A-Level letters, …). Câu 6's grades are **required**; câu 7's scores stay
   **optional**, because that step's own copy tells the student to leave one blank
   while they wait for a result.

   Two limits are deliberate and commented in the module: a letter-grade list has
   to accept a run-together form ("A\*AA"), which means any run of grade letters
   passes; and an unknown "Other" scale can only be held to leading with its
   number ("18/20", "87%"). Both are shape filters, not verification.

   **Schema:** `student_profiles.curriculum_grades` (JSONB) is new and REQUIRED —
   it is the only place a two-curriculum student's second grade, or an IB total,
   can land without being relabelled. `gpa_scale` / `gpa_value` are now the
   *derived summary*: the first ticked curriculum whose scale yields a comparable
   number, for the check against `universities.gpa_range`. `gpa_value` is widened
   to `NUMERIC(6,2)` so a 100% "Others" grade cannot overflow it mid-save.

#### `/mentors/[id]` — five departures, and two bugs the rebuild had to fix

The frame is `375:21633` "Detail cố vấn" (1440×1823). Layout is taken from it
exactly: a 1200-wide header card, then a 720 / 96 / 384 two-column body. The
section cards really do carry only 12px of horizontal padding against 32–48
vertical — that is the frame, not a mistake in the code.

Departures, all noted in the files themselves:

1. **The booking section's heading in the frame reads "Điểm mạnh"** — the same
   heading as the strengths block two sections above it, over a paragraph about
   picking a day. A copy-paste artefact. Shipped as "Book a session".
2. **The frame's calendar is a broken component instance.** `Dates`
   (`375:21725`) is 412px wide with cells at x=0…360 — **ten columns** — under a
   seven-label weekday header, so 1–31 run continuously and the selected "8"
   lands in the ninth column. January 8 2027 is a Friday. Built as a real
   Monday-first 7-column month instead, same 40px cells, same rose selected pill
   and availability dot.
3. **The strengths paragraph has no column behind it.** In the frame it holds a
   course description ("Master of Health Administration (MHA)…"), which is not a
   statement about the mentor. Dropped, same call as the lorem ipsum on
   `/universities/[id]`. The chips (`strengths`) render.
4. **"Book now" opens an intake dialog rather than going straight to Stripe.**
   `POST /api/mentorship/checkout` requires `help_topic` (3–200 chars) and the
   booking is useless to the mentor without it. The frame ends at the slot, so
   the picker is drawn as designed and the missing intake is asked for after.
5. **The frame draws only the empty state for reviews.** No design exists for a
   populated list, so one is composed from the same card and type tokens.

Two live bugs found while rebuilding, both fixed by the new reads in
`src/lib/mentors.ts`:

- **The page 404'd for every signed-out visitor.** Every select policy on
  `achiever_profiles`, `mentor_availability_slots` and `session_reviews` is
  granted `to authenticated` (supabase-global-station.sql). `getMentorById` uses
  the request-scoped client, so anonymous reads returned zero rows,
  `notFound()` fired, and every card in the *public* directory was a dead link.
  RLS returning nothing is not an error, so nothing reported it.
- **It leaked the mentor's PII.** `getMentorById` selects `*` and the page
  handed the whole row to a `'use client'` component, putting `legal_name`,
  `date_of_birth`, `stripe_account_id` and the four verification-document
  storage keys in the page payload. `getPublicMentorById` uses the existing
  `PublicMentor` projection instead.

Two smaller correctness fixes in the same area: the calendar now offers only
`open` slots starting at least an hour out, because checkout rejects `held`
slots with a 409 and anything sooner with a 400 — the old grid offered both and
let the student discover it at the payment step.

⚠️ `session_reviews` has **no `reviewer_name` column**, though
`MentorReviewWithReviewer` declares one. Every review the old page rendered was
already unattributed; the new one says "Glowbal student" rather than carry the
fiction. Add the column (or a join) before review authorship means anything.

### Two corrections to earlier notes in this file

1. **`337:19349` "Chi tiết voucer" is not a voucher.** Despite the frame name it
   is a scholarship *detail* view, and every field maps to a real `scholarships`
   column (`coverage`, `eligibility`, `conditions`, `insight`, `applies_to_text`,
   `deadline_date`). It was predicted to hit the same schema wall as the code
   field; it does not, and it is built.
2. **`337:19703` "Chọn lại ngành" is not a saved-list dialog.** Its background
   reads "Reflection / 1/3 / What is your highest level… / ILETS" — it is the
   Select-a-Major picker from the **AI-strategy** flow. It was grouped under the
   "Trang lưu" banner by spatial position only. Build it with `/ai-strategy`.

---

## Designed but not built

| Route | Figma | Canvas | Blocker |
|---|---|---|---|
| `/ai-strategy` | 18 frames, listed in [nav-items.tsx](../src/features/marketing/ui/nav-items.tsx) — landing `375:18445`, candidate info `375:19260`, achievements `375:18839`, reflection modals `407:17291`/`408:17403`/`409:17502`/`409:17626`, reflection `375:18328`, portrait `375:18185`, fit `375:18645`, strategy `375:19502`/`405:6526`, essay `375:17961`, CV `375:18038`, pricing `375:19705`, submit `375:18117`, confirmation `375:18594`, major picker `375:13546` | **Khanh Linh - Chi** | Net-new route, largest group, **404s today** from both nav and footer. No longer a provenance risk — it has migrated onto the dev canvas. `/ai-strategy` is already registered in `OWN_CHROME_PREFIXES`. |
| `/plus` | `115:13253`, `132:9601`, `196:16799`, `115:17014` | **Tính năng** | 3 tiers (free / $10 / $100). Sales are off (`PLUS_SALES_ENABLED=false`) — build as static preview. |
| `/guides/[slug]` | `153:20197` | **Tính năng** | Detail page still on app chrome. |
| `/privacy` | `153:22478` | **Tính năng** | Frame is named `Desktop`. |

### Wiring: a rebuilt page nobody could reach (found 30/07)

**A page can be finished, verified, and still be dead.** `/universities/[id]` was
built on 28/07 from `375:10629` and was correct. It was also **unreachable from
the product**: clicking a card on `/universities` called `setView('detail', id)`,
which swapped in `detail-view.tsx` — the 893-line pre-redesign panel — at
`?u=<id>`. Nothing ever linked to the new route, so the only way to see it was to
type the URL. Two days later the owner reported "the detail UI is still the old
design", and that was exactly right.

The gap was recorded and read as done: `university-list-client.tsx`'s header said
DetailView was kept as *"giữ detail cũ tạm"* until its redesign landed. The
redesign landed as a **different route**, so the sentence stayed true-looking
while becoming false.

**When a rebuild ships as a new route rather than as an edit to the old
component, the old component does not become dead — it stays live until someone
changes what points at it. Grep for who navigates to the thing you replaced, and
click through from the page a real reader starts on.** A screenshot of the new
URL proves the page renders, not that anyone can get to it.

Fixed 30/07:
- Cards are a stretched `<Link href="/universities/{id}">`, so the card has a
  real URL (middle-click, new tab, crawlers). The login gate is preserved by
  intercepting the click for guests, not by withholding the href.
- `detail-view.tsx` **deleted**; the `activeView === 'detail'` branch and the
  `?u=` two-way sync with it.
- `?u=<id>` still resolves — `useLegacyDetailParamRedirect` forwards it to
  `/universities/<id>`, because `/api/home/save-university` ends the sign-up
  funnel on it and `selection-cache` restores focus with it. That route now
  redirects straight to the real page.
- `TID.uniDetailPanel` moved onto the root of `/universities/[id]`, so
  `signed-in.spec.ts`'s "click a card, expect the detail panel" now asserts the
  redesigned page, and the guest gate test's "expect 0" still holds.

### `position: sticky` never worked anywhere on this site (found 30/07)

`<html>` and `<body>` both carried `overflow-x-hidden` (layout.tsx). `hidden`
computes the other axis to `auto`, which makes the element a **scroll
container** — so `body` sat between every page and the thing that actually
scrolls, and sticky resolves against its nearest scrolling ancestor. Body never
scrolls, so nothing could ever stick.

It hid for months because `getComputedStyle` still reports `position: sticky` and
nothing errors — the element just scrolls away. `/universities/[id]`'s sidebar had
shipped `lg:sticky` since 28/07 and had never once stuck.

Fix: `overflow-x-clip` on both (clip does not create a scroll container), plus
`flow-root` on body. **The `flow-root` is not cosmetic** — `hidden` was also
establishing a block formatting context as a side effect, and dropping to `clip`
without replacing it let first/last child margins collapse through the body, so
every page lost height at both ends.

⚠️ There is a **second** sticky trap that is per-page and the CSS fix does not
help: a sticky element only sticks while *its own parent box* is on screen. The
section bar was first wrapped in a `<div className="pt-gb-5xl">`, pinning it to a
103px-tall parent, and it scrolled away immediately. Sticky elements must be
direct children of something tall — top spacing goes on the sticky element as a
margin, not on a wrapper.

### `/universities/[id]` — what the data actually supports (measured 28/07)

Do not re-probe this; it decided the approach.

- **97 universities, and all 97 have every editorial field populated**:
  `strengths`, `specific_insight`, `teaching_style`, `gpa_range`,
  `english_requirement`, `standardized_test`, `admission_difficulty`,
  `accept_rate`, `application_deadline`, `scholarship`, `tuition_usd`,
  `living_cost_usd`, `housing`, `industry_connections`, `employability`,
  `best_for`, `weaknesses`, `notes`. Also `qs_rank` 92/97, `image_url` 75/97,
  `logo_url` 65/97. Every row is `source = 'curated'`.
- **There is no `slug` column**, so the route is keyed on the numeric id
  (`/universities/97`), not a slug. Adding slugs is a separate migration.
- The table is much richer than a first look suggests — the columns are not the
  obvious names. There is no `description`, `website`, `city`, `tuition_min` or
  `acceptance_rate`; the equivalents are `specific_insight`, (none),
  (none), `tuition_usd` and `accept_rate`.

**VinUni keeps its content, and it is already in the right shape to keep.**
All of it lives in typed constants in [src/lib/vinuni-content.ts](../src/lib/vinuni-content.ts)
— `vinuniHero`, `vinuniColleges`, `vinuniScholarships`, `vinuniFinancials`,
`vinuniAdmissions`, `vinuniCareer`, `vinuniCampusLife`, `vinuniFaq` — not
inlined in the page component. So the plan is an **extension, not a migration**:
the dynamic route renders the frame's sections from the `universities` row for
all 97, and VinUni (id 97) additionally renders its extra sections from that
module. Nothing is copied into the database, where 96 rows would have nothing to
put in the new columns.

⚠️ Two things in `vinuni-content.ts` are NOT university content and should not
move with it: `VINUNI_AACC_PILLARS` and `vinuniSopGuidance` feed the SOP
analysis section (`SopAaccSection`, ~500 lines of `vinuni-profile-client.tsx`,
calling `/api/ai/analyze-statement-aacc`). That is a *feature* that happens to
be parked on this page, and it belongs with `/ai-strategy`.

#### Frame → column mapping, already derived

`375:10629` is a two-column body (`375:10690`): a 720px `Rich text` column and a
384px sidebar. Read from the frame on 28/07 — build from this rather than
spending the Figma calls again.

| Frame node | Section | Source |
|---|---|---|
| `375:10692` | `Giới thiệu về <name>` | `name` |
| `375:10693` | intro + "Môi trường quốc tế" + "Phong cách giảng dạy" | `specific_insight`, `international_environment`, `teaching_style` |
| `375:10694` | second paragraph | ⚠️ **LOREM IPSUM in the frame** ("Ipsum sit mattis nulla quam nulla…") — no column, do not invent one |
| `375:10696`–`10701` | `Nhập học yêu cầu`, 4 check items | `gpa_range`, `english_requirement`, `standardized_test`, `admission_difficulty` |
| `375:10702`–`10707` | campus paragraph + image | `housing`, `image_url` |
| `375:10709`–`10782` | `Học bổng`, three `_Job post` cards + "Xem chi tiết học bổng" | `getScholarshipQueries().byUniversityIds([id])` |
| `375:10784`–`10810` | careers, 4 label/value check items | `industry_connections`, `internship_coop`, `employability`, `best_for` |
| `375:10813`–`10824` | `Tại sao sinh viên chọn <name>` | derived from `strengths`, `industry_connections`, `scholarship`, `employability` |
| `375:10826`–`10829` | `Nói chuyện với ai đó đã học ở đây` + button | links to `/mentors` |

The header is `375:10642`, the anchor bar `375:10665`, the sidebar card
`375:10831`.

#### Departures from the frame, and why

- **`375:10694` is lorem ipsum.** No column behind it; not rendered.
- **The anchor bar names seven sections, the body has five.** "Các ngành" and
  "Xếp hạng" have no target — ranks are badges in the header. Anchors are built
  from the sections that actually render, so a link never scrolls nowhere.
  VinUni gets a programmes anchor back because it has programmes.
- **The scholarship cards print "Remote" on a map pin** — the same kit leak the
  saved list and applications list hit. Country is what a pin would point at.
  No pin icon: `marker-pin-02` (41:4011) was never exported into `ICONS`, and
  hand-drawing one is what that file exists to prevent.
- **Deadlines are prose, not dates.** CMU's is a 40-word paragraph about there
  being no fixed deadline. Clamped to two lines, prose kept — parsing a date out
  of it would invent one.
- **The last button reads "AI lên chiến lược"** under a heading about talking to
  someone who studied here. It goes to `/mentors`.
- **`weaknesses` is shown**, though the frame has no counterweight to "why
  students choose". It is populated on all 97 rows and is the honest other half
  of a shortlisting decision.
- **The sidebar CTA points at `/ai-strategy`**, which 404s until Phase 2 — the
  same deliberate, tracked dead link the nav and footer already carry, not a new
  one.

#### Two traps this hit

1. **`getByIds` is not `getById`.** The first selects `UNIVERSITY_LIST_COLUMNS`,
   the subset a card needs, and silently omits the long editorial fields.
   `weaknesses` came back undefined and its whole section vanished with no error
   anywhere. A detail page wants `getById`, which selects `*`.
2. **`Container` swallowed `aria-label`.** `as="nav"` with no accessible name is
   an unlabelled landmark. It now forwards `id` / `aria-label` /
   `aria-labelledby`; before this, any label passed to it was dropped silently.

---

`/scholarships` has **no dedicated redesign frame** and is already token-clean —
low priority.

---

## Still legacy — pass tokens, keep layout

~32 routes with no Figma frame. Legacy class counts, highest first:

| Area | Legacy classes | Note |
|---|---|---|
| `src/app/onboarding/` | 43 | **Mostly dead code** — see [known-issues.md](known-issues.md). The wizard itself is clean. |
| `src/components/` | 41 | `nav-reveal.tsx` (the app sidebar) is most of it. |
| `src/app/profile/` | 41 | 9 routes. |
| `src/app/admin/` | 29 | 8 routes, internal only — cheapest thing to cut. |
| `src/app/dashboard/` | 12 | 6 routes. |
| `src/app/coordinator/` | 8 | |
| `src/app/my-universities/[id]/` | 3 | Task/writer pages under the rebuilt list. |
| `src/app/guides/[slug]/` | 2 | `article-body.tsx`. |

`src/app/mentors/` is no longer on this list — the browse page was rebuilt and
`MentorBrowse.tsx` deleted, and `/mentors/[id]` was rebuilt on 29/07 (which also
deleted `MentorProfile.tsx`, `BookMentorModal.tsx` and
`MentorAvailabilityGrid.tsx`). `/mentors/apply` and its success page still use
the app chrome — and `/mentors/apply/page.tsx` is the last `.glow-pill` in the
mentors tree.

Definition of done for any of these: the grep in [verification.md](verification.md)
returns nothing for that route's whole tree. Half-converted is the worst state —
`globals.css` is 5,375 unlayered lines that out-rank Tailwind utilities.

---

## Pages that render their own chrome

`src/components/nav-reveal.tsx` suppresses the legacy app sidebar and mobile nav
for pages that ship `TopNav` + `MobileNav` + `Footer` themselves. Two lists
since 28/07:

- `OWN_CHROME_ROUTES`, matched **exactly**: `/`, `/dev/home`, `/universities`,
  `/auth`, `/coming-soon`, `/onboarding`, `/about`, `/guides`,
  `/my-universities`, `/apply`, `/mentors`, `/dev/saved-list`. Exact, because
  the child routes under most of them (`/apply/[applicationId]`,
  `/guides/[slug]`, `/my-universities/[id]`, `/universities/vinuni`,
  `/mentors/apply`) are still on the app chrome.
- Two **id-shaped** matchers, for rebuilt detail pages whose siblings are not
  rebuilt and so cannot take a prefix: `/universities/<digits>` and
  `/mentors/<uuid>`. The shape is what separates them from `/universities/vinuni`
  and `/mentors/apply` next door.
- `OWN_CHROME_PREFIXES`, matched by **prefix**: `/ai-strategy`. Only for
  subtrees where every descendant is rebuilt — a prefix silently covers routes
  that do not exist yet.
- One regex, `/^\/universities\/\d+$/`, for the rebuilt detail page. It cannot
  be a prefix entry: `/universities/vinuni` sits in the same subtree and is a
  redirect, and matching digits is what separates them. When the vinuni file is
  finally deleted this can become a normal prefix.

**Adding a rebuilt page and forgetting this is the failure mode** — the sidebar
renders on top of the new page. It happened to `/apply`.

⚠️ And a second, quieter failure mode found on 28/07: a page can be in the list,
suppress the legacy chrome correctly, and still have **no navigation on mobile**
if it forgets its own `<MobileNav>`. `TopNav` is `hidden md:block`, so desktop
looks perfect while a phone gets nothing. `/` and `/dev/home` both shipped that
way; `tests/e2e/home-preview.spec.ts` now guards both.

---

## Sitemap — `123:2864` no longer exists

The sitemap frame this file used to cite ("Dg-final", 10 top-level destinations)
**is not in the Figma file any more.** Both canvases were scanned at full depth:
no `123:*` node, and no node named like a sitemap. There are only two pages in
the document.

This matters because [nav-items.tsx](../src/features/marketing/ui/nav-items.tsx)
cites it as the authority for keeping `/ai-strategy` and `/apply` as separate
destinations. That reasoning is now uncited — ask the designer to restore the
frame or re-confirm the split.

The two flow facts previously recorded from that board, still unverified:

1. **Q&A runs before log-in**: `Study abroad plan → Q&A → log in → school
   recommendation`. Today `/onboarding` bounces guests to `/auth` first.
2. **Search university has three entry points**: list, by major, by country.
   Only the list exists.
