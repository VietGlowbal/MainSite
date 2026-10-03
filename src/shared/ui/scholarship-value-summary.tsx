import type {
  ScholarshipTextTranslator,
  ScholarshipValueViewModel,
} from '@/shared/types/scholarship-value';
import { canonicalizeExternalUrl } from '@/shared/lib/external-url';

export type SharedScholarshipValueSummaryProps = {
  model: ScholarshipValueViewModel;
  compact?: boolean;
  showBreakdown?: boolean;
  showEvidence?: boolean;
  className?: string;
  /** Legacy display fallback used only when no canonical amount is available. */
  fallbackAwardLabel?: string | null | undefined;
  /** Route-provided translation function; the shared renderer owns no catalog. */
  t?: ScholarshipTextTranslator;
};

function ValueStatus({
  model,
  t,
}: {
  model: ScholarshipValueViewModel;
  t: ScholarshipTextTranslator;
}) {
  if (model.totalValueKind === 'unavailable') {
    return <span className="text-gb-xs font-medium text-fg-muted">{t('Value unavailable')}</span>;
  }
  return (
    <span
      className="text-gb-xs font-semibold text-fg-secondary"
      aria-label={`${t('Value status')}: ${model.totalValueStatusLabel ? t(model.totalValueStatusLabel) : ''}`}
    >
      {model.totalValueStatusLabel ? t(model.totalValueStatusLabel) : null}
    </span>
  );
}

export function SharedScholarshipValueSummary({
  model,
  compact = false,
  showBreakdown = false,
  showEvidence = false,
  className = '',
  fallbackAwardLabel = null,
  t = (source) => source,
}: SharedScholarshipValueSummaryProps) {
  const visibleComponents = model.components.filter((component) => component.included || !compact);

  return (
    <section
      aria-label={t('Scholarship value')}
      className={`flex min-w-0 flex-col gap-gb-sm ${className}`.trim()}
    >
      <div className="flex min-w-0 flex-col gap-gb-xxs">
        {model.coverageLabel ? (
          <p className="text-gb-sm font-semibold text-fg-brand">{model.coverageLabel}</p>
        ) : null}
        {model.originalAwardLabel || fallbackAwardLabel ? (
          <p className="text-gb-sm font-semibold text-fg">
            {model.originalAwardLabel ?? fallbackAwardLabel}
          </p>
        ) : null}
        <p
          className={`${compact ? 'text-gb-md' : 'text-gb-xl'} font-semibold tracking-tight text-fg-brand`}
          aria-label={model.totalValueLabel}
        >
          {model.totalValueLabel}
        </p>
        {!compact ? <ValueStatus model={model} t={t} /> : null}
      </div>

      {model.durationLabel ? (
        <p className="text-gb-xs text-fg-tertiary">{t('Award duration:')} {model.durationLabel}</p>
      ) : null}

      {showBreakdown && visibleComponents.length > 0 ? (
        <div className="border-t border-line pt-gb-md">
          <h4 className="text-gb-xs font-semibold uppercase tracking-wide text-fg-secondary">
            {t('Benefit breakdown')}
          </h4>
          <ul className="mt-gb-sm flex flex-col gap-gb-sm" aria-label={t('Benefit breakdown')}>
            {visibleComponents.map((component, index) => (
              <li key={`${component.type}-${index}`} className="flex min-w-0 items-start justify-between gap-gb-lg text-gb-sm">
                <span className="min-w-0 text-fg-secondary">
                  {component.label}
                  {component.periodLabel ? ` ${component.periodLabel}` : ''}
                  {component.durationLabel ? ` × ${component.durationLabel}` : ''}
                  {!component.included ? ` (${t('alternative')})` : ''}
                </span>
                <span className="shrink-0 text-right font-medium text-fg">
                  {component.totalLabel ?? component.amountLabel ?? t('Amount unavailable')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && model.warnings.length > 0 ? (
        <p role="note" className="text-gb-xs text-fg-error">
          {model.totalValueKind === 'unavailable'
            ? t('The available evidence is not sufficient to calculate a defensible total.')
            : t('Some value components use incomplete or estimated evidence.')}
        </p>
      ) : null}

      {showEvidence && (model.evidence.length > 0 || model.sourceUrl) ? (
        <details className="border-t border-line pt-gb-sm text-gb-xs text-fg-tertiary">
          <summary className="cursor-pointer font-semibold text-fg-secondary">{t('Sources and evidence')}</summary>
          <ul className="mt-gb-sm flex list-disc flex-col gap-gb-xs pl-gb-lg">
            {model.evidence.map((evidence, index) => (
              <li key={`${evidence.sourceField}-${index}`}>
                {evidence.excerpt}
                {canonicalizeExternalUrl(evidence.sourceUrl) ? (
                  <a className="ml-gb-xs text-brand underline" href={canonicalizeExternalUrl(evidence.sourceUrl)!} target="_blank" rel="noreferrer noopener">
                    {t('Source')}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          {canonicalizeExternalUrl(model.sourceUrl) ? (
            <a className="mt-gb-sm inline-flex text-brand underline" href={canonicalizeExternalUrl(model.sourceUrl)!} target="_blank" rel="noreferrer noopener">
              {t('Official scholarship source')}
            </a>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}
