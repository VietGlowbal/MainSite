import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { revalidateTeam } from '@/server/cache';

/**
 * GET/POST /api/admin/team/revalidate
 *
 * The team roster has no admin UI — it is edited by running a `supabase-*.sql`
 * file by hand (see supabase-team.sql, supabase-team-members-seed.sql). That
 * write goes straight to Postgres and never touches Next's cache, but
 * `getTeamMembers()` (src/lib/team.ts) is wrapped in `unstable_cache` with a
 * 12-hour TTL tagged `team`. `revalidateTeam()` has existed in
 * src/server/cache/tags.ts since the cache-tags module was introduced, but
 * nothing in the repo ever called it for the team tag specifically — so a
 * roster edited straight in Supabase stayed invisible on the live site for
 * up to 12 hours regardless of how correct the SQL was. This route is the
 * missing "flip the switch" step: after running a seed file, hit this once
 * (signed in as an admin) and the next page load re-reads the database.
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

  revalidateTeam();
  return NextResponse.json({ revalidated: true, tag: 'team' });
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
