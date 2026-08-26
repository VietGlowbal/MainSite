import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getApplicationPersonalReportV2Version,
  getApplicationProfileAnalysisVersion,
  getLatestApplicationPersonalReportV2,
  saveApplicationPersonalReportSupplement,
} from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';
import { isPersonalReportMigrationMissing, loadOwnedPersonalReportApplication } from '../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ answer: z.string().trim().min(1).max(4000) });

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
    return NextResponse.json({ error: 'Confirm Candidate Information before adding evidence.', code: 'APPLICATION_NOT_CONFIRMED' }, { status: 409 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
  const result = await saveApplicationPersonalReportSupplement(supabase, {
    userId: user.id,
    applicationId,
    fieldKey: `evidence:${randomUUID()}`,
    answer: JSON.stringify({ answer: parsed.data.answer }),
  });
  if (result.error) {
    return NextResponse.json(
      { error: result.error.migrationMissing ? 'This feature is not enabled in this environment.' : 'Could not save your answer.' },
      { status: result.error.migrationMissing ? 503 : 500 },
    );
  }
  return NextResponse.json({ success: true, applicationId });
}
