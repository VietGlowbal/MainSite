'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportV2 } from '../../domain';
import { Badge, HorizontalBarChart } from '@/shared/ui';

const SIGNAL_EXPLANATION: Record<string, string> = {
  patternConsistency: 'How consistently specific behaviours recur across separate experiences.',
  thematicConvergence: 'How strongly your experiences converge around repeated areas of interest.',
  growthArc: 'Whether the available outcomes show a reliable development pattern over time.',
  differentiation: 'How distinctive the combination of your recurring role, method and themes appears.',
  evidenceDensity: 'How much usable evidence supports the identity analysis.',
};

export function IdentityEvidenceProfileView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const signals = (report.analytics?.narrativeIdentitySignals ?? []).filter((signal) => signal.score !== null);
  if (signals.length === 0) return null;

  return (
    <div className="grid gap-gb-2xl lg:grid-cols-12">
      <div className="flex flex-col justify-between gap-gb-xl rounded-gb-xl border border-line bg-surface p-6 sm:p-8 shadow-xs lg:col-span-7">
        <div>
          <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Identity evidence profile')}</p>
          <h3 className="mt-gb-xs text-gb-lg sm:text-gb-xl font-bold text-fg">{t('How established is the pattern behind your identity?')}</h3>
          <p className="mt-gb-sm text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
            {t('These are evidence-health signals from your reflected experiences. They describe how strongly GlowBal can support the identity analysis — not how “good” your personality is.')}
          </p>
        </div>
        <div className="mt-gb-md">
          <HorizontalBarChart
            ariaLabel={t('Core identity evidence signals')}
            data={signals.map((signal) => ({
              key: signal.key,
              label: signal.label,
              value: signal.score,
            }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface-muted/60 p-6 sm:p-7 lg:col-span-5">
        <div>
          <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('What the signals mean')}</p>
          <p className="mt-0.5 text-gb-xs text-fg-muted">{t('Evidence context and confidence')}</p>
        </div>
        <div className="flex flex-col gap-gb-sm">
          {signals.map((signal) => (
            <div key={signal.key} className="flex flex-col gap-1 rounded-gb-lg border border-line/60 bg-surface p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-gb-sm">
                <p className="text-gb-sm font-bold text-fg">{signal.label}</p>
                <Badge variant={signal.confidence === 'high' ? 'safe-chip' : 'neutral-chip'}>
                  {signal.confidence} {t('confidence')}
                </Badge>
              </div>
              <p className="text-gb-xs sm:text-gb-sm leading-relaxed text-fg-secondary">
                {SIGNAL_EXPLANATION[signal.key] ?? signal.explanation ?? t('An evidence-backed identity signal.')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

