'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingGlobe } from '@/components/landing-globe';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const rows = [
  { num: '01', label: 'Direction', body: 'Explore countries and courses with real signal — no noise, no overwhelm.' },
  { num: '02', label: 'Fit',       body: 'We show you why an option matches you, not just that it showed up in a search.' },
  { num: '03', label: 'Confidence',body: 'From first spark to shortlist — calm, purposeful, built for human decisions.' },
];

export function DesignElectric({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Scan-line entrance: a div that sweeps top→bottom then disappears
    gsap.fromTo('.c3-scan',
      { scaleY: 0, transformOrigin: 'top center' },
      { scaleY: 1, duration: 0.4, ease: 'power2.inOut',
        onComplete: () => gsap.to('.c3-scan', { opacity: 0, duration: 0.3 }),
      }
    );

    // Text words stagger in fast
    const tl = gsap.timeline({ delay: 0.3 });
    tl.from('.c3-word',  { opacity: 0, y: 70, skewX: -8, stagger: 0.06, duration: 0.6, ease: 'power4.out' })
      .from('.c3-sub',   { opacity: 0, y: 24, duration: 0.5, ease: 'power3.out' }, '-=0.2')
      .from('.c3-badge', { opacity: 0, x: -20, stagger: 0.07, duration: 0.4, ease: 'power2.out' }, '-=0.2')
      .from('.c3-globe', { opacity: 0, scale: 0.6, duration: 1.2, ease: 'expo.out' }, '-=0.5');

    // Globe pulse loop
    gsap.to('.c3-glow', { opacity: 0.6, scale: 1.15, duration: 2, ease: 'sine.inOut', repeat: -1, yoyo: true });

    // Feature rows wipe from left (clip-path)
    gsap.from('.c3-row', {
      scrollTrigger: { trigger: '.c3-rows', start: 'top 78%' },
      clipPath: 'inset(0 100% 0 0)', opacity: 0,
      stagger: 0.18, duration: 0.9, ease: 'power3.inOut',
    });

    // Row numbers count-in feel
    gsap.from('.c3-num', {
      scrollTrigger: { trigger: '.c3-rows', start: 'top 78%' },
      opacity: 0, scale: 0.6, stagger: 0.18, duration: 0.6, ease: 'back.out(2)',
    });

    // Form slam in
    gsap.from('.c3-form', {
      scrollTrigger: { trigger: '.c3-form', start: 'top 88%' },
      opacity: 0, y: 48, duration: 0.8, ease: 'power3.out',
    });
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className="relative overflow-x-hidden" style={{ background: '#060606', color: '#fff' }}>
      {/* Scan-line overlay */}
      <div aria-hidden className="c3-scan pointer-events-none fixed inset-0 z-50" style={{ background: 'linear-gradient(180deg,rgba(255,0,102,0.12),rgba(0,255,255,0.08))', scaleY: 0 } as React.CSSProperties} />

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24">
        {/* Neon grid lines */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,0,102,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,0,102,0.04) 1px,transparent 1px)', backgroundSize: '80px 80px' }} />

        {/* Globe glow */}
        <div className="c3-glow pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle,rgba(255,0,102,0.18),transparent 65%)' }} />

        {/* Globe */}
        <div className="c3-globe pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <LandingGlobe theme="electric" size={560} rotateSpeed={0.7} />
        </div>

        {/* Text */}
        <div className="relative z-10 max-w-4xl text-center">
          <div className="mb-6 flex flex-wrap justify-center gap-3">
            {['Students', 'Parents', 'Counsellors'].map((b) => (
              <span key={b} className="c3-badge inline-block rounded-full border border-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.2em] text-white/50">
                {b}
              </span>
            ))}
          </div>
          <h1 className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-6xl font-black uppercase tracking-tight md:text-8xl">
            {['Study', 'without', 'limits.'].map((w) => (
              <span
                key={w}
                className="c3-word inline-block"
                style={w === 'limits.' ? { background: 'linear-gradient(90deg,#ff006e,#00ffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : undefined}
              >
                {w}
              </span>
            ))}
          </h1>
          <p className="c3-sub mt-6 text-lg leading-8 text-white/50 md:text-xl">
            Glowbal is being rebuilt — smarter, calmer, student-first.
          </p>
        </div>

        <div aria-hidden className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[.6rem] font-bold uppercase tracking-[.35em] text-white/20">Scroll</span>
          <span className="h-8 w-px" style={{ background: 'linear-gradient(to bottom,rgba(255,0,102,0.4),transparent)' }} />
        </div>
      </section>

      {/* Feature rows */}
      <section className="c3-rows relative px-6 py-24 md:px-16 md:py-32">
        <p className="mb-12 text-xs font-bold uppercase tracking-[.25em]" style={{ color: '#ff006e' }}>What we're building</p>
        <div className="flex flex-col divide-y divide-white/[.06]">
          {rows.map((r) => (
            <div key={r.num} className="c3-row grid grid-cols-[3rem_1fr_1fr] items-center gap-6 py-8 md:grid-cols-[4rem_1fr_2fr]">
              <span className="c3-num text-2xl font-black" style={{ color: '#ff006e' }}>{r.num}</span>
              <span className="text-xl font-bold text-white md:text-2xl">{r.label}</span>
              <span className="text-sm leading-7 text-white/45 md:text-base">{r.body}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="relative px-6 pb-28 pt-8">
        <div
          className="c3-form mx-auto max-w-md rounded-[1.5rem] p-8"
          style={{ border: '1px solid rgba(255,0,102,0.3)', background: 'rgba(255,0,102,0.05)', boxShadow: '0 0 60px rgba(255,0,102,0.1),inset 0 1px 0 rgba(255,255,255,0.05)' }}
        >
          <p className="text-xs font-bold uppercase tracking-[.25em]" style={{ color: '#ff006e' }}>Early Access</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Join the list</h2>
          <p className="mt-2 text-sm leading-6 text-white/45">We'll reach out when Glowbal opens its doors.</p>
          <WaitlistForm action={action} />
        </div>
      </section>
    </div>
  );
}
