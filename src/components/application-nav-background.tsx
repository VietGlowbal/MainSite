'use client';

import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/shared/ui';

/**
 * Kinetic-typography backdrop for the brand-red application header
 * (`ApplicationNav`) — adapted from a reference canvas animation the owner
 * supplied, ported algorithm-for-algorithm (the ease-in typing curve, the
 * exponential-decay marquee physics, the per-instance alignment flash) but
 * scaled to fit this header's real, unchanged height rather than the
 * reference's fullscreen canvas. Purely decorative: `aria-hidden`,
 * `pointer-events-none`, gone under `prefers-reduced-motion`.
 *
 * ─── THE THREE PHASES, PORTED FROM THE REFERENCE ─────────────────────────────
 *
 * 1. "Go" stretches into "Gooooo…" across the header width, `'o'` typing in
 *    on an accelerating ease (`progress ** 2.8`) — starts slow, accelerates
 *    hard toward the edge, each new `'o'` scaling and fading in rather than
 *    popping.
 * 2. Once typing finishes, "Glow" (moving right) and "GlowBal" (moving left)
 *    fade in underneath and crawl in opposite directions, entering fast and
 *    decaying exponentially into a slow, steady drift — an integrated
 *    velocity curve (`steady*t + (burst/decay)*(1-e^(-decay*t))`), not a
 *    hand-tuned keyframe, so there is no seam where the deceleration ends.
 * 3. As the two rows cross the header's start column, the ONE word instance
 *    that lands there — and the "Go" prefix — flash white for 2 seconds on
 *    a sine curve. "GlowBal" (moving left) flashes 1 second ahead of the
 *    geometric crossing as an anticipatory cue, matching the reference.
 *
 * ─── WHY ONLY ONE WORD INSTANCE FLASHES, NOT THE WHOLE ROW ───────────────────
 *
 * A first pass flashed every tiled copy in a row at once — visually
 * indistinguishable from the whole line turning white, which (confined to
 * this header's real height, with no room to separate the animation from the
 * breadcrumb/nav text above it) briefly outshone the actual navigation. The
 * reference's own alignment logic only ever highlights the ONE instance
 * whose screen position matches the trigger (`Math.abs(x - targetX) < 2`);
 * ported faithfully, at most two small words are ever bright at once,
 * everywhere else stays in the low-contrast base rose, and the real white
 * nav text on top never has to compete with anything its own size.
 */

const BOOT_PREFIX = 'G';
const BOOT_REPEAT = 'o';
const BOOT_DURATION_S = 1.4;
const ROW_2_WORD = 'Glow';
const ROW_3_WORD = 'GlowBal';
const FLASH_DURATION_MS = 2000;
const FONT_FAMILY = '"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, sans-serif';

// Phase 2 deceleration physics — steady crawl, initial burst, and how fast
// the burst decays away. The reference's own constants.
const STEADY_SPEED = 8.8;
const INITIAL_EXTRA_SPEED = 168;
const DECAY_RATE = 1.15;

// The reference ran at full opacity on a fullscreen canvas with real empty
// space around it. Confined to this header's actual height, three lines of
// text at full strength directly behind the breadcrumb/nav read as clutter,
// not texture — this is the second lever (besides the per-instance flash
// fix above) that keeps it feeling like ambient motion rather than a second
// competing message. `FLASH_PEAK_ALPHA` caps how bright even an active
// flash gets, well short of matching the real white nav text's own weight.
const BASE_ALPHA = 0.22;
const FLASH_PEAK_ALPHA = 0.65;

