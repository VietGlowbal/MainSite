'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useT } from '@/lib/i18n';
import {
  AWARD_LEVEL_OPTIONS,
  AWARD_ROLE_OPTIONS,
  BUDGET_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENT_EDUCATION_OPTIONS,
  GRADING_SYSTEM_OPTIONS,
  INTENDED_LEVEL_OPTIONS,
  MAJOR_OPTIONS,
  TEST_SCORE_OPTIONS,
  createEmptyAward,
  createEmptyTestScore,
  stepIsComplete,
  type AwardAnswer,
  type OnboardingFlowStep,
  type OnboardingViewModel,
  type TestScoreAnswer,
} from '../domain';

const LightGlobe = dynamic(
  () => import('@/components/landing-globe').then((mod) => ({ default: mod.LandingGlobe })),
  { ssr: false, loading: () => <div className="h-full w-full rounded-full bg-brand-subtle/40" /> },
);

export function CurrentOnboardingView(model: OnboardingViewModel) {
  const t = useT();
  const {
    answers,
    activeStep,
    back,
    canGoBack,
    canGoNext,
    completedSteps,
    currentStepIndex,
    fromSearch,
    isSignedIn,
    isSubmitting,
    message,
    next,
    steps,
    skip,
    submit,
    updateAnswer,
  } = model;

  function toggleCountry(country: string) {
    updateAnswer(
      'preferred_countries',
      answers.preferred_countries.includes(country)
        ? answers.preferred_countries.filter((value) => value !== country)
        : [...answers.preferred_countries, country],
    );
  }

  function toggleMajor(major: string) {
    updateAnswer(
      'target_majors',
      answers.target_majors.includes(major)
        ? answers.target_majors.filter((value) => value !== major)
        : [...answers.target_majors, major],
    );
  }

  function toggleTest(testType: string) {
    const existing = answers.test_scores.find((test) => test.type === testType);
    updateAnswer(
      'test_scores',
      existing
        ? answers.test_scores.filter((test) => test.id !== existing.id)
        : [...answers.test_scores, { ...createEmptyTestScore(), type: testType }],
    );
  }

  function updateTest(id: string, patch: Partial<TestScoreAnswer>) {
    updateAnswer(
      'test_scores',
      answers.test_scores.map((test) => (test.id === id ? { ...test, ...patch } : test)),
    );
  }

  function updateAward(id: string, patch: Partial<AwardAnswer>) {
    updateAnswer(
      'academic_awards',
      answers.academic_awards.map((award) => (award.id === id ? { ...award, ...patch } : award)),
    );
  }

  function addAward() {
    updateAnswer('academic_awards', [...answers.academic_awards, createEmptyAward()]);
  }

  function removeAward(id: string) {
    updateAnswer(
      'academic_awards',
      answers.academic_awards.filter((award) => award.id !== id),
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden" data-no-auto-translate>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--gb-brand) 8%, transparent), transparent 35%), radial-gradient(ellipse at 85% 12%, color-mix(in srgb, var(--color-tier-recommend) 10%, transparent), transparent 30%), linear-gradient(180deg, var(--color-bg) 0%, var(--gb-bg-primary) 80%)',
        }}
      />

      <div aria-hidden className="pointer-events-none absolute right-[-120px] top-[-60px] hidden lg:block">
        <div className="h-[420px] w-[420px] opacity-80">
          <LightGlobe theme="marble" responsive rotateSpeed={0.4} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        <div className="relative">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-fg-brand">
              {t('GLOWBAL · onboarding')}
            </span>
            <button
              type="button"
              onClick={skip}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-fg-muted transition hover:text-fg-brand"
            >
              {t('Skip to search')}
              <span aria-hidden>→</span>
            </button>
          </div>

          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-fg md:text-5xl">
            {t("Tell us about you. We'll do the rest.")}
          </h1>

          {fromSearch ? (
            <div className="mt-5 rounded-2xl border border-brand-surface bg-brand-subtle/60 p-4 text-sm text-fg-secondary">
              <p className="font-semibold text-fg-brand">
                {t('A 60-second detour will sharpen your search.')}
              </p>
              <p className="mt-1 leading-relaxed">
                {t('Filling in these questions lets')} <span className="glowbal-wordmark">GLOWBAL</span>{' '}
                {t('rank universities by how well they fit your subject, country preference, and goals. You can skip any time — your search will just be more generic until you do.')}
              </p>
            </div>
          ) : (
            <p className="mt-3 max-w-2xl text-base leading-7 text-fg-secondary">
              {t("Nine short questions. They tune the matcher so the universities you see actually fit you. Skip any you're not sure about — every answer makes the search better, none are required.")}
            </p>
          )}

          <div className="mt-6 flex items-center gap-3" aria-label="onboarding progress">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full bg-brand transition-all duration-500"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums text-fg-muted">
              {currentStepIndex + 1}/{steps.length}
            </span>
          </div>
        </div>

        <form onSubmit={submit} className="mt-10 space-y-8">
          {activeStep.id === 'preferred_countries' ? <QuestionCard q={activeStep} answered={stepIsComplete(activeStep.id, answers)}>
            <div className="grid gap-3 sm:grid-cols-2">
              {COUNTRY_OPTIONS.map((country) => (
                <Choice
                  key={country}
                  label={country}
                  selected={answers.preferred_countries.includes(country)}
                  onClick={() => toggleCountry(country)}
                />
              ))}
            </div>
          </QuestionCard> : null}

          {activeStep.id === 'current_education' ? <QuestionCard
            q={activeStep}
            answered={stepIsComplete(activeStep.id, answers)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('Highest level of education')}>
                <select
                  className={INPUT}
                  value={answers.current_education_level}
                  onChange={(event) => updateAnswer('current_education_level', event.target.value)}
                >
                  <option value="">{t('Select a level')}</option>
                  {CURRENT_EDUCATION_OPTIONS.map((option) => <option key={option} value={option}>{t(option)}</option>)}
                </select>
              </Field>
              <Field label={t('Average grade')}>
                <input
                  className={INPUT}
                  value={answers.average_grade}
                  onChange={(event) => updateAnswer('average_grade', event.target.value)}
                  placeholder={t('e.g. 80')}
                />
              </Field>
            </div>
          </QuestionCard> : null}

          {activeStep.id === 'target_majors' ? <QuestionCard
            q={activeStep}
            answered={stepIsComplete(activeStep.id, answers)}
          >
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {MAJOR_OPTIONS.map((major) => (
                <Choice
                  key={major}
                  label={major}
                  selected={answers.target_majors.includes(major)}
                  onClick={() => toggleMajor(major)}
                />
              ))}
            </div>
            <Field label={t('Other majors')} className="mt-4">
              <input
                className={INPUT}
                value={answers.other_major}
                onChange={(event) => updateAnswer('other_major', event.target.value)}
                placeholder={t('e.g. Graphic Design')}
              />
            </Field>
          </QuestionCard> : null}

          {activeStep.id === 'intended_level' ? <QuestionCard q={activeStep} answered={stepIsComplete(activeStep.id, answers)}>
            <div className="grid gap-3">
              {INTENDED_LEVEL_OPTIONS.map((level) => (
                <Choice
                  key={level}
                  label={level}
                  selected={answers.intended_level === level}
                  onClick={() => updateAnswer('intended_level', level)}
                />
              ))}
            </div>
          </QuestionCard> : null}

          {activeStep.id === 'nationality' ? <QuestionCard q={activeStep} answered={stepIsComplete(activeStep.id, answers)}>
            <Field label={t('Nationality')}>
              <input
                className={INPUT}
                list="onboarding-nationalities"
                value={answers.nationality}
                onChange={(event) => updateAnswer('nationality', event.target.value)}
                placeholder={t('e.g. Vietnam')}
              />
              <datalist id="onboarding-nationalities">
                {['Vietnam', 'Canada', 'United Kingdom', 'United States', 'Australia', 'Germany', 'Japan'].map((country) => (
                  <option key={country} value={country} />
                ))}
              </datalist>
            </Field>
          </QuestionCard> : null}

          {activeStep.id === 'academic_grades' ? <QuestionCard
            q={activeStep}
            answered={stepIsComplete(activeStep.id, answers)}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label={t('Select a GPA')}>
                <select
                  className={INPUT}
                  value={answers.grading_system}
                  onChange={(event) => updateAnswer('grading_system', event.target.value)}
                >
                  <option value="">{t('Select a GPA')}</option>
                  {GRADING_SYSTEM_OPTIONS.map((option) => <option key={option} value={option}>{t(option)}</option>)}
                </select>
              </Field>
              <Field label={t('Your grade')}>
                <input
                  className={INPUT}
                  value={answers.grade_value}
                  onChange={(event) => updateAnswer('grade_value', event.target.value)}
                  placeholder={t('e.g. 7 / 10')}
                />
              </Field>
            </div>
          </QuestionCard> : null}

          {activeStep.id === 'test_scores' ? <QuestionCard q={activeStep} answered={stepIsComplete(activeStep.id, answers)}>
            <div className="grid gap-3 sm:grid-cols-2">
              {TEST_SCORE_OPTIONS.map((testType) => {
                const selected = answers.test_scores.some((test) => test.type === testType);
                return (
                  <Choice
                    key={testType}
                    label={testType}
                    selected={selected}
                    onClick={() => toggleTest(testType)}
                  />
                );
              })}
            </div>
            <div className="mt-4 space-y-3">
              {answers.test_scores.map((test) => (
                <div key={test.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm font-semibold text-fg">{t(test.type)}</span>
                  <input
                    className={`${INPUT} max-w-[180px]`}
                    value={test.score}
                    onChange={(event) => updateTest(test.id, { score: event.target.value })}
                    placeholder={t('Score')}
                    aria-label={`${test.type} ${t('score')}`}
                  />
                </div>
              ))}
            </div>
          </QuestionCard> : null}

          {activeStep.id === 'academic_awards' ? <QuestionCard q={activeStep} answered={stepIsComplete(activeStep.id, answers)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                label="Yes"
                selected={answers.has_academic_awards === 'yes'}
                onClick={() => updateAnswer('has_academic_awards', 'yes')}
              />
              <Choice
                label="No"
                selected={answers.has_academic_awards === 'no'}
                onClick={() => {
                  updateAnswer('has_academic_awards', 'no');
                  updateAnswer('academic_awards', []);
                }}
              />
            </div>

            {answers.has_academic_awards === 'yes' ? (
              <div className="mt-5 space-y-4">
                {answers.academic_awards.map((award, index) => (
                  <div key={award.id} className="rounded-2xl border border-line bg-surface-muted/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">#{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAward(award.id)}
                        className="text-xs text-fg-muted transition hover:text-brand"
                      >
                        {t('Remove')}
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t('Select a Level')}>
                        <select className={INPUT} value={award.level} onChange={(event) => updateAward(award.id, { level: event.target.value })}>
                          <option value="">{t('Select a Level')}</option>
                          {AWARD_LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{t(option)}</option>)}
                        </select>
                      </Field>
                      <Field label={t('Role / Achievement')}>
                        <select className={INPUT} value={award.role} onChange={(event) => updateAward(award.id, { role: event.target.value })}>
                          <option value="">{t('Role / Achievement')}</option>
                          {AWARD_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{t(option)}</option>)}
                        </select>
                      </Field>
                      <Field label={t('Prize Name')} >
                        <input className={INPUT} value={award.name} onChange={(event) => updateAward(award.id, { name: event.target.value })} placeholder={t('Prize name')} />
                      </Field>
                      <Field label={t('Organization')}>
                        <input className={INPUT} value={award.organization} onChange={(event) => updateAward(award.id, { organization: event.target.value })} placeholder={t('Organization')} />
                      </Field>
                      <Field label={t('Date')}>
                        <input className={INPUT} type="date" value={award.date} onChange={(event) => updateAward(award.id, { date: event.target.value })} />
                      </Field>
                      <Field label={t('Other')} className="sm:col-span-2">
                        <textarea className={`${INPUT} min-h-24`} value={award.description} onChange={(event) => updateAward(award.id, { description: event.target.value })} placeholder={t('Tell us the name of the project, your role, and what drove you to start…')} />
                      </Field>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAward}
                  className="w-full rounded-2xl border border-dashed border-brand-surface bg-brand-subtle/50 py-3 text-sm font-semibold text-fg-brand transition hover:bg-brand-subtle"
                >
                  + {t('Add an award')}
                </button>
              </div>
            ) : null}
          </QuestionCard> : null}

          {activeStep.id === 'budget' ? <QuestionCard q={activeStep} answered={stepIsComplete(activeStep.id, answers)}>
            <div className="grid gap-3 sm:grid-cols-2">
              {BUDGET_OPTIONS.map((budget) => (
                <Choice
                  key={budget}
                  label={budget}
                  selected={answers.budget_range === budget}
                  onClick={() => updateAnswer('budget_range', budget)}
                />
              ))}
            </div>
          </QuestionCard> : null}

          <div className="sticky bottom-4 z-20">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-gb-lg backdrop-blur">
              <p className="min-w-[180px] flex-1 text-sm text-fg-secondary">
                {completedSteps === 0
                  ? t('Pick at least one answer to save a personalised match.')
                  : completedSteps < steps.length
                    ? t('Looking great — {completed}/{total} answered.', { completed: completedSteps, total: steps.length })
                    : t('All set. Save your profile to unlock matches.')}
              </p>
              <button
                type="button"
                onClick={skip}
                className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg-secondary hover:border-line-strong"
              >
                {t('Skip for now')}
              </button>
              {canGoBack ? (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-fg-secondary hover:border-line-strong"
                >
                  {t('Back')}
                </button>
              ) : null}
              {canGoNext ? (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand shadow-gb-md transition hover:-translate-y-0.5"
                >
                  {t('Next')}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting || completedSteps === 0}
                className={`rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand shadow-gb-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${canGoNext ? 'hidden' : ''}`}
              >
                {isSubmitting ? t('Saving…') : isSignedIn ? t('Save & see matches') : t('Sign in & save')}
              </button>
            </div>
          </div>

          {message ? <p className="text-center text-sm text-fg-brand">{t(message)}</p> : null}
        </form>
      </div>
    </div>
  );
}

const INPUT = 'block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder-fg-muted outline-none transition focus:border-brand focus:ring-2 focus:ring-brand-subtle';

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-fg-secondary">{label}</label>
      {children}
    </div>
  );
}

