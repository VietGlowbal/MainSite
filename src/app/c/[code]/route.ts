import { after, NextResponse, type NextRequest } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { REF_COOKIE } from '@/lib/referrals';
import { CONSENT_COOKIE, analyticsConsentedFromCookie } from '@/shared/lib';

/**
 * Coordinator share-link tracker.
 *
 *   GET /c/<code>
 *
 * Looks up the coordinator link for <code>, immediately redirects the visitor
 * to the homepage, and logs the visit AFTER the response is sent (via `after`)
 * so tracking never blocks the redirect. Raw IPs are never stored — only a
 * salted sha256 hash.
 *
 * ─── TWO COOKIES, ONE OF THEM OPTIONAL ──────────────────────────────────────
 *
 * `gb_ref` is set unconditionally. It carries the code the visitor deliberately
 * clicked through to the moment they sign up, which is what makes an ambassador
 * link do the thing the visitor used it for; it holds a public share code, not
 * an identifier for the person. That is the strictly-necessary case.
 *
 * `gb_visitor` is NOT. It is a year-long random id whose only job is to tell
 * whether a visit is a repeat, i.e. audience measurement — the same category as
 * the analytics behind `ConsentBoundary`, and so it needs the same permission.
 * It is now written only for a visitor whose `gb_consent` cookie says they
 * accepted; everyone else gets no device storage from this route at all.
 *
 * WHAT THAT COSTS. A visitor arriving from an ambassador link has never seen
 * the banner yet, so on a first click there is no consent and the visit is
 * logged as non-unique under the ANONYMOUS_VISITOR sentinel. Unique-visitor
 * counts therefore only ever cover visitors who accepted; total clicks stay
 * exact. The alternative — storing the id first and asking afterwards — is the
 * thing consent is meant to prevent, so the undercount is the intended trade.
 *
 * The visit row itself is still written without consent. That is server-side
 * logging of a request that was made to us, not storage on the visitor's
 * device, so it is a legitimate-interest question rather than an ePrivacy one;
 * it is what the ambassador programme counts, and it holds a hashed IP, never
 * a raw one.
 */

const VISITOR_COOKIE = 'gb_visitor';
/**
 * Stands in for the visitor id when analytics consent is absent.
 *
 * `ambassador_visits.visitor_id` is `not null`, and a fresh random id per click
 * would be worse than a constant: it would look like a distinct person in any
 * `count(distinct visitor_id)` and quietly inflate reach. A single shared value
 * collapses every unconsented click into one bucket — an undercount, which is
 * the safe direction — and is self-describing when someone reads the table.
 */
const ANONYMOUS_VISITOR = 'anonymous-no-consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
// Cheap crawler/preview filter — these still get redirected, just not counted.
const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|whatsapp|telegrambot|preview|headless|monitor|pingdom|lighthouse|gtmetrix/i;

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.VISIT_IP_SALT ?? '';
  return createHash('sha256').update(`${ip}${salt}`).digest('hex');
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const home = new URL('/', request.url);
  const admin = createAdminClient();

  const { data: link } = await admin
    .from('ambassador_links')
    .select('id, coordinator_id, is_active')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();

  // Broken or inactive link still lands the visitor on the homepage.
  if (!link) {
    return NextResponse.redirect(home);
  }

  // Visitor cookie drives unique-visitor dedup — and is analytics, so it is
  // written only with consent. See the header comment.
  const mayMeasure = analyticsConsentedFromCookie(request.cookies.get(CONSENT_COOKIE)?.value);
  const existingVisitor = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const visitorId = mayMeasure ? existingVisitor ?? randomUUID() : ANONYMOUS_VISITOR;

  const response = NextResponse.redirect(home);
  if (mayMeasure && !existingVisitor) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }
  // Consent withdrawn after it was once given: clear the id we are no longer
  // allowed to keep. Leaving it would let the next accepted visit resume the
  // same year-old identity, which is not what "reject" means.
  if (!mayMeasure && existingVisitor) {
    response.cookies.set(VISITOR_COOKIE, '', { path: '/', maxAge: 0 });
  }

  // Referral attribution cookie — overwritten every visit (last-touch). Read
  // when the visitor later signs up / logs in to credit this ambassador.
  response.cookies.set(REF_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  // Don't count obvious bots/crawlers — just redirect them.
  const userAgent = request.headers.get('user-agent') ?? '';
  if (BOT_UA.test(userAgent)) {
    return response;
  }

  const referrer = request.headers.get('referer');
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const ipHash = hashIp(ip);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) utm[key] = value;
  }

  const linkId = link.id;
  const coordinatorId = link.coordinator_id;

  // Log the visit after the redirect is sent — never blocks the visitor.
  after(async () => {
    // First time this visitor hits this link → counts as a unique visitor.
    // Skipped without consent: there is no stable id to dedup against, and the
    // sentinel would make only the very first unconsented click on a link look
    // unique. Not asking also saves a query on the majority path.
    let isUnique = false;
    if (mayMeasure) {
      const { count } = await admin
        .from('ambassador_visits')
        .select('id', { count: 'exact', head: true })
        .eq('link_id', linkId)
        .eq('visitor_id', visitorId);
      isUnique = (count ?? 0) === 0;
    }

    await admin.from('ambassador_visits').insert({
      link_id: linkId,
      coordinator_id: coordinatorId,
      visitor_id: visitorId,
      is_unique: isUnique,
      landing_path: '/',
      referrer,
      user_agent: userAgent || null,
      ip_hash: ipHash,
      utm,
    });
  });

  return response;
}
