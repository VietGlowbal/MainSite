'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingGlobe } from '@/components/landing-globe';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const features = [
  { icon: '🌍', title: 'Explore with clarity', body: 'Discover countries, courses, and next steps without the usual noise and overwhelm.' },
  { icon: '✨', title: 'Recommendations that make sense', body: 'We explain why an option fits you — not just a ranked list to figure out yourself.' },
  { icon: '🛸', title: 'A journey built for you', body: 'From curious spark to confident shortlist — calm, modern, and encouraging every step.' },
];

export function DesignCosmos({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Entry sequence
    const tl = gsap.timeline({ delay: 0.15 });
    tl.from('.c1-globe', { opacity: 0, scale: 0.4, duration: 1.8, ease: 'expo.out' })
      .from('.c1-pill', { opacity: 0, y: -20, duration: 0.5, ease: 'back.out(2.5)' }, '-=0.9')
      .from('.c1-word', { opacity: 0, y: 80, rotateX: -20, stagger: 0.08, duration: 0.9, ease: 'power4.out' }, '-=0.5')
      .from('.c1-sub',  { opacity: 0, y: 28, duration: 0.7, ease: 'power3.out' }, '-=0.4')
      .from('.c1-badge',{ opacity: 0, scale: 0.7, stagger: 0.08, duration: 0.5, ease: 'back.out(2)' }, '-=0.3');

    // Globe parallax as hero scrolls away
    gsap.to('.c1-globe-wrap', {
      scrollTrigger: { trigger: '.c1-hero', start: 'top top', end: 'bottom top', scrub: 1.8 },
      y: -70, scale: 0.7, opacity: 0.25,
    });
    gsap.to('.c1-text', {
      scrollTrigger: { trigger: '.c1-hero', start: 'top top', end: '60% top', scrub: 1.2 },
      y: -40, opacity: 0,
    });

    // Feature cards stagger in
    gsap.from('.c1-feature', {
      scrollTrigger: { trigger: '.c1-features', start: 'top 76%' },
      opacity: 0, y: 64, stagger: 0.15, duration: 0.9, ease: 'power3.out',
    });

    // Form reveal
    gsap.from('.c1-form', {
      scrollTrigger: { trigger: '.c1-form', start: 'top 85%' },
      opacity: 0, y: 56, duration: 1, ease: 'power3.out',
    });
  }, { scope: rootRef });

  return (
    <div
      ref={rootRef}
      className="relative overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg,#040b17 0%,#061325 55%,#091c36 100%)' }}
    >
      {/* Tiled star field via repeating radial gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 18% 28%,rgba(255,255,255,.88),transparent),' +
            'radial-gradient(1.5px 1.5px at 58% 14%,rgba(255,255,255,.7),transparent),' +
            'radial-gradient(1px 1px at 82% 62%,rgba(255,255,255,.8),transparent),' +
            'radial-gradient(1px 1px at 38% 82%,rgba(186,230,253,.75),transparent),' +
            'radial-gradient(2px 2px at 8% 72%,rgba(186,230,253,.6),transparent),' +
            'radial-gradient(1px 1px at 92% 38%,rgba(255,255,255,.65),transparent),' +
            'radial-gradient(1px 1px at 52% 92%,rgba(255,255,255,.5),transparent),' +
            'radial-gradient(1.5px 1.5px at 28% 52%,rgba(255,255,255,.55),transparent)',
          backgroundSize: '210px 210px,260px 270px,310px 190px,165px 230px,285px 305px,195px 215px,255px 245px,175px 195px',
        }}
      />

      {/* Hero */}
      <section className="c1-hero relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%,rgba(0,150,210,.07),transparent)' }} />

        <div className="c1-globe-wrap pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="c1-globe">
            <LandingGlobe theme="cosmos" size={640} rotateSpeed={0.4} />
          </div>
        </div>

        <div className="c1-text relative z-10 max-w-3xl text-center" style={{ perspective: '800px' }}>
          <span className="c1-pill inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-5 py-2 text-xs font-bold uppercase tracking-[.22em] text-cyan-300 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400 shadow-[0_0_6px_2px_rgba(34,211,238,.55)]" />
            Opening Soon
          </span>
          <h1 className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-5xl font-black tracking-tight text-white md:text-7xl lg:text-8xl">
            {['Find', 'your', 'world.'].map((w) => <span key={w} className="c1-word inline-block">{w}</span>)}
          </h1>
          <p className="c1-sub mt-6 text-lg leading-8 text-white/60 md:text-xl">
            A calmer, smarter way for students to discover where — and what — to study abroad.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {['Students', 'Parents', 'Counsellors'].map((b) => (
              <span key={b} className="c1-badge rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/65 backdrop-blur-sm">
                {b}
              </span>
            ))}
          </div>
        </div>

        <div aria-hidden className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2 text-white/25">
          <span className="text-[.65rem] uppercase tracking-[.3em]">Scroll</span>
          <span className="h-8 w-px bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* Features */}
      <section className="c1-features relative px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[.22em] text-cyan-400">What's coming</p>
          <h2 className="mb-14 text-center text-3xl font-bold text-white md:text-4xl">Built for the journey ahead</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="c1-feature rounded-2xl border border-white/[.07] bg-white/[.04] p-6 backdrop-blur-sm">
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 text-base font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-7 text-white/50">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="relative px-6 pb-32 pt-8">
        <div
          className="c1-form mx-auto max-w-md rounded-[2rem] border border-cyan-400/20 p-8 backdrop-blur-xl"
          style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.05),rgba(0,180,216,.06))', boxShadow: '0 0 80px rgba(0,180,216,.09),inset 0 1px 0 rgba(255,255,255,.08)' }}
        >
          <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-400">Early Access</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Be first to explore</h2>
          <p className="mt-2 text-sm leading-6 text-white/50">Join the waitlist — we'll reach out when Glowbal opens.</p>
          <div style={{ '--glow-input-bg': 'rgba(255,255,255,0.06)', color: 'inherit' } as React.CSSProperties}>
            <WaitlistForm action={action} />
          </div>
        </div>
      </section>
    </div>
  );
}
