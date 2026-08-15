<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing codes. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Persistent memory

- For every task, use agentmemory before planning or changing files.
- Before work, call `memory_smart_search` or `memory_recall` with the project,
  task, and affected feature terms; read relevant hits before deriving context.
- After material work, call `memory_save` for durable decisions, verified
  findings, outcomes, checks run, and unresolved risks. Do not store secrets,
  credentials, personal data, transient logs, or unverified assumptions.
- Treat code, configuration, and current documentation as the source of truth;
  correct or supersede stale memory when discovered.
- If memory tools are unavailable, report that once and continue with the
  project context workflow. Do not install or start a memory service without
  explicit user approval.

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
