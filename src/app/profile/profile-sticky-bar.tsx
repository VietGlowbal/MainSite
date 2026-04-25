'use client';

import { useEffect, useState } from 'react';
import { motion, useScroll } from 'framer-motion';

interface Props {
  displayName: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  docCount: number;
  hasProfile: boolean;
}

// Gradient stops that cycle as user scrolls
const GRADIENT_STOPS = [
  ['#ff4d8c', '#00b4d8'],   // pink → cyan  (default)
  ['#ff4d8c', '#a855f7'],   // pink → purple
  ['#f97316', '#ff4d8c'],   // orange → pink
  ['#00b4d8', '#a855f7'],   // cyan → purple
  ['#10b981', '#00b4d8'],   // emerald → cyan
];

export function ProfileStickyBar({ displayName, email, initials, avatarUrl, docCount, hasProfile }: Props) {
  const { scrollY } = useScroll();
  const [gradientIndex, setGradientIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  // Show sticky bar after scrolling 220px
  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setVisible(y > 220);
      const idx = Math.floor(y / 300) % GRADIENT_STOPS.length;
      setGradientIndex(idx);
    });
  }, [scrollY]);

  const [from, to] = GRADIENT_STOPS[gradientIndex];
  const gradient = `linear-gradient(135deg, ${from}, ${to})`;

  return (
    <motion.div
      aria-hidden={!visible}
      initial={false}
      animate={{ y: visible ? 0 : -80, opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          margin: '10px auto',
          maxWidth: '56rem',
          padding: '0 1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            borderRadius: '999px',
            border: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(22,33,62,0.1)',
            padding: '0.5rem 1rem 0.5rem 0.5rem',
          }}
        >
          {/* Scroll-reactive avatar */}
          <motion.div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: gradient,
              padding: 2,
              flexShrink: 0,
              transition: 'background 0.6s ease',
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: from,
              }}>
                {initials}
              </div>
            )}
          </motion.div>

          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgb(15 23 42)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </p>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgb(100 116 139)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {email}
            </p>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'flex', gap: '1rem', flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'rgb(15 23 42)' }}>{docCount}</p>
              <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgb(148 163 184)' }}>Docs</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: hasProfile ? '#10b981' : 'rgb(148 163 184)' }}>
                {hasProfile ? '✓' : '—'}
              </p>
              <p style={{ margin: 0, fontSize: '0.65rem', color: 'rgb(148 163 184)' }}>Profile</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
