import { redirect } from 'next/navigation';
import { ApplicationNav } from '@/components/application-nav';
import { getServerIdentity } from '@/server/auth/server-identity';

/**
 * Shell for the `/apply/[applicationId]` feature pages — CV builder, CV review,
 * the CV hub, the statement workspace, and the LOR workspace.
 *
 * ─── WHY A ROUTE GROUP ───────────────────────────────────────────────────────
 *
 * The context bar has to be on all of an application's destinations or it
 * is not navigation, it is decoration on some of them: pages under `/apply`
 * need the shared context bar so a student always has access to the full
 * application journey and reports.
 *
 * It cannot go in `src/app/apply/[applicationId]/layout.tsx`, because that also
 * wraps the Overview page — and Overview ships its own TopNav *inside* the page
 * (it is the one `/apply` route suppressed in nav-reveal.tsx), so a bar mounted
 * above it would land above that header rather than below it. A route group
 * covers the children that take the shared app header, changes no
 * URL, and leaves Overview to keep passing the bar into its own chrome.
 *
 * `lor-feedback` is included in the group and highlighted in `ApplicationNav`
 * as the LOR Support destination.
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

  const { supabase, identity: user } = await getServerIdentity();

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
        userId={user.id}
        {...(application?.course_name ? { courseName: application.course_name } : {})}
      />
      {children}
    </div>
  );
}
