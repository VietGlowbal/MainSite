import { after } from 'next/server';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeTotal } from '@/lib/currency';
import { computeServiceFee } from '@/lib/currency';
import { getPlusPackage, planAmountMajor } from '@/lib/plus';
import { convertToVnd, VNPAY_FX_RATES } from '@/lib/payments/vnpay-shared';
import { isSupportedCurrency } from '@/lib/mentors';
import { getManualPaymentConfig } from '@/server/payments/manual-config';
import { dispatchDueManualPaymentJobs } from '@/server/payments/manual-outbox';
import { manualRequestFingerprint, newManualReference, MANUAL_MENTORSHIP_INITIAL_HOLD_MINUTES, MANUAL_MENTORSHIP_REVIEW_GRACE_HOURS, MANUAL_PLUS_EXPIRY_HOURS } from '@/lib/payments/manual';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Key = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
const Body = z.discriminatedUnion('product', [
  z.object({
    provider: z.literal('manual_bank_transfer').optional(), product: z.literal('mentorship'), slot_id: z.number().int().positive(),
    help_topic: z.string().trim().min(3).max(200), help_questions: z.string().max(1500).optional().nullable(), help_outcome: z.string().max(500).optional().nullable(),
    user_university_id: z.number().int().positive().optional().nullable(), idempotency_key: Key, locale: z.enum(['en', 'vi']).optional(),
  }),
  z.object({
    provider: z.literal('manual_bank_transfer').optional(), product: z.literal('plus'), plan: z.enum(['plus-starter', 'plus-pro', 'plus-premium']),
    currency: z.enum(['USD', 'VND', 'GBP', 'EUR', 'CNY']).optional(), applicationId: z.string().uuid().optional(), idempotency_key: Key, locale: z.enum(['en', 'vi']).optional(),
  }),
]);

