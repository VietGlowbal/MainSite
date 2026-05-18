'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AchieverWithUniversity, AchieverAvailability, ReviewWithReviewer } from '@/types/achievers';
import { BookingModal } from './BookingModal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= Math.round(Number(rating)) ? '#facc15' : 'none'}
          stroke={star <= Math.round(Number(rating)) ? '#facc15' : '#cbd5e1'}
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

type Props = {
  achiever: AchieverWithUniversity;
  availability: AchieverAvailability[];
  reviews: ReviewWithReviewer[];
  reviewCount: number;
  relatedAchievers: AchieverWithUniversity[];
};

export function AchieverProfileClient({
  achiever,
  availability,
  reviews,
  reviewCount,
  relatedAchievers,
}: Props) {
  const [showBooking, setShowBooking] = useState(false);

  const initials = achiever.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Group availability by day
  const slotsByDay = DAYS.map((day, i) => ({
    day,
    slots: availability.filter((s) => s.day_of_week === i),
  })).filter((d) => d.slots.length > 0);

  return (
    <>
      <div className="space-y-8">
        {/* Hero section */}
        <section className="glow-card">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar */}
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)',
                padding: 3,
              }}
            >
              {achiever.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={achiever.avatar_url}
                  alt={achiever.display_name}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#ff4d8c',
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{achiever.display_name}</h1>
                <p className="text-slate-500">
                  {achiever.university?.name ?? 'University'}
                  {achiever.university?.country ? ` · ${achiever.university.country}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  {achiever.degree_level.charAt(0).toUpperCase() + achiever.degree_level.slice(1)}
                </span>
                {achiever.currently_enrolled && (
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Currently enrolled
                  </span>
                )}
                <span className="text-sm text-slate-500">{achiever.subject}</span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <StarRating rating={Number(achiever.avg_rating)} />
                  <span className="text-slate-500">({reviewCount})</span>
                </div>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">{achiever.total_sessions} sessions</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  {achiever.languages.join(', ')}
                </span>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <span className="text-lg font-semibold text-slate-900">
                  {formatVND(achiever.session_price_vnd)}
                </span>
                <span className="text-sm text-slate-400">/ {achiever.session_duration_mins} min</span>
                <button
                  type="button"
                  onClick={() => setShowBooking(true)}
                  className="glow-button-primary text-sm px-5 py-2.5 ml-auto"
                >
                  Book a session
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        {achiever.bio && (
          <section className="glow-card space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">About</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{achiever.bio}</p>
            {achiever.help_topics.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {achiever.help_topics.map((topic) => (
                  <span
                    key={topic}
                    className="glow-chip text-xs px-3 py-1 glow-chip-static"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Availability */}
        <section className="glow-card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Availability</h2>
            <p className="text-xs text-slate-400">All times in Vietnam time (UTC+7)</p>
          </div>
          {slotsByDay.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slotsByDay.map(({ day, slots }) => (
                <div key={day} className="glow-muted-card">
                  <p className="text-xs font-semibold text-slate-700 mb-2">{day}</p>
                  <div className="space-y-1">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setShowBooking(true)}
                        className="w-full text-left text-sm text-slate-600 hover:text-sky-600 transition px-2 py-1 rounded-lg hover:bg-sky-50"
                      >
                        {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No availability set yet.</p>
          )}
        </section>

        {/* Reviews */}
        <section className="glow-card space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Reviews {reviewCount > 0 && <span className="text-slate-400 font-normal">({reviewCount})</span>}
          </h2>
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-black/5 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={review.rating} size={14} />
                    <span className="text-xs text-slate-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-slate-600">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No reviews yet.</p>
          )}
        </section>

        {/* Related achievers */}
        {relatedAchievers.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Other Achievers at {achiever.university?.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedAchievers.map((related) => (
                <Link
                  key={related.id}
                  href={`/achievers/${related.id}`}
                  className="glow-card-tight hover:shadow-lg transition space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)',
                        padding: 2,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          background: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#ff4d8c',
                        }}
                      >
                        {related.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{related.display_name}</p>
                      <p className="text-xs text-slate-400">{related.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <StarRating rating={Number(related.avg_rating)} size={12} />
                    <span>{formatVND(related.session_price_vnd)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky CTA (mobile) */}
      <div className="fixed bottom-20 left-0 right-0 p-4 sm:hidden z-30">
        <button
          type="button"
          onClick={() => setShowBooking(true)}
          className="glow-button-primary w-full py-3 text-sm"
        >
          Book a session · {formatVND(achiever.session_price_vnd)}
        </button>
      </div>

      {/* Booking modal */}
      {showBooking && (
        <BookingModal
          achiever={achiever}
          availability={availability}
          onClose={() => setShowBooking(false)}
        />
      )}
    </>
  );
}
