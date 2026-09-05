import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { StatementWriter } from '@/components/statement/StatementWriter';
import { getServerIdentity } from '@/server/auth/server-identity';
import type { AIAnalysis } from '@/lib/types';
import { ICONS, KitIcon } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'Statement writer | GlowBal',
  description: 'Get line-by-line AI feedback on your personal statement or SOP.',
};

/**
 * `/ai-strategy/[applicationId]/statement` — the SOP / personal-statement tool,
 * scoped to one application.
 *
 * ─── WHY THIS ROUTE DID NOT EXIST ────────────────────────────────────────────
 *
 * `StatementWriter` was already built, already had an `application` save target,
 * and was already reachable two ways — full-page at `/my-universities/[id]/writer`
 * (against a saved university) and inside `StatementFeedbackModal` (against an
 * application). What was missing was an entry point from the Strategy, which is
 * where a student is actually told their statement needs work. The Dashboard's
 * "Personal Statement" category listed the tasks and offered no way to do them.
 *
 * `/demo-throwaway/overview` has been linking to exactly this path the whole
 * time, so the route was intended and simply never built.
 *
 * ─── WHY A PAGE AND NOT THE EXISTING MODAL ───────────────────────────────────
 *
 * `StatementFeedbackModal` exists and would have been less code. It is the wrong
 * shape here:
 *
 *   - It loads the draft client-side, so the student watches a spinner for a
 *     round trip this page can do during SSR.
 *   - A statement is a long editing session, not a glance. A modal cannot be
 *     linked to, cannot be bookmarked, loses the draft's place on a back
 *     gesture, and traps scroll on a page whose whole purpose is a big textarea.
 *   - The Dashboard's Help column and category board both need an href. A modal
 *     needs a client component holding open state, which would make every row of
 *     a server-rendered table into a client island.
 *
 * The modal stays where it is (inside the Apply journey, where the statement IS a
 * glance at one task). Both call the same component underneath.
 *
 * ─── OWNERSHIP ───────────────────────────────────────────────────────────────
 *
 * The `[applicationId]` layout above already resolved the session and rejected
 * an application belonging to someone else. This page still re-reads its own
 * slice rather than taking data from context — the documented precedent for
 * every page in this subtree (see that layout's header).
 *
 * The draft query is filtered on `user_id` as well as `application_id`, which is
 * belt-and-braces given the layout's check, but `personal_statements` is read
 * here with the user's own client and a row is cheap to scope. Two filters that
 * agree cost nothing; one that is missing is how a draft leaks.
 */
export default async function StrategyStatementPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;

  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect(`/auth?redirect=${encodeURIComponent(`/ai-strategy/${applicationId}/statement`)}`);

  const { data: application } = await supabase
    .from('course_applications')
    .select('course_name, university_name, ai_summary, entry_requirements_summary')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!application) notFound();

  /* Newest draft wins. `personal_statements` is append-capable rather than
     one-row-per-application, and the modal reads it the same way — ordering by
     updated_at is what makes the two entry points show the same draft instead of
     each finding a different row. */
  const { data: draft } = await supabase
    .from('personal_statements')
    .select('id, content, ai_analysis, doc_type')
    .eq('application_id', applicationId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const courseName = application.course_name ?? 'your course';
  const universityName = application.university_name ?? 'your university';

  /* What the course is looking for, so the AI is not critiquing the statement in
     a vacuum. The course-level summary is preferred over the entry requirements:
     a statement is judged on fit and motivation, and the requirements text is
     grades and English scores, which a statement cannot change. */
  const contextNote = application.ai_summary ?? application.entry_requirements_summary ?? null;

  const docType = (draft?.doc_type as 'personal_statement' | 'statement_of_purpose' | null) ?? null;

  /* h-dvh, not h-screen: on mobile Safari `100vh` is the viewport WITHOUT the
     browser chrome, so a full-height flex column ends up taller than what is
     actually visible and the writer's own footer sits under the address bar.
     StatementWriter's non-embedded layout expects a bounded flex parent. */
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-surface">
      <header className="flex shrink-0 flex-wrap items-center gap-gb-lg border-b border-line px-gb-2xl py-gb-lg">
        <Link
          href={`/ai-strategy/${applicationId}/strategy/dashboard`}
          className="inline-flex items-center gap-gb-xs text-gb-sm text-fg-tertiary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowLeft} frame={16} className="shrink-0" />
          Back to strategy
        </Link>
        <span aria-hidden="true" className="h-gb-xl w-px bg-line" />
        <div className="min-w-0">
          <h1 className="truncate text-gb-sm font-semibold text-fg">Statement writer</h1>
          <p className="truncate text-gb-xs text-fg-tertiary">
            {courseName} · {universityName}
          </p>
        </div>
      </header>

      <StatementWriter
        saveTarget={{ kind: 'application', applicationId }}
        targetName={`${courseName}, ${universityName}`}
        contextNote={contextNote}
        initialContent={draft?.content ?? ''}
        initialAnalysis={(draft?.ai_analysis as AIAnalysis | null) ?? null}
        statementId={(draft?.id as number | null) ?? null}
        {...(docType ? { initialDocType: docType } : {})}
      />
    </main>
  );
}
