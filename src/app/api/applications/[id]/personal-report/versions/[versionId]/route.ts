import { NextResponse } from 'next/server';
import { getApplicationPersonalReportV2Version } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';
import { isPersonalReportMigrationMissing, loadOwnedPersonalReportApplication } from '../../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id: applicationId, versionId } = await context.params;
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

  const result = await getApplicationPersonalReportV2Version(
    supabase,
    { userId: user.id, applicationId },
    versionId,
  );
  if (result.migrationMissing) return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  if (!result.record) return NextResponse.json({ error: 'Version not found.' }, { status: 404 });

  return NextResponse.json({
    applicationId,
    reportVersionId: result.record.id,
    reportV2: result.record.reportV2,
    generatedAt: result.record.generatedAt,
    trigger: result.record.trigger,
    confirmedSnapshotId: result.record.confirmedSnapshotId,
    sourceAnalysisVersionId: result.record.sourceAnalysisVersionId,
  });
}
