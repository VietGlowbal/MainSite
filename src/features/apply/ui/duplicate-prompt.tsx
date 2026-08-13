'use client';

import type { EvidenceDuplicate } from '../domain';
import { Button } from '@/shared/ui';

/**
 * "Possible duplicate" — shown for each extracted candidate whose title
 * matches something already on the profile, per document §38-39.
 *
 * Sits above the card grid rather than inside it: a duplicate is not yet a
 * card (it was deliberately held back by `applyEvidenceCandidates`), so it
 * has nowhere else on the page to render.
 */
export function DuplicatePrompt({
  duplicates,
  onMerge,
  onKeepBoth,
  t,
}: {
  duplicates: EvidenceDuplicate[];
  onMerge: (duplicate: EvidenceDuplicate) => void;
  onKeepBoth: (duplicate: EvidenceDuplicate) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  if (duplicates.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-xl">
      <p className="text-gb-sm font-semibold text-fg">
        {duplicates.length === 1
          ? t('Possible duplicate')
          : t('{count} possible duplicates', { count: duplicates.length })}
      </p>
      <ul className="flex flex-col gap-gb-md">
        {duplicates.map((duplicate) => (
          <li
            key={duplicate.candidate.candidateId}
            className="flex flex-wrap items-center justify-between gap-gb-md rounded-gb-lg border border-line bg-surface p-gb-lg"
          >
            <p className="text-gb-sm text-fg-secondary">
              {t('“{title}” looks like it might already be on your profile as “{existing}”.', {
                title: duplicate.candidate.data.title,
                existing: duplicate.existingTitle,
              })}
            </p>
            <div className="flex gap-gb-sm">
              <Button type="button" variant="secondary" size="sm" onClick={() => onKeepBoth(duplicate)}>
                {t('Keep both')}
              </Button>
              <Button type="button" size="sm" onClick={() => onMerge(duplicate)}>
                {t('Merge')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
