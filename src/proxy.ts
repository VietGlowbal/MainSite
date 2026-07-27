import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SITE_GATE_COOKIE, isSiteLockEnabled, verifyGateCookie } from '@/lib/site-gate';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/profile',
  '/dashboard',
  '/my-universities',
  '/writer',
  '/admin',
  '/onboarding/complete',
];

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
  // See LAUNCH_PLAN.md and src/lib/site-gate.ts. SITE_LOCK_ENABLED=1 walls the
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  // Not logged in trying to access protected route → redirect to auth
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    url.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Logged in user on /auth → redirect away
  if (user && pathname.startsWith('/auth') && !pathname.startsWith('/auth/callback')) {
    const redirectTarget = request.nextUrl.searchParams.get('redirect');
    if (redirectTarget?.startsWith('/')) {
      return NextResponse.redirect(new URL(redirectTarget, request.url));
    }

    const url = request.nextUrl.clone();
    url.pathname = '/my-universities';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Onboarding gate: signed-in users without a completed profile shouldn't
  // see /my-universities/* or /profile until they finish onboarding.
  // /universities and /mentors remain browseable so users can preview value.
  const ONBOARDING_GATED = ['/my-universities', '/profile'];
  const needsOnboardingCheck =
    user &&
    ONBOARDING_GATED.some((route) => pathname.startsWith(route)) &&
    !pathname.startsWith('/onboarding');

  if (needsOnboardingCheck) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('onboarding_completed, study_level, preferred_countries')
      .eq('user_id', user.id)
      .maybeSingle();

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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|ico|css|js|woff2?|csv)$).*)',
  ],
};
