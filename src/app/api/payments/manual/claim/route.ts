import { after } from 'next/server';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dispatchDueManualPaymentJobs } from '@/server/payments/manual-outbox';
import { sameOrigin } from '@/server/payments/manual-review-auth';

const Body = z.object({ reference: z.string().regex(/^GLOWMANUAL[A-Z0-9]+$/i) });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment reference' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const { data, error } = await createAdminClient().rpc('claim_manual_payment', { p_user_id: user.id, p_reference: parsed.data.reference });
  if (error) return NextResponse.json({ error: 'Could not record transfer claim' }, { status: 503 });
  const result = data as { ok?: boolean; reason?: string; status?: string; review_deadline_at?: string };
  if (!result.ok && result.reason === 'not_found') return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  if (!result.ok) return NextResponse.json({ error: 'This payment cannot be claimed', status: result.status }, { status: 409 });

  const admin = createAdminClient();
  const { data: tx } = await admin
    .from('payment_transactions')
    .select('id')
    .eq('reference', parsed.data.reference)
    .maybeSingle();

  if (tx?.id) {
    await admin
      .from('payment_notification_jobs')
      .insert({ transaction_id: tx.id, kind: 'student_confirmed' })
      .select()
      .maybeSingle();
  }

  after(() => dispatchDueManualPaymentJobs(10).catch(() => undefined));
  return NextResponse.json({ status: result.status ?? 'claimed', review_deadline_at: result.review_deadline_at });
}
