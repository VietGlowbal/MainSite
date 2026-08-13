'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ABOUT_QUESTIONS,
  ABOUT_QUESTION_COUNT,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_META,
  FUNDING_SOURCE_CATALOG,
  INTENDED_LEVELS,
  OTHER_SUBJECT_ID,
  SELECTABLE_SUBJECTS,
  aboutQuestionProgress,
  destinationFlag,
  destinationLabel,
  intakeOptionsWith,
  isCompleteBudget,
  reflectionBlockingIssues,
  searchDestinations,
  searchSubjects,
  reflectionStep,
  subjectById,
  type AboutQuestionKey,
  type AboutYouValues,
  type AspirationsValues,
  type EnglishTestId,
  type IntakeChoice,
  type ScoreMethod,
} from '@/features/apply/domain';
import {
  AspirationQuestion,
  BudgetQuestion,
  DisplayModeToggle,
  EnglishQuestion,
  GpaQuestion,
  IntakePicker,
  NationalityPicker,
  NotSureNote,
  OptionCards,
  QuestionCard,
  QuestionTracker,
  ReflectionShell,
  SaveIndicator,
  SearchableMultiSelectGrid,
  SelectionCard,
  SubjectMotivationQuestion,
} from '@/features/apply/ui';
import { useLanguage, useT } from '@/lib/i18n';
import { Button, Input } from '@/shared/ui';

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

const AUTOSAVE_DELAY_MS = 1200;

/**
 * The glyph and one-line gloss on each intended-level card.
 *
 * Emoji rather than traced icons here: a rolled certificate and a diploma
 * document have no equivalent in the kit's stroked icon set, and inventing
 * two would be a worse match for the design than the characters every
 * platform already draws. They are `aria-hidden` inside `SelectionCard`, and
 * the title carries the meaning.
 */
const INTENDED_LEVEL_GLYPH: Record<(typeof INTENDED_LEVELS)[number], string> = {
  'Master or Post-Graduate Certificate': '🎓',
  'Bachelor’s Degree': '📜',
  'College Diploma / Certificate': '📄',
};

const INTENDED_LEVEL_DESCRIPTION: Record<(typeof INTENDED_LEVELS)[number], string> = {
  'Master or Post-Graduate Certificate': 'Advanced study after your undergraduate degree.',
  'Bachelor’s Degree': 'An undergraduate degree, typically lasting 3–4 years.',
  'College Diploma / Certificate': 'Vocational or academic qualifications at college level.',
};

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
    // A message about the question they just left would read as a complaint
    // about the one they just arrived at.
    setError(null);
  }

  async function finish() {
    // In show-all mode nothing has gated the answers on the way past, so the
    // whole set is checked here; the first unanswered required question is
    // the one named.
    const missing = ABOUT_QUESTIONS.map((q) => questionError(q.key, values)).find(Boolean);
    if (missing) {
      setError(missing);
      return;
    }
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
                  onClick={() => {
                    // Validate before moving, and show the reason inline —
                    // never an alert, and never a silent refusal.
                    const problem = question ? questionError(question.key, values) : null;
                    if (problem) {
                      setError(problem);
                      return;
                    }
                    setError(null);
                    if (isLast) void finish();
                    else goTo(index + 1);
                  }}
                >
                  {/* The last question ends step 1, so it says so — "Next"
                      there would promise a thirteenth question. */}
                  {isLast ? t('Complete') : t('Next')}
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
        return values.countries.length > 0 || values.countryPreferenceFlexible === true;
      case 'intendedLevel':
        return values.intendedLevel !== undefined;
      case 'targetIntake':
        return values.intake !== undefined;
      case 'careerGoal':
        return values.careerGoal !== undefined;
      case 'studyMotivation':
        // Answered for any one subject counts — the question only ever
        // required one — and so does the older single-box answer.
        return (
          Object.values(values.subjectMotivations ?? {}).some((answer) => answer.trim().length > 0) ||
          values.studyMotivation !== undefined
        );
      case 'fundingSource':
        return values.fundingSource !== undefined;
      case 'budget':
        return isCompleteBudget(values.tuitionBudget);
    }
  };

  return ABOUT_QUESTIONS.filter((q) => has(q.key)).length;
}

/**
 * The message blocking Next on this question, or null.
 *
 * ─── ONLY FOUR QUESTIONS ARE REQUIRED ────────────────────────────────────────
 *
 * Everything else stays skippable, as it was: the schema marks every field
 * optional and `reflectionCompleteness` already treats an unanswered field as
 * unanswered. The spec asks for these four specifically, and they earn it —
 * subjects and destinations are what course matching runs on, and a report
 * generated without them is a report about nobody.
 *
 * Returned as a message rather than a boolean so the caller cannot invent its
 * own wording for a rule decided here.
 *
 * Delegates to `reflectionBlockingIssues`, the domain-layer version of this
 * same check — the Review & Confirm page and its server-side confirm route
 * need the identical rule without a `'use client'` import, so the rule lives
 * there and this is a thin per-question lookup over it.
 */
