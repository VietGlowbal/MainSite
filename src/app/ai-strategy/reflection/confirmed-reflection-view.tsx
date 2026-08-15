'use client';

import {
  EDUCATION_LEVEL_META,
  destinationFlag,
  destinationLabel,
  formatBudgetRange,
  fundingSourceLabel,
  isCompleteBudget,
  subjectById,
  type FundingSourceId,
  type ReflectionValues,
} from '@/features/apply/domain';
import { localizeIntakeCopy } from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { Button, Panel } from '@/shared/ui';

/**
 * Reflections, after confirmation — a finished profile summary, not a
 * disabled questionnaire.
 *
 * No inputs, no Next/Back, no question tracker: the questionnaire is over. A
 * student who lands here (directly, because the browser Back button
 * resurfaced an old `/ai-strategy/reflection` URL after confirming, or
 * because a NEW application's onboarding CTA sent them here while this
 * globally-shared profile was already confirmed from an earlier application)
 * sees exactly what they confirmed and nothing they can change — the route
 * guard in `page.tsx` is what decides they land here at all. `continueHref`
 * is what gets them back out again, since there is otherwise no forward
 * navigation on this screen at all — landing here used to be a dead end for
 * a student opening a second application, reported live 2026-08-13. It is
 * computed by the page via `confirmedReflectionContinueHref` — report
 * generation while this application's reports are still pending, or
 * straight to the Personal Report once they exist — rather than a raw
 * `returnTo`, which used to point at the analysis gate even after reports
 * already existed (reported live 2026-08-14).
 *
 * A client component, like every other reflection page in this feature, so
 * it can use `useT()` directly rather than sprinkling `<T k="…" />` islands
 * through a page that is almost entirely translated static labels.
 */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex flex-col gap-gb-xxs">
      <p className="text-gb-xs text-fg-tertiary">{label}</p>
      <p className="text-gb-sm text-fg">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel as="section" className="flex flex-col gap-gb-xl">
      <h2 className="text-gb-md font-semibold text-fg">{title}</h2>
      <div className="grid gap-gb-lg sm:grid-cols-2">{children}</div>
    </Panel>
  );
}

export function ConfirmedReflectionView({
  values,
  confirmedAt,
  continueHref,
}: {
  values: ReflectionValues;
  confirmedAt: string;
  continueHref?: string | undefined;
}) {
  const t = useT();
  const confirmedDate = new Date(confirmedAt).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const educationLabel =
    values.highestEducation === 'Other'
      ? values.otherEducation
      : values.highestEducation
        ? `${t(values.highestEducation)} (${t(EDUCATION_LEVEL_META[values.highestEducation].hint)})`
        : undefined;

  const subjectLabels = values.majors.map((id) => t(subjectById(id)?.label ?? id));
  const countryLabels = values.countries.map(
    (id) => `${destinationFlag(id)} ${destinationLabel(id)}`,
  );

  const primarySubject = values.primaryMotivationSubject;
  const motivationEntries = Object.entries(values.subjectMotivations ?? {});
  const primaryMotivation =
    (primarySubject && values.subjectMotivations?.[primarySubject]) ?? values.studyMotivation;
  const moreMotivations = motivationEntries.length > 1 ? motivationEntries.length - 1 : 0;

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="rounded-gb-xl border border-tier-safe bg-tier-safe/10 px-gb-xl py-gb-lg">
        <p className="flex items-center gap-gb-sm text-gb-sm font-semibold text-on-tier-safe">
          <span aria-hidden="true">✓</span> {t('Confirmed profile')}
        </p>
        <p className="mt-gb-xxs text-gb-sm text-fg-secondary">
          {t('This information was confirmed on {date} and is used to generate your reports.', {
            date: confirmedDate,
          })}
        </p>
        {continueHref ? (
          <Button href={continueHref} size="sm" className="mt-gb-lg">
            {t('Continue')}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-gb-xs">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {t('Candidate information')}
        </h1>
        <p className="text-gb-sm text-fg-tertiary">{t('All fields are read-only.')}</p>
      </div>

      <Section title={t('Personal information')}>
        <Field label={t('Highest level of education')} value={educationLabel} />
        <Field label={t('Nationality')} value={values.nationality} />
      </Section>

      <Section title={t('Academic profile')}>
        <Field label={t('GPA / equivalent')} value={values.gpa} />
        {values.gpaSource ? <Field label={t('Original grades')} value={values.gpaSource} /> : null}
        <Field label={t('IELTS / English test')} value={values.ielts} />
        <Field label={t('SAT / other test scores')} value={values.englishTestScore} />
      </Section>

      <Section title={t('Study preferences')}>
        <Field
          label={t('Subjects')}
          value={subjectLabels.length > 0 ? subjectLabels.join(', ') : undefined}
        />
        <Field
          label={t('Countries')}
          value={
            countryLabels.length > 0
              ? countryLabels.join(', ')
              : values.countryPreferenceFlexible
                ? t('Open to suggestions')
                : undefined
          }
        />
        <Field label={t('Study level')} value={values.intendedLevel ? t(values.intendedLevel) : undefined} />
        <Field
          label={t('Preferred intake')}
          value={values.intake ? localizeIntakeCopy(values.intake, t).label : undefined}
        />
      </Section>

      <Section title={t('Aspirations')}>
        <Field label={t('After graduation')} value={values.careerGoal} />
        {primaryMotivation ? (
          <Field
            label={
              primarySubject
                ? t('Why {subject}', { subject: t(subjectById(primarySubject)?.label ?? primarySubject) })
                : t('Subject motivation')
            }
            value={primaryMotivation}
          />
        ) : null}
        {moreMotivations > 0 ? (
          <p className="text-gb-xs text-fg-tertiary sm:col-span-2">
            {t('{count} more subject motivations on file.', { count: moreMotivations })}
          </p>
        ) : null}
      </Section>

      <Section title={t('Financial plan')}>
        <Field
          label={t('Funding')}
          value={
            values.fundingSource ? t(fundingSourceLabel(values.fundingSource as FundingSourceId)) : undefined
          }
        />
        <Field
          label={t('Annual tuition budget')}
          value={isCompleteBudget(values.tuitionBudget) ? formatBudgetRange(values.tuitionBudget) : undefined}
        />
      </Section>

      <p className="rounded-gb-lg bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-tertiary">
        {t('Need to make a change? Contact GlowBal Support if something in your confirmed information is incorrect.')}
      </p>
    </div>
  );
}
