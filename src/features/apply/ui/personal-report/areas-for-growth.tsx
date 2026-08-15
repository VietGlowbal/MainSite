'use client';

import type { PersonalReportV2 } from '../../domain';
import { Badge } from '@/shared/ui';
import { SectionShell } from './shared';

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

/**
 * Transitional Areas for Growth view for the new Personal Canvas. It only
 * surfaces limitations the current evaluation engine already recorded; it
 * does not manufacture new weaknesses on the client. A future report schema
 * can replace these with dedicated Current gap → Why it matters → Suggested
 * direction records without changing the six-section page structure.
 */
export function AreasForGrowthView({ report }: { report: PersonalReportV2 }) {
  const gaps = unique([
    ...report.personalPositioning.whatPreventsStrongerPositioning,
    ...report.coreIdentity.stillDeveloping,
    ...report.emergingThemes.themes.map((theme) => theme.limitation),
  ]).slice(0, 3);

  return (
    <SectionShell eyebrow="Areas for Growth" title="Where your profile can become stronger">
      {gaps.length > 0 ? (
        <div className="grid gap-gb-lg md:grid-cols-3">
          {gaps.map((gap, index) => (
            <article key={gap} className="flex flex-col gap-gb-md rounded-gb-xl border border-line p-gb-lg">
              <div className="flex items-center justify-between gap-gb-md">
                <Badge variant="neutral-chip">Priority {index + 1}</Badge>
                <span className="text-gb-xs text-fg-muted">Evidence gap</span>
              </div>
              <h3 className="text-gb-md font-semibold text-fg">Growth opportunity</h3>
              <p className="text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>
                {gap}
              </p>
              <div className="mt-auto border-t border-line pt-gb-md">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Suggested direction</p>
                <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
                  Add stronger, more specific evidence in this area before treating it as an established strength.
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-gb-xl bg-surface-muted p-gb-xl">
          <p className="text-gb-sm font-semibold text-fg">No high-confidence growth gaps identified yet.</p>
          <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
            As you add more reflected experiences, GlowBal can distinguish genuine development opportunities from simple missing data.
          </p>
        </div>
      )}

      <div className="rounded-gb-xl border border-dashed border-line p-gb-lg">
        <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Next iteration</p>
        <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
          This section is ready for the dedicated impact × effort matrix once growth recommendations are generated as structured report data.
        </p>
      </div>
    </SectionShell>
  );
}
