'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/shared/ui';

/**
 * Kinetic-typography accent strip under the brand-red application header
 * (`ApplicationNav`) — "GlowBal" tiled edge-to-edge, crawling right to left,
 * as many repetitions as the header is wide, forever, which is what makes it
 * read as alive rather than a one-shot flourish. A soft white shimmer sweeps
 * through every so often for a bit of sparkle.
 *
 * ─── WHY ITS OWN STRIP, NOT A BACKDROP BEHIND THE NAV TEXT ───────────────────
 *
 * The first pass drew this as a full-height backdrop behind the breadcrumb
 * and sub-nav text, the same "ambient texture" idea the reference design
 * used. It looked right in isolation and wrong in the real header: this band
 * has no spare vertical space (two tightly-packed lines, no headroom), so
 * the marquee and its flash sat directly on top of "Overview / Personal
 * Report / …" and made it unreadable at the exact moment it was brightest.
 * A dedicated strip below the real content — never sharing a pixel with it —
 * is what lets this be visibly there without ever competing with navigation.
 *
 * `aria-hidden` and `pointer-events-none`: nothing here is information, and
 * it must never intercept a click. Gone entirely under `prefers-reduced-motion`.
 */

const WORD = 'GlowBal';
const FLASH_INTERVAL_MS = 5200;
const FLASH_DURATION_MS = 1400;
const FONT_FAMILY = '"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, sans-serif';
const BASE_ALPHA = 0.5;
const FLASH_PEAK_ALPHA = 0.95;
const CRAWL_PX_PER_S = 26;

export function ApplicationNavBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const styles = getComputedStyle(canvas);
    const textColor = styles.getPropertyValue('--color-brand-hover').trim() || '#be123c';
    const flashColor = styles.getPropertyValue('--color-on-brand').trim() || '#ffffff';

    let width = 0;
    let height = 0;
    let rafId = 0;
    let startTime: number | null = null;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Same guard `use-nav-reveal.ts` uses: ResizeObserver is universal in real
    // browsers but absent in jsdom, so a plain unguarded `new ResizeObserver`
    // would throw the moment this mounts under test.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    resize();

    function render(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsedMs = timestamp - startTime;

      ctx!.clearRect(0, 0, width, height);
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'middle';

      const fontSize = Math.min(height * 0.62, 22);
      ctx!.font = `700 ${fontSize}px ${FONT_FAMILY}`;

      const tile = `${WORD}   `;
      const tileWidth = ctx!.measureText(tile).width;
      if (tileWidth > 0) {
        const offset = (elapsedMs / 1000) * CRAWL_PX_PER_S;
        const start = -(((offset % tileWidth) + tileWidth) % tileWidth);
        const copies = Math.ceil((width - start) / tileWidth) + 2;
        const y = height / 2;

        // A soft shimmer sweeps through periodically — brighter, but still
        // brief and gentle, never a hard on/off blink.
        const cyclePos = elapsedMs % FLASH_INTERVAL_MS;
        const flashProgress = cyclePos / FLASH_DURATION_MS;
        const flashFactor = flashProgress <= 1 ? Math.sin(Math.PI * flashProgress) : 0;
        const alpha = BASE_ALPHA + (FLASH_PEAK_ALPHA - BASE_ALPHA) * flashFactor;

        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = flashFactor > 0.5 ? flashColor : textColor;
        for (let i = 0; i < copies; i += 1) {
          ctx!.fillText(tile, start + i * tileWidth, y);
        }
        ctx!.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
