import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getOrCreateStrategy,
  getStructuredCv,
  getTargetProfile,
} from '@/features/application-strategy/api';
import { TargetProfileWorkspace } from '@/features/application-strategy/ui';

export const metadata: Metadata = {
  title: 'Target Profile | GlowBal',
  description: 'Define what your CV needs to prove for this programme.',
};

/**
 * CV step 1 — /ai-strategy/[applicationId]/cv/target-profile
 *
 * The layout above has established the session and ownership. This reads the
 * stored profile and hands it to the client workspace, which owns the editing.
 *
 * `hasProgrammeData` is resolved here rather than in the client because it needs
 * the joined course row, and shipping the whole application object to the browser
 * to answer one boolean would be sending a student's data somewhere it is not
 * needed.
 */
export default async function TargetProfilePage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: application } = await supabase
    .from('course_applications')
    .select('id, ai_summary, entry_requirements_summary, courses (course_summary, entry_requirements_summary)')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!application) notFound();

  const strategy = await getOrCreateStrategy(supabase, user.id, applicationId);
  const [targetProfile, cv] = await Promise.all([
    getTargetProfile(supabase, strategy.id),
    getStructuredCv(supabase, strategy.id),
  ]);

  /*
   * PostgREST types an embedded one-to-one join as an array, and returns it as an
   * object at runtime for a single row. Both shapes are handled rather than cast
   * away, because which one arrives depends on the generated types rather than on
   * anything visible here.
   */
  const joined = application.courses as unknown;
  const course = (Array.isArray(joined) ? joined[0] : joined) as Record<string, unknown> | null;

  const hasProgrammeData = Boolean(
    application.ai_summary ||
      application.entry_requirements_summary ||
      course?.course_summary ||
      course?.entry_requirements_summary,
  );

  return (
    <TargetProfileWorkspace
      applicationId={applicationId}
      initial={targetProfile}
      hasProgrammeData={hasProgrammeData}
      {...(cv && cv.sections.length > 0 ? { furthestStep: 'content' as const } : {})}
    />
  );
}
