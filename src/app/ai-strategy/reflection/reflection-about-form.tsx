'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ABOUT_QUESTIONS,
  ABOUT_QUESTION_COUNT,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_META,
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
  type EnglishTestId,
  type ScoreMethod,
} from '@/features/apply/domain';
import {
  DisplayModeToggle,
  EnglishQuestion,
  GpaQuestion,
  NationalityPicker,
  NotSureNote,
  OptionCards,
  QuestionCard,
  QuestionTracker,
  ReflectionShell,
  SaveIndicator,
} from '@/features/apply/ui';
import { useLanguage, useT } from '@/lib/i18n';
import { regions, subjectFamilies } from '@/lib/onboarding-options';
import { Button, Input, MultiSelect, RangeHistogram, Select, Textarea } from '@/shared/ui';

/**
 * Candidate Information, step 1.
 *
 * ─── TWO MODES, ONE SET OF CONTROLS ──────────────────────────────────────────
 *
 * The brief's central requirement: a student can answer one question at a time
 * (the default) or see all twelve on one page, and switching must never lose
 * an answer or downgrade a control to a plain text input.
 *
 * Both of those fall out of the same decision — `AboutQuestion` renders one
 * question and knows nothing about which mode it is in. One-at-a-time renders
 * it once; show-all renders it twelve times in a loop. There is no second
 * implementation to fall out of step, and no state to migrate when the toggle
 * flips, because the answers live above both modes in `values`.
 *
 * ─── AUTOSAVE, AND WHY IT IS DEBOUNCED RATHER THAN PER KEYSTROKE ─────────────
 *
 * Answers save on their own about a second after the student stops changing
 * them. Per keystroke would be a PATCH per character of a career goal; per
 * question would lose an answer to a closed tab. The debounce also collapses
 * the budget question's paired updates (slider and band move together) into
 * one request.
 *
 * `Save & Exit` flushes immediately and leaves. Nothing depends on the student
 * pressing it — it exists because being told your work is saved is different
 * from it being saved.
 */

/**
 * The bars behind the budget slider.
 *
 * FLAT, AND THAT IS THE POINT. `RangeHistogram` states the rule in its own
 * source: real data or nothing, because a curve here is a claim about what
 * other students budget and we have no cohort data to support it.
 */
