'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SavedNavLink } from '@/components/saved-nav-link';
import {
  FOOTER_COLUMNS,
  FOOTER_COPYRIGHT,
  FOOTER_RATINGS,
  FOOTER_SOCIAL,
  FOOTER_TAGLINE,
  MARKETING_NAV_ITEMS,
} from '@/features/marketing/ui';
import { anyParsePending, useParseRefresh } from '@/features/apply/hooks';
import type { CourseApplication } from '@/lib/apply-types';
import { Button, Container, Footer, MobileNav, TopNav } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { MyApplicationSection } from './my-application-section';
import { SavedListSection, type SavedRow } from './saved-list-section';

/**
 * /apply — "Application Progress". Figma 562:15078 ("Trang lưu") on the
 * authoritative "Khanh Linh - Chi" canvas.
 *
 * ONE PAGE, TWO SECTIONS: "My application" (the tracker, 562:15386) above
 * "Danh sách đã lưu" (the saved list, 562:15092 + 562:15098). They used to be
 * two URLs — /apply and /my-universities — which meant a student saved a
 * university on one page and had to navigate to another to find out whether it
 * had become anything. /my-universities now 308s here (next.config.ts).
 *
 * This file is the shell: chrome, the parse poller, and the one piece of
 * behaviour that only exists because the two halves are now adjacent —
 * `planApplications` below. The sections themselves own their own rendering.
 *
 * The child routes did NOT move: /apply/[applicationId] is the per-course
 * workspace, and /my-universities/program is still the subject picker the saved
 * rows link to.
 *
 * ⚠️ THE ONLY WAY TO CREATE AN APPLICATION IS `planApplications` (01/08). The
 * paste-a-course-URL bar and the CourseSearchSessionModal that used to sit
 * alongside it are gone, along with the `?universityId` + `?openCourseSearch`
 * entry point that opened the modal. That param had no caller left outside the
 * modal's own post-auth return trip — `/scholarships` sends `?focus=<id>`, which
 * is handled below — so nothing external broke. The endpoint behind the bar,
 * `/api/applications/from-course-url`, is still there and still supports the
 * ingestion pipeline; it simply has no button.
 */

/** Everything the shell hands to the saved list, resolved on the server. */
export type ApplicationProgressClientProps = {
  applications: CourseApplication[];
  /** universities.logo_url keyed by universities.id, for the row crest. */
  logoByUniversityId: Record<number, string | null>;
  /** Empty in the signed-out shell — there is no saved list without an account. */
  savedRows: SavedRow[];
  /**
   * Whether each application's strategy is finished, keyed by id. Drives the
   * per-row quick links into the planner's three views. Defaults to empty, so
   * the signed-out shell and any caller that has not computed it get the
   * conservative "build your strategy" link rather than four dead ones.
   */
  strategyReadyById?: Record<string, boolean>;
  userName?: string | null;
  userAvatarUrl?: string | null;
  isLoggedOut?: boolean;
};

