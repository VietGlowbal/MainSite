#!/usr/bin/env node
/**
 * Copy the Auth service configuration (Dashboard -> Authentication settings)
 * from the old Supabase project to the new one via the Management API.
 *
 * None of this lives in Postgres, so a pg_dump/restore never carries it:
 * Site URL, redirect allow-list, Google OAuth client, password policy, JWT
 * expiry, rate limits, MFA, email templates, SMTP, auth hooks.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *     node scripts/copy-supabase-auth-config.mjs --old-ref <old> --new-ref <new>          # dry run
 *     node scripts/copy-supabase-auth-config.mjs --old-ref <old> --new-ref <new> --apply  # write
 *
 * The token is a personal access token (Dashboard -> Account -> Access Tokens)
 * with the Auth config permission. Fine-grained tokens are often scoped to one
 * organisation; when the old project lives in another org, add a second token
 * for it as SUPABASE_OLD_ACCESS_TOKEN (read is enough there).
 *
 * Rules: values that are null/empty in the old project are never copied (they
 * would wipe a setting in the new one); values that come back masked are listed
 * as "set by hand"; any string containing the old ref is rewritten to the new ref.
 */

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const APPLY = args.includes('--apply');
const oldRef =
  argOf('old-ref') ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const newRef = argOf('new-ref');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const oldToken = process.env.SUPABASE_OLD_ACCESS_TOKEN || token;
if (!oldRef || !newRef || !token) {
  console.error('Need --old-ref, --new-ref and SUPABASE_ACCESS_TOKEN.');
  process.exit(1);
}
if (oldRef === newRef) {
  console.error('Old and new refs are identical.');
  process.exit(1);
}

const API = 'https://api.supabase.com/v1/projects';
const headersFor = (ref) => ({
  Authorization: `Bearer ${ref === oldRef ? oldToken : token}`,
  'Content-Type': 'application/json',
});

async function getConfig(ref) {
  const r = await fetch(`${API}/${ref}/config/auth`, { headers: headersFor(ref) });
  if (!r.ok) throw new Error(`GET ${ref}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function patchConfig(ref, body) {
  const r = await fetch(`${API}/${ref}/config/auth`, { method: 'PATCH', headers: headersFor(ref), body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, text: r.ok ? '' : (await r.text()).slice(0, 300) };
}

// Suffix match: smtp_pass, external_google_secret, sms_twilio_auth_token, hook_*_secrets.
// A substring match would also hide mailer_*_password_changed_* templates.
const isSecretKey = (k) => /(^|_)(secrets?|pass|token|key)$/.test(k);
// The API returns secrets as a SHA-256 hex digest, not asterisks. Copying that
// digest writes a wrong secret (measured 2026-09-29: Google OAuth broke this way).
const looksMasked = (k, v) =>
  typeof v === 'string' && (/^\*+$|^•+$|\*{4,}/.test(v) || (isSecretKey(k) && /^[0-9a-f]{64}$/.test(v)));
const empty = (v) => v === null || v === undefined || v === '';
const show = (k, v) => (isSecretKey(k) && !empty(v) ? '<secret>' : JSON.stringify(v)?.slice(0, 90));

// process.exit() while fetch sockets are closing trips a libuv assertion on
// Windows; return the code and let the event loop drain instead.
async function main() {
  let oldCfg;
  let newCfg;
  try {
    [oldCfg, newCfg] = await Promise.all([getConfig(oldRef), getConfig(newRef)]);
  } catch (e) {
    console.error(e.message);
    console.error('403 on the old ref -> the token does not cover the old org: add SUPABASE_OLD_ACCESS_TOKEN.');
    console.error('403 "missing auth_config_*" on the new ref -> give the token the Auth config permission.');
    return (1);
  }

  const patch = {};
  const manual = [];
  for (const [k, raw] of Object.entries(oldCfg)) {
    if (empty(raw)) continue;
    if (looksMasked(k, raw)) {
      manual.push(k);
      continue;
    }
    const v = typeof raw === 'string' ? raw.split(oldRef).join(newRef) : raw;
    if (JSON.stringify(v) !== JSON.stringify(newCfg[k])) patch[k] = v;
  }

  console.log(`\nAuth config ${APPLY ? '(APPLY)' : '(dry run — pass --apply to write)'}  ${oldRef} -> ${newRef}\n`);
  const keys = Object.keys(patch).sort();
  for (const k of keys) console.log(`  ${k.padEnd(48)} ${show(k, newCfg[k])}  ->  ${show(k, patch[k])}`);
  if (!keys.length) console.log('  ok  nothing differs');
  if (manual.length) {
    console.log('\nMasked by the API — set these by hand in the new project:');
    for (const k of manual) console.log(`  ${k}`);
  }

  if (!APPLY || !keys.length) return (0);

  // One PATCH first; if the API rejects a field (read-only or plan-gated), fall
  // back to one field at a time so a single bad key does not block the rest.
  const all = await patchConfig(newRef, patch);
  if (all.ok) {
    console.log(`\nApplied ${keys.length} setting(s).`);
    return (0);
  }
  console.log(`\nBulk PATCH rejected (HTTP ${all.status}): ${all.text}\nRetrying field by field…`);
  const failed = [];
  for (const k of keys) {
    const r = await patchConfig(newRef, { [k]: patch[k] });
    if (!r.ok) failed.push(`${k}: HTTP ${r.status} ${r.text.slice(0, 120)}`);
  }
  console.log(`Applied ${keys.length - failed.length}/${keys.length}.`);
  for (const f of failed) console.log(`  FAILED ${f}`);
  return (failed.length ? 2 : 0);
  return 0;
}

process.exitCode = await main();
