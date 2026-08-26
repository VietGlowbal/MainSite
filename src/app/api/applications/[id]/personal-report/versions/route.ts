import { NextResponse } from 'next/server';
import { listApplicationPersonalReportV2Versions } from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';
import { isPersonalReportMigrationMissing, loadOwnedPersonalReportApplication } from '../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

  const result = await listApplicationPersonalReportV2Versions(supabase, { userId: user.id, applicationId });
  if (result.migrationMissing) return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  return NextResponse.json({ applicationId, versions: result.versions });
}
