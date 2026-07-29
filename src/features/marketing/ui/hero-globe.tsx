'use client';

import { useEffect, useRef } from 'react';

/**
 * HeroGlobe — the rotating dot globe in the homepage hero.
 *
 * Replaces public/home-hero-globe.png, a 446KB static render. The mask this
 * samples is 6.8KB, so the moving version is the lighter one.
 *
 * ─── WHAT CHANGED FROM THE PROTOTYPE ────────────────────────────────────────
 *
 * NO RUNTIME DEPENDENCIES. The prototype fetched world-atlas from a CDN and
 * rasterised it in the browser with d3-geo and topojson-client. On the homepage
 * hero that is a third-party request plus two libraries on the critical path,
 * to produce a bitmap that never changes. scripts/build-globe-mask.mjs bakes it
 * once into public/hero-globe-land.png instead.
 *
 * COLOUR ARRIVES IN BLOOMS, NOT AS STATIC. This is the difference between the
 * prototype and something you want to look at. There, every dot flashed
 * independently on a 12%-per-frame coin flip, which is a precise description of
 * television static — the eye finds no pattern because there is none. Here a
 * bloom starts at one point and travels outward as a ring, so the colour reads
 * as a pulse crossing the surface. Same mechanism, one added variable
 * (distance from a centre), completely different feel.
 *
 * FIVE HUES, NOT TWENTY-ONE, and walked in order rather than drawn at random —
 * see --gb-globe-flash-* in tokens.css for why.
 *
 * IT STOPS WHEN NOBODY IS LOOKING. The prototype ran an unconditional
 * requestAnimationFrame loop. This one pauses when scrolled out of view, when
 * the tab is hidden, and entirely when the visitor prefers reduced motion — in
 * which case it draws a single still frame, because a hero with a hole in it is
 * not an accessibility win.
 *
 * NOT INTERACTIVE. The prototype had drag, wheel-zoom and click ripples. Drag
 * and wheel on a hero fight the page for the gesture, and on a phone that means
 * the globe eats your scroll. It rotates on its own and that is all.
 */

/** Degrees between sampled points. Smaller is denser and costs more. */
const LAT_STEP = 2.6;
const LAT_STEP_DENSE = 1.9;

/** Sampled band. Past ~84° the rows converge and add cost, not detail. */
const LAT_LIMIT = 84;

const ROTATION_PER_MS = 0.00007;

/** A bloom's life, and how far across the sphere its ring travels (radians). */
const BLOOM_MS = 2600;
const BLOOM_REACH = 1.5;
/**
 * Half-width of the lit ring, in radians.
 *
 * This is the number that decides whether the effect reads as a travelling
 * pulse or as a coloured wash. At 0.34 the band covered most of a hemisphere at
 * once, so the whole globe simply turned violet and the motion was invisible.
 * Narrow enough to see an edge, wide enough not to look like a hoop.
 */
const BLOOM_BAND = 0.2;
/** Several thin rings at once look richer than one thick one. */
const MAX_BLOOMS = 5;

type Point = {
  /** Unit vector on the sphere, unrotated. */
  x: number;
  y: number;
  z: number;
};

type Bloom = {
  x: number;
  y: number;
  z: number;
  start: number;
  colour: string;
};

function readPalette(el: HTMLElement): { dot: string; flashes: string[] } {
  const style = getComputedStyle(el);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const flashes = [1, 2, 3, 4, 5]
    .map((n) => read(`--gb-globe-flash-${n}`))
    .filter((c) => c.length > 0);

  return {
    dot: read('--gb-globe-dot') || 'white',
    // A visible fallback rather than an empty list: if the tokens ever fail to
    // resolve, the globe should still light up rather than silently going grey.
    flashes: flashes.length > 0 ? flashes : ['white'],
  };
}

