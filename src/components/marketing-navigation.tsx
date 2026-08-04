'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { GlowbalLogo } from '@/components/glowbal-logo';
import { SavedNavLink } from '@/components/saved-nav-link';
import { MARKETING_NAV_ITEMS } from '@/features/marketing/ui';
import { createClient } from '@/lib/supabase/client';
import { MobileNav, TopNav } from '@/shared/ui';

type NavUser = {
  name: string;
  avatarUrl?: string | undefined;
};

type NavAction = {
  href: string;
  label: string;
};

/** Guest-first marketing chrome; identity is added after hydration. */
export function MarketingNavigation({
  primaryAction = { href: '/onboarding', label: 'Plan your studies' },
  showSaved = false,
}: {
  primaryAction?: NavAction;
  showSaved?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    let active = true;
    let generation = 0;

    function sync(authUser: {
      email?: string | null;
      user_metadata?: Record<string, unknown>;
    } | null) {
      if (!active) return;
      if (!authUser) {
        setUser(null);
        return;
      }
      setUser({
        name:
          (authUser.user_metadata?.full_name as string | undefined) ||
          authUser.email?.split('@')[0] ||
          'Profile',
        avatarUrl: authUser.user_metadata?.avatar_url as string | undefined,
      });
    }

    const initialRequest = ++generation;
    void supabase.auth.getUser().then(({ data }) => {
      if (initialRequest === generation) sync(data.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      generation += 1;
      sync(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <>
      <TopNav
        tone="light"
        logo={<GlowbalLogo height={28} />}
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        {...(showSaved ? { utility: <SavedNavLink /> } : {})}
        {...(user
          ? { user: { ...user, href: '/profile' } }
          : { secondaryAction: { href: '/auth', label: 'Sign in' } })}
      />
      <MobileNav
        logo={
          <Link href="/" aria-label="GlowBal home" className="inline-flex items-center">
            <GlowbalLogo height={28} />
          </Link>
        }
        items={MARKETING_NAV_ITEMS}
        primaryAction={primaryAction}
        secondaryAction={
          user ? { href: '/profile', label: 'Profile' } : { href: '/auth', label: 'Sign in' }
        }
        {...(showSaved ? { utility: <SavedNavLink variant="row" /> } : {})}
        openLabel="Menu"
        closeLabel="Close menu"
      />
    </>
  );
}
