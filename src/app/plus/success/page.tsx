import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { getPlusPackage, computeExpiry, formatChargedAmount, isDisplayCurrency } from '@/lib/plus';
import { Button, ICONS, KitIcon } from '@/shared/ui';

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

  const activated = state !== 'unverified';

  return (
    <main className="gb-page-full-bleed flex min-h-screen items-center justify-center bg-surface-muted px-gb-xl py-gb-9xl">
      <div className="w-full max-w-gb-width-sm rounded-gb-2xl border border-line bg-surface p-gb-5xl text-center shadow-gb-lg">
        {/* The mark follows the state. A green tick over "Confirming your
            payment…" said the opposite of the sentence under it. */}
        <span
          className={`mx-auto flex size-gb-7xl items-center justify-center rounded-gb-full ${
            activated ? 'bg-brand text-on-brand' : 'bg-surface-muted text-fg-tertiary'
          }`}
        >
          <KitIcon art={activated ? ICONS.checkCircle : ICONS.clock} frame={28} />
        </span>

        {state === 'unverified' ? (
          <>
            <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
              Confirming your payment…
            </h1>
            <p className="mt-gb-lg text-gb-sm text-fg-tertiary">
              We couldn&rsquo;t confirm this payment automatically yet. If you completed checkout
              and Plus doesn&rsquo;t appear shortly, contact{' '}
              <a
                href="mailto:hello@glowbal.com"
                className="font-semibold text-fg-brand underline-offset-4 hover:underline"
              >
                hello@glowbal.com
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-gb-3xl font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
              {state === 'already' ? 'You’re already on Plus' : 'Welcome to GlowBal Plus'}
            </h1>
            <p className="mt-gb-lg text-gb-sm text-fg-tertiary">
              {state === 'already'
                ? 'This plan is already active on your account — you’re all set.'
                : `Your ${pkg?.durationLabel} plan is active, with ${pkg?.aiCredits} AI strategy credits added. Let’s build your scholarship plan.`}
            </p>
          </>
        )}

        <div className="mt-gb-4xl flex flex-col gap-gb-lg">
          {applicationId ? (
            <Button href={`/apply/${applicationId}`} size="lg">
              Continue to your application →
            </Button>
          ) : (
            <Button href="/scholarships" size="lg">
              Explore scholarships
            </Button>
          )}
          {/* Was /universities labelled "Go to my universities" — the search
              page, not the student's own list. The saved list lives on /apply
              since the merge (31/07), and the nav calls it My Portal. */}
          <Button href="/apply" size="lg" variant="secondary">
            Go to My Portal
          </Button>
        </div>
      </div>
    </main>
  );
}
