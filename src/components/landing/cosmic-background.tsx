'use client';

/**
 * CosmicBackground
 * ─────────────────
 * Canvas-based deep-space scene that lives behind the landing page:
 *   • Three parallax layers of stars (depth, color variance, glow on close ones)
 *   • Subtle twinkle driven by per-star phase + speed
 *   • Soft nebula radial tints (cyan + pink) for atmosphere
 *   • Meteors with proper tapered trails, ease-in/ease-out alpha, and a bright head
 *   • Slow drift on closer layers to suggest the camera moving through space
 *
 * It's DPR-aware, pauses on hidden tabs, and respects prefers-reduced-motion.
 * No external animation libs — one rAF loop, scoped to the canvas.
 */

import { useEffect, useRef } from 'react';

type StarColor = readonly [number, number, number];

const STAR_COLORS: StarColor[] = [
  [255, 255, 255], // white
  [232, 244, 255], // pale blue-white
  [186, 230, 253], // soft cyan
  [244, 196, 228], // pale pink
  [255, 220, 240], // warm pink-white
];

type Star = {
  x: number;
  y: number;
  r: number;
  depth: number;       // 0 = far, 1 = near
  baseAlpha: number;
  twPhase: number;     // twinkle phase offset
  twSpeed: number;     // twinkle speed
  drift: number;       // px / frame (already weighted by depth)
  color: StarColor;
};

type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  maxLife: number;
};

