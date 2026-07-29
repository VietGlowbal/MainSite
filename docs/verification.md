# Verification

## Gates — run after every page, not at the end of a wave

```bash
npm run typecheck && npm run typecheck:strict
npm run lint            # 0 errors. 30 warnings are pre-existing; do not add any.
npm test                # baseline: 355 pass / 2 todo
```

Per wave, plus a legacy sweep of the page's whole tree:

```bash
npm run test:e2e        # baseline: 49 pass / 3 skipped / 0 fail (see below)
grep -rE 'class(Name)?="[^"]*\b(glowbal|auth|glow|profile|cosmic|cosmos|onboarding|geo|explorer)-' <page-tree>
# must return nothing
```

### e2e baseline, post-migration

`public.user_universities` was created 2026-07-27 (see known-issues.md §1), so
the one expected failure this doc used to document is gone. Current baseline:
**49 pass** when `E2E_EMAIL`/`E2E_PASSWORD` are not set in the Playwright
process (the 3 signed-in specs skip rather than fail), **52 pass / 0 fail** when
they are. If you see a failure instead of a skip on the signed-in specs, that is
a real regression, not the known gap this doc used to describe.

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

## Home swap gate

`/` cannot take the new design until this is empty:

```bash
grep -rn "MissingContent" src/features/marketing
```

Four sections still await owner copy. After the swap, `grep -rn "home-landing" src`
must also be empty.
