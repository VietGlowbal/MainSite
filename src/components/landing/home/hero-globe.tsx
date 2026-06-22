'use client';

import dynamic from 'next/dynamic';

/**
 * HeroGlobe — client island that renders the spinning globe in the home hero.
 *
 * LandingGlobe is a canvas/three.js component, so it must be dynamically
 * imported with `ssr: false`. That can't live directly in the home page
 * (a Server Component), hence this tiny wrapper. Mirrors the onboarding usage:
 * the "marble" (true-colour Earth) theme, responsive sizing, gentle rotation.
 */
const LandingGlobe = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false, loading: () => <div className="aspect-square w-full rounded-full bg-pink-50/40" /> },
);

export function HeroGlobe() {
  return (
    <div className="mx-auto aspect-square w-full max-w-md">
      <LandingGlobe theme="marble" responsive rotateSpeed={0.4} />
    </div>
  );
}
