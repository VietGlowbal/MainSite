'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ORBIT_PATH_D,
  ORBIT_SAMPLES,
  ORBIT_VIEWBOX,
  orbitPointAt,
} from '../domain/orbit-path';
import { PARTNER_LOGOS } from './partner-logos';

/**
 * Partner logos, orbiting a tilted ellipse — replaces the Figma 104:7135 scatter.
 *
 * That frame had no auto-layout: eleven tiles at hand-placed coordinates with the
 * heading floating in a lane left clear across the middle. It was reproduced as a
 * fixed-ratio stage with every coordinate as a percentage of it, which scaled the
 * composition as one piece and guaranteed the heading never collided with a tile.
 * The logos now travel instead, and that guarantee is kept a different way — see
 * ORBIT_Z_CEILING below.
 *
 * ─── WHAT CHANGED FROM THE PROTOTYPE ────────────────────────────────────────
 *
 * THE CURVE IS MEASURED ONCE, NOT PER FRAME. The prototype asked the live
 * `<path>` for a point per node per frame. See ../domain/orbit-path for why that
 * is 660 DOM geometry queries a second to walk a curve that never changes, and
 * for the arc-length table that replaces it.
 *
 * THE FIRST PAINT IS ALREADY RIGHT. Because that table is pure, the eleven
 * starting positions are computed during render — on the server — and arrive as
 * custom properties in the HTML. The prototype positioned nodes only once its
 * animation loop began, so every logo sat stacked in one corner until then.
 *
 * IT STOPS WHEN NOBODY IS LOOKING, the same three ways HeroGlobe does: paused out
 * of view, paused on a hidden tab, and never started at all under reduced motion —
 * where the server-rendered positions are the whole composition and no JavaScript
 * is needed. It also does not run below `lg`, where the orbit is not on screen.
 *
 * NO INVENTED COPY. Each partner in the prototype had a one-line description
 * ("Leading research in physical AI and autonomous systems") revealed on hover.
 * Those are claims about institutions, and about a relationship this repo cannot
 * substantiate — see the warning in ./partner-logos — so hover reveals the
 * institution's name and nothing else. A crest is genuinely hard to place, so the
 * name is worth surfacing; the sentence is not ours to write.
 *
 * ─── HOW THE TWO LAYOUTS SHARE ONE DOM ──────────────────────────────────────
 *
 * The orbit is a desktop composition. At 390px the stage would be 340px wide and
 * the logos 33px, so below `lg` the same eleven items fall back to the centred
 * wrap they had before — which is also the only place they are shown at something
 * near their real 90px resolution.
 *
 * ⚠️ EVERY ANIMATED VALUE RIDES IN AS A CUSTOM PROPERTY and is read back only by
 * `lg:` utilities. That is load-bearing, not stylistic: setting `left`, `opacity`
 * or `z-index` as inline styles instead would apply them at every width, and the
 * mobile list would inherit the orbit's depth fade and stack out of position.
 */

/** Milliseconds for one lap. Slow enough to read a crest as it passes. */
const REVOLUTION_MS = 48_000;

/**
 * One more than the highest z-index a logo can take, for the heading to sit on.
 *
 * The heading does not, in fact, collide with the orbit at the moment: the curve
 * only reaches the heading's vertical band out at its left and right extremes,
 * x≈0 and x≈1020, while "Our featured partners" set at 48px occupies roughly the
 * middle 480px of a 1120px stage. But the Vietnamese heading is half again as
 * long, DomTranslator swaps it in at runtime, and the stage is fluid — so the
 * clearance is a coincidence of one string at one width rather than a property of
 * the layout. Putting the heading above the whole orbit makes it one.
 */
const ORBIT_Z_CEILING = 101;

type OrbitVars = {
  readonly x: string;
  readonly y: string;
  readonly depth: string;
  readonly z: string;
};

/** Position and depth for node `index` of `count`, `base` laps into the orbit. */
function orbitVars(index: number, count: number, base: number): OrbitVars {
  const point = orbitPointAt(ORBIT_SAMPLES, base + index / count);
  return {
    x: `${((point.x / ORBIT_VIEWBOX.width) * 100).toFixed(3)}%`,
    y: `${((point.y / ORBIT_VIEWBOX.height) * 100).toFixed(3)}%`,
    depth: point.depth.toFixed(4),
    /* Near side in front of far side. Rounded, because z-index is an integer. */
    z: String(Math.round(point.depth * (ORBIT_Z_CEILING - 1))),
  };
}

function orbitStyle(index: number, count: number, base: number): CSSProperties {
  const vars = orbitVars(index, count, base);
  return {
    '--orbit-x': vars.x,
    '--orbit-y': vars.y,
    '--orbit-depth': vars.depth,
    '--orbit-z': vars.z,
  } as CSSProperties;
}

const NODE_CLASSES = [
  /* Mobile: the centred wrap, at close to the images' real resolution. */
  'relative aspect-square w-[88px] overflow-hidden rounded-gb-md',
  /* Desktop: a point on the orbit, centred on it. */
  'lg:absolute lg:left-[var(--orbit-x)] lg:top-[var(--orbit-y)] lg:w-[9.8%]',
  /* Depth. 0.55–1.15 on scale and 0.6–1 on opacity are the prototype's ranges;
     they read well against black. `--orbit-lift` is the hover nudge, which
     confirms the pause was deliberate rather than a stall. */
  'lg:z-[var(--orbit-z)] lg:opacity-[calc(0.6+var(--orbit-depth)*0.4)]',
  'lg:[--orbit-lift:1] lg:hover:[--orbit-lift:1.12]',
  'lg:[transform:translate(-50%,-50%)_scale(calc((0.55+var(--orbit-depth)*0.6)*var(--orbit-lift)))]',
  /* No transition on transform: it is rewritten every frame, and easing a value
     that is already animating only lags it behind the position it belongs to.
     The prototype did both, which is why its motion looked soft. */
  'lg:[will-change:transform,opacity]',
].join(' ');