type RowFlash = { startedAt: number; offsetAlign: number };

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
    let bootDone = false;

    let row2Flashes: RowFlash[] = [];
    let row3Flashes: RowFlash[] = [];
    let prefixFlashes: { startedAt: number }[] = [];
    let prevOffset2 = 0;
    let prevOffset3 = 0;

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

    /** The signed tile boundary a row's word crosses this frame, or null — mirrors the reference's checkWordAlignment. */
    function crossedTile(
      offset: number,
      prevOffset: number,
      direction: 1 | -1,
      leadDistance: number,
      tileWidth: number,
    ): number | null {
      if (tileWidth <= 0) return null;
      const posCurr = direction > 0 ? offset + leadDistance : -offset + leadDistance;
      const posPrev = direction > 0 ? prevOffset + leadDistance : -prevOffset + leadDistance;
      const indexCurr = Math.floor(posCurr / tileWidth);
      const indexPrev = Math.floor(posPrev / tileWidth);
      if (indexCurr <= indexPrev) return null;
      return direction > 0 ? indexCurr * tileWidth : -indexCurr * tileWidth;
    }

    function sineAlpha(flashes: readonly { startedAt: number }[], now: number) {
      let alpha = 0;
      for (const flash of flashes) {
        const progress = (now - flash.startedAt) / FLASH_DURATION_MS;
        if (progress >= 0 && progress <= 1) alpha = Math.max(alpha, Math.sin(Math.PI * progress));
      }
      return alpha;
    }

    /**
     * One marquee row, tiled edge-to-edge — base copies in the low-contrast
     * rose, then a white overlay on only the ONE tile instance a matching
     * flash targets (`targetX`, the tile's current screen position given how
     * far the row has scrolled since the flash was recorded).
     */
    function drawRow(
      word: string,
      y: number,
      offset: number,
      alignX: number,
      flashes: readonly RowFlash[],
      now: number,
      alphaMultiplier: number,
    ) {
      const tile = `${word}  `;
      const tileWidth = ctx!.measureText(tile).width;
      if (tileWidth <= 0) return;

      let basePos = alignX + (((offset % tileWidth) + tileWidth) % tileWidth);
      while (basePos > -tileWidth * 2) basePos -= tileWidth;
      const copies = Math.ceil((width - basePos) / tileWidth) + 2;

      ctx!.save();
      ctx!.globalAlpha = BASE_ALPHA * alphaMultiplier;
      ctx!.fillStyle = textColor;
      for (let i = 0; i < copies; i += 1) {
        ctx!.fillText(tile, basePos + i * tileWidth, y);
      }
      ctx!.restore();

      for (let i = 0; i < copies; i += 1) {
        const x = basePos + i * tileWidth;
        let factor = 0;
        for (const flash of flashes) {
          const targetX = alignX + (offset - flash.offsetAlign);
          if (Math.abs(x - targetX) < 2) {
            const progress = (now - flash.startedAt) / FLASH_DURATION_MS;
            if (progress >= 0 && progress <= 1) factor = Math.max(factor, Math.sin(Math.PI * progress));
          }
        }
        if (factor > 0) {
          ctx!.save();
          ctx!.globalAlpha = factor * FLASH_PEAK_ALPHA * alphaMultiplier;
          ctx!.fillStyle = flashColor;
          ctx!.fillText(tile, x, y);
          ctx!.restore();
        }
      }
    }

    function render(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      ctx!.clearRect(0, 0, width, height);
      ctx!.textAlign = 'left';
      ctx!.textBaseline = 'top';

      row2Flashes = row2Flashes.filter((f) => timestamp - f.startedAt < FLASH_DURATION_MS);
      row3Flashes = row3Flashes.filter((f) => timestamp - f.startedAt < FLASH_DURATION_MS);
      prefixFlashes = prefixFlashes.filter((f) => timestamp - f.startedAt < FLASH_DURATION_MS);

      // Proportional to the header's own (unchanged) height, not the
      // reference's viewport-width-based sizing — there is no spare height
      // to grow into here, so everything scales to what the band actually has.
      const mainFontSize = Math.max(10, height * 0.26);
      const subFontSize = mainFontSize * 0.5;
      const startX = 2;
      const bootY = height * 0.04;

      ctx!.font = `700 ${mainFontSize}px ${FONT_FAMILY}`;
      const prefixWidth = ctx!.measureText(BOOT_PREFIX).width;
      const oWidth = ctx!.measureText(BOOT_REPEAT).width;
      const neededOs = Math.max(1, Math.ceil((width - startX - prefixWidth) / oWidth) + 4);

      const rawProgress = Math.min(elapsed / BOOT_DURATION_S, 1);
      const eased = rawProgress ** 2.8;
      const fade = Math.min(elapsed / (BOOT_DURATION_S * 0.2), 1);
      const currentOProgress = eased * neededOs;
      const fullOIndex = Math.floor(currentOProgress);
      const partialFrac = currentOProgress - fullOIndex;

      // The "Go" line — base text, the active prefix flash (if any), and the
      // currently-typing 'o' scaling/fading in.
      ctx!.save();
      ctx!.globalAlpha = fade * BASE_ALPHA;
      ctx!.fillStyle = textColor;
      ctx!.fillText(BOOT_PREFIX + BOOT_REPEAT.repeat(fullOIndex), startX, bootY);

      const prefixFlashAlpha = sineAlpha(prefixFlashes, timestamp);
      if (prefixFlashAlpha > 0) {
        ctx!.save();
        ctx!.globalAlpha = fade * prefixFlashAlpha * FLASH_PEAK_ALPHA;
        ctx!.fillStyle = flashColor;
        ctx!.fillText(BOOT_PREFIX + BOOT_REPEAT.repeat(fullOIndex), startX, bootY);
        ctx!.restore();
      }

      if (!bootDone && fullOIndex < neededOs) {
        const activeX = startX + prefixWidth + fullOIndex * oWidth;
        ctx!.save();
        ctx!.globalAlpha = fade * BASE_ALPHA * Math.min(partialFrac * 1.5, 1);
        const scale = 0.75 + partialFrac * 0.25;
        ctx!.translate(activeX + oWidth / 2, bootY + mainFontSize / 2);
        ctx!.scale(scale, scale);
        ctx!.fillStyle = textColor;
        ctx!.fillText(BOOT_REPEAT, -oWidth / 2, -mainFontSize / 2);
        ctx!.restore();
      }
      ctx!.restore();

      if (rawProgress >= 1) bootDone = true;

      // Phase 2 — the two marquee rows, once the header has finished typing.
      if (bootDone) {
        const t2 = Math.max(0, elapsed - BOOT_DURATION_S);
        const marqueeAlpha = Math.min(t2 / 0.18, 1);
        const distance =
          STEADY_SPEED * t2 + (INITIAL_EXTRA_SPEED / DECAY_RATE) * (1 - Math.exp(-DECAY_RATE * t2));
        const offset2 = distance; // Glow moves right
        const offset3 = -distance; // GlowBal moves left
        const currentSpeed = STEADY_SPEED + INITIAL_EXTRA_SPEED * Math.exp(-DECAY_RATE * t2);

        ctx!.font = `700 ${subFontSize}px ${FONT_FAMILY}`;

        const row2Y = bootY + mainFontSize * 0.92;
        const row3Y = row2Y + subFontSize * 1.05;

        const tile2Width = ctx!.measureText(`${ROW_2_WORD}  `).width;
        const tile3Width = ctx!.measureText(`${ROW_3_WORD}  `).width;

        if (t2 > 0.6) {
          // Row 2 flashes right at the crossing; row 3 (the anticipatory
          // cue) gets a 1-second lead so both flashes read as synchronised.
          const align2 = crossedTile(offset2, prevOffset2, 1, 0, tile2Width);
          if (align2 !== null) {
            row2Flashes.push({ startedAt: timestamp, offsetAlign: align2 });
            prefixFlashes.push({ startedAt: timestamp });
          }
          const align3 = crossedTile(offset3, prevOffset3, -1, currentSpeed * 1.0, tile3Width);
          if (align3 !== null) {
            row3Flashes.push({ startedAt: timestamp, offsetAlign: align3 });
            prefixFlashes.push({ startedAt: timestamp });
          }
        }
        prevOffset2 = offset2;
        prevOffset3 = offset3;

        drawRow(ROW_2_WORD, row2Y, offset2, startX, row2Flashes, timestamp, marqueeAlpha);
        drawRow(ROW_3_WORD, row3Y, offset3, startX, row3Flashes, timestamp, marqueeAlpha);
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
