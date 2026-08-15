import { getManualPaymentConfig } from './manual-config';
import { createManualReviewToken } from './manual-capability';
import { fetchConfiguredQrAttachment, sendManualTransactionalEmail } from './manual-email';
import { renderManualFounderEmail, renderManualOutcomeEmail, renderManualStudentEmail } from './manual-email-templates';
import { createAdminClient } from '@/lib/supabase/admin';

type Job = {
  id: string;
  transaction_id: string;
  kind: 'student_instructions' | 'founder_review' | 'founder_claimed' | 'student_confirmed' | 'student_rejected' | 'student_needs_support';
  transaction: Record<string, unknown> | null;
  review: Record<string, unknown> | null;
};

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function unwrapManualOutboxRecord(
  value: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value) return null;
  const wrapped = value['?column?'];
  return wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)
    ? (wrapped as Record<string, unknown>)
    : value;
}

function requireManualReviewToken(review: Record<string, unknown> | null, secret: string): string {
  if (!review || typeof review.id !== 'string') {
    throw new Error('Manual founder review capability is unavailable');
  }
  const tokenVersion = Number(review.token_version);
  if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 1) {
    throw new Error('Manual founder review capability is unavailable');
  }
  return createManualReviewToken(review.id, tokenVersion, secret);
}

export async function sendManualPaymentJob(job: Job): Promise<string> {
  const config = getManualPaymentConfig();
  const tx = unwrapManualOutboxRecord(job.transaction);
  const review = unwrapManualOutboxRecord(job.review);
  if (!tx) throw new Error('Manual notification has no transaction');
  const reference = stringValue(tx.reference);
  const amountVnd = numberValue(tx.amount_vnd);
  const productType = stringValue(tx.product_type);
  const plusPlan = stringValue(tx.plus_plan);
  let productLabel = productType === 'mentorship' ? 'Mentorship session' : (plusPlan ? `GlowBal Plus ${plusPlan}` : 'GlowBal Plus');
  if (productType === 'plus') {
    if (plusPlan === 'plus-starter') productLabel = 'GlowBal Plus Starter';
    else if (plusPlan === 'plus-pro') productLabel = 'GlowBal Plus Pro';
    else if (plusPlan === 'plus-premium') productLabel = 'GlowBal Plus Premium';
  }
  const statusUrl = `${config.siteUrl}/payment/manual/status?reference=${encodeURIComponent(reference)}`;
  const recipientName = stringValue(tx.recipient_name, 'GlowBal student');
  const recipientEmail = stringValue(tx.recipient_email);
  const expiresAt = new Date(stringValue(tx.expires_at));

  if (job.kind === 'student_instructions') {
    const rendered = renderManualStudentEmail({
      locale: tx.locale === 'vi' ? 'vi' : 'en', recipientName, bankLabel: config.bankLabel,
      accountHolder: config.accountHolder, accountNumberMasked: config.accountNumberMasked,
      amountVnd, reference, productLabel, expiresAt, statusUrl, qrCid: 'manual-payment-qr',
    });
    const qr = await fetchConfiguredQrAttachment();
    return sendManualTransactionalEmail({ ...rendered, jobId: job.id, kind: job.kind, to: recipientEmail, attachments: [qr] });
  }
  if (job.kind === 'founder_review') {
    throw new Error('Checkout-time founder notifications are no longer delivered');
  }
  if (job.kind === 'founder_claimed') {
    const reviewToken = requireManualReviewToken(review, config.reviewSecret);
    const reviewUrl = `${config.siteUrl}/payment/manual/review?token=${encodeURIComponent(reviewToken)}`;
    const rendered = renderManualFounderEmail({
      reference, amountVnd, studentId: stringValue(tx.user_id),
      studentName: recipientName, studentEmail: recipientEmail,
      studentPhone: stringValue(tx.recipient_phone),
      productLabel, summary: stringValue(tx.summary, productType === 'mentorship' ? 'Mentorship slot held' : 'Plus plan purchase'),
      checkoutCreatedAt: new Date(stringValue(tx.created_at)),
      claimedAt: new Date(stringValue(review?.claimed_at)),
      reviewDeadlineAt: new Date(stringValue(review?.review_deadline_at, stringValue(tx.expires_at))),
      reviewUrl,
    });
    return sendManualTransactionalEmail({ ...rendered, jobId: job.id, kind: job.kind, to: config.founderEmail });
  }
  const rendered = renderManualOutcomeEmail({
    confirmed: job.kind === 'student_confirmed', recipientName, reference, productLabel, statusUrl,
  });
  return sendManualTransactionalEmail({ ...rendered, jobId: job.id, kind: job.kind, to: recipientEmail });
}

export async function dispatchDueManualPaymentJobs(limit = 10): Promise<number> {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin.rpc('lease_manual_payment_notification_jobs', { p_limit: limit });
  if (error) throw new Error('Could not lease manual payment notifications');
  const results = await Promise.all(((jobs ?? []) as Job[]).map(async (job) => {
    try {
      const providerMessageId = await sendManualPaymentJob(job);
      await admin.rpc('complete_manual_payment_notification_job', { p_job_id: job.id, p_provider_message_id: providerMessageId });
      return true;
    } catch {
      // Deliberately log only the job id and a generic error; never log the
      // recipient, bank details, or review token.
      // Keep provider details out of logs and the durable job row: Resend
      // errors can echo request fields, including recipient addresses.
      const message = 'manual email delivery failed';
      console.error('[manual-payment/outbox]', { jobId: job.id, message });
      await admin.rpc('fail_manual_payment_notification_job', { p_job_id: job.id, p_error: message });
      return false;
    }
  }));
  return results.filter(Boolean).length;
}
