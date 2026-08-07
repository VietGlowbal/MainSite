import 'server-only';

import Stripe from 'stripe';

/**
 * Server-only Stripe client. We lazy-init so we don't crash module-load
 * during build when STRIPE_SECRET_KEY hasn't been set yet (e.g. preview
 * deployments before secrets are wired up).
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it to .env.local and restart the dev server.',
    );
  }

  _stripe = new Stripe(key, {
    // Pin to a specific API version so behaviour doesn't drift over time.
    apiVersion: '2025-08-27.basil',
    typescript: true,
    appInfo: {
      name: 'Glowbal Advisor Hub',
      version: '1.0.0',
    },
  });

  return _stripe;
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is not set. Get it from the Stripe dashboard → Developers → Webhooks.',
    );
  }
  return secret;
}
