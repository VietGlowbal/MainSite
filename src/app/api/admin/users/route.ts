import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin user-management API.
 *
 *   GET    /api/admin/users           → list users (auth + profile flags)
 *   PATCH  /api/admin/users           → toggle is_admin on a profile
 *   DELETE /api/admin/users?id=...    → hard-delete an auth user (kick)
 *
 * All three guard with isAdmin() against the calling user.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required', status: 401 as const, user: null };
  if (!(await isAdmin(user.id))) {
    return { error: 'Forbidden', status: 403 as const, user: null };
  }
  return { error: null, status: 200 as const, user };
}

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();

  // Auth users (paginated; first 200 is plenty for the admin dashboard).
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  // Join with student_profiles so we can show is_admin + onboarding status.
  const { data: profiles } = await admin
    .from('student_profiles')
    .select('user_id, is_admin, is_coordinator, onboarding_completed, study_level');

  // Join with mentor profiles (achiever_profiles) so we can flag mentor status.
  const { data: mentors } = await admin
    .from('achiever_profiles')
    .select('id, status, display_name');

  // Per-user login counts (Supabase only exposes last_sign_in_at, not a count).
  const { data: loginCounts } = await admin
    .from('user_login_counts')
    .select('user_id, login_count');

  const profileByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, p]),
  );
  const mentorByUser = new Map((mentors ?? []).map((m) => [m.id, m]));
  const loginCountByUser = new Map(
    (loginCounts ?? []).map((r) => [r.user_id, Number(r.login_count ?? 0)]),
  );

  const users = usersPage.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    full_name: (u.user_metadata?.full_name as string | undefined) ?? null,
    avatar_url: (u.user_metadata?.avatar_url as string | undefined) ?? null,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    is_admin: profileByUser.get(u.id)?.is_admin === true,
    is_coordinator: profileByUser.get(u.id)?.is_coordinator === true,
    onboarding_completed: profileByUser.get(u.id)?.onboarding_completed === true,
    mentor_status: mentorByUser.get(u.id)?.status ?? null,
    mentor_name: mentorByUser.get(u.id)?.display_name ?? null,
    login_count: loginCountByUser.get(u.id) ?? 0,
  }));

  return NextResponse.json({ users });
}

const PatchSchema = z
  .object({
    user_id: z.string().uuid(),
    is_admin: z.boolean().optional(),
    is_coordinator: z.boolean().optional(),
  })
  .refine((v) => v.is_admin !== undefined || v.is_coordinator !== undefined, {
    message: 'Nothing to update',
  });

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { user_id, is_admin, is_coordinator } = parsed.data;

  // Don't let an admin demote themselves — easy way to lock yourself out.
  if (user_id === guard.user!.id && is_admin === false) {
    return NextResponse.json(
      { error: 'You can\u2019t remove your own admin access from this page.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Upsert the role flags onto student_profiles. If the user has never
  // completed onboarding there might not be a row yet, so we upsert.
  const update: { user_id: string; is_admin?: boolean; is_coordinator?: boolean } = { user_id };
  if (is_admin !== undefined) update.is_admin = is_admin;
  if (is_coordinator !== undefined) update.is_coordinator = is_coordinator;

  const { error } = await admin
    .from('student_profiles')
    .upsert(update, { onConflict: 'user_id' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Revoking the role stops all of that coordinator's ambassador links
  // (history is kept). Granting it does nothing extra — the coordinator
  // creates their own ambassador links from /coordinator.
  if (is_coordinator === false) {
    await admin
      .from('ambassador_links')
      .update({ is_active: false })
      .eq('coordinator_id', user_id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Self-kick guard.
  if (id === guard.user!.id) {
    return NextResponse.json(
      { error: 'You can\u2019t remove your own account from here.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
