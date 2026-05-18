import Link from 'next/link';
import { getAchieversByUniversity } from '@/lib/achievers';

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

/**
 * Server component that shows up to 3 approved Achievers at a given university.
 * Renders nothing (returns null) if no achievers are found, so the parent
 * can choose whether to wrap it in a heading.
 *
 * For unauthenticated callers: getAchieversByUniversity will return [] because
 * RLS only allows authenticated reads. That's fine — the section just doesn't render.
 */
export async function AchieversAtUniversity({
  universityId,
  universityName,
  limit = 3,
}: {
  universityId: number;
  universityName: string;
  limit?: number;
}) {
  const achievers = await getAchieversByUniversity(universityId, limit);

  return (
    <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-pink-50/30 to-cyan-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Talk to someone who goes here
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Real advice from current students and alumni at {universityName}.
          </p>
        </div>
        <Link
          href={`/achievers?university=${universityId}`}
          className="text-xs font-semibold text-cyan-600 hover:underline whitespace-nowrap"
        >
          See all →
        </Link>
      </div>

      {achievers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center">
          <p className="text-sm text-slate-500">
            No mentors at {universityName} yet.
          </p>
          <Link
            href="/achievers/apply"
            className="mt-2 inline-flex text-xs font-semibold text-pink-600 hover:underline"
          >
            Are you a student here? Become a mentor →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {achievers.map((a) => {
            const initials = a.display_name
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            return (
              <Link
                key={a.id}
                href={`/achievers/${a.id}`}
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 hover:shadow-md transition space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--brand-pink), var(--brand-cyan))',
                      padding: 2,
                      flexShrink: 0,
                    }}
                  >
                    {a.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.avatar_url}
                        alt={a.display_name}
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
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: 'var(--brand-pink)',
                        }}
                      >
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">{a.display_name}</p>
                    <p className="text-[0.65rem] text-slate-400 truncate">{a.subject}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[0.65rem] text-slate-500">
                  <span>{a.session_duration_mins} min</span>
                  <span className="font-semibold text-pink-600">{formatVND(a.session_price_vnd)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
