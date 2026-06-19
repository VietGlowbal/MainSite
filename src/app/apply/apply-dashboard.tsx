'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  CourseApplication,
  ShortlistedUniversity,
  UpcomingDeadline,
  ApplicationOverview,
  SavedScholarshipLite,
} from '@/lib/apply-types';
import { useLanguage } from '@/lib/i18n';
import { StatementFeedbackModal } from '@/components/statement/StatementFeedbackModal';

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────── */

function formatDeadlineDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = d.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  return { month, day };
}

function statusBadge(status: CourseApplication['status'], deadline?: string) {
  if (status === 'submitted') return { label: 'Submitted', color: 'bg-blue-100 text-blue-700' };
  if (status === 'offer_received') return { label: 'Offer received', color: 'bg-green-100 text-green-700' };
  if (status === 'rejected') return { label: 'Rejected', color: 'bg-red-100 text-red-700' };
  if (status === 'interview') return { label: 'Interview', color: 'bg-purple-100 text-purple-700' };

  if (deadline) {
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
    if (daysLeft < 60) return { label: 'Deadline soon', color: 'bg-amber-100 text-amber-700' };
  }
  return { label: 'On track', color: 'bg-green-100 text-green-700' };
}

function methodBadge(method?: string) {
  if (!method) return null;
  const colors: Record<string, string> = {
    UCAS: 'bg-blue-50 text-blue-700 border-blue-200',
    'Direct Apply': 'bg-pink-50 text-pink-700 border-pink-200',
    'Common App': 'bg-violet-50 text-violet-700 border-violet-200',
    'University Portal': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  return colors[method] ?? 'bg-slate-50 text-slate-600 border-slate-200';
}

/* ─────────────────────────────────────────────────────────────────────────
   URL IMPORT BAR
───────────────────────────────────────────────────────────────────────── */

function ImportBar() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please paste a course URL first.');
      return;
    }
    try {
      new URL(url);
      setError('');
      setSuccess('');
      setLoading(true);

      // Call the AI extraction API
      const response = await fetch('/api/applications/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseUrl: url }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.existingApplicationId) {
          setError('You\'ve already imported this course.');
          // Optionally redirect to the existing application
          setTimeout(() => {
            window.location.href = `/apply/${data.existingApplicationId}`;
          }, 2000);
        } else {
          setError(data.error || 'Failed to import course. Please try again.');
        }
        return;
      }

      // Success!
      setSuccess(`✓ ${data.summary.courseName} imported successfully! Found ${data.summary.tasksCreated} tasks and ${data.summary.scholarshipsFound} scholarships.`);
      setUrl('');
      
      // Redirect to the new application after a short delay
      setTimeout(() => {
        window.location.href = `/apply/${data.applicationId}`;
      }, 2000);
    } catch {
      setError('This doesn\'t look like a valid URL. Please paste the official course page link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-50">
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-pink-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
        </div>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); setSuccess(''); }}
          placeholder="Paste a university course page URL (e.g. https://www.example.ac.uk/courses/...)"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-pink-400 focus:bg-white focus:ring-2 focus:ring-pink-100"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 inline-flex h-10 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(255,77,140,0.28)] transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {loading ? 'Analyzing...' : 'Build my checklist'}
        </button>
      </form>
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-xs text-green-600">{success}</p>
        </div>
      )}
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-slate-400" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Use the official course page from the university website. We&apos;ll create a personalised application plan for you.
        <button type="button" className="ml-1 shrink-0 font-semibold text-pink-600 hover:text-pink-700 transition">
          How it works
        </button>
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   APPLICATION CARD
───────────────────────────────────────────────────────────────────────── */

