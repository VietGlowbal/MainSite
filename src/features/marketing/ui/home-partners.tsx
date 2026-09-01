'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';
import { getLocaleText, localizePath, type Locale } from '@/lib/i18n/locale';
import {
  ORBIT_SAMPLES,
  ORBIT_TOTAL_LENGTH,
  ORBIT_VIEWBOX,
  orbitArcDistance,
  orbitPointAt,
} from '../domain/orbit-path';
import { TID, testId } from '@/shared/lib';
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
 * Three engineering choices worth flagging because they are not visible in
 * the reference itself:
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
 * 2. THE HOVER POP EASES ON ITS OWN TRACK, NOT THE WAVE'S. The reference sets
 *    the hovered card's extra scale and lift from a bare `isSelf` boolean —
 *    1.25x and -14px the instant `mouseenter` fires, back to 1x the instant
 *    it doesn't. That is exactly the "pop" that needed smoothing: each
 *    NodeState now also carries `focus`, a second eased value alongside
 *    `impact` (same IMPACT_EASE_IN_MS/OUT_MS), driven purely by "is this the
 *    hovered index" rather than by wave arrival, so the grow-and-lift glides
 *    in and back out instead of snapping on both ends.
 *
 * 3. SOUND UNLOCKS ON THE FIRST GESTURE ANYWHERE ON THE PAGE, not just on this
 *    section. Browsers only unlock an AudioContext on a "real" user gesture —
 *    click, key press, touch start — and do not count `mouseenter` as one. A
 *    context created lazily on the first hover would therefore often stay
 *    suspended: the very interaction meant to trigger the chime is the one
 *    kind of interaction that cannot unlock it. So a one-time
 *    pointerdown/keydown listener on `document` primes the shared
 *    AudioContext as soon as the visitor's first genuine gesture happens
 *    anywhere — a nav click, a scroll-triggered tap, whatever comes first —
 *    which is normally well before their pointer ever reaches this section.
 *    It still is not a guarantee: a visitor who hovers a logo as the literal
 *    first thing they do on the page will get silence that one time, because
 *    no gesture has happened yet to unlock audio at all. That is the
 *    platform's policy, not a bug, and the existing try/catch around playback
 *    already treats a still-suspended context as a harmless no-op.
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
 * ─── THE HEADING IS THE HOVER'S ANSWER, AND THE LOGOS GO SOMEWHERE ──────────
 *
 * The supporting line reads "Study <somewhere>" and the second word flips over
 * as the pointer moves round the ring: "Study Anywhere" at rest, "Study
 * Cambridge" while Cambridge is under the cursor. The Home.md catalogue title
 * remains fixed above it, so the required copy never disappears on hover.
 *
 * Two details are load-bearing:
 *
 * 1. THE LINE'S WIDTH IS RESERVED BY EVERY WORD AT ONCE, not by the longest
 *    one guessed by character count. `StudyWord` stacks all twelve candidates,
 *    invisible, in a single grid cell, so the cell is as wide as the widest one
 *    actually renders. Guessing was tried first and is not safe: this heading is
 *    centred, so if the reserved width is even slightly short the whole line —
 *    "Study" included — re-centres the instant a wider word lands, and in a bold
 *    display face "Cambridge" and "ETH Zürich" swap places depending on the
 *    tracking. Twelve invisible spans cost nothing and cannot be wrong.
 *
 * 2. THE OUTGOING WORD IS A SEPARATE ELEMENT, kept alive for the length of its
 *    own animation. One element cannot flip out and in at the same time, and a
 *    crossfade is not what the reference does — see the note on
 *    --animate-gb-word-flip-* in src/styles/tokens.css for why the direction of
 *    the rotation matters.
 *
 * EVERY LOGO IS A LINK to that university's page in the directory, which is the
 * question a visitor who just hovered a crest is asking. The route is
 * `/universities/[id]` on the numeric row id — there is no slug column, see that
 * page's header — so the ids cannot be written down beside the logos and are
 * resolved by name at the page level and passed in. `universityIds` is therefore
 * allowed to be short, sparse or absent, and anything unresolved falls back to
 * the directory index rather than to a dead 404 or a logo that is silently not
 * clickable. See `findIdsByNames` in features/universities/api.
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
    the curve is defined in. */
