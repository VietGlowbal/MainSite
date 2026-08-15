'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';
import {
  PLUS_DISPLAY_CURRENCIES,
  type DisplayCurrency,
  formatPlanPrice,
} from '@/lib/plus';
import { TermsModal } from '@/components/legal/terms-modal';

type PlusTier = 'plus-starter' | 'plus-pro' | 'plus-master';

type PlusModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
};

const PLAN_AMOUNTS_VND: Record<PlusTier, number> = {
  'plus-starter': 349000,
  'plus-pro': 2490000,
  'plus-master': 4500000,
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

  const [selectedTier, setSelectedTier] = useState<PlusTier>('plus-pro');
  const [currency, setCurrency] = useState<DisplayCurrency>('VND');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getTierDisplay = (tier: PlusTier) => {
    switch (tier) {
      case 'plus-starter':
        return {
          title: t('GlowBal Monthly'),
          tagline: t('Start finding your direction — no commitment yet.'),
          priceDisplay: formatPlanPrice(PLAN_AMOUNTS_VND['plus-starter'], currency),
          period: t('/mo'),
          monthlyEquivalent: null,
          badge: null,
          bullets: [
            t('Easy / Target / Reach school matching — know exactly where you stand'),
            t('Deadline reminders so you never miss a submission'),
            t('AI CV / SOP review'),
          ],
        };
      case 'plus-pro':
        return {
          title: t('GlowBal Yearly'),
          tagline: t('By your side all season — no more ceilings.'),
          priceDisplay: formatPlanPrice(PLAN_AMOUNTS_VND['plus-pro'], currency),
          period: t('/yr'),
          monthlyEquivalent: t('Just 207,000₫/month'),
          badge: t('🏆 Best value'),
          bullets: [
            t('Everything in Monthly,'),
            t('Unlimited roadmap + CV/SOP edits —'),
            t('Scholarship matching + real-time progress tracking'),
            t('3 free 1-on-1 sessions'),
          ],
        };
      case 'plus-master':
        return {
          title: t('GlowBal Premium'),
          tagline: t('Stop carrying it alone — real experts stand behind your application.'),
          priceDisplay: formatPlanPrice(PLAN_AMOUNTS_VND['plus-master'], currency),
          period: t('/yr'),
          monthlyEquivalent: t('375,000₫/month'),
          badge: t('⭐ Most complete'),
          bullets: [
            t('Everything in Yearly — plus'),
            t('Strategy reviewed by a'),
            t('An expert checks your'),
            t('5 one-on-one sessions'),
            t('Priority support — someone’s always there when you need them'),
          ],
        };
    }
  };

  const handleStartCheckout = () => {
    if (!agreedTerms) return;
    setSubmitting(true);
    router.push(`/plus?plan=${selectedTier}&currency=${currency}`);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        label={t('Upgrade to GlowBal Plus')}
        className="max-w-4xl p-0 overflow-hidden"
      >
        <div className="flex flex-col max-h-[90vh] bg-white">
          {/* Header */}
          <div className="relative border-b border-[#EDE9EE] px-6 py-5 bg-gradient-to-br from-[#FFF5F7] via-[#FFF] to-[#FFF0F3]">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-[#6B6570] hover:bg-[#EDE9EE] hover:text-[#141118] transition-colors cursor-pointer"
              aria-label={t('Close')}
            >
              ✕
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E11D48]/10 px-2.5 py-0.5 text-xs font-bold text-[#E11D48]">
                ✨ GLOWBAL PLUS
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#141118]">
              {title || t('Upgrade to GlowBal Plus')}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#6B6570] max-w-xl">
              {subtitle || t('Upgrade to GlowBal Plus to browse all 3000+ scholarships worldwide, unlock advanced filtering and tailored application requirements.')}
            </p>

            {/* Currency selector */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#6B6570]">
                {t('Show prices in:')}
              </span>
              <div className="flex rounded-lg border border-[#EDE9EE] bg-white p-0.5 shadow-xs">
                {PLUS_DISPLAY_CURRENCIES.map((c: DisplayCurrency) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      currency === c
                        ? 'bg-[#E11D48] text-white shadow-xs'
                        : 'text-[#6B6570] hover:text-[#141118]'
                    }`}
                  >
                    {CURRENCY_SYMBOLS[c]} {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body: 3 Plans */}
          <div className="overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['plus-starter', 'plus-pro', 'plus-master'] as PlusTier[]).map((tier) => {
                const info = getTierDisplay(tier);
                const isSelected = selectedTier === tier;
                const isPopular = tier === 'plus-pro';

                return (
                  <div
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`relative flex flex-col justify-between rounded-2xl p-5 cursor-pointer transition-all border-2 ${
                      isSelected
                        ? 'border-[#E11D48] bg-[#FFF8FA] shadow-md ring-1 ring-[#E11D48]/30'
                        : isPopular
                        ? 'border-[#E11D48]/30 bg-white hover:border-[#E11D48]/60 hover:shadow-sm'
                        : 'border-[#EDE9EE] bg-white hover:border-[#D0CAD3] hover:shadow-xs'
                    }`}
                  >
                    {info.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E11D48] px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
                        {info.badge}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-[#141118] text-base">
                          {info.title}
                        </h3>
                        <div
                          className={`size-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-[#E11D48] bg-[#E11D48]'
                              : 'border-[#6B6570]/40'
                          }`}
                        >
                          {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-[#6B6570] leading-snug">
                        {info.tagline}
                      </p>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-[#141118]">
                          {info.priceDisplay}
                        </span>
                        <span className="text-xs font-medium text-[#6B6570]">
                          {info.period}
                        </span>
                      </div>

                      {info.monthlyEquivalent && (
                        <p className="mt-0.5 text-xs font-semibold text-[#E11D48]">
                          {info.monthlyEquivalent}
                        </p>
                      )}

                      <ul className="mt-4 space-y-2 border-t border-[#EDE9EE]/60 pt-4">
                        {info.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-[#2B2730]">
                            <span className="text-[#E11D48] font-bold shrink-0">✓</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Terms checkbox */}
            <div className="mt-6 rounded-xl border border-[#EDE9EE] bg-[#FBF9FA] p-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 size-4.5 rounded border-2 border-line-strong accent-[#E11D48] cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-[#2B2730]">
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
          <div className="border-t border-[#EDE9EE] px-6 py-4 bg-[#FBF9FA] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#6B6570]">
              {t('Secure checkout with instant activation · 100% money-back guarantee within 7 days.')}
            </p>
            <button
              type="button"
              disabled={!agreedTerms || submitting}
              onClick={handleStartCheckout}
              className={`w-full sm:w-auto rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all cursor-pointer ${
                agreedTerms && !submitting
                  ? 'bg-[#E11D48] hover:bg-[#B01238] hover:shadow-lg'
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

      {/* Embedded Terms Modal */}
      <TermsModal
        open={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </>
  );
}
