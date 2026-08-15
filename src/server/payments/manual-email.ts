import { getManualPaymentConfig } from './manual-config';
import type { ManualEmailAttachment } from './manual-email-templates';

export type TransactionalEmail = {
  jobId: string;
  kind: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<ManualEmailAttachment & { content: string }>;
};

export function manualEmailIdempotencyKey(jobId: string, kind: string): string {
  return `glowbal-manual-payment:${jobId}:${kind}`;
}

export async function sendManualTransactionalEmail(email: TransactionalEmail): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  const config = getManualPaymentConfig();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': manualEmailIdempotencyKey(email.jobId, email.kind),
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      attachments: email.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        content_id: attachment.contentId,
      })),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok || !payload.id) throw new Error(payload.message || `Resend rejected email (${response.status})`);
  return payload.id;
}

export async function fetchConfiguredQrAttachment(): Promise<{ filename: string; contentId: string; content: string }> {
  const config = getManualPaymentConfig();
  const response = await fetch(config.bankQrUrl, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Configured bank QR asset returned ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 2_000_000) throw new Error('Configured bank QR asset has an invalid size');
  return { filename: 'glowbal-bank-qr.png', contentId: 'manual-payment-qr', content: Buffer.from(bytes).toString('base64') };
}
