'use client';

/**
 * LandingSections
 * ───────────────
 * Long-form landing content that lives below the cosmic hero.
 *
 * Covers everything in the team's wireframe brief:
 *   1.  Brand statement   (Go Glow — Go Glowbal)
 *   2.  Stats marquee     (5,000+ unis, 120 countries, etc.)
 *   3.  How we help you   (3-step numbered cards)
 *   4.  Demo video        (poster + play affordance)
 *   5.  Our mission       (gradient panel with quote)
 *   6.  Experts           (advisor grid)
 *   7.  Team Behind       (founders grid)
 *   8.  What users say    (testimonial cards)
 *   9.  Contacts          (Facebook + phone + footer)
 *
 * All cards use the canonical pink → red → aqua → navy brand gradient
 * (defined in globals.css) so motion + colour stay coherent across the
 * page. Sections animate in on scroll via framer-motion `whileInView`.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────
   Reusable bits
───────────────────────────────────────────────────────────────────── */

function SectionTitle({
  eyebrow,
  title,
  body,
  align = 'center',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: 'center' | 'left';
}) {
  const alignClasses =
    align === 'center'
      ? 'text-center mx-auto items-center'
      : 'text-left items-start';
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`flex max-w-3xl flex-col gap-3 ${alignClasses}`}
    >
      {eyebrow ? (
        <span className="cosmic-eyebrow">{eyebrow}</span>
      ) : null}
      <h2 className="cosmic-h2">{title}</h2>
      {body ? <p className="cosmic-body">{body}</p> : null}
    </motion.div>
  );
}

