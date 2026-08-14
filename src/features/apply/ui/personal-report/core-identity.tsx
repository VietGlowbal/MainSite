'use client';

import { useT } from '@/lib/i18n';
import type { CoreIdentitySection } from '../../domain';
import { InsufficientDataCard, SectionShell } from './shared';

export function CoreIdentityView({ section, returnTo }: { section: CoreIdentitySection; returnTo: string | undefined }) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Core Identity')} title={t('Who they consistently are')} confidence={section.confidence}>
      {section.available ? (
        <div className="flex flex-col gap-gb-lg" data-no-auto-translate>
          <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
            {section.headline}
          </h3>
          <p className="text-gb-md leading-relaxed text-fg-tertiary">{section.interpretation}</p>
          <div className="grid gap-gb-lg sm:grid-cols-3">
            {section.recurringRole ? (
              <div>
                <p className="text-gb-xs text-fg-muted">{t('Recurring role')}</p>
                <p className="text-gb-sm text-fg">{section.recurringRole}</p>
              </div>
            ) : null}
            {section.valueOrientation ? (
              <div>
                <p className="text-gb-xs text-fg-muted">{t('Value orientation')}</p>
                <p className="text-gb-sm text-fg">{section.valueOrientation}</p>
              </div>
            ) : null}
          </div>
          {section.recurringBehaviours.length > 0 ? (
            <div className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('What GlowBal observed')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary">
                {section.observations.map((observation) => (
                  <li key={observation}>{observation}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {section.stillDeveloping.length > 0 ? (
            <p className="text-gb-xs text-fg-muted">
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
