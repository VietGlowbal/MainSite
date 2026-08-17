import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SITE_GATE_COOKIE, isSiteLockEnabled, verifyGateCookie } from '@/lib/site-gate';
import { contactDetailsComplete } from '@/features/auth/domain';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/apply',
  '/profile',
  '/dashboard',
  '/my-universities',
  '/writer',
  '/admin',
  '/onboarding/complete',
];

const PUBLIC_MARKETING_ROUTES = new Set(['/about', '/news', '/universities', '/advisors']);

// Paths that stay reachable even while the site lock (below) is on: static
// assets, API routes (already individually authed — cron secrets, webhooks,
// admin checks — and Stripe/Vercel Cron need to reach them regardless), the
// gate page itself, and the metadata-route icons the gate page's own <head>
// needs to render.
function bypassesSiteLock(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname === '/coming-soon' ||
    pathname === '/icon' ||
    pathname === '/apple-icon' ||
    /\.(svg|png|jpg|jpeg|gif|ico|css|js|woff2?)$/.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Pre-launch site lock ────────────────────────────────────────────────
  // See src/lib/site-gate.ts. SITE_LOCK_ENABLED=1 walls the
  // whole site off behind one shared team password; unset it at launch and
  // this whole block is a no-op. Deliberately checked before, and separate
  // from, everything below — this decides whether the site is visible at
  // all, the existing logic decides who's signed in once it is.
  if (isSiteLockEnabled() && !bypassesSiteLock(pathname)) {
    const cookie = request.cookies.get(SITE_GATE_COOKIE)?.value;
    if (!verifyGateCookie(cookie)) {
      const url = request.nextUrl.clone();
      url.pathname = '/coming-soon';
      url.search = '';
      url.searchParams.set('from', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }

  // Skip static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // These pages render guest-only HTML and hydrate identity in the browser.
  // Avoid an auth round trip on every public request; the query-backed
  // university directory is identical for all visitors and safe to edge-cache.
  if (PUBLIC_MARKETING_ROUTES.has(pathname)) {
    const publicResponse = NextResponse.next();
    if (pathname === '/universities') {
      publicResponse.headers.set(
        'Vercel-CDN-Cache-Control',
        'public, s-maxage=43200, stale-while-revalidate=86400',
      );
    }
    return publicResponse;
  }

  // Create a Supabase client that can read cookies from the request
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Verify the JWT locally when Supabase uses asymmetric signing keys. This
  // still refreshes expiring sessions, but avoids an Auth API round trip on
  // every page navigation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  // Not logged in trying to access protected route → redirect to auth
  if (!userId && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Logged in user on /auth → redirect away.
  //
  // /auth/complete-profile is exempt alongside /auth/callback: it is a screen
  // only a signed-in student can be on, so without the exemption the gate below
  // would redirect them to /apply and /apply would redirect them straight back.
  if (
    userId &&
    pathname.startsWith('/auth') &&
    !pathname.startsWith('/auth/callback') &&
    !pathname.startsWith('/auth/complete-profile')
  ) {
    const redirectTarget = request.nextUrl.searchParams.get('redirect');
    if (redirectTarget?.startsWith('/')) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    /*
     * The post-login landing. Was /my-universities until the saved list and the
     * applications tracker were merged onto /apply (Figma 562:15078) — that URL
     * now 308s here anyway (next.config.ts), but sending a fresh sign-in
     * through a redirect hop to reach their own homepage is not the thing to do.
     */
    const url = request.nextUrl.clone();
    url.pathname = '/apply';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Onboarding gate: signed-in users without a completed profile shouldn't
  // see /apply, /my-universities/* or /profile until they finish onboarding.
  // /universities and /advisors remain browseable so users can preview value.
  //
  // /apply joined this list with the merge: it is where the saved list lives
  // now, and that is what this gate was protecting. /my-universities stays for
  // the child routes (/program, /[id]) that did not move.
  const ONBOARDING_GATED = ['/apply', '/my-universities', '/profile'];

  // Contact-details gate: every account must carry a name, a phone number and a
  // date of birth, but only the email/password form can ask for them at
  // sign-up. Google hands back a name and nothing else, which is how 333 of 409
  // accounts reached the app with no phone and no date of birth between them.
  // Students missing either are held at /auth/complete-profile.
  //
  // Runs BEFORE the onboarding gate on purpose: two fields first, the
  // nine-question wizard second. It also covers /onboarding itself, which the
  // onboarding gate necessarily cannot.
  //
  // /universities and /advisors stay open — they return further up as public
  // marketing routes, so someone still deciding whether GlowBal is worth an
  // account never meets this wall.
  //
  // PROTECTED_ROUTES is NOT the list of authenticated routes, which is why the
  // three below are named explicitly. `/ai-strategy/*`, `/scholarships` and
  // `/universities/matches` each call getUser() and redirect to /auth from
  // inside their own server component instead of relying on this file, so a
  // gate built from PROTECTED_ROUTES alone leaves them reachable by typing the
  // URL — the exact bypass the hard gate exists to close. `/universities` is an
  // exact-match public route above, so the `/matches` child still lands here.
  //
  // Payment returns (`/plus/success`, `/payment/*`) are deliberately left OUT.
  // They are where a student lands after handing over money, and bouncing that
  // redirect into a form loses them the confirmation they just paid for.
  const CONTACT_GATED = [
    ...PROTECTED_ROUTES,
    '/onboarding',
    '/ai-strategy',
    '/scholarships',
    '/universities/matches',
  ];
  const needsContactCheck = userId && CONTACT_GATED.some((route) => pathname.startsWith(route));

  const needsOnboardingCheck =
    userId &&
    ONBOARDING_GATED.some((route) => pathname.startsWith(route)) &&
    !pathname.startsWith('/onboarding');

  if (needsContactCheck || needsOnboardingCheck) {
    // One read serving both gates — they want overlapping columns off the same
    // row, and this runs on every navigation into the app.
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('onboarding_completed, study_level, preferred_countries, phone, date_of_birth')
      .eq('user_id', userId)
      .maybeSingle();

    if (needsContactCheck && !contactDetailsComplete(profile)) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/complete-profile';
      url.search = '';
      url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }

    if (needsOnboardingCheck) {
      const completed =
        profile?.onboarding_completed ||
        (profile?.study_level &&
          Array.isArray(profile?.preferred_countries) &&
          profile.preferred_countries.length > 0);

      if (!completed) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|ico|css|js|woff2?|csv)$).*)',
  ],
};
