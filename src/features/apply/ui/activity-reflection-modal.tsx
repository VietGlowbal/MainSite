'use client';

import { useState } from 'react';
import {
  REFLECTION_DIMENSIONS,
  REFLECTION_DIMENSION_COUNT,
  activityReflectionProgress,
  reflectionInspiration,
  reflectionQuestion,
  type ActivityReflectionValues,
  type ExperienceCategory,
  type ReflectionDimension,
} from '@/features/apply/domain';
import { Button, ProgressBar, Modal, Textarea } from '@/shared/ui';

/**
 * The activity-level reflection dialog — Context → Motivation → Challenge →
 * Action → Impact → Transformation → Future, one dimension per screen.
 *
 * ─── CONTROLLED, NOT ITS OWN SOURCE OF TRUTH ─────────────────────────────────
 *
 * Every keystroke calls `onChange` with the whole updated
 * `ActivityReflectionValues`, and the parent (`reflection-evidence-form.tsx`)
 * holds it as part of the item's normal draft state. Closing this dialog —
 * the X, the backdrop, navigating away — therefore never loses an answer:
 * there is nothing "in" the dialog that is not already in the parent, the
 * same guarantee `EditEvidenceModal` already gives every other field on the
 * item. Persisting to the server is the parent's job (the ordinary
 * `PATCH /api/reflection` whole-list save), not this component's.
 */

export function ActivityReflectionModal({
  open,
  onClose,
  category,
  activityTitle,
  value,
  onChange,
  onRequestCard,
  t,
}: {
  open: boolean;
  onClose: () => void;
  category: ExperienceCategory;
  activityTitle: string;
  value: ActivityReflectionValues;
  onChange: (next: ActivityReflectionValues) => void;
  /** Called when the student finishes the last dimension and wants a Reflection Card. */
  onRequestCard: () => void;
  t: (s: string, vars?: Record<string, string | number>) => string;
}) {
  const [index, setIndex] = useState(0);
  const [showInspiration, setShowInspiration] = useState(false);

  // Reset to the first unanswered dimension (or the start) each time the
  // dialog opens, rather than remembering the last position across
  // different activities. Adjusted during render (React's documented
  // pattern for resetting state when a prop changes) rather than in a
  // `useEffect`, which would set state synchronously on mount.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const firstUnanswered = REFLECTION_DIMENSIONS.findIndex((dim) => !value[dim]?.trim());
      setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
      setShowInspiration(false);
    }
  }

  const dimension: ReflectionDimension = REFLECTION_DIMENSIONS[index] ?? 'context';
  const question = reflectionQuestion(category, dimension);
  const isLast = index === REFLECTION_DIMENSION_COUNT - 1;

  function updateAnswer(text: string) {
    onChange({ ...value, [dimension]: text, updatedAt: new Date().toISOString() });
  }

  function goNext() {
    setShowInspiration(false);
    if (isLast) {
      onRequestCard();
      return;
    }
    setIndex((i) => Math.min(i + 1, REFLECTION_DIMENSION_COUNT - 1));
  }

  function goBack() {
    setShowInspiration(false);
    setIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Reflect on {title}', { title: activityTitle })}
      className="flex max-h-[90vh] w-full max-w-gb-width-md flex-col gap-gb-2xl overflow-y-auto p-gb-3xl sm:max-h-[85vh]"
    >
      <div className="flex flex-col gap-gb-md">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">{activityTitle}</p>
        <ProgressBar
          value={Math.round(activityReflectionProgress(index + 1) * 100)}
          label={t('{current} of {total} · {dimension}', {
            current: index + 1,
            total: REFLECTION_DIMENSION_COUNT,
            dimension: t(DIMENSION_LABELS[dimension]),
          })}
          size="sm"
        />
      </div>

      <div className="flex flex-col gap-gb-lg">
        <h2 className="text-gb-lg font-semibold text-fg">{t(question.heading)}</h2>
        <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-tertiary">
          {question.guidance.map((line) => (
            <li key={line}>{t(line)}</li>
          ))}
        </ul>
      </div>

      <Textarea
        name={`reflection-${dimension}`}
        label={t('Your answer')}
        rows={6}
        value={value[dimension] ?? ''}
        onChange={(e) => updateAnswer(e.target.value)}
        placeholder={t('Write in your own words…')}
      />

      <div>
        <button
          type="button"
          onClick={() => setShowInspiration((v) => !v)}
          className="text-gb-sm font-semibold text-fg-brand hover:underline"
        >
          {showInspiration ? t('Hide example') : t('Need inspiration?')}
        </button>
        {showInspiration ? (
          <p className="mt-gb-md rounded-gb-lg bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg-secondary">
            {t(reflectionInspiration(dimension))}
          </p>
        ) : null}
      </div>

      <div className="mt-gb-md flex items-center justify-between gap-gb-lg">
        <Button type="button" variant="secondary" onClick={index === 0 ? onClose : goBack}>
          {index === 0 ? t('Save & exit') : t('Back')}
        </Button>
        <Button type="button" onClick={goNext}>
          {isLast ? t('Finish reflection') : t('Continue')}
        </Button>
      </div>
    </Modal>
  );
}

const DIMENSION_LABELS: Record<ReflectionDimension, string> = {
  context: 'Context',
  motivation: 'Motivation',
  challenge: 'Challenge',
  action: 'Action',
  impact: 'Impact',
  transformation: 'Transformation',
  future: 'Future',
};
