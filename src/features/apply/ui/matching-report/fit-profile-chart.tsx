'use client';

import { useT } from '@/lib/i18n';
import type { DimensionKey, FitRow } from '../../domain';

const SHORT_DIMENSION_LABELS: Record<DimensionKey, string> = {
  academicCompetitiveness: 'Học thuật',
  personaAlignment: 'Chương trình & Giá trị',
  careerDirection: 'Định hướng nghề',
  financialFeasibility: 'Tài chính',
  applicationReadiness: 'Sẵn sàng hồ sơ',
};

export function FitProfileChart({ rows }: { rows: FitRow[] }) {
  const t = useT();

  // Find strongest assessed dimension
  const assessedRows = rows.filter((r) => r.assessed && r.percent !== null);
  const maxScore = assessedRows.length > 0 ? Math.max(...assessedRows.map((r) => r.percent ?? 0)) : null;
  const strongestKey = maxScore && maxScore >= 50
    ? assessedRows.find((r) => r.percent === maxScore)?.key
    : null;

  // Chart Dimensions (SVG viewport)
  const width = 640;
  const height = 220;
  const marginTop = 36;
  const marginBottom = 20;
  const marginLeft = 55;
  const marginRight = 20;

  const chartWidth = width - marginLeft - marginRight;
  const chartHeight = height - marginTop - marginBottom;

  const yTicks = [0, 20, 40, 60, 80, 100];
  const numBars = rows.length;
  const barSlotWidth = chartWidth / numBars;
  const barWidth = Math.min(68, barSlotWidth * 0.72);

  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-2xl border border-line bg-surface p-gb-xl shadow-xs">
      {/* Title */}
      <div className="flex flex-col items-center justify-center text-center gap-gb-xs border-b border-line/60 pb-gb-lg">
        <h3 className="font-display text-gb-display-xs font-bold tracking-tight text-fg">
          {t('Fit Analysis')}
        </h3>
        <p className="text-gb-sm text-fg-tertiary max-w-xl">
          {t('Dimensional evaluation across course prerequisites and applicant profile')}
        </p>
      </div>

      {/* SVG Analytical Column Chart */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[540px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto overflow-visible select-none"
            role="img"
            aria-label="Fit Analysis Column Chart"
          >
            {/* Y-Axis Label */}
            <text
              x={-(marginTop + chartHeight / 2)}
              y={16}
              transform="rotate(-90)"
              textAnchor="middle"
              className="fill-neutral-500 text-xs font-bold"
            >
              {t('Match (%)')}
            </text>

            {/* Gridlines & Y-Axis Ticks */}
            {yTicks.map((tick) => {
              const y = marginTop + chartHeight - (tick / 100) * chartHeight;
              return (
                <g key={tick}>
                  <line
                    x1={marginLeft}
                    y1={y}
                    x2={width - marginRight}
                    y2={y}
                    stroke={tick === 0 ? 'var(--border-strong)' : 'var(--border-subtle)'}
                    strokeWidth={tick === 0 ? 1.5 : 1}
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={marginLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-neutral-500 text-xs font-semibold"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {rows.map((row, index) => {
              const isStrongest = row.key === strongestKey;
              const slotCenterX = marginLeft + index * barSlotWidth + barSlotWidth / 2;
              const barX = slotCenterX - barWidth / 2;
              const pct = row.percent ?? 0;
              const barH = (pct / 100) * chartHeight;
              const barY = marginTop + chartHeight - barH;

              return (
                <g key={row.key} className="group cursor-default">
                  {row.assessed ? (
                    <>
                      {/* Bar Fill */}
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={Math.max(3, barH)}
                        rx={6}
                        ry={6}
                        className={[
                          'transition-all duration-300',
                          isStrongest
                            ? 'fill-brand hover:brightness-110'
                            : 'fill-brand hover:brightness-105',
                        ].join(' ')}
                      />

                      {/* Score Value Label above bar (Prominent font) */}
                      <text
                        x={slotCenterX}
                        y={barY - 8}
                        textAnchor="middle"
                        className={[
                          'text-sm font-extrabold',
                          isStrongest ? 'fill-brand' : 'fill-neutral-900',
                        ].join(' ')}
                      >
                        {pct}%
                      </text>
                    </>
                  ) : (
                    /* Unassessed Dashed Box */
                    <>
                      <rect
                        x={barX}
                        y={marginTop + chartHeight - 28}
                        width={barWidth}
                        height={28}
                        rx={6}
                        ry={6}
                        fill="var(--bg-subtle)"
                        stroke="var(--border-subtle)"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                      <text
                        x={slotCenterX}
                        y={marginTop + chartHeight - 10}
                        textAnchor="middle"
                        className="fill-neutral-400 text-xs font-bold uppercase"
                      >
                        {t('N/A')}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML X-Axis Column Headers (Wrapped, Legible, Large text) */}
          <div
            className="grid text-center pt-2"
            style={{
              gridTemplateColumns: `repeat(${numBars}, minmax(0, 1fr))`,
              paddingLeft: `${(marginLeft / width) * 100}%`,
              paddingRight: `${(marginRight / width) * 100}%`,
            }}
          >
            {rows.map((row) => {
              const isStrongest = row.key === strongestKey;
              return (
                <div key={row.key} className="flex flex-col items-center justify-start px-1">
                  <span
                    className={[
                      'text-xs sm:text-sm font-bold leading-tight',
                      isStrongest ? 'text-brand' : 'text-fg',
                    ].join(' ')}
                  >
                    {t(SHORT_DIMENSION_LABELS[row.key] || row.label)}
                  </span>
                  <span className="mt-1 text-[11px] text-fg-muted line-clamp-2 hidden sm:block">
                    {t(row.label)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
