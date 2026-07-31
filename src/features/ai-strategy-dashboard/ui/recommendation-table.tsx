'use client';

import Link from 'next/link';
import type { Recommendation } from '../domain';
import { SEEDED_CATEGORIES, groupByCategory } from '../domain';
import { ProgressStatusControl } from './progress-status-control';
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
 * Priority / Recommendation / Reason / Status / Help. The title links to the
 * Recommendation Detail page (Requirement 11); Status is
 * `ProgressStatusControl` (Requirement 13), shared with that page so a
 * change made in either place can't disagree with the other.
 */
export function RecommendationTable({
  applicationId,
  recommendations,
}: {
  applicationId: string;
  recommendations: readonly Recommendation[];
}) {
  if (recommendations.length === 0) {
    return (
      <p className="text-gb-sm text-fg-tertiary">
        No recommendations yet — generate your strategy from the AI Strategy Introduction page.
      </p>
    );
  }

  const groups = groupByCategory(recommendations);

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
                    <td className="px-gb-lg py-gb-lg align-top text-gb-sm font-medium">
                      <Link
                        href={`/ai-strategy/${applicationId}/strategy/recommendations/${rec.id}`}
                        className="text-fg hover:text-fg-brand hover:underline"
                      >
                        {rec.title}
                      </Link>
                    </td>
                    <td className="px-gb-lg py-gb-lg align-top text-gb-sm text-fg-tertiary">
                      {rec.reason ?? '—'}
                    </td>
                    <td className="px-gb-lg py-gb-lg align-top">
                      <ProgressStatusControl
                        applicationId={applicationId}
                        recommendationId={rec.id}
                        status={rec.status}
                        label={`Status for ${rec.title}`}
                      />
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
