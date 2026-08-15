---
description: Run the verification gate that matches what actually changed
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(npm run:*), Bash(npm test), Bash(npx:*)
---

Pick the smallest gate that covers the change — do not run everything by reflex,
and do not skip the build when the change could affect it.

First look at what changed:

```bash
git status --short && git diff --stat HEAD
```

Then run the matching gate. Commands are in `package.json`; the measured
baseline and CI behavior are in `docs/verification.md`.

| What changed | Run |
|---|---|
| Types / any `.ts` under `features`, `shared`, `server` | `npm run typecheck` then `npm run typecheck:strict` |
| A component or page | `npm run typecheck` + `npm run lint` |
| Logic with tests behind it | `npm test` (or `npx vitest run <file>` for one file) |
| Anything, after a **merge** | `npm run build` — non-negotiable, see below |
| Before a PR | `npm run verify:pr` (the full CI gate, ~4 min) |

⚠️ `npm run build` is not optional after a merge. A branch once merged cleanly,
passed typecheck, and still failed on Vercel with `Cannot find name
'useLoadingIndicator'` — the merge kept one side's call and the other side's
imports. Neither `tsc --noEmit` nor the tests caught it.

Report only what you actually ran and what it actually returned. If a gate
fails, show the output — never describe an unrun check as passing. If you
skipped a gate, say which and why.

$ARGUMENTS
