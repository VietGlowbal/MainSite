'use client';

import { useEffect, useRef, useState } from 'react';
import { TID, testId } from '@/shared/lib/testids';
import { getLocaleText, type Locale } from '@/lib/i18n/locale';
import { GLOBE_COUNTRY_INDEX, GLOBE_COUNTRY_MASK_SRC } from '../domain/globe-country-index';
import { globeCountryName, type GlobeCountry } from '../domain/home-globe';

/**
 * HeroGlobe — the draggable dot globe in the homepage hero.
 *
 * Replaces public/home-hero-globe.png, a 446KB static render. The two masks it
 * samples (land ~84KB, countries ~14KB) are still lighter than that one image.
 *
 * ─── SALES-JOURNEY REDESIGN (2026-09-27): THE COLOUR NOW MEANS SOMETHING ────
 *
 * Land is neutral grey, and ONLY the countries GlowBal has scholarship data for
 * light up — in rose-500, with a soft halo — passed in as `countries` from
 * `ScholarshipQueries.countryCounts()`. Hovering (or tapping) a lit dot shows
 * "Country · N scholarships" with the real count. This replaces the earlier
 * five-hue random flashing: the brief allows rose as the only accent, and a
 * globe that lights up at random says nothing, while one that lights where the
 * data is says "we cover these".
 *
 * A dot's country comes from public/hero-globe-countries.png, baked by
 * scripts/build-globe-countries.mjs: every country painted in its own flat grey
 * level. One pixel lookup per dot, and borders fall where borders are — the
 * design prototype's lat/lon boxes lit half of northern Mexico as "United
 * States". Two small cases are handled here, not in the bake:
 *
 *  - A COASTAL DOT can sit on a sea pixel: the land sampler keeps a dot when
 *    30% of its cell is land (see LAND_COVERAGE), so its centre may be off
 *    shore. Those look a little around the centre before giving up.
 *  - A COUNTRY SMALLER THAN A DOT (Singapore, Hong Kong) never gets one. A lit
 *    country with no dot gets a single dot at its baked centroid, so the data
 *    is never silently missing from the map.
 *
 * The random "twinkle" survives, but only on lit dots and only in rose, so the
 * globe still feels alive without reintroducing colour that means nothing.
 *
 * ─── CARRIED OVER ───────────────────────────────────────────────────────────
 *
 * NO RUNTIME DEPENDENCIES — both masks are baked offline. IT STOPS WHEN NOBODY
 * IS LOOKING: paused off screen and on a hidden tab, and under reduced motion it
 * draws still frames on demand (drag still works — a globe that turns exactly as
 * far as you pull it is motion the visitor is asking for). IT IS DRAGGABLE, with
 * `touch-action: pan-y` so a vertical swipe still scrolls the page. IT GROWS IN
 * on mount, driven through `radius` in `draw()` rather than a CSS transform, so
 * `resize()` never measures a shrunken mid-transition rect.
 *
 * ⚠️ IT IS DOTS AND NOTHING ELSE. A filled ocean sphere was tried and taken out
 * on sight by the owner — at hero size it read as a blue ball with specks on it.
 * Roundness comes from the dots' depth falloff. Do not add a background.
 */

/** Degrees between sampled latitude rows. Desktop gets the denser grid. */
const LAT_STEP = 2.3;
const LAT_STEP_DENSE = 1.7;

/**
 * How much of a dot's cell must be land for the dot to exist. Averaging the
 * whole cell rather than point-sampling its centre is the fix for dots adrift in
 * open ocean and gaps on real land (Panama); 0.3 keeps Iceland, Sri Lanka,
 * Taiwan and New Zealand's South Island.
 */
const LAND_COVERAGE = 0.3;

/** 0.0086°/ms, the handoff's auto-spin. */
const ROTATION_PER_MS = 0.00015;

/* ── Intro: grow, fade and a fast spin that settles ──────────────────────── */

const INTRO_MS = 320;
const INTRO_SCALE_FROM = 0.62;
const INTRO_SPIN = 0.0016;
/** Steeper than FLICK_DECAY so the intro burst settles with the grow, not after it. */
const INTRO_SPIN_DECAY = 0.8;

