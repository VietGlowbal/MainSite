'use client';

import { usePathname } from 'next/navigation';
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
  const { t } = useLanguage();

  return (
    <SubNav
      items={items}
      activeKey={activeAiStrategyApplicationKey(pathname, items)}
      label={t('Application sections')}
      tone={tone}
    />
  );
}
