import { NextResponse } from 'next/server';
import { listPersonalReportV2Versions } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/ai-strategy/personal-report/versions
 *
 * Every past Personal Report version's id/date/trigger for this student,
 * newest first — populates the version-history dropdown on the report
 * page. No report content here; see `versions/[id]` for one version's
 * full content.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You need to sign in.' }, { status: 401 });

  const { versions, migrationMissing } = await listPersonalReportV2Versions(supabase, user.id);
  if (migrationMissing) return NextResponse.json({ versions: [] });

  return NextResponse.json({ versions });
}