const WAVE_SPEED_PX_PER_MS = 2.4;
/**
 * Distance (user units) over which a wave's arrival smooth-steps a logo's
 * impact from 0 to 1, and over which the transient crest/dip bounce plays
 * out. Both roughly doubled from the reference's 70/80 — at WAVE_SPEED_PX_PER_MS
 * those windows are ~29ms and ~33ms, a couple of frames, which read as a
 * flick rather than a bounce. ~117ms and ~133ms give the pop somewhere to
 * happen.
 */
const IMPACT_SMOOTH_WINDOW_PX = 140;
const CREST_WINDOW_PX = 160;
/** Peak upward nudge (px) as the hover wave's crest passes through a logo. */
const HOVER_CREST_LIFT_PX = 16;
/** Peak downward nudge (px) as the release wave's dip passes through. */
const RELEASE_CREST_LIFT_PX = 12;
/**
 * How quickly a logo's impact (and FOCUS_SCALE/FOCUS_LIFT_PX, via `focus` —
 * see NodeState) eases toward its target — faster rising into an impact than
 * falling out of one, matching the reference's 22/12 (1/sec) rates, but both
 * roughly doubled from the direct millisecond-time-constant conversion
 * (45/83) for the same reason as the windows above: fast enough to read as
 * responsive, slow enough to read as eased rather than snapped.
 */
const IMPACT_EASE_IN_MS = 110;
const IMPACT_EASE_OUT_MS = 190;
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
    wider than an earlier build's 0.55–1.15, matching the reference. Depth
    affects only size and stacking order here, never colour — the reference's
    opacity fade at the back horizon (down to 0.35) is deliberately not
    carried over: it read as the logos dimming as they orbit, and a
    university's crest is a fixed mark, not something that should look
    different depending on where it currently sits on the ring. */
const DEPTH_SCALE_FROM = 0.55;
const DEPTH_SCALE_SPAN = 0.7;
/** Degrees a logo tilts away from the hovered one at full impact, capped and
    tapering with index distance around the ring. */
const TILT_MAX_DEG = 12;
const TILT_DEG_PER_STEP = 3;

/** z-index the hovered logo takes, and the ceiling one above it that the
    heading occupies — see ORBIT_Z_CEILING in the earlier build's history for
    why the heading must always render above every possible logo z-index. */
const FOCUS_Z_INDEX = 200;
const ORBIT_Z_CEILING = FOCUS_Z_INDEX + 1;

/** What the heading says while nothing is hovered: "Study Anywhere". */
const DEFAULT_STUDY_WORD = 'Anywhere';
/** Every word the heading's second slot can hold, which is what reserves its
    width. Order is irrelevant — they all occupy the same grid cell. */
const STUDY_WORDS: readonly string[] = [
  DEFAULT_STUDY_WORD,
  ...PARTNER_LOGOS.map((logo) => logo.shortName),
];
/** Must be ≥ the flip-out animation in tokens.css, or the outgoing word is
    unmounted mid-rotation and disappears instead of finishing. */
const WORD_FLIP_OUT_MS = 260;
/** The directory index — where a logo points when its row could not be
    resolved. Not a 404 and not an inert logo: the visitor still lands somewhere
    they can find the university themselves. */
const DIRECTORY_HREF = '/universities';

type Wave = {
  readonly sourceProgress: number;
  readonly sourceIndex: number;
  readonly startTime: number;
  readonly playedNodes: Set<number>;
};

type NodeState = {
  /** This node's own position along the curve, 0–1. */
  progress: number;
  /** 0 = orbiting normally, 1 = fully caught by a wave (near-frozen, tilted).
      Shared by every logo the wave passes through. */
  impact: number;
  /** 0 = at rest, 1 = the literally-hovered logo. Unlike `impact`, only ever
      targets 1 for whichever index is currently hovered (and 0 for every
      other index, including the one that was just released) — this is what
      the hover pop (FOCUS_SCALE, FOCUS_LIFT_PX) eases through, so it grows in
      and shrinks back on its own smooth curve instead of following the wave. */
  focus: number;
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
  readonly z: string;
  readonly scale: string;
  readonly tilt: string;
  readonly offsetPx: string;
};

