# Verification

Last measured locally on **2026-10-04**, on the Saved Universities integration
with main `57e91918`, using **Node 24.19.0/npm 10.9.2** and the existing install
(the merge changes no dependency/lockfile). Results are
also summarized in [current-status.md](current-status.md). This is not a claim
that the new integration has passed GitHub Actions or independent review.

## Gates

GitHub Actions runs the full pull-request gate automatically. Local pushes do
not run it. Use the same aggregate command manually before a PR when needed:

```powershell
npm.cmd run verify:pr
```

For targeted iteration, run the relevant individual commands:

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:strict
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Run `npm ci` first on a fresh or suspect checkout. Do not diagnose missing-module
errors as product regressions before confirming the install is current.

⚠️ **`npm run build` is not optional.** A branch that was behind `origin` once
merged cleanly, passed typecheck, and still failed on Vercel with
`Cannot find name 'useLoadingIndicator'` — the merge kept one side's call and
the other side's imports. Neither `tsc --noEmit` on the pre-merge tree nor the
tests caught it. Run the build after every merge, not only before a PR.

Current measured local snapshot:

| Gate | 2026-10-04 result |
|---|---|
| Lint | **Pass:** 0 errors, 9 warnings. |
| Base typecheck | **Pass.** |
| Strict typecheck | **Pass.** |
| Vitest | **4289 pass / 2 todo** across **454 passing** files; coverage enabled and thresholds passed. |
| Saved Universities coverage | The six affected files and their 109 regression tests are included in the full suite. |
| Build | **Pass:** Next.js 16.3.1 production build, including `build:ci` in the aggregate gate. |
| `verify:pr` | **Pass**, using the unchanged repository gate. |
| E2E | Earlier `c2e63de2` local run: **70 pass / 0 fail / 9 skipped** on an owned fresh production server. Not rerun locally after the Saved Universities/main merge; fresh shared CI required. |
| i18n | Missing static keys, placeholder mismatches and dynamic-catalog misses **0**. |
| `git diff --check` | **Pass.** |

The earlier local E2E skips are seven signed-in tests (no local `E2E_EMAIL`/`E2E_PASSWORD`)
and two absent platform-specific Home baselines. Signed-in flows therefore
remain unverified by this run. Old-project Storage images still log HTTP 402;
their bytes have not been restored into the new project. Independent OpenCode
delta review could not start (configured providers returned HTTP 401); report
**NOT COMPLETED**, not PASS. Fresh shared CI is required after pushing.

The previous feature CI `37120195871` passed verify but failed E2E because its
Supabase project returned catalogue `exceed_storage_size_quota`. With owner
approval, the three GitHub Actions Supabase secrets were updated from the new
validated local environment, without logging keys or changing database data.
The independent main lockfile repair PR #244 then passed shared CI
`37126477773` (Ubuntu, Node 24.19.0/npm 11.17.0): verify and E2E, 67 passed/
10 skipped, no catalogue quota errors. This is environment/lockfile evidence,
not a substitute for CI on the new feature HEAD. The 10 shared skips include
seven missing-account tests and three absent Linux visual baselines.

Feature revision `69f7c1aa` subsequently passed shared CI `37127251317`
(Ubuntu, Node 24.19.0/npm 11.17.0): verify, 451 passing test files, production
build, and E2E 69 passed/10 skipped; all Planner checks passed. Catalogue quota
errors were absent, but old Storage image requests still returned HTTP 402.
Main advanced to `5472d476` while that run completed. The follow-up merge has
only a documentation conflict and preserves its upstream onboarding query
fix unchanged; it does not alter scholarship/application security or domain
code. Post-sync local sanity: both typechecks, lint (0 errors/9 existing
warnings), 354 focused tests across 52 files, i18n and diff checks passed.
Fresh CI is required on the resulting HEAD, not inferred from this run.

