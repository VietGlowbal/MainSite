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
 *
 * `?next=` overrides where the visitor lands afterwards. /universities/[id]'s
 * save heart (Figma 522:8643) uses it to send a guest back to the university
 * they were reading rather than to the list. It is validated by {@link safeNext}
 * rather than trusted: this value comes off the query string, and reflecting it
 * unchecked into a redirect is an open redirect that a phishing link could point
 * at any host it liked.
 */

/**
 * A caller-supplied redirect target, or null.
 *
 * Only same-origin absolute paths are allowed. `//evil.example` is rejected
 * because a protocol-relative URL sends the browser off-origin while looking
 * like a path, and `/\evil.example` because some browsers normalise the
 * backslash to a forward slash before resolving it.
 */
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const uRaw = searchParams.get('u');
  const uid = uRaw ? Number.parseInt(uRaw, 10) : Number.NaN;
  const next = safeNext(searchParams.get('next'));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in yet (e.g. direct hit) — bounce through auth, preserving intent.
  if (!user) {
    const params = new URLSearchParams();
    if (uRaw) params.set('u', uRaw);
    if (next) params.set('next', next);
    const query = params.toString();
    const back = `/api/home/save-university${query ? `?${query}` : ''}`;
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

  /*
   * `/universities/<id>`, not `/universities?u=<id>`. The query form used to
   * open an in-page detail panel; that panel was deleted on 2026-07-30 when
   * cards were rewired to the real route. `?u=` still resolves — the list page
   * redirects it — but sending the funnel straight to its destination saves the
   * visitor a redirect at the end of a sign-up.
   */
  const dest = next ?? (Number.isNaN(uid) ? '/universities' : `/universities/${uid}`);
  return NextResponse.redirect(`${origin}${dest}`);
}
