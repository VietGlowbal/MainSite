import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { WaitlistForm } from '@/components/waitlist-form';
import type { WaitlistAction } from '@/lib/types';
import { getTeamMembers, splitTeam, type TeamMember } from '@/lib/team';
import { Reveal } from './reveal';
import { SiteHeader } from './site-header';
import { UniversitySearch } from './university-search';
import { HeroGlobe } from './hero-globe';

/**
 * Sections kept in code for future use but hidden from the current home flow.
 * Flip to `true` to re-enable the Problem, University-search, AI-strategy,
 * Testimonial and Plus sections (and the legacy hero mockup).
 */
const SHOW_LEGACY_SECTIONS: boolean = false;

/**
 * HomeLanding — the product-led GlowBal landing page (spec Phase 1).
 *
 * Replaces the old waitlist hero. Section order follows the brief:
 * Hero → Stats → Problem → How it works → University search → Scholarship
 * preview → AI strategy → Student supporters → Team → Testimonials → Plus →
 * FAQ → Final CTA → Footer.
 *
 * Everything here is static/server-rendered for speed; interactivity is
 * isolated to a few client islands (header, search, scroll reveal, lead form).
 * The Team section is hard-coded for now and becomes Supabase-backed in
 * Phase 2.
 */

/* ── Shared bits ─────────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-pink-600">
      {children}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'center',
}: {
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  align?: 'center' | 'left';
}) {
  const wrap =
    align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl text-left';
  return (
    <div className={wrap}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-4xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">{body}</p>
      ) : null}
    </div>
  );
}

function PrimaryCTA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
    >
      {children}
    </Link>
  );
}

function GhostCTA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      {children}
    </a>
  );
}

/* ── 1. Hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* soft global/youthful gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 15% 0%, rgba(255,77,140,0.10), transparent 45%), radial-gradient(ellipse at 90% 10%, rgba(0,180,216,0.10), transparent 40%), linear-gradient(180deg, #FBFBFF 0%, #ffffff 70%)',
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-16">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-100 bg-pink-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pink-600">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Study abroad, with a plan
          </span>

          <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-900 sm:text-5xl lg:text-[3.5rem]">
            Find the right university and scholarship for your future abroad
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg lg:mx-0">
            Explore 10,000+ universities, discover 2,000+ scholarships worth over
            over $150,000,000, and build your application strategy with AI and real
            student supporters around the world.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <PrimaryCTA href="/universities">Find my scholarships</PrimaryCTA>
            <GhostCTA href="#how-it-works">See how it works</GhostCTA>
          </div>

          <p className="mt-5 text-sm text-slate-500">
            Free to start · No agents · Start with one dream university
          </p>
        </div>

        {/* Hero visual — spinning globe (legacy product mockup kept for future use) */}
        <Reveal className="relative" y={32}>
          {SHOW_LEGACY_SECTIONS ? <HeroMockup /> : <HeroGlobe />}
        </Reveal>
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_30px_70px_rgba(30,40,80,0.12)]">
        {/* search bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          University of Birmingham
        </div>

        {/* scholarship card */}
        <div className="mt-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-pink-600">Scholarship</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Saved</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900">International Excellence Scholarship</p>
          <p className="text-xs text-slate-500">University of Birmingham · UK</p>
          <p className="mt-2 text-sm font-bold text-slate-900">Up to £10,000</p>
        </div>

        {/* AI strategy card */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff,#fdf2f8)] p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#00b4d8)] text-xs font-bold text-white">AI</span>
            <span className="text-sm font-semibold text-slate-900">Your strategy</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
            <li>Fit: <span className="font-semibold text-slate-900">Medium-high</span></li>
            <li>✓ Subject interest matches the award</li>
            <li>→ Strengthen your personal statement</li>
          </ul>
        </div>

        {/* supporter chip */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00b4d8,#1e2a78)] text-xs font-bold text-white">MA</span>
          <div className="text-xs">
            <p className="font-semibold text-slate-900">Minh Anh · Melbourne</p>
            <p className="text-slate-500">Can help with scholarship essays</p>
          </div>
        </div>
      </div>

      <div aria-hidden className="absolute -right-6 -top-6 -z-10 h-32 w-32 rounded-full bg-pink-200/40 blur-2xl" />
      <div aria-hidden className="absolute -bottom-8 -left-8 -z-10 h-32 w-32 rounded-full bg-cyan-200/40 blur-2xl" />
    </div>
  );
}

