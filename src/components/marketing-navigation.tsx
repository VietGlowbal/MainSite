'use client';

import { SiteNavigation } from '@/components/site-navigation';
import type { Locale } from '@/lib/i18n/locale';

type NavAction = {
  href: string;
  label: string;
};

/**
 * Backwards-compatible name for marketing pages that already import it.
 *
 * `primaryAction` is retained only so older compositions keep compiling while
 * they migrate. The top-nav matrix is now global and completion-aware, so a
 * page may no longer replace its one-time onboarding / Strategy Master slot.
 */
export function MarketingNavigation({
  showSaved = false,
  tone = 'light',
  locale,
}: {
  primaryAction?: NavAction;
  showSaved?: boolean;
  tone?: 'dark' | 'light';
  locale?: Locale;
}) {
  return <SiteNavigation tone={tone} showSaved={showSaved} locale={locale} />;
}
