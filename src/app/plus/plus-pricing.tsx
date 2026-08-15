'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_DISPLAY_CURRENCY,
  PLUS_DISPLAY_CURRENCIES,
  PLUS_PACKAGES,
  currencyLabel,
  formatPlanPrice,
  type DisplayCurrency,
  type PlusPackage,
} from '@/lib/plus';
import { Container, Modal } from '@/shared/ui';
import { PaymentMethodSelector } from '@/components/payments/payment-method-selector';
import { TermsModal } from '@/components/legal/terms-modal';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';
import { useLanguage } from '@/lib/i18n';

export function PlusPricing({
  signedIn,
  applicationId,
}: {
  signedIn: boolean;
  applicationId: string | null;
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState<DisplayCurrency>(DEFAULT_DISPLAY_CURRENCY);
  const { t } = useLanguage();
  const [selectedPkg, setSelectedPkg] = useState<PlusPackage | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [termsOpen, setTermsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLoadingIndicator(loading, t('Opening secure checkout'));

  async function handleCheckout() {
    if (!selectedPkg || loading || !agreedTerms) return;
    if (!signedIn) {
      setSelectedPkg(null);
      const redirect = `/plus${applicationId ? `?application=${applicationId}` : ''}`;
      router.push(`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/manual/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'plus',
          provider: 'manual_bank_transfer',
          plan: selectedPkg.id,
          currency,
          applicationId: applicationId ?? undefined,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.status_url) {
        throw new Error(data.error ?? t('Could not start checkout'));
      }
      window.location.assign(data.status_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Something went wrong'));
      setLoading(false);
    }
  }

  async function handlePromoRedeem() {
    if (!selectedPkg || loading || !promoCode.trim()) return;
    if (!signedIn) {
      setSelectedPkg(null);
      const redirect = `/plus${applicationId ? `?application=${applicationId}` : ''}`;
      router.push(`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/plus/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim(), plan: selectedPkg.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(t(data.error ?? 'Could not redeem promo code'));
      setSelectedPkg(null);
      setPromoCode('');
      setLoading(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not redeem promo code'));
      setLoading(false);
    }
  }

  return (
    <section className="relative w-full overflow-hidden bg-[#FBF9FA] py-12 md:py-16 text-[#141118]">
      {/* Ambient background glow highlights */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(244,63,94,0.12),transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-12 right-[5%] h-[480px] w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(42,189,216,0.10),transparent_65%)] blur-2xl"
      />

      <Container className="relative mx-auto max-w-[1140px] px-4 sm:px-6">
        {/* Header */}
        <header className="mx-auto mb-4 max-w-[720px] text-center">
          <div className="mb-4 inline-block text-[13px] font-bold tracking-[0.16em] uppercase text-[#E11D48]">
            {t('GlowBal Pricing')}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl leading-[1.1]">
            {t('Choose how you want to')}{' '}
            <span className="relative inline-block text-[#E11D48] whitespace-nowrap">
              {t('shine')}
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[124%] h-[150%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(244,63,94,0.30),transparent_75%)] blur-[2px]"
              />
            </span>{' '}
            {t('on your study-abroad journey')}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#6B6570]">
            {t("You don't go it alone. GlowBal")}{' '}
            <b className="font-semibold text-[#141118]">{t('walks with you')}</b>{' '}
            {t('from picking schools to hitting submit.')}
          </p>
        </header>

        {/* Launch ribbon */}
        <div className="mx-auto mb-10 mt-6 flex w-fit flex-wrap items-center justify-center gap-2.5 rounded-full border border-[#EDE9EE] bg-white px-5 py-2.5 shadow-[0_6px_20px_rgba(20,17,24,0.05)] text-sm font-semibold text-[#141118]">
          <span className="rounded-full bg-[#E11D48] px-2.5 py-0.5 text-xs font-extrabold tracking-wider text-white">
            −50%
          </span>
          <span>{t('Launch offer · 2026 application season')}</span>
          <span className="font-medium text-[#6B6570]">· {t('all plans')}</span>
        </div>

        {/* Currency Switcher (Discreet) */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="text-xs font-medium text-[#6B6570]">{t('Show prices in:')}</span>
          <div className="inline-flex rounded-full border border-[#EDE9EE] bg-white p-1 shadow-sm">
            {PLUS_DISPLAY_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  currency === code
                    ? 'bg-[#E11D48] text-white shadow-sm'
                    : 'text-[#6B6570] hover:text-[#141118]'
                }`}
              >
                {currencyLabel(code)}
              </button>
            ))}
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3 lg:items-stretch">
          {PLUS_PACKAGES.map((pkg) => (
            <PlanCard
              key={pkg.id}
              pkg={pkg}
              currency={currency}
              onSelect={() => {
                setError(null);
                setAgreedTerms(false);
                setPromoCode('');
                setSelectedPkg(pkg);
              }}
            />
          ))}
        </div>

        {/* Foot quote */}
        <p className="mt-12 text-center text-sm text-[#6B6570]">
          {t('You submit your application')}{' '}
          <b className="font-semibold text-[#141118]">{t('once')}</b>.{' '}
          {t("Pick the level of support you're most at peace with.")}
        </p>
      </Container>

      {/* Top-Level Payment Method Modal */}
      {selectedPkg ? (
        <Modal
          open={Boolean(selectedPkg)}
          onClose={() => {
            if (!loading) setSelectedPkg(null);
          }}
          label={t('Choose payment method')}
        >
          <div className="space-y-5">
            <div className="flex items-start justify-between border-b border-[#EDE9EE] pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-[#141118]">{t(selectedPkg.name)}</h3>
                <p className="text-xs text-[#6B6570] mt-0.5">{t(selectedPkg.durationLabel)}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-extrabold text-[#E11D48]">
                  {formatPlanPrice(selectedPkg.amountVnd, currency)}
                </div>
                <div className="text-xs line-through text-[#6B6570]">
                  {formatPlanPrice(selectedPkg.anchorVnd, currency)}
                </div>
              </div>
            </div>

            <PaymentMethodSelector
              id={`plus-payment-${selectedPkg.id}`}
              name={`plus-payment-${selectedPkg.id}`}
              value="manual_bank_transfer"
              amountVnd={selectedPkg.amountVnd}
            />

            <div className="rounded-xl border border-[#EDE9EE] bg-white p-3.5">
              <label
                htmlFor="plus-promo-code"
                className="mb-2 block text-xs font-bold text-[#141118]"
              >
                {t('Promo code')}
              </label>
              <div className="flex gap-2">
                <input
                  id="plus-promo-code"
                  type="text"
                  autoComplete="off"
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#EDE9EE] px-3 py-2 text-sm text-[#141118] outline-none focus:border-[#E11D48] focus:ring-2 focus:ring-[#E11D48]/15"
                  placeholder={t('Enter promo code')}
                />
                <button
                  type="button"
                  disabled={loading || promoCode.trim().length === 0}
                  onClick={() => void handlePromoRedeem()}
                  className="rounded-lg border border-[#E11D48] px-4 py-2 text-sm font-bold text-[#E11D48] transition-colors hover:bg-[#E11D48]/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('Apply code')}
                </button>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start gap-3 rounded-xl border border-[#EDE9EE] bg-[#FBF9FA] p-3.5 text-xs text-[#141118]">
              <input
                type="checkbox"
                id="agree-terms-checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-[#E11D48] accent-[#E11D48] cursor-pointer focus:ring-[#E11D48]"
              />
              <label htmlFor="agree-terms-checkbox" className="cursor-pointer select-none leading-relaxed text-[#6B6570]">
                {t('I have read and agree to the')}{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setTermsOpen(true);
                  }}
                  className="font-bold text-[#E11D48] underline decoration-[#E11D48]/40 hover:decoration-[#E11D48] cursor-pointer"
                >
                  {t('Terms and Conditions of Use')}
                </button>{' '}
                {t('of GlowBal Education.')}
              </label>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setSelectedPkg(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[#6B6570] hover:text-[#141118] transition-colors cursor-pointer"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                disabled={loading || !agreedTerms}
                onClick={() => void handleCheckout()}
                className="rounded-xl bg-[#E11D48] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#B01238] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? t('Processing…') : t('Continue to payment')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Full Terms and Conditions Dialog */}
      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
      />
    </section>
  );
}

function PlanCard({
  pkg,
  currency,
  onSelect,
}: {
  pkg: PlusPackage;
  currency: DisplayCurrency;
  onSelect: () => void;
}) {
  const { t } = useLanguage();
  const isHero = pkg.highlighted;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-[22px] p-7 sm:p-8 transition-all duration-300 ${
        isHero
          ? 'bg-gradient-to-b from-[#E7204C] via-[#E11D48] to-[#B01238] text-white shadow-[0_26px_60px_rgba(225,29,72,0.34)] lg:-translate-y-3.5 lg:hover:-translate-y-4.5 before:absolute before:-inset-4 sm:before:-inset-6 before:-z-10 before:rounded-[34px] before:bg-[radial-gradient(closest-side,rgba(244,63,94,0.34),transparent_70%)] before:blur-[6px]'
          : 'border border-[#EDE9EE] bg-white text-[#141118] shadow-[0_4px_16px_rgba(20,17,24,0.04)] hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(20,17,24,0.09)]'
      }`}
    >
      {/* Badge */}
      {pkg.badge ? (
        <div
          className={`absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap shadow-md ${
            pkg.badgeType === 'save'
              ? 'bg-white text-[#E11D48] shadow-[0_6px_18px_rgba(225,29,72,0.28)]'
              : 'bg-[#106574] text-white shadow-[0_6px_16px_rgba(16,101,116,0.28)]'
          }`}
        >
          {pkg.badge}
        </div>
      ) : null}

      <div>
        {/* Tier & Name */}
        <div
          className={`text-[12px] font-bold tracking-[0.14em] uppercase ${
            isHero ? 'text-white/80' : 'text-[#6B6570]'
          }`}
        >
          {t(pkg.tierLabel)}
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight">{t(pkg.name)}</h2>

        {/* Price Block */}
        <div className="mt-4 mb-2">
          <div
            className={`text-[15px] line-through ${
              isHero ? 'text-white/70 decoration-white/60' : 'text-[#6B6570] decoration-[#6B6570]/60'
            }`}
          >
            {formatPlanPrice(pkg.anchorVnd, currency)}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1 text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span>{formatPlanPrice(pkg.amountVnd, currency)}</span>
            <span
              className={`text-base font-semibold ${
                isHero ? 'text-white/80' : 'text-[#6B6570]'
              }`}
            >
              {pkg.durationMonths === 1 ? t('/mo') : t('/yr')}
            </span>
          </div>
          <div
            className={`mt-1 text-sm font-medium ${
              isHero ? 'text-white/85' : 'text-[#6B6570]'
            }`}
          >
            {t(pkg.perMonthLabel)}
          </div>

          {pkg.savePill ? (
            <span
              className={`mt-3 inline-block rounded-lg px-3 py-1 text-xs sm:text-[13px] font-bold ${
                isHero ? 'bg-white/20 text-white' : 'bg-[#E11D48]/10 text-[#E11D48]'
              }`}
            >
              {t(pkg.savePill)}
            </span>
          ) : null}
        </div>

        {/* Transform quote */}
        <div
          className={`mt-4 mb-1 border-l-[3px] pl-3 text-sm font-semibold italic leading-snug ${
            isHero ? 'border-white/70 text-white' : 'border-[#2ABDD8] text-[#106574]'
          }`}
        >
          {t(pkg.tagline)}
        </div>

        <hr className={`my-4.5 border-t ${isHero ? 'border-white/20' : 'border-[#EDE9EE]'}`} />

        {/* Features list */}
        <ul className="flex flex-col gap-3 text-sm">
          {pkg.bullets.map((bullet, idx) => (
            <li
              key={idx}
              className={`relative pl-7 leading-snug ${
                isHero
                  ? 'text-white/95'
                  : bullet.type === 'gap'
                    ? 'text-[#6B6570]'
                    : 'text-[#2B2730]'
              }`}
            >
              <span
                className={`absolute left-0 top-0 text-sm font-bold ${
                  bullet.type === 'gift'
                    ? isHero
                    : bullet.type === 'gap'
                      ? 'text-[#C9A227]'
                      : isHero
                        ? 'text-white'
                        : 'text-[#2ABDD8]'
                }`}
              >
                {bullet.type === 'gift' ? '🎁' : bullet.type === 'gap' ? '⚠' : '✓'}
              </span>
              <span>
                {bullet.text ? `${t(bullet.text)} ` : ''}
                {bullet.strong ? (
                  <b className="font-bold">{t(bullet.strong)}</b>
                ) : null}
                {bullet.extra ? ` ${t(bullet.extra)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Button */}
      <div className="mt-8">
        <button
          type="button"
          onClick={onSelect}
          className={`w-full rounded-xl py-3.5 text-center text-sm sm:text-base font-bold tracking-wide transition-all duration-200 cursor-pointer ${
            pkg.ctaVariant === 'ghost'
              ? 'border-[1.5px] border-[#106574] bg-white text-[#106574] hover:bg-[#106574] hover:text-white shadow-sm active:scale-[0.98]'
              : pkg.ctaVariant === 'solid'
                ? 'bg-white text-[#E11D48] shadow-lg hover:brightness-95 active:scale-[0.98]'
                : 'bg-[#106574] text-white shadow-lg hover:brightness-110 active:scale-[0.98]'
          }`}
        >
          {t(pkg.ctaText)}
        </button>
      </div>
    </div>
  );
}