export function HomePartners() {
  const stageRef = useRef<HTMLDivElement>(null);
  /**
   * Hover pause, in a ref rather than state: the animation loop is what reads it,
   * and re-rendering eleven `next/image` nodes to tell it would be wasted work.
   * The name under the heading *is* state, because that genuinely is a render.
   */
  const hoveredRef = useRef(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;

    const nodes = Array.from(stage.querySelectorAll<HTMLElement>('[data-orbit-node]'));
    if (nodes.length === 0) return;

    const desktop = window.matchMedia('(min-width: 1024px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    let frame: number | null = null;
    let base = 0;
    let last = 0;
    let inView = true;

    const step = (now: number) => {
      /* Elapsed time, not per frame, so a lap takes REVOLUTION_MS on a 144Hz
         screen as much as on a 60Hz one. `last === 0` marks a fresh start, where
         there is no previous frame to measure against. */
      const delta = last === 0 ? 0 : now - last;
      last = now;

      if (!hoveredRef.current) {
        base = (base + delta / REVOLUTION_MS) % 1;
        nodes.forEach((node, index) => {
          const vars = orbitVars(index, nodes.length, base);
          node.style.setProperty('--orbit-x', vars.x);
          node.style.setProperty('--orbit-y', vars.y);
          node.style.setProperty('--orbit-depth', vars.depth);
          node.style.setProperty('--orbit-z', vars.z);
        });
      }

      frame = requestAnimationFrame(step);
    };

    const sync = () => {
      const shouldRun = desktop.matches && !reduced.matches && inView && !document.hidden;
      if (shouldRun && frame === null) {
        last = 0;
        frame = requestAnimationFrame(step);
      } else if (!shouldRun && frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry !== undefined) inView = entry.isIntersecting;
        sync();
      },
      /* A lap is slow, so start it a little before the section scrolls in —
         otherwise the first thing a visitor sees is a motionless ring. */
      { rootMargin: '200px' },
    );
    observer.observe(stage);

    document.addEventListener('visibilitychange', sync);
    desktop.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    sync();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      desktop.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    };
  }, []);

  return (
    <section className="bg-surface-inverse-strong text-white">
      <div className="mx-auto w-full max-w-[1440px] px-gb-xl py-gb-9xl">
        {/* The stage is the orbit's coordinate space: its aspect ratio is the
            curve's viewBox, so a percentage of it is a point on the curve, and
            `container-type` lets the heading scale with it — 4.7059cqw is 48/1020
            and 6.2745cqw is 64/1020, the design's size and leading against the new
            stage width.

            Logo centres reach all four edges of the stage, so half a logo hangs
            over each one. The 88% cap leaves room for that at the sides; the
            section's own py-gb-9xl covers the top and bottom. */}
        <div
          ref={stageRef}
          className="relative mx-auto flex w-full flex-col items-center gap-gb-6xl lg:block lg:aspect-[1020/572] lg:w-[min(88%,1120px)] lg:[container-type:inline-size]"
        >
          {/* zIndex inline rather than as a utility so it cannot drift from the
              ceiling the logos are scaled against. Harmless on the mobile layout,
              where this element is static and z-index does not apply. */}
          <div
            className="pointer-events-none flex flex-col items-center gap-gb-sm lg:absolute lg:inset-x-0 lg:top-1/2 lg:-translate-y-1/2"
            style={{ zIndex: ORBIT_Z_CEILING }}
          >
            <h2 className="text-center font-display text-gb-display-sm font-semibold tracking-gb-display-open lg:whitespace-nowrap lg:text-[4.7059cqw] lg:leading-[6.2745cqw]">
              Our featured partners
            </h2>
            {/* Reserves its own line so nothing shifts as a logo passes under the
                cursor. Empty until one does — see the note above on why there is
                no default sentence here. Desktop only: it answers a hover, and
                there is no hover on the mobile layout.

                aria-hidden because it is a duplicate — the name it shows is the
                alt text of the logo being hovered, which is already in the tree. */}
            <p
              aria-hidden="true"
              className="hidden h-gb-3xl text-center text-gb-md text-white/70 lg:block"
            >
              {hoveredName}
            </p>
          </div>

          {/* The orbit, drawn faintly. `currentColor` inherits the section's
              white, so it needs no colour of its own and cannot drift from one.
              Delete the svg and the ring goes: nothing reads this element — the
              logos' positions come from the same `d` string through the domain
              module, not from the rendered path. */}
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${ORBIT_VIEWBOX.width} ${ORBIT_VIEWBOX.height}`}
            fill="none"
            className="pointer-events-none absolute inset-0 hidden lg:block"
          >
            <path
              d={ORBIT_PATH_D}
              stroke="currentColor"
              strokeWidth={1.5}
              strokeDasharray="10 12"
              className="opacity-[0.15]"
            />
          </svg>

          <ul className="flex flex-wrap justify-center gap-gb-3xl lg:block">
            {PARTNER_LOGOS.map((logo, index) => (
              <li
                key={logo.name}
                data-orbit-node
                className={NODE_CLASSES}
                style={orbitStyle(index, PARTNER_LOGOS.length, 0)}
                onMouseEnter={() => {
                  hoveredRef.current = true;
                  setHoveredName(logo.name);
                }}
                onMouseLeave={() => {
                  hoveredRef.current = false;
                  setHoveredName(null);
                }}
              >
                <Image
                  src={logo.src}
                  alt={logo.name}
                  fill
                  sizes="(min-width: 1024px) 128px, 88px"
                  className="object-cover"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
