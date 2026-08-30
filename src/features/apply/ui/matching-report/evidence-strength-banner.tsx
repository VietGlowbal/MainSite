'use client';

import { useT } from '@/lib/i18n';
import { safeV3Url, v3EvidenceStatusLabel, type V3EvidenceItem, type V3TargetSource } from './v3-report-details';

type EvidenceStrengthBannerProps = {
  coverage?: number;
  confidence?: number;
  description?: string;
  evidenceIndex?: V3EvidenceItem[];
  targetSourceIndex?: V3TargetSource[];
};

export function EvidenceStrengthBanner({
  coverage = 85,
  confidence = 0.8,
  description,
  evidenceIndex = [],
  targetSourceIndex = [],
}: EvidenceStrengthBannerProps) {
  const t = useT();

  // Determine active segments out of 5 based on coverage and confidence
  const scoreCombined = (coverage * 0.5 + (confidence * 100) * 0.5);
  const activeSegments = Math.max(1, Math.min(5, Math.round((scoreCombined / 100) * 5)));

  const defaultDesc =
    description ||
    t(
      'This analysis is based on your academic record, test scores, work experience, extracurricular activities, essays, and alignment with the university and programme priorities.',
    );

  const segmentColors = [
    'bg-rose-100',
    'bg-rose-200',
    'bg-rose-400',
    'bg-rose-600',
    'bg-rose-700',
  ];

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs">
      <div className="flex flex-col justify-between gap-gb-lg md:flex-row md:items-center">
        {/* Left: Icon + Content */}
        <div className="flex items-start gap-gb-md min-w-0 max-w-2xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-brand">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <div className="flex flex-col gap-gb-2xs">
          <h3 className="text-gb-sm font-bold text-fg">{t('Evidence Behind the Fit')}</h3>
          <p className="text-gb-xs leading-relaxed text-fg-secondary">
            {defaultDesc}
          </p>
        </div>
        </div>

        {/* Right: Segmented Strength Meter */}
        <div className="flex shrink-0 flex-col gap-gb-2xs md:items-end">
        <span className="text-gb-xs font-semibold text-fg-secondary">
          {t('Evidence Strength')}
        </span>

        {/* 5 Segmented Bars */}
        <div className="flex items-center gap-1.5">
          {segmentColors.map((colorClass, idx) => {
            const isActive = idx < activeSegments;
            return (
              <div
                key={idx}
                className={`h-3 w-7 rounded-xs transition-all ${
                  isActive ? colorClass : 'bg-neutral-100'
                }`}
              />
            );
          })}
        </div>

        <div className="flex w-full items-center justify-between text-[10px] font-semibold uppercase text-fg-muted">
          <span>{t('Moderate')}</span>
          <span>{t('Very Strong')}</span>
        </div>
        </div>
      </div>

      {evidenceIndex.length > 0 || targetSourceIndex.length > 0 ? (
        <div className="border-t border-line/60 pt-gb-md">
          <div className="mb-gb-sm flex flex-wrap items-center justify-between gap-gb-xs">
            <h4 className="text-gb-sm font-bold text-fg">{t('Evidence records and target sources')}</h4>
            <span className="text-[11px] text-fg-muted">{evidenceIndex.length} {t('evidence records')} · {targetSourceIndex.length} {t('target sources')}</span>
          </div>
          <div className="grid grid-cols-1 gap-gb-md lg:grid-cols-2">
            <div className="max-h-72 overflow-auto rounded-gb-lg border border-line/70 bg-surface-subtle/30 p-gb-sm">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Applicant evidence')}</h5>
              <div className="mt-gb-xs flex flex-col gap-gb-sm">
                {evidenceIndex.length > 0 ? evidenceIndex.map((item) => (
                  <div key={item.id} className="rounded-gb-md border border-line/60 bg-surface p-gb-sm">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-gb-xs font-semibold text-fg">{item.label}</span>
                      <span className="text-[10px] font-semibold text-fg-muted">{v3EvidenceStatusLabel(item.status, t)}{item.direct ? ` · ${t('Direct evidence')}` : ''}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">{item.statement}</p>
                    {item.sourceRefs.length > 0 ? <p className="mt-1 text-[10px] text-fg-muted">{t('Source references')}: {item.sourceRefs.join(', ')}</p> : null}
                  </div>
                )) : <p className="text-gb-xs text-fg-muted">{t('No applicant evidence was recorded.')}</p>}
              </div>
            </div>
            <div className="max-h-72 overflow-auto rounded-gb-lg border border-line/70 bg-surface-subtle/30 p-gb-sm">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{t('Target sources')}</h5>
              <div className="mt-gb-xs flex flex-col gap-gb-sm">
                {targetSourceIndex.length > 0 ? targetSourceIndex.map((source) => {
                  const href = safeV3Url(source.url);
                  const label = source.title || source.label || source.ref;
                  return (
                    <div key={source.ref} className="rounded-gb-md border border-line/60 bg-surface p-gb-sm">
                      {href ? <a href={href} target="_blank" rel="noreferrer" className="text-gb-xs font-semibold text-brand hover:underline">{label}</a> : <span className="text-gb-xs font-semibold text-fg">{label}</span>}
                      <p className="mt-1 text-[10px] text-fg-muted">{formatSourceKind(source.kind, t)} · {source.ref}</p>
                    </div>
                  );
                }) : <p className="text-gb-xs text-fg-muted">{t('No target sources were recorded.')}</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSourceKind(kind: V3TargetSource['kind'], t: ReturnType<typeof useT>): string {
  switch (kind) {
    case 'university': return t('University source');
    case 'programme': return t('Programme source');
    case 'requirement': return t('Requirement source');
    case 'scholarship': return t('Scholarship source');
  }
}
