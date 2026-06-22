import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import {
  getPlusPackage,
  planStripeUnitAmount,
  stripeCurrencyCode,
  meetsStripeMinimum,
  PLUS_DISPLAY_CURRENCIES,
  DEFAULT_DISPLAY_CURRENCY,
} from '@/lib/plus';

/**
 * POST /api/plus/checkout
 *   { plan: 'plus-starter' | 'plus-pro' | 'plus-premium', currency?, applicationId? }
 *
 * Creates a Stripe Checkout session for a GlowBal Plus tier and returns its
 * URL. A one-time payment (these are fixed-length plans, not recurring), priced
 * inline so no Stripe products need pre-creating. The amount + currency are
 * derived server-side from the tier so the client can't set its own price. The
 * success page verifies the session before activating.
 */
const BodySchema = z.object({
  plan: z.enum(['plus-starter', 'plus-pro', 'plus-premium']),
  // Display/checkout currency. Defaults to USD if absent/unknown.
  currency: z.enum(PLUS_DISPLAY_CURRENCIES).optional(),
  // Optional course_applications.id (uuid) when the checkout was started from
  // the Apply funnel, so the success page can return the user to it.
  applicationId: z.string().uuid().optional(),
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

  const currency = parsed.data.currency ?? DEFAULT_DISPLAY_CURRENCY;
  const unitAmount = planStripeUnitAmount(pkg.amountVnd, currency);
  if (!meetsStripeMinimum(unitAmount, currency)) {
    return NextResponse.json(
      { error: 'This amount is below the minimum we can charge in that currency.' },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const applicationId = parsed.data.applicationId;
  const appParam = applicationId ? `&application=${applicationId}` : '';

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: `${baseUrl}/plus/success?plan=${pkg.id}&session_id={CHECKOUT_SESSION_ID}${appParam}`,
      cancel_url: `${baseUrl}/plus?status=cancelled${applicationId ? `&application=${applicationId}` : ''}`,
      line_items: [
        {
          price_data: {
            currency: stripeCurrencyCode(currency),
            product_data: {
              name: `GlowBal Plus — ${pkg.name}`,
              description: `${pkg.aiCredits} AI strategy credits • ${pkg.durationLabel}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan: pkg.id,
        user_id: user.id,
        currency,
        ai_credits: String(pkg.aiCredits),
        duration_months: String(pkg.durationMonths),
        ...(applicationId ? { application_id: applicationId } : {}),
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
