'use client';

import { useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LandingGlobe } from '@/components/landing-globe';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const featureSteps = [
  {
    eyebrow: 'Explore',
    title: 'Search the world like a shortlist, not a spreadsheet',
    body: 'Move through countries, courses and universities in one calm flow, then narrow toward the places that genuinely fit you.',
  },
  {
    eyebrow: 'Match',
    title: 'Turn your profile into smarter recommendations',
    body: 'Glowbal uses your academic story, goals and application strength to surface more relevant routes with less guesswork.',
  },
  {
    eyebrow: 'Apply',
    title: 'See the next step before the process gets messy',
    body: 'From comparing options to preparing applications, the experience is designed to keep momentum and reduce overwhelm.',
  },
  {
    eyebrow: 'Track',
    title: 'Keep every deadline, decision and opportunity in view',
    body: 'Build a confident plan, revisit your shortlist, and stay on top of what matters across the whole journey.',
  },
];

const proofPoints = [
  { value: '500+', label: 'Universities indexed' },
  { value: '40+', label: 'Countries covered' },
  { value: '1', label: 'Connected place to explore, match and apply' },
];

const valueCards = [
  {
    title: 'A more cinematic way to begin',
    body: 'The homepage leads with a world view, not a generic dashboard. It signals ambition immediately while staying clear and buildable.',
  },
  {
    title: 'Guidance that feels premium, not noisy',
    body: 'Sharper hierarchy, calmer pacing and intentional surfaces help students focus on decisions instead of fighting clutter.',
  },
  {
    title: 'A signature interaction that can grow with the product',
    body: 'The globe becomes more than decoration: it sets up the explorer, recommendations and shortlist experience as one connected story.',
  },
];