/** Card wrapper that fades up on scroll. */
function RevealCard({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   1. Brand statement — "Go Glow — Go Glowbal"
───────────────────────────────────────────────────────────────────── */

function BrandStatement() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="cosmic-glass relative overflow-hidden rounded-[2rem] p-8 text-center sm:p-12 lg:p-16"
        >
          <span className="cosmic-eyebrow">The vibe</span>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
            Go Glow.{' '}
            <span className="glowbal-wordmark">Go GLOWBAL.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/72 md:text-lg">
            Find the best school. Land the highest scholarship. Actually get in.
            We&apos;re a team of students who walked the path — now we&apos;re
            building the calmer, smarter way for you to walk yours.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/universities" className="cosmic-cta-primary">
              Find your match
            </a>
            <a href="#waitlist" className="cosmic-cta-ghost">
              Join the waitlist
            </a>
          </div>

          {/* decorative glowing orb */}
          <span aria-hidden className="cosmic-orb cosmic-orb-pink" />
          <span aria-hidden className="cosmic-orb cosmic-orb-aqua" />
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   2. Stats — count up on view
───────────────────────────────────────────────────────────────────── */

type Stat = { value: number; suffix?: string; label: string };

const STATS: Stat[] = [
  { value: 5000, suffix: '+', label: 'Universities tracked' },
  { value: 120,  suffix: '+', label: 'Countries covered' },
  { value: 800,  suffix: '+', label: 'Achievers ready to mentor' },
  { value: 95,   suffix: '%', label: 'Of beta users felt less stressed' },
];

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) {
        // Use queueMicrotask to avoid synchronous setState in effect body
        queueMicrotask(() => setDisplay(to));
      }
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 1400;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to]);

  return (
    <span ref={ref}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function StatsBand() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
          className="cosmic-stats-grid"
        >
          {STATS.map((s, i) => (
            <RevealCard
              key={s.label}
              delay={i * 0.08}
              className="cosmic-stat-card"
            >
              <div className="cosmic-stat-value">
                <CountUp to={s.value} suffix={s.suffix} />
              </div>
              <div className="cosmic-stat-label">{s.label}</div>
            </RevealCard>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   3. How we help you
───────────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    n: '01',
    title: 'Answer a few simple questions',
    body: 'Tell us your strengths, preferences, and career direction. Our matcher does the heavy lifting.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Choose your dream paths',
    body: 'Get a curated shortlist of universities, scholarships, and programs that actually fit you.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l9-3 9 3-9 3-9-3z" />
        <path d="M3 12l9 3 9-3" />
        <path d="M3 18l9 3 9-3" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Apply with confidence',
    body: 'Connect with mentors who got in, sharpen your statements with our AI writer, and ship it.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="m9 15 2 2 4-4" />
      </svg>
    ),
  },
];

function HowItWorks() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <SectionTitle
          eyebrow="How we help you"
          title={<>Three steps from <span className="glowbal-wordmark">overwhelmed</span> to admitted.</>}
          body="No agents. No hidden costs. Just the clearest path from where you are to where you're going."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <RevealCard key={s.n} delay={i * 0.1} className="cosmic-step-card">
              <div className="cosmic-step-num">{s.n}</div>
              <div className="cosmic-step-icon">{s.icon}</div>
              <h3 className="mt-5 text-xl font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-7 text-white/65">{s.body}</p>
            </RevealCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   4. Demo video — poster with play affordance
───────────────────────────────────────────────────────────────────── */

function DemoVideo() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <SectionTitle
          eyebrow="Demo"
          title={<>See <span className="glowbal-wordmark">GLOWBAL</span> in motion.</>}
          body="A 90-second walkthrough of the matcher, the Achievers, and the AI statement writer."
        />

        <RevealCard className="cosmic-video-shell">
          <div className="cosmic-video-frame">
            <div className="cosmic-video-poster">
              <button type="button" className="cosmic-play-btn" aria-label="Play demo video">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <div className="cosmic-video-meta">
                <span className="cosmic-video-tag">Demo · 1:32</span>
                <span className="cosmic-video-title">Match → mentor → apply</span>
              </div>
            </div>
          </div>
        </RevealCard>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   5. Our mission
───────────────────────────────────────────────────────────────────── */

function Mission() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <RevealCard className="cosmic-mission-panel">
          <span className="cosmic-eyebrow">Our mission</span>
          <p className="cosmic-mission-quote">
            Help every ambitious student approach global education{' '}
            <em className="cosmic-quote-em">with ease</em> and{' '}
            <em className="cosmic-quote-em-2">without fear</em> — no matter
            where they&apos;re starting from.
          </p>
          <div className="cosmic-mission-sig">— The GLOWBAL team</div>
        </RevealCard>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   6. Experts + 7. Team Behind
───────────────────────────────────────────────────────────────────── */

type Person = {
  name: string;
  role: string;
  bio: string;
  initials: string;
  accent: 'pink' | 'aqua' | 'navy' | 'red';
};

const EXPERTS: Person[] = [
  { name: 'Dr. Anh Nguyen',     role: 'Admissions advisor · Ex-Cornell', bio: '15 yrs guiding international applicants into Ivy League programs.', initials: 'AN', accent: 'pink' },
  { name: 'Linh Tran',          role: 'Scholarship strategist',          bio: 'Won six-figure aid packages at Stanford, Oxford, and Sciences Po.',  initials: 'LT', accent: 'aqua' },
  { name: 'Marcus Lee',         role: 'STEM admissions · MIT alum',      bio: 'Helps engineering and CS hopefuls translate research into offers.',  initials: 'ML', accent: 'navy' },
  { name: 'Sara Patel',         role: 'Statement coach',                 bio: 'Turns rough drafts into stories that admissions officers remember.', initials: 'SP', accent: 'red' },
];

const TEAM: Person[] = [
  { name: 'Minh Pham',     role: 'Founder · ex-LSE',           bio: 'First-gen student. Built GLOWBAL so the next first-gen has it easier.', initials: 'MP', accent: 'pink' },
  { name: 'Kira Hoang',    role: 'Co-founder · Product',        bio: 'Designs the calm, opinionated UX that makes admissions feel doable.',  initials: 'KH', accent: 'aqua' },
  { name: 'Daniel Vu',     role: 'Co-founder · Engineering',    bio: 'Ships the matcher, the Achievers platform, and the AI writer.',         initials: 'DV', accent: 'navy' },
  { name: 'Yuki Sato',     role: 'Achievers community lead',     bio: 'Onboards the students who got in to share their playbooks.',           initials: 'YS', accent: 'red' },
];

function PersonCard({ person, index }: { person: Person; index: number }) {
  return (
    <RevealCard delay={index * 0.06} className={`cosmic-person-card cosmic-accent-${person.accent}`}>
      <div className="cosmic-person-avatar">
        <span className="cosmic-person-initials">{person.initials}</span>
      </div>
      <h4 className="cosmic-person-name">{person.name}</h4>
      <p className="cosmic-person-role">{person.role}</p>
      <p className="cosmic-person-bio">{person.bio}</p>
    </RevealCard>
  );
}

function ExpertsSection() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <SectionTitle
          eyebrow="Experts"
          title={<>Mentors who&apos;ve been on <span className="glowbal-wordmark">both sides</span> of admissions.</>}
          body="Our advisors review applications, coach interviews, and pressure-test scholarship strategies."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EXPERTS.map((p, i) => (
            <PersonCard key={p.name} person={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamBehindSection() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <SectionTitle
          eyebrow="Team behind GLOWBAL"
          title={<>Built by students who <span className="glowbal-wordmark">walked the path</span>.</>}
          body="A small team of first-gen and international graduates building what we wish we had."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((p, i) => (
            <PersonCard key={p.name} person={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   8. Testimonials
───────────────────────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote: 'GLOWBAL made the whole process feel doable. I went from anxious browsing to a real shortlist in a single afternoon.',
    name: 'An Vo',
    detail: 'Now studying CS at TU Delft',
    initials: 'AV',
    accent: 'pink' as const,
  },
  {
    quote: 'The AI statement writer is unreal. It pulled out the parts of my story that mattered without making me sound like a chatbot.',
    name: 'Priya R.',
    detail: 'Offer holder · Imperial College London',
    initials: 'PR',
    accent: 'aqua' as const,
  },
  {
    quote: 'Talking to an Achiever who actually got into my dream school was the moment everything clicked. So fun, hêhhee.',
    name: 'Daniel K.',
    detail: 'First-year · NYU Shanghai',
    initials: 'DK',
    accent: 'red' as const,
  },
];

function Testimonials() {
  return (
    <section className="cosmic-section">
      <div className="cosmic-container">
        <SectionTitle
          eyebrow="What users say"
          title={<>Loved by the students <span className="glowbal-wordmark">getting in</span>.</>}
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <RevealCard key={t.name} delay={i * 0.08} className={`cosmic-testimonial cosmic-accent-${t.accent}`}>
              <svg className="cosmic-quote-mark" viewBox="0 0 24 24" aria-hidden>
                <path d="M7.17 6A5.17 5.17 0 0 0 2 11.17V18h6v-6H5a3.17 3.17 0 0 1 3.17-3.17V6zm10 0a5.17 5.17 0 0 0-5.17 5.17V18h6v-6h-3a3.17 3.17 0 0 1 3.17-3.17V6z" fill="currentColor" />
              </svg>
              <p className="cosmic-testimonial-quote">{t.quote}</p>
              <div className="cosmic-testimonial-attrib">
                <div className="cosmic-testimonial-avatar">{t.initials}</div>
                <div>
                  <div className="cosmic-testimonial-name">{t.name}</div>
                  <div className="cosmic-testimonial-detail">{t.detail}</div>
                </div>
              </div>
            </RevealCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   9. Contacts / footer
───────────────────────────────────────────────────────────────────── */

function ContactsFooter() {
  return (
    <footer className="cosmic-section pb-16 pt-2">
      <div className="cosmic-container">
        <RevealCard className="cosmic-footer-shell">
          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <span className="cosmic-eyebrow">Contacts</span>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                Want to chat? <span className="glowbal-wordmark">We&apos;re listening.</span>
              </h3>
              <p className="mt-3 max-w-md text-sm leading-7 text-white/65">
                Drop us a message — partnerships, press, student stories, or just to say hi.
              </p>
            </div>

            <div>
              <p className="cosmic-footer-label">Reach us</p>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li>
                  <a href="https://www.facebook.com/glowbal.education" target="_blank" rel="noreferrer" className="cosmic-footer-link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/>
                    </svg>
                    facebook.com/glowbal.education
                  </a>
                </li>
                <li>
                  <a href="tel:+842836222999" className="cosmic-footer-link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    +84 28 3622 2999
                  </a>
                </li>
                <li>
                  <a href="mailto:hello@glowbal.com" className="cosmic-footer-link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    hello@glowbal.com
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="cosmic-footer-label">Explore</p>
              <ul className="mt-3 space-y-2 text-sm text-white/80">
                <li><a href="/universities" className="cosmic-footer-link-plain">Search universities</a></li>
                <li><Link href="/mentors" className="cosmic-footer-link-plain">Mentorship hub</Link></li>
                <li><a href="/news" className="cosmic-footer-link-plain">GLOWBAL News</a></li>
                <li><a href="#waitlist" className="cosmic-footer-link-plain">Join the waitlist</a></li>
              </ul>
            </div>
          </div>

          <div className="cosmic-footer-rule" aria-hidden />

          <div className="flex flex-col items-start justify-between gap-3 text-xs text-white/50 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} GLOWBAL. Student-first global guidance.</p>
            <p>Made with ☀️ + ✦ in HCMC</p>
          </div>
        </RevealCard>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Public composition
───────────────────────────────────────────────────────────────────── */

export function LandingSections() {
  return (
    <>
      <BrandStatement />
      <StatsBand />
      <HowItWorks />
      <DemoVideo />
      <Mission />
      <ExpertsSection />
      <TeamBehindSection />
      <Testimonials />
    </>
  );
}

export { ContactsFooter };