function QuestionCard({ q, answered, children }: { q: OnboardingFlowStep; answered: boolean; children: ReactNode }) {
  const t = useT();
  return (
    <section id={`q-${q.id}`} className="rounded-3xl border border-line bg-surface/90 p-6 shadow-gb-md backdrop-blur md:p-8">
      <header className="mb-3 flex items-center gap-3">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${answered ? 'bg-brand text-on-brand shadow-gb-sm' : 'bg-surface-muted text-fg-muted'}`}>
          {answered ? '✓' : q.number}
        </span>
        <h2 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">{t(q.title)}</h2>
      </header>
      <p className="mb-5 ml-10 text-sm leading-relaxed text-fg-secondary">{t(q.body)}</p>
      <div className="ml-10">{children}</div>
    </section>
  );
}

function Choice({ label, hint, selected, onClick }: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-2xl border px-4 py-3 text-left transition duration-200 hover:-translate-y-0.5 ${selected ? 'border-brand-surface bg-brand-subtle text-fg shadow-gb-sm' : 'border-line bg-surface text-fg-secondary hover:border-brand-surface hover:bg-brand-subtle/50'}`}
    >
      <div className="font-semibold tracking-tight">{t(label)}</div>
      {hint ? <div className="mt-0.5 text-xs text-fg-muted">{t(hint)}</div> : null}
    </button>
  );
}