/* ── Twinkle on lit dots ─────────────────────────────────────────────────── */

const FLASH_MS = 2600;
/** Share of LIT dots twinkling at once. */
const CONCURRENT_FRACTION = 0.08;
const HOVER_FLASH_BOOST = 1.6;
const FLASH_GROWTH = 0.6;

/** How far the globe tips as the hero scrolls away, in radians. */
const SCROLL_TILT = 0.34;
/** Resting tilt: none, so the equator runs through the canvas centre at rest. */
const BASE_TILT = 0;

/* ── Drag ──────────────────────────────────────────────────────────────── */

const DRAG_RADIANS_PER_PX = 0.0075;
const TILT_LIMIT = 0.95;
const MAX_FLICK = 0.0022;
const FLICK_DECAY = 0.94;
/** Movement under this (px) between down and up is a tap, not a drag. */
const TAP_SLOP_PX = 5;

/* ── Tooltip ───────────────────────────────────────────────────────────── */

/** The handoff's hit radius around a lit dot. */
const HIT_RADIUS_PX = 12;
/** Lit dots this close to the limb are too foreshortened to point at. */
const HIT_MIN_DEPTH = 0.25;
/** How long a tapped tooltip stays up on touch, where there is no hover-out. */
const TAP_TOOLTIP_MS = 2500;

/** Upper left and mostly frontal; kept gentle — see `shade` in `draw`. */
const LIGHT = (() => {
  const [x, y, z] = [-0.42, 0.4, 0.82];
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
})();

type Point = {
  /** Unit vector on the sphere, unrotated. */
  x: number;
  y: number;
  z: number;
  lat: number;
  lon: number;
  /** Index into the lit-country list, or -1. */
  lit: number;
  /** performance.now() when this dot last twinkled, or 0. */
  flashStart: number;
};

type Palette = { land: string; lit: string };

type Tooltip = { readonly lit: number; readonly x: number; readonly y: number };

function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const read = (name: string) => style.getPropertyValue(name).trim();
  return {
    land: read('--gb-globe-land') || 'grey',
    // A visible fallback: if the token ever fails to resolve, the data should
    // still show rather than going silently grey.
    lit: read('--gb-globe-lit') || 'red',
  };
}

/**
 * Mean land coverage of one lat/lon cell, 0 (all sea) to 1 (all land). The mask
 * is anti-aliased on purpose, so averaging a cell gives a real area estimate.
 */
function coverage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lat: number,
  latSpan: number,
  lon: number,
  lonSpan: number,
): number {
  const top = ((90 - (lat + latSpan / 2)) / 180) * height;
  const bottom = ((90 - (lat - latSpan / 2)) / 180) * height;
  const y0 = Math.min(height - 1, Math.max(0, Math.floor(top)));
  const y1 = Math.min(height - 1, Math.max(y0, Math.ceil(bottom) - 1));

  const x0 = Math.floor((((lon - lonSpan / 2 + 540) % 360) / 360) * width);
  const cols = Math.max(1, Math.round((lonSpan / 360) * width));

  let sum = 0;
  let samples = 0;
  for (let y = y0; y <= y1; y++) {
    const rowOffset = y * width;
    for (let c = 0; c < cols; c++) {
      sum += data[(rowOffset + ((x0 + c) % width)) * 4]!;
      samples += 1;
    }
  }
  return samples === 0 ? 0 : sum / (samples * 255);
}

function unitVector(lat: number, lon: number): { x: number; y: number; z: number } {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  return { x: cosLat * Math.sin(lonRad), y: Math.sin(latRad), z: cosLat * Math.cos(lonRad) };
}

/**
 * Points on the land, sampled from the baked equirectangular mask. Rows close
 * exactly (a whole number of dots per parallel), alternate rows are offset half
 * a step for a hexagonal packing that keeps coastlines crisp, and the band runs
 * pole to pole so Antarctica is not sliced flat.
 */