const BUDGET_BINS = Array.from({ length: 48 }, () => 1);
const BUDGET_MIN_VND = 0;
const BUDGET_MAX_VND = 2_000_000_000;
const AUTOSAVE_DELAY_MS = 1200;

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString('vi-VN')} VND`;
}

export type AboutFormValues = AboutYouValues &
  AspirationsValues & {
    /** Provenance for the two converted scores — see `StoredScores`. */
    gpaMethod?: ScoreMethod;
    gpaSource?: string;
    ieltsMethod?: ScoreMethod;
    englishTest?: EnglishTestId;
    englishTestScore?: string;
    englishNotTaken?: boolean;
  };

export function ReflectionAboutForm({ initial }: { initial: AboutFormValues }) {
  const t = useT();
  const { lang } = useLanguage();
  const router = useRouter();
  const returnTo = useSearchParams().get('return');

  const [values, setValues] = useState<AboutFormValues>(initial);
  const [mode, setMode] = useState<'one' | 'all'>('one');
  const [index, setIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Nothing has changed yet on first render, so the mount effect must not fire
  // a PATCH that rewrites the profile with what it just read out of it.
  const dirty = useRef(false);

  /*
   * Takes what to send rather than reading a ref.
   *
   * The obvious shape here is a `latest` ref assigned during render, which
   * React forbids — and rightly: under concurrent rendering a render can be
   * thrown away, so a ref written during one is not reliably the state that
   * was committed. Every caller already has the committed `values` in scope
   * (the autosave effect re-runs on it; the button handlers close over it), so
   * passing it is both correct and simpler.
   */
  const save = useCallback(async (payload: AboutFormValues): Promise<boolean> => {
    setSaveState('saving');
    try {
      const response = await fetch('/api/reflection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ about: payload }),
      });
      if (!response.ok) {
        setSaveState('error');
        return false;
      }
      dirty.current = false;
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, []);

  // Debounced autosave. The timer restarts on every change, so a student
  // typing continuously produces one request when they pause rather than one
  // per keystroke.
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => void save(values), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [values, save]);

  // "Saved" is an acknowledgement, not a status — it should not sit there
  // claiming freshness while the student edits something else.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = setTimeout(() => setSaveState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [saveState]);

  const setMany = useCallback((patch: Partial<AboutFormValues>) => {
    dirty.current = true;
    setValues((prev) => ({ ...prev, ...patch }));
  }, []);

  const set = useCallback(
    <K extends keyof AboutFormValues>(key: K, value: AboutFormValues[K]) => {
      setMany({ [key]: value } as Partial<AboutFormValues>);
    },
    [setMany],
  );

  const answered = useMemo(() => countAnswered(values), [values]);

  function goTo(next: number) {
    const clamped = Math.min(Math.max(next, 0), ABOUT_QUESTION_COUNT - 1);
    setIndex(clamped);
    setFurthest((prev) => Math.max(prev, clamped));
  }

  async function finish() {
    setError(null);
    const ok = await save(values);
    if (!ok) {
      setError('We could not save that. Please try again.');
      return;
    }
    router.push(
      returnTo
        ? `${reflectionStep('evidence').path}?return=${encodeURIComponent(returnTo)}`
        : reflectionStep('evidence').path,
    );
  }

  async function saveAndExit() {
    setError(null);
    const ok = await save(values);
    if (!ok) {
      setError('We could not save that. Please try again.');
      return;
    }
    router.push(returnTo ?? '/apply');
  }

  const question = ABOUT_QUESTIONS[index];
  const isLast = index === ABOUT_QUESTION_COUNT - 1;

  // In one-at-a-time mode the tracker below already says "Question 4 of 12",
  // so the shell keeps its own caption on the step name — printing the same
  // sentence twice, a few pixels apart, reads as a rendering fault.
  const positionLabel = t('Question {current} of {total}', {
    current: index + 1,
    total: ABOUT_QUESTION_COUNT,
  });
  const completedLabel = t('{answered} of {total} completed', {
    answered,
    total: ABOUT_QUESTION_COUNT,
  });

  const shared = { values, set, setMany, t, lang };

  return (
    <ReflectionShell
      step="about"
      progress={
        mode === 'one' ? aboutQuestionProgress(index) : (answered / ABOUT_QUESTION_COUNT) * 0.5
      }
      caption={mode === 'one' ? undefined : completedLabel}
    >
      <div className="flex flex-col gap-gb-2xl">
        <div className="flex flex-wrap items-center justify-between gap-gb-lg">
          <DisplayModeToggle
            mode={mode}
            onChange={setMode}
            oneLabel={t('One question at a time')}
            allLabel={t('Show all questions')}
            groupLabel={t('How would you like to answer?')}
          />
          <SaveIndicator
            state={saveState}
            savingLabel={t('Saving…')}
            savedLabel={t('Saved')}
            errorLabel={t('Not saved')}
          />
        </div>

        {mode === 'one' ? (
          <>
            <QuestionTracker
              total={ABOUT_QUESTION_COUNT}
              current={index}
              furthestReached={furthest}
              onJump={goTo}
              label={positionLabel}
            />

            {question ? (
              <QuestionCard
                icon={question.icon}
                heading={t(question.heading)}
                subtitle={t(question.subtitle)}
                section={t(question.section)}
              >
                <AboutQuestion questionKey={question.key} {...shared} />
              </QuestionCard>
            ) : null}

            {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-gb-lg">
              {index > 0 ? (
                <Button type="button" variant="secondary" size="lg" onClick={() => goTo(index - 1)}>
                  {t('Back')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap items-center gap-gb-md">
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => void saveAndExit()}
                >
                  {t('Save & Exit')}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="min-w-40"
                  onClick={() => (isLast ? void finish() : goTo(index + 1))}
                >
                  {isLast ? t('Continue') : t('Next')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <ProgressSummary answered={answered} total={ABOUT_QUESTION_COUNT} label={completedLabel} />

            <div className="flex flex-col gap-gb-2xl">
              {ABOUT_QUESTIONS.map((entry) => (
                <QuestionCard
                  key={entry.key}
                  icon={entry.icon}
                  heading={t(entry.heading)}
                  subtitle={t(entry.subtitle)}
                  section={t(entry.section)}
                >
                  <AboutQuestion questionKey={entry.key} {...shared} />
                </QuestionCard>
              ))}
            </div>

            {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-end gap-gb-md">
              <Button type="button" variant="secondary" size="lg" onClick={() => void saveAndExit()}>
                {t('Save & Exit')}
              </Button>
              <Button type="button" size="lg" className="min-w-48" onClick={() => void finish()}>
                {t('Save & Continue')}
              </Button>
            </div>
          </>
        )}
      </div>
    </ReflectionShell>
  );
}

/** Show-all mode's completion indicator, in place of the numbered tracker. */
function ProgressSummary({
  answered,
  total,
  label,
}: {
  answered: number;
  total: number;
  label: string;
}) {
  const percent = Math.round((answered / total) * 100);
  return (
    <div className="flex flex-col gap-gb-xs">
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-gb-full bg-line"
      >
        <span className="block h-full rounded-gb-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-gb-sm text-fg-tertiary">{label}</p>
    </div>
  );
}

/**
 * How many of the twelve have an answer.
 *
 * Mirrors `ABOUT_QUESTIONS` rather than `reflectionCompleteness`, which counts
 * step 2's achievements and activities as well — this indicator is about this
 * page only, and "7 of 12" has to mean seven of the twelve on screen.
 */
function countAnswered(values: AboutFormValues): number {
  const has = (key: AboutQuestionKey): boolean => {
    switch (key) {
      case 'highestEducation':
        return values.highestEducation !== undefined;
      case 'nationality':
        return values.nationality !== undefined;
      case 'gpa':
        return values.gpa !== undefined;
      case 'ielts':
        return values.ielts !== undefined || values.englishNotTaken === true;
      case 'majors':
        return values.majors.length > 0;
      case 'countries':
        return values.countries.length > 0;
      case 'intendedLevel':
        return values.intendedLevel !== undefined;
      case 'targetIntake':
        return values.targetIntake !== undefined;
      case 'careerGoal':
        return values.careerGoal !== undefined;
      case 'studyMotivation':
        return values.studyMotivation !== undefined;
      case 'fundingSource':
        return values.fundingSource !== undefined;
      case 'budget':
        return values.budgetRange !== undefined || values.tuitionBudgetUsd !== undefined;
    }
  };

  return ABOUT_QUESTIONS.filter((q) => has(q.key)).length;
}

type QuestionProps = {
  questionKey: AboutQuestionKey;
  values: AboutFormValues;
  set: <K extends keyof AboutFormValues>(key: K, value: AboutFormValues[K]) => void;
  setMany: (patch: Partial<AboutFormValues>) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  lang: string;
};

/**
 * One question's control.
 *
 * Rendered identically by both display modes — that is what guarantees the
 * brief's "do not replace interactive components with plain text inputs" in
 * show-all mode, rather than it being a thing to remember.
 */
function AboutQuestion({ questionKey, values, set, setMany, t, lang }: QuestionProps) {
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
        <div className="flex flex-col gap-gb-xl">
          <OptionCards
            label={t('Highest level of education')}
            value={values.highestEducation}
            onChange={(next) =>
              setMany({
                highestEducation: next,
                // Leaving "Other" behind should not leave its text behind too,
                // or it silently becomes the stored qualification again.
                ...(next === 'Other' ? {} : { otherEducation: undefined }),
              })
            }
            options={EDUCATION_LEVELS.map((level) => ({
              value: level,
              label: t(level),
              hint: t(EDUCATION_LEVEL_META[level].hint),
              icon: EDUCATION_LEVEL_META[level].icon,
            }))}
          />

          {values.highestEducation === 'Other' ? (
            <Input
              name="otherEducation"
              label={t('What qualification is it?')}
              placeholder={t('e.g. National Diploma in Engineering')}
              value={values.otherEducation ?? ''}
              onChange={(e) => set('otherEducation', e.target.value || undefined)}
            />
          ) : null}

          <NotSureNote text={t('Not sure? You can update this later in your profile settings.')} />
        </div>
      );

    case 'nationality':
      return (
        <div className="flex flex-col gap-gb-xl">
          <NationalityPicker
            value={values.nationality}
            onChange={(next) => set('nationality', next)}
            locale={lang}
            label={t('What is your nationality?')}
            searchPlaceholder={t('Search country or nationality')}
            emptyLabel={t('No country or nationality matches that.')}
            clearLabel={t('Select your nationality')}
          />
          <NotSureNote text={t('Not sure? You can update this later in your profile settings.')} />
        </div>
      );

    case 'gpa':
      return (
        <GpaQuestion
          value={values.gpa}
          source={values.gpaSource}
          t={t}
          onChange={({ gpa, method, source }) =>
            setMany({
              gpa,
              gpaMethod: method,
              ...(source === undefined ? {} : { gpaSource: source }),
            })
          }
        />
      );

    case 'ielts':
      return (
        <EnglishQuestion
          ielts={values.ielts}
          test={values.englishTest}
          testScore={values.englishTestScore}
          notTaken={values.englishNotTaken === true}
          t={t}
          onChange={(next) =>
            setMany({
              ...('ielts' in next ? { ielts: next.ielts } : {}),
              ...(next.method ? { ieltsMethod: next.method } : {}),
              ...('test' in next ? { englishTest: next.test } : {}),
              ...('testScore' in next ? { englishTestScore: next.testScore } : {}),
              ...(next.notTaken === undefined ? {} : { englishNotTaken: next.notTaken }),
            })
          }
        />
      );

    case 'majors':
      return (
        <MultiSelect
          name="majors"
          label={t('Which subjects are you interested in?')}
          placeholder={t('Search subjects')}
          options={majorOptions}
          value={values.majors}
          onChange={(next) => set('majors', next)}
          maxVisible={6}
        />
      );

    case 'countries':
      return (
        <MultiSelect
          name="countries"
          label={t('Which countries are you interested in?')}
          placeholder={t('Search countries')}
          options={countryOptions}
          value={values.countries}
          onChange={(next) => set('countries', next)}
          maxVisible={6}
        />
      );

    case 'intendedLevel':
      return (
        <OptionCards
          label={t('Intended level of study')}
          value={values.intendedLevel}
          onChange={(next) => set('intendedLevel', next)}
          columns="single"
          options={INTENDED_LEVELS.map((level) => ({
            value: level,
            label: t(level),
            icon: 'graduationCap',
          }))}
        />
      );

    case 'targetIntake':
      return (
        <div className="max-w-sm">
          <Select
            name="targetIntake"
            label={t('When do you want to start?')}
            placeholder={t('Select an intake')}
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
        </div>
      );

    case 'careerGoal':
      return (
        <Textarea
          name="careerGoal"
          label={t('What do you want to do after you graduate?')}
          placeholder={t('A sentence or two is plenty.')}
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
          rows={4}
          value={values.studyMotivation ?? ''}
          onChange={(e) => set('studyMotivation', e.target.value || undefined)}
        />
      );

    case 'fundingSource':
      return (
        <OptionCards
          label={t('How will your study be funded?')}
          value={values.fundingSource}
          onChange={(next) => set('fundingSource', next)}
          options={FUNDING_SOURCES.map((source) => ({
            value: source,
            label: t(source),
            icon: 'usersTwo',
          }))}
        />
      );

    case 'budget':
      /*
       * TWO CONTROLS, ONE ANSWER — annual tuition, in two currencies, each
       * updating the other. The rate is printed rather than applied silently;
       * see the note in domain/reflection.ts for why it is a constant.
       */
      return (
        <div className="flex flex-col gap-gb-2xl">
          <RangeHistogram
            min={BUDGET_MIN_VND}
            max={BUDGET_MAX_VND}
            step={10_000_000}
            low={budgetLow}
            high={budgetHigh}
            onChange={({ low, high }) =>
              setMany({
                budgetRange: `${low}-${high}`,
                tuitionBudgetUsd: usdBandFromVndRange(low, high),
              })
            }
            distribution={BUDGET_BINS}
            label={t('Annual tuition budget')}
            formatValue={(low, high) => `${formatVnd(low)} - ${formatVnd(high)}`}
          />

          <div className="max-w-sm">
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
        </div>
      );
  }

  // `questionKey` is a closed union, so this is unreachable — returning null
  // keeps the switch exhaustiveness-checked without a cast.
  return null;
}