/** `focus` is 0 for every logo except whichever is hovered, where it eases
    0→1 — see NodeState. Z-index switches to FOCUS_Z_INDEX once focus is past
    the midpoint of its ease, which in practice reads as instant (the ease
    itself now runs ~110ms) without needing a separate boolean plumbed through. */
function orbitVars(progress: number, focus: number, tiltDeg: number, offsetPx: number): OrbitVars {
  const point = orbitPointAt(ORBIT_SAMPLES, progress);
  const depthScale = DEPTH_SCALE_FROM + point.depth * DEPTH_SCALE_SPAN;
  return {
    x: `${((point.x / ORBIT_VIEWBOX.width) * 100).toFixed(3)}%`,
    y: `${((point.y / ORBIT_VIEWBOX.height) * 100).toFixed(3)}%`,
    z: String(focus > 0.5 ? FOCUS_Z_INDEX : Math.floor(point.depth * 100)),
    scale: (depthScale * (1 + focus * (FOCUS_SCALE - 1))).toFixed(4),
    tilt: tiltDeg.toFixed(2),
    offsetPx: `${(focus * -FOCUS_LIFT_PX + offsetPx).toFixed(2)}px`,
  };
}

function orbitStyle(vars: OrbitVars): CSSProperties {
  return {
    '--orbit-x': vars.x,
    '--orbit-y': vars.y,
    '--orbit-z': vars.z,
    '--orbit-scale': vars.scale,
    '--orbit-tilt': vars.tilt,
    '--orbit-offset-px': vars.offsetPx,
  } as CSSProperties;
}

const NODE_CLASSES = [
  /* Mobile: the centred wrap, at close to the images' real resolution. */
  'relative aspect-square w-[88px] overflow-hidden rounded-gb-md',
  /* Desktop: a point on the orbit, centred on it. Full opacity always — depth
     is conveyed by scale and stacking order only, never by fading colour. */
  'lg:absolute lg:left-[var(--orbit-x)] lg:top-[var(--orbit-y)] lg:w-[9.8%]',
  'lg:z-[var(--orbit-z)]',
  'lg:[transform:translate(-50%,-50%)_translateY(var(--orbit-offset-px))_scale(var(--orbit-scale))_rotate(calc(var(--orbit-tilt)*1deg))]',
  'lg:[will-change:transform]',
].join(' ');

/**
 * The second word of "Study <somewhere>", rotating down as it changes.
 *
 * The gradient fill and both keyframes are tokens — see the partner-orbit block
 * at the end of src/styles/tokens.css, which also explains why the rotation goes
 * the way it does.
 */
