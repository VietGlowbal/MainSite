'use client';

import { useT } from '@/lib/i18n';
import { Badge } from '@/shared/ui';
import type { EligibilityRow } from '../../domain';

export function RequirementStatusTrack({
  criteria,
}: {
  criteria: EligibilityRow[];
}) {
  const t = useT();

  return (
    <div className="flex flex-col divide-y divide-line rounded-gb-2xl border border-line bg-surface shadow-xs">
      {criteria.map((row) => {
        let riskLabel = t('Low risk');
        let riskVariant: 'safe-chip' | 'recommend-chip' | 'reach' | 'neutral-chip' = 'safe-chip';

        if (row.blocking) {
          riskLabel = t('Blocking');
          riskVariant = 'reach';
        } else if (row.status === 'not_met') {
          riskLabel = t('High risk');
          riskVariant = 'reach';
        } else if (row.status === 'unknown') {
          riskLabel = t('Unchecked');
          riskVariant = 'neutral-chip';
        }

        return (
          <div
            key={row.key}
            className="flex flex-col gap-gb-sm p-gb-lg transition-colors hover:bg-surface-muted/40"
          >
            {/* Top row: Requirement Name, Track, Assessment, Risk Badge */}
            <div className="flex flex-wrap items-center justify-between gap-gb-md">
              <div className="flex min-w-[12rem] items-center gap-gb-sm">
                <span
                  className={[
                    'h-2.5 w-2.5 rounded-full shrink-0',
                    row.blocking
                      ? 'bg-rose-500 ring-4 ring-rose-100'
                      : row.status === 'met'
                        ? 'bg-emerald-500 ring-4 ring-emerald-100'
                        : 'bg-neutral-300 ring-4 ring-neutral-100',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <span className="font-display text-gb-sm font-semibold text-fg">
                  {t(row.label)}
                </span>
              </div>

              {/* Status Sequence Indicator */}
              <div className="flex flex-wrap items-center gap-gb-xs">
                {/* Assessment Badge */}
                {row.blocking ? (
                  <Badge variant="reach">{t(row.statusLabel)}</Badge>
                ) : row.status === 'met' ? (
                  <Badge variant="safe-chip">{t(row.statusLabel)}</Badge>
                ) : (
                  <Badge variant="neutral-chip">{t(row.statusLabel)}</Badge>
                )}

                {/* Risk Level Badge */}
                <Badge variant={riskVariant}>{riskLabel}</Badge>
              </div>
            </div>

            {/* Visual Status Track bar */}
            <div className="flex items-center gap-2">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-500',
                    row.blocking
                      ? 'w-1/3 bg-rose-500'
                      : row.status === 'met'
                        ? 'w-full bg-emerald-500'
                        : 'w-1/2 bg-neutral-300',
                  ].join(' ')}
                />
              </div>
              <span className="text-[10px] font-medium text-fg-muted uppercase tracking-wider">
                {row.status === 'met' ? t('Eligible') : row.blocking ? t('Action required') : t('To verify')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
