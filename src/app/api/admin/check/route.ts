import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/check
 *
 * Lightweight endpoint the client header polls once on load to decide
 * whether to render the "Admin" pill. Server-side check so the env-based
 * ADMIN_USER_IDS bootstrap list keeps working without exposing it.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ isAdmin: false });
  }
  const ok = await isAdmin(user.id);
  return NextResponse.json({ isAdmin: ok });
}
