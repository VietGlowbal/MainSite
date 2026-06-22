import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isCoordinator } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { slugify } from '@/lib/geo-cms';
import type { AmbassadorLinkStats } from '@/lib/types';

/**
 * Coordinator self-serve ambassador links.
 *
 *   GET   /api/coordinator/ambassadors        → list own ambassadors + stats
 *   POST  /api/coordinator/ambassadors         → create an ambassador link
 *   PATCH /api/coordinator/ambassadors         → activate/deactivate a link
 *
 * Every operation is scoped to the calling coordinator (coordinator_id =
 * their user id). Writes use the service-role client; ownership is enforced
 * here in code.
 */

async function requireCoordinator() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in required', status: 401 as const, user: null };
  if (!(await isCoordinator(user.id))) {
    return { error: 'Forbidden', status: 403 as const, user: null };
  }
  return { error: null, status: 200 as const, user };
}

export async function GET() {
  const guard = await requireCoordinator();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ambassador_link_stats')
    .select('*')
    .eq('coordinator_id', guard.user!.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ambassadors = ((data ?? []) as AmbassadorLinkStats[]).map((a) => ({
    ...a,
    total_visits: Number(a.total_visits ?? 0),
    unique_visitors: Number(a.unique_visitors ?? 0),
  }));
  return NextResponse.json({ ambassadors });
}

const PostSchema = z.object({
  ambassador_name: z.string().trim().min(1).max(120),
});

export async function POST(request: NextRequest) {
  const guard = await requireCoordinator();
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ambassador name is required' }, { status: 400 });
  }
  const ambassadorName = parsed.data.ambassador_name;

  const admin = createAdminClient();

  // Unique code from the ambassador name, with a short random suffix on clash.
  const base = slugify(ambassadorName) || 'ambassador';
  let code = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: taken } = await admin
      .from('ambassador_links')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!taken) break;
    code = `${base}-${randomUUID().slice(0, 4)}`;
  }

  const { data: created, error } = await admin
    .from('ambassador_links')
    .insert({ coordinator_id: guard.user!.id, ambassador_name: ambassadorName, code })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ambassador: created });
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const guard = await requireCoordinator();
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

  const admin = createAdminClient();
  // Scope the update to this coordinator's own link.
  const { data, error } = await admin
    .from('ambassador_links')
    .update({ is_active: parsed.data.is_active })
    .eq('id', parsed.data.id)
    .eq('coordinator_id', guard.user!.id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
