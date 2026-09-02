import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  countApplicationReportGenerations,
  enqueueApplicationPersonalReportGeneration,
  getApplicationPersonalReportGeneration,
  getLatestApplicationPersonalReportV2,
  processApplicationPersonalReportGenerations,
} from '@/features/apply/api';
import {
  APPLICATION_REPORT_GENERATION_LIMIT,
  PERSONAL_REPORT_CONTRACT_VERSION,
} from '@/features/apply/domain';
import { PERSONAL_REPORT_EXTRACTION_VERSION } from '@/lib/ai/personal-report-v2';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit, personalReportLimiter } from '@/lib/rate-limiter';
import { ENGINE_VERSION } from '@/shared/evaluation';
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

function publicGeneration(job: Awaited<ReturnType<typeof getApplicationPersonalReportGeneration>>['job']) {
  if (!job) return null;
  const safeErrorCodes = new Set([
    'SNAPSHOT_MISSING',
    'INSUFFICIENT_EVIDENCE',
    'MIGRATION_MISSING',
    'NOT_CONFIGURED',
    'AI_GENERATION_FAILED',
    'WORKER_ERROR',
    'MAX_RETRIES_EXCEEDED',
    'REPORT_LIMIT_REACHED',
  ]);
  return {
    status: job.status,
    force_requested: job.force_requested,
    confirmed_snapshot_id: job.confirmed_snapshot_id,
    input_hash: job.input_hash,
    report_version_id: job.report_version_id,
    error_code: job.error_code && safeErrorCodes.has(job.error_code) ? job.error_code : null,
    error_message:
      job.status !== 'blocked'
        ? null
        : job.error_code === 'REPORT_LIMIT_REACHED'
          ? 'You have reached the maximum number of report generations.'
          : 'Could not create the report. Please try again.',
  };
}

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

  const [latest, snapshot, generation, reportCount] = await Promise.all([
    getLatestApplicationPersonalReportV2(supabase, { userId: user.id, applicationId }),
    owned.data.candidate_confirmed_at
      ? loadLatestApplicationSnapshot(supabase, user.id, applicationId)
      : Promise.resolve({ data: null, error: null }),
    getApplicationPersonalReportGeneration(supabase, { userId: user.id, applicationId }),
    countApplicationReportGenerations(supabase, { userId: user.id, applicationId }),
  ]);
  if (
    latest.migrationMissing ||
    generation.migrationMissing ||
    reportCount.migrationMissing ||
    isPersonalReportMigrationMissing(snapshot.error)
  ) {
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
    reportCount: reportCount.count,
    reportLimit: APPLICATION_REPORT_GENERATION_LIMIT,
    generation: publicGeneration(generation.job),
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

  const [latest, snapshot, currentGeneration, reportCount] = await Promise.all([
    getLatestApplicationPersonalReportV2(supabase, { userId: user.id, applicationId }),
    loadLatestApplicationSnapshot(supabase, user.id, applicationId),
    getApplicationPersonalReportGeneration(supabase, { userId: user.id, applicationId }),
    countApplicationReportGenerations(supabase, { userId: user.id, applicationId }),
  ]);
  if (
    latest.migrationMissing ||
    reportCount.migrationMissing ||
    isPersonalReportMigrationMissing(snapshot.error)
  ) {
    return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  }
  if (currentGeneration.migrationMissing) {
    return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  }

  const currentSnapshotId = snapshot.data?.id ?? null;
  const reportIsCurrent = Boolean(
    latest.record &&
      currentSnapshotId &&
      latest.record.confirmedSnapshotId === currentSnapshotId &&
      latest.record.reportContractVersion === PERSONAL_REPORT_CONTRACT_VERSION &&
      latest.record.engineVersion === ENGINE_VERSION &&
      latest.record.promptVersion === PERSONAL_REPORT_EXTRACTION_VERSION,
  );
  if (reportIsCurrent && !parsed.data.force) {
    return NextResponse.json({
      applicationId,
      queued: false,
      cached: true,
      reportV2: latest.record!.reportV2,
      versionId: latest.record!.id,
      generatedAt: latest.record!.generatedAt,
      trigger: latest.record!.trigger,
      confirmed: true,
      confirmedSnapshotId: currentSnapshotId,
      stale: false,
      reportCount: reportCount.count,
      reportLimit: APPLICATION_REPORT_GENERATION_LIMIT,
      generation: publicGeneration(currentGeneration.job),
    });
  }

  if (
    currentGeneration.job &&
    ['pending', 'processing', 'retry'].includes(currentGeneration.job.status) &&
    (!parsed.data.force || currentGeneration.job.force_requested)
  ) {
    return NextResponse.json({ applicationId, queued: true, generation: publicGeneration(currentGeneration.job), stale: true }, { status: 202 });
  }

  const trigger = parsed.data.trigger ?? 'manual';
  if (trigger === 'manual' && reportCount.count >= APPLICATION_REPORT_GENERATION_LIMIT) {
    return NextResponse.json(
      {
        error: 'You have reached the maximum number of report generations.',
        code: 'REPORT_LIMIT_REACHED',
        reportCount: reportCount.count,
        reportLimit: APPLICATION_REPORT_GENERATION_LIMIT,
      },
      { status: 409 },
    );
  }

  const limited = applyRateLimit(personalReportLimiter, `${user.id}:${applicationId}`, 'Personal Report');
  if (limited) return limited;

  const queued = await enqueueApplicationPersonalReportGeneration(supabase, {
    userId: user.id,
    applicationId,
    trigger,
    force: parsed.data.force,
    idempotencyKey: parsed.data.idempotencyKey,
  });
  if (queued.migrationMissing) return NextResponse.json({ error: 'This feature is not enabled in this environment.' }, { status: 503 });
  if (!queued.job) return NextResponse.json({ error: 'Could not queue Personal Report generation.' }, { status: 502 });
  // Start a leased worker now rather than making the student wait for the next
  // one-minute cron tick. Cron remains the durable retry/fallback path.
  after(async () => {
    try {
      await processApplicationPersonalReportGenerations(1);
    } catch (error) {
      console.error('[personal-report-generation] request-time worker dispatch failed', error);
    }
  });
  return NextResponse.json({ applicationId, queued: true, generation: publicGeneration(queued.job), stale: true }, { status: 202 });
}
