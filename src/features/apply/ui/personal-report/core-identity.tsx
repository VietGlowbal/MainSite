'use client';

import { useT } from '@/lib/i18n';
import type { CoreIdentitySection, PersonalReportV2 } from '../../domain';
import { InsufficientDataCard, SectionShell } from './shared';

export function CoreIdentityView({ section, report, returnTo }: { section: CoreIdentitySection; report?: PersonalReportV2; returnTo: string | undefined }) {
  const t = useT();
  const narrative = report?.narrativeDetails?.coreIdentity;
  const traits = narrative?.definingTraits.length
    ? narrative.definingTraits.map((trait) => ({
        characteristic: trait.characteristic,
        insight: trait.insight,
        whyItMatters: trait.whyItMatters,
        scope: trait.scope,
        confidence: trait.confidence,
        evidenceIds: trait.evidenceIds,
        supportingExperienceTitles: trait.supportingExperienceTitles ?? [],
        evidenceStrength: trait.evidenceStrength ?? (trait.confidence === 'high' ? 'strong' : trait.confidence === 'medium' ? 'moderate' : 'limited'),
        maturity: trait.maturity ?? (trait.scope === 'emerging' ? 'emerging' : 'established'),
      }))
    : section.recurringBehaviours.map((behaviour) => ({
        characteristic: behaviour,
        insight: section.observations.slice(0, 2).join(' ') || t('Recorded in the activity evidence.'),
        whyItMatters: t('This behaviour recurs in the activity record, so it is used as a pattern signal.'),
        scope: 'repeated' as const,
        confidence: section.confidence,
        evidenceIds: section.evidenceRefs.map((ref) => ref.id),
        supportingExperienceTitles: section.observations.slice(0, 3),
        evidenceStrength: section.confidence === 'high' ? 'strong' as const : section.confidence === 'medium' ? 'moderate' as const : 'limited' as const,
        maturity: 'established' as const,
      }));
  const identityStatement = narrative?.identityStatement?.trim() || section.interpretation?.trim() || null;
  const hasIdentityEvidence = Boolean(identityStatement || section.headline || section.observations.length > 0);

  return (
    <SectionShell eyebrow={t('Core Identity')} title={t('Who they consistently are')} confidence={section.confidence}>
      <div className="flex flex-col gap-gb-xl" data-no-auto-translate>
        {hasIdentityEvidence ? (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-gb-md">
                <h3 className="font-display text-gb-display-xs sm:text-gb-display-sm font-bold tracking-gb-display-tight text-fg">
                  {section.headline ?? t('An emerging identity signal')}
                </h3>
                {!section.available ? (
                  <span className="rounded-full border border-line bg-surface-muted px-2 py-1 text-gb-xs font-semibold text-fg-muted">
                    {t('Emerging')} · {section.confidence}
                  </span>
                ) : null}
              </div>
              <p className="mt-gb-sm text-gb-base sm:text-gb-md leading-relaxed text-fg-secondary">
                {identityStatement ?? t('This is a meaningful observation from the available activity evidence, but it is not yet a recurring identity claim.')}
              </p>
            </div>
            {(section.recurringRole || section.valueOrientation) ? (
              <div className="grid gap-gb-lg rounded-gb-xl border border-line bg-surface-muted/60 p-6 sm:grid-cols-2">
                {section.recurringRole ? (
                  <div>
                    <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Recurring role')}</p>
                    <p className="mt-1 text-gb-base font-semibold text-fg">{section.recurringRole}</p>
                  </div>
                ) : null}
                {section.valueOrientation ? (
                  <div>
                    <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Value orientation')}</p>
                    <p className="mt-1 text-gb-base font-semibold text-fg">{section.valueOrientation}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-gb-xl border border-dashed border-line bg-surface-muted/50 p-6">
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Identity statement')}</p>
            <p className="mt-gb-sm text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
              {t('No applicant-specific identity statement is supported by the current evidence.')}
            </p>
          </div>
        )}

        {section.observations.length > 0 ? (
          <div className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('What GlowBal observed')}</p>
            <ul className="flex list-disc flex-col gap-gb-sm pl-gb-xl text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
              {section.observations.map((observation) => <li key={observation}>{observation}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col gap-gb-lg border-t border-line pt-gb-xl">
          <div>
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Defining traits / key characteristics')}</p>
            <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
              {traits.length > 0
                ? t('Each characteristic is tied to source evidence and labelled by maturity. Emerging means the action is meaningful but not yet recurring across independent experiences.')
                : t('No defining characteristic is established yet. Observed signals remain visible as evidence to investigate, not as recurring traits.')}
            </p>
          </div>
          {traits.length > 0 ? (
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {traits.slice(0, 5).map((trait) => (
                <details key={trait.characteristic} open className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
                  <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-gb-sm [&::-webkit-details-marker]:hidden">
                    <h4 className="text-gb-base font-bold text-fg">{trait.characteristic}</h4>
                    <span className="rounded-full border border-line bg-surface-muted px-2 py-1 text-gb-xs font-semibold text-fg-muted">
                      {trait.maturity === 'emerging' ? t('Emerging') : t('Established')} · {trait.evidenceStrength} · {trait.confidence}
                    </span>
                  </summary>
                  <div className="flex flex-col gap-gb-sm pt-gb-sm">
                  <p className="text-gb-sm leading-relaxed text-fg-secondary">
                    <span className="font-semibold text-fg">{t('Evidence')}:</span> {trait.insight}
                  </p>
                  <p className="text-gb-xs text-fg-muted">{trait.evidenceIds.length} {t('source evidence item')}{trait.evidenceIds.length === 1 ? '' : 's'}</p>
                  {trait.supportingExperienceTitles.length > 0 ? (
                    <div className="rounded-gb-lg border border-line/60 bg-surface-muted/70 p-gb-md">
                      <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Supporting activities')}</p>
                      <ul className="mt-1 flex list-disc flex-col gap-gb-xs pl-gb-lg text-gb-xs sm:text-gb-sm text-fg-secondary" data-no-auto-translate>
                        {trait.supportingExperienceTitles.map((title) => <li key={title}>{title}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-auto rounded-gb-lg border border-line/60 bg-surface-muted/70 p-gb-md text-gb-xs sm:text-gb-sm text-fg-secondary">
                    <span className="font-bold text-fg-brand">{t('Why it matters')}:</span> {trait.whyItMatters}
                  </div>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="rounded-gb-xl border border-dashed border-line bg-surface-muted/50 p-6 text-gb-sm leading-relaxed text-fg-secondary">
              {section.observedBehaviours?.length
                ? `${t('Observed signals')}: ${section.observedBehaviours.join('; ')}`
                : t('Add a detailed activity or reflection to establish a characteristic from demonstrated behaviour.')}
            </div>
          )}
        </div>

        {!section.available && section.insufficientData ? <InsufficientDataCard data={section.insufficientData} returnTo={returnTo} /> : null}

        {section.available && section.stillDeveloping.length > 0 ? (
          <p className="text-gb-xs sm:text-gb-sm text-fg-muted">{t('Still developing')}: {section.stillDeveloping.join(' ')}</p>
        ) : null}
      </div>
    </SectionShell>
  );
}
