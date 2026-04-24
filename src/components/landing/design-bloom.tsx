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
  { emoji: '🌸', title: 'Clearer direction', body: 'Students get a gentler way to explore countries, study options, and next steps without overwhelm.' },
  { emoji: '💬', title: 'Human-feeling advice', body: 'We explain why an option fits — not just a ranked list you have to decode yourself.' },
  { emoji: '🌱', title: 'Supportive every step', body: 'From first curiosity to confident shortlist — warm, modern, and encouraging throughout.' },
];

export function DesignBloom({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Entry
    const tl = gsap.timeline({ delay: 0.15 });
    tl.from('.c2-globe',    { opacity: 0, x: 100, rotateY: 25, duration: 1.4, ease: 'power4.out' })
      .from('.c2-pill',     { opacity: 0, y: -16, duration: 0.4, ease: 'back.out(2)' }, '-=0.8')
      .from('.c2-headline', { opacity: 0, x: -60, duration: 0.9, ease: 'power3.out' }, '-=0.5')
      .from('.c2-sub',      { opacity: 0, x: -40, duration: 0.7, ease: 'power2.out' }, '-=0.4')
      .from('.c2-cta',      { opacity: 0, scale: 0.85, duration: 0.5, ease: 'back.out(1.8)' }, '-=0.2');

    // Gentle globe bob (continuous)
    gsap.to('.c2-globe', {
      y: -18, duration: 3, ease: 'sine.inOut', repeat: -1, yoyo: true,
    });

    // Feature cards flip in (perspective)
    gsap.from('.c2-card', {
      scrollTrigger: { trigger: '.c2-cards', start: 'top 80%' },
      opacity: 0, rotateX: -30, y: 50, stagger: 0.18, duration: 0.9,
      ease: 'power3.out', transformOrigin: 'top center', transformPerspective: 800,
    });

    // Waitlist reveal
    gsap.from('.c2-form', {
      scrollTrigger: { trigger: '.c2-form', start: 'top 85%' },
      opacity: 0, y: 40, scale: 0.97, duration: 0.9, ease: 'power3.out',
    });
  }, { scope: rootRef });

  return (
    <div ref={rootRef} className="relative overflow-x-hidden" style={{ background: '#fffcf9' }}>
      {/* Gradient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[700px] w-[700px] rounded-full opacity-30" style={{ background: 'radial-gradient(circle,rgba(255,150,180,0.5),transparent 65%)' }} />
        <div className="absolute -left-32 top-1/3 h-[500px] w-[500px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle,rgba(0,180,216,0.45),transparent 65%)' }} />
        <div className="absolute bottom-20 right-20 h-[400px] w-[400px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle,rgba(255,77,140,0.4),transparent 65%)' }} />
      </div>

      {/* Hero */}
      <section className="relative grid min-h-screen gap-8 px-8 py-20 md:grid-cols-2 md:items-center md:px-16 lg:px-20">
        {/* Text */}
        <div className="relative z-10 max-w-xl">
          <span className="c2-pill inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-5 py-2 text-xs font-bold uppercase tracking-[.2em] text-pink-600">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
            Opening Soon
          </span>
          <h1 className="c2-headline mt-6 text-5xl font-black leading-[1.08] tracking-tight text-slate-900 md:text-6xl">
            A calmer,<br />smarter way<br />to study abroad.
          </h1>
          <p className="c2-sub mt-5 text-lg leading-8 text-slate-500">
            Glowbal helps students find the right place — country, course, and confidence — without the noise.
          </p>
          <div className="c2-cta mt-8 flex flex-wrap gap-3">
            <span className="rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">Students &amp; Parents</span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">Counsellors</span>
          </div>
        </div>

        {/* Globe */}
        <div className="c2-globe relative z-10 flex justify-center md:justify-end">
          <LandingGlobe theme="bloom" size={480} rotateSpeed={0.5} />
        </div>
      </section>

      {/* Features */}
      <section className="c2-cards relative px-8 py-20 md:px-16 lg:px-20">
        <p className="mb-3 text-xs font-bold uppercase tracking-[.22em] text-pink-400">What we're building</p>
        <h2 className="mb-12 text-3xl font-bold text-slate-900">Designed around students, not spreadsheets.</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="c2-card rounded-[1.75rem] border border-black/[.04] bg-white/80 p-7 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur-sm"
            >
              <div className="mb-4 text-3xl">{f.emoji}</div>
              <h3 className="mb-2 text-base font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-7 text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="relative px-8 pb-28 pt-12 md:px-16 lg:px-20">
        <div
          className="c2-form mx-auto max-w-lg rounded-[2rem] border border-pink-100 p-8 shadow-[0_20px_60px_rgba(255,77,140,0.1)]"
          style={{ background: 'linear-gradient(180deg,#fff,rgba(255,240,248,0.6))' }}
        >
          <p className="text-xs font-bold uppercase tracking-[.2em] text-pink-500">Waitlist</p>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">Get early access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Drop your email and we'll let you know when Glowbal is ready.</p>
          <WaitlistForm action={action} />
        </div>
      </section>
    </div>
  );
}
