/**
 * Progress Sidebar Component
 * Shows progress, deadline, tips, mentors, and official links
 */

import Link from 'next/link';
import type { ApplicationSource, ApplicationRecommendation } from '@/lib/apply-types';

type Props = {
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  deadline?: {
    date: string;
    daysLeft: number;
    label: string;
  };
  recommendation?: ApplicationRecommendation;
  sources: ApplicationSource[];
};

export function ProgressSidebar({ 
  progress, 
  tasksCompleted, 
  tasksTotal, 
  deadline,
  recommendation,
  sources 
}: Props) {
  // Get top 4 sources
  const topSources = sources.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Application Progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Application progress</h3>
        
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500">Overall progress</span>
          <span className="text-sm font-bold text-slate-900">{progress}%</span>
        </div>
        
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 mb-4">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#FF3D9A,#FF85B3)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              Completed
            </span>
            <span className="font-semibold text-slate-900">{tasksCompleted}/{tasksTotal}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              In progress
            </span>
            <span className="font-semibold text-slate-900">1</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 rounded-full bg-slate-300"></span>
              Not started
            </span>
            <span className="font-semibold text-slate-900">{tasksTotal - tasksCompleted - 1}</span>
          </div>
        </div>
      </div>

      {/* Upcoming Deadline */}
      {deadline && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Upcoming deadline</h3>
          
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                {new Date(deadline.date).toLocaleDateString('en-GB', { month: 'short' })}
              </span>
              <span className="text-base font-bold text-slate-900 leading-none">
                {new Date(deadline.date).getDate()}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-900">UCAS application deadline</p>
              <p className="text-xs text-red-600 font-medium mt-0.5">{deadline.label}</p>
            </div>
          </div>

          {deadline.daysLeft <= 30 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Tip: UCAS recommends applying at least 3 months early.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Need help?</h3>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            {recommendation.body || 'Get expert guidance from current students and admissions mentors.'}
          </p>
          
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-2">
              {['#FF3D9A', '#3B82F6', '#10B981', '#F59E0B'].map((color, i) => (
                <div
                  key={i}
                  className="h-7 w-7 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: color }}
                >
                  {['J', 'S', 'A', 'M'][i]}
                </div>
              ))}
            </div>
            <span className="text-xs text-slate-500">+12</span>
          </div>

          <p className="text-xs text-slate-600 mb-3">
            Chat with a University of Manchester mentor who can guide you through this step.
          </p>

          <Link
            href="/mentors"
            className="flex h-9 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-xs font-semibold text-white shadow-[0_4px_12px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5"
          >
            Ask a mentor
          </Link>
        </div>
      )}

      {/* Official Links */}
      {topSources.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Official links</h3>
          
          <div className="space-y-2">
            {topSources.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs font-medium text-slate-700 transition hover:bg-white hover:border-slate-200"
              >
                <span>{source.title}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            ))}
          </div>

          {sources.length > 4 && (
            <button
              type="button"
              className="mt-3 w-full text-center text-xs font-semibold text-pink-600 hover:text-pink-700 transition"
            >
              View all sources →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