/* ── 2. Stats strip ──────────────────────────────────────────────────────── */

const STATS = [
  { value: '10,000+', label: 'Universities' },
  { value: '2,000+', label: 'Scholarships' },
  { value: '$500,000+', label: 'Scholarship value' },
  { value: '200+', label: 'Student supporters worldwide' },
];

function StatsStrip() {
  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-6">
      <Reveal className="rounded-[2rem] bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] p-6 shadow-[0_18px_40px_rgba(255,77,140,0.30)] sm:p-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{s.value}</div>
              <div className="mt-1 text-sm text-white/85">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-white/90">
          From choosing your dream university to preparing your application,
          GlowBal helps you move from confusion to a clear study-abroad plan.
        </p>
      </Reveal>
    </section>
  );
}

/* ── Product demo (reserved slot for the recorded walkthrough) ───────────── */

function DemoVideoSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Product demo"
        title="See GlowBal in action"
        body="A short walkthrough of how GlowBal takes you from a dream university to a clear scholarship plan."
      />
      <Reveal className="mt-12" y={28}>
        <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#FFF1F7,#EFFBFF)] shadow-[0_24px_60px_rgba(30,40,80,0.10)]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-pink-600 shadow-[0_10px_24px_rgba(255,77,140,0.25)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <p className="text-sm font-semibold text-slate-600">Product demo — coming soon</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── 3. Problem ──────────────────────────────────────────────────────────── */

const PROBLEMS = [
  { title: 'Too many universities', body: 'It is hard to know which universities are realistic, ambitious, affordable, or worth applying to.' },
  { title: 'Scholarships are hard to find', body: 'Scholarship information is scattered across different websites, deadlines, eligibility pages, and university portals.' },
  { title: 'You don’t know what to do next', body: 'Even after finding a scholarship, many students are unsure how to prepare documents or improve their chances.' },
  { title: 'Advice is hard to trust', body: 'GlowBal connects you with real people who have studied abroad, won scholarships, and supported others through the journey.' },
];

function ProblemSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <SectionHeading
        eyebrow="The problem"
        title="Studying abroad should not feel this confusing"
        body="Most students start excited and quickly get overwhelmed. GlowBal turns the noise into a clear, step-by-step plan."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PROBLEMS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.07}>
            <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
              <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ── 4. How GlowBal works ────────────────────────────────────────────────── */

