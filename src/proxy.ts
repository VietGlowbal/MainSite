import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/onboarding',
  '/profile',
  '/dashboard',
  '/universities',
  '/my-universities',
  '/writer',
];

// Routes that authenticated users with incomplete onboarding can access
const ONBOARDING_ALLOWED = ['/onboarding', '/auth'];

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
  let response = NextResponse.next({
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
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Logged in user on /auth → redirect away
  if (user && pathname.startsWith('/auth') && !pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = '/universities';
    return NextResponse.redirect(url);
  }

  // Logged in → check onboarding completion for protected routes
  if (user && isProtected && !pathname.startsWith('/onboarding')) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile || !profile.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
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
