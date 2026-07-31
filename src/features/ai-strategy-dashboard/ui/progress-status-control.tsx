'use client';

import { useState } from 'react';
import type { ProgressStatus } from '../domain';
import { PROGRESS_STATUS, PROGRESS_STATUS_LABEL } from '../domain';

/**
 * Progress Tracker control — requirements.md Requirement 13. One PATCH call,
 * optimistic update with rollback on failure. Shared by the recommendation
 * table and the detail page so the two can't fall out of sync on how a
 * status change is sent.
 */
export function ProgressStatusControl({
  applicationId,
  recommendationId,
  status,
  label,
  onChange,
}: {
  applicationId: string;
  recommendationId: string;
  status: ProgressStatus;
  /** Accessible name — the table passes the row's title, the detail page a generic label. */
  label: string;
  onChange?: (status: ProgressStatus) => void;
}) {
  const [value, setValue] = useState(status);
  const [pending, setPending] = useState(false);

  async function update(next: ProgressStatus) {
    const previous = value;
    setValue(next);
    setPending(true);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/strategy/recommendations/${recommendationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        },
      );
      if (!res.ok) {
        setValue(previous);
        return;
      }
      onChange?.(next);
    } catch {
      setValue(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      aria-label={label}
      value={value}
      disabled={pending}
      onChange={(e) => update(e.target.value as ProgressStatus)}
      className="rounded-gb-md border border-line bg-surface px-gb-md py-gb-xs text-gb-sm text-fg"
    >
      {PROGRESS_STATUS.map((s) => (
        <option key={s} value={s}>
          {PROGRESS_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
