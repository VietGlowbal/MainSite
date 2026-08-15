import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/server/auth/auth-helpers';
import { getManualPaymentConfig, isManualReviewer } from './manual-config';
import { verifyManualReviewToken } from './manual-capability';

export type ManualReviewAuth = { userId: string; reviewId: string; tokenVersion: number; admin: ReturnType<typeof createAdminClient> };

export async function authorizeManualReview(token: string): Promise<ManualReviewAuth | null> {
  const config = getManualPaymentConfig();
  const capability = verifyManualReviewToken(token, config.reviewSecret);
  if (!capability) return null;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !isManualReviewer(user.id, config) || !(await isAdmin(user.id))) return null;
  return { userId: user.id, reviewId: capability.reviewId, tokenVersion: capability.version, admin: createAdminClient() };
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function loadManualReview(token: string): Promise<Record<string, unknown> | null> {
  const auth = await authorizeManualReview(token);
  if (!auth) return null;
  const { data: review } = await auth.admin.from('manual_payment_reviews').select('id, transaction_id, state, token_version, expires_at, claimed_at, review_deadline_at, reviewed_at, reviewer_note').eq('id', auth.reviewId).eq('token_version', auth.tokenVersion).maybeSingle();
  if (!review) return null;
  const { data: transaction } = await auth.admin.from('payment_transactions').select('reference, provider, product_type, status, amount_vnd, expires_at, booking_id, plus_plan, plus_ai_credits, plus_duration_months, recipient_name, recipient_email, summary, created_at').eq('id', review.transaction_id).maybeSingle();
  if (!transaction || transaction.provider !== 'manual_bank_transfer') return null;
  return { ...review, transaction };
}
