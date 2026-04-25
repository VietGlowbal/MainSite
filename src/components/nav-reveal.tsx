'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useScroll } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/dashboard', label: 'Dashboard' },
];

function NavAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setDeg((y / 2) % 360);
    });
  }, [scrollY]);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: `linear-gradient(${deg}deg, #ff4d8c, #00b4d8)`,
          padding: 2,
          transition: 'background 0.1s linear',
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#ff4d8c',
          }}>
            {initials}
          </div>
        )}
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgb(15 23 42)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name.split(' ')[0]}
      </span>
    </Link>
  );
}

export function NavReveal() {
  const [revealed, setRevealed] = useState(false);
  const [user, setUser] = useState<{ name: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    // Always show on inner pages; only gate on the landing page
    const isLanding = window.location.pathname === '/';
    if (!isLanding || localStorage.getItem('glowbal-nav-revealed') === 'true') {
      setRevealed(true);
    }
    function onReveal() {
      setRevealed(true);
      localStorage.setItem('glowbal-nav-revealed', 'true');
    }
    window.addEventListener('glowbal:reveal-nav', onReveal);

    // Auth state
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
    <header className="glowbal-topbar border-b border-black/5 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10 lg:px-12">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          <span className="glowbal-wordmark">Glowbal</span>
        </Link>

        <nav className="glowbal-nav flex items-center gap-2 text-sm text-slate-600">
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
  );
}
