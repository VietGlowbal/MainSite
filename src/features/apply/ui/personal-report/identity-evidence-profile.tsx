'use client';

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
  const signals = (report.analytics?.narrativeIdentitySignals ?? []).filter((signal) => signal.score !== null);
  if (signals.length === 0) return null;

  return (
    <div className="grid gap-gb-xl rounded-gb-xl border border-line p-gb-xl lg:grid-cols-[1fr_0.9fr]">
      <div className="flex flex-col gap-gb-lg">
        <div>
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Identity evidence profile</p>
          <h3 className="mt-gb-xs text-gb-lg font-semibold text-fg">How established is the pattern behind your identity?</h3>
          <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
            These are evidence-health signals from your reflected experiences. They describe how strongly GlowBal can support the identity analysis — not how “good” your personality is.
          </p>
        </div>
        <HorizontalBarChart
          ariaLabel="Core identity evidence signals"
          data={signals.map((signal) => ({
            key: signal.key,
            label: signal.label,
            value: signal.score,
            caption: signal.explanation ?? SIGNAL_EXPLANATION[signal.key],
          }))}
        />
      </div>

      <div className="flex flex-col gap-gb-md">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">What the signals mean</p>
        {signals.map((signal) => (
          <div key={signal.key} className="rounded-gb-lg bg-surface-muted p-gb-md">
            <div className="flex items-start justify-between gap-gb-md">
              <p className="text-gb-sm font-semibold text-fg">{signal.label}</p>
              <Badge variant={signal.confidence === 'high' ? 'safe-chip' : 'neutral-chip'}>
                {signal.confidence} confidence
              </Badge>
            </div>
            <p className="mt-gb-xs text-gb-xs leading-relaxed text-fg-tertiary">
              {SIGNAL_EXPLANATION[signal.key] ?? signal.explanation ?? 'An evidence-backed identity signal.'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