function studentName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const name = user.user_metadata?.full_name;
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : (user.email?.split('@')[0] ?? 'GlowBal student');
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return jsonError('Invalid manual payment request', 400);
  const input = parsed.data;
  try { getManualPaymentConfig(); } catch { return jsonError('Manual bank transfer is not configured.', 503); }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return jsonError('Sign in required', 401);
  const admin = createAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const locale = input.locale ?? (request.headers.get('accept-language')?.toLowerCase().startsWith('vi') ? 'vi' : 'en');
  const config = getManualPaymentConfig();

  let amountVnd: number;
  let expiresAt: Date;
  let reviewDeadlineAt: Date;
  let fingerprintValue: Record<string, unknown>;
  let rpcInput: Record<string, unknown>;
  if (input.product === 'plus') {
    const pkg = getPlusPackage(input.plan);
    if (!pkg) return jsonError('Unknown plan', 400);
    if (input.applicationId) {
      const { data: application } = await admin.from('course_applications').select('id').eq('id', input.applicationId).eq('user_id', user.id).maybeSingle();
      if (!application) return jsonError('Application not found', 404);
    }
    amountVnd = pkg.amountVnd;
    const now = Date.now();
    expiresAt = new Date(now + MANUAL_PLUS_EXPIRY_HOURS * 60 * 60_000);
    reviewDeadlineAt = expiresAt;
    const currency = input.currency ?? 'USD';
    fingerprintValue = { product: 'plus', plan: pkg.id, currency, applicationId: input.applicationId ?? null, provider: 'manual_bank_transfer' };
    rpcInput = { p_product_type: 'plus', p_plus_plan: pkg.id, p_plus_ai_credits: pkg.aiCredits, p_plus_duration_months: pkg.durationMonths, p_plus_application_id: input.applicationId ?? null, p_summary: `${pkg.name} — ${pkg.durationLabel}`, p_source_currency: currency, p_source_amount: planAmountMajor(pkg.amountVnd, currency), p_fx_rate: VNPAY_FX_RATES[currency] };
  } else {
    const { data: slot, error: slotError } = await admin.from('mentor_availability_slots').select('id, mentor_id, starts_at, ends_at, status').eq('id', input.slot_id).maybeSingle();
    if (slotError || !slot) return jsonError('Slot not found', 404);
    if (slot.status !== 'open') return jsonError('This slot is no longer available', 409);
    if (new Date(slot.starts_at).getTime() < Date.now() + 60 * 60_000) return jsonError('Sessions must be booked at least an hour in advance', 400);
    const { data: mentor, error: mentorError } = await admin.from('achiever_profiles').select('id, display_name, hourly_rate_amount, hourly_rate_currency, status').eq('id', slot.mentor_id).maybeSingle();
    if (mentorError || !mentor) return jsonError('Advisor not found', 404);
    if (mentor.status !== 'approved') return jsonError('Advisor is not currently accepting bookings', 403);
    const mentorAmount = Number(mentor.hourly_rate_amount);
    if (!mentorAmount || mentorAmount <= 0) return jsonError('Advisor pricing is not configured.', 400);
    if (!isSupportedCurrency(mentor.hourly_rate_currency)) return jsonError('Advisor pricing is not configured.', 400);
    const currency = mentor.hourly_rate_currency;
    const serviceFee = computeServiceFee(mentorAmount);
    const total = computeTotal(mentorAmount);
    amountVnd = convertToVnd(total, currency);
    expiresAt = new Date(Date.now() + MANUAL_MENTORSHIP_INITIAL_HOLD_MINUTES * 60_000);
    reviewDeadlineAt = new Date(expiresAt.getTime() + MANUAL_MENTORSHIP_REVIEW_GRACE_HOURS * 60 * 60_000);
    fingerprintValue = { product: 'mentorship', slot_id: input.slot_id, help_topic: input.help_topic, help_questions: input.help_questions ?? null, help_outcome: input.help_outcome ?? null, user_university_id: input.user_university_id ?? null, source_currency: currency, mentor_amount: mentorAmount, service_fee: serviceFee, total, provider: 'manual_bank_transfer' };
    rpcInput = { p_product_type: 'mentorship', p_slot_id: input.slot_id, p_help_topic: input.help_topic, p_help_questions: input.help_questions ?? null, p_help_outcome: input.help_outcome ?? null, p_user_university_id: input.user_university_id ?? null, p_summary: `${mentor.display_name ?? 'Advisor'} mentorship session`, p_source_currency: currency, p_source_amount: total, p_mentor_amount: mentorAmount, p_service_fee: serviceFee, p_fx_rate: VNPAY_FX_RATES[currency] };
  }

  const reference = newManualReference();
  const requestFingerprint = manualRequestFingerprint(fingerprintValue);
  const { data, error } = await admin.rpc('create_manual_payment_checkout', {
    p_user_id: user.id, p_reference: reference, p_product_type: input.product, p_amount_vnd: amountVnd,
    p_idempotency_key: input.idempotency_key, p_request_fingerprint: requestFingerprint, p_expires_at: expiresAt.toISOString(), p_review_deadline_at: reviewDeadlineAt.toISOString(), p_locale: locale,
    ...rpcInput, p_recipient_name: studentName(user), p_recipient_email: user.email, p_bank_label: config.bankLabel, p_bank_qr_revision: config.bankQrRevision,
  });
  if (error || !data) {
    const message = error?.message ?? '';
    return jsonError(message.includes('idempotency') ? 'This idempotency key was already used for different details.' : 'Could not create manual payment.', message.includes('idempotency') ? 409 : 500);
  }
  const result = data as { reference: string; status: string; amount_vnd: number; expires_at: string; booking_id?: number | null };
  // Next 16.3.1's `after` keeps the first outbox attempt inside the request
  // lifecycle while returning the checkout response promptly. Reconciliation
  // remains authoritative when the process is interrupted.
  after(() => dispatchDueManualPaymentJobs(2).catch(() => console.error('[manual-payment/outbox] dispatch failed')));
  return NextResponse.json({ reference: result.reference, status: result.status, amount_vnd: Number(result.amount_vnd), expires_at: result.expires_at, status_url: `${baseUrl}/payment/manual/status?reference=${encodeURIComponent(result.reference)}`, ...(result.booking_id ? { booking_id: result.booking_id } : {}) }, { status: 201 });
}