Main subsequently advanced to `24e038e6` (request-local onboarding memoization
and report-intent prefetch). Only the rolling status note conflicted; upstream
source was retained unchanged, and feature status notes were moved below the
stable main checkpoints to avoid repeated header conflicts. Scholarship,
valuation, application URL and recommendation source is unchanged. Post-sync
local sanity passed: both typechecks, lint (0 errors/9 existing warnings),
332 focused tests across 48 files including real-RSC user/application cache
isolation, i18n and diff checks. Shared CI must verify the new HEAD.

### Scholarship integration checks (2026-10-03)

The owner applied `sql/supabase-universities-city.sql` separately. Read-only
schema and nested-select probes returned HTTP 200; integration verification
did not run SQL, backfill city data, or acquire cost/FX references.

The candidate cache now stores raw rows as deflate/base64 (`raw-deflate-base64-v1`)
and normalizes after decoding, preserving evidence and non-JSON helper values
such as an undated deadline's `Infinity`. Complete sets are loaded in 1,000-row
batches; sort/page fields do not duplicate the raw-set cache. Regression tests
enforce the 2 MB serialized-entry limit, lossless decoding, global asc/desc
ordering across pages, two batched reads, and retry after a failed read.
At 2,877 published rows, raw JSON measured 6,208,025 bytes and encoded cache JSON
867,622 bytes. This is a current-scale measurement, not a guarantee for arbitrary
catalogue growth. Date, provider, FX and comparison-policy identities remain
part of the existing cache boundaries.

Home orbit assertions are unchanged and additionally run at 960/1100px;
960/1024/1100/1280/1440px all passed. The Windows kitchen-sink failure was traced
to intentional global-navigation deduplication in commit `9886033900c88ec5`:
the old reference included an extra 73px header. After aligning that offset
and rejecting optional cookies, the body differed by 0.026%, with unchanged
token geometry. Only the Windows baseline was regenerated (1280×7688 instead
of 1280×7761). The test now rejects optional cookies through the actual privacy
UI before capturing; no screenshot tolerance, assertion or timeout was weakened.
The subsequent full E2E run passed without snapshot-update mode.

Per wave, plus a legacy sweep of the page's whole tree:

```powershell
npm.cmd run test:e2e
rg 'class(Name)?="[^"]*\b(glowbal|auth|glow|profile|cosmic|cosmos|onboarding|geo|explorer)-' <page-tree>
# must return nothing
```

### E2E status and historical baseline

CI now runs Playwright on pull requests after the unit/build job. It intentionally
does not run for the daily GEO push to `main`, and it uploads `playwright-report/`
when the job fails. This corrects the 2026-08-03 audit statement that CI had no
E2E job.

`public.user_universities` was created 2026-07-27 (see known-issues.md §1), so
the missing-table failure this doc used to document is gone. The historical
baseline measured 2026-07-30 was
**52 pass / 1 fail** with `E2E_EMAIL`/`E2E_PASSWORD`
set in the Playwright process, **49 pass / 1 fail / 3 skipped** without them (the
signed-in specs skip rather than fail).

⚠️ **In that historical run, the 1 failure was `kitchen-sink.spec.ts` → "design
tokens render as expected", and it was pre-existing on `feat/saved-uni-page`.** Verified by
stashing all working-tree changes and re-running on a clean tree: it fails with
byte-identical numbers (expected 1280×7876, received 1280×7761, 1,293,946 pixels
different). Something committed on this branch changed that page's height and the
snapshot was never re-blessed. **Do not re-bless it blind** — find what changed
the height first, then decide. Do not spend time proving it is yours; it isn't.

Two flakes to expect rather than chase, both artefacts of `reuseExistingServer`
attaching to a `next dev` server:
- `smoke.spec.ts` → `/about` can 500 on its very first compile and pass on every
  later run.
- `signed-in.spec.ts` → "saving a university survives a reload" can fail under a
  busy full-suite run: the save does a second insert (tasks from
  `task_templates`) and the reload can beat the commit. Passes in isolation.

Re-run a suspected flake before treating it as a regression.

