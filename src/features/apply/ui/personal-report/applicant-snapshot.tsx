'use client';

import type { PersonalReportV2 } from '../../domain';
import { Badge, ICONS, KitIcon } from '@/shared/ui';
import { useT } from '@/lib/i18n';
import { ConfidenceBadge } from './shared';

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

/**
 * Formats simple inline markdown such as *keyword* into styled text,
 * preventing raw asterisks from showing up in prose paragraphs.
 */
function FormattedProse({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <span key={index} className="font-semibold text-fg">
              {part.slice(1, -1)}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

/**
 * Executive summary for the Personal Report. `snapshot.summary` is the
 * canonical 150–200 word contract; the shorter overview is only a legacy
 * fallback for report versions created before that field existed.
 */
export function ApplicantSnapshotView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const themes = report.emergingThemes.themes.slice(0, 3).map((theme) => theme.theme);

  // Filter out long narrative sentences (> 40 chars) so tags only display concise keywords/themes
  const tags = unique([
    ...themes,
    report.coreIdentity.recurringRole,
    report.coreIdentity.valueOrientation,
  ]).filter((tag) => tag.length <= 40);

  const evidenceCount = report.analytics?.evidenceSummary.totalItems;

  const headline =
    report.coreIdentity.headline ??
    report.personalPositioning.statement ??
    'Your applicant profile is still taking shape';

  const summary =
    report.narrativeDetails?.snapshot ??
    report.snapshot?.summary ??
    report.overview?.summary ??
    report.coreIdentity.interpretation ??
    report.personalPositioning.statement ??
    'Add more reflected experiences to help GlowBal identify reliable patterns across your profile.';

  return (
    <section
      aria-labelledby="applicant-snapshot-title"
      className="group relative overflow-hidden rounded-gb-2xl border border-line bg-surface shadow-gb-xs transition-shadow duration-300 hover:shadow-gb-lg"
    >
      {/* Top brand accent bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-brand/70 to-brand/30" />

      <div className="grid gap-gb-2xl p-gb-xl md:p-gb-2xl lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        {/* Main narrative column */}
        <div className="flex max-w-3xl flex-col gap-gb-xl">
          <div className="flex flex-col gap-gb-xs">
            <div className="flex items-center gap-gb-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              <p className="text-gb-xs font-bold uppercase tracking-[0.14em] text-fg-brand">
                Applicant Snapshot
              </p>
            </div>
            <h2
              id="applicant-snapshot-title"
              className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg"
              data-no-auto-translate
            >
              {headline}
            </h2>
          </div>

          <p className="text-gb-sm md:text-gb-md leading-relaxed text-fg-secondary" data-no-auto-translate>
            {summary}
          </p>

          {report.overallSummary?.paragraphs[0] ? (
            <div
              className="relative flex flex-col gap-gb-xs rounded-gb-xl border border-line/60 bg-surface-muted/60 p-gb-lg"
              data-no-auto-translate
            >
              <div className="flex items-center gap-gb-xs">
                <KitIcon art={ICONS.messageChatCircle} frame={14} className="text-fg-brand" />
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {t('Overall impression')}
                </p>
              </div>
              <p className="text-gb-sm leading-relaxed text-fg-secondary">
                <FormattedProse text={report.overallSummary.paragraphs[0]} />
              </p>
            </div>
          ) : null}

          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-gb-xs pt-gb-xs" aria-label="Applicant profile themes">
              <span className="mr-gb-xs text-gb-xs font-medium text-fg-muted">
                {t('Key themes')}:
              </span>
              {tags.map((tag) => (
                <Badge key={tag} variant="brand-chip">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        {/* Structured Evidence & Status Sidebar */}
        <div className="flex flex-col justify-between gap-gb-lg rounded-gb-xl border border-line/80 bg-surface-muted/50 p-gb-xl">
          <div className="flex flex-col gap-gb-md">
            <div className="flex items-center justify-between border-b border-line/60 pb-gb-sm">
              <span className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">
                Evidence Base
              </span>
              <KitIcon art={ICONS.chartBreakoutSquare} frame={16} className="text-fg-brand" />
            </div>

            <div className="flex flex-col gap-gb-xxs">
              <p className="font-display text-gb-display-md font-bold tracking-tight text-fg">
                {evidenceCount ?? '—'}
              </p>
              <p className="text-gb-xs leading-relaxed text-fg-tertiary">
                {evidenceCount == null
                  ? 'Evidence count is unavailable for this report version.'
                  : `${evidenceCount} evidence item${evidenceCount === 1 ? '' : 's'} considered in this report.`}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-gb-xs border-t border-line/60 pt-gb-md">
            <div className="flex items-center justify-between">
              <span className="text-gb-xs font-medium text-fg-muted">
                {t('Confidence')}
              </span>
              <ConfidenceBadge confidence={report.overallEvidenceConfidence} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