function StudyWord({ word, locale }: { word: string; locale: Locale }) {
  /** `nonce` exists to key the two animated spans: React reuses a DOM node when
      only its text changes, and a reused node does not replay a CSS animation.
      Bumping it on every swap forces a fresh element, which is what makes the
      flip run at all. */
  const [shown, setShown] = useState({ word, leaving: null as string | null, nonce: 0 });

  /* Adjusted during render rather than in an effect. An effect runs after paint,
     so the browser would show the new word once, sitting still in its resting
     position, and only then start the flip — a visible stutter on every hover.
     Setting state while rendering makes React discard this output and re-render
     immediately, before anything is painted. This is the documented pattern for
     state derived from a prop, not a workaround. */
  if (shown.word !== word) {
    setShown({ word, leaving: shown.word, nonce: shown.nonce + 1 });
  }

  /* Retire the outgoing word once its animation has played. Keyed on `nonce`, so
     a second swap arriving mid-flip cancels this timer and starts its own —
     without that, the first timer would fire during the second flip and drop the
     wrong word out of the DOM. */
  useEffect(() => {
    if (shown.leaving === null) return;
    const timer = setTimeout(
      () => setShown((current) => ({ ...current, leaving: null })),
      WORD_FLIP_OUT_MS,
    );
    return () => clearTimeout(timer);
  }, [shown.nonce, shown.leaving]);

  /* The gradient is painted through the glyphs, so the text itself has no
     colour of its own — `text-transparent` is what makes the fill visible, not
     an accident.

     `text-left` OVERRIDES the `text-center` inherited from the h2. Without it,
     a short word (MIT, NUS, HKU) centres inside the reservation cell above —
     which is sized for "Cambridge"/"ETH Zürich" — and ends up floating well
     right of "Study" with a big gap in between. Left-aligning pins every word
     flush against "Study "; the leftover reserved width still trails invisibly
     after the word, so the line's total width (and therefore "Study"'s
     position) still never jitters as words change. */
  const wordClasses =
    'col-start-1 row-start-1 whitespace-nowrap text-left bg-[image:var(--gb-partner-word)] bg-clip-text text-transparent';

  /* inline-grid, not inline-block: every word below shares ONE cell
     (col-start-1 row-start-1), which both stacks them and makes the cell as wide
     as the widest of them. `perspective` is what turns the keyframes' rotateX
     into a rotation you can see rather than a vertical squash. */
  return (
    <span className="inline-grid align-baseline [perspective:600px]">
      {/* The width reservation. Invisible but laid out, all twelve in one cell,
          so the column is as wide as the widest word truly renders — see the ⚠️
          in this file's header for why this is not a `longest by length` guess.
          data-no-auto-translate: these are institution names, and translating
          text nobody can see would be a round trip for nothing. */}
      <span aria-hidden="true" data-no-auto-translate className="invisible col-start-1 row-start-1 grid">
        {STUDY_WORDS.map((candidate) => (
          <span key={candidate} className="col-start-1 row-start-1 whitespace-nowrap">
            {candidate}
          </span>
        ))}
      </span>

      {shown.leaving !== null ? (
        /* motion-reduce hides it outright: with the animation off, `both` never
           applies the closing frame, so it would sit at full opacity on top of
           the incoming word for the length of the timer. */
        <span
          key={`out-${shown.nonce}`}
          aria-hidden="true"
          data-no-auto-translate
          className={`${wordClasses} animate-gb-word-flip-out motion-reduce:animate-none motion-reduce:opacity-0`}
        >
          {shown.leaving}
        </span>
      ) : null}

      {/* Only the default word is translatable; the rest are university names,
          which the i18n rules say are never translated. The attribute is
          conditional rather than always-on for exactly that reason. */}
      <span
        key={`in-${shown.nonce}`}
        {...(shown.word === DEFAULT_STUDY_WORD ? {} : { 'data-no-auto-translate': true })}
        className={`${wordClasses} animate-gb-word-flip-in motion-reduce:animate-none`}
      >
          {shown.word === DEFAULT_STUDY_WORD ? getLocaleText(locale, shown.word) : shown.word}
      </span>
    </span>
  );
}

export type HomePartnersProps = {
  /**
   * Row id in `universities` for each logo, positionally aligned with
   * PARTNER_LOGOS. `null` — or a short/absent array — means "not resolved", and
   * that logo links to the directory index instead. See this file's header.
   */
  readonly universityIds?: readonly (number | null)[];
  readonly locale?: Locale;
};

