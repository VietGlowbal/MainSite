'use client';

import { useCallback, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { LandingGlobe } from '@/components/landing-globe';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';

gsap.registerPlugin(useGSAP);

const features = ['Explore universities worldwide', 'Shortlist the ones that fit', 'Move forward with less chaos'];

export function DesignCosmos({ action }: { action: WaitlistAction }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillClicks = useRef(0);

  const handlePillClick = useCallback(() => {
    pillClicks.current += 1;
    if (pillClicks.current >= 5) {
      window.dispatchEvent(new CustomEvent('glowbal:reveal-nav'));
    }
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
    <div ref={rootRef} className="relative overflow-x-hidden bg-[#06101f] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 18% 18%, rgba(34,211,238,0.14), transparent 28%), radial-gradient(circle at 78% 20%, rgba(244,114,182,0.12), transparent 22%), linear-gradient(180deg, #06101f 0%, #08172a 52%, #0b1d33 100%)',
        }}
      />

      <section className="relative overflow-hidden px-6 pb-20 pt-24 md:pt-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,1fr)] lg:items-center">
          <div className="relative z-10 max-w-3xl">
            <button
              type="button"
              onClick={handlePillClick}
              className="landing-pill inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200 backdrop-blur"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Early access
            </button>

            <h1 className="landing-title mt-6 text-5xl font-semibold leading-none tracking-[-0.05em] md:text-6xl lg:text-[5.5rem]">
              Find your best-fit
              <span className="glowbal-wordmark block">future abroad</span>
            </h1>

            <p className="landing-subtitle mt-5 max-w-2xl text-base leading-8 text-white/70 md:text-xl">
              Explore universities around the world, narrow your options calmly, and move from discovery to application with a lot less noise.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/universities"
                className="landing-cta inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff4d8c,#ff8fb8)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
              >
                Explore universities
              </a>
              <a
                href="#waitlist"
                className="landing-cta inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-7 py-3.5 text-sm font-semibold text-white/88 backdrop-blur transition hover:bg-white/10"
              >
                Join the waitlist
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {features.map((feature) => (
                <div key={feature} className="landing-feature rounded-full border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-white/78 backdrop-blur-sm">
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="landing-globe relative flex items-center justify-center lg:justify-end">
            <div className="landing-stars pointer-events-none absolute inset-0" aria-hidden />
            <div className="relative translate-x-[10%] rounded-full border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_140px_rgba(34,211,238,0.14)] backdrop-blur-md md:translate-x-[14%] xl:translate-x-[18%]">
              <LandingGlobe theme="cosmos" size={700} rotateSpeed={0.26} />
            </div>
          </div>
        </div>
      </section>

      <section id="waitlist" className="relative px-6 pb-16">
        <div className="landing-waitlist mx-auto grid max-w-5xl gap-8 rounded-[2rem] border border-white/10 bg-white/[0.05] p-8 backdrop-blur-xl md:grid-cols-[1fr_360px] md:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/85">Stay in the loop</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Be first to try the calmer version of Glowbal.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/64 md:text-base">
              We&apos;re building a more playful, more focused way to explore global study options without the clutter that usually comes with it.
            </p>
          </div>
          <div style={{ '--glow-input-bg': 'rgba(255,255,255,0.06)', color: 'inherit' } as React.CSSProperties}>
            <WaitlistForm action={action} />
          </div>
        </div>
      </section>
    </div>
  );
}
