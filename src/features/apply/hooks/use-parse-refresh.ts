'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isParsePending } from '../domain';

/**
 * Re-read the server component while a course parse is still running.
 *
 * A pasted course URL is read in the background — a queued job the cron worker
 * drains, usually inside a minute. The row exists immediately with placeholder
 * text, so without this a student sits on "we're reading the course page" until
 * they happen to reload.
 *
 * `router.refresh()` rather than polling /api/applications/[id]/parse-status:
 * the parse changes the course name, the country, the deadline, the checklist
 * and the progress, and re-reading the server component picks all of them up in
 * one request. Polling the status endpoint would tell us the parse had finished
 * and then require a refresh anyway.
 *
 * Extracted from the applications list so the workspace polls on exactly the
 * same terms — two timers with independently drifting ceilings is how one
 * screen ends up self-healing and the other doesn't.
 */

const POLL_MS = 4000;

/**
 * Give up refreshing after this long. The worker retries with quadratic
 * backoff, so a job still pending at four minutes is waiting on a retry that is
 * minutes away — long past the point where a student is watching the tab.
 */
const POLL_CEILING_MS = 4 * 60 * 1000;

/** @param waiting whether anything on the page is still awaiting its parse. */
export function useParseRefresh(waiting: boolean): void {
  const router = useRouter();

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

/** True when any of these applications is still being parsed. */
export function anyParsePending(
  applications: ReadonlyArray<{ parseStatus?: string | null | undefined }>,
): boolean {
  return applications.some((app) => isParsePending(app.parseStatus));
}
