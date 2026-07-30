'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ORBIT_PATH_D,
  ORBIT_SAMPLES,
  ORBIT_TOTAL_LENGTH,
  ORBIT_VIEWBOX,
  orbitArcDistance,
  orbitPointAt,
} from '../domain/orbit-path';
import { PARTNER_LOGOS } from './partner-logos';

/**
 * Partner logos, orbiting a tilted ellipse and reacting to hover with a
 * shockwave — replaces the Figma 104:7135 scatter this section started as.
 *
 * ─── THE SHOCKWAVE, PORTED FROM A SUPPLIED REFERENCE ────────────────────────
 *
 * Hovering a logo no longer just pauses it (that was the previous build).
 * Now it fires a wave outward from the hovered logo, in both directions round
 * the ring at once, at WAVE_SPEED_PX_PER_MS. A logo keeps orbiting completely
 * normally until the wave front physically reaches it — measured in real
 * curve distance via `orbitArcDistance`, not in index steps, so the wave
 * reaches a close neighbour before a far one regardless of how the eleven are
 * spaced — at which point it eases into a near-stop (IMPACT_SPEED_FLOOR),
 * gets a brief upward crest bounce as the front passes through
 * (HOVER_CREST_LIFT_PX), and tilts a few degrees away from the hovered logo.
 * Unhovering fires a second, RELEASE wave from the same origin that un-freezes
 * logos the same way, front first, each with its own small release dip and a
 * different, descending note.
 *
 * Two engineering choices worth flagging because they are not visible in the
 * reference itself:
 *
 * 1. POSITION STAYS PERCENTAGE-BASED. The reference reads the container's
 *    pixel `getBoundingClientRect()` every frame and writes absolute
 *    `translate3d(px, px, 0)`. This still uses the CSS-percentage `--orbit-x`/
 *    `--orbit-y` custom properties the earlier build established — no
 *    per-frame layout read, and the eleven starting positions are still
 *    correct in the server-rendered HTML before any JS runs. The bounce and
 *    hover lift, which the reference expresses as raw pixel offsets, are
 *    layered on top via `calc()` (`--orbit-offset-px`), so the visual result
 *    is the same fixed-pixel nudge without needing the container's size.
 *
 * 2. SOUND IS AS-GIVEN, WITH ONE CAVEAT WORTH KNOWING. Most browsers only
 *    unlock an AudioContext on a "real" user gesture — click, key press, touch
 *    start — and do not count `mouseenter` as one. So on a first-ever visit
 *    where the pointer reaches this section before any click happens
 *    anywhere on the page, `audioCtx.resume()` can silently stay suspended
 *    and the chime just won't play; nothing here forces that not to happen,
 *    it's how the platform's autoplay policy works. The reference's own
 *    try/catch already treats a failed play as a no-op, which is the right
 *    behaviour either way.
 *
 * WHAT DIDN'T COME ACROSS, still: per-institution categories and hover
 * descriptions ("Academic Partner", "Leading research in physical AI…"). The
 * standing warning in ./partner-logos.ts is that this repo cannot currently
 * substantiate a partnership with any of these universities — inventing
 * categories multiplies that claim rather than decorating it. Hover still
 * surfaces only the institution's real name. Also left out: the reference's
 * demo header (speed/sound/pause toggles, the "Scale AI Engine" badge) —
 * prototype chrome for exploring the animation, not part of the section.
 *
 * ─── WHAT CARRIED OVER FROM EARLIER BUILDS ──────────────────────────────────
 *
 * THE CURVE IS MEASURED ONCE, NOT PER FRAME — see ../domain/orbit-path for why
 * `getPointAtLength` in a per-frame per-node loop was 660 DOM geometry queries
 * a second, and for the arc-length table (and now `ORBIT_TOTAL_LENGTH`) that
 * replaces it.
 *
 * IT STOPS WHEN NOBODY IS LOOKING: paused out of view, paused on a hidden tab,
 * never started under reduced motion (which also skips the shockwave and
 * sound entirely — both are motion/surprise effects reduced-motion asks for
 * none of). It also does not run below `lg`, where the orbit is not shown.
 *
 * ⚠️ EVERY ANIMATED VALUE RIDES IN AS A CUSTOM PROPERTY, read back only by
 * `lg:` utilities — setting `left`/`opacity`/`z-index` as inline styles
 * instead would apply them at every width, and the mobile list would inherit
 * the orbit's depth fade and stack out of position.
 */

