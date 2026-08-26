import { NextResponse } from 'next/server';
import { z } from 'zod';
import { saveApplicationPersonalReportSupplement } from '@/features/apply/api';
import { STUDY_MOTIVATION_SUPPLEMENT_KEY } from '@/features/apply/domain';
import { createClient } from '@/lib/supabase/server';
import { isPersonalReportMigrationMissing, loadOwnedPersonalReportApplication } from '../_helpers';

export const runtime = 'nodejs';

const bodySchema = z.object({
  fieldKey: z.string().trim().min(1).max(120),
  answer: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const owned = await loadOwnedPersonalReportApplication(supabase, user.id, applicationId);
  if (owned.error) {
    return NextResponse.json(
      { error: isPersonalReportMigrationMissing(owned.error) ? 'This feature is not enabled in this environment.' : 'Could not load this application.' },
      { status: isPersonalReportMigrationMissing(owned.error) ? 503 : 500 },
    );
  }
  if (!owned.data) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (!owned.data.candidate_confirmed_at) {
    return NextResponse.json({ error: 'Confirm Candidate Information before answering this question.', code: 'APPLICATION_NOT_CONFIRMED' }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
  if (parsed.data.fieldKey !== STUDY_MOTIVATION_SUPPLEMENT_KEY) {
    return NextResponse.json({ error: 'Unknown field.' }, { status: 422 });
  }

  const result = await saveApplicationPersonalReportSupplement(supabase, {
    userId: user.id,
    applicationId,
    fieldKey: parsed.data.fieldKey,
    answer: parsed.data.answer,
  });
  if (result.error) {
    return NextResponse.json(
      { error: result.error.migrationMissing ? 'This feature is not enabled in this environment.' : 'Could not save your answer.' },
      { status: result.error.migrationMissing ? 503 : 500 },
    );
  }
  return NextResponse.json({ success: true, applicationId, fieldKey: parsed.data.fieldKey });
}
