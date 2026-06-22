import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { FREE_FEATURES, GLOWBAL_FB_CHAT_URL } from '@/lib/plus';
import { PlusPricing } from '@/components/plus/plus-pricing';

export const metadata: Metadata = {
  title: 'GlowBal Plus | Unlock your full scholarship plan',
  description:
    'Upgrade to GlowBal Plus for more AI application strategies, full scholarship details, a document checklist, and priority student-supporter access.',
};

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; application?: string }>;
}) {
  const { welcome, application } = await searchParams;
  const isWelcome = welcome === '1';
  const applicationId = application ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPlus = false;
  let planLabel: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('plus_status, plus_plan')
      .eq('user_id', user.id)
      .maybeSingle();
    isPlus = !!profile?.plus_status;
    planLabel = profile?.plus_plan ?? null;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#FBFBFF,#ffffff)] px-5 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {isWelcome ? (
          <div className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-3 rounded-3xl border border-pink-100 bg-white px-6 py-5 text-center shadow-[0_12px_30px_rgba(30,40,80,0.05)] sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-sm font-semibold text-slate-900">🎉 You’re all set!</p>
              <p className="text-sm text-slate-500">Get the most from GlowBal with Plus — or keep exploring for free.</p>
            </div>
            <Link href="/universities" className="shrink-0 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
              Maybe later — see my matches →
            </Link>
          </div>
        ) : null}

        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-pink-600">
            GlowBal Plus
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-4xl">
            Unlock your full scholarship plan
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Go beyond searching — more AI application strategies, full scholarship
            details, a document checklist, and priority student-supporter access.
            Designed to help you apply with a clearer, stronger strategy.
          </p>

          {applicationId ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-sm font-medium text-slate-700">
                Unlock the full application plan to keep building this application.
              </p>
              <Link
                href={`/apply/${applicationId}?sop=1`}
                className="text-sm font-semibold text-slate-500 underline-offset-2 transition hover:text-slate-900 hover:underline"
              >
                Continue with limited plan →
              </Link>
            </div>
          ) : null}
        </div>

        {isPlus ? (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center text-sm text-emerald-700">
            You’re on <strong>GlowBal Plus</strong>
            {planLabel ? <> ({planLabel})</> : null}. Thanks for your support — you can extend your plan any time below.
          </div>
        ) : null}

        {/* Currency switcher + tier cards + Free-vs-paid comparison */}
        <PlusPricing signedIn={!!user} applicationId={applicationId} />

        {/* Talk-to-a-human CTA */}
        <div className="mx-auto mt-8 max-w-2xl text-center">
          <a
            href={GLOWBAL_FB_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_4px_14px_rgba(30,40,80,0.05)] transition hover:border-pink-300 hover:text-pink-600"
          >
            <span aria-hidden>💬</span>
            Not sure? Chat with our in-house team for more info
          </a>
        </div>

        {/* Free tier reference */}
        <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Free plan</p>
          <p className="mt-1 text-sm text-slate-500">Everything you need to start — no payment required.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-0.5 text-slate-400">✓</span>{f}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-2 text-center text-xs text-slate-400">
          <p className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Payments are processed securely by Stripe.
          </p>
          <p>
            Choose your currency above — you’ll be charged in the currency you
            select; conversions from VND are approximate. GlowBal helps you
            discover opportunities and prepare stronger applications; it does not
            guarantee scholarship outcomes.
          </p>
        </div>
      </div>
    </main>
  );
}
