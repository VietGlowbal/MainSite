# Verification

## Gates — run after every page, not at the end of a wave

```bash
npm run typecheck && npm run typecheck:strict
npm run lint            # 0 errors. 30 warnings are pre-existing; do not add any.
npm test                # baseline: 474 pass / 2 todo (was 355 before the apply-primitives merge)
npm run build           # the only gate that catches what Vercel catches
```

⚠️ **`npm run build` is not optional.** A branch that was behind `origin` once
merged cleanly, passed typecheck, and still failed on Vercel with
`Cannot find name 'useLoadingIndicator'` — the merge kept one side's call and
the other side's imports. Neither `tsc --noEmit` on the pre-merge tree nor the
tests caught it. Run the build after every merge, not only before a PR.

Per wave, plus a legacy sweep of the page's whole tree:

```bash
npm run test:e2e        # baseline: 50 pass / 3 skipped / 0 fail (see below)
grep -rE 'class(Name)?="[^"]*\b(glowbal|auth|glow|profile|cosmic|cosmos|onboarding|geo|explorer)-' <page-tree>
# must return nothing
```

### e2e baseline, post-migration

`public.user_universities` was created 2026-07-27 (see known-issues.md §1), so
the one expected failure this doc used to document is gone. Current baseline
(re-measured 2026-07-30): **52 pass / 1 fail** with `E2E_EMAIL`/`E2E_PASSWORD`
set in the Playwright process, **49 pass / 1 fail / 3 skipped** without them (the
signed-in specs skip rather than fail).

⚠️ **The 1 failure is `kitchen-sink.spec.ts` → "design tokens render as
expected", and it is PRE-EXISTING on `feat/saved-uni-page`.** Verified by
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
`user_universities` now exists (2026-07-27) but is empty in production, so a real
account still shows the empty state. `/dev/saved-list` renders the same client
component from the real repositories with only the `user_universities` read
substituted — real covers, ranks, deadlines, crests, and really-linked
scholarships.

Prefer this pattern over writing to the owner's database. Same idea as
`/dev/home` and `/dev/kitchen-sink`; gate it identically:

```ts
const enabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_ROUTES === '1';
if (!enabled) notFound();
```

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
