'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isParsePending } from '../domain/course-name';

const POLL_MS = 4000;
const POLL_CEILING_MS = 4 * 60 * 1000;

type ParseTarget = {
  id: string;
  parseStatus?: string | null;
};

type PollResult = 'pending' | 'changed' | 'retry' | 'stop';

async function pollStatus(id: string): Promise<PollResult> {
  try {
    const response = await fetch(`/api/applications/${id}/parse-status`);
    if (response.status === 401 || response.status === 403) return 'stop';
    if (response.status === 404) return 'changed';
    if (!response.ok) return 'retry';
    const body = (await response.json()) as { parseStatus?: string | null };
    return isParsePending(body.parseStatus) ? 'pending' : 'changed';
  } catch {
    return 'retry';
  }
}

/** Poll only the tiny status endpoint; refresh the Server Component once data changes. */
export function useParseRefresh(applications: ReadonlyArray<ParseTarget>): void {
  const router = useRouter();
  const pendingKey = applications
    .filter((application) => isParsePending(application.parseStatus))
    .map((application) => application.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (!pendingKey) return undefined;
    const ids = pendingKey.split(',');
    const startedAt = Date.now();
    let polling = false;

    const timer = setInterval(async () => {
      if (Date.now() - startedAt >= POLL_CEILING_MS) {
        clearInterval(timer);
        return;
      }
      if (document.visibilityState === 'hidden' || polling) return;
      polling = true;
      const settled = await Promise.allSettled(ids.map(pollStatus));
      polling = false;
      const results = settled
        .filter((result): result is PromiseFulfilledResult<PollResult> => result.status === 'fulfilled')
        .map((result) => result.value);
      if (results.includes('stop')) {
        clearInterval(timer);
      } else if (results.includes('changed')) {
        clearInterval(timer);
        router.refresh();
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [pendingKey, router]);
}
