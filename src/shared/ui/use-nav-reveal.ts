'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Keeps the top bar reachable without scrolling back to the top of the page.
 *
 * The bar used to be a plain block in normal flow: it scrolled away, and the
 * only way back was to scroll all the way up. This makes it sticky and hides it
 * off the top edge once the student has scrolled past it, then brings it back
 * when they reach for it.
 *
 * ─── IT MOVES BY `top`, NOT BY `transform`, AND THAT IS LOAD-BEARING ─────────
 *
 * `TopNav`'s dropdown panel is `position: fixed` on purpose — the `<nav>` is
 * `overflow-hidden` so a too-narrow bar clips its labels instead of sliding
 * them under the buttons, and an absolutely positioned panel would be clipped
 * at the bar's bottom edge. A fixed panel escapes that only while no ancestor
 * establishes a containing block, and `transform` is exactly what does. So the
 * obvious implementation — `-translate-y-full` — would silently reintroduce the
 * clipping bug the fixed panel exists to avoid.
 *
 * `position: sticky` does not create a containing block for fixed descendants,
 * and `top` is animatable, so a sticky header parked at `top: -<height>` is
 * fully hidden and slides in by animating that number to zero. It also never
 * leaves the flow, so nothing below it jumps when it hides — which the usual
 * "switch to fixed and add a spacer" approach has to work to avoid.
 *
 * ─── WAYS BACK, AND ONE THAT IS DELIBERATELY NOT HERE ────────────────────────
 *
 *   1. The pointer comes within `REVEAL_ZONE_PX` of the top edge — the one the
 *      owner asked for, and on a mouse the only one.
 *   2. Focus enters the bar. A keyboard user tabbing into a bar parked
 *      off-screen would otherwise be focusing something they cannot see, so
 *      this is not negotiable on accessibility grounds.
 *   3. Scrolling back to the very top of the document (`AT_TOP_PX`), where the
 *      bar is simply at rest in its normal place.
 *
 * Scrolling UP mid-page used to reveal it too. It does not any more: the owner
 * asked for a bar that stays gone while reading and comes back only when
 * reached for, and reveal-on-scroll-up meant every upward flick — including the
 * overscroll bounce at the end of a downward one — flashed the bar over the
 * content. Point 3 is what keeps a touchscreen-only desktop from being stranded.
 *
 * Hiding uses a larger threshold than revealing (`HIDE_ZONE_PX`) so the bar
 * does not flicker when the pointer sits near the boundary.
 *
 * ─── IT ALSO PUBLISHES ITS HEIGHT, SO STICKY PAGE FURNITURE CAN FOLLOW ───────
 *
 * A sticky sub-nav pinned at `top: 0` sits UNDER this bar whenever it is
 * revealed. Rather than have every such bar hard-code 69px, the live measured
 * height goes onto `<html>` as `--gb-nav-reveal` (0px while hidden), which
 * `--gb-nav-offset` in tokens.css turns into the number sticky elements
 * actually pin to. See that token's comment for the contract.
 */

/** Pointer within this many px of the top edge reveals the bar. */
const REVEAL_ZONE_PX = 90;
/** It hides again only below this — the gap is hysteresis, not a typo. */
const HIDE_ZONE_PX = 160;
/** Scrolled less than this and the bar is simply at rest in its normal place. */
const AT_TOP_PX = 8;

/** Fired when the bar hides, so an open dropdown can close with it. */
export const NAV_HIDDEN_EVENT = 'glowbal:nav-hidden';

/**
 * Live height of the revealed bar, read by `--gb-nav-offset` (tokens.css).
 *
 * Written to `<html>`'s inline style, which is also `:root`, so the inline value
 * wins over the stylesheet and the derived `--gb-nav-offset` recomputes.
 */
const NAV_REVEAL_VAR = '--gb-nav-reveal';

