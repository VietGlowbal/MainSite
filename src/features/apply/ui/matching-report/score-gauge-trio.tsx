'use client';

import { useT } from '@/lib/i18n';
import { Badge, type BadgeVariant } from '@/shared/ui';
import type { ClassificationTone, MatchSummary } from '../../domain';

const TONE_BADGE: Record<ClassificationTone, BadgeVariant> = {
  safe: 'safe',
  recommend: 'recommend',
  reach: 'reach',
  neutral: 'neutral',
  blocked: 'reach',
};

type GaugeProps = {
  value: number | null;
  label: string;
  isPrimary?: boolean;
  badgeContent?: React.ReactNode;
};

function CircularGauge({ value, label, isPrimary = false, badgeContent }: GaugeProps) {
  const t = useT();
  const assessed = value !== null;
  const pct = assessed ? Math.max(0, Math.min(100, Math.round(value))) : 0;

  // Geometry
  const size = isPrimary ? 128 : 108;
  const stroke = isPrimary ? 8.5 : 7;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  const strokeDashoffset = assessed ? circumference - (pct / 100) * circumference : circumference;

  return (
    <div
      className={[
        'flex flex-1 flex-col items-center justify-between rounded-gb-2xl p-gb-lg text-center transition-all duration-300',
        isPrimary
          ? 'border border-rose-200/70 bg-gradient-to-b from-rose-50/60 via-white to-white shadow-xs'
          : 'border border-line/60 bg-surface-muted/40 hover:bg-surface-muted/70',
      ].join(' ')}
    >
      <div className="relative flex items-center justify-center">
        {/* Ambient Glow for Primary Gauge */}
        {isPrimary && assessed ? (
          <div
            className="absolute inset-0 rounded-full bg-brand/10 blur-md pointer-events-none"
            aria-hidden="true"
          />
        ) : null}

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rotate-[-90deg] transform"
          role="img"
          aria-label={`${label}: ${assessed ? `${pct}%` : t('Not assessed')}`}
        >
          {/* Background Track */}
          <circle
            cx={centre}
            cy={centre}
            r={radius}
            fill="none"
            stroke="currentColor"
            className={isPrimary ? 'text-rose-100' : 'text-neutral-200/80'}
            strokeWidth={stroke}
            strokeDasharray={assessed ? undefined : '4 4'}
          />

          {/* Active Arc */}
          {assessed && pct > 0 ? (
            <circle
              cx={centre}
              cy={centre}
              r={radius}
              fill="none"
              stroke="currentColor"
              className={isPrimary ? 'text-brand' : 'text-brand-600/90'}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          ) : null}
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {assessed ? (
            <span
              className={[
                'font-display font-bold tracking-tight text-fg',
                isPrimary ? 'text-gb-display-xs' : 'text-gb-xl',
              ].join(' ')}
            >
              {pct}
              <span className="text-gb-xs font-semibold text-fg-muted">%</span>
            </span>
          ) : (
            <span className="text-gb-xs font-semibold text-fg-muted uppercase tracking-wider">
              {t('N/A')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-gb-md flex flex-col items-center gap-gb-xs">
        <span className="text-gb-xxs font-bold uppercase tracking-wider text-fg-muted">
          {label}
        </span>
        {badgeContent ? <div className="mt-gb-2xs">{badgeContent}</div> : null}
      </div>
    </div>
  );
}

export function ScoreGaugeTrio({ summary }: { summary: MatchSummary }) {
  const t = useT();

  return (
    <div className="grid grid-cols-1 gap-gb-md sm:grid-cols-3">
      {/* 1. Overall Match Score (Visually dominant) */}
      <CircularGauge
        value={summary.matchPercent}
        label={t('Overall Match')}
        isPrimary
        badgeContent={<Badge variant={TONE_BADGE[summary.tone]}>{t(summary.label)}</Badge>}
      />

      {/* 2. Application Readiness */}
      <CircularGauge
        value={summary.readinessPercent}
        label={t('Application Readiness')}
      />

      {/* 3. Confidence Level */}
      <CircularGauge
        value={summary.confidencePercent}
        label={t('Confidence Level')}
      />
    </div>
  );
}
