'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { UploadedDocument, StudentProfile } from '@/lib/types';

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

/* ─────────────────────────────────────────────────────────────────────────
   PROFILE SECTIONS DATA
───────────────────────────────────────────────────────────────────────── */

type SectionDef = {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  barColor: string;
  cta: string;
  pct: (p: StudentProfile | null, docs: UploadedDocument[]) => number;
};

const SECTIONS: SectionDef[] = [
  {
    key: 'personal',
    title: 'Personal information',
    description: 'Name, nationality, location and contact details',
    iconBg: 'bg-pink-100',
    barColor: 'bg-green-500',
    cta: 'View details',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    pct: (p) => {
      const done = [!!p?.location, !!p?.nationality, !!p?.bio].filter(Boolean).length;
      return Math.round((done / 3) * 100);
    },
  },
  {
    key: 'academic',
    title: 'Academic background',
    description: 'Your education history, grades and subjects',
    iconBg: 'bg-violet-100',
    barColor: 'bg-[#FF3D9A]',
    cta: 'Complete section',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
    pct: (p) => {
      const done = [!!p?.study_level, !!p?.academic_background, !!p?.grades_summary].filter(Boolean).length;
      return Math.round((done / 3) * 100);
    },
  },
  {
    key: 'preferences',
    title: 'Target preferences',
    description: 'Countries, subjects, budget and preferred cities',
    iconBg: 'bg-blue-100',
    barColor: 'bg-blue-500',
    cta: 'Edit preferences',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
    pct: (p) => {
      const done = [
        (p?.preferred_countries?.length ?? 0) > 0,
        (p?.target_subjects?.length ?? 0) > 0,
        !!p?.budget_range,
      ].filter(Boolean).length;
      return Math.round((done / 3) * 100);
    },
  },
  {
    key: 'achievements',
    title: 'Achievements',
    description: 'Awards, extracurriculars and leadership roles',
    iconBg: 'bg-amber-100',
    barColor: 'bg-amber-400',
    cta: 'Add achievements',
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
    title: 'Work experience',
    description: 'Internships, jobs and volunteering',
    iconBg: 'bg-green-100',
    barColor: 'bg-green-500',
    cta: 'Add experience',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
    pct: () => 20,
  },
  {
    key: 'documents',
    title: 'Documents',
    description: 'Upload important documents and certificates',
    iconBg: 'bg-cyan-100',
    barColor: 'bg-cyan-500',
    cta: 'Upload documents',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    pct: (_, docs) => {
      const pct = Math.min(docs.length * 15, 100);
      return pct;
    },
  },
  {
    key: 'english',
    title: 'English proficiency',
    description: 'IELTS, TOEFL or other language test scores',
    iconBg: 'bg-purple-100',
    barColor: 'bg-purple-500',
    cta: 'Add test score',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8c-1.7 0-3 1.3-3 3s1.3 3 3 3 3 1.3 3 3-1.3 3-3 3" /><path d="M12 6v2M12 16v2" />
      </svg>
    ),
    pct: () => 0,
  },
  {
    key: 'goals',
    title: 'Application goals',
    description: 'What you want to achieve and your dream career',
    iconBg: 'bg-rose-100',
    barColor: 'bg-[#FF3D9A]',
    cta: 'Add goals',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>
    ),
    pct: (p) => (p?.goals ? 50 : 0),
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   PROFILE SIDEBAR NAV
───────────────────────────────────────────────────────────────────────── */

