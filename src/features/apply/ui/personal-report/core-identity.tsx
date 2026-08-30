'use client';

import { useT } from '@/lib/i18n';
import type { CoreIdentitySection, PersonalReportV2 } from '../../domain';
import { InsufficientDataCard, SectionShell } from './shared';

export function CoreIdentityView({ section, report, returnTo }: { section: CoreIdentitySection; report?: PersonalReportV2; returnTo: string | undefined }) {
  const t = useT();
  const narrative = report?.narrativeDetails?.coreIdentity;
  const traits = narrative?.definingTraits.length
    ? narrative.definingTraits.map((trait) => ({ characteristic: trait.characteristic, insight: trait.insight, whyItMatters: trait.whyItMatters }))
    : section.recurringBehaviours.map((behaviour) => ({
        characteristic: behaviour,
        insight: section.observations.slice(0, 2).join(' ') || t('Recorded in the activity evidence.'),
        whyItMatters: t('This behaviour recurs in the activity record, so it is used as a pattern signal.'),
      }));
  return (
    <SectionShell eyebrow={t('Core Identity')} title={t('Who they consistently are')} confidence={section.confidence}>
      {section.available ? (
        <div className="flex flex-col gap-gb-xl" data-no-auto-translate>
          <div>
            <h3 className="font-display text-gb-display-xs sm:text-gb-display-sm font-bold tracking-gb-display-tight text-fg">
              {section.headline}
            </h3>
            <p className="mt-gb-sm text-gb-base sm:text-gb-md leading-relaxed text-fg-secondary">{narrative?.identityStatement ?? section.interpretation}</p>
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

          {traits.length > 0 ? (
            <div className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
              <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                {t('What GlowBal observed')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-sm pl-gb-xl text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
                {section.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {traits.length > 0 ? (
            <div className="flex flex-col gap-gb-lg border-t border-line pt-gb-xl">
              <div>
                <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                  {t('Defining traits / key characteristics')}
                </p>
                <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
                  {t('These characteristics are recurring behaviours extracted from activity evidence, not traits inferred from a single answer.')}
                </p>
              </div>
              <div className="grid gap-gb-lg sm:grid-cols-2">
                {traits.slice(0, 5).map((trait) => (
                  <article key={trait.characteristic} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
                    <h4 className="text-gb-base font-bold text-fg">{trait.characteristic}</h4>
                    <p className="text-gb-sm leading-relaxed text-fg-secondary">
                      <span className="font-semibold text-fg">{t('Evidence')}:</span>{' '}{trait.insight}
                    </p>
                    <div className="mt-auto rounded-gb-lg border border-line/60 bg-surface-muted/70 p-gb-md text-gb-xs sm:text-gb-sm text-fg-secondary">
                      <span className="font-bold text-fg-brand">{t('Why it matters')}:</span>{' '}{trait.whyItMatters}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {section.stillDeveloping.length > 0 ? (
            <p className="text-gb-xs sm:text-gb-sm text-fg-muted">
              {t('Still developing')}: {section.stillDeveloping.join(' ')}
            </p>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} />
      )}
    </SectionShell>
  );
}
