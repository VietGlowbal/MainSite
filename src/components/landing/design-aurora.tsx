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
  { title: 'Explore the world', body: 'Discover countries and universities that actually fit your goals and preferences.' },
  { title: 'Understand why', body: 'Every recommendation comes with clear reasoning you can act on — not just a rank number.' },
  { title: 'Move with confidence', body: 'Guided from curiosity to shortlist without the stress of traditional university research.' },
];

export function DesignAurora({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Entry: globe rises slowly, text layers float up
    const tl = gsap.timeline({ delay: 0.2 });
    tl.from('.c4-globe', { opacity: 0, scale: 0.55, y: 60, duration: 2, ease: 'expo.out' })
      .from('.c4-pill',  { opacity: 0, y: -16, duration: 0.6, ease: 'back.out(2)' }, '-=1.2')
      .from('.c4-h1',    { opacity: 0, y: 50, duration: 1, ease: 'power3.out' }, '-=0.8')
      .from('.c4-sub',   { opacity: 0, y: 30, duration: 0.8, ease: 'power2.out' }, '-=0.5')
      .from('.c4-chips', { opacity: 0, y: 20, duration: 0.6, ease: 'power2.out' }, '-=0.4');

    // Aurora gradient shifts on scroll (animate CSS custom property)
    gsap.to('.c4-aurora-1', {
      scrollTrigger: { trigger: '.c4-root', start: 'top top', end: 'bottom bottom', scrub: 3 },
      x: 200, y: -100, scale: 1.4,
    });
    gsap.to('.c4-aurora-2', {
      scrollTrigger: { trigger: '.c4-root', start: 'top top', end: 'bottom bottom', scrub: 2.5 },
      x: -150, y: 120, scale: 1.3,
    });

    // Features: fade through aurora mist
    gsap.from('.c4-feature', {
      scrollTrigger: { trigger: '.c4-features', start: 'top 80%' },
      opacity: 0, y: 55, filter: 'blur(8px)', stagger: 0.2, duration: 1.1, ease: 'power3.out',
    });

    // Form drift up
    gsap.from('.c4-form', {
      scrollTrigger: { trigger: '.c4-form', start: 'top 85%' },
      opacity: 0, y: 50, filter: 'blur(6px)', duration: 1.2, ease: 'power3.out',
    });
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className="c4-root relative overflow-x-hidden" style={{ background: '#0b0820', color: '#fff' }}>
      {/* Aurora layers (animated via GSAP) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="c4-aurora-1 absolute -left-40 top-0 h-[700px] w-[900px] rounded-[50%]" style={{ background: 'radial-gradient(ellipse,rgba(0,240,160,0.16),transparent 65%)', filter: 'blur(60px)', transform: 'rotate(-20deg)' }} />
        <div className="c4-aurora-2 absolute -right-40 top-1/4 h-[600px] w-[700px] rounded-[50%]" style={{ background: 'radial-gradient(ellipse,rgba(100,100,255,0.18),transparent 65%)', filter: 'blur(50px)', transform: 'rotate(15deg)' }} />
        <div className="absolute bottom-0 left-1/4 h-[500px] w-[600px] rounded-[50%]" style={{ background: 'radial-gradient(ellipse,rgba(0,200,200,0.12),transparent 65%)', filter: 'blur(55px)' }} />
      </div>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24">
        {/* Globe */}
        <div className="c4-globe pointer-events-none absolute inset-0 flex items-center justify-center">
          <LandingGlobe theme="aurora" size={580} rotateSpeed={0.35} />
        </div>

        {/* Text overlay */}
        <div className="relative z-10 max-w-3xl text-center">
          <span className="c4-pill inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-[.22em] backdrop-blur-sm" style={{ border: '1px solid rgba(0,240,160,0.25)', background: 'rgba(0,240,160,0.08)', color: 'rgba(0,240,160,0.9)' }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'rgba(0,240,160,0.9)', boxShadow: '0 0 8px 2px rgba(0,240,160,0.5)' }} />
            Opening Soon
          </span>
          <h1 className="c4-h1 mt-8 text-5xl font-black tracking-tight md:text-7xl" style={{ textShadow: '0 0 60px rgba(0,240,160,0.12)' }}>
            Your world.<br />
            <span style={{ background: 'linear-gradient(135deg,#00f0a0,#00c8ff,#a060ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Clearly lit.
            </span>
          </h1>
          <p className="c4-sub mt-6 text-lg leading-8 text-white/55 md:text-xl">
            A calmer, smarter way for students to discover where — and what — to study abroad.
          </p>
          <div className="c4-chips mt-6 flex flex-wrap justify-center gap-3">
            {['Students', 'Parents', 'Counsellors'].map((b) => (
              <span key={b} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 backdrop-blur-sm">
                {b}
              </span>
            ))}
          </div>
        </div>

        <div aria-hidden className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
          <span className="text-[.65rem] uppercase tracking-[.3em]">Scroll</span>
          <span className="h-8 w-px bg-gradient-to-b from-white/25 to-transparent" />
        </div>
      </section>

      {/* Features */}
      <section className="c4-features relative px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[.22em]" style={{ color: 'rgba(0,240,160,0.8)' }}>What's coming</p>
          <h2 className="mb-14 text-center text-3xl font-bold text-white md:text-4xl">Guided by light, not noise.</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="c4-feature rounded-2xl p-6 backdrop-blur-md"
                style={{
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: i === 1
                    ? 'linear-gradient(135deg,rgba(0,240,160,0.07),rgba(0,200,255,0.05))'
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <div className="mb-4 h-1 w-10 rounded-full" style={{ background: 'linear-gradient(90deg,#00f0a0,#00c8ff)' }} />
                <h3 className="mb-2 text-base font-bold text-white">{f.title}</h3>
                <p className="text-sm leading-7 text-white/48">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section className="relative px-6 pb-28 pt-8">
        <div
          className="c4-form mx-auto max-w-md rounded-[2rem] p-8 backdrop-blur-xl"
          style={{
            border: '1px solid rgba(0,240,160,0.18)',
            background: 'linear-gradient(135deg,rgba(0,240,160,0.05),rgba(0,200,255,0.04),rgba(160,96,255,0.04))',
            boxShadow: '0 0 80px rgba(0,240,160,0.07)',
          }}
        >
          <p className="text-xs font-bold uppercase tracking-[.22em]" style={{ color: 'rgba(0,240,160,0.85)' }}>Early Access</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Step into the light</h2>
          <p className="mt-2 text-sm leading-6 text-white/48">Join the waitlist and hear when Glowbal is ready.</p>
          <WaitlistForm action={action} />
        </div>
      </section>
    </div>
  );
}
