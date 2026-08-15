'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_DISPLAY_CURRENCY,
  PLAN_COLUMNS,
  PLUS_COMPARISON,
  PLUS_DISPLAY_CURRENCIES,
  PLUS_PACKAGES,
  currencyLabel,
  formatPlanPrice,
  type ComparisonValue,
  type DisplayCurrency,
  type PlanColumn,
  type PlusPackage,
} from '@/lib/plus';
import { Button, Container, ICONS, KitIcon, Modal } from '@/shared/ui';
import { PaymentMethodSelector } from '@/components/payments/payment-method-selector';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { useLanguage } from '@/lib/i18n';

/**
 * PlusPricing — the interactive middle of /plus: currency switcher, the three
 * tier cards, and the Free-vs-paid comparison.
 *
 * ⚠️ NO FIGMA SOURCE. /plus was never redrawn onto the "Khanh Linh - Chi"
 * canvas — docs/redesign-status.md lists it under "designed but not built"
 * against four frames on the RETIRED "Tính năng" canvas (115:13253, 132:9601,
 * 196:16799, 115:17014), and those draw a three-tier free/$10/$100 page that no
 * longer matches lib/plus.ts. The product owner confirmed on 2026-08-02 that the
 * page was missed in the redesign and asked for it to be built on the system
 * rather than from a frame. So this is tokens + shared primitives only, in the
 * same standing as `Panel` / `StatTile` / the admin console: nothing here
 * invents a colour, a radius or a type step.
 *
 * It owns the display currency (USD by default) and feeds it to every price
 * label. VNPay always charges the canonical VND amount; the selected currency
 * is retained only as a frozen display estimate in the payment ledger.
 *
 * Three things about the layout are deliberate:
 *
 *  - The switcher is still on the hero's black band and the cards straddle the
 *    seam beneath it. The 96px dark strip behind the cards' top edge is an
 *    absolutely positioned block, NOT a negative margin: a negative margin on
 *    the first in-flow child collapses through `Container` and drags the whole
 *    light band up with it, which hides the overlap instead of creating it.
 *  - The card CTA is a real `Button`, not the whole card. The card used to be
 *    `role="button"` with a styled span inside it pretending to be one; the kit
 *    has a button and a disabled state, and with sales off that state is the
 *    honest thing to render.
 *  - The Pro column is tinted the whole height of the comparison table. The
 *    header alone left the reader counting rows to keep their place across five
 *    columns on a table that scrolls sideways on a phone.
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
      {/* Currency switcher — the last element on the hero's black band. */}
      <div className="bg-surface-inverse-strong pb-gb-7xl">
        <Container className="flex flex-col items-center gap-gb-lg">
          <p className="text-gb-sm font-medium text-fg-on-inverse-muted">Show prices in</p>
          <div
            role="group"
            aria-label="Display currency"
            className="inline-flex flex-wrap items-center justify-center gap-gb-xxs rounded-gb-full border border-white/12 bg-white/8 p-gb-xs"
          >
            {PLUS_DISPLAY_CURRENCIES.map((code) => {
              const active = currency === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  aria-pressed={active}
                  className={`rounded-gb-full px-gb-xl py-gb-md text-gb-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    active
                      ? 'bg-brand text-on-brand'
                      : 'text-fg-on-inverse-muted hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {currencyLabel(code)}
                </button>
              );
            })}
          </div>
        </Container>
      </div>

      {/* Plans. The cards start at this band's top edge, so the dark strip
          behind them is what puts their first 96px on black. */}
      <div className="relative bg-surface-muted pb-gb-9xl">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-gb-9xl bg-surface-inverse-strong"
        />
        <Container className="relative">
          {/* Stretch, not `items-start`: the three cards carry three, three and
              three bullets of different lengths, and left to their natural
              heights their CTAs landed on three different lines. */}
          <div className="grid gap-gb-3xl lg:grid-cols-3">
            {PLUS_PACKAGES.map((pkg) => (
              <PlanCard
                key={pkg.id}
                pkg={pkg}
                currency={currency}
                signedIn={signedIn}
                applicationId={applicationId}
              />
            ))}
          </div>
        </Container>
      </div>

      <ComparisonTable currency={currency} />
    </>
  );
}

function PlanCard({
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
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'manual_bank_transfer'>('vnpay');
  useLoadingIndicator(loading, 'Opening secure checkout');
  const [error, setError] = useState<string | null>(null);
  const featured = pkg.highlighted;

  // Starts checkout for a signed-in student, or sends a guest to sign up first
  // and back here afterwards.
  async function startCheckout() {
    if (loading) return;
    if (!signedIn) {
      setPaymentOpen(false);
      const redirect = `/plus${applicationId ? `?application=${applicationId}` : ''}`;
      router.push(`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(paymentMethod === 'manual_bank_transfer' ? '/api/payments/manual/checkout' : '/api/payments/vnpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'plus',
          ...(paymentMethod === 'manual_bank_transfer' ? { provider: 'manual_bank_transfer' } : {}),
          plan: pkg.id,
          currency,
          applicationId: applicationId ?? undefined,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok || (paymentMethod === 'vnpay' && !data.checkout_url) || (paymentMethod === 'manual_bank_transfer' && !data.status_url)) {
        throw new Error(data.error ?? 'Could not start checkout');
      }
      window.location.assign((paymentMethod === 'manual_bank_transfer' ? data.status_url : data.checkout_url) as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  const ctaLabel = loading
      ? 'Starting checkout…'
      : signedIn
        ? 'Continue with VNPay'
        : 'Sign up & choose';

  return (
    <div
      /*
       * No `h-full`: the grid already stretches every card to the row height,
       * and a definite height is what stops the featured card growing past it.
       * With `auto` height, `-my` makes the stretched box 48px TALLER than its
       * grid area — so the Pro card stands 24px proud at both ends instead of
       * sliding up and leaving its foot 24px short of its neighbours'.
       */
      className={`relative flex flex-col rounded-gb-2xl border bg-surface p-gb-4xl transition-shadow ${
        featured
          ? 'border-brand shadow-gb-lg lg:-my-gb-3xl'
          : 'border-line shadow-gb-xs hover:shadow-gb-lg'
      }`}
    >
      {featured ? (
        <span className="absolute -top-gb-lg left-1/2 -translate-x-1/2 rounded-gb-full bg-brand px-gb-lg py-gb-xs text-gb-xs font-semibold whitespace-nowrap text-on-brand shadow-gb-xs">
          Most popular
        </span>
      ) : null}

      {/* The tier name alone is the heading: the page is already titled GlowBal
          Plus, and "GlowBal Plus {name}" would render as two adjacent text
          nodes, neither of which can match a dictionary key. */}
      <h3 className="font-display text-gb-xl font-semibold text-fg">{pkg.name}</h3>
      <p className="mt-gb-xs min-h-gb-5xl text-gb-sm text-fg-tertiary">{pkg.tagline}</p>

      <p className="mt-gb-3xl font-display text-gb-display-md font-semibold tracking-gb-display-tight text-fg">
        {formatPlanPrice(pkg.amountVnd, currency)}
      </p>
      <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{pkg.durationLabel}</p>

      {/* Credits get their own plate rather than a bullet: they are the one
          number that differs by an order of magnitude between tiers. */}
      <div className="mt-gb-3xl flex items-center gap-gb-lg rounded-gb-xl bg-brand-subtle px-gb-2xl py-gb-lg">
        <span className="flex size-gb-5xl shrink-0 items-center justify-center rounded-gb-full bg-brand text-on-brand">
          <KitIcon art={ICONS.zapFast} frame={20} />
        </span>
        <span className="flex flex-wrap items-baseline gap-gb-sm">
          <span className="font-display text-gb-xl font-semibold text-fg-brand">{pkg.aiCredits}</span>
          <span className="text-gb-sm font-medium text-fg-brand">AI strategy credits</span>
        </span>
      </div>

      <ul className="mt-gb-3xl flex flex-1 flex-col gap-gb-lg">
        {pkg.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-gb-md">
            <span className="mt-gb-xxs shrink-0 text-brand">
              <KitIcon art={ICONS.checkCircle} frame={20} />
            </span>
            <span className="text-gb-sm text-fg-tertiary">{highlight}</span>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        variant={featured ? 'primary' : 'secondary'}
        className="mt-gb-3xl w-full"
        onClick={() => {
          setError(null);
          setPaymentMethod('vnpay');
          setPaymentOpen(true);
        }}
        disabled={loading}
        aria-busy={loading}
      >
        {ctaLabel}
      </Button>

      {error ? <p className="mt-gb-md text-center text-gb-xs text-fg-error">{error}</p> : null}

      {!signedIn ? (
        <p className="mt-gb-lg text-center text-gb-xs text-fg-muted">
          No account yet? Selecting a plan signs you up first — it&rsquo;s free to start.
        </p>
      ) : null}

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        label={`Choose payment method for ${pkg.name}`}
        className="max-w-[560px] p-gb-3xl"
      >
        <div className="flex flex-col gap-gb-xl">
          <div>
            <h4 className="font-display text-gb-xl font-semibold text-fg">{t('Payment method')}</h4>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{pkg.name} · {formatPlanPrice(pkg.amountVnd, 'VND')}</p>
          </div>
          <PaymentMethodSelector
            amountVnd={pkg.amountVnd}
            id={`plus-payment-${pkg.id}`}
            name={`plus-payment-method-${pkg.id}`}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
          <Button
            size="lg"
            variant={featured ? 'primary' : 'secondary'}
            onClick={startCheckout}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? t('Starting checkout…') : signedIn ? paymentMethod === 'manual_bank_transfer' ? t('Continue with manual transfer') : t('Continue with VNPay') : t('Sign up & choose')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** One cell of the comparison: a tick, a dash, or a short value. */
function Cell({ value, accent }: { value: ComparisonValue; accent: boolean }) {
  if (value === true) {
    return (
      <span className={`inline-flex items-center justify-center ${accent ? 'text-brand' : 'text-fg-tertiary'}`}>
        <KitIcon art={ICONS.checkCircle} frame={20} />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    // A dash, not a cross: nine of the eleven rows are "this tier does not go
    // that far", which is a boundary, not a failure.
    return (
      <span className="inline-flex items-center justify-center text-gb-sm text-fg-muted">
        <span aria-hidden>—</span>
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return (
    <span className={`text-gb-sm font-semibold ${accent ? 'text-fg-brand' : 'text-fg'}`}>{value}</span>
  );
}

function ComparisonTable({ currency }: { currency: DisplayCurrency }) {
  // The price sits under each column name so the columns read as real,
  // comparable options. Free renders a formatted zero rather than the word
  // "Free" — that column is already headed "Free", and repeating it left the
  // one column with no price to compare against the three that have one.
  const priceFor = (key: PlanColumn): string => {
    if (key === 'free') return formatPlanPrice(0, currency);
    const pkg = PLUS_PACKAGES.find((p) => p.id === key);
    return pkg ? formatPlanPrice(pkg.amountVnd, currency) : '—';
  };

  return (
    <section className="bg-surface py-gb-9xl">
      <Container className="flex flex-col gap-gb-5xl">
        <div className="mx-auto max-w-gb-width-xl text-center">
          <h2 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg md:text-gb-display-sm">
            Compare Free &amp; Plus
          </h2>
          <p className="mt-gb-lg text-gb-md text-fg-tertiary">
            Start free, upgrade when you&rsquo;re ready. Here&rsquo;s exactly what each option
            includes.
          </p>
        </div>

        <div className="flex flex-col gap-gb-lg">
          {/*
            `contain:paint` is not decoration. The table is 720px at its
            narrowest and this wrapper scrolls it, which is correct — but Chrome
            still counts a scroll container's overflow toward the ROOT element's
            scrollWidth, so `<html>` reported 687px on a 390px phone. Nothing
            could scroll (body's own overflow-x is `clip`, see
            docs/redesign-status.md on why), yet the page measured as
            overflowing and full-page screenshots came out 687px wide with a
            dead band down the right. Paint containment is the only thing that
            fixed it — `max-width`, `overflow-x: scroll`, clipping the section
            and clipping <html> all left it at 687. Safe here: the wrapper holds
            nothing but the table, so there is no fixed descendant for the new
            containing block to capture.
          */}
          <div className="overflow-x-auto rounded-gb-2xl border border-line shadow-gb-xs [contain:paint]">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted">
                  <th scope="col" className="px-gb-3xl py-gb-2xl text-gb-sm font-semibold text-fg-tertiary">
                    Features
                  </th>
                  {PLAN_COLUMNS.map((col) => {
                    const accent = col.key === 'plus-pro';
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        className={`px-gb-xl py-gb-2xl text-center${accent ? ' bg-brand-subtle' : ''}`}
                      >
                        <span
                          className={`block text-gb-sm font-semibold ${accent ? 'text-fg-brand' : 'text-fg'}`}
                        >
                          {col.name}
                        </span>
                        <span className="mt-gb-xxs block text-gb-xs text-fg-muted">
                          {priceFor(col.key)}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PLUS_COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <th
                      scope="row"
                      className="px-gb-3xl py-gb-xl text-gb-sm font-medium text-fg-secondary"
                    >
                      {row.label}
                    </th>
                    {PLAN_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-gb-xl py-gb-xl text-center${
                          col.key === 'plus-pro' ? ' bg-brand-subtle' : ''
                        }`}
                      >
                        <Cell value={row.values[col.key]} accent={col.key === 'plus-pro'} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* The table is 720px wide at its narrowest and a phone is not, so say
              so rather than leaving a cut-off column to be discovered. */}
          <p className="text-gb-xs text-fg-muted md:hidden">
            Scroll the table sideways to see every plan.
          </p>
        </div>
      </Container>
    </section>
  );
}
