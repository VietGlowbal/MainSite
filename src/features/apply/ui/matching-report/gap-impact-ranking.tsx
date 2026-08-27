'use client';

import { useT } from '@/lib/i18n';
import { Badge } from '@/shared/ui';
import type { GapEntry } from '../../domain';

function ImpactDots({ level }: { level: number }) {
  const dots = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1" aria-label={`Impact level ${level} of 5`}>
      {dots.map((d) => (
        <span
          key={d}
          className={[
            'h-2 w-2 rounded-full transition-colors',
            d <= level
              ? 'bg-brand shadow-2xs'
              : 'bg-neutral-200 dark:bg-neutral-700',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

export function GapImpactRanking({
  gaps,
}: {
  gaps: GapEntry[];
}) {
  const t = useT();

  if (gaps.length === 0) {
    return (
      <div className="rounded-gb-2xl border border-line bg-surface p-gb-xl text-center">
        <p className="text-gb-sm text-fg-muted">
          {t('We did not find evidence-backed gaps for this programme.')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-gb-md">
      {gaps.map((entry, index) => {
        const isCritical = entry.tier === 'critical';
        const impactLevel = isCritical ? 5 - (index % 2) : 3 - (index % 2);

        return (
          <div
            key={`${entry.dimension}-${entry.text}`}
            className={[
              'flex flex-col gap-gb-md rounded-gb-2xl border p-gb-xl shadow-xs transition-all',
              isCritical
                ? 'border-rose-200/80 bg-rose-50/30 hover:bg-rose-50/50'
                : 'border-line bg-surface hover:bg-surface-muted/50',
            ].join(' ')}
          >
            {/* Header: Tier, Dimension, Impact Scale */}
            <div className="flex flex-wrap items-center justify-between gap-gb-sm border-b border-line/60 pb-gb-sm">
              <div className="flex items-center gap-gb-sm">
                <Badge variant={isCritical ? 'reach' : 'neutral-chip'}>
                  {isCritical ? t('Critical Gap') : t('Competitive Gap')}
                </Badge>
                <span className="font-display text-gb-sm font-semibold text-fg">
                  {t(entry.dimension)}
                </span>
              </div>

              {/* 5-Dot Impact Ranking */}
              <div className="flex items-center gap-2">
                <span className="text-gb-xxs font-bold uppercase tracking-wider text-fg-muted">
                  {t('Impact')}
                </span>
                <ImpactDots level={impactLevel} />
              </div>
            </div>

            {/* Gap Description & Action Direction */}
            <div className="flex flex-col gap-gb-xs">
              <p className="text-gb-sm leading-relaxed text-fg-secondary">
                {entry.text}
              </p>
              <div className="mt-gb-xs flex items-center gap-gb-xs text-gb-xs text-brand font-medium">
                <span>{t('Suggested focus')}:</span>
                <span className="text-fg-tertiary">
                  {isCritical
                    ? t('Prioritise addressing before submitting application')
                    : t('Can be reinforced through supporting materials or personal statement')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
