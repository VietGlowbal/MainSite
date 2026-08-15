'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DIMENSION_LABELS,
  REFLECTION_DIMENSIONS,
  REFLECTION_DIMENSION_COUNT,
  activityReflectionProgress,
  reflectionQuestion,
  type ActivityReflectionValues,
  type ExperienceCategory,
  type ReflectionDimension,
} from '@/features/apply/domain';
import { Button, ProgressBar, Modal, Textarea, useAutoGrowTextarea } from '@/shared/ui';

/**
 * The activity-level reflection dialog — Context → Motivation → Challenge →
 * Action → Impact → Transformation → Future, one dimension per screen.
 *
 * ─── CONTROLLED, NOT ITS OWN SOURCE OF TRUTH ─────────────────────────────────
 *
 * Every keystroke calls `onChange` with the whole updated
 * `ActivityReflectionValues`, and the parent (`reflection-evidence-form.tsx`)
 * holds it as part of the item's normal draft state. Closing this dialog —
 * the X, the backdrop, navigating away — therefore never loses an answer.
 * `dimensionIndex`/`onDimensionIndexChange` are controlled the same way, for
 * a different reason: the surrounding page's breadcrumb needs to say
 * "Entrepreneurship Club / Challenge" and update live as the student moves
 * between dimensions, which means the current dimension has to live above
 * this component, not inside it.
 *
 * ─── THREE DISCLOSURE LEVELS, NOT TWO ────────────────────────────────────────
 *
 * Level 1 (always shown): the main question. Level 2 ("Help me think",
 * collapsed by default): the two guiding prompts. Level 3 ("Need
 * inspiration?", collapsed by default, only offered once Level 2 is open):
 * the optional answer framework. Showing all three at once is exactly the
 * "looks like homework" problem this redesign exists to fix.
 */

