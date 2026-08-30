'use client';

import { useT } from '@/lib/i18n';
import type {
  MatchingReportV3,
  MatchingV3Metric,
  MatchingV3MetricStatus,
} from '@/lib/ai/matching/domain';

export type V3EvidenceItem = MatchingReportV3['evidenceIndex'][number];
export type V3TargetSource = MatchingReportV3['targetSourceIndex'][number];

type Translate = ReturnType<typeof useT>;

export function safeV3Url(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function formatV3Identifier(value: string): string {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function v3MetricStatusLabel(status: MatchingV3MetricStatus, t: Translate): string {
  switch (status) {
    case 'assessed':
      return t('Assessed');
    case 'limited':
      return t('Limited evidence');
    case 'not_available':
      return t('Not available');
  }
}

export function v3EvidenceStatusLabel(status: V3EvidenceItem['status'], t: Translate): string {
  switch (status) {
    case 'verified':
      return t('Verified');
    case 'unverified':
      return t('Unverified');
    case 'conflicting':
      return t('Conflicting');
    case 'report_only':
      return t('Report only');
  }
}

export function V3ReferenceList({
  evidenceIds = [],
  targetSourceRefs = [],
  metricIds = [],
  metricLabels = {},
  evidenceIndex = [],
  targetSourceIndex = [],
}: {
  evidenceIds?: string[] | undefined;
  targetSourceRefs?: string[] | undefined;
  metricIds?: string[] | undefined;
  metricLabels?: Record<string, string> | undefined;
  evidenceIndex?: V3EvidenceItem[] | undefined;
  targetSourceIndex?: V3TargetSource[] | undefined;
}) {
  const t = useT();
  const evidenceById = new Map(evidenceIndex.map((item) => [item.id, item]));
  const sourceByRef = new Map(targetSourceIndex.map((item) => [item.ref, item]));
  const hasReferences = evidenceIds.length > 0 || targetSourceRefs.length > 0 || metricIds.length > 0;

  if (!hasReferences) return null;

  return (
    <details className="group mt-gb-sm rounded-gb-lg border border-line/70 bg-surface-subtle/40 px-gb-sm py-gb-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-gb-sm text-gb-xs font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <span>{t('Evidence references')} ({evidenceIds.length}) · {t('Programme source references')} ({targetSourceRefs.length})</span>
        <span className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div className="mt-gb-sm flex flex-col gap-gb-sm text-[11px] text-fg-secondary">
        {metricIds.length > 0 ? (
          <div>
            <p className="font-semibold text-fg">{t('Linked metrics')}</p>
            <p>{metricIds.map((id) => metricLabels[id] ?? formatV3Identifier(id)).join(' · ')}</p>
          </div>
        ) : null}

        {evidenceIds.length > 0 ? (
          <div>
            <p className="font-semibold text-fg">{t('Applicant evidence')}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {evidenceIds.map((id) => {
                const item = evidenceById.get(id);
                return (
                  <li key={id}>
                    <span className="font-medium text-fg">{item?.label ?? id}</span>
                    {item ? ` — ${item.statement}` : null}
                    {item ? ` (${v3EvidenceStatusLabel(item.status, t)})` : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {targetSourceRefs.length > 0 ? (
          <div>
            <p className="font-semibold text-fg">{t('Target sources')}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {targetSourceRefs.map((ref) => {
                const source = sourceByRef.get(ref);
                const href = safeV3Url(source?.url ?? null);
                const label = source?.title || source?.label || ref;
                return (
                  <li key={ref}>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        {label}
                      </a>
                    ) : (
                      <span>{label}</span>
                    )}
                    {source?.kind ? ` (${formatV3Identifier(source.kind)})` : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function V3MetricDetails({
  label,
  metric,
  evidenceIndex,
  targetSourceIndex,
}: {
  label: string;
  metric: MatchingV3Metric;
  evidenceIndex?: V3EvidenceItem[] | undefined;
  targetSourceIndex?: V3TargetSource[] | undefined;
}) {
  const t = useT();
  const score = metric.score === null ? null : Math.round(metric.score);

  return (
    <details className="group rounded-gb-lg border border-line/70 bg-surface p-gb-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-gb-xs [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 font-semibold text-fg">{t(label)}</span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="font-bold text-fg">{score === null ? t('Not assessed') : `${score}/100`}</span>
          <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-semibold text-fg-muted">
            {v3MetricStatusLabel(metric.status, t)}
          </span>
          <span className="text-brand transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </span>
      </summary>

      <div className="mt-gb-sm flex flex-col gap-gb-sm border-t border-line/60 pt-gb-sm">
        <div className="grid grid-cols-2 gap-gb-xs text-[11px] text-fg-secondary">
          <span>{t('Evidence coverage')}: <strong className="text-fg">{metric.coverage}%</strong></span>
          <span>{t('Confidence')}: <strong className="text-fg">{Math.round(metric.confidence * 100)}%</strong></span>
        </div>
        {metric.summary ? <p className="text-gb-xs leading-relaxed text-fg-secondary">{metric.summary}</p> : null}

        <div className="flex flex-col gap-gb-xs">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Submetrics')}</h5>
          {metric.submetrics.map((submetric) => {
            const subScore = submetric.score === null ? null : Math.round(submetric.score);
            return (
              <div key={submetric.submetricId} className="rounded-gb-md border border-line/60 bg-surface-subtle/30 p-gb-sm">
                <div className="flex flex-wrap items-center justify-between gap-gb-xs">
                  <span className="font-semibold text-fg">{formatV3Identifier(submetric.submetricId)}</span>
                  <span className="text-[11px] font-semibold text-fg-muted">
                    {subScore === null ? t('Not assessed') : `${subScore}/100`} · {v3MetricStatusLabel(submetric.status, t)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">
                  <strong className="text-fg">{t('Reasoning')}:</strong> {submetric.reasoning}
                </p>
                {submetric.missingEvidence.length > 0 ? (
                  <div className="mt-1 text-[11px] text-amber-800">
                    <strong>{t('Missing evidence')}:</strong> {submetric.missingEvidence.join(' · ')}
                  </div>
                ) : null}
                {submetric.limitations.length > 0 ? (
                  <div className="mt-1 text-[11px] text-fg-muted">
                    <strong>{t('Limitations')}:</strong> {submetric.limitations.join(' · ')}
                  </div>
                ) : null}
                <V3ReferenceList
                  evidenceIds={submetric.applicantEvidenceIds}
                  targetSourceRefs={submetric.targetSourceRefs}
                  evidenceIndex={evidenceIndex}
                  targetSourceIndex={targetSourceIndex}
                />
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

export function V3InsightSections({
  strengths,
  gaps,
  positioningOpportunities,
  evidenceIndex,
  targetSourceIndex,
}: {
  strengths: MatchingReportV3['strengths'];
  gaps: MatchingReportV3['gaps'];
  positioningOpportunities: MatchingReportV3['positioningOpportunities'];
  evidenceIndex: V3EvidenceItem[];
  targetSourceIndex: V3TargetSource[];
}) {
  const t = useT();
  const groups = [
    { title: t('Strengths'), empty: t('No strengths were recorded.'), items: strengths },
    { title: t('Gaps'), empty: t('No gaps were recorded.'), items: gaps },
    { title: t('Positioning Opportunities'), empty: t('No positioning opportunities were recorded.'), items: positioningOpportunities },
  ];

  if (groups.every((group) => group.items.length === 0)) return null;

  return (
    <section className="flex flex-col gap-gb-md" aria-labelledby="matching-supporting-insights">
      <h2 id="matching-supporting-insights" className="font-display text-gb-md font-bold tracking-tight text-fg">
        4. {t('Supporting Insights')}
      </h2>
      <div className="grid grid-cols-1 items-start gap-gb-md lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title} className="flex h-fit flex-col gap-gb-sm rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs">
            <div className="flex items-center justify-between gap-gb-sm">
              <h3 className="text-gb-sm font-bold text-fg">{group.title}</h3>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-fg-muted">{group.items.length}</span>
            </div>
            {group.items.length === 0 ? (
              <p className="text-gb-xs leading-relaxed text-fg-muted">{group.empty}</p>
            ) : (
              <div className="flex flex-col gap-gb-xs">
                {group.items.map((item) => (
                  <article key={item.id} className="rounded-gb-lg border border-line/70 bg-surface-subtle/30 p-gb-sm">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-gb-sm [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="block text-gb-xs font-semibold text-fg">{item.title}</span>
                          <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-fg-secondary group-open:hidden">{item.description}</span>
                        </span>
                        <span className="shrink-0 text-xs text-brand transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
                      </summary>
                      <div className="mt-gb-sm border-t border-line/60 pt-gb-sm">
                        <p className="text-gb-xs leading-relaxed text-fg-secondary">{item.description}</p>
                        <V3ReferenceList
                          evidenceIds={item.evidenceIds}
                          targetSourceRefs={item.targetSourceRefs}
                          evidenceIndex={evidenceIndex}
                          targetSourceIndex={targetSourceIndex}
                        />
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function V3ScholarshipAlignment({
  fit,
  selectedScholarshipKey,
  evidenceIndex,
  targetSourceIndex,
}: {
  fit: MatchingReportV3['scholarshipAlignment'];
  selectedScholarshipKey: string | null;
  evidenceIndex: V3EvidenceItem[];
  targetSourceIndex: V3TargetSource[];
}) {
  const t = useT();

  return (
    <section className="flex flex-col gap-gb-md" aria-labelledby="matching-scholarship-alignment">
      <h2 id="matching-scholarship-alignment" className="font-display text-gb-md font-bold tracking-tight text-fg">
        5. {t('Scholarship Alignment')}
      </h2>
      {fit ? (
        <div className="flex flex-col gap-gb-md rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-gb-sm">
            <div>
              <h3 className="text-gb-sm font-bold text-fg">{selectedScholarshipKey || t('Selected scholarship')}</h3>
              <p className="mt-1 text-gb-xs text-fg-secondary">{fit.summary}</p>
            </div>
            <div className="flex flex-wrap gap-gb-xs text-[11px]">
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-semibold text-fg">{fit.score === null ? t('Not assessed') : `${Math.round(fit.score)}/100`}</span>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-semibold text-fg-muted">{v3MetricStatusLabel(fit.status, t)}</span>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-semibold text-fg-muted">{t('Evidence coverage')}: {fit.coverage}%</span>
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-semibold text-fg-muted">{t('Confidence')}: {Math.round(fit.confidence * 100)}%</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-gb-sm">
            {Object.entries(fit.metrics).map(([id, metric]) => (
              <V3MetricDetails
                key={id}
                label={formatV3Identifier(id)}
                metric={metric}
                evidenceIndex={evidenceIndex}
                targetSourceIndex={targetSourceIndex}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs">
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {selectedScholarshipKey
              ? t('Scholarship alignment is unavailable for the selected scholarship.')
              : t('No selected scholarship was available for this application, so scholarship alignment was not assessed.')}
          </p>
        </div>
      )}
    </section>
  );
}