export function ApplicationProgressClient({
  applications,
  logoByUniversityId,
  savedRows,
  strategyReadyById = {},
  userName,
  userAvatarUrl,
  isLoggedOut = false,
}: ApplicationProgressClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keeps the list moving while an enrichment parse is still running. Only rows
  // planned for a university with a catalogued course link are ever pending.
  useParseRefresh(anyParsePending(applications));

  const applicationsRef = useRef<HTMLElement>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  /** Set by ?focus=<universityId> below; the saved list ticks and scrolls to it. */
  const [focusUniversityId, setFocusUniversityId] = useState<number | null>(null);
  useLoadingIndicator(planning, 'Setting up your application');

  /**
   * Scroll to "My application".
   *
   * Same pattern as the two other lists that reveal results in place
   * (`university-list-client.tsx`, `scholarship-directory-client.tsx`): a ref
   * plus `scroll-mt-gb-9xl` on the target, so the sticky header does not sit on
   * top of the heading. `prefers-reduced-motion` gets the jump instead of the
   * glide — the movement here can be two thousand pixels.
   */
  const scrollToApplications = useCallback(() => {
    const target = applicationsRef.current;
    if (!target) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, []);

  /**
   * "Lên kế hoạch ứng tuyển" — turn ticked saved universities into tracked
   * applications, then scroll up to them. This is now the ONLY way an
   * application is created.
   *
   * IT POSTS A UNIVERSITY, NOT A URL. It used to post each row's `program_url`
   * to `/api/applications/from-course-url`, which meant a saved row without one
   * could not become an application at all — and most cannot: the programme
   * catalogue covers 24 of the 106 universities, so for the other 82 the subject
   * list comes from `universities.strengths`, which is names with no links
   * behind it. That bounced the student to the subject picker and, when the
   * picker had no URL to save either, told them to go and find one. The new
   * endpoint takes `{ universityId }`, reads the subject off the saved row, and
   * seeds the baseline checklist itself; the course link is optional and only
   * decides whether an AI enrichment pass is queued on top.
   *
   * A row with no SUBJECT still goes to the picker first, because an application
   * is "I am applying to study X at Y" and without X there is nothing to track.
   * The endpoint enforces that too (409 SUBJECT_REQUIRED) — this is the same
   * check made early so the student is not charged a round trip to be told.
   */
  const planApplications = useCallback(
    async (rows: SavedRow[]) => {
      if (rows.length === 0) return;
      setPlanError(null);

      const needsSubject = rows.find((row) => !row.program);
      if (needsSubject) {
        const back = `/apply?planFor=${needsSubject.universityId}`;
        router.push(
          `/my-universities/program?u=${needsSubject.universityId}&next=${encodeURIComponent(back)}`,
        );
        return;
      }

      setPlanning(true);
      const failed: string[] = [];
      let quotaReached = false;

      for (const row of rows) {
        try {
          const res = await fetch('/api/applications/from-saved-university', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ universityId: row.universityId }),
          });

          if (res.ok) continue;

          const body = await res.json().catch(() => ({}));
          // 409 + duplicate means it is already on the plan — the goal, not a
          // failure. 409 + SUBJECT_REQUIRED is a race with the picker and is
          // reported like any other refusal.
          if (res.status === 409 && body.duplicate) continue;
          /* The free plan allows five active courses. Say so once rather than
             naming every row that hit the same wall. */
          if (res.status === 403) {
            quotaReached = true;
            break;
          }
          failed.push(row.name);
        } catch {
          failed.push(row.name);
        }
      }
      setPlanning(false);

      /*
       * Say which ones did not make it, by name. A silent partial success here
       * would be the worst outcome: the student scrolls up, counts fewer rows
       * than they ticked, and has no way to know which.
       */
      if (quotaReached) {
        setPlanError('You have reached the number of courses your plan allows.');
      } else if (failed.length > 0) {
        setPlanError(
          failed.length === rows.length
            ? 'We could not set those applications up. Please try again.'
            : `We could not set up: ${failed.join(', ')}. The rest are below.`,
        );
      }

      // Server-rendered list — re-read rather than guess at the new rows.
      router.refresh();
      scrollToApplications();
    },
    [router, scrollToApplications],
  );

  /*
   * The return trip from the subject picker: /apply?planFor=<universityId>.
   *
   * Consumed once and stripped from the URL — otherwise a refresh or a
   * back-navigation re-fires it. The row is looked up in the freshly-rendered
   * `savedRows`, so by this point it has the subject the student just picked.
   *
   * ⚠️ THE DEAD END HERE IS GONE. This used to require `programUrl` and, when
   * the picker had none to save — the common case, not an edge one, for the 82
   * universities with no catalogue — told the student to go and find a course
   * link themselves. A subject is now enough.
   */
  const planFor = searchParams.get('planFor');
  useEffect(() => {
    if (!planFor) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('planFor');
    router.replace(params.size ? `/apply?${params}` : '/apply', { scroll: false });

    const row = savedRows.find((r) => String(r.universityId) === planFor);
    if (row?.program) {
      void planApplications([row]);
    } else if (row) {
      // Came back without choosing anything. Not an error — say what is missing
      // rather than bouncing them into the picker again, which would be a loop.
      setPlanError('Choose a subject for that university to plan its application.');
    }
    // `savedRows` and `planApplications` are deliberately out of the dep list:
    // this must fire once per arrival, not again when the refresh above
    // re-renders the list with the new application in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFor]);

  /*
   * /apply?focus=<universityId>, sent by /scholarships when the student presses
   * "go to my plan" from a scholarship attached to a university
   * (scholarship-directory-client.tsx). It has been sent since that page was
   * built and IGNORED here the whole time — the owner's own screenshot is of
   * /apply?focus=82 doing nothing. It now scrolls the saved row into view and
   * ticks it, so "Plan my application" acts on the one they arrived for.
   *
   * Consumed once and stripped from the URL, like ?planFor above.
   */
  const focus = searchParams.get('focus');
  useEffect(() => {
    if (!focus) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('focus');
    router.replace(params.size ? `/apply?${params}` : '/apply', { scroll: false });

    const universityId = Number.parseInt(focus, 10);
    if (!Number.isFinite(universityId)) return;
    if (!savedRows.some((row) => row.universityId === universityId)) return;
    setFocusUniversityId(universityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const isSignedIn = !isLoggedOut && !!userName;
  const primaryAction = useMemo(() => ({ href: '/universities', label: 'Search universities' }), []);
  const navItems = MARKETING_NAV_ITEMS;

  return (
    <div className="gb-page-full-bleed gb-has-mobile-header bg-surface">
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={navItems}
        primaryAction={primaryAction}
        utility={<SavedNavLink />}
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
        items={navItems}
        primaryAction={primaryAction}
        secondaryAction={
          isSignedIn ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        utility={<SavedNavLink variant="row" />}
        openLabel="Menu"
        closeLabel="Close menu"
      />

      {/* Figma 562:15091 — both sections live in this one column. */}
      {/* `relative` only — deliberately NOT `overflow-hidden`. The bloom below
          is inset inside `main` and needs no clipping, and this element is the
          ancestor of both the scholarship dialogs and the saved list's toast,
          which are `position: fixed`. */}
      <main className="relative min-h-screen pb-gb-9xl pt-gb-6xl">
        {/*
          A rose bloom behind the first heading. Decorative and not in the frame,
          which paints the page flat white: the two headings and their marks are
          the only colour above the fold, and on a 1440 canvas they sat in the
          top-left corner of a very large empty rectangle. This gives that
          rectangle the same rose the marks are made of and fades it out before
          the first row. Token value, not a hex — Rose/50, as everywhere else.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
          style={{
            background:
              'radial-gradient(70% 100% at 12% 0%, var(--color-gb-brand-50), transparent 72%)',
          }}
        />

        <Container className="relative flex flex-col gap-gb-7xl">
          <MyApplicationSection
            applications={applications}
            logoByUniversityId={logoByUniversityId}
            strategyReadyById={strategyReadyById}
            sectionRef={applicationsRef}
          />

          {planError ? (
            <p role="alert" className="text-gb-sm font-medium text-danger">
              {planError}
            </p>
          ) : null}

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
            <SavedListSection
              rows={savedRows}
              onPlan={planApplications}
              onGoToApplications={scrollToApplications}
              planning={planning}
              focusUniversityId={focusUniversityId}
            />
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
    </div>
  );
}
