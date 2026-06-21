/**
 * Shared auth for scheduled (cron) API routes.
 *
 * Vercel Cron Jobs invoke their target route with an
 * `Authorization: Bearer <CRON_SECRET>` header, where CRON_SECRET is the
 * project environment variable Vercel injects. We accept that, and also allow
 * the service-role key so the same endpoints can be triggered manually from a
 * trusted backend/script. If no secret is configured the route is locked down
 * (returns false) rather than left open.
 */
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const accepted = [cronSecret, serviceKey]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map((v) => `Bearer ${v}`);

  if (accepted.length === 0) return false;
  return accepted.includes(header);
}
