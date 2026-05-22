'use client';

import Link from 'next/link';
import type { MentorWithUniversity } from '@/types/mentorship';
import { formatMoney } from '@/lib/currency';
import { MentorAvatar, StarRating } from './mentor-icons';

/**
 * MentorCard — the grid item in the mentor browser.
 *
 * Required by the spec:
 *   ✓ Mentor name
 *   ✓ Image (round)
 *   ✓ Star rating
 *   ✓ University name
 * Plus the fields that make the card actually useful:
 *   ✓ Degree level + subject
 *   ✓ Hourly rate (in mentor's currency)
 *   ✓ Status badges (currently enrolled, top rated)
 */
export function MentorCard({ mentor }: { mentor: MentorWithUniversity }) {
  const studyWindow = mentor.study_start_year && mentor.graduation_year
    ? `${mentor.study_start_year} → ${mentor.graduation_year}`
    : mentor.graduation_year
    ? `Class of ${mentor.graduation_year}`
    : null;

  const rate = Number(mentor.hourly_rate_amount ?? 0);
  const rateLabel = rate > 0
    ? `${formatMoney(rate, mentor.hourly_rate_currency)}/hr`
    : 'Pricing pending';

  const isTopRated = Number(mentor.avg_rating) >= 4.5 && mentor.total_sessions >= 3;

  return (
    <Link
      href={`/mentors/${mentor.id}`}
      className="group relative block rounded-3xl border border-black/5 bg-white/95 p-5 shadow-[0_12px_32px_rgba(22,33,62,0.06)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(22,33,62,0.12)]"
    >
      {/* Glow accent on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 0%, rgba(255,77,140,0.10), transparent 60%)',
        }}
      />

      <div className="relative">
        {/* Top: avatar + meta */}
        <div className="flex items-start gap-3">
          <MentorAvatar name={mentor.display_name} src={mentor.avatar_url} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-base font-semibold text-slate-900">
                {mentor.display_name}
              </p>
              {isTopRated && (
                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-amber-700">
                  Top rated
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">
              {mentor.university?.name ?? 'University'}
            </p>
            {mentor.university?.country && (
              <p className="truncate text-[0.7rem] text-slate-400">
                {mentor.university.country}
              </p>
            )}
          </div>
        </div>

        {/* Subject + degree */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wider text-sky-700">
            {mentor.degree_level}
          </span>
          {mentor.currently_enrolled && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[0.7rem] font-semibold text-emerald-700">
              Currently studying
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-1 text-sm font-medium text-slate-700">{mentor.subject}</p>
        {studyWindow && (
          <p className="mt-0.5 text-xs text-slate-400">{studyWindow}</p>
        )}

        {/* Rating row */}
        <div className="mt-3 flex items-center gap-2 text-sm">
          <StarRating rating={Number(mentor.avg_rating)} size={14} />
          {mentor.total_sessions > 0 ? (
            <span className="text-xs text-slate-500">
              {Number(mentor.avg_rating).toFixed(1)} · {mentor.total_sessions} session
              {mentor.total_sessions === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="text-xs text-slate-400">New mentor</span>
          )}
        </div>

        {/* Strengths preview */}
        {mentor.strengths && mentor.strengths.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {mentor.strengths.slice(0, 3).map((s) => (
              <span
                key={s}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.7rem] text-slate-600"
              >
                {s}
              </span>
            ))}
            {mentor.strengths.length > 3 && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.7rem] text-slate-400">
                +{mentor.strengths.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: rate + CTA */}
        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
          <div>
            <p className="text-base font-semibold text-slate-900">{rateLabel}</p>
            <p className="text-[0.65rem] uppercase tracking-wider text-slate-400">
              + 10% service fee
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_18px_rgba(255,77,140,0.25)]">
            Book a session
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
