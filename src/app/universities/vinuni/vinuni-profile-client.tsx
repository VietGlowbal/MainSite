'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { VinUniAaccFeedback } from '@/components/statement/VinUniAaccFeedback';
import { useT } from '@/lib/i18n';
import type { AaccAnalysis } from '@/lib/ai/vinuni-grounded-evaluation';
import type { AaccAnalysisV2 } from '@/lib/ai/vinuni-evaluation-v2';
import type { University } from '@/lib/types';
import {
  vinuniHero,
  vinuniColleges,
  vinuniScholarships,
  vinuniFinancials,
  vinuniAdmissions,
  vinuniCareer,
  vinuniCampusLife,
  vinuniFaq,
  VINUNI_AACC_PILLARS,
  vinuniSopGuidance,
  type College,
  type Scholarship,
  type AaccPillarKey,
} from '@/lib/vinuni-content';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type Props = {
  university: University;
  matchPercentage: number | null;
  isLoggedIn: boolean;
  initiallySaved: boolean;
};

const SECTIONS = [
  { id: 'academic', label: 'Academic' },
  { id: 'financials', label: 'Financials' },
  { id: 'admissions', label: 'Admissions' },
  { id: 'career', label: 'Career' },
  { id: 'campus', label: 'Campus Life' },
  { id: 'sop', label: 'SOP fit' },
  { id: 'faq', label: 'FAQ' },
];

