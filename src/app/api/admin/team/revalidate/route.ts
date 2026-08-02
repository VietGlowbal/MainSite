import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { revalidateTeam } from '@/server/cache';

/**
 * GET/POST /api/admin/team/revalidate
 *
 * The team roster has no admin UI — it is edited by running a `supabase-*.sql`
 * file by hand (see supabase-team.sql, supabase-team-members-seed.sql). That
 * write goes straight to Postgres and never touches Next's cache, so the site
 * keeps serving the pre-edit roster until something explicitly busts it.
 *
 * TWO CACHES, AND MISSING EITHER ONE LOOKS IDENTICAL TO MISSING BOTH:
 *
 *   1. The DATA cache. `getTeamMembers()` (src/lib/team.ts) is wrapped in
 *      `unstable_cache` with a 12-hour TTL tagged `team`. `revalidateTeam()`
 *      has existed in src/server/cache/tags.ts since that module was
 *      introduced, but nothing in the repo ever called it.
 *   2. The PAGE cache. `/about` sets `export const revalidate = 43200`, so
 *      the rendered HTML is itself held for 12 hours by ISR — INDEPENDENTLY
 *      of the data cache underneath it.
 *
 * The first version of this route only did (1), which is why a seeded roster
 * still showed the old four people: the data cache was correctly busted and
 * the page never re-rendered to read it. Symptom to recognise if this
 * regresses — the live page shows values that no longer exist in Supabase at
 * all (an old spelling of a name, an old role), which means stale HTML rather
 * than stale data, and points at (2).
 *
 * GET, not just POST, on purpose: the only way to trigger this is opening the
 * URL while signed in as an admin, and a POST-only endpoint can't be visited
 * from a browser address bar.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, error: 'Sign in required' };
  if (!(await isAdmin(user.id))) {
    return { ok: false as const, status: 403 as const, error: 'Forbidden' };
  }
  return { ok: true as const };
}

async function handle() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  // Both, in this order — see the note above on why either alone is not enough.
  revalidateTeam();
  revalidatePath('/about');

  return NextResponse.json({ revalidated: true, tag: 'team', path: '/about' });
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
