'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  flattenGuide,
  STRATEGY_GUIDE,
  type FlatGuideStep,
  type GuideArea,
  type GuideStep,
} from '../domain/strategy-guide';
import { Badge, Button, ICONS, KitIcon, type BadgeVariant } from '@/shared/ui';

/**
 * The `/ai-strategy` explainer — a sticky, scroll-driven walkthrough of the
 * three areas of the product. Content lives in ../domain/strategy-guide.ts;
 * this file is only how it is presented.
 *
 * ─── HOW THE SCROLL DRIVES IT ────────────────────────────────────────────────
 *
 * One tall track (`100vh` of scroll per step) with a `sticky` viewport pinned
 * inside it. Scroll position within the track maps to an active step index:
 * the pane stays put while the reader scrolls, and the left column and the
 * right video swap content as each step comes up. That is the whole trick —
 * there is no scroll hijacking, no transform on the page, and the scrollbar
 * behaves exactly as the reader expects, which is why this survives a
 * trackpad, a mouse wheel, a keyboard PageDown and a phone fling equally.
 *
 * TWO KINDS OF SCROLL STATE, ON PURPOSE. The active step index is React state
 * — it changes ~13 times over the whole page, so a re-render is the right
 * cost. The within-step progress changes every single frame, so it is written
 * straight to the progress bar's `style.width` through a ref instead: putting
 * it in state would re-render the entire pane 60 times a second to move one
 * div by a pixel.
 *
 * The listener is `passive` and coalesced into a `requestAnimationFrame`, so
 * a fast fling does work once per painted frame rather than once per scroll
 * event (which fire far more often than frames on most trackpads).
 *
 * ─── MOBILE IS A DIFFERENT LAYOUT, NOT A SQUEEZED ONE ────────────────────────
 *
 * Sticky two-column scrollytelling needs a viewport tall and wide enough to
 * hold a readable text column beside a video. Below `lg` there isn't one, so
 * the whole mechanism is dropped and the same steps render as a plain
 * stacked list. Same content, same links, no pinning. This is why the content
 * is a data file — both renderings read from it, so they cannot drift.
 *
 * `prefers-reduced-motion` gets the stacked list too. Pinning is not an
 * animation, but content that swaps under a reader who did not click anything
 * is the same class of surprise, and the stacked version loses nothing.
 *
 * ─── THE VIDEOS DO NOT EXIST YET ─────────────────────────────────────────────
 *
 * Every step's `videoSrc` is null pending the owner's demo clips, so the
 * right pane renders a labelled placeholder naming the file it is waiting
 * for. Deliberately not a mocked-up player: a fake video frame is how the
 * previous /ai-strategy page ended up looking finished while doing nothing.
 */

/** Scroll distance allotted to each step. One viewport reads as "one beat". */
const SCROLL_PER_STEP_VH = 100;

/** One chip colour per area, so the three read as distinct stages rather than
    three copies of the same block. Only variants `Badge` actually defines —
    the kit has no "success" chip; `safe-chip` is the green one. */
const AREA_BADGE: Record<string, BadgeVariant> = {
  find: 'info-chip',
  apply: 'brand-chip',
  strategy: 'safe-chip',
};

function areaBadgeVariant(areaId: string): BadgeVariant {
  return AREA_BADGE[areaId] ?? 'neutral-chip';
}

/* ── The right-hand pane ─────────────────────────────────────────────────── */

/**
 * The video slot. Renders the real clip once one exists, and until then an
 * honest placeholder that names the file it is waiting for — see the header.
 */