Not a flake, open as of 2026-09-14: `signed-in.spec.ts` → "scholarship focus
mode keeps two independent pages and apply focus" times out because the cookie
banner (`aside[aria-label="Cookie preferences"]`) intercepts the click on
`scholarship-continue-to-apply`. A fresh browser context has no consent record
and the test never dismisses the banner.

### Content Security Policy (`tests/e2e/csp.spec.ts`)

Run it after any change to `src/proxy.ts`, the root layout, `next/script`
usage, or a dependency that might `eval`. A missed nonce does not throw — the
page just stops hydrating — so this spec checks each page's Next runtime came up
and fails on any **enforced** `securitypolicyviolation`. It prints report-only
violations as `[csp] …`; that list is the evidence for promoting the origin
allowlists (docs/known-issues.md §0k). It aborts GA beacons so local runs never
record page views. Baseline 2026-09-14: 3/3 pass, 0 report-only guest, 1
signed-in (known essay-page eval).

It needs a production build — `next dev` adds `'unsafe-eval'` to the policy.

### Visual baselines

`home-preview.spec.ts` and `kitchen-sink.spec.ts` hold screenshot snapshots. Any
change to shared chrome (the logo, `TopNav`, `Footer`, tokens) will fail them.
Re-bless **only when the change is intentional**:

```bash
npx playwright test tests/e2e/home-preview.spec.ts --update-snapshots
```

## Playwright setup

`playwright.config.ts` has `reuseExistingServer: !CI`, so locally it attaches to
whatever answers on `:3000` — usually a `next dev` server. A green local run is
therefore **not** evidence CI will be green (CI always builds). `ENABLE_DEV_ROUTES=1`
is set so `/dev/*` is reachable in a production build.

Node is not on PATH for the Bash tool on this machine — **use the PowerShell tool
for `npm` / `node`**, or absolute-path the project's `node_modules`.

## Signed-in flows

`tests/e2e/signed-in.spec.ts` skips unless `E2E_EMAIL` / `E2E_PASSWORD` are set.
They are in `.env.local` (gitignored) for a dedicated test account. Never put
those values in a committed file.

⚠️ Playwright does **not** read `.env.local`, so a plain `npx playwright test`
skips every signed-in test and still reports green. Export the two variables
into the shell first (PowerShell, without echoing them):
`foreach ($l in Get-Content .env.local) { if ($l -match '^(E2E_EMAIL|E2E_PASSWORD)=(.*)$') { Set-Item "env:$($Matches[1])" $Matches[2].Trim('"') } }`

### Clicking before hydration

Playwright's `fill`/`click` wait for actionability, **not hydration**. A click
that lands early falls through to a native form submit. Wait for React first:

```js
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="auth-submit"]');
  return !!el && Object.keys(el).some((k) => k.startsWith('__react'));
});
```

This is how the "password in the URL" bug was found — worth keeping in any script
that drives a form.

## Seeing a gated page

`/my-universities` is behind the auth gate **and** the onboarding gate.
`user_universities` exists (applied 2026-07-27) and holds rows — the E2E account
had 2 saved universities on 2026-07-30, which is enough to see the real page.
`/dev/saved-list` renders the same client component from the real repositories
with only the `user_universities` read substituted — real covers, ranks, tuition,
deadlines, crests, and really-linked scholarships.

For the full cluster (list → subject picker → scholarship browse → detail →
apply → confirmation), signing in as the E2E user and walking it is better than
the preview, because the preview cannot exercise the writes. What that walk
showed on 2026-07-30, all with the `program` columns still absent:

| Step | Result |
|---|---|
| `/my-universities` | 2 rows, tuition badges, 2 "Choose a subject here" links |
| nav heart | `data-saved-count="2"`, no header overflow at 1440 |
| "Scholarships here" | 5 real linked scholarships, frame's card layout |
| "See details" | the `375:13369` panel, real columns |
| `/my-universities/program?u=82` | 6 subjects from `strengths` (the fallback path) |
| VI | list, bar and messages all in Vietnamese |

