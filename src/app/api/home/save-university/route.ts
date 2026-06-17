import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/home/save-university?u=<universityId>
 *
 * Post-auth landing target for the homepage login gate. When a visitor picks a
 * university and creates a profile, the auth flow finishes here: we persist the
 * chosen university to their plan (user_universities) and forward them into the
 * explorer with it selected, so the "choose a university → create profile →
 * view scholarships" funnel carries context across sign-up.
 *
 * Works for every auth path because callback / OAuth / password login all end
 * up navigating the browser to this route (which then 302s onward).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const uRaw = searchParams.get('u');
  const uid = uRaw ? Number.parseInt(uRaw, 10) : Number.NaN;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in yet (e.g. direct hit) — bounce through auth, preserving intent.
  if (!user) {
    const back = `/api/home/save-university${uRaw ? `?u=${encodeURIComponent(uRaw)}` : ''}`;
    return NextResponse.redirect(
      `${origin}/auth?mode=signup&redirect=${encodeURIComponent(back)}`,
    );
  }

  if (!Number.isNaN(uid)) {
    // Idempotent: don't clobber an existing status (e.g. 'applying') if the
    // university is already on their plan.
    await supabase.from('user_universities').upsert(
      { user_id: user.id, university_id: uid, status: 'interested' },
      { onConflict: 'user_id,university_id', ignoreDuplicates: true },
    );
  }

  const dest = Number.isNaN(uid) ? '/universities' : `/universities?u=${uid}`;
  return NextResponse.redirect(`${origin}${dest}`);
}
