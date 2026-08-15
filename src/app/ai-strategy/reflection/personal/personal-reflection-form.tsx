'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PERSONAL_REFLECTION_QUESTIONS,
  PERSONAL_REFLECTION_QUESTION_COUNT,
  personalReflectionProgress,
  personalReflectionQuestion,
  type PersonalReflectionValues,
} from '@/features/apply/domain';
import { useT } from '@/lib/i18n';
import { Button, ProgressBar, Textarea } from '@/shared/ui';

/**
 * Step 3 — Personal Reflection: five fixed, cross-cutting questions, one per
 * screen, deliberately simpler than the activity reflection dialog (no
 * category adaptation, no "need inspiration?", no AI follow-ups — just the
 * question, its guidance, and an open answer).
 *
 * Answers save on every Back/Continue and on blur, so leaving mid-question
 * never loses what was already typed — there is no separate "save" step to
 * forget to press.
 */
export function PersonalReflectionForm({
  applicationId,
  returnTo,
  initial,
}: {
  applicationId?: string | undefined;
  returnTo?: string | undefined;
  initial: PersonalReflectionValues;
}) {
  const t = useT();
  const router = useRouter();
  const [answers, setAnswers] = useState<PersonalReflectionValues>(initial);
  const [index, setIndex] = useState(() => {
    const firstUnanswered = PERSONAL_REFLECTION_QUESTIONS.findIndex((q) => !initial[q.key]?.trim());
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const question = personalReflectionQuestion(PERSONAL_REFLECTION_QUESTIONS[index]?.key ?? 'q1');
  const isLast = index === PERSONAL_REFLECTION_QUESTION_COUNT - 1;

  async function save(finish: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/reflection/personal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          ...(applicationId ? { applicationId } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? t('We could not save that. Please try again.'));
        setSaving(false);
        return false;
      }
      setSaving(false);
      if (finish) {
        const confirmReturn = returnTo || '/ai-strategy/report';
        router.push(`/ai-strategy/reflection/confirm?return=${encodeURIComponent(confirmReturn)}`);
      }
      return true;
    } catch {
      setError(t('We could not save that. Please try again.'));
      setSaving(false);
      return false;
    }
  }

  async function handleContinue() {
    if (isLast) {
      await save(true);
      return;
    }
    await save(false);
    setIndex((i) => Math.min(i + 1, PERSONAL_REFLECTION_QUESTION_COUNT - 1));
  }

  async function handleBack() {
    if (index === 0) return;
    await save(false);
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="flex flex-col gap-gb-lg">
        <h1 className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg">
          {t('Personal Reflection')}
        </h1>
        <ProgressBar
          value={Math.round(personalReflectionProgress(index + 1) * 100)}
          label={t('Question {current} of {total}', {
            current: index + 1,
            total: PERSONAL_REFLECTION_QUESTION_COUNT,
          })}
          size="sm"
        />
      </div>

      <div className="flex flex-col gap-gb-lg">
        <h2 className="text-gb-lg font-semibold text-fg">{t(question.heading)}</h2>
        <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
          <li className="font-medium text-fg-tertiary">{t('Think about:')}</li>
          {question.guidance.map((line) => (
            <li key={line}>• {t(line)}</li>
          ))}
        </ul>
      </div>

      <Textarea
        name={`personal-reflection-${question.key}`}
        label={t('Your answer')}
        rows={7}
        value={answers[question.key] ?? ''}
        onChange={(e) => setAnswers({ ...answers, [question.key]: e.target.value })}
        onBlur={() => void save(false)}
        placeholder={t('Write in your own words…')}
      />

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

      <div className="flex items-center justify-between gap-gb-lg">
        <Button type="button" variant="secondary" disabled={index === 0 || saving} onClick={() => void handleBack()}>
          {t('Back')}
        </Button>
        <Button type="button" disabled={saving} onClick={() => void handleContinue()}>
          {saving ? t('Saving…') : isLast ? t('Continue to Review & Confirm') : t('Continue')}
        </Button>
      </div>
    </div>
  );
}
