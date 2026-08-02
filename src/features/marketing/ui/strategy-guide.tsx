'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  destinationLabel,
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
 * ─── ONE PANEL, TWO DRIVERS ──────────────────────────────────────────────────
 *
 * `GuidePanel` is the presentation — the three area cards, the step's clip,
 * the step's own detail, and Previous/Next — and knows nothing about how the
 * active step got chosen. Two things drive it: `GuideScroller` (this page;
 * scroll position picks the step) and the help popup in
 * ./strategy-help-button.tsx (clicks pick it). Factoring it this way is not
 * tidiness — it is the only reason the popup and the page cannot drift into
 * describing the product differently.
 *
 * IT ALSO OWNS THE CHROME NOW (02/08 redesign). The area switcher and the
 * Previous/Next pair used to live in the popup's header and footer bars, which
 * meant the page had neither: on /ai-strategy the only way forward was to keep
 * scrolling, and the areas were invisible. Both moved in here, so both drivers
 * get them and the popup is down to a title, a step count and a close button.
 *
 * ─── HOW THE SCROLL DRIVES IT ────────────────────────────────────────────────
 *
 * One tall track (`100vh` of scroll per step) with a `sticky` viewport pinned
 * inside it. Scroll position within the track maps to an active step index:
 * the pane stays put while the reader scrolls, and its contents swap as each
 * step comes up. No scroll hijacking, no transform on the page — the scrollbar
 * behaves exactly as the reader expects, which is why this survives a
 * trackpad, a wheel, a keyboard PageDown and a phone fling equally.
 *
 * THE ONLY SCROLL STATE IS THE ACTIVE STEP INDEX. It changes ~14 times over
 * the whole page, so a re-render is the right cost. There used to be a second
 * kind — within-step progress, written straight to a thin bar's `style.width`
 * through a ref because it changes every frame — and it went with the 02/08
 * redesign: the area cards carry a dot per step, so position in the journey is
 * already shown, and a hairline bar measuring sub-step progress next to them
 * was the less legible of the two.
 *
 * ─── NOTHING MOVES WITHIN AN AREA (owner, 01/08) ─────────────────────────────
 *
 * The first version jumped on every step change, and all three causes were
 * layout, not animation:
 *
 *   1. the pane was `items-center`, so ANY height change re-centred the whole
 *      thing and shifted every element vertically;
 *   2. the area header sat inside the same column as the step list, so the
 *      list expanding pushed the header;
 *   3. the step list grew when a step expanded (it gained a summary, details
 *      and a button), changing the container height on every step.
 *
 * The fix is structural, and the 02/08 redesign keeps every part of it. The
 * area cards span the full width above the grid and are derived from the AREAS,
 * so they are byte-identical for all fourteen steps and cannot move — only
 * which dot is filled changes. The pane is a fixed height anchored to the top
 * (`items-start`), never centred. The step's own detail is the only thing
 * allowed to change size, and it sits in a `min-h-0 overflow-y-auto` block, so
 * a long step scrolls internally instead of resizing its parent or pushing
 * Previous/Next off the bottom. The clip keeps a fixed `aspect-video` at a
 * fixed offset, so it cannot shift either.
 *
 * ─── THE CLIP IS ON THE LEFT (owner, 01/08) ──────────────────────────────────
 *
 * Steps were on the left and the clip on the right, which left a tall column
 * beside a short one and read as unbalanced. Swapped: clip left, the step's
 * detail right, an even half each.
 *
 * ─── MOBILE IS A DIFFERENT LAYOUT, NOT A SQUEEZED ONE ────────────────────────
 *
 * Sticky two-column scrollytelling needs a viewport tall and wide enough for a
 * readable text column beside a video. Below `lg` there isn't one, so the
 * mechanism is dropped and the same steps render as a plain stacked list.
 * `prefers-reduced-motion` gets that too: pinning is not an animation, but
 * content swapping under a reader who did not click anything is the same class
 * of surprise, and the stacked version loses nothing.
 *
 * ─── THE VIDEOS DO NOT EXIST YET ─────────────────────────────────────────────
 *
 * Every step's `videoSrc` is null pending the owner's demo clips, so the clip
 * slot renders a labelled placeholder naming the file it is waiting for.
 * Deliberately not a mocked-up player: a fake video frame is how the original
 * /ai-strategy page ended up looking finished while doing nothing.
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

