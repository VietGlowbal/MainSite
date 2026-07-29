# Known issues

Ordered by how likely they are to waste your time.

---

## 1. FIXED 2026-07-27 — `public.user_universities` migration applied

Was: PostgREST answered `Could not find the table 'public.user_universities' in
the schema cache` even for the service-role key. The owner ran
`supabase-schema.sql:151` and it is now confirmed live (empty, RLS enabled,
`application_tasks`'s FK to it resolves).

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
a.from('user_universities').select('id').limit(1).then(r => console.log(r.error?.message ?? 'OK'));
"
```

This unblocks: the heart button on `/universities`, `GET
/api/home/save-university`, `/my-universities` actually holding rows, and
`tests/e2e/signed-in.spec.ts` → *"saving a university survives a reload"*
(baseline moves from 51 pass / 1 fail to 52 pass / 0 fail).

Related tables that were already populated: `universities` (97),
`scholarships` (2877), `scholarship_universities` (374), `user_scholarships`,
`student_profiles`, `course_applications` (29), `team_members`, `geo_articles`,
`achiever_profiles` (8, 7 approved).

---

## 1b. `public.achiever_profiles` has no public-read RLS policy

Found while rebuilding `/mentors`: the anon role reads back **zero rows** from
`achiever_profiles`, so the request-scoped Supabase client used by the old
`getApprovedMentors` silently returned an empty directory to every signed-out
visitor. Confirmed directly:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
a.from('achiever_profiles').select('id').eq('status','approved').then(r => console.log(r.error?.message ?? 'rows: ' + r.data.length));
"
```

Worked around, not fixed, in `src/lib/mentors.ts`: `getApprovedMentors` now reads
through `createAdminClient()` and projects onto an explicit `PublicMentor` type
(name, avatar, university, subject, bio, help topics, rating, session rate —
**not** `legal_name`, `date_of_birth`, the four verification storage keys, or
`stripe_account_id`, which the old `select('*')` was serialising into every page
load regardless of the RLS bug). The durable fix is a
`status = 'approved'` public read policy on the table; this workaround should be
revisited once that migration exists.

---

## 2. Hydration mismatch on `/universities` — reduced, not eliminated

The imagery patch (`setWithImages`) lives **outside** the `<Suspense>` that wraps
`Chrome`, so its state update can land while the card subtree is still hydrating.
React then discards the server HTML and re-renders the whole tree — and the
explorer comes back with default state, which is how a signed-in card click could
end up on the login gate.

Only reproduces once `/api/university-images` is warm enough to answer in a few
milliseconds, which is why it appears after repeated runs and not on a cold visit.

Mitigated in `src/app/universities/university-list-client.tsx` with
`startTransition` plus a one-frame `requestAnimationFrame` defer. Clean in most
runs, **still reproduces occasionally**.

Proper fix (not done): move the imagery state inside the Suspense boundary, or
resolve imagery server-side and drop the client patch.

---

## 3. Dead code

| File | Lines | Status |
|---|---|---|
| `src/app/onboarding/profile-form.tsx` | 599 | Orphan — nothing imports it. 14 legacy classes. |
| `src/app/onboarding/world-picker.tsx` | 701 | Imported only by `onboarding-globe-quiz.tsx`, itself an orphan. 13 legacy classes. |
| `src/components/onboarding/onboarding-globe-quiz.tsx` | 663 | Orphan. |
| `src/components/onboarding/onboarding-single-page.tsx` | 564 | Orphan — only referenced from comments in `i18n-dictionary.ts` and `selection-cache.ts`. |

These are ~2,500 lines and most of `src/app/onboarding/`'s 43 legacy classes.
Deleting them is safe and would make the onboarding tree clean, but it was left
alone because nobody asked. `src/app/my-universities/my-universities-client.tsx`
(928 lines) was in the same state and **has** been deleted — it is in git history
if it is ever wanted back.

---

## 4. `parseDeadline` resolves bare "Jan 15" to the year 2001

Pre-existing and **deliberately pinned by a test** in
`src/features/universities/domain/__tests__/formatting.test.ts` — V8's
`Date.parse('Jan 15')` succeeds and wins before the roll-forward fallback can run.

Do not "fix" it without updating that test, which exists so the fix is a visible
diff. `formatDeadlineLabel` guards against it: a parse landing more than a year in
the past is treated as "the string had no year", and the original prose is shown
instead. That is why `/my-universities` prints
`Deadline: UG: Jan 1 (EA: Nov 1) | PG: Dec–Jan varies by dept` rather than a
confidently wrong date.

---

## 5. Fixed 2026-07-26 — do not re-introduce

| What | Where |
|---|---|
| Password reached the URL. A submit landing before hydration falls through to a native GET, putting `email`/`password` in the query string, history and access logs. Both forms now carry `method="post"`. | `src/app/auth/auth-form.tsx`, `src/app/guides/guides-client.tsx` |
| Save failed silently — `addToShortlist` discarded the upsert error and kept the optimistic state, so the UI said "Saved" and the row vanished on reload. Now logs, rolls back, toasts. (`showToast` had to be hoisted above `addToShortlist`: a `useCallback` deps array is evaluated at the call site, so naming a `const` declared below throws on the TDZ.) | `src/features/universities/ui/explorer-context.tsx` |
| Signed-in card click never opened the detail view. One effect wrote `?u=<id>`; the other read the URL before that write landed, saw no `?u`, and reverted to `browse`. Guests never hit it because `setView` bounces them to the login gate first — which is why the guest suite stayed green and hid it. | `useUniversityUrlSync` in `src/app/universities/university-list-client.tsx` |
| Every blog guide fell back to empty frontmatter — `parseFrontmatter` anchored on `\n---\n` and the draft files are CRLF. Titles rendered as slugs, excerpts as `---`, dates as today. | `src/lib/geo-content.ts` |
| Logo rendered blurry with colour fringing. `public/glowbal-logo.png` is 1115×398 but the wordmark occupies only 929×163 of it, so `height={28}` gave a 78×28 box with ~11px lettering. Cropped to the framing Figma itself uses (node `153:18271`) → `public/brand/glowbal-wordmark.png`, 1115×227, `quality={90}`. `height={28}` now yields the design's 138×28. | `src/components/glowbal-logo.tsx` |

---

## 5b. Fixed 2026-07-27 — do not re-introduce

| What | Where |
|---|---|
| The legacy app sidebar (`NavReveal`) overlapped the new `/apply` page. Rebuilding a page onto its own `TopNav`/`MobileNav`/`Footer` chrome does nothing on its own — the route also has to be added to `OWN_CHROME_ROUTES`, or the old sidebar renders on top of it. Confirmed by screenshot before the fix. | `src/components/nav-reveal.tsx` — same list also needed `/mentors` for the same reason |
| `achiever_profiles` has no public-read RLS policy — see 1b above. | `src/lib/mentors.ts` |
| Mentor card badge overflowed into the next grid column. `Badge` bakes in `whitespace-nowrap`, and real university names run to "London School of Economics and Political Science" — the pill needs its own line and a `truncate` on the text inside, not inline with the name. | `src/app/mentors/mentors-client.tsx` |
| `setState` called synchronously inside a `useEffect` body (new lint error, baseline is 0). The "open the course-search modal from a query param" flag is a prop, so opening the modal belongs in `useState`'s initializer, not a reaction fired from an effect. The effect that's left only strips the query param, which is a real side effect. | `src/app/apply/apply-list-client.tsx` |

---

## 6. Open questions for the designer / owner

1. **The sitemap frame (`123:2864`, "Dg-final") no longer exists in the file.**
   Both canvases were scanned at full depth on 2026-07-27 — no `123:*` node, no
   node named like a sitemap. `nav-items.ts` cites it as the reason
   `/ai-strategy` and `/apply` stay separate destinations; that citation is now
   dead. Restore the frame, or re-confirm the split some other way.
2. **Scholarship code field** (`223:13022`) — new feature needing a backend, or drop it from the design?
3. **`achiever_profiles` public-read RLS** — see 1b above. Needs a
   `status = 'approved'` policy; currently worked around with the admin client.
4. **Error ramp** — `tokens.css` ships an Untitled UI stock error ramp. No frame draws an error state, so it is unconfirmed.
5. **Ratings badge** — "Best AI Tool · 2,000+ reviews" is placeholder the owner asked to keep temporarily. It appears in the footer of every page, so it is a public claim.
6. **X (Twitter)** — drawn in the footer frame `104:7422` with no handle supplied. Currently omitted; Instagram has no art in Figma at all (hence the hand-shaped `InstagramMark`).
7. **Rose `#e11d48`** — confirmed as brand by the owner, but Figma variables still resolve to Untitled UI purple `#6941c6`. `tokens.css` is the authority; do not "correct" it against a variable dump.
