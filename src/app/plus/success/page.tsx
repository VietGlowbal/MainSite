import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { getPlusPackage, computeExpiry, formatChargedAmount, isDisplayCurrency } from '@/lib/plus';

export const metadata: Metadata = {
  title: 'Welcome to GlowBal Plus',
  robots: { index: false },
};

/**
 * Post-payment landing for GlowBal Plus.
 *
 * Stripe Checkout redirects here with ?plan=<id>&session_id=<cs_...>. We
 * verify the session with Stripe (paid + belongs to this user) before
 * activating, so the page can't be used to self-grant Plus. Activation tops up
 * AI credits, sets the plan + expiry, and records a plus_subscriptions row.
 *
 * Idempotent via stripe_reference: a refresh (same session) won't re-grant.
 */
export default async function PlusSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; session_id?: string; application?: string }>;
}) {
  const { plan, session_id: sessionId, application } = await searchParams;
  const pkg = getPlusPackage(plan);
  const applicationId = application ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const back = `/plus/success?${new URLSearchParams({
      ...(plan ? { plan } : {}),
      ...(sessionId ? { session_id: sessionId } : {}),
    }).toString()}`;
    redirect(`/auth?redirect=${encodeURIComponent(back)}`);
  }

  let state: 'activated' | 'already' | 'unverified' = 'unverified';

  if (pkg && sessionId) {
    // 1. Verify the payment with Stripe.
    let paid = false;
    // What was actually charged, for the audit record. Falls back to the plan
    // name if the session didn't report an amount/currency.
    let chargedLabel = `GlowBal Plus ${pkg.name}`;
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      paid =
        (session.payment_status === 'paid' || session.status === 'complete') &&
        session.client_reference_id === user.id;
      const sessionCurrency = (session.currency ?? '').toUpperCase();
      if (session.amount_total != null && isDisplayCurrency(sessionCurrency)) {
        chargedLabel = formatChargedAmount(session.amount_total, sessionCurrency);
      }
    } catch (err) {
      console.error('[plus/success] could not verify session', err);
    }

    if (paid) {
      const admin = createAdminClient();

      // 2. Idempotency — has this exact session already been recorded?
      const { data: existing } = await admin
        .from('plus_subscriptions')
        .select('id')
        .eq('stripe_reference', sessionId)
        .maybeSingle();

      if (existing) {
        state = 'already';
      } else {
        const { data: profile } = await admin
          .from('student_profiles')
          .select('ai_strategy_credits')
          .eq('user_id', user.id)
          .maybeSingle();

        const startedAt = new Date().toISOString();
        const expiresAt = computeExpiry(pkg.durationMonths);
        const newCredits = (profile?.ai_strategy_credits ?? 0) + pkg.aiCredits;

        await admin.from('student_profiles').upsert(
          {
            user_id: user.id,
            plus_status: true,
            plus_plan: pkg.id,
            plus_started_at: startedAt,
            plus_expires_at: expiresAt,
            ai_strategy_credits: newCredits,
          },
          { onConflict: 'user_id' },
        );

        await admin.from('plus_subscriptions').insert({
          user_id: user.id,
          plan: pkg.id,
          price_label: chargedLabel,
          ai_credits: pkg.aiCredits,
          duration_months: pkg.durationMonths,
          stripe_reference: sessionId,
          status: 'active',
          started_at: startedAt,
          expires_at: expiresAt,
        });

        state = 'activated';
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#FBFBFF,#ffffff)] px-5 py-14">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_56px_rgba(30,40,80,0.10)]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </span>

        {state === 'unverified' ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">Confirming your payment…</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              We couldn’t confirm this payment automatically yet. If you completed
              checkout and Plus doesn’t appear shortly, contact{' '}
              <a href="mailto:hello@glowbal.com" className="font-semibold text-pink-600">hello@glowbal.com</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-semibold text-slate-900">
              {state === 'already' ? 'You’re already on Plus' : 'Welcome to GlowBal Plus'}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {state === 'already'
                ? 'This plan is already active on your account — you’re all set.'
                : `Your ${pkg?.durationLabel} plan is active, with ${pkg?.aiCredits} AI strategy credits added. Let’s build your scholarship plan.`}
            </p>
          </>
        )}

        <div className="mt-7 flex flex-col gap-2.5">
          {applicationId ? (
            <Link href={`/apply/${applicationId}`} className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5">
              Continue to your application →
            </Link>
          ) : (
            <Link href="/scholarships" className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5">
              Explore scholarships
            </Link>
          )}
          <Link href="/universities" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            Go to my universities
          </Link>
        </div>
      </div>
    </main>
  );
}
