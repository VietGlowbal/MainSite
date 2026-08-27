import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  hashCandidateSnapshotPayload,
  loadCandidateReflection,
  loadResolvedFollowUpAnswers,
  ApplicationLookupError,
  ApplicationNotOwnedError,
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

  // A bare POST with no body is still valid for the legacy entry point. Once a
  // caller supplies an application id, malformed or unowned ids must fail
  // closed rather than silently becoming a global confirmation.
  let requestedApplicationId: string | undefined;
  try {
    const raw = await request.text();
    if (raw.trim()) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
      }
      const parsed = bodySchema.safeParse(parsedJson);
      if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
      requestedApplicationId = parsed.data.applicationId;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 422 });
  }
  let applicationId: string | undefined;
  if (requestedApplicationId) {
    try {
      applicationId = await verifiedApplicationId(supabase, user.id, requestedApplicationId, { strict: true });
    } catch (error) {
      if (error instanceof ApplicationNotOwnedError) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
      }
      if (error instanceof ApplicationLookupError) {
        return NextResponse.json({ error: 'Could not verify application.' }, { status: 503 });
      }
      throw error;
    }
    if (!applicationId) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  }

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

  const payloadResult = candidateSnapshotPayloadSchema.safeParse({
    reflection,
    documents: documents.map((document) => ({
      id: document.id,
      fileName: document.fileName,
      storageKey: document.storageKey,
    })),
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
  if (!payloadResult.success) {
    logger.warn('candidate_confirmation', {
      userId: user.id,
      applicationId,
      stage: 'validated',
      outcome: 'not_ready',
      durationMs: getElapsed(),
    });
    return NextResponse.json(
      {
        error: 'INVALID_CANDIDATE_DATA',
        message: 'Some saved experience data needs updating. Please return to Experiences and press Continue again.',
      },
      { status: 422 },
    );
  }
  const payload = payloadResult.data;

  const nowIso = new Date().toISOString();
  const payloadHash = hashCandidateSnapshotPayload(payload);

  let savedRow: { id: string; confirmed_at: string };
  if (applicationId) {
    // Application confirmation is one transaction: the database function locks
    // the application row, re-checks idempotency, appends the revision and sets
    // candidate_confirmed_at. Never degrade this path to a global/partial row.
    const atomic = await supabase.rpc('confirm_application_candidate_snapshot', {
      p_application_id: applicationId,
      p_payload: payload,
      p_payload_hash: payloadHash,
      p_confirmed_at: nowIso,
    });
    if (atomic.error) {
      if (atomic.error.code === 'P0001' && /application not found/i.test(atomic.error.message ?? '')) {
        return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
      }
      logger.error('candidate_confirmation', atomic.error, {
        userId: user.id,
        applicationId,
        stage: 'persisted',
        outcome: migrationMissing(atomic.error) ? 'migration_missing' : 'failed',
        durationMs: getElapsed(),
      });
      return NextResponse.json(
        { error: migrationMissing(atomic.error) ? 'Confirmation is not available yet. Please try again shortly.' : 'Could not confirm your information' },
        { status: migrationMissing(atomic.error) ? 503 : 500 },
      );
    }
    const row = (Array.isArray(atomic.data) ? atomic.data[0] : atomic.data) as
      | { snapshot_id?: unknown; confirmed_at?: unknown }
      | null;
    if (!row?.snapshot_id || typeof row.confirmed_at !== 'string') {
      return NextResponse.json({ error: 'Could not confirm your information' }, { status: 500 });
    }
    savedRow = { id: String(row.snapshot_id), confirmed_at: row.confirmed_at };
  } else {
    // Legacy global confirmation remains for callers that send no application
    // context. It is deliberately not available to application requests.
    const nowIsoLegacy = nowIso;
    const baseRow = {
      user_id: user.id,
      payload,
      schema_version: 2 as const,
      confirmed_at: nowIsoLegacy,
      payload_hash: payloadHash,
    };
    const inserted = await supabase
      .from('confirmed_candidate_snapshots')
      .insert(baseRow)
      .select('id, confirmed_at')
      .single();
    if (inserted.error || !inserted.data) {
      logger.error('candidate_confirmation', inserted.error, {
        userId: user.id,
        applicationId,
        stage: 'persisted',
        outcome: migrationMissing(inserted.error) ? 'migration_missing' : 'failed',
        durationMs: getElapsed(),
      });
      return NextResponse.json(
        { error: migrationMissing(inserted.error) ? 'Confirmation is not available yet. Please try again shortly.' : 'Could not confirm your information' },
        { status: migrationMissing(inserted.error) ? 503 : 500 },
      );
    }
    savedRow = inserted.data as { id: string; confirmed_at: string };
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
    if (applicationId) {
      logger.warn('candidate_confirmation', {
        userId: user.id,
        applicationId,
        stage: 'persisted',
        outcome: 'failed',
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
