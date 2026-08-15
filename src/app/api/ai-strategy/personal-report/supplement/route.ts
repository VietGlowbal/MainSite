import { NextResponse } from 'next/server';
import { z } from 'zod';
import { savePersonalReportSupplement } from '@/features/apply/api';
import { STUDY_MOTIVATION_SUPPLEMENT_KEY } from '@/features/apply/domain';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/ai-strategy/personal-report/supplement
 *
 * Saves a student's answer to one of the Personal Report's own follow-up
 * questions — see `supabase-personal-report-supplements.sql` for why this
 * is a separate table from `student_profiles`, never merged back into a
 * student's confirmed Candidate Information. Only `fieldKey`s the report
 * itself knows how to ask about are accepted; anything else is rejected
 * rather than silently accepted and never read by generation.
 *
 * Does not regenerate the report itself — the client calls
 * `POST /api/ai-strategy/personal-report` next, same as any other
 * "Create report"/"Update report" action.
 */
const ALLOWED_FIELD_KEYS = new Set([STUDY_MOTIVATION_SUPPLEMENT_KEY]);

const bodySchema = z.object({
  fieldKey: z.string().min(1).max(120),
  answer: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const { fieldKey, answer } = parsed.data;
  if (!ALLOWED_FIELD_KEYS.has(fieldKey)) {
    return NextResponse.json({ error: 'Unknown field.' }, { status: 400 });
  }

  const { error } = await savePersonalReportSupplement(supabase, { userId: user.id, fieldKey, answer });
  if (error) {
    return NextResponse.json(
      {
        error: error.migrationMissing
          ? 'This feature is not enabled in this environment.'
          : 'Could not save your answer.',
      },
      { status: error.migrationMissing ? 503 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
