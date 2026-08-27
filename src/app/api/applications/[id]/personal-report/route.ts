import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enqueueApplicationPersonalReportGeneration,
  getApplicationPersonalReportGeneration,
  getLatestApplicationPersonalReportV2,
} from '@/features/apply/api';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit, personalReportLimiter } from '@/lib/rate-limiter';
import {
  isPersonalReportMigrationMissing,
  loadLatestApplicationSnapshot,
  loadOwnedPersonalReportApplication,
} from './_helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  trigger: z.enum(['manual', 'matching_report', 'supplement_answer']).optional(),
  force: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params) {
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

  const [latest, snapshot, generation] = await Promise.all([
    getLatestApplicationPersonalReportV2(supabase, { userId: user.id, applicationId }),
    owned.data.candidate_confirmed_at
      ? loadLatestApplicationSnapshot(supabase, user.id, applicationId)
      : Promise.resolve({ data: null, error: null }),
    getApplicationPersonalReportGeneration(supabase, { userId: user.id, applicationId }),
  ]);
  if (latest.migrationMissing || generation.migrationMissing || isPersonalReportMigrationMissing(snapshot.error)) {
    return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  }

  const snapshotId = snapshot.data?.id ?? null;
  const stale = !owned.data.candidate_confirmed_at
    ? Boolean(latest.record)
    : Boolean(snapshotId && (!latest.record || latest.record.confirmedSnapshotId !== snapshotId));

  return NextResponse.json({
    applicationId,
    reportV2: latest.record?.reportV2 ?? null,
    versionId: latest.record?.id ?? null,
    generatedAt: latest.record?.generatedAt ?? null,
    trigger: latest.record?.trigger ?? null,
    confirmed: Boolean(owned.data.candidate_confirmed_at && snapshotId),
    confirmedSnapshotId: snapshotId,
    stale,
    generation: generation.job,
  });
}

export async function POST(request: Request, context: Params) {
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
    return NextResponse.json(
      { error: 'Confirm Candidate Information before generating a Personal Report.', code: 'APPLICATION_NOT_CONFIRMED' },
      { status: 409 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });

  const limited = applyRateLimit(personalReportLimiter, `${user.id}:${applicationId}`, 'Personal Report');
  if (limited) return limited;

  const queued = await enqueueApplicationPersonalReportGeneration(supabase, {
    userId: user.id,
    applicationId,
    trigger: parsed.data.trigger ?? 'manual',
    force: parsed.data.force,
  });
  if (queued.migrationMissing) return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  if (!queued.job) return NextResponse.json({ error: 'Could not queue Personal Report generation.' }, { status: 502 });
  return NextResponse.json({ applicationId, queued: true, generation: queued.job, stale: true }, { status: 202 });
}
