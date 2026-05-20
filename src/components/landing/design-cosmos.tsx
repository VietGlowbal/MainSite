'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { LandingGlobe } from '@/components/landing-globe';
import { CosmicBackground } from '@/components/landing/cosmic-background';
import { LandingSections, ContactsFooter } from '@/components/landing/landing-sections';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';

gsap.registerPlugin(useGSAP);

const features = [
  'Match with universities worldwide',
  'Talk to students who got in',
  'Apply with confidence',
];

export function DesignCosmos({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const waitlistRef = useRef<HTMLElement>(null);
  const pillClicks = useRef(0);
  const [cosmosOpacity, setCosmosOpacity] = useState(1);
  const [longContentOpacity, setLongContentOpacity] = useState(0);

  const handlePillClick = useCallback(() => {
    pillClicks.current += 1;
    if (pillClicks.current >= 5) {
      window.dispatchEvent(new CustomEvent('glowbal:reveal-nav'));
    }
  }, []);

  /**
   * The deep-space backdrop is the visual signature of the home hero,
   * but the rest of the site uses light surfaces. Once the user scrolls
   * past the waitlist card we crossfade the cosmos out and a light
   * gradient in, so the long-form sections sit on a surface that matches
   * the rest of the product (search, profile, etc).
   */
  useEffect(() => {
    function update() {
      const target = waitlistRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      // Distance from the bottom of the waitlist card to the top of the viewport.
      // Positive when the card has scrolled out of view above.
      const scrolledPast = -rect.bottom;
      // Crossfade across ~280px of scroll for a smooth handoff.
      const fadeDistance = 280;
      const t = Math.max(0, Math.min(1, scrolledPast / fadeDistance));
      setCosmosOpacity(1 - t);
      setLongContentOpacity(t);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.08 });
    tl.from('.landing-pill', { opacity: 0, y: -12, duration: 0.35, ease: 'power2.out' })
      .from('.landing-title', { opacity: 0, y: 26, duration: 0.55, ease: 'power3.out' }, '-=0.15')
      .from('.landing-subtitle', { opacity: 0, y: 18, duration: 0.45, ease: 'power3.out' }, '-=0.2')
      .from('.landing-cta', { opacity: 0, y: 16, stagger: 0.06, duration: 0.4, ease: 'power3.out' }, '-=0.2')
      .from('.landing-feature', { opacity: 0, y: 24, stagger: 0.08, duration: 0.45, ease: 'power3.out' }, '-=0.1')
      .from('.landing-globe', { opacity: 0, scale: 0.92, duration: 0.8, ease: 'expo.out' }, '-=0.7')
      .from('.landing-waitlist', { opacity: 0, y: 28, duration: 0.5, ease: 'power3.out' }, '-=0.15');
  }, { scope: rootRef });

  return (
    <div
      ref={rootRef}
      className="cosmos-root relative overflow-x-hidden text-white"
      style={{
        background: '#02060f',
      }}
    >
      {/* Canvas-based deep space — stars, nebula, meteors */}
      <div
        aria-hidden
        className="cosmic-bg-wrap pointer-events-none fixed inset-0 z-0 transition-opacity duration-200"
        style={{ opacity: cosmosOpacity }}
      >
        <CosmicBackground />
      </div>

      {/* Soft brand colour wash on top of the canvas (also fades with cosmos) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-200"
        style={{
          opacity: cosmosOpacity,
          background:
            'radial-gradient(ellipse at 18% 12%, rgba(34,211,238,0.10), transparent 35%), radial-gradient(ellipse at 82% 18%, rgba(244,114,182,0.09), transparent 32%)',
        }}
      />

      {/* Light-mode wash that mirrors the rest of the product. Fades in
          as the cosmos fades out so the page feels like a single piece. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-200"
        style={{
          opacity: longContentOpacity,
          background:
            'radial-gradient(ellipse at 60% 0%, #EEF0FF 0%, #F5F6FF 55%), linear-gradient(180deg, #F5F6FF 0%, #ffffff 80%)',
        }}
      />

      <section className="relative z-10 px-5 pb-16 pt-20 sm:px-6 md:pt-24 lg:pb-20 lg:pt-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1fr)] lg:items-center lg:gap-10">
          {/* ── Copy ─────────────────────────────────────────────── */}
          <div className="relative z-10 max-w-3xl text-center lg:text-left">
            <button
              type="button"
              onClick={handlePillClick}
              className="landing-pill inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200 backdrop-blur sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.24em]"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Early access
            </button>

            <h1 className="landing-title mt-5 text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-[5.25rem] lg:leading-none lg:tracking-[-0.05em] xl:text-[5.75rem]">
              Your future
              <span className="glowbal-wordmark block">is global</span>
            </h1>

            <p className="landing-subtitle mx-auto mt-4 max-w-xl text-[0.95rem] leading-7 text-white/70 sm:text-base sm:leading-8 md:text-lg lg:mx-0 lg:max-w-2xl lg:text-xl">
              <span className="glowbal-wordmark">GLOWBAL</span> is the calmer way to find, apply to, and get into universities anywhere in the world. Match with the right schools, learn from students who&apos;ve been there, and ship your application with less noise.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a
                href="/universities"
                className="landing-cta inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff4d8c,#ff8fb8)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
              >
                Find your match
              </a>
              <a
                href="#waitlist"
                className="landing-cta inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-7 py-3.5 text-sm font-semibold text-white/88 backdrop-blur transition hover:bg-white/10"
              >
                Get early access
              </a>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3 lg:justify-start">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="landing-feature rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 text-[0.78rem] font-medium text-white/78 backdrop-blur-sm sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* ── Globe ─────────────────────────────────────────────── */}
          <div className="landing-globe relative order-first flex items-center justify-center lg:order-none lg:justify-end">
            <div className="cosmos-globe-stage">
              {/* soft halo behind the globe so it feels suspended */}
              <div className="cosmos-globe-halo" aria-hidden />
              <LandingGlobe theme="cosmos" rotateSpeed={0.26} responsive />
            </div>
          </div>
        </div>
      </section>

      <section ref={waitlistRef} id="waitlist" className="relative z-10 px-5 pb-12 sm:px-6">
        <div className="landing-waitlist relative mx-auto grid max-w-5xl gap-7 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-6 backdrop-blur-xl sm:rounded-[2rem] sm:p-8 md:grid-cols-[1fr_360px] md:gap-8 md:p-10">
          {/* Animated brand-gradient ring frames the join card so it pops as the
              key conversion point on the page. */}
          <span aria-hidden className="cosmic-waitlist-ring" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/85 sm:text-xs sm:tracking-[0.24em]">Join our waitlist</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl sm:tracking-[-0.04em]">
              <span className="glowbal-wordmark">GLOWBAL</span> is in development —
              be first in line.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/64 sm:mt-4 md:text-base">
              Real universities. Real students who got in. Real advice.
              Skip the agents, the noise, and the endless tabs. Add yourself
              to the waitlist and we&apos;ll let you in as we open the doors.
            </p>

            <ul className="mt-5 space-y-2 text-sm text-white/72">
              <li className="flex items-center gap-2">
                <span className="cosmic-waitlist-tick" /> Free for early users
              </li>
              <li className="flex items-center gap-2">
                <span className="cosmic-waitlist-tick" /> No spam — one welcome email, that&apos;s it
              </li>
              <li className="flex items-center gap-2">
                <span className="cosmic-waitlist-tick" /> Help shape the product as we build
              </li>
            </ul>
          </div>

          <div style={{ '--glow-input-bg': 'rgba(255,255,255,0.06)', color: 'inherit' } as React.CSSProperties}>
            <WaitlistForm action={action} />
          </div>
        </div>
      </section>

      {/* ── Long-form content ───────────────────────────────────────
          Wrapped in a "light surface" zone so once the cosmos fades
          out, the sections feel native to the rest of the site. */}
      <div className="relative z-10 cosmos-light-zone">
        <LandingSections />
      </div>

      <div className="relative z-10 cosmos-light-zone">
        <ContactsFooter />
      </div>
    </div>
  );
}