export function CosmicBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    const meteors: Meteor[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      // Density scales with viewport area, but capped so phones aren't
      // overwhelmed and giant monitors don't bog down.
      const area = width * height;
      const isNarrow = width < 640;
      const divisor = isNarrow ? 7000 : 5200;
      const target = Math.max(120, Math.min(isNarrow ? 220 : 480, Math.floor(area / divisor)));

      stars = [];
      for (let i = 0; i < target; i += 1) {
        const depth = Math.random();
        // Sizes biased so most stars are tiny, with a sprinkling of bigger close ones.
        const r =
          depth < 0.45
            ? 0.35 + Math.random() * 0.35
            : depth < 0.82
            ? 0.55 + Math.random() * 0.6
            : 0.9 + Math.random() * 1.4;
        const baseAlpha = 0.28 + depth * 0.7;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r,
          depth,
          baseAlpha,
          twPhase: Math.random() * Math.PI * 2,
          twSpeed: 0.4 + Math.random() * 1.6,
          drift: 0.015 + depth * 0.05,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        });
      }
    }

    function spawnMeteor(now: number) {
      // Most meteors come from the upper-right and slice down-left,
      // a couple variations keep it from feeling on-rails.
      const variant = Math.random();
      let x: number;
      let y: number;
      let angleDeg: number;

      if (variant < 0.65) {
        // top-right → bottom-left
        x = width * (0.6 + Math.random() * 0.45);
        y = -40 - Math.random() * 60;
        angleDeg = 150 + Math.random() * 20; // pointing down-left
      } else if (variant < 0.9) {
        // right edge → bottom-left
        x = width + 40 + Math.random() * 60;
        y = height * (0.05 + Math.random() * 0.5);
        angleDeg = 165 + Math.random() * 15;
      } else {
        // top-left → bottom-right (rare)
        x = -40 - Math.random() * 60;
        y = height * (0.05 + Math.random() * 0.4);
        angleDeg = 25 + Math.random() * 15;
      }

      const angle = (angleDeg * Math.PI) / 180;
      const speed = 7 + Math.random() * 5;
      const len = 110 + Math.random() * 110;
      const maxLife = 70 + Math.random() * 40;

      meteors.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len,
        life: 0,
        maxLife,
      });

      // Schedule next one with some breathing room.
      nextMeteorAt = now + 3800 + Math.random() * 5200;
    }

    function drawNebula() {
      const minDim = Math.min(width, height);
      const r1 = ctx!.createRadialGradient(
        width * 0.18,
        height * 0.22,
        0,
        width * 0.18,
        height * 0.22,
        minDim * 1.05,
      );
      r1.addColorStop(0, 'rgba(34, 211, 238, 0.13)');
      r1.addColorStop(0.55, 'rgba(34, 211, 238, 0.04)');
      r1.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx!.fillStyle = r1;
      ctx!.fillRect(0, 0, width, height);

      const r2 = ctx!.createRadialGradient(
        width * 0.82,
        height * 0.78,
        0,
        width * 0.82,
        height * 0.78,
        minDim * 1.1,
      );
      r2.addColorStop(0, 'rgba(244, 114, 182, 0.11)');
      r2.addColorStop(0.55, 'rgba(244, 114, 182, 0.03)');
      r2.addColorStop(1, 'rgba(244, 114, 182, 0)');
      ctx!.fillStyle = r2;
      ctx!.fillRect(0, 0, width, height);

      // A faint vignette into deep space at the bottom.
      const vg = ctx!.createLinearGradient(0, 0, 0, height);
      vg.addColorStop(0, 'rgba(2, 6, 18, 0)');
      vg.addColorStop(1, 'rgba(2, 6, 18, 0.55)');
      ctx!.fillStyle = vg;
      ctx!.fillRect(0, 0, width, height);
    }

    function drawStars(now: number) {
      const t = now / 1000;
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(s.twPhase + t * s.twSpeed);
        const alpha = s.baseAlpha * tw;
        const [r, g, b] = s.color;

        // Bigger, closer stars get a soft halo so they read as bright points
        // rather than flat dots.
        if (s.depth > 0.65) {
          const glowR = s.r * (s.depth > 0.9 ? 5 : 3.5);
          const grad = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
          grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.55})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx!.fillStyle = grad;
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, glowR, 0, Math.PI * 2);
          ctx!.fill();
        }

        ctx!.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();

        // Slow horizontal drift adds a sense of camera motion.
        s.x += s.drift;
        if (s.x > width + 6) s.x = -6;
      }
    }

    function drawMeteors() {
      for (let i = meteors.length - 1; i >= 0; i -= 1) {
        const m = meteors[i];
        m.life += 1;
        m.x += m.vx;
        m.y += m.vy;

        const t = m.life / m.maxLife;
        // ease in over first 12% of life, ease out for the rest
        const alpha = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88);

        if (
          alpha <= 0 ||
          m.x < -260 ||
          m.x > width + 260 ||
          m.y > height + 260 ||
          m.y < -260
        ) {
          meteors.splice(i, 1);
          continue;
        }

        const speed = Math.hypot(m.vx, m.vy) || 1;
        const tx = m.x - (m.vx / speed) * m.len;
        const ty = m.y - (m.vy / speed) * m.len;

        // Tapered trail.
        const grad = ctx!.createLinearGradient(m.x, m.y, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(0.35, `rgba(186,230,253,${alpha * 0.75})`);
        grad.addColorStop(1, 'rgba(186,230,253,0)');
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.8;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(m.x, m.y);
        ctx!.lineTo(tx, ty);
        ctx!.stroke();

        // Bright head.
        const headR = 6;
        const headGrad = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, headR);
        headGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        headGrad.addColorStop(0.6, `rgba(186,230,253,${alpha * 0.6})`);
        headGrad.addColorStop(1, 'rgba(186,230,253,0)');
        ctx!.fillStyle = headGrad;
        ctx!.beginPath();
        ctx!.arc(m.x, m.y, headR, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    let raf = 0;
    let nextMeteorAt = performance.now() + 1800 + Math.random() * 2000;

    function frame(now: number) {
      ctx!.clearRect(0, 0, width, height);
      drawNebula();
      drawStars(now);

      if (!reduce) {
        if (now >= nextMeteorAt) spawnMeteor(now);
        drawMeteors();
      }

      raf = requestAnimationFrame(frame);
    }

    resize();

    if (reduce) {
      // Render a single static scene; no rAF loop.
      ctx.clearRect(0, 0, width, height);
      drawNebula();
      drawStars(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    function onResize() {
      resize();
    }

    function onVisibility() {
      if (reduce) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(frame);
      }
    }

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="cosmic-bg-canvas" />;
}
