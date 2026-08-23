'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PERSONAL_REFLECTION_QUESTIONS,
  PERSONAL_REFLECTION_QUESTION_COUNT,
  personalReflectionQuestion,
  type PersonalReflectionValues,
  type PersonalReflectionKey,
} from '@/features/apply/domain';
import { ReflectionBreadcrumb } from '@/features/apply/ui';
import { useT } from '@/lib/i18n';
import { Badge, Button, Panel, Textarea, useAutoGrowTextarea } from '@/shared/ui';

function PersonalQuestionRow({
  questionKey,
  index,
  value,
  onChange,
  onBlur,
}: {
  questionKey: PersonalReflectionKey;
  index: number;
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
}) {
  const t = useT();
  const question = personalReflectionQuestion(questionKey);
  const textareaRef = useAutoGrowTextarea<HTMLTextAreaElement>(value, { maxHeight: 400 });
  const isAnswered = Boolean(value.trim());

  return (
    <section
      aria-labelledby={`heading-${questionKey}`}
      className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all duration-200 flex flex-col gap-5 sm:gap-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-600 border border-rose-100/60 mt-0.5">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <h2 id={`heading-${questionKey}`} className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">
              {t(question.heading)}
            </h2>
            <p className="text-xs font-medium text-slate-400">
              {t(question.shortLabel)}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isAnswered ? (
            <Badge variant="brand-subtle" className="px-3 py-1 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100 rounded-full">
              <span className="text-[10px] mr-1" aria-hidden="true">✓</span>
              {t('Answered')}
            </Badge>
          ) : (
            <Badge variant="neutral" className="px-3 py-1 text-xs font-medium bg-slate-100/90 text-slate-500 rounded-full">
              {t('Optional')}
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50/80 border border-slate-100/90 p-4 sm:p-5 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span className="text-amber-500/90 text-sm leading-none" aria-hidden="true">💡</span>
          <span>{t('Think about:')}</span>
        </div>
        <ul className="flex flex-col gap-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {question.guidance.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="text-slate-300 select-none text-xs leading-5" aria-hidden="true">•</span>
              <span>{t(line)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <Textarea
          ref={textareaRef}
          name={`personal-reflection-${questionKey}`}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={t('Tell us what happened in your own words…')}
          className="min-h-[110px] rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-400 focus:ring-4 focus:ring-rose-50/60 focus:outline-none transition-all resize-none leading-relaxed shadow-sm"
        />
      </div>
    </section>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Step 3 — Personal Reflection: single-page review & edit layout rendering all
 * five cross-cutting questions with debounced autosave.
 */
export function PersonalReflectionForm({
  applicationId,
  returnTo,
  initial,
  applicationLabel,
}: {
  applicationId?: string | undefined;
  returnTo?: string | undefined;
  initial: PersonalReflectionValues;
  /** e.g. "Cambridge · Computer Science" — drives the in-page breadcrumb. */
  applicationLabel?: string | undefined;
}) {
  const t = useT();
  const router = useRouter();
  const [answers, setAnswers] = useState<PersonalReflectionValues>(initial);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isNetworkSaving, setIsNetworkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = PERSONAL_REFLECTION_QUESTIONS.filter(
    (q) => Boolean(answers[q.key]?.trim()),
  ).length;

  const requestIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards state updates from responses that land after unmount (the
  // fire-and-forget flush below intentionally outlives the component).
  const mountedRef = useRef(true);
  // True while there are edits not yet confirmed persisted — drives the
  // unmount flush so browser-back / tab-close never loses text.
  const dirtyRef = useRef(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  const saveAnswers = useCallback(
    async (currentAnswers: PersonalReflectionValues, finish = false): Promise<boolean> => {
      const currentRequestId = ++requestIdRef.current;
      if (mountedRef.current) {
        setSaveStatus('saving');
        setIsNetworkSaving(true);
        setError(null);
      }

      try {
        const response = await fetch('/api/reflection/personal', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: currentAnswers,
            ...(applicationId ? { applicationId } : {}),
          }),
        });

        if (currentRequestId !== requestIdRef.current) {
          return false;
        }

        if (!response.ok) {
          if (mountedRef.current) {
            const body = await response.json().catch(() => null);
            setError(body?.message ?? t('We could not save that. Please try again.'));
            setSaveStatus('error');
          }
          return false;
        }

        dirtyRef.current = false;

        if (mountedRef.current) {
          setSaveStatus('saved');
        }

        if (finish) {
          const confirmReturn = returnTo || '/ai-strategy/report';
          router.push(`/ai-strategy/reflection/confirm?return=${encodeURIComponent(confirmReturn)}`);
        }

        return true;
      } catch {
        if (currentRequestId !== requestIdRef.current) {
          return false;
        }
        if (mountedRef.current) {
          setError(t('We could not save that. Please try again.'));
          setSaveStatus('error');
        }
        return false;
      } finally {
        if (mountedRef.current && currentRequestId === requestIdRef.current) {
          setIsNetworkSaving(false);
        }
      }
    },
    [applicationId, returnTo, router, t],
  );

  const saveAnswersRef = useRef(saveAnswers);
  saveAnswersRef.current = saveAnswers;

  const handleFieldChange = (key: PersonalReflectionKey, val: string) => {
    const updated = { ...answers, [key]: val };
    setAnswers(updated);
    dirtyRef.current = true;
    setSaveStatus('saving');

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void saveAnswers(updated, false);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Flush an edit still sitting in the debounce window. Fire-and-forget:
      // the PATCH completes server-side even though this instance is gone,
      // and the mounted guard above suppresses the state writes.
      if (dirtyRef.current) {
        void saveAnswersRef.current(answersRef.current, false);
      }
    };
  }, []);

  const handleBlur = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    void saveAnswers(answersRef.current, false);
  };

  const handleContinue = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await saveAnswers(answersRef.current, true);
  };

  const handleBack = async () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    await saveAnswers(answersRef.current, false);
    const backPath = returnTo
      ? `/ai-strategy/reflection/achievements?return=${encodeURIComponent(returnTo)}`
      : '/ai-strategy/reflection/achievements';
    router.push(backPath);
  };

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {applicationLabel ? (
        <ReflectionBreadcrumb
          items={[
            { label: applicationLabel },
            { label: t('Personal Reflection') },
          ]}
          mobile={{
            backLabel: t('Achievements'),
            onBack: () => void handleBack(),
            title: t('Personal Reflection'),
            meta: t('{count} of {total} answered', {
              count: answeredCount,
              total: PERSONAL_REFLECTION_QUESTION_COUNT,
            }),
          }}
        />
      ) : null}

      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t('Personal Reflection')}
          </h1>
          <p className="text-sm text-slate-500 max-w-xl leading-relaxed">
            {t(
              'Reflect on patterns across your experiences. All answers save automatically as you type.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto bg-slate-50/90 border border-slate-200/80 px-4 py-2 rounded-full shadow-xs">
          <span className="text-xs font-semibold text-slate-700">
            {t('{count} of {total} answered', {
              count: answeredCount,
              total: PERSONAL_REFLECTION_QUESTION_COUNT,
            })}
          </span>
          {saveStatus !== 'idle' ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 pl-2.5 border-l border-slate-200">
              {saveStatus === 'saving' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" aria-hidden="true" />
                  <span className="text-rose-600">{t('Saving…')}</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="text-emerald-700 font-medium">{t('Saved')}</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-red-600">{t('Save error')}</span>
                </>
              )}
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-6 sm:gap-8">
        {PERSONAL_REFLECTION_QUESTIONS.map((q, idx) => (
          <PersonalQuestionRow
            key={q.key}
            index={idx}
            questionKey={q.key}
            value={answers[q.key] ?? ''}
            onChange={(val) => handleFieldChange(q.key, val)}
            onBlur={handleBlur}
          />
        ))}
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-line-error bg-surface-error p-4 text-sm text-fg-error shadow-sm">
          <span>{error}</span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void saveAnswers(answersRef.current, false)}
          >
            {t('Try again')}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-slate-200/80 pt-8 pb-4">
        <Button
          type="button"
          variant="secondary"
          disabled={isNetworkSaving}
          onClick={() => void handleBack()}
          className="rounded-xl px-5 py-2.5 font-medium"
        >
          <span aria-hidden="true" className="mr-1">←</span>
          {t('Back to Achievements')}
        </Button>
        <Button
          type="button"
          disabled={isNetworkSaving}
          onClick={() => void handleContinue()}
          className="rounded-xl px-6 py-2.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
        >
          {isNetworkSaving ? t('Saving…') : (
            <>
              {t('Continue to Review & Confirm')}
              <span aria-hidden="true" className="ml-1.5">→</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
