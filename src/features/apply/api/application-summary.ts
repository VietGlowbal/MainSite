import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The one-line "which application is this" label used by the reflection
 * flow's breadcrumb, its application-setup stepper, and the return-to
 * chrome on `/profile/*` editors opened from an application — e.g.
 * "Cambridge · Computer Science". Composed from `university_name` +
 * `course_name` when both are present (the common case), falling back to
 * whichever one exists so a still-parsing/partial application still gets a
 * usable label instead of nothing.
 */
export async function loadApplicationSummary(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string,
): Promise<{ label: string } | null> {
  const { data } = await supabase
    .from('course_applications')
    .select('id, course_name, university_name')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;

  const university = typeof data.university_name === 'string' ? data.university_name.trim() : '';
  const course = typeof data.course_name === 'string' ? data.course_name.trim() : '';
  const label = university && course ? `${university} · ${course}` : university || course;

  return label ? { label } : null;
}
