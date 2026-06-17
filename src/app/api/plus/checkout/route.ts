import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { getPlusPackage, PLUS_CURRENCY } from '@/lib/plus';

/**
 * POST /api/plus/checkout  { plan: 'plus-6m' | 'plus-12m' | 'plus-24m' }
 *
 * Creates a Stripe Checkout session for a GlowBal Plus package and returns its
 * URL. Mirrors the mentorship checkout: a one-time payment (these are
 * fixed-duration plans, not recurring), priced inline so no Stripe products
 * need pre-creating. The success page verifies the session before activating.
 */
const BodySchema = z.object({
  plan: z.enum(['plus-6m', 'plus-12m', 'plus-24m']),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const pkg = getPlusPackage(parsed.data.plan);
  if (!pkg) {
    return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: `${baseUrl}/plus/success?plan=${pkg.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/plus?status=cancelled`,
      line_items: [
        {
          price_data: {
            currency: PLUS_CURRENCY,
            product_data: {
              name: `GlowBal Plus — ${pkg.durationLabel}`,
              description: `${pkg.aiCredits} AI strategy credits • full scholarship details & roadmap`,
            },
            unit_amount: pkg.amountVnd,
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan: pkg.id,
        user_id: user.id,
        ai_credits: String(pkg.aiCredits),
        duration_months: String(pkg.durationMonths),
      },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    console.error('[plus/checkout] Stripe error', err);
    return NextResponse.json(
      { error: 'Could not start the payment. Please try again.' },
      { status: 502 },
    );
  }
}
