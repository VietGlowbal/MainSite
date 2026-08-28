'use client';

import type { PersonalReportV2 } from '../../domain';
import { Badge } from '@/shared/ui';
import { useT } from '@/lib/i18n';

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

/**
 * Executive summary for the Personal Report. `snapshot.summary` is the
 * canonical 150–200 word contract; the shorter overview is only a legacy
 * fallback for report versions created before that field existed.
 */
export function ApplicantSnapshotView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const themes = report.emergingThemes.themes.slice(0, 2).map((theme) => theme.theme);
  const tags = unique([
    report.coreIdentity.recurringRole,
    report.coreIdentity.valueOrientation,
    ...themes,
  ]).slice(0, 4);
  const evidenceCount = report.analytics?.evidenceSummary.totalItems;

  const headline =
    report.coreIdentity.headline ??
    report.personalPositioning.statement ??
    'Your applicant profile is still taking shape';

  const summary =
    report.snapshot?.summary ??
    report.overview?.summary ??
    report.coreIdentity.interpretation ??
    report.personalPositioning.statement ??
    'Add more reflected experiences to help GlowBal identify reliable patterns across your profile.';

  return (
    <section
      aria-labelledby="applicant-snapshot-title"
      className="overflow-hidden rounded-gb-2xl border border-line bg-surface"
    >
      <div className="grid gap-gb-2xl p-gb-xl md:grid-cols-[minmax(0,1fr)_auto] md:p-gb-2xl">
        <div className="flex max-w-3xl flex-col gap-gb-lg">
          <div className="flex flex-col gap-gb-xs">
            <p className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">
              Applicant Snapshot
            </p>
            <h2
              id="applicant-snapshot-title"
              className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg"
              data-no-auto-translate
            >
              {headline}
            </h2>
          </div>

          <p className="text-gb-md leading-relaxed text-fg-tertiary" data-no-auto-translate>
            {summary}
          </p>

          {report.overallSummary?.paragraphs[0] ? (
            <div className="rounded-gb-xl bg-surface-muted p-gb-lg" data-no-auto-translate>
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Overall impression')}</p>
              <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">
                {report.overallSummary.paragraphs[0]}
              </p>
            </div>
          ) : null}

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-gb-sm" aria-label="Applicant profile themes">
              {tags.map((tag) => (
                <Badge key={tag} variant="brand-chip">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex min-w-[11rem] flex-col justify-end gap-gb-xs rounded-gb-xl bg-surface-muted p-gb-lg">
          <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">Evidence base</p>
          <p className="font-display text-gb-display-xs font-semibold text-fg">
            {evidenceCount ?? '—'}
          </p>
          <p className="text-gb-xs leading-relaxed text-fg-tertiary">
            {evidenceCount == null
              ? 'Evidence count is unavailable for this report version.'
              : `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} considered in this report.`}
          </p>
        </div>
      </div>
    </section>
  );
}
