import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const DEFAULTS = {
  deadline_reminders: true,
  weekly_strategy_digest: true,
  scholarship_alerts: true,
  mentorship_reminders: true,
  product_updates: true,
  marketing: false,
  preferred_language: 'en' as const,
  timezone: 'Asia/Ho_Chi_Minh',
};

const PatchSchema = z.object({
  deadline_reminders: z.boolean().optional(),
  weekly_strategy_digest: z.boolean().optional(),
  scholarship_alerts: z.boolean().optional(),
  mentorship_reminders: z.boolean().optional(),
  product_updates: z.boolean().optional(),
  marketing: z.boolean().optional(),
  preferred_language: z.enum(['en', 'vi']).optional(),
  timezone: z.string().min(1).max(80).optional(),
}).strict();

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('email_preferences')
    .select('deadline_reminders,weekly_strategy_digest,scholarship_alerts,mentorship_reminders,product_updates,marketing,preferred_language,timezone')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Could not load email preferences.' }, { status: 500 });
  }

  return NextResponse.json({ preferences: { ...DEFAULTS, ...(data ?? {}) } });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email preferences.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('email_preferences')
    .upsert(
      { user_id: user.id, ...parsed.data, updated_at: now },
      { onConflict: 'user_id' },
    )
    .select('deadline_reminders,weekly_strategy_digest,scholarship_alerts,mentorship_reminders,product_updates,marketing,preferred_language,timezone')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Could not update email preferences.' }, { status: 500 });
  }

  return NextResponse.json({ preferences: { ...DEFAULTS, ...data } });
}
