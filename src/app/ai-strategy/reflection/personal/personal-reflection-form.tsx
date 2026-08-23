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
  value,
  onChange,
  onBlur,
}: {
  questionKey: PersonalReflectionKey;
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
}) {
  const t = useT();
  const question = personalReflectionQuestion(questionKey);
  const textareaRef = useAutoGrowTextarea<HTMLTextAreaElement>(value, { maxHeight: 360 });

  return (
    <Panel className="flex flex-col gap-gb-md p-gb-xl">
      <div className="flex flex-wrap items-start justify-between gap-gb-sm">
        <div className="flex flex-col gap-gb-xxs">
          <h2 className="text-gb-md font-semibold text-fg">{t(question.heading)}</h2>
          <p className="text-gb-xs font-medium text-fg-tertiary">{t(question.shortLabel)}</p>
        </div>
        {value.trim() ? (
          <Badge variant="brand-subtle">{t('Answered')}</Badge>
        ) : (
          <Badge variant="neutral">{t('Optional')}</Badge>
        )}
      </div>

      <ul className="flex flex-col gap-gb-xxs text-gb-sm text-fg-tertiary">
        <li className="font-medium text-fg-tertiary">{t('Think about:')}</li>
        {question.guidance.map((line) => (
          <li key={line}>• {t(line)}</li>
        ))}
      </ul>

      <div className="flex flex-col gap-gb-xs">
        <Textarea
          ref={textareaRef}
          name={`personal-reflection-${questionKey}`}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={t('Tell us what happened in your own words…')}
          className="resize-none"
        />
      </div>
    </Panel>
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
    <div className="flex flex-col gap-gb-2xl">
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

      <header className="flex flex-wrap items-end justify-between gap-gb-md">
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
            {t('Personal Reflection')}
          </h1>
          <p className="text-gb-sm text-fg-tertiary">
            {t(
              'Reflect on patterns across your experiences. All answers save automatically as you type.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-gb-sm">
          <span className="text-gb-xs font-medium text-fg-tertiary">
            {t('{count} of {total} answered', {
              count: answeredCount,
              total: PERSONAL_REFLECTION_QUESTION_COUNT,
            })}
          </span>
          <span className="text-gb-xs text-fg-muted">
            {saveStatus === 'saving'
              ? t('Saving…')
              : saveStatus === 'saved'
                ? t('Saved')
                : saveStatus === 'error'
                  ? t('Save error')
                  : ''}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-gb-xl">
        {PERSONAL_REFLECTION_QUESTIONS.map((q) => (
          <PersonalQuestionRow
            key={q.key}
            questionKey={q.key}
            value={answers[q.key] ?? ''}
            onChange={(val) => handleFieldChange(q.key, val)}
            onBlur={handleBlur}
          />
        ))}
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-gb-md border border-line-error bg-surface-error p-gb-md text-gb-sm text-fg-error">
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

      <div className="flex items-center justify-between gap-gb-lg border-t border-line pt-gb-xl">
        <Button
          type="button"
          variant="secondary"
          disabled={isNetworkSaving}
          onClick={() => void handleBack()}
        >
          {t('Back to Achievements')}
        </Button>
        <Button
          type="button"
          disabled={isNetworkSaving}
          onClick={() => void handleContinue()}
        >
          {isNetworkSaving ? t('Saving…') : t('Continue to Review & Confirm')}
        </Button>
      </div>
    </div>
  );
}
