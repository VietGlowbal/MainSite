#!/usr/bin/env node
/**
 * Copy Supabase Storage files (the bytes, not just the manifest) from the old
 * project to the new one. pg_dump only carries `storage.objects` rows; the files
 * themselves live in the Storage service and must go through its API.
 *
 * Old project: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local)
 * New project: NEW_SUPABASE_URL + NEW_SUPABASE_SERVICE_ROLE_KEY
 *
 *   # 1. dry run (default): sizes per bucket, what would be copied
 *   NEW_SUPABASE_URL=... NEW_SUPABASE_SERVICE_ROLE_KEY=... \
 *     node --env-file=.env.local scripts/copy-supabase-storage.mjs
 *   # 2. copy
 *     ... scripts/copy-supabase-storage.mjs --apply [--bucket avatars --bucket university-images]
 *
 * Safe to re-run: files already present in the new project with the same size
 * are skipped, so an interrupted run resumes where it stopped.
 *
 * The old project's Storage API must be reachable. While it answers HTTP 402
 * (quota restriction) no file can be read — lift the restriction first.
 *
 * Quota guard: a Free project whose Storage exceeds 1 GB gets its WHOLE API
 * restricted (Auth and REST included), which is what happened to the old
 * project. --apply refuses to push the new project past --quota-gb (default 1).
 */

import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const argsOf = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] ? [args[i + 1]] : []));

const APPLY = args.includes('--apply');
const QUOTA_GB = Number(argOf('quota-gb') ?? 1);
const CONCURRENCY = Number(argOf('concurrency') ?? 4);
const onlyBuckets = argsOf('bucket');

const OLD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OLD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (old) and NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY (new).');
  process.exit(1);
}
if (OLD_URL.replace(/\/+$/, '') === NEW_URL.replace(/\/+$/, '')) {
  console.error('Old and new URLs are identical — .env.local may already point at the new project.');
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldSb = createClient(OLD_URL, OLD_KEY, opts);
const newSb = createClient(NEW_URL, NEW_KEY, opts);
const log = (...a) => console.log(...a);
const mb = (b) => (b / 1024 / 1024).toFixed(1);

/** Recursively list every file in a bucket → [{ path, size, mimetype, cacheControl }]. */
async function walk(sb, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      // Folders are synthesised by the API and carry no id.
      if (e.id === null) files.push(...(await walk(sb, bucket, path)));
      else if (e.name !== '.emptyFolderPlaceholder')
        files.push({
          path,
          size: Number(e.metadata?.size ?? 0),
          mimetype: e.metadata?.mimetype,
          cacheControl: e.metadata?.cacheControl,
        });
    }
    if (data.length < 1000) break;
  }
  return files;
}

