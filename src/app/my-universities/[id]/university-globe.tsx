'use client';

import dynamic from 'next/dynamic';

const LandingGlobe = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false, loading: () => <div className="h-full w-full" /> },
);

// Map countries to approximate lat/lng for the globe to focus on
const countryCoords: Record<string, { lat: number; lng: number }> = {
  'United Kingdom': { lat: 54, lng: -2 },
  'United States': { lat: 38, lng: -97 },
  Canada: { lat: 56, lng: -106 },
  Australia: { lat: -25, lng: 134 },
  Germany: { lat: 51, lng: 10 },
  France: { lat: 46, lng: 2 },
  Netherlands: { lat: 52, lng: 5 },
  Japan: { lat: 36, lng: 138 },
  Singapore: { lat: 1, lng: 104 },
  'South Korea': { lat: 36, lng: 128 },
  China: { lat: 35, lng: 105 },
  India: { lat: 20, lng: 77 },
  Italy: { lat: 42, lng: 12 },
  Spain: { lat: 40, lng: -4 },
  Sweden: { lat: 62, lng: 15 },
  Switzerland: { lat: 47, lng: 8 },
  Ireland: { lat: 53, lng: -8 },
  'New Zealand': { lat: -41, lng: 174 },
  'United Arab Emirates': { lat: 24, lng: 54 },
  Qatar: { lat: 25, lng: 51 },
  'Hong Kong': { lat: 22, lng: 114 },
  Brazil: { lat: -14, lng: -51 },
  Mexico: { lat: 23, lng: -102 },
};

type Props = {
  country?: string | null;
};

export function UniversityGlobe({ country }: Props) {
  return (
    <div className="h-full w-full">
      <LandingGlobe theme="marble" size={280} rotateSpeed={0.3} />
    </div>
  );
}
