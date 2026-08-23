'use client';

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

import { useEffect, useRef, useState } from 'react';
import {
  DIMENSION_LABELS,
  REFLECTION_DIMENSIONS,
  REFLECTION_DIMENSION_COUNT,
  activityReflectionAnsweredCount,
  reflectionQuestion,
  type ActivityReflectionValues,
  type ExperienceCategory,
  type ReflectionDimension,
} from '@/features/apply/domain';
import { Badge, Button, Modal, Textarea, useAutoGrowTextarea } from '@/shared/ui';

function DimensionItem({
  dimension,
  category,
  value,
  onChange,
  t,
}: {
  dimension: ReflectionDimension;
  category: ExperienceCategory;
  value: string;
  onChange: (val: string) => void;
  t: (s: string, vars?: Record<string, string | number>) => string;
}) {
  const [showGuidance, setShowGuidance] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const question = reflectionQuestion(category, dimension);
  const textareaRef = useAutoGrowTextarea<HTMLTextAreaElement>(value, { maxHeight: 300 });

  return (
    <div className="flex flex-col gap-gb-sm rounded-gb-lg border border-line bg-surface p-gb-lg">
      <div className="flex flex-wrap items-start justify-between gap-gb-xs">
        <div className="flex flex-col gap-gb-xxs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
            {t(DIMENSION_LABELS[dimension])}
          </p>
          <h3 className="text-gb-md font-semibold text-fg">{t(question.heading)}</h3>
        </div>
        {value.trim() ? (
          <Badge variant="brand-subtle">{t('Answered')}</Badge>
        ) : (
          <Badge variant="neutral">{t('Optional')}</Badge>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        name={`reflection-${dimension}`}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('Tell us what happened in your own words…')}
        className="resize-none"
      />

      <div className="flex items-center gap-gb-lg text-gb-xs">
        <button
          type="button"
          onClick={() => setShowGuidance((v) => !v)}
          aria-expanded={showGuidance}
          className="flex items-center gap-gb-xs font-semibold text-fg-brand hover:underline"
        >
          💡 {showGuidance ? t('Hide help') : t('Help me think')}
        </button>
      </div>

      {showGuidance && (question.guidance.length > 0 || question.framework) ? (
        <div className="flex flex-col gap-gb-md rounded-gb-md bg-surface-muted p-gb-md">
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
                <p className="mt-gb-sm rounded-gb-md bg-surface px-gb-md py-gb-sm text-gb-sm text-fg-secondary">
                  {t('One way you could structure your answer:')} “{t(question.framework)}”
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The activity-level reflection dialog — single-page scrollable modal rendering
 * all 7 reflection dimensions with progressive disclosure.
 */
export function ActivityReflectionModal({
  open,
  onClose,
  category,
  activityTitle,
  value,
  onChange,
  // Legacy per-dimension stepper props: still accepted so existing callers
  // compile, deliberately unbound — the single-page layout ignores them.
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
  dimensionIndex?: number;
  onDimensionIndexChange?: (index: number) => void;
  /** Debounced save-in-the-background hook — resolves once the answer is persisted. */
  onAutosave: () => Promise<void>;
  /** Called when the student finishes the last dimension and wants a Reflection Card. */
  onRequestCard: () => void;
  t: (s: string, vars?: Record<string, string | number>) => string;
}) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const answeredCount = activityReflectionAnsweredCount(value);

  function updateDimensionAnswer(dim: ReflectionDimension, text: string) {
    onChange({ ...value, [dim]: text, updatedAt: new Date().toISOString() });

    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      void onAutosave()
        .then(() => {
          setSaveState('saved');
          savedTimer.current = setTimeout(() => setSaveState('idle'), 2000);
        })
        .catch(() => {
          setSaveState('idle');
        });
    }, 800);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Reflect on {title}', { title: activityTitle })}
      className="flex max-h-[90vh] w-full max-w-gb-width-lg flex-col gap-gb-lg overflow-y-auto p-gb-2xl sm:max-h-[85vh]"
    >
      <div className="flex flex-wrap items-end justify-between gap-gb-md border-b border-line pb-gb-md">
        <div className="flex flex-col gap-gb-xxs">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">{activityTitle}</p>
          <h2 className="text-gb-lg font-semibold text-fg">{t('Activity Reflection')}</h2>
        </div>
        <div className="flex items-center gap-gb-sm">
          <span className="text-gb-xs font-medium text-fg-tertiary">
            {t('{count} of {total} answered', {
              count: answeredCount,
              total: REFLECTION_DIMENSION_COUNT,
            })}
          </span>
          <span aria-live="polite" className="text-gb-xs text-fg-muted">
            {saveState === 'saving' ? t('Saving…') : saveState === 'saved' ? t('Saved') : ''}
          </span>
        </div>
      </div>

      <p className="text-gb-xs text-fg-tertiary">
        {t('You don’t need polished answers. A few honest sentences is enough.')}
      </p>

      <div className="flex flex-col gap-gb-md">
        {REFLECTION_DIMENSIONS.map((dim) => (
          <DimensionItem
            key={dim}
            dimension={dim}
            category={category}
            value={value[dim] ?? ''}
            onChange={(val) => updateDimensionAnswer(dim, val)}
            t={t}
          />
        ))}
      </div>

      <div className="mt-gb-md flex flex-wrap items-center justify-between gap-gb-lg border-t border-line pt-gb-md">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('Save & exit')}
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            void onAutosave()
              .then(() => onRequestCard())
              .catch(() => setSaveState('idle'));
          }}
        >
          {t('Finish reflection')}
        </Button>
      </div>
    </Modal>
  );
}
