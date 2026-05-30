'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  MentorWithUniversity,
  MentorAvailabilitySlot,
  MentorReviewWithReviewer,
} from '@/types/mentorship';
import { formatMoney } from '@/lib/currency';
import { MentorAvatar, StarRating, GraduationCapIcon, ClockIcon } from './mentor-icons';
import { MentorAvailabilityGrid } from './MentorAvailabilityGrid';
import { BookMentorModal } from './BookMentorModal';
import { MentorCard } from './MentorCard';

type Props = {
  mentor: MentorWithUniversity;
  slots: MentorAvailabilitySlot[];
  reviews: MentorReviewWithReviewer[];
  reviewCount: number;
  related: MentorWithUniversity[];
  isSignedIn: boolean;
};

export function MentorProfile({ mentor, slots, reviews, reviewCount, related, isSignedIn }: Props) {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<MentorAvailabilitySlot | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const studyWindow = mentor.study_start_year && mentor.graduation_year
    ? `${mentor.study_start_year} – ${mentor.graduation_year}`
    : mentor.study_start_year
    ? `Started ${mentor.study_start_year}`
    : mentor.graduation_year
    ? `Class of ${mentor.graduation_year}`
    : null;

  const rate = Number(mentor.hourly_rate_amount ?? 0);
  const rateLabel = rate > 0
    ? `${formatMoney(rate, mentor.hourly_rate_currency)}/hr`
    : 'Pricing pending';

  function startBooking() {
    if (!selectedSlot) return;
    if (!isSignedIn) {
      router.push(`/auth?redirect=/mentors/${mentor.id}`);
      return;
    }
    setBookingOpen(true);
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-white/95 p-6 shadow-[0_12px_32px_rgba(22,33,62,0.06)] md:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,77,140,0.18), transparent 60%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.16), transparent 60%)' }}
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <MentorAvatar name={mentor.display_name} src={mentor.avatar_url} size={128} />

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                {mentor.display_name}
              </h1>
              <p className="text-slate-500">
                {mentor.university?.name ?? 'University'}
                {mentor.university?.country ? ` · ${mentor.university.country}` : ''}
              </p>
              {studyWindow && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <GraduationCapIcon size={14} />
                  {studyWindow} · {mentor.degree_level} · {mentor.subject}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <StarRating rating={Number(mentor.avg_rating)} size={16} />
                <span className="text-slate-500">
                  {Number(mentor.avg_rating).toFixed(1)} / 5{' '}
                  {reviewCount > 0 ? <span className="text-slate-400">({reviewCount} review{reviewCount === 1 ? '' : 's'})</span> : <span className="text-slate-400">· no reviews yet</span>}
                </span>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{mentor.total_sessions} session{mentor.total_sessions === 1 ? '' : 's'} delivered</span>
              {mentor.languages.length > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">{mentor.languages.join(', ')}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="text-lg font-semibold text-slate-900">{rateLabel}</p>
              <p className="text-xs text-slate-400">+ 10% Glowbal service fee</p>
              <a
                href="#availability"
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5"
              >
                See open times <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout: bio + sticky booking panel */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Bio */}
          {mentor.bio && (
            <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_12px_32px_rgba(22,33,62,0.04)]">
              <h2 className="text-lg font-semibold text-slate-900">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {mentor.bio}
              </p>
            </section>
          )}

          {/* Strengths */}
          {mentor.strengths.length > 0 && (
            <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_12px_32px_rgba(22,33,62,0.04)]">
              <h2 className="text-lg font-semibold text-slate-900">Strengths</h2>
              <p className="mt-1 text-xs text-slate-500">
                Areas this mentor is especially good at helping with.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {mentor.strengths.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Help topics */}
          {mentor.help_topics.length > 0 && (
            <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_12px_32px_rgba(22,33,62,0.04)]">
              <h2 className="text-lg font-semibold text-slate-900">Best for</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {mentor.help_topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Availability calendar */}
          <section
            id="availability"
            className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_12px_32px_rgba(22,33,62,0.04)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Availability</h2>
                <p className="text-xs text-slate-500">
                  Pick any open date below. Sessions are 60 minutes by default.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <ClockIcon size={12} />
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
            <div className="mt-4">
              <MentorAvailabilityGrid
                slots={slots}
                selectedSlotId={selectedSlot?.id ?? null}
                onSelectSlot={setSelectedSlot}
              />
            </div>
          </section>

          {/* Reviews */}
          <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-[0_12px_32px_rgba(22,33,62,0.04)]">
            <h2 className="text-lg font-semibold text-slate-900">
              Reviews{' '}
              {reviewCount > 0 && (
                <span className="text-slate-400 font-normal">({reviewCount})</span>
              )}
            </h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No reviews yet — be the first to book and leave one.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-2">
                      <StarRating rating={r.rating} size={14} />
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1.5 text-sm text-slate-600">{r.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sticky booking panel */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-[0_12px_32px_rgba(22,33,62,0.06)]">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-pink-600">
              Book this mentor
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{rateLabel}</p>
            <p className="text-xs text-slate-500">+ 10% service fee · billed securely via Stripe</p>

            <div className="my-4 h-px bg-slate-100" />

            {selectedSlot ? (
              <div className="space-y-2 rounded-2xl bg-emerald-50/60 p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700">
                  Selected slot
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {new Date(selectedSlot.starts_at).toLocaleDateString(undefined, {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </p>
                <p className="text-xs text-slate-600">
                  {new Date(selectedSlot.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{' – '}
                  {new Date(selectedSlot.ends_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                Pick a slot from the calendar to continue.
              </p>
            )}

            <button
              type="button"
              onClick={startBooking}
              disabled={!selectedSlot}
              className="mt-4 w-full rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedSlot ? `Continue · ${rateLabel}` : 'Select a slot'}
            </button>
            {!isSignedIn && (
              <p className="mt-2 text-center text-[0.7rem] text-slate-500">
                You&rsquo;ll be asked to sign in or create an account before paying.
              </p>
            )}
          </div>

          {/* Trust signals */}
          <div className="mt-4 space-y-2 rounded-3xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Why book through Glowbal?</p>
            <ul className="space-y-1.5">
              <li>✓ Verified student & alumni mentors</li>
              <li>✓ Secure card payments via Stripe</li>
              <li>✓ Auto-generated meeting link &amp; calendar invite</li>
              <li>✓ Full refund if your mentor no-shows</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Related mentors */}
      {related.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              More mentors at {mentor.university?.name}
            </h2>
            <Link
              href={`/mentors?university=${mentor.university_id}`}
              className="text-xs font-semibold text-pink-600 hover:underline"
            >
              See all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((m) => (
              <MentorCard key={m.id} mentor={m} />
            ))}
          </div>
        </section>
      )}

      {/* Booking modal */}
      {bookingOpen && selectedSlot && (
        <BookMentorModal
          mentor={mentor}
          slot={selectedSlot}
          onClose={() => setBookingOpen(false)}
        />
      )}
    </div>
  );
}