/**
 * The clip slot. Renders the real video once one exists, and until then an
 * honest placeholder naming the file it is waiting for — see the header.
 *
 * Fixed `aspect-video` in every state, so swapping steps never changes its
 * size and nothing around it shifts.
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

/**
 * The three areas as one row of cards, with a dot per step.
 *
 * REPLACES THE OLD STEP LIST, and that is the substance of the 02/08 redesign.
 * Before, the right-hand column was a list of every step in the current area
 * with the active one expanded inline; the areas themselves only appeared as
 * text chips in the popup's header and not at all on the page. Two problems:
 * the student could not see the shape of the journey (three stages, fourteen
 * steps) without reading a list, and the expanding list was the one thing in
 * the panel that changed height, which is what all the layout-stability
 * scaffolding below exists to contain.
 *
 * The dots are decorative, not controls. A button per dot would be a button
 * nested inside the card's button — invalid, and unfocusable in that order —
 * and within-area movement is what Previous/Next is for. Clicking a card jumps
 * to that area's first step, which is the one navigation the old header chips
 * got right.
 */
function AreaTabs({
  flat,
  active,
  onSelect,
}: {
  flat: readonly FlatGuideStep[];
  active: FlatGuideStep;
  onSelect: (flatIndex: number) => void;
}) {
  return (
    /* Three columns from `sm` up; below it they scroll sideways rather than
       stacking. Stacked, three cards ate a third of the popup's height on a
       phone, and the popup is the only place this panel renders at that width
       — the page has `GuideStacked` for small screens. */
    <ol className="flex shrink-0 gap-gb-md overflow-x-auto pb-gb-xxs sm:grid sm:grid-cols-3 sm:gap-gb-lg sm:overflow-visible sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {STRATEGY_GUIDE.map((area) => {
        const isCurrent = area.id === active.area.id;
        const firstIndex = flat.findIndex((entry) => entry.area.id === area.id);
        return (
          <li key={area.id} className="min-w-[13rem] sm:min-w-0">
            <button
              type="button"
              onClick={() => onSelect(firstIndex)}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex h-full w-full flex-col gap-gb-lg rounded-gb-xl border px-gb-xl py-gb-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                isCurrent
                  ? 'border-brand bg-brand-subtle'
                  : 'border-line bg-surface hover:bg-surface-muted'
              }`}
            >
              <span className="flex items-center gap-gb-lg">
                <span
                  className={`flex size-gb-3xl shrink-0 items-center justify-center rounded-gb-full text-gb-xs font-semibold ${
                    isCurrent ? 'bg-brand text-on-brand' : 'bg-surface-muted text-fg-muted'
                  }`}
                >
                  {area.number}
                </span>
                <span
                  className={`text-gb-sm font-semibold ${isCurrent ? 'text-fg' : 'text-fg-secondary'}`}
                >
                  {area.title}
                </span>
              </span>
              <span className="flex items-center gap-gb-sm" aria-hidden="true">
                {area.steps.map((areaStep, index) => (
                  <span
                    key={areaStep.number}
                    className={`size-gb-md rounded-gb-full ${
                      isCurrent && index === active.indexInArea ? 'bg-brand' : 'bg-line-strong'
                    }`}
                  />
                ))}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The step's call to action.
 *
 * The magnifier goes on the destinations a student SEARCHES (the directory,
 * the scholarship list) and the arrow on the ones they work in. Derived from
 * `href` rather than stored per step: two hrefs is not worth a field on all
 * fourteen steps, and the pairing is a property of the destination anyway.
 *
 * The caption under it is `destinationLabel(href)` — see the note on that
 * function for why the text is keyed on the href instead of written per step.
 */
const SEARCH_DESTINATIONS = new Set(['/universities', '/scholarships']);

function StepAction({ step }: { step: GuideStep }) {
  if (step.href === null || step.linkLabel === null) return null;
  const caption = destinationLabel(step.href);
  return (
    <div className="flex flex-col gap-gb-md">
      <Button href={step.href} size="lg" className="w-full gap-gb-md">
        <KitIcon
          art={SEARCH_DESTINATIONS.has(step.href) ? ICONS.search : ICONS.arrowRight}
          frame={20}
        />
        {step.linkLabel}
      </Button>
      {caption ? <p className="text-gb-xs text-fg-muted">Takes you to {caption}</p> : null}
    </div>
  );
}

/** Previous / Next. Moves through the FLAT list, so it walks from the end of
    one area into the start of the next rather than dead-ending. */
function GuideNav({
  activeIndex,
  total,
  onSelect,
}: {
  activeIndex: number;
  total: number;
  onSelect: (flatIndex: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-gb-lg">
      <Button
        variant="secondary"
        size="lg"
        className="gap-gb-md"
        onClick={() => onSelect(Math.max(0, activeIndex - 1))}
        disabled={activeIndex === 0}
      >
        <KitIcon art={ICONS.arrowLeft} frame={20} />
        Previous
      </Button>
      <Button
        size="lg"
        className="gap-gb-md"
        onClick={() => onSelect(Math.min(total - 1, activeIndex + 1))}
        disabled={activeIndex === total - 1}
      >
        Next
        <KitIcon art={ICONS.arrowRight} frame={20} />
      </Button>
    </div>
  );
}

/**
 * The shared two-column presentation. Deliberately has no idea how
 * `activeIndex` is chosen — see the header.
 */
export function GuidePanel({
  flat,
  activeIndex,
  onSelect,
}: {
  flat: readonly FlatGuideStep[];
  activeIndex: number;
  onSelect: (flatIndex: number) => void;
}) {
  const active = flat[activeIndex] ?? flat[0];
  if (active === undefined) return null;
  const { area, step } = active;

  return (
    /* `w-full` is load-bearing on the page, not decoration: there the panel is
       a flex ITEM of the sticky container, and a flex item sizes to its content
       unless told otherwise, so without it the two columns collapse to
       max-content instead of splitting the pane. */
    <div className="flex h-full w-full min-h-0 flex-col gap-gb-2xl">
      <AreaTabs flat={flat} active={active} onSelect={onSelect} />

      {/* Two columns from `lg`, where the step's own detail does the scrolling.
          Below that they stack, the clip alone would fill a short viewport, so
          the whole thing scrolls as one instead. */}
      <div className="grid min-h-0 flex-1 gap-gb-3xl overflow-y-auto lg:grid-cols-2 lg:gap-gb-4xl lg:overflow-hidden">
        {/* Clip — left. Fixed aspect, fixed offset, so it cannot shift. */}
        <div>
          <StepMedia step={step} />
        </div>

        {/* The step itself — right. The ONLY thing allowed to change size, and
            it absorbs that change internally (its body scrolls) rather than
            resizing its parent. See the header on layout stability. */}
        <div className="flex min-h-0 flex-col gap-gb-2xl">
          <div className="flex min-h-0 flex-1 flex-col gap-gb-lg overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <h2 className="font-display text-gb-display-xs font-semibold text-fg">{step.title}</h2>
            <div className="flex flex-col gap-gb-xs">
              <p className="text-gb-sm font-semibold text-fg-brand">
                Step {active.indexInArea + 1} of {area.steps.length}
              </p>
              <p className="text-gb-md text-fg-tertiary">{step.summary}</p>
            </div>
            <hr className="border-line" />
            <StepDetails step={step} />
            <StepAction step={step} />
          </div>

          <GuideNav activeIndex={activeIndex} total={flat.length} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}

/* ── Desktop: the pinned, scroll-driven pane ─────────────────────────────── */

function GuideScroller({ flat }: { flat: readonly FlatGuideStep[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (track === null) return;

    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const rect = track.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const travelled = Math.min(Math.max(-rect.top, 0), scrollable);
      const progress = travelled / scrollable;

      // Guard the exact end: progress === 1 would index one past the last step.
      const index = Math.floor(Math.min(progress * flat.length, flat.length - 0.0001));
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

  /** Scroll to a given step — the step list is clickable as well as scrollable. */
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

  return (
    <div
      ref={trackRef}
      className="relative hidden lg:block motion-reduce:lg:hidden"
      style={{ height: `${flat.length * SCROLL_PER_STEP_VH}vh` }}
    >
      {/* `items-start`, never centred — see the header on layout stability. */}
      <div className="sticky top-gb-6xl flex h-[calc(100vh-8rem)] items-start py-gb-2xl">
        <GuidePanel flat={flat} activeIndex={activeIndex} onSelect={jumpToStep} />
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
