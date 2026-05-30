'use client';

import Link from 'next/link';
import type { MentorWithUniversity } from '@/types/mentorship';
import { formatMoney } from '@/lib/currency';
import { MentorAvatar, StarRating } from './mentor-icons';

/**
 * MentorCard — the grid item in the mentor browser.
 * Redesigned to match the Glowbal design system with enhanced visual hierarchy.
 */
export function MentorCard({ mentor }: { mentor: MentorWithUniversity }) {
  const studyWindow = mentor.study_start_year && mentor.graduation_year
    ? `${mentor.study_start_year} - ${mentor.graduation_year}`
    : mentor.graduation_year
    ? `Class of ${mentor.graduation_year}`
    : null;

  const rate = Number(mentor.hourly_rate_amount ?? 0);
  const rateLabel = rate > 0
    ? formatMoney(rate, mentor.hourly_rate_currency)
    : 'Free';

  const isTopRated = Number(mentor.avg_rating) >= 4.8 && mentor.total_sessions >= 5;
  const hasReviews = mentor.total_sessions > 0;

  return (
    <Link
      href={`/mentors/${mentor.id}`}
      className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-100/50"
    >
      {/* Top badge */}
      {isTopRated && (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 shadow-lg">
          <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-xs font-bold text-white">Top match</span>
        </div>
      )}

      {/* Card content */}
      <div className="p-5">
        {/* Avatar + Name + University */}
        <div className="flex items-start gap-4">
          <div className="relative">
            <MentorAvatar name={mentor.display_name} src={mentor.avatar_url} size={64} />
            {mentor.currently_enrolled && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-pink-600 transition">
              {mentor.display_name}
            </h3>
            <p className="mt-0.5 text-sm font-medium text-slate-600">
              {mentor.university?.name ?? 'University'}
            </p>
            {mentor.university?.country && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {mentor.university.country}
              </p>
            )}
          </div>
        </div>

        {/* Degree + Subject */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
              {mentor.degree_level}
            </span>
            {mentor.currently_enrolled && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Current student
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm font-semibold text-slate-700">{mentor.subject}</p>
          {studyWindow && (
            <p className="text-xs text-slate-500">{studyWindow}</p>
          )}
        </div>

        {/* Rating */}
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
          <StarRating rating={Number(mentor.avg_rating)} size={16} />
          {hasReviews ? (
            <span className="text-sm font-semibold text-slate-700">
              {Number(mentor.avg_rating).toFixed(1)}
              <span className="ml-1 font-normal text-slate-500">
                ({mentor.total_sessions})
              </span>
            </span>
          ) : (
            <span className="text-sm text-slate-500">New mentor</span>
          )}
        </div>

        {/* Help topics preview */}
        {mentor.help_topics && mentor.help_topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mentor.help_topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
              >
                {topic}
              </span>
            ))}
            {mentor.help_topics.length > 3 && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                +{mentor.help_topics.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer: Price + CTA */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="text-xl font-bold text-slate-900">{rateLabel}<span className="text-sm font-normal text-slate-500">/hr</span></p>
            <p className="text-xs text-slate-500">Response time: Within a few hours</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl hover:scale-105">
            View profile
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </Link>
  );
}
