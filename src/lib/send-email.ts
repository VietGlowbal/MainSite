import { getEmailReplyTo, getEmailSender } from '@/lib/email/config';
import { beginEmailDelivery, finishEmailDelivery } from '@/lib/email/delivery-log';
import type { SendEmailOptions, SendEmailResult } from '@/lib/email/types';

export type { EmailAttachment, EmailCategory, EmailTemplateId, SendEmailOptions, SendEmailResult } from '@/lib/email/types';

function recipientLabel(to: string | string[]): string {
  return Array.isArray(to) ? to.join(',') : to;
}

/**
 * The single low-level mail transport for GlowBal.
 *
 * - Uses support@glowbal-education.com by default.
 * - Preserves WAITLIST_FROM_EMAIL as a deployment compatibility fallback.
 * - Supports attachments, plain text, reply-to and Resend idempotency.
 * - Writes best-effort delivery/audit rows when supabase-email-system.sql exists.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const category = options.category ?? 'product_transactional';
  const template = options.template ?? 'legacy';
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const recipient = recipientLabel(options.to);
  const senderKind = category === 'marketing' ? 'marketing' : 'default';
  const from = options.from?.trim() || getEmailSender(senderKind);
  const replyTo = options.replyTo?.trim() || getEmailReplyTo();

  if (!apiKey || apiKey.startsWith('re_your_')) {
    console.warn('[sendEmail] RESEND_API_KEY not configured — skipping email to', recipient);
    return { ok: true, skipped: true, reason: 'not-configured' };
  }

  const claim = await beginEmailDelivery({
    recipient,
    subject: options.subject,
    template,
    category,
    eventKey: options.idempotencyKey,
    userId: options.userId,
    metadata: options.tags,
  });
  if (claim.duplicate) {
    return { ok: true, skipped: true, reason: 'duplicate' };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey.slice(0, 256);

  const payload = {
    from,
    to,
    subject: options.subject,
    html: options.html,
    ...(options.text ? { text: options.text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(options.attachments?.length
      ? {
          attachments: options.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: attachment.content,
            ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
            ...(attachment.contentId ? { content_id: attachment.contentId } : {}),
          })),
        }
      : {}),
    ...(options.tags && Object.keys(options.tags).length
      ? {
          tags: Object.entries(options.tags).map(([name, value]) => ({
            name: name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256),
            value: value.slice(0, 256),
          })),
        }
      : {}),
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };

    if (!response.ok || !body.id) {
      const error = body.message || body.error || `Resend rejected email (${response.status})`;
      console.error('[sendEmail] Resend error:', response.status, error);
      await finishEmailDelivery(claim.id, { ok: false, error });
      return { ok: false, status: response.status, error };
    }

    await finishEmailDelivery(claim.id, { ok: true, messageId: body.id });
    return { ok: true, messageId: body.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email delivery failure';
    console.error('[sendEmail] Resend request failed:', message);
    await finishEmailDelivery(claim.id, { ok: false, error: message });
    return { ok: false, error: message };
  }
}