const audienceSignals = ['Students planning abroad', 'Shortlist with more confidence', 'Global discovery, clearer next steps'];

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
    const tl = gsap.timeline({ delay: 0.12 });
    tl.from('.c1-globe-shell', { opacity: 0, scale: 0.82, duration: 1.4, ease: 'expo.out' })
      .from('.c1-orbit', { opacity: 0, scale: 0.92, duration: 1.1, ease: 'power3.out' }, '-=1.05')
      .from('.c1-pill', { opacity: 0, y: -18, duration: 0.45, ease: 'back.out(2.5)' }, '-=0.95')
      .from('.c1-word', { opacity: 0, y: 54, rotateX: -18, stagger: 0.07, duration: 0.78, ease: 'power4.out' }, '-=0.72')
      .from('.c1-sub', { opacity: 0, y: 24, duration: 0.65, ease: 'power3.out' }, '-=0.42')
      .from('.c1-hero-cta', { opacity: 0, y: 24, stagger: 0.08, duration: 0.55, ease: 'power3.out' }, '-=0.32')
      .from('.c1-hero-chip', { opacity: 0, y: 18, stagger: 0.06, duration: 0.45, ease: 'power3.out' }, '-=0.3');

    gsap.to('.c1-globe-wrap', {
      scrollTrigger: { trigger: '.c1-hero', start: 'top top', end: 'bottom top', scrub: 1.6 },
      y: -82,
      scale: 0.78,
      opacity: 0.34,
    });

    gsap.to('.c1-hero-copy', {
      scrollTrigger: { trigger: '.c1-hero', start: 'top top', end: '65% top', scrub: 1.1 },
      y: -34,
      opacity: 0.1,
    });

    gsap.from('.c1-proof-card', {
      scrollTrigger: { trigger: '.c1-proof', start: 'top 82%' },
      opacity: 0,
      y: 30,
      stagger: 0.1,
      duration: 0.75,
      ease: 'power3.out',
    });

    gsap.from('.c1-story-card', {
      scrollTrigger: { trigger: '.c1-story', start: 'top 74%' },
      opacity: 0,
      y: 56,
      stagger: 0.12,
      duration: 0.85,
      ease: 'power3.out',
    });

    gsap.from('.c1-value-card', {
      scrollTrigger: { trigger: '.c1-values', start: 'top 78%' },
      opacity: 0,
      y: 44,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out',
    });

    gsap.from('.c1-form', {
      scrollTrigger: { trigger: '.c1-form', start: 'top 84%' },
      opacity: 0,
      y: 52,
      duration: 0.9,
      ease: 'power3.out',
    });
  }, { scope: rootRef });

  return (
    <div
      ref={rootRef}
      className="relative overflow-x-hidden bg-[#040816] text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 18%, rgba(56,189,248,0.12), transparent 28%), radial-gradient(circle at 78% 14%, rgba(244,114,182,0.12), transparent 24%), radial-gradient(circle at 50% 42%, rgba(14,165,233,0.08), transparent 38%), linear-gradient(180deg, #040816 0%, #06101f 48%, #09172b 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 18% 28%,rgba(255,255,255,.85),transparent), radial-gradient(1.5px 1.5px at 58% 14%,rgba(255,255,255,.7),transparent), radial-gradient(1px 1px at 82% 62%,rgba(255,255,255,.75),transparent), radial-gradient(1px 1px at 38% 82%,rgba(186,230,253,.75),transparent), radial-gradient(2px 2px at 8% 72%,rgba(186,230,253,.6),transparent), radial-gradient(1px 1px at 92% 38%,rgba(255,255,255,.58),transparent)',
          backgroundSize: '210px 210px,260px 270px,310px 190px,165px 230px,285px 305px,195px 215px',
        }}
      />

      <section className="c1-hero relative isolate flex min-h-screen items-center overflow-hidden px-6 pb-20 pt-28 md:pt-32">
        <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-300/8 to-transparent" />
        <div className="mx-auto grid w-full max-w-7xl gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="c1-hero-copy relative z-10 max-w-3xl">
            <button
              type="button"
              onClick={handlePillClick}
              className="c1-pill inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200 backdrop-blur-md"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(74,222,128,0.9)]" />
              Early access for students planning abroad
            </button>

            <div className="mt-7 space-y-5">
              <h1 className="flex flex-wrap gap-x-4 gap-y-2 text-5xl font-semibold leading-none tracking-[-0.04em] md:text-7xl lg:text-[5.7rem]">
                {['Find', 'your', 'best-fit', 'future.'].map((word) => (
                  <span
                    key={word}
                    className="c1-word inline-block"
                    style={
                      word === 'future.'
                        ? {
                            background: 'linear-gradient(90deg,#ffffff 0%,#8be9ff 45%,#ff8fb8 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }
                        : undefined
                    }
                  >
                    {word}
                  </span>
                ))}
              </h1>

              <p className="c1-sub max-w-2xl text-base leading-8 text-white/68 md:text-xl">
                Explore universities around the world, understand where you fit, and move from discovery to application with calmer, smarter guidance.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="/universities"
                className="c1-hero-cta inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff4d8c,#ff8fb8)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(255,77,140,0.32)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(255,77,140,0.4)]"
              >
                Explore universities
              </a>
              <a
                href="#waitlist"
                className="c1-hero-cta inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-7 py-3.5 text-sm font-semibold text-white/88 backdrop-blur-md transition duration-200 hover:border-cyan-300/30 hover:bg-white/10"
              >
                Join the waitlist
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/56">
              {audienceSignals.map((signal) => (
                <div
                  key={signal}
                  className="c1-hero-chip rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-sm"
                >
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="c1-globe-wrap relative flex items-center justify-center">
            <div className="c1-orbit absolute h-[24rem] w-[24rem] rounded-full border border-cyan-300/10 md:h-[31rem] md:w-[31rem]" />
            <div className="c1-orbit absolute h-[28rem] w-[28rem] rounded-full border border-white/8 md:h-[36rem] md:w-[36rem]" />
            <div className="c1-globe-shell relative flex h-[25rem] w-[25rem] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_0_140px_rgba(34,211,238,0.12)] backdrop-blur-md md:h-[34rem] md:w-[34rem]">
              <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.16),transparent_58%)]" />
              <div className="relative">
                <LandingGlobe theme="cosmos" size={560} rotateSpeed={0.32} />
              </div>
            </div>
            <div className="absolute bottom-8 left-0 rounded-3xl border border-white/10 bg-[#081223]/80 px-5 py-4 backdrop-blur-xl shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-200/80">Signature experience</p>
              <p className="mt-2 max-w-[13rem] text-sm leading-6 text-white/70">A world-first view for exploring countries, comparing options and planning next moves.</p>
            </div>
            <div className="absolute right-0 top-10 rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-xl shadow-[0_20px_60px_rgba(2,6,23,0.4)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-pink-200/80">Built for momentum</p>
              <p className="mt-2 max-w-[12rem] text-sm leading-6 text-white/70">Less tab-hopping. Clearer decisions. A more guided route from search to shortlist.</p>
            </div>
          </div>
        </div>

        <div aria-hidden className="absolute bottom-10 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/25 md:flex">
          <span className="text-[0.65rem] uppercase tracking-[0.3em]">Scroll</span>
          <span className="h-8 w-px bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      <section className="c1-proof relative px-6 pb-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="c1-proof-card rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/85">Why it feels different</p>
            <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl">
              One focused homepage story: explore, match, apply, track.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/64 md:text-base">
              Glowbal should feel like a premium guide for global study decisions, with a single strong hero, clearer pacing, and product-led calls to action.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-1">
            {proofPoints.map((stat) => (
              <div key={stat.label} className="c1-proof-card rounded-[1.75rem] border border-white/10 bg-[#0a1425]/85 p-6 backdrop-blur-xl">
                <p className="text-3xl font-semibold tracking-[-0.04em] text-white md:text-4xl">{stat.value}</p>
                <p className="mt-2 text-sm leading-6 text-white/58">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="c1-story relative px-6 py-24 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/85">How Glowbal guides the journey</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
              A clearer sequence from global discovery to real application progress.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {featureSteps.map((step, index) => (
              <article
                key={step.title}
                className="c1-story-card rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl md:p-8"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/90">
                    {step.eyebrow}
                  </span>
                  <span className="text-sm font-medium text-white/30">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-white/64 md:text-base">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="c1-values relative px-6 pb-20">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-cyan-300/14 bg-[linear-gradient(180deg,rgba(8,18,35,0.95),rgba(8,18,35,0.78))] p-8 shadow-[0_20px_70px_rgba(8,145,178,0.12)] backdrop-blur-xl md:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/85">Brand direction translated</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
              Premium, cinematic, and still grounded in a usable product story.
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/64 md:text-base">
              The visual system leans deeper, cleaner and more editorial: midnight surfaces, restrained glow, stronger typography, and one memorable focal interaction.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-1">
            {valueCards.map((card) => (
              <article key={card.title} className="c1-value-card rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/62">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist" className="relative px-6 pb-20 pt-4">
        <div className="c1-form mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,18,35,0.96),rgba(7,24,42,0.88))] shadow-[0_30px_90px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
          <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-8 md:p-10 lg:border-b-0 lg:border-r">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-200/85">Early access</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">Be first to explore with Glowbal.</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/64 md:text-base">
                Join the waitlist to hear when the product opens up. We&apos;ll share early access, product updates and the first premium student tools as they land.
              </p>
              <div className="mt-8 space-y-4 text-sm text-white/58">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                  Save countries, courses and universities into one clearer decision flow.
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                  Understand your fit sooner with guidance designed around real application choices.
                </div>
              </div>
            </div>

            <div className="p-8 md:p-10">
              <div style={{ '--glow-input-bg': 'rgba(255,255,255,0.05)', color: 'inherit' } as React.CSSProperties}>
                <WaitlistForm action={action} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
