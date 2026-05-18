'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Props = {
  bookingId: number;
  achieverId: string;
  userId: string;
};

export function ReviewFormClient({ bookingId, achieverId, userId }: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const { error: insertError } = await supabase.from('session_reviews').insert({
      booking_id: bookingId,
      reviewer_id: userId,
      achiever_id: achieverId,
      rating,
      comment: comment.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    // Update booking status to reviewed
    await supabase
      .from('bookings')
      .update({ status: 'reviewed' })
      .eq('id', bookingId);

    router.push('/dashboard/bookings');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="glow-card space-y-6">
      {/* Star rating */}
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700 mb-3">Rating</p>
        <div className="inline-flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-1 transition hover:scale-110"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill={star <= rating ? '#facc15' : 'none'}
                stroke={star <= rating ? '#facc15' : '#cbd5e1'}
                strokeWidth="2"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="glow-label font-medium">Comment (optional)</label>
        <textarea
          className="glow-input glow-textarea mt-1.5"
          placeholder="Share your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
        />
        <p className="text-xs text-slate-400 mt-1">{comment.length}/500</p>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="glow-button-primary w-full py-3"
      >
        {submitting ? 'Submitting...' : 'Submit review'}
      </button>
    </form>
  );
}
