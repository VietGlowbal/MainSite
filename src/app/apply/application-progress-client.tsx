'use client';

import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHashScrollTarget } from '@/features/apply/hooks';
import { useParseRefresh } from '@/features/apply/parse-refresh';
import type { CourseApplication } from '@/lib/apply-types';
import { Button } from '@/shared/ui/button';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import type { UniversityScholarships } from './application-scholarships';
import { MyApplicationSection } from './my-application-section';
import type { SavedRow } from './saved-list-section';

const SavedListSection = dynamic(
  () => import('./saved-list-section').then((module) => module.SavedListSection),
  { loading: () => <SavedListSkeleton /> },
);

function SavedListSkeleton() {
  return (
    <section
      className="min-h-[520px] animate-pulse rounded-gb-2xl border border-line bg-surface-muted"
      aria-label="Loading saved universities"
      aria-busy="true"
    />
  );
}

function DeferredSavedList({
  savedRowsPromise,
  onPlan,
  onGoToApplications,
  planning,
  focusUniversityId,
  setFocusUniversityId,
  setPlanError,
  isPlus,
}: {
  savedRowsPromise: Promise<SavedRow[]>;
  onPlan: (rows: SavedRow[]) => Promise<void>;
  onGoToApplications: () => void;
  planning: boolean;
  focusUniversityId: number | null;
  setFocusUniversityId: Dispatch<SetStateAction<number | null>>;
  setPlanError: Dispatch<SetStateAction<string | null>>;
  isPlus?: boolean;
}) {
  const savedRows = use(savedRowsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const planFor = searchParams.get('planFor');
  const focus = searchParams.get('focus');

  useEffect(() => {
    if (!planFor) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('planFor');
    router.replace(params.size ? `/apply?${params}` : '/apply', { scroll: false });

    const row = savedRows.find((candidate) => String(candidate.universityId) === planFor);
    if (row?.program) void onPlan([row]);
    else if (row) setPlanError('Choose a subject for that university to plan its application.');
    // Consume each return URL once; refreshed saved rows must not submit again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFor]);

  useEffect(() => {
    if (!focus) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('focus');
    router.replace(params.size ? `/apply?${params}` : '/apply', { scroll: false });

    const universityId = Number.parseInt(focus, 10);
    if (
      Number.isFinite(universityId) &&
      savedRows.some((row) => row.universityId === universityId)
    ) {
      setFocusUniversityId(universityId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <SavedListSection
      rows={savedRows}
      onPlan={onPlan}
      onGoToApplications={onGoToApplications}
      planning={planning}
      focusUniversityId={focusUniversityId}
      isPlus={isPlus}
    />
  );
}

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
  savedRowsPromise: Promise<SavedRow[]>;
  /**
   * Whether each application's strategy is finished, keyed by id. Drives the
   * per-row quick links into the planner's three views. Defaults to empty, so
   * the signed-out shell and any caller that has not computed it get the
   * conservative "build your strategy" link rather than four dead ones.
   */
  strategyReadyById?: Record<string, boolean>;
  /**
   * The scholarships chosen for — and offerable at — each university on the
   * tracker, keyed by universities.id. Feeds the drawer under each application
   * row. Empty in the signed-out shell and in the /dev preview.
   */
  scholarshipsByUniversityId?: Record<number, UniversityScholarships>;
  isLoggedOut?: boolean;
  isPlus?: boolean;
};

export function ApplicationProgressClient({
  applications,
  logoByUniversityId,
  savedRowsPromise,
  strategyReadyById = {},
  scholarshipsByUniversityId = {},
  isLoggedOut = false,
  isPlus,
}: ApplicationProgressClientProps) {
  const router = useRouter();

  // Keeps the list moving while an enrichment parse is still running. Only rows
  // planned for a university with a catalogued course link are ever pending.
  useParseRefresh(applications);

  const applicationsRef = useRef<HTMLElement>(null);
  const savedSectionRef = useHashScrollTarget<HTMLDivElement>('#saved');
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

  return (
    <>
      <MyApplicationSection
        applications={applications}
        logoByUniversityId={logoByUniversityId}
        strategyReadyById={strategyReadyById}
        scholarshipsByUniversityId={scholarshipsByUniversityId}
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
        /*
         * Keep the fragment target OUTSIDE Suspense. On a direct or client-side
         * visit to /apply#saved, the saved rows may still be streaming; if the
         * id only appears with SavedListSection, the browser looks for it while
         * the skeleton is mounted, finds nothing, and leaves the student at the
         * top of My Portal. `savedSectionRef` also retries from a passive effect
         * because the App Router can run its cross-page fragment lookup before
         * this client subtree mounts at all.
         */
        <div ref={savedSectionRef} id="saved" className="scroll-mt-gb-9xl">
          <Suspense fallback={<SavedListSkeleton />}>
            <DeferredSavedList
              savedRowsPromise={savedRowsPromise}
              onPlan={planApplications}
              onGoToApplications={scrollToApplications}
              planning={planning}
              focusUniversityId={focusUniversityId}
              setFocusUniversityId={setFocusUniversityId}
              setPlanError={setPlanError}
              isPlus={isPlus}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
