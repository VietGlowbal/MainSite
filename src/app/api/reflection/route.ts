import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { verifiedApplicationId } from '@/features/apply/api';
import {
  aboutYouSchema,
  achievementSchema,
  activitySchema,
  aspirationsSchema,
  profileUpdateFromReflection,
} from '@/features/apply/domain';

/**
 * PATCH /api/reflection
 *
 * Saves one step of the candidate-information flow. Both steps post here and
 * each sends only its own slice, so a student is never blocked by a field two
 * screens away — the same reason the schemas are split per step rather than
 * validated as one object.
 *
 * The step-1 fields land on `student_profiles`; achievements and activities are
 * their own tables (supabase-reflection.sql), because they repeat.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const aboutPayload = aboutYouSchema.merge(aspirationsSchema);

/**
 * Is this error "that column does not exist yet"?
 *
 * Same shape as the check `match-insights/route.ts` already uses: PostgREST
 * reports an unknown column as `42703` on the SQL side or `PGRST204` from its
 * own schema cache, and the message names the column either way.
 */
function migrationMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        /study_motivation|subject_motivations|target_intake/i.test(error.message ?? '')),
  );
}

/**
 * The columns added after the base schema, in the order they were added.
 *
 * Dropped together on a migration-missing retry rather than one at a time: the
 * error names only the first column PostgREST tripped over, so retrying
 * without that one alone just fails again on the next.
 */
const LATER_COLUMNS = ['study_motivation', 'subject_motivations', 'target_intake'] as const;

/**
 * `supabase-reflection-review-status.sql`'s three columns, shared by both
 * `student_achievements` and `student_activities` — same names, same retry.
 */
const REVIEW_COLUMNS = ['review_status', 'source_type', 'sources'] as const;

/** A shallow copy of `row` without the given keys. */
function omit<T extends Record<string, unknown>>(row: T, keys: readonly string[]): Partial<T> {
  const next: Partial<T> = { ...row };
  for (const key of keys) delete next[key as keyof T];
  return next;
}

