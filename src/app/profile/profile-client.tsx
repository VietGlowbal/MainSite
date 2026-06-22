'use client';

import Link from 'next/link';
import type { UploadedDocument, StudentProfile } from '@/lib/types';
import { SignOutButton } from '@/components/sign-out-button';

/* ─────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────── */

type Props = {
  displayName: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  memberSince: string;
  profile: StudentProfile | null;
  documents: UploadedDocument[];
  activeApplications: number;
  isMentor: boolean;
  plusStatus: boolean;
  plusPlan: string | null;
};

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function CircularGauge({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#F1F5F9" strokeWidth="10" />
        <circle
          cx="56" cy="56" r={r}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FF3D9A" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{pct}%</span>
      </div>
    </div>
  );
}

function formatDocDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const PLAN_LABELS: Record<string, string> = {
  // Current feature tiers
  'plus-starter': 'Starter plan',
  'plus-pro': 'Pro plan',
  'plus-premium': 'Premium plan',
  // Legacy duration-based plans (kept so existing subscribers still read nicely)
  'plus-6m': '6-month plan',
  'plus-12m': '12-month plan',
  'plus-24m': '24-month plan',
};

/* ─────────────────────────────────────────────────────────────────────────
   PROFILE SECTIONS DATA — each links to its real editor route
───────────────────────────────────────────────────────────────────────── */

type SectionDef = {
  key: string;
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  barColor: string;
  pct: (p: StudentProfile | null, docs: UploadedDocument[]) => number;
};

