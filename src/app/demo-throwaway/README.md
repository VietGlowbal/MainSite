# THROWAWAY DEMO — delete after the demo

Everything for the Application Strategy walkthrough lives in this one folder.

## Delete it

```bash
rm -rf src/app/demo-throwaway
```

That is the whole cleanup. Nothing outside this folder was changed, so there is
nothing else to revert. To confirm, `git status` should be clean apart from the
pre-existing Feature 2 work.

## What it is

A clickable walkthrough of the `/ai-strategy/[applicationId]` workspace from
`.kiro/specs/ai-application-strategy`, running entirely on in-memory fixtures.
No Supabase, no OpenAI, no network calls. The placeholder `.env.local` is enough.

Start at http://localhost:3000/demo-throwaway

## Why it is safe

- **Reads only.** It imports from `@/shared/ui`, `@/features/apply/domain` and
  `@/features/application-strategy/domain`. It does not modify them.
- **No writes anywhere.** State is React `useState`. Reloading resets it.
- **Route-isolated.** `/demo-throwaway/*` collides with nothing. The real
  `/ai-strategy/*` routes are untouched.
- **Gated.** `layout.tsx` 404s unless `NODE_ENV !== 'production'` or
  `ENABLE_DEV_ROUTES=1`, matching the existing `/dev/*` convention. The gate is
  in a server component deliberately — see the comment in `/dev/reflection`.

## What is real vs faked

Real, imported from the committed domain layer:

- `cvStatus`, `statementStatus`, `strategyStatus`, `nextAction`, `statusLabel`
- `isReviewOutdated`, `isExportOutdated`, `isAnalysisOutdated`
- every type in `domain/types.ts`

Faked in `fixtures.ts` because the API and AI layers are not built yet:

- AI generation, CV review, statement analysis (canned results on a timer)
- PDF export (a state machine, no actual PDF)
- document text extraction

## Scenarios

Append `?scenario=` to any demo page. The switcher in the header does this too.

| Scenario  | What it shows |
|-----------|---------------|
| `empty`   | Nothing started. Empty states and first-run actions. |
| `partial` | Mid-flight. Review outdated after CV edits, export stale. |
| `ready`   | All green. `Continue to Submit Audit` handoff. |

`partial` is the interesting one — it is where the staleness logic is visible.
