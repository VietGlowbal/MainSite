import { NextResponse } from 'next/server';
import { isCoordinator } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/coordinator/check
 *
 * Lightweight endpoint the client nav polls once on load to decide whether to
 * render the "Coordinator" link. Server-side check so the env-based
 * COORDINATOR_USER_IDS bootstrap list keeps working without exposing it.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ isCoordinator: false });
  }
  const ok = await isCoordinator(user.id);
  return NextResponse.json({ isCoordinator: ok });
}
