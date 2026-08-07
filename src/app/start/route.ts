import { NextResponse, type NextRequest } from 'next/server';
import { readOnboardingStatus } from '@/features/onboarding/api';

/**
 * GET /start — the Home hero's "Find matching scholarships" button.
 *
 * It sends a student who has not answered the onboarding questions to
 * /onboarding, and a student who has straight to /universities. Owner's call,
 * 01/08: the second group has already told us their level, countries and
 * budget, and putting the questionnaire in front of them again is asking twice
 * for something we saved the first time.
 *
 * WHY A REDIRECT ROUTE RATHER THAN A CONDITIONAL href
 *
 * Home is prerendered (`export const revalidate` in src/app/page.tsx) and
 * `HomeHero` is a server component on purpose — the note on it explains that
 * `t()` would force 'use client' and push the largest text on the site behind
 * hydration. Deciding the destination on the page would mean one of:
 *
 *   - reading the session in the page, which opts "/" out of static rendering
 *     for every visitor, signed in or not;
 *   - deciding it in the browser, which means the button's href is wrong until
 *     a fetch resolves — and wrong is where it gets clicked.
 *
 * A route handler keeps "/" static and costs one hop, taken only by people who
 * actually press the button. 307, not 308: the destination depends on who is
 * asking, so it must never be cached as if it did not.
 *
 * The navigation's "Plan your Global Education" action also points directly
 * to /onboarding. Its shared session state retires that action after completion,
 * and the onboarding page itself redirects completed students as a final guard.
 */

// The session lives in a cookie, so this is per-request by definition. Stated
// rather than inferred: a route handler that Next decides is static would
// answer every visitor with whatever the first one got.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const status = await readOnboardingStatus();

  const destination = status.completed ? '/universities' : '/onboarding';

  return NextResponse.redirect(new URL(destination, request.url), 307);
}
