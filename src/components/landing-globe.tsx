'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type ComponentType } from 'react';

export type LandingGlobeTheme = 'cosmos' | 'bloom' | 'electric' | 'aurora' | 'journey';

export type LandingGlobeHandle = {
  flyTo: (lat: number, lng: number, altitude: number, duration?: number) => void;
};

type Props = {
  theme?: LandingGlobeTheme;
  size?: number;
  rotateSpeed?: number;
};

const themeConfigs: Record<LandingGlobeTheme, { atmosphere: string; alt: number; texture: string }> = {
  cosmos:   { atmosphere: 'rgba(56,189,248,0.42)',  alt: 0.22, texture: '//unpkg.com/three-globe/example/img/earth-night.jpg' },
  bloom:    { atmosphere: 'rgba(255,150,180,0.42)', alt: 0.14, texture: '//unpkg.com/three-globe/example/img/earth-day.jpg' },
  electric: { atmosphere: 'rgba(255,0,100,0.58)',   alt: 0.28, texture: '//unpkg.com/three-globe/example/img/earth-night.jpg' },
  aurora:   { atmosphere: 'rgba(100,255,180,0.48)', alt: 0.32, texture: '//unpkg.com/three-globe/example/img/earth-night.jpg' },
  journey:  { atmosphere: 'rgba(186,230,253,0.45)', alt: 0.18, texture: '//unpkg.com/three-globe/example/img/earth-day.jpg' },
};

export const LandingGlobe = forwardRef<LandingGlobeHandle, Props>(function LandingGlobe(
  { theme = 'cosmos', size = 500, rotateSpeed = 0.5 },
  ref,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GlobeComp, setGlobeComp] = useState<ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(undefined);
  const cfg = themeConfigs[theme];

  useEffect(() => {
    import('react-globe.gl').then((mod) => setGlobeComp(() => mod.default));
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lng, altitude, duration = 1000) {
      globeRef.current?.pointOfView({ lat, lng, altitude }, duration);
    },
  }));

  function onReady() {
    if (!globeRef.current) return;
    globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: 1.8 }, 0);
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = rotateSpeed;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;
  }

  if (!GlobeComp) return <div style={{ width: size, height: size }} />;

  return (
    <GlobeComp
      ref={globeRef}
      width={size}
      height={size}
      backgroundColor="rgba(0,0,0,0)"
      showAtmosphere
      atmosphereColor={cfg.atmosphere}
      atmosphereAltitude={cfg.alt}
      globeImageUrl={cfg.texture}
      onGlobeReady={onReady}
      enablePointerInteraction={false}
    />
  );
});