export function ActivityReflectionModal({
  open,
  onClose,
  category,
  activityTitle,
  value,
  onChange,
  dimensionIndex,
  onDimensionIndexChange,
  onAutosave,
  onRequestCard,
  t,
}: {
  open: boolean;
  onClose: () => void;
  category: ExperienceCategory;
  activityTitle: string;
  value: ActivityReflectionValues;
  onChange: (next: ActivityReflectionValues) => void;
  /** 0-based index into `REFLECTION_DIMENSIONS`, owned by the parent so the page breadcrumb can reflect it. */
  dimensionIndex: number;
  onDimensionIndexChange: (index: number) => void;
  /** Debounced save-in-the-background hook — resolves once the answer is persisted. */
  onAutosave: () => Promise<void>;
  /** Called when the student finishes the last dimension and wants a Reflection Card. */
  onRequestCard: () => void;
  t: (s: string, vars?: Record<string, string | number>) => string;
}) {
  const [showGuidance, setShowGuidance] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapse both help levels again whenever the dialog opens or the
  // dimension changes — a framework read for Challenge should not still be
  // sitting open on Impact. Adjusting state during render (rather than in an
  // effect) avoids the extra commit-then-cascading-render an effect would
  // cause here — React bails out before painting the stale state.
  const openStepKey = `${open}-${dimensionIndex}`;
  const [lastOpenStepKey, setLastOpenStepKey] = useState(openStepKey);
  if (open && openStepKey !== lastOpenStepKey) {
    setLastOpenStepKey(openStepKey);
    setShowGuidance(false);
    setShowInspiration(false);
  }

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const dimension: ReflectionDimension = REFLECTION_DIMENSIONS[dimensionIndex] ?? 'context';
  const question = reflectionQuestion(category, dimension);
  const isLast = dimensionIndex === REFLECTION_DIMENSION_COUNT - 1;
  const textareaRef = useAutoGrowTextarea<HTMLTextAreaElement>(value[dimension] ?? '', { maxHeight: 360 });

  function updateAnswer(text: string) {
    onChange({ ...value, [dimension]: text, updatedAt: new Date().toISOString() });

    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      void onAutosave().then(() => {
        setSaveState('saved');
        savedTimer.current = setTimeout(() => setSaveState('idle'), 2000);
      });
    }, 800);
  }

  function goNext() {
    if (isLast) {
      onRequestCard();
      return;
    }
    onDimensionIndexChange(Math.min(dimensionIndex + 1, REFLECTION_DIMENSION_COUNT - 1));
  }

  function goBack() {
    onDimensionIndexChange(Math.max(dimensionIndex - 1, 0));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Reflect on {title}', { title: activityTitle })}
      className="flex max-h-[90vh] w-full max-w-gb-width-md flex-col gap-gb-xl overflow-y-auto p-gb-3xl sm:max-h-[85vh]"
    >
      <div className="flex flex-col gap-gb-md">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">{activityTitle}</p>
        <ProgressBar
          value={Math.round(activityReflectionProgress(dimensionIndex + 1) * 100)}
          label={t('{current} of {total} · {dimension}', {
            current: dimensionIndex + 1,
            total: REFLECTION_DIMENSION_COUNT,
            dimension: t(DIMENSION_LABELS[dimension]),
          })}
          size="sm"
        />
      </div>

      <h2 className="text-gb-lg font-semibold text-fg sm:text-gb-xl">{t(question.heading)}</h2>

      {dimensionIndex === 0 ? (
        <p className="text-gb-xs text-fg-tertiary">
          {t('You don’t need polished answers. A few honest sentences is enough.')}
        </p>
      ) : null}

      <div className="flex flex-col gap-gb-md">
        <Textarea
          ref={textareaRef}
          name={`reflection-${dimension}`}
          rows={3}
          value={value[dimension] ?? ''}
          onChange={(e) => updateAnswer(e.target.value)}
          placeholder={t('Tell us what happened in your own words…')}
          className="resize-none"
        />
        <div className="flex min-h-[1.25rem] items-center justify-between gap-gb-lg text-gb-xs">
          <button
            type="button"
            onClick={() => setShowGuidance((v) => !v)}
            aria-expanded={showGuidance}
            className="flex items-center gap-gb-xs font-semibold text-fg-brand hover:underline"
          >
            💡 {showGuidance ? t('Hide help') : t('Help me think')}
          </button>
          <span aria-live="polite" className="text-fg-tertiary">
            {saveState === 'saving' ? t('Saving…') : saveState === 'saved' ? t('Saved') : ''}
          </span>
        </div>
      </div>

      {showGuidance && (question.guidance.length > 0 || question.framework) ? (
        <div className="flex flex-col gap-gb-md rounded-gb-lg bg-surface-muted p-gb-lg">
          {question.guidance.length > 0 ? (
            <div className="flex flex-col gap-gb-xs">
              <p className="text-gb-xs font-semibold text-fg-tertiary">{t('Think about:')}</p>
              <ul className="flex flex-col gap-gb-xs text-gb-sm text-fg-secondary">
                {question.guidance.map((line) => (
                  <li key={line}>• {t(line)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {question.framework ? (
            <div>
              <button
                type="button"
                onClick={() => setShowInspiration((v) => !v)}
                aria-expanded={showInspiration}
                className="text-gb-sm font-semibold text-fg-brand hover:underline"
              >
                {showInspiration ? t('Hide example') : t('Need inspiration?')}
              </button>
              {showInspiration ? (
                <p className="mt-gb-md rounded-gb-lg bg-surface px-gb-lg py-gb-md text-gb-sm text-fg-secondary">
                  {t('One way you could structure your answer:')} “{t(question.framework)}”
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-gb-md flex flex-wrap items-center justify-between gap-gb-lg">
        <Button type="button" variant="secondary" onClick={dimensionIndex === 0 ? onClose : goBack}>
          {dimensionIndex === 0 ? t('Save & exit') : t('Back')}
        </Button>
        <div className="flex items-center gap-gb-lg">
          {!isLast ? (
            <button
              type="button"
              onClick={goNext}
              className="text-gb-sm font-medium text-fg-tertiary hover:text-fg-secondary hover:underline"
            >
              {t('Skip for now')}
            </button>
          ) : null}
          <Button type="button" onClick={goNext}>
            {isLast ? t('Finish reflection') : t('Continue')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
