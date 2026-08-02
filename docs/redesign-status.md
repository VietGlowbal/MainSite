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
| `/apply` | **`562:15078`** (+ `375:12841`, `375:13295`, `375:13369`, `502:18462`) | **Khanh Linh - Chi** | **"Application"** — the MERGED page, 31/07. `/apply` and `/my-universities` were two halves of one journey on two URLs; `562:15078` draws them stacked. "My application" (`562:15386`) over "Danh sách đã lưu" (`562:15092` + `562:15098`). See §"Two pages became one" below. |
| ~~`/my-universities`~~ | `375:12701` | — | **GONE 31/07.** 308s to `/apply` (`next.config.ts`, exact source). The children did not move — `/my-universities/program` and `/my-universities/[id]` are still there. |
| `/my-universities/program` | `375:13546` | **Khanh Linh - Chi** | **Built 30/07.** "Chọn lại ngành", the subject re-picker a saved row links to. ⚠️ Needs `supabase-saved-program.sql` — see below. |
| `/mentors` | `154:8345` | **Tính năng** | Search + 4-across card grid. ⚠️ Not yet migrated — expect a pass when it is. |
| `/about` | `153:11401` | **Tính năng** | Net-new route. Real team from `lib/team.ts`. ⚠️ Same provenance risk. |
| `/news` | `153:18266` | **Tính năng** | Blog list, data-driven topic tabs. ⚠️ Same provenance risk. **Merged 31/07:** `/guides` and `/news` served the same data through two designs; the redesign is now the only UI and `/news` the only URL. See §"Two blog routes became one" below. |
| `/` | `375:9844` | **Khanh Linh - Chi** | **Promoted 28/07**, replacing the 976-line legacy landing. Ships no `MissingContent`: testimonials and FAQ are omitted outright, Features and the scholarship rail take `showPlaceholders={false}`. Owns its chrome, including its own `MobileNav` — without that a phone gets no navigation at all. |
| `/dev/home` | `375:9844` | **Khanh Linh - Chi** | Still here after the swap, on purpose: it keeps every section INCLUDING the placeholders, so the copy gaps stay visible. Renders no real data — check data against `/`. |
| `/universities/[id]` | `375:10629` | **Khanh Linh - Chi** | **Built 28/07, wired up + extended 30/07.** ONE page for all 97, keyed on the numeric id (there is no `slug` column). `/universities/vinuni` now 308-redirects here; VinUni's colleges, FAQ and AACC statement analyser render as extras from `src/lib/vinuni-content.ts`. See the notes below. |
| `/mentors/[id]` | `375:21633` | **Khanh Linh - Chi** | **Built 29/07.** Replaced `MentorProfile.tsx` + `BookMentorModal.tsx` + `MentorAvailabilityGrid.tsx`, all three deleted. Real 7-column booking calendar (the frame's is a broken 10-column instance — see below). Fixed two live bugs in the process: the page 404'd for every signed-out visitor, and it serialised the mentor's PII into the client payload. |
| `/plus` | **none** | — | **Rebuilt 02/08 — the one page with NO frame.** See §"/plus had no design" below. Tokens + `shared/ui` only. `/plus/success` restyled with it. |
| `/dev/saved-list` | — | — | Dev-only preview of `/my-universities`, hydrated from the real repositories. |

### Deliberate departures from the frames

Each is documented in a comment at the top of the relevant file.

- **The "Explore 10,000+ universities worldwide…" subtitle is wrong on three
  frames** (`337:18767`, `154:8345`, and the saved list). It is the university
  search page's subtitle, left on the layer when those screens were duplicated
  from it. Rewritten each time to describe the actual page.
- **The saved row keeps "Ngành … / Chọn lại ngành tại đây".** `562:15078` drops
  it from every row — that is the whole reason those rows shrink 272px → 188px —
  and the owner said keep it (31/07). It is the only entry to
  `/my-universities/program`, and since the merge it is load-bearing: "Plan my
  application" needs a chosen subject to have a course URL to post. Row height
  follows the frame, the line stays.
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
- ~~**`/apply` keeps the course importer.**~~ **REVERSED 01/08 — the frame was
  right.** The owner confirmed applications are created from the saved list, not
  from a pasted URL. The paste-a-URL bar, `CourseSearchSessionModal` and the
  `?universityId` + `?openCourseSearch` entry point are all gone; the modal
  component and its three test files are deleted. Nothing external linked with
  those params (the "funnel from `/scholarships`" this note claimed was already
  stale — that page sends `?focus=<id>`). See §"Applications now come from the
  saved list" below.
- **`/apply` crests fall back to initials.** Only 4 of 29 live rows carry a
  `university_id` to join a `logo_url` from. ⚠️ This shrinks by itself from
  01/08: every application created from a saved university carries one.
- **`/apply` adds five things `562:15078` does not draw** (01/08, after the owner
  called the page boring). All five are recorded in the file headers of
  `my-application-section.tsx` and `saved-list-section.tsx`; the reason they are
  additions rather than fidelity is that Figma has no clock, no cursor and no
  selection model, so a live list has to supply those itself:
  1. **The deadline is banded** — `features/apply/domain/deadline.ts`. Rose
     inside a fortnight, amber inside a month, struck through once passed, with
     a "N days left" countdown. The frame prints all three dates in one grey.
  2. **The tracker row answers the pointer** — a rose rail unrolls at its left
     edge, the border goes Rose/300 and the card lifts.
  3. **A ticked saved row shows it on the card** — brand border + ring, not a
     Rose/50 fill: every pill on that card *is* Rose/50, so a wash erases the
     rankings, the tuition and any attached scholarship. Measured, not guessed.
  4. **The scholarship bar is a Rose/50 panel** rather than a hairline rule. Its
     gift icon, headline, link and CTA were already rose and were floating on
     the same white as the rows above them.
  5. **A Rose/50 bloom behind the first heading**, fading out before the first
     row. Both empty states are on the same Rose/50 + Rose/100 pairing.
- **`/apply` saved rows: the attached-scholarship pill is the card's only
  unbounded string, and it overflowed** (owner screenshot, 01/08). `Badge` bakes
  `whitespace-nowrap` — `design-system.md` flags this as the primitive's known
  trap — and the row printed the provider's name whole. Measured at 1440: an
  840px pill inside a 779px card, hanging 87px out over the page. Fixed in two
  layers, and both are needed:
  - `scholarshipLabel()` (`features/universities/domain/saved-list.ts`, tested)
    strips the `" at <university>"` that the card's own heading already says —
    26 of those 96 characters. Handles the parenthetical acronym in
    `universities.name` ("University of Amsterdam (UvA)" vs "at UvA") and
    refuses to strip a name down to nothing.
  - `min-w-0` from the `<li>` down to the pill, plus `truncate` on the name, so
    what is left ellipses against the card. `min-w-0` is the load-bearing part:
    a flex item defaults to `min-width: auto`, which is exactly "never shrink
    below my content". The amount is `shrink-0` and the untouched name stays on
    `title`.

  ⚠️ If another unbounded provider string ever lands in a `Badge`, expect the
  same failure. Sweep with a Playwright check comparing each descendant's
  `getBoundingClientRect().right` against its card's — this page is clean at
  1920/1440/1280/1024/768/390.
- **`/about` hero** — the frame claims "offices all around the world" over a world
  map. Untrue for a Vietnamese student startup; replaced with honest copy.
- **`/news` cards** — no author byline (`GeoGuide` has no author field).
- **`/news` keeps a search box and a featured post**, neither of which
  `153:18266` draws. Owner instruction, 31/07 — both existed on the page this
  route absorbed and dropping working controls to match a frame is the same
  trade as the subscribe row. See §"Two blog routes became one" below.
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
2. ~~**`337:19703` "Chọn lại ngành" is not a saved-list dialog.**~~ **WRONG —
   corrected 30/07 by the product owner.** The note read the frame's dimmed
   backdrop ("Reflection / 1/3 / What is your highest level… / ILETS"), concluded
   the picker belonged to the AI-strategy questionnaire, and said it had been
   grouped under the "Trang lưu" banner by spatial position only. The owner has
   since described the flow directly: a saved row's "Chọn lại ngành tại đây"
   opens it. The backdrop is a reused screen; the frame is in the Trang lưu
   cluster because that is where it is used. It is built, as
   `/my-universities/program` (migrated node `375:13546`).

   **The lesson is about the evidence, not the answer.** "Its background shows
   another page" is weak evidence next to "it sits inside that banner group" —
   a designer reuses a backdrop far more often than they misfile a frame. When a
   layout signal and a grouping signal disagree, ask rather than pick.

---

## Designed but not built

| Route | Figma | Canvas | Blocker |
|---|---|---|---|
| `/ai-strategy` | 18 frames, listed in [nav-items.tsx](../src/features/marketing/ui/nav-items.tsx) — landing `375:18445`, candidate info `375:19260`, achievements `375:18839`, reflection modals `407:17291`/`408:17403`/`409:17502`/`409:17626`, reflection `375:18328`, portrait `375:18185`, fit `375:18645`, strategy `375:19502`/`405:6526`, essay `375:17961`, CV `375:18038`, pricing `375:19705`, submit `375:18117`, confirmation `375:18594`, major picker `375:13546` | **Khanh Linh - Chi** | Net-new route, largest group, **404s today** from both nav and footer. No longer a provenance risk — it has migrated onto the dev canvas. `/ai-strategy` is already registered in `OWN_CHROME_PREFIXES`. |
| `/news/[slug]` | `153:20197` | **Tính năng** | Detail page still on app chrome. |
| `/privacy` | `153:22478` | **Tính năng** | Frame is named `Desktop`. |

### `/plus` had no design, and that is why it looked old (02/08)

The owner reported on 2026-08-02 that `/plus` "is still using the old UI" and
confirmed the page had been **missed in the redesign** — there is no frame for
it on "Khanh Linh - Chi". This file listed it under *designed but not built*
against `115:13253` / `132:9601` / `196:16799` / `115:17014`, four frames on the
**retired "Tính năng" canvas** drawing a free / $10 / $100 split that
`src/lib/plus.ts` (Starter / Pro / Premium, five currencies) stopped matching
long ago. So the frames were not a usable source and nothing replaced them.

**Built from the design system instead, on the owner's instruction** — same
standing as `Panel`, `StatTile` and the admin console: tokens + `shared/ui`
only, no invented colour, radius or type step. Rhythm follows Home: black hero →
muted plans → white comparison → muted close.

The four things worth not re-deriving:

1. **The cards straddle the hero's bottom edge**, and the 96px of black behind
   their top is an **absolutely positioned strip, not a negative margin**. A
   negative top margin on the first in-flow child collapses through `Container`
   and drags the whole light band up with it — which hides the overlap instead
   of creating it.
2. **The featured card uses `lg:-my-gb-3xl` and NO `h-full`.** The grid already
   stretches every card to the row height; a definite height is exactly what
   stops the featured one growing past it. With `auto` height the negative
   margins make the stretched box 48px taller than its grid area, so Pro stands
   24px proud at *both* ends. With `h-full` (tried first) it slid up 24px and
   left its foot 24px short of its neighbours'.
3. **`[contain:paint]` on the comparison table's scroll wrapper is load-bearing.**
   The table is `min-w-[720px]` inside `overflow-x-auto`, which is correct — but
   Chrome still counts a scroll container's overflow toward the **root**
   element's `scrollWidth`, so `<html>` measured 687px on a 390px phone. Nothing
   could actually scroll (body is `overflow-x: clip` — see §sticky above for why
   it is `clip` and not `hidden`), yet the page measured as overflowing and
   full-page screenshots came out 687px wide with a dead band down the right.
   Paint containment was the **only** fix: `max-width: 100%`, `overflow-x:
   scroll`, clipping the section and clipping `<html>` all left it at 687.
4. **`?status=cancelled` is answered at last.** Stripe's `cancel_url` has
   pointed at `/plus?status=cancelled` since checkout was written and the page
   ignored the param, so abandoning payment returned you to an unchanged pricing
   page with nothing saying you had not been charged.

Smaller corrections made in the same pass, each visible in a diff and easy to
lose:

- **The card CTA is a real `Button`.** The card used to be `role="button"` with
  a styled `<span>` inside it pretending to be one, and with `PLUS_SALES_ENABLED
  = false` it rendered a control that looked live and did nothing. It is now a
  `disabled` button reading "Coming soon" — three of them, asserted inert.
- **`PLUS_PACKAGES.highlights` lost its leading "<n> AI strategy credits"
  bullet** on all three tiers. Credits get their own plate directly above the
  list, so the bullet printed the same number twice in the same card. There is a
  ⚠️ on the field in `lib/plus.ts` so it does not come back.
- **The comparison's Free column shows a formatted zero**, not the word "Free"
  under a column already headed "Free" — that was the one column with no price
  to compare against the three that had one.
- **`/plus/success` no longer shows a green tick over "Confirming your
  payment…"**, which said the opposite of the sentence under it. Unverified gets
  the clock; activated gets the tick.
- **Its second button pointed at `/universities`** — the search page — while
  labelled "Go to my universities". The student's own list has been on `/apply`
  since the 31/07 merge, so it now says "Go to My Portal" and goes there.
- **The whole page was machine-translated.** `/plus` had exactly ONE dictionary
  key before this (`'Upgrade to GlowBal Plus'`, which belongs to `/profile`), so
  every tier name, price caption and comparison row was hitting `/api/translate`
  on a Vietnamese visitor's first paint and rendering whatever came back unread.
  ~70 keys added, including the literals in `lib/plus.ts`.

Verified at 1440 / 1280 / 768 / 390 signed-out and signed-in: 0 overflow, 0
console errors, one `nav-header`, currency switch updates both the cards and the
table header.

### Two pages became one: `/apply` + `/my-universities` (31/07)

The designer drew the merge on **`562:15078`** ("Trang lưu", 1440×2461) — a
frame that is *invisible* to anyone reading the older ones, because it sits in
the same "Trang lưu" cluster as `375:12701` and `375:12841` and carries the same
name. Find it by height: 2461 vs 1771/1563.

```
562:15078  Trang lưu
├─ 562:15079  Dropdown header navigation
└─ 562:15091  Features section
   ├─ 562:15386  h 874   "My application"   ← heading 562:15387 + list 562:15393
   ├─ 562:15092  h  86   "Danh sách đã lưu" heading
   ├─ 562:15098  h 868   saved rows + selection bar (562:15184)
   └─ 562:15192  Footer
```

**The tracker block is unchanged.** `562:15393` is h680 with three h184 rows —
byte-identical to `375:12994`, which the code was already built from. Nothing in
`ApplicationRow` needed touching.

⚠️ **THE FRAME IS NAMED "My Portal ", NOT "Trang lưu".** The name above was read
off the *cluster*, which is what the owner calls it; the frame's own layer name
is "My Portal " (trailing space). Both headings on it are **`Colors/Rose/600`**,
and each carries a mark the first build dropped — a 56px Rose/50 disc holding a
40px globe (`562:15622` / `562:15637`) beside "My application", and a 32px
Rose/50 disc holding the kit's heart (`562:15559`) beside "Saved University".
They shipped in `text-fg` with no marks at all, which is what made the owner
call the page boring on 01/08. Both are now in
`src/app/apply/section-heading.tsx`; the globe is committed at
`public/brand/apply-globe.png` (the export is a 2048² PNG, resized to 160²).

**The saved row shrank 272px → 188px**, and the removed element is `Frame 162`,
the "Ngành … / Chọn lại ngành tại đây" line. **It is kept anyway** (owner, 31/07)
— see the departures list above. Rows 2–3 also lack the tuition badge that row 1
has; that is an unfilled placeholder, not a variant.

#### What the merge actually changed, beyond layout

Nothing on the saved list ever *created* an application. "Lên kế hoạch ứng
tuyển" was `<Button href="/apply">` — a link to the page it now lives on. It
posts the saved row's `program_url` to `POST /api/applications/from-course-url`
and the shell scrolls to `#my-application`. **No new endpoint**: that route
already creates the row, queues the parse job, and answers 409 with
`existingApplicationId` for the already-tracked case.

Two things had to be fixed for that to work at all:

1. **`program-picker.tsx` never saved a URL for a catalogue pick.** It wrote
   `urlProvided ? url.trim() : null`, so choosing a subject and not pasting a
   link stored the subject with no URL — while `chosenOfficialUrl` sat two
   blocks below being rendered as "Open the official course page". Harmless
   while it fed a display line; a redirect loop the moment "Plan my application"
   needed a URL. It now falls back to the catalogue's own `official_url`.
2. **The catalogue covers 24 of 106 universities.** For the other 82 the subject
   list comes from `universities.strengths`, which has no links behind it, so a
   student can come back from the picker still URL-less. That case says so
   explicitly rather than bouncing them back.

⚠️ `POST /api/applications/from-course-url` can still refuse: with
`getIngestionProvider()` on `'ingestion'` it 400s unless the university has
`domain_review_status = 'approved'` and a `primary_domain`. **Now measured — see
below. It was 20 of 106.**

### Applications now come from the saved list (01/08)

The paste-a-course-URL importer is gone from `/apply`. "Plan my application" is
the only way an application is created, and it no longer needs a course URL.

**What forced it.** The old CTA posted each ticked row's `program_url` to
`/api/applications/from-course-url`. Measured against the live database on
2026-08-01:

| | |
|---|---|
| Universities | 106 |
| …with a programme catalogue (`catalog_programmes`, 404 rows, all with `official_url`) | **24** |
| …also clearing the ingestion domain gate | **20** (all US, all inside the 24) |
| Saved rows with a `program_url` | **1 of 9** |
| Applications with no `university_id` | **29 of 37** |

So for 82 of 106 universities the subject list comes from
`universities.strengths` — names with no links — and the flow dead-ended. Worse,
the CTA itself was nearly unreachable: it only rendered when
`applyCandidates.length === 0 && attachedCount > 0`, so a university with **no**
scholarship in the directory showed "Apply scholarship", whose dialog opens to
say there are none.

**What replaced it.**

- `POST /api/applications/from-saved-university` takes `{ universityId }`, reads
  the subject off `user_universities`, and 409s `SUBJECT_REQUIRED` if there is
  none. Every field is real at insert — no `"Loading course details..."`
  placeholder, and always a `university_id`.
- `lib/course-parser/baseline-checklist.ts` seeds the five `STAGE_TEMPLATE`
  stages plus 13 universal tasks (`created_by: 'system'`), so no application
  opens empty. A course URL is now *optional* and only decides whether an AI
  enrichment pass is queued on top.
- `writeChecklist` in `job-processor.ts` **no longer deletes and recreates the
  spine.** It matches stages on `slug` and replaces only `created_by = 'ai'`
  tasks. Without that change the first successful parse of every application
  would have produced **ten** stages, and would have wiped baseline tasks the
  student had already ticked.
- "Plan my application" is now the primary action whenever a row is ticked;
  "Apply scholarship" is secondary and appears only when the ticked rows have an
  award to attach.
- `supabase-apply-baseline-checklist.sql` — a **guarded follow-up** (§0), adding
  `'system'` to `valid_created_by` and dropping `NOT NULL` from
  `course_applications.course_url`. **Must be applied before the new endpoint
  works**; `seedBaselineChecklist` throws `BaselineNotEnabledError` naming the
  file if it has not been.
- The subject picker keeps its paste-a-link field, restyled as optional — it is
  the only way one of the 82 ever gets an AI-read checklist.
- `?focus=<universityId>` is handled at last. `/scholarships` has been sending it
  since it was built and `/apply` ignored it; it now ticks and scrolls to that
  saved row.

⚠️ **13 of 37 live applications were stranded** at `parse_status = 'pending'`
with **no job row in either queue**, the oldest since 15 June, each rendering
"GlowBal's AI is reading the course page…" forever. Cause: `createParseJob`
returns `null` on a write failure and the enqueue sat in a catch commented
"Best-effort — don't fail the request". Both endpoints now settle the row
honestly. `scripts/repair-stranded-applications.mjs` fixes the existing rows —
**dry run by default, `--apply` to write**, and it needs the migration first.

#### Nav

`MARKETING_NAV_ITEMS`: `/apply` is now labelled **"Application"** (was "Plan your
studies" / "Lập kế hoạch du học"). The CTA button keeps the old string pointing
at `/onboarding`, so both survive and both are dictionary hits.
**Superseded 01/08 — see "The nav became four entries" below.**

⚠️ **`/apply` and `/ai-strategy` stay visible to signed-out visitors.** Both were
briefly hidden behind a `requiresAuth` filter on this list; the owner reversed
that the same day — the links are how a guest discovers the features, and each
page forces sign-in when opened. `/ai-strategy` gained that redirect in the same
change (it used to render in full for anyone). Do not reintroduce a nav filter.

⚠️ **`/apply` was already in `PII_ROUTE_PREFIXES`** (`src/lib/dom-translate.tsx`)
and its strings were **never in the dictionary** — so the tracker's heading,
subtitle and import bar had been sitting in English on the Vietnamese page with
no machine fallback to hide it. Added. Every new string on this route must be.

### The nav became four entries, and the Home CTA branches (01/08)

Both changes are the **owner's, and both disagree with the frames.** 375:9845 and
375:10151 still draw a flat row of six labels. Ask the designer to redraw them;
do not "restore" the flat list from Figma.

**The bar, left to right: News · Search ▾ · Build your strategy · My Portal.**
The same four for signed-out and signed-in — the two frames differ only in which
label the CTA slot promotes, and every page already picks its own
`primaryAction`.

| Before (6, flat) | After (4) |
|---|---|
| About us | **gone from the header** — still in the footer's Company column, `/about` untouched |
| Build your strategy | 3rd |
| Search universities | inside **Search ▾** as "Universities" |
| Application (`/apply`) | 4th, relabelled **"My Portal"** |
| Find a mentor | inside **Search ▾** as "Mentors" |
| Blog (`/news`) | 1st, relabelled **"News"** |
| — | **Search ▾** is new: Scholarships · Universities · Mentors |

`/scholarships` gains a header entry for the first time; it was footer-only.

Grouping cost nothing in reachability and bought width: the bar overflowed
**371px at 768** and now overflows 74px, with 0 clipping at 1280 and 1440
(measured). It is still `overflow-hidden` and that is still deliberate — read
the ⚠️ on the `<nav>` element.

**The dropdown panel is `position: fixed`, and that is load-bearing.** The
`<nav>` clips its children, so an absolutely positioned panel would be cut off
at the bar's bottom edge; a fixed one is laid out against the viewport and
escapes. The cost is that its position is measured in JS (`place()` in
`NavDropdown`). **No ancestor of the header may gain `transform`, `filter` or
`contain: paint`** — any of them makes the header a containing block for fixed
descendants and the clipping comes back.

It is a **disclosure**, not an ARIA menu: `aria-expanded` + `aria-controls` over
a plain list of links. `role="menu"` would promise roving arrow-key focus,
type-ahead and a focus trap, none of which this implements — and Tab already
walks the links, because the panel follows the trigger in the DOM. The mobile
sheet renders the same group expanded in place and **open by default**: it is a
vertical list with room, and collapsing it would bury Scholarships and
Universities behind an extra tap.

Both navigations now read one model, `src/shared/ui/nav-model.ts`
(`NavLink | NavGroup`). `TopNavItem` / `MobileNavItem` survive as aliases so the
~15 existing importers compile unchanged.

#### `/start` — the Home hero CTA

"Find matching scholarships" pointed unconditionally at `/onboarding`. It now
points at **`/start`** (`src/app/start/route.ts`), which 307s to `/onboarding`
for a student who has not answered the questions and **`/universities`** for one
who has.

Why a route and not a conditional `href`: `/` is prerendered (`revalidate`, 12h)
and `HomeHero` is a server component on purpose. Reading the session on the page
would opt every visitor out of static rendering; deciding in the browser would
leave the href wrong until a fetch resolves, which is where it gets clicked. The
route costs one hop, taken only by people who press the button. **`/` is still
`○ Static` in the build output** — check that if this is ever revisited.

The nav's own CTA still goes straight to `/onboarding`. That was not part of the
instruction and its label ("Plan your studies") promises the questionnaire.

⚠️ **"Completed" is now defined in three places.** `onboardingIsComplete`
(`src/features/onboarding/domain/completion.ts`, tested) is the canonical one;
`src/proxy.ts` and `src/app/auth/callback/route.ts` still inline the same
expression. They agree today. **Change one, change all three** — a student who
is complete enough for the middleware but not for the CTA ping-pongs between two
pages. Converging those two onto the domain function is a clean follow-up.

The rule is `onboarding_completed === true` **OR** (`study_level` and a non-empty
`preferred_countries` array). The OR is not belt-and-braces: rows written by
`onboarding-single-page` / `onboarding-globe-quiz` predate the flag, and a final
upsert can lose a race with the redirect. Sending those students back to
question one is the worse failure.

### Two blog routes became one (31/07)

`/news` and `/guides` rendered the **same** `listGeoGuides()` data through two
different designs — `/news` pre-redesign (orbiting-globe hero, featured article,
search, grid/list toggle, trending sidebar), `/guides` the Figma rebuild
(`153:18266`). The owner merged them: **the redesign is the UI, `/news` is the
URL.**

`/news` won the URL because it is what everything already pointed at — the app
sidebar (`nav-reveal.tsx`), the article breadcrumb, and the `BreadcrumbList` in
each article's JSON-LD. The Figma nav label stays "Blog"; only the href moved.

What moved, and what has to move with it if this is ever revisited:

| | Before | After |
|---|---|---|
| List | `/guides` + `/news` | `/news` (`news-client.tsx`) |
| Article | `/guides/[slug]` | `/news/[slug]` |
| Old URLs | — | 308 in `next.config.ts` |
| Canonical | `…/guides/<slug>` | `…/news/<slug>` — `scripts/geo/generateMetadata.ts` **and** the 5 already-generated `content/geo/metadata/*.json` |
| `revalidatePath` | `/news` + `/guides` + `/guides/:slug` | `/news` + `/news/:slug` (4 admin routes) |
| Own chrome | `'/guides'` | `'/news'` |
| Typecheck scope | `geo.tsconfig.json`, the pipeline's `git add` | same, repointed |

The 308s are not tidiness. Every article published so far shipped a
`/guides/<slug>` canonical in its metadata JSON and in the sitemap, so those
addresses are what search engines hold and what any inbound link points at.

Two controls the frame does not draw survived the merge, on the owner's
instruction: **search** (title/excerpt/topic/tags, the filter the old page
shipped) and a **featured** lead post. The dead ones did not — "Save for later"
and the sort select were buttons with no handler, and the trending rail ranked
by a hand-written topic weighting rather than any real signal.

Only `NewsletterCard` survives from the old tree, in
`src/components/news/newsletter-card.tsx`; `/news/[slug]` still renders it and it
is still on the legacy pink styling that page uses. It goes when `153:20197` is
built.

### The saved list was a canvas behind (found 30/07)

> Superseded 31/07 — the saved list is now a section of `/apply`, drawn on
> `562:15078`. Kept because the lesson is about node-id provenance, not about
> this page, and because the `375:*` frames below are still the source for
> everything inside the row.

`/my-universities` was built from `223:8824` / `223:13621` / `223:13022` on the
**retired "Tính năng" canvas**. The migrated frames — `375:12701` and friends —
draw a strictly larger card, and the three extra elements are the whole feature
the owner asked for:

| On `375:12701` | On `223:8824` | Now |
|---|---|---|
| tuition badge (`375:12740`) | absent | `formatTuitionForCard(tuition_usd)`, and the **net** figure once a scholarship is attached |
| "Ngành …" + "Chọn lại ngành tại đây" (`375:12741`) | absent | links to `/my-universities/program` |
| "Học bổng tại đây" + the applied state (`375:12841`) | a plain `/scholarships` link | opens the picker in browse mode; the bar shows the discount |

Plus two frames nobody had built: the subject re-picker `375:13546` and the
confirmation `502:18462`.

**How this hid for so long.** The old file's header comment cited its frames
accurately, the page looked finished, and the tests passed. Nothing in the repo
says which canvas a node id belongs to — `223:*` and `375:*` are just numbers. The
only way to catch it is the table at the top of this file, which is why it is at
the top of this file. **Before touching a rebuilt page, check the node ids in its
header comment against that table.**

#### Where the picker's options come from

**`catalog_programmes`.** It is the crawler's programme catalogue and it carries
exactly the tree the frame draws: `programme_name`, `degree_level`, and a
denormalised `academic_units` array that is the school layer. Read through
`features/universities/api/programme-queries.ts`.

⚠️ **This file previously said "there is no course catalogue", and that was
wrong.** The check behind it probed three *guessed* table names — `programs`,
`majors`, `university_programs` — missed on all three, and generalised. There are
**75 tables** in this database. One call answers the question properly:

```bash
# PostgREST's OpenAPI document: every exposed table and its columns
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  | jq -r '.definitions | keys[]'
```

**Enumerate the schema; never conclude a table is absent from a handful of
guessed names.** This is the second entry in this pack about trusting a guess
over the database — see known-issues.md §0 for the first.

Coverage is partial, and that shapes the design (measured 2026-07-31):

| Fact | Consequence |
|---|---|
| 404 programmes over **24** of 106 universities | `universities.strengths` stays the fallback, and is the path most students hit |
| `duration` null on **400 of 404** | the frame's "(4 năm)" renders for almost nothing; never defaulted |
| `degree_level` well populated, but spelled `bachelor` **and** `Bachelor's` | folded by `degreeLabel`; it takes the secondary line the frame gave to duration, because the same subject is catalogued at two levels |
| a programme can list several `academic_units` | it appears under each school, once in the flat list |
| `catalog_programmes` readable by `anon` **and** `authenticated` | no repeat of the mentor-directory RLS trap; checked with both keys |

What the database still cannot answer is the frame's *supporting* line, "Viện
kinh doanh — Chương trình cử nhân kinh doanh quốc tế", which is a sentence about
the university rather than a row. That slot keeps `best_for`; the student's own
chosen subject gets the "Ngành …" line, which is a fact because they chose it.

#### Crawled data needs shaping before it reaches a student

Three decisions, all measured against all 404 rows rather than the handful that
happened to be on screen.

**1. `verification_status` is neither filtered nor badged.** 390 of 404 rows are
`NEEDS_REVIEW`, 10 are `RULE_VALIDATED`, 4 are null — and all 10 validated rows
belong to **one university** (Penn). So filtering to "verified" would leave the
catalogue path working for 1 of the 24 catalogued universities, silently, with
everyone else dropping to the `strengths` fallback: that is deleting the feature,
not hedging it. And a badge on 96.5% of rows cannot help a student choose between
two of them.

⚠️ `NEEDS_REVIEW` is the **default** state of crawler output that has not been
through a rule validator. It does not mean "we think this is wrong" — `REJECTED`
means that. Do not label it "unverified" anywhere.

What ships instead: `REJECTED` rows are excluded (zero today, so it is insurance),
and the picker says once, under the heading, *"Collected from this university's
own course catalogue. Check the official page before you apply."* with
`official_url` — populated on all 404 — offered as a link on the chosen
programme.

**2. Names are peeled back to the subject** (`tidyProgrammeName`). Crawled names
are frequently every facet concatenated, sometimes with the school twice:

> Health Education and Health Communication, MSPH Bloomberg School of Public
> Health Master's Full-time Part-time Bloomberg School of Public Health In-person

That is 154 characters, and the median name is 35. Across all 404 rows: p90
84 → 65, worst 154 → 47, 44 shortened, and **0 outputs that are not a prefix of
their input** — the same invariant `leadFragment` carries.

⚠️ **It peels the TAIL; it must never cut mid-string.** The first version cut at
the earliest facet word anywhere in the name, which turned Georgia Tech's
"Computer Science – Online Degree (MS)" into "Computer Science" — losing the
distinguishing clause *and* colliding with the real "Computer Science (MS)" two
rows below it in the same list. Found by looking at the rendered picker; there is
a regression test on it now.

**3. Dedupe keys on name AND degree.** The same subject is commonly catalogued at
two levels, and collapsing on name alone would delete one of the two things the
student came to choose between. Measured: tidying costs **0** extra rows to
dedupe — the 5 rows it does collapse are duplicates already present upstream
(Princeton lists "Computer Science" twice at master's and twice at bachelor's).

The frame's "Mã học bổng" + "ÁP DỤNG" redeem-a-code control is **still not
built**, for the same reason as the first time: no voucher table, no code column,
no endpoint. Migrating to the new canvas did not add one.

#### The migration

`supabase-saved-program.sql` adds `user_universities.program` and `program_url`.
**Applied by the owner 2026-07-31**; confirmed live, and the round trip works —
picking "Computer Science (MS)" at Georgia Tech stores that string and the card
renders "Subject: Computer Science (MS)".

The tolerance built while it was outstanding is worth keeping: the read is a
`select('*')`, so a project without these columns still renders the list rather
than failing whole. If you add another column here, do not switch that to an
explicit list.

⚠️ The missing-column check matches on the PostgREST **code**, verified against
the live API: `PGRST204`, message `Could not find the 'program' column of
'user_universities' in the schema cache`. Note "column" comes *after* the column
name — an obvious `/column .*program/` pattern misses it, and did.

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

#### The same class of bug again, one page over (found 30/07)

**Nothing in the product linked to `/my-universities` at all.** Not the nav, not
the footer, not the heart that saves to it. `src/proxy.ts` sends every fresh
sign-in there and `/universities/[id]` has a save button whose entire purpose is
to put a row on it — and the only way to *read* the result was to type the URL.

Same shape as the paragraph above and worth stating as a rule: **a page that
writes data needs a link to the page that reads it, and the writer is not that
link.** Grep for `href="/<route>"` before calling a route done; zero hits outside
its own subtree is the tell.

Fixed with `src/components/saved-nav-link.tsx` — a heart with a count in
`TopNav`'s `utility` slot, plus a row in `MobileNav`'s drawer. It reads its own
count (`head: true`, RLS-scoped, renders nothing when signed out or on error)
rather than being threaded through the seventeen places `TopNav` is constructed.

⚠️ **It was 61px wide and that broke the header.** `TopNav` already warns that
its six nowrap labels crowd the actions; the first version pushed the nav 14px
past its box on `/universities` and 27px on `/my-universities`, clipping "Blog" to
"B" **at 1440, the design's own width**. Confirmed as this control's fault by
deleting the element from the live DOM and re-measuring (overflow → 0). It is now
32px square with a corner count badge. **Anything else added to that slot needs
the same measurement.**

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

### Every jump-to-section link showed a 10-second fake loader (found 30/07)

Owner report: clicking a section in the detail page's bar "loads quite long
(about 10s)". **10s was not a coincidence — it is `SAFETY_MS` in
[route-loading.tsx](../src/components/route-loading.tsx) to the millisecond.** A
duration that exactly equals a timeout constant means nothing was ever loading;
a handle was opened and nothing could close it.

`navigatesInApp()` already declined hash-only links correctly, so the click path
was innocent. The culprit was one line further down:

```ts
window.addEventListener('popstate', start);
```

**Chrome fires `popstate` for a same-document fragment navigation.** So every
anchor click opened a loader, and all three of its exits were closed:
- `usePathname()` does not change on a hash change → the commit effect never ran.
- The URL poll captured its "from" *inside* `start()`, which on popstate runs
  **after** the address bar has already updated → it compared the new URL against
  itself, forever.
- Leaving only `SAFETY_MS`.

Fixed by remembering the last settled `pathname + search` in a ref (popstate
cannot read where it came from — it has to have been recorded beforehand) and
ignoring any traversal that does not change it. Query-string-only traversals are
ignored too, for the same unendable-loader reason; they are cache-served and
imperceptible.

⚠️ **The unit test asserted the bug.** `route-loading.test.tsx` had "shows the
loader on back/forward navigation" dispatching a bare `PopStateEvent` **without
touching the URL** — encoding "any popstate is a navigation", which is precisely
what was wrong. It now updates the URL first, in the order a browser does, and
there are four new cases pinning hash-only and query-only traversals.

**Second instance of the same root cause, introduced the same day:** the rewired
university card calls `preventDefault()` for guests to show the login gate.
`RouteLoading` listens on **capture**, so it runs before React's handler and sees
`defaultPrevented === false` — a cancelled click therefore also parked the loader
for the full 10s. Fixed with the `data-no-loader` opt-out the component already
provides, applied only when signed out. **Any handler that may cancel a `<Link>`
needs that attribute.**

Related, and part of why the page felt slow in Vietnamese: the section labels
were not in `i18n-dictionary.ts`, so the bar rendered half-translated
("Giới thiệu · Subjects · Tuyển sinh · Location") until several sequential
`/api/translate` round trips returned. The fixed UI strings are now static
entries — 4 round trips down to 3, and the remaining ones are the university's
own prose, which genuinely needs the model.

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
| ~~`src/app/profile/`~~ | **0** | **Done 31/07** — see "The two consoles" below. |
| ~~`src/app/admin/`~~ | **0** | **Done 31/07** — see "The two consoles" below. |
| `src/app/dashboard/` | 12 | 6 routes. |
| `src/app/coordinator/` | 8 | |
| `src/app/my-universities/[id]/` | 3 | Task/writer pages under the rebuilt list. |
| `src/app/news/[slug]/` | 2 | `article-body.tsx`. |

`src/app/mentors/` is no longer on this list — the browse page was rebuilt and
`MentorBrowse.tsx` deleted, and `/mentors/[id]` was rebuilt on 29/07 (which also
deleted `MentorProfile.tsx`, `BookMentorModal.tsx` and
`MentorAvailabilityGrid.tsx`). `/mentors/apply` and its success page still use
the app chrome — and `/mentors/apply/page.tsx` is the last `.glow-pill` in the
mentors tree.

Definition of done for any of these: the grep in [verification.md](verification.md)
returns nothing for that route's whole tree. Half-converted is the worst state —
`globals.css` is 5,375 unlayered lines that out-rank Tailwind utilities.

### The two consoles — rebuilt 31/07 with NO Figma frame

`/profile` (9 routes) and `/admin` (8 routes) were brought onto the token system
at the owner's request. **Neither is drawn anywhere in the Figma file**, so
nothing here is measured — do not go looking for the node id, and do not
"correct" these pages against a frame that does not exist. The rules followed
instead were the token scale, the primitives in `src/shared/ui`, and the
dark-band vocabulary (`bg-surface-inverse-deep` + the `fg-on-inverse-*` ramp)
that the footer and top nav already use, so both consoles read as the same
product as the marketing pages.

Four things were added to the design system to make this possible. All are
token-only and all carry a "no Figma source" header, the same standing as
`ProgressBar` and the error ramp:

| Added | Where | Why |
|---|---|---|
| `Panel` · `PanelHeader` · `StatTile` | `shared/ui/panel.tsx` | ~30 cards and 17 stat tiles across the two consoles. Hand-writing `rounded-gb-2xl border border-line bg-surface` thirty times is thirty chances to drift. |
| `Badge` `safe-chip` / `neutral-chip` | `shared/ui/badge.tsx` | An admin status column stacks all four states in one table column, so they must share one geometry. `brand-chip` and `info-chip` already existed; these are the other two steps. |
| `Button` `secondary-destructive` | `shared/ui/button.tsx` | Four irreversible actions in the console. **Read its comment before reaching for `className="text-fg-error"` instead** — that was tried and silently does nothing (see below). |
| `AdminHeading` · `TableShell` · `TH`/`TD` · `Alert` · `EmptyRow` | `src/app/admin/_ui.tsx` | Console-only. Deliberately not in shared/ui: nothing outside `/admin` renders a data table. |
| `SaveBar` · `TagInput` · `SelectOptions` | `src/app/profile/_form-parts.tsx` | Profile-only. The save row was copy-pasted five times, the tag field five times. |

Deleted as dead code, all three unreferenced: `profile/personal-info-card.tsx`,
`profile/profile-sticky-bar.tsx`, `profile/profile-avatar.tsx`.

**A trap worth writing down: `className` cannot override a `Button` variant's
colour.** `<Button variant="secondary" className="text-fg-error">` renders grey.
Both are `color` utilities, and Tailwind resolves the conflict by stylesheet
order, not by the order of the class attribute — `secondary`'s own
`text-fg-secondary` wins. It shipped that way for one screenshot cycle on the
Kick and Delete buttons before a render caught it. Anything that needs a
different colour needs a variant, not a class.

Four things the old pages did that these deliberately do not, each removed
rather than restyled:

1. **A green "Verified" tick on every student**, whatever their account. Nothing
   in the schema verifies anything about a student.
2. **"Active N · Submitted 0 · Offers 0"** on the profile applications card,
   where the last two were literals. Now one figure, and it is real.
3. **Work experience and English proficiency scored at a hard-coded 0%.** Both
   live in their own tables and `/profile/page.tsx` fetched neither, so the
   cards read "Get started" to a student who had already filled them in and
   dragged the overall strength figure down. Two `head: true` counts fixed it.
4. **A `<select>` silently showing the wrong value.** Several option lists were
   rewritten after onboarding shipped, so real rows hold strings the current
   list does not contain — the E2E account's `budget_range` is "Up to $25k",
   which is not in `BUDGET_OPTIONS`. A native select whose value matches no
   option displays the *first* one, so the page rendered "Under $10,000 / year"
   in a field that would have overwritten the real answer on the next save.
   `SelectOptions` appends the stored value. Six selects were affected.

Verified 31/07 on a production build with `ADMIN_USER_IDS` set in the server's
environment (no DB write — see verification.md): all 16 routes 200, no redirect,
**no horizontal overflow at 360 or 1440**, no console errors beyond the two
`_vercel/insights` 404s that every local page produces.

---

## Pages that render their own chrome

`src/components/nav-reveal.tsx` suppresses the legacy app sidebar and mobile nav
for pages that ship `TopNav` + `MobileNav` + `Footer` themselves. Two lists
since 28/07:

- `OWN_CHROME_ROUTES`, matched **exactly**: `/`, `/dev/home`, `/universities`,
  `/auth`, `/coming-soon`, `/onboarding`, `/about`, `/news`,
  `/my-universities/program`, `/apply`, `/mentors`, `/dev/saved-list`. Exact,
  because the child routes under most of them (`/news/[slug]`,
  `/my-universities/[id]`, `/universities/vinuni`, `/mentors/apply`) are still
  on the app chrome. `/my-universities` itself came off this list on 31/07 when
  it stopped being a page — only the subject picker under it remains.
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
