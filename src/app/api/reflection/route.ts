import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
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

const bodySchema = z.object({
  about: aboutPayload.optional(),
  achievements: z.array(achievementSchema).max(20).optional(),
  activities: z.array(activitySchema).max(20).optional(),
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

  if (about) {
    const update = profileUpdateFromReflection(about);
    const { error } = await supabase
      .from('student_profiles')
      .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' });

    if (error) {
      console.error('[reflection] profile upsert failed:', error);
      return NextResponse.json({ error: 'Could not save your information' }, { status: 500 });
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
      const { error } = await supabase.from('student_achievements').insert(
        achievements.map((item) => ({
          user_id: user.id,
          category: item.category,
          title: item.title,
          competition: item.competition ?? null,
          organisation: item.organisation ?? null,
          level: item.level ?? null,
          year: item.year ?? null,
          detail: item.detail ?? null,
          evidence_key: item.evidenceKey ?? null,
        })),
      );
      if (error) {
        console.error('[reflection] achievements insert failed:', error);
        return NextResponse.json({ error: 'Could not save your achievements' }, { status: 500 });
      }
    }
  }

  if (activities) {
    await supabase.from('student_activities').delete().eq('user_id', user.id);
    if (activities.length > 0) {
      const { error } = await supabase.from('student_activities').insert(
        activities.map((item) => ({
          user_id: user.id,
          category: item.category,
          title: item.title,
          organisation: item.organisation ?? null,
          level: item.level ?? null,
          period: item.period ?? null,
          description: item.description ?? null,
        })),
      );
      if (error) {
        console.error('[reflection] activities insert failed:', error);
        return NextResponse.json({ error: 'Could not save your activities' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
