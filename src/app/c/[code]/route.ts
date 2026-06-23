import { after, NextResponse, type NextRequest } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { REF_COOKIE } from '@/lib/referrals';

/**
 * Coordinator share-link tracker.
 *
 *   GET /c/<code>
 *
 * Looks up the coordinator link for <code>, immediately redirects the visitor
 * to the homepage, and logs the visit AFTER the response is sent (via `after`)
 * so tracking never blocks the redirect. Visits are deduped per visitor with
 * the `gb_visitor` cookie to count unique visitors. Raw IPs are never stored —
 * only a salted sha256 hash.
 */

const VISITOR_COOKIE = 'gb_visitor';
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

  // Visitor cookie drives unique-visitor dedup.
  const existingVisitor = request.cookies.get(VISITOR_COOKIE)?.value ?? null;
  const visitorId = existingVisitor ?? randomUUID();

  const response = NextResponse.redirect(home);
  if (!existingVisitor) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
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
    const { count } = await admin
      .from('ambassador_visits')
      .select('id', { count: 'exact', head: true })
      .eq('link_id', linkId)
      .eq('visitor_id', visitorId);

    await admin.from('ambassador_visits').insert({
      link_id: linkId,
      coordinator_id: coordinatorId,
      visitor_id: visitorId,
      is_unique: (count ?? 0) === 0,
      landing_path: '/',
      referrer,
      user_agent: userAgent || null,
      ip_hash: ipHash,
      utm,
    });
  });

  return response;
}
