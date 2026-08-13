'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  courseUrlLabel,
  deadlineUrgency,
  displayCourseName,
  displayUniversityName,
  isParsePending,
} from '@/features/apply/workspace-domain';
import type { DeadlineTone } from '@/features/apply/workspace-domain';
import { ResearchingInline } from '@/features/apply/tracker-ui';
import type { CourseApplication } from '@/lib/apply-types';
import { useT } from '@/lib/i18n';
import { Avatar } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { ICONS, KitIcon } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/input';
import { Modal } from '@/shared/ui/modal';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { ScoreRing } from '@/shared/ui/score-ring';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { ApplySectionHeading } from './section-heading';

/**
 * "My application" — the applications tracker. A SECTION, not a page: it renders
 * at the top of `ApplicationProgressClient`, above the saved list, and ships no
 * chrome of its own.
 *
 * Figma 562:15386 inside 562:15078 ("Trang lưu"), the frame that merges the
 * tracker and the saved list into one screen. That block is unchanged from the
 * standalone 337:18767 / 375:12975 this file was built against — same 680px
 * list of three 184px rows — so everything below carries over; only the heading
 * above it grew (562:15387, h98 vs h86).
 *
 * Where this departs from the frame, and why:
 *
 * Where this departs from the frame, and why:
 *
 *  1. THE SUPPORTING LINE IS REWRITTEN. The frame reads "Explore 10,000+
 *     universities worldwide and find your perfect fit." — the subtitle from the
 *     university search page, left on the layer when this screen was duplicated
 *     from it. On a list of the student's own in-flight applications it is not
 *     just off-tone, it is untrue. Replaced with copy that describes the page.
 *     Same call as the "Remote" pin on the saved list.
 *
 *  2. THE PIN SHOWS THE COUNTRY. The frame's details line is
 *     [pin "Remote"][clock deadline], "Remote" being leftover text from the kit's
 *     job-post card that both this row and the saved-list row are instances of.
 *     course_applications has a country column and no city column, so country
 *     goes on the pin, exactly as on the saved list.
 *
 *  3. THE CREST FALLS BACK TO INITIALS. The frame draws a university mark on
 *     every row. Current application creation and the scheduled reconciler
 *     attach `university_id`, but a transient resolution miss or failed image
 *     request must still render `Avatar`'s initials rather than a broken box.
 *
 *  4. DEADLINE IS OPTIONAL. The frame prints "14 Jan 2026" on all three rows.
 *     Only 7 of 29 live rows have a deadline at all, so the block collapses to
 *     "No deadline set" instead of inventing one.
 *
 *  5. THERE IS NO IMPORTER, AND THE FRAME IS RIGHT ABOUT THAT. This section used
 *     to carry a paste-a-course-URL bar, on the reasoning that the frame drew no
 *     way to add an application and removing it would leave a dead end. The
 *     owner confirmed on 01/08 that the frame is the intent: applications are
 *     created from the saved list below — tick a university, attach a
 *     scholarship if there is one, press "Plan my application" — and this
 *     section is a read-only view of what that produced. The bar, the
 *     CourseSearchSessionModal it shared the page with, and the
 *     ?openCourseSearch entry point all went with it. See
 *     app/api/applications/from-saved-university/route.ts.
 *
 *  6. NO MOBILE FRAME EXISTS for this page — the only 375-wide frames in the file
 *     are the three nav menus. The row reflows here: the gauge and deadline drop
 *     under the text block below `lg`.
 *
 *  7. THE DEADLINE IS BANDED. The frame prints all three dates in one grey,
 *     which a mockup can afford and a nine-row live list cannot — see
 *     features/apply/domain/deadline.ts. Rose inside a fortnight, amber inside a
 *     month, grey beyond, struck through once it has passed.
 *
 * Colour, added 01/08 after the owner called the page boring: the heading is
 * Rose/600 with the globe mark the frame draws beside it (both were missing —
 * see section-heading.tsx), and the row answers the pointer. The hover state is
 * NOT in the frame: Figma draws one resting state per row and has no notion of
 * a cursor, so a list whose rows lead somewhere has to say so itself.
 *
 * Dropped from the previous dashboard because the frame does not draw them and
 * they were not load-bearing: the overview stat card, the upcoming-deadlines
 * card, the mentor and "improve your profile" promos and the trial banner. All
 * of it is in git history at apply-dashboard.tsx.
 *
 * ⚠️ That list used to name the shortlist section too, on the grounds that
 * `user_universities` "does not exist on the database". It does — ten columns,
 * verified live, `program` and `program_url` included. The saved list it fed is
 * now the section directly below this one.
 */