const bodySchema = z.object({
  about: aboutPayload.optional(),
  achievements: z.array(achievementSchema).max(20).optional(),
  activities: z.array(activitySchema).max(20).optional(),
  /**
   * The application this edit is being made in the context of — derived by
   * the reflection pages from their own `?return=` param
   * (`applicationIdFromPath`), NOT trusted as-is: this route re-verifies
   * ownership below before using it for anything. Omitted by the legacy,
   * non-application-scoped entry points, which keep today's global-lock
   * behaviour.
   */
  applicationId: z.string().uuid().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid reflection payload', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { about, achievements, activities } = parsed.data;
  const applicationId = await verifiedApplicationId(supabase, user.id, parsed.data.applicationId);

  /*
   * Locked once confirmed (POST /api/candidate-information/confirm) — a
   * confirmed record is exactly the version of the student's information
   * reports were generated from, and letting an edit through here would make
   * "this is what your reports were built from" (the read-only reflection
   * pages) false.
   *
   * PER-APPLICATION, not global: an application id is present whenever this
   * edit came from the normal onboarding flow, and it is THAT application's
   * own `course_applications.candidate_confirmed_at` that decides the lock —
   * confirming application B must not block editing for a later, still-
   * unconfirmed application C. Only when no application id is resolvable
   * (the legacy, non-application-scoped entry points) does this fall back to
   * the old global `student_profiles.confirmed_at` check, unchanged.
   *
   * Missing the column (migration not run yet) is read as "not locked", the
   * same fail-open every other tolerant read in this route already uses —
   * server enforcement matters once the column exists; a student cannot be
   * blocked by a lock the deployment does not have yet.
   */
  if (applicationId) {
    const lock = await supabase
      .from('course_applications')
      .select('candidate_confirmed_at')
      .eq('id', applicationId)
      .maybeSingle();
    if (!lock.error && lock.data?.candidate_confirmed_at) {
      return NextResponse.json(
        {
          error: 'PROFILE_LOCKED',
          message: 'This profile has already been confirmed.',
        },
        { status: 423 },
      );
    }
  } else {
    const lock = await supabase
      .from('student_profiles')
      .select('confirmed_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!lock.error && lock.data?.confirmed_at) {
      return NextResponse.json(
        {
          error: 'PROFILE_LOCKED',
          message: 'This profile has already been confirmed.',
        },
        { status: 423 },
      );
    }
  }

  if (about) {
    const update = profileUpdateFromReflection(about);
    // `personal_summary_completed_at` is what `fetchOnboardingState` reads as
    // `personalSummaryComplete` (see supabase-strategy-onboarding-state.sql
    // and domain/onboarding.ts) — without setting it here, submitting this
    // step never actually completes it, so a student can never advance past
    // `personal-summary` no matter how many times they submit. See
    // docs/known-issues.md §5g.
    const row: Record<string, unknown> = {
      user_id: user.id,
      ...update,
      personal_summary_completed_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('student_profiles')
      .upsert(row, { onConflict: 'user_id' });

    if (error && migrationMissing(error)) {
      /*
       * `supabase-reflection-questions.sql` and/or
       * `supabase-reflection-subject-motivations.sql` have not been run yet.
       *
       * This project has a standing habit of shipping code ahead of its
       * migrations (docs/known-issues.md §0d–§0f are all instances), and the
       * columns those questions write are the only new ones here. Failing the
       * whole request would mean a student loses their nationality, GPA and
       * budget — everything on the step — because of three optional answers.
       * So the save is retried without them: the student keeps the answers
       * that have somewhere to go, and the newer questions start persisting
       * the moment the migration lands, with no code change.
       */
      console.warn(
        `[reflection] ${LATER_COLUMNS.join('/')} missing — run supabase-reflection-questions.sql and supabase-reflection-subject-motivations.sql. Saving the rest.`,
      );
      const withoutNewColumns = { ...row };
      for (const column of LATER_COLUMNS) delete withoutNewColumns[column];
      const retry = await supabase
        .from('student_profiles')
        .upsert(withoutNewColumns, { onConflict: 'user_id' });

      if (retry.error) {
        console.error('[reflection] profile upsert failed:', retry.error);
        return NextResponse.json({ error: 'Could not save your information' }, { status: 500 });
      }
    } else if (error) {
      console.error('[reflection] profile upsert failed:', error);
      return NextResponse.json({ error: 'Could not save your information' }, { status: 500 });
    }

    // Per-application companion to the global stamp above — what
    // `fetchOnboardingState` actually reads for THIS application (see
    // onboarding-status.ts). Best-effort: a failure here (e.g. the migration
    // not run yet) must not fail a save that already succeeded against the
    // shared profile.
    if (applicationId) {
      const stamped = await supabase
        .from('course_applications')
        .update({ personal_summary_reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);
      if (stamped.error) {
        console.warn(
          '[reflection] could not stamp personal_summary_reviewed_at — run supabase-per-application-onboarding.sql.',
          stamped.error.message,
        );
      }
    }
  }

  /*
   * Replace-in-full rather than diff. The form owns the whole list — a row the
   * student deleted has to disappear, and matching up ids to work out which
   * ones those were is more moving parts than re-writing a set that is capped
   * at twenty. Delete-then-insert is safe here because the delete is scoped to
   * this user and both statements are their own round trip: a failure leaves
   * the student with an empty list they can refill, not a merged one they
   * cannot untangle.
   */
  if (achievements) {
    await supabase.from('student_achievements').delete().eq('user_id', user.id);
    if (achievements.length > 0) {
      const rows = achievements.map((item) => ({
        user_id: user.id,
        category: item.category,
        title: item.title,
        competition: item.competition ?? null,
        organisation: item.organisation ?? null,
        level: item.level ?? null,
        year: item.year ?? null,
        detail: item.detail ?? null,
        evidence_key: item.evidenceKey ?? null,
        review_status: item.reviewStatus ?? null,
        source_type: item.sourceType ?? null,
        sources: item.sources ?? null,
      }));
      const { error } = await supabase.from('student_achievements').insert(rows);

      if (error && migrationMissing(error)) {
        console.warn(
          `[reflection] ${REVIEW_COLUMNS.join('/')} missing on student_achievements — run supabase-reflection-review-status.sql. Saving without review status.`,
        );
        const stripped = rows.map((row) => omit(row, REVIEW_COLUMNS));
        const retry = await supabase.from('student_achievements').insert(stripped);
        if (retry.error) {
          console.error('[reflection] achievements insert failed:', retry.error);
          return NextResponse.json({ error: 'Could not save your achievements' }, { status: 500 });
        }
      } else if (error) {
        console.error('[reflection] achievements insert failed:', error);
        return NextResponse.json({ error: 'Could not save your achievements' }, { status: 500 });
      }
    }
  }

  if (activities) {
    await supabase.from('student_activities').delete().eq('user_id', user.id);
    if (activities.length > 0) {
      const rows = activities.map((item) => ({
        user_id: user.id,
        category: item.category,
        title: item.title,
        organisation: item.organisation ?? null,
        level: item.level ?? null,
        period: item.period ?? null,
        description: item.description ?? null,
        review_status: item.reviewStatus ?? null,
        source_type: item.sourceType ?? null,
        sources: item.sources ?? null,
      }));
      const { error } = await supabase.from('student_activities').insert(rows);

      if (error && migrationMissing(error)) {
        console.warn(
          `[reflection] ${REVIEW_COLUMNS.join('/')} missing on student_activities — run supabase-reflection-review-status.sql. Saving without review status.`,
        );
        const stripped = rows.map((row) => omit(row, REVIEW_COLUMNS));
        const retry = await supabase.from('student_activities').insert(stripped);
        if (retry.error) {
          console.error('[reflection] activities insert failed:', retry.error);
          return NextResponse.json({ error: 'Could not save your activities' }, { status: 500 });
        }
      } else if (error) {
        console.error('[reflection] activities insert failed:', error);
        return NextResponse.json({ error: 'Could not save your activities' }, { status: 500 });
      }
    }
  }

  // Same completion-flag gap as `about` above, for step 2. Requirement 4.3
  // explicitly allows an empty achievements/activities list to still count as
  // "done" — the student having submitted the step is what completes it, not
  // the list having entries — so this fires whenever either key was sent,
  // regardless of length. `reflection-evidence-form.tsx` always sends both
  // together, but this does not assume that.
  if (achievements !== undefined || activities !== undefined) {
    const { error } = await supabase.from('student_profiles').upsert(
      { user_id: user.id, achievements_completed_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) {
      console.error('[reflection] achievements-completion upsert failed:', error);
      return NextResponse.json({ error: 'Could not save your achievements' }, { status: 500 });
    }

    // Per-application companion — see the identical note on the "about"
    // step above.
    if (applicationId) {
      const stamped = await supabase
        .from('course_applications')
        .update({ achievements_reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);
      if (stamped.error) {
        console.warn(
          '[reflection] could not stamp achievements_reviewed_at — run supabase-per-application-onboarding.sql.',
          stamped.error.message,
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
