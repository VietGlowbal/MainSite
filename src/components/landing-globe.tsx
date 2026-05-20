'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type ComponentType } from 'react';

export type LandingGlobeTheme = 'cosmos' | 'bloom' | 'electric' | 'aurora' | 'journey';

export type LandingGlobeHandle = {
  flyTo: (lat: number, lng: number, altitude: number, duration?: number) => void;
};

type Props = {
  theme?: LandingGlobeTheme;
  /** Fixed pixel size. Ignored when `responsive` is true. */
  size?: number;
  rotateSpeed?: number;
  /**
   * When true, the globe sizes itself to its parent container
   * (using ResizeObserver) and stays square. Useful for fluid layouts.
   */
  responsive?: boolean;
};

const themeConfigs: Record<LandingGlobeTheme, { atmosphere: string; alt: number; texture: string }> = {
  cosmos:   { atmosphere: 'rgba(56,189,248,0.42)',  alt: 0.22, texture: '//unpkg.com/three-globe/example/img/earth-night.jpg' },
  bloom:    { atmosphere: 'rgba(255,150,180,0.42)', alt: 0.14, texture: '//unpkg.com/three-globe/example/img/earth-day.jpg' },
  electric: { atmosphere: 'rgba(255,0,100,0.58)',   alt: 0.28, texture: '//unpkg.com/three-globe/example/img/earth-night.jpg' },
  aurora:   { atmosphere: 'rgba(100,255,180,0.48)', alt: 0.32, texture: '//unpkg.com/three-globe/example/img/earth-night.jpg' },
  journey:  { atmosphere: 'rgba(186,230,253,0.45)', alt: 0.18, texture: '//unpkg.com/three-globe/example/img/earth-day.jpg' },
};

export const LandingGlobe = forwardRef<LandingGlobeHandle, Props>(function LandingGlobe(
  { theme = 'cosmos', size = 500, rotateSpeed = 0.5, responsive = false },
  ref,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GlobeComp, setGlobeComp] = useState<ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number>(size);
  const cfg = themeConfigs[theme];

  useEffect(() => {
    import('react-globe.gl').then((mod) => setGlobeComp(() => mod.default));
  }, []);

  useEffect(() => {
    if (!responsive) {
      setMeasured(size);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = Math.max(160, Math.round(Math.min(rect.width, rect.height || rect.width)));
      setMeasured(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, size]);

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

  // Outer wrapper keeps a square aspect ratio when responsive.
  const wrapperStyle: React.CSSProperties = responsive
    ? { width: '100%', aspectRatio: '1 / 1', display: 'block' }
    : { width: size, height: size };

  if (!GlobeComp) {
    return <div ref={wrapRef} style={wrapperStyle} />;
  }

  return (
    <div ref={wrapRef} style={wrapperStyle}>
      <GlobeComp
        ref={globeRef}
        width={measured}
        height={measured}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor={cfg.atmosphere}
        atmosphereAltitude={cfg.alt}
        globeImageUrl={cfg.texture}
        onGlobeReady={onReady}
        enablePointerInteraction={false}
      />
    </div>
  );
});
