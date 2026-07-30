'use client';

import { useEffect, useRef } from 'react';
import { TID, testId } from '@/shared/lib/testids';

/**
 * HeroGlobe — the draggable dot globe in the homepage hero.
 *
 * Replaces public/home-hero-globe.png, a 446KB static render. The mask this
 * samples is ~84KB, so the moving version is still the lighter one.
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
 * the tab is hidden, and does not start at all when the visitor prefers reduced
 * motion — in which case it draws still frames on demand, because a hero with a
 * hole in it is not an accessibility win.
 *
 * ─── AND WHAT CHANGED SINCE ─────────────────────────────────────────────────
 *
 * IT IS DRAGGABLE. Previously it was not, on the reasoning that drag on a hero
 * fights the page for the gesture. That is true of *vertical* drag on a
 * touchscreen and not of anything else, so the fix is `touch-action: pan-y`
 * rather than giving up the interaction: a vertical swipe scrolls the page as
 * usual, a horizontal one spins the globe. See the pointer handlers below.
 *
 * IT LOOKS LIKE EARTH. Two things were wrong and are covered where they are
 * fixed: the mask was too coarse and sampled a single pixel (see LAND_COVERAGE
 * and `coverage`), and the rows were offset by an irrational phase that frayed
 * every coastline (see `buildPoints`).
 *
 * ⚠️ IT IS DOTS AND NOTHING ELSE. A filled ocean sphere was tried here — a navy
 * disc with a lit limb, on the reasoning that land dots alone describe the
 * continents but not the body they sit on. The owner asked for it out on sight,
 * and they were right: at hero size it read as a solid blue ball with specks on
 * it rather than as a constellation of a planet, and it fought the black band
 * the hero sits on. Roundness comes from the dots' own depth falloff instead.
 * Do not add a background behind them.
 *
 * IT ANNOUNCES ITSELF ON MOUNT. The globe used to appear already spinning at
 * its resting rate, full size, full opacity, from the very first frame — there
 * was nothing marking the moment it became interactive. It now grows in from
 * ~62% size with a matching fade, while spinning at several times its resting
 * rate and decaying back down over about a second, the same decay curve a
 * released drag flick uses (see INTRO_SPIN and FLICK_DECAY). All three settle
 * around the same moment, which is what makes it read as one entrance rather
 * than three unrelated animations. Both are computed in `draw()`/`frame()`
 * rather than as a CSS transition on the wrapping element, because a CSS
 * transform there would be reflected in `wrap.getBoundingClientRect()` and
 * `resize()` would size the canvas's backing store to the shrunken
 * mid-transition rect — locking the globe at a blurry, under-resolved size for
 * the rest of its life. Driving the grow through `radius` instead never touches
 * layout, only what gets drawn.
 */

/**
 * Degrees between sampled latitude rows — the dot spacing, in effect.
 * Smaller is denser and costs more. Desktop gets the denser grid.
 */
const LAT_STEP = 2.3;
const LAT_STEP_DENSE = 1.7;

/**
 * How much of a dot's cell must be land for the dot to exist.
 *
 * ⚠️ THIS IS THE FIX FOR "SOME DOTS ARE COMPLETELY OFF", so think before
 * lowering it. The old sampler asked one pixel of a 1024x512 land-110m raster
 * whether it was land. At that resolution a single pixel is 20km of a coastline
 * generalised for a thumbnail, so the answer was frequently wrong in both
 * directions: dots appeared on specks of open ocean where 110m had rounded an
 * islet up, and vanished from real land like the Panama isthmus where it had
 * rounded a strait down. Averaging the whole cell instead of point-sampling its
 * centre asks the question the dot is actually posing — "is this patch of Earth
 * land?" — and a sub-cell speck can no longer answer yes.
 *
 * 0.3 keeps Iceland, Sri Lanka, Taiwan and New Zealand's South Island. It drops
 * things smaller than about a third of a cell, which at this density is Hawaii
 * and the Canaries. A lone correct dot and a lone wrong dot look identical, so
 * the ones too small to read as their own landmass are not worth the ones that
 * would come back with them.
 */
const LAND_COVERAGE = 0.3;

const ROTATION_PER_MS = 0.00015;

/* ── Intro: grow, fade and a fast spin that settles ──────────────────────── */

/** How long the grow/fade take. The spin's own decay (below) lands near here too. */
const INTRO_MS = 900;
/** Dots start at this fraction of full projected size and grow to 1. */
const INTRO_SCALE_FROM = 0.62;
/**
 * Starting angular velocity, rad/ms — just under MAX_FLICK, a fast but not
 * dizzying burst. Decays toward ROTATION_PER_MS on the same curve a released
 * drag flick does (FLICK_DECAY), landing within about a second.
 */