export function HomePartners({ universityIds, locale }: HomePartnersProps = {}) {
  const { lang } = useLanguage();
  const activeLocale = locale ?? lang;
  const stageRef = useRef<HTMLDivElement>(null);
  /** Which logo is hovered, and since when — read every frame by the loop, so
      kept in a ref rather than state (a state update would re-render eleven
      `next/image` nodes for something only the imperative loop needs). */
  const hoveredIndexRef = useRef<number | null>(null);
  /** The hovered logo, mirrored into state because the heading and the caption
      under it are rendered by React rather than written by the loop. Held as an
      index, not a name, so both lines read from one source. */
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hovered = hoveredIndex === null ? null : (PARTNER_LOGOS[hoveredIndex] ?? null);

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
      focus: 0,
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
      setHoveredIndex(null);
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

        const impactEaseMs = targetImpact > state.impact ? IMPACT_EASE_IN_MS : IMPACT_EASE_OUT_MS;
        state.impact += (targetImpact - state.impact) * Math.min(1, delta / impactEaseMs);

        // Separate from impact on purpose — see NodeState.focus. Targets 1
        // only for the literal hovered index and 0 for everyone else,
        // including whichever index was hovered a moment ago, so the pop
        // eases back out symmetrically with how it eased in.
        const targetFocus = isSelf ? 1 : 0;
        const focusEaseMs = targetFocus > state.focus ? IMPACT_EASE_IN_MS : IMPACT_EASE_OUT_MS;
        state.focus += (targetFocus - state.focus) * Math.min(1, delta / focusEaseMs);

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

        const vars = orbitVars(state.progress, state.focus, tilt, offsetPx);
        node.style.setProperty('--orbit-x', vars.x);
        node.style.setProperty('--orbit-y', vars.y);
        node.style.setProperty('--orbit-z', vars.z);
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

    // Prime audio on the visitor's first genuine gesture anywhere on the page
    // — see the doc comment above for why a hover alone cannot reliably do
    // this. Skipped entirely under reduced motion, matching the shockwave's
    // own reduced-motion policy: no wave, no sound.
    let unlockAudio: (() => void) | null = null;
    if (!reduced.matches) {
      unlockAudio = () => {
        getAudioCtx();
      };
      document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
      document.addEventListener('keydown', unlockAudio, { once: true });
    }

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
        setHoveredIndex(index);
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
      /* Keyboard parity, now that each logo is a link and therefore in the tab
         order: tabbing onto one fires the same wave and moves the heading, so
         someone who never touches a pointer gets the same section. `focusin` /
         `focusout` rather than `focus` / `blur` because the focus lands on the
         anchor INSIDE this node, and only the -in/-out pair bubbles. */
      node.addEventListener('focusin', onEnter);
      node.addEventListener('focusout', onLeave);
      teardownListeners.push(() => {
        node.removeEventListener('mouseenter', onEnter);
        node.removeEventListener('mouseleave', onLeave);
        node.removeEventListener('focusin', onEnter);
        node.removeEventListener('focusout', onLeave);
      });
    });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (hoverLockTimer !== null) clearTimeout(hoverLockTimer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      desktop.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
      if (unlockAudio !== null) {
        document.removeEventListener('pointerdown', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
      }
      teardownListeners.forEach((teardown) => teardown());
    };
  }, []);

  return (
    <section {...testId(TID.heroPartners)} className="bg-surface-inverse-strong text-white">
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
            className="flex flex-col items-center gap-gb-lg lg:absolute lg:inset-x-0 lg:top-1/2 lg:-translate-y-1/2"
            style={{ zIndex: ORBIT_Z_CEILING }}
          >
            <h2 className="pointer-events-none max-w-[620px] text-center font-display text-gb-display-sm font-semibold leading-tight lg:text-[3.5cqw]">
              {getLocaleText(activeLocale, "Choose from 200+ of the world's leading universities")}
            </h2>
            <p className="pointer-events-none text-gb-sm text-white/70 md:text-gb-md">
              <span>{getLocaleText(activeLocale, 'Study')}</span>{' '}
              <StudyWord word={hovered?.shortName ?? DEFAULT_STUDY_WORD} locale={activeLocale} />
            </p>
            <Button href={localizePath('/universities', activeLocale)} size="lg" variant="primary-on-dark">
              {getLocaleText(activeLocale, 'Find a university')}
            </Button>
          </div>

          <ul className="flex flex-wrap justify-center gap-gb-3xl lg:block">
            {PARTNER_LOGOS.map((logo, index) => {
              const universityId = universityIds?.[index] ?? null;
              return (
                <li
                  key={logo.name}
                  data-orbit-node
                  className={NODE_CLASSES}
                  style={orbitStyle(orbitVars(index / PARTNER_LOGOS.length, 0, 0, 0))}
                >
                  {/* The whole tile is the hit area, and the link's accessible
                      name is the logo's alt text — so no aria-label, which would
                      override it with a second wording of the same thing.

                      The focus ring is inset (`-outline-offset`) because this
                      node is `overflow-hidden` for the rounded corners, and an
                      outset ring would be clipped away to nothing. */}
                  <Link
                    href={localizePath(universityId === null ? DIRECTORY_HREF : `/universities/${universityId}`, activeLocale)}
                    className="absolute inset-0 block rounded-gb-md focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white"
                  >
                    <Image
                      src={logo.src}
                      alt={logo.name}
                      fill
                      sizes="(min-width: 1024px) 128px, 88px"
                      className="object-cover"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
