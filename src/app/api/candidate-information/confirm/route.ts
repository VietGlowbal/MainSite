import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  hashCandidateSnapshotPayload,
  loadCandidateReflection,
  loadResolvedFollowUpAnswers,
  verifiedApplicationId,
} from '@/features/apply/api';
import { candidateReadiness, candidateSnapshotPayloadSchema } from '@/features/apply/domain';
import { logger, startTimer } from '@/server/observability';

/**
 * POST /api/candidate-information/confirm
 *
 * Review & Confirm's "Confirm & Generate Reports" — the checkpoint between
 * finishing Candidate Information and generating reports.
 *
 * Validates the SAME readiness rule the Review & Confirm page already shows
 * (`candidateReadiness`), server-side, rather than trusting the client: a
 * request built by hand past a client that let something slip through must
 * not be able to confirm past a genuinely unanswered required question or an
 * unreviewed extracted achievement.
 *
 * ─── PER-APPLICATION, WITH A GLOBAL FALLBACK ─────────────────────────────────
 *
 * An optional `applicationId` in the body (verified server-side — see
 * `verifiedApplicationId`) scopes both the idempotency check and the lock
 * this route sets to `course_applications.candidate_confirmed_at` for THAT
 * application, instead of the old `student_profiles.confirmed_at` (shared by
 * every application a student has). Confirming application A must not make
 * application B's onboarding think IT has been confirmed too — see
 * `docs/known-issues.md` for the incident this fixed. The global
 * `student_profiles.confirmed_at` is still set on every confirmation
 * (harmless "has ever confirmed at least once" marker) and is what this
 * route falls back to, unchanged, when no `applicationId` resolves — the
 * legacy, non-application-scoped entry points never sent one.
 *
 * ─── IDEMPOTENT ──────────────────────────────────────────────────────────────
 *
 * If this application (or, with no `applicationId`, the student globally) is
 * already confirmed, this returns the existing snapshot's id and timestamp
 * rather than creating a second one or erroring — a retried request
 * (double-click, a flaky connection) must not produce two "confirmations".
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function migrationMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204' || error.code === '42P01') return true;
  return /does not exist/i.test(error.message ?? '');
}

const bodySchema = z.object({ applicationId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const getElapsed = startTimer();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // A bare POST with no body is still valid — the legacy, non-application-
  // scoped entry points never sent one and never will.
  let requestedApplicationId: string | undefined;
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success) requestedApplicationId = parsed.data.applicationId;
  } catch {
    // No body, or invalid JSON — treated the same as "no applicationId given".
  }
  const applicationId = await verifiedApplicationId(supabase, user.id, requestedApplicationId);

  logger.info('candidate_confirmation', {
    userId: user.id,
    applicationId,
    stage: 'started',
    outcome: 'started',
  });

  const { reflection, documents, confirmedAt } = await loadCandidateReflection(
    supabase,
    user.id,
    applicationId,
  );

  if (confirmedAt) {
    const existingQuery = supabase
      .from('confirmed_candidate_snapshots')
      .select('id, confirmed_at')
      .eq('user_id', user.id)
      .order('confirmed_at', { ascending: false })
      .limit(1);
    const existing = applicationId
      ? await existingQuery.eq('application_id', applicationId).maybeSingle()
      : await existingQuery.maybeSingle();

    logger.info('candidate_confirmation', {
      userId: user.id,
      applicationId,
      stage: 'cache_hit',
      outcome: 'cached',
      cached: true,
      durationMs: getElapsed(),
    });

    return NextResponse.json({
      snapshotId: existing.data?.id ?? null,
      status: 'confirmed',
      confirmedAt,
    });
  }

  const readiness = candidateReadiness(reflection);
  if (!readiness.ready) {
    logger.warn('candidate_confirmation', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'not_ready',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      {
        error: 'NOT_READY',
        message: 'Please finish reviewing your information before confirming.',
        blockingIssues: readiness.blockingIssues,
        achievementsNeedingReview: readiness.achievementsNeedingReview,
        activitiesNeedingReview: readiness.activitiesNeedingReview,
      },
      { status: 422 },
    );
  }

  const payload = candidateSnapshotPayloadSchema.parse({
    reflection,
    documents: documents.map((document) => ({ id: document.id, fileName: document.fileName })),
    // Schema v2: resolved Adaptive Follow-up answers are frozen INTO the
    // snapshot at confirm time, so a report derived from this snapshot reads
    // the answers as the student confirmed them. Tolerant loader — an
    // un-migrated follow-up table degrades to "no answers", never blocks.
    ...(applicationId
      ? {
          followUpAnswers: await loadResolvedFollowUpAnswers(supabase, user.id, applicationId),
        }
      : {}),
  });

  const nowIso = new Date().toISOString();
  const payloadHash = hashCandidateSnapshotPayload(payload);

  // The snapshot this new row SUPERSEDES — the latest existing row for THIS
  // application (a reopened application's re-confirm appends; a first confirm
  // has nothing to point at). Resolved within application scope only, never
  // across applications.
  let supersedesSnapshotId: string | undefined;
  if (applicationId) {
    const previous = await supabase
      .from('confirmed_candidate_snapshots')
      .select('id')
      .eq('user_id', user.id)
      .eq('application_id', applicationId)
      .order('confirmed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!previous.error && previous.data?.id) {
      supersedesSnapshotId = previous.data.id as string;
    }
  }

  const baseRow = {
    user_id: user.id,
    payload,
    schema_version: 2 as const,
    confirmed_at: nowIso,
    payload_hash: payloadHash,
    ...(supersedesSnapshotId ? { supersedes_snapshot_id: supersedesSnapshotId } : {}),
    ...(applicationId ? { application_id: applicationId } : {}),
  };

  /**
   * Layered insert tolerant of ANY of the newer columns not being migrated yet:
   * each failure naming a missing column drops exactly that column and retries
   * (`ADD COLUMN IF NOT EXISTS` migrations may land in any order). An error
   * that names none of our columns is real and fails the request.
   */
  const DROPPABLE_COLUMNS = ['supersedes_snapshot_id', 'payload_hash', 'application_id'] as const;
  function missingColumnsFrom(error: { code?: string; message?: string }): string[] {
    if (!migrationMissing(error)) return [];
    const named = new Set<string>();
    for (const match of error.message?.matchAll(/column "?([a-z_]+)"? does not exist/gi) ?? []) {
      named.add(match[1]);
    }
    return DROPPABLE_COLUMNS.filter((column) => named.has(column));
  }

  let workingRow: Record<string, unknown> = { ...baseRow };
  let inserted: Awaited<ReturnType<typeof insertSnapshot>> | null = null;
  let lastError: { code?: string; message?: string } | null = null;
  while (!inserted) {
    const attempt = await insertSnapshot(workingRow);
    if (!attempt.error) {
      inserted = attempt;
      break;
    }
    lastError = attempt.error;
    const missing = missingColumnsFrom(attempt.error);
    if (missing.length === 0 || missing.length === Object.keys(workingRow).length) break;
    for (const column of missing) delete workingRow[column];
  }

  async function insertSnapshot(row: Record<string, unknown>) {
    return supabase.from('confirmed_candidate_snapshots').insert(row).select('id, confirmed_at').single();
  }

  if (inserted?.error == null && inserted?.data) {
    // success path continues below
  } else if (lastError && migrationMissing(lastError)) {
    logger.warn('candidate_confirmation', {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      outcome: 'migration_missing',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      { error: 'Confirmation is not available yet. Please try again shortly.' },
      { status: 503 },
    );
  } else if (lastError) {
    logger.error('candidate_confirmation', lastError, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not confirm your information' }, { status: 500 });
  }

  const savedRow = inserted!.data as { id: string; confirmed_at: string };

  // Per-application lock — the actual gate `fetchOnboardingState` reads for
  // THIS application going forward. Best-effort against a missing migration,
  // same "costs the lock, not the confirmation" rule the global update below
  // already follows: the snapshot above is the real record of what happened,
  // and a re-POST is safe (idempotent) if this update never lands.
  if (applicationId) {
    const appLocked = await supabase
      .from('course_applications')
      .update({ candidate_confirmed_at: nowIso })
      .eq('id', applicationId);
    if (appLocked.error) {
      logger.warn('candidate_confirmation', {
        userId: user.id,
        applicationId,
        stage: 'persisted',
        outcome: 'app_lock_failed',
        durationMs: getElapsed(),
      });
    }
  }

  const locked = await supabase
    .from('student_profiles')
    .update({ confirmed_at: nowIso })
    .eq('user_id', user.id);

  if (locked.error) {
    if (migrationMissing(locked.error)) {
      logger.warn('candidate_confirmation', {
        userId: user.id,
        applicationId,
        stage: 'persisted',
        outcome: 'profile_lock_migration_missing',
        durationMs: getElapsed(),
      });
      return NextResponse.json({
        snapshotId: savedRow.id,
        status: 'confirmed',
        confirmedAt: savedRow.confirmed_at,
      });
    }
    logger.error('candidate_confirmation', locked.error, {
      userId: user.id,
      applicationId,
      stage: 'persisted',
      durationMs: getElapsed(),
    });
    return NextResponse.json({ error: 'Could not confirm your information' }, { status: 500 });
  }

  logger.info('candidate_confirmation', {
    userId: user.id,
    applicationId,
    stage: 'completed',
    outcome: 'success',
    durationMs: getElapsed(),
  });

  return NextResponse.json({
    snapshotId: savedRow.id,
    status: 'confirmed',
    confirmedAt: savedRow.confirmed_at,
  });
}
