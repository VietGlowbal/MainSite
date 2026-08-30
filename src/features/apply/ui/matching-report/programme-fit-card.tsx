'use client';

import { useT } from '@/lib/i18n';
import type { MatchingV3Metric, MatchingV3MetricStatus } from '@/lib/ai/matching/domain';
import { V3MetricDetails, type V3EvidenceItem, type V3TargetSource } from './v3-report-details';

export type ProgrammeDimension = {
  id: string;
  label: string;
  score: number | null;
  metric?: MatchingV3Metric;
};

type ProgrammeFitCardProps = {
  courseName: string;
  dimensions: ProgrammeDimension[];
  strongestFit?: string;
  potentialGap?: string;
  recommendation?: string;
  fitScore?: number | null | undefined;
  fitStatus?: MatchingV3MetricStatus | undefined;
  fitCoverage?: number | undefined;
  fitConfidence?: number | undefined;
  fitSummary?: string | undefined;
  evidenceIndex?: V3EvidenceItem[] | undefined;
  targetSourceIndex?: V3TargetSource[] | undefined;
};

const VIEWBOX_W = 400;
const VIEWBOX_H = 300;
const RADAR_CENTER_X = 200;
const RADAR_CENTER_Y = 145;
const RADAR_MAX_RADIUS = 82;
const RINGS = [0.25, 0.5, 0.75, 1];

function angleFor(index: number, count: number): number {
  return (index / count) * Math.PI * 2 - Math.PI / 2;
}

function pointFor(index: number, count: number, radiusFraction: number): { x: number; y: number } {
  const angle = angleFor(index, count);
  return {
    x: RADAR_CENTER_X + Math.cos(angle) * RADAR_MAX_RADIUS * radiusFraction,
    y: RADAR_CENTER_Y + Math.sin(angle) * RADAR_MAX_RADIUS * radiusFraction,
  };
}

