import { Button } from '@/shared/ui';
import type { UpNextCopy } from '../domain';

/**
 * The visual and functional hero of the screen (spec §7). Noticeably more
 * colourful than the rest of the interface but still one tint, not a
 * gradient — spec §17 explicitly asks to avoid "gradients everywhere".
 */
export function UpNextCard({
  copy,
  estimatedMinutes,
  onOpen,
}: {
  copy: UpNextCopy;
  estimatedMinutes?: number | undefined;
  onOpen: () => void;
}) {
  return (
    <div className="mx-gb-xl flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-brand-subtle p-gb-2xl">
      <span className="inline-flex w-fit items-center gap-gb-xs rounded-gb-full bg-brand px-gb-lg py-gb-xs text-gb-xs font-semibold text-on-brand">
        Up next ✨
      </span>

      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-sm font-medium text-fg-brand">{copy.eyebrow}</p>
        <p className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
          {copy.headline}
        </p>
      </div>

      <div className="flex items-center justify-between gap-gb-lg">
        {estimatedMinutes ? (
          <span className="text-gb-xs text-fg-muted">~{estimatedMinutes} min</span>
        ) : (
          <span />
        )}
        <Button onClick={onOpen} size="lg">
          {copy.cta}
        </Button>
      </div>
    </div>
  );
}
