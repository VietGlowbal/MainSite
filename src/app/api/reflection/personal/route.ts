import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifiedApplicationId } from '@/features/apply/api';
import { personalReflectionSchema } from '@/features/apply/domain';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/reflection/personal
 *
 * Saves the seven cross-cutting Personal Reflection answers — see
 * `src/features/apply/domain/personal-reflection.ts`. Global and reusable
 * across every application, like achievements, so this writes
 * `student_profiles.personal_reflection_answers` (never a per-application
 * copy) and stamps `personal_reflection_completed_at` (global) plus
 * `course_applications.personal_reflection_reviewed_at` (per-application),
 * mirroring the "about" and achievements steps in `/api/reflection`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  answers: personalReflectionSchema,
  applicationId: z.string().uuid().optional(),
});

/** Same "column does not exist yet" check every writer in this feature uses. */
function migrationMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === '42703' ||
        error.code === 'PGRST204' ||
        /personal_reflection/i.test(error.message ?? '')),
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid personal reflection payload', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const applicationId = await verifiedApplicationId(supabase, user.id, parsed.data.applicationId);

  // Same per-application-first, global-fallback lock check as PATCH /api/reflection.
  if (applicationId) {
    const lock = await supabase
      .from('course_applications')
      .select('candidate_confirmed_at')
      .eq('id', applicationId)
      .maybeSingle();
    if (!lock.error && lock.data?.candidate_confirmed_at) {
      return NextResponse.json(
        { error: 'PROFILE_LOCKED', message: 'This profile has already been confirmed.' },
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
        { error: 'PROFILE_LOCKED', message: 'This profile has already been confirmed.' },
        { status: 423 },
      );
    }
  }

  const now = new Date().toISOString();
  const row = {
    user_id: user.id,
    personal_reflection_answers: parsed.data.answers,
    personal_reflection_completed_at: now,
  };
  const { error } = await supabase.from('student_profiles').upsert(row, { onConflict: 'user_id' });

  if (error && migrationMissing(error)) {
    console.warn(
      '[reflection/personal] personal_reflection_* columns missing — run supabase-application-experience-flow.sql.',
      error.message,
    );
    return NextResponse.json(
      { error: 'Personal reflection is not enabled yet. Please try again later.' },
      { status: 503 },
    );
  }
  if (error) {
    console.error('[reflection/personal] upsert failed:', error);
    return NextResponse.json({ error: 'Could not save your reflection' }, { status: 500 });
  }

  if (applicationId) {
    const stamped = await supabase
      .from('course_applications')
      .update({ personal_reflection_reviewed_at: now })
      .eq('id', applicationId);
    if (stamped.error) {
      console.warn(
        '[reflection/personal] could not stamp personal_reflection_reviewed_at — run supabase-application-experience-flow.sql.',
        stamped.error.message,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