Re-checked 2026-07-31 with the `program` columns applied and a **catalogued**
university (Georgia Tech, id 104 — one of the 24):

| Step | Result |
|---|---|
| picker, school list | College of Computing 3 · College of Design 1 · College of Engineering 13 · Scheller College of Business 3 |
| picker, subject list | "Aerospace Engineering (BS) / Bachelor", "…(MS) / Master", … |
| narrowing by school | 20 → the 3 Computing programmes |
| save | stored `program: "Computer Science (MS)"` |
| the card | "Subject: Computer Science (MS) · Change subject here" |

⚠️ **That walk seeds a `user_universities` row and deletes it in a `finally`.**
Only ever for the `E2E_EMAIL` account, and only ever rows the script itself
inserted — the same rule as the shortlist test. Seeding for a real student's
account would put a university on their list that they did not choose.

Note `Radio` renders its `<input>` as a **sibling** of the label, not inside it,
so `label:has(input:checked)` matches nothing — read the value off the input.
That cost a run.

Prefer this pattern over writing to the owner's database. Same idea as
`/dev/home` and `/dev/kitchen-sink`; gate it identically:

```ts
const enabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
if (!enabled) notFound();
```

### Seeing `/admin` without writing to the database

`isAdmin` (`src/server/auth/auth-helpers.ts`) checks **`ADMIN_USER_IDS`** — a
comma-separated env var — before it checks `student_profiles.is_admin`. So an
admin session needs no migration and no row edit: put the E2E user's id in that
variable in the *server's* environment and sign in normally.

The owner's `next dev` usually holds :3000, so run a second server rather than
restarting theirs:

```powershell
npm run build
$env:ADMIN_USER_IDS = '<e2e-user-id>'; $env:ENABLE_DEV_ROUTES = '1'; npx next start -p 3001
```

Prefer this to flipping `is_admin` on a real row — nothing to remember to
revert, and it cannot leak past the process. ⚠️ `next start` reads the build
manifest at boot: **rebuild and restart it** after a code change, or you will
screenshot the previous build and think a fix did not land. That happened once.

### Verifying a page that needs real per-user rows and has no `/dev/*` preview

`/apply`'s gauge is banded by `progress_percentage`, and the real E2E account had
zero applications, so the empty state was all that would render. There is no
`/dev/apply` preview. Used the same idea `signed-in.spec.ts`'s shortlist test
uses — seed throwaway rows for the E2E user with the admin client, screenshot,
delete them in a `finally` block so a failure mid-run still cleans up:

```js
const { data: inserted } = await admin.from('course_applications')
  .insert(SEED.map((s) => ({ ...s, user_id: e2eUserId })))
  .select('id');
try {
  // sign in as the E2E user, screenshot, assert
} finally {
  await admin.from('course_applications').delete().in('id', inserted.map((r) => r.id));
}
```

Never point this at a real student's account — only ever the dedicated
`E2E_EMAIL` test user, and only ever rows this script itself inserted.

## Screenshotting

Check **360 / 768 / 1440**, and assert no horizontal scroll at 360:

```js
const w = await page.evaluate(() => document.documentElement.scrollWidth);
// must equal the viewport width
```

Drive it with the project's own `playwright-core` by absolute path, and use
`channel: 'chrome'`:

```js
const { chromium } = require('c:/Users/Tlinh/MainSite/node_modules/playwright-core');
const browser = await chromium.launch({ channel: 'chrome' });
```

⚠️ That snippet is CommonJS. If the script is `.mjs` (needed for top-level
`await`), plain `require` doesn't exist and a bare specifier import
(`import 'playwright-core'`) resolves against the *script's own* directory, not
the project — it fails when the script lives in the scratchpad. Use
`createRequire` rooted at the project instead:

```js
import { createRequire } from 'node:module';
const require = createRequire('file:///c:/Users/Tlinh/MainSite/package.json');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js'); // same trick if you need both
```

Compare each shot against the Figma node id recorded in
[redesign-status.md](redesign-status.md) — not against memory.

## Inspecting the database

