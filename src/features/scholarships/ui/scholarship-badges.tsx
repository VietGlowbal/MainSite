import type { FrequentlyPickedSummary } from '../domain/frequently-picked';
import type { ScholarshipRecommendationResult } from '../domain/recommendation';
import { recommendationReasonLabel } from '../domain/value-formatting';
import { Badge } from '@/shared/ui/badge';
import { useLanguage } from '@/lib/i18n';

export type ScholarshipBadgesProps = {
  recommendation?: ScholarshipRecommendationResult | null | undefined;
  frequentlyPicked?: FrequentlyPickedSummary | null | undefined;
  eligibilityStatus?: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN' | null | undefined;
  showReasons?: boolean;
  className?: string;
};

export function ScholarshipBadges({
  recommendation = null,
  frequentlyPicked = null,
  eligibilityStatus = null,
  showReasons = false,
  className = '',
}: ScholarshipBadgesProps) {
  const { t } = useLanguage();
  const resolvedEligibility = eligibilityStatus ?? recommendation?.reasonData.eligibilityStatus ?? null;
  const reasons = recommendation?.reasonCodes ?? [];
  const warnings = recommendation?.warnings ?? [];
  const showRecommendation = recommendation?.recommended === true;

  return (
    <div className={`flex min-w-0 flex-col gap-gb-sm ${className}`.trim()}>
      <div className="flex flex-wrap items-center gap-gb-sm">
        {showRecommendation ? <Badge variant="recommend">{t('GlowBal Recommend')}</Badge> : null}
        {frequentlyPicked?.isFrequentlyPicked ? (
          <Badge variant="info-chip">{t('Frequently-picked')}</Badge>
        ) : null}
        {resolvedEligibility === 'UNKNOWN' ? (
          <Badge variant="neutral" aria-label={t('Eligibility needs verification')}>
            {t('Eligibility needs verification')}
          </Badge>
        ) : null}
      </div>

      {showReasons && showRecommendation && reasons.length > 0 ? (
        <div aria-label={t('Why recommended')} className="text-gb-xs text-fg-secondary">
          <p className="font-semibold text-fg">{t('Why recommended')}</p>
          <ul className="mt-gb-xxs list-disc space-y-gb-xxs pl-gb-lg">
            {reasons.slice(0, 4).map((reason) => (
              <li key={reason}>{t(recommendationReasonLabel(reason))}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {showReasons && warnings.length > 0 ? (
        <ul aria-label={t('Scholarship warnings')} className="text-gb-xs text-fg-error">
          {warnings.slice(0, 2).map((warning) => <li key={warning.code}>{t(warning.message)}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
