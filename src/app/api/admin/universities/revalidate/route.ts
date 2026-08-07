import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth-helpers';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { createClient } from '@/lib/supabase/server';
import { expireUniversitiesNow } from '@/server/cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/universities/revalidate
 *
 * Bulk image imports write straight to Supabase, bypassing Next's 12-hour
 * tagged data cache and ISR pages. This endpoint expires both layers after the
 * SQL has run. It accepts the same trusted Bearer credentials as cron routes,
 * or an authenticated site admin for manual browser use.
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (isAuthorizedCron(request)) return true;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && isAdmin(user.id);
}

async function handle(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  expireUniversitiesNow();
  revalidatePath('/');
  revalidatePath('/universities');
  revalidatePath('/universities/[id]', 'page');

  return NextResponse.json({
    revalidated: true,
    tag: 'universities',
    paths: ['/', '/universities', '/universities/[id]'],
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
