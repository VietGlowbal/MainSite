'use client';

import { ICONS, KitIcon } from '@/shared/ui';
import type { SaveStatus } from '../hooks/use-autosave';

/**
 * The small "Saving / Saved / Could not save" line beside a heading or field.
 *
 * WHY NOT A TOAST. The requirement is explicit that autosave must not be
 * confirmed by a toast alone, and the reason is that a toast is gone by the time
 * a student wonders whether their work saved. This sits next to what it describes
 * and stays there.
 *
 * `aria-live="polite"` rather than `assertive`: a save confirmation should not
 * interrupt a screen-reader user mid-sentence while they are typing. The failure
 * case gets `role="alert"` instead, because that one does need to interrupt.
 */
export function AutosaveStatus({
  status,
  version,
  onRetry,
}: {
  status: SaveStatus;
  /** Shown after a successful save so the student can see it moved. */
  version?: number | undefined;
  /** Wired to the hook's `retry`. Required for the error state to be recoverable. */
  onRetry?: (() => void) | undefined;
}) {
  if (status === 'error') {
    return (
      <span role="alert" className="inline-flex items-center gap-gb-xs text-gb-xs text-fg-error">
        <KitIcon art={ICONS.messageChatCircle} frame={12} />
        Could not save
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline decoration-line-strong underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        ) : null}
      </span>
    );
  }

  if (status === 'idle') {
    return null;
  }

  return (
    <span aria-live="polite" className="inline-flex items-center gap-gb-xs text-gb-xs text-fg-muted">
      {status === 'saved' ? <KitIcon art={ICONS.checkCircle} frame={12} /> : null}
      {status === 'saving' ? 'Saving' : 'Saved'}
      {status === 'saved' && version !== undefined ? ` · version ${version}` : ''}
    </span>
  );
}
