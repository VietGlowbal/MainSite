import Image from 'next/image';

/**
 * The official Glowbal wordmark + globe icon.
 * Single source of truth for the logo so we can swap the asset once
 * and have it propagate across nav, hero, emails (where applicable), etc.
 *
 * The source image is 1115x398 (ratio ~2.8:1). We let next/image scale it
 * with proper aspect ratio. Default sizing targets a comfortable nav height.
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
const SRC_H = 398;

export function GlowbalLogo({
  height = 36,
  className,
  priority = false,
  alt = 'Glowbal',
}: Props) {
  const width = Math.round((SRC_W / SRC_H) * height);
  return (
    <Image
      src="/glowbal-logo.png"
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}