// process.exit() while fetch sockets are closing trips a libuv assertion on
// Windows; return the code and let the event loop drain instead.
async function main() {
  // --------------------------------------------------------------- preflight
  const { data: oldBuckets, error: oldErr } = await oldSb.storage.listBuckets();
  if (oldErr) {
    console.error(`Old project Storage is not readable: ${oldErr.message}`);
    if (/restricted|402|quota/i.test(oldErr.message) || oldErr.status === 402)
      console.error('The old project is still API-restricted (HTTP 402). Files cannot be read until that is lifted.');
    return (1);
  }
  const { data: newBuckets, error: newErr } = await newSb.storage.listBuckets();
  if (newErr) {
    console.error(`New project Storage is not reachable: ${newErr.message}`);
    return (1);
  }

  const buckets = oldBuckets.filter((b) => !onlyBuckets.length || onlyBuckets.includes(b.id));
  log(`\nStorage copy ${APPLY ? '(APPLY)' : '(dry run — pass --apply to copy)'}`);
  log(`  old ${OLD_URL}\n  new ${NEW_URL}\n`);

  // ------------------------------------------------------------------ plan
  const plan = [];
  let newExistingBytes = 0;
  for (const nb of newBuckets) {
    try {
      newExistingBytes += (await walk(newSb, nb.id)).reduce((s, f) => s + f.size, 0);
    } catch {
      /* empty or unlisted bucket — counted as 0 */
    }
  }
  for (const b of buckets) {
    const src = await walk(oldSb, b.id);
    const exists = newBuckets.some((x) => x.id === b.id);
    const dst = exists ? new Map((await walk(newSb, b.id)).map((f) => [f.path, f.size])) : new Map();
    const todo = src.filter((f) => dst.get(f.path) !== f.size);
    const bytes = src.reduce((s, f) => s + f.size, 0);
    const todoBytes = todo.reduce((s, f) => s + f.size, 0);
    plan.push({ bucket: b, exists, src, todo, bytes, todoBytes });
    log(
      `  ${b.id.padEnd(26)} ${b.public ? 'public ' : 'private'}  ${String(src.length).padStart(6)} files ${mb(bytes).padStart(9)} MB` +
        `   to copy: ${String(todo.length).padStart(6)} (${mb(todoBytes)} MB)${exists ? '' : '  [bucket will be created]'}`,
    );
  }
  const totalTodo = plan.reduce((s, p) => s + p.todoBytes, 0);
  const projected = newExistingBytes + totalTodo;
  log(`\n  new project now: ${mb(newExistingBytes)} MB   after copy: ${mb(projected)} MB   quota guard: ${QUOTA_GB} GB`);

  if (!APPLY) {
    if (projected > QUOTA_GB * 1024 ** 3)
      log(`\n  ⚠ Copying everything would exceed ${QUOTA_GB} GB. Pick buckets with --bucket, or upgrade the new org and pass --quota-gb.`);
    log('\nDry run only. Nothing was written.');
    return (0);
  }
  if (projected > QUOTA_GB * 1024 ** 3) {
    console.error(`\nRefusing: the new project would reach ${mb(projected)} MB, over the ${QUOTA_GB} GB guard.`);
    console.error('Exceeding the Free Storage quota restricts the whole project (Auth + REST), taking the app down.');
    return (1);
  }

  // ------------------------------------------------------------------ copy
  const failures = [];
  let copied = 0;
  for (const p of plan) {
    const b = p.bucket;
    const settings = {
      public: b.public,
      fileSizeLimit: b.file_size_limit ?? null,
      allowedMimeTypes: b.allowed_mime_types ?? null,
    };
    const { error } = p.exists
      ? await newSb.storage.updateBucket(b.id, settings)
      : await newSb.storage.createBucket(b.id, settings);
    if (error) {
      failures.push({ bucket: b.id, path: '(bucket)', error: error.message });
      log(`  FAILED bucket ${b.id}: ${error.message}`);
      continue;
    }

    const queue = [...p.todo];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        let lastError = '';
        for (let attempt = 1; attempt <= 3; attempt++) {
          const dl = await oldSb.storage.from(b.id).download(f.path);
          if (dl.error) {
            lastError = `download: ${dl.error.message}`;
            continue;
          }
          const maxAge = String(f.cacheControl ?? '').match(/max-age=(\d+)/)?.[1];
          const up = await newSb.storage.from(b.id).upload(f.path, dl.data, {
            upsert: true,
            contentType: f.mimetype ?? dl.data.type ?? 'application/octet-stream',
            ...(maxAge ? { cacheControl: maxAge } : {}),
          });
          if (!up.error) {
            lastError = '';
            break;
          }
          lastError = `upload: ${up.error.message}`;
        }
        if (lastError) failures.push({ bucket: b.id, path: f.path, error: lastError });
        else copied++;
        const done = copied + failures.length;
        if (done % 50 === 0) log(`  … ${done} processed (${copied} ok, ${failures.length} failed)`);
      }
    };
    log(`\n-> ${b.id}: ${p.todo.length} files`);
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  const outDir = resolve(argOf('out') ?? join(homedir(), 'glowbal-backups'));
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `storage-copy-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
  writeFileSync(file, JSON.stringify({ old: OLD_URL, new: NEW_URL, copied, failures }, null, 2));

  log(`\nCopied ${copied} file(s), ${failures.length} failure(s). Report: ${file}`);
  log(failures.length ? 'Re-run the same command to retry failures (already-copied files are skipped).' : 'Done.');
  return (failures.length ? 2 : 0);
  return 0;
}

process.exitCode = await main();
