import { NextResponse } from 'next/server';
import { getPersonalReportV2Version } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/ai-strategy/personal-report/versions/[id]
 *
 * One past version's full report content, for the version-history
 * dropdown's read-only view. Ownership is enforced in the repository query
 * itself (filtered by the signed-in user's id), not just by this route —
 * an id belonging to another student's report returns 404, never their
 * content.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const { record, migrationMissing } = await getPersonalReportV2Version(supabase, user.id, id);
  if (migrationMissing) {
    return NextResponse.json(
      { error: 'This feature is not enabled in this environment.' },
      { status: 503 },
    );
  }
  if (!record) return NextResponse.json({ error: 'Version not found.' }, { status: 404 });

  return NextResponse.json({
    reportV2: record.reportV2,
    generatedAt: record.generatedAt,
    trigger: record.trigger,
  });
}
