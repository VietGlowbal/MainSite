'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { CourseSearchSessionModal } from '@/components/course-search-session-modal';
import { UpgradePromptModal } from '@/components/upgrade-prompt-modal';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import type { CourseApplication } from '@/lib/apply-types';
import {
  Avatar,
  Button,
  Container,
  Footer,
  ICONS,
  Input,
  KitIcon,
  MobileNav,
  ScoreRing,
  TopNav,
} from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * The applications list — Figma 337:18767 ("Trang my apply", titled "My
 * application") on the "UI Final - Dev" canvas.
 *
 * This frame supersedes 224:14068 / 224:14957 on the older "Tính năng" canvas.
 * Both of those are named "Trang lưu" and sit under a "My applications" banner;
 * this one is the migrated redraw and is the one to build against.
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
 *     every row. Only 4 of the 29 live rows carry a university_id to join a
 *     logo_url from, so the rest render `Avatar`'s initials fallback rather than
 *     a broken image box.
 *
 *  4. DEADLINE IS OPTIONAL. The frame prints "14 Jan 2026" on all three rows.
 *     Only 7 of 29 live rows have a deadline at all, so the block collapses to
 *     "No deadline set" instead of inventing one.
 *
 *  5. THE IMPORTER IS KEPT. The frame draws no way to add an application, which
 *     would leave the page a dead end — and would drop the Smart Course Importer,
 *     a headline feature. The paste-a-URL bar is retained above the list, in
 *     tokens. Same for CourseSearchSessionModal, which /scholarships links into
 *     with ?openCourseSearch=true; removing it would break that funnel.
 *
 *  6. NO MOBILE FRAME EXISTS for this page — the only 375-wide frames in the file
 *     are the three nav menus. The row reflows here: the gauge and deadline drop
 *     under the text block below `lg`.
 *
 * Dropped from the previous dashboard because the frame does not draw them and
 * they were not load-bearing: the overview stat card, the upcoming-deadlines
 * card, the mentor and "improve your profile" promos, the trial banner and the
 * shortlist section. The shortlist read from `user_universities`, which does not
 * exist on the database (see docs/known-issues.md), so it rendered empty
 * regardless. All of it is in git history at apply-dashboard.tsx.
 */

/** Figma 337:18812 — the gauge is banded by value: 92 green, 60 amber, 30 rose. */
function gaugeColor(pct: number): string {
  if (pct >= 70) return 'var(--color-gb-tier-safe)'; // Figma Colors/Green/700
  if (pct >= 40) return 'var(--color-gb-yellow-400)'; // Figma Colors/Yellow/400
  return 'var(--color-gb-brand-600)'; // Figma Colors/Rose/600
}

/**
 * Figma 337:18813 "Activity gauge".
 *
 * The frame exports the three rings as flat images baked at 92% / 60% / 30%, so
 * they cannot be reused — the arc has to follow real `progress_percentage`. Drawn
 * as an SVG arc instead, which is what the ring it replaces did too.
 */
function ProgressGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 32;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex size-[104px] shrink-0 items-center justify-center rounded-gb-full bg-surface-muted/90 p-gb-lg backdrop-blur-sm">
      <svg
        width="76"
        height="76"
        viewBox="0 0 76 76"
        role="img"
        aria-label={`${pct}% complete`}
      >
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--color-gb-neutral-300)"
          strokeWidth="8"
        />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={gaugeColor(pct)}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`}
          transform="rotate(-90 38 38)"
        />
        <text
          x="38"
          y="38"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-[var(--gb-text-primary)] text-gb-md font-semibold"
        >
          {pct}%
        </text>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Waiting for the parse

   A pasted course URL is read in the background — a queued job the cron worker
   drains, usually inside a minute. The row is created immediately with
   placeholder text, so without this the list said "Loading course details..."
   forever and only corrected itself if the student happened to reload later.

   `router.refresh()` rather than polling /api/applications/[id]/parse-status:
   the parse changes the course name, the country, the deadline and the
   progress, and re-reading the server component picks all of them up in one
   request. Polling the status endpoint would tell us the parse had finished and
   then require a refresh anyway.
   ───────────────────────────────────────────────────────────────────────── */

const POLL_MS = 4000;
/**
 * Give up refreshing after this long. The worker retries with quadratic
 * backoff, so a job still pending at four minutes is waiting on a retry that is
 * minutes away — long past the point where a student is watching the tab.
 */
const POLL_CEILING_MS = 4 * 60 * 1000;

function isPending(app: CourseApplication): boolean {
  return app.parseStatus === 'pending' || app.parseStatus === 'processing';
}

function useParseRefresh(applications: CourseApplication[]): void {
  const router = useRouter();
  const waiting = applications.some(isPending);

  useEffect(() => {
    if (!waiting) return undefined;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > POLL_CEILING_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [waiting, router]);
}

/** "14 Jan 2026" — the frame's format. Fixed locale so it cannot drift on hydration. */
function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The row's course line while the page is still being read.
 *
 * `course_name` is inserted as the literal string "Loading course details..."
 * when the application is created, so it is a placeholder masquerading as data.
 * Rendering it verbatim is what made a stalled parse look like a stuck spinner
 * that never resolved. Treat any row that is still parsing as having no course
 * name yet, whatever the column happens to hold.
 */
const COURSE_NAME_PLACEHOLDER = /^loading course details/i;

function courseLine(app: CourseApplication): string | null {
  if (isPending(app)) return null;
  if (!app.courseName) return null;
  return COURSE_NAME_PLACEHOLDER.test(app.courseName) ? null : app.courseName;
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

/** Figma 337:18787 — one application row. */
function ApplicationRow({ app, logoUrl }: { app: CourseApplication; logoUrl: string | null }) {
  const course = courseLine(app);
  const pending = isPending(app);
  const failed = app.parseStatus === 'failed' || app.parseStatus === 'timeout';

  return (
    <li className="flex flex-col gap-gb-3xl rounded-gb-2xl border border-line p-gb-xl lg:flex-row lg:items-center lg:justify-between">
      {/* Figma 337:18790 "_Job post" */}
      <div className="flex min-w-0 flex-1 items-center gap-gb-2xl">
        <Avatar name={app.universityName} src={logoUrl} size="lg" className="hidden sm:block" />

        <span aria-hidden className="hidden self-stretch border-l border-line sm:block" />

        <div className="flex min-w-0 flex-col gap-gb-2xl">
          <div className="flex min-w-0 flex-col gap-gb-xl">
            <p className="text-gb-md font-semibold text-fg">{app.universityName}</p>
            {course ? <p className="text-gb-md text-fg-tertiary">{course}</p> : null}

            {pending ? (
              <p className="text-gb-sm text-fg-muted" aria-live="polite">
                Reading the course page and building your checklist…
              </p>
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
                <KitIcon art={ICONS.clock} frame={20} className="shrink-0 text-fg-tertiary" />
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
            <span className="text-gb-xl font-semibold text-fg-tertiary">
              {app.deadline ? formatDeadline(app.deadline) : 'No deadline set'}
            </span>
          </div>
          <Link
            href={`/apply/${app.id}`}
            className="flex items-center gap-gb-xs text-gb-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Continue applying
            <KitIcon art={ICONS.arrowUpRight} frame={20} />
          </Link>
        </div>
      </div>
    </li>
  );
}

/**
 * Paste-a-course-URL importer. Ported from the previous dashboard's ImportBar
 * with its behaviour intact — same endpoint, same 409 duplicate and 403 quota
 * branches — and restyled onto tokens.
 */
function ImportBar() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Loading your applications');
  const [quota, setQuota] = useState<{ currentUsage: number; currentLimit: number } | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!url.trim()) {
        setError('Please paste a course URL first.');
        return;
      }
      try {
        new URL(url);
      } catch {
        setError("This doesn't appear to be a valid course page. Double-check the URL.");
        return;
      }

      setError('');
      setSuccess('');
      setLoading(true);
      try {
        const response = await fetch('/api/applications/from-course-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseUrl: url }),
        });
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 409 && data.duplicate) {
            setError('This course is already in your list.');
          } else if (response.status === 403 && data.upgradeRequired) {
            setQuota({
              currentUsage: data.usage?.coursesAdded ?? 0,
              currentLimit: data.usage?.courseAddLimit ?? 5,
            });
          } else {
            setError(data.error || 'Failed to add course. Please try again.');
          }
          return;
        }

        setSuccess('Course added. Building your checklist in the background.');
        setUrl('');
        // Server-rendered list — re-read rather than guess at the new row.
        router.refresh();
      } catch {
        setError('Could not reach the server. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [url, router],
  );

  return (
    <div className="flex flex-col gap-gb-md rounded-gb-2xl border border-line p-gb-3xl">
      <form onSubmit={handleSubmit} method="post" className="flex flex-col gap-gb-lg sm:flex-row sm:items-start">
        <Input
          name="courseUrl"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
            setSuccess('');
          }}
          label="Add a course"
          placeholder="Paste a university course page URL"
          disabled={loading}
          fieldClassName="flex-1"
          {...(error ? { error } : {})}
          {...(success && !error ? { hint: success } : {})}
        />
        <Button type="submit" size="lg" disabled={loading} className="sm:mt-[26px]">
          {loading ? 'Adding…' : 'Add course'}
        </Button>
      </form>
      <p className="text-gb-sm text-fg-muted">
        We parse the official course page and build your application checklist from it.
      </p>

      {quota ? (
        <UpgradePromptModal
          isOpen
          onClose={() => setQuota(null)}
          limitType="courses"
          currentUsage={quota.currentUsage}
          currentLimit={quota.currentLimit}
        />
      ) : null}
    </div>
  );
}

export type ApplyListClientProps = {
  applications: CourseApplication[];
  /** universities.logo_url keyed by universities.id, for the row crest. */
  logoByUniversityId: Record<number, string | null>;
  userName?: string | null;
  userAvatarUrl?: string | null;
  /**
   * Target of the ?universityId=..&openCourseSearch=true entry point, resolved
   * server-side. `domain` is '' when the name is not in the websites lookup —
   * the modal already treats that as "unknown", as the previous dashboard did.
   */
  courseSearchUniversity: { id: number; name: string; domain: string } | null;
  openCourseSearch: boolean;
  isLoggedOut?: boolean;
};

export function ApplyListClient({
  applications,
  logoByUniversityId,
  userName,
  userAvatarUrl,
  courseSearchUniversity,
  openCourseSearch,
  isLoggedOut = false,
}: ApplyListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keeps the list moving while a pasted URL is still being read.
  useParseRefresh(applications);

  /*
   * /scholarships links here with ?universityId=..&openCourseSearch=true.
   *
   * Derived at mount rather than set from inside the effect below: the flag is a
   * prop, so opening the modal is initial state, not a reaction to one.
   */
  const [searchOpen, setSearchOpen] = useState(
    () => openCourseSearch && courseSearchUniversity != null,
  );

  // Drop the trigger from the URL once it has been consumed, so a refresh or a
  // back-navigation does not re-open the modal. This part is a real side effect.
  useEffect(() => {
    if (!openCourseSearch || !courseSearchUniversity) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openCourseSearch');
    router.replace(params.size ? `/apply?${params}` : '/apply', { scroll: false });
  }, [openCourseSearch, courseSearchUniversity, router, searchParams]);

  const isSignedIn = !isLoggedOut && !!userName;
  const primaryAction = useMemo(() => ({ href: '/universities', label: 'Search universities' }), []);

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(isSignedIn && userName
          ? { user: { name: userName, avatarUrl: userAvatarUrl, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Sign in' } })}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        openLabel="Menu"
        closeLabel="Close menu"
      />

      {/* Figma 337:18779 "Features section" */}
      <main className="min-h-screen pb-gb-9xl pt-gb-6xl">
        <Container className="flex flex-col gap-gb-6xl">
          {/* Figma 337:18782 */}
          <div className="flex flex-col gap-gb-lg">
            <h1 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg md:text-gb-display-md">
              My application
            </h1>
            <p className="max-w-gb-width-xl text-gb-xl text-fg-tertiary">
              {applications.length > 0
                ? 'The courses you are applying to, how far along each one is, and what is due next.'
                : 'Nothing here yet — add a course below and we will build its application checklist.'}
            </p>
          </div>

          {isLoggedOut ? (
            <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-line bg-surface-muted p-gb-5xl">
              <p className="text-gb-md text-fg-tertiary">
                Sign in to keep track of the courses you are applying to.
              </p>
              <Button href="/auth" size="lg">
                Sign in
              </Button>
            </div>
          ) : (
            <>
              <ImportBar />

              {applications.length > 0 ? (
                <ul className="flex flex-col gap-gb-5xl">
                  {applications.map((app) => (
                    <ApplicationRow
                      key={app.id}
                      app={app}
                      logoUrl={
                        app.universityId != null
                          ? (logoByUniversityId[app.universityId] ?? null)
                          : null
                      }
                    />
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-start gap-gb-xl rounded-gb-2xl border border-line bg-surface-muted p-gb-5xl">
                  <p className="text-gb-md text-fg-tertiary">
                    Paste a course page URL above, or browse universities to find one.
                  </p>
                  <Button href="/universities" size="lg">
                    Search universities
                  </Button>
                </div>
              )}
            </>
          )}
        </Container>
      </main>

      <Footer
        logo={<GlowbalLogo height={28} />}
        tagline={FOOTER_TAGLINE}
        columns={FOOTER_COLUMNS}
        social={FOOTER_SOCIAL}
        copyright={FOOTER_COPYRIGHT}
        ratings={FOOTER_RATINGS}
      />

      {searchOpen && courseSearchUniversity ? (
        <CourseSearchSessionModal
          isOpen
          onClose={() => setSearchOpen(false)}
          universityId={courseSearchUniversity.id}
          universityName={courseSearchUniversity.name}
          universityDomain={courseSearchUniversity.domain}
        />
      ) : null}
    </div>
  );
}