function pointsAttr(points: readonly { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function ProgrammeFitCard({
  courseName,
  dimensions,
  strongestFit,
  potentialGap,
  recommendation,
  fitScore,
  fitStatus,
  fitCoverage,
  fitConfidence,
  fitSummary,
  evidenceIndex,
  targetSourceIndex,
}: ProgrammeFitCardProps) {
  const t = useT();

  const count = dimensions.length;
  const hasShape = count >= 3;

  const defaultStrongest =
    strongestFit ||
    t(
      'Your motivations and career direction align strongly with what this programme offers and where it can take you.',
    );

  const defaultGap =
    potentialGap ||
    t(
      'Research exposure is the key area to deepen. Consider projects, independent research, or publications to strengthen this dimension.',
    );

  const defaultRecommendation =
    recommendation ||
    t(
      'Highlight analytical projects, case competitions, or research initiatives in your applications and interviews.',
    );

  return (
    <div className="flex flex-col gap-gb-lg rounded-gb-2xl border border-line bg-surface p-gb-lg shadow-gb-xs sm:p-gb-xl">
      <div className="grid grid-cols-1 gap-gb-xl lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        {/* Column 1: Programme Fit Overview + Unclipped Radar Chart */}
        <div className="flex min-w-0 flex-col items-center border-b border-line/60 pb-gb-xl lg:border-b-0 lg:border-r lg:pb-0 lg:pr-gb-xl">
          <div className="flex flex-col gap-gb-2xs text-left w-full">
            <h3 className="text-gb-sm font-bold text-fg">{t('Programme Fit Overview')}</h3>
            <p className="line-clamp-3 text-gb-xs leading-relaxed text-fg-tertiary" title={fitSummary || undefined}>
              {fitSummary || t('Your alignment with the {course} programme based on curriculum, skills, experience, and career goals.', {
                  course: courseName,
                })}
            </p>
            {fitScore !== undefined ? (
              <div className="mt-gb-sm flex flex-wrap gap-x-gb-sm gap-y-1 text-[10px] text-fg-muted">
                <span>{t('Match score')}: {fitScore === null ? t('Not assessed') : `${Math.round(fitScore)}/100`}</span>
                {fitStatus ? <span>{t('Evidence status')}: {t(fitStatus === 'limited' ? 'Limited evidence' : fitStatus === 'not_available' ? 'Not available' : 'Assessed')}</span> : null}
                {fitCoverage !== undefined ? <span>{t('Evidence coverage')}: {fitCoverage}%</span> : null}
                {fitConfidence !== undefined ? <span>{t('Confidence')}: {Math.round(fitConfidence * 100)}%</span> : null}
              </div>
            ) : null}
          </div>

          {/* SVG Radar Chart with generous bounds */}
          <div className="mt-gb-md flex w-full flex-col items-center py-gb-xs">
            {hasShape ? (
              <div className="w-full max-w-[340px] flex items-center justify-center">
                <svg
                  viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                  className="w-full h-auto select-none"
                  role="img"
                  aria-label={t('Programme Fit Radar Chart')}
                >
                  {/* Background Concentric Rings (Pentagons) */}
                  {RINGS.map((fraction) => (
                    <polygon
                      key={fraction}
                      points={pointsAttr(dimensions.map((_, index) => pointFor(index, count, fraction)))}
                      fill="none"
                      stroke="var(--color-gb-neutral-200)"
                      strokeWidth={1}
                    />
                  ))}

                  {/* Radial Axis Lines */}
                  {dimensions.map((datum, index) => {
                    const p = pointFor(index, count, 1);
                    return (
                      <line
                        key={`axis-${datum.id}`}
                        x1={RADAR_CENTER_X}
                        y1={RADAR_CENTER_Y}
                        x2={p.x}
                        y2={p.y}
                        stroke="var(--color-gb-neutral-200)"
                        strokeWidth={1}
                      />
                    );
                  })}

                  {/* Ideal Profile (Dashed Benchmark Polygon) */}
                  <polygon
                    points={pointsAttr(dimensions.map((_, index) => pointFor(index, count, 0.95)))}
                    fill="none"
                    stroke="currentColor"
                    className="text-neutral-400"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />

                  {/* Your Fit Polygon (Filled Brand) */}
                  <polygon
                    points={pointsAttr(
                      dimensions.map((datum, index) =>
                        pointFor(
                          index,
                          count,
                          datum.score === null ? 0 : Math.max(0, Math.min(100, datum.score)) / 100,
                        ),
                      ),
                    )}
                    fill="currentColor"
                    className="text-brand"
                    fillOpacity={0.18}
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                  />

                  {/* Vertex Points */}
                  {dimensions.map((datum, index) => {
                    if (datum.score === null) return null;
                    const p = pointFor(index, count, Math.max(0, Math.min(100, datum.score)) / 100);
                    return (
                      <circle
                        key={`point-${datum.id}`}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="currentColor"
                        className="text-brand"
                      />
                    );
                  })}

                  {/* Axis Labels positioned safely */}
                  {dimensions.map((datum, index) => {
                    const angle = angleFor(index, count);
                    // Placement vectors
                    let anchor: 'start' | 'middle' | 'end' = 'middle';
                    let lx = RADAR_CENTER_X + Math.cos(angle) * (RADAR_MAX_RADIUS + 18);
                    let ly = RADAR_CENTER_Y + Math.sin(angle) * (RADAR_MAX_RADIUS + 18);

                    if (index === 0) {
                      // Top
                      anchor = 'middle';
                      ly = RADAR_CENTER_Y - RADAR_MAX_RADIUS - 12;
                    } else if (index === 1) {
                      // Top-Right
                      anchor = 'start';
                      lx = RADAR_CENTER_X + Math.cos(angle) * RADAR_MAX_RADIUS + 12;
                    } else if (index === 2) {
                      // Bottom-Right
                      anchor = 'start';
                      lx = RADAR_CENTER_X + Math.cos(angle) * RADAR_MAX_RADIUS + 10;
                      ly = RADAR_CENTER_Y + Math.sin(angle) * RADAR_MAX_RADIUS + 14;
                    } else if (index === 3) {
                      // Bottom-Left
                      anchor = 'end';
                      lx = RADAR_CENTER_X + Math.cos(angle) * RADAR_MAX_RADIUS - 10;
                      ly = RADAR_CENTER_Y + Math.sin(angle) * RADAR_MAX_RADIUS + 14;
                    } else if (index === 4) {
                      // Top-Left
                      anchor = 'end';
                      lx = RADAR_CENTER_X + Math.cos(angle) * RADAR_MAX_RADIUS - 12;
                    }

                    const labelText = t(datum.label);
                    const splitIdx = labelText.indexOf(' & ');

                    if (splitIdx > 0) {
                      const line1 = labelText.slice(0, splitIdx + 3);
                      const line2 = labelText.slice(splitIdx + 3);
                      return (
                        <text
                          key={`label-${datum.id}`}
                          x={lx}
                          y={ly - 5}
                          textAnchor={anchor}
                          className="fill-neutral-700 text-[10px] font-bold sm:text-[11px]"
                        >
                          <tspan x={lx} dy="0">{line1}</tspan>
                          <tspan x={lx} dy="12">{line2}</tspan>
                        </text>
                      );
                    }

                    return (
                      <text
                        key={`label-${datum.id}`}
                        x={lx}
                        y={ly}
                        textAnchor={anchor}
                        dominantBaseline="central"
                        className="fill-neutral-700 text-[10px] font-bold sm:text-[11px]"
                      >
                        {labelText}
                      </text>
                    );
                  })}
                </svg>
              </div>
            ) : null}

            {/* Radar Legend */}
            <div className="mt-gb-sm flex items-center justify-center gap-gb-lg text-gb-xs">
              <div className="flex items-center gap-1.5 font-medium text-brand">
                <span className="h-0.5 w-4 rounded-full bg-brand" />
                <span>{t('Your Fit')}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium text-fg-muted">
                <span className="h-0.5 w-4 border-b border-dashed border-neutral-400" />
                <span>{t('Ideal Profile')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Dimension Summary (Horizontal Bars) */}
        <div className="flex min-w-0 flex-col border-b border-line/60 pb-gb-xl lg:border-b-0 lg:pb-0">
          <div className="flex flex-col gap-gb-2xs">
            <h3 className="text-gb-sm font-bold text-fg">{t('Dimension Summary')}</h3>
            <p className="text-gb-xs text-fg-tertiary">
              {t('Detailed evaluation across the programme’s distinct focus areas.')}
            </p>
          </div>

          <div className="mt-gb-md flex flex-col gap-gb-md">
            {dimensions.map((dim) => {
              if (dim.metric) {
                return (
                  <V3MetricDetails
                    key={dim.id}
                    label={dim.label}
                    metric={dim.metric}
                    evidenceIndex={evidenceIndex}
                    targetSourceIndex={targetSourceIndex}
                  />
                );
              }
              const val = dim.score !== null ? Math.max(0, Math.min(100, Math.round(dim.score))) : null;
              return (
                <div key={dim.id} className="flex flex-col gap-gb-2xs">
                  <div className="flex items-center justify-between text-gb-xs">
                    <span className="font-semibold text-fg truncate pr-2">{t(dim.label)}</span>
                    <span className="font-bold text-fg shrink-0">
                      {val !== null ? (
                        <>
                          {val} <span className="font-normal text-fg-muted">/100</span>
                        </>
                      ) : (
                        <span className="text-fg-muted font-normal">{t('Not assessed')}</span>
                      )}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                    {val !== null && val > 0 ? (
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${val}%` }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Strategic Insights Callouts */}
        <div className="grid min-w-0 grid-cols-1 gap-gb-md border-t border-line/60 pt-gb-lg sm:grid-cols-3 lg:col-span-2">
          {/* 1. Strongest Fit */}
          <div className="flex flex-col gap-gb-2xs rounded-gb-xl bg-surface-subtle/40 p-gb-md">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{t('Strongest Fit')}</span>
            </div>
            <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
              {defaultStrongest}
            </p>
          </div>

          {/* 2. Potential Gap */}
          <div className="flex flex-col gap-gb-2xs rounded-gb-xl bg-surface-subtle/40 p-gb-md sm:border-l sm:border-line/60 sm:pl-gb-lg">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700">
              <svg className="h-3.5 w-3.5 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{t('Potential Gap')}</span>
            </div>
            <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
              {defaultGap}
            </p>
          </div>

          {/* 3. Recommendation */}
          <div className="flex flex-col gap-gb-2xs rounded-gb-xl bg-surface-subtle/40 p-gb-md sm:border-l sm:border-line/60 sm:pl-gb-lg">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-700">
              <svg className="h-3.5 w-3.5 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
              </svg>
              <span>{t('Recommendation')}</span>
            </div>
            <p className="text-gb-xs leading-relaxed text-fg-secondary break-words">
              {defaultRecommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
