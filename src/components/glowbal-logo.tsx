import Image from 'next/image';

/**
 * The official Glowbal wordmark. Single source of truth for the logo so the
 * asset can be swapped once and propagate across nav, hero, footer, etc.
 *
 * ── Why this points at a cropped asset ───────────────────────────────────────
 * The original export, public/glowbal-logo.png, is 1115x398 with the wordmark
 * occupying only 929x163 of it — 93px of transparent margin either side and
 * 108/127px above and below. Rendering that at `height={28}` produced a 78x28
 * box in which the actual lettering was ~11px tall, then asked next/image to
 * downscale a 1115px-wide gradient wordmark into it. That is what made the logo
 * look smeared and colour-fringed: the glyphs were getting a fraction of the
 * pixels the box could have given them.
 *
 * public/brand/glowbal-wordmark.png is the same export with the vertical
 * padding cropped to the framing the design itself uses — Figma node 153:18271
 * scales this image to `w-full` / `h-175.51%` at `top--37.76%` inside a 138x28
 * frame, which works out to source rows 86..313. So the ratio below is the
 * design's logo box (138/28 = 4.93) rather than the raw file's 2.80, the
 * lettering now fills 72% of the height instead of 41%, and `height={28}`
 * yields exactly the 138x28 the Figma header draws.
 *
 * The uncropped file is left in place; nothing else references it.
 *
 * ── Why the inline width is a number, not `auto` ─────────────────────────────
 * `width: auto` leaves the cross size auto, so in a COLUMN flex container the
 * default `align-items: stretch` applies to the <img> and blows it out to the
 * container's full width while the fixed height stays put. That is what made
 * the footer wordmark render 352x28 (ratio 12.6 against the asset's 4.9) — the
 * footer's left column is `flex flex-col` with no `items-*`, whereas TopNav's
 * row has `items-center` and so was unaffected. Emitting the derived width in
 * px opts every call site out of that stretch, whatever container it lands in.
 */
type Props = {
  /** Rendered height in px. Width is derived from the source aspect ratio. */
  height?: number;
  /** Optional className applied to the underlying <img>. */
  className?: string;
  /** Whether to mark this image as priority (LCP eligible). Use on hero. */
  priority?: boolean;
  /** Override the alt text. Defaults to "Glowbal". */
  alt?: string;
};

const SRC_W = 1115;
const SRC_H = 227;

export function GlowbalLogo({
  height = 36,
  className,
  priority = false,
  alt = 'Glowbal',
}: Props) {
  const width = Math.round((SRC_W / SRC_H) * height);
  return (
    <Image
      src="/brand/glowbal-wordmark.png"
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      /*
       * A gradient wordmark with thin counters is the worst case for the
       * default quality of 75 — the artefacts land on the letter edges, where
       * they read as the fringing this component used to show. The asset is
       * small enough that the extra bytes do not matter.
       */
      quality={90}
      className={className}
      style={{ height, width, display: 'block' }}
    />
  );
}
