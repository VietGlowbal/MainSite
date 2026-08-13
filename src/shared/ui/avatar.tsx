'use client';

import { useState } from 'react';

/**
 * Avatar — Untitled UI's avatar with the kit's "contrast border" treatment,
 * from Figma 203:12467 (the signed-in top nav).
 *
 * The three nested rings read as redundant until you see where the component
 * has to work: the same avatar sits on the black nav bar and, later, on white
 * cards. The white hairline is what separates the photo from black; the
 * translucent dark ring is what separates it from white. Drop either and the
 * avatar bleeds into one of the two backgrounds.
 *
 * Sizes are named steps, the way button.tsx handles its padding steps. `sm` is
 * the signed-in nav's 32px; `lg` is the 60px crest slot on the applications list
 * (Figma 337:18792), where the frame draws a university mark and most rows have
 * no logo to draw, so the initials fallback carries them.
 */

export type AvatarSize = 'sm' | 'lg';

const SIZES: Record<AvatarSize, string> = {
  sm: 'size-gb-4xl text-gb-xs',
  lg: 'size-[60px] text-gb-lg',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  // Vietnamese names put the given name last ("Trần Khánh Linh" -> TL), which
  // is also what first+last gives for the English order. One rule covers both.
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const seed = `${first}${last}`.toUpperCase();
  return seed === '' ? '?' : seed;
}

export function Avatar({
  name,
  src,
  size = 'sm',
  className,
}: {
  /** Used for the alt text and as the initials fallback. */
  name: string;
  src?: string | null | undefined;
  size?: AvatarSize | undefined;
  className?: string | undefined;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && src !== failedSrc;

  return (
    <div
      className={`relative ${SIZES[size]} shrink-0 rounded-gb-full bg-surface p-px shadow-gb-xs ring-[0.5px] ring-black/10${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="size-full overflow-hidden rounded-gb-full ring-[0.5px] ring-black/16">
        {showImage ? (
          /* Plain <img> rather than next/image: avatar URLs come from OAuth
             providers and user uploads, and an unconfigured host makes
             next/image throw at runtime. At 32px there is nothing to optimise.
             This is the only avatar in the app now — /profile's own scroll-
             reactive one was deleted with the console rebuild. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? undefined}
            alt={name}
            loading="lazy"
            onError={() => setFailedSrc(src ?? null)}
            className="size-full rounded-gb-full border border-white object-cover"
          />
        ) : (
          <div
            aria-hidden
            /* Text size is inherited from the wrapper's size step. */
            className="flex size-full items-center justify-center rounded-gb-full border border-white bg-surface-muted font-semibold text-fg-secondary"
          >
            {initials(name)}
          </div>
        )}
      </div>
    </div>
  );
}