const ACCENT_STYLES: Record<College['accent'], { ring: string; chip: string; bar: string }> = {
  pink: {
    ring: 'ring-rose-200',
    chip: 'bg-rose-50 text-rose-600 border-rose-200',
    bar: 'bg-[linear-gradient(135deg,#e11d48,#fb7185)]',
  },
  cyan: {
    ring: 'ring-cyan-200',
    chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bar: 'bg-[linear-gradient(135deg,#00C2FF,#90e0ef)]',
  },
  purple: {
    ring: 'ring-purple-200',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
    bar: 'bg-[linear-gradient(135deg,#7B2FBE,#e11d48)]',
  },
  emerald: {
    ring: 'ring-emerald-200',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-[linear-gradient(135deg,#10b981,#00C2FF)]',
  },
};

export function VinUniProfileClient({
  university,
  matchPercentage,
  isLoggedIn,
  initiallySaved,
}: Props) {
  return (
    <main className="relative min-h-screen text-slate-900">
      <SectionNav />
      <Hero
        university={university}
        matchPercentage={matchPercentage}
        isLoggedIn={isLoggedIn}
        initiallySaved={initiallySaved}
      />
      <AcademicSection university={university} />
      <FinancialsSection />
      <AdmissionsSection />
      <CareerSection />
      <CampusLifeSection />
      <SopAaccSection isLoggedIn={isLoggedIn} />
      <FaqSection />
      <BottomCta isLoggedIn={isLoggedIn} />
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
//  In-page sticky anchor nav
// ──────────────────────────────────────────────────────────────────

function SectionNav() {
  return (
    // top-0 put this bar underneath the site header — the fixed mobile one
    // always, and the desktop one whenever it was revealed. --gb-nav-offset is
    // how much chrome is above it right now; see tokens.css.
    <nav className="sticky top-[var(--gb-nav-offset)] z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md transition-[top] duration-200 ease-out motion-reduce:transition-none">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3 md:gap-2 md:px-6">
        <Link
          href="/universities"
          className="mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-600"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          All universities
        </Link>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Hero
// ──────────────────────────────────────────────────────────────────

function Hero({
  university,
  matchPercentage,
  isLoggedIn,
  initiallySaved,
}: {
  university: University;
  matchPercentage: number | null;
  isLoggedIn: boolean;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const cover = university.image_url || null;
  const logo = university.logo_url || null;

  return (
    <header className="relative overflow-hidden">
      {/* Background — cinematic gradient with optional cover image */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#0F1745_0%,#1e2a78_45%,#7B2FBE_100%)]" />
      {cover ? (
        <div className="absolute inset-0 opacity-30 mix-blend-luminosity">
          <Image src={cover} alt="" fill priority className="object-cover" sizes="100vw" />
        </div>
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(225,29,72,0.25),transparent_55%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-16 md:px-6 md:pt-20 md:pb-24">
        <div className="flex flex-col items-start gap-6">
          {/* Logo + name */}
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_8px_22px_rgba(0,0,0,0.18)] md:h-20 md:w-20">
              {logo ? (
                <Image src={logo} alt="VinUniversity logo" width={56} height={56} className="object-contain" />
              ) : (
                <span className="text-2xl font-bold text-rose-600">VU</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200/80">
                {vinuniHero.campusLocation}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                VinUniversity
              </h1>
            </div>
          </div>

          <p className="max-w-3xl text-base text-white/85 md:text-lg">
            {vinuniHero.tagline}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <HeroBadge label={`Founded ${vinuniHero.founded}`} />
            <HeroBadge label="Private · Non-profit" />
            <HeroBadge label="100% English-taught" />
            {university.qs_rank ? <HeroBadge label={`QS #${university.qs_rank}`} /> : null}
            {matchPercentage !== null ? (
              <HeroBadge label={`${matchPercentage}% match`} highlight />
            ) : null}
          </div>

          {/* Partnership chips */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/55">
              Strategic partners
            </span>
            {vinuniHero.partnerships.map((p) => (
              <span key={p} className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                {p}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={vinuniHero.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#e11d48,#fb7185)] px-6 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(225,29,72,0.35)] transition hover:-translate-y-0.5"
            >
              Apply to VinUni
              <ArrowRight />
            </a>
            <Link
              href="/advisors"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Talk to a VinUni advisor
            </Link>
            <button
              type="button"
              onClick={() => setSaved((s) => !s)}
              aria-label={saved ? 'Remove from saved' : 'Save VinUniversity'}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 backdrop-blur transition ${
                saved ? 'bg-white text-rose-600' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>

          {!isLoggedIn ? (
            <p className="text-xs text-white/70">
              <Link href="/auth" className="underline underline-offset-2 hover:text-white">
                Sign in
              </Link>{' '}
              to see your personal match score and save VinUni to your shortlist.
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function HeroBadge({ label, highlight = false }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${
        highlight
          ? 'border-rose-200/80 bg-rose-500/30 text-white'
          : 'border-white/30 bg-white/10 text-white/90'
      }`}
    >
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
//  §1 Academic Profile
// ──────────────────────────────────────────────────────────────────

function AcademicSection({ university }: { university: University }) {
  return (
    <section id="academic" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-6 md:py-20">
      <SectionHeading
        eyebrow="01 · Academic"
        title="Academic profile"
        subtitle="Programs across four colleges, co-developed with Cornell University and the University of Pennsylvania."
      />

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Colleges" value="4" />
        <StatTile label="Bachelor programs" value="10+" />
        <StatTile label="Language of instruction" value="English" />
        <StatTile label="Faculty advisors" value="Cornell · Penn" />
      </div>

      <div className="mt-10 space-y-4">
        {vinuniColleges.map((college) => (
          <CollegeCard key={college.id} college={college} />
        ))}
      </div>

      {university.strengths || university.specific_insight ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Strengths from the Glowbal database</h3>
          {university.strengths ? <p className="mt-2 text-sm text-slate-600">{university.strengths}</p> : null}
          {university.specific_insight ? (
            <p className="mt-2 text-sm text-slate-600">{university.specific_insight}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CollegeCard({ college }: { college: College }) {
  const [open, setOpen] = useState(false);
  const accent = ACCENT_STYLES[college.accent];

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)] ring-1 ${accent.ring}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 p-6 text-left"
        aria-expanded={open}
      >
        <div className={`h-12 w-12 shrink-0 rounded-xl ${accent.bar}`} aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">{college.name}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}>
              {college.shortName}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{college.tagline}</p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {college.programs.length} program{college.programs.length === 1 ? '' : 's'} · click to {open ? 'collapse' : 'expand'}
          </p>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`mt-1 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-6">
          {college.programs.map((p) => (
            <div key={p.name} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold text-slate-900">{p.name}</h4>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}>
                  {p.degree} · {p.durationYears}y
                </span>
                {p.graduationMode ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    {p.graduationMode}
                  </span>
                ) : null}
              </div>
              {p.accreditation ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">{p.accreditation}</p>
              ) : null}
              {p.curriculumHighlights?.length ? (
                <ul className="mt-3 space-y-1.5">
                  {p.curriculumHighlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {college.facilityNotes?.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Facilities</h5>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {college.facilityNotes.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  §2 Financials & Scholarships
// ──────────────────────────────────────────────────────────────────

function FinancialsSection() {
  return (
    <section id="financials" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          eyebrow="02 · Financials"
          title="Tuition, scholarships & financial aid"
          subtitle="Almost all VinUni admits receive scholarship support. Apply early to maximise your chances."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <CostTile
            label="Tuition (USD / year)"
            value={`$${vinuniFinancials.tuitionUsdPerYear.toLocaleString()}`}
            accent="pink"
          />
          <CostTile
            label="Living cost (USD / year)"
            value={`$${vinuniFinancials.livingCostUsdPerYear.toLocaleString()}`}
            accent="cyan"
          />
          <CostTile
            label="Aid availability"
            value="Up to 100% + stipend"
            accent="purple"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">{vinuniFinancials.paymentSchedule}</p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <ScholarshipTable
            title="Base scholarships (merit-based)"
            scholarships={vinuniScholarships.base}
            accent="pink"
          />
          <ScholarshipTable
            title="Special & cumulative scholarships"
            scholarships={vinuniScholarships.special}
            accent="cyan"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-900">
          <strong className="font-semibold">Maintaining your scholarship:</strong> {vinuniScholarships.maintainNote}
        </div>

        <div className="mt-12">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">On-campus jobs</h3>
          <p className="mt-1 text-sm text-slate-600">
            Earn while you study. Most teaching & research roles open from year 2 onwards.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {vinuniFinancials.onCampusJobs.map((job) => (
              <div key={job.role} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                <p className="text-sm font-semibold text-slate-900">{job.role}</p>
                <p className="mt-2 text-xs text-slate-500">{job.stipend}</p>
                <p className="mt-3 text-xs text-slate-600">{job.eligibility}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CostTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'pink' | 'cyan' | 'purple';
}) {
  const bg =
    accent === 'pink'
      ? 'bg-[linear-gradient(135deg,#e11d48,#fb7185)]'
      : accent === 'cyan'
      ? 'bg-[linear-gradient(135deg,#00C2FF,#90e0ef)]'
      : 'bg-[linear-gradient(135deg,#7B2FBE,#e11d48)]';
  return (
    <div className={`rounded-2xl ${bg} p-6 text-white shadow-[0_10px_28px_rgba(15,23,42,0.12)]`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-white/80">{label}</p>
      <p className="mt-3 text-2xl font-semibold md:text-3xl">{value}</p>
    </div>
  );
}

function ScholarshipTable({
  title,
  scholarships,
  accent,
}: {
  title: string;
  scholarships: Scholarship[];
  accent: 'pink' | 'cyan';
}) {
  const accentColor = accent === 'pink' ? 'text-rose-600' : 'text-cyan-700';
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {scholarships.map((s) => (
          <li key={s.name} className="px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-sm font-semibold text-slate-900">{s.name}</p>
              <span className={`text-xs font-semibold ${accentColor}`}>{s.coverage}</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600">{s.eligibility}</p>
            {s.maintainGPA ? (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Maintain: {s.maintainGPA}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  §3 Admissions
// ──────────────────────────────────────────────────────────────────

function AdmissionsSection() {
  return (
    <section id="admissions" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          eyebrow="03 · Admissions"
          title="Admission requirements & timeline"
          subtitle="VinUni evaluates holistically — academics, English proficiency, leadership and fit."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <h3 className="text-base font-semibold text-slate-900">Academic baseline</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Minimum GPA" value={vinuniAdmissions.gpaMin} />
              {vinuniAdmissions.standardizedTests.map((t) => (
                <Row key={t.test} label={t.test} value={t.detail} />
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <h3 className="text-base font-semibold text-slate-900">English proficiency</h3>
            <dl className="mt-4 space-y-3 text-sm">
              {vinuniAdmissions.languageRequirements.map((l) => (
                <Row key={l.test} label={l.test} value={l.minimum} />
              ))}
            </dl>
            <p className="mt-4 text-xs text-slate-500">{vinuniAdmissions.interview}</p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Documents required</h3>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {vinuniAdmissions.documentsRequired.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <h3 className="text-base font-semibold text-slate-900">Application timeline</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {vinuniAdmissions.deadlines.map((d) => (
              <div key={d.round} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">{d.round}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Deadline: {d.deadline}</p>
                <p className="mt-1 text-xs text-slate-600">Notify: {d.notify}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-700">
            {vinuniAdmissions.scholarshipDeadlineNote}
          </p>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  §4 Career & Alumni
// ──────────────────────────────────────────────────────────────────

function CareerSection() {
  return (
    <section id="career" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          eyebrow="04 · Career"
          title="Career outcomes & alumni"
          subtitle="VinUni partners directly with global employers and Ivy League graduate schools."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <CostTile
            label="Employment rate (within 6 months)"
            value={`${vinuniCareer.employmentRatePercent}%`}
            accent="pink"
          />
          <CostTile
            label="Avg. starting salary"
            value={`$${vinuniCareer.averageStartingSalaryUsd.toLocaleString()}+ / year`}
            accent="cyan"
          />
          <CostTile label="Industry partners" value={`${vinuniCareer.partnerCompanies.length}+`} accent="purple" />
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">Recruiting partners</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {vinuniCareer.partnerCompanies.map((c) => (
              <span key={c} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <h3 className="text-base font-semibold text-slate-900">Internship & experience programs</h3>
            <ul className="mt-3 space-y-2">
              {vinuniCareer.internshipPrograms.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <h3 className="text-base font-semibold text-slate-900">Alumni network</h3>
            <p className="mt-3 text-sm text-slate-700">{vinuniCareer.alumniNetworkSummary}</p>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-sm italic text-slate-700">“{vinuniCareer.testimonial.quote}”</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
                — {vinuniCareer.testimonial.author}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-purple-200 bg-purple-50/60 p-5 text-sm text-purple-900">
          <strong className="font-semibold">Post-graduation pathway:</strong> {vinuniCareer.postGradVisa}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
//  §5 Campus Life
// ──────────────────────────────────────────────────────────────────

function CampusLifeSection() {
  return (
    <section id="campus" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          eyebrow="05 · Campus Life"
          title="Location, housing & community"
          subtitle="A modern green campus 15 km from central Hanoi — Vietnam’s growing innovation belt."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <h3 className="text-base font-semibold text-slate-900">Location</h3>
            <p className="mt-3 text-sm text-slate-700">{vinuniCampusLife.locationDescription}</p>
            <p className="mt-3 text-sm text-slate-700">
              <strong className="font-semibold">Climate:</strong> {vinuniCampusLife.climate}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
            <h3 className="text-base font-semibold text-slate-900">Housing</h3>
            <p className="mt-3 text-sm text-slate-700">{vinuniCampusLife.housing.description}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row
                label="Year-1 housing"
                value={vinuniCampusLife.housing.onCampusRequiredYear1 ? 'Required on-campus' : 'Optional'}
              />
              <Row label="Monthly cost" value={`$${vinuniCampusLife.housing.monthlyCostUsd}`} />
            </dl>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Clubs & community</h3>
            <span className="text-xs font-semibold text-rose-600">
              {vinuniCampusLife.internationalStudentPercent}% international
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {vinuniCampusLife.clubs.map((c) => (
              <span key={c} className="rounded-full border border-rose-100 bg-rose-50/70 px-3 py-1 text-xs font-semibold text-rose-700">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">Campus gallery</h3>
          <p className="mt-1 text-sm text-slate-500">Real photography coming soon — these are placeholder gradients.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vinuniCampusLife.gallery.map((g) => (
              <div
                key={g.caption}
                className="relative h-44 overflow-hidden rounded-2xl shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                style={{ background: g.gradient }}
              >
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4">
                  <p className="text-sm font-semibold text-white">{g.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
//  FAQ
// ──────────────────────────────────────────────────────────────────

function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Quick answers to the things students ask most before applying."
        />
        <div className="mt-8 space-y-3">
          {vinuniFaq.map((f, i) => (
            <FaqItem key={f.question} question={f.question} answer={f.answer} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer, defaultOpen }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{question}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? <p className="border-t border-slate-100 bg-slate-50/40 p-5 text-sm text-slate-700">{answer}</p> : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Bottom CTA
// ──────────────────────────────────────────────────────────────────

function BottomCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#e11d48_0%,#7B2FBE_55%,#0F1745_100%)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-16 text-center md:px-6 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          Ready to start?
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Apply to VinUniversity through Glowbal
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 md:text-base">
          Build your VinUni application with advisors who studied there. Track your tasks,
          drafts and deadlines in one place — and save VinUni to your shortlist.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={vinuniHero.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-rose-600 shadow-[0_10px_28px_rgba(225,29,72,0.35)] transition hover:-translate-y-0.5"
          >
            Apply on VinUni site
            <ArrowRight />
          </a>
          <Link
            href={isLoggedIn ? '/apply' : '/auth'}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            {isLoggedIn ? 'Open my shortlist' : 'Sign in to save VinUni'}
          </Link>
          <Link
            href="/advisors"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Book a VinUni advisor
          </Link>
        </div>
        <p className="mt-6 text-xs text-white/60">
          <Link href="/universities" className="underline underline-offset-2 hover:text-white">
            ← Back to all universities
          </Link>
        </p>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Shared bits
// ──────────────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">{subtitle}</p> : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">{value}</p>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────
//  §6 SOP AACC analyzer
// ──────────────────────────────────────────────────────────────────

type AaccPillarResult = AaccAnalysis['pillars'][AaccPillarKey];

const VERDICT_LABEL: Record<AaccAnalysis['overall']['verdict'], { label: string; tone: string }> = {
  'strong-fit': { label: 'Strong fit', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  promising: { label: 'Promising', tone: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  'needs-work': { label: 'Needs work', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  misaligned: { label: 'Misaligned', tone: 'bg-rose-100 text-rose-700 border-rose-200' },
};

const PILLAR_ACCENT: Record<AaccPillarKey, { ring: string; chip: string; bar: string; text: string }> = {
  ability: {
    ring: 'ring-rose-200',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-[linear-gradient(135deg,#e11d48,#fb7185)]',
    text: 'text-rose-700',
  },
  aspirations: {
    ring: 'ring-purple-200',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
    bar: 'bg-[linear-gradient(135deg,#7B2FBE,#e11d48)]',
    text: 'text-purple-700',
  },
  creativity: {
    ring: 'ring-cyan-200',
    chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bar: 'bg-[linear-gradient(135deg,#00C2FF,#90e0ef)]',
    text: 'text-cyan-700',
  },
  commitment: {
    ring: 'ring-emerald-200',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-[linear-gradient(135deg,#10b981,#00C2FF)]',
    text: 'text-emerald-700',
  },
};

const MIN_SOP_CHARS = 200;

async function readVinUniAnalysis(response: Response): Promise<AaccAnalysisV2> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || 'Unable to analyse right now.');
  }
  const lines = (await response.text()).split('\n').filter(Boolean);
  for (const line of lines) {
    const event = JSON.parse(line) as { type?: string; analysis?: AaccAnalysisV2; message?: string };
    if (event.type === 'complete' && event.analysis) return event.analysis;
    if (event.type === 'error') throw new Error(event.message || 'Analysis was not completed.');
  }
  throw new Error('Analysis was not completed.');
}

export function SopAaccSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT();
  const [mode, setMode] = useState<'idle' | 'yes' | 'no'>('idle');
  const [sopText, setSopText] = useState('');
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Analysing your statement');
  const [result, setResult] = useState<(AaccAnalysis | AaccAnalysisV2) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = sopText.trim().length;
  const canAnalyze = charCount >= MIN_SOP_CHARS && !loading;

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai/analyze-statement-aacc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sopText, contextMode: 'vinuni_public' }),
      });
      setResult(await readVinUniAnalysis(res));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="sop" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <SectionHeading
          eyebrow="06 · AACC fit"
          title="Stress-test your SOP against VinUni's AACC rubric"
          subtitle="VinUni evaluates every applicant on four pillars — Ability, Aspirations, Creativity, Commitment. See how your Statement of Purpose stacks up."
        />

        {/* Idle: ask Yes/No */}
        {mode === 'idle' ? (
          <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-10">
            <p className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              Do you have a Statement of Purpose (SOP) yet?
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Either way, we’ve got you. We’ll either analyse your draft or coach you to write one.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMode('yes')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#e11d48,#fb7185)] px-7 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(225,29,72,0.32)] transition hover:-translate-y-0.5"
              >
                Yes — analyze it
                <ArrowRight />
              </button>
              <button
                type="button"
                onClick={() => setMode('no')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-white px-7 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                No — show me how to write one
              </button>
            </div>
          </div>
        ) : null}

        {/* Yes flow */}
        {mode === 'yes' ? (
          <div className="mt-10 space-y-6">
            <SopBackToggle onChange={setMode} />
            {!isLoggedIn ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-8 text-center shadow-[0_10px_28px_rgba(225,29,72,0.12)]">
                <h3 className="text-lg font-semibold text-slate-900">Sign in to analyze your SOP</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Analysis runs against your private account. Sign in to securely send your draft to the AACC reviewer.
                </p>
                <Link
                  href="/auth?redirect=/universities/vinuni"
                  className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#e11d48,#fb7185)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(225,29,72,0.28)] transition hover:-translate-y-0.5"
                >
                  Sign in to continue
                  <ArrowRight />
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:p-8">
                  <label htmlFor="sop-textarea" className="text-sm font-semibold text-slate-900">
                    Paste your Statement of Purpose
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('At least {count} characters. Your essay is analysed by AI and is not saved.', {
                      count: MIN_SOP_CHARS,
                    })}
                  </p>
                  <textarea
                    ref={textareaRef}
                    id="sop-textarea"
                    value={sopText}
                    onChange={(e) => setSopText(e.target.value)}
                    placeholder="Paste your full SOP here…"
                    className="mt-4 block min-h-[280px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-100"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span>
                      {charCount} / {MIN_SOP_CHARS}+ characters
                      {charCount > 0 && charCount < MIN_SOP_CHARS ? ' · keep going' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={!canAnalyze}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7B2FBE,#e11d48)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(123,47,190,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
                    >
                      {loading ? 'Analyzing…' : 'Analyze with AACC'}
                      {!loading ? <ArrowRight /> : null}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                {loading ? <AaccSkeleton /> : null}
                {result ? <AaccResult analysis={result} onTryAgain={() => { setResult(null); setError(null); textareaRef.current?.focus(); }} /> : null}
              </>
            )}
          </div>
        ) : null}

        {/* No flow */}
        {mode === 'no' ? (
          <div className="mt-10 space-y-6">
            <SopBackToggle onChange={setMode} />
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:p-8">
              <p className="text-sm text-slate-700 md:text-base">{vinuniSopGuidance.intro}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-rose-600">
                {vinuniSopGuidance.lengthGuide}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:p-8">
              <h3 className="text-base font-semibold text-slate-900">{t('One possible planning framework')}</h3>
              <p className="mt-2 text-sm text-slate-600">{t('Use these prompts flexibly; your essay does not need to follow a fixed structure.')}</p>
              <ol className="mt-4 space-y-2.5">
                {vinuniSopGuidance.structure.map((s, i) => (
                  <li key={s} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-3">
              {VINUNI_AACC_PILLARS.map((p) => (
                <PillarGuideAccordion key={p.key} pillar={p} />
              ))}
            </div>

            <div className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 text-center md:p-8">
              <h3 className="text-lg font-semibold text-slate-900">Drafted something already?</h3>
              <p className="mt-2 text-sm text-slate-700">
                Run it through the AACC analyzer whenever you’re ready.
              </p>
              <button
                type="button"
                onClick={() => setMode('yes')}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#e11d48,#fb7185)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5"
              >
                I have a draft — analyze it
                <ArrowRight />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SopBackToggle({ onChange }: { onChange: (mode: 'idle' | 'yes' | 'no') => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange('idle')}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Change my answer
    </button>
  );
}

function PillarGuideAccordion({
  pillar,
}: {
  pillar: (typeof VINUNI_AACC_PILLARS)[number];
}) {
  const [open, setOpen] = useState(false);
  const accent = PILLAR_ACCENT[pillar.key];
  const tips = vinuniSopGuidance.pillarTips[pillar.key];
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ring-1 ${accent.ring}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-5 text-left md:p-6"
      >
        <div className={`h-10 w-10 shrink-0 rounded-xl ${accent.bar}`} aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-slate-900">{pillar.name}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}>
              {pillar.nameVi}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{pillar.description}</p>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`mt-1 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 p-5 md:p-6">
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Writing prompts
            </h5>
            <ul className="mt-2 space-y-1.5">
              {tips.prompts.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${accent.bar}`} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Examples</h5>
            <ul className="mt-2 space-y-2">
              {tips.examples.map((e) => (
                <li key={e} className="rounded-xl border border-slate-200 bg-white p-3 text-sm italic text-slate-700">
                  “{e}”
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-rose-600">Common pitfalls</h5>
            <ul className="mt-2 space-y-1.5">
              {tips.pitfalls.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Indicators VinUni rewards</h5>
            <div className="mt-2 flex flex-wrap gap-2">
              {pillar.indicators.map((i) => (
                <span key={i} className={`rounded-full border px-3 py-1 text-xs font-semibold ${accent.chip}`}>
                  {i}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AaccSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
      <div className="flex animate-pulse flex-col gap-4">
        <div className="h-6 w-1/3 rounded-full bg-slate-100" />
        <div className="h-4 w-2/3 rounded-full bg-slate-100" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-40 rounded-2xl bg-slate-100" />
          <div className="h-40 rounded-2xl bg-slate-100" />
          <div className="h-40 rounded-2xl bg-slate-100" />
          <div className="h-40 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function AaccResult({ analysis, onTryAgain }: { analysis: AaccAnalysis | AaccAnalysisV2; onTryAgain: () => void }) {
  if (analysis.sections) {
    return <VinUniAaccFeedback analysis={analysis} onTryAgain={onTryAgain} />;
  }
  const verdict = VERDICT_LABEL[analysis.overall.verdict] ?? VERDICT_LABEL.promising;
  return (
    <div className="space-y-6">
      {/* Overall */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="grid gap-6 p-6 md:grid-cols-[180px_1fr] md:p-8">
          <ScoreDial value={analysis.overall.score} label="Overall AACC" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${verdict.tone}`}>
                {verdict.label}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                VinUni AACC verdict
              </span>
            </div>
            <p className="mt-3 text-base text-slate-800 md:text-lg">{analysis.overall.summary}</p>
          </div>
        </div>
      </div>

      {/* 4 pillars */}
      <div className="grid gap-4 md:grid-cols-2">
        {VINUNI_AACC_PILLARS.map((p) => (
          <PillarResultCard key={p.key} pillar={p} result={analysis.pillars[p.key]} />
        ))}
      </div>

      {/* Recommendations */}
      {analysis.topRecommendations?.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_4px_14px_rgba(15,23,42,0.04)] md:p-8">
          <h3 className="text-base font-semibold text-slate-900">Top recommendations</h3>
          <ol className="mt-4 space-y-3">
            {analysis.topRecommendations.map((r, i) => {
              const accent = PILLAR_ACCENT[r.pillar] ?? PILLAR_ACCENT.ability;
              const pillarMeta = VINUNI_AACC_PILLARS.find((p) => p.key === r.pillar);
              return (
                <li key={r.id ?? i} className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent.chip}`}>
                        {pillarMeta?.name ?? r.pillar}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">{r.action}</p>
                    </div>
                    {r.rationale ? (
                      <p className="mt-1 text-sm text-slate-600">{r.rationale}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {/* Red flags */}
      {analysis.redFlags?.length ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h4 className="text-sm font-semibold text-rose-700">Red flags to address</h4>
          <ul className="mt-2 space-y-1">
            {analysis.redFlags.map((f) => (
              <li key={f} className="text-sm text-rose-700">· {f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onTryAgain}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-rose-600 bg-white px-6 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          Edit & re-analyze
        </button>
        <Link
          href="/advisors"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7B2FBE,#e11d48)] px-6 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(123,47,190,0.28)] transition hover:-translate-y-0.5"
        >
          Book a VinUni advisor to deepen this
          <ArrowRight />
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        Analysis is AI-generated guidance, not an admissions decision. VinUni admissions reads the full application in context.
      </p>
    </div>
  );
}

function PillarResultCard({
  pillar,
  result,
}: {
  pillar: (typeof VINUNI_AACC_PILLARS)[number];
  result: AaccPillarResult | undefined;
}) {
  const accent = PILLAR_ACCENT[pillar.key];
  if (!result) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] ring-1 ${accent.ring}`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 shrink-0 rounded-xl ${accent.bar}`} aria-hidden />
          <h4 className="text-base font-semibold text-slate-900">{pillar.name}</h4>
        </div>
        <p className="mt-3 text-sm text-slate-500">No data returned for this pillar.</p>
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] ring-1 ${accent.ring} md:p-6`}>
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 shrink-0 rounded-xl ${accent.bar}`} aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-base font-semibold text-slate-900">{pillar.name}</h4>
            <span className={`text-lg font-semibold tabular-nums ${accent.text}`}>
              {result.score}/100
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${clamp(result.score, 0, 100)}%` }} />
          </div>
        </div>
      </div>

      {result.strengths?.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Strengths</p>
          <ul className="mt-1.5 space-y-1">
            {result.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.gaps?.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Gaps</p>
          <ul className="mt-1.5 space-y-1">
            {result.gaps.map((g) => (
              <li key={g} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.evidenceQuotes?.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">From your SOP</p>
          <ul className="mt-1.5 space-y-1.5">
            {result.evidenceQuotes.map((q) => (
              <li key={q} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm italic text-slate-700">
                “{q}”
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ScoreDial({ value, label }: { value: number; label: string }) {
  const v = clamp(value, 0, 100);
  const circumference = 2 * Math.PI * 44;
  const offset = circumference * (1 - v / 100);
  return (
    <div className="grid place-items-center">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#aacc-grad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
          <defs>
            <linearGradient id="aacc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e11d48" />
              <stop offset="100%" stopColor="#7B2FBE" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-3xl font-semibold tabular-nums text-slate-900">{v}</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
