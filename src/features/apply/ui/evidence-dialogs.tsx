'use client';

import { useState } from 'react';
import {
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_CATEGORY_META,
  EXPERIENCE_SUBTYPES,
  type ExperienceSubtype,
  type TopLevelExperienceCategory,
} from '@/features/apply/domain';
import { ICONS, KitIcon } from '@/shared/ui';
import { Button, Modal } from '@/shared/ui';
import { questionIcon } from './question-chrome';

/**
 * "+ Add experience" → one of the four approved top-level categories, then
 * (only when more than one exists) which specific subtype — before the edit
 * modal opens already knowing which table/category to create. See
 * `activity-reflection.ts`'s `EXPERIENCE_SUBTYPES` for why every subtype
 * here resolves to an EXISTING achievement/activity category value rather
 * than a new one.
 */
export function ExperienceCategoryChooser({
  open,
  onClose,
  onChoose,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (subtype: ExperienceSubtype) => void;
  t: (key: string) => string;
}) {
  const [category, setCategory] = useState<TopLevelExperienceCategory | null>(null);

  function close() {
    onClose();
    // Reset after the close animation has a moment to start, so reopening
    // always begins at the category step rather than wherever it was left.
    setTimeout(() => setCategory(null), 200);
  }

  function pickCategory(next: TopLevelExperienceCategory) {
    const subtypes = EXPERIENCE_SUBTYPES[next];
    if (subtypes.length === 1) {
      const only = subtypes[0]!;
      onClose();
      onChoose(only);
      setTimeout(() => setCategory(null), 200);
      return;
    }
    setCategory(next);
  }

  const subtypes = category ? EXPERIENCE_SUBTYPES[category] : [];

  return (
    <Modal open={open} onClose={close} label={category ? t('What best describes it?') : t('What kind of experience was this?')}>
      <div className="flex flex-col gap-gb-xl">
        {category ? (
          <>
            <div className="flex items-center gap-gb-md">
              <button
                type="button"
                onClick={() => setCategory(null)}
                aria-label={t('Back')}
                className="rounded-gb-sm p-gb-xs text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                <KitIcon art={ICONS.arrowLeft} frame={18} />
              </button>
              <h2 className="text-gb-lg font-semibold text-fg">{t('What best describes it?')}</h2>
            </div>
            <div className="flex flex-col gap-gb-md">
              {subtypes.map((subtype) => (
                <button
                  key={`${subtype.kind}-${subtype.category}`}
                  type="button"
                  onClick={() => {
                    onClose();
                    onChoose(subtype);
                    setTimeout(() => setCategory(null), 200);
                  }}
                  className="rounded-gb-xl border border-line p-gb-lg text-left text-gb-sm font-semibold text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {t(subtype.label)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-gb-lg font-semibold text-fg">{t('What kind of experience was this?')}</h2>
            <div className="grid gap-gb-lg sm:grid-cols-2">
              {EXPERIENCE_CATEGORIES.map((key) => {
                const meta = EXPERIENCE_CATEGORY_META[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickCategory(key)}
                    className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-xl text-left transition-colors hover:border-brand hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-gb-lg bg-brand-subtle text-fg-brand"
                    >
                      <KitIcon art={questionIcon(meta.icon)} frame={20} />
                    </span>
                    <span className="flex flex-col gap-gb-xxs">
                      <span className="text-gb-sm font-semibold text-fg">{t(meta.label)}</span>
                      <span className="text-gb-xs text-fg-tertiary">{t(meta.description)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** "Remove this achievement?" — the one confirmation every delete goes through. */
export function RemoveConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  title: string;
  /** e.g. "Remove this achievement?" */
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  return (
    <Modal open={open} onClose={onCancel} label={title}>
      <div className="flex flex-col gap-gb-xl">
        <div className="flex flex-col gap-gb-xs">
          <h2 className="text-gb-lg font-semibold text-fg">{title}</h2>
          <p className="text-gb-sm text-fg-tertiary">{description}</p>
        </div>
        <div className="flex justify-end gap-gb-md">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('Cancel')}
          </Button>
          <Button type="button" variant="secondary-destructive" onClick={onConfirm}>
            {t('Remove')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
