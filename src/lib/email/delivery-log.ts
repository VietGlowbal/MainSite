import { createAdminClient } from '@/server/db/admin';
import type { EmailCategory, EmailTemplateId } from './types';

type DeliveryStart = {
  recipient: string;
  subject: string;
  template: EmailTemplateId;
  category: EmailCategory;
  eventKey?: string;
  userId?: string;
  metadata?: Record<string, string>;
};

type DeliveryClaim = { id: number | null; duplicate: boolean };

function unavailableTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205';
}

/**
 * Best-effort persistent claim + log. A unique event_key makes scheduled and
 * retried sends idempotent across server instances. Deployments that have not
 * yet applied supabase-email-system.sql still send mail; they simply miss the
 * audit log until the schema is installed.
 */
export async function beginEmailDelivery(input: DeliveryStart): Promise<DeliveryClaim> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { id: null, duplicate: false };
  }

  try {
    const admin = createAdminClient();
    const payload = {
      user_id: input.userId ?? null,
      recipient: input.recipient,
      template: input.template,
      category: input.category,
      event_key: input.eventKey ?? null,
      subject: input.subject,
      provider: 'resend',
      status: 'sending',
      metadata: input.metadata ?? {},
      attempt_count: 1,
    };

    const { data, error } = await admin
      .from('email_deliveries')
      .insert(payload)
      .select('id')
      .single();

    if (!error) return { id: data?.id ?? null, duplicate: false };
    if (unavailableTable(error)) return { id: null, duplicate: false };

    // event_key is unique. A conflict normally means the logical email already
    // ran. Failed sends are allowed one retry by reusing the same row.
    if (error.code === '23505' && input.eventKey) {
      const { data: existing, error: lookupError } = await admin
        .from('email_deliveries')
        .select('id,status,attempt_count')
        .eq('event_key', input.eventKey)
        .maybeSingle();

      if (lookupError || !existing) return { id: null, duplicate: true };
      if (existing.status !== 'failed') return { id: existing.id, duplicate: true };

      const { error: retryError } = await admin
        .from('email_deliveries')
        .update({
          status: 'sending',
          error: null,
          failed_at: null,
          attempt_count: Number(existing.attempt_count || 1) + 1,
        })
        .eq('id', existing.id)
        .eq('status', 'failed');

      return retryError
        ? { id: existing.id, duplicate: true }
        : { id: existing.id, duplicate: false };
    }

    console.error('[email] failed to create delivery log', error.message);
    return { id: null, duplicate: false };
  } catch (error) {
    console.error('[email] delivery log unavailable', error);
    return { id: null, duplicate: false };
  }
}

export async function finishEmailDelivery(
  id: number | null,
  result: { ok: true; messageId: string } | { ok: false; error: string },
): Promise<void> {
  if (!id || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    if (result.ok) {
      await admin
        .from('email_deliveries')
        .update({ status: 'sent', provider_message_id: result.messageId, sent_at: now })
        .eq('id', id);
    } else {
      await admin
        .from('email_deliveries')
        .update({ status: 'failed', error: result.error.slice(0, 2000), failed_at: now })
        .eq('id', id);
    }
  } catch (error) {
    console.error('[email] failed to finish delivery log', error);
  }
}