function ApplicationCard({
  app,
  score,
  scholarships,
  highlighted,
  isPlus,
  t,
}: {
  app: CourseApplication;
  score: number;
  scholarships: SavedScholarshipLite[];
  highlighted: boolean;
  isPlus: boolean;
  t: (en: string, vars?: Record<string, string | number>) => string;
}) {
  const badge = statusBadge(app.status, app.deadline);
  const methodClass = methodBadge(app.applicationMethod);

  const deadlineDisplay = app.deadline
    ? new Date(app.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  // Plus subscribers go straight to the workspace; everyone else hits the
  // payment page first (carrying this application so we can return to it).
  const href = isPlus ? `/apply/${app.id}` : `/plus?application=${app.id}`;

  return (
    <div className={highlighted ? 'rounded-2xl ring-2 ring-pink-400 ring-offset-2' : ''}>
    <Link
      href={href}
      className="group flex items-stretch gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5"
    >
      {/* University image */}
      <div className="relative hidden w-[140px] shrink-0 overflow-hidden sm:block">
        {app.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={app.imageUrl}
            alt={app.universityName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-pink-100 to-blue-100">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <ScoreRing value={score} label={t('Achievability')} />
          <div className="min-w-0 flex-1">
            {highlighted && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                ✓ {t('Just saved')}
              </span>
            )}
            <h3 className="text-base font-semibold text-slate-900 leading-snug">{app.courseName}</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {app.countryFlag} {app.universityName}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {app.degreeLevel && (
                <span className="inline-flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  {app.degreeLevel}
                </span>
              )}
              {app.studyMode && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {app.studyMode}
                  </span>
                </>
              )}
              {app.intake && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {app.intake}
                  </span>
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {app.applicationMethod && (
                <span className={`inline-flex h-5 items-center rounded border px-2 text-[10px] font-semibold ${methodClass}`}>
                  {app.applicationMethod}
                </span>
              )}
              {app.applicationCode && (
                <span className="inline-flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-600">
                  {app.applicationMethod === 'UCAS' ? 'UCAS code: ' : 'Code: '}{app.applicationCode}
                </span>
              )}
            </div>
          </div>

          {/* Deadline + status + progress */}
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Deadline</p>
            {deadlineDisplay && (
              <p className="mt-0.5 text-base font-bold text-[#FF3D9A] leading-tight">{deadlineDisplay}</p>
            )}
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.color}`}>
              {badge.label}
            </span>

            <div className="mt-3">
              <div className="flex items-center justify-end gap-2 mb-1">
                <p className="text-xs text-slate-500">Progress</p>
                <p className="text-xs font-semibold text-slate-700">{app.progressPercentage}%</p>
              </div>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#FF3D9A,#FF85B3)] transition-all"
                  style={{ width: `${app.progressPercentage}%` }}
                />
              </div>
            </div>

            {app.nextAction && (
              <p className="mt-2 text-right text-xs text-pink-600 font-medium">
                Next up: {app.nextAction}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chevron */}
      <div className="flex items-center pr-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 transition group-hover:text-pink-400 group-hover:translate-x-0.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>

      {/* Saved scholarships nested under this application */}
      {scholarships.length > 0 && (
        <div className="mt-2 space-y-2 pl-4 sm:pl-8">
          {scholarships.map((sc) => (
            <ScholarshipNestedRow key={sc.id} sc={sc} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SCORE RING + NESTED SCHOLARSHIP ROW
───────────────────────────────────────────────────────────────────────── */

function ScoreRing({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex shrink-0 flex-col items-center">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="#FCE7F3" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="#FF3D9A"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 24 24)"
        />
        <text x="24" y="25" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 text-[11px] font-bold">
          {pct}%
        </text>
      </svg>
      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}

function ScholarshipNestedRow({
  sc,
  t,
}: {
  sc: SavedScholarshipLite;
  t: (en: string, vars?: Record<string, string | number>) => string;
}) {
  const inner = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-100 text-sm">🎓</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-700">{sc.name}</p>
        {sc.amountLabel && <p className="truncate text-[11px] text-slate-500">{sc.amountLabel}</p>}
      </div>
      {sc.deadlineLabel && <span className="shrink-0 text-[10px] text-slate-400">{sc.deadlineLabel}</span>}
    </>
  );
  const className =
    'flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5 transition hover:border-pink-200 hover:bg-white';
  return sc.sourceUrl ? (
    <a href={sc.sourceUrl} target="_blank" rel="noopener noreferrer" className={className} title={t('Open scholarship')}>
      {inner}
    </a>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SHORTLISTED UNIVERSITY ROW
───────────────────────────────────────────────────────────────────────── */

function ShortlistedRow({
  uni,
  scholarships,
  t,
}: {
  uni: ShortlistedUniversity;
  scholarships: SavedScholarshipLite[];
  t: (en: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div>
    <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:bg-white hover:border-slate-200">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm text-lg">
        {uni.countryFlag ?? '🏫'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 leading-snug">{uni.universityName}</p>
        <p className="text-xs text-slate-500 mt-0.5">{uni.countryFlag} {uni.country}</p>
      </div>
      <div className="flex items-center gap-2">
        {uni.courseSearchUrl ? (
          <a
            href={uni.courseSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-pink-300 bg-white px-3 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
            onClick={(e) => e.stopPropagation()}
          >
            Find a course
          </a>
        ) : (
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-pink-300 bg-white px-3 text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
          >
            Find a course
          </button>
        )}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="More options"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>

      {scholarships.length > 0 && (
        <div className="mt-2 space-y-2 pl-4 sm:pl-8">
          {scholarships.map((sc) => (
            <ScholarshipNestedRow key={sc.id} sc={sc} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   RIGHT SIDEBAR — APPLICATION OVERVIEW
───────────────────────────────────────────────────────────────────────── */

function OverviewCard({ overview }: { overview: ApplicationOverview }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Application overview</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 leading-none">Active applications</p>
            <p className="mt-0.5 text-xl font-bold text-slate-900">{overview.activeApplications}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 leading-none">Submitted</p>
            <p className="mt-0.5 text-xl font-bold text-slate-900">{overview.submitted}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 leading-none">Offers received</p>
            <p className="mt-0.5 text-xl font-bold text-slate-900">{overview.offersReceived}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 leading-none">Tasks completed</p>
            <p className="mt-0.5 text-base font-bold text-slate-900">{overview.tasksCompleted}/{overview.totalTasks}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeadlinesCard({ deadlines }: { deadlines: UpcomingDeadline[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Upcoming deadlines
        </h3>
        <button type="button" className="text-xs font-semibold text-pink-600 hover:text-pink-700">View all</button>
      </div>
      <div className="mt-4 space-y-3">
        {deadlines.map((d) => {
          const { month, day } = formatDeadlineDate(d.date);
          const urgent = d.daysLeft <= 14;
          return (
            <Link
              key={`${d.applicationId}-${d.label}`}
              href={`/apply/${d.applicationId}`}
              className="flex items-center gap-3 group"
            >
              <div className="flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{month}</p>
                <p className="text-base font-bold text-slate-900 leading-none">{day}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 leading-snug">{d.label}</p>
                <p className="text-[11px] text-slate-500 truncate">{d.universityName}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgent ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                {d.daysLeft}d left
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MentorCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Need help?</h3>
      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
        Get expert guidance from current students and admissions mentors.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex -space-x-2">
          {['#FF3D9A', '#3B82F6', '#10B981', '#F59E0B'].map((c, i) => (
            <div
              key={i}
              className="h-7 w-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-[10px] font-bold"
              style={{ background: c }}
            >
              {['J', 'S', 'A', 'M'][i]}
            </div>
          ))}
        </div>
        <span className="text-xs text-slate-500">+245</span>
      </div>
      <Link
        href="/mentors"
        className="mt-4 flex h-9 w-full items-center justify-center rounded-full border border-pink-300 bg-white text-xs font-semibold text-pink-600 transition hover:bg-pink-50"
      >
        Find a mentor
      </Link>
    </div>
  );
}

function ImproveCard({ onOpenSop, sopEnabled }: { onOpenSop: () => void; sopEnabled: boolean }) {
  const tools = [
    {
      label: 'SOP Maximiser',
      desc: 'Improve your statement',
      icon: '📝',
      onClick: sopEnabled ? onOpenSop : undefined,
      disabled: !sopEnabled,
    },
    { label: 'Interview Prep', desc: 'Practice & get ready', icon: '🎤' },
    { label: 'Profile Review', desc: 'Get expert feedback', icon: '👤' },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 mb-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-900">Improve your application</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">Tools and feedback to strengthen your profile.</p>
      <div className="grid grid-cols-3 gap-2">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.onClick}
            disabled={t.disabled}
            title={t.disabled ? 'Add an application first' : undefined}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-center transition hover:bg-pink-50 hover:border-pink-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:border-slate-100"
          >
            <span className="text-xl">{t.icon}</span>
            <span className="text-[10px] font-semibold text-slate-700 leading-tight">{t.label}</span>
            <span className="text-[10px] text-slate-400 leading-tight">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TRIAL BANNER
───────────────────────────────────────────────────────────────────────── */

function TrialBanner() {
  return (
    <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <p className="text-sm font-bold text-slate-900">7-day full access</p>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed mb-3">
        You&apos;re on a free trial. Unlock all tools and mentor support.
      </p>
      <Link
        href="/plus"
        className="w-full inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-xs font-semibold text-white shadow-[0_4px_12px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5"
      >
        Upgrade Now
      </Link>
      <p className="mt-2 text-center text-[10px] text-slate-400">Trial ends in 6 days</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────────────────────── */

function EmptyApplications() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-50 mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF3D9A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Start your first application plan</h3>
      <p className="mt-1 max-w-xs text-xs text-slate-500 leading-relaxed">
        Paste the official course page URL from a university website and Glowbal will build your personalised checklist.
      </p>
      <button type="button" className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(255,77,140,0.25)]">
        Paste course URL
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────────────────── */

type Props = {
  applications: CourseApplication[];
  shortlisted: ShortlistedUniversity[];
  upcomingDeadlines: UpcomingDeadline[];
  overview: ApplicationOverview;
  savedScholarshipsByUniversity: Record<number, SavedScholarshipLite[]>;
  matchByApplicationId: Record<string, number>;
  focusUniversityId: number | null;
  isPlus: boolean;
};

export function ApplyDashboard({
  applications,
  shortlisted,
  upcomingDeadlines,
  overview,
  savedScholarshipsByUniversity,
  matchByApplicationId,
  focusUniversityId,
  isPlus,
}: Props) {
  const { t } = useLanguage();
  const scholarshipsFor = (universityId: number | null | undefined) =>
    universityId != null ? savedScholarshipsByUniversity[universityId] ?? [] : [];
  const activeApps = applications.filter((a) =>
    !['submitted', 'offer_received', 'accepted', 'rejected', 'withdrawn'].includes(a.status)
  );
  const completedApps = applications.filter((a) =>
    ['submitted', 'offer_received', 'accepted', 'rejected', 'withdrawn'].includes(a.status)
  );

  // SOP feedback tool targets the soonest-deadline active application.
  const sopTarget =
    [...activeApps].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    })[0] ?? applications[0];
  const [sopOpen, setSopOpen] = useState(false);

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
          <p className="mt-1 text-sm text-slate-500">Track and manage all your university course applications in one place.</p>
        </div>

        {/* URL import bar */}
        <ImportBar />

        {/* Active applications */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Active Applications{' '}
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-pink-100 text-[10px] font-bold text-pink-600">
                {activeApps.length}
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              Sort by:
              <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-pink-200">
                <option>Deadline (soonest)</option>
                <option>Progress (highest)</option>
                <option>Recently added</option>
              </select>
            </div>
          </div>

          {activeApps.length > 0 ? (
            <div className="space-y-3">
              {activeApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  score={matchByApplicationId[app.id] ?? app.progressPercentage}
                  scholarships={scholarshipsFor(app.universityId)}
                  highlighted={focusUniversityId != null && app.universityId === focusUniversityId}
                  isPlus={isPlus}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <EmptyApplications />
          )}
        </section>

        {/* Shortlisted universities */}
        {shortlisted.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Shortlisted Universities{' '}
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                {shortlisted.length}
              </span>
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="divide-y divide-slate-100 p-3">
                {shortlisted.map((uni) => (
                  <div key={uni.id} className="py-1 first:pt-0 last:pb-0">
                    <ShortlistedRow uni={uni} scholarships={scholarshipsFor(Number(uni.id))} t={t} />
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-center">
                <Link href="/universities" className="text-xs font-semibold text-pink-600 hover:text-pink-700">
                  View all shortlisted universities →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Completed applications (collapsed by default when empty) */}
        {completedApps.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Submitted / Completed</h2>
            <div className="space-y-3">
              {completedApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  score={matchByApplicationId[app.id] ?? app.progressPercentage}
                  scholarships={scholarshipsFor(app.universityId)}
                  highlighted={false}
                  isPlus={isPlus}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Right sidebar */}
      <div className="hidden xl:block w-72 shrink-0 space-y-4">
        <OverviewCard overview={overview} />
        <DeadlinesCard deadlines={upcomingDeadlines} />
        <MentorCard />
        <ImproveCard onOpenSop={() => setSopOpen(true)} sopEnabled={Boolean(sopTarget)} />
        <TrialBanner />
      </div>

      {sopOpen && sopTarget && (
        <StatementFeedbackModal
          applicationId={sopTarget.id}
          targetName={`${sopTarget.courseName} · ${sopTarget.universityName}`}
          contextNote={sopTarget.aiSummary}
          onClose={() => setSopOpen(false)}
        />
      )}
    </div>
  );
}
