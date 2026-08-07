'use client';

import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { useNavigationSession } from '@/components/navigation-session';
import { SavedNavLink } from '@/components/saved-nav-link';
import { getMarketingNavPresentation } from '@/features/marketing/ui';
import { useLanguage } from '@/lib/i18n';
import { MobileNav, TopNav } from '@/shared/ui';

type Props = {
  tone?: 'dark' | 'light';
  showSaved?: boolean;
};

/**
 * The canonical desktop + mobile site header.
 *
 * While the browser session is unresolved it renders the shared destinations
 * but no account-specific actions. That prevents a completed student from
 * seeing the first-time onboarding CTA flash during hydration.
 */
export function SiteNavigation({ tone = 'dark', showSaved = false }: Props) {
  const { t } = useLanguage();
  const session = useNavigationSession();

  const presentation = getMarketingNavPresentation(
    session.ready
      ? { signedIn: session.signedIn, completed: session.completed }
      : // The completed list is the neutral subset: it contains no first-time
        // Strategy item and actions are withheld separately below.
        { signedIn: true, completed: true },
    t,
  );

  const primaryAction = session.ready ? presentation.primaryAction : undefined;
  const accountAction = session.ready ? presentation.accountAction : undefined;
  const user = session.ready && session.signedIn ? session.user : null;

  return (
    <>
      <TopNav
        tone={tone}
        logo={<GlowbalLogo height={28} />}
        items={presentation.items}
        primaryAction={primaryAction}
        {...(showSaved ? { utility: <SavedNavLink /> } : {})}
        {...(user
          ? {
              user: {
                name: user.name,
                label: presentation.accountAction.label,
                avatarUrl: user.avatarUrl,
                href: presentation.accountAction.href,
              },
            }
          : accountAction
            ? { secondaryAction: accountAction }
            : {})}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={presentation.items}
        primaryAction={primaryAction}
        secondaryAction={accountAction}
        {...(showSaved ? { utility: <SavedNavLink variant="row" /> } : {})}
        openLabel={t('Menu')}
        closeLabel={t('Close menu')}
      />
    </>
  );
}
