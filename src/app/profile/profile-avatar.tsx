'use client';

import { useEffect, useState } from 'react';
import { useScroll } from 'framer-motion';

const GRADIENT_STOPS = [
  ['#ff4d8c', '#00b4d8'],
  ['#ff4d8c', '#a855f7'],
  ['#f97316', '#ff4d8c'],
  ['#00b4d8', '#a855f7'],
  ['#10b981', '#00b4d8'],
];

interface Props {
  displayName: string;
  initials: string;
  avatarUrl?: string;
}

export function ProfileAvatar({ displayName, initials, avatarUrl }: Props) {
  const { scrollY } = useScroll();
  const [gradientIndex, setGradientIndex] = useState(0);

  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setGradientIndex(Math.floor(y / 300) % GRADIENT_STOPS.length);
    });
  }, [scrollY]);

  const [from, to] = GRADIENT_STOPS[gradientIndex];

  return (
    <div
      className="shrink-0"
      style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        padding: 3,
        transition: 'background 0.6s ease',
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={displayName} className="profile-avatar-img" />
      ) : (
        <span
          className="profile-avatar-initials"
          aria-label={displayName}
          style={{ color: from }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
