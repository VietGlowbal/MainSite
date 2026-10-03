'use client';

import type { PersonalReportV2 } from '../../domain';
import { Badge, ICONS, KitIcon, type KitIconArt } from '@/shared/ui';
import { useT } from '@/lib/i18n';

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

type SnapshotSection = {
  readonly title?: string;
  readonly content: string;
};

const SECTION_ICONS: Record<string, KitIconArt> = {
  'Overall Identity': ICONS.usersTwo,
  'Core Identity': ICONS.usersTwo,
  'Unique Positioning': ICONS.zapFast,
  'Profile Positioning': ICONS.zapFast,
  'Positioning': ICONS.zapFast,
  'Most Prominent Recurring Pattern': ICONS.chartBreakoutSquare,
  'Recurring Pattern': ICONS.chartBreakoutSquare,
  'Signature Pattern': ICONS.chartBreakoutSquare,
  'Potential/Development Direction': ICONS.arrowRight,
  'Potential / Development Direction': ICONS.arrowRight,
  'Development Direction': ICONS.arrowRight,
  'Future Direction': ICONS.arrowRight,
};

/**
 * Parses snapshot narrative into structured sections if section headings exist
 * (e.g. "Overall Identity: ... Unique Positioning: ... Most Prominent Recurring Pattern: ...")
 * or multiple paragraphs. Falls back to a single paragraph.
 */
function parseSnapshotSections(text: string): SnapshotSection[] {
  if (!text || typeof text !== 'string') return [];

  // Match section headers like "Overall Identity:", "**Unique Positioning:**", etc.
  const headerRegex = /(?:^|(?<=[.!?]\s+|\n+))(?:\*\*)?([A-Z][A-Za-z0-9/–—\s]{2,40}):?(?:\*\*)?:?\s*/g;
  const matches = [...text.matchAll(headerRegex)];

  if (matches.length >= 2) {
    const sections: SnapshotSection[] = [];

    // Any introductory text before the first heading
    const firstMatch = matches[0];
    if (firstMatch.index > 0) {
      const intro = text.slice(0, firstMatch.index).trim();
      if (intro) {
        sections.push({ content: intro });
      }
    }

    matches.forEach((m, idx) => {
      const title = m[1].trim();
      const nextMatch = matches[idx + 1];
      const start = m.index + m[0].length;
      const end = nextMatch ? nextMatch.index : text.length;
      const content = text.slice(start, end).trim();
      if (content) {
        sections.push({ title, content });
      }
    });

    return sections;
  }

  // Fallback: split by double newlines into distinct paragraphs if present
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.map((p) => {
      const inlineMatch = p.match(/^(?:\*\*)?([A-Z][A-Za-z0-9/–—\s]{2,40}):?(?:\*\*)?:?\s+(.*)$/s);
      if (inlineMatch) {
        return { title: inlineMatch[1].trim(), content: inlineMatch[2].trim() };
      }
      return { content: p };
    });
  }

  return [{ content: text.trim() }];
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

  const sections = parseSnapshotSections(summary);

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

          {sections.length > 1 || (sections.length === 1 && sections[0].title) ? (
            <div className="flex flex-col gap-gb-md" data-no-auto-translate>
              {sections.map((section, idx) => {
                const icon = section.title ? SECTION_ICONS[section.title] : undefined;
                return (
                  <div
                    key={idx}
                    className="flex flex-col gap-gb-xs rounded-gb-xl border border-line/70 bg-surface-muted/30 p-gb-lg transition-colors hover:border-line hover:bg-surface-muted/50"
                  >
                    {section.title ? (
                      <div className="flex items-center gap-gb-sm">
                        {icon ? (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-gb-md bg-brand-surface text-fg-brand">
                            <KitIcon art={icon} frame={14} />
                          </span>
                        ) : (
                          <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                        )}
                        <h3 className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                          {t(section.title)}
                        </h3>
                      </div>
                    ) : null}
                    <p className="text-gb-sm md:text-gb-md leading-relaxed text-fg-secondary">
                      <FormattedProse text={section.content} />
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gb-sm md:text-gb-md leading-relaxed text-fg-secondary" data-no-auto-translate>
              <FormattedProse text={summary} />
            </p>
          )}

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

        </div>
      </div>
    </section>
  );
}