const SIDEBAR_NAV = [
  { label: 'Home', href: '/my-universities', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
  { label: 'Search', href: '/universities', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg> },
  { label: 'Shortlist', href: '/my-universities', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg> },
  { label: 'Applications', href: '/apply', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg> },
  { label: 'Mentors', href: '/mentors', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { label: 'Bookings', href: '/dashboard/bookings', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
  { label: 'Profile', href: '/profile', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
  { label: 'Settings', href: '/profile', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
];

function ProfileSidebar({
  displayName,
  initials,
  avatarUrl,
}: {
  displayName: string;
  initials: string;
  avatarUrl?: string;
}) {
  return (
    <aside className="hidden lg:flex w-52 shrink-0 flex-col gap-1">
      <nav className="space-y-0.5">
        {SIDEBAR_NAV.map((item) => {
          const active = typeof window !== 'undefined'
            ? window.location.pathname === item.href
            : item.label === 'Profile';
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                item.label === 'Profile'
                  ? 'bg-pink-50 text-pink-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Upgrade card */}
      <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-4 text-center">
        <div className="flex justify-center mb-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <p className="text-xs font-bold text-slate-900 mb-1">You&apos;re on Free</p>
        <p className="text-[10px] text-slate-500 leading-relaxed mb-3">Unlock all tools, unlimited applications and mentor sessions.</p>
        <button type="button" className="w-full rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] py-2 text-[11px] font-semibold text-white shadow-[0_4px_12px_rgba(255,77,140,0.25)]">
          Upgrade now
        </button>
      </div>

      {/* Language + user */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className="text-xs text-slate-700">English</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-blue-500 text-white text-xs font-bold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 truncate">{displayName.split(' ')[0]} L.</p>
            <Link href="/profile" className="text-[10px] text-slate-400 hover:text-pink-600">View profile</Link>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><polyline points="9 18 15 12 9 6" /></svg>
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   USER CARD
───────────────────────────────────────────────────────────────────────── */

function UserCard({
  displayName,
  email,
  avatarUrl,
  initials,
  memberSince,
  profile,
}: {
  displayName: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  memberSince: string;
  profile: StudentProfile | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-5">
        {/* Avatar with camera overlay */}
        <div className="relative shrink-0">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-400 to-blue-500 p-0.5">
            <div className="h-full w-full rounded-full overflow-hidden bg-white flex items-center justify-center">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-slate-700">{initials}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-600 text-white shadow-sm transition hover:bg-slate-700"
            aria-label="Upload photo"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>
            <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:text-pink-700 transition">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">{email}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verified
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{profile?.location || 'Location not set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-base">🇬🇧</span>
              <span className="truncate">{profile?.nationality || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="truncate">{memberSince}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              <span className="truncate">{profile?.study_level || 'Undergraduate'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 col-span-2 sm:col-span-4">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Looking for Sep 2027 intake</span>
              <Link href="/profile" className="ml-1 text-xs font-semibold text-pink-600 hover:text-pink-700">View public profile ↗</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SECTION CARDS GRID
───────────────────────────────────────────────────────────────────────── */

function SectionCard({ section, profile, documents }: { section: SectionDef; profile: StudentProfile | null; documents: UploadedDocument[] }) {
  const pct = section.pct(profile, documents);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${section.iconBg}`}>
          {section.icon}
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-xs font-semibold text-slate-900">{section.title}</p>
          <p className={`text-xs font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>
            {pct}% complete
          </p>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${section.barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-xs text-slate-500 leading-relaxed flex-1">{section.description}</p>

      <button
        type="button"
        className="w-full rounded-full border border-slate-200 py-1.5 text-xs font-semibold text-pink-600 transition hover:border-pink-300 hover:bg-pink-50"
      >
        {section.cta}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SUGGESTED NEXT STEPS
───────────────────────────────────────────────────────────────────────── */

function SuggestedNextSteps({ profile, documents }: { profile: StudentProfile | null; documents: UploadedDocument[] }) {
  const steps = [
    {
      icon: '📋',
      iconBg: 'bg-violet-100',
      title: 'Add your achievements',
      description: 'Help universities see your strengths beyond academics.',
    },
    {
      icon: '📄',
      iconBg: 'bg-blue-100',
      title: 'Upload your transcript',
      description: "We'll use it to check eligibility and find better matches.",
    },
    {
      icon: '🎯',
      iconBg: 'bg-pink-100',
      title: 'Set your application goals',
      description: 'Get a personalised plan and smart recommendations.',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">Suggested next steps</h2>
        <p className="mt-0.5 text-xs text-slate-500">Complete these to get the most out of Glowbal.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step) => (
          <button
            key={step.title}
            type="button"
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-left transition hover:bg-pink-50 hover:border-pink-200 group"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${step.iconBg}`}>
              {step.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 leading-snug group-hover:text-pink-700">{step.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{step.description}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 group-hover:text-pink-400">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        ))}
      </div>
      <button type="button" className="mt-4 w-full text-center text-xs font-semibold text-pink-600 hover:text-pink-700">
        View all recommendations ▾
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   RIGHT SIDEBAR
───────────────────────────────────────────────────────────────────────── */

const CHECKLIST_ITEMS = [
  { label: 'Personal information', key: 'personal' },
  { label: 'Academic background', key: 'academic' },
  { label: 'Target preferences', key: 'preferences' },
  { label: 'Achievements', key: 'achievements' },
  { label: 'Work experience', key: 'work' },
  { label: 'Documents', key: 'documents' },
  { label: 'English proficiency', key: 'english' },
  { label: 'Application goals', key: 'goals' },
];

const MOCK_DOCUMENTS = [
  { name: 'Academic transcript', date: 'Uploaded 2 Jun 2026', uploaded: true },
  { name: 'Passport', date: 'Uploaded 1 Jun 2026', uploaded: true },
  { name: 'IELTS Certificate', date: 'Uploaded 1 Jun 2026', uploaded: true },
  { name: 'Personal statement draft', date: 'Not uploaded', uploaded: false },
  { name: 'Curriculum vitae', date: 'Not uploaded', uploaded: false },
];

function ProfileStrengthSidebar({
  profile,
  documents,
  activeApplications,
}: {
  profile: StudentProfile | null;
  documents: UploadedDocument[];
  activeApplications: number;
}) {
  const sectionPcts = SECTIONS.map((s) => s.pct(profile, documents));
  const overall = Math.round(sectionPcts.reduce((a, b) => a + b, 0) / SECTIONS.length);

  const completedSections = SECTIONS.filter((s) => s.pct(profile, documents) >= 80);

  return (
    <div className="space-y-4">
      {/* Profile strength gauge */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold text-slate-900">Profile strength</h3>
            <button type="button" className="text-slate-300 hover:text-slate-500" aria-label="How profile strength works">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <CircularGauge pct={overall} />
          <div>
            <p className="text-sm font-bold text-slate-900">Good progress! 🚀</p>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">Complete the remaining sections to get better course matches and stronger application plans.</p>
          </div>
          <button
            type="button"
            className="w-full rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5"
          >
            Improve profile
          </button>
        </div>

        {/* Checklist */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {CHECKLIST_ITEMS.map((item) => {
            const section = SECTIONS.find((s) => s.key === item.key);
            const done = section ? section.pct(profile, documents) >= 80 : false;
            return (
              <div key={item.key} className="flex items-center gap-2">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${done ? 'bg-green-500 text-white' : 'border-2 border-slate-200'}`}>
                  {done && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span className={`text-xs ${done ? 'text-slate-700' : 'text-slate-400'}`}>{item.label}</span>
              </div>
            );
          })}
          <button type="button" className="mt-2 text-xs font-semibold text-pink-600 hover:text-pink-700">
            How profile strength works →
          </button>
        </div>
      </div>

      {/* Your documents */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Your documents</h3>
          <button type="button" className="text-xs font-semibold text-pink-600 hover:text-pink-700">View all</button>
        </div>
        <div className="space-y-2.5">
          {MOCK_DOCUMENTS.map((doc) => (
            <div key={doc.name} className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 leading-snug">{doc.name}</p>
                <p className="text-[11px] text-slate-400">{doc.date}</p>
              </div>
              {doc.uploaded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-200" />
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload a document
        </button>
      </div>

      {/* Your applications */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-4">
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
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <Link
          href="/apply"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 py-2 text-xs font-semibold text-pink-600 transition hover:bg-pink-100"
        >
          Go to my applications →
        </Link>
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
}: Props) {
  return (
    <div className="flex gap-5">
      {/* Left sidebar */}
      <ProfileSidebar displayName={displayName} initials={initials} avatarUrl={avatarUrl} />

      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-5">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="mt-0.5 text-sm text-slate-500">Tell us about yourself so we can give you better recommendations and build stronger application plans.</p>
        </div>

        {/* User card */}
        <UserCard
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          initials={initials}
          memberSince={memberSince}
          profile={profile}
        />

        {/* Profile sections grid */}
        <div>
          <h2 className="mb-3 text-base font-bold text-slate-900">Profile sections</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTIONS.map((section) => (
              <SectionCard key={section.key} section={section} profile={profile} documents={documents} />
            ))}
          </div>
        </div>

        {/* Suggested next steps */}
        <SuggestedNextSteps profile={profile} documents={documents} />
      </div>

      {/* Right sidebar */}
      <div className="hidden xl:block w-72 shrink-0">
        <ProfileStrengthSidebar
          profile={profile}
          documents={documents}
          activeApplications={activeApplications}
        />
      </div>
    </div>
  );
}
