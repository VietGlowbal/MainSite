'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ABOUT_QUESTIONS,
  ABOUT_QUESTION_COUNT,
  EDUCATION_LEVELS,
  FUNDING_SOURCES,
  INTAKE_TERMS,
  INTENDED_LEVELS,
  TUITION_BUDGETS_USD,
  VND_PER_USD,
  aboutQuestionProgress,
  parseBudgetBand,
  reflectionStep,
  usdBandFromVndRange,
  vndRangeFromUsdBand,
  type AboutQuestionKey,
  type AboutYouValues,
  type AspirationsValues,
} from '@/features/apply/domain';
import { ReflectionSection, ReflectionShell } from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { NATIONALITIES } from '@/lib/nationalities';
import { regions, subjectFamilies } from '@/lib/onboarding-options';
import { Button, Input, MultiSelect, RangeHistogram, Select, Textarea } from '@/shared/ui';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

/**
 * Reflection step 1 — personal and study information, asked one question at a
 * time.
 *
 * ─── WHY A WIZARD AND NOT ONE LONG FORM ──────────────────────────────────────
 *
 * It was a single page of twelve controls under three headings. Owner
 * direction: ask them one at a time and let the bar fill as the student goes.
 * The order and the grouping live in `ABOUT_QUESTIONS`
 * (`features/apply/domain/reflection-steps.ts`) rather than in this file's JSX,
 * so the progress maths and the screen sequence cannot disagree — the same
 * reason the step count is one file.
 *
 * ─── ALL ANSWERS SAVE AT THE END, NOT PER SCREEN ─────────────────────────────
 *
 * One PATCH on the final question, exactly as before. Saving per screen would
 * be twelve round trips for a form that is already prefilled from the profile,
 * and a half-finished walk would leave the profile in a state the student
 * never confirmed. Moving between questions is local state; nothing is written
 * until they finish the step.
 *
 * ─── NOTHING IS REQUIRED ─────────────────────────────────────────────────────
 *
 * Every question can be skipped with Continue, which is deliberate and matches
 * the schema (every field is `.optional()`). `reflectionCompleteness` already
 * treats an unanswered field as unanswered; blocking the flow on a GPA a
 * student does not have to hand would cost more than the missing value.
 */

/**
 * The bars behind the budget slider.
 *
 * FLAT, AND THAT IS THE POINT. The frame draws a lively distribution, and it
 * would be a few lines to reproduce one — but `RangeHistogram` states the rule
 * plainly in its own source: real data or nothing, because a curve here is a
 * claim about what other students budget, and we have no cohort data to
 * support it. A student reading a peak at 500M VND would reasonably conclude
 * that is what people like them spend.
 *
 * So the bars are uniform: they render the scale the handles move along and
 * assert nothing. When there are enough saved budgets to aggregate without
 * identifying anyone, this becomes a real distribution and the frame's shape
 * arrives honestly.
 */
const BUDGET_BINS = Array.from({ length: 48 }, () => 1);

