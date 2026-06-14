'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

/**
 * A drop-in replacement for next/link that prefetches on hover/focus intent
 * rather than eagerly when the link scrolls into view.
 *
 * For dense lists (university cards, news/guide cards) eager viewport
 * prefetching can kick off dozens of route prefetches the user never visits.
 * This keeps the initial load lean and only warms a route once the user
 * signals intent by pointing at it — so the click feels instant without the
 * upfront cost.
 */
type Props = ComponentProps<typeof Link>;

export function HoverPrefetchLink({ onMouseEnter, onFocus, ...props }: Props) {
  const [active, setActive] = useState(false);

  return (
    <Link
      {...props}
      // `false` until intent, then `null` (Next's default automatic prefetch).
      prefetch={active ? null : false}
      onMouseEnter={(event) => {
        setActive(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setActive(true);
        onFocus?.(event);
      }}
    />
  );
}
