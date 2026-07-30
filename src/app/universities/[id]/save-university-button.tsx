'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ICONS, KitIcon } from '@/shared/ui';
import { createClient } from '@/lib/supabase/client';

/**
 * The save-to-shortlist heart — Figma 522:8643, in the title row of 375:10629.
 *
 * This control is NEW in the frame. Its node id sits in the 522: block while
 * every other node on the page is 375:, so it was drawn after /universities/[id]
 * was built on 2026-07-28 and the first build could not have included it.
 *
 * It writes the same row the list page's card heart writes — `user_universities`
 * with status 'interested', upserted on (user_id, university_id) — so saving
 * here and saving there are the same act, and /my-universities sees both.
 *
 * Deliberately NOT wired through `UniversityExplorerProvider`. That context is
 * how the list page tracks shortlist state, but its provider takes the whole
 * university array as a prop; mounting it here to toggle one row would ship all
 * 97 rows into this page's payload to render a 32px button.
 *
 * Guests are sent through /api/home/save-university, which parks the intent in
 * the auth redirect and performs the save once they come back signed in — the
 * same route the homepage funnel uses. Showing them an optimistic filled heart
 * that no row exists behind would be a lie.
 */
export function SaveUniversityButton({
  universityId,
  universityName,
  isSignedIn,
  initialSaved,
}: {
  universityId: number;
  universityName: string;
  isSignedIn: boolean;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!isSignedIn) {
      const next = `/universities/${universityId}`;
      router.push(
        `/api/home/save-university?u=${universityId}&next=${encodeURIComponent(next)}`,
      );
      return;
    }

    const nextSaved = !saved;
    setSaved(nextSaved);
    setError(null);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaved(!nextSaved);
      setError('Your session expired. Please sign in again.');
      return;
    }

    const result = nextSaved
      ? await supabase.from('user_universities').upsert(
          { user_id: userData.user.id, university_id: universityId, status: 'interested' },
          { onConflict: 'user_id,university_id', ignoreDuplicates: true },
        )
      : await supabase
          .from('user_universities')
          .delete()
          .eq('user_id', userData.user.id)
          .eq('university_id', universityId);

    /*
     * Roll the optimistic state back on failure, for the reason the list page's
     * heart already documents: `public.user_universities` is missing from at
     * least one project this runs against, and a discarded error there made
     * every lost save look like a successful one until the next reload.
     */
    if (result.error) {
      setSaved(!nextSaved);
      setError('Could not update your list. Please try again.');
      return;
    }

    // /my-universities and the nav count read this on the server.
    startTransition(() => router.refresh());
  }

  const label = saved
    ? `Remove ${universityName} from your list`
    : `Save ${universityName} to your list`;

  return (
    <span className="flex flex-col items-end gap-gb-xs">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={saved}
        aria-label={label}
        title={label}
        data-saved={saved ? 'true' : 'false'}
        className={`flex size-[32px] shrink-0 items-center justify-center rounded-gb-full transition-colors ${
          saved
            ? 'bg-brand text-on-brand hover:bg-brand-hover'
            : 'bg-brand-subtle text-brand hover:bg-brand hover:text-on-brand'
        } ${pending ? 'opacity-70' : ''}`}
      >
        <KitIcon art={ICONS.heart} frame={32} filled={saved} />
      </button>
      {error ? (
        <span role="status" className="text-gb-xs text-fg-error">
          {error}
        </span>
      ) : null}
    </span>
  );
}
