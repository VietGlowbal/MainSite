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
 * ─── WHAT CHANGED FROM THE FIRST ORBIT BUILD ────────────────────────────────
 *
 * HOVER NOW FREEZES ONLY THE HOVERED LOGO. It used to pause the entire ring —
 * simple, but it meant one hover stopped ten other logos that had nothing to do
 * with it. Each node now tracks its own position along the curve (`progress` in
 * NodeState) instead of all eleven being read off one shared clock, so the
 * hovered one can hold still while its neighbours keep travelling. That is a
 * structural change, not a tuning one: position is no longer "index offset from
 * a shared base" but "this node's own accumulated progress."
 *
 * THE HOVERED LOGO POPS FORWARD, AND ITS NEIGHBOURS LEAN AWAY. Both ease in and
 * out through the same `focus` value (0 at rest, 1 fully hovered), rather than
 * snapping — a CSS `:hover` transition could ease the pop, but the lean is a
 * function of *which* node is hovered and needs the same easing, so both are
 * computed together in the animation loop and ridden in as `--orbit-focus` and
 * `--orbit-lean`.
 *
 * WHAT DIDN'T COME ACROSS, ON PURPOSE:
 *
 * - Per-institution categories and descriptions ("Academic Partner", "Leading
 *   research in physical AI…"). The standing warning in ./partner-logos.ts is
 *   that this repo cannot currently substantiate a partnership with any of
 *   these universities at all — adding invented categories doesn't just
 *   decorate that claim, it multiplies it. Hover still surfaces the
 *   institution's real name and nothing invented about it.
 * - Hover sound. A ripple of Web Audio notes on every hover is a real product
 *   decision for a marketing homepage (autoplay policy, a mute control someone
 *   has to design, whether it's welcome at all) — not implied by "animation
 *   improvements," so it's left out rather than guessed at.
 * - The demo chrome — speed/sound/pause toggles, the "Scale AI Engine" badge.
 *   Prototype controls for exploring the animation, not part of the section.
 *
 * ─── WHAT CARRIED OVER FROM THE VERY FIRST REFERENCE ────────────────────────
 *
 * THE CURVE IS MEASURED ONCE, NOT PER FRAME — see ../domain/orbit-path for why
 * `getPointAtLength` in a per-frame per-node loop was 660 DOM geometry queries a
 * second, and for the arc-length table that replaces it.
 *
 * THE FIRST PAINT IS ALREADY RIGHT: the eleven starting positions are computed
 * during render, server-side, and arrive in the HTML as custom properties.
 *
 * IT STOPS WHEN NOBODY IS LOOKING, the same three ways HeroGlobe does: paused
 * out of view, paused on a hidden tab, never started under reduced motion. It
 * also does not run below `lg`, where the orbit is not on screen at all.
 *
 * ─── HOW THE TWO LAYOUTS SHARE ONE DOM ──────────────────────────────────────
 *
 * The orbit is a desktop composition. At 390px the stage would be 340px wide and
 * the logos 33px, so below `lg` the same eleven items fall back to the centred
 * wrap they had before — which is also the only place they are shown at
 * something near their real 90px resolution.
 *
 * ⚠️ EVERY ANIMATED VALUE RIDES IN AS A CUSTOM PROPERTY and is read back only by
 * `lg:` utilities. That is load-bearing, not stylistic: setting `left`,
 * `opacity` or `z-index` as inline styles instead would apply them at every
 * width, and the mobile list would inherit the orbit's depth fade and stack out
 * of position.
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
 * clearance is a coincidence of one string at one width rather than a property
 * of the layout. Putting the heading above the whole orbit, hover pop included
 * (see FOCUS_Z_BUDGET), makes it one.
 */
const ORBIT_Z_CEILING = 101;
/** Headroom a fully-focused (hovered) logo is allowed to borrow on top of its
    depth-based z-index. Bounded well under ORBIT_Z_CEILING so a hover pop can
    never itself breach the heading's clearance. */
const FOCUS_Z_BUDGET = 40;

/** How quickly `focus` eases toward its target, in the style of HeroGlobe's
    `hover += (target - hover) * min(1, elapsed / MS)`. */
const FOCUS_EASE_MS = 240;
/** Extra scale at full focus, on top of the normal depth scale. Also embedded
    literally in NODE_CLASSES' transform — keep the two in sync. */
const FOCUS_SCALE = 0.22;
/** Upward nudge at full focus, in pixels. A CSS percentage on translateY would
    resolve against the logo's own (depth-scaled) box rather than the stage, so
    this is a flat px offset instead. Also embedded literally in NODE_CLASSES. */
const FOCUS_LIFT_PX = 10;

/** Degrees the nearest neighbour leans away from a fully-focused logo. */
const LEAN_MAX_DEG = 6;
/** Degrees less lean per step further around the ring. Neighbours past
    roughly two steps away get none. */
const LEAN_FALLOFF_DEG = 2.4;

type NodeState = {
  /** This node's own position along the curve, 0–1. Advances independently per
      node so freezing one on hover does not freeze its neighbours. */
  progress: number;
  /** 0 at rest, 1 fully hovered. Drives the pop, the lift and, on this node's
      neighbours, how strongly they lean. */
  focus: number;
};

type OrbitVars = {
  readonly x: string;
  readonly y: string;
  readonly depth: string;
  readonly z: string;
  readonly focus: string;
  readonly lean: string;
};

function orbitVars(progress: number, focus: number, lean: number): OrbitVars {
  const point = orbitPointAt(ORBIT_SAMPLES, progress);
  const baseZ = Math.round(point.depth * (ORBIT_Z_CEILING - 1 - FOCUS_Z_BUDGET));
  return {
    x: `${((point.x / ORBIT_VIEWBOX.width) * 100).toFixed(3)}%`,
    y: `${((point.y / ORBIT_VIEWBOX.height) * 100).toFixed(3)}%`,
    depth: point.depth.toFixed(4),
    // Bounded below ORBIT_Z_CEILING - 1 even at full focus, so the heading's
    // clearance holds regardless of how many logos are mid-hover-transition.
    z: String(Math.min(ORBIT_Z_CEILING - 1, baseZ + Math.round(focus * FOCUS_Z_BUDGET))),
    focus: focus.toFixed(3),
    lean: lean.toFixed(2),
  };
}

function orbitStyle(vars: OrbitVars): CSSProperties {
  return {
    '--orbit-x': vars.x,
    '--orbit-y': vars.y,
    '--orbit-depth': vars.depth,
    '--orbit-z': vars.z,
    '--orbit-focus': vars.focus,
    '--orbit-lean': vars.lean,
  } as CSSProperties;
}

const NODE_CLASSES = [
  /* Mobile: the centred wrap, at close to the images' real resolution. */
  'relative aspect-square w-[88px] overflow-hidden rounded-gb-md',
  /* Desktop: a point on the orbit, centred on it. */
  'lg:absolute lg:left-[var(--orbit-x)] lg:top-[var(--orbit-y)] lg:w-[9.8%]',
  /* Depth: 0.55–1.15 scale, 0.6–1 opacity — the ranges the first build measured
     as reading well against black. Focus adds a further pop and lift on top,
     and z-index gets a bounded boost so the hovered logo clears its neighbours
     without ever reaching the heading (see FOCUS_Z_BUDGET). Built as a template
     literal, not a hand-typed string, so FOCUS_SCALE and FOCUS_LIFT_PX can't
     silently drift from the values the doc comments above describe. */
  'lg:z-[var(--orbit-z)] lg:opacity-[calc(0.6+var(--orbit-depth)*0.4)]',
  `lg:[transform:translate(-50%,-50%)_translateY(calc(var(--orbit-focus)*-${FOCUS_LIFT_PX}px))_scale(calc((0.55+var(--orbit-depth)*0.6)*(1+var(--orbit-focus)*${FOCUS_SCALE})))_rotate(calc(var(--orbit-lean)*1deg))]`,
  'lg:[will-change:transform,opacity]',
].join(' ');

export function HomePartners() {
  const stageRef = useRef<HTMLDivElement>(null);
  /**
   * Which logo is hovered, in a ref rather than state: the animation loop is
   * what reads it every frame, and re-rendering eleven `next/image` nodes to
   * tell it would be wasted work. The name under the heading *is* state,
   * because that genuinely is a render.
   */
  const hoveredIndexRef = useRef<number | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;

    const nodes = Array.from(stage.querySelectorAll<HTMLElement>('[data-orbit-node]'));
    if (nodes.length === 0) return;

    const desktop = window.matchMedia('(min-width: 1024px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const states: NodeState[] = nodes.map((_, index) => ({
      progress: index / nodes.length,
      focus: 0,
    }));

    let frame: number | null = null;
    let last = 0;
    let inView = true;

    const step = (now: number) => {
      /* Elapsed time, not per frame, so a lap takes REVOLUTION_MS on a 144Hz
         screen as much as on a 60Hz one. `last === 0` marks a fresh start,
         where there is no previous frame to measure against. */
      const delta = last === 0 ? 0 : now - last;
      last = now;

      const hoveredIndex = hoveredIndexRef.current;
      const count = states.length;

      states.forEach((state, index) => {
        if (index !== hoveredIndex) {
          state.progress = (state.progress + delta / REVOLUTION_MS) % 1;
        }
        const target = index === hoveredIndex ? 1 : 0;
        state.focus += (target - state.focus) * Math.min(1, delta / FOCUS_EASE_MS);
      });

      // The lean anchors on the literally-hovered index, but its magnitude
      // rides the SAME eased focus value driving that logo's own pop — so a
      // neighbour's lean fades in and out in step with the hover it's reacting
      // to, rather than snapping ahead of or behind it.
      const anchorFocus = hoveredIndex === null ? 0 : states[hoveredIndex]!.focus;

      nodes.forEach((node, index) => {
        const state = states[index]!;
        let lean = 0;
        if (hoveredIndex !== null && index !== hoveredIndex) {
          let offset = index - hoveredIndex;
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;
          const magnitude = Math.max(0, LEAN_MAX_DEG - LEAN_FALLOFF_DEG * Math.abs(offset));
          lean = Math.sign(offset) * magnitude * anchorFocus;
        }

        const vars = orbitVars(state.progress, state.focus, lean);
        node.style.setProperty('--orbit-x', vars.x);
        node.style.setProperty('--orbit-y', vars.y);
        node.style.setProperty('--orbit-depth', vars.depth);
        node.style.setProperty('--orbit-z', vars.z);
        node.style.setProperty('--orbit-focus', vars.focus);
        node.style.setProperty('--orbit-lean', vars.lean);
      });

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
          <div
            className="pointer-events-none flex flex-col items-center gap-gb-sm lg:absolute lg:inset-x-0 lg:top-1/2 lg:-translate-y-1/2"
            style={{ zIndex: ORBIT_Z_CEILING }}
          >
            <h2 className="text-center font-display text-gb-display-sm font-semibold tracking-gb-display-open lg:whitespace-nowrap lg:text-[4.7059cqw] lg:leading-[6.2745cqw]">
              Our featured partners
            </h2>
            {/* Reserves its own line so nothing shifts as a logo passes under the
                cursor. Empty until one does. Desktop only: it answers a hover, and
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
                style={orbitStyle(orbitVars(index / PARTNER_LOGOS.length, 0, 0))}
                onMouseEnter={() => {
                  hoveredIndexRef.current = index;
                  setHoveredName(logo.name);
                }}
                onMouseLeave={() => {
                  if (hoveredIndexRef.current === index) hoveredIndexRef.current = null;
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
