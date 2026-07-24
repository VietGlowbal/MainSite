import { BrandIcon, type BrandIconArt } from './icons';

/**
 * RatingsBadge — the kit's `Ratings badge`, Figma 104:7411, in the footer's
 * left column: a laurel wreath either side of five stars and two lines of text.
 *
 * ⚠️ The copy is the caller's, and on GLOWBAL it is currently a placeholder.
 * The mockup reads "Best AI Tool / 2,000+ reviews"; the product owner confirmed
 * on 2026-07-25 that those are stand-in numbers to be replaced with real ones.
 * Nothing here invents a claim — pass what is true.
 *
 * BUILT AT NATURAL SIZE, and the mockup is not. Every measurement in 104:7411
 * is exactly 0.8x the kit's — 12.8px stars, 28.8x64.3 wreaths, 11.2px and 9.6px
 * type — because the designer resized the instance to fit the column rather
 * than restyling it. Reproducing that literally would put two strings below
 * 10px, which is not readable, and would take the type off the scale that keeps
 * the rest of the site coherent. So the badge renders at 16px stars and
 * text-sm / text-xs, and the wreaths (vectors) scale up losslessly.
 * If the designer wants the smaller instance, it is one `scale-[0.8]`.
 *
 * The kit also layers a #262626 "Star background" shape behind each star. It is
 * dropped: its only purpose is a soft halo, and against the #0a0a0a footer —
 * the one surface this badge appears on — the two are indistinguishable.
 */

/** Figma I104:7411;7460:147443 — "Star icon", exported at 12.8px, one path. */
const STAR: BrandIconArt = {
  w: 12.8,
  h: 12.8,
  frame: 12.8,
  d: 'M6.10454 1.03038C6.21385 0.767564 6.58615 0.767563 6.69546 1.03038L8.01776 4.20956C8.06384 4.32036 8.16804 4.39606 8.28765 4.40565L11.7199 4.68081C12.0036 4.70356 12.1186 5.05764 11.9025 5.24281L9.28748 7.48282C9.19635 7.56088 9.15655 7.68337 9.18439 7.80009L9.98331 11.1493C10.0494 11.4262 9.74816 11.645 9.50524 11.4967L6.5668 9.70188C6.4644 9.63933 6.3356 9.63933 6.2332 9.70188L3.29476 11.4967C3.05185 11.645 2.75065 11.4262 2.81669 11.1493L3.61561 7.80009C3.64345 7.68337 3.60365 7.56088 3.51252 7.48282L0.897544 5.24281C0.681372 5.05764 0.796421 4.70356 1.08015 4.68081L4.51235 4.40565C4.63196 4.39606 4.73616 4.32036 4.78224 4.20956L6.10454 1.03038Z',
};

export function RatingsBadge({
  headline,
  supporting,
  stars = 5,
  className,
}: {
  /** e.g. "Best AI Tool". */
  headline: string;
  /** e.g. "2,000+ reviews". */
  supporting: string;
  stars?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={className ? `flex items-center ${className}` : 'flex items-center'}>
      {/* The wreaths overlap the centre block by 4px on each side in the design
          (-3.2 at 0.8 scale), which is what closes the laurel around the text. */}
      {/* Plain <img>, not next/image: these are SVGs, which the image optimiser
          passes through untouched unless `dangerouslyAllowSVG` is on — so the
          component would buy nothing and cost a config flag. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/ratings-wreath-left.svg"
        alt=""
        aria-hidden="true"
        width={36}
        height={80}
        className="-mr-gb-xs shrink-0"
      />
      <div className="flex flex-col items-center gap-gb-xs">
        <div className="flex items-start gap-gb-xxs text-gb-yellow-400">
          {Array.from({ length: stars }, (_, i) => (
            <BrandIcon key={i} art={STAR} frame={16} />
          ))}
        </div>
        <div className="flex flex-col items-center whitespace-nowrap">
          <span className="text-gb-sm font-semibold text-fg-on-inverse">{headline}</span>
          <span className="text-gb-xs font-medium text-fg-on-inverse-muted">{supporting}</span>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/ratings-wreath-right.svg"
        alt=""
        aria-hidden="true"
        width={36}
        height={80}
        className="-ml-gb-xs shrink-0"
      />
    </div>
  );
}