const INTRO_SPIN = 0.0016;

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
const CONCURRENT_FRACTION = 0.028;
/** Multiplier on that share while the pointer is over the globe. */
const HOVER_FLASH_BOOST = 1.9;
/** Peak size multiplier. Enough to notice, not enough to bulge. */
const FLASH_GROWTH = 0.78;

/** How far the globe tips as the hero scrolls away, in radians. */
const SCROLL_TILT = 0.34;
/**
 * Resting tilt: none. The rotation axis sits vertical on screen, so the
 * equator — which is what the sphere's radius is measured against — runs
 * exactly through the canvas's centre at rest, at every rotation, before any
 * scroll or drag. See the tilt math in `draw()`: an equatorial point's screen
 * height is `-z1 * sin(tilt)`, which is only independent of `z1` (and so
 * identically 0, dead centre) when `tilt` is 0.
 *
 * This used to be 23.44°, Earth's real axial tilt, kept for two reasons: it's
 * the realistic number, and it held the poles off-centre so the land read as
 * a globe rather than a disc. Neither survives contact with "centre the
 * equator" as a hard requirement — any nonzero tilt sags the equator below
 * centre at its nearest point — so this is 0 and the poles sit exactly on the
 * limb instead, which reads perfectly fine on a *spinning* sphere: it's the
 * ordinary "globe on a vertical spindle" view. Scrolling and dragging still
 * tip it away from here.
 */
const BASE_TILT = 0;

/* ── Drag ─────────────────────────────────────────────────────────────────
   Radians per pixel is set so that dragging across the globe's own width turns
   it about half a turn: less and it feels stuck to treacle, more and a flick
   sends it spinning past where you were aiming. */
const DRAG_RADIANS_PER_PX = 0.0075;
/** Tilt is clamped short of the pole; past that you are looking at a disc. */
const TILT_LIMIT = 0.95;
/** Flick speed ceiling, rad/ms. Roughly three turns a second. */
const MAX_FLICK = 0.0022;
/** Share of the flick that survives each 16ms once you let go. */
const FLICK_DECAY = 0.94;

/**
 * Direction the light comes from, in view space: x right, y up, z toward the
 * viewer. Upper left and mostly frontal.
 *
 * The shading it drives is deliberately gentle — see `shade` in `draw`. With no
 * ocean surface to catch a highlight there is nothing for a strong terminator to
 * fall across, so pushing it only thins the dots down one side and the globe
 * starts to read as a crescent.
 */
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
  /** performance.now() when this dot last lit, or 0. */
  flashStart: number;
  flashColour: string;
};

type Palette = { dot: string; flashes: string[] };

