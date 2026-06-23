import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AmbassadorLink, AmbassadorLinkStats } from '@/lib/types';

/**
 * Admin ambassador overview.
 *
 *   GET /api/admin/coordinators → list every ambassador link with its owning
 *                                 coordinator and aggregate visit stats.
 *
 * Assigning/revoking the coordinator role itself goes through
 * PATCH /api/admin/users (is_coordinator). Ambassador links are created by the
 * coordinator from /coordinator.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required', status: 401 as const };
  if (!(await isAdmin(user.id))) return { error: 'Forbidden', status: 403 as const };
  return { error: null, status: 200 as const };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();

  const [{ data: links }, { data: stats }, { data: usersPage }] = await Promise.all([
    admin
      .from('ambassador_links')
      .select('id, coordinator_id, ambassador_name, code, is_active, created_at, updated_at')
      .order('created_at', { ascending: false }),
    admin.from('ambassador_link_stats').select('*'),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  const statByLink = new Map(
    ((stats ?? []) as AmbassadorLinkStats[]).map((s) => [s.link_id, s]),
  );
  const userById = new Map((usersPage?.users ?? []).map((u) => [u.id, u]));

  const ambassadors = ((links ?? []) as AmbassadorLink[]).map((link) => {
    const stat = statByLink.get(link.id);
    const u = userById.get(link.coordinator_id);
    return {
      coordinator_id: link.coordinator_id,
      link_id: link.id,
      code: link.code,
      ambassador_name: link.ambassador_name,
      is_active: link.is_active,
      coordinator_name: (u?.user_metadata?.full_name as string | undefined) ?? null,
      coordinator_email: u?.email ?? null,
      total_visits: Number(stat?.total_visits ?? 0),
      unique_visitors: Number(stat?.unique_visitors ?? 0),
      referred_users: Number(stat?.referred_users ?? 0),
      last_visit_at: stat?.last_visit_at ?? null,
    };
  });

  return NextResponse.json({ ambassadors });
}
