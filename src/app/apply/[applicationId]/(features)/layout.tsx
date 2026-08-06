import { redirect } from 'next/navigation';
import { ApplicationNav } from '@/components/application-nav';
import { createClient } from '@/lib/supabase/server';

/**
 * Shell for the `/apply/[applicationId]` feature pages — CV builder, CV review,
 * the CV hub and the statement workspace.
 *
 * ─── WHY A ROUTE GROUP ───────────────────────────────────────────────────────
 *
 * The context bar has to be on all six of an application's destinations or it
 * is not navigation, it is decoration on four of them: two of the six sat under
 * `/apply` with no bar at all, so a student who opened the CV builder had one
 * way out of it (the browser's Back button) and nothing on screen saying the
 * Statement or the reports existed.
 *
 * It cannot go in `src/app/apply/[applicationId]/layout.tsx`, because that also
 * wraps the Overview page — and Overview ships its own TopNav *inside* the page
 * (it is the one `/apply` route suppressed in nav-reveal.tsx), so a bar mounted
 * above it would land above that header rather than below it. A route group
 * covers exactly the four children that take the shared app header, changes no
 * URL, and leaves Overview to keep passing the bar into its own chrome.
 *
 * `lor-feedback` is deliberately outside the group: it is not one of the six
 * entries, so a bar with nothing highlighted would say less than no bar.
 *
 * ─── WHAT IT DOES AND DOES NOT CHECK ─────────────────────────────────────────
 *
 * Signed-out is redirected here so the band never renders for a stranger, but
 * ownership of `applicationId` is left to each page: they already run that check
 * with the data they need (`fetchApplicationWorkspace`, `loadCvBuilderContext`)
 * and `notFound()` on a miss. `ApplicationNav` reads only this user's own rows,
 * so it cannot leak a foreign application while the page resolves.
 */
export default async function ApplicationFeatureLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/apply/${applicationId}`)}`);

  const { data: application } = await supabase
    .from('course_applications')
    .select('course_name')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    /* bg-surface, so the page below the band is white regardless of what the
       individual workspace paints — the site background is #F5F6FF and a red
       band butting onto lilac reads as an unfinished gradient. */
    <div className="bg-surface">
      <ApplicationNav
        applicationId={applicationId}
        {...(application?.course_name ? { courseName: application.course_name } : {})}
      />
      {children}
    </div>
  );
}