function questionError(key: AboutQuestionKey, values: AboutFormValues): string | null {
  return reflectionBlockingIssues(values).find((issue) => issue.key === key)?.message ?? null;
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
  // Search state lives per question rather than in the shared answers, so
  // typing in the subject grid never marks the form dirty or triggers a save.
  const [subjectQuery, setSubjectQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');

  const subjectItems = useMemo(
    () =>
      searchSubjects(subjectQuery).map((subject) => ({
        id: subject.id,
        label: t(subject.label),
        icon: subject.icon,
      })),
    [subjectQuery, t],
  );

  /*
   * Generated once per mount rather than per render: the list depends on
   * today's date, and re-deriving it mid-session could in principle drop the
   * option a student is looking at if they leave the page open across a month
   * boundary. `intakeOptionsWith` also guarantees their stored choice is
   * present even when it has aged out of the window.
   */
  const intakeOptions = useMemo(() => intakeOptionsWith(values.intake), [values.intake]);

  const destinationItems = useMemo(
    () =>
      searchDestinations(destinationQuery, lang).map((destination) => ({
        id: destination.id,
        label: destinationLabel(destination.id, lang),
        glyph: destinationFlag(destination.id),
      })),
    [destinationQuery, lang],
  );

  /*
   * Q10 asks about the subjects Q5 chose, so its options are derived rather
   * than listed. A subject the catalogue does not know is the "Other" escape
   * hatch, and it shows the student's own words — asking "why are you
   * interested in Other?" would be worse than not asking.
   */
  const motivationSubjects = useMemo(
    () =>
      values.majors.map((id) => {
        const known = subjectById(id);
        if (known) return { id, label: t(known.label), icon: known.icon };
        return {
          id,
          label:
            id === OTHER_SUBJECT_ID ? (values.customSubject ?? t('Your subject')) : id,
        };
      }),
    [values.majors, values.customSubject, t],
  );

  /*
   * Which subject's box is open. Deliberately NOT in `values`: it is a view
   * concern, and putting it there would mark the form dirty and fire a save
   * every time a student glanced at another subject's tab.
   */
  const [activeMotivationSubject, setActiveMotivationSubject] = useState<string | undefined>(
    values.primaryMotivationSubject,
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
        <div className="flex flex-col gap-gb-xl">
          <SearchableMultiSelectGrid
            label={t('Which subjects are you interested in?')}
            items={subjectItems}
            selectedIds={values.majors}
            onChange={(next) => set('majors', next)}
            searchValue={subjectQuery}
            onSearchChange={setSubjectQuery}
            searchPlaceholder={t('Search subjects or browse below')}
            emptyLabel={t('No subjects found for “{query}”', { query: subjectQuery })}
            emptyAction={t('Add as Other')}
            onEmptyAction={() =>
              setMany({
                majors: [...new Set([...values.majors, OTHER_SUBJECT_ID])],
                customSubject: subjectQuery,
              })
            }
            footerNote={t('Pick as many as you are considering — you can change these later.')}
            resetLabel={t('Reset')}
            selectAllLabel={t('Select all')}
            // Select all takes the catalogue, never the free-text escape
            // hatch: ticking "Other" for someone would then demand a custom
            // subject they never asked to give.
            onSelectAll={() => set('majors', SELECTABLE_SUBJECTS.map((subject) => subject.id))}
          />

          {values.majors.includes(OTHER_SUBJECT_ID) ? (
            <Input
              name="customSubject"
              label={t('What subject are you interested in?')}
              placeholder={t('e.g. Marine Biology')}
              value={values.customSubject ?? ''}
              onChange={(e) => set('customSubject', e.target.value || undefined)}
            />
          ) : null}
        </div>
      );

    case 'countries':
      return (
        <div className="flex flex-col gap-gb-xl">
          <SearchableMultiSelectGrid
            label={t('Which countries are you interested in?')}
            items={destinationItems}
            selectedIds={values.countries}
            onChange={(next) => set('countries', next)}
            searchValue={destinationQuery}
            onSearchChange={setDestinationQuery}
            searchPlaceholder={t('Search countries')}
            emptyLabel={t('No countries found for “{query}”', { query: destinationQuery })}
            footerNote={t('Pick as many as you are considering — you can change these later.')}
            resetLabel={t('Reset')}
            columns={5}
            // Popular destinations up front; the rest are one click away and
            // searching skips the cap entirely.
            initialVisible={20}
            showAllLabel={t('Show all countries')}
            // No "Select all" here, deliberately: choosing all 197 countries
            // is not a preference, it is the absence of one, and it would
            // give the matching engine nothing to work with. The flexible
            // option below says the same thing usefully.
          />

          <label className="flex items-start gap-gb-md rounded-gb-lg border border-line bg-surface px-gb-lg py-gb-md">
            <input
              type="checkbox"
              checked={values.countryPreferenceFlexible === true}
              onChange={(e) => set('countryPreferenceFlexible', e.target.checked || undefined)}
              className="mt-gb-xxs size-4 shrink-0 accent-[var(--color-brand)]"
            />
            <span className="flex flex-col gap-gb-xxs">
              <span className="text-gb-sm font-medium text-fg">
                {t('🌍 I’m open to other countries')}
              </span>
              <span className="text-gb-xs text-fg-tertiary">
                {t('Show me strong options outside my current choices too.')}
              </span>
            </span>
          </label>
        </div>
      );

    case 'intendedLevel':
      return (
        <div className="flex flex-col gap-gb-xl">
          <div
            role="radiogroup"
            aria-label={t('Intended level of study')}
            className="flex flex-col gap-gb-md"
          >
            {INTENDED_LEVELS.map((level) => (
              <SelectionCard
                key={level}
                glyph={INTENDED_LEVEL_GLYPH[level]}
                title={t(level)}
                description={t(INTENDED_LEVEL_DESCRIPTION[level])}
                selected={values.intendedLevel === level}
                onSelect={() =>
                  set('intendedLevel', values.intendedLevel === level ? undefined : level)
                }
              />
            ))}
          </div>

          {/* Guidance, never a block. A student planning several years ahead
              is entitled to say so; the spec is explicit that this must not
              prevent the selection. */}
          {values.highestEducation === 'High school' &&
          values.intendedLevel === 'Master or Post-Graduate Certificate' ? (
            <NotSureNote
              text={t(
                'A Master’s normally requires an undergraduate degree first. You can still choose this if you’re planning ahead.',
              )}
            />
          ) : (
            <NotSureNote
              text={t('Not sure which one to choose? You can update this information later.')}
            />
          )}
        </div>
      );

    case 'targetIntake':
      return (
        <IntakePicker
          options={intakeOptions}
          value={values.intake}
          onChange={(next: IntakeChoice) => set('intake', next)}
          label={t('When do you want to start?')}
          placeholder={t('Select an intake')}
        />
      );

    case 'careerGoal':
      return (
        <AspirationQuestion
          value={values.careerGoal}
          subjects={motivationSubjects.map((subject) => subject.label)}
          onChange={(next) => set('careerGoal', next)}
          t={t}
        />
      );

    case 'studyMotivation':
      return (
        <div className="flex flex-col gap-gb-xl">
          {/*
            The answer a student gave to the older single-box version of this
            question. Shown rather than silently migrated into one of the
            per-subject boxes: which subject they meant is not ours to guess,
            and it keeps feeding the reports until they answer per subject.
          */}
          {values.studyMotivation !== undefined &&
          Object.keys(values.subjectMotivations ?? {}).length === 0 ? (
            <div className="flex flex-col gap-gb-xs rounded-gb-lg border border-line bg-surface-muted p-gb-lg">
              <p className="text-gb-sm font-semibold text-fg">{t('What you told us before')}</p>
              <p className="text-gb-sm text-fg-tertiary">{values.studyMotivation}</p>
            </div>
          ) : null}

          <SubjectMotivationQuestion
            subjects={motivationSubjects}
            active={activeMotivationSubject}
            onActiveChange={setActiveMotivationSubject}
            answers={values.subjectMotivations ?? {}}
            onAnswerChange={(id, next) =>
              setMany({
                subjectMotivations: { ...(values.subjectMotivations ?? {}), [id]: next },
                // The first subject answered becomes the headline one — the
                // single `study_motivation` column has to carry something
                // definite, and "whichever they wrote first" beats "whichever
                // key the object happened to iterate first".
                ...(values.primaryMotivationSubject === undefined && next.trim()
                  ? { primaryMotivationSubject: id }
                  : {}),
              })
            }
            aspiration={values.careerGoal}
            t={t}
          />
        </div>
      );

    case 'fundingSource':
      return (
        <div className="flex flex-col gap-gb-xl">
          <div
            role="radiogroup"
            aria-label={t('How will your study be funded?')}
            className="flex flex-col gap-gb-md"
          >
            {FUNDING_SOURCE_CATALOG.map((source) => (
              <SelectionCard
                key={source.id}
                icon={source.icon}
                title={t(source.label)}
                description={t(source.description)}
                selected={values.fundingSource === source.id}
                onSelect={() =>
                  set(
                    'fundingSource',
                    values.fundingSource === source.id ? undefined : source.id,
                  )
                }
              />
            ))}
          </div>
          <NotSureNote
            text={t('You can change this later — it only shapes which scholarships we look for.')}
          />
        </div>
      );

    case 'budget':
      return (
        <BudgetQuestion
          value={values.tuitionBudget}
          onChange={(next) => set('tuitionBudget', next)}
          t={t}
        />
      );
  }

  // `questionKey` is a closed union, so this is unreachable — returning null
  // keeps the switch exhaustiveness-checked without a cast.
  return null;
}
