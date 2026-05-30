'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  type College,
  type Scholarship,
} from '@/lib/vinuni-content';

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
  { id: 'faq', label: 'FAQ' },
];

const ACCENT_STYLES: Record<College['accent'], { ring: string; chip: string; bar: string }> = {
  pink: {
    ring: 'ring-pink-200',
    chip: 'bg-pink-50 text-pink-600 border-pink-200',
    bar: 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)]',
  },
  cyan: {
    ring: 'ring-cyan-200',
    chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bar: 'bg-[linear-gradient(135deg,#00C2FF,#90e0ef)]',
  },
  purple: {
    ring: 'ring-purple-200',
    chip: 'bg-purple-50 text-purple-700 border-purple-200',
    bar: 'bg-[linear-gradient(135deg,#7B2FBE,#FF3D9A)]',
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
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3 md:gap-2 md:px-6">
        <Link
          href="/universities"
          className="mr-2 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-pink-300 hover:text-pink-600"
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
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-pink-50 hover:text-pink-600"
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,77,140,0.25),transparent_55%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-16 md:px-6 md:pt-20 md:pb-24">
        <div className="flex flex-col items-start gap-6">
          {/* Logo + name */}
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_8px_22px_rgba(0,0,0,0.18)] md:h-20 md:w-20">
              {logo ? (
                <Image src={logo} alt="VinUniversity logo" width={56} height={56} className="object-contain" />
              ) : (
                <span className="text-2xl font-bold text-pink-600">VU</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-200/80">
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
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-6 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(255,77,140,0.35)] transition hover:-translate-y-0.5"
            >
              Apply to VinUni
              <ArrowRight />
            </a>
            <Link
              href="/mentors"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Talk to a VinUni mentor
            </Link>
            <button
              type="button"
              onClick={() => setSaved((s) => !s)}
              aria-label={saved ? 'Remove from saved' : 'Save VinUniversity'}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 backdrop-blur transition ${
                saved ? 'bg-white text-pink-600' : 'bg-white/10 text-white hover:bg-white/20'
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
          ? 'border-pink-200/80 bg-pink-500/30 text-white'
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
                <p className="mt-2 text-xs font-semibold text-pink-600">{p.accreditation}</p>
              ) : null}
              {p.curriculumHighlights?.length ? (
                <ul className="mt-3 space-y-1.5">
                  {p.curriculumHighlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-pink-400" />
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
      ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)]'
      : accent === 'cyan'
      ? 'bg-[linear-gradient(135deg,#00C2FF,#90e0ef)]'
      : 'bg-[linear-gradient(135deg,#7B2FBE,#FF3D9A)]';
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
  const accentColor = accent === 'pink' ? 'text-pink-600' : 'text-cyan-700';
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
                <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">{d.round}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">Deadline: {d.deadline}</p>
                <p className="mt-1 text-xs text-slate-600">Notify: {d.notify}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-pink-200 bg-pink-50/70 p-3 text-xs text-pink-700">
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
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-pink-600">
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
            <span className="text-xs font-semibold text-pink-600">
              {vinuniCampusLife.internationalStudentPercent}% international
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {vinuniCampusLife.clubs.map((c) => (
              <span key={c} className="rounded-full border border-pink-100 bg-pink-50/70 px-3 py-1 text-xs font-semibold text-pink-700">
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
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#FF3D9A_0%,#7B2FBE_55%,#0F1745_100%)]" />
      <div className="relative mx-auto max-w-5xl px-4 py-16 text-center md:px-6 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          Ready to start?
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Apply to VinUniversity through Glowbal
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-white/85 md:text-base">
          Build your VinUni application with mentors who studied there. Track your tasks,
          drafts and deadlines in one place — and save VinUni to your shortlist.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={vinuniHero.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-pink-600 shadow-[0_10px_28px_rgba(255,77,140,0.35)] transition hover:-translate-y-0.5"
          >
            Apply on VinUni site
            <ArrowRight />
          </a>
          <Link
            href={isLoggedIn ? '/my-universities' : '/auth'}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            {isLoggedIn ? 'Open my shortlist' : 'Sign in to save VinUni'}
          </Link>
          <Link
            href="/mentors"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
          >
            Book a VinUni mentor
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink-600">{eyebrow}</p>
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