/**
 * Points on the land, sampled from the baked equirectangular mask.
 *
 * The longitude step widens with latitude by 1/cos(lat) so the dots stay
 * roughly evenly spaced on the sphere instead of bunching at the poles, which
 * is what a fixed step gives and what makes a dot globe look like it has hair.
 */
function buildPoints(mask: ImageData, latStep: number): Point[] {
  const points: Point[] = [];
  const { width, height, data } = mask;

  for (let lat = LAT_LIMIT; lat >= -LAT_LIMIT; lat -= latStep) {
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const lonStep = Math.max(latStep / Math.max(cosLat, 0.22), latStep);

    const pixelY = Math.min(height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * height)));

    for (let lon = -180; lon < 180; lon += lonStep) {
      const pixelX = Math.min(width - 1, Math.max(0, Math.floor(((lon + 180) / 360) * width)));
      // The mask is greyscale-in-RGBA; one channel is enough.
      if (data[(pixelY * width + pixelX) * 4]! < 120) continue;

      const lonRad = (lon * Math.PI) / 180;
      points.push({
        x: cosLat * Math.sin(lonRad),
        y: sinLat,
        z: cosLat * Math.cos(lonRad),
      });
    }
  }

  return points;
}

export function HeroGlobe({ className }: { className?: string | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /*
     * All three are re-bound with an explicit type after the guard.
     *
     * The narrowing from `if (!x) return` does not reach the function
     * declarations below — TypeScript will not assume a closure runs after the
     * check that guarded it — so `resize` and `draw` see the nullable original
     * and every use is an error. Annotating the re-bind is what fixes it, and
     * it is why these look redundant.
     */
    const canvasEl = canvasRef.current;
    const wrapEl = wrapRef.current;
    if (!canvasEl || !wrapEl) return undefined;

    const contextEl = canvasEl.getContext('2d');
    if (!contextEl) return undefined;

    const canvas: HTMLCanvasElement = canvasEl;
    const wrap: HTMLDivElement = wrapEl;
    const ctx: CanvasRenderingContext2D = contextEl;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const palette = readPalette(wrap);

    let points: Point[] = [];
    let raf = 0;
    let disposed = false;
    let visible = true;
    let rotation = 0.6;
    let lastFrame = 0;
    let blooms: Bloom[] = [];
    let bloomCursor = 0;
    let size = 0;
    let dpr = 1;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const next = Math.max(1, Math.round(Math.min(rect.width, rect.height)));
      // Capped at 2: a phone at dpr 3 would otherwise do 2.25x the pixel work
      // for a difference nobody can see on a 400px globe.
      dpr = Math.min(2, window.devicePixelRatio || 1);
      size = next;
      canvas.width = Math.round(next * dpr);
      canvas.height = Math.round(next * dpr);
      canvas.style.width = `${next}px`;
      canvas.style.height = `${next}px`;
    }

    function spawnBloom(now: number) {
      // Walk the palette rather than drawing from it: consecutive blooms are
      // then adjacent hues, so two overlapping ones are always a near-pair.
      const colour = palette.flashes[bloomCursor % palette.flashes.length]!;
      bloomCursor += 1;

      // A uniformly random direction. Sampling lat/lon uniformly instead would
      // cluster the blooms at the poles.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - u * u));

      blooms.push({
        x: r * Math.cos(theta),
        y: u,
        z: r * Math.sin(theta),
        start: now,
        colour,
      });
    }

    function draw(now: number) {
      const centre = size / 2;
      const radius = size * 0.46;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cosY = Math.cos(rotation);
      const sinY = Math.sin(rotation);
      // A fixed tilt, so the poles are not dead centre and the land reads as a
      // globe rather than a disc.
      const tilt = 0.36;
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);

      const active = blooms;
      const dotSize = Math.max(1.5, size * 0.0062);

      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;

        // Spin about the pole, then tilt toward the viewer.
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        if (z2 < 0) continue; // Back of the sphere.

        const screenX = centre + x1 * radius;
        const screenY = centre - y2 * radius;

        // Atmosphere: dots fade toward the limb, which is what gives a flat
        // point cloud its roundness.
        const depth = 0.35 + 0.65 * Math.pow(z2, 0.5);

        // Brightest bloom wins, rather than blending several — overlapping
        // additive colour turns two brand hues into a muddy third.
        let best = 0;
        let bestColour = '';
        for (let b = 0; b < active.length; b++) {
          const bloom = active[b]!;
          const age = (now - bloom.start) / BLOOM_MS;
          if (age < 0 || age > 1) continue;

          const dot = p.x * bloom.x + p.y * bloom.y + p.z * bloom.z;
          const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
          const front = age * BLOOM_REACH;
          const offset = Math.abs(angle - front);
          if (offset > BLOOM_BAND) continue;

          // Across the ring: 1 at the front, 0 at the band edge.
          const across = 1 - offset / BLOOM_BAND;
          // Over its life: rises and falls, so a bloom never pops out.
          const life = Math.sin(age * Math.PI);
          const strength = across * across * life;
          if (strength > best) {
            best = strength;
            bestColour = bloom.colour;
          }
        }

        if (best > 0.01) {
          const lit = dotSize * (1 + 0.75 * best);
          ctx.globalAlpha = Math.min(1, depth * (0.55 + 0.45 * best));
          ctx.fillStyle = bestColour;
          ctx.shadowColor = bestColour;
          ctx.shadowBlur = 6 * best;
          ctx.beginPath();
          ctx.arc(screenX, screenY, lit / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.globalAlpha = depth * 0.6;
          ctx.fillStyle = palette.dot;
          ctx.beginPath();
          ctx.arc(screenX, screenY, dotSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    function frame(now: number) {
      if (disposed) return;

      if (visible) {
        // Advance by elapsed time, not per frame, so the spin runs at the same
        // speed on a 120Hz screen as on a 60Hz one. Clamped because a
        // backgrounded tab hands back a gap of seconds on its first frame.
        const elapsed = lastFrame === 0 ? 16 : Math.min(64, now - lastFrame);
        lastFrame = now;
        rotation += elapsed * ROTATION_PER_MS;

        blooms = blooms.filter((b) => now - b.start < BLOOM_MS);
        if (blooms.length < MAX_BLOOMS && Math.random() < 0.035) spawnBloom(now);

        draw(now);
      } else {
        lastFrame = 0;
      }

      raf = requestAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) draw(performance.now());
    });
    observer.observe(wrap);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
      },
      { rootMargin: '80px' },
    );
    io.observe(wrap);

    function onVisibility() {
      if (document.hidden) {
        visible = false;
      } else {
        visible = true;
        lastFrame = 0;
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    const image = new Image();
    image.decoding = 'async';
    image.src = '/hero-globe-land.png';

    image.onload = () => {
      if (disposed) return;

      const off = document.createElement('canvas');
      off.width = image.naturalWidth;
      off.height = image.naturalHeight;
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;
      offCtx.drawImage(image, 0, 0);

      // Denser on a big screen, where there is room to see it.
      const step = window.innerWidth >= 1024 ? LAT_STEP_DENSE : LAT_STEP;
      points = buildPoints(offCtx.getImageData(0, 0, off.width, off.height), step);

      resize();

      if (reduced) {
        // One frame, no loop, no blooms.
        draw(performance.now());
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      image.onload = null;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`relative aspect-square ${className ?? ''}`}
    >
      {/* A soft brand glow behind the sphere. Pure decoration, but it stops the
          dots reading as a flat scatter on the black band. */}
      <div
        className="pointer-events-none absolute inset-[18%] rounded-gb-full opacity-[0.18] blur-2xl"
        style={{ background: 'radial-gradient(circle, var(--gb-brand) 0%, transparent 70%)' }}
      />
      <canvas ref={canvasRef} className="relative block size-full" />
    </div>
  );
}
