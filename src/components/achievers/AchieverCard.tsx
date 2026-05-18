'use client';

import Link from 'next/link';
import type { AchieverWithUniversity } from '@/types/achievers';

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="14"
          height="14"
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

export function AchieverCard({ achiever }: { achiever: AchieverWithUniversity }) {
  const initials = achiever.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="glow-card space-y-4">
      {/* Header: avatar + name */}
      <div className="flex items-center gap-3">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'linear-gradient(135deg, #ff4d8c, #00b4d8)',
            padding: 2,
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
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#ff4d8c',
              }}
            >
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{achiever.display_name}</p>
          <p className="text-xs text-slate-400 truncate">
            {achiever.university?.name ?? 'University'}
            {achiever.university?.country ? ` · ${achiever.university.country}` : ''}
          </p>
        </div>
      </div>

      {/* Subject + degree badge */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
            {achiever.degree_level.charAt(0).toUpperCase() + achiever.degree_level.slice(1)}
          </span>
          {achiever.currently_enrolled && (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Currently enrolled
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-slate-700">{achiever.subject}</p>
      </div>

      {/* Rating + sessions */}
      <div className="flex items-center gap-3 text-sm">
        <StarRating rating={Number(achiever.avg_rating)} />
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">{achiever.total_sessions} sessions</span>
      </div>

      {/* Help topics */}
      {achiever.help_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {achiever.help_topics.slice(0, 2).map((topic) => (
            <span
              key={topic}
              className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600"
            >
              {topic}
            </span>
          ))}
          {achiever.help_topics.length > 2 && (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-400">
              +{achiever.help_topics.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Price + CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-black/5">
        <p className="text-sm font-semibold text-slate-900">{formatVND(achiever.session_price_vnd)}</p>
        <Link
          href={`/achievers/${achiever.id}`}
          className="glow-button-primary text-xs px-4 py-2"
        >
          Book a session
        </Link>
      </div>
    </article>
  );
}
