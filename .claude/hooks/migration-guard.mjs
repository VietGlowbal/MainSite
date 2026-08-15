#!/usr/bin/env node
// PreToolUse guard for Edit/Write on already-committed supabase-*.sql migrations.
//
// Why this exists: known-issues.md §0 records that editing an applied migration
// cost the owner four re-runs. `ADD COLUMN IF NOT EXISTS` matches on NAME, not
// TYPE, so re-running a repaired migration can never fix a wrong column. The
// only correct move is a guarded follow-up file. Docs alone did not stop this
// from recurring, so the reminder fires at the moment of the edit instead.
//
// This does not block. It injects one line of context so the agent knows to add
// a follow-up rather than rewrite history it cannot re-apply.

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw || '{}');
} catch {
  process.exit(0); // never break a tool call over a parse failure
}

const filePath = payload?.tool_input?.file_path ?? '';
const name = basename(filePath);

if (!/^supabase-.*\.sql$/i.test(name)) process.exit(0);

// A file git has never seen is a brand-new migration: nothing to warn about.
let tracked = false;
try {
  execFileSync('git', ['ls-files', '--error-unmatch', filePath], {
    stdio: 'ignore',
  });
  tracked = true;
} catch {
  tracked = false;
}

if (!tracked) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        `${name} is a committed migration and may already have been applied to ` +
        `Supabase. known-issues.md §0: ADD COLUMN IF NOT EXISTS matches names, ` +
        `not types, so editing this file cannot repair a wrong column — a re-run ` +
        `silently no-ops. Unless you are only changing comments, write a guarded ` +
        `follow-up migration in a NEW file instead. Verify current column types ` +
        `against the live database before deciding.`,
    },
    suppressOutput: true,
  }),
);
