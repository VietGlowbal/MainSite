'use client';

import { PERSONAL_REFLECTION_QUESTIONS } from '@/features/apply/domain';
import { useT } from '@/lib/i18n';
import { Button, Panel, PanelHeader } from '@/shared/ui';

/** Read-only view once this application's candidate information is confirmed. */
export function ConfirmedPersonalReflectionView({
  answers,
  confirmedAt,
  continueHref,
}: {
  answers: Record<string, string | undefined> | undefined;
  confirmedAt: string;
  continueHref?: string | undefined;
}) {
  const t = useT();
  const confirmedDate = new Date(confirmedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="flex flex-col gap-gb-xs">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {t('Personal Reflection')}
        </h1>
        <p className="text-gb-sm text-fg-tertiary">
          {t('This was confirmed on {date} and is used to generate your reports.', {
            date: confirmedDate,
          })}
        </p>
      </div>

      {PERSONAL_REFLECTION_QUESTIONS.map((q) => {
        const answer = answers?.[q.key];
        if (!answer) return null;
        return (
          <Panel key={q.key} className="flex flex-col gap-gb-md">
            <PanelHeader title={t(q.heading)} />
            <p className="text-gb-sm text-fg-secondary">{answer}</p>
          </Panel>
        );
      })}

      {continueHref ? (
        <div className="flex justify-end">
          <Button href={continueHref}>{t('Continue')}</Button>
        </div>
      ) : null}
    </div>
  );
}
