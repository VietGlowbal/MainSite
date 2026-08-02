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
 * ─── THREE WAYS BACK, BECAUSE A MOUSE IS NOT THE ONLY POINTER ────────────────
 *
 *   1. The pointer comes within `REVEAL_ZONE_PX` of the top edge — the one the
 *      owner asked for.
 *   2. Focus enters the bar. A keyboard user tabbing into a bar parked
 *      off-screen would otherwise be focusing something they cannot see.
 *   3. Scrolling up. The bar is desktop-only (`hidden md:block`), but a
 *      touchscreen laptop is still desktop-width and has no hover at all —
 *      without this, those students would have no way to bring it back.
 *
 * Hiding uses a larger threshold than revealing (`HIDE_ZONE_PX`) so the bar
 * does not flicker when the pointer sits near the boundary.
 */

/** Pointer within this many px of the top edge reveals the bar. */
const REVEAL_ZONE_PX = 90;
/** It hides again only below this — the gap is hysteresis, not a typo. */
const HIDE_ZONE_PX = 160;
/** Scrolled less than this and the bar is simply at rest in its normal place. */
const AT_TOP_PX = 8;

/** Fired when the bar hides, so an open dropdown can close with it. */
export const NAV_HIDDEN_EVENT = 'glowbal:nav-hidden';

export type NavReveal = {
  ref: React.RefObject<HTMLElement | null>;
  /** Inline `top`, in px. 0 when shown, negative by the bar's height when not. */
  top: number;
  /** False while the bar is at rest at the top of the document. */
  isFloating: boolean;
};

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
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeight(entry.contentRect.height);
    });
    observer.observe(element);
    setHeight(element.getBoundingClientRect().height);

    let lastScrollY = window.scrollY;

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

    function onScroll() {
      const scrollY = window.scrollY;
      const scrolledUp = scrollY < lastScrollY;
      lastScrollY = scrollY;
      update(scrolledUp ? true : scrollY > AT_TOP_PX ? false : null);
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
      observer.disconnect();
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

  return {
    ref,
    // Height is 0 on the very first paint, before the measurement lands. Zero
    // is the safe value: the bar shows rather than hiding at an unknown offset.
    top: hidden && height > 0 ? -height : 0,
    isFloating,
  };
}
