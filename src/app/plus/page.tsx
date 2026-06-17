import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  PLUS_PACKAGES,
  PLUS_BENEFITS,
  FREE_FEATURES,
  getPaymentLink,
  type PlusPackage,
} from '@/lib/plus';

export const metadata: Metadata = {
  title: 'GlowBal Plus | Unlock your full scholarship plan',
  description:
    'Upgrade to GlowBal Plus for more AI application strategies, full scholarship details, a document checklist, and priority student-supporter access.',
};

type UserLite = { id: string; email: string | null };

/**
 * Build the subscribe href for a package:
 *  - signed out → send to sign-up, returning to /plus
 *  - signed in  → the Stripe payment link with the user attached via
 *    client_reference_id (so activation can be reconciled) + prefilled email
 *  - link missing → null (button renders disabled)
 */
function buildHref(pkg: PlusPackage, user: UserLite | null): string | null {
  if (!user) return '/auth?mode=signup&redirect=/plus';
  const link = getPaymentLink(pkg);
  if (!link) return null;
  try {
    const url = new URL(link);
    url.searchParams.set('client_reference_id', user.id);
    if (user.email) url.searchParams.set('prefilled_email', user.email);
    return url.toString();
  } catch {
    return null;
  }
}

export default async function PlusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isPlus = false;
  let planLabel: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('plus_status, plus_plan, plus_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    isPlus = !!profile?.plus_status;
    planLabel = profile?.plus_plan ?? null;
  }

  const userLite: UserLite | null = user ? { id: user.id, email: user.email ?? null } : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#FBFBFF,#ffffff)] px-5 py-14 sm:px-6">
      <div className="mx-auto max-w-6xl">
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
        </div>

        {isPlus ? (
          <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center text-sm text-emerald-700">
            You’re on <strong>GlowBal Plus</strong>
            {planLabel ? <> ({planLabel})</> : null}. Thanks for your support — you can extend your plan any time below.
          </div>
        ) : null}

        {/* Packages */}
        <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
          {PLUS_PACKAGES.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} href={buildHref(pkg, userLite)} />
          ))}
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
            Prices in VND. GlowBal helps you discover opportunities and prepare
            stronger applications; it does not guarantee scholarship outcomes.
          </p>
        </div>
      </div>
    </main>
  );
}

function PackageCard({ pkg, href }: { pkg: PlusPackage; href: string | null }) {
  const highlighted = pkg.highlighted;
  return (
    <div
      className={`relative flex flex-col rounded-3xl border bg-white p-7 ${
        highlighted
          ? 'border-2 border-pink-300 shadow-[0_24px_56px_rgba(255,77,140,0.18)] lg:-mt-3 lg:mb-3'
          : 'border-slate-200 shadow-[0_12px_30px_rgba(30,40,80,0.05)]'
      }`}
    >
      {highlighted ? (
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          Best value
        </span>
      ) : null}

      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-900">GlowBal Plus</h2>
        <p className="text-sm text-slate-500">{pkg.durationLabel}</p>

        <div className="mt-4">
          <div className="text-3xl font-bold tracking-tight text-slate-900">{pkg.priceLabel}</div>
          <div className="mt-1 text-sm text-slate-500">{pkg.perMonthLabel}</div>
          {pkg.originalPriceLabel ? (
            <div className="mt-1 text-xs text-slate-400">
              <span className="line-through">{pkg.originalPriceLabel}</span>
              {pkg.saveLabel ? <span className="ml-2 font-semibold text-emerald-600">{pkg.saveLabel}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {href ? (
        <a
          href={href}
          className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition ${
            highlighted
              ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_12px_28px_rgba(255,77,140,0.3)] hover:-translate-y-0.5'
              : 'border border-slate-200 bg-white text-slate-700 hover:border-pink-300 hover:text-pink-600'
          }`}
        >
          Subscribe now
        </a>
      ) : (
        <span className="mt-6 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-400">
          Available soon
        </span>
      )}

      <div className="mt-6 rounded-2xl bg-pink-50 px-4 py-3 text-center">
        <span className="text-2xl font-bold text-pink-600">{pkg.aiCredits}</span>
        <span className="ml-1 text-sm font-medium text-pink-600">AI strategy credits</span>
      </div>

      {pkg.bonusLabel ? (
        <p className="mt-3 text-center text-xs font-semibold text-emerald-600">{pkg.bonusLabel}</p>
      ) : null}

      <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
        {PLUS_BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-0.5 text-pink-500">✓</span>{b}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-center text-xs text-slate-400">
        Need an account first?{' '}
        <Link href="/auth?mode=signup&redirect=/plus" className="font-semibold text-pink-600">Sign up free</Link>
      </p>
    </div>
  );
}
