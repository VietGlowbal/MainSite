'use client';

import { useEffect, useState } from 'react';
import { useScroll } from 'framer-motion';

interface Props {
  displayName: string;
  initials: string;
  avatarUrl?: string;
}

export function ProfileAvatar({ displayName, initials, avatarUrl }: Props) {
  const { scrollY } = useScroll();
  const [deg, setDeg] = useState(135);

  useEffect(() => {
    return scrollY.on('change', (y: number) => {
      setDeg((y / 2) % 360);
    });
  }, [scrollY]);

  const gradient = `linear-gradient(${deg}deg, #ff4d8c, #00b4d8)`;

  return (
    <div
      className="shrink-0"
      style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        background: gradient,
        padding: 3,
        transition: 'background 0.1s linear',
      }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={displayName} className="profile-avatar-img" />
      ) : (
        <span className="profile-avatar-initials" aria-label={displayName}>
          {initials}
        </span>
      )}
    </div>
  );
}
