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
      {/* Back button */}
      <Link
        href="/mentors"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-pink-600"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to mentors
      </Link>

      {/* Hero Profile Card */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-pink-50/20 to-purple-50/10 p-8 shadow-lg md:p-10">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,77,140,0.3), transparent 70%)' }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -left-24 -bottom-24 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25), transparent 70%)' }}
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-start">
          <div className="relative">
            <MentorAvatar name={mentor.display_name} src={mentor.avatar_url} size={160} />
            {mentor.currently_enrolled && (
              <span className="absolute -bottom-2 -right-2 flex items-center gap-1.5 rounded-full border-4 border-white bg-emerald-500 px-3 py-1.5 shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white"></span>
                <span className="text-xs font-bold text-white">Active</span>
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                    {mentor.display_name}
                  </h1>
                  <p className="mt-2 flex items-center gap-2 text-lg text-slate-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {mentor.university?.name ?? 'University'}
                  </p>
                  {mentor.university?.country && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {mentor.university.country}
                    </p>
                  )}
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-pink-300 hover:bg-pink-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>

              {studyWindow && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-700">
                    <GraduationCapIcon size={16} />
                    {mentor.degree_level}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-semibold text-purple-700">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    {mentor.subject}
                  </span>
                  <span className="text-sm text-slate-500">{studyWindow}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <StarRating rating={Number(mentor.avg_rating)} size={18} />
                <span className="font-semibold text-slate-700">
                  {Number(mentor.avg_rating).toFixed(1)}
                </span>
                {reviewCount > 0 && (
                  <span className="text-slate-500">
                    ({reviewCount} review{reviewCount === 1 ? '' : 's'})
                  </span>
                )}
              </div>
              <span className="h-4 w-px bg-slate-300"></span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <ClockIcon size={16} />
                {mentor.total_sessions} session{mentor.total_sessions === 1 ? '' : 's'}
              </span>
              {mentor.languages.length > 0 && (
                <>
                  <span className="h-4 w-px bg-slate-300"></span>
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    {mentor.languages.slice(0, 2).join(', ')}
                    {mentor.languages.length > 2 && ` +${mentor.languages.length - 2}`}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">{rateLabel}<span className="text-base font-normal text-slate-500">/hr</span></p>
                <p className="text-xs text-slate-500">+ 10% service fee</p>
              </div>
              <a
                href="#availability"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:shadow-xl hover:scale-105"
              >
                Book a session
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout: bio + sticky booking panel */}
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* About section */}
          {mentor.bio && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <svg className="h-5 w-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">About {mentor.display_name.split(' ')[0]}</h2>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {mentor.bio}
              </p>
            </section>
          )}

          {/* What I can help you with */}
          {mentor.help_topics.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">What I can help you with</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {mentor.help_topics.map((topic) => (
                  <div
                    key={topic}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-slate-700">{topic}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Strengths */}
          {mentor.strengths.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">My strengths</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {mentor.strengths.map((strength) => (
                  <span
                    key={strength}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {strength}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Availability calendar */}
          <section
            id="availability"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h2 className="text-xl font-bold text-slate-900">Select a time</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                <ClockIcon size={12} />
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
            <p className="mb-4 text-sm text-slate-500">
              Choose a time that works for you. All sessions are 60 minutes.
            </p>
            <div className="mt-4">
              <MentorAvailabilityGrid
                slots={slots}
                selectedSlotId={selectedSlot?.id ?? null}
                onSelectSlot={setSelectedSlot}
              />
            </div>
          </section>

          {/* Reviews */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h2 className="text-xl font-bold text-slate-900">
                Student reviews
                {reviewCount > 0 && (
                  <span className="ml-2 text-base font-normal text-slate-500">({reviewCount})</span>
                )}
              </h2>
            </div>
            {reviews.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-slate-600">
                  No reviews yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Be the first to book and share your experience
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <StarRating rating={r.rating} size={16} />
                        <span className="text-sm font-semibold text-slate-700">{r.rating}.0</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.comment}</p>
                    )}
                    {r.reviewer_name && (
                      <p className="mt-2 text-xs font-medium text-slate-500">— {r.reviewer_name}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sticky booking panel */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-6 text-white">
              <p className="text-sm font-semibold opacity-90">Book a session</p>
              <p className="mt-1 text-3xl font-bold">{rateLabel}<span className="text-lg font-normal opacity-80">/hr</span></p>
              <p className="mt-1 text-xs opacity-75">+ 10% service fee</p>
            </div>

            <div className="p-6">
              {selectedSlot ? (
                <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-bold text-emerald-900">Time selected</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {new Date(selectedSlot.starts_at).toLocaleDateString(undefined, {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Date(selectedSlot.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{' – '}
                      {new Date(selectedSlot.ends_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Select a time slot from the calendar below
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={startBooking}
                disabled={!selectedSlot}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 py-3.5 text-base font-bold text-white shadow-lg transition hover:shadow-xl hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {selectedSlot ? 'Continue to details' : 'Select a time slot'}
              </button>
              
              {!isSignedIn && (
                <p className="mt-3 text-center text-xs text-slate-500">
                  You&rsquo;ll be asked to sign in before booking
                </p>
              )}
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              You're in safe hands
            </p>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Verified mentors (students & alumni)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Secure payments powered by Stripe</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Flexible scheduling & cancellation</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>Satisfaction guarantee</span>
              </li>
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