⚠️ `npm run check:migrations` is **not read-only** despite its name: it calls
`claim_course_parse_jobs` with a test worker id and a batch size of one. Use the
schema/read queries below for a status audit unless you explicitly intend to
exercise the queue. Do not run that script merely to update documentation.

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
a.from('universities').select('*', { count: 'exact', head: true }).then(r => console.log(r.count, r.error?.message));
"
```

`dotenv` is not installed — use `node --env-file=.env.local`.

⚠️ A `head: true` count query can return no error for a table that does not
exist. Always confirm with a real `select()`.

### Checking a column's TYPE, not just its existence

Selecting a column proves the **name** exists and nothing else. That distinction
cost the owner four re-runs of a migration (known-issues.md §0): `curriculum`
existed, so every check passed, but it was `TEXT` where the app wrote `TEXT[]`.

PostgREST publishes the live schema at the REST root — no SQL editor needed:

```bash
node --env-file=.env.local -e "
const u = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', k = process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(u, { headers: { apikey: k, Authorization: 'Bearer ' + k } })
  .then(r => r.json())
  .then(s => console.log(s.definitions.student_profiles.properties.curriculum));
"
# {type:'array'}                      -> TEXT[]
# {type:'string', format:'text'}      -> TEXT, migration not applied
```

`s.definitions.<table>.properties` lists every column with its type, which also
answers "does this table have the column my TypeScript type claims it has" —
`session_reviews.reviewer_name` is declared in `src/types/mentorship.ts` and does
not exist (known-issues.md §2b).

### Verifying a public page as a guest

An RLS filter returning zero rows is a *successful* query, so error-checking
cannot detect it and a signed-in browser session will never reproduce it. For
anything reachable from the guest nav, read with the **anon** key:

```bash
node --env-file=.env.local -e "
const { createClient } = require('@supabase/supabase-js');
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
a.from('achiever_profiles').select('id').eq('status','approved')
  .then(r => console.log(r.error?.message ?? 'anon sees ' + r.data.length + ' rows'));
"
```

And fetch the page itself without cookies — which also catches PII the server
serialised into the payload for a client component:

```powershell
$c = (Invoke-WebRequest -Uri "http://localhost:3000/mentors/<id>" -UseBasicParsing).Content
foreach ($k in @('legal_name','date_of_birth','stripe_account_id','storage_key')) {
  Write-Host ("{0,-20} {1}" -f $k, $c.Contains($k))
}
```

## Home swap gate — **done 2026-07-28**

`/` now renders the new design (Figma `375:9844`). The gate this section used to
describe — "`grep -rn MissingContent src/features/marketing` must be empty" — was
**not** met and was resolved a different way, so do not re-apply it as written:
the components still contain `MissingContent`, and `/` avoids those unfinished
states by passing `showPlaceholders={false}` to the partly written feature and
scholarship content. Testimonials and FAQ are finished sections; testimonials
use supplied anonymous quotes and explicitly illustrative portraits rather than
fabricated student identities. **Since 2026-08-15 the testimonials section is
hidden on `/`** at the owner's request — `HomeTestimonials` is unchanged and
still renders on `/dev/home`; re-enabling it means re-adding the import and the
element in `src/app/page.tsx`.

What must stay true instead is a **rendered** assertion, not a grep — and it
already exists, in `tests/e2e/home-preview.spec.ts` → *"the real home page never
ships a missing-content marker"*. Trust that over a source scan: the marketing
component tree intentionally retains preview-only placeholder branches, so a
grep can report matches that never render on `/`.

⚠️ `grep -rn "home-landing" src` is **not** empty, and this doc previously
implied it would be. The route was swapped, but the legacy tree
`src/components/landing/home/` (5 files, 1,510 lines) was never deleted and is
now orphaned — see known-issues.md §3. `globals.css` still carries two
`.home-landing-root` rules for it.

`/dev/home` deliberately keeps the full composition, including the remaining
preview-only feature placeholders, so the outstanding copy gaps stay visible
somewhere.
