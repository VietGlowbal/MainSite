import Link from 'next/link';
import { getMentorsByUniversity } from '@/lib/mentors';
import { formatMoney } from '@/lib/currency';
import { MentorAvatar, StarRating } from './mentor-icons';

/**
 * Server component that surfaces up to N approved mentors at a given
 * university. Renders the empty state with a "become a mentor" CTA when
 * no one has signed up yet.
 *
 * Used on the My Universities detail page.
 */
export async function MentorsAtUniversity({
  universityId,
  universityName,
  limit = 3,
}: {
  universityId: number;
  universityName: string;
  limit?: number;
}) {
  const mentors = await getMentorsByUniversity(universityId, limit);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-pink-50/30 to-cyan-50/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Talk to an advisor who studies here
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Real advice from current students and recent alumni at {universityName}.
          </p>
        </div>
        <Link
          href={`/advisors?university=${universityId}`}
          className="whitespace-nowrap text-xs font-semibold text-cyan-600 hover:underline"
        >
          See all →
        </Link>
      </div>

      {mentors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center">
          <p className="text-sm text-slate-500">No advisors at {universityName} yet.</p>
          <Link
            href="/advisors/apply"
            className="mt-2 inline-flex text-xs font-semibold text-pink-600 hover:underline"
          >
            Are you a student here? Become an advisor →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {mentors.map((m) => {
            const rate = Number(m.hourly_rate_amount ?? 0);
            return (
              <Link
                key={m.id}
                href={`/advisors/${m.id}`}
                className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <MentorAvatar name={m.display_name} src={m.avatar_url} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">{m.display_name}</p>
                    <p className="truncate text-[0.65rem] text-slate-400">{m.subject}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[0.65rem] text-slate-500">
                  <span className="inline-flex items-center gap-1"><StarRating rating={Number(m.avg_rating)} size={10} /></span>
                  <span className="font-semibold text-pink-600">
                    {rate > 0 ? formatMoney(rate, m.hourly_rate_currency) : 'Pricing soon'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
