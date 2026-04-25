'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useScroll } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/',            label: 'Home',       icon: '🏠' },
  { href: '/onboarding',  label: 'Onboarding', icon: '🎓' },
  { href: '/dashboard',   label: 'Dashboard',  icon: '📊' },
];

// ── Rotating avatar ring ─────────────────────────────────────────────────────
function NavAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setDeg((y / 2) % 360);
    });
  }, [scrollY]);

  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const firstName = name.split(' ')[0];

  return (
    <Link href="/profile" aria-label="Your profile" className="glowbal-nav-profile-link">
      {/* Name on the left */}
      <span className="glowbal-nav-profile-name">{firstName}</span>
      {/* Avatar on the right */}
      <div
        className="glowbal-nav-avatar-ring"
        style={{ background: `linear-gradient(${deg}deg, #ff4d8c, #00b4d8)` }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="glowbal-nav-avatar-img" />
        ) : (
          <div className="glowbal-nav-avatar-initials">{initials}</div>
        )}
      </div>
    </Link>
  );
}

// ── Mobile bottom bar ────────────────────────────────────────────────────────
function MobileNav({ user }: { user: { name: string; avatarUrl?: string } | null }) {
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setDeg((y / 2) % 360);
    });
  }, [scrollY]);

  const initials = user?.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '';

  const allItems = [
    ...NAV_ITEMS,
    user
      ? { href: '/profile',  label: 'Profile',  icon: null }
      : { href: '/auth',     label: 'Sign in',  icon: '👤' },
  ];

  return (
    <nav className="glowbal-mobile-nav" aria-label="Mobile navigation">
      {allItems.map((item) => {
        const isActive = pathname === item.href;
        const isProfile = item.href === '/profile' && user;
        return (
          <Link key={item.href} href={item.href} className={`glowbal-mobile-nav-item ${isActive ? 'glowbal-mobile-nav-item-active' : ''}`}>
            {isProfile ? (
              <div
                className="glowbal-mobile-nav-avatar"
                style={{ background: `linear-gradient(${deg}deg, #ff4d8c, #00b4d8)` }}
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="glowbal-nav-avatar-img" />
                ) : (
                  <div className="glowbal-nav-avatar-initials" style={{ fontSize: '0.55rem' }}>{initials}</div>
                )}
              </div>
            ) : (
              <span className="glowbal-mobile-nav-icon" aria-hidden="true">{item.icon}</span>
            )}
            <span className="glowbal-mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Main nav ─────────────────────────────────────────────────────────────────
export function NavReveal() {
  const [revealed, setRevealed] = useState(false);
  const [user, setUser] = useState<{ name: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    const isLanding = window.location.pathname === '/';
    if (!isLanding || localStorage.getItem('glowbal-nav-revealed') === 'true') {
      setRevealed(true);
    }
    function onReveal() {
      setRevealed(true);
      localStorage.setItem('glowbal-nav-revealed', 'true');
    }
    window.addEventListener('glowbal:reveal-nav', onReveal);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Profile',
          avatarUrl: data.user.user_metadata?.avatar_url,
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Profile',
          avatarUrl: session.user.user_metadata?.avatar_url,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      window.removeEventListener('glowbal:reveal-nav', onReveal);
      subscription.unsubscribe();
    };
  }, []);

  if (!revealed) return null;

  return (
    <>
      {/* ── Desktop / tablet header ── */}
      <header className="glowbal-topbar border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10 lg:px-12">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            <span className="glowbal-wordmark">Glowbal</span>
          </Link>

          <nav className="glowbal-nav hidden sm:flex items-center gap-2 text-sm text-slate-600">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="glowbal-nav-link transition hover:text-slate-900">
                {item.label}
              </Link>
            ))}

            {user ? (
              <NavAvatar name={user.name} avatarUrl={user.avatarUrl} />
            ) : (
              <Link href="/auth" className="glowbal-nav-link transition hover:text-slate-900">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* ── Mobile bottom bar ── */}
      <MobileNav user={user} />
    </>
  );
}
