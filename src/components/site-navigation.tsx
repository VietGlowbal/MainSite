'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { GlowbalLogo } from '@/components/glowbal-logo';
import {
  useNavigationRoles,
  withNavigationRoleItems,
} from '@/components/navigation-roles';
import { useNavigationSession } from '@/components/navigation-session';
import { SavedNavLink } from '@/components/saved-nav-link';
import { getMarketingNavPresentation } from '@/features/marketing/ui';
import { useLanguage } from '@/lib/i18n';
import { MobileNav, TopNav } from '@/shared/ui';

type Props = {
  tone?: 'dark' | 'light';
  showSaved?: boolean;
};

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

function useHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
}

/**
 * The canonical desktop + mobile site header.
 *
 * While the browser session is unresolved it renders the shared destinations
 * but no account-specific actions. That prevents a completed student from
 * seeing the first-time onboarding CTA flash during hydration.
 */
export function SiteNavigation({ tone = 'dark', showSaved = false }: Props) {
  // Read the locale itself as well as the translator. The persistent shell can
  // survive a locale toggle; keying the nav islands to the locale guarantees
  // that a translated action label (notably Strategy Master) is never retained
  // across EN ↔ VI updates.
  const { lang, t } = useLanguage();
  const session = useNavigationSession();
  const roles = useNavigationRoles();
  const hydrated = useHydrated();
  const sessionReady = hydrated && session.ready;

  const presentation = getMarketingNavPresentation(
    sessionReady
      ? { signedIn: session.signedIn, completed: session.completed }
      : // The completed list is the neutral subset: it contains no first-time
        // Strategy item and actions are withheld separately below.
        { signedIn: true, completed: true },
    t,
  );

  const primaryAction = sessionReady ? presentation.primaryAction : undefined;
  const accountAction = sessionReady ? presentation.accountAction : undefined;
  const user = sessionReady && session.signedIn ? session.user : null;
  const items = withNavigationRoleItems(
    presentation.items,
    sessionReady ? roles : null,
    t,
  );

  return (
    <>
      <TopNav
        key={`top-nav-${lang}`}
        tone={tone}
        logo={<GlowbalLogo height={28} />}
        items={items}
        primaryAction={primaryAction}
        {...(showSaved ? { utility: <SavedNavLink /> } : {})}
        {...(user
          ? {
              user: {
                name: user.name,
                avatarUrl: user.avatarUrl,
                href: presentation.accountAction.href,
              },
            }
          : accountAction
            ? { secondaryAction: accountAction }
            : {})}
      />
      <MobileNav
        key={`mobile-nav-${lang}`}
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={items}
        primaryAction={primaryAction}
        secondaryAction={accountAction}
        {...(showSaved ? { utility: <SavedNavLink variant="row" /> } : {})}
        openLabel={t('Menu')}
        closeLabel={t('Close menu')}
      />
    </>
  );
}