function buildPoints(mask: ImageData, latStep: number): Point[] {
  const points: Point[] = [];
  const { width, height, data } = mask;

  const rows = Math.max(2, Math.round(180 / latStep));
  const rowStep = 180 / rows;

  for (let row = 0; row <= rows; row++) {
    const lat = 90 - row * rowStep;
    const cosLat = Math.max(0, Math.cos((lat * Math.PI) / 180));

    const count = Math.max(1, Math.round((360 * cosLat) / rowStep));
    const step = 360 / count;
    const phase = row % 2 === 0 ? 0 : step / 2;
    const lonSpan = Math.min(step, rowStep * 1.5);

    for (let i = 0; i < count; i++) {
      const lon = -180 + phase + i * step;
      if (coverage(data, width, height, lat, rowStep, lon, lonSpan) < LAND_COVERAGE) continue;
      points.push({ ...unitVector(lat, lon), lat, lon, lit: -1, flashStart: 0 });
    }
  }

  return points;
}

/** The country-mask index under a lat/lon, or 0 for sea. */
function countryIndexAt(mask: ImageData, lat: number, lon: number): number {
  const { width, height, data } = mask;
  const x = Math.min(width - 1, Math.max(0, Math.floor((((lon + 540) % 360) / 360) * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * height)));
  return data[(y * width + x) * 4]!;
}

/** Offsets (degrees) tried around a coastal dot whose centre lands on sea. */
const COAST_PROBES: ReadonlyArray<readonly [number, number]> = [
  [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6],
];

/**
 * Tag every dot with its lit-country index, and add one dot for any lit country
 * too small to have received one. Mutates and returns `points`.
 */
function classifyPoints(points: Point[], mask: ImageData, litByName: ReadonlyMap<string, number>): Point[] {
  const covered = new Set<number>();
  for (const point of points) {
    let index = countryIndexAt(mask, point.lat, point.lon);
    for (let probe = 0; index === 0 && probe < COAST_PROBES.length; probe++) {
      const [dLat, dLon] = COAST_PROBES[probe]!;
      index = countryIndexAt(mask, point.lat + dLat, point.lon + dLon);
    }
    const name = GLOBE_COUNTRY_INDEX[index]?.name;
    const lit = name === undefined ? undefined : litByName.get(name);
    point.lit = lit ?? -1;
    if (lit !== undefined) covered.add(lit);
  }

  for (const [name, lit] of litByName) {
    if (covered.has(lit)) continue;
    const entry = GLOBE_COUNTRY_INDEX.find((candidate) => candidate?.name === name);
    if (!entry) continue;
    points.push({ ...unitVector(entry.lat, entry.lon), lat: entry.lat, lon: entry.lon, lit, flashStart: 0 });
  }
  return points;
}

