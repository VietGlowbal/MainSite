'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SavedNavLink } from '@/components/saved-nav-link';
import { CourseSearchSessionModal } from '@/components/course-search-session-modal';
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
 */

/** Everything the shell hands to the saved list, resolved on the server. */
export type ApplicationProgressClientProps = {
  applications: CourseApplication[];
  /** universities.logo_url keyed by universities.id, for the row crest. */
  logoByUniversityId: Record<number, string | null>;
  /** Empty in the signed-out shell — there is no saved list without an account. */
  savedRows: SavedRow[];
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

export function ApplicationProgressClient({
  applications,
  logoByUniversityId,
  savedRows,
  userName,
  userAvatarUrl,
  courseSearchUniversity,
  openCourseSearch,
  isLoggedOut = false,
}: ApplicationProgressClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keeps the list moving while a pasted URL is still being read. Also covers
  // the rows `planApplications` creates — they arrive parse_status='pending'.
  useParseRefresh(anyParsePending(applications));

  /*
   * /scholarships links here with ?universityId=..&openCourseSearch=true.
   *
   * Derived at mount rather than set from inside the effect below: the flag is a
   * prop, so opening the modal is initial state, not a reaction to one.
   */
  const [searchOpen, setSearchOpen] = useState(
    () => openCourseSearch && courseSearchUniversity != null,
  );

  const applicationsRef = useRef<HTMLElement>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
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
   * applications, then scroll up to them.
   *
   * NO NEW ENDPOINT. `POST /api/applications/from-course-url` already creates
   * the row and queues the parse job that produces the checklist, the deadline
   * and the progress the donut reads; it also answers 409 with
   * `existingApplicationId` when the course is already tracked, which is
   * exactly the "you already planned this one, here it is" case. Posting the
   * saved row's own programme URL is the whole implementation.
   *
   * A row with no subject chosen has no URL to post, and an application with no
   * course parses into nothing — no checklist, no deadline, a donut frozen at
   * 0%. So that row goes to the subject picker first and comes back through
   * `?planFor`, rather than being created hollow. (Owner's call, 31/07.)
   */
  const planApplications = useCallback(
    async (rows: SavedRow[]) => {
      if (rows.length === 0) return;
      setPlanError(null);

      const needsSubject = rows.find((row) => !row.programUrl);
      if (needsSubject) {
        const back = `/apply?planFor=${needsSubject.universityId}`;
        router.push(
          `/my-universities/program?u=${needsSubject.universityId}&next=${encodeURIComponent(back)}`,
        );
        return;
      }

      setPlanning(true);
      const failed: string[] = [];
      for (const row of rows) {
        try {
          const res = await fetch('/api/applications/from-course-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseUrl: row.programUrl, universityId: row.universityId }),
          });
          // 409 means it is already on the list — the goal, not a failure.
          if (!res.ok && res.status !== 409) failed.push(row.name);
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
      if (failed.length > 0) {
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
   * Consumed once and stripped from the URL, for the same reason
   * ?openCourseSearch is below — otherwise a refresh or a back-navigation
   * re-fires it. The row is looked up in the freshly-rendered `savedRows`, so
   * by this point it has the programme the student just picked.
   */
  const planFor = searchParams.get('planFor');
  useEffect(() => {
    if (!planFor) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('planFor');
    router.replace(params.size ? `/apply?${params}` : '/apply', { scroll: false });

    const row = savedRows.find((r) => String(r.universityId) === planFor);
    if (row?.programUrl) {
      void planApplications([row]);
    } else if (row) {
      /*
       * Back from the picker, still no URL — and this is the common case, not
       * an edge one. The catalogue covers 24 of 106 universities; for the other
       * 82 the subject list comes from `universities.strengths`, which is a
       * list of names with no links behind it, so there is nothing for the
       * picker to have saved.
       *
       * Say so instead of pushing them back to the picker, which would be a
       * loop, or doing nothing, which would look like the button is broken.
       */
      setPlanError(
        'We need the course page link to build a checklist. Open "Change subject here" on that university and paste the link to the course.',
      );
    }
    // `savedRows` and `planApplications` are deliberately out of the dep list:
    // this must fire once per arrival, not again when the refresh above
    // re-renders the list with the new application in it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFor]);

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
      <main className="min-h-screen pb-gb-9xl pt-gb-6xl">
        <Container className="flex flex-col gap-gb-7xl">
          <MyApplicationSection
            applications={applications}
            logoByUniversityId={logoByUniversityId}
            showImportBar={!isLoggedOut}
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
