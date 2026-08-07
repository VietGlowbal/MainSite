import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MentorApplySuccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?redirect=/advisors');

  return (
    <main className="min-h-screen bg-transparent px-4 py-16 md:px-8">
      <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-black/5 bg-white/95 p-8 text-center shadow-[0_12px_32px_rgba(22,33,62,0.06)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Application received</h1>
        <p className="text-sm text-slate-500">
          Thanks for applying. Our team reviews advisor applications within 48 hours and we&rsquo;ll email you with the outcome.
          Meanwhile you can pre-fill your calendar from the dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/advisor"
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(255,77,140,0.25)]"
          >
            Go to my advisor dashboard
          </Link>
          <Link
            href="/advisors"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            Browse other advisors
          </Link>
        </div>
      </div>
    </main>
  );
}