/* ─────────────────────────────────────────────────────────────────────────
   Waiting for the parse

   Both the polling and the placeholder rule now live in the feature (hooks/
   use-parse-refresh and domain/course-name) so that the list and the per-course
   workspace behave identically. They previously lived only here, which is why
   the workspace shipped with neither: it printed the placeholder as its <h1>
   and never refreshed itself when the parse landed.
   ───────────────────────────────────────────────────────────────────────── */

/** "14 Jan 2026" — the frame's format. Fixed locale so it cannot drift on hydration. */
function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The date itself, banded. See departure (7) in the header. */
const DEADLINE_TEXT: Record<DeadlineTone, string> = {
  passed: 'text-fg-muted line-through',
  urgent: 'text-brand',
  soon: 'text-fg',
  normal: 'text-fg-tertiary',
};

/**
 * The countdown under the date.
 *
 * Every string here is a static dictionary key and the number is its own text
 * node, for the reason the saved list's scholarship bar documents at length:
 * /apply is a PII route, machine translation is off, and an interpolated
 * "3 days left" could never be a dictionary hit.
 */
function DeadlineCountdown({ tone, days }: { tone: DeadlineTone; days: number }) {
  if (tone === 'passed') {
    return <span className="text-gb-sm font-medium text-fg-muted">Deadline passed</span>;
  }
  if (days === 0) {
    return <span className="text-gb-sm font-semibold text-brand">Due today</span>;
  }

  const colour =
    tone === 'urgent' ? 'text-brand' : tone === 'soon' ? 'text-fg-secondary' : 'text-fg-muted';

  return (
    <span className={`text-gb-sm font-medium ${colour}`}>
      {days} <span>{days === 1 ? 'day left' : 'days left'}</span>
    </span>
  );
}

function isPending(app: CourseApplication): boolean {
  return isParsePending(app.parseStatus);
}

function courseLine(app: CourseApplication): string | null {
  return displayCourseName(app.courseName, app.parseStatus);
}