/** Milliseconds for one lap at zero impact — matches the reference's
    0.032 progress/sec (1 / 0.032 = 31.25s). */
const REVOLUTION_MS = 31_250;

/** How fast a shockwave travels along the curve, in user units per ms — the
    reference's 2400px/s against an SVG in the same 1020x572 user-unit space
    ORBIT_PATH_D is defined in. */
const WAVE_SPEED_PX_PER_MS = 2.4;
/** Distance (user units) over which a wave's arrival smooth-steps a logo's
    impact from 0 to 1, rather than snapping the instant the front arrives. */
const IMPACT_SMOOTH_WINDOW_PX = 70;
/** Distance (user units) over which the transient crest/dip bounce plays out
    as a wave front passes through a logo. */
const CREST_WINDOW_PX = 80;
/** Peak upward nudge (px) as the hover wave's crest passes through a logo. */
const HOVER_CREST_LIFT_PX = 16;
/** Peak downward nudge (px) as the release wave's dip passes through. */
const RELEASE_CREST_LIFT_PX = 12;
/** How quickly a logo's impact eases toward its target — faster rising into
    an impact than falling out of one, matching the reference's 22/12 (1/sec)
    rates expressed here as millisecond time-constants. */
const IMPACT_EASE_IN_MS = 45;
const IMPACT_EASE_OUT_MS = 83;
/** At full impact a logo does not fully stop — it creeps at this fraction of
    normal speed, which is what keeps a long hover from ever looking static. */
const IMPACT_SPEED_FLOOR = 0.02;
/** A release wave is considered spent once it could have reached anywhere on
    the ring (arc distance tops out at half the loop) with margin. */
const RELEASE_WAVE_EXPIRE_FRACTION = 0.6;
/** Minimum time a hover has to hold before mouseleave is honoured — without
    this, brushing across the ring fires a wave-then-immediately-release pair
    per logo, which reads as flicker rather than as a response. */
const HOVER_LOCK_MS = 500;

/** Extra scale the hovered logo gets, multiplying its normal depth scale. */
const FOCUS_SCALE = 1.25;
/** How far the hovered logo lifts, px. */
const FOCUS_LIFT_PX = 14;
/** Depth scale range: 0.55 at the back of the orbit to 1.25 at the front —
    wider than the previous build's 0.55–1.15, matching the reference. */
const DEPTH_SCALE_FROM = 0.55;
const DEPTH_SCALE_SPAN = 0.7;
/** Below this depth a logo is considered "at the back horizon" and dims to
    HORIZON_OPACITY — a hard cut rather than the previous continuous fade,
    again matching the reference. */
const HORIZON_DEPTH_THRESHOLD = 0.08;
const HORIZON_OPACITY = 0.35;
/** Degrees a logo tilts away from the hovered one at full impact, capped and
    tapering with index distance around the ring. */
const TILT_MAX_DEG = 12;
const TILT_DEG_PER_STEP = 3;

/** z-index the hovered logo takes, and the ceiling one above it that the
    heading occupies — see ORBIT_Z_CEILING in the earlier build's history for
    why the heading must always render above every possible logo z-index. */
const FOCUS_Z_INDEX = 200;
const ORBIT_Z_CEILING = FOCUS_Z_INDEX + 1;

