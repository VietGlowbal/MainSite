<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing codes. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Persistent memory

> ⚠️ This section used to mandate an `agentmemory` MCP server (`memory_recall`,
> `memory_smart_search`, `memory_save`). **That server has never been connected
> to this project** — a sweep of all 28 recorded sessions on 2026-08-15 found
> zero calls to any `memory_*` tool, because none was ever available. The
> instruction only ever cost each session a failed attempt or an apology.
> Replaced with the mechanism that does exist.

Durable cross-session memory lives in **`docs/`**, which is version-controlled
and reviewable. Treat it as the memory store:

- **Recall** by following the router in `docs/README.md` and searching
  `docs/current-status.md` for the affected feature — not by re-deriving context
  from the code.
- **Save** by updating `docs/current-status.md` and the task-specific document,
  per the workflow below. A decision that is not written there did not persist.
- Never store secrets, credentials, personal data, or unverified assumptions in
  documentation.
- Code and configuration are the source of truth; correct or supersede stale
  documentation when you find it rather than working around it.

Claude Code additionally keeps a private per-user memory outside the repo
(`~/.claude/projects/<project>/memory/` with a `MEMORY.md` index). That is for
user preferences and cross-session working context, **not** a substitute for
`docs/` — anything the next contributor needs belongs in the repo. Do not
install or start a memory service without explicit user approval.

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
