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
 * FIVE HUES, NOT TWENTY-ONE. The prototype mixed neon red, electric blue,
 * matrix green and solar gold, every colour clashing with its neighbour. See
 * --gb-globe-flash-* in tokens.css.
 *
 * IT STOPS WHEN NOBODY IS LOOKING. The prototype ran an unconditional
 * requestAnimationFrame loop. This one pauses when scrolled out of view, when
 * the tab is hidden, and entirely when the visitor prefers reduced motion — in
 * which case it draws a single still frame, because a hero with a hole in it is
 * not an accessibility win.
 *
 * NOT INTERACTIVE. The prototype had drag, wheel-zoom and click ripples. Drag
 * and wheel on a hero fight the page for the gesture, and on a phone that means
 * the globe eats your scroll.
 */

/** Degrees between sampled latitude rows. Smaller is denser and costs more. */
const LAT_STEP = 2.6;
const LAT_STEP_DENSE = 1.9;

/** Sampled band. Past ~84° the rows converge and add cost, not detail. */
const LAT_LIMIT = 84;

const ROTATION_PER_MS = 0.00007;

/* ─────────────────────────────────────────────────────────────────────────
   Flashes

   Individual dots lighting at random, which is what the brief asked for after
   the first build. That one sent expanding rings of colour across the surface;
   correct to the letter of "animated", but with several rings alive at once it
   read as a light show rather than as a globe with something happening on it.

   Single dots, sparsely, with a long gentle curve. The intensity knob is
   CONCURRENT_FRACTION: the share of dots lit at any moment. It is a fraction
   rather than a count so density changes do not change the look.
   ───────────────────────────────────────────────────────────────────────── */

const FLASH_MS = 2600;
/** Share of dots lit at once. 0.015 is a scattering; 0.05 is a light show. */
const CONCURRENT_FRACTION = 0.014;
/** Peak size multiplier. Enough to notice, not enough to bulge. */
const FLASH_GROWTH = 0.55;

/** How far the globe tips as the hero scrolls away, in radians. */
const SCROLL_TILT = 0.34;
const BASE_TILT = 0.34;

