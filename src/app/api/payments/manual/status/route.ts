import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { manualStatusLabel } from '@/lib/payments/manual';
import { getManualPaymentConfig } from '@/server/payments/manual-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference')?.trim();
  if (!reference) return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  // This is deliberately the ordinary user client. RLS enforces user_id and
  // the query repeats it to keep the ownership boundary obvious in reviews.
  const { data, error } = await supabase.from('payment_transactions').select('id, reference, provider, product_type, status, amount_vnd, expires_at, paid_at, fulfilled_at, booking_id, plus_plan, recipient_name').eq('reference', reference).eq('user_id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load payment status' }, { status: 503 });
  if (!data || data.provider !== 'manual_bank_transfer') return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  // Keep this on the ordinary user client: the review policy exposes only a
  // row belonging to this transaction's user. The ledger stays authoritative
  // for terminal outcomes, while a claimed review state survives a reload
  // before the founder has confirmed it.
  const { data: review, error: reviewError } = await supabase
    .from('manual_payment_reviews')
    .select('transaction_id, state, claimed_at, review_deadline_at')
    .eq('transaction_id', data.id)
    .maybeSingle();
  if (reviewError) return NextResponse.json({ error: 'Could not load payment status' }, { status: 503 });
  const reviewState = typeof review?.state === 'string' ? review.state : null;
  const status = data.status === 'pending' && (reviewState === 'claimed' || reviewState === 'expired')
    ? reviewState
    : data.status;
  const canClaim = status === 'pending'
    && reviewState === 'pending'
    && !review?.claimed_at
    && new Date(data.expires_at).getTime() > Date.now();
  // Fetch phone from profiles for the transfer description
  const { data: profile } = await supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle();
  const phone = typeof profile?.phone === 'string' ? profile.phone.trim() : '';

  // Build human-readable transfer description: Name [Phone] Amount
  const recipientName = typeof data.recipient_name === 'string' ? data.recipient_name.trim() : '';
  const transferDescParts = [recipientName, phone, String(data.amount_vnd)].filter(Boolean);
  const transfer_description = transferDescParts.join(' ');

  const config = getManualPaymentConfig();
  return NextResponse.json({ ...data, status, status_label: manualStatusLabel(status), can_claim: canClaim, bank_label: config.bankLabel, account_holder: config.accountHolder, account_number: config.accountNumber, account_number_masked: config.accountNumberMasked, bank_qr_url: config.bankQrUrl, transfer_description });
}
