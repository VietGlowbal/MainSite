'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ICONS, KitIcon } from '@/shared/ui/icons';

/**
 * The way to the saved list — a heart with a count, in the header.
 *
 * Points at `/apply#saved` since the merge: the saved list is the lower half of
 * that page (Figma 562:15078), and the anchor scrolls past the applications
 * tracker to it. `#saved` is a contract with `SavedListSection`, which carries
 * that id and a `scroll-mt-gb-9xl` so the sticky header does not cover the
 * heading.
 *
 * WHY THIS EXISTS. Before it, nothing in the product linked to the saved list at
 * all. The page was built, the heart on a university saved to it, `src/proxy.ts`
 * sent every fresh sign-in there — and there was no way to get back to it except
 * typing the URL. A cart nobody can open is not a cart.
 * (This is the second time on this feature: the university detail page shipped
 * unreachable for two days for the same reason. Grep for who links to a page
 * before calling it done.)
 *
 * WHY IT READS ITS OWN COUNT. `TopNav` is rendered from seventeen places — the
 * app chrome plus every page that ships its own header — and threading a count
 * prop through all of them would mean each one also has to learn who is signed
 * in. Instead this asks for a `head: true` count, which transfers no rows, and
 * renders nothing at all until it has an answer. RLS scopes the query to the
 * caller, so there is no user id to pass and nothing to leak.
 *
 * It re-reads on navigation, because saving happens on other pages: the heart on
 * `/universities/[id]` calls `router.refresh()`, which re-runs server components
 * but cannot know about this client component's state.
 */
export function SavedNavLink({
  /**
   * `pill` is the desktop header control. `row` is the full-width form for
   * `MobileNav`'s drawer footer, styled to match the language toggle that already
   * sits there — a 28px bordered pill in a stack of full-width rows reads as a
   * stray element.
   */
  variant = 'pill',
}: {
  variant?: 'pill' | 'row';
} = {}) {
  const pathname = usePathname();
  /** undefined = not answered yet; null = signed out or unreadable. */
  const [count, setCount] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setCount(null);
        return;
      }

      const { count: saved, error } = await supabase
        .from('user_universities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (cancelled) return;
      /*
       * A failed read renders nothing rather than a zero. `user_universities` is
       * absent from at least one project this runs against, and a "0" there would
       * be a claim about the student's list that we cannot make.
       */
      setCount(error ? null : (saved ?? 0));
    }

    void read();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (count == null) return null;

  const label = count === 1 ? '1 saved university' : `${count} saved universities`;

  if (variant === 'row') {
    return (
      <Link
        href="/apply#saved"
        data-saved-count={count}
        className="mb-gb-lg flex w-full items-center justify-between rounded-gb-md px-gb-lg py-gb-md text-gb-sm font-medium text-fg-tertiary transition-colors hover:bg-surface-hover"
      >
        <span className="flex items-center gap-gb-sm">
          <KitIcon art={ICONS.heart} frame={20} filled={count > 0} className="text-brand" />
          <span>Saved universities</span>
        </span>
        <span className="text-gb-xs font-semibold tracking-wide text-fg-muted">{count}</span>
      </Link>
    );
  }

  /*
   * ICON-ONLY, WITH THE COUNT AS A CORNER BADGE — and that is a measurement, not
   * a preference. The first version of this was a bordered pill with the number
   * beside the heart, 61px wide. `TopNav` already notes that its six nowrap
   * labels crowd the actions; adding 61px plus a 24px gap pushed the nav 14px
   * past its box on /universities and 27px on /my-universities, clipping "Blog"
   * to "B" at 1440 — the design's own width. Measured with the element removed
   * from the live DOM to confirm the overflow was this control's and not
   * pre-existing.
   *
   * At 32px square it costs less than the gap it sits in, and the count is still
   * on screen.
   */
  return (
    <Link
      href="/apply#saved"
      aria-label={label}
      title={label}
      data-saved-count={count}
      className="relative flex size-[32px] shrink-0 items-center justify-center rounded-gb-full text-brand transition-colors hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* Filled once there is something in the list — the same signal the save
          button on a university detail page uses for its own state. */}
      <KitIcon art={ICONS.heart} frame={20} filled={count > 0} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-gb-xs -top-gb-xs flex min-w-[16px] items-center justify-center rounded-gb-full bg-brand px-gb-xxs text-[10px] font-semibold leading-[16px] text-on-brand"
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
