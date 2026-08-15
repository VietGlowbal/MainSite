import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { savePersonalReportSupplement } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/ai-strategy/personal-report/evidence
 *
 * Accepts one quick, self-reported supporting experience from a Personal
 * Canvas evidence gap. Like report follow-up answers, this is deliberately
 * stored in `personal_report_supplements` rather than the student's confirmed
 * Candidate Information. Personal Report generation overlays these rows only
 * for the report, where they remain unverified/self-reported evidence.
 */
const EVIDENCE_FIELD_PREFIX = 'evidence:';

const bodySchema = z.object({
  answer: z.string().trim().min(1).max(4000),
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

  const fieldKey = `${EVIDENCE_FIELD_PREFIX}${randomUUID()}`;
  const { error } = await savePersonalReportSupplement(supabase, {
    userId: user.id,
    fieldKey,
    answer: JSON.stringify({ answer: parsed.data.answer }),
  });

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
