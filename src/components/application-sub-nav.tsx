'use client';

import { usePathname } from 'next/navigation';
import { activeSubNavKey, type SubNavItem } from '@/shared/lib';
import { SubNav } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

/**
 * The application context bar, bound to the current route.
 *
 * A thin client wrapper so `SubNav` stays a generic primitive: the primitive
 * knows how to draw a secondary bar, this knows which of GlowBal's routes maps
 * to which entry. Putting `activeSubNavKey` inside the primitive would tie a
 * shared component to this product's URL shapes.
 *
 * It reads the pathname itself rather than taking `activeKey` from the server,
 * because the strategy pages navigate client-side between each other — a
 * server-computed active entry would be one navigation stale.
 */
export function ApplicationSubNav({ items }: { items: readonly SubNavItem[] }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <SubNav
      items={items}
      activeKey={activeSubNavKey(pathname)}
      label={t('Application sections')}
      lockedHint={t('Finish your AI analysis to unlock this')}
    />
  );
}