/** 0 – 2 tỷ VND, the span the frame's chip is inside. */
const BUDGET_MIN_VND = 0;
const BUDGET_MAX_VND = 2_000_000_000;

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} VND`;
}

export type AboutFormValues = AboutYouValues & AspirationsValues;

export function ReflectionAboutForm({ initial }: { initial: AboutFormValues }) {
  const t = useT();
  const router = useRouter();
  /*
   * `onboardingStepHref('personal-summary', applicationId)` builds
   * `?return=<encoded per-application analysis URL>` so that a student who
   * arrived here from a specific application's Overview page ends up back
   * there once reflections are done — see `domain/onboarding.ts`. This page
   * is also reached from many places with no application context (the
   * report chrome's "Reflections" stage link, "Update your reflections"
   * CTAs, the marketing guide), which pass no `return` at all, so the
   * fallback (`reflectionStep('evidence').path`, no query string) is
   * unchanged for them.
   */
  const returnTo = useSearchParams().get('return');
  const [values, setValues] = useState<AboutFormValues>(initial);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLoadingIndicator(saving, t('Saving your information'));

  function set<K extends keyof AboutFormValues>(key: K, value: AboutFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Several fields at once, in one state update.
   *
   * The budget question needs this: moving the slider sets both the VND band
   * and the USD band, and two sequential `set` calls would each build their
   * patch from the same stale `values`, so the second would drop the first.
   */
  function setMany(patch: Partial<AboutFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  const question = ABOUT_QUESTIONS[index];
  const isLast = index === ABOUT_QUESTION_COUNT - 1;

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: values }),
      });

      if (!response.ok) {
        setError('We could not save that. Please try again.');
        setSaving(false);
        return;
      }

      router.push(
        returnTo
          ? `${reflectionStep('evidence').path}?return=${encodeURIComponent(returnTo)}`
          : reflectionStep('evidence').path,
      );
    } catch {
      setError('We could not save that. Please try again.');
      setSaving(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLast) {
      void save();
      return;
    }
    setIndex((prev) => Math.min(prev + 1, ABOUT_QUESTION_COUNT - 1));
  }

  return (
    <ReflectionShell
      step="about"
      progress={aboutQuestionProgress(index)}
      caption={t('Question {current} of {total}', {
        current: index + 1,
        total: ABOUT_QUESTION_COUNT,
      })}
    >
      {/* `key` on the form remounts the controls between questions. Without it
          React reuses the same <input> across two different questions and
          carries the previous one's uncommitted DOM state — most visibly the
          scroll position of the MultiSelect lists. */}
      <form key={question?.key} onSubmit={handleSubmit} className="flex flex-col gap-gb-3xl">
        <ReflectionSection title={t(question?.section ?? '')}>
          {question ? (
            <AboutQuestion
              questionKey={question.key}
              values={values}
              set={set}
              setMany={setMany}
              t={t}
            />
          ) : null}
        </ReflectionSection>

        {error ? <p className="text-gb-sm text-fg-error">{t(error)}</p> : null}

        <div className="flex items-center justify-between gap-gb-xl">
          {/* Back is absent on the first question rather than disabled: there
              is nothing behind it, and a dead control invites the click. */}
          {index > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={saving}
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
            >
              {t('Back')}
            </Button>
          ) : (
            <span />
          )}

          <Button type="submit" size="lg" disabled={saving} className="min-w-48">
            {saving ? t('Saving…') : isLast ? t('Continue') : t('Next')}
          </Button>
        </div>
      </form>
    </ReflectionShell>
  );
}

/**
 * A visible question above a control that has no visible label of its own.
 *
 * `MultiSelect` takes a `label`, but renders it as `aria-label` and never
 * draws it (see its header — the frames it was built from put the question in
 * the surrounding layout). That was fine on a page of labelled fields; with
 * one question per screen it left the student looking at a bare search box
 * with nothing on screen saying what to search for. The `label` prop is still
 * passed for assistive tech; this is the same words, visible.
 */
function QuestionBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-gb-md">
      <p className="text-gb-sm font-semibold text-fg">{label}</p>
      {children}
      {hint ? <p className="text-gb-sm text-fg-tertiary">{hint}</p> : null}
    </div>
  );
}

/** The one control this question needs. Split out so the wizard above stays readable. */
function AboutQuestion({
  questionKey,
  values,
  set,
  setMany,
  t,
}: {
  questionKey: AboutQuestionKey;
  values: AboutFormValues;
  set: <K extends keyof AboutFormValues>(key: K, value: AboutFormValues[K]) => void;
  setMany: (patch: Partial<AboutFormValues>) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // Flattened once per render rather than per option row: `subjectFamilies` is
  // a nested tree and the control wants a flat list.
  const majorOptions = useMemo(
    () =>
      subjectFamilies.flatMap((family) =>
        family.children.map((child) => ({ value: child, label: child })),
      ),
    [],
  );
  const countryOptions = useMemo(
    () => regions.flatMap((region) => region.countries.map((c) => ({ value: c, label: c }))),
    [],
  );

  const [budgetLow, budgetHigh] = parseBudgetBand(
    values.budgetRange,
    BUDGET_MIN_VND,
    BUDGET_MAX_VND,
  );

  switch (questionKey) {
    case 'highestEducation':
      return (
        <Select
          name="highestEducation"
          label={t('What is your highest level of education?')}
          placeholder={t('Select your level')}
          value={values.highestEducation ?? ''}
          onChange={(e) =>
            set(
              'highestEducation',
              (e.target.value || undefined) as AboutFormValues['highestEducation'],
            )
          }
        >
          {EDUCATION_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(level)}
            </option>
          ))}
        </Select>
      );

    case 'nationality':
      // A native <select> rather than the searchable MultiSelect: there are
      // 197 nationalities, MultiSelect's panel is always open by design (see
      // its header), and 197 always-visible rows is a worse control than the
      // one every platform already gives you type-ahead for.
      return (
        <Select
          name="nationality"
          label={t('What is your nationality?')}
          placeholder={t('Select your nationality')}
          value={values.nationality ?? ''}
          onChange={(e) => set('nationality', e.target.value || undefined)}
        >
          {NATIONALITIES.map((nationality) => (
            <option key={nationality} value={nationality}>
              {nationality}
            </option>
          ))}
        </Select>
      );

    case 'gpa':
      // Kept as written rather than parsed to a number: students give these on
      // different scales ("3.5 / 4", "8.7/10"), and normalising at input time
      // would mean guessing which.
      return (
        <Input
          name="gpa"
          label={t('GPA')}
          placeholder="3.5 / 4"
          hint={t('Write it on whichever scale your school uses.')}
          value={values.gpa ?? ''}
          onChange={(e) => set('gpa', e.target.value || undefined)}
        />
      );

    case 'ielts':
      return (
        <Input
          name="ielts"
          label={t('IELTS')}
          placeholder="7 / 10"
          hint={t('Leave this empty if you have not taken it yet.')}
          value={values.ielts ?? ''}
          onChange={(e) => set('ielts', e.target.value || undefined)}
        />
      );

    case 'majors':
      return (
        <QuestionBlock
          label={t('Which subjects are you interested in?')}
          hint={t('Pick as many as you are considering — you can change these later.')}
        >
          <MultiSelect
            name="majors"
            label={t('Which subjects are you interested in?')}
            placeholder={t('Search subjects')}
            options={majorOptions}
            value={values.majors}
            onChange={(next) => set('majors', next)}
            maxVisible={6}
          />
        </QuestionBlock>
      );

    case 'countries':
      return (
        <QuestionBlock
          label={t('Which countries are you interested in?')}
          hint={t('Pick as many as you are considering — you can change these later.')}
        >
          <MultiSelect
            name="countries"
            label={t('Which countries are you interested in?')}
            placeholder={t('Search countries')}
            options={countryOptions}
            value={values.countries}
            onChange={(next) => set('countries', next)}
            maxVisible={6}
          />
        </QuestionBlock>
      );

    case 'intendedLevel':
      // Three cards rather than a dropdown, per the frame. A radiogroup
      // because they are mutually exclusive — the frame's green outline on the
      // chosen one is a selection state, not a checkbox.
      return (
        <fieldset className="flex flex-col gap-gb-md">
          <legend className="mb-gb-md text-gb-sm font-semibold text-fg">
            {t('What is your intended level of study?')}
          </legend>
          <div
            role="radiogroup"
            aria-label={t('Intended level of study')}
            className="flex flex-col gap-gb-md"
          >
            {INTENDED_LEVELS.map((level) => {
              const selected = values.intendedLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set('intendedLevel', selected ? undefined : level)}
                  className={`rounded-gb-xl border px-gb-xl py-gb-lg text-left text-gb-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    selected
                      ? 'border-tier-safe bg-surface font-semibold text-fg'
                      : 'border-line bg-surface text-fg-tertiary hover:border-line-strong'
                  }`}
                >
                  {t(level)}
                </button>
              );
            })}
          </div>
        </fieldset>
      );

    case 'targetIntake':
      return (
        <Select
          name="targetIntake"
          label={t('When do you want to start?')}
          placeholder={t('Select an intake')}
          hint={t('This is what the Planner counts back from when it sets your deadlines.')}
          value={values.targetIntake ?? ''}
          onChange={(e) =>
            set('targetIntake', (e.target.value || undefined) as AboutFormValues['targetIntake'])
          }
        >
          {INTAKE_TERMS.map((term) => (
            <option key={term} value={term}>
              {t(term)}
            </option>
          ))}
        </Select>
      );

    case 'careerGoal':
      return (
        <Textarea
          name="careerGoal"
          label={t('What do you want to do after you graduate?')}
          placeholder={t('A sentence or two is plenty.')}
          hint={t('Your strategy report uses this to judge which direction fits you best.')}
          rows={4}
          value={values.careerGoal ?? ''}
          onChange={(e) => set('careerGoal', e.target.value || undefined)}
        />
      );

    case 'studyMotivation':
      return (
        <Textarea
          name="studyMotivation"
          label={t('Why this subject?')}
          placeholder={t('What got you interested, and what keeps you interested.')}
          hint={t('Your personal report builds its "driving force" section from this.')}
          rows={4}
          value={values.studyMotivation ?? ''}
          onChange={(e) => set('studyMotivation', e.target.value || undefined)}
        />
      );

    case 'fundingSource':
      return (
        <Select
          name="fundingSource"
          label={t('How will your study be funded?')}
          placeholder={t('Select a funding source')}
          value={values.fundingSource ?? ''}
          onChange={(e) =>
            set('fundingSource', (e.target.value || undefined) as AboutFormValues['fundingSource'])
          }
        >
          {FUNDING_SOURCES.map((source) => (
            <option key={source} value={source}>
              {t(source)}
            </option>
          ))}
        </Select>
      );

    case 'budget':
      /*
       * TWO CONTROLS, ONE ANSWER. The slider and the band are the same
       * quantity — annual tuition — in two currencies, and each updates the
       * other. They share a screen for that reason: on separate questions a
       * student would answer in USD, move on, and never see the slider agree.
       *
       * The rate is printed rather than applied silently. It is a fixed
       * constant (`VND_PER_USD`), not a live rate, because a saved budget
       * should not mean something different next week — see the note in
       * domain/reflection.ts.
       */
      return (
        <div className="flex flex-col gap-gb-2xl">
          <RangeHistogram
            min={BUDGET_MIN_VND}
            max={BUDGET_MAX_VND}
            step={10_000_000}
            low={budgetLow}
            high={budgetHigh}
            onChange={({ low, high }) => {
              setMany({
                budgetRange: `${low}-${high}`,
                tuitionBudgetUsd: usdBandFromVndRange(low, high),
              });
            }}
            distribution={BUDGET_BINS}
            label={t('Annual tuition budget')}
            formatValue={(low, high) => `${formatVnd(low)} - ${formatVnd(high)}`}
          />

          <Select
            name="tuitionBudgetUsd"
            label={t('Annual tuition budget (USD)')}
            placeholder={t('Select a band')}
            hint={t('Converted at {rate} VND to 1 USD.', {
              rate: VND_PER_USD.toLocaleString('en-US'),
            })}
            value={values.tuitionBudgetUsd ?? ''}
            onChange={(e) => {
              const band = (e.target.value || undefined) as AboutFormValues['tuitionBudgetUsd'];
              if (!band) {
                set('tuitionBudgetUsd', undefined);
                return;
              }
              const { low, high } = vndRangeFromUsdBand(band, BUDGET_MAX_VND);
              setMany({ tuitionBudgetUsd: band, budgetRange: `${low}-${high}` });
            }}
          >
            {TUITION_BUDGETS_USD.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </Select>
        </div>
      );
  }

  // `questionKey` is a closed union, so this is unreachable — but returning
  // null is cheaper than a cast and keeps the switch exhaustiveness-checked.
  return null;
}
