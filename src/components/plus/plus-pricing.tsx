'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  PLUS_PACKAGES,
  PLUS_COMPARISON,
  PLAN_COLUMNS,
  PLUS_DISPLAY_CURRENCIES,
  DEFAULT_DISPLAY_CURRENCY,
  PLUS_SALES_ENABLED,
  formatPlanPrice,
  currencyLabel,
  type DisplayCurrency,
  type PlusPackage,
  type ComparisonValue,
  type PlanColumn,
} from '@/lib/plus';
import { useLoadingIndicator } from '@/shared/ui';

/**
 * PlusPricing — the interactive heart of the /plus page.
 *
 * Owns the selected display/checkout currency (USD by default) and feeds it to
 * every price label and to the Subscribe buttons (so Stripe charges in the
 * chosen currency). Renders the three tier cards plus a Free-vs-paid comparison
 * table so it's easy to see what you get for free and what each tier adds.
 */
export function PlusPricing({
  signedIn,
  applicationId,
}: {
  signedIn: boolean;
  applicationId: string | null;
}) {
  const [currency, setCurrency] = useState<DisplayCurrency>(DEFAULT_DISPLAY_CURRENCY);

  return (
    <>
      {/* Currency switcher */}
      <div className="mt-10 flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Show prices in
        </span>
        <div
          role="group"
          aria-label="Display currency"
          className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-[0_4px_14px_rgba(30,40,80,0.05)]"
        >
          {PLUS_DISPLAY_CURRENCIES.map((c) => {
            const active = currency === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                aria-pressed={active}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_6px_16px_rgba(255,77,140,0.25)]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {currencyLabel(c)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-3">
        {PLUS_PACKAGES.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            currency={currency}
            signedIn={signedIn}
            applicationId={applicationId}
          />
        ))}
      </div>

      {/* Free vs paid comparison */}
      <ComparisonTable currency={currency} />
    </>
  );
}

function PackageCard({
  pkg,
  currency,
  signedIn,
  applicationId,
}: {
  pkg: PlusPackage;
  currency: DisplayCurrency;
  signedIn: boolean;
  applicationId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  useLoadingIndicator(loading, 'Opening secure checkout');
  const [error, setError] = useState<string | null>(null);
  const highlighted = pkg.highlighted;

  // The whole card is the button: selecting it starts checkout (signed in) or
  // sends the user to sign up first (returning to /plus afterwards).
  async function select() {
    if (loading) return;
    if (!signedIn) {
      const redirect = `/plus${applicationId ? `?application=${applicationId}` : ''}`;
      router.push(`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plus/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: pkg.id, currency, applicationId: applicationId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error ?? 'Could not start checkout');
      }
      window.location.assign(data.checkout_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  const ctaLabel = !PLUS_SALES_ENABLED
    ? 'Coming soon'
    : loading
      ? 'Starting checkout…'
      : signedIn
        ? 'Choose this plan'
        : 'Sign up & choose';

  // With sales off the card is a plain preview: no click target, no keyboard
  // handler, no hover lift — nothing that promises an action we won't perform.
  const interactive = PLUS_SALES_ENABLED
    ? ({
        role: 'button',
        tabIndex: 0,
        'aria-label': `Select GlowBal Plus ${pkg.name} — ${formatPlanPrice(pkg.amountVnd, currency)}`,
        'aria-busy': loading,
        onClick: select,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select();
          }
        },
      } as const)
    : {};

  return (
    <div
      {...interactive}
      className={`group relative flex flex-col rounded-3xl border bg-white p-7 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-pink-300 focus-visible:ring-offset-2 ${
        PLUS_SALES_ENABLED ? 'cursor-pointer hover:-translate-y-1.5' : ''
      } ${
        highlighted
          ? 'border-2 border-pink-300 shadow-[0_24px_56px_rgba(255,77,140,0.18)] hover:shadow-[0_30px_64px_rgba(255,77,140,0.26)] lg:-mt-3 lg:mb-3'
          : 'border-slate-200 shadow-[0_12px_30px_rgba(30,40,80,0.05)] hover:border-pink-200 hover:shadow-[0_22px_48px_rgba(30,40,80,0.12)]'
      }`}
    >
      {highlighted ? (
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] px-4 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          Most popular
        </span>
      ) : null}

      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-900">GlowBal Plus {pkg.name}</h2>
        <p className="mt-1 min-h-[40px] text-sm text-slate-500">{pkg.tagline}</p>

        <div className="mt-4">
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {formatPlanPrice(pkg.amountVnd, currency)}
          </div>
          <div className="mt-1 text-sm text-slate-500">{pkg.durationLabel}</div>
        </div>
      </div>

      {/* Visual CTA — the click is handled by the whole card, so this is a
          styled cue rather than a separate interactive control. With sales off
          it drops to a muted label so it doesn't read as a live button. */}
      <span
        aria-hidden={PLUS_SALES_ENABLED}
        className={`mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition ${
          !PLUS_SALES_ENABLED
            ? 'border border-slate-200 bg-slate-50 text-slate-500'
            : highlighted
              ? 'bg-[linear-gradient(135deg,#FF3D9A,#FF85B3)] text-white shadow-[0_12px_28px_rgba(255,77,140,0.3)]'
              : 'border border-slate-200 bg-white text-slate-700 group-hover:border-pink-300 group-hover:text-pink-600'
        } ${loading ? 'opacity-60' : ''}`}
      >
        {ctaLabel}
      </span>
      {error ? <p className="mt-2 text-center text-xs text-rose-600">{error}</p> : null}

      <div className="mt-6 rounded-2xl bg-pink-50 px-4 py-3 text-center">
        <span className="text-2xl font-bold text-pink-600">{pkg.aiCredits}</span>
        <span className="ml-1 text-sm font-medium text-pink-600">AI strategy credits</span>
      </div>

      <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
        {pkg.highlights.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <span className="mt-0.5 text-pink-500">✓</span>
            {b}
          </li>
        ))}
      </ul>

      {PLUS_SALES_ENABLED && !signedIn ? (
        <p className="mt-5 text-center text-xs text-slate-400">
          No account yet? Selecting a plan signs you up first — it&rsquo;s free to start.
        </p>
      ) : null}
    </div>
  );
}

/** Renders a single cell value: a tick, a dash, or a text/number value. */
function Cell({ value, accent }: { value: ComparisonValue; accent: boolean }) {
  if (value === true) {
    return (
      <span className={`inline-flex ${accent ? 'text-pink-600' : 'text-emerald-600'}`} aria-label="Included">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex text-slate-300" aria-label="Not included">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  return <span className={`text-sm font-semibold ${accent ? 'text-pink-600' : 'text-slate-700'}`}>{value}</span>;
}

function ComparisonTable({ currency }: { currency: DisplayCurrency }) {
  // Price row sits at the bottom of the header so the columns read as real,
  // comparable options — Free at 0 next to each paid tier's price.
  const priceFor = (key: PlanColumn): string => {
    if (key === 'free') return 'Free';
    const pkg = PLUS_PACKAGES.find((p) => p.id === key);
    return pkg ? formatPlanPrice(pkg.amountVnd, currency) : '—';
  };

  return (
    <section className="mx-auto mt-14 max-w-4xl">
      <h2 className="text-center text-2xl font-semibold tracking-[-0.02em] text-slate-900">
        Compare Free &amp; Plus
      </h2>
      <p className="mt-2 text-center text-sm text-slate-500">
        Start free, upgrade when you’re ready. Here’s exactly what each option includes.
      </p>

      <div className="mt-7 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(30,40,80,0.05)]">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-5 py-4 text-sm font-semibold text-slate-500">Features</th>
              {PLAN_COLUMNS.map((col) => {
                const accent = col.key === 'plus-pro';
                return (
                  <th key={col.key} className="px-4 py-4 text-center">
                    <span className={`block text-sm font-bold ${accent ? 'text-pink-600' : 'text-slate-900'}`}>
                      {col.name}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">{priceFor(col.key)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PLUS_COMPARISON.map((row) => (
              <tr key={row.label} className="border-b border-slate-50 last:border-0">
                <th scope="row" className="px-5 py-3 text-sm font-medium text-slate-700">
                  {row.label}
                </th>
                {PLAN_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-center ${col.key === 'plus-pro' ? 'bg-pink-50/40' : ''}`}
                  >
                    <Cell value={row.values[col.key]} accent={col.key === 'plus-pro'} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
