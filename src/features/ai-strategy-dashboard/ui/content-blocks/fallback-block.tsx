'use client';

import { useLanguage } from '@/lib/i18n';

/**
 * FallbackBlock — the honest degraded panel for a block this UI cannot edit:
 * `schema` is `null`, or its `type` is missing from CONTENT_BLOCK_TYPES
 * (an older or newer generator wrote it, or a payload is malformed).
 *
 * CALM AND HONEST. The student did nothing wrong and may have saved work
 * already, so: say plainly that there is no editable form here, reassure that
 * saved progress is kept — and render NOTHING of the raw payload. Echoing the
 * unknown JSON would leak generator internals into the page; staying silent
 * about the situation would look like a broken page. `role="note"` keeps it
 * out of the landmark structure while still being announced.
 */
export function FallbackBlock() {
  const { t } = useLanguage();
  return (
    <div
      role="note"
      className="flex flex-col gap-gb-sm rounded-gb-lg border border-line bg-surface-muted p-gb-xl"
    >
      <p className="text-gb-sm font-medium text-fg-secondary">
        {t('This task has no editable form right now.')}
      </p>
      <p className="text-gb-xs text-fg-muted">{t('Your saved progress is kept.')}</p>
    </div>
  );
}