/** Retry control for a row whose parse failed. Wired to a route that had no caller. */
function RetryParse({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  useLoadingIndicator(retrying, 'Reading the course page');

  return (
    <div className="flex flex-col gap-gb-xs">
      <button
        type="button"
        disabled={retrying}
        onClick={async () => {
          setRetrying(true);
          setError('');
          try {
            const res = await fetch(`/api/applications/${applicationId}/retry-parse`, {
              method: 'POST',
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(
                res.status === 429
                  ? 'Too many attempts just now. Try again in an hour.'
                  : (body.error ?? 'Could not start another attempt.'),
              );
              return;
            }
            router.refresh();
          } catch {
            setError('Could not reach the server.');
          } finally {
            setRetrying(false);
          }
        }}
        className="self-start text-gb-sm font-semibold text-brand hover:text-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {retrying ? 'Trying again…' : 'Try again'}
      </button>
      {error ? <span className="text-gb-sm text-fg-error">{error}</span> : null}
    </div>
  );
}

/**
 * "Delete" — removes an application permanently.
 *
 * A real DELETE, not the `status: 'archived'` soft-delete the schema already
 * has a column for (see `supabase-schema.sql`'s `course_applications.status`
 * CHECK) — nothing in this codebase ever writes that value, and reusing it
 * here would be inventing a whole archive/unarchive feature nobody asked
 * for. Every child row is `ON DELETE CASCADE` off `course_applications.id`
 * (stages, tasks, the Personal Report, Matching Report, Personalized
 * Strategy report, recommendations, CV/statement strategy work), so this one
 * confirmation genuinely means "and everything built for it" — the copy
 * below says so rather than implying a quieter action than what happens.
 */
function DeleteApplicationButton({ applicationId, label }: { applicationId: string; label: string }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  useLoadingIndicator(deleting, 'Deleting your application');

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? t('Could not delete that application.'));
        setDeleting(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(t('Could not reach the server. Please try again.'));
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gb-xs font-semibold text-fg-error hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t('Delete')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={t('Delete application')}>
        <div className="flex flex-col gap-gb-xl">
          <h2 className="text-gb-lg font-semibold text-fg">{t('Delete this application?')}</h2>
          <p className="text-gb-sm text-fg-tertiary">
            {t(
              'This permanently removes {label} and everything built for it — your checklist, reports, and any CV or statement work done for this course. This cannot be undone.',
              { label },
            )}
          </p>
          {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}
          <div className="flex justify-end gap-gb-lg">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
              {t('Cancel')}
            </Button>
            <Button variant="secondary-destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? t('Deleting…') : t('Delete application')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/**
 * "Add another course" — a second, independent application at a university
 * the student already has one with.
 *
 * `from-saved-university` (the "Plan my application" path) cannot do this:
 * `user_universities` has `UNIQUE(user_id, university_id)` and a single
 * `program` column, so a saved university only ever holds one subject at a
 * time. `/api/applications/from-course-url` has no such limit — its
 * duplicate check is `(user_id, course_url)`, not university — so pasting a
 * second course's page here creates a genuinely separate `course_applications`
 * row, tracked on its own, without touching the saved-list model at all.
 */
function AddCourseButton({
  universityId,
  universityLabel,
}: {
  universityId: number;
  universityLabel: string;
}) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  useLoadingIndicator(submitting, 'Adding your course');

  async function submit() {
    if (!url.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/applications/from-course-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseUrl: url.trim(), universityId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body.duplicate) {
          setError(t('You already have an application for that course.'));
        } else if (res.status === 403) {
          setError(body.error ?? t('You have reached the number of courses your plan allows.'));
        } else {
          setError(body.error ?? t('We could not add that course. Please try again.'));
        }
        setSubmitting(false);
        return;
      }
      setOpen(false);
      setUrl('');
      router.refresh();
    } catch {
      setError(t('Could not reach the server. Please try again.'));
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gb-xs font-semibold text-fg-tertiary transition-colors hover:text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t('Add another course')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label={t('Apply to another course')}>
        <div className="flex flex-col gap-gb-xl">
          <h2 className="text-gb-lg font-semibold text-fg">
            {t('Apply to another course at {university}', { university: universityLabel })}
          </h2>
          <p className="text-gb-sm text-fg-tertiary">
            {t(
              'Paste the course page and we will track it as its own application, alongside the one you already have here.',
            )}
          </p>
          <Input
            name="anotherCourseUrl"
            label={t('Course page')}
            placeholder="https://university.edu/programmes/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            {...(error ? { error } : {})}
          />
          <div className="flex justify-end gap-gb-lg">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
              {t('Cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={submitting || !url.trim()}>
              {submitting ? t('Adding…') : t('Add course')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** Figma 337:18787 — one application row. */
function ApplicationRow({
  app,
  logoUrl,
  strategyReady,
}: {
  app: CourseApplication;
  logoUrl: string | null;
  /** False until the AI analysis is done — see `RowQuickLinks`. */
  strategyReady: boolean;
}) {
  const router = useRouter();
  const course = courseLine(app);
  const university = displayUniversityName(app.universityName);
  const urlLabel = courseUrlLabel(app.courseUrl);
  const pending = isPending(app);
  const failed = app.parseStatus === 'failed' || app.parseStatus === 'timeout';
  const urgency = deadlineUrgency(app.deadline);
  const workspaceHref = `/apply/${app.id}`;

  return (
    <li className="group relative flex flex-col gap-gb-3xl overflow-hidden rounded-gb-2xl border border-line bg-surface p-gb-xl transition duration-200 hover:-translate-y-gb-xxs hover:border-gb-brand-300 hover:shadow-gb-lg lg:flex-row lg:items-center lg:justify-between">
      {/*
        The rose rail that unrolls on hover. Purely an affordance: the whole row
        is a link target in everything but markup (the CTA is the accessible
        one), and a bordered rectangle that does nothing on approach is what
        made the list read as a table.
      */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-gb-xs origin-top scale-y-0 bg-brand transition-transform duration-200 group-hover:scale-y-100 motion-reduce:transition-none"
      />

      {/* Figma 337:18790 "_Job post" */}
      <div className="flex min-w-0 flex-1 items-center gap-gb-2xl">
        <Avatar
          name={university ?? urlLabel ?? 'Course'}
          src={logoUrl}
          size="lg"
          className="hidden sm:block"
        />

        <span aria-hidden className="hidden self-stretch border-l border-line sm:block" />

        <div className="flex min-w-0 flex-col gap-gb-2xl">
          <div className="flex min-w-0 flex-col gap-gb-xl">
            {/* `university` is null when the paste never matched the directory,
                where the column holds the literal "Unknown University". The
                host of the pasted URL is the honest stand-in. */}
            <p className="text-gb-md font-semibold text-fg">
              {university ?? urlLabel ?? 'Your application'}
            </p>
            {course ? <p className="text-gb-md text-fg-tertiary">{course}</p> : null}

            {pending ? (
              <div className="flex max-w-sm flex-col gap-gb-md">
                <ProgressBar label="Reading the course page" size="sm" />
                <ResearchingInline>
                  GlowBal&rsquo;s AI is reading the course page and building your checklist…
                </ResearchingInline>
              </div>
            ) : null}

            {failed ? (
              <div className="flex flex-col gap-gb-sm">
                <p className="text-gb-sm text-fg-error">
                  {app.parseError ?? 'We could not read that course page.'}
                </p>
                <RetryParse applicationId={app.id} />
              </div>
            ) : null}
          </div>

          {/* Figma 337:18803 "Details" */}
          <div className="flex flex-wrap items-center gap-gb-xl">
            {app.country ? (
              <span className="flex items-center gap-gb-sm">
                <KitIcon art={ICONS.markerPin02} frame={20} className="shrink-0 text-fg-tertiary" />
                <span className="text-gb-sm font-semibold text-fg-tertiary">{app.country}</span>
              </span>
            ) : null}
            {app.deadline ? (
              <span className="flex items-center gap-gb-sm">
                <KitIcon
                  art={ICONS.clock}
                  frame={20}
                  className={`shrink-0 ${urgency?.tone === 'urgent' ? 'text-brand' : 'text-fg-tertiary'}`}
                />
                <span className="text-gb-sm font-semibold text-fg-tertiary">
                  Deadline: {formatDeadline(app.deadline)}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Figma 337:18811 — gauge + deadline + continue */}
      <div className="flex shrink-0 items-center gap-gb-3xl">
        <ScoreRing value={app.progressPercentage ?? 0} measure="progress" />

        <div className="flex flex-col justify-center gap-gb-xl">
          <div className="flex flex-col gap-gb-xxs">
            <span className="text-gb-sm text-fg-secondary">Deadline</span>
            <span
              className={`text-gb-xl font-semibold ${
                urgency ? DEADLINE_TEXT[urgency.tone] : 'text-fg-tertiary'
              }`}
            >
              {app.deadline ? formatDeadline(app.deadline) : 'No deadline set'}
            </span>
            {urgency ? <DeadlineCountdown tone={urgency.tone} days={urgency.days} /> : null}
          </div>
          <Link
            href={workspaceHref}
            prefetch={false}
            onMouseEnter={() => router.prefetch(workspaceHref)}
            onFocus={() => router.prefetch(workspaceHref)}
            className="group/cta flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Continue applying
            <KitIcon
              art={ICONS.arrowUpRight}
              frame={20}
              className="transition-transform duration-200 group-hover/cta:-translate-y-gb-xxs group-hover/cta:translate-x-gb-xxs motion-reduce:transition-none"
            />
          </Link>

          <RowQuickLinks applicationId={app.id} strategyReady={strategyReady} />

          <div className="flex flex-wrap items-center gap-x-gb-lg gap-y-gb-xs">
            {app.universityId != null ? (
              <AddCourseButton
                universityId={app.universityId}
                universityLabel={university ?? urlLabel ?? 'this university'}
              />
            ) : null}
            <DeleteApplicationButton
              applicationId={app.id}
              label={course ? `${course} at ${university ?? 'this university'}` : (university ?? 'this application')}
            />
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Jump straight into this application's real destinations.
 *
 * ─── THE PROBLEM ─────────────────────────────────────────────────────────────
 *
 * Reaching a board from here used to be: open the row, find the strategy CTA,
 * walk the onboarding chain, land on the dashboard, then find a view switcher
 * that was not in the URL. Five navigations to look at a list of deadlines the
 * student had already produced. These are the same destinations, one click
 * away, which is only possible because the planner's view now lives in `?view=`.
 *
 * ─── ONE LINK, NOT FOUR, WHEN THERE IS NOTHING TO OPEN ───────────────────────
 *
 * Before the analysis has run, all four of these routes redirect back into
 * onboarding. Showing them anyway would trade one confusing funnel for four
 * doors that lead to the same form, so a row without a strategy gets the one
 * honest link that starts it.
 */
function RowQuickLinks({
  applicationId,
  strategyReady,
}: {
  applicationId: string;
  strategyReady: boolean;
}) {
  if (!strategyReady) {
    return (
      <Link
        href={`/ai-strategy/${applicationId}/strategy`}
        className="text-gb-xs font-semibold text-fg-tertiary hover:text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Build your strategy
      </Link>
    );
  }

  const strategy = `/ai-strategy/${applicationId}/strategy`;
  const links = [
    { href: `${strategy}/analysis/portrait`, label: 'Report' },
    { href: `${strategy}/dashboard`, label: 'List' },
    { href: `${strategy}/dashboard?view=calendar`, label: 'Calendar' },
    { href: `${strategy}/dashboard?view=kanban`, label: 'Board' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-gb-lg gap-y-gb-xs">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="rounded-gb-sm text-gb-xs font-semibold text-fg-tertiary transition-colors hover:text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

export function MyApplicationSection({
  applications,
  logoByUniversityId,
  strategyReadyById,
  sectionRef,
}: {
  applications: CourseApplication[];
  /** universities.logo_url keyed by universities.id, for the row crest. */
  logoByUniversityId: Record<number, string | null>;
  /**
   * Whether each application's strategy is finished, keyed by application id.
   * Decides between the four quick links and the single "build your strategy"
   * one — see `RowQuickLinks`. Computed page-side in two queries for the whole
   * list rather than per row.
   */
  strategyReadyById: Record<string, boolean>;
  /**
   * Scroll target for "Lên kế hoạch ứng tuyển" and the scholarship
   * confirmation, both of which live in the saved list below and both of which
   * mean "show me what this became". The shell owns the ref.
   */
  sectionRef?: React.Ref<HTMLElement>;
}) {
  return (
    <section
      id="my-application"
      ref={sectionRef}
      className="flex scroll-mt-gb-9xl flex-col gap-gb-6xl"
    >
      {/* Figma 562:15387 */}
      <ApplySectionHeading as="h1" title="My application" mark="globe">
        {applications.length > 0
          ? 'The courses you are applying to, how far along each one is, and what is due next.'
          : 'Nothing here yet — tick a university in your saved list below and plan its application.'}
      </ApplySectionHeading>

      {applications.length > 0 ? (
        <ul className="flex flex-col gap-gb-5xl">
          {applications.map((app) => (
            <ApplicationRow
              key={app.id}
              app={app}
              logoUrl={
                app.universityId != null ? (logoByUniversityId[app.universityId] ?? null) : null
              }
              strategyReady={strategyReadyById[app.id] ?? false}
            />
          ))}
        </ul>
      ) : (
        /*
          The empty state points DOWN the page now, not away from it. Before the
          merge this offered "Search universities", because the saved list was a
          different URL; it is the next section, so say so.
        */
        <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-gb-brand-100 bg-brand-subtle p-gb-5xl">
          {/* An empty list is the first thing most students see here, so it is
              the one place on the page worth spending a little colour on. */}
          <span className="flex size-gb-6xl items-center justify-center rounded-gb-full bg-surface text-brand">
            <KitIcon art={ICONS.zapFast} frame={28} />
          </span>
          <p className="text-gb-md text-fg-tertiary">
            Tick a university in your saved list below, choose the subject you want, and plan its
            application. It will appear here.
          </p>
          <Button href="#saved" variant="secondary" size="lg">
            Go to my saved list
          </Button>
        </div>
      )}
    </section>
  );
}