function StepMedia({ step }: { step: GuideStep }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-gb-xl bg-surface-inverse-strong">
      {step.videoSrc ? (
        <video
          key={step.videoSrc}
          className="size-full object-cover"
          src={step.videoSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-gb-lg p-gb-4xl text-center">
          <span className="flex size-gb-7xl items-center justify-center rounded-gb-full bg-white/10 text-fg-on-inverse">
            <KitIcon art={ICONS.zapFast} frame={24} />
          </span>
          <p className="text-gb-sm font-semibold text-fg-on-inverse">Demo clip coming soon</p>
          <p className="max-w-sm text-gb-xs text-fg-on-inverse-muted">
            This step will show a short screen recording of{' '}
            <span className="font-medium text-fg-on-inverse-secondary">
              {step.title.toLowerCase()}
            </span>
            .
          </p>
          <code className="rounded-gb-sm bg-white/10 px-gb-md py-gb-xs text-gb-xs text-fg-on-inverse-secondary">
            {step.videoFileName}
          </code>
        </div>
      )}
    </div>
  );
}

/* ── The left-hand pane ──────────────────────────────────────────────────── */

function StepDetails({ step }: { step: GuideStep }) {
  return (
    <ul className="flex flex-col gap-gb-md">
      {step.details.map((detail) => (
        <li key={detail} className="flex items-start gap-gb-md">
          <KitIcon art={ICONS.checkCircle} frame={20} className="mt-gb-xxs shrink-0 text-brand" />
          <span className="text-gb-sm text-fg-secondary">{detail}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Desktop: the pinned scrollytelling pane ─────────────────────────────── */

function GuideScroller({ flat }: { flat: readonly FlatGuideStep[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  /* Scroll → active step + within-step progress. See the header for why only
     one of those two is React state. */
  useEffect(() => {
    const track = trackRef.current;
    if (track === null) return;

    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const rect = track.getBoundingClientRect();
      // How far the track's top has travelled past the top of the viewport,
      // over the distance it can travel while still being pinned.
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const travelled = Math.min(Math.max(-rect.top, 0), scrollable);
      const progress = travelled / scrollable;

      // Guard the exact end: progress === 1 would index one past the last step.
      const raw = Math.min(progress * flat.length, flat.length - 0.0001);
      const index = Math.floor(raw);

      if (progressRef.current !== null) {
        progressRef.current.style.width = `${Math.round((raw - index) * 100)}%`;
      }
      setActiveIndex((current) => (current === index ? current : index));
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [flat.length]);

  /** Scroll to the top of a given step — used by the step list and the area
      jump buttons, so the pane is clickable as well as scrollable. */
  const jumpToStep = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (track === null) return;
      const scrollable = track.offsetHeight - window.innerHeight;
      const top = track.offsetTop + (index / flat.length) * scrollable + 8;
      window.scrollTo({ top, behavior: 'smooth' });
    },
    [flat.length],
  );

  const active = flat[activeIndex] ?? flat[0];
  if (active === undefined) return null;
  const { area, step } = active;

  return (
    <div
      ref={trackRef}
      className="relative hidden lg:block motion-reduce:lg:hidden"
      style={{ height: `${flat.length * SCROLL_PER_STEP_VH}vh` }}
    >
      <div className="sticky top-gb-6xl flex h-[calc(100vh-8rem)] items-center">
        <div className="grid w-full gap-gb-5xl lg:grid-cols-12">
          {/* Left: which area, which step, and the step list. */}
          <div className="flex flex-col gap-gb-2xl lg:col-span-5">
            <div className="flex flex-col gap-gb-lg">
              <div className="flex items-center gap-gb-lg">
                <Badge variant={areaBadgeVariant(area.id)}>
                  Area {area.number} of {STRATEGY_GUIDE.length}
                </Badge>
                <span className="text-gb-sm text-fg-muted">
                  Step {active.indexInArea + 1} of {area.steps.length}
                </span>
              </div>
              <h2 className="font-display text-gb-display-xs font-semibold text-fg">
                {area.title}
              </h2>
              <p className="text-gb-md text-fg-tertiary">{area.summary}</p>
              {/* Within-step progress. Width is written by the scroll
                  listener through this ref — never through state. */}
              <div className="h-gb-xs w-full overflow-hidden rounded-gb-full bg-surface-muted">
                <div ref={progressRef} className="h-full w-0 rounded-gb-full bg-brand" />
              </div>
            </div>

            <ol className="flex flex-col gap-gb-md">
              {area.steps.map((areaStep) => {
                const isActive = areaStep.number === step.number;
                const flatIndex = flat.findIndex((f) => f.step.number === areaStep.number);
                return (
                  <li key={areaStep.number}>
                    <button
                      type="button"
                      onClick={() => jumpToStep(flatIndex)}
                      aria-current={isActive ? 'step' : undefined}
                      className={`flex w-full items-start gap-gb-lg rounded-gb-lg border p-gb-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        isActive
                          ? 'border-brand bg-brand-subtle'
                          : 'border-transparent hover:bg-surface-muted'
                      }`}
                    >
                      <span
                        className={`mt-gb-xxs flex size-gb-4xl shrink-0 items-center justify-center rounded-gb-md text-gb-xs font-semibold ${
                          isActive ? 'bg-brand text-white' : 'bg-surface-muted text-fg-muted'
                        }`}
                      >
                        {areaStep.number}
                      </span>
                      <span className="flex min-w-0 flex-col gap-gb-xxs">
                        <span
                          className={`text-gb-sm font-semibold ${isActive ? 'text-fg' : 'text-fg-secondary'}`}
                        >
                          {areaStep.title}
                        </span>
                        {isActive ? (
                          <span className="text-gb-sm text-fg-tertiary">{areaStep.summary}</span>
                        ) : null}
                      </span>
                    </button>
                    {isActive ? (
                      <div className="flex flex-col gap-gb-lg py-gb-lg pl-[3.5rem]">
                        <StepDetails step={areaStep} />
                        {areaStep.href && areaStep.linkLabel ? (
                          <Button href={areaStep.href} variant="secondary" size="sm">
                            {areaStep.linkLabel}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Right: the demo clip for the active step. */}
          <div className="lg:col-span-7">
            <StepMedia step={step} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile / reduced motion: the same steps, stacked ────────────────────── */

function GuideStacked({ areas }: { areas: readonly GuideArea[] }) {
  return (
    <div className="flex flex-col gap-gb-7xl lg:hidden motion-reduce:lg:flex">
      {areas.map((area) => (
        <section key={area.id} id={`area-${area.id}`} className="flex flex-col gap-gb-3xl">
          <div className="flex flex-col gap-gb-lg">
            <Badge variant={areaBadgeVariant(area.id)}>
              Area {area.number} of {areas.length}
            </Badge>
            <h2 className="font-display text-gb-display-xs font-semibold text-fg">{area.title}</h2>
            <p className="text-gb-md text-fg-tertiary">{area.summary}</p>
          </div>

          <div className="flex flex-col gap-gb-4xl">
            {area.steps.map((step) => (
              <article key={step.number} className="flex flex-col gap-gb-xl">
                <StepMedia step={step} />
                <div className="flex flex-col gap-gb-lg">
                  <div className="flex items-center gap-gb-md">
                    <span className="flex size-gb-4xl shrink-0 items-center justify-center rounded-gb-md bg-brand text-gb-xs font-semibold text-white">
                      {step.number}
                    </span>
                    <h3 className="text-gb-lg font-semibold text-fg">{step.title}</h3>
                  </div>
                  <p className="text-gb-md text-fg-tertiary">{step.summary}</p>
                  <StepDetails step={step} />
                  {step.href && step.linkLabel ? (
                    <Button href={step.href} variant="secondary" size="sm" className="self-start">
                      {step.linkLabel}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function StrategyGuide() {
  const flat = flattenGuide(STRATEGY_GUIDE);
  return (
    <>
      <GuideScroller flat={flat} />
      <GuideStacked areas={STRATEGY_GUIDE} />
    </>
  );
}