const STEPS = [
  {
    n: '1',
    title: 'Choose a university',
    body: 'Search for a university you’re interested in, or browse by country, subject, budget, and scholarship availability.',
  },
  {
    n: '2',
    title: 'Create your free GlowBal profile',
    body: 'Add your basic details so GlowBal can show relevant scholarships and save your application plan.',
  },
  {
    n: '3',
    title: 'Pick scholarships',
    body: 'View scholarship opportunities linked to your chosen university and save the ones you want to apply for.',
  },
  {
    n: '4',
    title: 'Generate your AI strategy',
    body: 'Get a personalised strategy showing what to prepare, what to improve, and how to approach each scholarship.',
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[linear-gradient(180deg,#FAFAFF,#ffffff)]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How GlowBal works"
          title="Choose a university. Unlock scholarships. Build your plan."
          body="No agents, no endless tabs. Just the clearest path from a single dream school to a scholarship plan."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="relative h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <PrimaryCTA href="/universities">Start with a university</PrimaryCTA>
        </div>
      </div>
    </section>
  );
}

/* ── 5. Choose university / search module ────────────────────────────────── */

function UniversitySearchSection() {
  return (
    <section id="universities" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Start here"
          title="Where do you want to study?"
          body="Pick a university to see the scholarships and student supporters connected to it. You only create a profile once you’re ready to unlock the details."
        />
        <div className="mt-10">
          <UniversitySearch />
        </div>
      </div>
    </section>
  );
}

/* ── 6. Scholarship preview ──────────────────────────────────────────────── */

const SCHOLARSHIPS = [
  {
    name: 'International Excellence Scholarship',
    university: 'University of Birmingham',
    country: 'United Kingdom',
    value: 'Up to £10,000',
    level: 'Undergraduate / Postgraduate',
    summary: 'For high-achieving international students applying to selected courses.',
  },
  {
    name: 'Global Merit Award',
    university: 'University of Melbourne',
    country: 'Australia',
    value: 'AUD 20,000',
    level: 'Undergraduate',
    summary: 'Recognises academic excellence among new international applicants.',
  },
  {
    name: 'ASEAN Undergraduate Scholarship',
    university: 'National University of Singapore',
    country: 'Singapore',
    value: 'Full tuition + stipend',
    level: 'Undergraduate',
    summary: 'Covers tuition and living costs for outstanding students from ASEAN.',
  },
];

function ScholarshipPreviewSection() {
  return (
    <section id="scholarships" className="scroll-mt-20 bg-[linear-gradient(180deg,#ffffff,#FAFAFF)]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Scholarship preview"
          title="See scholarships connected to your chosen university"
          body="Browse a preview for free. Create your profile to unlock full eligibility, required documents, and save opportunities to your plan."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {SCHOLARSHIPS.map((s, i) => (
            <Reveal key={s.name} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-pink-600">{s.country}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Locked
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{s.name}</h3>
                <p className="text-sm text-slate-500">{s.university}</p>
                <p className="mt-3 text-lg font-bold text-slate-900">{s.value}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{s.level}</p>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{s.summary}</p>
                <Link
                  href="/auth?mode=signup&redirect=/scholarships"
                  className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-600"
                >
                  Unlock details
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
          Create your free GlowBal profile to unlock full scholarship details and
          save opportunities to your plan.
        </p>
      </div>
    </section>
  );
}

/* ── 7. AI strategy ──────────────────────────────────────────────────────── */

function AIStrategySection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            align="left"
            eyebrow="AI strategy"
            title="Get an AI strategy for your scholarship application"
            body="Once you save a scholarship, GlowBal generates a personalised application strategy: your fit, strengths, risks, required documents, and a 30-day action plan."
          />
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {['Fit summary and risk level', 'Strengths and what to improve', 'Required documents checklist', '30-day action plan and next step'].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm text-pink-700">
            Free users get <strong>2 AI strategy suggestions</strong>. Upgrade to
            GlowBal Plus for more strategies and deeper support.
          </p>
        </div>

        <Reveal y={28}>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(30,40,80,0.10)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#00b4d8)] text-xs font-bold text-white">AI</span>
              <h3 className="text-base font-semibold text-slate-900">Your scholarship strategy</h3>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <p><span className="font-semibold text-slate-900">Fit:</span> <span className="text-emerald-600">Medium-high</span></p>
              <div>
                <p className="font-semibold text-slate-900">Strengths</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  <li>• Your subject interest matches the scholarship area.</li>
                  <li>• Your academic profile appears relevant.</li>
                  <li>• You have time to prepare before the deadline.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-900">What to improve</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  <li>• Strengthen your personal statement.</li>
                  <li>• Show leadership or extracurricular activity.</li>
                  <li>• Ask for a recommendation letter early.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-900">30-day plan</p>
                <ul className="mt-1 space-y-1 text-slate-600">
                  <li>Week 1: Confirm eligibility and collect documents.</li>
                  <li>Week 2: Draft your personal statement.</li>
                  <li>Week 3: Review your CV and recommendation letter.</li>
                  <li>Week 4: Final review and submit.</li>
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── 8. Student supporter network ────────────────────────────────────────── */

const SUPPORTERS = [
  { initials: 'MA', name: 'Minh Anh', uni: 'University of Melbourne', subject: 'Commerce', help: ['Australian university applications', 'Scholarship essays', 'Student life in Melbourne'], accent: '#00b4d8,#1e2a78' },
  { initials: 'TH', name: 'Thu Ha', uni: 'University of Toronto', subject: 'Engineering', help: ['Canadian applications', 'STEM scholarships', 'Visa and settling in'], accent: '#FF3D9A,#ff3b3b' },
  { initials: 'KP', name: 'Khoa Pham', uni: 'NUS Singapore', subject: 'Computer Science', help: ['ASEAN scholarships', 'Personal statements', 'Interview prep'], accent: '#7B2FBE,#00b4d8' },
];

function SupporterSection() {
  return (
    <section className="bg-[linear-gradient(180deg,#ffffff,#FAFAFF)]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Student supporters"
          title="Learn from students who have already made it"
          body="GlowBal connects you with students around the world who share real experience about universities, scholarships, applications, and student life."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {SUPPORTERS.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${p.accent})` }}>{p.initials}</span>
                  <div>
                    <p className="text-base font-semibold text-slate-900">{p.name}</p>
                    <p className="text-sm text-slate-500">{p.uni} · {p.subject}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Can help with</p>
                <ul className="mt-2 flex-1 space-y-1.5 text-sm text-slate-600">
                  {p.help.map((h) => <li key={h}>• {h}</li>)}
                </ul>
                <Link href="/advisors" className="mt-5 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:text-pink-600">
                  Ask about this university
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <GhostCTA href="/advisors">Find a student supporter</GhostCTA>
        </div>
      </div>
    </section>
  );
}

/* ── 9. Team behind GlowBal (Supabase-backed, static fallback) ──────────── */

const TEAM_GRADIENTS = [
  '#FF3D9A,#7B2FBE',
  '#00b4d8,#1e2a78',
  '#FF3D9A,#ff3b3b',
  '#7B2FBE,#00b4d8',
];

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Built-in fallback used before the Supabase migration/seed has run.
const FALLBACK_FOUNDER_BULLETS = [
  '80% Merit-based Scholarship recipient at VinUniversity',
  'Exchange Student at University of Birmingham, UK',
  'Advised students who earned 70–80% VinUniversity scholarships',
  '3-time Dean’s List Award recipient',
];

function FounderSpotlight({
  name,
  role,
  bioLine,
  bullets,
  quote,
  photoUrl,
  gradient = TEAM_GRADIENTS[0],
}: {
  name: string;
  role: string;
  bioLine: string | null;
  bullets: string[];
  quote: string | null;
  photoUrl?: string | null;
  gradient?: string;
}) {
  return (
    <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_16px_40px_rgba(30,40,80,0.07)] sm:p-9 lg:grid-cols-[auto_1fr] lg:items-center">
      <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
        {photoUrl ? (
          <Image src={photoUrl} alt={name} width={112} height={112} className="h-28 w-28 rounded-3xl object-cover" />
        ) : (
          <span
            className="flex h-28 w-28 items-center justify-center rounded-3xl text-3xl font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${gradient})` }}
          >
            {initials(name)}
          </span>
        )}
        <h3 className="mt-4 text-xl font-semibold text-slate-900">{name}</h3>
        <p className="text-sm font-semibold text-pink-600">{role}</p>
      </div>
      <div>
        {bioLine ? <p className="text-sm leading-7 text-slate-600">{bioLine}</p> : null}
        {bullets.length > 0 ? (
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                {b}
              </li>
            ))}
          </ul>
        ) : null}
        {quote ? (
          <p className="mt-5 border-l-2 border-pink-200 pl-4 text-sm italic text-slate-500">
            “{quote}”
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TeamGridCard({ member, index }: { member: TeamMember; index: number }) {
  const bullets = member.achievements
    .filter((a) => a.category !== 'quote')
    .slice(0, 3)
    .map((a) => a.title);
  const gradient = TEAM_GRADIENTS[index % TEAM_GRADIENTS.length];
  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
      <div className="flex items-center gap-3">
        {member.photo_url ? (
          <Image src={member.photo_url} alt={member.full_name} width={48} height={48} className="h-12 w-12 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${gradient})` }}>
            {initials(member.full_name)}
          </span>
        )}
        <div>
          <p className="text-base font-semibold text-slate-900">{member.full_name}</p>
          <p className="text-sm text-pink-600">{member.role}</p>
        </div>
      </div>
      {bullets.length > 0 ? (
        <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
          {bullets.map((b) => <li key={b}>• {b}</li>)}
        </ul>
      ) : member.short_bio ? (
        <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">{member.short_bio}</p>
      ) : null}
    </div>
  );
}

async function TeamSection() {
  const members = await getTeamMembers();
  const { featured, rest } = splitTeam(members);

  return (
    <section id="team" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Team behind GlowBal"
          title="Built by students who understand the journey"
          body="GlowBal is created by students, scholarship recipients, advisors, and international applicants who know how confusing the study-abroad process can feel."
        />

        <Reveal className="mt-12">
          {featured ? (
            <FounderSpotlight
              name={featured.full_name}
              role={featured.role}
              bioLine={
                featured.short_bio ??
                ([featured.degree, featured.major, featured.university]
                  .filter(Boolean)
                  .join(', ') || null)
              }
              bullets={featured.achievements
                .filter((a) => a.category !== 'quote')
                .slice(0, 4)
                .map((a) => a.title)}
              quote={featured.favourite_quote}
              photoUrl={featured.photo_url}
            />
          ) : (
            <FounderSpotlight
              name="Nguyen Khanh Linh"
              role="Founder"
              bioLine="Bachelor of Business Administration (Marketing), VinUniversity · Exchange Student at University of Birmingham, UK. Scholarship recipient and student advisor helping others build stronger study-abroad plans."
              bullets={FALLBACK_FOUNDER_BULLETS}
              quote="Because it is either the pain of perseverance or the pain of failure."
            />
          )}
        </Reveal>

        {rest.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((m, i) => (
              <Reveal key={m.id} delay={i * 0.07}>
                <TeamGridCard member={m} index={i} />
              </Reveal>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ── 10. Testimonials / student stories ──────────────────────────────────── */
/* Spec: do not use fake testimonials. Until real ones exist we frame this as
   "stories coming soon" + verifiable founder/mentoring outcomes. */

function TestimonialSection() {
  return (
    <section className="bg-[linear-gradient(180deg,#FAFAFF,#ffffff)]">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Student stories"
          title="Real outcomes from the GlowBal team"
          body="We don’t publish fake reviews. While the first student stories are on the way, here’s the advising track record behind GlowBal."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Reveal>
            <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
              <p className="text-sm leading-7 text-slate-700">“Advised multiple students who earned 70–80% merit-based scholarships at VinUniversity.”</p>
              <p className="mt-4 text-sm font-semibold text-slate-900">GlowBal advising record</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
              <p className="text-sm leading-7 text-slate-700">“Real student supporters who have studied abroad and won scholarships, ready to share what worked.”</p>
              <p className="mt-4 text-sm font-semibold text-slate-900">200+ supporters worldwide</p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="flex h-full flex-col items-start justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6">
              <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">Coming soon</span>
              <p className="mt-3 text-sm leading-7 text-slate-600">Student stories from the first GlowBal cohort will appear here.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 11. GlowBal Plus ────────────────────────────────────────────────────── */

const FREE_FEATURES = ['Search universities', 'View limited scholarship previews', 'Save scholarships', 'Create a basic profile', '2 AI strategy suggestions'];
const PLUS_FEATURES = ['Unlock more scholarship opportunities', 'More AI strategy suggestions', 'Full scholarship application roadmap', 'Document checklist', 'Priority student supporter access', 'Deeper application guidance'];

function PlusSection() {
  return (
    <section id="plus" className="scroll-mt-20">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
        <SectionHeading
          eyebrow="GlowBal Plus"
          title="Want a stronger scholarship strategy?"
          body="GlowBal Plus helps you go beyond searching — unlock more scholarships, generate more AI strategies, and build a clearer plan. Designed to help you apply with a clearer, stronger strategy."
        />
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
              <h3 className="text-lg font-semibold text-slate-900">Free</h3>
              <p className="mt-1 text-sm text-slate-500">Everything you need to start.</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-600">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-slate-400">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/universities" className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Start for free
              </Link>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-pink-200 bg-[linear-gradient(180deg,#fff,#fdf2f8)] p-7 shadow-[0_20px_44px_rgba(255,77,140,0.16)]">
              <span className="absolute right-5 top-5 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Plus</span>
              <h3 className="text-lg font-semibold text-slate-900">GlowBal Plus</h3>
              <p className="mt-1 text-sm text-slate-500">Deeper support for serious applicants.</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
                {PLUS_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 text-pink-500">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/plus" className="mt-6 inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(255,77,140,0.3)] transition hover:-translate-y-0.5">
                Unlock my full scholarship plan
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── 12. FAQ (native <details> — accessible, zero JS) ────────────────────── */

const FAQS = [
  { q: 'What is GlowBal?', a: 'GlowBal is a platform that helps students discover global universities, find scholarships, and build an application strategy with AI and student support.' },
  { q: 'Is GlowBal free?', a: 'You can search universities, preview scholarships, save opportunities, and generate a limited number of AI strategy suggestions for free. GlowBal Plus unlocks deeper support.' },
  { q: 'What is an AI strategy suggestion?', a: 'It is a personalised plan for a selected scholarship, including fit, strengths, weaknesses, required documents, risks, and next steps.' },
  { q: 'Who are student supporters?', a: 'Student supporters are people who have studied internationally, won scholarships, or experienced the application process themselves.' },
  { q: 'Do I need to know my university already?', a: 'No. You can search for a specific university or browse based on country, subject, budget, and scholarship availability.' },
  { q: 'Why do I need to create a profile?', a: 'Your profile helps GlowBal save your scholarship plan and show opportunities that are more relevant to your goals.' },
  { q: 'Does GlowBal guarantee scholarships?', a: 'No. GlowBal helps students discover opportunities and prepare stronger applications, but final decisions are made by universities and scholarship providers.' },
];

function FAQSection() {
  return (
    <section id="faq" className="scroll-mt-20 bg-[linear-gradient(180deg,#ffffff,#FAFAFF)]">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10 space-y-3">
          {FAQS.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-slate-900">
                {item.q}
                <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-45" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 13. Final CTA + lead capture ────────────────────────────────────────── */

function FinalCTASection({ action }: { action: WaitlistAction }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#0f1745,#1e2a78)] p-8 sm:p-12">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-pink-500/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              Start with one dream university. Leave with a scholarship plan.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/70">
              Choose a university, discover scholarships, and build your AI
              application strategy — free to start.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/universities" className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(255,77,140,0.3)] transition hover:-translate-y-0.5">
                Find my scholarships
              </Link>
              <a href="#how-it-works" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10">
                See how it works
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Get early updates</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Not ready yet? Save your spot.</h3>
            <p className="mt-1 text-sm text-white/60">We’ll send your scholarship starting points and product updates. One email, no spam.</p>
            <div style={{ '--glow-input-bg': 'rgba(255,255,255,0.08)' } as React.CSSProperties} className="text-white [&_.glow-label]:text-white/80">
              <WaitlistForm action={action} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 14. Footer ──────────────────────────────────────────────────────────── */

const FOOTER_COLS = [
  { title: 'Product', links: [['Find universities', '/universities'], ['Find scholarships', '/scholarships'], ['AI strategy', '#how-it-works'], ['Student supporters', '/advisors'], ['GlowBal Plus', '/plus']] },
  { title: 'Company', links: [['About', '#team'], ['Team', '#team'], ['Student stories', '/news'], ['Contact', 'mailto:hello@glowbal.com']] },
  { title: 'Legal', links: [['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']] },
];

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <span className="glowbal-wordmark text-xl font-bold tracking-tight">GLOWBAL</span>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
              Helping students find global universities, scholarships, and
              application strategies.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-slate-900">{col.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-500">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/') ? (
                      <Link href={href} className="transition hover:text-pink-600">{label}</Link>
                    ) : (
                      <a href={href} className="transition hover:text-pink-600">{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} GlowBal. Student-first global guidance.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="https://www.facebook.com/glowbal.education" target="_blank" rel="noreferrer" aria-label="Facebook" className="transition hover:text-pink-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" /></svg>
            </a>
            <a href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="transition hover:text-pink-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><line x1="17.5" y1="6.5" x2="17.5" y2="6.5" /></svg>
            </a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="transition hover:text-pink-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 18.34v-7.2H6v7.2zM7.17 9.9a1.36 1.36 0 1 0 0-2.72 1.36 1.36 0 0 0 0 2.72zM18 18.34v-3.95c0-2.11-1.13-3.09-2.63-3.09a2.27 2.27 0 0 0-2.06 1.13v-.97h-2.34v7.2h2.34v-3.8c0-1 .19-1.97 1.43-1.97s1.25 1.15 1.25 2v3.77z" /></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Composition ─────────────────────────────────────────────────────────── */

export function HomeLanding({ action }: { action: WaitlistAction }) {
  return (
    <div className="home-landing-root min-h-screen bg-white text-slate-800">
      <SiteHeader />
      <main>
        <Hero />
        <StatsStrip />
        <DemoVideoSection />
        <HowItWorksSection />
        <ScholarshipPreviewSection />
        <SupporterSection />
        <TeamSection />
        <FAQSection />
        <FinalCTASection action={action} />

        {/* Sections kept for future use — hidden from the current flow.
            Flip SHOW_LEGACY_SECTIONS to re-enable. */}
        {SHOW_LEGACY_SECTIONS && (
          <>
            <ProblemSection />
            <UniversitySearchSection />
            <AIStrategySection />
            <TestimonialSection />
            <PlusSection />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
