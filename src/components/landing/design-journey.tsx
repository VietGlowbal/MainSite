'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingGlobe, type LandingGlobeHandle } from '@/components/landing-globe';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const stops = [
  { section: 'c5-s1', lat: 20,  lng: 10,  alt: 1.8, heading: 'Find your world.', sub: 'A calmer, smarter way for students to discover where — and what — to study abroad.', tag: 'Opening Soon', region: '' },
  { section: 'c5-s2', lat: 52,  lng: 15,  alt: 1.4, heading: 'Europe & beyond.', sub: 'Explore universities and cities across the continent — from UK traditions to Berlin\'s innovation scene.', tag: 'Europe', region: '🏰' },
  { section: 'c5-s3', lat: 28,  lng: 98,  alt: 1.4, heading: 'Asia\'s rising.', sub: 'Discover world-class programmes in Singapore, Japan, South Korea, and across South Asia.', tag: 'Asia', region: '🏯' },
  { section: 'c5-s4', lat: -23, lng: 135, alt: 1.5, heading: 'Down under & Pacific.', sub: 'Australia and New Zealand offer some of the world\'s most liveable student cities — find your fit.', tag: 'Oceania', region: '🌊' },
];

export function DesignJourney({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<LandingGlobeHandle>(null);

  useGSAP(() => {
    // Entry animation for first section
    gsap.from('.c5-s1 .c5-content', {
      opacity: 0, x: -60, duration: 1.2, ease: 'power3.out', delay: 0.2,
    });

    // Each subsequent section: fly globe + animate text
    stops.slice(1).forEach((stop) => {
      ScrollTrigger.create({
        trigger: `.${stop.section}`,
        start: 'top 55%',
        onEnter: () => {
          globeRef.current?.flyTo(stop.lat, stop.lng, stop.alt, 1200);
          gsap.from(`.${stop.section} .c5-content`, {
            opacity: 0, x: -50, duration: 0.9, ease: 'power3.out',
          });
          gsap.from(`.${stop.section} .c5-tag`, {
            opacity: 0, scale: 0.8, duration: 0.5, ease: 'back.out(2)', delay: 0.2,
          });
        },
        onLeaveBack: () => {
          const prevStop = stops[stops.indexOf(stop) - 1];
          if (prevStop) globeRef.current?.flyTo(prevStop.lat, prevStop.lng, prevStop.alt, 1000);
        },
        once: false,
      });
    });

    // Form reveal
    gsap.from('.c5-form', {
      scrollTrigger: { trigger: '.c5-form', start: 'top 85%' },
      opacity: 0, y: 48, duration: 1, ease: 'power3.out',
    });
  }, { scope: rootRef });

  return (
    <div
      ref={rootRef}
      className="relative overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg,#0d1117 0%,#111827 100%)' }}
    >
      {/* Sticky two-column layout: content left, globe right */}
      <div className="relative">
        {/* Globe: sticky on right */}
        <div className="pointer-events-none sticky top-0 float-right flex h-screen w-1/2 items-center justify-center" style={{ zIndex: 10 }}>
          <div className="hidden md:flex items-center justify-center w-full h-full">
            <LandingGlobe ref={globeRef} theme="journey" size={480} rotateSpeed={0.3} />
          </div>
        </div>

        {/* Scrollable sections on left */}
        <div className="md:mr-[50%]">
          {stops.map((stop) => (
            <section
              key={stop.section}
              className={`${stop.section} flex min-h-screen flex-col justify-center px-8 py-20 md:px-16`}
            >
              <div className="c5-content max-w-xl">
                {stop.tag && (
                  <span className="c5-tag mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-[.2em] text-white/60">
                    {stop.region && <span>{stop.region}</span>}
                    {stop.tag}
                  </span>
                )}
                <h2 className="text-4xl font-black leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
                  {stop.heading}
                </h2>
                <p className="mt-5 text-lg leading-8 text-white/55">{stop.sub}</p>
                {stop.section === 'c5-s1' && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    {['Students', 'Parents', 'Counsellors'].map((b) => (
                      <span key={b} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {stop.section === 'c5-s1' && (
                <div aria-hidden className="mt-16 flex flex-col gap-2 text-white/20">
                  <span className="text-[.65rem] uppercase tracking-[.3em]">Scroll to explore</span>
                  <span className="h-8 w-px bg-gradient-to-b from-white/25 to-transparent" />
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Clear float */}
        <div className="clear-both" />
      </div>

      {/* Globe for mobile (inline, not sticky) */}
      <div className="flex justify-center py-10 md:hidden">
        <LandingGlobe theme="journey" size={320} rotateSpeed={0.4} />
      </div>

      {/* Waitlist */}
      <section className="relative px-8 pb-28 pt-10 md:px-16">
        <div
          className="c5-form mx-auto max-w-lg rounded-[2rem] border border-white/[.07] p-8 backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        >
          <p className="text-xs font-bold uppercase tracking-[.22em] text-sky-400">Early Access</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Start your journey</h2>
          <p className="mt-2 text-sm leading-6 text-white/50">Join the waitlist — we'll reach out when Glowbal opens.</p>
          <WaitlistForm action={action} />
        </div>
      </section>
    </div>
  );
}
