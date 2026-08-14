<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing codes. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Project context workflow

Before planning or changing code:

1. Read `docs/README.md` as the documentation index.
2. Read only the documents it routes to for the current task. Do not bulk-load
   unrelated plans, audits, or historical design notes.
3. Search `docs/current-status.md` for the affected feature and recent work
   before re-deriving project context. Treat code and configuration as the
   source of truth when documentation is stale.

After material changes:

1. Run the task-relevant checks in `docs/verification.md`. Before a PR, ensure
   the checks used by `.github/workflows/ci.yml` pass.
2. Update `docs/current-status.md` and any task-specific document when commands,
   architecture, behavior, CI, setup, or known risks changed. Record only
   measured results; never claim an unrun check passed.
3. Keep documentation concise and replace stale status instead of appending a
   conflicting account. Trivial refactors that change no behavior or workflow
   do not require a documentation update.
