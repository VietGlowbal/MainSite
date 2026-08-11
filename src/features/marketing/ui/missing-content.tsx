import { useT } from '@/lib/i18n';

/**
 * A visible marker for copy the Figma file has not been written yet.
 *
 * Two of the three feature blocks (104:7188, 104:7199) still hold Untitled UI's
 * demo text — customer-service SaaS copy, one sentence of which advertises
 * "Untitled" by name. None of it can ship, and inventing replacement product
 * claims is not mine to do, so the preview shows the real layout with the gaps
 * named instead.
 *
 * `data-no-auto-translate` keeps DomTranslator from posting these strings to
 * /api/translate — they are Vietnamese already, and dev-only besides.
 *
 * ⚠️ NOTHING THAT RENDERS THIS MAY REACH "/". Grep for MissingContent before
 * the đợt 5 swap; if it still has call sites, the copy is still missing.
 */
/* Kept out of the JSX for the reason spelled out in `Container`: a class
   touching a `${` is invisible to Tailwind's scanner. */
const BOX =
  'flex flex-col gap-gb-xs rounded-gb-md border-2 border-dashed border-line-strong px-gb-lg py-gb-md';

export function MissingContent({
  node,
  label,
  className,
}: {
  /** The Figma node whose content is missing, e.g. "104:7193". */
  node: string;
  /** What belongs here, in a few words. */
  label: string;
  className?: string | undefined;
}) {
  const t = useT();
  return (
    <div
      data-no-auto-translate
      data-missing-content={node}
      className={className ? `${BOX} ${className}` : BOX}
    >
      <span className="text-gb-sm font-semibold text-fg-secondary">{t('Content unavailable')}</span>
      <span className="text-gb-sm text-fg-muted">
        {label} — {t('Figma {node} is still an Untitled UI placeholder.', { node })}
      </span>
    </div>
  );
}