function readPalette(el: HTMLElement): Palette {
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
 * Mean land coverage of one lat/lon cell, 0 (all sea) to 1 (all land).
 *
 * The mask is greyscale-in-RGBA and deliberately anti-aliased — see the note in
 * scripts/build-globe-mask.mjs — so a coastal pixel already carries a partial
 * value, and averaging a cell gives a real area estimate rather than a vote.
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

  // Longitude wraps, so this walks a column count from a start index modulo the
  // width rather than clamping to an edge the way latitude does.
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

/**
 * Points on the land, sampled from the baked equirectangular mask.
 *
 * THREE THINGS HERE ARE EASY TO GET WRONG, and earlier builds got all three.
 *
 * 1. A ROW HAS TO CLOSE. Walking `lon += step` from -180 while `lon < 180` only
 *    lands evenly if the step divides 360, and `latStep / cos(lat)` almost never
 *    does. The last dot of each row therefore sat an arbitrary fraction of a step
 *    from where the row began, leaving a seam of mis-spaced dots running pole to
 *    pole. Rounding to a whole number of dots and dividing 360 by THAT makes
 *    every row exactly periodic.
 *
 * 2. ROWS MUST NOT SHARE A STARTING LONGITUDE — but the cure can be worse than
 *    the disease. With every row starting at -180, neighbouring rows have
 *    near-equal steps and their dots stack into vertical columns: a moiré that
 *    makes a sphere look like a grid draped over one. The previous fix offset
 *    each row by the golden ratio, which does break the columns, and also means
 *    no two adjacent dots have any fixed relationship — so every coastline came
 *    out frayed and the land read as a smudge rather than as a continent with an
 *    edge. Half a step on alternate rows breaks the columns just as well and
 *    gives a hexagonal packing, which is both the tightest arrangement on a
 *    plane and regular enough that a coast looks like a coast.
 *
 * 3. THE POLES ARE PART OF EARTH. The band used to stop at ±84° on the reasoning
 *    that the rows converge there and add cost rather than detail. They do
 *    converge — but Antarctica reaches the pole, so the globe was showing it
 *    sliced flat, and Greenland lost its top. Letting the dot count fall with
 *    cos(lat) to a single dot at the pole costs almost nothing, because that is
 *    exactly where the rows are shortest.
 */
function buildPoints(mask: ImageData, latStep: number): Point[] {
  const points: Point[] = [];
  const { width, height, data } = mask;

  // A whole number of rows, so the grid lands exactly on both poles.
  const rows = Math.max(2, Math.round(180 / latStep));
  const rowStep = 180 / rows;

  for (let row = 0; row <= rows; row++) {
    const lat = 90 - row * rowStep;
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.max(0, Math.cos(latRad));
    const sinLat = Math.sin(latRad);

    // Dots per parallel falls with cos(lat), which keeps the spacing on the
    // sphere even instead of bunching them up towards the poles.
    const count = Math.max(1, Math.round((360 * cosLat) / rowStep));
    const step = 360 / count;
    const phase = row % 2 === 0 ? 0 : step / 2;

    // The cell is as tall as the row spacing and as wide as the dot spacing,
    // capped because near the poles a step is tens of degrees and averaging that
    // much longitude would smear Antarctica's coast into the sea.
    const lonSpan = Math.min(step, rowStep * 1.5);

    for (let i = 0; i < count; i++) {
      const lon = -180 + phase + i * step;
      if (coverage(data, width, height, lat, rowStep, lon, lonSpan) < LAND_COVERAGE) continue;

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
    let ready = false;
    let rotation = 0.6;
    let lastFrame = 0;
    let flashCursor = 0;
    /** Carries the fractional part of "dots to light this frame" across frames. */
    let spawnDebt = 0;
    let size = 0;
    let dpr = 1;
    /** performance.now() of the first animated frame, or -1 before it happens. */
    let introStart = -1;
    /** Eased 0→1 over INTRO_MS. Fixed at 1 (fully settled) under reduced motion,
        since drawOnce() never advances it. */
    let introEase = reduced ? 1 : 0;
    /** Where the page is scrolled, and the eased value the globe actually uses. */
    let scrollTarget = 0;
    let scrollEased = 0;

    /* Interaction state. `spin` is the live angular velocity: it sits at
       ROTATION_PER_MS normally, is replaced by the flick speed on release, and
       eases back. `tiltDrag` is where the visitor left the axis and stays there,
       because a globe you have turned should not creep back on its own. */
    let spin = ROTATION_PER_MS;
    let tiltDrag = 0;
    let dragging = false;
    let dragPointer = -1;
    let dragX = 0;
    let dragY = 0;
    let dragAt = 0;
    let dragVelocity = 0;
    let hover = 0;
    let hoverTarget = 0;

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
      const radius = size * 0.46 * (INTRO_SCALE_FROM + (1 - INTRO_SCALE_FROM) * introEase);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const cosY = Math.cos(rotation);
      const sinY = Math.sin(rotation);
      // Resting tilt, plus wherever the visitor dragged the axis to, plus the
      // scrolled part that tips it further as the hero leaves.
      const tilt = BASE_TILT + tiltDrag + scrollEased * SCROLL_TILT;
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

        /*
         * Two terms, doing different jobs, and the balance between them is the
         * whole look now that there is nothing drawn behind the dots.
         *
         * Depth fades dots toward the limb. With no sphere under them this is
         * the ONLY thing making a flat scatter read as round, so it carries most
         * of the range.
         *
         * Lambert shades them by their angle to the light, and gets a deliberately
         * narrow one. It earns its keep on a lit surface; on bare dots, turning it
         * up just thins one side out and the globe reads as a crescent. A high
         * floor also keeps the far side of the terminator legible — the point is
         * to model the sphere, not to hide the continents on it.
         */
        const depth = 0.35 + 0.65 * Math.sqrt(z2);
        const lambert = Math.max(0, x1 * LIGHT.x + y2 * LIGHT.y + z2 * LIGHT.z);
        const shade = depth * (0.7 + 0.3 * lambert) * (1 + 0.12 * hover);

        let lit = 0;
        if (p.flashStart > 0) {
          const age = (now - p.flashStart) / FLASH_MS;
          // sin gives a symmetrical rise and fall, so nothing pops in or out.
          if (age > 0 && age < 1) lit = Math.sin(age * Math.PI);
        }

        if (lit > 0.01) {
          const s = dotSize * (1 + FLASH_GROWTH * lit);
          // Flashes keep a floor of their own brightness: a dot lighting up on
          // the night side should still be visible, or the effect only ever
          // happens on one half of the globe.
          ctx.globalAlpha = Math.min(1, Math.max(shade, depth * 0.92) * (0.65 + 0.35 * lit)) * introEase;
          ctx.fillStyle = p.flashColour;
          ctx.shadowColor = p.flashColour;
          ctx.shadowBlur = 9 * lit;
          ctx.beginPath();
          ctx.arc(screenX, screenY, s / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.globalAlpha = Math.min(1, shade * 0.85) * introEase;
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

        if (introStart < 0) introStart = now;
        const introT = Math.min(1, (now - introStart) / INTRO_MS);
        introEase = 1 - (1 - introT) ** 3; // cubic ease-out

        hover += (hoverTarget - hover) * Math.min(1, elapsed / 180);

        if (!dragging) {
          // A flick decays back to the idle rate rather than stopping dead, so
          // letting go feels like releasing something with mass.
          spin = ROTATION_PER_MS + (spin - ROTATION_PER_MS) * FLICK_DECAY ** (elapsed / 16);
          rotation += elapsed * spin;
        }
        scrollEased += (scrollTarget - scrollEased) * Math.min(1, elapsed / 220);

        // Rate that holds CONCURRENT_FRACTION of the dots lit: each lives
        // FLASH_MS, so lighting (fraction * count / FLASH_MS) per ms sustains it.
        const share = CONCURRENT_FRACTION * (1 + (HOVER_FLASH_BOOST - 1) * hover);
        spawnDebt += (elapsed * points.length * share) / FLASH_MS;
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

    /**
     * Draw one frame outside the loop.
     *
     * Under reduced motion there is no loop to piggyback on, but drag still
     * works — the guidance is about motion the visitor did not ask for, and a
     * globe that turns exactly as far as you pull it is motion they are asking
     * for continuously. So drag repaints through here instead.
     */
    function drawOnce() {
      if (ready) draw(performance.now());
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
      // Capture so a drag that leaves the canvas keeps tracking, and so the
      // release always arrives even if it happens over another element.
      wrap.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!dragging || event.pointerId !== dragPointer) return;

      const dx = event.clientX - dragX;
      const dy = event.clientY - dragY;
      const dt = Math.max(1, event.timeStamp - dragAt);
      dragX = event.clientX;
      dragY = event.clientY;
      dragAt = event.timeStamp;

      rotation += dx * DRAG_RADIANS_PER_PX;
      // Pulling down tips the front face down, which brings the north pole into
      // view — the same way it works on a globe on a desk.
      tiltDrag = Math.min(
        TILT_LIMIT - BASE_TILT,
        Math.max(-TILT_LIMIT - BASE_TILT, tiltDrag + dy * DRAG_RADIANS_PER_PX),
      );
      // Only the last moment of the gesture decides the flick, so a slow drag
      // that ends in a snap throws and one that ends parked does not.
      dragVelocity = (dx * DRAG_RADIANS_PER_PX) / dt;

      if (reduced) drawOnce();
    }

    function endDrag(event: PointerEvent) {
      if (!dragging || event.pointerId !== dragPointer) return;
      dragging = false;
      dragPointer = -1;
      if (wrap.hasPointerCapture(event.pointerId)) wrap.releasePointerCapture(event.pointerId);
      // Inertia is motion nobody asked for, so under reduced motion the globe
      // simply stops where it was left.
      spin = reduced ? 0 : Math.max(-MAX_FLICK, Math.min(MAX_FLICK, dragVelocity));
    }

    function onPointerEnter() {
      hoverTarget = 1;
      if (reduced) drawOnce();
    }

    function onPointerLeave() {
      hoverTarget = 0;
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
      ready = true;

      if (reduced) {
        // One frame, no loop, no flashes, no intro spin — but drag still repaints.
        drawOnce();
        return;
      }
      spin = INTRO_SPIN;
      raf = requestAnimationFrame(frame);
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
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
      image.onload = null;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      /*
       * Still aria-hidden, and still not focusable, even though it is now
       * draggable. The globe carries no information and performs no function —
       * spinning it tells you nothing the still version did not — so it is
       * decoration that happens to respond to a pointer. Putting a tab stop on
       * the hero for it would cost every keyboard visitor a keystroke to skip
       * something that does nothing.
       *
       * `touch-pan-y` is what makes drag safe here: on a touchscreen the browser
       * keeps vertical gestures for scrolling and only hands us horizontal ones,
       * so the globe cannot eat the page's scroll.
       */
      aria-hidden="true"
      {...testId(TID.heroGlobe)}
      className={`relative aspect-square cursor-grab touch-pan-y select-none active:cursor-grabbing ${className ?? ''}`}
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