const SECTIONS: SectionDef[] = [
  {
    key: 'personal',
    href: '/profile/personal',
    title: 'Personal information',
    description: 'Name, nationality, location and contact details',
    iconBg: 'bg-pink-100',
    barColor: 'bg-green-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    pct: (p) => Math.round(([!!p?.location, !!p?.nationality, !!p?.bio].filter(Boolean).length / 3) * 100),
  },
  {
    key: 'academic',
    href: '/profile/academic',
    title: 'Academic background',
    description: 'Your education history, grades and subjects',
    iconBg: 'bg-violet-100',
    barColor: 'bg-[#FF3D9A]',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
    pct: (p) => Math.round(([!!p?.study_level, !!p?.academic_background, !!p?.grades_summary].filter(Boolean).length / 3) * 100),
  },
  {
    key: 'preferences',
    href: '/profile/preferences',
    title: 'Target preferences',
    description: 'Countries, subjects, budget and preferred cities',
    iconBg: 'bg-blue-100',
    barColor: 'bg-blue-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
    pct: (p) => Math.round((
      [(p?.preferred_countries?.length ?? 0) > 0, (p?.target_subjects?.length ?? 0) > 0, !!p?.budget_range].filter(Boolean).length / 3
    ) * 100),
  },
  {
    key: 'achievements',
    href: '/profile/achievements',
    title: 'Achievements',
    description: 'Awards, extracurriculars and leadership roles',
    iconBg: 'bg-amber-100',
    barColor: 'bg-amber-400',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
    pct: (p) => {
      const count = p?.achievements?.length ?? 0;
      if (count === 0) return 0;
      if (count === 1) return 40;
      if (count < 3) return 70;
      return 100;
    },
  },
  {
    key: 'work',
    href: '/profile/work',
    title: 'Work experience',
    description: 'Internships, jobs and volunteering',
    iconBg: 'bg-green-100',
    barColor: 'bg-green-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    pct: () => 0,
  },
  {
    key: 'documents',
    href: '/profile/documents',
    title: 'Documents',
    description: 'Upload important documents and certificates',
    iconBg: 'bg-cyan-100',
    barColor: 'bg-cyan-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    pct: (_, docs) => Math.min(docs.length * 25, 100),
  },
  {
    key: 'english',
    href: '/profile/english',
    title: 'English proficiency',
    description: 'IELTS, TOEFL or other language test scores',
    iconBg: 'bg-purple-100',
    barColor: 'bg-purple-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8c-1.7 0-3 1.3-3 3s1.3 3 3 3 3 1.3 3 3-1.3 3-3 3" /><path d="M12 6v2M12 16v2" />
      </svg>
    ),
    pct: () => 0,
  },
  {
    key: 'goals',
    href: '/profile/goals',
    title: 'Application goals',
    description: 'What you want to achieve and your dream career',
    iconBg: 'bg-rose-100',
    barColor: 'bg-[#FF3D9A]',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
    pct: (p) => (p?.goals ? 100 : 0),
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   USER HERO CARD
───────────────────────────────────────────────────────────────────────── */

function UserCard({
  displayName,
  email,
  avatarUrl,
  initials,
  memberSince,
  profile,
  plusStatus,
  plusPlan,
}: {
  displayName: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  memberSince: string;
  profile: StudentProfile | null;
  plusStatus: boolean;
  plusPlan: string | null;
}) {
  const intake = profile?.target_intake
    ? `${profile.target_intake}${profile.application_cycle_year ? ` ${profile.application_cycle_year}` : ''}`
    : null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-400 to-blue-500 p-0.5">
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-slate-700">{initials}</span>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
            {plusStatus ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Plus
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Verified
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{email}</p>

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <Fact icon="pin" label={profile?.location || 'Location not set'} />
            <Fact icon="flag" label={profile?.nationality || 'Nationality not set'} />
            <Fact icon="cal" label={`Member since ${memberSince}`} />
            <Fact icon="cap" label={profile?.study_level || 'Study level not set'} />
            {intake ? <Fact icon="clock" label={`Target intake: ${intake}`} /> : null}
            {plusStatus && plusPlan ? <Fact icon="star" label={`GlowBal Plus · ${PLAN_LABELS[plusPlan] ?? plusPlan}`} /> : null}
          </div>
        </div>

        <div className="flex shrink-0 justify-center sm:justify-end">
          <Link
            href="/profile/personal"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit profile
          </Link>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon, label }: { icon: 'pin' | 'flag' | 'cal' | 'cap' | 'clock' | 'star'; label: string }) {
  const icons: Record<string, React.ReactNode> = {
    pin: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10 a3 3 0 1 0 0 0.01" />,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>,
    cal: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    cap: <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    star: <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />,
  };
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-slate-600 sm:justify-start">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
        {icons[icon]}
      </svg>
      <span className="truncate">{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION CARD — links to its editor route
───────────────────────────────────────────────────────────────────────── */

function SectionCard({ section, profile, documents }: { section: SectionDef; profile: StudentProfile | null; documents: UploadedDocument[] }) {
  const pct = section.pct(profile, documents);
  const done = pct >= 100;
  return (
    <Link
      href={section.href}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-pink-200 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.iconBg}`}>
          {section.icon}
        </div>
        <span className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>
          {done ? 'Complete' : `${pct}%`}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{section.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{section.description}</p>
      </div>
      <div className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${section.barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-pink-600 group-hover:gap-1.5">
        {pct === 0 ? 'Get started' : done ? 'Review' : 'Continue'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </span>
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   RIGHT RAIL
───────────────────────────────────────────────────────────────────────── */

function ProfileStrength({ profile, documents }: { profile: StudentProfile | null; documents: UploadedDocument[] }) {
  const overall = Math.round(SECTIONS.reduce((a, s) => a + s.pct(profile, documents), 0) / SECTIONS.length);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Profile strength</h3>
      <div className="mt-3 flex flex-col items-center gap-3 text-center">
        <CircularGauge pct={overall} />
        <p className="text-xs leading-relaxed text-slate-500">
          {overall >= 80
            ? 'Great profile! You’re ready for stronger matches.'
            : 'Complete more sections for better course matches and stronger plans.'}
        </p>
      </div>
    </div>
  );
}

function DocumentsCard({ documents }: { documents: UploadedDocument[] }) {
  const shown = documents.slice(0, 5);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Your documents</h3>
        <Link href="/profile/documents" className="text-xs font-semibold text-pink-600 hover:text-pink-700">Manage</Link>
      </div>
      {shown.length > 0 ? (
        <div className="space-y-2.5">
          {shown.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{doc.file_name}</p>
                <p className="text-[11px] text-slate-400">{doc.type} · {formatDocDate(doc.created_at)}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
          No documents uploaded yet.
        </p>
      )}
      <Link
        href="/profile/documents"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Upload a document
      </Link>
    </div>
  );
}

function ApplicationsCard({ activeApplications }: { activeApplications: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Your applications</h3>
        <Link href="/apply" className="text-xs font-semibold text-pink-600 hover:text-pink-700">View all</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active', value: activeApplications },
          { label: 'Submitted', value: 0 },
          { label: 'Offers', value: 0 },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="mb-1 text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
      <Link href="/apply" className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-100">
        Go to my applications →
      </Link>
    </div>
  );
}

function AccountCard({ email, plusStatus }: { email: string; plusStatus: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Account</h3>
      <p className="mt-1 truncate text-xs text-slate-500">{email}</p>

      <div className="mt-4 space-y-2">
        <Link
          href="/plus"
          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-pink-200 hover:bg-pink-50"
        >
          <span>{plusStatus ? 'Manage GlowBal Plus' : 'Upgrade to GlowBal Plus'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
        </Link>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <SignOutButton
          containerClassName="flex flex-col gap-1"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </SignOutButton>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────────────────────────────────────── */

export function ProfileClient({
  displayName,
  email,
  avatarUrl,
  initials,
  memberSince,
  profile,
  documents,
  activeApplications,
  isMentor,
  plusStatus,
  plusPlan,
}: Props) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page title */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Keep your profile up to date for better recommendations and stronger application plans.
          </p>
        </div>
        {isMentor ? (
          <Link href="/dashboard/mentor" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600">
            Mentor dashboard →
          </Link>
        ) : null}
      </div>

      <UserCard
        displayName={displayName}
        email={email}
        avatarUrl={avatarUrl}
        initials={initials}
        memberSince={memberSince}
        profile={profile}
        plusStatus={plusStatus}
        plusPlan={plusPlan}
      />

      {/* Two-column layout that actually works */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <h2 className="text-base font-bold text-slate-900">Profile sections</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SECTIONS.map((section) => (
              <SectionCard key={section.key} section={section} profile={profile} documents={documents} />
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <ProfileStrength profile={profile} documents={documents} />
          <DocumentsCard documents={documents} />
          <ApplicationsCard activeApplications={activeApplications} />
          <AccountCard email={email} plusStatus={plusStatus} />
        </aside>
      </div>
    </div>
  );
}