type Point = {
  /** Unit vector on the sphere, unrotated. */
  x: number;
  y: number;
  z: number;
  /** performance.now() when this dot last lit, or 0. */
  flashStart: number;
  flashColour: string;
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
 * TWO THINGS HERE ARE EASY TO GET WRONG, and the first build got both.
 *
 * 1. A ROW HAS TO CLOSE. Walking `lon += step` from -180 while `lon < 180`
 *    only lands evenly if the step divides 360, and `latStep / cos(lat)` almost
 *    never does. The last dot of each row therefore sat an arbitrary fraction of
 *    a step from where the row began, leaving a seam of mis-spaced dots running
 *    pole to pole — which swept across the visible face as the globe turned and
 *    read as the dots being out of line. Rounding to a whole number of dots and
 *    dividing 360 by THAT makes every row exactly periodic.
 *
 * 2. ROWS MUST NOT SHARE A STARTING LONGITUDE. With every row beginning at
 *    -180, neighbouring rows have near-equal steps and their dots stack into
 *    vertical columns — a moiré that makes a sphere look like a grid draped over
 *    one. Offsetting each row by the golden ratio is the standard fix: the
 *    sequence never repeats, so no two rows ever line up.
 *
 * The longitude step still widens by 1/cos(lat) so dots stay roughly evenly
 * spaced on the sphere rather than bunching at the poles.
 */
const GOLDEN = 0.6180339887498949;

function buildPoints(mask: ImageData, latStep: number): Point[] {
  const points: Point[] = [];
  const { width, height, data } = mask;

  let row = 0;
  for (let lat = LAT_LIMIT; lat >= -LAT_LIMIT; lat -= latStep) {
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);

    const wanted = Math.max(latStep, latStep / Math.max(cosLat, 0.22));
    // A whole number of dots around the parallel, so the row closes on itself.
    const count = Math.max(3, Math.round(360 / wanted));
    const step = 360 / count;
    // Irrational offset per row: no two rows line up into a column.
    const phase = ((row * GOLDEN) % 1) * step;
    row += 1;

    const pixelY = Math.min(height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * height)));

    for (let i = 0; i < count; i++) {
      const lon = -180 + phase + i * step;
      const pixelX = Math.min(
        width - 1,
        Math.max(0, Math.floor((((lon + 540) % 360) / 360) * width)),
      );
      // The mask is greyscale-in-RGBA; one channel is enough.
      if (data[(pixelY * width + pixelX) * 4]! < 120) continue;

      const lonRad = (lon * Math.PI) / 180;
      points.push({
        x: cosLat * Math.sin(lonRad),
        y: sinLat,
        z: cosLat * Math.cos(lonRad),
        flashStart: 0,
        flashColour: '',
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
    let flashCursor = 0;
    /** Carries the fractional part of "dots to light this frame" across frames. */
    let spawnDebt = 0;
    let size = 0;
    let dpr = 1;
    /** Where the page is scrolled, and the eased value the globe actually uses. */
    let scrollTarget = 0;
    let scrollEased = 0;

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

    /**
     * Scroll progress, 0 at the top and 1 once the hero is a viewport away.
     *
     * Read from a listener rather than inside the draw loop so the layout is not
     * queried every frame, and eased toward rather than applied raw — a tilt
     * bound directly to scrollY jitters with every wheel notch.
     */
    function onScroll() {
      const h = window.innerHeight || 1;
      scrollTarget = Math.min(1, Math.max(0, window.scrollY / h));
    }

    function lightDots(now: number, count: number) {
      if (points.length === 0) return;
      for (let i = 0; i < count; i++) {
        // Walk the palette rather than drawing from it, so the mix on screen
        // stays even instead of clumping onto one hue by chance.
        const colour = palette.flashes[flashCursor % palette.flashes.length]!;
        flashCursor += 1;

        const p = points[Math.floor(Math.random() * points.length)]!;
        // Skip one already lit: restarting it mid-curve is a visible stutter.
        if (now - p.flashStart < FLASH_MS) continue;
        p.flashStart = now;
        p.flashColour = colour;
      }
    }

    function draw(now: number) {
      const centre = size / 2;
      const radius = size * 0.46;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cosY = Math.cos(rotation);
      const sinY = Math.sin(rotation);
      // Base tilt keeps the poles off centre so the land reads as a globe rather
      // than a disc; the scrolled part tips it further as the hero leaves.
      const tilt = BASE_TILT + scrollEased * SCROLL_TILT;
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);

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

        let lit = 0;
        if (p.flashStart > 0) {
          const age = (now - p.flashStart) / FLASH_MS;
          // sin gives a symmetrical rise and fall, so nothing pops in or out.
          if (age > 0 && age < 1) lit = Math.sin(age * Math.PI);
        }

        if (lit > 0.01) {
          const s = dotSize * (1 + FLASH_GROWTH * lit);
          ctx.globalAlpha = Math.min(1, depth * (0.5 + 0.5 * lit));
          ctx.fillStyle = p.flashColour;
          ctx.shadowColor = p.flashColour;
          ctx.shadowBlur = 5 * lit;
          ctx.beginPath();
          ctx.arc(screenX, screenY, s / 2, 0, Math.PI * 2);
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
        scrollEased += (scrollTarget - scrollEased) * Math.min(1, elapsed / 220);

        // Rate that holds CONCURRENT_FRACTION of the dots lit: each lives
        // FLASH_MS, so lighting (fraction * count / FLASH_MS) per ms sustains it.
        spawnDebt += (elapsed * points.length * CONCURRENT_FRACTION) / FLASH_MS;
        const toLight = Math.floor(spawnDebt);
        if (toLight > 0) {
          spawnDebt -= toLight;
          lightDots(now, toLight);
        }

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

    // Scroll-linked motion is precisely what reduced motion asks us not to do,
    // so the listener is only attached when motion is welcome.
    if (!reduced) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

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
        // One frame, no loop, no flashes.
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
      window.removeEventListener('scroll', onScroll);
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
