import { NextResponse } from 'next/server';
import {
  getApplicationPersonalReportV2Version,
  getApplicationProfileAnalysisVersion,
  getLatestApplicationPersonalReportV2,
} from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';
import { isPersonalReportMigrationMissing, loadOwnedPersonalReportApplication } from '../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isEvidenceBank(value: unknown): value is {
  version: string;
  sources: Record<string, unknown>;
  interpretations: unknown[];
  claims: unknown[];
  missingInformation: unknown[];
} {
  if (!value || typeof value !== 'object') return false;
  const bank = value as Record<string, unknown>;
  return (
    typeof bank.version === 'string' &&
    bank.sources !== null &&
    typeof bank.sources === 'object' &&
    Array.isArray(bank.interpretations) &&
    Array.isArray(bank.claims) &&
    Array.isArray(bank.missingInformation)
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
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

  const versionId = new URL(request.url).searchParams.get('versionId');
  const report = versionId
    ? await getApplicationPersonalReportV2Version(supabase, { userId: user.id, applicationId }, versionId)
    : await getLatestApplicationPersonalReportV2(supabase, { userId: user.id, applicationId });
  if (report.migrationMissing) return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  if (!report.record) return NextResponse.json({ error: 'Report version not found.' }, { status: 404 });

  const analysis = await getApplicationProfileAnalysisVersion(
    supabase,
    { userId: user.id, applicationId },
    report.record.sourceAnalysisVersionId,
  );
  if (analysis.migrationMissing) return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  if (!analysis.analysis || !isEvidenceBank(analysis.analysis.evidenceBank)) {
    return NextResponse.json({ error: 'Evidence provenance not found.' }, { status: 404 });
  }

  const provenance = {
    reportVersionId: report.record.id,
    analysisVersionId: analysis.analysis.id,
    confirmedSnapshotId: report.record.confirmedSnapshotId,
  };
  return NextResponse.json({ applicationId, ...provenance, provenance, evidenceBank: analysis.analysis.evidenceBank });
}
