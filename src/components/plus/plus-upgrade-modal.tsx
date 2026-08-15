'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';
import {
  PLUS_DISPLAY_CURRENCIES,
  type DisplayCurrency,
  formatPlanPrice,
  PLUS_PACKAGES,
  type PlusPlanId,
  currencyLabel,
} from '@/lib/plus';
import { TermsModal } from '@/components/legal/terms-modal';

type PlusModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
};

const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  VND: '₫',
  USD: '$',
  GBP: '£',
  EUR: '€',
  CNY: '¥',
};

export function PlusUpgradeModal({
  open,
  onClose,
  title,
  subtitle,
}: PlusModalProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [selectedPlanId, setSelectedPlanId] = useState<PlusPlanId>('plus-pro');
  const [currency, setCurrency] = useState<DisplayCurrency>('VND');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleStartCheckout = () => {
    if (!agreedTerms) return;
    setSubmitting(true);
    router.push(`/plus?plan=${selectedPlanId}&currency=${currency}`);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        label={t('Upgrade to GlowBal Plus')}
        className="max-w-4xl lg:max-w-5xl w-full p-0 overflow-hidden"
      >
        <div className="flex flex-col max-h-[88vh] bg-white">
          {/* Header */}
          <div className="relative border-b border-[#EDE9EE] px-6 py-5 bg-gradient-to-br from-[#FFF5F7] via-[#FFF] to-[#FFF0F3] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-[#6B6570] hover:bg-[#EDE9EE] hover:text-[#141118] transition-colors cursor-pointer"
              aria-label={t('Close')}
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E11D48]/10 px-3 py-0.5 text-xs font-bold text-[#E11D48]">
                ✨ GLOWBAL PLUS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#141118]">
              {title || t('Upgrade to GlowBal Plus')}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#6B6570] max-w-2xl leading-relaxed">
              {subtitle ||
                t(
                  'Upgrade to GlowBal Plus to browse all 3000+ scholarships worldwide, unlock advanced filtering and tailored application requirements.',
                )}
            </p>

            {/* Currency selector */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-[#6B6570]">
                {t('Show prices in:')}
              </span>
              <div className="inline-flex rounded-lg border border-[#EDE9EE] bg-white p-0.5 shadow-xs">
                {PLUS_DISPLAY_CURRENCIES.map((c: DisplayCurrency) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                      currency === c
                        ? 'bg-[#E11D48] text-white shadow-xs'
                        : 'text-[#6B6570] hover:text-[#141118]'
                    }`}
                  >
                    {CURRENCY_SYMBOLS[c]} {currencyLabel(c)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body: 3 Plans Grid */}
          <div className="overflow-y-auto px-6 py-6 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch pt-2">
              {PLUS_PACKAGES.map((pkg) => {
                const isSelected = selectedPlanId === pkg.id;
                const isHero = pkg.highlighted;

                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPlanId(pkg.id)}
                    className={`relative flex flex-col justify-between rounded-2xl p-5 cursor-pointer transition-all duration-200 border-2 ${
                      isSelected
                        ? 'border-[#E11D48] bg-[#FFF8FA] shadow-lg ring-2 ring-[#E11D48]/20'
                        : isHero
                        ? 'border-[#E11D48]/40 bg-white hover:border-[#E11D48] hover:shadow-md'
                        : 'border-[#EDE9EE] bg-white hover:border-[#D0CAD3] hover:shadow-sm'
                    }`}
                  >
                    {/* Floating Badge */}
                    {pkg.badge && (
                      <div
                        className={`absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold tracking-wide whitespace-nowrap shadow-md ${
                          pkg.badgeType === 'save'
                            ? 'bg-[#E11D48] text-white'
                            : 'bg-[#106574] text-white'
                        }`}
                      >
                        {t(pkg.badge)}
                      </div>
                    )}

                    <div>
                      {/* Top Header with Tier & Radio */}
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-[#6B6570]">
                          {t(pkg.tierLabel)}
                        </span>
                        <div
                          className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-[#E11D48] bg-[#E11D48]'
                              : 'border-[#D0CAD3] bg-white'
                          }`}
                        >
                          {isSelected && (
                            <span className="text-white text-[11px] font-bold leading-none">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Plan Title */}
                      <h3 className="mt-1 font-extrabold text-[#141118] text-lg">
                        {t(pkg.name)}
                      </h3>

                      {/* Tagline */}
                      <p className="mt-1 text-xs text-[#6B6570] leading-snug min-h-[32px]">
                        {t(pkg.tagline)}
                      </p>

                      {/* Price Section */}
                      <div className="mt-3.5 pb-3 border-b border-[#EDE9EE]">
                        <div className="text-xs line-through text-[#6B6570]/70">
                          {formatPlanPrice(pkg.anchorVnd, currency)}
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <span className="text-2xl lg:text-3xl font-extrabold text-[#141118] tracking-tight">
                            {formatPlanPrice(pkg.amountVnd, currency)}
                          </span>
                          <span className="text-xs font-semibold text-[#6B6570]">
                            {pkg.durationMonths === 1 ? t('/mo') : t('/yr')}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-bold text-[#E11D48]">
                          {t(pkg.perMonthLabel)}
                        </p>
                        {pkg.savePill && (
                          <span className="mt-1.5 inline-block rounded-md bg-[#E11D48]/10 px-2 py-0.5 text-[11px] font-bold text-[#E11D48]">
                            {t(pkg.savePill)}
                          </span>
                        )}
                      </div>

                      {/* Feature Bullets */}
                      <ul className="mt-4 space-y-2.5">
                        {pkg.bullets.map((bullet, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs text-[#2B2730] leading-relaxed"
                          >
                            <span className="text-[#E11D48] font-bold shrink-0 mt-0.5">
                              {bullet.type === 'gift' ? '🎁' : '✓'}
                            </span>
                            <span>
                              {bullet.text ? t(bullet.text) : ''}
                              {bullet.strong ? (
                                <strong className="font-semibold text-[#141118]">
                                  {' '}
                                  {t(bullet.strong)}
                                </strong>
                              ) : null}
                              {bullet.extra ? (
                                <span className="text-[#6B6570]"> {t(bullet.extra)}</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Terms Checkbox */}
            <div className="mt-6 rounded-xl border border-[#EDE9EE] bg-[#FBF9FA] p-3.5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="plus-modal-agree-terms"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 size-4.5 rounded border-2 border-gray-300 accent-[#E11D48] text-[#E11D48] cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-[#2B2730] leading-relaxed">
                  {t('I have read and agree to the')}{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTermsModal(true);
                    }}
                    className="font-bold text-[#E11D48] underline hover:text-[#B01238] cursor-pointer"
                  >
                    {t('Terms and Conditions of Use')}
                  </button>{' '}
                  {t('of GlowBal Education.')}
                </span>
              </label>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="border-t border-[#EDE9EE] px-6 py-4 bg-[#FBF9FA] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-[#6B6570] text-center sm:text-left">
              {t(
                'Secure checkout with instant activation · 100% money-back guarantee within 7 days.',
              )}
            </p>
            <button
              type="button"
              disabled={!agreedTerms || submitting}
              onClick={handleStartCheckout}
              className={`w-full sm:w-auto rounded-xl px-7 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer ${
                agreedTerms && !submitting
                  ? 'bg-[#E11D48] hover:bg-[#B01238] hover:shadow-lg active:scale-[0.99]'
                  : 'bg-slate-300 cursor-not-allowed opacity-70'
              }`}
            >
              {submitting
                ? t('Starting checkout…')
                : `${t('Upgrade to GlowBal Plus')} →`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Full Terms and Conditions Dialog */}
      <TermsModal
        open={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </>
  );
}
