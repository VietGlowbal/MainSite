'use client';

import { usePathname, useRouter } from 'next/navigation';
import { activeAiStrategyApplicationKey } from '@/shared/lib/ai-strategy-route-model';
import type { SubNavItem } from '@/shared/lib/app-routes';
import { SubNav, type SubNavTone } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

/** The application context bar, bound to the current canonical route model. */
export function ApplicationSubNav({
  items,
  tone,
}: {
  items: readonly SubNavItem[];
  tone?: SubNavTone | undefined;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <SubNav
      items={items}
      activeKey={activeAiStrategyApplicationKey(pathname, items)}
      label={t('Application sections')}
      tone={tone}
      onIntent={(href) => {
        // Warm only report reads the student is about to open, not every heavy
        // workspace at once. The loading-boundary default only warms the shell.
        if (/\/(?:personal-report|matching-report|strategy-report)(?:\?|$)/.test(href) && href !== pathname) {
          router.prefetch(href);
        }
      }}
    />
  );
}