type Wave = {
  readonly sourceProgress: number;
  readonly sourceIndex: number;
  readonly startTime: number;
  readonly playedNodes: Set<number>;
};

type NodeState = {
  /** This node's own position along the curve, 0–1. */
  progress: number;
  /** 0 = orbiting normally, 1 = fully caught by a wave (near-frozen, tilted). */
  impact: number;
};

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

/** Lazily-created AudioContext, module-scoped so every mount reuses one
    rather than accumulating a new context per navigation to "/". */
let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (sharedAudioCtx === null) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      sharedAudioCtx = new Ctor();
    }
    if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/** A pentatonic run for the hover wave hitting a logo, indexed by position
    around the ring so a full sweep plays as a rising figure. */
const HOVER_SCALE_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
/** A different, descending-leaning scale for the release wave, so letting go
    is audibly distinct from hovering rather than a mirror of the same note. */
const RELEASE_SCALE_SEMITONES = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

function playTone(
  freq: number,
  { type, peakGain, ms, glideTo }: { type: OscillatorType; peakGain: number; ms: number; glideTo?: number },
): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + ms / 1000);
    gain.gain.setValueAtTime(peakGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + ms / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + ms / 1000);
  } catch {
    // Autoplay policy or an unsupported browser — silence is the correct fallback.
  }
}

function playRippleNote(index: number): void {
  const semitones = HOVER_SCALE_SEMITONES[index % HOVER_SCALE_SEMITONES.length]!;
  const freq = 440 * 2 ** (semitones / 12); // A4 pentatonic
  playTone(freq, { type: 'triangle', peakGain: 0.025, ms: 180 });
}

function playReleaseNote(index: number): void {
  const semitones = RELEASE_SCALE_SEMITONES[(HOVER_SCALE_SEMITONES.length - 1 - index) % RELEASE_SCALE_SEMITONES.length]!;
  const freq = 523.25 * 2 ** (semitones / 12); // C5 harmonic release
  playTone(freq, { type: 'sine', peakGain: 0.02, ms: 160, glideTo: freq * 0.75 });
}

type OrbitVars = {
  readonly x: string;
  readonly y: string;
  readonly depth: string;
  readonly z: string;
  readonly opacity: string;
  readonly scale: string;
  readonly tilt: string;
  readonly offsetPx: string;
};

function orbitVars(progress: number, isSelf: boolean, tiltDeg: number, offsetPx: number): OrbitVars {
  const point = orbitPointAt(ORBIT_SAMPLES, progress);
  const depthScale = DEPTH_SCALE_FROM + point.depth * DEPTH_SCALE_SPAN;
  return {
    x: `${((point.x / ORBIT_VIEWBOX.width) * 100).toFixed(3)}%`,
    y: `${((point.y / ORBIT_VIEWBOX.height) * 100).toFixed(3)}%`,
    depth: point.depth.toFixed(4),
    z: String(isSelf ? FOCUS_Z_INDEX : Math.floor(point.depth * 100)),
    opacity: point.depth < HORIZON_DEPTH_THRESHOLD ? String(HORIZON_OPACITY) : '1',
    scale: (depthScale * (isSelf ? FOCUS_SCALE : 1)).toFixed(4),
    tilt: tiltDeg.toFixed(2),
    offsetPx: `${((isSelf ? -FOCUS_LIFT_PX : 0) + offsetPx).toFixed(2)}px`,
  };
}

function orbitStyle(vars: OrbitVars): CSSProperties {
  return {
    '--orbit-x': vars.x,
    '--orbit-y': vars.y,
    '--orbit-z': vars.z,
    '--orbit-opacity': vars.opacity,
    '--orbit-scale': vars.scale,
    '--orbit-tilt': vars.tilt,
    '--orbit-offset-px': vars.offsetPx,
  } as CSSProperties;
}

