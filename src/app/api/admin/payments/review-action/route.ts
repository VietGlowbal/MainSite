import { after } from 'next/server';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isPaymentAdmin } from '@/server/auth/auth-helpers';
import { dispatchDueManualPaymentJobs } from '@/server/payments/manual-outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  action: z.enum(['confirm', 'reject']),
  transactionId: z.string().uuid().optional().nullable(),
  bookingId: z.number().int().positive().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const canManage = await isPaymentAdmin(user.id, user.email);
  if (!canManage) {
    return NextResponse.json({ error: 'Unauthorized to review payments' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { action, transactionId, bookingId, note } = parsed.data;

  if (!transactionId && !bookingId) {
    return NextResponse.json({ error: 'Missing transaction or booking ID' }, { status: 400 });
  }

  if (transactionId) {
    // 1. Transaction-based review (Manual bank transfer or VNPay)
    const { data: tx, error: txError } = await admin
      .from('payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();

    if (txError || !tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (action === 'confirm') {
      // Call fulfill_payment_transaction
      const { data: fulfillResult, error: fulfillError } = await admin.rpc('fulfill_payment_transaction', {
        p_transaction_id: transactionId,
        p_actor: user.id,
      });

      if (fulfillError) {
        return NextResponse.json({ error: 'Failed to fulfill payment transaction' }, { status: 500 });
      }

      // Update manual_payment_reviews state
      await admin
        .from('manual_payment_reviews')
        .update({
          state: 'confirmed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          reviewer_note: note || null,
        })
        .eq('transaction_id', transactionId);

      after(() => dispatchDueManualPaymentJobs(10).catch(() => undefined));

      return NextResponse.json({
        success: true,
        action: 'confirm',
        status: (fulfillResult as { status?: string })?.status ?? 'fulfilled',
      });
    } else {
      // action === 'reject'
      await admin
        .from('manual_payment_reviews')
        .update({
          state: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          reviewer_note: note || null,
        })
        .eq('transaction_id', transactionId);

      await admin
        .from('payment_transactions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (tx.booking_id) {
        await admin.rpc('cancel_vnpay_booking', {
          p_booking_id: tx.booking_id,
          p_reason: note || 'Manual transfer rejected by admin',
        });
      }

      // Enqueue rejection email job
      await admin
        .from('payment_notification_jobs')
        .insert({
          transaction_id: transactionId,
          kind: 'student_rejected',
        });

      after(() => dispatchDueManualPaymentJobs(10).catch(() => undefined));

      return NextResponse.json({
        success: true,
        action: 'reject',
        status: 'failed',
      });
    }
  }

  // 2. Direct booking review (legacy or direct booking without payment_transactions)
  if (bookingId) {
    if (action === 'confirm') {
      const { data: booking, error: bError } = await admin
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

      if (bError || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      const meetingLink = booking.meeting_link || `https://meet.jit.si/glowbal-${booking.id}-${Math.random().toString(36).slice(2, 10)}`;

      await admin
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_confirmed_at: new Date().toISOString(),
          meeting_link: meetingLink,
        })
        .eq('id', bookingId);

      if (booking.slot_id) {
        await admin
          .from('mentor_availability_slots')
          .update({
            status: 'booked',
            hold_expires_at: null,
          })
          .eq('id', booking.slot_id);
      }

      return NextResponse.json({ success: true, action: 'confirm', status: 'confirmed' });
    } else {
      await admin
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_by: 'admin',
          cancellation_reason: note || 'Cancelled by admin',
        })
        .eq('id', bookingId);

      const { data: booking } = await admin
        .from('bookings')
        .select('slot_id')
        .eq('id', bookingId)
        .maybeSingle();

      if (booking?.slot_id) {
        await admin
          .from('mentor_availability_slots')
          .update({
            status: 'open',
            booking_id: null,
            hold_expires_at: null,
          })
          .eq('id', booking.slot_id);
      }

      return NextResponse.json({ success: true, action: 'reject', status: 'cancelled' });
    }
  }

  return NextResponse.json({ error: 'Unhandled request' }, { status: 400 });
}
