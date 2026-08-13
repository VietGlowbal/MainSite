# Verification

Last measured on branch `fix/feedback-118` at `24117e3` plus the PR #182 My
Portal logo reconciliation and cron-budget work on **2026-08-14**. Results are
also summarized in [current-status.md](current-status.md).

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

Current measured local snapshot (Node 24.19.0):

The 2026-08-14 Node 24.19.0 runtime alignment ran the complete
`npm run verify:pr` gate after the logo-reconciliation work. The aggregate gate
passed in 248 seconds.

| Gate | 2026-08-14 result |
|---|---|
| Lint | **Pass:** 0 errors, 23 warnings. |
| Base typecheck | **Pass.** |
| Strict typecheck | **Pass.** |
| Vitest | **1983 pass / 2 todo** across **195 passing** files; coverage enabled. |
| Build | **Pass:** Next.js 16.2.3 production build completed. Placeholder Supabase fetches and the existing NFT trace warning were non-fatal. |
| E2E | Not rerun in the docs refresh. |

The follow-up cron-budget repair was checked on the resulting working tree with
10/10 focused Vitest tests, base and strict TypeScript, targeted ESLint, and a
Next.js 16.2.3 production build; all passed. The full coverage suite and E2E
were not rerun after that follow-up, so the aggregate table above remains the
latest full-suite measurement rather than a claim about the current tree.

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
the missing-table failure this doc used to document is gone. The last historical
baseline, measured 2026-07-30 and not yet rerun, was
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
the components still contain `MissingContent`, and `/` avoids it by omitting the
two sections that have no copy (testimonials, FAQ) and passing
`showPlaceholders={false}` to the two that are partly written.

What must stay true instead is a **rendered** assertion, not a grep — and it
already exists, in `tests/e2e/home-preview.spec.ts` → *"the real home page never
ships a missing-content marker"*. Trust that over a source scan: `src/app/page.tsx`
mentions `MissingContent` in its header comment, explaining which sections are
omitted and why, so grepping the file reports a hit that means nothing.

⚠️ `grep -rn "home-landing" src` is **not** empty, and this doc previously
implied it would be. The route was swapped, but the legacy tree
`src/components/landing/home/` (5 files, 1,510 lines) was never deleted and is
now orphaned — see known-issues.md §3. `globals.css` still carries two
`.home-landing-root` rules for it.

`/dev/home` deliberately keeps the full composition **including** the
placeholders, so the outstanding copy gaps stay visible somewhere.
