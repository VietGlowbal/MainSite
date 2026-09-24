'use client';

import { useT } from '@/lib/i18n';
import { CONSENT_OPEN_EVENT } from '@/components/privacy/consent-boundary';

export function ConsentSettingsTrigger() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className="rounded-gb-sm text-gb-sm font-semibold text-fg-on-inverse-muted transition-colors hover:text-fg-on-inverse focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {t('Privacy settings')}
    </button>
  );
}
