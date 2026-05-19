import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/profile',
  '/dashboard',
  '/my-universities',
  '/writer',
  '/admin',
  '/onboarding/complete',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  // /universities and /achievers remain browseable so users can preview value.
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