function loadImageData(src: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const off = document.createElement('canvas');
      off.width = image.naturalWidth;
      off.height = image.naturalHeight;
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return resolve(null);
      offCtx.drawImage(image, 0, 0);
      resolve(offCtx.getImageData(0, 0, off.width, off.height));
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export function HeroGlobe({
  className,
  countries = [],
  locale = 'en',
}: {
  className?: string | undefined;
  /** Countries to light, with their scholarship counts. Empty = a plain grey globe. */
  countries?: readonly GlobeCountry[] | undefined;
  locale?: Locale | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  /* Read once when the masks load. The list comes from a cached server read and
     does not change while the page is open, so the effect need not re-run. */
  const countriesRef = useRef(countries);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const wrapEl = wrapRef.current;
    if (!canvasEl || !wrapEl) return undefined;

    const contextEl = canvasEl.getContext('2d');
    if (!contextEl) return undefined;

    /* Re-bound with explicit types: narrowing from the guard above does not
       reach the closures below. */
    const canvas: HTMLCanvasElement = canvasEl;
    const wrap: HTMLDivElement = wrapEl;
    const ctx: CanvasRenderingContext2D = contextEl;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const palette = readPalette(wrap);
    const litByName = new Map(countriesRef.current.map((country, index) => [country.name, index]));

    let points: Point[] = [];
    let litPoints: Point[] = [];
    /** Screen positions of front-facing lit dots, rebuilt every draw, for hit-testing. */
    const targets: Array<{ x: number; y: number; lit: number }> = [];
    let raf = 0;
    let disposed = false;
    let visible = true;
    let ready = false;
    let rotation = 0.6;
    let lastFrame = 0;
    let spawnDebt = 0;
    let size = 0;
    let dpr = 1;
    let introStart = -1;
    let introEase = reduced ? 1 : 0;
    let scrollTarget = 0;
    let scrollEased = 0;

    let spin = ROTATION_PER_MS;
    let tiltDrag = 0;
    let dragging = false;
    let dragPointer = -1;
    let dragX = 0;
    let dragY = 0;
    let dragAt = 0;
    let dragVelocity = 0;
    let dragTravel = 0;
    let hover = 0;
    let hoverTarget = 0;
    /** The lit country under the pointer, or -1. Pauses the auto-spin while set. */
    let pointedAt = -1;
    let tapTimer: ReturnType<typeof setTimeout> | null = null;

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const next = Math.max(1, Math.round(Math.min(rect.width, rect.height)));
      // Capped at 2: dpr 3 is 2.25x the pixel work for no visible difference.
      dpr = Math.min(2, window.devicePixelRatio || 1);
      size = next;
      canvas.width = Math.round(next * dpr);
      canvas.height = Math.round(next * dpr);
      canvas.style.width = `${next}px`;
      canvas.style.height = `${next}px`;
    }

    function onScroll() {
      const h = window.innerHeight || 1;
      scrollTarget = Math.min(1, Math.max(0, window.scrollY / h));
    }

    function twinkle(now: number, count: number) {
      if (litPoints.length === 0) return;
      for (let i = 0; i < count; i++) {
        const p = litPoints[Math.floor(Math.random() * litPoints.length)]!;
        if (now - p.flashStart < FLASH_MS) continue;
        p.flashStart = now;
      }
    }

    function draw(now: number) {
      const centre = size / 2;
      const radius = size * 0.46 * (INTRO_SCALE_FROM + (1 - INTRO_SCALE_FROM) * introEase);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cosY = Math.cos(rotation);
      const sinY = Math.sin(rotation);
      const tilt = BASE_TILT + tiltDrag + scrollEased * SCROLL_TILT;
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);

      const dotSize = Math.max(1.5, size * 0.0062);
      targets.length = 0;

      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;

        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        if (z2 < 0) continue; // Back of the sphere.

        const screenX = centre + x1 * radius;
        const screenY = centre - y2 * radius;

        /* Depth fades dots toward the limb (the only thing making bare dots read
           as round); a narrow Lambert term models the light without thinning
           one side into a crescent. */
        const depth = 0.35 + 0.65 * Math.sqrt(z2);
        const lambert = Math.max(0, x1 * LIGHT.x + y2 * LIGHT.y + z2 * LIGHT.z);
        const shade = depth * (0.7 + 0.3 * lambert) * (1 + 0.12 * hover);

        if (p.lit < 0) {
          ctx.globalAlpha = Math.min(1, shade * 0.85) * introEase;
          ctx.fillStyle = palette.land;
          ctx.beginPath();
          ctx.arc(screenX, screenY, dotSize / 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        let glow = 0;
        if (p.flashStart > 0) {
          const age = (now - p.flashStart) / FLASH_MS;
          if (age > 0 && age < 1) glow = Math.sin(age * Math.PI);
        }
        const pointed = p.lit === pointedAt;
        // A lit dot keeps a floor of its own brightness so the night side of the
        // globe still shows where the data is.
        const alpha = Math.min(1, Math.max(shade, depth * 0.9)) * introEase;

        /* Halo: the handoff's 4.2px at 28% was drawn on a 2.1° grid. On the
           denser 1.7° desktop grid a halo that size overlaps its neighbours and
           a whole country fuses into one rose blob, so it stays inside roughly
           half the dot spacing — each lit country still reads as dots. */
        ctx.globalAlpha = alpha * (pointed ? 0.4 : 0.22);
        ctx.fillStyle = palette.lit;
        ctx.beginPath();
        ctx.arc(screenX, screenY, dotSize * 1.05 * (0.6 + z2 * 0.4), 0, Math.PI * 2);
        ctx.fill();

        const core = dotSize * 0.6 * (1 + FLASH_GROWTH * glow + (pointed ? 0.4 : 0));
        ctx.globalAlpha = alpha;
        ctx.shadowColor = palette.lit;
        ctx.shadowBlur = 8 * glow;
        ctx.beginPath();
        ctx.arc(screenX, screenY, core, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (z2 > HIT_MIN_DEPTH) targets.push({ x: screenX, y: screenY, lit: p.lit });
      }

      ctx.restore();
    }

    function frame(now: number) {
      if (disposed) return;

      if (visible) {
        const elapsed = lastFrame === 0 ? 16 : Math.min(64, now - lastFrame);
        lastFrame = now;

        if (introStart < 0) introStart = now;
        const introT = Math.min(1, (now - introStart) / INTRO_MS);
        introEase = 1 - (1 - introT) ** 3;

        hover += (hoverTarget - hover) * Math.min(1, elapsed / 180);

        if (!dragging) {
          const decay = introT < 1 ? INTRO_SPIN_DECAY : FLICK_DECAY;
          spin = ROTATION_PER_MS + (spin - ROTATION_PER_MS) * decay ** (elapsed / 16);
          // Hold still while a country is pointed at, so its tooltip stays on it.
          if (pointedAt < 0) rotation += elapsed * spin;
        }
        scrollEased += (scrollTarget - scrollEased) * Math.min(1, elapsed / 220);

        const share = CONCURRENT_FRACTION * (1 + (HOVER_FLASH_BOOST - 1) * hover);
        spawnDebt += (elapsed * litPoints.length * share) / FLASH_MS;
        const toLight = Math.floor(spawnDebt);
        if (toLight > 0) {
          spawnDebt -= toLight;
          twinkle(now, toLight);
        }

        draw(now);
      } else {
        lastFrame = 0;
      }

      raf = requestAnimationFrame(frame);
    }

    function drawOnce() {
      if (ready) draw(performance.now());
    }

    /* ── Tooltip ────────────────────────────────────────────────────────── */

    function hitTest(clientX: number, clientY: number): Tooltip | null {
      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let best: Tooltip | null = null;
      let bestDistance = HIT_RADIUS_PX;
      for (const target of targets) {
        const distance = Math.hypot(target.x - x, target.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { lit: target.lit, x: target.x, y: target.y };
        }
      }
      return best;
    }

    function point(next: Tooltip | null) {
      const nextLit = next?.lit ?? -1;
      if (nextLit === pointedAt) return;
      pointedAt = nextLit;
      setTooltip(next);
      if (reduced) drawOnce();
    }

    /* ── Pointer ────────────────────────────────────────────────────────── */

    function onPointerDown(event: PointerEvent) {
      if (!ready || dragging || !event.isPrimary) return;
      dragging = true;
      dragPointer = event.pointerId;
      dragX = event.clientX;
      dragY = event.clientY;
      dragAt = event.timeStamp;
      dragVelocity = 0;
      dragTravel = 0;
      wrap.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging) {
        if (event.pointerType === 'mouse' && ready) point(hitTest(event.clientX, event.clientY));
        return;
      }
      if (event.pointerId !== dragPointer) return;

      const dx = event.clientX - dragX;
      const dy = event.clientY - dragY;
      const dt = Math.max(1, event.timeStamp - dragAt);
      dragX = event.clientX;
      dragY = event.clientY;
      dragAt = event.timeStamp;
      dragTravel += Math.hypot(dx, dy);

      if (dragTravel > TAP_SLOP_PX) point(null);
      rotation += dx * DRAG_RADIANS_PER_PX;
      // Pulling down tips the front face down, bringing the north pole into view.
      tiltDrag = Math.min(
        TILT_LIMIT - BASE_TILT,
        Math.max(-TILT_LIMIT - BASE_TILT, tiltDrag + dy * DRAG_RADIANS_PER_PX),
      );
      dragVelocity = (dx * DRAG_RADIANS_PER_PX) / dt;

      if (reduced) drawOnce();
    }

    function endDrag(event: PointerEvent) {
      if (!dragging || event.pointerId !== dragPointer) return;
      dragging = false;
      dragPointer = -1;
      if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);

      if (dragTravel <= TAP_SLOP_PX && event.type === 'pointerup') {
        // A tap: show that country's tooltip. Touch has no hover-out, so it
        // clears itself.
        spin = reduced ? 0 : ROTATION_PER_MS;
        point(hitTest(event.clientX, event.clientY));
        if (tapTimer !== null) clearTimeout(tapTimer);
        if (event.pointerType !== 'mouse') tapTimer = setTimeout(() => point(null), TAP_TOOLTIP_MS);
        return;
      }
      // Inertia is motion nobody asked for, so under reduced motion it just stops.
      spin = reduced ? 0 : Math.max(-MAX_FLICK, Math.min(MAX_FLICK, dragVelocity));
    }

    function onPointerEnter() {
      hoverTarget = 1;
      if (reduced) drawOnce();
    }

    function onPointerLeave(event: PointerEvent) {
      hoverTarget = 0;
      if (event.pointerType === 'mouse') point(null);
      if (reduced) drawOnce();
    }

    wrap.addEventListener('pointerdown', onPointerDown);
    wrap.addEventListener('pointermove', onPointerMove);
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);
    wrap.addEventListener('pointerenter', onPointerEnter);
    wrap.addEventListener('pointerleave', onPointerLeave);

    /* ── Lifecycle ──────────────────────────────────────────────────────── */

    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) drawOnce();
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

    if (!reduced) {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    const landLoad = loadImageData('/hero-globe-land.png');
    const countryLoad = litByName.size > 0 ? loadImageData(GLOBE_COUNTRY_MASK_SRC) : Promise.resolve(null);

    void landLoad.then((land) => {
      if (disposed || land === null) return;

      // Denser on a big screen, where there is room to see it.
      const step = window.innerWidth >= 1024 ? LAT_STEP_DENSE : LAT_STEP;
      points = buildPoints(land, step);

      resize();
      ready = true;

      // The land shows first; the rose arrives when the country mask does. A
      // failed country mask leaves a plain grey globe, never a broken hero.
      void countryLoad.then((countryMask) => {
        if (disposed || countryMask === null) return;
        classifyPoints(points, countryMask, litByName);
        litPoints = points.filter((p) => p.lit >= 0);
        if (reduced) drawOnce();
      });

      if (reduced) {
        drawOnce();
        return;
      }
      spin = INTRO_SPIN;
      raf = requestAnimationFrame(frame);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (tapTimer !== null) clearTimeout(tapTimer);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('scroll', onScroll);
      wrap.removeEventListener('pointerdown', onPointerDown);
      wrap.removeEventListener('pointermove', onPointerMove);
      wrap.removeEventListener('pointerup', endDrag);
      wrap.removeEventListener('pointercancel', endDrag);
      wrap.removeEventListener('pointerenter', onPointerEnter);
      wrap.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  const tipCountry = tooltip === null ? undefined : countries[tooltip.lit];

  return (
    <div
      ref={wrapRef}
      /*
       * aria-hidden and not focusable: the globe is decoration that responds to
       * a pointer. What it SHOWS — the countries and their counts — is given to
       * assistive technology as text by the hero itself (see home-hero.tsx), so
       * nothing here is lost to someone who cannot see the canvas.
       */
      aria-hidden="true"
      {...testId(TID.heroGlobe)}
      className={`relative aspect-square cursor-grab touch-pan-y select-none active:cursor-grabbing ${className ?? ''}`}
    >
      {/* A faint rose glow behind the sphere, so the dots do not read as a flat
          scatter on the black band. */}
      <div
        className="pointer-events-none absolute inset-[18%] rounded-gb-full opacity-[0.14] blur-2xl"
        style={{ background: 'radial-gradient(circle, var(--gb-brand) 0%, transparent 70%)' }}
      />
      <canvas ref={canvasRef} className="relative block size-full" />
      {tooltip !== null && tipCountry !== undefined ? (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-gb-md bg-surface px-gb-md py-gb-sm text-gb-xs font-semibold text-fg shadow-gb-lg"
          style={{ left: tooltip.x, top: tooltip.y - 14 }}
        >
          {globeCountryName(tipCountry.name, locale === 'vi')} ·{' '}
          {getLocaleText(locale, '{count} scholarships', { count: tipCountry.count })}
        </span>
      ) : null}
    </div>
  );
}
