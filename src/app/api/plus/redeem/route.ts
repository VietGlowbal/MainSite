import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sameOrigin } from '@/server/payments/manual-review-auth';

const PROMO_CODE = 'gogogogoglowbal';
const PROMO_CAMPAIGN = 'gogogogoglowbal-v2';
const Body = z.object({
  code: z.string().trim().min(1).max(64),
  plan: z.enum(['plus-starter', 'plus-pro', 'plus-premium']),
});

type RedemptionResult = {
  ok?: boolean;
  reason?: string;
  plan?: string;
  expires_at?: string;
};

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid promo request' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (parsed.data.code.toLocaleLowerCase('en-US') !== PROMO_CODE) {
    return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc('redeem_plus_promo', {
    p_user_id: user.id,
    p_campaign: PROMO_CAMPAIGN,
    p_plan: parsed.data.plan,
  });
  if (error) {
    return NextResponse.json({ error: 'Promo redemption is unavailable' }, { status: 503 });
  }

  const result = data as RedemptionResult | null;
  if (!result?.ok && result?.reason === 'already_redeemed') {
    return NextResponse.json({ error: 'This promo has already been used on your account' }, { status: 409 });
  }
  if (!result?.ok) {
    return NextResponse.json({ error: 'Could not redeem promo code' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, plan: result.plan, expires_at: result.expires_at });
}
