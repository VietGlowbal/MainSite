import { redirect } from 'next/navigation';
import { ManualReviewPanel } from './manual-review-panel';
import { loadManualReview } from '@/server/payments/manual-review-auth';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function ManualPaymentReviewPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  const reviewPath = `/payment/manual/review?token=${encodeURIComponent(token)}`;
  if (!token) return <main className="min-h-screen p-gb-5xl">Review link is missing.</main>;
  const review = await loadManualReview(token);
  if (!review) {
    // The helper intentionally returns null for signed-out and unauthorized
    // users. Preserve the complete encoded pathname through login; the token
    // is revalidated from scratch after the redirect.
    const { createClient } = await import('@/lib/supabase/server');
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user) redirect(`/auth?redirect=${encodeURIComponent(reviewPath)}`);
    return <main className="min-h-screen p-gb-5xl">This review is unavailable.</main>;
  }
  return <main className="min-h-screen bg-surface-muted px-gb-lg py-gb-5xl"><meta name="referrer" content="no-referrer" /><ManualReviewPanel token={token} review={review as never} /></main>;
}