const NODE_CLASSES = [
  /* Mobile: the centred wrap, at close to the images' real resolution. */
  'relative aspect-square w-[88px] overflow-hidden rounded-gb-md',
  /* Desktop: a point on the orbit, centred on it. */
  'lg:absolute lg:left-[var(--orbit-x)] lg:top-[var(--orbit-y)] lg:w-[9.8%]',
  'lg:z-[var(--orbit-z)] lg:opacity-[var(--orbit-opacity)]',
  'lg:[transform:translate(-50%,-50%)_translateY(var(--orbit-offset-px))_scale(var(--orbit-scale))_rotate(calc(var(--orbit-tilt)*1deg))]',
  'lg:[will-change:transform,opacity]',
].join(' ');

export function HomePartners() {
  const stageRef = useRef<HTMLDivElement>(null);
  /** Which logo is hovered, and since when — read every frame by the loop, so
      kept in a ref rather than state (a state update would re-render eleven
      `next/image` nodes for something only the imperative loop needs). */
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
      impact: 0,
    }));

    let activeWave: Wave | null = null;
    let activeReleaseWave: Wave | null = null;
    let hoverLockTimer: ReturnType<typeof setTimeout> | null = null;
    let hoverStartedAt = 0;
    let pendingRelease = -1;

    let frame: number | null = null;
    let last = 0;
    let inView = true;

    function releaseHover(index: number): void {
      if (hoveredIndexRef.current === index) hoveredIndexRef.current = null;
      pendingRelease = -1;
      if (hoverLockTimer !== null) {
        clearTimeout(hoverLockTimer);
        hoverLockTimer = null;
      }
      setHoveredName(null);
      activeWave = null;
      activeReleaseWave = {
        sourceProgress: states[index]!.progress,
        sourceIndex: index,
        startTime: performance.now(),
        playedNodes: new Set([index]),
      };
    }

    const step = (now: number) => {
      const delta = last === 0 ? 0 : now - last;
      last = now;

      const count = states.length;
      const hoveredIndex = hoveredIndexRef.current;
      const isHovered = hoveredIndex !== null;

      let waveRadiusPx = 0;
      let waveSourceProgress = 0;
      if (isHovered && activeWave) {
        waveRadiusPx = (now - activeWave.startTime) * WAVE_SPEED_PX_PER_MS;
        waveSourceProgress = activeWave.sourceProgress;
      }

      let releaseRadiusPx = 0;
      let releaseSourceProgress = 0;
      let releaseSourceIndex = -1;
      let isReleasing = !isHovered && activeReleaseWave !== null;
      if (isReleasing && activeReleaseWave) {
        releaseRadiusPx = (now - activeReleaseWave.startTime) * WAVE_SPEED_PX_PER_MS;
        releaseSourceProgress = activeReleaseWave.sourceProgress;
        releaseSourceIndex = activeReleaseWave.sourceIndex;
        if (releaseRadiusPx > ORBIT_TOTAL_LENGTH * RELEASE_WAVE_EXPIRE_FRACTION) {
          activeReleaseWave = null;
          isReleasing = false;
        }
      }

      nodes.forEach((node, index) => {
        const state = states[index]!;
        const isSelf = index === hoveredIndex;
        let targetImpact = 0;
        let offsetPx = 0;

        if (isHovered) {
          if (isSelf) {
            targetImpact = 1;
          } else {
            const distancePx = orbitArcDistance(state.progress, waveSourceProgress);
            if (waveRadiusPx >= distancePx) {
              const overshoot = waveRadiusPx - distancePx;
              targetImpact = smoothstep(0, IMPACT_SMOOTH_WINDOW_PX, overshoot);
              if (overshoot < CREST_WINDOW_PX) {
                const crest = Math.sin((overshoot / CREST_WINDOW_PX) * Math.PI);
                offsetPx = -crest * HOVER_CREST_LIFT_PX;
                if (activeWave && !activeWave.playedNodes.has(index)) {
                  activeWave.playedNodes.add(index);
                  playRippleNote(index);
                }
              }
            }
          }
        } else if (isReleasing) {
          const distancePx = orbitArcDistance(state.progress, releaseSourceProgress);
          if (releaseRadiusPx >= distancePx) {
            const overshoot = releaseRadiusPx - distancePx;
            if (overshoot < CREST_WINDOW_PX) {
              const crest = Math.sin((overshoot / CREST_WINDOW_PX) * Math.PI);
              offsetPx = crest * RELEASE_CREST_LIFT_PX;
              if (activeReleaseWave && !activeReleaseWave.playedNodes.has(index)) {
                activeReleaseWave.playedNodes.add(index);
                playReleaseNote(index);
              }
            }
          } else {
            targetImpact = 1;
          }
        }

        const easeMs = targetImpact > state.impact ? IMPACT_EASE_IN_MS : IMPACT_EASE_OUT_MS;
        state.impact += (targetImpact - state.impact) * Math.min(1, delta / easeMs);

        const speedRatio = 1 - state.impact * (1 - IMPACT_SPEED_FLOOR);
        state.progress = (state.progress + (delta / REVOLUTION_MS) * speedRatio) % 1;
        if (state.progress < 0) state.progress += 1;

        let tilt = 0;
        if (state.impact > 0.05 && !isSelf) {
          const originIndex = isHovered ? hoveredIndex : isReleasing ? releaseSourceIndex : -1;
          if (originIndex !== null && originIndex !== -1) {
            let offset = index - originIndex;
            if (offset > count / 2) offset -= count;
            if (offset < -count / 2) offset += count;
            tilt = Math.sign(offset) * Math.min(TILT_MAX_DEG, Math.abs(offset) * TILT_DEG_PER_STEP) * state.impact;
          }
        }

        const vars = orbitVars(state.progress, isSelf, tilt, offsetPx);
        node.style.setProperty('--orbit-x', vars.x);
        node.style.setProperty('--orbit-y', vars.y);
        node.style.setProperty('--orbit-z', vars.z);
        node.style.setProperty('--orbit-opacity', vars.opacity);
        node.style.setProperty('--orbit-scale', vars.scale);
        node.style.setProperty('--orbit-tilt', vars.tilt);
        node.style.setProperty('--orbit-offset-px', vars.offsetPx);
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

    const teardownListeners: (() => void)[] = [];
    nodes.forEach((node, index) => {
      const onEnter = () => {
        if (hoverLockTimer !== null) {
          clearTimeout(hoverLockTimer);
          hoverLockTimer = null;
        }
        hoveredIndexRef.current = index;
        hoverStartedAt = performance.now();
        pendingRelease = -1;
        activeReleaseWave = null;
        activeWave = {
          sourceProgress: states[index]!.progress,
          sourceIndex: index,
          startTime: performance.now(),
          playedNodes: new Set([index]),
        };
        setHoveredName(PARTNER_LOGOS[index]?.name ?? null);
      };
      const onLeave = () => {
        const elapsed = performance.now() - hoverStartedAt;
        if (elapsed >= HOVER_LOCK_MS) {
          releaseHover(index);
          return;
        }
        pendingRelease = index;
        if (hoverLockTimer !== null) clearTimeout(hoverLockTimer);
        hoverLockTimer = setTimeout(() => {
          if (pendingRelease === index) releaseHover(index);
        }, HOVER_LOCK_MS - elapsed);
      };
      node.addEventListener('mouseenter', onEnter);
      node.addEventListener('mouseleave', onLeave);
      teardownListeners.push(() => {
        node.removeEventListener('mouseenter', onEnter);
        node.removeEventListener('mouseleave', onLeave);
      });
    });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (hoverLockTimer !== null) clearTimeout(hoverLockTimer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      desktop.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
      teardownListeners.forEach((teardown) => teardown());
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
                style={orbitStyle(orbitVars(index / PARTNER_LOGOS.length, false, 0, 0))}
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
