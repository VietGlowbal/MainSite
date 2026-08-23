'use client';

import { useLanguage } from '@/lib/i18n';

/**
 * Shared save indicator for every block input (moved out of content-block.tsx
 * when the four inputs became registry entries).
 *
 * Text, not a spinner or colour change alone: the state must read without hue
 * (WCAG 1.4.1) and `aria-live="polite"` announces it to screen readers
 * without stealing focus.
 */
export function SaveStatus({ saving }: { saving: boolean }) {
  const { t } = useLanguage();
  return (
    <span aria-live="polite" className="text-gb-xs text-fg-muted">
      {saving ? t('Saving…') : ''}
    </span>
  );
}
