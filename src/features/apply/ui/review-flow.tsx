'use client';

import { Button, Modal } from '@/shared/ui';
import type { EvidenceDraft } from './edit-evidence-modal';

/**
 * "Review achievements" — steps through the extracted items still marked
 * `needs_review`, one at a time, instead of leaving a student to inspect all
 * of them scattered across the card grid.
 *
 * Keep and Remove act immediately and advance; Edit hands the item to the
 * caller and closes this drawer rather than stacking a second modal on top of
 * it — the edit modal reopens the review drawer itself once the student saves
 * or cancels, so the queue is never lost.
 */
export function ReviewFlowDrawer({
  open,
  queue,
  total,
  onKeep,
  onEdit,
  onRemove,
  onClose,
  t,
}: {
  open: boolean;
  /**
   * The items still needing review, in the order they are stepped through.
   * Shrinks as each is resolved — this is the remaining queue, not the full
   * one the review flow started with.
   */
  queue: EvidenceDraft[];
  /** How many there were when "Review achievements" was clicked — the fixed
   *  denominator, so the count reads "3 of 14" rather than "1 of 12" once a
   *  couple have already been resolved. */
  total: number;
  onKeep: (item: EvidenceDraft) => void;
  onEdit: (item: EvidenceDraft) => void;
  onRemove: (item: EvidenceDraft) => void;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (!open) return null;

  const current = queue[0];

  if (!current) {
    return (
      <Modal open={open} onClose={onClose} label={t('All extracted achievements reviewed')}>
        <div className="flex flex-col items-center gap-gb-xl py-gb-lg text-center">
          <p className="text-gb-lg font-semibold text-fg">
            {t('All extracted achievements reviewed')}
          </p>
          <Button type="button" onClick={onClose}>
            {t('Done')}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} label={t('Review achievements')}>
      <div className="flex flex-col gap-gb-xl">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
          {t('{current} of {total}', { current: total - queue.length + 1, total })}
        </p>

        <div className="flex flex-col gap-gb-xs">
          <h2 className="text-gb-lg font-semibold text-fg">{current.title}</h2>
          {current.kind === 'achievement' ? (
            <p className="text-gb-sm text-fg-tertiary">
              {[current.competition ?? current.organisation, current.year ? String(current.year) : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : (
            <p className="text-gb-sm text-fg-tertiary">
              {[current.organisation, current.period].filter(Boolean).join(' · ')}
            </p>
          )}
          {(current.kind === 'achievement' ? current.detail : current.description) ? (
            <p className="text-gb-sm text-fg-secondary">
              {current.kind === 'achievement' ? current.detail : current.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-gb-md">
          <Button type="button" variant="secondary" onClick={() => onRemove(current)}>
            {t('Remove')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onEdit(current)}>
            {t('Edit')}
          </Button>
          <Button type="button" onClick={() => onKeep(current)}>
            {t('Keep')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
