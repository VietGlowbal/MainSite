'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PlusPlanId, DisplayCurrency } from '@/lib/plus';

/**
 * SubscribeButton — kicks off a GlowBal Plus checkout.
 *
 * Signed-in users POST to /api/plus/checkout (with the chosen currency) and are
 * redirected to Stripe. Signed-out users are sent to sign-up first, returning
 * to /plus.
 */
export function SubscribeButton({
  plan,
  currency,
  signedIn,
  highlighted,
  applicationId,
}: {
  plan: PlusPlanId;
  currency: DisplayCurrency;
  signedIn: boolean;
  highlighted: boolean;
  applicationId?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base =
    'mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition disabled:opacity-60';
  const look = highlighted
    ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_12px_28px_rgba(255,77,140,0.3)] hover:-translate-y-0.5'
    : 'border border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:text-pink-600';

  async function subscribe() {
    if (!signedIn) {
      const redirect = `/plus${applicationId ? `?application=${applicationId}` : ''}`;
      router.push(`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plus/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, currency, applicationId: applicationId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error ?? 'Could not start checkout');
      }
      window.location.assign(data.checkout_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={subscribe} disabled={loading} className={`${base} ${look}`}>
        {loading ? 'Starting checkout…' : 'Subscribe now'}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-rose-600">{error}</p> : null}
    </>
  );
}
