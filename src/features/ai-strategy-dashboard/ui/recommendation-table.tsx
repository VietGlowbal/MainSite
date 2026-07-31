'use client';

import { useState } from 'react';
import type { ProgressStatus, Recommendation } from '../domain';
import { PROGRESS_STATUS, PROGRESS_STATUS_LABEL, groupByCategory } from '../domain';
import { SEEDED_CATEGORIES } from '../domain';
import { Badge, type BadgeVariant } from '@/shared/ui';

const PRIORITY_VARIANT: Record<Recommendation['priority'], BadgeVariant> = {
  urgent: 'reach',
  high: 'reach',
  medium: 'recommend',
  low: 'neutral',
};

function categoryLabel(key: string | null): string {
  if (!key) return 'General';
  return SEEDED_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/**
 * AI Recommendation Table — requirements.md Requirement 10. Grouped by
 * category (`domain/recommendation.ts#groupByCategory`), each row showing
 * Priority / Recommendation / Reason / Status / Help, with an inline status
 * control wired to `PATCH .../recommendations/[recId]` for the Progress
 * Tracker (Requirement 13).
 *
 * No Recommendation Detail page yet (tasks.md Phase 5) — "Help" links out
 * using whatever `actionTarget` the AI itself provided rather than a route
 * that doesn't exist.
 */
export function RecommendationTable({
  applicationId,
  recommendations,
}: {
  applicationId: string;
  recommendations: Recommendation[];
}) {
  const [rows, setRows] = useState(recommendations);
  const [pending, setPending] = useState<string | null>(null);

  async function updateStatus(id: string, status: ProgressStatus) {
    setPending(id);
    const previous = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/strategy/recommendations/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) setRows(previous);
    } catch {
      setRows(previous);
    } finally {
      setPending(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-gb-sm text-fg-tertiary">
        No recommendations yet — generate your strategy from the AI Strategy Introduction page.
      </p>
    );
  }

  const groups = groupByCategory(rows);

  return (
    <div className="flex flex-col gap-gb-3xl">
      {[...groups.entries()].map(([category, group]) => (
        <div key={category ?? 'general'} className="flex flex-col gap-gb-lg">
          <h3 className="text-gb-sm font-semibold uppercase tracking-wide text-fg-tertiary">
            {categoryLabel(category)}
          </h3>
          <div className="overflow-x-auto rounded-gb-xl border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-muted text-gb-xs font-semibold uppercase tracking-wide text-fg-tertiary">
                  <th className="px-gb-lg py-gb-md">Priority</th>
                  <th className="px-gb-lg py-gb-md">Recommendation</th>
                  <th className="px-gb-lg py-gb-md">Reason</th>
                  <th className="px-gb-lg py-gb-md">Status</th>
                  <th className="px-gb-lg py-gb-md">Help</th>
                </tr>
              </thead>
              <tbody>
                {group.map((rec) => (
                  <tr key={rec.id} className="border-b border-line last:border-b-0">
                    <td className="px-gb-lg py-gb-lg align-top">
                      <Badge variant={PRIORITY_VARIANT[rec.priority]}>{rec.priority}</Badge>
                    </td>
                    <td className="px-gb-lg py-gb-lg align-top text-gb-sm font-medium text-fg">
                      {rec.title}
                    </td>
                    <td className="px-gb-lg py-gb-lg align-top text-gb-sm text-fg-tertiary">
                      {rec.reason ?? '—'}
                    </td>
                    <td className="px-gb-lg py-gb-lg align-top">
                      <select
                        aria-label={`Status for ${rec.title}`}
                        value={rec.status}
                        disabled={pending === rec.id}
                        onChange={(e) => updateStatus(rec.id, e.target.value as ProgressStatus)}
                        className="rounded-gb-md border border-line bg-surface px-gb-md py-gb-xs text-gb-sm text-fg"
                      >
                        {PROGRESS_STATUS.map((status) => (
                          <option key={status} value={status}>
                            {PROGRESS_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-gb-lg py-gb-lg align-top text-gb-sm">
                      {rec.actionTarget ? (
                        <a
                          href={rec.actionTarget}
                          target={rec.actionType === 'external_url' ? '_blank' : undefined}
                          rel={rec.actionType === 'external_url' ? 'noopener noreferrer' : undefined}
                          className="font-semibold text-fg-brand hover:underline"
                        >
                          {rec.actionLabel ?? 'View'}
                        </a>
                      ) : (
                        <span className="text-fg-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
