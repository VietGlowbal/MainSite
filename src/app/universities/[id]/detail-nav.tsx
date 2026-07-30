'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Container } from '@/shared/ui';

/**
 * The section bar from Figma 375:10665, made sticky and self-aware.
 *
 * The frame draws a static row of links that scrolls away with the rest of the
 * page. On a 1440-wide render this page is ~4,700px tall and the bar is gone by
 * the time the second section arrives, so the links only work from the top —
 * which is the one place a reader does not need them. Sticking it and marking
 * the section currently in view is a departure from the frame's geometry, not
 * from its intent.
 *
 * Scroll-spy runs off a scroll listener rather than IntersectionObserver on
 * purpose. The question here is "which heading was the last one to pass under
 * the bar", and sections on this page are tall enough that two of them are
 * routinely on screen at once while a third is in the observer's band — an
 * observer answers "which are visible", and turning that back into an ordering
 * costs more than reading offsetTop. The handler is rAF-throttled and passive.
 */

export type DetailSection = {
  /** Anchor id, and the target of the bar at the top. */
  id: string;
  label: string;
};

/**
 * Distance from the top of the viewport at which a heading counts as "reached".
 * The bar itself is ~57px; the extra clearance means a heading registers as it
 * settles under the bar rather than the instant it touches it.
 */
const SPY_OFFSET = 96;

export function DetailNav({
  sections,
  officialSite,
}: {
  sections: readonly DetailSection[];
  officialSite: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const [progress, setProgress] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (sections.length === 0) return;
    let frame = 0;

    function measure() {
      frame = 0;

      // Reading progress across the whole document, for the hairline under the
      // bar. `scrollHeight - innerHeight` is 0 on a page shorter than the
      // viewport; guard rather than divide by it.
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);

      let current: string | null = sections[0]?.id ?? null;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= SPY_OFFSET) current = section.id;
      }

      /*
       * The last section is usually short, so scrolling to the very bottom of
       * the page can leave the previous heading as the last one past the
       * threshold and the final link never lights up. At the bottom, it is the
       * one the reader is looking at.
       */
      if (scrollable > 0 && window.scrollY >= scrollable - 2) {
        current = sections[sections.length - 1]?.id ?? current;
      }

      setActiveId(current);
    }

    function onScroll() {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections]);

  /*
   * Keep the active chip in view in the horizontally-scrolling mobile strip, by
   * writing the strip's own `scrollLeft`.
   *
   * ⚠️ NOT `scrollIntoView`, even with `block: 'nearest'`. That method scrolls
   * every scrollable ancestor including the document, so while the bar is
   * pinned it re-scrolled the *page* on each section change and dragged the
   * reader backwards — a `window.scrollTo(0, 2500)` came to rest at 1148. It
   * fires on exactly the interaction it breaks, so it looked fine until the
   * page was actually scrolled.
   */
  useEffect(() => {
    const list = listRef.current;
    if (!activeId || !list) return;
    const chip = list.querySelector(`[data-anchor="${activeId}"]`);
    if (!(chip instanceof HTMLElement)) return;

    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = left;
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth;
  }, [activeId]);

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+var(--gb-header-mobile))] z-30 mt-gb-5xl border-b border-line bg-surface/85 backdrop-blur-sm md:top-0">
      <Container as="nav" aria-label="On this page" className="relative">
        <div className="flex items-center gap-gb-lg py-gb-lg">
          <div
            ref={listRef}
            className="-mx-gb-md flex min-w-0 flex-1 items-center gap-gb-xs overflow-x-auto px-gb-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((section) => {
              const active = section.id === activeId;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  data-anchor={section.id}
                  aria-current={active ? 'true' : undefined}
                  className={`shrink-0 rounded-gb-full px-gb-lg py-gb-sm text-gb-sm whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-brand-subtle font-semibold text-fg-brand'
                      : 'text-fg-tertiary hover:bg-surface-muted hover:text-fg'
                  }`}
                >
                  {section.label}
                </a>
              );
            })}
          </div>

          <div className="hidden shrink-0 items-center gap-gb-md lg:flex">
            {/*
             * There is no website column. `officialWebsite` is the project's
             * answer to "where does this university live" and it is honest about
             * partial coverage — when it misses, the button is not rendered
             * rather than linking nowhere.
             */}
            {officialSite ? (
              <Button href={officialSite} variant="secondary" size="sm">
                Official website
              </Button>
            ) : null}
            <Button href="/universities" size="sm">
              Search universities
            </Button>
          </div>
        </div>

        {/*
         * Reading progress. Decorative and duplicated by the scrollbar, so it is
         * hidden from assistive tech rather than announced as a progressbar that
         * nobody can act on.
         */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 block h-[2px] origin-left bg-brand transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </Container>
    </div>
  );
}