export type NavReveal = {
  ref: React.RefObject<HTMLElement | null>;
  /** Inline `top`, in px. 0 when shown, negative by the bar's height when not. */
  top: number;
  /** False while the bar is at rest at the top of the document. */
  isFloating: boolean;
  /** True once the bar is parked off-screen — the caller drops its shadow. */
  isHidden: boolean;
};

/**
 * The bar's own height, border and padding included.
 *
 * ⚠️ NOT `entry.contentRect.height`. That is the CONTENT box, so it omits the
 * bar's 16px vertical padding and its 1px rule — about half its height. Parking
 * the bar at `-contentRect.height` left a ~33px strip of it on screen, which is
 * the "the nav doesn't disappear completely" bug. `borderBoxSize` is the
 * observer's own border-box figure; `getBoundingClientRect` is the fallback for
 * engines that predate it.
 */
function measure(element: Element, entry?: ResizeObserverEntry): number {
  const box = entry?.borderBoxSize?.[0];
  if (box) return box.blockSize;
  return element.getBoundingClientRect().height;
}

export function useNavReveal(): NavReveal {
  const ref = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // The bar's height changes with the viewport (labels wrap, gaps open up),
    // so it is measured rather than assumed — a hard-coded value would leave a
    // sliver of bar visible at some widths.
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(([entry]) => {
          if (entry) setHeight(measure(element, entry));
        });
    observer?.observe(element);
    setHeight(measure(element));

    function update(revealed: boolean | null) {
      const scrollY = window.scrollY;
      const atTop = scrollY <= AT_TOP_PX;
      setIsFloating(!atTop);
      if (atTop) {
        // At the top of the document the bar is where it has always been.
        setHidden(false);
        return;
      }
      if (revealed !== null) setHidden(!revealed);
    }

    function onPointerMove(event: PointerEvent) {
      // A coarse pointer reports a position on tap; treating that as "reaching
      // for the bar" would make it appear on every tap near the top.
      if (event.pointerType !== 'mouse') return;
      if (event.clientY <= REVEAL_ZONE_PX) update(true);
      else if (event.clientY > HIDE_ZONE_PX) update(false);
    }

    // Any scroll away from the top hides the bar, in either direction. Reaching
    // for the top edge is what brings it back — see the note on ways back.
    function onScroll() {
      update(window.scrollY > AT_TOP_PX ? false : null);
    }

    // Focus is the keyboard route back in — see the header.
    function onFocusIn(event: FocusEvent) {
      const target = event.target as Node | null;
      if (target && element?.contains(target)) update(true);
    }

    // Leaving the window entirely should not leave the bar pinned open.
    function onPointerLeave() {
      update(false);
    }

    update(null);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);

    return () => {
      observer?.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  // An open dropdown's panel is placed against the viewport and only re-measures
  // on scroll — a bar that slides away underneath it would strand the panel
  // mid-air. Closing on hide is simpler and less surprising than chasing it.
  useEffect(() => {
    if (hidden) window.dispatchEvent(new Event(NAV_HIDDEN_EVENT));
  }, [hidden]);

  /*
   * Tell the page how much room the bar is taking, so sticky furniture below it
   * can pin to `--gb-nav-offset` and be pushed down / released with it.
   *
   * The `height > 0` guard is load-bearing in two ways. It skips the first paint
   * before the measurement lands, and it skips a bar that is `display: none` —
   * which is exactly the duplicate global bar that the `[data-global-navigation]`
   * rule in globals.css switches off. Without it, that hidden twin would report
   * 0 and flatten the offset while the page's real bar is on screen.
   */
  useEffect(() => {
    if (height <= 0) return;
    const root = document.documentElement;
    root.style.setProperty(NAV_REVEAL_VAR, hidden ? '0px' : `${height}px`);
    return () => {
      root.style.removeProperty(NAV_REVEAL_VAR);
    };
  }, [hidden, height]);

  return {
    ref,
    // Height is 0 on the very first paint, before the measurement lands. Zero
    // is the safe value: the bar shows rather than hiding at an unknown offset.
    top: hidden && height > 0 ? -height : 0,
    isFloating,
    isHidden: hidden && height > 0,
  };
}
