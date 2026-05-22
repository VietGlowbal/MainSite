import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Slot management for the signed-in mentor (the only person allowed to add
 * or remove slots on their own calendar). The handler is small because the
 * RLS policies on `mentor_availability_slots` already enforce ownership.
 *
 *   POST  → add a slot (or many slots in one go)
 *   DELETE → remove an open slot the mentor hasn't sold yet
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const AddSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        starts_at: z
          .string()
          .regex(ISO_DATE_RE, 'starts_at must be ISO 8601')
          .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
        // Mentor sessions are always 60 min, but we allow 30/45/60 to
        // future-proof the schema.
        duration_mins: z.number().int().refine((n) => [30, 45, 60].includes(n)).default(60),
      }),
    )
    .min(1)
    .max(60),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = AddSlotsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  // Confirm the user is a mentor (any status — pending mentors can still
  // pre-fill their calendar; bookings are gated separately).
  const { data: mentor } = await supabase
    .from('achiever_profiles')
    .select('id, status')
    .eq('id', user.id)
    .maybeSingle();

  if (!mentor) {
    return NextResponse.json({ error: 'No mentor profile' }, { status: 403 });
  }

  const now = Date.now();
  const rows = parsed.data.slots.map((s) => {
    const starts = new Date(s.starts_at);
    const ends = new Date(starts.getTime() + s.duration_mins * 60 * 1000);
    return { starts, ends };
  });

  // Don't allow slots in the past.
  if (rows.some((r) => r.starts.getTime() < now)) {
    return NextResponse.json(
      { error: 'Cannot add a slot in the past' },
      { status: 400 },
    );
  }

  // Insert with onConflict: ignore duplicates (same mentor + same start).
  const { data, error } = await supabase
    .from('mentor_availability_slots')
    .upsert(
      rows.map((r) => ({
        mentor_id: user.id,
        starts_at: r.starts.toISOString(),
        ends_at: r.ends.toISOString(),
        status: 'open',
      })),
      { onConflict: 'mentor_id,starts_at', ignoreDuplicates: true },
    )
    .select('id, starts_at, ends_at, status');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ slots: data ?? [] });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const slotId = Number(url.searchParams.get('id'));
  if (!Number.isFinite(slotId)) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  // RLS limits this to slots owned by the user, but we also want to refuse
  // deletion of slots that have a booking attached.
  const { data: slot } = await supabase
    .from('mentor_availability_slots')
    .select('id, status, mentor_id')
    .eq('id', slotId)
    .maybeSingle();

  if (!slot || slot.mentor_id !== user.id) {
    return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  }
  if (slot.status === 'booked' || slot.status === 'held') {
    return NextResponse.json(
      { error: 'Cannot delete a slot that has been booked' },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from('mentor_availability_slots')
    .delete()
    .eq('id', slotId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
