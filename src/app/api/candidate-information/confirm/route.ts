import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { loadCandidateReflection, verifiedApplicationId } from '@/features/apply/api';
import { candidateReadiness, candidateSnapshotPayloadSchema } from '@/features/apply/domain';

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

/**
 * Same shape of check the rest of this project uses for a column shipped
 * ahead of its migration — `42703`/`PGRST204` are PostgREST's two ways of
 * saying "that column doesn't exist", and `42P01` is Postgres's "that
 * relation doesn't exist".
 *
 * ⚠️ Deliberately does NOT match on the table/column name appearing anywhere
 * in the message. It used to, and that is exactly what turned a real
 * production incident into a silent dead end: an RLS policy gap made every
 * insert fail with `42501` (insufficient_privilege) — a permission error,
 * not a missing migration — but its message still names this table
 * ("new row violates row-level security policy for table
 * confirmed_candidate_snapshots"), so the loose regex matched anyway and
 * told a student to retry a request that could never succeed. Matching only
 * on `42703`/`PGRST204`/`42P01` plus an explicit "does not exist" phrase
 * means a permission error now falls through to the generic 500 instead —
 * still an error, but not a misleading one telling anybody to just wait.
 */
function migrationMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204' || error.code === '42P01') return true;
  return /does not exist/i.test(error.message ?? '');
}

const bodySchema = z.object({ applicationId: z.string().uuid().optional() });

export async function POST(request: Request) {
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

    return NextResponse.json({
      snapshotId: existing.data?.id ?? null,
      status: 'confirmed',
      confirmedAt,
    });
  }

  const readiness = candidateReadiness(reflection);
  if (!readiness.ready) {
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
  });

  const nowIso = new Date().toISOString();
  const baseRow = { user_id: user.id, payload, schema_version: 1, confirmed_at: nowIso };

  // Tag the snapshot with the application it was confirmed for, tolerant of
  // `application_id` not existing yet (supabase-per-application-onboarding.sql
  // not run) — retried without it rather than failing the whole
  // confirmation, same layered-retry shape `LATER_COLUMNS` uses in
  // `PATCH /api/reflection`.
  const withAppColumn = applicationId
    ? await supabase
        .from('confirmed_candidate_snapshots')
        .insert({ ...baseRow, application_id: applicationId })
        .select('id, confirmed_at')
        .single()
    : null;
  if (withAppColumn?.error && !migrationMissing(withAppColumn.error)) {
    console.error('[candidate-information/confirm] snapshot insert failed:', withAppColumn.error);
    return NextResponse.json({ error: 'Could not confirm your information' }, { status: 500 });
  }
  if (withAppColumn?.error) {
    console.warn(
      '[candidate-information/confirm] confirmed_candidate_snapshots.application_id is missing — run supabase-per-application-onboarding.sql. Saving without it.',
      withAppColumn.error.message,
    );
  }
  const inserted =
    withAppColumn && !withAppColumn.error
      ? withAppColumn
      : await supabase
          .from('confirmed_candidate_snapshots')
          .insert(baseRow)
          .select('id, confirmed_at')
          .single();

  if (inserted.error) {
    if (migrationMissing(inserted.error)) {
      console.error(
        '[candidate-information/confirm] confirmed_candidate_snapshots is missing — run supabase-candidate-confirmation.sql.',
        inserted.error.message,
      );
      return NextResponse.json(
        { error: 'Confirmation is not available yet. Please try again shortly.' },
        { status: 503 },
      );
    }
    console.error('[candidate-information/confirm] snapshot insert failed:', inserted.error);
    return NextResponse.json({ error: 'Could not confirm your information' }, { status: 500 });
  }

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
      console.error(
        '[candidate-information/confirm] could not set course_applications.candidate_confirmed_at — run supabase-per-application-onboarding.sql. Snapshot was saved but this application is not locked.',
        appLocked.error.message,
      );
    }
  }

  const locked = await supabase
    .from('student_profiles')
    .update({ confirmed_at: nowIso })
    .eq('user_id', user.id);

  if (locked.error) {
    if (migrationMissing(locked.error)) {
      // The snapshot exists, but the profile could not be locked — the next
      // GET will see `confirmedAt: null` and treat the student as still
      // editing, which is the same "degrades to the old behaviour" rule
      // every other column this project has shipped ahead of a migration
      // follows. It costs the lock, not the confirmation.
      console.error(
        '[candidate-information/confirm] student_profiles.confirmed_at is missing — run supabase-candidate-confirmation.sql. Snapshot was saved but the profile is not locked.',
        locked.error.message,
      );
      return NextResponse.json({
        snapshotId: inserted.data.id,
        status: 'confirmed',
        confirmedAt: inserted.data.confirmed_at,
      });
    }
    console.error('[candidate-information/confirm] lock failed:', locked.error);
    return NextResponse.json({ error: 'Could not confirm your information' }, { status: 500 });
  }

  return NextResponse.json({
    snapshotId: inserted.data.id,
    status: 'confirmed',
    confirmedAt: inserted.data.confirmed_at,
  });
}
