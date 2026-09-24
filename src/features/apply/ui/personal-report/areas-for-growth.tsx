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
            <article key={gap} className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
              <div className="flex items-center justify-between gap-gb-md">
                <Badge variant="neutral-chip">Priority {index + 1}</Badge>
                <span className="text-gb-xs font-semibold text-fg-muted">Evidence gap</span>
              </div>
              <h3 className="text-gb-base sm:text-gb-md font-bold text-fg">Growth opportunity</h3>
              <p className="text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary" data-no-auto-translate>
                {gap}
              </p>
              <div className="mt-auto border-t border-line/60 pt-gb-md">
                <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Suggested direction</p>
                <p className="mt-1 text-gb-sm leading-relaxed text-fg-secondary">
                  Build more specific, verifiable evidence in this area so GlowBal can distinguish an emerging capability from a genuine development gap.
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-gb-xl border border-line bg-surface-muted/60 p-6 sm:p-8">
          <p className="text-gb-base font-bold text-fg">No high-confidence growth gaps identified yet.</p>
          <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
            As you add more reflected experiences, GlowBal can distinguish genuine development opportunities from simple missing data.
          </p>
        </div>
      )}
    </SectionShell>
  );
}
