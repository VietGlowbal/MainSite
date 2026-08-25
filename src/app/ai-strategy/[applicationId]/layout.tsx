import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ApplicationNav } from '@/components/application-nav';
import { isPlusEntitlementActive } from '@/lib/entitlements/entitlement-service';
import { createClient } from '@/lib/supabase/server';
import { PRIVATE_ROBOTS } from '@/lib/seo/indexability';
import { ReflectionChrome } from '../reflection-chrome';

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

/**
 * Shell for every `/ai-strategy/[applicationId]/*` page (the AI Strategy
 * Dashboard feature — see .kiro/specs/ai-strategy-dashboard/).
 *
 * Resolves the session and the ownership check exactly once, the same
 * decision Feature 2's design.md documents for the sibling CV/Statement
 * workspace: `/ai-strategy` ships its own chrome (nav-reveal.tsx suppresses
 * the app shell for this subtree), so every page under here needs it, and an
 * `applicationId` that is not this student's own must 404 rather than reveal
 * that it exists.
 *
 * Each page still re-reads its own slice of `course_applications` — this
 * layout does not thread data down via context, matching the same precedent.
 *
 * ─── THE GLOWBAL PLUS PAYWALL LIVES HERE (owner, 17/08) ──────────────────────
 *
 * The comment at the top of `/ai-strategy/page.tsx` had been saying since
 * 01/08 that the paywall belongs "on the Strategy, after the application
 * stage, not before it" — every AI report and the planner for a SPECIFIC
 * application, reached only once a student opens one from My Portal
 * ("Continue applying" → `/apply/[applicationId]` → here). The two
 * user-level, not-application-scoped reports (`/ai-strategy/personal-report`,
 * `/ai-strategy/matching`) and every reflection page stay free — this layout
 * doesn't wrap them. One check here covers the whole subtree instead of
 * repeating it per page.
 *
 * `/plus?application=` is pre-built for exactly this redirect: it renders a
 * "back to your application" link once the student is entitled, so this
 * layout doesn't need its own return-trip plumbing.
 */
export default async function StrategyApplicationLayout({
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

  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/ai-strategy/${applicationId}/strategy`)}`);

  const [{ data: application }, { data: profile }] = await Promise.all([
    supabase
      .from('course_applications')
      .select('id, course_name')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('student_profiles')
      .select('plus_status, plus_expires_at, is_admin')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!application) notFound();

  if (!isPlusEntitlementActive(profile ?? {})) {
    redirect(`/plus?application=${encodeURIComponent(applicationId)}`);
  }

  return (
    /*
     * The context bar sits above every strategy page rather than inside each
     * one. These screens are reached through a redirect chain and then rarely
     * again — the reports especially — so the one thing they all needed was a
     * permanent statement of where you are and what else belongs to this
     * application. Mounting it here is also what stops six pages each growing
     * their own slightly different version.
     *
     * It goes in the chrome's `nav` slot, not in `children`: the band is
     * full-bleed and brings its own measure, and `children` is rendered inside
     * a `max-w-4xl` Container.
     */
    <ReflectionChrome
      user={user}
      nav={<ApplicationNav applicationId={applicationId} courseName={application.course_name} />}
    >
      {children}
    </ReflectionChrome>
  );
}
