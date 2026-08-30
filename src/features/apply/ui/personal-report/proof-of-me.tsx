'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportAnalytics, ProofOfMeSection, ReportOverallSummary } from '../../domain';
import { Badge, DonutChart } from '@/shared/ui';
import { InsufficientDataCard, SectionShell } from './shared';

const VERIFICATION_LABEL: Record<string, string> = {
  verified: 'Verified',
  attributable: 'Checkable',
  stated: 'Self-reported',
};

function EvidenceSummaryCharts({ evidenceSummary }: { evidenceSummary: PersonalReportAnalytics['evidenceSummary'] }) {
  const t = useT();
  return (
    <div className="grid gap-gb-2xl border-t border-line pt-gb-xl sm:grid-cols-3">
      <div className="flex flex-col items-center gap-gb-sm">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Evidence verification')}</p>
        <DonutChart
          ariaLabel={t('Evidence verification')}
          centerLabel={String(evidenceSummary.totalItems)}
          segments={[
            { key: 'verified', label: t('Verified'), value: evidenceSummary.verification.verified, color: 'var(--color-gb-tier-safe)' },
            { key: 'attributable', label: t('Checkable'), value: evidenceSummary.verification.attributable, color: 'var(--color-gb-blue-600)' },
            { key: 'stated', label: t('Self-reported'), value: evidenceSummary.verification.stated, color: 'var(--color-gb-neutral-400)' },
          ]}
        />
      </div>
      <div className="flex flex-col items-center gap-gb-sm">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Evidence strength')}</p>
        <DonutChart
          ariaLabel={t('Evidence strength')}
          segments={[
            { key: 'strong', label: t('Strong'), value: evidenceSummary.strength.strong, color: 'var(--color-gb-tier-safe)' },
            { key: 'moderate', label: t('Moderate'), value: evidenceSummary.strength.moderate, color: 'var(--color-gb-yellow-400)' },
            { key: 'limited', label: t('Limited'), value: evidenceSummary.strength.limited, color: 'var(--color-gb-brand-600)' },
          ]}
        />
      </div>
      <div className="flex flex-col items-center gap-gb-sm">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Competency claims')}</p>
        <DonutChart
          ariaLabel={t('Competency claims')}
          segments={[
            { key: 'hard', label: t('Hard skill'), value: evidenceSummary.competencyClaims.hard },
            { key: 'soft', label: t('Soft skill'), value: evidenceSummary.competencyClaims.soft },
            { key: 'meta', label: t('Meta skill'), value: evidenceSummary.competencyClaims.meta },
          ]}
        />
      </div>
    </div>
  );
}

export function ProofOfMeView({
  section,
  evidenceSummary,
  overallSummary,
  returnTo,
}: {
  section: ProofOfMeSection;
  /** Undefined for a report version generated before analytics existed — see `PersonalReportV2.analytics`. */
  evidenceSummary: PersonalReportAnalytics['evidenceSummary'] | undefined;
  overallSummary: ReportOverallSummary | null | undefined;
  returnTo: string | undefined;
}) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Proof of Me')} title={t('The evidence behind every claim above')}>
      {section.available ? (
        <div className="flex flex-col gap-gb-2xl">
          {section.narrative ? (
            <p className="text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary" data-no-auto-translate>
              {section.narrative}
            </p>
          ) : null}
          <div className="grid gap-gb-lg sm:grid-cols-2">
            {section.cards.map((card) => (
              <div key={card.activityId} className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-6 shadow-xs" data-no-auto-translate>
                <div className="flex flex-wrap items-start justify-between gap-gb-md">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-gb-base sm:text-gb-md font-bold text-fg leading-snug">{card.title}</h3>
                    {card.role ? <p className="mt-0.5 text-gb-xs font-medium text-fg-muted">{card.role}</p> : null}
                  </div>
                  <Badge variant={card.evidenceStrength === 'strong' ? 'safe-chip' : 'neutral-chip'}>
                    {t('Evidence')}: {card.evidenceStrength}
                  </Badge>
                </div>
                {card.personalContribution ? (
                  <p className="text-gb-sm leading-relaxed text-fg-secondary">{card.personalContribution}</p>
                ) : null}
                {card.outcome ? <p className="text-gb-sm font-semibold text-fg">{card.outcome}</p> : null}
                {card.competenciesDemonstrated.length > 0 ? (
                  <div className="flex flex-wrap gap-gb-xs">
                    {card.competenciesDemonstrated.map((competency) => (
                      <Badge key={competency} variant="brand-chip">
                        {competency}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {card.supports.length > 0 ? (
                  <p className="text-gb-xs text-fg-muted">
                    <span className="font-semibold text-fg">{t('Supports')}:</span> {card.supports.join(', ')}
                  </p>
                ) : null}
                {[card.organisation, card.level, card.year?.toString(), card.period, card.competition].some(Boolean) || (card.sources?.length ?? 0) > 0 ? (
                  <div className="grid gap-x-gb-lg gap-y-gb-xs border-t border-line/60 pt-gb-sm text-gb-xs text-fg-secondary sm:grid-cols-2">
                    {card.organisation ? <p><span className="font-semibold text-fg">{t('Organisation')}:</span> {card.organisation}</p> : null}
                    {card.level ? <p><span className="font-semibold text-fg">{t('Level')}:</span> {card.level}</p> : null}
                    {card.year ? <p><span className="font-semibold text-fg">{t('Year')}:</span> {card.year}</p> : null}
                    {card.period ? <p><span className="font-semibold text-fg">{t('Period')}:</span> {card.period}</p> : null}
                    {card.competition ? <p><span className="font-semibold text-fg">{t('Competition')}:</span> {card.competition}</p> : null}
                    {(card.sources?.length ?? 0) > 0 ? <p><span className="font-semibold text-fg">{t('Supporting documents')}:</span> {card.sources?.length}</p> : null}
                  </div>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-gb-md border-t border-line/60 pt-gb-sm">
                  <Badge variant="neutral-chip">{t(VERIFICATION_LABEL[card.verificationStatus] ?? card.verificationStatus)}</Badge>
                  {card.evidenceSource ? (
                    <span className="text-gb-xs font-medium text-fg-muted">{card.evidenceSource}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {evidenceSummary ? <EvidenceSummaryCharts evidenceSummary={evidenceSummary} /> : null}

          {overallSummary && overallSummary.paragraphs.length > 0 ? (
            <div className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface-muted/60 p-6 sm:p-7" data-no-auto-translate>
              <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                {t('What this report suggests overall')}
              </p>
              {overallSummary.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} />
      )}
    </SectionShell>
  );
}
