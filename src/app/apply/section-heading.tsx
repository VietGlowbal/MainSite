import Image from 'next/image';
import { ICONS, KitIcon } from '@/shared/ui';

/**
 * The two section headings on /apply — Figma 562:15387 ("My application") and
 * 562:15092 ("Saved University"), inside 562:15078 "My Portal".
 *
 * ⚠️ BOTH HEADINGS ARE ROSE, AND THAT IS THE FRAME'S ONE PIECE OF COLOUR.
 * They shipped in `text-fg` — near-black — which is why the page read as a
 * greyscale list rather than a portal. `Colors/Rose/600` is bound on both text
 * nodes (562:15391, 562:15096), so this is a design variable the code was
 * missing, not a preference. `text-brand` resolves to exactly that #e11d48.
 *
 * Each heading also carries a mark the code had dropped entirely:
 *
 *  - "My application" → 562:15622, a 56px Rose/50 disc holding a 40px globe
 *    (562:15637 "Transparent Globe 1"). The export is a 2048² PNG; committed at
 *    160² — four times the 40px slot, so it stays sharp on a 4x display without
 *    shipping 158KB for an icon. Same artwork, fewer pixels.
 *  - "Saved University" → 562:15559, a 32px Rose/50 disc holding the kit's
 *    heart. Already in `ICONS.heart` (it is the same glyph the university
 *    detail page's save button uses), so the exported SVG is not committed
 *    again — the Rose/50 plate behind it is the caller's job either way, which
 *    is what `ICONS.heart`'s own header note says.
 *
 * The heading level is the caller's: "My application" is the page's h1 and the
 * saved list is an h2 under it. The frame draws them at the same size because
 * it has no document outline to respect; the code does.
 */

export type ApplyHeadingMark = 'globe' | 'heart';

/** 562:15622 — the globe disc beside "My application". */
function GlobeMark() {
  return (
    <span className="flex size-[56px] shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle">
      <Image
        src="/brand/apply-globe.png"
        alt=""
        width={40}
        height={40}
        className="size-[40px]"
        priority
      />
    </span>
  );
}

/** 562:15559 — the heart disc beside "Saved University". */
function HeartMark() {
  return (
    <span className="flex size-[32px] shrink-0 items-center justify-center rounded-gb-full bg-brand-subtle text-brand">
      <KitIcon art={ICONS.heart} frame={32} />
    </span>
  );
}

export function ApplySectionHeading({
  as: Tag,
  title,
  mark,
  children,
}: {
  as: 'h1' | 'h2';
  title: string;
  mark: ApplyHeadingMark;
  /** The supporting line under the heading (562:15392 / 562:15097). */
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-gb-lg">
      <div className="flex flex-wrap items-center gap-gb-lg">
        <Tag className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-brand md:text-gb-display-md">
          {title}
        </Tag>
        {mark === 'globe' ? <GlobeMark /> : <HeartMark />}
      </div>
      <p className="max-w-gb-width-xl text-gb-xl text-fg-tertiary">{children}</p>
    </div>
  );
}
