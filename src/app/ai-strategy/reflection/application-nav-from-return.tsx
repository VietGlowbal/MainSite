import { ApplicationNav } from '@/components/application-nav';
import { applicationIdFromPath } from '@/shared/lib';
import { getServerIdentity } from '@/server/auth/server-identity';

/**
 * The brand-red application band for the reflection steps.
 *
 * ─── WHY THIS IS NOT JUST `<ApplicationNav applicationId={...}>` ─────────────
 *
 * The reflection steps live at `/ai-strategy/reflection`, not under
 * `/ai-strategy/[applicationId]`, so they are outside the layout that mounts
 * the band for every other strategy page — which is why they were the one
 * place in the flow with no breadcrumbs and no way back to the application a
 * student had just come from. They are shared by every application (the
 * answers write to `student_profiles`, not to one course), so there is no
 * `applicationId` in the path to read.
 *
 * What there is, when the student arrived from an application, is the
 * `?return=` parameter the onboarding router already builds — a path like
 * `/ai-strategy/<id>/strategy/analysis`. That is where the id comes from.
 *
 * ─── THE PARAMETER IS UNTRUSTED ──────────────────────────────────────────────
 *
 * It is a query string: anyone can put any id in it. So the id is not enough
 * on its own — this re-reads `course_applications` scoped to the signed-in
 * user and renders nothing unless the application is genuinely theirs. A
 * fabricated id would otherwise draw a real-looking nav bar for an
 * application that is not the student's, and confirm the id exists.
 *
 * Fetching the course name here rather than letting the band fall back to the
 * generic "Application" also makes the breadcrumb read the same as it does on
 * every other page of the flow.
 */
export async function ApplicationNavFromReturn({ returnTo }: { returnTo?: string | undefined }) {
  if (!returnTo) return null;

  const applicationId = applicationIdFromPath(returnTo);
  if (!applicationId) return null;

  const { supabase, identity: user } = await getServerIdentity();
  if (!user) return null;

  const { data: application } = await supabase
    .from('course_applications')
    .select('id, course_name')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Not this student's application (or not one at all) — no band, exactly as
  // before. Reflection is still perfectly usable without it; every other
  // entry point into these pages passes no `return` at all.
  if (!application) return null;

  return (
    <ApplicationNav
      applicationId={applicationId}
      userId={user.id}
      courseName={application.course_name}
    />
  );
}
