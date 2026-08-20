/**
 * Auth callbacks must return to the browser origin in local/test runs. A
 * developer commonly keeps the production public URL in `.env.local`; using
 * it during `next dev` makes a successful local sign-in jump to production.
 */
export function resolveAuthOrigin(requestOrigin: string): string {
  if (process.env.NODE_ENV !== 'production') return requestOrigin;

  let configured = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (configured && !/^https?:\/\//i.test(configured)) {
    configured = `${configured.startsWith('localhost') ? 'http' : 'https'}://${configured}`;
  }
  return configured || requestOrigin;
}
